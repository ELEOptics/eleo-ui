// Plan #1018 (agent_docs/plans/1018-cross-browser.md), issue #1063 (review M3 round 1): the renderers write the transform shape matrixOf parses.
// oracle: reference interact.js matrixOf (its parse: `matrix(` six finite numbers `)`); each renderer's data-group transform must fit it, and a trailing `translate(1)` must not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ELEO from '../../packages/plots/src/index.js';

import '../../packages/plots/src/sample.js';

globalThis.ELEO = ELEO;

// The same shape matrixOf accepts: six numbers split on whitespace or commas, all finite.
function parses(t) {
  const m = /^matrix\(([^)]*)\)$/.exec(t);
  if (!m) return false;
  const n = m[1].trim().split(/[\s,]+/).map(Number);
  return n.length === 6 && n.every(Number.isFinite);
}
// The writers use single spaces only, stricter than matrixOf.
const spaced = (t) => /^matrix\((?:-?[\d.]+(?:e-?\d+)? ){5}-?[\d.]+(?:e-?\d+)?\)$/.test(t);

const dataGroups = (svg) => [...svg.matchAll(/<g\b[^>]*?transform="(matrix\([^"]*\))"/g)].map((m) => m[1]);

for (const [name, draw] of [
  ['curve', () => ELEO.curve({})],
  ['layout2D', () => ELEO.layout2D({})],
  ['spot', () => ELEO.spot()],
]) {
  test(`${name} data-group transform matches matrixOf's format`, () => {
    const ts = dataGroups(draw());
    assert.ok(ts.length > 0, `${name} writes a matrix data group`);
    for (const t of ts) assert.ok(parses(t) && spaced(t), `${name}: ${t}`);
  });
}

test('a matrix with a trailing transform is not the matrixOf shape', () => {
  assert.equal(parses('matrix(1,2,3,4,5,6) translate(1)'), false);
  assert.equal(parses('matrix(1 2 3 4 5)'), false);
});
