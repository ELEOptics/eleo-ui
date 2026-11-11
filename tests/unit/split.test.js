import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ELEO from '../../packages/plots/dist/index.js';
import { draws } from '../../scripts/record-renderers.mjs';

// Plan 162, O2: the renderers draw what main's build drew at the plan's base.
// oracle: fixture SVG markup from main's dist at the plan's base (scripts/record-renderers.mjs)
// The fixture is recorded by scripts/record-renderers.mjs from that build, never from the code under test; the layout2D entries were re-recorded at plan #337 #382 by the user's choice (CR #381).
const baseline = JSON.parse(readFileSync(new URL('../fixtures/renderers-baseline.json', import.meta.url), 'utf8'));

// Plan #804 M1 (#806, #844): the plan's data-* names are not part of the base markup; both sides are compared without them.
// Every other data-* (data-grid) stays compared. M2 adds its names here (data-category, data-cell, ...); #818 added data-field, data-ray, data-surface.
const PLAN_ATTRS = ['data-series', 'data-role', 'data-label', 'data-panel', 'data-cell', 'data-category', 'data-category-label', 'data-extent', 'data-range', 'data-rows', 'data-columns', 'data-radii', 'data-angles', 'data-field', 'data-ray', 'data-surface', 'data-view', 'data-element', 'data-glass', 'data-nd', 'data-vd', 'data-r1', 'data-r2', 'data-ct', 'data-diameter', 'data-f'];
const planAttr = new RegExp(` (?:${PLAN_ATTRS.join('|')})="[^"]*"`, 'g');
const bare = (m) => m.replace(planAttr, '');

test('SVG renderers draw the base markup', () => {
  const now = draws();
  assert.deepEqual(Object.keys(now), Object.keys(baseline), 'same renderers as recorded');
  for (const [name, draw] of Object.entries(now)) assert.equal(bare(draw()), bare(baseline[name]), name);
});
// Plan 162 M1: curve and legend moved verbatim to curve.js and legend.js; this guard covers the moved modules.
// Plan 162 M1: spot, throughFocus and rayFan moved verbatim to spot.js and fan.js; the guard covered them too.
// Plan 232 M2 (#240): spot now draws through its typed panels and left the baseline; spot.test.js checks it against sample.json.
// Plan 232 M1 (#235): rayFan now draws through curve's panels and left the baseline; fan.test.js checks it against sample.json.
// Plan 162 M1: map2D, layout3D and the icon set moved verbatim to map2d.js, layout3d.js and icons.js; the guard covers them too.

// Plan #642 O3 (CR #653): the four recorded-layout entries are the recordings with `status` deleted, so the base stays the legacy drawing.
test('the recorded layout entries draw without status (O3, CR #653)', () => {
  const real = ELEO.layout2D, seen = [];
  ELEO.layout2D = (props) => { seen.push(props); return real(props); };
  try {
    for (const name of ['wandersleb', 'cassegrain']) for (const width of [1000, 600]) draws()[`layout2D-${name}-${width}`]();
  } finally { ELEO.layout2D = real; }
  assert.equal(seen.length, 4);
  for (const props of seen) assert.equal('status' in props.data, false, 'no status key');
});

// Plan #677 M1 (#679): bars draws the gallery's seidel tiles as main's build did before the key extraction (#680).
// oracle: fixture SVG markup recorded from main's dist before the extraction (scripts/record-renderers.mjs)
test('bars baseline', () => {
  const now = draws();
  for (const name of ['seidel', 'seidel-terms']) {
    assert.ok(name in baseline, `${name} recorded`);
    assert.ok(name in now, `${name} drawn`);
    assert.equal(bare(now[name]()), bare(baseline[name]), name);
  }
});
