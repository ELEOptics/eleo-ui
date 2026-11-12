// Plan #804 (agent_docs/plans/804-interaction.md), issue #986 (CR #984).
// oracle: spec hand-computed cases on the rectangle [0, 0, 10, 10] (a segment through it, one inside, one missing it, a re-entering polyline, a triangle over a corner).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipPolyline, clipPolygon, dashOffset } from '../../packages/plots/src/clip.js';

const R = [0, 0, 10, 10];

test('clips polylines and polygons to a rectangle', () => {
  // through: (-5,5)->(15,5) enters at (0,5), leaves at (10,5); 5 of 20 cut off before the first point
  assert.deepEqual(clipPolyline([[-5, 5], [15, 5]], R), [{ from: 0, points: [[0, 5], [10, 5]], cut: 5 }]);
  // inside: untouched, nothing cut
  assert.deepEqual(clipPolyline([[2, 2], [3, 4], [8, 8]], R), [{ from: 0, points: [[2, 2], [3, 4], [8, 8]], cut: 0 }]);
  // missing
  assert.deepEqual(clipPolyline([[-5, -5], [-1, 20]], R), []);
  assert.deepEqual(clipPolyline([[5, 5]], R), []);
  // re-entering: (5,5) -> (15,5) -> (15,8) -> (5,8) -> (5,9)
  // run 1 leaves at (10,5); run 2 enters at (10,8) on segment 2, after 10 + 3 + 5 of polyline
  assert.deepEqual(clipPolyline([[5, 5], [15, 5], [15, 8], [5, 8], [5, 9]], R), [
    { from: 0, points: [[5, 5], [10, 5]], cut: 0 },
    { from: 2, points: [[10, 8], [5, 8], [5, 9]], cut: 10 + 3 + 5 },
  ]);
  // an interior data point between the cuts is kept: (-4,5) -> (4,5) -> (14,5)
  assert.deepEqual(clipPolyline([[-4, 5], [4, 5], [14, 5]], R), [{ from: 0, points: [[0, 5], [4, 5], [10, 5]], cut: 4 }]);

  // polygon: the hypotenuse x + y = 0 of (-5,-5), (5,-5), (-5,5) touches only the origin, so the triangle misses
  assert.deepEqual(clipPolygon([[-5, -5], [5, -5], [-5, 5]], R), []);
  // triangle (-5,-5), (10,-5), (-5,10): hypotenuse x + y = 5 cuts the corner to (0,0), (5,0), (0,5)
  const tri = clipPolygon([[-5, -5], [10, -5], [-5, 10]], R);
  const area = tri.reduce((s, [x, y], i) => { const [u, v] = tri[(i + 1) % tri.length]; return s + (x * v - u * y) / 2; }, 0);
  assert.equal(Math.abs(area), 12.5);
  for (const p of [[0, 0], [5, 0], [0, 5]]) assert.ok(tri.some(([x, y]) => x === p[0] && y === p[1]), `has ${p}`);
  // inside unchanged, containing the whole rectangle gives the rectangle's area
  assert.deepEqual(clipPolygon([[2, 2], [8, 2], [5, 8]], R), [[2, 2], [8, 2], [5, 8]]);
  const big = clipPolygon([[-5, -5], [15, -5], [15, 15], [-5, 15]], R);
  assert.equal(big.reduce((s, [x, y], i) => { const [u, v] = big[(i + 1) % big.length]; return s + (x * v - u * y) / 2; }, 0), 100);
});

// Plan #804 M3 (#990, CR #984): the dash offset of a cut run.
// oracle: spec hand-computed: the cut-off length modulo the dash period, the period doubled for an odd count
test('dashOffset is the cut-off length modulo the dash period', () => {
  assert.equal(dashOffset('6 4', 25), ' stroke-dashoffset="5"');
  assert.equal(dashOffset('1 2 3', 13), ' stroke-dashoffset="1"', 'an odd count doubles: period 12');
  assert.equal(dashOffset('6 4', 20), '', 'a whole period is no offset');
  assert.equal(dashOffset('6 4', 0), '');
  assert.equal(dashOffset('', 7), '', 'no dash');
  assert.equal(dashOffset('6 4', 1 / 3), ' stroke-dashoffset="0.333"');
});
