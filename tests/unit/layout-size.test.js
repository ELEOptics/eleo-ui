// Plan #90 (agent_docs/plans/90-glass-identity.md), issue #92: the roadmap's 2 kB gzipped budget for the
// standalone layout entry, per roadmap row.
// oracle: measurement gzipped size of dist/eleo-layout.js built from main at 48dc2b6 (node zlib.gzipSync, default level)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BASELINE = 2338; // bytes gzipped, main 48dc2b6, recorded at the start of row C
const BUDGET = 2048; // bytes of growth the roadmap allows per row

test('standalone layout entry within budget', () => {
  const entry = readFileSync(new URL('../../packages/plots/dist/eleo-layout.js', import.meta.url));
  const size = gzipSync(entry).length;
  assert.ok(size <= BASELINE + BUDGET,
    `dist/eleo-layout.js is ${size} B gzipped, over the ${BASELINE} B baseline + ${BUDGET} B budget by ${size - BASELINE - BUDGET} B`);
});

// CR #113, issue #116: the READMEs leave the gzipped size to this test, so the figure can't go stale.
test('README states no gzipped size for the entry', () => {
  for (const path of ['../../README.md', '../../packages/plots/README.md']) {
    const lines = readFileSync(new URL(path, import.meta.url), 'utf8').split('\n')
      .filter((line) => line.includes('`eleo-layout.js`'));
    assert.ok(lines.length > 0, `${path} has no line about eleo-layout.js`);
    for (const line of lines) {
      const budget = /\d+ KB gzipped per roadmap row/;
      assert.match(line, budget, `${path} lost the budget sentence: ${line}`);
      assert.doesNotMatch(line.replace(budget, ''), /KB gzipped/i, `${path} states a gzipped size: ${line}`);
    }
  }
});
