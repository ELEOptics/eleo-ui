// Plan #389 (agent_docs/plans/389-map2d-typed.md), M3, issue #405.
// oracle: spec #405 Behaviour: given `values`, Map2D renders `div.eleo-svg[role=img]` (not a canvas); without them, the canvas as today.
// Per-mode `range` rule (#460): typed mode (with `values`) takes `range?: [lo, hi]` in; sample mode reports `{ lo, hi }` out. Map2D.svelte types it as a union, checked by `npm run check` (svelte-check), not at runtime.
// The component is compiled for the server against stub plots and theme modules, in a temp dir; effects do not run in SSR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('Map2D renders a div.eleo-svg for a typed grid and a canvas for the sample', async () => {
  const { compile } = await import('svelte/compiler');
  const { render } = await import('svelte/server');
  const src = readFileSync(new URL('../../packages/plots-svelte/src/lib/Map2D.svelte', import.meta.url), 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'map2d-'));
  try {
    writeFileSync(join(dir, 'plots.js'), 'export const map2D = () => ({ lo: 0, hi: 1 });\nexport const interact = () => () => {};');
    writeFileSync(join(dir, 'theme.js'), 'export const themeTick = () => 0;');
    writeFileSync(join(dir, 'interact.js'), 'export const hover = () => ({});');
    let js = compile(src, { generate: 'server', filename: 'Map2D.svelte' }).js.code;
    js = js.replace("'svelte/internal/server'", JSON.stringify(import.meta.resolve('svelte/internal/server')))
      .replace("'@eleoptics/plots'", '"./plots.js"').replace("'./theme.svelte.js'", '"./theme.js"').replace("'./interact.svelte.js'", '"./interact.js"');
    writeFileSync(join(dir, 'Map2D.js'), js);
    const { default: Map2D } = await import(pathToFileURL(join(dir, 'Map2D.js')).href);
    const typed = render(Map2D, { props: { values: [[0, 1], [1, 0]], extent: [-1, 1, -1, 1], label: 'Wavefront' } }).body;
    assert.match(typed, /<div class="eleo-svg"[^>]*role="img"/);
    assert.match(typed, /aria-label="Wavefront"/);
    assert.doesNotMatch(typed, /<canvas/);
    const sample = render(Map2D, { props: { kind: 'psf' } }).body;
    assert.match(sample, /<canvas/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// #461: the svelte-check fixture guards the per-mode `range` union. Its @ts-expect-error lines make a widened union fail `npm run check`.
test('Map2D type fixture keeps its @ts-expect-error guards', () => {
  const fixture = readFileSync(new URL('../../packages/plots-svelte/src/fixtures/Map2DTypes.svelte', import.meta.url), 'utf8');
  const guards = fixture.match(/^\s*\/\/ @ts-expect-error/gm) ?? [];
  assert.equal(guards.length, 3, 'typed { lo, hi }, sample [lo, hi], values without extent');
  assert.match(fixture, /bind:range/, 'the sample bind:range is accepted');
});
