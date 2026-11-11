// O4 (plan #30): a plots minor leaves plots-svelte unplanned, with its peer range kept.
// oracle: spec semver, reproduced as in #21: plots-svelte's peer range must still admit the new plots, so
// changesets has no reason to release it or rewrite the range (#83: on changesets 3 a plots minor also plans
// a caret-pinned plots-svelte as a patch, not a major, so "not a major" alone would pass on the old `^0.1.0`).
// It runs `changeset status --output` and `changeset version` in a temp git workspace, never on this repo: the
// live repo's status needs `main` (absent in CI's shallow checkout) and fails once `.changeset/` is empty after
// a release.
// The workspace holds the three packages' real names, versions and peer ranges, a copy of `.changeset/config.json`, one
// changeset per test and an empty root `package-lock.json`: changesets 3 recognises an npm workspace
// only by its lock file (2.x does not need it), so without one 3.x finds no packages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const changeset = createRequire(import.meta.url).resolve('@changesets/cli/bin.js');
const manifest = (dir) => JSON.parse(readFileSync(join(repo, 'packages', dir, 'package.json'), 'utf8'));

const run = (cwd, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}\n${r.stdout}${r.stderr}`);
  return r;
};

// Only what changesets reads: name, version, and the dependency fields that link the packages.
const minimal = ({ name, version, dependencies, peerDependencies }) =>
  JSON.stringify({ name, version, ...(dependencies && { dependencies }), ...(peerDependencies && { peerDependencies }) }, null, 2);

// A temp git workspace with the three packages' real names, versions and peer ranges, on branch `release`, whose
// one commit off `main` adds `bumps` as one changeset. `fn` gets the workspace path and runs changesets in it.
const withWorkspace = (bumps, fn) => {
  const ws = mkdtempSync(join(tmpdir(), 'eleo-release-'));
  try {
    const git = (...args) => run(ws, 'git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args]);
    writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', private: true, workspaces: ['packages/*'] }));
    writeFileSync(join(ws, 'package-lock.json'), '{}');
    for (const dir of ['plots', 'plots-svelte', 'tokens']) {
      mkdirSync(join(ws, 'packages', dir), { recursive: true });
      writeFileSync(join(ws, 'packages', dir, 'package.json'), minimal(manifest(dir)));
    }
    mkdirSync(join(ws, '.changeset'));
    copyFileSync(join(repo, '.changeset/config.json'), join(ws, '.changeset/config.json'));
    git('init', '-q', '-b', 'main');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    git('checkout', '-q', '-b', 'release');
    const front = Object.entries(bumps).map(([name, type]) => `"${name}": ${type}`).join('\n');
    writeFileSync(join(ws, '.changeset/bumps.md'), `---\n${front}\n---\n\nBumps.\n`);
    git('add', '-A');
    git('commit', '-q', '-m', 'bumps');
    fn(ws);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
};
const versioned = (ws, dir) => JSON.parse(readFileSync(join(ws, 'packages', dir, 'package.json'), 'utf8'));

test('a plots minor leaves plots-svelte unplanned and its peer range kept', () => {
  withWorkspace({ '@eleoptics/plots': 'minor' }, (ws) => {
    run(ws, process.execPath, [changeset, 'status', '--output', 'status.json']);
    const { releases } = JSON.parse(readFileSync(join(ws, 'status.json'), 'utf8'));
    const type = (name) => releases.find((r) => r.name === name)?.type;
    assert.equal(type('@eleoptics/plots'), 'minor');
    assert.equal(type('@eleoptics/plots-svelte'), undefined, `plots-svelte is planned: ${JSON.stringify(releases)}`);

    const peer = manifest('plots-svelte').peerDependencies['@eleoptics/plots'];
    run(ws, process.execPath, [changeset, 'version']);
    const svelte = versioned(ws, 'plots-svelte');
    assert.equal(svelte.peerDependencies['@eleoptics/plots'], peer, 'version rewrote the plots-svelte peer range');
    assert.equal(svelte.version, manifest('plots-svelte').version, 'version bumped plots-svelte');
  });
});

// Plan #464 (agent_docs/plans/464-beam-footprint.md), outcome O2 (issue #465; #469 unskips). Row N: the footprint circle
// is a plots minor; plots-svelte ships its widened peer as a patch, in its own file (#85).
// oracle: spec: @changesets/cli's plan of the named files; #457
// Once `changeset version` deleted the files, the twin below reads the CHANGELOG entries they became (#594).
const ROW_N_PLOTS_ENTRY = /`spot` panels take `circle: \{ radius, label \}`/;
const ROW_N_SVELTE_ENTRY = /Peer `@eleoptics\/plots` is now `>=0\.7\.0 <1`/;
const rowNConsumed = ['footprint-circle.md', 'plots-svelte-peer-0.7.md'].every((f) => !existsSync(join(repo, '.changeset', f)))
  && ROW_N_PLOTS_ENTRY.test(readFileSync(join(repo, 'packages/plots/CHANGELOG.md'), 'utf8'))
  && ROW_N_SVELTE_ENTRY.test(readFileSync(join(repo, 'packages/plots-svelte/CHANGELOG.md'), 'utf8'));
test('row N changesets', { skip: rowNConsumed && 'consumed by changeset version' }, () => {
  const read = (f) => {
    const text = readFileSync(join(repo, '.changeset', f), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    assert.ok(m, `.changeset/${f} has no front matter`);
    return { text, body: m[2] };
  };
  const plots = read('footprint-circle.md');
  const svelte = read('plots-svelte-peer-0.7.md');
  assert.match(svelte.body, />=0\.7\.0 <1/, 'the plots-svelte body names the widened peer');
  withWorkspace({ '@eleoptics/plots': 'minor' }, (ws) => {
    rmSync(join(ws, '.changeset/bumps.md'));
    writeFileSync(join(ws, '.changeset/footprint-circle.md'), plots.text);
    writeFileSync(join(ws, '.changeset/plots-svelte-peer-0.7.md'), svelte.text);
    run(ws, 'git', ['add', '-A']);
    run(ws, 'git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'row N']);
    run(ws, process.execPath, [changeset, 'status', '--output', 'status.json']);
    const { releases } = JSON.parse(readFileSync(join(ws, 'status.json'), 'utf8'));
    const type = (name) => releases.find((r) => r.name === name)?.type;
    assert.equal(type('@eleoptics/plots'), 'minor');
    assert.equal(type('@eleoptics/plots-svelte'), 'patch');
    assert.deepEqual(releases.map((r) => r.name).sort(), ['@eleoptics/plots', '@eleoptics/plots-svelte'], 'only plots and plots-svelte are planned');
  });
});

test('row N changesets became a plots minor and a plots-svelte patch',
  { skip: !rowNConsumed && 'changesets not yet versioned' }, () => {
    assert.equal(entry('plots', ROW_N_PLOTS_ENTRY).kind, 'Minor');
    assert.equal(entry('plots-svelte', ROW_N_SVELTE_ENTRY).kind, 'Patch');
  });

// #104 (plan #90): the release asks plots, plots-svelte and tokens minors. A tokens minor falls outside a
// `^0.1.0` peer, so changesets would rewrite it to `^0.2.0` and bump its dependents (the #21 lesson); widened to
// `>=0.1.0 <1`, both tokens peers survive `changeset version` and every package goes exactly one minor.
// oracle: spec semver (a 0.x minor stays inside `<1`), plan #90 Constraints.
test('tokens peers survive version', () => {
  const minor = (v) => v.replace(/^(\d+)\.(\d+)\.\d+$/, (_, M, m) => `${M}.${Number(m) + 1}.0`);
  // the helper itself, past 0.x (review M3 finding 5): a 1.x minor is 1.(m+1).0, not the version unchanged
  assert.deepEqual(['0.1.4', '1.2.3'].map(minor), ['0.2.0', '1.3.0']);
  const dirs = ['plots', 'plots-svelte', 'tokens'];
  withWorkspace(Object.fromEntries(dirs.map((d) => [manifest(d).name, 'minor'])), (ws) => {
    run(ws, process.execPath, [changeset, 'version']);
    for (const dir of dirs) assert.equal(versioned(ws, dir).version, minor(manifest(dir).version), `${dir} is not one minor up`);
    for (const dir of ['plots', 'plots-svelte']) {
      assert.equal(versioned(ws, dir).peerDependencies['@eleoptics/tokens'], '>=0.1.0 <1', `${dir}'s tokens peer`);
    }
  });
});

// #80 (CR #79): changesets/action v1 doesn't support CLI 3 (it finds published packages by `New tag:` in
// stdout, which CLI 3 doesn't print), so a release would tag nothing. v2 renames the inputs and reads the
// token only from its `github-token` input, not the GITHUB_TOKEN env.
// oracle: url https://github.com/changesets/action/tree/v2#api (the v2 README's inputs table; action.yml at
// tag v2 lists the same names).
// Read as text: no YAML parser is a direct dependency, and the jobs' and steps' blocks are all this needs.
const workflow = () => readFileSync(join(repo, '.github/workflows/release.yml'), 'utf8').split('\n');

// The lines from `start` up to the next non-blank line indented no deeper than it.
const block = (lines, start) => {
  const indent = lines[start].search(/\S/);
  const end = lines.findIndex((l, i) => i > start && l.trim() && l.search(/\S/) <= indent);
  return lines.slice(start, end === -1 ? undefined : end);
};
const keysOf = (lines) => lines.slice(1).map((l) => l.match(/^\s*([\w-]+):/)?.[1]).filter(Boolean);
const job = (lines, name) => {
  const start = lines.findIndex((l) => new RegExp(`^  ${name}:\\s*$`).test(l));
  assert.notEqual(start, -1, `release.yml has no ${name} job`);
  return block(lines, start).filter((l) => !/^\s*#/.test(l));
};

test('release workflow uses changesets/action v2 inputs', () => {
  const lines = workflow();
  const steps = lines.flatMap((l, i) => (/^\s*- uses: changesets\/action@/.test(l) ? [block(lines, i)] : []));
  assert.notEqual(steps.length, 0, 'release.yml has no changesets/action step');
  for (const step of steps) {
    const keys = keysOf(step);
    assert.match(step[0], /changesets\/action@v2\s*$/);
    for (const old of ['version', 'publish']) assert.ok(!keys.includes(old), `v1 input ${old}: is still set`);
    assert.match(step.find((l) => /^\s*github-token:/.test(l)) ?? '', /\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/);
  }
  const keys = steps.flatMap(keysOf);
  for (const input of ['version-script', 'publish-script']) assert.ok(keys.includes(input), `no ${input} input`);
});

// Only the publish job may mint an OIDC token, and it runs in the `npm` environment, whose required reviewer
// gates every publish; npm's trusted publisher for each package names that environment, so a publish from
// any other job or environment is refused. The version job's step finds an unpublished version, before
// changesets/action bumps anything, and the publish job runs only when no changesets are pending (PR #142).
// oracle: url https://docs.npmjs.com/trusted-publishers/ (the environment field) and
// https://docs.github.com/actions/reference/workflows-and-actions/workflow-syntax (jobs.<id>.environment,
// jobs.<id>.if, jobs.<id>.outputs).
test('release workflow publishes only from the npm environment', () => {
  const lines = workflow();
  const version = job(lines, 'version');
  const publish = job(lines, 'publish');
  const top = lines.slice(0, lines.findIndex((l) => /^jobs:/.test(l)));
  assert.ok(!top.some((l) => /id-token/.test(l)), 'id-token is granted to every job');
  assert.ok(!version.some((l) => /id-token|environment:/.test(l)), 'the version job can mint an OIDC token');
  assert.ok(!version.some((l) => /publish-script:/.test(l)), 'the version job publishes');
  assert.ok(publish.some((l) => /^\s+environment:\s*npm\s*$/.test(l)), 'the publish job is not in the npm environment');
  assert.ok(publish.some((l) => /^\s+id-token:\s*write\s*$/.test(l)), 'the publish job has no id-token: write');
  assert.ok(publish.some((l) => /^\s+needs:\s*version\s*$/.test(l)));
  assert.ok(publish.some((l) => /^\s+if:\s*needs\.version\.outputs\.publish == 'true'\s*$/.test(l)), 'the publish job runs on every push');
  // With changesets pending, changesets/action versions instead of publishing, which the publish job may not do.
  assert.ok(version.some((l) => /publish:\s*\$\{\{\s*steps\.unpublished\.outputs\.publish == 'true' && steps\.changesets\.outputs\['has-changesets'\] == 'false'\s*\}\}/.test(l)), 'the publish job runs with changesets pending');
  // changesets/action leaves the bumped manifests of pending changesets checked out: the check must read main's.
  const unpublished = version.findIndex((l) => /^\s*- id: unpublished\s*$/.test(l));
  const action = version.findIndex((l) => /^\s*- uses: changesets\/action@/.test(l));
  assert.notEqual(unpublished, -1, 'the version job has no unpublished step');
  assert.ok(unpublished < action, 'the unpublished check reads the manifests changesets/action bumped');
  assert.ok(version.slice(action, action + 2).some((l) => /^\s+id: changesets\s*$/.test(l)), 'the changesets/action step has no id: changesets');
});

// #41: the branch's changesets ask plots minor (the breaking data.layout shape, which plan #30 releases as
// a minor while the major is 0) and an explicit plots-svelte patch, which ships the widened peer range: O4 shows
// changesets would not plan plots-svelte from the plots minor alone.
// #85: two files, because changesets writes a changeset's one body into every package it bumps: the plots-svelte
// patch has its own file, so its changelog entry does not say "Breaking".
// oracle: plan #30's #41 and #85 rows and O4 (spec semver: a patch isn't breaking).
// `changeset version` deletes both files (the Version Packages PR and every release after it), so then the test
// reads the CHANGELOG entries they became instead. One file without the other still fails.
const consumed = ['layouts.md', 'layouts-svelte-peer.md'].every((f) => !existsSync(join(repo, '.changeset', f)));

// The changelog entry whose text matches `re`, with the `### <kind> Changes` heading it sits under.
const entry = (dir, re) => {
  let kind;
  for (const line of readFileSync(join(repo, 'packages', dir, 'CHANGELOG.md'), 'utf8').split('\n')) {
    kind = line.match(/^### (\w+) Changes/)?.[1] ?? kind;
    if (line.startsWith('- ') && re.test(line)) return { kind, text: line };
  }
  assert.fail(`packages/${dir}/CHANGELOG.md has no entry matching ${re}`);
};

test('layouts changeset became a plots minor and a plots-svelte patch', { skip: !consumed && 'changesets not yet versioned' }, () => {
  const plots = entry('plots', /data\.layout/);
  // The plots peer by name: later entries widen other peers to the same range (tokens, in 0.2.0).
  const svelte = entry('plots-svelte', /`@eleoptics\/plots` peer range to `>=0\.1\.0 <1`/);
  assert.equal(plots.kind, 'Minor');
  assert.equal(svelte.kind, 'Patch');
  assert.doesNotMatch(svelte.text, /breaking/i);
  assert.ok(!/data\.layout/.test(readFileSync(join(repo, 'packages/plots-svelte/CHANGELOG.md'), 'utf8')), 'the plots-svelte changelog carries the layouts body');
});

// The one front-matter parser: a changeset file's bumps and its trimmed body.
const parse = (file) => {
  const text = readFileSync(join(repo, '.changeset', file), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `.changeset/${file} has no front matter`);
  const bumps = Object.fromEntries(m[1].split('\n').map((l) => l.match(/^"([^"]+)":\s*(\w+)\s*$/)).filter(Boolean).map((r) => [r[1], r[2]]));
  return { bumps, body: m[2].trim() };
};

test('layouts changeset asks plots minor, plots-svelte patch', { skip: consumed && 'consumed by changeset version' }, () => {
  const plots = parse('layouts.md');
  const svelte = parse('layouts-svelte-peer.md');
  assert.deepEqual({ ...plots.bumps, ...svelte.bumps }, { '@eleoptics/plots': 'minor', '@eleoptics/plots-svelte': 'patch' });
  // each file bumps only its own package: changesets writes a file's body into every package it bumps (#85, #87)
  assert.deepEqual(Object.keys(plots.bumps), ['@eleoptics/plots'], 'the plots file bumps another package');
  assert.deepEqual(Object.keys(svelte.bumps), ['@eleoptics/plots-svelte'], 'the plots-svelte file bumps another package');
  assert.doesNotMatch(svelte.body, /breaking/i);
  assert.match(svelte.body, />=0\.1\.0 <1/);
});

// Plan #144 (agent_docs/plans/144-layout-defaults.md), O4, issue #145: the branch's changeset asks a plots minor only.
// oracle: spec roadmap row L exit (the release is planned); semver 0.x: a minor carries a look change (the #41
// precedent, above). `changeset version` deletes the file, so then the twin reads the CHANGELOG entry it became.
// The file is consumed once it is gone and the entry is there; gone with no entry means it was never written.
const LAYOUT_ENTRY = /field labels 6 px past the image plane/;
const layoutDefaultsConsumed = !existsSync(join(repo, '.changeset', 'layout-defaults.md'))
  && LAYOUT_ENTRY.test(readFileSync(join(repo, 'packages/plots/CHANGELOG.md'), 'utf8'));

test('layout defaults changeset asks a plots minor', { skip: layoutDefaultsConsumed && 'consumed by changeset version' }, () => {
  const text = readFileSync(join(repo, '.changeset', 'layout-defaults.md'), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, '.changeset/layout-defaults.md has no front matter');
  const bumps = Object.fromEntries(m[1].split('\n').map((l) => l.match(/^"([^"]+)":\s*(\w+)\s*$/)).filter(Boolean).map((r) => [r[1], r[2]]));
  assert.deepEqual(bumps, { '@eleoptics/plots': 'minor' });
});

test('layout defaults changeset became a plots minor', { skip: !layoutDefaultsConsumed && 'changesets not yet versioned' }, () => {
  assert.equal(entry('plots', LAYOUT_ENTRY).kind, 'Minor');
});

// Plan #162 (agent_docs/plans/162-curve-typed.md), O6, issue #181.
// oracle: spec roadmap Constraints (a typed API added alongside the old ships as a minor); semver 0.x.
// plots-svelte's peer range >=0.1.0 <1 admits it, so it gets no bump (plan #30's O4, above).
// Read as the layout-defaults pair above: the file, or once `changeset version` deleted it, the CHANGELOG entry.
const CURVE_ENTRY = /typed curve/i;
const curveTypedConsumed = !existsSync(join(repo, '.changeset', 'curve-typed.md'))
  && CURVE_ENTRY.test(readFileSync(join(repo, 'packages/plots/CHANGELOG.md'), 'utf8'));

test('curve-typed changeset asks a plots minor', { skip: curveTypedConsumed && 'consumed by changeset version' }, () => {
  const text = readFileSync(join(repo, '.changeset', 'curve-typed.md'), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, '.changeset/curve-typed.md has no front matter');
  const bumps = Object.fromEntries(m[1].split('\n').map((l) => l.match(/^"([^"]+)":\s*(\w+)\s*$/)).filter(Boolean).map((r) => [r[1], r[2]]));
  assert.deepEqual(bumps, { '@eleoptics/plots': 'minor' });
});

test('curve-typed changeset became a plots minor', { skip: !curveTypedConsumed && 'changesets not yet versioned' }, () => {
  assert.equal(entry('plots', CURVE_ENTRY).kind, 'Minor');
});

// Plan #232 (agent_docs/plans/232-panels-spot.md), O4, issue #242; #245 adds the changeset, #246 unskips.
// oracle: spec roadmap Constraints (a typed API added alongside the old ships as a minor); semver 0.x.
// Read as the curve-typed pair above: the file, or once `changeset version` deleted it, the CHANGELOG entry (#279).
const PANELS_ENTRY = /Curve panels and a typed spot/;
const panelsSpotConsumed = !existsSync(join(repo, '.changeset', 'panels-spot.md'))
  && PANELS_ENTRY.test(readFileSync(join(repo, 'packages/plots/CHANGELOG.md'), 'utf8'));

test('panels-spot changeset asks a plots minor', { skip: panelsSpotConsumed && 'consumed by changeset version' }, () => {
  const text = readFileSync(join(repo, '.changeset', 'panels-spot.md'), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, '.changeset/panels-spot.md has no front matter');
  const bumps = Object.fromEntries(m[1].split('\n').map((l) => l.match(/^"([^"]+)":\s*(\w+)\s*$/)).filter(Boolean).map((r) => [r[1], r[2]]));
  assert.deepEqual(bumps, { '@eleoptics/plots': 'minor' });
});

test('panels-spot changeset became a plots minor', { skip: !panelsSpotConsumed && 'changesets not yet versioned' }, () => {
  assert.equal(entry('plots', PANELS_ENTRY).kind, 'Minor');
});

// Plan #284 (agent_docs/plans/284-bars-limits.md), O4, issue #295.
// oracle: spec roadmap Constraints (a typed API added alongside the old one ships as a minor); semver 0.x.
// Each file test has a consumed twin reading the CHANGELOG once `changeset version` deleted the file (#279).
// The plots changeset starts **Breaking:** (README.md, Changing things): it names #199's throws.
const BARS_PLOTS_ENTRY = /New: `bars` draws grouped bars/;
const BARS_SVELTE_ENTRY = /New `BarPlot` component/;
const barsConsumed = (file, dir, re) => !existsSync(join(repo, '.changeset', file))
  && re.test(readFileSync(join(repo, 'packages', dir, 'CHANGELOG.md'), 'utf8'));
const barsPlotsConsumed = barsConsumed('bars-limits.md', 'plots', BARS_PLOTS_ENTRY);
const barsSvelteConsumed = barsConsumed('bars-limits-svelte.md', 'plots-svelte', BARS_SVELTE_ENTRY);

test('bars-limits changesets ask plots and plots-svelte minors',
  { skip: (barsPlotsConsumed && barsSvelteConsumed && 'consumed by changeset version') }, () => {
    const plots = parse('bars-limits.md');
    assert.deepEqual(plots.bumps, { '@eleoptics/plots': 'minor' });
    assert.ok(plots.body.startsWith('**Breaking:**'), 'bars-limits.md body must start with **Breaking:**');
    assert.match(plots.body, /TypeError/);
    assert.deepEqual(parse('bars-limits-svelte.md').bumps, { '@eleoptics/plots-svelte': 'minor' });
  });

test('bars-limits changesets became a plots minor and a plots-svelte minor',
  { skip: (!(barsPlotsConsumed && barsSvelteConsumed) && 'changesets not yet versioned') }, () => {
    assert.equal(entry('plots', BARS_PLOTS_ENTRY).kind, 'Minor');
    assert.equal(entry('plots-svelte', BARS_SVELTE_ENTRY).kind, 'Minor');
  });

// Plan #337 (agent_docs/plans/337-ray-status.md), O3, issue #343; #346 adds the changeset, #347 unskips.
// oracle: spec roadmap Constraints (a typed API added alongside the old one ships as a minor); semver 0.x.
// Read as the bars-limits pair above: the file, or once `changeset version` deleted it, the CHANGELOG entry.
// The entry is matched by a phrase only this changeset has (#346), not the generic `alive`.
const RAY_STATUS_ENTRY = /the per-ray alive points/;
const rayStatusConsumed = !existsSync(join(repo, '.changeset', 'ray-status.md'))
  && RAY_STATUS_ENTRY.test(readFileSync(join(repo, 'packages/plots/CHANGELOG.md'), 'utf8'));

test('ray-status changeset asks a plots minor',
  { skip: (rayStatusConsumed && 'consumed by changeset version') }, () => {
    assert.deepEqual(parse('ray-status.md').bumps, { '@eleoptics/plots': 'minor' });
  });

test('ray-status changeset became a plots minor',
  { skip: (!rayStatusConsumed && 'changesets not yet versioned') }, () => {
    assert.equal(entry('plots', RAY_STATUS_ENTRY).kind, 'Minor');
  });

// Plan #389 (agent_docs/plans/389-map2d-typed.md), O3, issue #404; #407 adds the changesets, #408 unskips.
// oracle: spec roadmap Constraints (a typed API added alongside the old one ships as a minor); semver 0.x.
// plots-svelte's `Map2D` takes the typed props, a new feature, so it is a minor too (the bars-limits precedent).
// Read as the bars-limits pair above: the file, or once `changeset version` deleted it, the CHANGELOG entry.
// The entries are matched by phrases only these changesets have (#407 writes them): New: `map2D` takes a typed grid,
// New: `Map2D` takes typed props.
const MAP2D_PLOTS_ENTRY = /New: `map2D` takes a typed grid/;
const MAP2D_SVELTE_ENTRY = /New: `Map2D` takes typed props/;
const map2dPlotsConsumed = barsConsumed('map2d-typed.md', 'plots', MAP2D_PLOTS_ENTRY);
const map2dSvelteConsumed = barsConsumed('map2d-typed-svelte.md', 'plots-svelte', MAP2D_SVELTE_ENTRY);

test('map2D changeset asks minors',
  { skip: (map2dPlotsConsumed && map2dSvelteConsumed && 'consumed by changeset version') }, () => {
    assert.deepEqual(parse('map2d-typed.md').bumps, { '@eleoptics/plots': 'minor' });
    assert.deepEqual(parse('map2d-typed-svelte.md').bumps, { '@eleoptics/plots-svelte': 'minor' });
  });

test('map2D changeset became minors',
  { skip: (!(map2dPlotsConsumed && map2dSvelteConsumed) && 'changesets not yet versioned') }, () => {
    assert.equal(entry('plots', MAP2D_PLOTS_ENTRY).kind, 'Minor');
    assert.equal(entry('plots-svelte', MAP2D_SVELTE_ENTRY).kind, 'Minor');
  });

// Plan #389, issue #333 (CR #332's `later`), raised by #457 (plan #464): BarPlot needs `bars` (plots 0.5.0) and the typed
// Map2D needs `map2D` (plots 0.7.0), so the plots-svelte peer must exclude 0.6.0 and admit 0.7.0. Plots is 0.7.0 on npm and in
// the workspace, so `npm ci` resolves.
// oracle: spec semver (a `>=X.Y.Z <M` range admits v when X.Y.Z <= v and v's major < M).
// Issue #598 (plan #512 M3 review): the wrappers draw at a width, which needs plots 0.8.0 (row O's minor, ADR-0003), so the
// peer also excludes 0.7.0, where rayFan ignores `width`.
// Issue #1006 (CR #1005, plan #804 M4): the wrappers import `interact`, so the floor is the plots version this release makes:
// plots' package.json version plus the highest bump among the pending plots changesets. The test derives it, not a fixed
// 0.10.0, so a plots release on main before the merge (the pending bumps then add to a higher version) turns it red.
// Read as the consumed-changeset pairs above: while a plots changeset is pending, the floor is the version it makes; once
// `changeset version` consumed them all (the Version Packages PR, and main after), plots is already at the floor or above it,
// so the floor must be at most the plots version and admit it.
const peerProblem = (dir, version, range) => {
  const m = range.match(/^>=(\d+)\.(\d+)\.(\d+) <(\d+)$/);
  if (!m) return `the plots peer ${range} is not >=X.Y.Z <M`;
  const floor = m.slice(1, 4).map(Number);
  const rank = { patch: 0, minor: 1, major: 2 };
  const pending = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => readFileSync(join(dir, f), 'utf8').match(/^"@eleoptics\/plots":\s*(\w+)\s*$/m)?.[1]).filter(Boolean);
  const [maj, min, pat] = version.split('.').map(Number);
  if (pending.length) {
    const top = pending.reduce((a, b) => (rank[b] > rank[a] ? b : a), 'patch');
    const next = top === 'major' ? [maj + 1, 0, 0] : top === 'minor' ? [maj, min + 1, 0] : [maj, min, pat + 1];
    return floor.join('.') === next.join('.') ? null : `${range} is not the plots this release makes (${next.join('.')})`;
  }
  const cmp = [maj, min, pat].map((n, i) => n - floor[i]).find((d) => d !== 0) ?? 0;
  if (cmp < 0) return `${range} excludes the released plots ${version}`;
  return maj < Number(m[4]) ? null : `${range} excludes the released plots ${version}`;
};

test('plots-svelte peers the plots that ships interact', () => {
  const range = manifest('plots-svelte').peerDependencies['@eleoptics/plots'];
  assert.equal(peerProblem(join(repo, '.changeset'), manifest('plots').version, range), null);
});

test('the plots peer check holds in both the pending and the released state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eleo-peer-'));
  try {
    writeFileSync(join(dir, 'README.md'), '# changesets\n');
    // released: no pending changeset, plots at 0.10.0
    assert.equal(peerProblem(dir, '0.10.0', '>=0.10.0 <1'), null);
    assert.equal(peerProblem(dir, '0.11.0', '>=0.10.0 <1'), null);
    assert.match(peerProblem(dir, '0.10.0', '>=0.11.0 <1'), /excludes the released plots/);
    assert.match(peerProblem(dir, '1.0.0', '>=0.10.0 <1'), /excludes the released plots/);
    // pending: a plots minor on 0.9.0 makes 0.10.0
    writeFileSync(join(dir, 'interact.md'), '---\n"@eleoptics/plots": minor\n---\n\nNew.\n');
    assert.equal(peerProblem(dir, '0.9.0', '>=0.10.0 <1'), null);
    assert.match(peerProblem(dir, '0.9.0', '>=0.8.0 <1'), /not the plots this release makes \(0\.10\.0\)/);
    assert.match(peerProblem(dir, '0.10.0', '>=0.10.0 <1'), /\(0\.11\.0\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Plan #389, issue #456 (CR #455), retired by #457 (plan #464): the peer is now >=0.7.0, which has the typed map2D, so the
// README's Map2D paragraph no longer carries a "needs plots 0.7.0" note.
test('plots-svelte README drops the typed Map2D plots-version note', () => {
  const readme = readFileSync(join(repo, 'packages/plots-svelte/README.md'), 'utf8');
  const para = readme.split('\n\n').find((p) => p.startsWith('`Map2D` draws a typed grid'));
  assert.ok(para, 'no Map2D paragraph in the plots-svelte README');
  assert.doesNotMatch(para, /0\.7\.0/);
});

// Plan #512 (agent_docs/plans/512-plot-scale.md), outcome O4 (issue #529; #531 writes the files and unskips). Row O: the visible
// text and stroke change is a plots minor; the measuring wrappers and `Legend` values are a plots-svelte minor, each in its own file.
// oracle: spec roadmap Constraints (a visible change ships as a minor); semver 0.x. `changeset status` plans those two minors.
// Read as the bars-limits pair above: the files, or once `changeset version` deleted them, the CHANGELOG entries (#594).
const ROW_O_PLOTS_ENTRY = /Plots draw at their width in px/;
const ROW_O_SVELTE_ENTRY = /The framed wrappers measure their container/;
const rowOPlotsConsumed = barsConsumed('plot-scale.md', 'plots', ROW_O_PLOTS_ENTRY);
const rowOSvelteConsumed = barsConsumed('plots-svelte-scale.md', 'plots-svelte', ROW_O_SVELTE_ENTRY);
const rowOConsumed = rowOPlotsConsumed && rowOSvelteConsumed;
test('row O changesets', { skip: rowOConsumed && 'consumed by changeset version' }, () => {
  const plots = parse('plot-scale.md');
  const svelte = parse('plots-svelte-scale.md');
  assert.deepEqual(plots.bumps, { '@eleoptics/plots': 'minor' });
  assert.deepEqual(svelte.bumps, { '@eleoptics/plots-svelte': 'minor' });
  assert.ok(plots.body && svelte.body, 'a changeset names no change');
  withWorkspace({ ...plots.bumps, ...svelte.bumps }, (ws) => {
    run(ws, process.execPath, [changeset, 'status', '--output', 'status.json']);
    const { releases } = JSON.parse(readFileSync(join(ws, 'status.json'), 'utf8'));
    const type = (name) => releases.find((r) => r.name === name)?.type;
    assert.equal(type('@eleoptics/plots'), 'minor');
    assert.equal(type('@eleoptics/plots-svelte'), 'minor');
  });
});

test('row O changesets became minors',
  { skip: !rowOConsumed && 'changesets not yet versioned' }, () => {
    assert.equal(entry('plots', ROW_O_PLOTS_ENTRY).kind, 'Minor');
    assert.equal(entry('plots-svelte', ROW_O_SVELTE_ENTRY).kind, 'Minor');
  });

// Plan #603 (agent_docs/plans/603-recorded-fans.md), outcome O3 (issue #604; #598's item unskips). Row P: `minWidth` is a plots minor; plots-svelte
// peers `@eleoptics/plots >=0.8.0 <1` as a patch, in its own file (#85), because plots 0.7 ignores `width` (#598).
// oracle: spec semver (the peer admits only plots that draw at a width); @changesets/cli's plan of the named files
// Once `changeset version` deleted the files, the twin below reads the CHANGELOG entries they became, as row N's does (#594).
const ROW_P_PLOTS_ENTRY = /`minWidth\(name, props\)`/;
const ROW_P_SVELTE_ENTRY = /Peer `@eleoptics\/plots` is now `>=0\.8\.0 <1`/;
const rowPConsumed = ['min-width.md', 'plots-svelte-peer-0.8.md'].every((f) => !existsSync(join(repo, '.changeset', f)))
  && ROW_P_PLOTS_ENTRY.test(readFileSync(join(repo, 'packages/plots/CHANGELOG.md'), 'utf8'))
  && ROW_P_SVELTE_ENTRY.test(readFileSync(join(repo, 'packages/plots-svelte/CHANGELOG.md'), 'utf8'));
test('row P changesets', { skip: rowPConsumed && 'consumed by changeset version' }, () => {
  const read = (f) => {
    const text = readFileSync(join(repo, '.changeset', f), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    assert.ok(m, `.changeset/${f} has no front matter`);
    return { text, body: m[2] };
  };
  const plots = read('min-width.md');
  const svelte = read('plots-svelte-peer-0.8.md');
  assert.match(plots.body, /minWidth/, 'the plots body names minWidth');
  assert.match(svelte.body, />=0\.8\.0 <1/, 'the plots-svelte body names the raised peer');
  assert.equal(manifest('plots-svelte').peerDependencies['@eleoptics/plots'], '>=0.8.0 <1', 'plots-svelte peers plots 0.8 and up');
  withWorkspace({ '@eleoptics/plots': 'minor' }, (ws) => {
    rmSync(join(ws, '.changeset/bumps.md'));
    writeFileSync(join(ws, '.changeset/min-width.md'), plots.text);
    writeFileSync(join(ws, '.changeset/plots-svelte-peer-0.8.md'), svelte.text);
    run(ws, 'git', ['add', '-A']);
    run(ws, 'git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'row P']);
    run(ws, process.execPath, [changeset, 'status', '--output', 'status.json']);
    const { releases } = JSON.parse(readFileSync(join(ws, 'status.json'), 'utf8'));
    const type = (name) => releases.find((r) => r.name === name)?.type;
    assert.equal(type('@eleoptics/plots'), 'minor');
    assert.equal(type('@eleoptics/plots-svelte'), 'patch');
    assert.deepEqual(releases.map((r) => r.name).sort(), ['@eleoptics/plots', '@eleoptics/plots-svelte'], 'only plots and plots-svelte are planned');
  });
});

test('row P changesets became a plots minor and a plots-svelte patch',
  { skip: !rowPConsumed && 'changesets not yet versioned' }, () => {
    assert.equal(entry('plots', ROW_P_PLOTS_ENTRY).kind, 'Minor');
    assert.equal(entry('plots-svelte', ROW_P_SVELTE_ENTRY).kind, 'Patch');
  });

// Plan #642 (agent_docs/plans/642-ray-visibility.md), outcome O6 (issue #651). Row Q: a layout's `status` and the `show` option are a
// plots minor, in one file; the label clamp and the named image error are a plots patch, in another. oracle: spec semver (a visible change
// ships as a minor); @changesets/cli's plan of the named file. Once `changeset version` deleted a file, its twin below reads the
// CHANGELOG entry it became. Unlike rows O and P, which share one gate and one twin, row Q gives each changeset its own gate and twin.
const ROW_Q_ENTRY = /With `status`, a ray is drawn to its last point/;
const ROW_Q_PATCH_ENTRY = /at least 1 em below the top of a cropping/;
const rowQConsumed = barsConsumed('layout-status.md', 'plots', ROW_Q_ENTRY);
const rowQPatchConsumed = barsConsumed('layout-label-clamp.md', 'plots', ROW_Q_PATCH_ENTRY);
test('row Q changesets', { skip: rowQConsumed && 'consumed by changeset version' }, () => {
  const plots = parse('layout-status.md');
  assert.deepEqual(plots.bumps, { '@eleoptics/plots': 'minor' });
  assert.match(plots.body, /`status`/, 'the body names status');
  assert.match(plots.body, /`show`/, 'the body names show');
  withWorkspace(plots.bumps, (ws) => {
    run(ws, process.execPath, [changeset, 'status', '--output', 'status.json']);
    const { releases } = JSON.parse(readFileSync(join(ws, 'status.json'), 'utf8'));
    assert.equal(releases.find((r) => r.name === '@eleoptics/plots')?.type, 'minor');
  });
});

test('row Q patch changeset', { skip: rowQPatchConsumed && 'consumed by changeset version' }, () => {
  const clamp = parse('layout-label-clamp.md');
  assert.deepEqual(clamp.bumps, { '@eleoptics/plots': 'patch' });
  assert.match(clamp.body, /label/, 'the body names the label');
  assert.match(clamp.body, /layout2D: surface i/, 'the body names the error');
});

test('row Q changeset became a plots minor',
  { skip: !rowQConsumed && 'changesets not yet versioned' }, () => {
    assert.equal(entry('plots', ROW_Q_ENTRY).kind, 'Minor');
  });

test('row Q patch changeset became a plots patch',
  { skip: !rowQPatchConsumed && 'changesets not yet versioned' }, () => {
    assert.equal(entry('plots', ROW_Q_PATCH_ENTRY).kind, 'Patch');
  });

// Plan #677 (agent_docs/plans/677-gallery-polish.md), outcome O5 (issue #700). Row R: nine plots minors (the keys, the grids, the
// tick labels, the throughFocus panels), six plots patches (fixes) and one tokens minor (the map grid tokens). plots-svelte has no
// changeset: its wrappers spread their props, so the new props reach the renderers unchanged and its peer range already admits the
// new plots. oracle: spec semver (a visible change ships as a minor, a fix as a patch); @changesets/cli's plan of the named files.
// Once `changeset version` deleted the files, the twin below reads the CHANGELOG entries they became, as row Q's does.
const ROW_R = {
  '@eleoptics/plots': {
    minor: {
      'curve-key.md': /`curve` keys its series/,
      'rayfan-key.md': /`rayFan` takes `key: true`/,
      'spot-key.md': /`spot` series take a `label`/,
      'layout2d-key.md': /`layout2D` takes a `key`/,
      'plot-grid-off.md': /`grid: false` on `curve`/,
      'map2d-grid.md': /`map2D` draws no grid unless asked/,
      'spot-grid.md': /`spot` draws a grid at the nice ticks/,
      'spot-tick-labels.md': /`spot` panels label their grid ticks/,
      'through-focus-panels.md': /`throughFocus` draws each cell as `spot` draws a panel/,
    },
    patch: {
      'sagittal-dash.md': /a sagittal curve's dash scales/,
      'limit-labels.md': /limit labels' offsets/,
      'layout3d-plane.md': /`layout3D` paints the image plane before the outgoing rays/,
      'map2d-colorbar-ticks.md': /linear `map2D` colorbar draws at least 3 ticks/,
      'layout2d-labels.md': /field labels that a cropping `box` clamps to the top/,
      'layout2d-stop-bar.md': /draws a stop bar at every stop it labels STO/,
    },
  },
  '@eleoptics/tokens': { minor: { 'map-grid-tokens.md': /New tokens `map-grid-<map>`/ } },
};
const rowRFiles = Object.entries(ROW_R).flatMap(([pkg, kinds]) => Object.entries(kinds).flatMap(([type, files]) =>
  Object.entries(files).map(([file, re]) => ({ pkg, type, file, re, dir: pkg.replace('@eleoptics/', '') }))));
const rowRConsumed = rowRFiles.every(({ file, dir, re }) => barsConsumed(file, dir, re));
test('row R changesets', { skip: rowRConsumed && 'consumed by changeset version' }, () => {
  const ask = {};
  for (const { pkg, type, file, re } of rowRFiles) {
    const c = parse(file);
    assert.deepEqual(c.bumps, { [pkg]: type }, `${file} bumps only ${pkg}: ${type}`);
    assert.match(c.body, re, `${file} names its change`);
    if (type === 'minor' || !ask[pkg]) ask[pkg] = type;
  }
  assert.deepEqual(ask, { '@eleoptics/plots': 'minor', '@eleoptics/tokens': 'minor' });
  withWorkspace(ask, (ws) => {
    run(ws, process.execPath, [changeset, 'status', '--output', 'status.json']);
    const { releases } = JSON.parse(readFileSync(join(ws, 'status.json'), 'utf8'));
    const planned = Object.fromEntries(releases.map((r) => [r.name, r.type]));
    assert.deepEqual(planned, { '@eleoptics/plots': 'minor', '@eleoptics/tokens': 'minor' }, 'plots-svelte stays unplanned');
  });
});

test('row R changesets became plots and tokens entries',
  { skip: !rowRConsumed && 'changesets not yet versioned' }, () => {
    for (const { type, dir, re } of rowRFiles) {
      assert.equal(entry(dir, re).kind, type[0].toUpperCase() + type.slice(1));
    }
  });
