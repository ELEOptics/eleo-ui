// Plan #512 (agent_docs/plans/512-plot-scale.md), outcome O3 (issue #529, Files from CR #592; #530 writes the wrappers and unskips, CR #593).
// oracle: reference the renderers (a width the caller gives reaches the renderer; none given reaches it as undefined, so it draws its default).
// The six framed wrappers are compiled for the server against a stub `@eleoptics/plots` whose renderers print the width they got, in a temp
// dir as map2d-svelte.test.js does. The server has no layout, so `bind:clientWidth` measures nothing there: the wrapper must pass the
// caller's width, or none, never 0 or NaN. Map2D's typed SVG is drawn in an effect, which does not run in SSR, so it is checked for its frame only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('wrappers pass width through on the server', async () => {
  const { compile } = await import('svelte/compiler');
  const { render } = await import('svelte/server');
  const dir = mkdtempSync(join(tmpdir(), 'plots-svelte-'));
  try {
    const stub = (name) => `export const ${name} = (p) => '<svg data-width="' + p.width + '"></svg>';`;
    writeFileSync(join(dir, 'plots.js'), ['curve', 'rayFan', 'bars', 'spot', 'layout2D'].map(stub).join('\n') + '\nexport const map2D = () => ({ lo: 0, hi: 1 });');
    writeFileSync(join(dir, 'theme.js'), 'export const themeTick = () => 0;');
    const load = async (name) => {
      const src = readFileSync(new URL(`../../packages/plots-svelte/src/lib/${name}.svelte`, import.meta.url), 'utf8');
      const js = compile(src, { generate: 'server', filename: `${name}.svelte` }).js.code
        .replaceAll("'svelte/internal/server'", JSON.stringify(import.meta.resolve('svelte/internal/server')))
        .replaceAll("'@eleoptics/plots'", '"./plots.js"').replaceAll("'./theme.svelte.js'", '"./theme.js"');
      writeFileSync(join(dir, `${name}.js`), js);
      return (await import(pathToFileURL(join(dir, `${name}.js`)).href)).default;
    };
    const props = {
      CurvePlot: { series: [{ points: [[0, 1], [1, 0]], index: 0 }] },
      RayFan: {},
      BarPlot: { categories: ['1'], series: [{ values: [1], index: 0 }] },
      SpotDiagram: {},
      Layout2D: {},
    };
    for (const [name, p] of Object.entries(props)) {
      const Wrapper = await load(name);
      assert.match(render(Wrapper, { props: { ...p, width: 300 } }).body, /data-width="300"/, `${name} drops the width it is given`);
      assert.match(render(Wrapper, { props: p }).body, /data-width="undefined"/, `${name} passes a width on the server when none is given`);
    }
    const Map2D = await load('Map2D');
    assert.match(render(Map2D, { props: { values: [[0, 1], [1, 0]], extent: [-1, 1, -1, 1], width: 300 } }).body, /<div class="eleo-svg"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
