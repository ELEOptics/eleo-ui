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
