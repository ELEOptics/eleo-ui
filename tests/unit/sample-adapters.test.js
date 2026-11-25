// Plan #1258 M1, O5 (issue #1204): gallery/sample-adapters.js draws the sample tiles through typed calls, the same SVG as the sample calls drew.
// oracle: fixture tests/fixtures/renderers-baseline.json (recorded from the plan base's build, chromaticFocus and rayFan-opd by #1203; never re-recorded in row K); property: the keys and panels follow sample.json's own fields and wavelengths
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ELEO from '../../packages/plots/dist/index.js';
import '../../gallery/sample-adapters.js'; // a classic script: assigns globalThis.ELEOSampleAdapters

const S = JSON.parse(readFileSync(new URL('../../packages/plots/src/sample.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(readFileSync(new URL('../fixtures/renderers-baseline.json', import.meta.url), 'utf8'));
const A = () => globalThis.ELEOSampleAdapters;
// The same data-* blindness as split.test.js: the baseline predates the plan's data attributes.
const bare = (m) => m.replace(/ data-[a-z0-9-]+="[^"]*"/g, '');

test('chromaticFocus draws the baseline tile', () => {
  assert.equal(bare(ELEO.curve(A().chromaticFocus(S))), bare(baseline.chromaticFocus));
});

test('rayFan with a key draws the baseline OPD fans', () => {
  assert.equal(bare(ELEO.curve(A().rayFan(S, { kind: 'opd', key: true }))), bare(baseline['rayFan-opd']));
});

test('rayFan sizes by width and columns', () => {
  const none = A().rayFan(S, {}), wide = A().rayFan(S, { width: 1368 });
  assert.equal(none.width, 3 * (170 + 58));
  assert.equal(none.height, 314);
  assert.equal(wide.height, Math.round(1368 * 314 / (3 * 228)));
  assert.equal(A().rayFan(S, { height: 99 }).height, 99);
  assert.equal(none.key, undefined, 'no key without key: true');
});

test('fanPanels: a column per field, row T then row S, symmetric nice range', () => {
  const f = A().fanPanels(S, {});
  assert.equal(f.columns, S.fields.length);
  assert.equal(f.panels.length, 2 * S.fields.length);
  assert.deepEqual(f.panels.map((p) => p.title.slice(-2)), ['Py', 'Py', 'Py', 'Px', 'Px', 'Px']);
  assert.equal(f.panels[0].series.length, S.wl.length);
  assert.equal(f.y.range[0], -f.y.range[1]);
  const mx = Math.max(...S.fans.flatMap((x) => ['T', 'S'].flatMap((k) => x[k].flat().filter((v) => v !== null).map(Math.abs))));
  assert.ok(f.y.range[1] >= mx, 'the range holds every value');
});

test('layouts: the two sample layouts draw as the layout2D tiles', () => {
  const L = A().layouts(S);
  assert.equal(bare(ELEO.layout2D({ data: L.field, width: 1000, box: { zmin: -8, zmax: S.zimg + 4, ylo: -13.5, yhi: 13.5 } })), bare(baseline.layout2D));
  assert.equal(bare(ELEO.layout2D({ data: L.wavelength, width: 1000, colorBy: 'wavelength', rays: 'fan', box: { zmin: -8, zmax: S.zimg + 4, ylo: -13.5, yhi: 13.5 } })), bare(baseline['layout2D-fan']));
});

test('keyLabels', () => {
  assert.deepEqual(A().keyLabels(S, 'field').map((e) => e.label), ['F1 0.0°', 'F2 1.0°', 'F3 2.0°']);
  assert.deepEqual(A().keyLabels(S, 'wavelength').map((e) => e.label), ['λ1 486.1 nm', 'λ2 587.6 nm', 'λ3 656.3 nm']);
  assert.deepEqual(A().keyLabels(S, 'wavelength').map((e) => e.index), [0, 1, 2]);
});
