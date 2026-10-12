// Acceptance tests for plan #284 (agent_docs/plans/284-bars-limits.md), outcome O1.
// oracle: fixture phos-core SeidelCoefficients recorded by scripts/record-phos-core.py (roadmap U9); inverting the series group's transform recovers every bar's height within 0.5 px
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ELEO from '../../packages/plots/src/index.js';

// adapters.js reads ELEO from globalThis when seidel() runs, not when it loads.
globalThis.ELEO = ELEO;

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { TOL_PX, SIZES, fixture, seriesGroup, marks, toPx, toData, frame } from './helpers/svg.js';

// What #288's adapter (tests/fixtures/phos-core/adapters.js) must return, from the recording #286 writes:
//  - seidel(rec): { categories, series, total, y } at the system's reference wavelength (the recording's `referenceWavelengthNm`). `categories` are the
//    surface numbers as strings; `series` has one { values, index, label } per Seidel term (SI…SV, CL, CT; index 0–6), each with one
//    value per surface, in phos-core's sign and mm. phos-core's recorded total (the last element of each term) is STRIPPED: bars()
//    recomputes the sum from `total`, which is 'Σ'. y is { label: 'Seidel sum', unit: 'mm' }.
//  - The test reads the stripped total back from the recording itself: the last element of each term at that wavelength.
// What #287's bars({ categories, series, total: 'Σ', y, width, height }) must draw: one <rect> per category and series, then one per series for the
// Σ group, in the series group's data space: y = min(0, v) and height = |v|, so the transform inverts to the value.
test('recorded Seidel round trip (U9)', async () => {
  await import('../fixtures/phos-core/adapters.js');
  const { ELEOAdapters } = globalThis;
  assert.ok(ELEOAdapters && typeof ELEOAdapters.seidel === 'function', 'adapters.js assigns globalThis.ELEOAdapters.seidel');
  for (const lens of ['achromat', 'cooke']) {
    const rec = fixture(`${lens}-seidel`);
    const { categories, series, y, total } = ELEOAdapters.seidel(rec);
    assert.equal(total, 'Σ', `${lens}: the adapter asks for the Σ group`);
    assert.equal(series.length, 7, `${lens}: seven terms`);
    for (const s of series) assert.equal(s.values.length, categories.length, `${lens} ${s.label}: one value per surface, the total stripped`);
    // The recorded total of each term, at the reference wavelength (names are not exact: the nearest wavelength).
    const res = rec.results.reduce((a, r) => (Math.abs(r.wavelengthNm - rec.referenceWavelengthNm) < Math.abs(a.wavelengthNm - rec.referenceWavelengthNm) ? r : a));
    // Paired by term name, not by key order: the labels SI..CT stand for these keys.
    const names = { SI: 'spherical', SII: 'coma', SIII: 'astigmatism', SIV: 'fieldCurvature', SV: 'distortion', CL: 'axialColor', CT: 'lateralColor' };
    const totals = series.map((s) => res.terms[names[s.label]].at(-1));
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

// Plan #284 #287. oracle: property: synthetic values recovered within 0.5 px; an unsigned set's range starts at 0 and draws no zero line;
// total bars are the series sums; thinned labels sit at their band centre; a bad index throws; `bars` is on every entry.
const labelsOf = (svg) => [...svg.matchAll(/<text class="eleo-tick"([^>]*)>([^<]*)<\/text>/g)].map((m) => ({ x: Number(/\bx="([\d.\-]+)"/.exec(m[1])?.[1]), text: m[2], attrs: m[1] }));
const heightsPx = (group, rects) => rects.map((r) => Math.abs(toPx(group.M, [0, r.y + r.height])[1] - toPx(group.M, [0, r.y])[1]));

test('synthetic bars round trip, signed and unsigned', async () => {
  const categories = ['1', '2', '3'];
  const series = [{ values: [0.012, -0.004, 0.001], index: 0, label: 'SI' }, { values: [0.003, 0.005, -0.002], index: 1, label: 'SII' }];
  for (const [width, height] of SIZES) {
    const svg = ELEO.bars({ categories, series, total: 'Σ', y: { label: 'Seidel sum', unit: 'mm' }, width, height });
    assert.match(svg, /<svg [^>]*role="img" aria-label="Seidel sum, mm by category bar plot"/);
    const group = seriesGroup(svg), rects = marks(group, 'rect');
    assert.equal(rects.length, series.length * (categories.length + 1), 'a bar per series and category, then the Σ group');
    const want = [...categories.flatMap((_, c) => series.map((s) => s.values[c])), ...series.map((s) => s.values.reduce((a, b) => a + b, 0))];
    rects.forEach((r, i) => {
      assert.ok(Math.abs(r.height - Math.abs(want[i])) <= 1e-12, `bar ${i}: height is |v|`);
      assert.ok(Math.abs(r.y - Math.min(0, want[i])) <= 1e-12, `bar ${i}: y is min(0, v)`);
      assert.ok(Math.abs(heightsPx(group, [r])[0] - Math.abs(toPx(group.M, [0, want[i]])[1] - toPx(group.M, [0, 0])[1])) <= TOL_PX, `bar ${i} recovered within ${TOL_PX} px`);
    });
    const text = labelsOf(svg).map((l) => l.text);
    for (const t of ['1', '2', '3', 'Σ', 'SI', 'SII']) assert.ok(text.includes(t), `label ${t} drawn`);
    assert.ok(svg.includes('stroke="var(--plot-axis)"'), 'a signed set draws a zero line');
  }
  // Unsigned: the range starts at 0 and no zero line is drawn.
  const svg = ELEO.bars({ categories: ['a', 'b'], series: [{ values: [2, 5] }], y: { label: 'n' } });
  const group = seriesGroup(svg);
  assert.ok(Math.abs(toData(group.M, [0, frame(svg).ph])[1]) <= 1e-9, 'the range starts at 0');
  assert.ok(!svg.includes('var(--plot-axis)'), 'an unsigned set draws no zero line');
  // 50 categories at 460 px: every k-th label, at its band centre.
  const cats = Array.from({ length: 50 }, (_, i) => String(i + 1));
  const big = ELEO.bars({ categories: cats, series: [{ values: cats.map((_, i) => Math.sin(i)) }], y: { label: 's' }, width: 460 });
  const g = seriesGroup(big), cat = labelsOf(big).filter((l) => cats.includes(l.text) && !/dy=/.test(l.attrs));
  assert.ok(cat.length > 1 && cat.length < 50, 'labels are thinned');
  const k = Number(cat[1].text) - Number(cat[0].text);
  assert.ok(k > 1);
  const { L } = frame(big);
  cat.forEach((l, j) => {
    assert.equal(Number(l.text), 1 + j * k, 'every k-th label');
    assert.ok(Math.abs(l.x - L - toPx(g.M, [Number(l.text) - 1 + 0.5, 0])[0]) <= TOL_PX, `label ${l.text} at its band centre`);
  });
  // Bad indexes throw.
  for (const index of [-1, 1.5, '2', NaN]) assert.throws(() => ELEO.bars({ categories: ['a'], series: [{ values: [1], index }], y: { label: 'n' } }), /index must be a non-negative integer/);
  // On every entry.
  const named = await import('../../packages/plots/src/index.js');
  assert.equal(typeof named.bars, 'function');
  assert.equal(named.default.bars, named.bars);
  const win = {};
  vm.runInNewContext(readFileSync(new URL('../../packages/plots/dist/eleo-plots.js', import.meta.url), 'utf8'), { window: win });
  assert.equal(typeof win.ELEO.bars, 'function', 'window.ELEO.bars');
});

// Plan #284 #305. oracle: property: a value that is not a finite number draws no rect and is left out of the sum; labels sit at band centres from plotCell's margins.
test('non-numeric values draw no bar', () => {
  const svg = ELEO.bars({ categories: ['a', 'b', 'c', 'd'], series: [{ values: [NaN, undefined, true, 0] }], total: 'Σ', y: { label: 'n' }, width: 460, height: 260 });
  const group = seriesGroup(svg), rects = marks(group, 'rect');
  assert.equal(rects.length, 2, 'the 0 and the Σ bar');
  assert.ok(rects.every((r) => r.height === 0), 'both are 0: the skipped values count as nothing');
  const { L } = frame(svg);
  const labels = labelsOf(svg).filter((l) => ['a', 'b', 'c', 'd', 'Σ'].includes(l.text));
  assert.equal(labels.length, 5);
  labels.forEach((l, k) => {
    const centre = k < 4 ? k + 0.5 : 4 + 0.5 + 0.5;
    assert.ok(Math.abs(l.x - L - toPx(group.M, [centre, 0])[0]) <= TOL_PX, `label ${l.text} at its band centre`);
  });
  const mixed = ELEO.bars({ categories: ['a', 'b'], series: [{ values: [3, 'x'] }], total: 'Σ', y: { label: 'n' } });
  const mg = seriesGroup(mixed), mr = marks(mg, 'rect');
  assert.equal(mr.length, 2, 'the 3 and Σ');
  assert.equal(mr[1].height, 3, 'Σ leaves the skipped value out');
});

// Plan #284 #307. oracle: property: every series stays named and inside the viewBox; one key line at 460 px keeps the old height; a null series throws.
test('key row wraps inside the viewBox and null series throw', () => {
  const labels = ['SI', 'SII', 'SIII', 'SIV', 'SV', 'CL', 'CT'];
  const series = labels.map((label, index) => ({ values: [1, -2], index, label }));
  const keys = (svg) => [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="8" height="8"[^>]*\/><text class="eleo-tick" x="([\d.]+)" y="([\d.]+)">([^<]*)<\/text>/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), tx: Number(m[3]), text: m[5] }));
  for (const [width, height] of [[240, 260], [460, 260]]) {
    const svg = ELEO.bars({ categories: ['1', '2'], series, y: { label: 'n' }, width, height });
    const k = keys(svg);
    assert.deepEqual(k.map((e) => e.text), labels, `${width}px: every series is named`);
    for (const e of k) {
      assert.ok(e.tx + 6 * e.text.length <= width, `${width}px: ${e.text} ends inside the viewBox`);
      assert.ok(e.y >= 0 && e.y + 8 <= height, `${width}px: ${e.text} sits inside the height`);
    }
    const rows = new Set(k.map((e) => e.y)).size;
    if (width === 460) {
      assert.equal(rows, 1, 'one key line at 460 px');
      assert.equal(k[0].y, height - 12, 'the single line is where it was');
    } else assert.ok(rows > 1, '240 px wraps to a second line');
  }
  assert.throws(() => ELEO.bars({ categories: ['1'], series: [null] }), { name: 'TypeError', message: 'bars: each series must be an object' });
});

test('seidel adapter labels by term name', async () => {
  await import('../fixtures/phos-core/adapters.js');
  const rec = fixture('achromat-seidel');
  const names = ['spherical', 'coma', 'astigmatism', 'fieldCurvature', 'distortion', 'axialColor', 'lateralColor'];
  const labels = ['SI', 'SII', 'SIII', 'SIV', 'SV', 'CL', 'CT'];
  const shuffled = structuredClone(rec);
  shuffled.results = shuffled.results.map((r) => ({ ...r, terms: Object.fromEntries([...names].reverse().map((k) => [k, r.terms[k]])) }));
  const res = rec.results.reduce((a, r) => (Math.abs(r.wavelengthNm - rec.referenceWavelengthNm) < Math.abs(a.wavelengthNm - rec.referenceWavelengthNm) ? r : a));
  const { series } = globalThis.ELEOAdapters.seidel(shuffled);
  names.forEach((k, i) => {
    const s = series[i];
    assert.equal(s.label, labels[i], `${k}: labelled ${labels[i]}`);
    assert.equal(s.index, i, `${k}: index ${i}`);
    assert.deepEqual(s.values, res.terms[k].slice(0, -1), `${k}: its own values`);
  });
});

// Plan #284 #309. oracle: property: the key row never takes the frame below TOP + PLOT_B + 1, so every height stays positive.
test('a small drawing keeps a positive frame', () => {
  const series = ['SI', 'SII', 'SIII', 'SIV', 'SV', 'CL', 'CT'].map((label, index) => ({ label, index, values: [1, -2] }));
  const svg = ELEO.bars({ categories: ['1', '2'], series, total: 'Σ', y: { label: 'n' }, width: 120, height: 120 });
  const heights = [...svg.matchAll(/<(?:rect|svg)\b[^>]*\bheight="([^"]+)"/g)].map((m) => Number(m[1]));
  assert.ok(heights.length > 0);
  assert.ok(heights.every((h) => h > 0), `every height is positive: ${heights.join(', ')}`);
  assert.ok(series.every((s) => svg.includes('>' + s.label + '</text>')), 'every series is still named');
});

// Plan #284 #312 (CR from the M1 demo). oracle: property: solid dividers at band boundaries 1, 2 and the Σ gap's middle, full frame height, outside the series group; the frame sits at least 14 px under the title baseline; with thinned labels, a divider only every step boundaries.
test('group dividers and title room', () => {
  const isVertical = (l) => l.match(/\bx1="([^"]+)"/)[1] === l.match(/\bx2="([^"]+)"/)[1];
  const svg = ELEO.bars({ categories: ['1', '2', '3'], series: [{ values: [1, -2, 3], index: 0 }], total: 'Σ', y: { label: 'Seidel sum', unit: 'mm' }, width: 460, height: 260 });
  const group = seriesGroup(svg), { L, ph } = frame(svg), T = Number(/<svg\b[^>]*\by="([\d.]+)"[^>]*>\s*<g\b[^>]*transform="matrix/.exec(svg)[1]), B = T + ph;
  const dots = [...svg.matchAll(/<line\b[^>]*stroke="var\(--plot-grid\)"[^>]*>/g)].map((m) => m[0]).filter(isVertical);
  assert.equal(dots.length, 3);
  assert.ok(dots.every((d) => !/stroke-dasharray/.test(d)), 'the dividers are solid: no stroke-dasharray');
  const attr = (s, k) => Number(s.match(new RegExp(`\\b${k}="([^"]+)"`))[1]);
  const xs = dots.map((d) => attr(d, 'x1'));
  [1, 2, 3.25].forEach((c, k) => assert.ok(Math.abs(xs[k] - (L + toPx(group.M, [c, 0])[0])) <= TOL_PX, `divider ${k} at x = ${c}`));
  dots.forEach((d) => {
    assert.ok(/stroke="var\(--plot-grid\)"/.test(d));
    assert.ok(Math.abs(attr(d, 'y1') - T) <= TOL_PX && Math.abs(attr(d, 'y2') - B) <= TOL_PX, 'spans the frame');
  });
  assert.equal(marks(group, 'line').length, 0, 'no dividers in the data group');
  assert.ok(T >= 10 + 14, `frame top ${T} is at least 14 px under the title baseline`);
  const many = ELEO.bars({ categories: Array.from({ length: 40 }, (_, i) => String(i + 1)), series: [{ values: Array.from({ length: 40 }, () => 1), index: 0 }], total: 'Σ', width: 460, height: 260 });
  const ticks = [...many.matchAll(/<text class="eleo-tick"[^>]*text-anchor="middle">/g)].length - 1;
  const step = Math.ceil(40 / ticks);
  assert.ok(step > 1, 'labels are thinned');
  const cuts = [...many.matchAll(/<line\b[^>]*stroke="var\(--plot-grid\)"[^>]*>/g)].map((m) => m[0]).filter(isVertical).length;
  assert.equal(cuts, Math.floor(39 / step) + 1, `a divider every ${step} boundaries, plus the gap before the total`);
});

// Plan #284 #317 (CR #315). oracle: fixture phos-core SeidelCoefficients (every bar's height, the Σ series included, within 0.5 px); metamorphic: a value drawn grouped by surface, by coefficient or in a subset has the same height at one fixed y range.
test('recorded Seidel grouped by coefficient and as a subset', async () => {
  await import('../fixtures/phos-core/adapters.js');
  const { ELEOAdapters } = globalThis;
  const names = { SI: 'spherical', SII: 'coma', SIII: 'astigmatism', SIV: 'fieldCurvature', SV: 'distortion', CL: 'axialColor', CT: 'lateralColor' };
  const terms = Object.keys(names);
  for (const lens of ['achromat', 'cooke']) {
    const rec = fixture(`${lens}-seidel`);
    const res = rec.results.reduce((a, r) => (Math.abs(r.wavelengthNm - rec.referenceWavelengthNm) < Math.abs(a.wavelengthNm - rec.referenceWavelengthNm) ? r : a));
    // v[t][s]: term t at surface s; sums[t]: phos-core's recorded total of term t (the last element).
    const v = terms.map((t) => res.terms[names[t]].slice(0, -1));
    const sums = terms.map((t) => res.terms[names[t]].at(-1));
    const surfaces = v[0].map((_, s) => String(s + 1));
    const all = [...v.flat(), ...sums];
    const lo = Math.min(0, ...all), hi = Math.max(0, ...all), pad = (hi - lo) * 0.1;
    const y = { label: 'Seidel sum', unit: 'mm', range: [lo - pad, hi + pad] };
    // Caller-built calls, no gallery adapter.
    const bySurface = { categories: surfaces, series: terms.map((label, i) => ({ label, index: i, values: v[i] })), total: 'Σ', y };
    const byCoef = { categories: terms, series: [...surfaces.map((_, s) => ({ label: surfaces[s], index: s, values: terms.map((__, t) => v[t][s]) })), { label: 'Σ', index: surfaces.length, values: sums }], y };
    // The gallery adapter's by-term call is the hand-built one (its y has no shared range).
    const viaAdapter = ELEOAdapters.seidel(rec, { by: 'term' });
    assert.deepEqual(viaAdapter.categories, byCoef.categories, `${lens}: adapter by-term categories`);
    assert.deepEqual(viaAdapter.series.map((x) => [x.index, x.values]), byCoef.series.map((x) => [x.index, x.values]), `${lens}: adapter by-term values and indexes`);
    assert.throws(() => ELEOAdapters.seidel(rec, { by: 'terms' }), /by/, 'an unknown by throws');
    const pick = [0, 1], tPick = [0, 1, 2];
    const subset = { categories: tPick.map((t) => terms[t]), series: pick.map((s) => ({ label: surfaces[s], index: s, values: tPick.map((t) => v[t][s]) })), y };
    for (const [width, height] of SIZES) {
      // Each bar's height in data units, from its pixel height and the group's own scale, keyed by what it shows.
      const draw = (opts, key) => {
        const svg = ELEO.bars({ ...opts, width, height });
        const group = seriesGroup(svg), rects = marks(group, 'rect').filter((r) => !r.limit);
        const pxPerUnit = Math.abs(toPx(group.M, [0, 1])[1] - toPx(group.M, [0, 0])[1]);
        const n = opts.series.length;
        assert.equal(rects.length, opts.categories.length * n, `${lens} ${width}px: a bar per category and series`);
        const out = new Map();
        rects.forEach((r, i) => {
          const px = Math.abs(toPx(group.M, [r.x, r.y + r.height])[1] - toPx(group.M, [r.x, r.y])[1]);
          const [c, s] = [Math.floor(i / n), i % n];
          out.set(key(c, s), { px, pxPerUnit });
        });
        return out;
      };
      const full = draw(byCoef, (c, s) => `${terms[c]}/${s}`);
      const grouped = draw({ ...bySurface, total: undefined }, (c, s) => `${terms[s]}/${c}`);
      const sub = draw(subset, (c, s) => `${terms[tPick[c]]}/${pick[s]}`);
      const near = (a, b, msg) => assert.ok(Math.abs(a.px - b.px) <= TOL_PX && a.pxPerUnit === b.pxPerUnit, msg);
      terms.forEach((t, ti) => {
        // Every surface bar of every term, and the Σ series (index = surfaces.length), against the fixture.
        surfaces.forEach((_, s) => {
          const g = full.get(`${t}/${s}`);
          assert.ok(Math.abs(g.px - Math.abs(v[ti][s]) * g.pxPerUnit) <= TOL_PX, `${lens} ${width}px ${t} surface ${s + 1}: height recovers ${v[ti][s]} within ${TOL_PX} px`);
          near(g, grouped.get(`${t}/${s}`), `${lens} ${width}px ${t} surface ${s + 1}: the same height grouped by surface`);
        });
        const sg = full.get(`${t}/${surfaces.length}`);
        assert.ok(Math.abs(sg.px - Math.abs(sums[ti]) * sg.pxPerUnit) <= TOL_PX, `${lens} ${width}px ${t} Σ: height recovers the recorded total ${sums[ti]} within ${TOL_PX} px`);
      });
      for (const [k, b] of sub) near(full.get(k), b, `${lens} ${width}px subset ${k}: the same height as in the full call`);
      assert.equal(sub.size, 6, 'two surfaces, three terms');
    }
  }
});
