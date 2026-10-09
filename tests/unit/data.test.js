// Acceptance test for plan #162 (agent_docs/plans/162-curve-typed.md), issue #165, outcome O2.
// oracle: property the sample state in data.js is the one ELEO.sample reads and every renderer draws from (sample.json's field list)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ELEO from '../../packages/plots/src/renderers.js';
import { state, data } from '../../packages/plots/src/data.js';

const sample = JSON.parse(readFileSync(new URL('../../packages/plots/src/sample.json', import.meta.url), 'utf8'));

test('useSample sets ELEO.sample and reaches every renderer', () => {
  assert.equal(ELEO.sample, null);
  assert.throws(() => ELEO.layout2D({}), /ELEO: pass \{ data \}/);
  ELEO.useSample(sample);
  assert.equal(ELEO.sample, sample);
  assert.equal(state.sample, sample);
  assert.equal(data({}), sample);
  assert.equal(data({ data: { x: 1 } }).x, 1, 'an explicit data option wins');
  assert.match(ELEO.legend('field'), new RegExp(`F${sample.fields.length}`), 'legend reads the sample');
  assert.ok(ELEO.layout2D({}).includes('<svg'), 'layout2D draws the sample');
});
