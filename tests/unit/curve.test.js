// Acceptance tests for plan #162 (agent_docs/plans/162-curve-typed.md), outcome O1.
// oracle: fixture phos-core PolychromaticModulationTransfer recorded by scripts/record-phos-core.py (roadmap U6); inverting the series group's transform recovers every in-range point within 0.5 px
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ELEOBase from '../../packages/plots/src/renderers.js';
import { mtfDiffraction } from '../../packages/plots/src/physics.js';
import { niceRange } from '../../packages/plots/src/axis.js';

// renderers.js's default export lacks the physics helpers the adapters call on globalThis.ELEO.
const ELEO = Object.assign({}, ELEOBase, { mtfDiffraction });
globalThis.ELEO = ELEO;

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

// The plot frame, from the SVG itself: the nested <svg>'s box and the x tick lines with their labels.
function frame(svg) {
  const box = /<svg\b[^>]*\bx="([\d.]+)"[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"[^>]*>\s*<g\b[^>]*transform="matrix/.exec(svg);
  assert.ok(box, 'the nested <svg> carries x, width and height');
  const ticks = [...svg.matchAll(/<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)" y2="[\d.]+" stroke="var\(--plot-grid\)"\/><text class="eleo-tick"[^>]*>([^<]*)<\/text>/g)]
    .filter((m) => m[1] === m[2]).map((m) => ({ x1: +m[1], tick: Number(m[3].replace(/\u2212/g, '-')) }));
  return { L: +box[1], pw: +box[2], ph: +box[3], ticks };
}

// The transform is held to the caller's ranges, not to itself: x.range maps to [0, pw], y.range to [ph, 0], and each drawn x tick sits at its value.
function assertPinned(M, svg, x, y, msg) {
  const { L, pw, ph, ticks } = frame(svg);
  const [x0, y0] = toPx(M, [x.range[0], y.range[0]]), [x1, y1] = toPx(M, [x.range[1], y.range[1]]);
  assert.ok(Math.hypot(x0 - 0, y0 - ph) <= TOL_PX, `${msg}: range start maps to [0, ${ph}], got [${x0}, ${y0}]`);
  assert.ok(Math.hypot(x1 - pw, y1 - 0) <= TOL_PX, `${msg}: range end maps to [${pw}, 0], got [${x1}, ${y1}]`);
  assert.ok(ticks.length >= 2, `${msg}: x tick lines found`);
  for (const t of ticks) assert.ok(Math.abs(t.x1 - L - toPx(M, [t.tick, y.range[0]])[0]) <= TOL_PX, `${msg}: tick ${t.tick} at its value`);
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
      const svg = ELEO.curve({ series, x, y, width, height });
      const { M, paths } = seriesGroup(svg);
      assertPinned(M, svg, x, y, `${lens} ${width}px`);
      assert.equal(paths.length, series.length, `${lens} ${width}px: one path per series`);
      series.forEach((s, k) => {
        const inRange = s.points.filter(([px, py]) => px >= x.range[0] && px <= x.range[1] && py >= y.range[0] && py <= y.range[1]);
        assert.ok(inRange.length > 0, `${lens} series ${k} has in-range points`);
        assert.equal(paths[k].length, s.points.length, `${lens} ${width}px series ${k}: every point drawn, the viewport clips`);
        s.points.forEach((pt, i) => {
          const back = toData(M, toPx(M, paths[k][i]));
          const [ex, ey] = toPx(M, pt), [gx, gy] = toPx(M, back);
          assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${lens} ${width}px series ${k} point ${i} within ${TOL_PX} px`);
        });
      });
    }
  }
});

// Plan #162, outcome O3 (issue #176; #179 adds the adapters, #180 unskips).
// oracle: fixture phos-core FieldCurvature and Distortion recorded by scripts/record-phos-core.py (roadmap U6); closed-form Goodman, Introduction to Fourier Optics, incoherent MTF of a circular pupil
// What #179's adapters (tests/fixtures/phos-core/adapters.js) must return, each { series, x, y } with y = the recorded field angle:
//  - fieldCurvature(rec): at the reference wavelength (the result whose wavelengthNm is nearest rec.referenceWavelengthNm; the
//    recorded 656.272 vs 656.273 shows names are not exact) two series in source order, [tangential, sagittal], each
//    { points: [[focus shift mm, rec.sources[i].fieldAngleDeg], …] (one point per source, in order), index: 0, role }. x is
//    { label, unit: 'mm', range }, y is { label, unit: '°', range }. Both ranges cover every point (the Cooke's 24° tangential focus is -3.9 mm).
//  - distortion(rec): one series at the reference wavelength, index 0 and no role (distortion is not a tangential quantity; drawn solid by default), points [[percent, fieldAngleDeg], …];
//    x unit '%', y as above, ranges covering every point.
//  - mtf(rec, { diffraction: true }): the series of mtf(rec) plus a last series, role 'reference', whose points are
//    [nu, ELEO.mtfDiffraction(nu, λ, N)] with λ = rec.referenceWavelengthNm * 1e-6 mm and N = rec.firstOrder.workingFNumber (or fNumber),
//    on the grid nu = 0 … the cutoff 1/(λN); without the option mtf(rec) is unchanged.
test('recorded field curvature and distortion round trip (U6)', async () => {
  await import('../fixtures/phos-core/adapters.js');
  const { ELEOAdapters } = globalThis;
  assert.ok(ELEOAdapters && typeof ELEOAdapters.fieldCurvature === 'function' && typeof ELEOAdapters.distortion === 'function', 'adapters.js assigns fieldCurvature and distortion');
  const atRef = (rec, key) => {
    const src = rec.sources.map((s) => s.results.reduce((a, r) => Math.abs(r.wavelengthNm - rec.referenceWavelengthNm) < Math.abs(a.wavelengthNm - rec.referenceWavelengthNm) ? r : a));
    return src.map((r, i) => [r[key], rec.sources[i].fieldAngleDeg]);
  };
  const roundTrip = (label, { series, x, y }, expected) => {
    assert.equal(series.length, expected.length, `${label}: series count`);
    // The adapters leave x.range to curve (#213): the oracle is the nice range of the recorded values, from axis.js.
    const xs = series.flatMap((s) => s.points.map((p) => p[0]));
    const nr = niceRange(Math.min(...xs), Math.max(...xs), 6);
    const xr = { ...x, range: x.range ?? [nr.lo, nr.hi] }, yr = { ...y, range: y.range ?? [0, 1] };
    for (const [width, height] of SIZES) {
      const svg = ELEO.curve({ series, x, y, width, height });
      const { M, paths } = seriesGroup(svg);
      assertPinned(M, svg, xr, yr, `${label} ${width}px`);
      assert.equal(paths.length, series.length, `${label} ${width}px: one path per series`);
      series.forEach((s, k) => {
        assert.equal(s.points.length, expected[k].length, `${label} series ${k}: one point per source`);
        s.points.forEach(([px, py], i) => {
          assert.ok(Math.abs(px - expected[k][i][0]) < 1e-9 && Math.abs(py - expected[k][i][1]) < 1e-9, `${label} series ${k} point ${i} is the recorded value, y the field angle`);
          assert.ok(px >= xr.range[0] && px <= xr.range[1] && py >= yr.range[0] && py <= yr.range[1], `${label} series ${k} point ${i} in range`);
        });
        assert.equal(paths[k].length, s.points.length, `${label} ${width}px series ${k}: every point drawn`);
        s.points.forEach((pt, i) => {
          const back = toData(M, toPx(M, paths[k][i]));
          const [ex, ey] = toPx(M, pt), [gx, gy] = toPx(M, back);
          assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${label} ${width}px series ${k} point ${i} within ${TOL_PX} px`);
        });
      });
    }
  };
  for (const lens of ['achromat', 'cooke']) {
    const fc = fixture(`${lens}-field-curvature`), dist = fixture(`${lens}-distortion`);
    const r = ELEOAdapters.fieldCurvature(fc);
    assert.deepEqual(r.series.map((s) => s.role), ['tangential', 'sagittal'], `${lens} field curvature: roles`);
    roundTrip(`${lens} field curvature`, r, [atRef(fc, 'tangential'), atRef(fc, 'sagittal')]);
    const d = ELEOAdapters.distortion(dist);
    assert.equal(d.series.length, 1, `${lens} distortion: one series`);
    assert.equal(d.series[0].role, undefined, `${lens} distortion: no role`);
    assert.equal(d.series[0].index, 0, `${lens} distortion: index 0`);
    roundTrip(`${lens} distortion`, d, [atRef(dist, 'percent')]);

    // MTF's diffraction limit, from the closed form 2/π (φ − cos φ sin φ), φ = acos(ν/ν_c), ν_c = 1/(λN).
    const rec = fixture(`${lens}-mtf`);
    const plain = ELEOAdapters.mtf(rec), withRef = ELEOAdapters.mtf(rec, { diffraction: true });
    assert.equal(withRef.series.length, plain.series.length + 1, `${lens} mtf: one reference series added`);
    const ref = withRef.series[withRef.series.length - 1];
    assert.equal(ref.role, 'reference', `${lens} mtf: the last series is the reference`);
    const lambda = rec.referenceWavelengthNm * 1e-6, N = rec.firstOrder.workingFNumber ?? rec.firstOrder.fNumber, nuc = 1 / (lambda * N);
    const limit = (nu) => { if (nu >= nuc) return 0; const phi = Math.acos(nu / nuc); return (2 / Math.PI) * (phi - Math.cos(phi) * Math.sin(phi)); };
    assert.ok(ref.points.length >= 2 && ref.points[0][0] === 0 && ref.points[0][1] === 1, `${lens} mtf: reference starts at (0, 1)`);
    ref.points.forEach(([nu, m], i) => assert.ok(Math.abs(m - limit(nu)) < 1e-9, `${lens} mtf: reference point ${i} is the closed form`));
    for (const [width, height] of SIZES) {
      const svg = ELEO.curve({ ...withRef, width, height });
      const { M, paths } = seriesGroup(svg);
      assertPinned(M, svg, withRef.x, withRef.y, `${lens} mtf+ref ${width}px`);
      assert.equal(paths.length, withRef.series.length, `${lens} mtf+ref ${width}px: one path per series`);
      const k = paths.length - 1;
      ref.points.forEach((pt, i) => {
        const [ex, ey] = toPx(M, pt), [gx, gy] = toPx(M, paths[k][i]);
        assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${lens} mtf+ref ${width}px reference point ${i} within ${TOL_PX} px`);
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
    assertPinned(M, svg, x, y, `${width}px`);
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

// oracle: metamorphic (an unknown kind equals chromaticFocus)
test('unknown kind draws chromatic focus', async () => {
  await import('../../packages/plots/src/sample.js');
  const want = ELEO.curve({ kind: 'chromaticFocus' });
  for (const kind of ['toString', 'nope']) assert.equal(ELEO.curve({ kind }), want, kind);
});

test('aria-label escapes labels once', () => {
  const svg = ELEO.curve({ series: [{ points: [[0, 0], [1, 1]], role: 'reference' }], x: { label: 'S&P', range: [0, 1] }, y: { label: 'Modulus', range: [0, 1] } });
  const label = /aria-label="([^"]*)"/.exec(svg)[1];
  assert.equal(label, 'Modulus against S&amp;P plot');
});

test('caller ticks in exponent notation keep their decimals', () => {
  const xTexts = (ticks, hi) => {
    const svg = ELEO.curve({ series: [{ points: [[0, 0], [hi, 1]], role: 'reference' }], x: { range: [0, hi], ticks }, y: { range: [0, 1], ticks: [0] } });
    return [...svg.matchAll(/<text class="eleo-tick" x="[\d.]+" y="[\d.]+" text-anchor="middle">([^<]*)<\/text>/g)].map((m) => m[1]);
  };
  assert.deepEqual(xTexts([0, 1e-7, 2e-7], 2e-7), ['0.0000000', '0.0000001', '0.0000002']);
  assert.deepEqual(xTexts([0, 1e-10, 2e-10], 2e-10), ['0.0000000000', '0.0000000001', '0.0000000002']);
  assert.deepEqual(xTexts([0, 5e-10, 1e-9], 1e-9), ['0.0000000000', '0.0000000005', '0.0000000010']);
});

test('caller ticks given as strings draw', () => {
  const svg = ELEO.curve({ series: [{ points: [[0, 0], [1, 1]], role: 'reference' }], x: { range: [0, 1], ticks: ['0', '0.5'] }, y: { range: [0, 1], ticks: [0] } });
  const texts = [...svg.matchAll(/<text class="eleo-tick" x="[\d.]+" y="[\d.]+" text-anchor="middle">([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(texts, ['0.0', '0.5']);
});

test('caller ticks print exactly at a shared precision', () => {
  const svg = ELEO.curve({ series: [{ points: [[0, 0], [3, 1]], role: 'reference' }], x: { range: [0, 3], ticks: [0, 1.5, 3] }, y: { range: [0, 1], ticks: [0] } });
  const texts = [...svg.matchAll(/<text class="eleo-tick" x="[\d.]+" y="[\d.]+" text-anchor="middle">([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(texts, ['0.0', '1.5', '3.0']);
});

// Plan #162, issue #197: points and matrix keep their precision at tiny and huge ranges.
// oracle: the caller's ranges and the plot frame; a point at fraction f of x.range lands at f * pw, one at fraction g of y.range at ph * (1 - g). Not read back from the emitted matrix.
test('tiny and huge ranges round-trip within 0.5 px', () => {
  const y = { label: 'b', range: [0, 1] };
  for (const range of [[-1e-4, 1e-4], [0, 1e7], [1e6, 1e6 + 1]]) {
    const x = { label: 'a', range };
    const fr = [0, 0.1234567, 0.5, 0.7654321, 1];
    const points = fr.map((f, i) => [range[0] + f * (range[1] - range[0]), 0.1 + 0.2 * i]);
    for (const [width, height] of SIZES) {
      const svg = ELEO.curve({ series: [{ points, index: 0 }], x, y, width, height });
      const { M, paths } = seriesGroup(svg);
      const { pw, ph } = frame(svg);
      assert.equal(paths[0].length, points.length, 'every point drawn');
      fr.forEach((f, i) => {
        const [gx, gy] = toPx(M, paths[0][i]);
        const ex = f * pw, ey = ph * (1 - points[i][1]);
        assert.ok(Math.hypot(gx - ex, gy - ey) <= TOL_PX, `x range ${range} ${width}px point ${i}: expected [${ex}, ${ey}], got [${gx}, ${gy}]`);
      });
    }
  }
});

// Plan #162, issue #202: the bundle targets es2017 and esbuild adds no polyfills.
test('kind lookup uses no API newer than the bundle target', () => {
  const bundle = readFileSync(new URL('../../packages/plots/dist/eleo-plots.js', import.meta.url), 'utf8');
  assert.ok(!bundle.includes('Object.hasOwn('), 'dist/eleo-plots.js calls Object.hasOwn, an ES2022 API');
});

// Plan #162, issue #204: point values are converted with + before printing, so no caller string reaches the markup.
test('string point values cannot inject markup', () => {
  const x = { range: [0, 2] }, y = { range: [0, 2] };
  const bad = ELEO.curve({ series: [{ points: [['1" onmouseover="alert(1)', 1], [2, 2]], index: 0 }], x, y, width: 460, height: 300 });
  assert.ok(!/onmouseover/.test(bad), 'no caller string reaches the markup');
  const ok = ELEO.curve({ series: [{ points: [['1', '1'], [2, 2]], index: 0 }], x, y, width: 460, height: 300 });
  assert.deepEqual(seriesGroup(ok).paths[0], [[1, 1], [2, 2]], "'1' draws as 1");
});

// Plan #162, issue #205: a given range is mapped through Number, so string ranges are not compared as strings.
test('string ranges draw as numbers', () => {
  const series = [{ points: [[2, 1], [6, 2], [10, 3]], index: 0 }], y = { range: [0, 4] };
  const num = ELEO.curve({ series, x: { range: [2, 10] }, y, width: 460, height: 300 });
  const str = ELEO.curve({ series, x: { range: ['2', '10'] }, y, width: 460, height: 300 });
  assert.equal(str, num);
});

// user plan #162 M1 demo
test('every role draws a 1 px stroke', () => {
  const pts = [[0, 0], [1, 1]];
  for (const role of ['tangential', 'sagittal', 'reference', undefined]) {
    const svg = ELEO.curve({ series: [{ points: pts, role }], x: { range: [0, 1] }, y: { range: [0, 1] } });
    const widths = [...svg.matchAll(/<polyline[^>]*\sstroke-width="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(widths, ['1'], String(role));
  }
});

// CR #212: the right margin grows to half the last x label's width (6 px a character, as layout2D estimates)
test('x tick labels stay inside the viewBox', () => {
  const W = 460, series = [{ points: [[-0.004, 0], [0, 1]], index: 0 }];
  const svg = ELEO.curve({ series, x: { range: [-0.004, 0], ticks: [-0.004, 0] }, y: { range: [0, 1] }, width: W, height: 300 });
  const labels = [...svg.matchAll(/<text class="eleo-tick" x="([\d.]+)" y="[\d.]+" text-anchor="middle">([^<]*)<\/text>/g)]
    .map((m) => ({ cx: +m[1], half: 3 * [...m[2]].length }));
  assert.equal(labels.length, 2);
  for (const l of labels) {
    assert.ok(l.cx + l.half <= W + 1e-6, `label centred at ${l.cx} with half-width ${l.half} fits in ${W}`);
    assert.ok(l.cx - l.half >= 0);
  }
  // a range ending at 400: "400" needs 9 px, so the margin stays 12
  const s2 = ELEO.curve({ series: [{ points: [[0, 0], [400, 1]], index: 0 }], x: { range: [0, 400], ticks: [0, 200, 400] }, y: { range: [0, 1] }, width: W, height: 300 });
  const box = /<svg\b[^>]*\bx="([\d.]+)"[^>]*\bwidth="([\d.]+)"[^>]*>\s*<g\b[^>]*transform="matrix/.exec(s2);
  assert.equal(+box[1] + +box[2], W - 12);
});
