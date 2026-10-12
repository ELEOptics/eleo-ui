// Acceptance tests for plan #232 (agent_docs/plans/232-panels-spot.md), outcome O2.
// oracle: fixture phos-core SpotDiagram recorded by scripts/record-phos-core.py (roadmap U7); inverting each panel's transform recovers every point within 0.5 px
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ELEO from '../../packages/plots/src/index.js';

// adapters.js reads ELEO from globalThis when spot() runs, not when it loads.
globalThis.ELEO = ELEO;

import { TOL_PX, SIZES, fixture, panelGroups, toPx, toData } from './helpers/svg.js';

// The shapes this test assumes:
//  - tests/fixtures/phos-core/{achromat,cooke}-spot.json. Per source rec.sources[i]: fieldAngleDeg, wavelengths (nm, one per
//    entry of points), points (per wavelength, an array of [x, y] in mm), enclosingRadius (per wavelength and polychromatic).
//  - tests/fixtures/phos-core/adapters.js: ELEOAdapters.spot(rec) returns { unit, origin, panels }: one panel per source,
//    { title (the field angle), series: [{ points: [[x, y] in µm, …], index: wavelength k }], airy (the Airy radius, µm) }, unit 'µm'.
//  - ELEO.spot({ panels, scale, half, unit, width, height }) draws one nested <svg> and matrix <g> per panel; each series is
//    one <path> of `M x y h0` dots in the group's data coordinates, and a panel's `airy` is a <circle r="…"> in that group
//    (r in data units, centred on the origin, inside the matrix <g>). scale 'common' gives every panel one scale, 'auto' fits each.
test('recorded spot round trip (U7)', async () => {
  await import('../fixtures/phos-core/adapters.js');
  const { ELEOAdapters } = globalThis;
  assert.ok(ELEOAdapters && typeof ELEOAdapters.spot === 'function', 'adapters.js assigns globalThis.ELEOAdapters.spot');
  for (const lens of ['achromat', 'cooke']) {
    const rec = fixture(`${lens}-spot`);
    const { panels, unit, scale: given } = ELEOAdapters.spot(rec);
    assert.equal(panels.length, rec.sources.length, `${lens}: one panel per source`);
    assert.equal(unit, 'µm', `${lens}: the adapter converts mm to µm`);
    // The points are the recording's, in µm.
    panels.forEach((p, i) => {
      const src = rec.sources[i];
      assert.equal(p.series.length, src.wavelengths.length, `${lens} panel ${i}: a series per wavelength`);
      p.series.forEach((s, w) => {
        assert.equal(s.points.length, src.points[w].length, `${lens} panel ${i} series ${w}: every recorded point`);
        s.points.forEach(([x, y], j) => assert.ok(Math.abs(x - src.points[w][j][0] * 1000) < 1e-6 && Math.abs(y - src.points[w][j][1] * 1000) < 1e-6, `${lens} panel ${i} series ${w} point ${j} is the recorded mm value in µm`));
      });
      assert.ok(p.airy > 0, `${lens} panel ${i}: an Airy circle radius`);
    });
    for (const scale of ['common', 'auto']) {
      for (const [width, height] of SIZES) {
        const svg = ELEO.spot({ panels, scale, unit, width, height });
        const groups = panelGroups(svg);
        const label = `${lens} ${scale} ${width}px`;
        assert.equal(groups.length, panels.length, `${label}: one nested <svg> and group per panel`);
        // Each panel's inner markup: from its nested <svg> to the next one (the last to the end).
        const starts = [...svg.matchAll(/<svg\b/g)].map((m) => m.index).slice(1);
        groups.forEach((g, p) => {
          const [a, b, c, d] = g.M;
          assert.ok(Math.abs(b) < 1e-9 && Math.abs(c) < 1e-9, `${label} panel ${p}: no rotation or skew`);
          assert.ok(Math.abs(Math.abs(a) - Math.abs(d)) <= 1e-9 * Math.abs(a), `${label} panel ${p}: |a| = |d|, one scale on both axes`);
          assert.equal(g.paths.length, panels[p].series.length, `${label} panel ${p}: one path per series`);
          panels[p].series.forEach((s, k) => {
            const drawn = g.paths[k].flat();
            assert.equal(drawn.length, s.points.length, `${label} panel ${p} series ${k}: every point drawn`);
            s.points.forEach((pt, i) => {
              const back = toData(g.M, toPx(g.M, drawn[i]));
              const [ex, ey] = toPx(g.M, pt), [gx, gy] = toPx(g.M, back);
              assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${label} panel ${p} series ${k} point ${i} within ${TOL_PX} px`);
              // In the box: the scale fits the points.
              assert.ok(ex >= -TOL_PX && ex <= g.box.pw + TOL_PX && ey >= -TOL_PX && ey <= g.box.ph + TOL_PX, `${label} panel ${p} series ${k} point ${i} inside its box`);
            });
          });
          // The circle's radius maps to the given radius: |a| · r is the given radius in px.
          const body = svg.slice(starts[p], starts[p + 1] ?? svg.length);
          const r = /<circle\b[^>]*\br="([\d.eE+\-]+)"/.exec(body);
          assert.ok(r, `${label} panel ${p}: the reference circle is drawn`);
          assert.ok(Math.abs(Math.abs(a) * (+r[1] - panels[p].airy)) <= TOL_PX, `${label} panel ${p}: the circle's radius maps to the given radius within ${TOL_PX} px`);
        });
        if (scale === 'common') {
          const a0 = Math.abs(groups[0].M[0]);
          groups.forEach((g, p) => assert.ok(Math.abs(Math.abs(g.M[0]) - a0) <= 1e-9 * a0, `${label} panel ${p}: one common scale across panels`));
        }
      }
    }
  }
});

// #239: spot({ panels }) on synthetic points (the recorded round trip is above).
test('typed points round trip, common and auto scale', () => {
  const panels = [
    { title: '0.0°', series: [{ points: [[0.4, -1.2], [1.1, 0.3], [-0.7, 0.9]], index: 0 }, { points: [[-2.5, 2.2], [0, 0]], index: 2 }], airy: 2.87, notes: ['100 % 6.53 µm'] },
    { title: '1.0°', series: [{ points: [[8, -12], [-14, 3.5], [Infinity, 1], [5, NaN]], index: 0 }], airy: 2.87, notes: [] },
    { title: '2.0°', series: [{ points: [[0.1, 0.2]], index: 1 }] },
  ];
  for (const scale of ['common', 'auto']) {
    for (const [width, height] of SIZES) {
      const svg = ELEO.spot({ panels, scale, unit: 'µm', width, height });
      const label = `${scale} ${width}px`;
      const groups = panelGroups(svg);
      assert.equal(groups.length, panels.length, `${label}: one nested <svg> and group per panel`);
      const starts = [...svg.matchAll(/<svg\b/g)].map((m) => m.index).slice(1);
      groups.forEach((g, p) => {
        const [a, b, c, d] = g.M;
        assert.ok(Math.abs(b) < 1e-9 && Math.abs(c) < 1e-9, `${label} panel ${p}: no rotation or skew`);
        assert.ok(Math.abs(Math.abs(a) - Math.abs(d)) <= 1e-9 * Math.abs(a), `${label} panel ${p}: |a| = |d|`);
        assert.ok(Math.abs(g.box.pw - g.box.ph) < 1e-9, `${label} panel ${p}: a square box`);
        assert.equal(g.paths.length, panels[p].series.length, `${label} panel ${p}: one path per series`);
        panels[p].series.forEach((s, k) => {
          const live = s.points.filter((q) => q.every(Number.isFinite));
          const drawn = g.paths[k].flat();
          assert.equal(drawn.length, live.length, `${label} panel ${p} series ${k}: every finite point drawn, no other`);
          live.forEach((pt, i) => {
            const [ex, ey] = toPx(g.M, pt), [gx, gy] = toPx(g.M, toData(g.M, toPx(g.M, drawn[i])));
            assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${label} panel ${p} series ${k} point ${i} within ${TOL_PX} px`);
            assert.ok(ex >= -TOL_PX && ex <= g.box.pw + TOL_PX && ey >= -TOL_PX && ey <= g.box.ph + TOL_PX, `${label} panel ${p} series ${k} point ${i} inside its box`);
          });
        });
        const body = svg.slice(starts[p], starts[p + 1] ?? svg.length);
        const r = /<circle\b[^>]*\br="([\d.eE+\-]+)"/.exec(body);
        if (panels[p].airy) assert.ok(r && Math.abs(Math.abs(a) * (+r[1] - panels[p].airy)) <= TOL_PX, `${label} panel ${p}: the circle's radius maps to the given radius`);
        else assert.ok(!r, `${label} panel ${p}: no circle unless given`);
        assert.ok(!/<line\b/.test(body), `${label} panel ${p}: no caller-given cross`);
      });
      if (scale === 'common') groups.forEach((g, p) => assert.ok(Math.abs(Math.abs(g.M[0]) - Math.abs(groups[0].M[0])) <= 1e-9 * Math.abs(groups[0].M[0]), `${label} panel ${p}: one common scale`));
      else assert.ok(Math.abs(groups[0].M[0]) > Math.abs(groups[1].M[0]), `${label}: auto fits each panel, the tight one larger`);
      assert.ok(svg.includes('M0.4,-1.2 h0'), `${label}: dots are M x y h0`);
      assert.ok(svg.includes('±') && svg.includes('µm') && svg.includes('100 % 6.53 µm') && svg.includes('1.0°'), `${label}: half, unit, title and notes drawn`);
    }
  }
  assert.ok(ELEO.spot({ panels: [panels[2]], scale: 'common', half: 7 }).includes('±7'), 'half overrides the common size');
});

// #240: spot() on the sample is the adapter spotPanels(sample, o) and then the typed path.
// oracle: reference packages/plots/src/sample.json: points, Airy radius and stats are the sample's.
test('spotPanels carries the sample\'s spots', async () => {
  const { spotPanels } = await import('../../packages/plots/src/spot.js');
  const sample = JSON.parse((await import('node:fs')).readFileSync(new URL('../../packages/plots/src/sample.json', import.meta.url), 'utf8'));
  const o = spotPanels(sample, { scale: 'auto', half: 7 });
  assert.equal(o.unit, 'µm');
  assert.equal(o.scale, 'auto');
  assert.equal(o.half, 7);
  assert.equal(o.panels.length, sample.spots.length, 'a panel per field');
  o.panels.forEach((p, fi) => {
    assert.equal(p.title, `${sample.fields[fi].toFixed(1)}°`);
    assert.equal(p.airy, sample.airy, 'the Airy radius is the circle');
    assert.deepEqual(p.series.map((s) => s.points), sample.spots[fi], 'a series per wavelength, the sample\'s points');
    assert.deepEqual(p.series.map((s) => s.index), sample.spots[fi].map((_, w) => w));
    assert.equal(p.notes, undefined, 'no RMS/GEO notes: the renderer computes them');
  });
  assert.ok(spotPanels(sample, { colorBy: 'field' }).panels.every((p, fi) => p.series.every((s) => s.index === fi)), 'colorBy field: index = field');
  assert.equal(spotPanels(sample, { showStats: false }).showStats, false, 'showStats passes through');
  assert.equal(spotPanels(sample, { airy: false }).panels[0].airy, undefined, 'airy: false draws no circle');
});

// #260: a panel's reference circle counts toward its half, so a circle beyond the spot is not clipped.
// oracle: property: for every panel, circle radius <= half, where half = (box side / 2) / |scale|
test('the half holds the reference circle', () => {
  const panels = [
    { series: [{ points: [[0.5, 0.2], [-0.3, 0.4]] }], airy: 2.87 },
    { series: [{ points: [[0.1, 0.1]] }], airy: 1.2 },
  ];
  for (const scale of ['common', 'auto']) {
    const groups = panelGroups(ELEO.spot({ panels, scale, width: 400, height: 200 }));
    groups.forEach((g, p) => {
      const half = (g.box.pw / 2) / Math.abs(g.M[0]);
      assert.ok(panels[p].airy <= half * (1 + 1e-9), `${scale} panel ${p}: circle ${panels[p].airy} within half ${half}`);
    });
  }
});

// #261:  empty panels non-negative viewBox, no no-op fill-opacity, sample aria-label names colorBy.
// oracle: property, and the base's output ("Spot diagrams, colored by <colorBy>")
test('typed spot hardening', async () => {
  await import('../../packages/plots/src/sample.js');
  const s = ELEO.spot({ panels: [{ series: [{ points: [[0.1, 0.1]] }] }] });
  const vb = /viewBox="([^"]+)"/.exec(ELEO.spot({ panels: [] }))[1].split(/\s+/).map(Number);
  assert.ok(vb.every((v) => v >= 0), 'empty panels give a non-negative viewBox: ' + vb);
  assert.ok(!/fill-opacity/.test(s), 'no fill-opacity on stroked dots');
  assert.ok(ELEO.spot({}).includes('aria-label="Spot diagrams, colored by wavelength"'), 'sample label names colorBy');
  assert.ok(ELEO.spot({ colorBy: 'field' }).includes('colored by field'));
  assert.ok(ELEO.spot({ panels: [{ series: [] }], label: 'Mine' }).includes('aria-label="Mine"'), 'typed call takes a label');
  const ev = ELEO.spot({ panels: [{ series: [] }], label: 'x" onfocus="a<b' });
  assert.ok(ev.includes('aria-label="x&quot; onfocus=&quot;a&lt;b"'), 'label is escaped inside aria-label');
  const pts = [{ points: [[0.5, 0.2]] }];
  const base = ELEO.spot({ panels: [{ series: pts }] });
  const inf = ELEO.spot({ panels: [{ series: pts, airy: Infinity }] });
  assert.equal(inf, base, 'a non-finite circle is neither drawn nor counted');
  assert.ok(!/<circle/.test(inf) && !/Infinity/.test(inf), 'no circle drawn for Infinity');
  assert.equal(ELEO.spot({ panels: [{ series: pts }], half: Infinity }), base, 'a non-finite half is ignored');
  assert.equal(ELEO.spot({ panels: [{ series: pts }], half: '1e400' }), base, 'a string half beyond range is ignored');
});

// #271 (CR #270): reference 'chief' draws the points as given, 'centroid' re-centres each panel on its mean; a caption names the reference.
// oracle: closed form: a panel offset by (3, -2) under 'centroid' draws as the unshifted set under 'chief'; each drawn mean is 0.
test('reference centroid re-centres each panel', () => {
  const base = [[0.4, -1.2], [1.1, 0.3], [-0.7, 0.9], [-2.5, 2.2], [0, 0]];
  const mean = base.reduce((a, q) => [a[0] + q[0] / base.length, a[1] + q[1] / base.length], [0, 0]);
  const centred = base.map((q) => [q[0] - mean[0], q[1] - mean[1]]);
  const mk = (pts, dx = 0, dy = 0) => ({ series: [{ points: pts.slice(0, 3).map((q) => [q[0] + dx, q[1] + dy]), index: 0 }, { points: pts.slice(3).map((q) => [q[0] + dx, q[1] + dy]), index: 1 }] });
  const dots = (svg) => panelGroups(svg).map((g) => g.paths.flat(2));
  const shifted = ELEO.spot({ panels: [mk(base, 3, -2)], reference: 'centroid', width: 300, height: 200 });
  const plain = ELEO.spot({ panels: [mk(centred)], reference: 'chief', width: 300, height: 200 });
  const a = dots(shifted)[0], b = dots(plain)[0];
  assert.equal(a.length, b.length);
  a.forEach((q, i) => assert.ok(Math.hypot(q[0] - b[i][0], q[1] - b[i][1]) < 1e-9, 'offset panel draws as the unshifted set'));
  const m = a.reduce((t, q) => [t[0] + q[0] / a.length, t[1] + q[1] / a.length], [0, 0]);
  assert.ok(Math.abs(m[0]) < 1e-9 && Math.abs(m[1]) < 1e-9, 'drawn mean is 0');
  assert.ok(shifted.includes('Reference: centroid'), 'caption names centroid');
  assert.ok(ELEO.spot({ panels: [mk(base)], origin: 'paraxial chief ray' }).includes('Reference: paraxial chief ray'), 'caption names the origin');
  assert.ok(ELEO.spot({ panels: [mk(base)] }).includes('Reference: chief ray'), 'default caption');
  assert.deepEqual(dots(ELEO.spot({ panels: [mk(base, 3, -2)] }))[0][0], [3.4, -3.2], 'chief draws as given');
});

// #272 (CR #270): RMS and GEO about the reference, behind showStats; the caption names them.
// oracle: closed form: points (±3, 0), (0, ±4) give RMS sqrt(12.5) = 3.54 and GEO 4.00 about the origin; offset by (1, 1) and drawn under 'centroid' they give the same.
test('stats about the reference', () => {
  const pts = [[3, 0], [-3, 0], [0, 4], [0, -4]];
  const off = pts.map((q) => [q[0] + 1, q[1] + 1]);
  const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  const chief = texts(ELEO.spot({ panels: [{ series: [{ points: pts }], notes: ['mine'] }], unit: 'µm' }));
  assert.ok(chief.includes('RMS 3.54 µm') && chief.includes('GEO 4.00 µm'), 'stats about the origin: ' + chief);
  assert.ok(chief.indexOf('RMS 3.54 µm') < chief.indexOf('GEO 4.00 µm') && chief.indexOf('GEO 4.00 µm') < chief.indexOf('mine'), 'stats come before the caller\'s notes');
  assert.ok(chief.includes('Reference: chief ray') && chief.includes('RMS, GEO'), 'caption: ' + chief);
  const cen = texts(ELEO.spot({ panels: [{ series: [{ points: off }] }], reference: 'centroid', unit: 'µm' }));
  assert.ok(cen.includes('RMS 3.54 µm') && cen.includes('GEO 4.00 µm'), 'stats about the centroid: ' + cen);
  assert.ok(cen.includes('Reference: centroid') && cen.includes('RMS, GEO'));
  const off1 = texts(ELEO.spot({ panels: [{ series: [{ points: pts }], notes: ['mine'] }], showStats: false, unit: 'µm' }));
  assert.ok(!off1.some((t) => /^(RMS|GEO)\b/.test(t)) && off1.includes('mine'), 'showStats false omits the notes');
  assert.ok(off1.every((t) => t !== 'RMS, GEO'), 'and the caption clause');
  const none = texts(ELEO.spot({ panels: [{ series: [{ points: [[NaN, 1], null] }] }] }));
  assert.ok(!none.some((t) => /^(RMS|GEO)\b/.test(t)), 'no drawn points, no stats');
});

// #273 (CR #270): a panel's `airy` radius is drawn about the origin when showAiry (default true) and named in the caption.
// oracle: property: with airy 2.87 the circle's radius maps to 2.87 within 0.5 px and the caption says `Airy radius 2.87 µm`; showAiry false leaves no <circle and no clause.
test('Airy circle toggled and labelled', () => {
  const series = [{ points: [[0.5, 0.2], [-0.3, 0.4]] }];
  const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  const on = ELEO.spot({ panels: [{ series, airy: 2.87 }], unit: 'µm', width: 300, height: 200 });
  const [g] = panelGroups(on);
  const r = /<circle\b[^>]*\br="([\d.eE+\-]+)"/.exec(on);
  assert.ok(r, 'the circle is drawn');
  assert.ok(Math.abs(Math.abs(g.M[0]) * (+r[1] - 2.87)) <= TOL_PX, 'its radius maps to 2.87');
  assert.ok(['Reference: chief ray', 'Airy radius 2.87 µm', 'RMS, GEO'].every((t) => texts(on).includes(t)), 'caption: ' + texts(on));
  const off = ELEO.spot({ panels: [{ series, airy: 2.87 }], unit: 'µm', showAiry: false, width: 300, height: 200 });
  assert.ok(!/<circle/.test(off) && !texts(off).some((t) => /Airy/.test(t)), 'showAiry false: no circle, no clause');
  assert.equal(off, ELEO.spot({ panels: [{ series }], unit: 'µm', width: 300, height: 200 }), 'and the radius no longer counts toward the half');
  const mixed = ELEO.spot({ panels: [{ series, airy: 1 }, { series, airy: 2 }], unit: 'µm' });
  assert.ok(texts(mixed).some((t) => t.includes('Airy circle') && !t.includes('radius')), 'differing radii: Airy circle');
});

// #275 (CR #270): the caption is one line per active setting, inside the figure; stats at 3 significant digits; centroid default for the sample.
// oracle: property: each caption line's estimated width (6 px a character, as layout2D estimates) <= the viewBox width; radii equal at 3 digits print once.
test('caption lines and stats labels', async () => {
  const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  const vbw = (svg) => +/viewBox="0 0 ([\d.]+)/.exec(svg)[1];
  const series = [{ points: [[0.4, -1.2], [1.1, 0.3]] }];
  const one = ELEO.spot({ panels: [{ series, airy: 2.87 }], unit: 'µm', reference: 'centroid' });
  const cap = texts(one).filter((t) => /^(Reference|Airy|RMS, GEO)/.test(t));
  assert.deepEqual(cap, ['Reference: centroid', 'Airy radius 2.87 µm', 'RMS, GEO'], 'one line per clause');
  cap.forEach((t) => assert.ok(6 * t.length <= vbw(one), `caption line "${t}" fits ${vbw(one)} px`));
  const ys = [...one.matchAll(/<text[^>]*\by="([\d.]+)"[^>]*>(Reference|Airy radius|RMS, GEO)/g)].map((m) => +m[1]);
  assert.ok(ys[1] - ys[0] === 15 && ys[2] - ys[1] === 15, 'lines 15 px apart');
  const H = +/viewBox="0 0 [\d.]+ ([\d.]+)/.exec(one)[1];
  assert.ok(ys[2] < H, 'last line inside the height');
  const mm = texts(ELEO.spot({ panels: [{ series: [{ points: [[0.001234, 0], [-0.001234, 0]] }] }], unit: 'mm' }));
  assert.ok(mm.includes('RMS 0.00123 mm') && mm.includes('GEO 0.00123 mm'), 'three significant digits: ' + mm);
  const { spotPanels } = await import('../../packages/plots/src/spot.js');
  const sample = JSON.parse((await import('node:fs')).readFileSync(new URL('../../packages/plots/src/sample.json', import.meta.url), 'utf8'));
  assert.equal(spotPanels(sample).reference, 'centroid', 'the sample is centroid-referenced');
  assert.equal(spotPanels(sample, { reference: 'chief' }).reference, 'chief', 'a given reference wins');
  const pts = [{ points: [[3, 1], [5, 3]] }];
  assert.equal(ELEO.spot({ panels: [{ series: pts }], reference: ' Centroid ' }), ELEO.spot({ panels: [{ series: pts }], reference: 'centroid' }), 'a mis-cased reference re-centres');
  assert.ok(!texts(ELEO.spot({ panels: [{ series: [{ points: [[NaN, 1]] }] }] })).includes('RMS, GEO'), 'no stats line for empty points');
  assert.ok(!texts(ELEO.spot({ panels: [] })).includes('RMS, GEO'), 'nor for no panels');
  const eq = texts(ELEO.spot({ panels: [{ series: pts, airy: 2.87 }, { series: pts, airy: 2.87 + 2 * Number.EPSILON * 2.87 }], unit: 'µm' }));
  assert.ok(eq.includes('Airy radius 2.87 µm') && !eq.includes('Airy circle'), 'radii equal at the printed precision print one radius: ' + eq);
  const lone = ELEO.spot({ panels: [{ series: pts }], origin: 'paraxial chief ray' });
  texts(lone).filter((t) => /^Reference/.test(t)).forEach((t) => assert.ok(6 * t.length + 12 <= vbw(lone), `one-panel "${t}" fits ${vbw(lone)} px`));
  const big = texts(ELEO.spot({ panels: [{ series: [{ points: [[1234, 0], [-1234, 0]] }], airy: 4 }], unit: 'µm' }));
  assert.ok(big.includes('GEO 1234 µm') && big.includes('RMS 1234 µm'), 'no exponent from 1000 up: ' + big);
  assert.ok(big.includes('Airy radius 4.00 µm'), 'the Airy radius prints through the same formatter: ' + big);
  const mixed = texts(ELEO.spot({ panels: [{ series: pts, airy: 2.87 }, { series: pts }], unit: 'µm' }));
  assert.ok(mixed.includes('Airy circle') && !mixed.some((t) => /^Airy radius/.test(t)), 'mixed panels say Airy circle: ' + mixed);
  const cross = texts(ELEO.spot({ panels: [{ series: [{ points: [[3, 0], [-3, 0], [0, 4], [0, -4]] }] }], unit: 'µm' }));
  assert.ok(cross.includes('GEO 4.00 µm') && cross.includes('RMS 3.54 µm'), 'three significant digits: ' + cross);
  const small = ELEO.spot({ panels: [{ series: pts, airy: 2.87 }], height: 60 });
  const Hs = +/viewBox="0 0 [\d.]+ ([\d.]+)/.exec(small)[1];
  const tys = [...small.matchAll(/<text[^>]*\by="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(tys.length && tys.every((y) => y < Hs), `every text y inside the viewBox height ${Hs}: ${tys}`);
});
