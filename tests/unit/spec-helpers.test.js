// Plan #1144 (agent_docs/plans/1144-interaction-polish.md), outcome O1 (issue #1145; #1150 unskips).
// oracle: closed-form #1126's path `M0.001,0.002 h6.7e-7 M0.003,0.004 h6.7e-7` and #1067's anchored rule (interact.js matrixOf's shape, as tests/unit/interact-matrix.test.js mirrors it)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as svg from './helpers/svg.js';

test('subpaths exponent dot', () => {
  assert.deepEqual(svg.subpaths('M0.001,0.002 h6.7e-7 M0.003,0.004 h6.7e-7'), [[[0.001, 0.002]], [[0.003, 0.004]]]);
});

test('matrixOf anchored', () => {
  assert.deepEqual(svg.matrixOf('matrix(1 0 0 1 2 3)'), [1, 0, 0, 1, 2, 3]);
  assert.equal(svg.matrixOf('matrix(1 0 0 1 2 3) translate(1)'), null);
});

test('no spec parses a matrix or a dot length of its own', () => {
  const dir = new URL('../', import.meta.url);
  const own = /matrix\\\(|matrix\\s\*\\\(|h\\s\*|h-\?\[/;
  // gallery.spec.js's dot rewrite (spot dots paint once on screen) rewrites dot lengths, it does not parse points.
  const allowed = (f, line) => f === 'gallery.spec.js' && line.includes("p.setAttribute('d', p.getAttribute('d').replace(");
  const hits = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.spec.js'))) {
    readFileSync(new URL(f, dir), 'utf8').split('\n').forEach((line, i) => { if (own.test(line) && !allowed(f, line)) hits.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(hits, []);
});
