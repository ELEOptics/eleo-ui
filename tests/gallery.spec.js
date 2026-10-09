// Every renderer draws, in both themes, without errors. Run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// Per tile in one theme column: its SVG mark count and inked canvas pixels.
const inkByTile = (page, theme) => page.locator(`.theme[data-theme="${theme}"] [data-tile]`).evaluateAll((els) => els.map((el) => {
  const svg = el.querySelector('.eleo-plot__body svg');
  const canvas = el.querySelector('canvas');
  let inked = 0;
  if (canvas) {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i]) inked++;
  }
  return { tile: el.dataset.tile, svgMarks: svg ? svg.querySelectorAll('path, line, circle, rect, polyline').length : 0, inked };
}));

test('gallery renders every tile in both themes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(errors).toEqual([]);

  for (const theme of ['light', 'dark']) {
    const tiles = await inkByTile(page, theme);
    expect(tiles.length).toBe(17);
    for (const t of tiles) expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
  }
});

// #69: a missing merit fixture fails its one tile, not the page. oracle: property, one broken tile doesn't
// blank the other 16. The 404 and the gallery's own report of it are the expected console errors.
test('a missing merit fixture blanks only its tile', async ({ page }) => {
  const thrown = [];
  page.on('pageerror', (e) => thrown.push(e.message));
  await page.route('**/merit-before.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(thrown).toEqual([]);
  for (const theme of ['light', 'dark']) {
    const tiles = await inkByTile(page, theme);
    expect(tiles.length).toBe(17);
    for (const t of tiles) {
      if (t.tile === 'layout2D-shared') expect(t.svgMarks + t.inked, `${theme} merit tile drew`).toBe(0);
      else expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
    }
  }
});

// Plan #162, #174, #222: a missing phos-core recording fails its one tile, not the page. oracle: property, one broken
// tile doesn't blank the other 16. The 404 and the gallery's own report of it are the expected console errors.
for (const [fixture, broken] of [['mtf', 'mtf'], ['field-curvature', 'fieldCurvature'], ['distortion', 'distortion']]) {
  test(`a missing phos-core fixture blanks only its tile: ${fixture}`, async ({ page }) => {
    const thrown = [];
    page.on('pageerror', (e) => thrown.push(e.message));
    await page.route(`**/achromat-${fixture}.json`, (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/gallery/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    expect(thrown).toEqual([]);
    for (const theme of ['light', 'dark']) {
      const tiles = await inkByTile(page, theme);
      expect(tiles.length).toBe(17);
      expect(tiles.map((t) => t.tile), `${theme} tile ${broken} exists`).toContain(broken);
      for (const t of tiles) {
        if (t.tile === broken) expect(t.svgMarks + t.inked, `${theme} ${broken} tile drew`).toBe(0);
        else expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
      }
    }
  });
}

// Plan #90, O3, #76: a merit fixture that layoutBounds accepts but layout2D rejects (2 fans against the tile's 3
// labels) fails its one drawing, not the page. oracle: property, one rejected drawing doesn't blank the other tiles
// or the merit tile's other drawing. The gallery's own report of it is the expected console error.
test('a rejected merit fixture blanks only its tile', async ({ page }) => {
  const thrown = [], logged = [];
  page.on('pageerror', (e) => thrown.push(e.message));
  page.on('console', (m) => m.type() === 'error' && logged.push(m.text()));
  await page.route('**/merit-before.json', async (route) => {
    const L = await (await route.fetch()).json();
    await route.fulfill({ json: { ...L, rays: L.rays.slice(0, 2) } });
  });
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(thrown).toEqual([]);
  expect(logged.length, 'the gallery logs the rejected drawing').toBeGreaterThan(0);
  for (const theme of ['light', 'dark']) {
    const tiles = await inkByTile(page, theme);
    expect(tiles.length).toBe(17);
    for (const t of tiles) expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
    const merit = await page.locator(`.theme[data-theme="${theme}"] [data-tile="layout2D-shared"] [data-svg]`).evaluateAll((els) =>
      Object.fromEntries(els.map((el) => [el.dataset.svg, el.querySelectorAll('svg *').length])));
    expect(merit['merit-before'], `${theme}: the rejected drawing is blank`).toBe(0);
    expect(merit['merit-after'], `${theme}: the merit tile's other drawing still draws`).toBeGreaterThan(0);
  }
});

// Plan #90, #131: a missing eleo-plots-sample.js fails the tiles that draw the sample, not the page. oracle: property,
// the tiles that bring their own data (merit, glasses, the recorded curves) or need none (airy, icons) still draw. The 404 is the expected
// console error.
test('a missing sample script blanks only the sample tiles', async ({ page }) => {
  const thrown = [];
  page.on('pageerror', (e) => thrown.push(e.message));
  await page.route('**/eleo-plots-sample.js', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(thrown).toEqual([]);
  const ownData = ['layout2D-shared', 'layout2D-glasses', 'mtf', 'fieldCurvature', 'distortion', 'airy', 'icons'];
  for (const theme of ['light', 'dark']) {
    const tiles = await inkByTile(page, theme);
    expect(tiles.length).toBe(17);
    for (const t of tiles) {
      if (ownData.includes(t.tile)) expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
      else expect(t.svgMarks + t.inked, `${theme} sample tile ${t.tile} drew`).toBe(0);
    }
  }
});

// Plan #90, O3, #47: the classic build exposes the sample. Loading eleo-plots.js, then eleo-plots-sample.js, leaves
// window.ELEO.sample set, so the gallery can read zimg from it. oracle: fixture packages/plots/src/sample.json's zimg
test('classic build exposes the sample', async ({ page }) => {
  const { zimg } = JSON.parse(readFileSync(new URL('../packages/plots/src/sample.json', import.meta.url)));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => window.ELEO.sample?.zimg)).toBe(zimg);
});

// Plan #90, #129: iife.js's merge branch. With eleo-layout.js loaded first, window.ELEO already exists, so
// eleo-plots.js merges into it; eleo-plots-sample.js then leaves window.ELEO.sample set, read through the merged
// object. oracle: fixture packages/plots/src/sample.json's zimg
test('classic entries merge and expose the sample', async ({ page }) => {
  const { zimg } = JSON.parse(readFileSync(new URL('../packages/plots/src/sample.json', import.meta.url)));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tests/fixtures/classic-merge.html');
  expect(errors).toEqual([]);
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => new URL(s.src).pathname));
  expect(scripts).toEqual(['/packages/plots/dist/eleo-layout.js', '/packages/plots/dist/eleo-plots.js', '/packages/plots/dist/eleo-plots-sample.js']);
  expect(await page.evaluate(() => ({ layout2D: typeof window.ELEO.layout2D, spot: typeof window.ELEO.spot }))).toEqual({ layout2D: 'function', spot: 'function' });
  expect(await page.evaluate(() => window.ELEO.sample?.zimg)).toBe(zimg);
});

// O3 (plan #30): eleo-layout.js loads alone and draws. oracle: property: the entry loads in a page with no
// other ELEO script and draws U3's fixtures. The page loads only tokens.css and the entry, draws each
// tests/fixtures/layouts/*.json into an element marked data-fixture="<name>", then sets body[data-ready]:
// "true", or "error" after logging a failed fixture. Errors are asserted first so a failure prints its text.
const layoutFixtures = readdirSync(new URL('./fixtures/layouts/', import.meta.url))
  .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();

test('standalone layout entry', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/tests/fixtures/standalone-layout.html');
  await expect(page.locator('body[data-ready]')).toHaveCount(1);
  expect(errors).toEqual([]);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  const assets = await page.evaluate(() => ({
    scripts: [...document.scripts].filter((s) => s.src).map((s) => new URL(s.src).pathname),
    styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => new URL(l.href).pathname),
    api: { layout2D: typeof window.ELEO?.layout2D, layoutBounds: typeof window.ELEO?.layoutBounds, glassLegend: typeof window.ELEO?.glassLegend, sample: typeof window.ELEO?.sample },
  }));
  expect(assets.scripts).toEqual(['/packages/plots/dist/eleo-layout.js']);
  expect(assets.styles).toEqual(['/packages/tokens/dist/tokens.css']);
  expect(assets.api).toEqual({ layout2D: 'function', layoutBounds: 'function', glassLegend: 'function', sample: 'undefined' });

  const drawn = await page.locator('[data-fixture]').evaluateAll((els) => els.map((el) => ({
    fixture: el.dataset.fixture,
    marks: el.querySelectorAll('svg path, svg line, svg circle, svg rect, svg polyline, svg polygon').length,
  })));
  expect(drawn.map((d) => d.fixture).sort()).toEqual(layoutFixtures);
  for (const d of drawn) expect(d.marks, `${d.fixture} drew nothing`).toBeGreaterThan(0);
});

test('canvas maps follow their theme', async ({ page }) => {
  await page.goto('/gallery/');
  const corner = (theme) => page.locator(`.theme[data-theme="${theme}"] [data-canvas="psf"]`).evaluate((c) => [...c.getContext('2d').getImageData(1, 1, 1, 1).data.slice(0, 3)]);
  // Stop 0 of the ember map is the plot ground: near white in light, near black in dark.
  expect((await corner('light')).every((v) => v > 230)).toBe(true);
  expect((await corner('dark')).every((v) => v < 40)).toBe(true);
});

// O2 (plan #4): the selected segment is marked in glass, not amber. oracle: user ELEO design system, one amber accent per view.
// The marker is inset 0 -2px 0 var(--glass-edge). oracle: user, plan #4 round 1 (carried from #10, which this subsumes).
test('segmented control marks in glass', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const col = page.locator(`.theme[data-theme="${theme}"]`);
    await expect(col.locator('.eleo-seg')).not.toHaveCount(0);
    const seg = await col.evaluate((el) => {
      const probe = (v) => { const p = document.createElement('i'); p.style.color = `var(${v})`; el.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
      const rgbs = (s) => s.match(/rgba?\([^)]*\)/g) || [];
      const control = el.querySelector('.eleo-seg');
      const colors = [control, ...control.querySelectorAll('*')].flatMap((n) => {
        const s = getComputedStyle(n);
        return [s.color, s.backgroundColor, s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor, s.outlineColor, ...rgbs(s.boxShadow)];
      });
      const checked = control.querySelector('input:checked + span');
      return { glass: probe('--glass-edge'), accent: probe('--accent'), marker: checked && rgbs(getComputedStyle(checked).boxShadow)[0], colors };
    });
    expect(seg.marker, `${theme} checked marker`).toBe(seg.glass);
    expect(seg.colors, `${theme} control uses no accent`).not.toContain(seg.accent);
  }
});

// O3 (plan #4): the header's palette switch sets <html data-palette>, and both theme columns recolor.
// oracle: property, rule R per palette (tests/unit/field-order.test.js); the spot tile's index 1 and 2 are the
// palette's first two fields, read in each column.
test('palette switch recolors both themes', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const palettes = [['Red-green', 'red-green', [3, 4]], ['Blue-yellow', 'blue-yellow', [1, 4]], ['Standard', 'standard', [1, 7]]];
  const checkColumns = async (label, fields) => {
    for (const theme of ['light', 'dark']) {
      const col = page.locator(`.theme[data-theme="${theme}"]`);
      const got = await col.evaluate((el, fields) => {
        const probe = (v) => { const p = document.createElement('i'); p.style.color = `var(${v})`; el.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
        const fill = (k) => { const c = el.querySelector(`[data-tile="spot"] circle[fill^="var(--series-${k}"]`); return c && getComputedStyle(c).fill; };
        return { fills: [fill(1), fill(2)], expected: fields.map((n) => probe(`--field-${n}`)) };
      }, fields);
      expect(got.fills, `${label}, ${theme} column: spot index 1 and 2`).toEqual(got.expected);
    }
  };
  for (const [label, value, fields] of palettes) {
    await page.getByRole('radio', { name: label }).check();
    if (value !== 'standard') await expect(page.locator('html')).toHaveAttribute('data-palette', value);
    await checkColumns(label, fields);
  }
  // The gallery removes the attribute for Standard, so set it directly: the [data-palette="standard"] block
  // must resolve the same as no attribute.
  await page.evaluate(() => { document.documentElement.dataset.palette = 'standard'; });
  await checkColumns('data-palette="standard"', [1, 7]);
});

// Plan #144 (agent_docs/plans/144-layout-defaults.md), O2, issue #145: everything layout2D draws lies inside its
// viewBox, labels included. oracle: property, overflow hidden and visible draw the same pixels around the SVG
// (roadmap row L exit; #117's measurement). Each fixture is drawn on the standalone page (tokens only) with
// labels at the fans' fields, at 1000 and 480 px; the screenshot clip is the SVG's box grown 12 px on every side.
test('layouts stay inside the viewBox (#117)', async ({ page }) => {
  await page.goto('/tests/fixtures/standalone-layout.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const fields = ['0°', '12.5°', '24°'];
  for (const name of layoutFixtures) {
    const data = JSON.parse(readFileSync(new URL(`./fixtures/layouts/${name}.json`, import.meta.url), 'utf8'));
    for (const width of [1000, 480]) {
      const svgBox = await page.evaluate(({ data, width, fields }) => {
        document.body.innerHTML = '<div id="probe" style="margin:24px"></div>';
        const labels = data.rays.map((_, k) => fields[k]);
        document.getElementById('probe').innerHTML = window.ELEO.layout2D({ data, labels, width });
        const svg = document.querySelector('#probe svg');
        svg.style.cssText = `display:block;width:${width}px`;
        const r = svg.getBoundingClientRect();
        return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
      }, { data, width, fields });
      const clip = { x: svgBox.x - 12, y: svgBox.y - 12, width: svgBox.width + 24, height: svgBox.height + 24 };
      const shot = async (overflow) => {
        await page.evaluate((o) => { document.querySelector('#probe svg').style.overflow = o; }, overflow);
        return page.screenshot({ clip, fullPage: true });
      };
      const hidden = await shot('hidden'), visible = await shot('visible');
      expect(visible.equals(hidden), `${name} at ${width} px draws outside its viewBox`).toBe(true);
    }
  }
});

// Plan #144, O3, issue #145: on a page with only tokens.css, layout2D's texts look as `.eleo-tick` does under
// plots.css. oracle: spec plots.css .eleo-tick (plots.css:127), through a bare <svg><text class="eleo-tick"> that
// layout2D didn't draw, on a page loading tokens.css and plots.css.
test('standalone label style (#112)', async ({ page }) => {
  const props = (el) => { const c = getComputedStyle(el); return { fontFamily: c.fontFamily, fontSize: c.fontSize, fontWeight: c.fontWeight, fill: c.fill }; };
  await page.goto('/tests/fixtures/standalone-layout.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const drawn = await page.locator('[data-fixture="merit-before"] svg text', { hasText: '10 mm' }).first().evaluate(props);
  // The same page, plus plots.css and a bare text layout2D didn't draw.
  const ref = await page.context().newPage();
  try {
    await ref.goto('/tests/fixtures/standalone-layout.html');
    await expect(ref.locator('body')).toHaveAttribute('data-ready', 'true');
    await ref.evaluate(() => new Promise((resolve, reject) => {
      const link = document.createElement('link');
      Object.assign(link, { rel: 'stylesheet', href: '/packages/plots/dist/plots.css', onload: resolve, onerror: () => reject(new Error('plots.css did not load')) });
      document.head.append(link);
      document.body.insertAdjacentHTML('beforeend', '<svg id="bare"><text class="eleo-tick">10 mm</text></svg>');
    }));
    const bare = await ref.locator('#bare text').evaluate(props);
    expect(drawn).toEqual(bare);
  } finally {
    await ref.close();
  }
});
