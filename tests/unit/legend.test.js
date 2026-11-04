// Plan #162 (agent_docs/plans/162-curve-typed.md), O5, issue #181.
// oracle: spec #121. Legend renders for the non-glass kinds with no sample loaded, SSR included.
// node --test runs each file in its own process and this file never imports the sample, so state.sample stays null.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('non-glass legends render without the sample (#121)', async () => {
  const { compile } = await import('svelte/compiler');
  const { render } = await import('svelte/server');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const src = readFileSync(join(root, 'packages/plots-svelte/src/lib/Legend.svelte'), 'utf8');
  // Under node_modules so the compiled output resolves svelte/internal/server and @eleoptics/plots.
  const dir = mkdtempSync(join(root, 'node_modules', '.legend-'));
  try {
    const file = join(dir, 'Legend.js');
    writeFileSync(file, compile(src, { generate: 'server', filename: 'Legend.svelte' }).js.code);
    const { default: Legend } = await import(pathToFileURL(file).href);
    const html = (props) => render(Legend, { props }).body;
    const keys = (body) => [...body.matchAll(/class="eleo-key[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]);
    assert.deepEqual(keys(html({ kind: 'field', n: 3 })), ['F1', 'F2', 'F3']);
    assert.deepEqual(keys(html({ kind: 'wavelength', n: 3 })), ['λ1', 'λ2', 'λ3']);
    assert.deepEqual(keys(html({ kind: 'field' })), []);
    assert.deepEqual(keys(html({ kind: 'wavelength' })), []);
    assert.deepEqual(keys(html({ kind: 'ts' })), ['T tangential', 'S sagittal', 'Diffraction limit']);
    assert.deepEqual(keys(html({ kind: 'rays' })), ['Marginal ray', 'Chief ray']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('legend() without the sample: n keys without values, none without n; ts/rays fixed (#121)', async () => {
  const { legend } = await import('../../packages/plots/src/legend.js');
  const keys = (s) => [...s.matchAll(/class="eleo-key[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(keys(legend('field', 3)), ['F1', 'F2', 'F3']);
  assert.deepEqual(keys(legend('wavelength', 3)), ['λ1', 'λ2', 'λ3']);
  assert.equal(legend('field'), '');
  assert.equal(legend('wavelength'), '');
  assert.deepEqual(keys(legend('ts')), ['T tangential', 'S sagittal', 'Diffraction limit']);
  assert.deepEqual(keys(legend('rays')), ['Marginal ray', 'Chief ray']);
});

// Plan #464, CR #483, issue #484. Appended last: it loads a sample into the shared state.
test('field and wavelength keys take explicit values (#484)', async () => {
  const { legend } = await import('../../packages/plots/src/legend.js');
  const { useSample } = await import('../../packages/plots/src/data.js');
  const keys = (s) => [...s.matchAll(/class="eleo-key[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]);
  const cs = (s) => [...s.matchAll(/--c:([^"]*)"/g)].map((m) => m[1]);
  const { idx } = await import('../../packages/plots/src/common.js');
  const f = legend('field', undefined, [0, 17, 24]);
  assert.deepEqual(keys(f), ['F1 0.0°', 'F2 17.0°', 'F3 24.0°']);
  assert.deepEqual(cs(f), [idx(0), idx(1), idx(2)]);
  assert.deepEqual(keys(legend('wavelength', 1, [550])), ['λ1 550.0 nm']);
  assert.deepEqual(keys(legend('field', 2, [0, 17, 24])), ['F1 0.0°', 'F2 17.0°']);
  assert.deepEqual(keys(legend('field', 3, [0, NaN])), ['F1 0.0°', 'F2', 'F3']);
  assert.deepEqual(keys(legend('ts', 1, [5])), keys(legend('ts')));
  // With a sample loaded, a call without values is unchanged.
  const none = { fields: [0, 10], wl: [550, 600] };
  useSample(none);
  const before = legend('field') + legend('wavelength') + legend('field', 3);
  assert.equal(before, '<span class="eleo-key" style="--c:' + idx(0) + '">F1 0.0°</span><span class="eleo-key" style="--c:' + idx(1) + '">F2 10.0°</span>'
    + '<span class="eleo-key" style="--c:' + idx(0) + '">λ1 550.0 nm</span><span class="eleo-key" style="--c:' + idx(1) + '">λ2 600.0 nm</span>'
    + '<span class="eleo-key" style="--c:' + idx(0) + '">F1 0.0°</span><span class="eleo-key" style="--c:' + idx(1) + '">F2 10.0°</span><span class="eleo-key" style="--c:' + idx(2) + '">F3</span>');
  // Explicit values win over the sample's.
  assert.deepEqual(keys(legend('field', undefined, [3])), ['F1 3.0°']);
  useSample(null);
});
