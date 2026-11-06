// Plan #677 M1 (#680): the key module lays entries out in rows and draws their swatches.
// oracle: property no wrapped line passes the right edge; swatch markup per kind
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyLayout, keyMarkup } from '../../packages/plots/src/key.js';

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
