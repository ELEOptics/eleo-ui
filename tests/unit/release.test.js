// O4 (plan #30): a plots minor plans plots-svelte as a patch, not a major.
// oracle: spec semver, reproduced as in #21: plots-svelte's peer range must still admit the new plots, so
// changesets has no reason to major-bump it.
// It runs `changeset status --output` in a temp git workspace, never on this repo: the live repo's status
// needs `main` (absent in CI's shallow checkout) and fails once `.changeset/` is empty after a release.
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

test('a plots minor plans plots-svelte as a patch, not a major', () => {
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
    assert.notEqual(type('@eleoptics/plots-svelte'), 'major', `plots-svelte would release as ${JSON.stringify(releases)}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
});
