// Plan #804 (agent_docs/plans/804-interaction.md), issue #808.
// oracle: closed-form `<label> · <x> <unit>, <y> <unit>` of the event's fields and the caller's axis specs (the issue's formula; the plan's O3 text).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readout } from '../../packages/plots/src/interact.js';
import ELEO, { readout as named } from '../../packages/plots/src/index.js';

const ev = { x: 120, y: 0.62, series: { index: 0, label: 'Tangential', role: 'tangential' } };

test('readout text', () => {
  assert.equal(readout(ev, { x: { unit: 'cycles/mm' }, y: {} }), 'Tangential · 120 cycles/mm, 0.62');
  assert.equal(named, readout);
  assert.equal(ELEO.readout, readout);
});

test('readout digits and units', () => {
  assert.equal(readout(ev, { x: { unit: 'cycles/mm', digits: 1 }, y: { unit: 'mm', digits: 3 } }), 'Tangential · 120.0 cycles/mm, 0.620 mm');
  assert.equal(readout({ x: -1.5, y: 0, series: { index: 1 } }, { x: {}, y: {} }), '−1.5, 0');
  assert.equal(readout(null, { x: {}, y: {} }), '');
});
