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
for (const [fixture, lens, blanked] of [['mtf', 'achromat', ['mtf', 'mtf-limits']], ['field-curvature', 'achromat', ['fieldCurvature']], ['distortion', 'achromat', ['distortion']], ['spot', 'achromat', ['spot']], ['seidel', 'achromat', ['seidel', 'seidel-terms']], ['layout', 'wandersleb', ['layout2D-wandersleb']], ['layout', 'cassegrain', ['layout2D-cassegrain', 'layout2D-cassegrain-dead-hidden']], ['psf', 'cooke', ['psf-recorded', 'psf-log']], ['wavefront', 'cooke', ['wavefront-recorded']], ['footprint', 'cooke', ['footprint']], ['fans', 'achromat', ['rayFan']]]) {
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

// Plan #464, CR #507, #508, #510: the footprint tile's header key ends at the plot frame's right edge.
// The text-size, plot-size, text-spacing and text-to-plot ratio checks of CR #499, #500, #502, #503 are superseded by plan #512 (user, at approval): O2's 'text follows ADR-0003 on every framed tile (U18)' covers the footprint tile.
// oracle: at 1440, 1100 and 700 px the .eleo-plot__key's right edge is within 4 px of the frame's right edge (the header and the body share the same 12 px right padding and the tile's border, so they cancel; the gap is the frame's own inset, measured 1.5 / 2.4 / 1.5 px).
test('the footprint tile header key ends at the plot frame right edge', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const at = async (width) => {
      await page.setViewportSize({ width, height: 900 });
      return page.locator(`.theme[data-theme="${theme}"] [data-tile="footprint"]`).evaluate((t) => {
        const svg = t.querySelector('svg');
        const ticks = [...svg.querySelectorAll('.eleo-tick')];
        const key = t.querySelector('.eleo-plot__key').getBoundingClientRect().right;
        const keyGap = Math.abs(t.querySelector('svg rect[rx="3"]').getBoundingClientRect().right - key);
        return { keyGap, n: ticks.length };
      });
    };
    const w = await at(1440);
    expect(w.n, `${theme} footprint ticks`).toBeGreaterThan(0);
    // CR #507, #508, #510: the header key ends at the plot frame's right edge. The header and the body share the same 12 px right padding and border, so they cancel; what remains is the frame's own inset (0.5 viewBox units), so the bound is 4 px.
    expect(w.keyGap, `${theme} key to frame at 1440`).toBeLessThanOrEqual(4);
    for (const width of [1100, 700]) {
      const r = await at(width);
      expect(r.keyGap, `${theme} key to frame at ${width}`).toBeLessThanOrEqual(4);
    }
  }
});

// Plan #642, O5, issue #650: the recorded Cassegrain with show: ["Alive", "Virtual"] draws no Dead run, while the
// tile without show draws one. oracle: the data-status of the drawn polylines.
test('the Cassegrain Dead-hidden tile draws no Dead run (U17)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const col = page.locator(`.theme[data-theme="${theme}"]`);
    const dead = (tile) => col.locator(`[data-tile="${tile}"] svg [data-status="Dead"]`);
    expect(await dead('layout2D-cassegrain').count(), `${theme} full tile has a Dead run`).toBeGreaterThan(0);
    await expect(col.locator('[data-tile="layout2D-cassegrain-dead-hidden"] svg [data-status="Alive"]').first(), `${theme} alive drawn`).toBeAttached();
    await expect(dead('layout2D-cassegrain-dead-hidden'), `${theme} hidden tile`).toHaveCount(0);
  }
});

// Plan #512, outcomes O1 and O2 (issue #513; #521 unskips; #527 adds the spot, throughFocus, footprint, bars and map2D tiles). Canvas tiles are exempt.
// oracle: closed-form ADR-0003. At 1440, 1100 and 700 px in both themes, each tile's rendered text (computed font-size times getScreenCTM().a)
// is within 1% of the formula for its rendered frame F (a plot frame's width in px; a layout tile's drawing width W) and at least 9 px.
// A layout tile whose W / 70 is under 9 draws no text.
const frameText = (F) => (F < 162 ? 9 : F <= 234 ? F / 18 : 13 * Math.cbrt(F / 234));
const layoutText = (W) => (W / 70 < 9 ? null : W <= 910 ? W / 70 : 13 * Math.sqrt(W / 910));
// Plan #677 M2, #688: a missing recording leaves its tile blank, with no key. The 404 is the expected console error.
// The keys of the present recordings are checked by 'fan and footprint keys'.
for (const [tile, fixture] of [['footprint', 'cooke-footprint.json'], ['rayFan', 'achromat-fans.json']]) {
  test(`a missing ${tile} fixture leaves its tile without keys`, async ({ page }) => {
    await page.route(`**/${fixture}`, (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/gallery/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    for (const theme of ['light', 'dark']) {
      const el = page.locator(`.theme[data-theme="${theme}"] [data-tile="${tile}"]`);
      await expect(el.locator('.eleo-plot__ft'), `${theme} ${tile} footer`).toHaveCount(0);
      await expect(el.locator('text[data-key]'), `${theme} ${tile} keys`).toHaveCount(0);
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
  // oracle: property: ELEO.minWidth(name, props) is never below ELEO.PLOT_SIZES[name].minWidth, so every sized tile's --tile-min is at least that plus 26 px of chrome, sample or not
  const mins = await page.$$eval('[data-tile][data-size]', (ts) => ts.map((t) => ({ tile: t.dataset.tile, min: parseFloat(t.style.getPropertyValue('--tile-min')), floor: window.ELEO.PLOT_SIZES[t.dataset.size].minWidth + 26 })));
  expect(mins.length).toBeGreaterThan(0);
  for (const m of mins) expect(m.min, `${m.tile} --tile-min`).toBeGreaterThanOrEqual(m.floor - 0.5);
  const ownData = ['layout2D-shared', 'layout2D-glasses', 'mtf', 'mtf-limits', 'fieldCurvature', 'distortion', 'rayFan', 'spot', 'seidel', 'seidel-terms', 'layout2D-wandersleb', 'layout2D-cassegrain', 'layout2D-cassegrain-dead-hidden', 'psf-recorded', 'psf-log', 'wavefront-recorded', 'footprint', 'irradiance-gaussian', 'airy', 'icons'];
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
// oracle: fixture, 192 x 192 grid, an <image> of that size and the colorbar's in the tile (#694).
test('recorded PSF tile draws', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const got = await page.locator(`.theme[data-theme="${theme}"] [data-tile="psf-recorded"]`).evaluate(async (el) => {
      const svg = el.querySelector('svg'), imgs = svg ? svg.querySelectorAll('image') : [];
      if (imgs.length !== 2) return { n: imgs.length };
      const bitmap = await createImageBitmap(await (await fetch(imgs[0].getAttribute('href'))).blob());
      return { n: 2, w: bitmap.width, h: bitmap.height };
    });
    expect(got, `${theme} recorded PSF image`).toEqual({ n: 2, w: 192, h: 192 });
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

// Plan #389, #435: the props' visible effects, so an adapter that sets `map: 'wave'` (ember is map2D's default, so dropping `map` passes), drops `aperture` or drops `scale: 'log'` fails. oracle: fixture cooke-wavefront.json
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
      // ADR-0003 text units: t is the tick text's inline font-size; the colorbar is the rect t wide, its ticks 0.3 t long from the bar's right edge, their labels 0.4 t past it.
      const t = parseFloat(svg.querySelector('text.eleo-tick').style.fontSize), near = (a, b) => Math.abs(a - b) < 0.02;
      const rect = [...svg.querySelectorAll('rect')].find((r) => near(+r.getAttribute('width'), t));
      const top = +rect.getAttribute('y'), h = +rect.getAttribute('height'), right = +rect.getAttribute('x') + +rect.getAttribute('width');
      const ys = [...svg.querySelectorAll('line')].filter((l) => near(+l.getAttribute('x2') - +l.getAttribute('x1'), 0.3 * t) && near(+l.getAttribute('x1'), right))
        .map((l) => +l.getAttribute('y1')).sort((a, b) => b - a);
      const topLabel = [...svg.querySelectorAll('text.eleo-tick')].find((l) => Math.abs(+l.getAttribute('y') - ys[ys.length - 1]) < 0.01 && near(+l.getAttribute('x'), right + 0.4 * t));
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

// The typed map takes its colors from the theme column: stop 0 of the ember map is the plot ground, near white in light, near black in dark.
// oracle: spec tokens.css --plot-ground per theme, through ELEO.colormap; the recorded PSF's corner is 1e-5 of its peak, so step 0.
test('maps follow their theme', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const typed = (theme) => page.locator(`.theme[data-theme="${theme}"] [data-tile="psf-recorded"] image`).first().evaluate(async (img) => {
    const bitmap = await createImageBitmap(await (await fetch(img.getAttribute('href'))).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height), g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  });
  expect((await typed('light')).every((v) => v > 230)).toBe(true);
  expect((await typed('dark')).every((v) => v < 40)).toBe(true);
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
// layout2D didn't draw, on a page loading tokens.css and plots.css, for fontFamily, fontWeight and fill. The size is
// ADR-0003's on purpose (plan #512, #518): fontSize is layoutText(width) for the fixture's drawing (1000 px), closed-form,
// not the class's 10 px.
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
    const { fontSize, ...rest } = drawn, { fontSize: _bare, ...bareRest } = bare;
    expect(rest).toEqual(bareRest);
    expect(parseFloat(fontSize)).toBeCloseTo(layoutText(1000), 2);
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

// Plan #512 M2 review r1 finding 6 (issue #581): fit's first draw is synchronous, so a typed map must not be drawn again by the load-time canvas pass. oracle: property, ELEO.map2D calls with a `values` prop per tile.
test('each typed map draws once at load', async ({ page }) => {
  await page.addInitScript(() => {
    window.__mapCalls = {};
    let real;
    Object.defineProperty(window, 'ELEO', {
      configurable: true,
      get: () => real,
      set: (v) => {
        const orig = v.map2D;
        v.map2D = function (props) {
          if (props && props.values && props.el) {
            const t = props.el.dataset.tile + '|' + props.el.closest('.theme').dataset.theme;
            window.__mapCalls[t] = (window.__mapCalls[t] || 0) + 1;
          }
          return orig.apply(this, arguments);
        };
        real = v;
      },
    });
  });
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const tiles = await page.locator('[data-map]').evaluateAll((els) => els.map((e) => e.parentNode.dataset.tile + '|' + e.closest('.theme').dataset.theme));
  expect(tiles.length).toBeGreaterThan(0);
  const calls = await page.evaluate(() => window.__mapCalls);
  for (const t of tiles) expect(calls[t], t).toBe(1);
});

// #591: tileMins skips a data-size that isn't a PLOT_SIZES key, so a typo would silently drop that tile's floor.
// oracle: property, every data-size in the page names a PLOT_SIZES row.
test('every data-size names a PLOT_SIZES row', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const { sizes, rows } = await page.evaluate(() => ({
    sizes: [...document.querySelectorAll('[data-size]')].map((el) => el.dataset.size),
    rows: Object.keys(window.ELEO.PLOT_SIZES),
  }));
  expect(sizes.length).toBeGreaterThan(0);
  expect(sizes.filter((s) => !rows.includes(s))).toEqual([]);
});

// Plan #603 (agent_docs/plans/603-recorded-fans.md), outcomes O1 to O3 (issue #604). Each case is skipped until its item lands.
const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));

// O1, issue #607. oracle: fixture tests/fixtures/phos-core/achromat-fans.json (phos-core TransverseRayError, scripts/record-phos-core.py --only fans): its sources' field angles title the panels
// ("<angle>° · Py" then "<angle>° · Px"), and the tile draws as many paths as the adapter's series count (a series per wavelength, per panel; a dead gap is a break inside a path).
test('rayFan tile draws the recording', async ({ page }) => {
  const rec = JSON.parse(readFileSync(new URL('./fixtures/phos-core/achromat-fans.json', import.meta.url), 'utf8'));
  const titles = ['Py', 'Px'].flatMap((k) => rec.sources.map((s) => `${s.fieldAngleDeg.toFixed(1)}° · ${k}`));
  const series = 2 * rec.sources.reduce((n, s) => n + s.wavelengths.length, 0);
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const tile = page.locator(`.theme[data-theme="${theme}"] [data-tile="rayFan"]`);
    await expect(tile.locator('.eleo-plot__meta'), `${theme} rayFan meta`).toContainText('Achromat, recorded, TRA from the chief ray, µm');
    const got = await tile.locator('.eleo-plot__body svg text').allTextContents();
    for (const t of titles) expect(got, `${theme} rayFan panel title ${t}`).toContain(t);
    expect(await tile.locator('.eleo-plot__body svg path[stroke]:not(.eleo-limit)').count(), `${theme} rayFan series paths`).toBeGreaterThanOrEqual(series);
  }
});

// CR #622 (the user at the M1 demo): every plot has its own full width, the light theme then the dark, so resizing shows each plot at each width.
// oracle: property: at each width every tile's width is its theme section's content width, every light tile is above every dark one, and the page never scrolls sideways;
// a tile narrower than its minimum (--tile-min, ELEO.minWidth plus 26 px of chrome, #611) keeps its body at that minimum inside the tile, which scrolls.
test('every tile is the page width, the light theme before the dark (#622)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const width of [1440, 1100, 700]) {
    await page.setViewportSize({ width, height: 900 });
    await settle(page);
    const r = await page.evaluate(() => {
      const box = (el) => el.getBoundingClientRect();
      const themes = [...document.querySelectorAll('.theme')].map((th) => {
        const c = getComputedStyle(th), b = box(th);
        return { theme: th.dataset.theme, left: b.left + parseFloat(c.paddingLeft), width: b.width - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight), top: b.top, bottom: b.bottom,
          tiles: [...th.querySelectorAll('[data-tile]')].map((t) => ({ tile: t.dataset.tile, left: box(t).left, width: box(t).width, min: parseFloat(t.style.getPropertyValue('--tile-min')), floor: t.dataset.size ? window.ELEO.PLOT_SIZES[t.dataset.size].minWidth + 26 : NaN, body: box(t.querySelector('.eleo-plot__body')).width })) };
      });
      return { themes, rows: document.querySelectorAll('.row').length, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    expect(r.sideways, `${width} scrolls sideways`).toBe(false);
    expect(r.rows, `${width} .row grids`).toBe(0);
    expect(r.themes.map((t) => t.theme), `${width} theme order`).toEqual(['light', 'dark']);
    expect(r.themes[0].bottom, `${width} light above dark`).toBeLessThanOrEqual(r.themes[1].top + 0.5);
    for (const th of r.themes) {
      expect(th.tiles.length, `${width} ${th.theme} tiles`).toBe(TILES);
      for (const t of th.tiles) {
        expect(Math.abs(t.width - th.width), `${width} ${th.theme} ${t.tile} width ${t.width} against ${th.width}`).toBeLessThanOrEqual(1);
        expect(Math.abs(t.left - th.left), `${width} ${th.theme} ${t.tile} left`).toBeLessThanOrEqual(1);
        if (Number.isNaN(t.min)) continue; // a tile with no data-size has no minimum
        // oracle: property: ELEO.minWidth(name, props) is never below ELEO.PLOT_SIZES[name].minWidth, so --tile-min is at least that plus 26 px of chrome
        expect(t.min, `${width} ${th.theme} ${t.tile} --tile-min`).toBeGreaterThanOrEqual(t.floor - 0.5);
        expect(t.body, `${width} ${th.theme} ${t.tile} body at least its minimum`).toBeGreaterThanOrEqual(t.min - 2 - 0.5);
      }
    }
  }
});

// O2, issue #611, reshaped by #625 (CR #622). oracle: closed-form ADR-0003 (the floor frame F = 162). A tile's --tile-min is ELEO.minWidth for its call plus the tile chrome (26 px).
// The viewport-width property (no sideways scroll) is asserted by 'every tile is the page width'. The floor is asserted by pinning each tile to exactly --tile-min wide:
// every frame is then at least 162 px (a map's first grid rect only: its colorbar has the same stroke, #587).
// Replaces 'rows give each frame the floor (#587)'.
test('every tile at its minimum has the floor frame (#587)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => document.querySelectorAll('.theme > [data-tile][data-size]').forEach((el) => {
    el.style.maxWidth = `${parseFloat(el.style.getPropertyValue('--tile-min')) || 240}px`;
  }));
  await settle(page);
  let checked = 0, mapTiles = 0;
  for (const theme of ['light', 'dark']) {
    const tiles = await page.evaluate((t) => [...document.querySelectorAll(`.theme[data-theme="${t}"] [data-tile][data-size]`)].map((el) => ({
      tile: el.dataset.tile, size: el.dataset.size, min: parseFloat(el.style.getPropertyValue('--tile-min')),
      frames: [...el.querySelectorAll('svg rect[stroke="var(--plot-grid)"]')].slice(0, el.dataset.size === 'map2D' ? 1 : undefined).map((x) => x.getBoundingClientRect().width + (x.getAttribute('rx') === '3' ? 1 : 0)), // rx 3 frames are drawn inset by the stroke, as in the #555 test
    })), theme);
    for (const t of tiles) {
      if (t.size === 'map2D') mapTiles++;
      for (const F of t.frames) { checked++; expect(F, `${theme} ${t.tile} frame ${F}px at tile-min ${t.min}`).toBeGreaterThanOrEqual(162 - 0.5); }
    }
  }
  expect(checked, 'frames checked').toBeGreaterThan(0);
  expect(mapTiles, 'map tiles checked').toBeGreaterThan(0);
});

// O2, issue #555 (reuse item); #512's U18 test, no hand lists. oracle: closed-form ADR-0003 (frameText, layoutText above). The tiles are enumerated by data-size, and the set equals every section holding a
// [data-svg] or [data-map] (so it is not the hand list asserted against itself); layout tiles carry data-size="layout2D".
test('text follows ADR-0003 on every framed tile (U18)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 1100, 700]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      const r = await page.evaluate((t) => {
        const col = document.querySelector(`.theme[data-theme="${t}"]`);
        const sized = [...col.querySelectorAll('[data-tile][data-size]')];
        const drawn = [...col.querySelectorAll('[data-tile]')].filter((el) => el.querySelector('[data-svg], [data-map]'));
        return {
          sized: sized.map((el) => el.dataset.tile).sort(), drawn: drawn.map((el) => el.dataset.tile).sort(),
          tiles: sized.map((el) => {
            const svg = el.querySelector('.eleo-plot__body svg');
            const frame = svg && svg.querySelector('rect[stroke="var(--plot-grid)"]');
            return {
              tile: el.dataset.tile, layout: el.dataset.size === 'layout2D', drawn: !!svg,
              F: frame ? frame.getBoundingClientRect().width + (frame.getAttribute('rx') === '3' ? 1 : 0) : null,
              W: svg ? svg.getBoundingClientRect().width : null,
              sizes: svg ? [...svg.querySelectorAll('text')].map((x) => parseFloat(getComputedStyle(x).fontSize) * x.getScreenCTM().a) : [],
            };
          }),
        };
      }, theme);
      expect(r.sized, `${theme} ${width}: the tiles with a data-size are every tile with a drawing`).toEqual(r.drawn);
      for (const t of r.tiles) {
        const at = `${theme} ${width} ${t.tile}`;
        expect(t.drawn, `${at} drawn`).toBe(true);
        if (!t.layout) expect(t.F, `${at} has a frame rect to measure`).not.toBeNull();
        const want = t.layout ? layoutText(t.W) : frameText(t.F);
        if (want === null) { expect(t.sizes, `${at} (W ${t.W}) labels hidden`).toEqual([]); continue; }
        expect(t.sizes.length, `${at} has text`).toBeGreaterThan(0);
        for (const s of t.sizes) {
          expect(Math.abs(s / want - 1), `${at} text ${s}px against ${want}px`).toBeLessThanOrEqual(0.01);
          expect(s, `${at} text ${s}px is at least 9 px (less 0.01 px: throughFocus floors its panel side to 2 decimals)`).toBeGreaterThanOrEqual(9 - 0.01);
        }
      }
    }
  }
});

// CR #632 (issue #634): canvas tiles draw through fit at their body's width and the device pixel ratio (layout3D's clamped to 2-3), so a resize redraws them. oracle: property, backing width vs rendered width x dpr.
test('canvas tiles redraw at their width (#632)', async ({ page }) => {
  const widths = () => page.locator('[data-canvas]').evaluateAll((els) => els.map((c) => ({
    id: c.dataset.canvas + '|' + c.closest('.theme').dataset.theme,
    backing: c.width, backingH: c.height, rendered: c.getBoundingClientRect().width, renderedH: c.getBoundingClientRect().height, dpr: c.dataset.canvas === 'layout3D' ? Math.max(2, Math.min(3, window.devicePixelRatio)) : window.devicePixelRatio,
  })));
  const at = async (w, before) => {
    await page.setViewportSize({ width: w, height: 900 });
    await expect.poll(async () => (await widths()).every((c, i) => Math.abs(c.backing - c.rendered * c.dpr) <= 1 && (!before || c.backing !== before[i].backing)), { message: `backing follows width at ${w}` }).toBe(true);
    return widths();
  };
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const wide = await at(1440), narrow = await at(700, wide);
  expect(wide.length, 'airy and layout3D, in two themes').toBe(4);
  wide.forEach((c, i) => {
    expect(c.backing, `${c.id} redrawn`).not.toBe(narrow[i].backing);
    if (!c.id.startsWith('layout3D')) expect(Math.abs(c.renderedH - c.rendered), `${c.id} square`).toBeLessThanOrEqual(1);
    else expect(Math.abs(c.renderedH / c.rendered - 320 / 560), 'layout3D aspect').toBeLessThan(0.01);
  });
  // A pixel-ratio change at the same CSS width redraws every canvas at the new ratio (#638).
  const cdp = await page.context().newCDPSession(page);
  // The height differs by 1 px: Chromium reports a pixel-ratio change to media queries only with a viewport change, and the width, which redraws the tiles by itself, stays.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 901, deviceScaleFactor: 2, mobile: false });
  await expect.poll(async () => (await widths()).every((c) => c.dpr === 2 && Math.abs(c.backing - c.rendered * c.dpr) <= 1), { message: 'backing follows the pixel ratio' }).toBe(true);
  // The airy image is radially symmetric: left/right and top/bottom halves match pixel for pixel, and every pixel is written (alpha 255).
  // Checked on the gallery's own (even) n and on a detached canvas with an odd n, where the middle row and column mirror onto themselves.
  const sym = await page.evaluate(() => {
    const check = (c) => {
      const n = c.width, d = c.getContext('2d').getImageData(0, 0, n, n).data;
      let bad = 0, unwritten = 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (d[(y * n + x) * 4 + 3] !== 255) unwritten++;
        for (let k = 0; k < 4; k++) {
          const a = d[(y * n + x) * 4 + k];
          if (a !== d[(y * n + (n - 1 - x)) * 4 + k] || a !== d[((n - 1 - y) * n + x) * 4 + k]) bad++;
        }
      }
      return { n, bad, unwritten };
    };
    const odd = document.createElement('canvas');
    airyTile(odd, 5);
    return { gallery: check(document.querySelector('[data-canvas="airy"]')), odd: check(odd) };
  });
  expect(sym.gallery.n, 'airy drawn').toBeGreaterThan(100);
  expect(sym.gallery.n % 2, 'gallery airy n is even').toBe(0);
  expect(sym.odd.n, 'odd airy n').toBe(5);
  for (const [k, r] of Object.entries(sym)) {
    expect(r.bad, `${k} airy mirror-symmetric`).toBe(0);
    expect(r.unwritten, `${k} airy has no unwritten pixel`).toBe(0);
  }
});

// Plan #677 (agent_docs/plans/677-gallery-polish.md), outcome O1 (issue #678; #683 unskips). The curve tiles key each curve in the SVG.
// Contract for the key items (#680, #681): every key entry's label is a <text data-key> in the figure's SVG.
// oracle: closed-form ADR-0003 (frameText above) for the key text size, within 1%, at 1440, 1100, 700 px and at each tile's --tile-min (as 'every tile at its minimum has the floor frame');
// fixture: the recorded achromat's three fields give the mtf tiles six keys (a tangential and a sagittal curve per field), field curvature two (tangential, sagittal), distortion one.
// Each key text is distinct, overlaps no other key text and no other text of the figure (axis labels, ticks), and stays inside the SVG unless it is alone on its line (bars' rule: a lone over-long entry may overrun).
// mtf-limits' vertical limit reads "50 cycles/mm".
const CURVE_KEYS = { mtf: 6, 'mtf-limits': 6, fieldCurvature: 2, distortion: 1 };
test('curve keys', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const measure = (theme) => page.evaluate(([th, names]) => names.map((name) => {
    const tile = document.querySelector(`.theme[data-theme="${th}"] [data-tile="${name}"]`);
    const svg = tile.querySelector('.eleo-plot__body svg');
    const frame = svg.querySelector('rect[stroke="var(--plot-grid)"]');
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const keys = [...svg.querySelectorAll('text[data-key]')];
    return {
      tile: name, F: frame.getBoundingClientRect().width + (frame.getAttribute('rx') === '3' ? 1 : 0), svg: box(svg), frame: box(frame),
      keys: keys.map((k) => ({ text: k.textContent, size: parseFloat(getComputedStyle(k).fontSize) * k.getScreenCTM().a, ...box(k) })),
      others: [...svg.querySelectorAll('text:not([data-key])')].map((x) => ({ text: x.textContent, ...box(x) })),
    };
  }), [theme, Object.keys(CURVE_KEYS)]);
  const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
  const check = (rows, at) => {
    for (const r of rows) {
      const w = `${at} ${r.tile}`;
      expect(r.keys.length, `${w} keys`).toBe(CURVE_KEYS[r.tile]);
      expect(new Set(r.keys.map((k) => k.text)).size, `${w} each label once`).toBe(r.keys.length);
      for (const k of r.keys) expect(Math.abs(k.size / frameText(r.F) - 1), `${w} key "${k.text}" ${k.size}px against ${frameText(r.F)}px`).toBeLessThanOrEqual(0.01);
      if (r.tile === 'distortion') for (const k of r.keys) {
        expect(k.l, `${w} corner key "${k.text}" inside the plot frame on the left`).toBeGreaterThanOrEqual(r.frame.l - 0.5);
        expect(k.r, `${w} corner key "${k.text}" inside the plot frame on the right`).toBeLessThanOrEqual(r.frame.r + 0.5);
        expect(k.t, `${w} corner key "${k.text}" inside the plot frame at the top`).toBeGreaterThanOrEqual(r.frame.t - 0.5);
        expect(k.b, `${w} corner key "${k.text}" inside the plot frame at the bottom`).toBeLessThanOrEqual(r.frame.b + 0.5);
      }
      r.keys.forEach((k, i) => {
        for (const o of [...r.keys.slice(i + 1), ...r.others]) expect(overlap(k, o), `${w} key "${k.text}" overlaps "${o.text}"`).toBe(false);
        const alone = r.keys.filter((o) => o !== k && Math.abs(o.t - k.t) < 1).length === 0;
        if (!alone) expect(k.r, `${w} key "${k.text}" inside the SVG`).toBeLessThanOrEqual(r.svg.r + 0.5);
        expect(k.l, `${w} key "${k.text}" inside the SVG on the left`).toBeGreaterThanOrEqual(r.svg.l - 0.5);
      });
    }
  };
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 1100, 700]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      check(await measure(theme), `${theme} ${width}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate((names) => document.querySelectorAll('.theme > [data-tile][data-size]').forEach((el) => {
    if (names.includes(el.dataset.tile)) el.style.maxWidth = `${parseFloat(el.style.getPropertyValue('--tile-min')) || 240}px`;
  }), Object.keys(CURVE_KEYS));
  await settle(page);
  for (const theme of ['light', 'dark']) check(await measure(theme), `${theme} at minWidth`);
  for (const theme of ['light', 'dark']) {
    const texts = await page.locator(`.theme[data-theme="${theme}"] [data-tile="mtf-limits"] .eleo-plot__body svg text`).allTextContents();
    expect(texts, `${theme} mtf-limits x limit label`).toContain('50 cycles/mm');
  }
});

// Plan #677 (agent_docs/plans/677-gallery-polish.md), outcome O2 (issue #684; #689 unskips). The footprint, recorded TRA and OPD tiles key in the SVG, with no HTML footer.
// Contract: every key entry's label is a <text data-key> in the figure's SVG (as in 'curve keys').
// oracle: closed-form ADR-0003 (frameText above) for the key text size, within 1%, at 1440, 1100, 700 px and at each tile's --tile-min;
// fixture: cooke-footprint.json's sources[].fieldAngleDeg (0, 17, 24) read "F1 0.0°", "F2 17.0°", "F3 24.0°";
// fixture: achromat-fans.json's sources[0].wavelengths (486.133, 587.562, 656.272 nm) key the TRA fans as "486.1 nm", "587.6 nm", "656.3 nm";
// sample.json wl (486.1327, 587.5618, 656.2725 nm) key the OPD fans the same way.
// No key text overlaps another key or any other text of the figure (captions, axis labels), stays inside the SVG unless alone on its line, and no tile has an .eleo-plot__ft.
const FAN_FOOT_KEYS = {
  footprint: ['F1 0.0°', 'F2 17.0°', 'F3 24.0°'],
  rayFan: ['486.1 nm', '587.6 nm', '656.3 nm'],
  'rayFan-opd': ['486.1 nm', '587.6 nm', '656.3 nm'],
};
test('fan and footprint keys', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const measure = (theme) => page.evaluate(([th, names]) => names.map((name) => {
    const tile = document.querySelector(`.theme[data-theme="${th}"] [data-tile="${name}"]`);
    const svg = tile.querySelector('.eleo-plot__body svg');
    const frame = svg.querySelector('rect[stroke="var(--plot-grid)"]');
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const keys = [...svg.querySelectorAll('text[data-key]')];
    return {
      tile: name, F: frame.getBoundingClientRect().width + (frame.getAttribute('rx') === '3' ? 1 : 0), svg: box(svg),
      footers: tile.querySelectorAll('.eleo-plot__ft').length,
      keys: keys.map((k) => ({ text: k.textContent, size: parseFloat(getComputedStyle(k).fontSize) * k.getScreenCTM().a, ...box(k) })),
      others: [...svg.querySelectorAll('text:not([data-key])')].map((x) => ({ text: x.textContent, ...box(x) })),
    };
  }), [theme, Object.keys(FAN_FOOT_KEYS)]);
  const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
  const check = (rows, at) => {
    for (const r of rows) {
      const w = `${at} ${r.tile}`;
      expect(r.footers, `${w} has no footer`).toBe(0);
      expect(r.keys.map((k) => k.text), `${w} keys`).toEqual(FAN_FOOT_KEYS[r.tile]);
      for (const k of r.keys) expect(Math.abs(k.size / frameText(r.F) - 1), `${w} key "${k.text}" ${k.size}px against ${frameText(r.F)}px`).toBeLessThanOrEqual(0.01);
      r.keys.forEach((k, i) => {
        for (const o of [...r.keys.slice(i + 1), ...r.others]) expect(overlap(k, o), `${w} key "${k.text}" overlaps "${o.text}"`).toBe(false);
        const alone = r.keys.filter((o) => o !== k && Math.abs(o.t - k.t) < 1).length === 0;
        if (!alone) expect(k.r, `${w} key "${k.text}" inside the SVG`).toBeLessThanOrEqual(r.svg.r + 0.5);
        expect(k.l, `${w} key "${k.text}" inside the SVG on the left`).toBeGreaterThanOrEqual(r.svg.l - 0.5);
      });
    }
  };
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 1100, 700]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      check(await measure(theme), `${theme} ${width}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate((names) => document.querySelectorAll('.theme > [data-tile][data-size]').forEach((el) => {
    if (names.includes(el.dataset.tile)) el.style.maxWidth = `${parseFloat(el.style.getPropertyValue('--tile-min')) || 240}px`;
  }), Object.keys(FAN_FOOT_KEYS));
  await settle(page);
  for (const theme of ['light', 'dark']) check(await measure(theme), `${theme} at minWidth`);
  // #774 (CR #768): every spot and footprint panel draws [data-grid] paths before its first series path.
  for (const theme of ['light', 'dark']) {
    const rows = await page.evaluate(([th, names]) => names.map((name) => {
      const svg = document.querySelector(`.theme[data-theme="${th}"] [data-tile="${name}"] .eleo-plot__body svg`);
      const panels = [...svg.querySelectorAll('svg')].filter((p) => p.querySelector('path[stroke^="var(--series-"]'));
      return {
        tile: name, panels: panels.length,
        // a panel's horizontal grid lines start at its x and sit before it in the parent
        gridFirst: panels.map((p) => {
          const before = [];
          for (let e = p.previousElementSibling; e; e = e.previousElementSibling) before.push(e);
          return before.some((e) => e.hasAttribute('data-grid') && e.getAttribute('d').startsWith(`M${+p.getAttribute('x')},`) && / H/.test(e.getAttribute('d')));
        }),
      };
    }), [theme, ['spot', 'footprint']]);
    for (const r of rows) {
      expect(r.panels, `${theme} ${r.tile} has panels`).toBeGreaterThan(0);
      expect(r.gridFirst, `${theme} ${r.tile} grid before the series, per panel`).toEqual(r.gridFirst.map(() => true));
    }
  }
});

// Plan #677 (agent_docs/plans/677-gallery-polish.md), outcome O4 (issue #690; #696 unskips). layout3D paints the rays over the image plane they end on.
// oracle: user request 9 (rays over the plane they end on); property: the --mech pixels with rays are a strict subset of those without (rays: false), in both themes, in the default iso view.
test('layout3D rays over the image plane', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const r = await page.locator(`.theme[data-theme="${theme}"] [data-tile="layout3D"] .eleo-plot__body`).evaluate((body) => {
      const mech = (() => { const p = document.createElement('canvas').getContext('2d'); p.fillStyle = window.ELEO.css(body, 'mech'); p.fillRect(0, 0, 1, 1); return [...p.getImageData(0, 0, 1, 1).data.slice(0, 3)]; })();
      const planePixels = (o) => {
        const c = document.createElement('canvas');
        body.appendChild(c);
        window.ELEO.layout3D(c, o);
        const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height), on = new Set();
        for (let i = 0; i < data.length; i += 4) if (data[i] === mech[0] && data[i + 1] === mech[1] && data[i + 2] === mech[2]) on.add(i / 4);
        c.remove();
        return on;
      };
      const bare = planePixels({ rays: false }), withRays = planePixels({});
      return { bare: bare.size, withRays: withRays.size, outside: [...withRays].filter((p) => !bare.has(p)).length };
    });
    expect(r.bare, `${theme} the plane is drawn`).toBeGreaterThan(0);
    expect(r.outside, `${theme} --mech pixels with rays that the bare plane lacks`).toBe(0);
    expect(r.withRays, `${theme} rays cover part of the plane`).toBeLessThan(r.bare);
  }
});

// Plan #677 M3, #694: the sample canvas psf and wavefront tiles are gone; the linear recorded PSF has a colorbar labelled "Intensity, relative"; no map tile draws a grid (CR #779).
// oracle: spec (user, round 1: drop the two tiles; the log tile's colorbar is the model for the linear one); a tile that asks for no grid draws no line in a map grid token, minors included (CR #767, #779).
test('map tiles', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    const col = page.locator(`.theme[data-theme="${theme}"]`);
    await expect(col.locator('[data-tile="psf"], [data-tile="wavefront"], [data-canvas="psf"], [data-canvas="wavefront"]'), `${theme} sample canvas map tiles`).toHaveCount(0);
    const tile = (name) => col.locator(`[data-tile="${name}"]`).evaluate((el) => {
      const svg = el.querySelector('svg');
      return { images: svg.querySelectorAll('image').length, text: svg.textContent, lines: svg.querySelectorAll('line[stroke^="var(--map-grid-"]').length };
    });
    const lin = await tile('psf-recorded');
    expect(lin.images, `${theme} linear PSF image and colorbar`).toBe(2);
    expect(lin.text, `${theme} linear PSF colorbar label`).toContain('Intensity, relative');
    for (const name of ['psf-recorded', 'psf-log', 'wavefront-recorded', 'irradiance-gaussian']) expect((await tile(name)).lines, `${theme} ${name} asks for no grid (CR #779)`).toBe(0);
  }
});
