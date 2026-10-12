// Acceptance tests for plan #162 (agent_docs/plans/162-curve-typed.md), outcome O1.
// oracle: fixture phos-core PolychromaticModulationTransfer recorded by scripts/record-phos-core.py (roadmap U6); inverting the series group's transform recovers every in-range point within 0.5 px
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ELEO from '../../packages/plots/src/index.js';
import { niceRange } from '../../packages/plots/src/axis.js';

// adapters.js reads ELEO from globalThis when mtf() runs, not when it loads.
globalThis.ELEO = ELEO;

import { TOL_PX, SIZES, fixture, seriesGroup, panelGroups, toPx, toData, frame, assertPinned } from './helpers/svg.js';

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
//    { label, unit: 'mm' } (curve picks the nice range) and y is { label, unit: '°', range }.
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
    const xr = { ...x, range: x.range ?? [nr.lo, nr.hi] }, yr = y;
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
  // ticks in descending order: the margin follows the largest shown tick, "10000" (half-width 15), not the last in array order
  const s3 = ELEO.curve({ series: [{ points: [[0, 0], [10000, 1]], index: 0 }], x: { range: [0, 10000], ticks: [10000, 0] }, y: { range: [0, 1] }, width: W, height: 300 });
  const l3 = [...s3.matchAll(/<text class="eleo-tick" x="([\d.]+)" y="[\d.]+" text-anchor="middle">([^<]*)<\/text>/g)]
    .map((m) => ({ cx: +m[1], half: 3 * [...m[2]].length }));
  assert.equal(l3.length, 2);
  for (const l of l3) assert.ok(l.cx + l.half <= W + 1e-6, `label centred at ${l.cx} with half-width ${l.half} fits in ${W}`);
});

// Plan #232, outcome O1 (issue #233; #234 adds curve's panels, #235 fanPanels, #236 unskips).
// oracle: fixture packages/plots/src/sample.json fans and opdFans (TransverseRayError waits on ELEOptics/phos-core#371; user 2026-10-11), changing U6's oracle for the fans
// What #234 and #235 must provide: fanPanels(sample, { kind }) in packages/plots/src/fan.js returns { panels, columns, x, y },
// each panel { title, series: [{ points: [[pupil, value | null], …], index }] } (a null value is a vignetted ray), and
// curve({ panels, columns, x, y, width, height }) draws one nested <svg> and transform group per panel, a series as a <path>
// whose `M`/`L` data starts a new subpath after each null.
test('sample fans round trip through panels (U6)', async () => {
  const { fanPanels } = await import('../../packages/plots/src/fan.js');
  const { default: sample } = await import('../../packages/plots/src/sample.json', { with: { type: 'json' } });
  // The sample holds no null, so a second pass runs on a clone with one interior value of each fan nulled (as fan.test.js does).
  const nulled = structuredClone(sample);
  nulled.fans[1].T[0][3] = null;
  nulled.opdFans[1].T[0][3] = null;
  for (const [pass, src] of [['sample', sample], ['one value nulled', nulled]]) for (const kind of ['tra', 'opd']) {
    const { panels, columns, x, y } = fanPanels(src, { kind });
    if (pass !== 'sample') assert.ok(panels.some((pn) => pn.series.some((s) => s.points.some((pt) => pt[1] === null))), `${kind}: the clone's null reaches the panels`);
    assert.ok(panels.length >= 2, `${kind}: panels for each row and field`);
    for (const [width, height] of SIZES) {
      const svg = ELEO.curve({ panels, columns, x, y, width, height });
      const groups = panelGroups(svg);
      assert.equal(groups.length, panels.length, `${kind} ${width}px: one nested <svg> and group per panel`);
      // Every panel maps the same ranges to its own box: the x range to [0, pw], the y range to [ph, 0].
      const xr = x.range ?? [-1, 1], yr = y.range;
      assert.ok(yr, `${kind}: the fans give a y range`);
      groups.forEach((g, p) => {
        const [x0, y0] = toPx(g.M, [xr[0], yr[0]]), [x1, y1] = toPx(g.M, [xr[1], yr[1]]);
        assert.ok(Math.hypot(x0, y0 - g.box.ph) <= TOL_PX && Math.hypot(x1 - g.box.pw, y1) <= TOL_PX, `${kind} ${width}px panel ${p}: the shared ranges map to its box`);
        assert.equal(g.paths.length, panels[p].series.length, `${kind} ${width}px panel ${p}: one path per series`);
        panels[p].series.forEach((s, k) => {
          const live = s.points.filter((pt) => pt[1] !== null);
          const drawn = g.paths[k].flat();
          assert.equal(drawn.length, live.length, `${kind} ${width}px panel ${p} series ${k}: every non-null point drawn`);
          live.forEach((pt, i) => {
            const back = toData(g.M, toPx(g.M, drawn[i]));
            const [ex, ey] = toPx(g.M, pt), [gx, gy] = toPx(g.M, back);
            assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${kind} ${width}px panel ${p} series ${k} point ${i} within ${TOL_PX} px`);
          });
          // A null splits the series: one subpath per run of non-null points.
          let runs = 0, prev = false;
          for (const pt of s.points) { const on = pt[1] !== null; if (on && !prev) runs++; prev = on; }
          assert.equal(g.paths[k].length, runs, `${kind} ${width}px panel ${p} series ${k}: a null splits the series into subpaths`);
          if (s.points.some((pt) => pt[1] === null)) assert.ok(runs >= 2, `${kind} ${pass}: the nulled series is two or more subpaths`);
        });
      });
    }
  }
});

// Issue #207: a range that does not coerce to two finite numbers is dropped, so the axis falls back to the data.
// oracle: spec #207
test('a non-numeric range falls back to the data (#207)', () => {
  const series = [{ points: [[0, 0], [10, 1]], index: 0 }];
  const want = ELEO.curve({ series, x: { label: 'a' }, y: { label: 'b' } });
  assert.ok(!/NaN|Infinity/.test(want));
  for (const range of [[], ['a', 'b'], [NaN, 1], [1], [0, Infinity]]) {
    const got = ELEO.curve({ series, x: { label: 'a', range }, y: { label: 'b', range } });
    assert.ok(!/NaN|Infinity/.test(got), `range ${JSON.stringify(range)} draws finite numbers`);
    assert.equal(got, want, `range ${JSON.stringify(range)} equals no range`);
  }
});

// Issue #234: curve({ panels, columns, x, y }) draws a grid on one scale, and a null breaks a series.
// oracle: property: synthetic points round-trip within 0.5 px; every panel maps the same ranges to its box
test('panels share ranges and break at nulls', () => {
  const panels = [
    { title: '1.0° · Py', series: [{ points: [[-1, 2], [0, 0], [0.5, null], [1, -3]], index: 0 }] },
    { title: '2.0° · Py', series: [{ points: [[-1, 8], [-0.5, 1], [0, null], [0.25, null], [0.5, 4], [1, 6], [1, null]], index: 1 }, { points: [[-1, -4], [1, 5]], index: 2, role: 'sagittal' }] },
    { title: '3.0° · Py', series: [{ points: [[-1, 0], [1, 1]], index: 0 }] },
  ];
  const x = { label: 'Pupil', range: [-1, 1] }, y = { label: 'Ray error', unit: 'µm' };
  for (const [width, height] of SIZES) {
    const svg = ELEO.curve({ panels, columns: 2, x, y, width, height });
    const groups = panelGroups(svg);
    assert.equal(groups.length, 3, `${width}px: one nested <svg> and group per panel`);
    assert.equal((svg.match(/>Ray error, µm</g) || []).length, 1, 'the axis labels once');
    for (const p of panels) assert.ok(svg.includes(`>${p.title}</text>`), `title ${p.title}`);
    // y was not given: the nice range of every panel's data, one for all (here -4..8 covers them).
    const nr = niceRange(-4, 8, 6), yr = [nr.lo, nr.hi];
    groups.forEach((g, p) => {
      const [x0, y0] = toPx(g.M, [-1, yr[0]]), [x1, y1] = toPx(g.M, [1, yr[1]]);
      assert.ok(Math.hypot(x0, y0 - g.box.ph) <= TOL_PX && Math.hypot(x1 - g.box.pw, y1) <= TOL_PX, `${width}px panel ${p}: the shared ranges map to its box`);
      assert.equal(g.paths.length, panels[p].series.length, `panel ${p}: one path per series`);
      panels[p].series.forEach((s, k) => {
        const live = s.points.filter((pt) => pt[1] !== null), drawn = g.paths[k].flat();
        assert.equal(drawn.length, live.length, `panel ${p} series ${k}: every non-null point drawn`);
        live.forEach((pt, i) => {
          const [ex, ey] = toPx(g.M, pt), [gx, gy] = toPx(g.M, toData(g.M, toPx(g.M, drawn[i])));
          assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX && Math.hypot(drawn[i][0] - pt[0], drawn[i][1] - pt[1]) < 1e-9, `panel ${p} series ${k} point ${i}`);
        });
        let runs = 0, prev = false;
        for (const pt of s.points) { const on = pt[1] !== null; if (on && !prev) runs++; prev = on; }
        assert.equal(g.paths[k].length, runs, `panel ${p} series ${k}: a null splits the series`);
      });
    });
    assert.ok(/<path d="M[^"]*M[^"]*"/.test(svg), 'a break is an M inside one path');
  }
});

// Issue #252: curve's rule for bad points. oracle: property; the base's output
test('non-finite points break panel series', () => {
  const pts = [[-1, 1], [-0.5, NaN], [0, 2], [0.25, Infinity], [0.5, 3], [0.75, 4], [NaN, 5], [1, 6], [-Infinity, 7]];
  const svg = ELEO.curve({ panels: [{ title: 'a', series: [{ points: pts, index: 0 }] }], x: { range: [-1, 1] }, y: { range: [0, 8] }, width: 460, height: 260 });
  const d = svg.match(/<path d="([^"]*)"/)[1];
  assert.ok(!/NaN|Infinity/.test(d), `no NaN or Infinity in the path data: ${d}`);
  // runs: [-1,1] | [0,2] | [0.5,3] [0.75,4] | [1,6]
  assert.equal((d.match(/M/g) || []).length, 4, `a non-finite coordinate ends the run: ${d}`);
});

test('single plot range unchanged by nulls', () => {
  const base = { x: { range: [0, 2] }, width: 460, height: 260 };
  const withNull = ELEO.curve({ ...base, series: [{ points: [[0, 5], [1, null], [2, 7]], index: 0 }] });
  const withZero = ELEO.curve({ ...base, series: [{ points: [[0, 5], [1, 0], [2, 7]], index: 0 }] });
  assert.equal(withNull, withZero, 'a null counts as 0 in the range, as at the base, so the polyline stays inside it');
});
