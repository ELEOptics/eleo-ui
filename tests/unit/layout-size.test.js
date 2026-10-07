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
