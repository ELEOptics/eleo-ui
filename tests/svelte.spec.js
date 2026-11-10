// plots-svelte wrappers (plan #512, agent_docs/plans/512-plot-scale.md), outcome O3 (issue #529; #530 unskips, CR #593). Run after `npm run build`.
// oracle: reference the renderers (a drawing's viewBox width is its width in px).
// The six framed wrappers are compiled with svelte/compiler for the client and bundled by esbuild, with `@eleoptics/plots` resolved to the
// gallery page's `window.ELEO`; the page mounts them in boxes. A compiled page because SSR has no layout, so the box's `contentRect` is never measured there.
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { compile, compileModule } from 'svelte/compiler';
import { test, expect } from '@playwright/test';

const lib = fileURLToPath(new URL('../packages/plots-svelte/src/lib/', import.meta.url));
const NAMES = ['CurvePlot', 'RayFan', 'BarPlot', 'Map2D', 'SpotDiagram', 'Layout2D'];

const bundle = async (extra = '') => {
  const svelte = {
    name: 'svelte',
    setup(b) {
      b.onResolve({ filter: /^@eleoptics\/plots$/ }, () => ({ path: 'eleo', namespace: 'eleo' }));
      b.onLoad({ filter: /.*/, namespace: 'eleo' }, () => ({
        contents: 'const E = window.ELEO; export const { curve, rayFan, bars, spot, layout2D, map2D, interact, readout } = E;', loader: 'js',
      }));
      b.onLoad({ filter: /\.svelte$/ }, (a) => ({ contents: compile(readFileSync(a.path, 'utf8'), { generate: 'client', filename: a.path }).js.code, loader: 'js' }));
      b.onLoad({ filter: /\.svelte\.js$/ }, (a) => ({ contents: compileModule(readFileSync(a.path, 'utf8'), { generate: 'client', filename: a.path }).js.code, loader: 'js' }));
    },
  };
  const entry = `import { mount } from 'svelte';\n${NAMES.map((n) => `import ${n} from './${n}.svelte';`).join('\n')}\nwindow.WRAPPERS = { mount, ${NAMES.join(', ')} };\n${extra}`;
  const out = await build({ stdin: { contents: entry, resolveDir: lib, loader: 'js' }, bundle: true, write: false, format: 'iife', platform: 'browser', plugins: [svelte] });
  return out.outputFiles[0].text;
};

const drawn = async (page, boxes) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.addScriptTag({ content: await bundle() });
  return page.evaluate(async (boxes) => {
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
    for (const box of boxes) for (const name of Object.keys(props)) {
      const host = document.createElement('div');
      host.style.width = typeof box === 'number' ? `${box}px` : box; // a number is px, a string a CSS width
      document.body.append(host);
      mount(W[name], { target: host, props: props[name] });
      await settle();
      out[`${name} ${box}`] = +host.querySelector('svg').getAttribute('viewBox').split(/\s+/)[2];
      host.remove();
    }
    return out;
  }, boxes);
};

test('wrappers draw at their width', async ({ page }) => {
  for (const [key, width] of Object.entries(await drawn(page, [300, 900]))) expect(width, key).toBe(+key.split(' ')[1]);
});

// oracle: reference `fit` (#539), which draws at the box's fractional content width.
test('wrappers draw at their fractional width', async ({ page }) => {
  for (const [key, width] of Object.entries(await drawn(page, [287.5]))) expect(width, key).toBe(287.5);
});

// oracle: reference `fit`'s `measure`, which rounds the measured width to 2 decimals.
test('wrappers round their width as fit does', async ({ page }) => {
  const widths = await drawn(page, ['calc(1000px / 3)']);
  expect(Object.keys(widths)).toHaveLength(6);
  for (const [key, width] of Object.entries(widths)) expect(width, key).toBe(333.33);
});

// oracle: reference `layout2D`'s default width (1000), drawn when the box is too narrow to measure (a collapsing panel, a transition).
test('Layout2D in a narrow box draws its default', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.addScriptTag({ content: await bundle() });
  const widths = await page.evaluate(async () => {
    const { mount, Layout2D } = window.WRAPPERS;
    const settle = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))));
    const out = {};
    for (const box of [3, 5, 8, 9]) {
      const host = document.createElement('div');
      host.style.width = `${box}px`;
      document.body.append(host);
      mount(Layout2D, { target: host, props: {} });
      await settle();
      const svg = host.querySelector('svg');
      out[box] = svg ? +svg.getAttribute('viewBox').split(/\s+/)[2] : null;
      host.remove();
    }
    return out;
  });
  expect(errors).toEqual([]);
  expect(widths).toEqual({ 3: 1000, 5: 1000, 8: 1000, 9: 9 });
});

// Plan #804 (agent_docs/plans/804-interaction.md), outcome O3 (issue #805; #812 unskips). oracle: closed-form `readout()` of the event's fields and the caller's axis specs.
// The harness (tests/fixtures/svelte/ReadoutHarness.svelte, #811) holds a CurvePlot in a PlotCard whose `readout` prop shows the last hover event through `readout(event, { x, y })`.
const harness = fileURLToPath(new URL('./fixtures/svelte/ReadoutHarness.svelte', import.meta.url));
test('PlotCard hover readout', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.addScriptTag({ content: await bundle(`import ReadoutHarness from ${JSON.stringify(harness)};\nwindow.WRAPPERS.ReadoutHarness = ReadoutHarness;`) });
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'harness';
    host.style.width = '600px';
    document.body.append(host);
    window.WRAPPERS.mount(window.WRAPPERS.ReadoutHarness, { target: host, props: {} });
  });
  // The harness draws one series, label 'Tangential', points [[0, 1], [120, 0.62], [240, 0.3]], x 'cycles/mm', y unitless.
  const poly = page.locator('#harness polyline[data-series="0"]');
  await expect(poly).toBeVisible();
  await poly.scrollIntoViewIfNeeded(); // the harness sits below the gallery's tiles, far under the viewport
  const g = poly.locator('xpath=..');
  const at = await g.evaluate((el) => {
    const [a, , , d, e, f] = el.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
    const vp = el.closest('svg');
    const root = vp.ownerSVGElement || vp;
    const box = root.getBoundingClientRect();
    const k = box.width / root.viewBox.baseVal.width;
    const vx = +(vp.getAttribute('x') || 0), vy = +(vp.getAttribute('y') || 0);
    return { x: box.left + (vx + a * 120 + e) * k, y: box.top + (vy + d * 0.62 + f) * k };
  });
  await page.mouse.move(at.x, at.y);
  await expect(page.locator('#harness .eleo-plot__readout')).toHaveText('Tangential · 120 cycles/mm, 0.62');
});
