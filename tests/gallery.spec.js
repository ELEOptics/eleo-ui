// Every renderer draws, in both themes, without errors. Run after `npm run build`.
import { readdirSync } from 'node:fs';
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
    expect(tiles.length).toBe(16);
    for (const t of tiles) expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
  }
});

// #69: a missing merit fixture fails its one tile, not the page. oracle: property, one broken tile doesn't
// blank the other 15. The 404 and the gallery's own report of it are the expected console errors.
test('a missing merit fixture blanks only its tile', async ({ page }) => {
  const thrown = [];
  page.on('pageerror', (e) => thrown.push(e.message));
  await page.route('**/merit-before.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(thrown).toEqual([]);
  for (const theme of ['light', 'dark']) {
    const tiles = await inkByTile(page, theme);
    expect(tiles.length).toBe(16);
    for (const t of tiles) {
      if (t.tile === 'layout2D-shared') expect(t.svgMarks + t.inked, `${theme} merit tile drew`).toBe(0);
      else expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
    }
  }
});

// O3 (plan #30): eleo-layout.js loads alone and draws. oracle: property: the entry loads in a page with no
// other ELEO script and draws U3's fixtures. The page loads only tokens.css and the entry, draws each
// tests/fixtures/layouts/*.json into an element marked data-fixture="<name>", then sets body[data-ready].
const layoutFixtures = readdirSync(new URL('./fixtures/layouts/', import.meta.url))
  .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();

test('standalone layout entry', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/tests/fixtures/standalone-layout.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(errors).toEqual([]);

  const assets = await page.evaluate(() => ({
    scripts: [...document.scripts].filter((s) => s.src).map((s) => new URL(s.src).pathname),
    styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => new URL(l.href).pathname),
    api: { layout2D: typeof window.ELEO?.layout2D, layoutBounds: typeof window.ELEO?.layoutBounds, sample: typeof window.ELEO?.sample },
  }));
  expect(assets.scripts).toEqual(['/packages/plots/dist/eleo-layout.js']);
  expect(assets.styles).toEqual(['/packages/tokens/dist/tokens.css']);
  expect(assets.api).toEqual({ layout2D: 'function', layoutBounds: 'function', sample: 'undefined' });

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
