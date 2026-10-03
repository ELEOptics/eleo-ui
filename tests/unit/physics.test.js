import { test } from 'node:test';
import assert from 'node:assert/strict';
import { j1, airy, airyRadius, slabMode } from '../../packages/plots/src/physics.js';

test('j1 matches tabulated values', () => {
  // Abramowitz and Stegun, table 9.1.
  assert.ok(Math.abs(j1(1) - 0.4400505857) < 1e-6);
  assert.ok(Math.abs(j1(5) - -0.3275791376) < 1e-6);
  assert.ok(Math.abs(j1(3.8317059702)) < 1e-6, 'first zero of J1');
});

test('Airy pattern: peak 1, first dark ring at 1.22 λN', () => {
  assert.equal(airy(0, 0.5876, 4), 1);
  const r0 = airyRadius(0.5876, 4);
  assert.ok(Math.abs(r0 - 1.22 * 0.5876 * 4) < 1e-12);
  // The exact first zero is 3.8317/π ≈ 1.2197 λN; 1.22 is the rounded convention.
  assert.ok(airy(r0, 0.5876, 4) < 1e-5);
  // First bright ring peaks at about 1.75 % of the centre.
  let peak = 0;
  for (let r = r0; r < 2.3 * 0.5876 * 4; r += 0.001) peak = Math.max(peak, airy(r, 0.5876, 4));
  assert.ok(Math.abs(peak - 0.0175) < 0.0005);
});

test('slab mode is continuous and smooth at the core edge', () => {
  const a = 10, e = 1e-6;
  assert.equal(slabMode(0, a), 1);
  assert.ok(Math.abs(slabMode(a - e, a) - slabMode(a + e, a)) < 1e-5);
  const inside = (slabMode(a, a) - slabMode(a - e, a)) / e, outside = (slabMode(a + e, a) - slabMode(a, a)) / e;
  assert.ok(Math.abs(inside - outside) < 1e-3, 'derivative matches across the boundary');
  assert.ok(slabMode(5 * a, a) < 1e-3, 'evanescent tail decays');
});
