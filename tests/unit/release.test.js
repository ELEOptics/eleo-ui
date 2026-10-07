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
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
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

test('layouts changeset asks plots minor, plots-svelte patch', { skip: consumed && 'consumed by changeset version' }, () => {
  const parse = (file) => {
    const text = readFileSync(join(repo, '.changeset', file), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    assert.ok(m, `.changeset/${file} has no front matter`);
    const bumps = Object.fromEntries(m[1].split('\n').map((l) => l.match(/^"([^"]+)":\s*(\w+)\s*$/)).filter(Boolean).map((r) => [r[1], r[2]]));
    return { bumps, body: m[2] };
  };
  const plots = parse('layouts.md');
  const svelte = parse('layouts-svelte-peer.md');
  assert.deepEqual({ ...plots.bumps, ...svelte.bumps }, { '@eleoptics/plots': 'minor', '@eleoptics/plots-svelte': 'patch' });
  // each file bumps only its own package: changesets writes a file's body into every package it bumps (#85, #87)
  assert.deepEqual(Object.keys(plots.bumps), ['@eleoptics/plots'], 'the plots file bumps another package');
  assert.deepEqual(Object.keys(svelte.bumps), ['@eleoptics/plots-svelte'], 'the plots-svelte file bumps another package');
  assert.doesNotMatch(svelte.body, /breaking/i);
  assert.match(svelte.body, />=0\.1\.0 <1/);
});
