// Acceptance tests for plan #4 (agent_docs/plans/4-brand-fixes.md), outcomes O1 and O3.
// oracle: paper Machado, Oliveira & Fernandes 2009 (CVD simulation, severity 1) via culori's deficiency filters, CIEDE2000 via culori; property (rule R and floor F, recomputed from tokens.json under each palette's vision conditions)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  differenceCiede2000, filterDeficiencyDeuter, filterDeficiencyProt, filterDeficiencyTrit,
} from 'culori';
import ELEO from '../../packages/plots/src/renderers.js';
import '../../packages/plots/src/sample.js';

const json = JSON.parse(readFileSync(new URL('../../packages/tokens/src/tokens.json', import.meta.url)));
const token = (name, theme) => json.color.tokens.find((t) => t.name === name).value[theme];
const css = readFileSync(new URL('../../packages/plots/src/plots.css', import.meta.url), 'utf8');

const THEMES = ['light', 'dark'];
const FIELDS = [1, 2, 3, 4, 5, 6, 7, 8];
const VISION = {
  normal: (c) => c,
  protan: filterDeficiencyProt(1),
  deutan: filterDeficiencyDeuter(1),
  tritan: filterDeficiencyTrit(1),
};
// Each palette is judged only under its own conditions (plan #4, rule R).
const PALETTES = {
  standard: { selector: ':root, [data-theme]', visions: ['normal'] },
  'red-green': { selector: '[data-palette="red-green"]', visions: ['protan', 'deutan'] },
  'blue-yellow': { selector: '[data-palette="blue-yellow"]', visions: ['tritan'] },
};
const FLOOR = 10;

const dE = differenceCiede2000();
const conditions = (visions) => THEMES.flatMap((theme) => visions.map((vision) => ({ theme, vision })));
const dist = (a, b, { theme, vision }) => dE(VISION[vision](token(a, theme)), VISION[vision](token(b, theme)));
const f = (n) => `field-${n}`;

// Minimum ΔE2000, over the conditions, between field n and each placed field and --accent.
const spread = (n, placed, conds) => Math.min(...conds.flatMap((c) => [
  ...placed.map((p) => dist(f(n), f(p), c)),
  dist(f(n), 'accent', c),
]));

// Rule R: the triple with the largest minimum ΔE (pairwise and to --accent), then a greedy tail. Ties go to the
// lower token number: ascending scans with strict >.
function ruleR(visions) {
  const conds = conditions(visions);
  let triple = null, tripleMin = -Infinity;
  for (let a = 1; a <= 8; a++) for (let b = a + 1; b <= 8; b++) for (let c = b + 1; c <= 8; c++) {
    const m = Math.min(spread(a, [b, c], conds), spread(b, [c], conds), spread(c, [], conds));
    if (m > tripleMin) { triple = [a, b, c]; tripleMin = m; }
  }
  const order = [...triple];
  let rest = FIELDS.filter((n) => !order.includes(n));
  while (rest.length) {
    let best = rest[0], bestSpread = spread(best, order, conds);
    for (const n of rest.slice(1)) {
      const s = spread(n, order, conds);
      if (s > bestSpread) { best = n; bestSpread = s; }
    }
    order.push(best);
    rest = rest.filter((n) => n !== best);
  }
  return { order, tripleMin };
}

// The mapping `--series-k: var(--field-n)` declared in the block whose selector starts with `selector`.
// Regex, not a CSS parser: the block format is fixed and written by plan #4 (no new dependency).
function mapping(selector) {
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!sel.replace(/\/\*[\s\S]*?\*\//g, '').trim().startsWith(selector)) continue;
    const pairs = [...body.matchAll(/--series-(\d+)\s*:\s*var\(\s*--field-(\d+)\s*\)/g)];
    if (!pairs.length) continue;
    const out = [];
    for (const [, k, n] of pairs) out[Number(k) - 1] = Number(n);
    return out;
  }
  return null;
}

// The palette's first three, under its conditions: pairwise and to --accent.
function floorFailures(order, visions) {
  const failures = [];
  const first = order.slice(0, 3);
  for (const c of conditions(visions)) {
    const at = `${c.theme} ${c.vision}`;
    first.forEach((a, i) => {
      for (const b of [...first.slice(i + 1), 'accent']) {
        const other = b === 'accent' ? 'accent' : f(b);
        const d = dist(f(a), other, c);
        if (d < FLOOR) failures.push(`${at}: field-${a} to ${other} ΔE ${d.toFixed(1)} < ${FLOOR}`);
      }
    });
  }
  return failures;
}

// The series indices an SVG drawing uses, in order of first use.
const series = (text) => [...new Set([...text.matchAll(/--series-(\d+)/g)].map((m) => Number(m[1])))];

// layout3D draws on a canvas: record the strokeStyle it sets. `read(name)` stands in for a computed custom property.
function layout3DStrokes(read) {
  const strokes = [];
  const ctx = new Proxy({}, {
    get: (_, k) => (k === 'createImageData' ? () => ({ data: [] }) : () => {}),
    set: (_, k, v) => { if (k === 'strokeStyle') strokes.push(v); return true; },
  });
  const saved = { window: globalThis.window, getComputedStyle: globalThis.getComputedStyle };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.getComputedStyle = () => ({ getPropertyValue: read });
  try {
    ELEO.layout3D({ getContext: () => ctx });
  } finally {
    Object.assign(globalThis, saved);
  }
  return strokes;
}
const firstUse = (names) => [...new Set(names.filter((n) => /^--(series|field)-\d+$/.test(n)))];

test('standard order is rule R under normal vision', (t) => {
  const { visions } = PALETTES.standard;
  const standard = mapping(PALETTES.standard.selector);
  assert.ok(standard, 'plots.css declares --series-1..8 on `:root, [data-theme]`');
  const { order, tripleMin } = ruleR(visions);
  t.diagnostic(`standard: rule R ${order.join(', ')}, triple min ΔE ${tripleMin.toFixed(1)}`);
  assert.deepEqual(standard, order, 'standard mapping is rule R under normal vision');
  assert.deepEqual(floorFailures(standard, visions), [], 'floor F');

  // Every SVG renderer resolves index k to --series-k, with the standard field as its fallback (no plots.css).
  const drawn = {
    layout2D: ELEO.layout2D({ colorBy: 'field' }),
    'layout2D wavelength': ELEO.layout2D({ colorBy: 'wavelength' }),
    'spot wavelength': ELEO.spot(),
    'spot field': ELEO.spot({ colorBy: 'field' }),
    throughFocus: ELEO.throughFocus(),
    rayFan: ELEO.rayFan(),
    'curve mtf': ELEO.curve({ kind: 'mtf' }),
    'curve fieldCurvature': ELEO.curve({ kind: 'fieldCurvature' }),
    'curve distortion': ELEO.curve({ kind: 'distortion' }),
    'curve chromaticFocus': ELEO.curve({ kind: 'chromaticFocus' }),
    'legend field': ELEO.legend('field', 8),
    'legend wavelength': ELEO.legend('wavelength', 8),
  };
  for (const [name, svg] of Object.entries(drawn)) {
    const used = series(svg);
    assert.ok(used.length > 0, `${name} colors through --series-k`);
    assert.deepEqual(used, used.map((_, i) => i + 1), `${name} uses index k as --series-k, in order`);
    const bare = svg.replace(/var\(--series-\d+,\s*var\(--field-\d+\)\)/g, '');
    assert.doesNotMatch(bare, /--field-\d/, `${name}: every field color sits behind a --series-k`);
    for (const [, k, n] of svg.matchAll(/var\(--series-(\d+),\s*var\(--field-(\d+)\)\)/g)) {
      assert.equal(Number(n), standard[Number(k) - 1], `${name}: --series-${k} falls back to the standard field`);
    }
  }
  assert.deepEqual(series(ELEO.legend('field', 8)), [1, 2, 3, 4, 5, 6, 7, 8], 'legend covers index 1 to 8');

  // layout3D: --series-1..3 when plots.css is loaded, the standard fields when --series-* reads empty.
  assert.deepEqual(firstUse(layout3DStrokes((n) => n)).slice(0, 3), ['--series-1', '--series-2', '--series-3'], 'layout3D with plots.css');
  assert.deepEqual(
    firstUse(layout3DStrokes((n) => (n.startsWith('--series-') ? '' : n))).slice(0, 3),
    standard.slice(0, 3).map((n) => `--field-${n}`),
    'layout3D without plots.css',
  );
});

test('each palette is rule R under its conditions', (t) => {
  for (const [name, { selector, visions }] of Object.entries(PALETTES)) {
    const declared = mapping(selector);
    assert.ok(declared, `plots.css declares --series-1..8 for ${name} (${selector})`);
    const { order, tripleMin } = ruleR(visions);
    t.diagnostic(`${name} (${visions.join(', ')}): rule R ${order.join(', ')}, triple min ΔE ${tripleMin.toFixed(1)}`);
    assert.deepEqual(declared, order, `${name} mapping is rule R under ${visions.join(' and ')}`);
    assert.deepEqual(floorFailures(declared, visions), [], `${name} floor F`);
  }
});
