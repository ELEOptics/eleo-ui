// Acceptance tests for plan #162 (agent_docs/plans/162-curve-typed.md), outcome O1.
// oracle: fixture phos-core PolychromaticModulationTransfer recorded by scripts/record-phos-core.py (roadmap U6); inverting the series group's transform recovers every in-range point within 0.5 px
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ELEO from '../../packages/plots/src/renderers.js';

const TOL_PX = 0.5;
const SIZES = [[460, 300], [920, 600]];
const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/phos-core/${name}.json`, import.meta.url), 'utf8'));
const nums = (s) => s.trim().split(/[\s,]+/).map(Number);

// The series group: the one `<g transform="matrix(a b c d e f)">` inside the curve's nested <svg>.
// Its paths are in data coordinates (non-scaling stroke), one per series, in series order.
function seriesGroup(svg) {
  const open = /<g\b[^>]*\btransform="matrix\(([^)]*)\)"[^>]*>/.exec(svg);
  assert.ok(open, 'the SVG has a <g transform="matrix(…)"> holding the series');
  const end = svg.indexOf('</g>', open.index);
  const paths = [...svg.slice(open.index, end).matchAll(/<(?:path|polyline)\b[^>]*?\b(?:d|points)="([^"]*)"/g)]
    .map((m) => { const n = nums(m[1].replace(/[ML]/g, ' ')); const p = []; for (let i = 0; i < n.length; i += 2) p.push([n[i], n[i + 1]]); return p; });
  return { M: nums(open[1]), paths };
}

// px = M·data; the inverse recovers data from px.
const toPx = ([a, b, c, d, e, f], [x, y]) => [a * x + c * y + e, b * x + d * y + f];
function toData([a, b, c, d, e, f], [px, py]) {
  const det = a * d - b * c;
  assert.ok(Math.abs(det) > 0, 'the transform is invertible');
  return [(d * (px - e) - c * (py - f)) / det, (a * (py - f) - b * (px - e)) / det];
}

// ELEOAdapters (classic script, tests/fixtures/phos-core/adapters.js, #174) builds { series, x, y } from a recording:
// one tangential and one sagittal series per field, each { points: [[cycles/mm, modulus], …], index, role }.
test('recorded MTF round trip (U6)', { skip: '#164: written ahead of #169 (fixtures), #172 (typed curve) and #174 (adapters.js); #175 unskips it' }, async () => {
  await import('../fixtures/phos-core/adapters.js');
  const { ELEOAdapters } = globalThis;
  assert.ok(ELEOAdapters && typeof ELEOAdapters.mtf === 'function', 'adapters.js assigns globalThis.ELEOAdapters.mtf');
  for (const lens of ['achromat', 'cooke']) {
    const { series, x, y } = ELEOAdapters.mtf(fixture(`${lens}-mtf`));
    assert.ok(series.length >= 2, `${lens}: tangential and sagittal series`);
    assert.ok(series.some((s) => s.role === 'tangential') && series.some((s) => s.role === 'sagittal'), `${lens}: both roles`);
    for (const [width, height] of SIZES) {
      const { M, paths } = seriesGroup(ELEO.curve({ series, x, y, width, height }));
      assert.equal(paths.length, series.length, `${lens} ${width}px: one path per series`);
      series.forEach((s, k) => {
        const inRange = s.points.filter(([px, py]) => px >= x.range[0] && px <= x.range[1] && py >= y.range[0] && py <= y.range[1]);
        assert.ok(inRange.length > 0, `${lens} series ${k} has in-range points`);
        assert.equal(paths[k].length, inRange.length, `${lens} ${width}px series ${k}: every in-range point drawn`);
        inRange.forEach((pt, i) => {
          const back = toData(M, toPx(M, paths[k][i]));
          const [ex, ey] = toPx(M, pt), [gx, gy] = toPx(M, back);
          assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${lens} ${width}px series ${k} point ${i} within ${TOL_PX} px`);
          assert.ok(Math.hypot(...toPx(M, paths[k][i]).map((v, j) => v - toPx(M, pt)[j])) <= TOL_PX, `${lens} ${width}px series ${k} point ${i} drawn at its data position`);
        });
      });
    }
  }
});
