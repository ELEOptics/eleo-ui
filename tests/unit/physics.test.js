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

test('mtfDiffraction closed form', async () => {
  const { mtfDiffraction } = await import('../../packages/plots/src/physics.js');
  const lambda = 0.0005, N = 4, nuc = 1 / (lambda * N);
  assert.equal(mtfDiffraction(0, lambda, N), 1);
  assert.equal(mtfDiffraction(nuc, lambda, N), 0);
  assert.equal(mtfDiffraction(1.5 * nuc, lambda, N), 0);
  // Goodman: 2/π (π/3 − (1/2)(√3/2)) at half cutoff, φ = π/3.
  const half = (2 / Math.PI) * (Math.PI / 3 - 0.5 * (Math.sqrt(3) / 2));
  assert.ok(Math.abs(half - 0.3910) < 5e-5);
  assert.ok(Math.abs(mtfDiffraction(nuc / 2, lambda, N) - half) < 1e-12);
});
