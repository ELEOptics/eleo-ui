// Plan #90 (agent_docs/plans/90-glass-identity.md), issue #92: the roadmap's 2 kB gzipped budget for the
// standalone layout entry, per roadmap row.
// Plan #144 (agent_docs/plans/144-layout-defaults.md), issue #145: re-recorded at the start of row L.
// oracle: measurement gzipped size of dist/eleo-layout.js built from main at e35dcbd (node zlib.gzipSync, default level)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BASELINE = 3278; // bytes gzipped, main e35dcbd, recorded at the start of row L
const BUDGET = 2048; // bytes of growth the roadmap allows per row

test('standalone layout entry within budget', () => {
  const entry = readFileSync(new URL('../../packages/plots/dist/eleo-layout.js', import.meta.url));
  const size = gzipSync(entry).length;
  assert.ok(size <= BASELINE + BUDGET,
    `dist/eleo-layout.js is ${size} B gzipped, over the ${BASELINE} B baseline + ${BUDGET} B budget by ${size - BASELINE - BUDGET} B`);
});

// CR #113, issues #116 and #118: the READMEs leave the entry's size to this test, so no figure can go stale.
test('README states no gzipped size for the entry', () => {
  for (const path of ['../../README.md', '../../packages/plots/README.md']) {
    const lines = readFileSync(new URL(path, import.meta.url), 'utf8').split('\n')
      .filter((line) => line.includes('`eleo-layout.js`'));
    assert.ok(lines.length > 0, `${path} has no line about eleo-layout.js`);
    for (const line of lines) {
      const budget = /\d+ KB gzipped per roadmap row/;
      assert.match(line, budget, `${path} lost the budget sentence: ${line}`);
      assert.doesNotMatch(line.replace(budget, ''), /\d+ KB (gzipped|minified)/i, `${path} states the entry's size: ${line}`);
    }
  }
});
