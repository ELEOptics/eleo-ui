// Acceptance tests for plan #232 (agent_docs/plans/232-panels-spot.md), outcome O2.
// oracle: fixture phos-core SpotDiagram recorded by scripts/record-phos-core.py (roadmap U7); inverting each panel's transform recovers every point within 0.5 px
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ELEO from '../../packages/plots/src/index.js';
import { idx } from '../../packages/plots/src/common.js';
import * as common from '../../packages/plots/src/common.js';
import { readFileSync } from 'node:fs';
import { frameText } from '../../packages/plots/src/scale.js';

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
      assert.ok(!svg.includes('±') && svg.includes('x, y in µm') && svg.includes('100 % 6.53 µm') && svg.includes('1.0°'), `${label}: unit, title and notes drawn, no ±half`);
    }
  }
  assert.ok(ELEO.spot({ panels: [panels[2]], scale: 'common', half: 7 }).includes('>−5<'), 'half overrides the common size: the ticks run to ±5');
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
  // #269: a subnormal half or extent must not make the scale non-finite.
  assert.ok(!/Infinity|NaN/.test(ELEO.spot({ panels: [{ series: pts }], half: 1e-310 })), 'a subnormal half gives a finite scale');
  assert.ok(!/Infinity|NaN/.test(ELEO.spot({ panels: [{ series: [{ points: [[5e-324, 0]] }] }], scale: 'auto' })), 'a subnormal extent gives a finite scale');
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

// Plan #464, O1 (issue #466): a panel's `circle {radius, label}` draws like the Airy circle and is captioned `<label> <r> <unit>`.
// oracle: property: radius 1.5 maps to 1.5 within 0.5 px, the caption line says `Semi-diameter 1.50 mm`, the half covers the circle, and no circle gives markup identical to today's.
test('labelled circle', () => {
  const series = [{ points: [[0.5, 0.2], [-0.3, 0.4]] }];
  const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  const base = { unit: 'mm', width: 300, height: 200 };
  const on = ELEO.spot({ panels: [{ series, circle: { radius: 1.5, label: 'Semi-diameter' } }], ...base });
  const [g] = panelGroups(on);
  const r = /<circle\b[^>]*\br="([\d.eE+\-]+)"/.exec(on);
  assert.ok(r, 'the circle is drawn');
  assert.ok(Math.abs(Math.abs(g.M[0]) * (+r[1] - 1.5)) <= TOL_PX, 'its radius maps to 1.5');
  assert.ok(texts(on).includes('Semi-diameter 1.50 mm'), 'caption: ' + texts(on));
  assert.ok(texts(on).includes('1') && texts(on).includes('−1') && !texts(on).includes('2'), 'the half (2) covers the circle, its ticks stop at ±1: ' + texts(on));
  const plain = ELEO.spot({ panels: [{ series }], ...base });
  assert.equal(ELEO.spot({ panels: [{ series, circle: undefined }], ...base }), plain, 'undefined circle: same markup');
  const two = ELEO.spot({ panels: [{ series, circle: { radius: 1, label: 'Stop' } }, { series, circle: { radius: 2, label: 'Stop' } }], unit: 'mm' });
  assert.ok(texts(two).includes('Stop') && !texts(two).some((t) => /^Stop \d/.test(t)), 'differing radii: label alone');
  const same = ELEO.spot({ panels: [{ series, circle: { radius: 1, label: 'Stop' } }, { series, circle: { radius: 1, label: 'Stop' } }], unit: 'mm' });
  assert.equal(texts(same).filter((t) => t === 'Stop 1.00 mm').length, 1, 'equal radii: one shared line');
  const ab = ELEO.spot({ panels: [{ series, circle: { radius: 1, label: 'Stop A' } }, { series, circle: { radius: 1, label: 'Stop B' } }], unit: 'mm' });
  assert.ok(!texts(ab).includes('Stop A 1.00 mm') && texts(ab).includes('Stop A'), 'equal radii, differing labels: the first label alone: ' + texts(ab));
  const empty = ELEO.spot({ panels: [{ series, circle: { radius: 1, label: '' } }, { series, circle: { radius: 2, label: '' } }], unit: 'mm' });
  assert.ok(!texts(empty).includes(''), 'an empty label with differing radii adds no caption text: ' + JSON.stringify(texts(empty)));
  const noLine = (svg) => !texts(svg).some((t) => !t.trim() || t === '1.00 mm');
  const emptyEq = ELEO.spot({ panels: [{ series, circle: { radius: 1, label: '' } }, { series, circle: { radius: 1, label: '' } }], unit: 'mm' });
  assert.ok(noLine(emptyEq), 'an empty label at equal radii adds no caption line: ' + JSON.stringify(texts(emptyEq)));
  const blank = ELEO.spot({ panels: [{ series, circle: { radius: 1, label: ' ' } }, { series, circle: { radius: 2, label: ' ' } }], unit: 'mm' });
  assert.ok(noLine(blank), 'a blank label adds no caption line: ' + JSON.stringify(texts(blank)));
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
  cap.forEach((t) => assert.ok(5.4 * t.length <= vbw(one), `caption line "${t}" fits ${vbw(one)} px`));
  const ys = [...one.matchAll(/<text[^>]*\by="([\d.]+)"[^>]*>(Reference|Airy radius|RMS, GEO)/g)].map((m) => +m[1]);
  assert.ok(Math.abs(ys[1] - ys[0] - 13.5) < 0.011 && Math.abs(ys[2] - ys[1] - 13.5) < 0.011, 'lines 1.5 text units (13.5 px at the 9 px floor) apart');
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
  texts(lone).filter((t) => /^Reference/.test(t)).forEach((t) => assert.ok(5.4 * t.length + 12 <= vbw(lone)+0.011, `one-panel "${t}" fits ${vbw(lone)} px`));
  const big = texts(ELEO.spot({ panels: [{ series: [{ points: [[1234, 0], [-1234, 0]] }], airy: 4 }], unit: 'µm' }));
  assert.ok(big.includes('GEO 1234 µm') && big.includes('RMS 1234 µm'), 'no exponent from 1000 up: ' + big);
  assert.ok(big.includes('Airy radius 4.00 µm'), 'the Airy radius prints through the same formatter: ' + big);
  const mixed = texts(ELEO.spot({ panels: [{ series: pts, airy: 2.87 }, { series: pts }], unit: 'µm' }));
  assert.ok(mixed.includes('Airy circle') && !mixed.some((t) => /^Airy radius/.test(t)), 'mixed panels say Airy circle: ' + mixed);
  const cross = texts(ELEO.spot({ panels: [{ series: [{ points: [[3, 0], [-3, 0], [0, 4], [0, -4]] }] }], unit: 'µm' }));
  assert.ok(cross.includes('GEO 4.00 µm') && cross.includes('RMS 3.54 µm'), 'three significant digits: ' + cross);
  // #278: no exponent at 999.6 or below 1e-6, and the shared-radius check compares what the caption prints.
  const edge = texts(ELEO.spot({ panels: [{ series: pts, airy: 999.6 }], unit: 'µm' }));
  assert.ok(edge.includes('Airy radius 1000 µm'), '999.6 prints 1000: ' + edge);
  const tiny = texts(ELEO.spot({ panels: [{ series: [{ points: [[4e-7, 0], [-4e-7, 0]] }], airy: 4e-7 }], unit: 'mm' }));
  assert.ok(!tiny.some((t) => /\de[+-]?\d/.test(t)), 'no exponent below 1e-6: ' + tiny);
  assert.ok(tiny.includes('0') && tiny.includes('x, y in mm'), 'the tick labels are kept apart, the caption names the unit: ' + tiny);
  const radii = texts(ELEO.spot({ panels: [{ series: pts, airy: 1231, circle: { radius: 1231, label: 'X' } }, { series: pts, airy: 1234, circle: { radius: 1234, label: 'X' } }], unit: 'µm' }));
  assert.ok(radii.includes('Airy circle') && !radii.some((t) => /^Airy radius/.test(t)), '1231 and 1234 differ as printed: ' + radii);
  assert.ok(radii.includes('X') && !radii.some((t) => /^X \d/.test(t)), 'nor does the circle line share them: ' + radii);
  // #473: a value below 1e-100 prints as 0, not 100 digits.
  const deep = texts(ELEO.spot({ panels: [{ series: pts, airy: 1e-200 }], unit: 'mm' }));
  assert.ok(deep.includes('Airy radius 0 mm'), '1e-200 prints 0: ' + deep);
  assert.ok(deep.every((t) => t.length <= 40), 'no caption line longer than 40 characters: ' + deep);
  const small = ELEO.spot({ panels: [{ series: pts, airy: 2.87 }], height: 60 });
  const Hs = +/viewBox="0 0 [\d.]+ ([\d.]+)/.exec(small)[1];
  const tys = [...small.matchAll(/<text[^>]*\by="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(tys.length && tys.every((y) => y < Hs), `every text y inside the viewBox height ${Hs}: ${tys}`);
});

// Plan #464 (agent_docs/plans/464-beam-footprint.md), outcome O1 (issue #465; #469 unskips).
// oracle: fixture: recorded phos-core BeamFootprint of the Cooke triplet (scripts/record-phos-core.py)
// The shapes this test assumes:
//  - tests/fixtures/phos-core/cooke-footprint.json: header semiDiameter (mm); per source rec.sources[i]: points[w] (alive rays, [x, y] in the stop's local mm).
//  - ELEOAdapters.footprint(rec) returns { unit: 'mm', panels: [{ series: [{ points, index }], circle: { radius, label } }] }, one panel.
//  - ELEO.spot draws a panel's `circle` as a <circle r="…"> in the matrix <g>, in data units, like `airy`.
test('recorded footprint round trip (U7)', async () => {
  await import('../fixtures/phos-core/adapters.js');
  const { ELEOAdapters } = globalThis;
  assert.ok(ELEOAdapters && typeof ELEOAdapters.footprint === 'function', 'adapters.js assigns globalThis.ELEOAdapters.footprint');
  const rec = fixture('cooke-footprint');
  const { panels, unit, scale: given } = ELEOAdapters.footprint(rec);
  const R = rec.semiDiameter;
  assert.ok(R > 0 && Number.isFinite(R), 'the recording carries a semi-diameter');
  assert.equal(panels.length, 1, 'one panel');
  assert.equal(panels[0].circle.radius, R, 'the circle is the recorded semi-diameter');
  // The series are the recording's: a series per field, index = field, the points of exactly one wavelength verbatim (mm).
  assert.equal(panels[0].series.length, rec.sources.length, 'a series per field');
  panels[0].series.forEach((s, i) => {
    assert.equal(s.index, i, `series ${i}: index is the field`);
    assert.ok(s.points.length > 0, `series ${i}: not empty`);
    const same = (pts) => pts.length === s.points.length && pts.every(([x, y], j) => x === s.points[j][0] && y === s.points[j][1]);
    const match = rec.sources[i].points.filter(same);
    assert.equal(match.length, 1, `series ${i}: the points of exactly one recorded wavelength, verbatim in mm`);
  });
  for (const scale of ['common', 'auto']) {
    for (const [width, height] of SIZES) {
      const svg = ELEO.spot({ panels, scale: given ?? scale, unit, width, height, showStats: false, showAiry: false });
      const label = `${scale} ${width}px`;
      const [g] = panelGroups(svg);
      assert.ok(g, `${label}: a panel is drawn`);
      const [a, b, c, d] = g.M;
      assert.ok(Math.abs(b) < 1e-9 && Math.abs(c) < 1e-9 && Math.abs(Math.abs(a) - Math.abs(d)) <= 1e-9 * Math.abs(a), `${label}: one scale on both axes`);
      assert.equal(g.paths.length, panels[0].series.length, `${label}: one path per series`);
      panels[0].series.forEach((s, k) => {
        const drawn = g.paths[k].flat();
        assert.equal(drawn.length, s.points.length, `${label} series ${k}: every alive point drawn`);
        s.points.forEach((pt, i) => {
          const [ex, ey] = toPx(g.M, pt), [gx, gy] = toPx(g.M, toData(g.M, toPx(g.M, drawn[i])));
          assert.ok(Math.hypot(ex - gx, ey - gy) <= TOL_PX, `${label} series ${k} point ${i} within ${TOL_PX} px`);
          assert.ok(Math.hypot(...pt) <= R * (1 + 1e-4), `${label} series ${k} point ${i} lies within the semi-diameter`);
        });
      });
      const r = /<circle\b[^>]*\br="([\d.eE+\-]+)"/.exec(svg);
      assert.ok(r, `${label}: the semi-diameter circle is drawn`);
      assert.ok(Math.abs(Math.abs(a) * (+r[1] - R)) <= TOL_PX, `${label}: the circle's radius maps to the semi-diameter within ${TOL_PX} px`);
    }
  }
});

// oracle: property: the docs state the rule spot.js follows (labelled circle's cases)
test('circle caption rule stated alike in index.d.ts and README', async () => {
  const { readFileSync } = await import('node:fs');
  const dts = readFileSync(new URL('../../packages/plots/src/index.d.ts', import.meta.url), 'utf8');
  const readme = readFileSync(new URL('../../packages/plots/README.md', import.meta.url), 'utf8');
  const jsdoc = dts.split('\n').find((l, i, a) => /^\s*circle\??:/.test(a[i + 1] || '') && l.includes('/**'));
  const bullet = readme.split('\n').find((l) => l.startsWith('- **`panels`:**') && l.includes('circle: { radius, label }'));
  assert.ok(jsdoc, 'SpotPanel.circle JSDoc found');
  assert.ok(bullet, 'panels bullet found');
  for (const [name, text] of [['index.d.ts', jsdoc], ['README', bullet]]) {
    assert.match(text, /labels? (all )?agree/, `${name}: the shared line needs the labels to agree`);
    assert.match(text, /empty, blank or missing/, `${name}: no line for an empty, blank or missing label`);
  }
});

// ADR-0003 (plan #512, #525): spot's text is frameText(F) for F = one panel's side, times textScale; the layout around it is in text units
// (1.5 for the x labels and 1.8 more to the title, 1.5 a line, a foot of 4.3 + 1.5 a line, a left margin of 2.4 for the y labels); dots weigh 2.2 * frameWeight(F). throughFocus takes `width` the same way.
// oracle: closed-form ADR-0003
test('text follows ADR-0003 per panel', async () => {
  const { frameText, frameWeight, frameOf } = await import('../../packages/plots/src/scale.js');
  const sample = JSON.parse((await import('node:fs')).readFileSync(new URL('../../packages/plots/src/sample.json', import.meta.url), 'utf8'));
  const near = (a, b, m) => assert.ok(Math.abs(a - b) <= 0.01, `${m}: ${a} against ${b}`);
  const base = { panels: [{ title: '0.0°', series: [{ points: [[0.4, -1.2], [1.1, 0.3]], index: 0 }], airy: 2.87, notes: ['n1'] }], unit: 'µm', reference: 'centroid' };
  const texts = (m) => [...m.matchAll(/<text\b([^>]*)>/g)].map((t) => ({ anchor: /text-anchor="(\w+)"/.exec(t[1]), y: +/\by="(-?[\d.]+)"/.exec(t[1])[1], size: /style="font-size:([\d.]+)px"/.exec(t[1]), cls: /class="([^"]+)"/.exec(t[1])[1] }));
  const hOf = (m) => +/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(m)[1];
  const dots = (m) => [...m.matchAll(/<path d="M[^"]*h0[^"]*"[^>]*stroke-width="([\d.]+)"/g)].map((d) => +d[1]);
  const seen = new Set();
  // One panel: F is the width. 100 is under the band, 200 inside it, 1200 above.
  for (const width of [100, 200, 1200]) {
    seen.add(frameOf(width, 2.4) < 162 ? 'below' : frameOf(width, 2.4) <= 234 ? 'inside' : 'above');
    for (const ts of [1, 0.5, 2]) {
      const F = frameOf(width, 2.4 * ts), t = frameText(F);
      const m = ELEO.spot({ ...base, width, textScale: ts }), tx = texts(m), body = tx.filter((x) => !x.anchor);
      assert.ok(tx.length > body.length, `${width} x${ts}: tick labels drawn`);
      assert.ok(tx.length > 0, `${width}: text drawn`);
      tx.forEach((x, i) => { assert.ok(x.size, `${width}: text ${i} has an inline size`); near(+x.size[1], t * ts, `${width} x${ts} text ${i} size`); });
      // the title is the first text that is not a tick label, 3.3 t under the panel; lines 1.5 t apart.
      const plotBottom = body[0].y - 3.3 * t * ts;
      near(plotBottom, 4 + Math.floor(F * 100) / 100, `${width} x${ts} the panel ends at its side`);
      near(body[2].y - body[1].y, 1.5 * t * ts, `${width} x${ts} line pitch`);
      // 3 notes + 4 caption lines: the foot is (4.3 + 1.5 * 7) t + 1.
      near(hOf(m), Math.floor(F * 100) / 100 + 8 + (4.3 + 1.5 * 7) * t * ts + 1, `${width} x${ts} height`);
      dots(m).forEach((w) => near(w, 2.2 * frameWeight(F), `${width} dot width`));
      assert.ok(dots(m).length > 0, 'dots drawn');
    }
  }
  assert.deepEqual([...seen].sort(), ['above', 'below', 'inside']);
  // Three panels: F is one panel's side, (width - 2 gaps) / 3, not the figure's width.
  const m3 = ELEO.spot({ data: sample, width: 1500 }), F3 = frameOf((1500 - 44) / 3, 2.4);
  texts(m3).forEach((x, i) => near(+x.size[1], frameText(F3), `three panels text ${i}`));
  // A height that bites shrinks the panel; the text follows the smaller side.
  const mh = ELEO.spot({ ...base, width: 600, height: 300 }), side = +/<svg x="[\d.]+" y="4" width="([\d.]+)"/.exec(mh)[1];
  assert.ok(side < 300, 'the height shrank the panel');
  texts(mh).forEach((x, i) => near(+x.size[1], frameText(side), `height-bound text ${i}`));
  assert.ok(hOf(mh) <= 300 + 0.011, 'it fits the height');
  // textScale 1 or unusable draws the default.
  for (const v of [undefined, 1, NaN, 0, -1, Infinity, 'x']) assert.equal(ELEO.spot({ ...base, width: 300, textScale: v }), ELEO.spot({ ...base, width: 300 }), `textScale ${String(v)} changes nothing`);
  // The default panel is 150, which is the floor.
  texts(ELEO.spot({ ...base })).forEach((x, i) => near(+x.size[1], 9, `default text ${i}`));
  const nar = { panels: base.panels, origin: 'a rather long origin name for the reference caption line that is wide', reference: 'chief' };
  const wOf = (m) => +/viewBox="0 0 ([\d.]+) /.exec(m)[1];
  assert.ok(wOf(ELEO.spot({ ...nar, textScale: 0.5 })) < wOf(ELEO.spot(nar)), 'the caption width estimate shrinks');

  // throughFocus: width gives the row label, the y labels' room and the panels (5 columns here); F is a panel's side, rect width + 1.
  const tfSeen = new Set(), tfRects = (m) => [...m.matchAll(/<rect\b[^>]*stroke="var\(--[a-z-]+\)"[^>]*>/g)].map((r) => +/\bwidth="([\d.]+)"/.exec(r[0])[1] + 1);
  const cols = 5; // the sample's defocus steps
  for (const width of [500, 1100, 3000]) {
    const m = ELEO.throughFocus({ data: sample, width }), F = tfRects(m)[0], t = frameText(F);
    tfSeen.add(F < 162 ? 'below' : F <= 234 ? 'inside' : 'above');
    assert.ok(F > 1, `${width}: panels drawn`);
    texts(m).forEach((x, i) => { assert.ok(x.size, `${width}: text ${i} inline`); near(+x.size[1], t, `${width} text ${i}`); });
    near(+/viewBox="0 0 ([\d.]+) /.exec(m)[1], width, `${width}: the figure is as wide as asked`);
    const widths = dots(m);
    assert.ok(widths.length > 0);
    widths.forEach((w) => near(w, 2.2 * frameWeight(F), `${width} dot width`));
    near(F, frameOf((width - cols * 10) / cols, (4.2 + 2.4) / cols), `${width}: F solves the row label's room and the y labels' 2.4 text units`);
  }
  assert.deepEqual([...tfSeen].sort(), ['above', 'below', 'inside']);
});

// #579: a height too small for the notes and caption sets the panel side to frameOf(height - 9, m), floored to 2 decimals.
// oracle: closed-form ADR-0003
test('height fit solves frameOf', async () => {
  const { frameOf } = await import('../../packages/plots/src/scale.js');
  const floor2 = (v) => Math.floor(v * 100) / 100;
  const pts = [[1, 2], [-2, 1], [0.5, -1]];
  const seen = new Set();
  for (const extra of [0, 3]) {
    for (const ts of [1, 2]) {
      // Two stats notes plus `extra` given ones; two caption lines (Reference, RMS/GEO).
      const notes = Array.from({ length: extra }, (_, i) => `note ${i}`);
      const m = (4.3 + 1.5 * (2 + extra + 2)) * ts;
      for (const height of [300, 330, 380, 500, 900]) {
        const svg = ELEO.spot({ panels: [{ series: [{ points: pts }], notes }], width: 2000, height, textScale: ts });
        const side = +/<svg x="[\d.]+" y="4" width="([\d.]+)"/.exec(svg)[1], F = frameOf(height - 9, m);
        seen.add(F < 162 ? 'below' : F <= 234 ? 'inside' : 'above');
        assert.equal(side, Math.max(floor2(F), 1), `${height} x${ts} +${extra}: side is floor2(frameOf(height - 9, m))`);
        const H = +/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)[1];
        assert.ok(H <= height + 0.011, `${height} x${ts} +${extra}: the figure fits the height (${H})`);
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['above', 'below', 'inside']);
});

// #590: the height fit and the drawn foot are one quantity: a fitted figure's bottom is the height, and sits 5 + t below the last caption baseline.
// oracle: closed-form ADR-0003 (foot = (4.3 + 1.5 lines) t + 1; last baseline = side + 4 + (3.3 + 1.5 lines) t)
test('height fit margin is the drawn foot', async () => {
  const pts = [[1, 2], [-2, 1], [0.5, -1]];
  for (const extra of [0, 3]) {
    for (const ts of [1, 2]) {
      const notes = Array.from({ length: extra }, (_, i) => `note ${i}`);
      for (const height of [300, 380, 500, 900]) {
        const svg = ELEO.spot({ panels: [{ series: [{ points: pts }], notes }], width: 2000, height, textScale: ts });
        const H = +/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)[1], t = +/font-size:([\d.]+)px/.exec(svg)[1];
        const lastY = Math.max(...[...svg.matchAll(/<text\b[^>]*\sy="([\d.]+)"/g)].map((m) => +m[1]));
        const tag = `${height} x${ts} +${extra}`;
        assert.ok(Math.abs(H - height) < 0.05, `${tag}: the fitted figure ends at the height (${H})`);
        assert.ok(Math.abs(H - lastY - (5 + t)) < 0.05, `${tag}: the foot below the last baseline is 5 + t (${H - lastY} vs ${5 + t})`);
      }
    }
  }
});

// Plan #677, issue #686. oracle: ADR-0003 foot layout in text units (a key row is 1.4 t after 0.7 t); the height-fit keeps the figure inside `height`
test('key', () => {
  const pts = [[1, 1], [-1, 0.5]];
  const mk = (extra) => ({ panels: [{ series: [{ points: pts, index: 0, label: 'F1 0.0°', ...extra }, { points: pts, index: 1, label: 'F2 17.0°' }] }, { series: [{ points: pts, index: 0, label: 'F1 0.0°' }] }], unit: 'mm', width: 400, height: 260 });
  const svg = ELEO.spot(mk());
  const keys = [...svg.matchAll(/<text [^>]*data-key[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['F1 0.0°', 'F2 17.0°'], 'each distinct label keyed once');
  const keyDots = (sv) => [...sv.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="([^"]+)"\/>/g)].map((m) => ({ cy: +m[2], fill: m[4] }));
  const keyTexts = (sv) => [...sv.matchAll(/<text [^>]*data-key[^>]*y="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map((m) => ({ y: +m[1], text: m[2] }));
  const kd = keyDots(svg), kt = keyTexts(svg);
  assert.equal(kd.length, 2, 'one dot per key entry');
  kd.forEach((d, i) => { assert.equal(d.fill, idx(i), `dot ${i} in idx(${i})`); assert.ok(Math.abs(d.cy - (kt[i].y - 0.4 * 9)) < 1.5, `dot ${i} on its key row`); });
  const H = +svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1];
  const ys = [...svg.matchAll(/<text [^>]*y="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(Math.max(...ys) < H, 'every text inside the height');
  const plain = ELEO.spot({ panels: [{ series: [{ points: pts, index: 0 }] }], unit: 'mm', width: 400, height: 260 });
  assert.ok(!/data-key/.test(plain), 'no label, no key');
  const empty = ELEO.spot({ panels: [{ series: [{ points: pts, index: 0, label: '' }] }], unit: 'mm', width: 400, height: 260 });
  assert.ok(!/data-key/.test(empty), 'an empty label is not keyed');
  assert.equal(empty, plain, 'and reserves no row');
  // a corner: one box per panel inside it, with that panel's labels, and no foot rows
  const corner = ELEO.spot({ ...mk(), keyAt: 'top-right' });
  assert.equal([...corner.matchAll(/class="eleo-key"/g)].length, 2, 'a box per panel');
  assert.deepEqual(keyTexts(corner).map((k) => k.text), ['F1 0.0°', 'F2 17.0°', 'F1 0.0°'], 'each panel its own labels');
  assert.throws(() => ELEO.spot({ ...mk(), keyAt: 'middle' }), TypeError);
  // height, no width, labels that wrap: every key baseline + 0.3 t inside H
  const many = Array.from({ length: 9 }, (_, i) => ({ points: pts, index: i % 8, label: `Field ${i} ${i * 3.5}°` }));
  for (const height of [140, 200, 320]) {
    const sv = ELEO.spot({ panels: [{ series: many }, { series: many }], unit: 'mm', height });
    const Hh = +sv.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1];
    const tt = [...sv.matchAll(/<text [^>]*data-key[^>]*y="([\d.]+)"[^>]*font-size:([\d.]+)px/g)].map((m) => [+m[2], +m[1]]);
    assert.equal(tt.length, 9);
    tt.forEach(([t, y]) => assert.ok(y + 0.3 * t <= Hh + 1e-6, `height ${height}: baseline ${y} + 0.3 * ${t} within ${Hh}`));
  }
});

// #770 (CR #768), #774: a grid at the 1-2-5 ticks strictly inside (-half, half), under the series; the frame draws the edges; grid: false draws none.
// oracle: closed-form the 1-2-5 rule by hand: half 5 steps by 2 (-4 -2 0 2 4), half 10 steps by 5 (-5 0 5); a line sits at side / 2 + t * side / (2 * half)
test('grid', () => {
  const panels = [{ series: [{ points: [[1, 2], [-3, 4]], index: 0 }, { points: [[0, 1]], index: 1 }] }];
  const xs = (svg) => [...svg.matchAll(/<path d="M([\d.]+),([\d.]+) V([\d.]+)" [^>]*data-grid="x"[^>]*\/>/g)];
  const svg = ELEO.spot({ panels, unit: 'µm', width: 300, half: 5 });
  const lines = xs(svg);
  const side = +/<svg x="[\d.]+" y="4" width="([\d.]+)"/.exec(svg)[1], left = +/<svg x="([\d.]+)" y="4"/.exec(svg)[1];
  const at = (ticks, half) => ticks.map((t) => +(left + side / 2 + (t * side) / (2 * half)).toFixed(2));
  assert.deepEqual(lines.map((m) => +(+m[1]).toFixed(2)), at([-4, -2, 0, 2, 4], 5), 'half 5: x positions are -4 -2 0 2 4');
  const big = ELEO.spot({ panels, unit: 'µm', width: 300, half: 10 });
  assert.deepEqual(xs(big).map((m) => +(+m[1]).toFixed(2)), at([-5, 0, 5], 10), 'half 10: -5 0 5, none on the frame edge');
  assert.ok(/stroke="var\(--plot-grid\)"/.test(lines[0][0]), 'the first x grid line has stroke var(--plot-grid)');
  const first = svg.indexOf('stroke-linecap="round"'), last = svg.lastIndexOf('data-grid=');
  assert.ok(last > -1 && first > last, 'every grid line before the first series path');
  assert.ok(/data-grid="y"/.test(svg), 'the SVG has horizontal grid lines too');
  const off = ELEO.spot({ panels, unit: 'µm', width: 300, half: 5, grid: false });
  assert.ok(!/data-grid/.test(off), 'grid: false draws none');
  // every <rect>/<path> that carries var(--plot-grid) (frames, grid lines, crosses) has no number with 3 or more decimals, as the panel's <svg x> has none (width 200.74, 3 panels: origin 74.24000000000001 unrounded)
  const three = ELEO.spot({ panels: [panels[0], panels[0], panels[0]], unit: 'µm', width: 200.74, half: 5 });
  const drawn = [...three.matchAll(/<(?:rect|path)[^>]*var\(--plot-grid\)[^>]*>/g)].map((m) => m[0]);
  assert.ok(drawn.length > 9, 'more than 9 elements carry var(--plot-grid)');
  drawn.forEach((el) => assert.ok(!/\d\.\d{3,}/.test(el), `no number with 3 or more decimals: ${el}`));
  // #776: in every start tag of the whole SVG (titles, captions, notes, the tick labels, the key below and in a corner), for 1, 2 and 3 panels:
  // no number with 3 or more decimals, except in font-size (toFixed(3) by the repo's convention: key.js, plotCell) and in three kinds of element left out of the check: any with matrix(, a path 'M... h0', a circle at cx=0 cy=0.
  const lab = [{ title: 'T', notes: ['n'], airy: 1.2345, circle: { radius: 2.3456, label: 'c' }, series: [{ points: [[1, 2], [-3, 4]], index: 0, label: 'a' }, { points: [[0, 1]], index: 1, label: 'b' }] }];
  for (const n of [1, 2, 3]) for (const keyAt of [undefined, 'top-left', 'bottom-right']) {
    const whole = ELEO.spot({ panels: Array(n).fill(lab[0]), unit: 'µm', width: 200.74, half: 5, keyAt });
    const bad = [...whole.matchAll(/<[a-z][^>]*>/g)].map((m) => m[0]).filter((el) => /\d\.\d{3,}/.test(el.replace(/font-size:[\d.]+px/g, '')) && !/matrix\(|<path d="M[^"]* h0|<circle cx="0" cy="0"/.test(el));
    assert.deepEqual(bad, [], `${n} panels, keyAt ${keyAt}: every start tag but the three left out has no number with 3 or more decimals outside font-size`);
  }
});

// Plan #677 M3 (#783, CR #780): throughFocus draws each cell with spot's panel function: grid under spot's dots, a centre cross, round-cap dots, a clipping nested svg.
// oracle: spec CR #780 (user): every cell drawn by spot's panel function
test('throughFocus panels', async () => {
  const { frameWeight } = await import('../../packages/plots/src/scale.js');
  const sample = JSON.parse((await import('node:fs')).readFileSync(new URL('../../packages/plots/src/sample.json', import.meta.url), 'utf8'));
  const tf = ELEO.throughFocus({ data: sample, width: 1100 });
  const rects = [...tf.matchAll(/<rect\b[^>]*stroke="var\(--[a-z-]+\)"[^>]*>/g)];
  assert.ok(rects.length > 0, 'cells drawn');
  const F = +/\bwidth="([\d.]+)"/.exec(rects[0][0])[1] + 1;
  // Every cell: a nested svg, one grid, round-cap dot paths (no circle dots), and the in-focus column alone in --ink-subtle.
  const nested = [...tf.matchAll(/<svg x=/g)].length;
  assert.equal(nested, rects.length, 'one clipping svg per cell');
  assert.ok([...tf.matchAll(/data-grid="x"/g)].length > 0 && [...tf.matchAll(/data-grid="y"/g)].length > 0, 'grid lines drawn');
  assert.equal([...tf.matchAll(/data-grid="x"/g)].length, [...tf.matchAll(/data-grid="y"/g)].length, 'as many vertical as horizontal');
  assert.ok(/<path d="M[^"]*h0[^"]*"[^>]*stroke-linecap="round"/.test(tf), 'dots are round-cap paths');
  assert.ok(!/<circle\b/.test(tf), 'no circle dots');
  const w = [...tf.matchAll(/<path d="M[^"]*h0[^"]*"[^>]*stroke-width="([\d.]+)"/g)].map((d) => +d[1]);
  assert.ok(w.length > 0);
  w.forEach((x) => assert.ok(Math.abs(x - 2.2 * frameWeight(F)) <= 0.001, `dot width ${x}`));
  assert.equal([...tf.matchAll(/stroke="var\(--ink-subtle\)"/g)].length, sample.throughFocus.spots.length, 'only the in-focus column (one cell per row) is --ink-subtle');
  // The grid sits strictly inside the frame and under the dots.
  assert.ok(tf.indexOf('data-grid') < tf.indexOf('stroke-linecap="round"'), 'grid before dots');
  [...tf.matchAll(/<path d="M([\d.]+),[\d.]+ V[\d.]+" [^>]*data-grid="x"/g)].forEach((m) => {
    const ox = Math.max(...[...rects].map((r) => +/\bx="([\d.]+)"/.exec(r[0])[1] - .5).filter((x) => x <= +m[1]));
    assert.ok(+m[1] > ox && +m[1] < ox + F, 'a grid line is strictly inside its frame');
  });
  // grid: false draws none and nothing else changes.
  const off = ELEO.throughFocus({ data: sample, width: 1100, grid: false });
  assert.ok(!/data-grid/.test(off), 'grid: false draws none');
  assert.equal(off.replace(/<path [^>]*data-grid="[xy]"\/>/g, ''), tf.replace(/<path [^>]*data-grid="[xy]"\/>/g, ''), 'grid: false removes the grid lines only');
});

// Plan #677 M3 (#784, CR #781): each spot panel labels its grid ticks (x under the bottom edge, y right-aligned left of the left edge), also with grid: false; the ±half label is gone and the caption says "x, y in <unit>".
// oracle: spec CR #781 (user): half 40 steps by 20 (−20 0 20); a label sits at side / 2 + t * side / (2 * half), the text at the panel's text size
test('tick labels', () => {
  const panels = [{ series: [{ points: [[1, 2], [-3, 4]], index: 0 }] }];
  const tx = (svg) => [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map((m) => ({ a: m[1], t: m[2] }));
  const svg = ELEO.spot({ panels, half: 40, unit: 'µm', width: 300 });
  const all = tx(svg), ticks = all.filter((x) => /^(−20|0|20)$/.test(x.t));
  assert.equal(ticks.length, 6, 'three x labels and three y labels');
  assert.ok(ticks.every((x) => /class="eleo-tick"/.test(x.a)), 'tick text is eleo-tick');
  assert.ok(!all.some((x) => /±/.test(x.t)), 'no ±half label');
  assert.ok(all.some((x) => x.t === 'x, y in µm'), 'the caption names the unit');
  const side = +/<svg x="([\d.]+)" y="4" width="([\d.]+)"/.exec(svg)[2], left = +/<svg x="([\d.]+)" y="4"/.exec(svg)[1];
  const size = +/font-size:([\d.]+)px/.exec(ticks[0].a)[1];
  const X = ticks.filter((x) => /text-anchor="middle"/.test(x.a)), Y = ticks.filter((x) => /text-anchor="end"/.test(x.a));
  assert.equal(X.length, 3); assert.equal(Y.length, 3);
  X.forEach((x, i) => {
    assert.ok(Math.abs(+/\bx="([\d.]+)"/.exec(x.a)[1] - (left + side / 2 + ([-20, 0, 20][i] * side) / 80)) < 0.02, 'x label centred on its tick');
    assert.ok(+/\by="([\d.]+)"/.exec(x.a)[1] > 4 + side, 'x labels sit under the frame');
  });
  Y.forEach((y) => assert.ok(+/\bx="([\d.]+)"/.exec(y.a)[1] < left, 'y labels sit left of the frame'));
  Y.forEach((y, i) => assert.ok(Math.abs(+/\by="([\d.]+)"/.exec(y.a)[1] - (4 + side / 2 - ([-20, 0, 20][i] * side) / 80 + 0.35 * size)) < 0.02, 'y label beside its tick, −20 lowest'));
  assert.ok(Math.abs(size - frameText(side)) < 0.01, 'text at the panel size');
  const capX = /<text\b[^>]*\bx="([\d.]+)"[^>]*>x, y in µm<\/text>/.exec(svg);
  assert.ok(capX && Math.abs(+capX[1] - left) < 0.02, 'caption lines start at the first frame\'s left edge');
  const off = ELEO.spot({ panels, half: 40, unit: 'µm', width: 300, grid: false });
  assert.equal(tx(off).filter((x) => /^(−20|0|20)$/.test(x.t)).length, 6, 'grid: false keeps the labels');
  const vb = /viewBox="0 0 ([\d.]+)/.exec(svg)[1];
  assert.ok(Math.abs(+vb - 300) < 0.02, 'the figure still fits width');
  assert.ok(!/±/.test(ELEO.spot({ panels, half: 40, width: 300 })), 'no ± without a unit either');
});

// Plan #677 M3 (#785, CR #781): throughFocus labels its outer edges only: x under the bottom row, y left of the left column, with a caption "x, y in µm" under the figure.
// oracle: spec CR #781 (user): half 40 steps by 20 (−20 0 20); the room is 4.2 text units of row label plus labelM (2.4) of y labels, in ADR-0003 text units; a label never touches the RMS lines, the column heads or the field labels
test('throughFocus tick labels', async () => {
  const { frameOf, frameText } = await import('../../packages/plots/src/scale.js');
  const sample = JSON.parse((await import('node:fs')).readFileSync(new URL('../../packages/plots/src/sample.json', import.meta.url), 'utf8'));
  const rows = sample.throughFocus.spots.length, cols = sample.throughFocus.defocus.length;
  const tx = (svg) => [...svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/g)].map((m) => ({ a: m[1], t: m[2].replace(/<[^>]*>/g, ''), x: +/\bx="(-?[\d.]+)"/.exec(m[1])[1], y: +/\by="(-?[\d.]+)"/.exec(m[1])[1] }));
  for (const grid of [true, false]) {
    const width = 1100, svg = ELEO.throughFocus({ data: sample, width, grid }), all = tx(svg);
    const rects = [...svg.matchAll(/<rect\b[^>]*stroke="var\(--[a-z-]+\)"[^>]*>/g)].map((r) => ({ x: +/\bx="([\d.]+)"/.exec(r[0])[1] - .5, y: +/\by="([\d.]+)"/.exec(r[0])[1] - .5, w: +/\bwidth="([\d.]+)"/.exec(r[0])[1] + 1 }));
    const F = rects[0].w, t = frameText(F), left = rects[0].x, bottom = Math.max(...rects.map((r) => r.y));
    near2(F, frameOf((width - cols * 10) / cols, (4.2 + 2.4) / cols), 'F solves the row label and the y labels');
    near2(left, 6.6 * t, 'the first panel starts after 4.2 + 2.4 text units');
    const ticks = all.filter((x) => /^(−20|0|20)$/.test(x.t)), X = ticks.filter((x) => /text-anchor="middle"/.test(x.a)), Y = ticks.filter((x) => /text-anchor="end"/.test(x.a));
    assert.equal(X.length, 3 * cols, `grid ${grid}: three x labels under each column of the bottom row only`);
    assert.equal(Y.length, 3 * rows, `grid ${grid}: three y labels left of each row's first panel only`);
    assert.equal(ticks.length, X.length + Y.length);
    X.forEach((x) => near2(x.y, bottom + F + 1.2 * t, 'x labels one line under the bottom row'));
    Y.forEach((y) => near2(y.x, left - 0.4 * t, 'y labels right-aligned in front of the left column'));
    // x labels are centred on the grid lines of their cell.
    const cell0 = X.filter((x) => x.x > left && x.x < left + F).map((x) => x.x).sort((a, b) => a - b);
    near2(cell0[1] - left, F / 2, 'zero is centred'); near2(cell0[2] - cell0[1], 20 * F / 80, 'twenty is a quarter of the side along');
    // Nothing collides: the y labels clear the field labels, the x labels clear the RMS lines of the bottom row, the caption clears both.
    const fields = all.filter((x) => /eleo-val/.test(x.a) && x.x === 0);
    assert.equal(fields.length, rows, 'one field label per row');
    fields.forEach((f) => assert.ok(f.x + 0.6 * t * f.t.length < left - 0.4 * t - 0.6 * t * 3, `field label "${f.t}" ends before the y labels begin`));
    const rms = all.filter((x) => /^RMS/.test(x.t)), lastRms = rms.filter((x) => x.y > bottom);
    assert.equal(rms.length, rows * cols);
    rects.forEach((r, k) => near2(rms[k].y, r.y + F + (r.y === bottom ? 2.5 : 1.3) * t, 'RMS at B + 1.3t, the bottom row\'s at B + 2.5t'));
    assert.equal(lastRms.length, cols, 'one bottom row of RMS lines');
    assert.ok(lastRms.every((r) => r.y - X[0].y >= 1.2 * t - 0.01), 'the bottom row\'s RMS lines sit a text line under the x labels');
    rms.forEach((r) => assert.ok(!X.some((x) => Math.abs(x.y - r.y) < t), 'no x label shares a line with an RMS line'));
    const pitch = [...new Set(rects.map((r) => r.y))].sort((a, b) => a - b); near2(pitch[1] - pitch[0], F + 2.6 * t, 'row pitch is B + 2.6t');
    const cap = all.filter((x) => x.t === 'x, y in µm');
    assert.equal(cap.length, 1, 'one caption');
    near2(cap[0].x, left, 'the caption starts at the first panel\'s left edge');
    assert.ok(cap[0].y - Math.max(...rms.map((r) => r.y)) >= 1.2 * t - 0.01, 'the caption is under the RMS lines');
    const H = +/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)[1];
    assert.ok(cap[0].y < H, 'the caption is inside the figure');
    all.filter((x) => /text-anchor="middle"/.test(x.a) && !/^(−20|0|20)$/.test(x.t)).forEach((h) => assert.ok(h.y < t * 2.2, 'column heads stay on top'));
  }
});
function near2(a, b, m) { assert.ok(Math.abs(a - b) <= 0.02, `${m}: ${a} against ${b}`); }

test('shared drawn-point rule', () => {
  assert.equal(typeof common.drawn, 'function', 'common.js exports the drawn-point predicate');
  assert.equal(typeof common.niceHalf, 'function', 'common.js exports the step rule');
  const d = common.drawn;
  assert.equal(d([1, 2]), true);
  [null, undefined, [null, 1], [1, null], [NaN, 1], [1, Infinity]].forEach((p) => assert.equal(d(p), false, JSON.stringify(p)));
  assert.deepEqual([0, 0.3, 1.1, 2.2, 3, 7, 11].map(common.niceHalf), [1, 0.4, 2, 2.5, 4, 10, 20]);
  const src = (f) => readFileSync(new URL(`../../packages/plots/src/${f}`, import.meta.url), 'utf8');
  assert.ok(!/var live = /.test(src('spot.js')) && !/function niceHalf/.test(src('spot.js')), 'spot.js keeps no copy');
  assert.ok(!/function drawn\(/.test(src('curve.js')), 'curve.js keeps no copy');
  const svg = ELEO.spot({ panels: [{ series: [{ points: [[1, 1], null, [null, 2], [NaN, 0], [-1, -1]] }] }] });
  assert.equal((svg.match(/ h0/g) || []).length, 2, 'only the two drawn points become dots');
});
