// map2D (plan #389). Run after `npm run build`.
// oracle: fixture phos-core PointSpread recorded by scripts/record-phos-core.py; sample canvas PNGs recorded by scripts/record-map2d-baseline.mjs
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

// O3: the sample call draws what it drew at the plan's base. oracle: fixture, sample canvas PNGs recorded by
// scripts/record-map2d-baseline.mjs from main's build at the plan's base.
test('sample call unchanged', async ({ page }) => {
  const baseline = fixture('map2d-baseline.json');
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) for (const kind of ['psf', 'wavefront']) {
    const png = await page.locator(`.theme[data-theme="${theme}"] [data-canvas="${kind}"]`).evaluate((c) => c.toDataURL('image/png'));
    expect(png === baseline[`${kind}-${theme}`], `${kind} in ${theme} differs from the recording`).toBe(true);
  }
});

// #394: the typed map's frame and image. oracle: closed-form, a 4 x 2 grid over [-0.02, 0.02] x [-0.01, 0.01] mm: the
// image is twice as wide as tall, px per mm equal on both axes, centred in the frame, row 0 at the top, masked cell alpha 0.
test('typed map places its extent', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.locator('.theme[data-theme="light"]').evaluate(async (el) => {
    const values = [[0, 1, 2, 3], [null, 1, 2, 4]];
    el.insertAdjacentHTML('beforeend', window.ELEO.map2D({ values, extent: [-0.02, 0.02, -0.01, 0.01], x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, map: 'ember', el }));
    const svg = el.lastElementChild, imgs = svg.querySelectorAll('image'), img = imgs[0];
    const bitmap = await createImageBitmap(await (await fetch(img.getAttribute('href'))).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height), g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const px = g.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const frame = svg.querySelector('rect').getBoundingClientRect(), b = img.getBoundingClientRect();
    const lut = window.ELEO.colormap('ember', el);
    return { viewBox: svg.getAttribute('viewBox'), label: svg.getAttribute('aria-label'), n: imgs.length, style: img.getAttribute('style'),
      w: b.width, h: b.height, left: b.left - frame.left, right: frame.right - b.right, top: b.top - frame.top, bottom: frame.bottom - b.bottom,
      bw: bitmap.width, bh: bitmap.height, maskedAlpha: px[(1 * 4 + 0) * 4 + 3], topLeft: [px[0], px[1], px[2], px[3]], expect0: lut[0], topRight: [px[28], px[29], px[30]], expect3: lut[255], text: svg.textContent };
  });
  expect(r.viewBox).toBe('0 0 460 360');
  expect(r.label).toBe('Map');
  expect(r.n).toBe(1);
  expect(r.style).toContain('image-rendering: pixelated');
  expect([r.bw, r.bh]).toEqual([4, 2]);
  expect(Math.abs(r.w / r.h - 2)).toBeLessThan(0.01);
  expect(Math.abs(r.left - r.right)).toBeLessThan(0.5);
  expect(Math.abs(r.top - r.bottom)).toBeLessThan(0.5);
  expect(Math.min(r.left, r.top)).toBeGreaterThanOrEqual(-0.5);
  expect(r.maskedAlpha).toBe(0);
  expect(r.topLeft[3]).toBe(255);
  expect(r.topLeft.slice(0, 3).map(Math.round)).toEqual(r.expect0.map(Math.round));
  expect(r.topRight.map(Math.round)).toEqual(r.expect3.map(Math.round));
  expect(r.text).toContain('mm');
});

// #418 (CR #416): given x.ticks and y.ticks are drawn. oracle: closed-form, ticks [-0.5, 0.5] over [-1, 1] print exactly those labels.
test('typed map draws given ticks', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.locator('.theme[data-theme="light"]').evaluate((el) => {
    el.insertAdjacentHTML('beforeend', window.ELEO.map2D({ values: [[1]], extent: [-1, 1, -1, 1], x: { ticks: [-0.5, 0.5] }, y: { ticks: [0.25] } }));
    return [...el.lastElementChild.querySelectorAll('text.eleo-tick')].map((t) => t.textContent.trim().replace('\u2212', '-'));
  });
  expect(r).toContain('-0.5');
  expect(r).toContain('0.5');
  expect(r).toContain('0.25');
  expect(r).not.toContain('0');
  expect(r).not.toContain('1');
});

// #419 (review M1 round 1): the typed map refuses an empty, ragged or reversed grid with a TypeError naming it.
test('typed map refuses bad grids', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(() => {
    const err = (o) => { try { window.ELEO.map2D(o); return null; } catch (e) { return e instanceof TypeError ? e.message : 'not a TypeError: ' + e.name; } };
    return { empty: err({ values: [], extent: [0, 1, 0, 1] }), emptyRow: err({ values: [[]], extent: [0, 1, 0, 1] }), ragged: err({ values: [[0, 1], [2, 3, 4]], extent: [0, 1, 0, 1] }),
      revX: err({ values: [[1]], extent: [1, 0, 0, 1] }), revY: err({ values: [[1]], extent: [0, 1, 1, 0] }), ok: err({ values: [[1]], extent: [0, 1, 0, 1] }) };
  });
  expect(r.empty).toMatch(/^map2D: values/);
  expect(r.emptyRow).toMatch(/^map2D: values/);
  expect(r.ragged).toMatch(/^map2D: .*same length/);
  expect(r.revX).toMatch(/^map2D: extent/);
  expect(r.revY).toMatch(/^map2D: extent/);
  expect(r.ok).toBe(null);
});

// O1: the typed map places the recorded Cooke PSF. oracle: fixture, phos-core PointSpread recorded by
// scripts/record-phos-core.py (roadmap U8).
test('recorded PSF cells (U8)', async ({ page }) => {
  const psf = fixture('phos-core/cooke-psf.json');
  const MASK = [[10, 20], [100, 37]];
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const drawn = {};
  for (const theme of ['light', 'dark']) {
    const sel = `.theme[data-theme="${theme}"]`;
    // Draw the recorded grid, and a copy with two cells masked, into the theme column.
    const r = await page.locator(sel).evaluate(async (el, p) => {
      const ELEO = window.ELEO;
      const props = (values) => ({ values, extent: p.extent, x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, map: 'ember', el });
      el.insertAdjacentHTML('beforeend', ELEO.map2D(props(p.values)));
      const svg = el.lastElementChild, img = svg.querySelector('image');
      const bitmap = await createImageBitmap(await (await fetch(img.getAttribute('href'))).blob());
      const c = new OffscreenCanvas(bitmap.width, bitmap.height), g = c.getContext('2d');
      g.drawImage(bitmap, 0, 0);
      const px = Array.from(g.getImageData(0, 0, bitmap.width, bitmap.height).data);
      const lut = ELEO.colormap('ember', el);
      const flat = p.values.flat().filter((v) => v !== null && !Number.isNaN(v));
      const lo = Math.min(...flat), hi = Math.max(...flat);
      const steps = p.values.map((row) => row.map((v) => Math.round(((v - lo) / (hi - lo)) * 255)));
      const box = img.getBoundingClientRect(), frame = svg.querySelector('rect').getBoundingClientRect(), [x0, x1, y0, y1] = p.extent;
      // The masked copy: tagged so the page can be screenshotted at its cells.
      const copy = p.values.map((row) => row.slice());
      p.mask.forEach(([r, k]) => { copy[r][k] = null; });
      // In a plot tile, as the gallery draws it, so the page behind the image is the tile's --surface.
      el.insertAdjacentHTML('beforeend', '<section class="eleo-plot" data-masked-copy><div class="eleo-plot__body"></div></section>');
      const tile = el.lastElementChild;
      tile.firstElementChild.innerHTML = ELEO.map2D({ ...props(copy), el: tile });
      const msvg = tile.querySelector('svg');
      const mimg = msvg.querySelector('image');
      const mb = await createImageBitmap(await (await fetch(mimg.getAttribute('href'))).blob());
      const mc = new OffscreenCanvas(mb.width, mb.height), mg = mc.getContext('2d');
      mg.drawImage(mb, 0, 0);
      const mpx = mg.getImageData(0, 0, mb.width, mb.height).data;
      const maskedAlpha = p.mask.map(([r, k]) => mpx[(r * mb.width + k) * 4 + 3]);
      const surf = new OffscreenCanvas(1, 1).getContext('2d');
      surf.fillStyle = getComputedStyle(tile).getPropertyValue('--surface').trim(); surf.fillRect(0, 0, 1, 1);
      return {
        bw: bitmap.width, bh: bitmap.height, px, lut, steps, maskedAlpha, surface: Array.from(surf.getImageData(0, 0, 1, 1).data),
        w: box.width, h: box.height, left: box.left - frame.left, right: frame.right - box.right, top: box.top - frame.top, bottom: frame.bottom - box.bottom,
        fw: frame.width, fh: frame.height, dx: x1 - x0, dy: y1 - y0,
      };
    }, { ...psf, mask: MASK });
    drawn[theme] = r;

    // Composited page: screenshot the masked copy's masked cells and compare to --surface.
    const pts = await page.locator(`${sel} [data-masked-copy] image`).evaluate(async (img, a) => {
      img.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const b = img.getBoundingClientRect();
      return a.mask.map(([r, k]) => ({ x: b.left + (k + 0.5) * b.width / a.n, y: b.top + (r + 0.5) * b.height / a.n, cw: b.width / a.n }));
    }, { mask: MASK, n: psf.values.length });
    for (const pt of pts) {
      expect(pt.cw, `${theme} a cell is at least 2 px wide on the page`).toBeGreaterThanOrEqual(2);
      const shot = await page.screenshot({ clip: { x: Math.floor(pt.x), y: Math.floor(pt.y), width: 1, height: 1 } });
      const rgb = await page.evaluate(async (b64) => {
        const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
        const g = new OffscreenCanvas(bm.width, bm.height).getContext('2d'); g.drawImage(bm, 0, 0);
        return Array.from(g.getImageData(0, 0, 1, 1).data).slice(0, 3);
      }, shot.toString('base64'));
      expect(rgb.map((v, i) => Math.abs(v - r.surface[i])).every((d) => d <= 1), `${theme} masked cell on the page ${rgb} vs --surface ${r.surface.slice(0, 3)}`).toBe(true);
    }
  }

  for (const theme of ['light', 'dark']) {
    const r = drawn[theme];
    // Grid decoded cell for cell: row 0 at the top, each pixel its value's step in the theme's colormap.
    expect([r.bw, r.bh], `${theme} one image pixel per cell`).toEqual([psf.values[0].length, psf.values.length]);
    let wrong = 0;
    r.steps.forEach((row, j) => row.forEach((s, k) => {
      const o = (j * r.bw + k) * 4, c = r.lut[s];
      if (r.px[o + 3] !== 255 || Math.abs(r.px[o] - c[0]) > 1 || Math.abs(r.px[o + 1] - c[1]) > 1 || Math.abs(r.px[o + 2] - c[2]) > 1) wrong++;
    }));
    expect(wrong, `${theme} cells off their step`).toBe(0);
    expect(r.maskedAlpha, `${theme} masked cells are alpha 0`).toEqual(MASK.map(() => 0));
    // px per mm equal on x and y: the difference over the image's size is under 0.5 px.
    const ppmX = r.w / r.dx, ppmY = r.h / r.dy;
    expect(Math.abs(ppmX - ppmY) * Math.max(r.dx, r.dy), `${theme} px per mm`).toBeLessThan(0.5);
    // The extent fills the plot area on its longer side and is centred on the other, within 0.5 px.
    expect(Math.min(r.left, r.right, r.top, r.bottom), `${theme} image inside the frame`).toBeGreaterThanOrEqual(-0.5);
    expect(Math.abs(r.left - r.right), `${theme} centred in x`).toBeLessThan(0.5);
    expect(Math.abs(r.top - r.bottom), `${theme} centred in y`).toBeLessThan(0.5);
    expect(Math.min(r.left, r.top), `${theme} one axis fills the plot area`).toBeLessThan(0.5);
  }

  // The columns' images differ exactly where their tokens do.
  const L = drawn.light, D = drawn.dark;
  let differ = 0, tokenDiffer = 0, mismatch = 0;
  L.steps.forEach((row, j) => row.forEach((s, k) => {
    const o = (j * L.bw + k) * 4;
    const img = [0, 1, 2].some((i) => Math.abs(L.px[o + i] - D.px[o + i]) > 1);
    const tok = [0, 1, 2].some((i) => Math.abs(L.lut[s][i] - D.lut[s][i]) > 1);
    if (img) differ++;
    if (tok) tokenDiffer++;
    if (img !== tok) mismatch++;
  }));
  expect(tokenDiffer, 'the two themes colour some cells differently').toBeGreaterThan(0);
  expect(differ, 'light and dark images differ').toBeGreaterThan(0);
  expect(mismatch, 'cells where image difference disagrees with token difference').toBe(0);
});
