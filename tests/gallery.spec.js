// Every renderer draws, in both themes, without errors. Run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// The gallery's tile count.
const TILES = 26;

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
    expect(tiles.length).toBe(TILES);
    for (const t of tiles) expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
  }
});

// #69: a missing merit fixture fails its one tile, not the page. oracle: property, one broken tile doesn't
// blank the others. The 404 and the gallery's own report of it are the expected console errors.
test('a missing merit fixture blanks only its tile', async ({ page }) => {
  const thrown = [];
  page.on('pageerror', (e) => thrown.push(e.message));
  await page.route('**/merit-before.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(thrown).toEqual([]);
  for (const theme of ['light', 'dark']) {
    const tiles = await inkByTile(page, theme);
    expect(tiles.length).toBe(TILES);
    for (const t of tiles) {
      if (t.tile === 'layout2D-shared') expect(t.svgMarks + t.inked, `${theme} merit tile drew`).toBe(0);
      else expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
    }
  }
});

// Plan #162, #174, #222: a missing phos-core recording fails its one tile, not the page. oracle: property, one broken
// tile doesn't blank the others. The 404 and the gallery's own report of it are the expected console errors.
for (const [fixture, lens, blanked] of [['mtf', 'achromat', ['mtf', 'mtf-limits']], ['field-curvature', 'achromat', ['fieldCurvature']], ['distortion', 'achromat', ['distortion']], ['spot', 'achromat', ['spot']], ['seidel', 'achromat', ['seidel', 'seidel-terms']], ['layout', 'wandersleb', ['layout2D-wandersleb']], ['layout', 'cassegrain', ['layout2D-cassegrain']], ['psf', 'cooke', ['psf-recorded', 'psf-log']], ['wavefront', 'cooke', ['wavefront-recorded']]]) {
  test(`a missing phos-core fixture blanks only its tiles: ${lens === 'achromat' ? '' : lens + ' '}${fixture}`, async ({ page }) => {
    const thrown = [];
    page.on('pageerror', (e) => thrown.push(e.message));
    await page.route(`**/${lens}-${fixture}.json`, (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/gallery/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    expect(thrown).toEqual([]);
    for (const theme of ['light', 'dark']) {
      const tiles = await inkByTile(page, theme);
      expect(tiles.length).toBe(TILES);
      for (const b of blanked) expect(tiles.map((t) => t.tile), `${theme} tile ${b} exists`).toContain(b);
      for (const t of tiles) {
        if (blanked.includes(t.tile)) expect(t.svgMarks + t.inked, `${theme} ${t.tile} tile drew`).toBe(0);
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
    expect(tiles.length).toBe(TILES);
    for (const t of tiles) expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
    const merit = await page.locator(`.theme[data-theme="${theme}"] [data-tile="layout2D-shared"] [data-svg]`).evaluateAll((els) =>
      Object.fromEntries(els.map((el) => [el.dataset.svg, el.querySelectorAll('svg *').length])));
    expect(merit['merit-before'], `${theme}: the rejected drawing is blank`).toBe(0);
    expect(merit['merit-after'], `${theme}: the merit tile's other drawing still draws`).toBeGreaterThan(0);
  }
});

// Plan #90, #131: a missing eleo-plots-sample.js fails the tiles that draw the sample, not the page. oracle: property,
// the tiles that bring their own data (merit, glasses, the recorded curves and spot) or need none (airy, icons) still draw. The 404 is the expected
// console error.
test('a missing sample script blanks only the sample tiles', async ({ page }) => {
  const thrown = [];
  page.on('pageerror', (e) => thrown.push(e.message));
  await page.route('**/eleo-plots-sample.js', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(thrown).toEqual([]);
  const ownData = ['layout2D-shared', 'layout2D-glasses', 'mtf', 'mtf-limits', 'fieldCurvature', 'distortion', 'spot', 'seidel', 'seidel-terms', 'layout2D-wandersleb', 'layout2D-cassegrain', 'psf-recorded', 'psf-log', 'wavefront-recorded', 'irradiance-gaussian', 'airy', 'icons'];
  for (const theme of ['light', 'dark']) {
    const tiles = await inkByTile(page, theme);
    expect(tiles.length).toBe(TILES);
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

// Plan #389, #395: the recorded Cooke PSF tile draws the typed map from tests/fixtures/phos-core/cooke-psf.json.
// oracle: fixture, 192 x 192 grid, one <image> of that size in the tile.
test('recorded PSF tile draws', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const got = await page.locator(`.theme[data-theme="${theme}"] [data-tile="psf-recorded"]`).evaluate(async (el) => {
      const svg = el.querySelector('svg'), imgs = svg ? svg.querySelectorAll('image') : [];
      if (imgs.length !== 1) return { n: imgs.length };
      const bitmap = await createImageBitmap(await (await fetch(imgs[0].getAttribute('href'))).blob());
      return { n: 1, w: bitmap.width, h: bitmap.height };
    });
    expect(got, `${theme} recorded PSF image`).toEqual({ n: 1, w: 192, h: 192 });
  }
});

// Plan #389, #401: the recorded Cooke wavefront tile draws the typed map from tests/fixtures/phos-core/cooke-wavefront.json as polar samples
// with a colorbar in waves, and a log PSF tile draws the recorded PSF with one. oracle: fixture, 64 x 64 samples, one <image>, a colorbar labelled in its unit.
test('recorded wavefront tile draws', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    for (const [tile, unit] of [['wavefront-recorded', 'waves'], ['psf-log', 'relative']]) {
      const got = await page.locator(`.theme[data-theme="${theme}"] [data-tile="${tile}"]`).evaluate((el) => {
        const svg = el.querySelector('svg');
        return { images: svg ? svg.querySelectorAll('image').length : 0, text: svg ? svg.textContent : '' };
      });
      expect(got.images, `${theme} ${tile} images`).toBe(2);
      expect(got.text, `${theme} ${tile} colorbar`).toContain(unit);
    }
  }
});

// Plan #389, #435: the props' visible effects, so an adapter that drops `map: 'ember'`, `aperture` or `scale: 'log'` fails. oracle: fixture cooke-wavefront.json
// (radii[0] row = 0.0024333, range 0.0024333..0.76991, so its step on [min, max] is round((v - min) / (max - min) * 255) of the ember map, not the wave map's);
// the aperture ring is a circle plus the even-odd path; log colorbar ticks are one decade (a quarter of the bar at 4 decades) apart, a linear bar's are not.
test('recorded wavefront tile draws with its map and aperture, the log PSF with whole decades', async ({ page }) => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/phos-core/cooke-wavefront.json', import.meta.url), 'utf8'));
  const flat = fixture.values.flat().filter((v) => Number.isFinite(v));
  const lo = Math.min(...flat), hi = Math.max(...flat), step = Math.round(((fixture.values[0][0] - lo) / (hi - lo)) * 255);
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const wf = await page.locator(`.theme[data-theme="${theme}"] [data-tile="wavefront-recorded"]`).evaluate(async (el, step) => {
      const svg = el.querySelector('svg'), img = svg.querySelector('image');
      const bitmap = await createImageBitmap(await (await fetch(img.getAttribute('href'))).blob());
      const g = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
      g.drawImage(bitmap, 0, 0);
      const px = [...g.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data.slice(0, 3)];
      const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 1);
      const wave = window.ELEO.colormap('wave', el)[step], ember = window.ELEO.colormap('ember', el)[step];
      // The ember map's step 0 is the plot ground, which is also the wave map's middle step, so the centre alone cannot tell the maps apart; the brightest sample
      // (value max, step 255 of either map) can: the image holds the ember top colour and not the wave top colour.
      const all = g.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const has = (c) => { for (let i = 0; i < all.length; i += 4) if (all[i + 3] > 0 && Math.abs(all[i] - c[0]) <= 1 && Math.abs(all[i + 1] - c[1]) <= 1 && Math.abs(all[i + 2] - c[2]) <= 1) return true; return false; };
      const top = window.ELEO.colormap('ember', el)[255], waveTop = window.ELEO.colormap('wave', el)[255];
      return {
        hasEmberTop: has(top), hasWaveTop: has(waveTop), topApart: !near(top, waveTop),
        ring: svg.querySelectorAll('circle[fill="none"]').length, even: svg.querySelectorAll('path[fill-rule="evenodd"]').length,
        isWave: near(px, wave), isEmber: near(px, ember), apart: !near(wave, ember),
      };
    }, step);
    expect(wf.apart, `${theme} wave and ember differ at step ${step}`).toBe(true);
    expect(wf.isEmber, `${theme} wavefront centre is the ember map's step ${step}`).toBe(true);
    expect(wf.isWave, `${theme} wavefront centre is not the wave map`).toBe(false);
    expect(wf.topApart, `${theme} ember and wave differ at step 255`).toBe(true);
    expect(wf.hasEmberTop, `${theme} wavefront max sample is the ember top colour`).toBe(true);
    expect(wf.hasWaveTop, `${theme} wavefront has no wave top colour`).toBe(false);
    expect(wf.ring, `${theme} aperture ring`).toBe(1);
    expect(wf.even, `${theme} aperture even-odd path`).toBe(1);

    const bar = await page.locator(`.theme[data-theme="${theme}"] [data-tile="psf-log"] svg[role="img"]`).evaluate((svg) => {
      const rect = [...svg.querySelectorAll('rect')].find((r) => r.getAttribute('width') === '10');
      const top = +rect.getAttribute('y'), h = +rect.getAttribute('height');
      const ys = [...svg.querySelectorAll('line')].filter((l) => +l.getAttribute('x2') - +l.getAttribute('x1') === 3 && +l.getAttribute('x1') === +rect.getAttribute('x') + 10)
        .map((l) => +l.getAttribute('y1')).sort((a, b) => b - a);
      const topLabel = [...svg.querySelectorAll('text.eleo-tick')].find((t) => Math.abs(+t.getAttribute('y') - ys[ys.length - 1]) < 0.01 && +t.getAttribute('x') === +rect.getAttribute('x') + 14);
      return { h, t: ys.map((y) => (top + h - y) / h), topLabel: topLabel ? topLabel.textContent : null };
    });
    expect(bar.t.length, `${theme} log colorbar ticks`).toBeGreaterThanOrEqual(4);
    // The adapter divides the recorded PSF by its peak, so the brightest value is 1: the highest tick is the top of the bar, labelled 1.
    expect(bar.t[bar.t.length - 1], `${theme} log colorbar top tick at the top of the bar`).toBeCloseTo(1, 2);
    expect(bar.topLabel, `${theme} log colorbar top tick label`).toBe('1');
    for (let i = 1; i < bar.t.length; i++) expect(bar.t[i] - bar.t[i - 1], `${theme} log ticks one decade (a quarter bar) apart`).toBeCloseTo(0.25, 2);
  }
});

// Plan #389, #402: the synthetic TEM00 Gaussian irradiance tile draws the typed map with a colorbar. Separate from the skipped O2 acceptance
// test `gaussian irradiance tile` in map2d.spec.js, which #403 unskips. oracle: one <image>, meta says synthetic, colorbar labelled "Irradiance, relative".
test('gaussian irradiance tile draws', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const got = await page.locator(`.theme[data-theme="${theme}"] [data-tile="irradiance-gaussian"]`).evaluate((el) => {
      const svg = el.querySelector('svg');
      return { images: svg ? svg.querySelectorAll('image').length : 0, text: svg ? svg.textContent : '', meta: el.querySelector('.eleo-plot__meta').textContent };
    });
    expect(got.images, `${theme} images`).toBe(2);
    expect(got.text, `${theme} colorbar`).toContain('Irradiance');
    expect(got.text, `${theme} colorbar unit`).toContain('relative');
    expect(got.meta).toMatch(/synthetic/i);
  }
});

// Maps take their colors from the theme column: stop 0 of the ember map is the plot ground, near white in light, near black in dark.
// oracle: spec tokens.css --plot-ground per theme, through ELEO.colormap; the recorded PSF's corner is 1e-5 of its peak, so step 0.
test('maps follow their theme', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const canvas = (theme) => page.locator(`.theme[data-theme="${theme}"] [data-canvas="psf"]`).evaluate((c) => [...c.getContext('2d').getImageData(1, 1, 1, 1).data.slice(0, 3)]);
  const typed = (theme) => page.locator(`.theme[data-theme="${theme}"] [data-tile="psf-recorded"] image`).evaluate(async (img) => {
    const bitmap = await createImageBitmap(await (await fetch(img.getAttribute('href'))).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height), g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  });
  for (const read of [canvas, typed]) {
    expect((await read('light')).every((v) => v > 230)).toBe(true);
    expect((await read('dark')).every((v) => v < 40)).toBe(true);
  }
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
        const fill = (k) => { const c = el.querySelector(`[data-tile="spot"] path[stroke^="var(--series-${k}"]`); return c && getComputedStyle(c).stroke; };
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

// Plan #232 #275: the spot caption is one line per setting and stays inside the figure. oracle: property, getBBox of each caption text within the viewBox.
test('spot caption stays inside the viewBox', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const got = await page.locator(`.theme[data-theme="${theme}"] [data-tile="spot"] .eleo-plot__body svg[viewBox]`).evaluate((svg) => {
      const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      const lines = [...svg.querySelectorAll(':scope > text')].filter((t) => /^(Reference|Airy|RMS, GEO)/.test(t.textContent));
      return { vw, lines: lines.map((t) => { const b = t.getBBox(); return { text: t.textContent, ok: b.x >= vx - 0.5 && b.y >= vy && b.x + b.width <= vx + vw + 0.5 && b.y + b.height <= vy + vh + 0.5 }; }) };
    });
    expect(got.lines.length, `${theme}: caption lines`).toBeGreaterThanOrEqual(2);
    for (const l of got.lines) expect(l.ok, `${theme}: "${l.text}" inside the viewBox`).toBe(true);
  }
  const lone = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = window.ELEO.spot({ panels: [{ series: [{ points: [[1, 2], [-1, 0.5]] }], airy: 2.87 }], unit: 'µm', origin: 'paraxial chief ray' });
    document.body.appendChild(host);
    const svg = host.querySelector('svg[viewBox]'), [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const lines = [...svg.querySelectorAll(':scope > text')].filter((t) => /^(Reference|Airy|RMS, GEO)/.test(t.textContent)).map((t) => { const b = t.getBBox(); return { text: t.textContent, ok: b.x >= vx - 0.5 && b.y >= vy && b.x + b.width <= vx + vw + 0.5 && b.y + b.height <= vy + vh + 0.5 }; });
    host.remove();
    return lines;
  });
  expect(lone.length, 'one-panel caption lines').toBeGreaterThanOrEqual(3);
  for (const l of lone) expect(l.ok, `one panel: "${l.text}" inside the viewBox`).toBe(true);
});
