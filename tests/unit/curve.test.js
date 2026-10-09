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
test('recorded MTF round trip (U6)', async () => {
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
        assert.equal(paths[k].length, s.points.length, `${lens} ${width}px series ${k}: every point drawn, the viewport clips`);
        s.points.forEach((pt, i) => {
          const back = toData(M, toPx(M, paths[k][i]));
          const [ex, ey] = toPx(M, pt), [gx, gy] = toPx(M, back);
          assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${lens} ${width}px series ${k} point ${i} within ${TOL_PX} px`);
          assert.ok(Math.hypot(...toPx(M, paths[k][i]).map((v, j) => v - toPx(M, pt)[j])) <= TOL_PX, `${lens} ${width}px series ${k} point ${i} drawn at its data position`);
        });
      });
    }
  }
});

// Plan #162, issue #172: the typed call. Synthetic points, no fixture.
// oracle: the points handed in (data space); the series group's transform is inverted and the drawn points must land within 0.5 px of them.
test('series round trip', () => {
  const series = [
    { points: [[0, 1], [100, 0.62], [200, 0.3], [400, 0.05]], index: 0, role: 'tangential' },
    { points: [[0, 1], [100, 0.7], [200, 0.4], [999, 0.5]], index: 0, role: 'sagittal' },
    { points: [[0, 1], [400, 0]], role: 'reference' },
  ];
  const x = { label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400] }, y = { label: 'Modulus', range: [0, 1] };
  for (const [width, height] of SIZES) {
    const svg = ELEO.curve({ series, x, y, width, height });
    const { M, paths } = seriesGroup(svg);
    assert.equal(paths.length, series.length, `${width}px: one path per series`);
    series.forEach((s, k) => {
      const inRange = s.points.filter(([px, py]) => px >= x.range[0] && px <= x.range[1] && py >= y.range[0] && py <= y.range[1]);
      assert.ok(inRange.length > 0, `series ${k} has in-range points`);
      assert.equal(paths[k].length, s.points.length, `${width}px series ${k}: every point drawn, the viewport clips`);
      s.points.forEach((pt, i) => {
        const [ex, ey] = toPx(M, pt), [gx, gy] = toPx(M, paths[k][i]);
        assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${width}px series ${k} point ${i}`);
        const back = toData(M, [ex, ey]);
        assert.ok(Math.hypot(back[0] - pt[0], back[1] - pt[1]) < 1e-6, 'the transform inverts');
      });
    });
    // Roles map to styles: sagittal dashes 5 3, reference is ink with 1 3 dashes, tangential is solid.
    assert.match(svg, /stroke-dasharray="5 3"/);
    assert.match(svg, /stroke="var\(--ink\)"[^>]*stroke-dasharray="1 3"|stroke-dasharray="1 3"[^>]*stroke="var\(--ink\)"/);
    assert.match(svg, /<svg\b[^>]*>[\s\S]*<svg\b/, 'the series sit in a nested <svg>');
    assert.match(svg, /vector-effect="non-scaling-stroke"/);
    assert.ok(svg.includes('Spatial frequency, cycles/mm') && svg.includes('Modulus'), 'axis labels drawn');
    assert.ok(!svg.includes('var(--plot-axis)'), 'no zero line when the ranges do not straddle 0');
  }
  // A series that leaves y's range and comes back keeps every point, so the clip (not a chord) cuts it.
  const dip = seriesGroup(ELEO.curve({ series: [{ points: [[0, 0.5], [1, -3], [2, 0.5]], index: 0 }], x: { label: 'a', range: [0, 2] }, y: { label: 'b', range: [0, 1] } }));
  assert.equal(dip.paths[0].length, 3, 'the out-of-range point stays in the polyline');
  // A range that straddles 0 draws a zero line; degenerate input does not throw or divide by zero.
  assert.ok(ELEO.curve({ series, x: { label: 'a', range: [-1, 1] }, y: { label: 'b' } }).includes('var(--plot-axis)'));
  const flat = ELEO.curve({ series: [{ points: [[1, 5], [2, 5]], index: 1 }], x: { label: 'a' }, y: { label: 'b' } });
  assert.ok(!/NaN|Infinity/.test(flat), 'a flat series draws finite numbers');
  assert.ok(!/NaN|Infinity/.test(ELEO.curve({ series: [], x: { label: 'a' }, y: { label: 'b' } })), 'no series draws finite numbers');
});

// Plan #162, issue #173: each kind is an adapter over the typed path.
// oracle: metamorphic (curve({kind}) equals curve of its adapter's output) plus the sample data (adapter points are the sample's)
test("kind draws its adapter's series", async () => {
  await import('../../packages/plots/src/sample.js');
  const { curveAdapters } = await import('../../packages/plots/src/curve.js');
  const { data } = await import('../../packages/plots/src/data.js');
  const D = data({});
  const pick = {
    mtf: () => [D.mtf.diff.map((v, i) => [i * D.mtf.df, v]), ...D.mtf.fields.flatMap((f) => [f.T, f.S].map((a) => a.map((v, i) => [i * D.mtf.df, v])))],
    fieldCurvature: () => [D.fieldCurv.map((r) => [r[1], r[0]]), D.fieldCurv.map((r) => [r[2], r[0]])],
    distortion: () => [D.distortion.map((r) => [r[1], r[0]])],
    chromaticFocus: () => [D.chromFocus.map((r) => [r[1], r[0]])],
  };
  for (const kind of Object.keys(pick)) {
    const a = curveAdapters[kind](D);
    assert.deepEqual(a.series.map((s) => s.points), pick[kind](), `${kind}: the adapter's points are the sample's`);
    for (const [width, height] of SIZES) {
      assert.equal(ELEO.curve({ kind, width, height }), ELEO.curve({ ...a, width, height }), `${kind} ${width}px`);
    }
  }
  assert.deepEqual(curveAdapters.mtf(D).series.map((s) => s.role), ['reference', ...D.mtf.fields.flatMap(() => ['tangential', 'sagittal'])]);
});
