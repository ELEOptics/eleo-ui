import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { draws } from '../../scripts/record-renderers.mjs';

// Plan 162, O2: the renderers draw what main's build drew at the plan's base.
// oracle: fixture SVG markup from main's dist at the plan's base (scripts/record-renderers.mjs)
// The fixture is recorded by scripts/record-renderers.mjs from that build, never from the code under test.
const baseline = JSON.parse(readFileSync(new URL('../fixtures/renderers-baseline.json', import.meta.url), 'utf8'));

test('SVG renderers draw the base markup', () => {
  const now = draws();
  assert.deepEqual(Object.keys(now), Object.keys(baseline), 'same renderers as recorded');
  for (const [name, draw] of Object.entries(now)) assert.equal(draw(), baseline[name], name);
});
// Plan 162 M1: curve and legend moved verbatim to curve.js and legend.js; this guard covers the moved modules.
// Plan 162 M1: spot, throughFocus and rayFan moved verbatim to spot.js and fan.js; the guard covers them too.
