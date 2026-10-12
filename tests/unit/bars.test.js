// Acceptance tests for plan #284 (agent_docs/plans/284-bars-limits.md), outcome O1.
// oracle: fixture phos-core SeidelCoefficients recorded by scripts/record-phos-core.py (roadmap U9); inverting the series group's transform recovers every bar's height within 0.5 px
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ELEO from '../../packages/plots/src/index.js';

// adapters.js reads ELEO from globalThis when seidel() runs, not when it loads.
globalThis.ELEO = ELEO;

import { TOL_PX, SIZES, fixture, seriesGroup, marks, toPx, toData } from './helpers/svg.js';

// What #288's adapter (tests/fixtures/phos-core/adapters.js) must return, from the recording #286 writes:
//  - seidel(rec): { categories, series, y } at the system's reference wavelength (the recording's `referenceWavelengthNm`). `categories` are the
//    surface numbers as strings; `series` has one { values, index, label } per Seidel term (SI…SV, CL, CT; index 0–6), each with one
//    value per surface, in phos-core's sign and mm. phos-core's recorded total (the last element of each term) is STRIPPED: bars()
//    recomputes the sum from `total`. y is { label: 'Seidel sum', unit: 'mm' }.
//  - The test reads the stripped total back from the recording itself: the last element of each term at that wavelength.
// What #287's bars({ categories, series, total: 'Σ', y, width, height }) must draw: one <rect> per category and series, then one per series for the
// Σ group, in the series group's data space: y = min(0, v) and height = |v|, so the transform inverts to the value.
test('recorded Seidel round trip (U9)', { skip: 'plan #284: waits on #286 (fixtures), #287 (bars), #288 (adapter); #289 unskips' }, async () => {
  await import('../fixtures/phos-core/adapters.js');
  const { ELEOAdapters } = globalThis;
  assert.ok(ELEOAdapters && typeof ELEOAdapters.seidel === 'function', 'adapters.js assigns globalThis.ELEOAdapters.seidel');
  for (const lens of ['achromat', 'cooke']) {
    const rec = fixture(`${lens}-seidel`);
    const { categories, series, y } = ELEOAdapters.seidel(rec);
    assert.equal(series.length, 7, `${lens}: seven terms`);
    for (const s of series) assert.equal(s.values.length, categories.length, `${lens} ${s.label}: one value per surface, the total stripped`);
    // The recorded total of each term, at the reference wavelength (names are not exact: the nearest wavelength).
    const res = rec.results.reduce((a, r) => (Math.abs(r.wavelengthNm - rec.referenceWavelengthNm) < Math.abs(a.wavelengthNm - rec.referenceWavelengthNm) ? r : a));
    const totals = Object.values(res.terms).map((t) => t.at(-1));
    for (const [width, height] of SIZES) {
      const svg = ELEO.bars({ categories, series, total: 'Σ', y, width, height });
      const group = seriesGroup(svg);
      const rects = marks(group, 'rect').filter((r) => !r.limit);
      assert.equal(rects.length, series.length * (categories.length + 1), `${lens} ${width}px: a bar per term and surface, then a Σ group`);
      const heightPx = (r) => { const a = toPx(group.M, [r.x, r.y]), b = toPx(group.M, [r.x, r.y + r.height]); return Math.abs(b[1] - a[1]); };
      const valuePx = (v) => Math.abs(toPx(group.M, [0, v])[1] - toPx(group.M, [0, 0])[1]);
      const bars = rects.slice(0, series.length * categories.length), sums = rects.slice(series.length * categories.length);
      // Bars come grouped by category, a bar per series, then the Σ group; the order is bars.js's (#287).
      bars.forEach((r, i) => {
        const v = series[i % series.length].values[Math.floor(i / series.length)];
        assert.ok(Math.abs(heightPx(r) - valuePx(v)) <= TOL_PX, `${lens} ${width}px bar ${i}: height recovers ${v} within ${TOL_PX} px`);
        const back = toData(group.M, toPx(group.M, [r.x, r.y]));
        assert.ok(Math.abs(back[1] - Math.min(0, v)) <= 1e-9 + Math.abs(v) * 1e-6 + TOL_PX / Math.abs(group.M[3] || 1), `${lens} ${width}px bar ${i}: sits on the zero line`);
      });
      sums.forEach((r, k) => {
        assert.ok(Math.abs(heightPx(r) - valuePx(totals[k])) <= TOL_PX, `${lens} ${width}px Σ bar ${k}: height matches the recorded total ${totals[k]} within ${TOL_PX} px`);
      });
    }
  }
});
