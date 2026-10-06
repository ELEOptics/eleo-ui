// Plan #4 (agent_docs/plans/4-brand-fixes.md), #17: SVG renderers color index k through --series-k.
// oracle: property (index k draws as --series-k, falling back to the standard field 1, 7, 8, ...)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ELEO from '../../packages/plots/src/renderers.js';
import '../../packages/plots/src/sample.js';

// The series indices a drawing uses, in order of first use.
const series = (text) => [...new Set([...text.matchAll(/--series-(\d+)/g)].map((m) => Number(m[1])))];
const fallbacks = (text) => Object.fromEntries(
  [...text.matchAll(/var\(--series-(\d+), var\(--field-(\d+)\)\)/g)].map(([, k, n]) => [k, Number(n)]),
);

test('svg renderers emit series variables in order', () => {
  const drawn = {
    'spot field': ELEO.spot({ colorBy: 'field' }),
    layout2D: ELEO.layout2D(),
    rayFan: ELEO.rayFan(),
    'curve mtf': ELEO.curve({ kind: 'mtf' }),
    'curve fieldCurvature': ELEO.curve({ kind: 'fieldCurvature' }),
    'curve distortion': ELEO.curve({ kind: 'distortion' }),
    'curve chromaticFocus': ELEO.curve({ kind: 'chromaticFocus' }),
    'legend field': ELEO.legend('field', 8),
  };
  for (const [name, svg] of Object.entries(drawn)) {
    const used = series(svg);
    assert.ok(used.length > 0, `${name} colors through --series-k`);
    assert.deepEqual(used.slice(0, 3), [1, 2, 3].slice(0, used.length), `${name} starts at --series-1, -2, -3`);
    const fb = fallbacks(svg);
    for (const [k, n] of [[1, 1], [2, 7], [3, 8]]) if (fb[k] !== undefined) assert.equal(fb[k], n, `${name}: --series-${k} falls back to field ${n}`);
    assert.doesNotMatch(svg.replace(/var\(--series-\d+, var\(--field-\d+\)\)/g, ''), /--field-\d/, `${name}: no bare field color`);
  }
  const legend = drawn['legend field'];
  assert.deepEqual(series(legend), [1, 2, 3, 4, 5, 6, 7, 8], 'legend lists index 1 to 8');
  assert.deepEqual(Object.values(fallbacks(legend)).sort(), [1, 2, 3, 4, 5, 6, 7, 8], 'legend lists each field once');
});
