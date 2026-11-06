// Plan #677 M1 (#680): the key module lays entries out in rows and draws their swatches.
// oracle: property no wrapped line passes the right edge; swatch markup per kind
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyLayout, keyMarkup, cornerBox, KEY_AT } from '../../packages/plots/src/key.js';

const t = 10;
const width = (label) => 1.2 * t + 0.6 * t * Array.from(label).length;

test('wrapped lines never pass the right edge', () => {
  const labels = ['a', 'a longer label', 'mid size', 'x', 'another long label here', 'zz', 'tail end label', 'q'];
  const entries = labels.map((label, i) => ({ label, index: i }));
  for (const R of [120, 200, 333, 480]) {
    const { rows, places } = keyLayout(entries, t, { L: 20, R, maxRow: 100 });
    assert.equal(places.length, entries.length);
    assert.equal(rows, 1 + Math.max(...places.map((p) => p[1])));
    places.forEach(([x], i) => {
      if (x > 20) assert.ok(x + width(labels[i]) <= R, `entry ${i} at x=${x} passes ${R}`);
    });
  }
});

test('layout reports its right edge', () => {
  const entries = [{ label: 'a long first label' }, { label: 'b' }, { label: 'a long second one' }];
  const one = keyLayout(entries.slice(0, 1), t, { L: 5, R: 1000, maxRow: 0 });
  assert.equal(one.right, 5 + width('a long first label'));
  const wrapped = keyLayout(entries, t, { L: 5, R: 300, maxRow: 100 });
  const far = Math.max(...wrapped.places.map(([x], i) => x + width(entries[i].label)));
  assert.equal(wrapped.right, far);
  assert.equal(keyLayout([], t, { L: 5, R: 300, maxRow: 100 }).right, 5);
});

test('maxRow stops the wrapping', () => {
  const entries = Array.from({ length: 6 }, (_, i) => ({ label: 'label ' + i, index: i }));
  const { rows, places } = keyLayout(entries, t, { L: 0, R: 100, maxRow: 1 });
  assert.equal(rows, 2);
  assert.ok(Math.max(...places.map((p) => p[1])) <= 1);
});

test('swatch by kind', () => {
  const entries = [
    { label: 'sq', index: 0 },
    { label: 'ln', index: 1, kind: 'line', dash: '5 3' },
    { label: 'dt', index: 2, kind: 'dot' },
  ];
  const { places } = keyLayout(entries, t, { L: 0, R: 1000, maxRow: 0 });
  const m = keyMarkup(places, entries, t, 50);
  assert.match(m, /<rect [^>]*width="8" height="8"/);
  assert.match(m, /<line [^>]*stroke-dasharray="5 3"/);
  assert.match(m, /<circle /);
  for (const l of ['sq', 'ln', 'dt']) assert.ok(m.includes('>' + l + '</text>'));
});

test('mark puts data-key on each label text', () => {
  const entries = [{ label: 'a', index: 0 }, { label: 'b', index: 1, kind: 'line' }];
  const { places } = keyLayout(entries, t, { L: 0, R: 1000, maxRow: 0 });
  const texts = (m) => m.match(/<text [^>]*>/g);
  const on = texts(keyMarkup(places, entries, t, 50, { mark: true }));
  assert.equal(on.length, 2);
  assert.ok(on.every((x) => x.includes(' data-key')));
  assert.ok(texts(keyMarkup(places, entries, t, 50)).every((x) => !x.includes('data-key')));
});

test('line swatch is two dash periods', () => {
  // a key line's dash is scaled to 0.15 t, one period 6.5 * 0.15 t, about 1 t
  const entries = [{ label: 'ln', index: 1, kind: 'line', dash: '0.6 0.375' }, { label: 'sq', index: 0 }];
  const { places } = keyLayout(entries, t, { L: 0, R: 1000, maxRow: 0 });
  const m = keyMarkup(places, entries, t, 50);
  const [, x1, x2] = m.match(/<line [^>]*x1="([\d.]+)"[^>]*x2="([\d.]+)"/);
  assert.equal(x2 - x1, 2 * t);
  const text = +m.match(/x="([\d.]+)" y="[\d.]+" style="font-size:10px">ln</)[1];
  assert.ok(text >= +x2, 'the label clears the swatch');
  // the width estimate counts the longer swatch: the next entry starts past it
  const lw = 2.4 * t + 0.6 * t * 2;
  assert.equal(places[1][0], lw + t);
  assert.equal(keyLayout(entries.slice(0, 1), t, { L: 0, R: 1000, maxRow: 0 }).right, lw);
  // wrap property for line entries
  const many = Array.from({ length: 6 }, (_, i) => ({ label: 'label ' + i, index: i, kind: 'line' }));
  for (const R of [150, 260, 400]) {
    const k = keyLayout(many, t, { L: 20, R, maxRow: 100 });
    k.places.forEach(([x], i) => { if (x > 20) assert.ok(x + 2.4 * t + 0.6 * t * 7 <= R); });
  }
});

test('corner box', () => {
  assert.deepEqual(KEY_AT, ['below', 'top-left', 'top-right', 'bottom-left', 'bottom-right']);
  const ents = [{ label: 'ab', index: 0 }, { label: 'cd', index: 1 }];
  const pad = 0.4 * t, box = (at, x0, y0, pw, ph, e = ents) => {
    const m = cornerBox(e, at, t, x0, y0, pw, ph);
    const [, x, y, w, h] = m.match(/<rect class="eleo-key" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="var\(--surface\)"\/>/).map(Number);
    return { m, x, y, w, h };
  };
  const tl = box('top-left', 30, 20, 200, 100);
  assert.equal(tl.x, 30 + pad);
  assert.equal(tl.y, 20 + pad);
  assert.ok(tl.m.includes('data-key'));
  const br = box('bottom-right', 30, 20, 200, 100);
  assert.equal(br.x, +(30 + 200 - pad - br.w).toFixed(2));
  assert.equal(br.y, +(20 + 100 - pad - br.h).toFixed(2));
  // a box wider than the plot starts inside its near edge and wraps at the plot's width
  const many = Array.from({ length: 6 }, (_, i) => ({ label: 'label ' + i, index: i }));
  const small = box('top-right', 30, 20, 50, 100, many);
  assert.equal(small.x, 30 + pad);
  assert.ok(small.h > box('top-right', 30, 20, 1000, 100, many).h, 'narrow plot wraps to more rows');
});
