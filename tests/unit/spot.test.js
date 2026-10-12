// Acceptance tests for plan #232 (agent_docs/plans/232-panels-spot.md), outcome O2.
// oracle: fixture phos-core SpotDiagram recorded by scripts/record-phos-core.py (roadmap U7); inverting each panel's transform recovers every point within 0.5 px
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ELEO from '../../packages/plots/src/index.js';

// adapters.js reads ELEO from globalThis when spot() runs, not when it loads.
globalThis.ELEO = ELEO;

import { TOL_PX, SIZES, fixture, panelGroups, toPx, toData } from './helpers/svg.js';

// What #238, #226 and #239 must provide (the shapes this test assumes):
//  - #238: tests/fixtures/phos-core/{achromat,cooke}-spot.json. Per source rec.sources[i]: fieldAngleDeg, wavelengths (nm, one per
//    entry of points), points (per wavelength, an array of [x, y] in mm), enclosingRadius (per wavelength and polychromatic).
//  - #226: ELEOAdapters.spot(rec) in tests/fixtures/phos-core/adapters.js returns { panels, unit, scale? }: one panel per source,
//    { title (the field angle), series: [{ points: [[x, y] in µm, …], index: wavelength k }], circle (the Airy radius, µm), notes }, unit 'µm'.
//  - #239: ELEO.spot({ panels, scale, half, unit, width, height }) draws one nested <svg> and matrix <g> per panel; each series is
//    one <path> of `M x y h0` dots in the group's data coordinates, and a panel's `circle` is a <circle r="…"> in that group
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
      assert.ok(p.circle > 0, `${lens} panel ${i}: an Airy circle radius`);
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
          assert.ok(Math.abs(Math.abs(a) * (+r[1] - panels[p].circle)) <= TOL_PX, `${label} panel ${p}: the circle's radius maps to the given radius within ${TOL_PX} px`);
        });
        if (scale === 'common') {
          const a0 = Math.abs(groups[0].M[0]);
          groups.forEach((g, p) => assert.ok(Math.abs(Math.abs(g.M[0]) - a0) <= 1e-9 * a0, `${label} panel ${p}: one common scale across panels`));
        }
      }
    }
  }
});

// #239: spot({ panels }) on synthetic points (the recorded round trip above waits on #238, #226 and #241).
test('typed points round trip, common and auto scale', () => {
  const panels = [
    { title: '0.0°', series: [{ points: [[0.4, -1.2], [1.1, 0.3], [-0.7, 0.9]], index: 0 }, { points: [[-2.5, 2.2], [0, 0]], index: 2 }], circle: 2.87, centroid: [0.3, -0.2], notes: ['100 % 6.53 µm'] },
    { title: '1.0°', series: [{ points: [[8, -12], [-14, 3.5], [Infinity, 1], [5, NaN]], index: 0 }], circle: 2.87, notes: [] },
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
        if (panels[p].circle) assert.ok(r && Math.abs(Math.abs(a) * (+r[1] - panels[p].circle)) <= TOL_PX, `${label} panel ${p}: the circle's radius maps to the given radius`);
        else assert.ok(!r, `${label} panel ${p}: no circle unless given`);
        const lines = [...body.matchAll(/<line\b[^>]*\bx1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map((m) => m.slice(1).map(Number));
        if (panels[p].centroid) {
          assert.equal(lines.length, 2, `${label} panel ${p}: a cross of two lines`);
          const [cx, cy] = panels[p].centroid;
          lines.forEach(([x1, y1, x2, y2]) => assert.ok(Math.abs((x1 + x2) / 2 - cx) < 1e-9 && Math.abs((y1 + y2) / 2 - cy) < 1e-9, `${label} panel ${p}: the cross is centred on the centroid`));
        } else assert.equal(lines.length, 0, `${label} panel ${p}: no cross unless given`);
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
    assert.equal(p.circle, sample.airy, 'the Airy radius is the circle');
    assert.deepEqual(p.series.map((s) => s.points), sample.spots[fi], 'a series per wavelength, the sample\'s points');
    assert.deepEqual(p.series.map((s) => s.index), sample.spots[fi].map((_, w) => w));
    const st = sample.spotStats[fi];
    assert.deepEqual(p.notes, [`RMS ${st.rms.toFixed(2)} µm`, `GEO ${st.geo.toFixed(2)} µm`]);
  });
  assert.ok(spotPanels(sample, { colorBy: 'field' }).panels.every((p, fi) => p.series.every((s) => s.index === fi)), 'colorBy field: index = field');
  assert.equal(spotPanels(sample, { airy: false }).panels[0].circle, undefined, 'airy: false draws no circle');
});

// #260: a panel's reference circle counts toward its half, so a circle beyond the spot is not clipped.
// oracle: property: for every panel, circle radius <= half, where half = (box side / 2) / |scale|
test('the half holds the reference circle', () => {
  const panels = [
    { series: [{ points: [[0.5, 0.2], [-0.3, 0.4]] }], circle: 2.87 },
    { series: [{ points: [[0.1, 0.1]] }], circle: 1.2 },
  ];
  for (const scale of ['common', 'auto']) {
    const groups = panelGroups(ELEO.spot({ panels, scale, width: 400, height: 200 }));
    groups.forEach((g, p) => {
      const half = (g.box.pw / 2) / Math.abs(g.M[0]);
      assert.ok(panels[p].circle <= half * (1 + 1e-9), `${scale} panel ${p}: circle ${panels[p].circle} within half ${half}`);
    });
  }
});

// #261: centroid coerced to numbers, empty panels non-negative viewBox, no no-op fill-opacity, sample aria-label names colorBy.
// oracle: property, and the base's output ("Spot diagrams, colored by <colorBy>")
test('typed spot hardening', async () => {
  await import('../../packages/plots/src/sample.js');
  const s = ELEO.spot({ panels: [{ series: [{ points: [[0.1, 0.1]] }], centroid: ['0.3', '-0.2'] }] });
  const ln = [...s.matchAll(/<line\b[^>]*\bx1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)][0].slice(1).map(Number);
  assert.ok(ln.every(Number.isFinite), 'centroid line coordinates are numbers');
  assert.ok(Math.abs((ln[0] + ln[2]) / 2 - 0.3) < 1e-9 && Math.abs(ln[1] - -0.2) < 1e-9, 'a string centroid draws at its number');
  const vb = /viewBox="([^"]+)"/.exec(ELEO.spot({ panels: [] }))[1].split(/\s+/).map(Number);
  assert.ok(vb.every((v) => v >= 0), 'empty panels give a non-negative viewBox: ' + vb);
  assert.ok(!/fill-opacity/.test(s), 'no fill-opacity on stroked dots');
  assert.ok(ELEO.spot({}).includes('aria-label="Spot diagrams, colored by wavelength"'), 'sample label names colorBy');
  assert.ok(ELEO.spot({ colorBy: 'field' }).includes('colored by field'));
  assert.ok(ELEO.spot({ panels: [{ series: [] }], label: 'Mine' }).includes('aria-label="Mine"'), 'typed call takes a label');
});
