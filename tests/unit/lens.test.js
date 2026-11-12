// Plan #804 (agent_docs/plans/804-interaction.md), issue #961 (CR #958).
// oracle: closed-form lensmaker equation, 1/f = (n-1)[1/R1 - 1/R2 + (n-1)ct/(n R1 R2)]; a sphere sampled from a known R returns R within 1e-3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vertexRadius, thickLensF } from '../../packages/plots/src/lens.js';

// 41 [z, y] points from -sd to +sd on the sphere of signed radius R (centre at z0 + R) with its vertex at z0.
function sphere(R, sd, z0 = 3) {
  return Array.from({ length: 41 }, (_, i) => { const y = -sd + (2 * sd * i) / 40; return [z0 + R - Math.sign(R) * Math.sqrt(R * R - y * y), y]; });
}
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol * Math.abs(want), `${what}: ${got} vs ${want}`);

test('vertex radius and thick-lens focal length', () => {
  for (const R of [42.99, -247.9, 25, -25, 659]) near(vertexRadius(sphere(R, 12)), R, 1e-3, `R ${R}`);
  near(vertexRadius(sphere(-30, 29)), -30, 1e-3, 'steep sphere');
  assert.equal(vertexRadius(Array.from({ length: 41 }, (_, i) => [5, -10 + i / 2])), Infinity, 'flat');
  // a conic's base radius is its vertex curvature: z = y^2 / (R (1 + sqrt(1 - (1+k) y^2/R^2)))
  const R = 40, k = -0.5, asph = Array.from({ length: 41 }, (_, i) => { const y = -10 + i / 2; return [y * y / (R * (1 + Math.sqrt(1 - (1 + k) * y * y / (R * R)))), y]; });
  near(vertexRadius(asph), R, 5e-3, 'asphere base radius (the window leaves a small conic bias)');
  // thick lens
  const n = 1.5, f = (r1, r2, ct) => 1 / ((n - 1) * (1 / r1 - 1 / r2 + (n - 1) * ct / (n * r1 * r2)));
  near(thickLensF(n, 100, -100, 10), f(100, -100, 10), 1e-12, 'biconvex');
  assert.equal(thickLensF(n, Infinity, -50, 4), 1 / ((n - 1) / 50), 'plano-convex');
  assert.equal(thickLensF(n, Infinity, Infinity, 4), Infinity, 'flat plate');
  assert.ok(thickLensF(1.6, -50, 50, 3) < 0, 'biconcave diverges');
  near(thickLensF(1.5, 100, -100, 10), 1 / (0.5 * (0.02 - 0.5 * 10 / (1.5 * 10000))), 1e-12, 'by hand');
  // meniscus with zero power: n=1.5, ct chosen so the bracket vanishes: 1/R1 - 1/R2 + (n-1)ct/(n R1 R2) = 0
  const r1 = 50, r2 = 40, ct = -(1 / r1 - 1 / r2) * 1.5 * r1 * r2 / 0.5;
  assert.equal(thickLensF(1.5, r1, r2, ct), Infinity, 'afocal');
  // the recorded Cooke triplet
  const L = JSON.parse(readFileSync(new URL('../fixtures/layouts/analysis-glasses.json', import.meta.url)));
  const S = L.surfaces, want = [[0, 1, 42.99, -247.9, 59.4], [2, 3, -38.2, 43.95, -32.6], [4, 5, 659, -33.5, 51.5]];
  for (const [i, j, w1, w2, wf] of want) {
    const a = vertexRadius(S[i].profile), b = vertexRadius(S[j].profile);
    near(a, w1, 0.03, 'R1'); near(b, w2, 0.03, 'R2');
    near(thickLensF(S[i].glass.nd, a, b, S[j].z - S[i].z), wf, 0.015, 'f');
  }
});
