// plots-svelte wrappers (plan #512, agent_docs/plans/512-plot-scale.md), outcome O3 (issue #529; #532 unskips). Run after `npm run build`.
// oracle: reference the renderers (a drawing's viewBox width is its width in px).
// The six framed wrappers are compiled with svelte/compiler for the client and bundled by esbuild, with `@eleoptics/plots` resolved to the
// gallery page's `window.ELEO`; the page mounts them in boxes. A compiled page because SSR has no layout, so `clientWidth` is never measured there.
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { compile, compileModule } from 'svelte/compiler';
import { test, expect } from '@playwright/test';

const lib = fileURLToPath(new URL('../packages/plots-svelte/src/lib/', import.meta.url));
const NAMES = ['CurvePlot', 'RayFan', 'BarPlot', 'Map2D', 'SpotDiagram', 'Layout2D'];

const bundle = async () => {
  const svelte = {
    name: 'svelte',
    setup(b) {
      b.onResolve({ filter: /^@eleoptics\/plots$/ }, () => ({ path: 'eleo', namespace: 'eleo' }));
      b.onLoad({ filter: /.*/, namespace: 'eleo' }, () => ({
        contents: 'const E = window.ELEO; export const { curve, rayFan, bars, spot, layout2D, map2D } = E;', loader: 'js',
      }));
      b.onLoad({ filter: /\.svelte$/ }, (a) => ({ contents: compile(readFileSync(a.path, 'utf8'), { generate: 'client', filename: a.path }).js.code, loader: 'js' }));
      b.onLoad({ filter: /\.svelte\.js$/ }, (a) => ({ contents: compileModule(readFileSync(a.path, 'utf8'), { generate: 'client', filename: a.path }).js.code, loader: 'js' }));
    },
  };
  const entry = `import { mount } from 'svelte';\n${NAMES.map((n) => `import ${n} from './${n}.svelte';`).join('\n')}\nwindow.WRAPPERS = { mount, ${NAMES.join(', ')} };`;
  const out = await build({ stdin: { contents: entry, resolveDir: lib, loader: 'js' }, bundle: true, write: false, format: 'iife', platform: 'browser', plugins: [svelte] });
  return out.outputFiles[0].text;
};

test('wrappers draw at their width', { skip: 'awaiting #530 (acceptance test from #529; #532 unskips)' }, async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.addScriptTag({ content: await bundle() });
  const widths = await page.evaluate(async () => {
    const { mount, ...W } = window.WRAPPERS;
    const props = {
      CurvePlot: { series: [{ points: [[0, 1], [100, 0.62]], index: 0, role: 'tangential' }], x: { label: 'Spatial frequency', range: [0, 400] }, y: { label: 'Modulus', range: [0, 1] } },
      RayFan: {},
      BarPlot: { categories: ['1', '2'], series: [{ values: [0.012, -0.004], index: 0, label: 'SI' }] },
      Map2D: { values: [[0, 1, 2, 3], [1, 2, 3, 4]], extent: [-2, 2, -1, 1] },
      SpotDiagram: {},
      Layout2D: {},
    };
    const settle = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))));
    const out = {};
    for (const box of [300, 900]) for (const name of Object.keys(props)) {
      const host = document.createElement('div');
      host.style.width = `${box}px`;
      document.body.append(host);
      mount(W[name], { target: host, props: props[name] });
      await settle();
      out[`${name} ${box}`] = +host.querySelector('svg').getAttribute('viewBox').split(/\s+/)[2];
      host.remove();
    }
    return out;
  });
  for (const [key, width] of Object.entries(widths)) expect(width, key).toBe(+key.split(' ')[1]);
});
