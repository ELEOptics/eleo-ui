// Acceptance tests for plan #162 (agent_docs/plans/162-curve-typed.md), outcome O1.
// oracle: fixture phos-core PolychromaticModulationTransfer recorded by scripts/record-phos-core.py (roadmap U6); inverting the series group's transform recovers every in-range point within 0.5 px
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ELEO from '../../packages/plots/src/index.js';
import { niceRange } from '../../packages/plots/src/axis.js';

// adapters.js reads ELEO from globalThis when mtf() runs, not when it loads.
globalThis.ELEO = ELEO;

import { TOL_PX, SIZES, fixture, seriesGroup, panelGroups, toPx, toData, frame, assertPinned, marks } from './helpers/svg.js';

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

// Plan #512, issue #557 (review M1 finding 9). oracle: property: the frame rect's and the nested svg's x, y, width and height have at most 2 decimals, so the markup is small and doesn't depend on Math.cbrt's last bits.
test('frame geometry has at most 2 decimals', () => {
  for (let width = 120; width <= 1600; width += 7) {
    const svg = ELEO.curve({ series: [{ points: [[0, 0], [1, 1]], index: 0 }], width, height: 260 });
    const tags = [/<rect\b[^>]*stroke="var\(--plot-grid\)"[^>]*>/.exec(svg), /<svg\b[^>]*\by="[^>]*>\s*<g\b[^>]*transform="matrix/.exec(svg)];
    for (const tag of tags) {
      assert.ok(tag, `width ${width}: frame tags found`);
      for (const a of ['x', 'y', 'width', 'height']) {
        const v = new RegExp(`\\s${a}="([^"]*)"`).exec(tag[0])[1];
        assert.match(v, /^-?\d+(\.\d{1,2})?$/, `width ${width}: ${a}="${v}"`);
      }
    }
    // #565: every position attribute outside the data group (grid and tick lines, zero lines, tick texts, limit labels, axis titles) is rounded too.
    const lim = ELEO.curve({ series: [{ points: [[-5, -1], [7, 3]], index: 0 }], limits: [{ y: 1.3, label: 'a' }, { x: 2.7, label: 'b' }], x: { label: 'F', unit: 'u' }, y: { label: 'M' }, width, height: 260 });
    for (const [name, doc] of [['single', svg], ['limits', lim], ['panels', ELEO.curve({ panels: [{ title: 'a', series: [{ points: [[-5, -1], [7, 3]], index: 0 }] }, { title: 'b', series: [{ points: [[0, 0], [1, 1]], index: 1 }] }], columns: 2, x: { label: 'F' }, y: { label: 'M' }, width, height: 260 })]]) {
      const outside = doc.replace(/<g transform="matrix\([^"]*"[^>]*>[\s\S]*?<\/g>/g, '');
      let n = 0;
      for (const m of outside.matchAll(/\s(x|y|x1|y1|x2|y2)="([^"]*)"/g)) {
        n++;
        assert.match(m[2], /^-?\d+(\.\d{1,2})?$/, `width ${width} ${name}: ${m[1]}="${m[2]}"`);
      }
      assert.ok(n > 10, `width ${width} ${name}: attributes found`);
    }
  }
});

// Plan #284 #329 (CR from the M2 demo). oracle: property: a single plot's frame top sits at least 14 px under the y-axis title's baseline (y = 10), as bars.test.js checks for bars.
test('the y-axis title has room above the frame', () => {
  const svg = ELEO.curve({ series: [{ points: [[0, 0], [1, 1]], index: 0 }], x: { label: 'Frequency', unit: 'cy/mm' }, y: { label: 'Modulus' }, width: 460, height: 260 });
  const T = Number(/<svg\b[^>]*\by="([\d.]+)"[^>]*>\s*<g\b[^>]*transform="matrix/.exec(svg)[1]);
  assert.ok(T >= 10 + 14, 'frame top ' + T + ' is under the title baseline by at least 14 px');
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
    // Roles map to styles: sagittal dashes 4 and 2.5 stroke weights (CR #726), reference is ink with 1 3 dashes, tangential is solid.
    assert.match(svg, /<polyline\b[^>]*stroke="var\(--series-1[^"]*"[^>]*stroke-dasharray="[\d.]+ [\d.]+"/, 'the sagittal polyline carries its own dash (the reference line\'s 1 3 does not count)');
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
    return [...svg.matchAll(/<text class="eleo-tick" x="[\d.]+" y="[\d.]+" text-anchor="middle"(?: style="[^"]*")?>([^<]*)<\/text>/g)].map((m) => m[1]);
  };
  assert.deepEqual(xTexts([0, 1e-7, 2e-7], 2e-7), ['0.0000000', '0.0000001', '0.0000002']);
  assert.deepEqual(xTexts([0, 1e-10, 2e-10], 2e-10), ['0.0000000000', '0.0000000001', '0.0000000002']);
  assert.deepEqual(xTexts([0, 5e-10, 1e-9], 1e-9), ['0.0000000000', '0.0000000005', '0.0000000010']);
});

test('caller ticks given as strings draw', () => {
  const svg = ELEO.curve({ series: [{ points: [[0, 0], [1, 1]], role: 'reference' }], x: { range: [0, 1], ticks: ['0', '0.5'] }, y: { range: [0, 1], ticks: [0] } });
  const texts = [...svg.matchAll(/<text class="eleo-tick" x="[\d.]+" y="[\d.]+" text-anchor="middle"(?: style="[^"]*")?>([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(texts, ['0.0', '0.5']);
});

test('caller ticks print exactly at a shared precision', () => {
  const svg = ELEO.curve({ series: [{ points: [[0, 0], [3, 1]], role: 'reference' }], x: { range: [0, 3], ticks: [0, 1.5, 3] }, y: { range: [0, 1], ticks: [0] } });
  const texts = [...svg.matchAll(/<text class="eleo-tick" x="[\d.]+" y="[\d.]+" text-anchor="middle"(?: style="[^"]*")?>([^<]*)<\/text>/g)].map((m) => m[1]);
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
test('every role draws a stroke of ADR-0003 weight', () => {
  const pts = [[0, 0], [1, 1]];
  for (const [role, width] of [['tangential'], ['sagittal'], ['reference'], [undefined], ['limit'], ['limit', 1200]]) {
    const svg = ELEO.curve({ series: [{ points: pts, role }], x: { range: [0, 1] }, y: { range: [0, 1] }, ...(width && { width }) });
    const widths = [...svg.matchAll(/<polyline[^>]*\sstroke-width="([^"]*)"/g)].map((m) => +m[1]);
    const F = frame(svg).pw, w = F > 234 ? Math.sqrt(F / 234) : 1; // oracle: ADR-0003, weight 1 up to F = 234, then sqrt(F / 234)
    assert.equal(widths.length, 1, String(role));
    assert.ok(Math.abs(widths[0] - w) <= 0.01, `${role} at ${width}: ${widths[0]} against ${w}`);
  }
});

// CR #726 (#730): the sagittal dash is in units of the stroke weight, so it reads as a dash at every width; the key's swatch too
test('sagittal dash scales with the stroke', () => {
  const pts = [[0, 0], [1, 1]], ratios = (svg, re) => [...svg.matchAll(re)].map((m) => [+m[2] / +m[1], +m[3] / +m[1]]);
  const draw = (width) => ELEO.curve({ series: [{ points: pts, role: 'sagittal', label: 'S' }], x: { range: [0, 1] }, y: { range: [0, 1] }, width });
  const lines = [], keys = [];
  for (const width of [200, 1200]) {
    const svg = draw(width);
    lines.push(...ratios(svg, /<polyline[^>]*\sstroke-width="([^"]*)"[^>]*stroke-dasharray="(\S+) (\S+)"/g));
    keys.push(...ratios(svg, /<line [^>]*stroke-width="([^"]*)"[^>]*stroke-dasharray="(\S+) (\S+)"/g));
  }
  assert.equal(lines.length, 2); assert.equal(keys.length, 2);
  for (const set of [lines, keys]) set.forEach(([a, b]) => { assert.ok(Math.abs(a - 4) < 0.1 && Math.abs(b - 2.5) < 0.1, `${a} ${b}`); });
});

// #737: a line swatch takes its role's cap, so the sagittal dashes look the same in the key as on the curve
test('key swatch takes the role\'s cap', () => {
  const draw = (role) => ELEO.curve({ series: [{ points: [[0, 0], [1, 1]], role, label: 'S' }], x: { range: [0, 1] }, y: { range: [0, 1] } });
  assert.match(draw('sagittal'), /<line [^>]*stroke-linecap="round"[^>]*stroke-dasharray=/);
  assert.match(draw('limit'), /<line [^>]*stroke-linecap="butt"/);
});

// CR #212: the right margin grows to half the last x label's width (0.6 em a character, ADR-0003: half is 0.3 text units a character, at least 1.2)
test('x tick labels stay inside the viewBox', () => {
  const W = 460, series = [{ points: [[-0.004, 0], [0, 1]], index: 0 }];
  const svg = ELEO.curve({ series, x: { range: [-0.004, 0], ticks: [-0.004, 0] }, y: { range: [0, 1] }, width: W, height: 300 });
  const labels = [...svg.matchAll(/<text class="eleo-tick" x="([\d.]+)" y="[\d.]+" text-anchor="middle" style="font-size:([\d.]+)px">([^<]*)<\/text>/g)]
    .map((m) => ({ cx: +m[1], half: 0.3 * +m[2] * [...m[3]].length }));
  assert.equal(labels.length, 2);
  for (const l of labels) {
    assert.ok(l.cx + l.half <= W + 1e-6, `label centred at ${l.cx} with half-width ${l.half} fits in ${W}`);
    assert.ok(l.cx - l.half >= 0);
  }
  // a range ending at 400: "400" needs 0.9 text units, so the margin stays 1.2
  const s2 = ELEO.curve({ series: [{ points: [[0, 0], [400, 1]], index: 0 }], x: { range: [0, 400], ticks: [0, 200, 400] }, y: { range: [0, 1] }, width: W, height: 300 });
  const box = /<svg\b[^>]*\bx="([\d.]+)"[^>]*\bwidth="([\d.]+)"[^>]*>\s*<g\b[^>]*transform="matrix/.exec(s2);
  const t2 = +/style="font-size:([\d.]+)px"/.exec(s2)[1];
  assert.ok(Math.abs(+box[1] + +box[2] - (W - 1.2 * t2)) <= 0.01);
  // ticks in descending order: the margin follows the largest shown tick, "10000" (half-width 15), not the last in array order
  const s3 = ELEO.curve({ series: [{ points: [[0, 0], [10000, 1]], index: 0 }], x: { range: [0, 10000], ticks: [10000, 0] }, y: { range: [0, 1] }, width: W, height: 300 });
  const l3 = [...s3.matchAll(/<text class="eleo-tick" x="([\d.]+)" y="[\d.]+" text-anchor="middle" style="font-size:([\d.]+)px">([^<]*)<\/text>/g)]
    .map((m) => ({ cx: +m[1], half: 0.3 * +m[2] * [...m[3]].length }));
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
  for (const range of [[], ['a', 'b'], [NaN, 1], [1], [0, Infinity], 5, '0,1', { lo: 0, hi: 1 }]) {
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
  // a point that is not drawn doesn't set the shared range either
  const auto = (points) => ELEO.curve({ panels: [{ series: [{ points, index: 0 }] }], width: 460, height: 260 });
  const base = [[0, 0], [1, 1]];
  assert.equal(auto([...base, [50, NaN]]), auto([...base, [50, null]]), 'NaN and null drop the point alike');
  assert.equal(auto([...base, [50, NaN]]), auto(base), 'a point not drawn leaves the range alone');
  // a null entry is a break
  let two;
  assert.doesNotThrow(() => { two = auto([[0, 0], null, [1, 1]]); });
  assert.equal((two.match(/<path d="([^"]*)"/)[1].match(/M/g) || []).length, 2, 'a null entry breaks the run');
});

test('single plot range unchanged by nulls', () => {
  const base = { x: { range: [0, 2] }, width: 460, height: 260 };
  const withNull = ELEO.curve({ ...base, series: [{ points: [[0, 5], [1, null], [2, 7]], index: 0 }] });
  const withZero = ELEO.curve({ ...base, series: [{ points: [[0, 5], [1, 0], [2, 7]], index: 0 }] });
  assert.equal(withNull, withZero, 'a null counts as 0 in the range, as at the base, so the polyline stays inside it');
});

test('helpers skip a path with no data', () => {
  const svg = '<svg x="0" width="10" height="10"><g transform="matrix(1 0 0 1 0 0)"><path/><polyline class="s"/></g></svg>';
  assert.deepEqual(seriesGroup(svg).paths, [], 'a bare <path/> reads as no series');
  assert.deepEqual(panelGroups(svg)[0].paths, [], 'and in a panel');
});

// Plan #677, issue #556. oracle: closed-form plotCell's t / 10 rule: the offsets 0.4 t, 0.3 t and 1 t, read against the label's own font-size at two widths.
test('limit label offsets scale', () => {
  const series = [{ points: [[0, 1], [400, 0]], index: 0 }];
  const x = { label: 'f', range: [0, 400] }, y = { label: 'm', range: [0, 1] };
  for (const width of [600, 1200]) {
    const svg = ELEO.curve({ series, x, y, limits: [{ y: 0.3, label: 'yl' }, { x: 50, label: 'xl' }, { x: 350, label: 'xr' }], width });
    const text = (label) => svg.match(new RegExp(`<text class="eleo-tick"([^>]*)>${label}</text>`))[1];
    const t = +text('yl').match(/font-size:([\d.]+)px/)[1], box = panelGroups(svg)[0].box, M = seriesGroup(svg).M;
    const num = (a, k) => +a.match(new RegExp(`${k}="([^"]*)"`))[1], tol = 0.1;
    assert.ok(Math.abs(num(text('yl'), 'dy') + 0.3 * t) <= tol, `${width}px: y label dy is -0.3 t`);
    assert.ok(Math.abs(num(text('xl'), 'y') - box.y - toPx(M, [0, 1])[1] - t) <= tol, `${width}px: x label sits 1 t below the top`);
    assert.ok(Math.abs(num(text('xl'), 'x') - 0.4 * t - box.x - toPx(M, [50, 0])[0]) <= tol, `${width}px: x label 0.4 t right of its line`);
    assert.ok(Math.abs(num(text('xr'), 'x') + 0.4 * t - box.x - toPx(M, [350, 0])[0]) <= tol, `${width}px: late x label 0.4 t left of its line`);
  }
});

// Plan #284, issue #291. oracle: property: synthetic limits recovered through the inverse transform within 0.5 px; an auto range contains every limit; a given range clips them.
test('limits draw single and paneled', () => {
  const series = [
    { points: [[0, 1], [100, 0.6], [200, 0.3], [400, 0.05]], index: 0, role: 'tangential' },
    { points: [[0, 1], [100, 0.7], [200, 0.4], [400, 0.1]], index: 0, role: 'sagittal' },
    { points: [[0, 1], [100, 0.5], [400, 0]], index: 1 },
    { points: [[0, 0.9], [400, 0.2]], index: 1, role: 'sagittal' },
  ];
  const limits = [{ y: 0.3, label: 'MTF ≥ 0.3' }, { x: 50 }, { y: [0.3, 0] }];
  const x = { label: 'f', range: [0, 400] }, y = { label: 'm', range: [0, 1] };
  const near = (M, v, w, msg) => assert.ok(Math.hypot(...toPx(M, v).map((c, i) => c - toPx(M, w)[i])) <= TOL_PX, msg);
  const lt = (svg) => +svg.match(/<text class="eleo-tick"[^>]*font-size:([\d.]+)px[^>]*>[^<]*<\/text>/)[1];
  const check = (g, msg) => {
    const lines = marks(g, 'line').filter((l) => l.limit), rects = marks(g, 'rect').filter((r) => r.limit);
    assert.equal(lines.length, 2, `${msg}: a line per number`);
    assert.equal(rects.length, 1, `${msg}: a rect per pair`);
    const h = lines.find((l) => l.y1 === l.y2), v = lines.find((l) => l.x1 === l.x2);
    near(g.M, [h.x1, h.y1], [0, 0.3], `${msg}: y line at 0.3, from the range start`);
    near(g.M, [h.x2, h.y2], [400, 0.3], `${msg}: y line to the range end`);
    near(g.M, [v.x1, v.y1], [50, 0], `${msg}: x line at 50`);
    near(g.M, [v.x2, v.y2], [50, 1], `${msg}: x line spans y`);
    near(g.M, [rects[0].x, rects[0].y], [0, 0], `${msg}: band corner`);
    near(g.M, [rects[0].x + rects[0].width, rects[0].y + rects[0].height], [400, 0.3], `${msg}: band far corner`);
    const at = [...g.body.matchAll(/<(?:path|polyline)\b/g)].map((m) => m.index);
    assert.ok(at.length > 0 && g.body.indexOf('<rect') < at[0] && g.body.indexOf('<line') > at.at(-1), `${msg}: band under, lines over`);
  };
  for (const [width, height] of SIZES) {
    let svg = ELEO.curve({ series, x, y, limits, width, height });
    check(seriesGroup(svg), `${width}px single`);
    assert.match(svg, /<text class="eleo-tick"[^>]*>MTF ≥ 0.3<\/text>/, 'the label is a text of its own');
    assert.match(svg, /<line class="eleo-limit"[^>]*stroke="var\(--ink\)"[^>]*stroke-dasharray="6 3 1 3"/, 'a line takes the limit role style');
    // Auto ranges contain every limit.
    const { range: _x, ...xa } = x, { range: _y, ...ya } = y;
    svg = ELEO.curve({ series, x: xa, y: ya, limits: [...limits, { y: 1.6 }, { x: [-20, 500] }], width, height });
    const f = frame(svg), g = seriesGroup(svg);
    const [xlo, ylo] = toData(g.M, [0, f.ph]), [xhi, yhi] = toData(g.M, [f.pw, 0]);
    assert.ok(ylo <= 0 && yhi >= 1.6 && xlo <= -20 && xhi >= 500, `${width}px auto range [${xlo},${xhi}]x[${ylo},${yhi}] contains the limits`);
    // A given range clips: a limit outside it leaves the range alone and draws no label.
    svg = ELEO.curve({ series, x, y, limits: [{ y: 9, label: 'far' }], width, height });
    assertPinned(seriesGroup(svg).M, svg, x, y, `${width}px clipped`);
    assert.ok(!svg.includes('far'), 'no label outside the range');
    // Panels: the limits in every panel, through its own transform.
    const panels = [{ title: 'a', series: series.slice(0, 2) }, { title: 'b', series: series.slice(2) }];
    svg = ELEO.curve({ panels, columns: 2, x, y, limits, width, height });
    const groups = panelGroups(svg);
    assert.equal(groups.length, 2);
    groups.forEach((pg, p) => check(pg, `${width}px panel ${p}`));
    assert.equal(svg.split('MTF ≥ 0.3').length - 1, 2, 'a label per panel');
    // A band partly inside the range keeps its label, at the clamped edge: y at the range top, x at the range start.
    svg = ELEO.curve({ series, x, y, limits: [{ y: [0.5, 9], label: 'part y' }, { x: [-50, 100], label: 'part x' }], width, height });
    const gp = seriesGroup(svg), bx = panelGroups(svg)[0].box;
    const ty = svg.match(/<text class="eleo-tick" x="[^"]*" y="([^"]*)"[^>]*>part y<\/text>/), tx = svg.match(/<text class="eleo-tick" x="([^"]*)" y="[^"]*"[^>]*>part x<\/text>/);
    assert.ok(ty && tx, `${width}px: a partly drawn band keeps its label`);
    assert.ok(Math.abs(+ty[1] - bx.y - toPx(gp.M, [0, 1])[1]) <= TOL_PX, `${width}px: the y band's label sits at the range top`);
    assert.ok(Math.abs(+tx[1] - 0.4 * lt(svg) - bx.x - toPx(gp.M, [0, 0])[0]) <= TOL_PX, `${width}px: the x band's label sits at the range start`);
    // An x limit past the plot's midpoint has its label end-anchored left of its line, inside the viewBox.
    svg = ELEO.curve({ series, x, y, limits: [{ x: 400, label: 'Nyquist 400' }, { x: 50, label: 'early' }], width, height });
    const ny = svg.match(/<text class="eleo-tick" x="([^"]*)" y="[^"]*"([^>]*)>Nyquist 400<\/text>/), ea = svg.match(/<text class="eleo-tick"([^>]*)>early<\/text>/);
    assert.ok(ny, `${width}px: the Nyquist label is drawn`);
    assert.match(ny[2], /text-anchor="end"/, `${width}px: a label past the midpoint is end-anchored`);
    assert.ok(+ny[1] <= width, `${width}px: the label's anchor is inside the viewBox`);
    assert.ok(Math.abs(+ny[1] + 0.4 * lt(svg) - panelGroups(svg)[0].box.x - toPx(seriesGroup(svg).M, [400, 0])[0]) <= TOL_PX, `${width}px: the label sits 0.4 t left of its line`);
    assert.ok(!/text-anchor/.test(ea[1]), `${width}px: a label before the midpoint keeps the start anchor`);
    // A band whose left edge is past the midpoint is end-anchored inside the band, at its right edge.
    svg = ELEO.curve({ series, x, y, limits: [{ x: [280, 360], label: 'late band' }, { x: [300, 900], label: 'late clip' }], width, height });
    const lb = svg.match(/<text class="eleo-tick" x="([^"]*)" y="[^"]*"([^>]*)>late band<\/text>/), lc = svg.match(/<text class="eleo-tick" x="([^"]*)" y="[^"]*"([^>]*)>late clip<\/text>/);
    const lx = panelGroups(svg)[0].box.x, lm = seriesGroup(svg).M;
    assert.ok(lb && lc && /text-anchor="end"/.test(lb[2]), `${width}px: a late band's label is end-anchored`);
    assert.ok(Math.abs(+lb[1] + 0.4 * lt(svg) - lx - toPx(lm, [360, 0])[0]) <= TOL_PX, `${width}px: a late band's label ends 0.4 t inside its right edge`);
    assert.ok(Math.abs(+lc[1] + 0.4 * lt(svg) - lx - toPx(lm, [400, 0])[0]) <= TOL_PX, `${width}px: a clipped late band's label ends at the range end`);
    // A band wholly outside the range has none.
    svg = ELEO.curve({ series, x, y, limits: [{ y: [2, 9], label: 'gone' }, { x: [500, 600], label: 'gone' }], width, height });
    assert.ok(!svg.includes('gone'), 'no label for a band outside the range');
  }
  assert.throws(() => ELEO.curve({ kind: 'mtf', limits }), { name: 'TypeError', message: 'curve: limits need series or panels' });
  assert.ok(!ELEO.curve({ series, x, y }).includes('eleo-limit'), 'no limits, no marks');
  assert.throws(() => ELEO.curve({ series, x, y, limits: [{ y: [0.5, 0.5] }] }), { name: 'TypeError', message: 'curve: a band needs two distinct ends' });
  assert.throws(() => ELEO.curve({ series, x, y, limits: [{ x: [3, 3] }] }), { name: 'TypeError', message: 'curve: a band needs two distinct ends' });
  for (const bad of [5, [null], [{}], [{ x: 1, y: 1 }], [{ y: NaN }], [{ y: [1] }], [{ y: 'a' }], [{ y: 1, label: 3 }]]) {
    assert.throws(() => ELEO.curve({ series, x, y, limits: bad }), { name: 'TypeError', message: /^curve: / }, JSON.stringify(bad));
  }
});

// Plan #284, outcome O2 (issue #290; #294 unskips). oracle: property: synthetic and recorded limits recovered through the inverse transform within 0.5 px; an auto range contains every limit.
// What the limits items must provide: curve({ series | panels, limits: [{ x? | y?: number | [lo, hi], label? }] }) draws, inside the data-space group, a number as
// <line class="eleo-limit"> across the plot (x1 y1 x2 y2 in data units) and a pair as <rect class="eleo-limit"> (x y width height in data units), bands before the
// series and lines after them; a limit's label is px-space text. A limit counts toward an auto range.
test('limit lines and bands round trip (U9)', async () => {
  const { marks } = await import('./helpers/svg.js');
  await import('../fixtures/phos-core/adapters.js');
  const { series, x, y } = globalThis.ELEOAdapters.mtf(fixture('achromat-mtf'));
  const limits = [{ y: 0.3, label: 'MTF ≥ 0.3' }, { x: 50 }, { y: [0, 0.3] }];
  const near = (a, b, M, axis, msg) => assert.ok(Math.abs(toPx(M, axis === 'x' ? [a, 0] : [0, a])[axis === 'x' ? 0 : 1] - toPx(M, axis === 'x' ? [b, 0] : [0, b])[axis === 'x' ? 0 : 1]) <= TOL_PX, msg);
  // The limit marks of one group: the horizontal line, the vertical line and the band, each recovered through the group's transform.
  const check = (g, ranges, msg) => {
    const lines = marks(g, 'line').filter((l) => l.limit), rects = marks(g, 'rect').filter((r) => r.limit);
    assert.equal(lines.length, 2, `${msg}: a line per number limit`);
    assert.equal(rects.length, 1, `${msg}: a rect per pair limit`);
    const h = lines.find((l) => l.y1 === l.y2), v = lines.find((l) => l.x1 === l.x2);
    assert.ok(h && v, `${msg}: one horizontal and one vertical line`);
    near(h.y1, 0.3, g.M, 'y', `${msg}: the y line sits at 0.3`);
    near(v.x1, 50, g.M, 'x', `${msg}: the x line sits at 50`);
    // Each line crosses the whole plot: its ends lie at or beyond the range ends.
    const [lo, hi] = ranges.x, [ylo, yhi] = ranges.y;
    assert.ok(Math.min(h.x1, h.x2) <= lo + 1e-9 && Math.max(h.x1, h.x2) >= hi - 1e-9, `${msg}: the y line spans the x range`);
    assert.ok(Math.min(v.y1, v.y2) <= ylo + 1e-9 && Math.max(v.y1, v.y2) >= yhi - 1e-9, `${msg}: the x line spans the y range`);
    near(rects[0].y, 0, g.M, 'y', `${msg}: the band starts at 0`);
    near(rects[0].y + rects[0].height, 0.3, g.M, 'y', `${msg}: the band ends at 0.3`);
    assert.ok(rects[0].x <= lo + 1e-9 && rects[0].x + rects[0].width >= hi - 1e-9, `${msg}: the band spans the x range`);
    // Bands under the series, lines over them.
    // A single plot draws its series as <polyline>, a panel as <path>.
    const at = (f) => Math.max(...['<path', '<polyline'].map((t) => g.body[f](t)));
    const first = [g.body.indexOf('<path'), g.body.indexOf('<polyline')].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? -1, last = at('lastIndexOf');
    assert.ok(first >= 0, `${msg}: the series are drawn`);
    assert.ok(g.body.indexOf('<rect') < first, `${msg}: the band is under the series`);
    assert.ok(g.body.indexOf('<line') > last, `${msg}: the lines are over the series`);
  };
  for (const [width, height] of SIZES) {
    // Single plot, caller ranges.
    let svg = ELEO.curve({ series, x, y, limits, width, height });
    assert.ok(svg.includes('MTF ≥ 0.3'), `${width}px: the limit's label is drawn`);
    check(seriesGroup(svg), { x: x.range, y: y.range }, `${width}px single`);
    // Single plot, auto ranges: the range contains every limit, here two beyond the data.
    const wide = [...limits, { y: 1.6 }, { x: [-20, 400] }];
    const { range: _x, ...xAuto } = x, { range: _y, ...yAuto } = y;
    svg = ELEO.curve({ series, x: xAuto, y: yAuto, limits: wide, width, height });
    const f = frame(svg), g = seriesGroup(svg);
    const [xlo, ylo] = toData(g.M, [0, f.ph]), [xhi, yhi] = toData(g.M, [f.pw, 0]);
    assert.ok(ylo <= 0 && yhi >= 1.6, `${width}px auto: the y range [${ylo}, ${yhi}] contains the limits 0 and 1.6`);
    assert.ok(xlo <= -20 && xhi >= 400, `${width}px auto: the x range [${xlo}, ${xhi}] contains the band -20 to 400`);
    // Panels: every panel carries the limits, recovered through its own transform.
    const panels = [];
    for (let i = 0; i < series.length; i += 2) panels.push({ title: `field ${i / 2}`, series: series.slice(i, i + 2).map((s) => ({ points: s.points, index: s.index })) });
    assert.ok(panels.length >= 2, 'panels for each field');
    svg = ELEO.curve({ panels, columns: 2, x, y, limits, width, height });
    const groups = panelGroups(svg);
    assert.equal(groups.length, panels.length, `${width}px: one group per panel`);
    groups.forEach((pg, p) => check({ ...pg }, { x: x.range, y: y.range }, `${width}px panel ${p}`));
    // Panels, auto ranges: the shared range contains the wide limits too.
    svg = ELEO.curve({ panels, columns: 2, x: xAuto, y: yAuto, limits: wide, width, height });
    const pf = frame(svg);
    panelGroups(svg).forEach((pg, p) => {
      const [plo, qlo] = toData(pg.M, [-0.01, pf.ph + 0.01]), [phi, qhi] = toData(pg.M, [pf.pw + 0.01, -0.01]);
      assert.ok(qlo <= 0 && qhi >= 1.6 && plo <= -20 && phi >= 400, `${width}px panel ${p} auto range [${plo},${phi}]x[${qlo},${qhi}] contains the limits`);
    });
  }
});

// spec #199
import { idx } from '../../packages/plots/src/common.js';
test('unknown roles and bad indexes throw (#199)', () => {
  const draw = (s) => ELEO.curve({ series: [{ points: [[0, 0], [1, 1]], ...s }], x: { range: [0, 1] }, y: { range: [0, 1] } });
  for (const role of ['Sagittal', 'ref', '', null, 3]) {
    assert.throws(() => draw({ role }), { name: 'TypeError', message: `curve: unknown role "${role}"` }, String(role));
  }
  for (const index of [-1, 1.5, NaN, Infinity, '0', null]) {
    assert.throws(() => draw({ index }), { name: 'TypeError', message: 'curve: index must be a non-negative integer' }, String(index));
  }
  for (const role of ['tangential', 'sagittal', 'reference', undefined]) assert.doesNotThrow(() => draw({ role, index: 0 }), String(role));
  const lim = draw({ role: 'limit' });
  assert.match(lim, /stroke="var\(--ink\)"[^>]*stroke-width="[\d.]+"[^>]*stroke-linecap="butt"[^>]*stroke-dasharray="6 3 1 3"/);
  assert.equal(idx(-1), idx(7));
  assert.equal(idx(-9), idx(7));
  assert.equal(idx(8), idx(0));
});

// Plan #512, issue #517. oracle: closed-form ADR-0003 (frameOf's F + m * t(F) = W, margins in text units 4.6 left, 3.6 bottom, 2.6 top, the right one 1.2 or 0.3 a character of the widest x label)
test('text and margins follow ADR-0003', async () => {
  const { frameText, frameWeight, frameOf } = await import('../../packages/plots/src/scale.js');
  const series = [{ points: [[0, 0], [1, 2], [2, 1]], index: 0, role: 'tangential' }];
  const input = { series, x: { label: 'Frequency', unit: 'cy/mm', range: [0, 2], ticks: [0, 1, 2] }, y: { label: 'Modulus', range: [0, 2], ticks: [0, 1, 2] } };
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= 0.01, `${msg}: ${a} against ${b}`);
  const m = 4.6 + 1.2;
  for (const W of [200, 300, 460, 1200]) {
    const svg = ELEO.curve({ ...input, width: W });
    const rect = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="none" stroke="var\(--plot-grid\)"\/>/.exec(svg);
    const [L, T, F, ph] = rect.slice(1).map(Number), t = frameText(F);
    near(F, frameOf(W, m), `${W}: frame width is frameOf`);
    near(F + m * t, W, `${W}: F + m t = W`);
    near(L, 4.6 * t, `${W}: left margin`);
    near(T, 2.6 * t, `${W}: top margin`);
    near(T + ph + 3.6 * t, Math.round(W * 260 / 460), `${W}: a missing height is 260/460 of the width in whole px, bottom margin 3.6 t`);
    const sizes = [...svg.matchAll(/<text\b[^>]*>/g)].map((x) => /style="font-size:([\d.]+)px"/.exec(x[0]));
    assert.ok(sizes.length >= 8 && sizes.every(Boolean), `${W}: every text carries an inline size`);
    sizes.forEach((s) => near(+s[1], t, `${W}: text size`));
    const widths = [...svg.matchAll(/<polyline\b[^>]*\bstroke-width="([\d.]+)"/g)].map((x) => +x[1]);
    assert.equal(widths.length, 1);
    near(widths[0], frameWeight(F), `${W}: series stroke`);
  }
  // the frame height clamps to 1
  const flat = ELEO.curve({ ...input, width: 300, height: 20 });
  assert.match(flat, /<rect [^>]*height="1" fill="none" stroke="var\(--plot-grid\)"/);
});

// Plan #512, issue #540, CR #538. oracle: spec (CR #538): an auto-height SVG lays out at scale 1 in a box of its own width, so its height is whole px
test('default heights are whole px', async () => {
  const { rayFan } = await import('../../packages/plots/src/fan.js');
  const sample = JSON.parse(readFileSync(new URL('../../packages/plots/src/sample.json', import.meta.url), 'utf8'));
  const series = [{ points: [[0, 0], [1, 2], [2, 1]], index: 0, role: 'tangential' }];
  const input = { series, x: { label: 'Frequency', unit: 'cy/mm', range: [0, 2], ticks: [0, 1, 2] }, y: { label: 'Modulus', range: [0, 2], ticks: [0, 1, 2] } };
  const h = (svg) => +/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)[1];
  for (const W of [300.6, 461, 999.9]) {
    const v = h(ELEO.curve({ ...input, width: W }));
    assert.ok(Number.isInteger(v) && Math.abs(v - W * 260 / 460) <= 0.5, `curve ${W}: height ${v}`);
  }
  const cols = sample.fans.length, base = cols * (170 + 58);
  for (const W of [450.3, 901]) {
    const v = h(rayFan({ data: sample, width: W }));
    assert.ok(Number.isInteger(v) && Math.abs(v - W * 314 / base) <= 0.5, `rayFan ${W}: height ${v}`);
  }
});

// Plan #603 (agent_docs/plans/603-recorded-fans.md), outcome O1 (issue #604; #605 records the fixtures, #606 adds ELEOAdapters.fans and unskips).
// oracle: fixture phos-core TransverseRayError recorded by scripts/record-phos-core.py --only fans (roadmap U6, user at plan #464): per source
// { fieldAngleDeg, wavelengths (nm), x: { points: [wavelength][sample] of [pupil, error mm], statuses }, y: same }; a non-Alive sample is a gap.
// Plan #603 M2, issue #624 (CR #621): oracle: fixture as above minus the chief ray, the pupil-0 sample (found by its pupil value) at rec.referenceWavelengthNm of the same fan.
// What #606 provides, #624 changes: ELEOAdapters.fans(rec) -> { panels, columns, x, y } in fanPanels' shape (row Py then row Px, a column per field, µm,
// every non-Alive sample null, each error minus its fan's chief-ray error, a symmetric y range at fanPanels' next nice step over the shifted errors).
test('recorded ray fans round trip (U6)', async () => {
  const { existsSync } = await import('node:fs');
  const { fanPanels } = await import('../../packages/plots/src/fan.js');
  await import('../fixtures/phos-core/adapters.js');
  const { ELEOAdapters } = globalThis;
  assert.ok(typeof ELEOAdapters?.fans === 'function', 'adapters.js assigns globalThis.ELEOAdapters.fans');
  const names = ['achromat-fans', 'cooke-fans'].concat(existsSync(new URL('../fixtures/phos-core/cooke-clipped-fans.json', import.meta.url)) ? ['cooke-clipped-fans'] : []);
  let dead = 0;
  // A clone with one interior alive sample made Dead, as the sample fans test nulls one (the default recordings may have no dead sample).
  const clone = structuredClone(fixture('achromat-fans'));
  clone.sources[1].y.statuses[0][3] = 'Dead';
  // A clone whose field-1 y chief ray at the reference wavelength is Dead: the adapter throws a TypeError naming the field.
  const noChief = structuredClone(fixture('achromat-fans'));
  const refW = (src) => src.wavelengths.indexOf(noChief.referenceWavelengthNm);
  const pupil0 = (src, axis, w) => src[axis].points[w].findIndex(([px]) => px === 0);
  noChief.sources[1].y.statuses[refW(noChief.sources[1])][pupil0(noChief.sources[1], 'y', refW(noChief.sources[1]))] = 'Dead';
  assert.throws(() => ELEOAdapters.fans(noChief), (e) => e instanceof TypeError && e.message.includes(`field ${noChief.sources[1].fieldAngleDeg}°`), 'a dead chief ray throws a TypeError naming the field');
  // A recording whose centre pupil is 1e-17 (a computed -1 + 2i/(n-1)) draws as one at exactly 0; with the nearest sample at 0.05 the chief ray is missing and it throws (#628).
  const tiny = structuredClone(fixture('achromat-fans'));
  tiny.sources.forEach((src) => ['x', 'y'].forEach((axis) => src[axis].points.forEach((fan) => { fan.find(([px]) => px === 0)[0] = 1e-17; })));
  assert.deepEqual(ELEOAdapters.fans(tiny).panels.map((pn) => pn.series.map((sr) => sr.points.map((pt) => pt[1]))), ELEOAdapters.fans(fixture('achromat-fans')).panels.map((pn) => pn.series.map((sr) => sr.points.map((pt) => pt[1]))), 'a centre pupil of 1e-17 gives the errors of one at 0');
  const gapped = structuredClone(fixture('achromat-fans'));
  { const src = gapped.sources[0], w = refW(src), i = pupil0(src, 'y', w); src.y.points[w].splice(i, 1); src.y.statuses[w].splice(i, 1); }
  assert.throws(() => ELEOAdapters.fans(gapped), (e) => e instanceof TypeError && e.message.includes(`field ${gapped.sources[0].fieldAngleDeg}°`), 'a nearest pupil of 0.05 is no chief ray: a TypeError naming the field');
  // A reference wavelength that is not recorded throws too.
  const noRef = structuredClone(fixture('achromat-fans'));
  noRef.referenceWavelengthNm = 123;
  assert.throws(() => ELEOAdapters.fans(noRef), TypeError, 'an unrecorded reference throws a TypeError');
  // A clone with negative field angles: fanPanels titles with U+2212, not a hyphen.
  const neg = structuredClone(fixture('achromat-fans'));
  neg.sources.forEach((s) => { s.fieldAngleDeg = -Math.abs(s.fieldAngleDeg) - 1; });
  for (const [name, rec] of names.map((n) => [n, fixture(n)]).concat([['achromat-fans, one sample made dead', clone], ['achromat-fans, negative field angles', neg]])) {
    const { panels, columns, x, y } = ELEOAdapters.fans(rec);
    assert.equal(columns, rec.sources.length, `${name}: a column per field`);
    assert.equal(panels.length, 2 * columns, `${name}: row Py then row Px`);
    // Titles are fanPanels' own for the same angles (pinned against the number rule copied in adapters.js).
    const own = fanPanels({ fields: rec.sources.map((s) => s.fieldAngleDeg), fans: rec.sources.map(() => ({ T: [[0, 0]], S: [[0, 0]] })) }, { kind: 'tra' });
    assert.deepEqual(panels.map((pn) => pn.title), own.panels.map((pn) => pn.title), `${name}: panel titles are fanPanels'`);
    // Every recorded sample is placed by its own pupil coordinate and error (mm to µm); every non-Alive one is null.
    [['y', 0], ['x', columns]].forEach(([axis, base]) => rec.sources.forEach((src, f) => {
      const rw = src.wavelengths.indexOf(rec.referenceWavelengthNm);
      assert.ok(rw >= 0, `${name} ${axis} field ${f}: the reference wavelength is recorded`);
      const ci = src[axis].points[rw].findIndex(([px]) => px === 0);
      assert.ok(ci >= 0 && src[axis].statuses[rw][ci] === 'Alive', `${name} ${axis} field ${f}: an alive chief ray`);
      const chief = src[axis].points[rw][ci][1];
      const want = src[axis].points.map((fan, w) => fan.map(([px, err], i) => (src[axis].statuses[w][i] === 'Alive' ? [px, (err - chief) * 1000] : [px, null])));
      assert.ok(Math.abs(want[rw][ci][1]) < 1e-9, `${name} ${axis} field ${f}: the reference fan is 0 at pupil 0`);
      assert.equal(panels[base + f].series.length, want.length, `${name} ${axis} field ${f}: a series per wavelength`);
      panels[base + f].series.forEach((s, w) => s.points.forEach((pt, i) => {
        assert.ok(Math.abs(pt[0] - want[w][i][0]) < 1e-9, `${name} ${axis} ${f}/${w}/${i}: pupil`);
        if (want[w][i][1] === null) { dead++; assert.equal(pt[1], null, `${name} ${axis} ${f}/${w}/${i}: a non-Alive sample is null`); }
        else assert.ok(Math.abs(pt[1] - want[w][i][1]) < 1e-9, `${name} ${axis} ${f}/${w}/${i}: error in µm minus the chief ray`);
      }));
    }));
    // The y range is fanPanels' rule on the same maximum (pinned against the copy in adapters.js).
    const live = panels.flatMap((pn) => pn.series.flatMap((s) => s.points.map((pt) => pt[1]).filter((v) => v !== null)));
    const probe = { fields: [0], fans: [{ T: [live], S: [live] }] };
    assert.deepEqual(y.range, fanPanels(probe, { kind: 'tra' }).y.range, `${name}: the symmetric range at fanPanels' step`);
    for (const [width, height] of SIZES) {
      const svg = ELEO.curve({ panels, columns, x, y, width, height });
      const groups = panelGroups(svg);
      assert.equal(groups.length, panels.length, `${name} ${width}px: one group per panel`);
      groups.forEach((g, p) => panels[p].series.forEach((s, k) => {
        const liveSamples = s.points.filter((pt) => pt[1] !== null);
        const drawn = g.paths[k].flat();
        assert.equal(drawn.length, liveSamples.length, `${name} ${width}px panel ${p} series ${k}: every alive sample drawn, no dead one`);
        liveSamples.forEach((pt, i) => {
          const back = toData(g.M, toPx(g.M, drawn[i]));
          const [ex, ey] = toPx(g.M, pt), [gx, gy] = toPx(g.M, back);
          assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${name} ${width}px panel ${p} series ${k} point ${i} within ${TOL_PX} px`);
        });
        let runs = 0, prev = false;
        for (const pt of s.points) { const on = pt[1] !== null; if (on && !prev) runs++; prev = on; }
        assert.equal(g.paths[k].length, runs, `${name} ${width}px panel ${p} series ${k}: a dead sample breaks the series`);
      }));
    }
  }
  assert.ok(dead > 0, 'some dead sample was drawn as a gap (the clone guarantees one)');
});

// Plan #677 M1 (#681): curve draws a key from series labels or `key`.
// oracle: closed-form ADR-0003 (t(F), rows of 1.4 t); the unkeyed SVG is the renderer baseline
test('key', async () => {
  const { frameText, frameOf } = await import('../../packages/plots/src/scale.js');
  const dims = (svg) => svg.match(/viewBox="0 0 (\S+) (\S+)"/).slice(1).map(Number);
  const texts = (svg) => [...svg.matchAll(/<text class="eleo-tick"( data-key)? [^>]*>([^<]*)<\/text>/g)].map((m) => ({ key: !!m[1], text: m[2] }));
  const x = { label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400], ticks: [0, 200, 400] }, y = { label: 'Modulus', range: [0, 1] };
  const pts = [[0, 1], [400, 0]];
  const plain = ELEO.curve({ series: [{ points: pts, role: 'tangential' }], x, y });
  const keyed = ELEO.curve({ series: [{ points: pts, index: 0, role: 'tangential', label: '0.0° T' }, { points: pts, index: 0, role: 'sagittal', label: '0.0° S' }, { points: pts, index: 1, role: 'tangential', label: '0.0° T' }], x, y });
  // One entry per distinct label, a line swatch each, the label under the x label.
  assert.deepEqual(texts(keyed).filter((t) => t.key).map((t) => t.text), ['0.0° T', '0.0° S']);
  assert.equal((keyed.match(/stroke-dasharray="[\d.]+ [\d.]+" fill="none"\/>/g) || []).length, 1, 'the sagittal entry is dashed');
  assert.ok(texts(keyed).some((t) => t.text === 'Spatial frequency, cycles/mm'));
  // Default height grows by the key's rows: round(H + 1.4 t rows + 0.2 t).
  const t = frameText(frameOf(460, 4.6 + 0.3 * 3));
  assert.equal(dims(plain)[1], 300 - 300 + Math.round(460 * 260 / 460));
  assert.equal(dims(keyed)[1], Math.round(260 + 1.4 * t + 0.2 * t), 'one row and the gap');
  // With a height the SVG keeps it and the frame gives up the rows.
  assert.equal(dims(ELEO.curve({ series: [{ points: pts, label: 'a' }], x, y, height: 300 }))[1], 300);
  // `key` replaces the labels; an empty one draws none; no label, no key: unchanged.
  const own = ELEO.curve({ series: [{ points: pts, label: 'ignored' }], key: [{ label: 'T', role: 'tangential' }, { label: 'S', role: 'sagittal', index: 2 }], x, y });
  assert.deepEqual(texts(own).filter((t) => t.key).map((t) => t.text), ['T', 'S']);
  assert.equal(texts(ELEO.curve({ series: [{ points: pts, label: 'a' }], key: [], x, y })).filter((t) => t.key).length, 0);
  // A corner key sits on --surface inside the plot and leaves the size alone.
  const corner = ELEO.curve({ series: [{ points: pts, label: 'a' }], keyAt: 'top-right', x, y });
  assert.deepEqual(dims(corner), dims(plain));
  assert.match(corner, /<rect class="eleo-key"[^>]*fill="var\(--surface\)"\/>/);
  assert.doesNotMatch(corner.match(/<rect class="eleo-key"[^>]*>/)[0], /stroke/);
  // Panels key once below.
  const pan = ELEO.curve({ panels: [{ series: [{ points: pts, label: 'a' }] }, { series: [{ points: pts, label: 'a' }] }], x, y });
  assert.equal(texts(pan).filter((t) => t.key).length, 1);
  assert.throws(() => ELEO.curve({ series: [{ points: pts, label: 'a' }], keyAt: 'middle' }), /keyAt/);
});

// Plan #677 M1 (#704): a below key's first baseline is one key line (1.4 t) under the x label's baseline.
// oracle: closed-form ADR-0003 (t(F) from the cell width, rows of 1.4 t)
test('key clears the x label', async () => {
  const x = { label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400], ticks: [0, 200, 400] }, y = { label: 'Modulus', range: [0, 1] };
  const pts = [[0, 1], [400, 0]];
  const base = (svg, pred) => [...svg.matchAll(/<text class="eleo-tick"( data-key)? x="[^"]*" y="([^"]*)"[^>]*font-size:([\d.]+)px">([^<]*)<\/text>/g)].filter(pred).map((m) => [+m[2], +m[3]])[0];
  const series = [{ points: pts, label: 'a' }];
  for (const width of [460, 900]) {
    for (const height of [undefined, 300]) {
      for (const panels of [false, true]) {
        const o = panels ? { panels: [{ series }, { series }], x, y, width, height } : { series, x, y, width, height };
        const svg = ELEO.curve(o);
        const xl = base(svg, (m) => !m[1] && m[4] === 'Spatial frequency, cycles/mm'), k = base(svg, (m) => m[1]);
        assert.ok(Math.abs(k[0] - xl[0] - 1.4 * xl[1]) < 0.02, `width ${width} height ${height} panels ${panels}: ${k[0] - xl[0]} against ${1.4 * xl[1]}`);
      }
    }
  }
});

// Plan #677 M1 (#714): a key swatch takes the role's colour, as its curve does.
// oracle: ADR-0001, the reference role is drawn in --ink
test('key swatch follows the role', () => {
  const pts = [[0, 1], [400, 0]];
  const x = { label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400], ticks: [0, 200, 400] }, y = { label: 'Modulus', range: [0, 1] };
  const svg = ELEO.curve({ series: [{ points: pts, role: 'tangential' }], key: [{ label: 'Ref', role: 'reference' }], x, y });
  const sw = svg.match(/<line [^>]*stroke="([^"]*)"[^>]*stroke-dasharray="1 3" fill="none"\/><text class="eleo-tick" data-key/);
  assert.ok(sw, 'a reference swatch line is drawn');
  assert.equal(sw[1], 'var(--ink)');
});

// Plan #677 M1 (#709): a corner key on a short plot wraps at the plot's width and stays inside the plot frame (a larger box starts inside it on both axes).
// oracle: property a key box that fits lies within the plot frame; a larger one starts inside it on both axes (CR #716)
test('corner key stays in the plot', async () => {
  const pts = [[0, 1], [400, 0]];
  const mk = (n, label) => Array.from({ length: n }, (_, i) => ({ points: pts, index: i, label: label || 'series number ' + i }));
  const nums = (m) => m.slice(1).map(Number);
  const box = (s) => nums(s.match(/<rect class="eleo-key" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/));
  const plot = (s) => nums(s.match(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="none" stroke="var\(--plot-grid\)"/));
  for (const keyAt of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    const o = { keyAt, width: 300, height: 120, x: { range: [0, 400] }, y: { range: [0, 1] } };
    const e = 1e-6;
    let svg = ELEO.curve({ ...o, series: mk(3, 's') });
    let [fx, fy, fw, fh] = plot(svg), [x, y, w, h] = box(svg);
    assert.ok(x >= fx - e && x + w <= fx + fw + e && y >= fy - e && y + h <= fy + fh + e, keyAt + ': 3 short labels lie inside the plot frame, box ' + [x, y, w, h] + ' frame ' + [fx, fy, fw, fh]);
    for (const [name, series] of [['8 labels', mk(8)], ['80-character label', mk(1, 'x'.repeat(80))]]) {
      svg = ELEO.curve({ ...o, series });
      [fx, fy] = plot(svg); [x, y] = box(svg);
      assert.ok(x >= fx - e && y >= fy - e, keyAt + ': ' + name + ' starts inside the plot frame, box ' + [x, y] + ' frame ' + [fx, fy]);
    }
  }
});

// Plan #677, issue #691. oracle: property: grid: false removes exactly the tick grid lines; the tick text and everything else stay, and without it the output is byte-identical.
test('plotCell without grid', async () => {
  const { plotCell } = await import('../../packages/plots/src/curve.js');
  const sc = { xr: [0, 10], yr: [0, 1], xt: { ticks: [0, 5, 10], decimals: 0 }, yt: { ticks: [0, 0.5, 1], decimals: 1 }, R: 10, Rt: 1 };
  const mg = { L: 40, B: 30, R: 10, t: 10 };
  const on = plotCell(sc, [], 300, 200, 10, false, '', undefined, mg);
  const off = plotCell(sc, [], 300, 200, 10, false, '', undefined, { ...mg, grid: false });
  assert.equal(plotCell(sc, [], 300, 200, 10, false, '', undefined, { ...mg, grid: true }), on, 'grid: true is the default');
  const lines = (s) => (s.match(/<line [^>]*stroke="var\(--plot-grid\)"[^>]*\/>/g) || []).length;
  const texts = (s) => s.match(/<text [^>]*>[^<]*<\/text>/g);
  assert.equal(lines(on), 6, 'three x and three y grid lines by default');
  assert.equal(lines(off), 0, 'no grid lines with grid: false');
  assert.deepEqual(texts(off), texts(on), 'tick text unchanged');
  assert.equal(on.replace(/<line [^>]*stroke="var\(--plot-grid\)"[^>]*\/>/g, ''), off, 'nothing else differs');
});
