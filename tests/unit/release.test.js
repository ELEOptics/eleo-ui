// O4 (plan #30): a plots minor leaves plots-svelte unplanned, with its peer range kept.
// oracle: spec semver, reproduced as in #21: plots-svelte's peer range must still admit the new plots, so
// changesets has no reason to release it or rewrite the range (#83: on changesets 3 a plots minor also plans
// a caret-pinned plots-svelte as a patch, not a major, so "not a major" alone would pass on the old `^0.1.0`).
// It runs `changeset status --output` and `changeset version` in a temp git workspace, never on this repo: the
// live repo's status needs `main` (absent in CI's shallow checkout) and fails once `.changeset/` is empty after
// a release.
// The workspace holds the real names, versions and peer ranges, a copy of `.changeset/config.json`, one
// `plots: minor` changeset and an empty root `package-lock.json`: changesets 3 recognises an npm workspace
// only by its lock file (2.x does not need it), so without one 3.x finds no packages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
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

// Only what changesets reads: name, version, and the dependency fields that link the two packages.
const minimal = ({ name, version, dependencies, peerDependencies }) =>
  JSON.stringify({ name, version, ...(dependencies && { dependencies }), ...(peerDependencies && { peerDependencies }) }, null, 2);

test('a plots minor leaves plots-svelte unplanned and its peer range kept', () => {
  const ws = mkdtempSync(join(tmpdir(), 'eleo-release-'));
  try {
    const git = (...args) => run(ws, 'git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args]);
    writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', private: true, workspaces: ['packages/*'] }));
    writeFileSync(join(ws, 'package-lock.json'), '{}');
    for (const dir of ['plots', 'plots-svelte']) {
      mkdirSync(join(ws, 'packages', dir), { recursive: true });
      writeFileSync(join(ws, 'packages', dir, 'package.json'), minimal(manifest(dir)));
    }
    mkdirSync(join(ws, '.changeset'));
    copyFileSync(join(repo, '.changeset/config.json'), join(ws, '.changeset/config.json'));
    git('init', '-q', '-b', 'main');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    git('checkout', '-q', '-b', 'release');
    writeFileSync(join(ws, '.changeset/plots-minor.md'), '---\n"@eleoptics/plots": minor\n---\n\nA minor.\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'plots minor');

    run(ws, process.execPath, [changeset, 'status', '--output', 'status.json']);
    const { releases } = JSON.parse(readFileSync(join(ws, 'status.json'), 'utf8'));
    const type = (name) => releases.find((r) => r.name === name)?.type;
    assert.equal(type('@eleoptics/plots'), 'minor');
    assert.equal(type('@eleoptics/plots-svelte'), undefined, `plots-svelte is planned: ${JSON.stringify(releases)}`);

    const peer = manifest('plots-svelte').peerDependencies['@eleoptics/plots'];
    run(ws, process.execPath, [changeset, 'version']);
    const versioned = JSON.parse(readFileSync(join(ws, 'packages/plots-svelte/package.json'), 'utf8'));
    assert.equal(versioned.peerDependencies['@eleoptics/plots'], peer, 'version rewrote the plots-svelte peer range');
    assert.equal(versioned.version, manifest('plots-svelte').version, 'version bumped plots-svelte');
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
});

// #80 (CR #79): changesets/action v1 doesn't support CLI 3 (it finds published packages by `New tag:` in
// stdout, which CLI 3 doesn't print), so a release would tag nothing. v2 renames the inputs and reads the
// token only from its `github-token` input, not the GITHUB_TOKEN env.
// oracle: url https://github.com/changesets/action/tree/v2#api (the v2 README's inputs table; action.yml at
// tag v2 lists the same names).
// Read as text: no YAML parser is a direct dependency, and the step's block is all this needs.
test('release workflow uses changesets/action v2 inputs', () => {
  const lines = readFileSync(join(repo, '.github/workflows/release.yml'), 'utf8').split('\n');
  const start = lines.findIndex((l) => /^\s*- uses: changesets\/action@/.test(l));
  assert.notEqual(start, -1, 'release.yml has no changesets/action step');
  const indent = lines[start].indexOf('-');
  const end = lines.findIndex((l, i) => i > start && l.trim() && l.search(/\S/) <= indent);
  const step = lines.slice(start, end === -1 ? undefined : end);
  const keys = step.slice(1).map((l) => l.match(/^\s*([\w-]+):/)?.[1]).filter(Boolean);

  assert.match(step[0], /changesets\/action@v2\s*$/);
  for (const input of ['version-script', 'publish-script', 'github-token']) assert.ok(keys.includes(input), `no ${input} input`);
  for (const old of ['version', 'publish']) assert.ok(!keys.includes(old), `v1 input ${old}: is still set`);
  assert.match(step.find((l) => /^\s*github-token:/.test(l)), /\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/);
});

// #41: the branch's own changeset asks plots minor (the breaking data.layout shape, which plan #30 releases as
// a minor while the major is 0) and an explicit plots-svelte patch, which ships the widened peer range: O4 shows
// changesets would not plan plots-svelte from the plots minor alone.
// oracle: plan #30's #41 row and O4 (spec semver).
test('layouts changeset asks plots minor, plots-svelte patch', () => {
  const text = readFileSync(join(repo, '.changeset/layouts.md'), 'utf8');
  const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1];
  assert.ok(front, '.changeset/layouts.md has no front matter');
  const bumps = Object.fromEntries(front.split('\n').map((l) => l.match(/^"([^"]+)":\s*(\w+)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  assert.deepEqual(bumps, { '@eleoptics/plots': 'minor', '@eleoptics/plots-svelte': 'patch' });
});
