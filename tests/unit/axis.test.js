// Plan #162 (agent_docs/plans/162-curve-typed.md), issue #171: nice axis ticks.
// oracle: paper Heckbert 1990, Graphics Gems, "Nice numbers for graph labels" (loose labeling, worked by hand below)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceTicks, niceRange } from '../../packages/plots/src/axis.js';

// Heckbert: nicenum(x, round) takes f = x / 10^floor(log10 x); round: f<1.5 -> 1, <3 -> 2, <7 -> 5, else 10;
// no round: f<=1 -> 1, <=2 -> 2, <=5 -> 5, else 10. Loose labeling: range = nicenum(hi-lo, false),
// d = nicenum(range/(n-1), true), graph from floor(lo/d)*d to ceil(hi/d)*d, decimals = max(-floor(log10 d), 0).
const cases = [
  // (0, 100, 5): range 100 -> f=1 -> 100. d = nicenum(25, true): f=2.5 -> 2 -> 20. Graph 0..100.
  { lo: 0, hi: 100, n: 5, ticks: [0, 20, 40, 60, 80, 100], decimals: 0 },
  // (0.15, 0.87, 5): range 0.72 -> exp -1, f=7.2 -> 10 -> 1. d = nicenum(0.25, true): exp -1, f=2.5 -> 2 -> 0.2.
  // floor(0.75)=0, ceil(4.35)=5 -> 0..1.0. decimals = -(-1) = 1.
  { lo: 0.15, hi: 0.87, n: 5, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], decimals: 1 },
  // (-3, 7, 5): range 10 -> f=1 -> 10. d = nicenum(2.5, true) -> 2. floor(-1.5)=-2 -> -4, ceil(3.5)=4 -> 8.
  { lo: -3, hi: 7, n: 5, ticks: [-4, -2, 0, 2, 4, 6, 8], decimals: 0 },
  // (0, 3, 5): range 3 -> f=3 (<=5) -> 5. d = nicenum(1.25, true): f=1.25 < 1.5 -> 1. Graph 0..3.
  { lo: 0, hi: 3, n: 5, ticks: [0, 1, 2, 3], decimals: 0 },
  // (0, 1, 11): range 1 -> 1. d = nicenum(0.1, true): f=1 -> 1 -> 0.1. Graph 0..1 in 11 ticks, decimals 1.
  { lo: 0, hi: 1, n: 11, ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], decimals: 1 },
  // (0, 0.0075, 4): range 0.0075 -> exp -3, f=7.5 (>5) -> 10 -> 0.01. d = nicenum(0.01/3=0.00333, true): f=3.33 (3..7) -> 5 -> 0.005.
  // ceil(0.0075/0.005)=2 -> 0..0.01. decimals = 3.
  { lo: 0, hi: 0.0075, n: 4, ticks: [0, 0.005, 0.01], decimals: 3 },
];

test("Heckbert's examples", () => {
  for (const c of cases) {
    const r = niceTicks(c.lo, c.hi, c.n);
    assert.deepEqual(r.ticks, c.ticks, `ticks (${c.lo}, ${c.hi}, ${c.n})`);
    assert.equal(r.decimals, c.decimals, `decimals (${c.lo}, ${c.hi}, ${c.n})`);
    assert.deepEqual(niceRange(c.lo, c.hi, c.n), { lo: c.ticks[0], hi: c.ticks[c.ticks.length - 1] });
  }
});
