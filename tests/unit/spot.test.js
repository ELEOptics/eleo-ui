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
test('recorded spot round trip (U7)', { skip: '#237: written ahead of #238 (spot fixtures), #239 (spot panels) and #226 (ELEOAdapters.spot); #241 unskips it' }, async () => {
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
