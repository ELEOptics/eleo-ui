// Plan #90 (agent_docs/plans/90-glass-identity.md), issue #95: glassFill, a CSS fill per distinct glass.
// oracle: property roadmap U12 (same name same fill; at equal nd a lower vd is never lighter; pairwise ΔE2000 ≥ 8 in
// both themes), with CSS Color 5 color-mix(in oklch) and relative color resolved here against tokens.json's band ends
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { differenceCiede2000, oklch } from 'culori';
import { glassFill, glassLegend } from '../../packages/plots/src/glass.js';

const tokens = JSON.parse(readFileSync(new URL('../../packages/tokens/src/tokens.json', import.meta.url))).color.tokens;
const band = (n, th) => oklch(tokens.find((t) => t.name === n).value[th]);
const deltaE = differenceCiede2000();

// Resolve one fill as a browser would: color-mix(in oklch, hi P%, lo) gives L and h by linear interpolation (the
// ends' hues are close, so the shorter arc is the linear one), then the relative color sets chroma and shifts hue.
const FILL = /^oklch\(from color-mix\(in oklch, var\(--glass-band-hi\) (\d+(?:\.\d+)?)%, var\(--glass-band-lo\)\) l ([\d.]+) calc\(h ([+-]) ([\d.]+)\)\)$/;
function resolve(fill, th) {
  const m = FILL.exec(fill);
  assert.ok(m, `fill ${fill} has the expected form`);
  const p = Number(m[1]) / 100, hi = band('glass-band-hi', th), lo = band('glass-band-lo', th);
  return { mode: 'oklch', l: lo.l + p * (hi.l - lo.l), c: Number(m[2]), h: lo.h + p * (hi.h - lo.h) + (m[3] === '-' ? -1 : 1) * Number(m[4]) };
}

const g = (name, nd, vd) => ({ name, nd, vd });
// Near-twins from tests/fixtures/glasses.json, plus F2 and N-SK16 at (almost) equal nd.
const SET = [g('N-BK7', 1.5168, 64.17), g('H-K9L', 1.5168, 64.2), g('F2', 1.62004, 36.37), g('N-F2', 1.62005, 36.43),
  g('S-TIM2', 1.62004, 36.26), g('N-SK16', 1.62041, 60.32), g('N-SF6', 1.80518, 25.36), g('N-FK51A', 1.48656, 84.47)];

test('same name same fill, parameters ordered by vd', () => {
  // A layout's glasses: names repeat, each lens a fresh object, in no particular order.
  const lenses = [SET[2], SET[5], SET[0], SET[2], SET[7], SET[1], SET[3], SET[6], SET[4], SET[5]].map((x) => ({ ...x }));
  const fills = glassFill(lenses);
  assert.ok(fills instanceof Map, 'a Map from name to fill');
  assert.deepEqual([...fills.keys()].sort(), SET.map((x) => x.name).sort(), 'one fill per distinct name');
  // Deterministic over the set: input order does not matter.
  assert.deepEqual(glassFill([...lenses].reverse()), fills, 'same fills whatever the lens order');

  for (const th of ['light', 'dark']) {
    const [lMin, lMax] = th === 'light' ? [0.66, 0.93] : [0.26, 0.52];
    const col = new Map([...fills].map(([n, f]) => [n, resolve(f, th)]));
    for (const [n, c] of col) {
      assert.ok(c.l >= lMin && c.l <= lMax, `${th} ${n}: L ${c.l} in the band`);
      assert.ok(c.c <= 0.1 && c.h >= 225 && c.h <= 275, `${th} ${n}: chroma ${c.c}, hue ${c.h} in the band`);
    }
    // The lower vd of two glasses is never lighter: vd sets the mix position, so at equal nd too.
    const byVd = [...SET].sort((a, b) => a.vd - b.vd);
    for (let i = 1; i < byVd.length; i++) {
      const a = col.get(byVd[i - 1].name), b = col.get(byVd[i].name);
      assert.ok(a.l <= b.l, `${th}: ${byVd[i - 1].name} (vd ${byVd[i - 1].vd}) L ${a.l} lighter than ${byVd[i].name} L ${b.l}`);
    }
    // Near-twins still separate.
    for (const [i, a] of SET.entries()) for (const b of SET.slice(i + 1)) {
      const d = deltaE(col.get(a.name), col.get(b.name));
      assert.ok(d >= 8, `${th}: ΔE2000 ${a.name} vs ${b.name} is ${d.toFixed(2)}`);
    }
  }
});

test('more than 8 glasses stay distinct, in band and ordered', () => {
  // Beyond 8 the slots run out: fills spread evenly over the mix, ordered by vd, spacing not guaranteed.
  const more = [...SET, g('N-LAK9', 1.691, 54.71), g('N-BAF10', 1.67003, 47.11), g('N-SF11', 1.78472, 25.68),
    g('N-PK52A', 1.497, 81.61)];
  assert.equal(more.length, 12);
  const fills = glassFill(more);
  assert.equal(fills.size, 12, 'a fill per glass');
  assert.equal(new Set(fills.values()).size, 12, '12 distinct fills');
  const byVd = [...more].sort((a, b) => a.vd - b.vd);
  for (const th of ['light', 'dark']) {
    const [lMin, lMax] = th === 'light' ? [0.66, 0.93] : [0.26, 0.52];
    const col = new Map([...fills].map(([n, f]) => [n, resolve(f, th)]));
    for (const [n, c] of col) {
      assert.ok(c.l >= lMin && c.l <= lMax, `${th} ${n}: L ${c.l} in the band`);
      assert.ok(c.c <= 0.1 && c.h >= 225 && c.h <= 275, `${th} ${n}: chroma ${c.c}, hue ${c.h} in the band`);
    }
    for (let i = 1; i < byVd.length; i++) {
      const a = col.get(byVd[i - 1].name), b = col.get(byVd[i].name);
      assert.ok(a.l <= b.l, `${th}: ${byVd[i - 1].name} (vd ${byVd[i - 1].vd}) L ${a.l} lighter than ${byVd[i].name} L ${b.l}`);
    }
  }
});

// Issue #100: glassLegend, the O2 markup contract in tests/glass-fills.spec.js (one swatch key per drawn glass).
test('legend lists each glass once in first-use order', () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/layouts/analysis-glasses.json', import.meta.url)));
  const fills = glassFill(fixture.surfaces.filter((s, i) => s.glass && typeof s.glass === 'object' && fixture.surfaces[i + 1]).map((s) => s.glass));
  const key = (n) => `<span class="eleo-key eleo-key--swatch" style="--c:${fills.get(n)}">${n}</span>`;
  const want = key('N-SK16') + key('F2');
  assert.equal(glassLegend(fixture), want, 'N-SK16 then F2, once each, fills from glassFill');
  assert.equal(glassLegend({ layout: fixture }), want, 'a system carrying the layout gives the same legend');

  // Only drawn glasses count (a glass on the last surface draws nothing), names are escaped as text,
  // and shorthand glasses ("crown", "flint") have no entry.
  const sv = (glass) => ({ z: 0, sd: 1, glass, profile: [] });
  const odd = { name: 'A<b>&"', nd: 1.5, vd: 60 };
  const L = { surfaces: [sv('crown'), sv(odd), sv('flint'), sv(null), sv(g('LAST', 1.6, 40))], rays: [] };
  const only = glassFill([odd]).get(odd.name);
  assert.equal(glassLegend(L), `<span class="eleo-key eleo-key--swatch" style="--c:${only}">A&lt;b&gt;&amp;&quot;</span>`);
  assert.equal(glassLegend({ surfaces: [sv('crown'), sv('flint'), sv(null)], rays: [] }), '', 'shorthand only: empty');
});

// Issue #120 (CR #119): layout2D picks its glasses with drawnGlasses, so its polygon fills and glassLegend's swatches
// come from one rule. A glass on the last surface draws nothing; a repeated glass draws one fill.
test('legend and drawing use one glass rule', async () => {
  const { layout2D } = await import('../../packages/plots/src/layout2d.js');
  const prof = (z, h) => Array.from({ length: 41 }, (_, i) => [z, -h + (2 * h * i) / 40]);
  const sv = (z, glass, extra = {}) => ({ z, sd: 5, glass, profile: prof(z, 5), ...extra });
  const A = g('N-BK7', 1.5168, 64.17), B = g('F2', 1.62004, 36.37), C = g('N-SF6', 1.80518, 25.36);
  const L = { surfaces: [sv(0, { ...A }), sv(2, { ...B }), sv(4, null), sv(6, { ...A }), sv(8, null), sv(10, { ...C }, { image: true })],
    rays: [[[[-2, 1], [10, 0]], [[-2, 0], [10, 0]], [[-2, -1], [10, 0]]]] };
  const drawn = [...layout2D({ data: L }).matchAll(/<polygon [^>]*style="fill:([^;"]+);/g)].map((m) => m[1]);
  const keys = [...glassLegend(L).matchAll(/style="--c:([^"]+)"/g)].map((m) => m[1]);
  assert.equal(drawn.length, 3, 'three named-glass polygons, none for the last surface');
  assert.deepEqual([...new Set(drawn)].sort(), [...keys].sort(), 'polygon fills and legend swatches are one set');
  assert.equal(keys.length, 2, 'the last-surface glass gets no swatch');
  // The rule lives once: layout2d.js calls glass.js's drawnGlasses instead of its own filter.
  const src = readFileSync(new URL('../../packages/plots/src/layout2d.js', import.meta.url), 'utf8');
  assert.ok(src.includes('glassFill(drawnGlasses(S))'), 'layout2d.js picks its glasses with drawnGlasses');
});
