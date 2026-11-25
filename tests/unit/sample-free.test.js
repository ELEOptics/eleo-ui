// Plan #1258 M1, O5 (issue #1203): the sample-shaped calls are gone and each throws its named error.
// One case per removal-table row; nothing in this file is skipped (#1213).
// The legend and padded-glass rows are tested where they live: legend.test.js "values only" (#1211), glass.test.js "unknown glass string throws" (#139).
// oracle: spec plan #1258's removal table (Milestones): "After removal" column, error texts `<fn>: <what> was removed; see the README migration table`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ELEO from '../../packages/plots/dist/index.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const self = fileURLToPath(import.meta.url);
const removed = (what) => new RegExp(`${what} was removed; see the README migration table`);

test('throughFocus', () => {
  assert.throws(() => ELEO.throughFocus({}), removed('throughFocus: the sample call'));
  assert.throws(() => ELEO.throughFocus(), removed('throughFocus: the sample call'));
  assert.doesNotThrow(() => ELEO.throughFocus({ defocus: [0], rows: [{ title: 'a', series: [[{ points: [[1, 2]] }]] }], unit: 'µm' }));
});

test('curve kind', () => {
  assert.throws(() => ELEO.curve({ kind: 'chromaticFocus' }), removed('curve: kind'));
});

test('rayFan', () => {
  assert.equal('rayFan' in ELEO, false, 'ELEO.rayFan is gone');
});

test('spot sample', () => {
  assert.throws(() => ELEO.spot({}), removed('spot: the sample call'));
  assert.throws(() => ELEO.spot(), removed('spot: the sample call'));
  assert.throws(() => ELEO.spot({ colorBy: 'field' }), removed('spot: the sample call'));
  assert.doesNotThrow(() => ELEO.spot({ panels: [{ title: 'a', series: [{ points: [[1, 2]], index: 0 }] }] }));
});

test('map2D canvas', () => {
  assert.throws(() => ELEO.map2D({}, { kind: 'psf' }), removed('map2D: the canvas call'));
  assert.throws(() => ELEO.map2D({ nodeType: 1 }), removed('map2D: the canvas call'));
  assert.throws(() => ELEO.map2D(), removed('map2D: the canvas call'));
});

test('LayoutSystem', () => {
  assert.throws(() => ELEO.layout2D({ layout: {} }), removed('layout2D: LayoutSystem'));
  assert.throws(() => ELEO.glassLegend({ layout: {} }), removed('glassLegend: LayoutSystem'));
});

test('no data', () => {
  assert.throws(() => ELEO.layout2D({}), /layout2D: pass \{ data: RecordedLayout \}/);
  assert.throws(() => ELEO.glassLegend({}), /glassLegend: pass \{ data: RecordedLayout \}/);
});

test('exports', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'packages/plots/package.json'), 'utf8'));
  for (const key of ['./sample', './eleo-plots-sample.js']) assert.equal(key in pkg.exports, false, `${key} is not exported`);
  assert.ok(!JSON.stringify(pkg.sideEffects).includes('sample'), 'sideEffects names no sample');
  assert.equal('useSample' in ELEO, false, 'ELEO.useSample is gone');
});

// zimg is a key of sample.json that no other dist file carries.
test('dist has no sample', () => {
  const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
  for (const file of walk(join(root, 'packages/plots/dist'))) {
    assert.doesNotMatch(relative(root, file), /sample/, `${file} is a sample file`);
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\bzimg\b/, `${file} carries the sample`);
  }
});

test('no tree reference', () => {
  const skipDir = new Set(['node_modules', 'dist', 'test-results', '.svelte-kit', 'playwright-report']);
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (skipDir.has(f) ? [] : walk(p)) : [p];
  });
  // Files that name the removal on purpose: the type test of the removed call, the release test and the README migration table, the generated CHANGELOGs (history).
  const named = new Set(['tests/types/removed.ts', 'tests/unit/release.test.js', 'packages/plots/README.md', 'packages/plots/CHANGELOG.md', 'packages/plots-svelte/CHANGELOG.md']);
  const name = /(?<![\w.-])(?:sample|data)\.js\b|useSample|ELEO\.sample|eleo-plots-sample|\bfan\.js\b|\bfan\.test\.js\b|CurveKindProps|RayFanProps|SpotSampleProps|curveAdapters/;
  const hits = ['packages', 'gallery', 'scripts', 'tests'].flatMap((d) => walk(join(root, d)))
    .filter((f) => f !== self && !named.has(relative(root, f)) && /\.(js|mjs|ts|svelte|html|json|md|css)$/.test(f) && name.test(readFileSync(f, 'utf8')))
    .map((f) => relative(root, f));
  assert.deepEqual(hits, [], 'files still naming the sample');
});
