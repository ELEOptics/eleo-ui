// Acceptance tests for plan #4 (agent_docs/plans/4-brand-fixes.md), outcomes O1 and O3.
// oracle: paper Machado, Oliveira & Fernandes 2009 (CVD simulation, severity 1) via culori's deficiency filters, CIEDE2000 via culori; contrast spec WCAG 2.2 via culori wcagContrast; property (O1 clauses, O3 greedy max-min rule)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  differenceCiede2000, filterDeficiencyDeuter, filterDeficiencyProt, filterDeficiencyTrit, wcagContrast,
} from 'culori';
import ELEO from '../../packages/plots/src/renderers.js';
import '../../packages/plots/src/sample.js';

const json = JSON.parse(readFileSync(new URL('../../packages/tokens/src/tokens.json', import.meta.url)));
const token = (name, theme) => json.color.tokens.find((t) => t.name === name).value[theme];

// Recorded baseline: fields 1, 7, 8 at commit cc675cf (packages/tokens/src/tokens.json). Pinned here because #7
// changes field-7 and field-8, and O1's pairwise floor is "at least as far apart as these were".
const BASELINE = {
  light: { 1: '#098ed7', 7: '#583393', 8: '#d15a63' },
  dark: { 1: '#3694d4', 7: '#b498f3', 8: '#cf686e' },
};

const THEMES = ['light', 'dark'];
const VISION = {
  normal: (c) => c,
  protanopia: filterDeficiencyProt(1),
  deuteranopia: filterDeficiencyDeuter(1),
  tritanopia: filterDeficiencyTrit(1),
};
const CONDITIONS = THEMES.flatMap((theme) => Object.keys(VISION).map((vision) => ({ theme, vision })));
const dE = differenceCiede2000();
const dist = (a, b, vision) => dE(VISION[vision](a), VISION[vision](b));

const FIRST = [1, 7, 8];
const PAIRS = [[1, 7], [1, 8], [7, 8]];

// The token numbers a drawing uses, in order of first use.
const order = (text) => [...new Set([...text.matchAll(/--field-(\d+)/g)].map((m) => Number(m[1])))];

// layout3D draws on a canvas: record the strokeStyle it sets, with each token read back as its own name.
function layout3DOrder() {
  const strokes = [];
  const ctx = new Proxy({}, {
    get: (_, k) => (k === 'createImageData' ? () => ({ data: [] }) : () => {}),
    set: (_, k, v) => { if (k === 'strokeStyle') strokes.push(v); return true; },
  });
  const saved = { window: globalThis.window, getComputedStyle: globalThis.getComputedStyle };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => n });
  try {
    ELEO.layout3D({ getContext: () => ctx });
  } finally {
    Object.assign(globalThis, saved);
  }
  return order(strokes.join(' '));
}

test('first three fields stay apart and away from amber', { skip: '#5' }, (t) => {
  const drawn = {
    layout2D: order(ELEO.layout2D({ colorBy: 'field' })),
    'layout2D wavelength': order(ELEO.layout2D({ colorBy: 'wavelength' })),
    'spot wavelength': order(ELEO.spot()),
    'spot field': order(ELEO.spot({ colorBy: 'field' })),
    throughFocus: order(ELEO.throughFocus()),
    rayFan: order(ELEO.rayFan()),
    'curve mtf': order(ELEO.curve({ kind: 'mtf' })),
    'legend field': order(ELEO.legend('field', 8)),
    'legend wavelength': order(ELEO.legend('wavelength', 8)),
    layout3D: layout3DOrder(),
  };
  for (const [name, fields] of Object.entries(drawn)) assert.deepEqual(fields.slice(0, 3), FIRST, name);

  const failures = [];
  const min = { pairwiseMargin: Infinity, pairwise: Infinity, accent: Infinity, contrast: Infinity };
  for (const { theme, vision } of CONDITIONS) {
    const at = `${theme} ${vision}`;
    const field = (n) => token(`field-${n}`, theme);
    for (const [a, b] of PAIRS) {
      const d = dist(field(a), field(b), vision);
      const floor = Math.max(10, dist(BASELINE[theme][a], BASELINE[theme][b], vision));
      min.pairwise = Math.min(min.pairwise, d);
      min.pairwiseMargin = Math.min(min.pairwiseMargin, d - floor);
      if (d < floor) failures.push(`${at}: field-${a} to field-${b} ΔE ${d.toFixed(1)} < ${floor.toFixed(1)}`);
    }
    for (const n of FIRST) {
      const d = dist(field(n), token('accent', theme), vision);
      min.accent = Math.min(min.accent, d);
      if (d < 20) failures.push(`${at}: field-${n} to accent ΔE ${d.toFixed(1)} < 20`);
      const sim = VISION[vision];
      const c = wcagContrast(sim(field(n)), sim(token('surface', theme)));
      min.contrast = Math.min(min.contrast, c);
      if (c < 3) failures.push(`${at}: field-${n} on surface ${c.toFixed(2)}:1 < 3:1`);
    }
  }
  t.diagnostic(`minimum: pairwise ΔE ${min.pairwise.toFixed(1)} (margin over floor ${min.pairwiseMargin.toFixed(1)}), `
    + `to accent ΔE ${min.accent.toFixed(1)}, contrast ${min.contrast.toFixed(2)}:1`);
  assert.deepEqual(failures, []);
});

test('index 4 to 8 are the greedy order', { skip: '#5' }, () => {
  // Each next field is the remaining one whose minimum ΔE2000, over every condition, to the placed fields and to
  // --accent is largest. Ties go to the lower token number (strict > while scanning in ascending order).
  const spread = (n, placed) => Math.min(...CONDITIONS.flatMap(({ theme, vision }) => [
    ...placed.map((p) => dist(token(`field-${n}`, theme), token(`field-${p}`, theme), vision)),
    dist(token(`field-${n}`, theme), token('accent', theme), vision),
  ]));
  const expected = [...FIRST];
  let rest = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => !expected.includes(n));
  while (rest.length) {
    let best = rest[0], bestSpread = spread(best, expected);
    for (const n of rest.slice(1)) {
      const s = spread(n, expected);
      if (s > bestSpread) { best = n; bestSpread = s; }
    }
    expected.push(best);
    rest = rest.filter((n) => n !== best);
  }
  assert.deepEqual(order(ELEO.legend('field', 8)), expected);
});
