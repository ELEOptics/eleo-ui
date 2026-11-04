// Plan #512 (agent_docs/plans/512-plot-scale.md), issue #516: fit(el, draw) draws at the container's width.
// oracle: spec ADR-0003 (fit: a synchronous first draw, one shared ResizeObserver, one redraw per frame, width changes above 0 only)
import { test } from 'node:test';
import assert from 'node:assert/strict';

const observed = new Set();
let notify = null;
let frames = [];
globalThis.ResizeObserver = class {
  constructor(cb) { notify = cb; this.made = (globalThis.__ro = (globalThis.__ro || 0) + 1); }
  observe(el) { observed.add(el); }
  unobserve(el) { observed.delete(el); }
  disconnect() { observed.clear(); }
};
globalThis.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
globalThis.cancelAnimationFrame = (id) => { frames[id - 1] = null; };
const flush = () => { const f = frames; frames = []; f.forEach((cb) => cb && cb(0)); };

const ELEO = (await import('../../packages/plots/src/index.js')).default;
const index = await import('../../packages/plots/src/index.js');
const { fit } = await import('../../packages/plots/src/fit.js');

test('draws now, coalesces, ignores height-only and zero widths', () => {
  const el = { clientWidth: 300, clientHeight: 100 };
  const widths = [];
  const stop = fit(el, (w) => { widths.push(w); });
  assert.deepEqual(widths, [300], 'draws synchronously at the width');
  assert.ok(observed.has(el), 'observes the element');

  el.clientWidth = 400; notify([{ target: el }]); notify([{ target: el }]);
  assert.deepEqual(widths, [300], 'no draw before the frame');
  flush();
  assert.deepEqual(widths, [300, 400], 'one redraw for two notifications');

  el.clientHeight = 500; notify([{ target: el }]); flush();
  assert.deepEqual(widths, [300, 400], 'height-only change draws nothing');

  el.clientWidth = 0; notify([{ target: el }]); flush();
  assert.deepEqual(widths, [300, 400], 'zero width draws nothing');
  el.clientWidth = 400; notify([{ target: el }]); flush();
  assert.deepEqual(widths, [300, 400], 'back at the drawn width draws nothing');

  el.clientWidth = 250; notify([{ target: el }]);
  stop();
  flush();
  assert.deepEqual(widths, [300, 400], 'stop cancels a pending redraw');
  assert.ok(!observed.has(el), 'stop unobserves');
  el.clientWidth = 200; notify([{ target: el }]); flush();
  assert.deepEqual(widths, [300, 400], 'no draw after stop');
});

test('a zero width at the start draws nothing until it has width', () => {
  const el = { clientWidth: 0 };
  const widths = [];
  const stop = fit(el, (w) => { widths.push(w); });
  assert.deepEqual(widths, [], 'no first draw at width 0');
  assert.ok(observed.has(el), 'still observed');
  el.clientWidth = 300; notify([{ target: el }]); flush();
  assert.deepEqual(widths, [300], 'draws once the width is above 0');
  stop();
});

test('one ResizeObserver serves every element', () => {
  const a = { clientWidth: 100 }, b = { clientWidth: 200 };
  const wa = [], wb = [];
  const sa = fit(a, (w) => wa.push(w)), sb = fit(b, (w) => wb.push(w));
  a.clientWidth = 150; b.clientWidth = 250; notify([{ target: a }, { target: b }]); flush();
  assert.deepEqual([wa, wb], [[100, 150], [200, 250]]);
  assert.equal(globalThis.__ro, 1, 'a single observer was made');
  sa(); sb();
});

test('index exports fit and the scale rule at runtime', () => {
  assert.equal(index.fit, fit);
  assert.equal(ELEO.fit, fit);
  for (const name of ['frameText', 'frameWeight', 'frameOf', 'layoutText', 'layoutWeight']) {
    assert.equal(typeof index[name], 'function', name);
  }
  for (const [name, v] of Object.entries({ TEXT_MIN: 9, TEXT_MAX: 13, F_LO: 162, F_HI: 234, W_LO: 630, W_HI: 910 })) {
    assert.equal(index[name], v, name);
  }
});
