// Plan #1175 (agent_docs/plans/1175-nan-index-font-mime.md), issue #1169.
// oracle: closed-form the limit role's dash 6 3 1 3 (period 13), and a '6 4' dash (period 10) cut 25 px along: offset 25 mod 10 = 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limitStyle } from '../../packages/plots/src/curve.js';
import { limitMarks } from '../../packages/plots/src/limits.js';

test('limit dash from limitStyle', () => {
  assert.equal(limitStyle().dash, '6 3 1 3');
  const norm = [{ axis: 'y', lo: 1, hi: 1, band: false }];
  // a horizontal line: its start is span[0] = 2.5 data units * 10 px = 25 px from data 0
  const m = limitMarks(norm, [2.5, 9], [0, 3], { line: 'stroke="x"', dash: '6 4' }, true, { x: 10, y: 10 });
  assert.match(m.over, /stroke-dashoffset="5"/);
});
