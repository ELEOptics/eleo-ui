// Plan #389 (agent_docs/plans/389-map2d-typed.md), M3, issue #405.
// oracle: spec #405 Behaviour: Map2D renders `div.eleo-svg[role=img]`, never a canvas (#1209 removed the sample branch).
// `range` is `[lo, hi]` in (#460); a `{ lo, hi }` or a sample call (no `values`) is a type error, checked by `npm run check` (svelte-check), not at runtime.
// The component is compiled for the server against stub plots and theme modules, in a temp dir; effects do not run in SSR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('Map2D renders a div.eleo-svg for a typed grid, never a canvas', async () => {
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
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// #461: the svelte-check fixture guards the typed `range`. Its @ts-expect-error lines make a widened union fail `npm run check`.
test('Map2D type fixture keeps its @ts-expect-error guards', () => {
  const fixture = readFileSync(new URL('../../packages/plots-svelte/src/fixtures/Map2DTypes.svelte', import.meta.url), 'utf8');
  const guards = fixture.match(/^\s*\/\/ @ts-expect-error/gm) ?? [];
  assert.equal(guards.length, 3, 'typed { lo, hi }, the sample call, values without extent');
  assert.doesNotMatch(fixture, /bind:range/, 'no sample bind:range');
});
