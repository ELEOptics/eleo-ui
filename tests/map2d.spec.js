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

// #420 (review M1 round 1): the margin follows the padded ticks. oracle: closed form, a label of n characters centred at x ends at x + 3n (6 px a character).
test('padded x ticks stay inside the viewBox', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.locator('.theme[data-theme="light"]').evaluate((el) => {
    el.insertAdjacentHTML('beforeend', window.ELEO.map2D({ values: [[1]], extent: [9000000, 9900000, 0, 10000000], x: { ticks: [9000000, 15950000] } }));
    const svg = el.lastElementChild, W = +svg.getAttribute('viewBox').split(' ')[2];
    return [...svg.querySelectorAll('text.eleo-tick')].map((t) => ({ t: t.textContent, edge: +t.getAttribute('x') + 3 * [...t.textContent].length, W }));
  });
  const last = r.find((q) => q.t.includes('1595'));
  expect(last).toBeTruthy();
  expect(last.edge).toBeLessThanOrEqual(last.W);
});

// #427 (review M1 round 2): the margin loop re-pads after it grows. oracle: closed form, the image spans the extent, so its width/height is dx/dy
// (px per unit equal on both axes), it stays inside the frame and is centred in it (the extent is padded for the final plot width). Extent [9e6, 9.9e6] x [0, 1e7] grows the margin.
test('margin growth re-pads: image stays centred', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.locator('.theme[data-theme="light"]').evaluate((el) => {
    el.insertAdjacentHTML('beforeend', window.ELEO.map2D({ values: [[1]], extent: [9000000, 9900000, 0, 10000000] }));
    const svg = el.lastElementChild, img = svg.querySelector('image').getBoundingClientRect(), f = svg.querySelector('rect').getBoundingClientRect();
    return { w: img.width, h: img.height, left: img.left - f.left, right: f.right - img.right, top: img.top - f.top, bottom: f.bottom - img.bottom };
  });
  expect(Math.abs(r.left - r.right)).toBeLessThan(0.5);
  expect(Math.abs(r.w - r.h * 0.09)).toBeLessThan(0.5);
  expect(Math.min(r.left, r.right, r.top, r.bottom)).toBeGreaterThanOrEqual(-0.5);
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

// #414 (CR #410): polar samples fill their annular sectors. oracle: closed-form, 3 rings at r = 1, 2, 3 and 4 spokes at 0, 90, 180, 270 deg
// with value 4 * ring + spoke on [0, 11]: sector edges at r = 1.5, 2.5 (first from 0, last at 3.5) and at 45 deg + k * 90 deg; a pixel there is
// step round(255 * v / 11), a pixel beyond r = 3.5 is alpha 0. Pixels within 1.5 px of an edge are not checked.
test('polar samples fill their sectors', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.locator('.theme[data-theme="light"]').evaluate(async (el) => {
    const radii = [1, 2, 3], angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2], values = radii.map((_, i) => angles.map((_, k) => 4 * i + k));
    el.insertAdjacentHTML('beforeend', window.ELEO.map2D({ values, polar: { radii, angles }, extent: [-4, 4, -4, 4], map: 'ember', el }));
    const svg = el.lastElementChild, imgs = svg.querySelectorAll('image'), img = imgs[0];
    const bm = await createImageBitmap(await (await fetch(img.getAttribute('href'))).blob());
    const g = new OffscreenCanvas(bm.width, bm.height).getContext('2d'); g.drawImage(bm, 0, 0);
    const px = g.getImageData(0, 0, bm.width, bm.height).data, lut = window.ELEO.colormap('ember', el);
    const pu = 8 / bm.width, b = img.getBoundingClientRect(), frame = svg.querySelector('rect').getBoundingClientRect();
    let checked = 0, wrong = 0, outside = 0, outsideWrong = 0;
    for (let j = 0; j < bm.height; j++) for (let i = 0; i < bm.width; i++) {
      const x = -4 + (i + 0.5) * pu, y = 4 - (j + 0.5) * pu, rr = Math.hypot(x, y), o = (j * bm.width + i) * 4;
      if (rr > 3.5 + 1.5 * pu) { outside++; if (px[o + 3] !== 0) outsideWrong++; continue; }
      const th = Math.atan2(y, x), k = Math.round((th < 0 ? th + 2 * Math.PI : th) / (Math.PI / 2)) % 4;
      const edgeA = Math.abs(((th < 0 ? th + 2 * Math.PI : th) % (Math.PI / 2)) - Math.PI / 4) * rr;
      if (Math.min(Math.abs(rr - 1.5), Math.abs(rr - 2.5), Math.abs(rr - 3.5), edgeA) < 1.5 * pu) continue;
      const ring = rr < 1.5 ? 0 : rr < 2.5 ? 1 : 2, c = lut[Math.round(255 * (4 * ring + k) / 11)];
      checked++;
      if (px[o + 3] !== 255 || [0, 1, 2].some((q) => Math.abs(px[o + q] - c[q]) > 1)) wrong++;
    }
    return { n: imgs.length, bw: bm.width, bh: bm.height, checked, wrong, outside, outsideWrong, w: b.width, h: b.height, fw: frame.width, fh: frame.height };
  });
  expect(r.n, 'one image').toBe(1);
  expect(r.checked, 'sector pixels checked').toBeGreaterThan(500);
  expect(r.wrong, 'sector pixels off their step').toBe(0);
  expect(r.outside, 'pixels beyond the outer edge').toBeGreaterThan(100);
  expect(r.outsideWrong, 'pixels beyond the outer edge are alpha 0').toBe(0);
  expect(r.bw, 'bitmap within the plot area px').toBeLessThanOrEqual(Math.ceil(r.w));
  expect(r.bh).toBeLessThanOrEqual(Math.ceil(r.h));
});

// #414: polar samples must be one row per radius and one value per angle, else a TypeError.
test('typed map refuses bad polar samples', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(() => {
    const err = (o) => { try { window.ELEO.map2D({ extent: [-1, 1, -1, 1], ...o }); return null; } catch (e) { return e instanceof TypeError ? e.message : 'not a TypeError: ' + e.name; } };
    const polar = { radii: [1, 2], angles: [0, 1, 2] };
    return { rows: err({ values: [[1, 2, 3]], polar }), cols: err({ values: [[1, 2], [3, 4]], polar }), radii: err({ values: [[1, 2, 3], [4, 5, 6]], polar: { radii: [2, 1], angles: polar.angles } }),
      angles: err({ values: [[1], [4]], polar: { radii: [1, 2], angles: [NaN] } }), ok: err({ values: [[1, 2, 3], [4, 5, 6]], polar }) };
  });
  for (const k of ['rows', 'cols', 'radii', 'angles']) expect(r[k], k).toMatch(/^map2D: polar/);
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

// ---- O2 (plan #389, M2): scales, aperture, colorbar, wavefront.
// The props `polar`, `scale`, `decades`, `range`, `aperture`, `value` and the colorbar are the plan's described shapes (#393, #398-#400, #413):
//  - `polar: { radii, angles }`: `values[ring][spoke]` are samples about the extent's origin; angles in radians from +x, counter-clockwise, y up.
//  - the grid is the largest `<image>` in the SVG (the colorbar's is 1 x 256) and covers the extent, row 0 at the top.
//  - colorbar ticks are `text.eleo-tick` right of the colorbar `<image>`; each tick's `y` attribute is its position, as in curve.js.
// Helpers run in the page: `window.__o2.decode(image)` -> { w, h, px }; `window.__o2.grid(svg)` -> the grid's decoded pixels.
const o2Helpers = () => {
  const decode = async (img) => {
    const bm = await createImageBitmap(await (await fetch(img.getAttribute('href'))).blob());
    const g = new OffscreenCanvas(bm.width, bm.height).getContext('2d');
    g.drawImage(bm, 0, 0);
    return { w: bm.width, h: bm.height, px: Array.from(g.getImageData(0, 0, bm.width, bm.height).data) };
  };
  const grid = async (svg) => {
    const all = await Promise.all([...svg.querySelectorAll('image')].map(async (img) => ({ img, ...(await decode(img)) })));
    return all.sort((a, b) => b.w * b.h - a.w * a.h)[0];
  };
  const tile = (el) => {
    el.insertAdjacentHTML('beforeend', '<section class="eleo-plot"><div class="eleo-plot__body"></div></section>');
    return el.lastElementChild;
  };
  window.__o2 = { decode, grid, tile };
};

// O2, wavefront: the typed map draws the recorded Cooke WavefrontError (polar samples, CR #410). oracle: fixture, phos-core WavefrontError
// recorded by scripts/record-phos-core.py (64 rings x 64 spokes) (roadmap U8). Each sample's annular sector (edges midway between neighbouring
// radii and spokes) is its value's step on [-m, m], m = max |value|; every pixel outside the aperture circle is --surface on the page.
test('recorded wavefront cells (U8)', async ({ page }) => {
  const wf = fixture('phos-core/cooke-wavefront.json');
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(o2Helpers);
  for (const theme of ['light', 'dark']) {
    const sel = `.theme[data-theme="${theme}"]`;
    const E = wf.pupilRadius * 1.25;
    const r = await page.locator(sel).evaluate(async (el, p) => {
      const ELEO = window.ELEO, { grid, tile } = window.__o2;
      const t = tile(el);
      const [x0, x1, y0, y1] = p.extent;
      t.firstElementChild.innerHTML = ELEO.map2D({ values: p.values, polar: { radii: p.radii, angles: p.angles }, extent: p.extent, map: 'wave',
        aperture: { x: 0, y: 0, r: p.pupilRadius }, x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, el: t });
      const svg = t.querySelector('svg'), G = await grid(svg), lut = ELEO.colormap('wave', t);
      const m = Math.max(...p.values.flat().map(Math.abs));
      const step = (v) => Math.round(((v + m) / (2 * m)) * 255);
      const pu = (x1 - x0) / G.w, diag = 1.5 * pu, TAU = 2 * Math.PI;
      const circ = (a, b) => { const d = Math.abs(a - b) % TAU; return Math.min(d, TAU - d); };
      let checked = 0, wrong = 0;
      for (let j = 0; j < G.h; j++) for (let i = 0; i < G.w; i++) {
        const x = x0 + (i + 0.5) * pu, y = y1 - (j + 0.5) * pu, rr = Math.hypot(x, y);
        if (rr > p.radii[p.radii.length - 1]) continue; // the inner disc is ring 0 (#414)
        const dr = p.radii.map((q, k) => [Math.abs(q - rr), k]).sort((a, b) => a[0] - b[0]);
        if (dr[1][0] - dr[0][0] < diag) continue;
        const th = Math.atan2(y, x), da = p.angles.map((q, k) => [circ(q, th), k]).sort((a, b) => a[0] - b[0]);
        if ((da[1][0] - da[0][0]) * rr < diag) continue;
        checked++;
        const c = lut[step(p.values[dr[0][1]][da[0][1]])], o = (j * G.w + i) * 4;
        if (G.px[o + 3] !== 255 || [0, 1, 2].some((k) => Math.abs(G.px[o + k] - c[k]) > 1)) wrong++;
      }
      const surf = new OffscreenCanvas(1, 1).getContext('2d');
      surf.fillStyle = getComputedStyle(t).getPropertyValue('--surface').trim(); surf.fillRect(0, 0, 1, 1);
      t.setAttribute('data-wavefront', '');
      const b = G.img.getBoundingClientRect();
      return { checked, wrong, surface: Array.from(surf.getImageData(0, 0, 1, 1).data).slice(0, 3), box: { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height } };
    }, { ...wf, extent: [-E, E, -E, E] });
    expect(r.checked, `${theme} sectors checked`).toBeGreaterThan(1000);
    expect(r.wrong, `${theme} sector pixels off their step`).toBe(0);

    // Composited page: every pixel outside the circle (and clear of the 1 px ring) is --surface.
    await page.locator(`${sel} [data-wavefront] image`).first().scrollIntoViewIfNeeded();
    const b = await page.locator(`${sel} [data-wavefront] image`).first().boundingBox();
    const shot = await page.screenshot({ clip: { x: Math.floor(b.x), y: Math.floor(b.y), width: Math.ceil(b.width) + 1, height: Math.ceil(b.height) + 1 } });
    const out = await page.evaluate(async (a) => {
      const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + a.b64)).blob());
      const g = new OffscreenCanvas(bm.width, bm.height).getContext('2d'); g.drawImage(bm, 0, 0);
      const d = g.getImageData(0, 0, bm.width, bm.height).data, cx = a.cx - a.ox, cy = a.cy - a.oy;
      let n = 0, bad = 0;
      for (let j = 0; j < bm.height; j++) for (let i = 0; i < bm.width; i++) {
        if (Math.hypot(i + 0.5 - cx, j + 0.5 - cy) < a.rpx + 2) continue;
        if (Math.min(i, j, bm.width - 1 - i, bm.height - 1 - j) < 2) continue; // the plot frame's 1 px stroke and the clip's rounding
        n++;
        if ([0, 1, 2].some((k) => Math.abs(d[(j * bm.width + i) * 4 + k] - a.surface[k]) > 1)) bad++;
      }
      return { n, bad };
    }, { b64: shot.toString('base64'), surface: r.surface, ox: Math.floor(b.x), oy: Math.floor(b.y), cx: b.x + b.width / 2, cy: b.y + b.height / 2, rpx: (wf.pupilRadius / (2 * E)) * b.width });
    expect(out.n, `${theme} pixels outside the circle`).toBeGreaterThan(100);
    expect(out.bad, `${theme} pixels outside the circle that are not --surface`).toBe(0);
  }
});

// O2, log: given values 10^-k on a D-decade log scale, each draws step (D - k)/D; values at or below 10^-D of the max (zeros, negatives included)
// draw step 0. oracle: property, log steps over a 32 x 32 grid cycling k = 0..5, 0 and -1 (max 1), at the default D = 4 and at decades: 2.
test('log decades', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(o2Helpers);
  const r = await page.locator('.theme[data-theme="light"]').evaluate(async (el) => {
    const ELEO = window.ELEO, { grid } = window.__o2, lut = ELEO.colormap('ember', el);
    const pool = [1, 1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 0, -1], ks = [0, 1, 2, 3, 4, 5, Infinity, Infinity];
    const n = 32, values = Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => pool[(j * n + i) % pool.length]));
    const out = {};
    for (const D of [undefined, 2]) {
      const dec = D ?? 4;
      el.insertAdjacentHTML('beforeend', ELEO.map2D({ values, extent: [0, 1, 0, 1], scale: 'log', ...(D ? { decades: D } : {}), map: 'ember', el }));
      const G = await grid(el.lastElementChild);
      let wrong = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const k = ks[(j * n + i) % pool.length], s = k >= dec ? 0 : ((dec - k) / dec) * 255, o = (j * G.w + i) * 4;
        const ok = [Math.floor(s), Math.ceil(s)].some((q) => [0, 1, 2].every((c) => Math.abs(G.px[o + c] - lut[q][c]) <= 1));
        if (G.w !== n || G.h !== n || G.px[o + 3] !== 255 || !ok) wrong++;
      }
      out[dec] = wrong;
    }
    return out;
  });
  expect(r[4], 'cells off their step at 4 decades').toBe(0);
  expect(r[2], 'cells off their step at 2 decades').toBe(0);
});

// Typed map, log scale and wave range (#398): 10^-k on a D-decade log scale draws step (D - k)/D; values at or under max * 10^-D (zeros,
// negatives) draw step 0; map 'wave' is symmetric about 0; range overrides both.
test('typed map log scale and wave range', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(o2Helpers);
  const r = await page.locator('.theme[data-theme="light"]').evaluate(async (el) => {
    const ELEO = window.ELEO, { grid } = window.__o2;
    const draw = async (values, o) => {
      el.insertAdjacentHTML('beforeend', ELEO.map2D({ values, extent: [0, 1, 0, 1], el, ...o }));
      return grid(el.lastElementChild);
    };
    const near = (G, i, lut, s) => [Math.floor(s), Math.ceil(s)].some((q) => [0, 1, 2].every((c) => Math.abs(G.px[i * 4 + c] - lut[q][c]) <= 1));
    const out = { log: 0, wave: 0, range: 0 };
    const ember = ELEO.colormap('ember', el), wave = ELEO.colormap('wave', el);
    const pool = [1, 1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 0, -1], ks = [0, 1, 2, 3, 4, 5, Infinity, Infinity];
    const logRows = Array.from({ length: 4 }, (_, j) => pool.slice().reverse().map((_, i) => pool[(i + j) % pool.length]));
    for (const D of [undefined, 2]) {
      const dec = D ?? 4, G = await draw(logRows, { scale: 'log', map: 'ember', ...(D ? { decades: D } : {}) });
      for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) {
        const k = ks[pool.indexOf(logRows[j][i])];
        if (!near(G, j * G.w + i, ember, k >= dec ? 0 : ((dec - k) / dec) * 255)) out.log++;
      }
    }
    // wave: [-3, 1] draws on [-3, 3]: -3 step 0, 0 step 127.5, 1 step 170
    const W = await draw([[-3, 0, 1, 3]], { map: 'wave' });
    [-3, 0, 1, 3].forEach((v, i) => { if (!near(W, i, wave, ((v + 3) / 6) * 255)) out.wave++; });
    const W2 = await draw([[-3, 0, 1]], { map: 'wave' });
    [-3, 0, 1].forEach((v, i) => { if (!near(W2, i, wave, ((v + 3) / 6) * 255)) out.wave++; });
    // range overrides: linear [0, 10] on [2, 4, 6] draws steps 51, 102, 153; wave with range [0, 4] has 0 at step 0; log range max 100
    const R = await draw([[2, 4, 6]], { map: 'ember', range: [0, 10] });
    [2, 4, 6].forEach((v, i) => { if (!near(R, i, ember, (v / 10) * 255)) out.range++; });
    const R2 = await draw([[0, 2, 4]], { map: 'wave', range: [0, 4] });
    [0, 2, 4].forEach((v, i) => { if (!near(R2, i, wave, (v / 4) * 255)) out.range++; });
    const R3 = await draw([[1, 10, 1000]], { map: 'ember', scale: 'log', decades: 2, range: [0, 100] });
    [0, 0.5 * 255, 255].forEach((s, i) => { if (!near(R3, i, ember, s)) out.range++; });
    return out;
  });
  expect(r.log, 'log cells off their step').toBe(0);
  expect(r.wave, 'wave cells off a range symmetric about 0').toBe(0);
  expect(r.range, 'cells off the given range').toBe(0);
});

// Typed map aperture (#399): `aperture: { x, y, r }` in extent units is an even-odd --surface path over the image outside the circle and a 1 px
// --plot-axis ring. oracle: closed-form, a point of the extent is masked exactly when it is farther than r from (x, y); on an unmasked grid and
// on a grid with masked corners, with the aperture off centre.
test('aperture masks outside', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.locator('.theme[data-theme="light"]').evaluate((el) => {
    const n = 16, out = {};
    const plain = Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => (i + j) / 30));
    const corners = plain.map((row, j) => row.map((v, i) => (Math.hypot(i - 7.5, j - 7.5) > 7.5 ? null : v)));
    const ap = { x: 0.25, y: -0.5, r: 1.5 }, extent = [-2, 2, -2, 2];
    for (const [name, values] of [['unmasked', plain], ['corners', corners], ['none', plain]]) {
      el.insertAdjacentHTML('beforeend', window.ELEO.map2D({ values, extent, map: 'ember', ...(name === 'none' ? {} : { aperture: ap }), el }));
      const svg = el.lastElementChild, img = svg.querySelector('image'), mask = svg.querySelector('path[fill-rule="evenodd"]'), ring = svg.querySelector('circle');
      if (name === 'none') { out[name] = { mask: !!mask, ring: !!ring }; continue; }
      const ix = +img.getAttribute('x'), iy = +img.getAttribute('y'), w = +img.getAttribute('width'), h = +img.getAttribute('height');
      const px = (ex, ey) => { const q = svg.createSVGPoint(); q.x = ix + ((ex - extent[0]) / 4) * w; q.y = iy + ((extent[3] - ey) / 4) * h; return q; };
      const probes = [[0.25, -0.5], [1.6, -0.5], [-1.2, -0.5], [0.25, 0.9], [0.25, 1.1], [-1.9, 1.9], [1.9, -1.9], [0.25, -1.9], [-1.2, 0.5]];
      const wrong = probes.filter(([x, y]) => mask.isPointInFill(px(x, y)) !== (Math.hypot(x - ap.x, y - ap.y) > ap.r)).length;
      const c = px(ap.x, ap.y);
      out[name] = {
        wrong, fill: mask.getAttribute('fill'), after: !!(img.compareDocumentPosition(mask) & Node.DOCUMENT_POSITION_FOLLOWING),
        stroke: ring.getAttribute('stroke'), sw: ring.getAttribute('stroke-width'), ringFill: ring.getAttribute('fill'),
        dc: Math.hypot(+ring.getAttribute('cx') - c.x, +ring.getAttribute('cy') - c.y), dr: Math.abs(+ring.getAttribute('r') - (ap.r / 4) * w),
      };
    }
    return out;
  });
  for (const name of ['unmasked', 'corners']) {
    const q = r[name];
    expect(q.wrong, `${name}: probes on the wrong side of the aperture`).toBe(0);
    expect(q.fill, `${name}: mask fill is the surface role`).toBe('var(--surface)');
    expect(q.after, `${name}: mask drawn over the image`).toBe(true);
    expect(q.stroke, `${name}: ring stroke`).toBe('var(--plot-axis)');
    expect(q.sw, `${name}: ring width`).toBe('1');
    expect(q.ringFill, `${name}: ring fill`).toBe('none');
    expect(q.dc, `${name}: ring centre off (px)`).toBeLessThan(0.05);
    expect(q.dr, `${name}: ring radius off (px)`).toBeLessThan(0.05);
  }
  expect(r.none, 'no aperture, no mask or ring').toEqual({ mask: false, ring: false });
});

// O2, colorbar: each colorbar tick sits at its value within 0.5 px. oracle: property, colorbar tick round trip: a tick labelled v is at
// y = bottom - (v - lo) / (hi - lo) * height of the colorbar image, for the range given and for the range of the data; the bar is 1 x 256
// and carries the value's label and unit.
test('colorbar ticks', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.locator('.theme[data-theme="light"]').evaluate(async (el) => {
    const ELEO = window.ELEO, out = [];
    const values = Array.from({ length: 16 }, (_, j) => Array.from({ length: 16 }, (_, i) => 1 + ((i + 16 * j) / 255) * 2.7));
    const cases = [{ range: [0, 4], lo: 0, top: 4 }, { range: [-2, 6], lo: -2, top: 6 }, { lo: 1, top: 3.7 },
      { scale: 'log', decades: 3, top: 3.7, log: true }];
    for (const c of cases) {
      const { lo, top, log, ...props } = c;
      el.insertAdjacentHTML('beforeend', ELEO.map2D({ values, extent: [0, 1, 0, 1], map: 'ember', ...props, value: { label: 'irradiance', unit: 'W/mm²' }, el }));
      const svg = el.lastElementChild;
      let cb = null;
      for (const q of svg.querySelectorAll('image')) { const bm = await createImageBitmap(await (await fetch(q.getAttribute('href'))).blob()); if (bm.width === 1 && bm.height === 256) cb = q; }
      const by = +cb.getAttribute('y'), bh = +cb.getAttribute('height'), bx = +cb.getAttribute('x') + +cb.getAttribute('width');
      const ticks = [...svg.querySelectorAll('text.eleo-tick')].filter((t) => +t.getAttribute('x') >= bx && /^[−-]?[\d.]+$/.test(t.textContent.trim()))
        .map((t) => {
          const v = parseFloat(t.textContent.trim().replace('−', '-'));
          const pos = log ? (Math.log10(v / top) + props.decades) / props.decades : (v - lo) / (top - lo);
          return { v, err: Math.abs(+t.getAttribute('y') - (by + bh - pos * bh)) };
        });
      out.push({ log: !!log, n: ticks.length, vs: ticks.map((t) => t.v), maxErr: Math.max(...ticks.map((q) => q.err)), text: svg.textContent });
    }
    return out;
  });
  for (const q of r) {
    expect(q.n, 'colorbar ticks drawn').toBeGreaterThanOrEqual(3);
    expect(q.maxErr, 'tick off its value (px)').toBeLessThan(0.5);
    expect(q.text).toContain('irradiance');
    expect(q.text).toContain('W/mm²');
    if (q.log) for (const v of q.vs) expect(Math.abs(Math.log10(v) - Math.round(Math.log10(v))), `log tick ${v} at a whole decade`).toBeLessThan(1e-9);
  }
});

// #400: the colorbar is a 1 x 256 image right of the plot; each tick sits at its value (linear, with and without a range; log at whole decades).
test('colorbar ticks sit at their values', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.locator('.theme[data-theme="light"]').evaluate(async (el) => {
    const ELEO = window.ELEO, out = [];
    const values = Array.from({ length: 16 }, (_, j) => Array.from({ length: 16 }, (_, i) => 1 + (i + 16 * j) / 255 * 2.7));
    const cases = [{ range: [0, 4], lo: 0, top: 4 }, { range: [-2, 6], lo: -2, top: 6 }, { lo: 1, top: 3.7 },
      { scale: 'log', decades: 3, lo: 0.0037, top: 3.7, log: true }];
    for (const c of cases) {
      const { lo, top, log, ...props } = c;
      el.insertAdjacentHTML('beforeend', ELEO.map2D({ values, extent: [0, 1, 0, 1], map: 'ember', ...props, value: { label: 'irradiance', unit: 'W/mm²' }, el }));
      const svg = el.lastElementChild, vb = svg.getAttribute('viewBox').split(' ').map(Number);
      let cb = null;
      for (const q of svg.querySelectorAll('image')) { const bm = await createImageBitmap(await (await fetch(q.getAttribute('href'))).blob()); if (bm.width === 1 && bm.height === 256) cb = q; }
      const by = +cb.getAttribute('y'), bh = +cb.getAttribute('height'), bx = +cb.getAttribute('x') + +cb.getAttribute('width');
      const fr = svg.querySelector('rect'), frameRight = +fr.getAttribute('x') + +fr.getAttribute('width');
      const ticks = [...svg.querySelectorAll('text.eleo-tick')].filter((t) => +t.getAttribute('x') >= bx && /^[−-]?[\d.]+$/.test(t.textContent.trim()))
        .map((t) => {
          const v = parseFloat(t.textContent.trim().replace('−', '-'));
          const pos = log ? (Math.log10(v / top) + 3) / 3 : (v - lo) / (top - lo);
          return { v, err: Math.abs(+t.getAttribute('y') - (by + bh - pos * bh)), inside: +t.getAttribute('x') + 3 * t.textContent.length <= vb[2] };
        });
      out.push({ n: ticks.length, vs: ticks.map((t) => t.v), maxErr: Math.max(...ticks.map((q) => q.err)), inside: ticks.every((t) => t.inside), text: svg.textContent, right: bx > frameRight });
    }
    return out;
  });
  for (const q of r) {
    expect(q.n, 'colorbar ticks drawn').toBeGreaterThanOrEqual(3);
    expect(q.maxErr, 'tick off its value (px)').toBeLessThan(0.5);
    expect(q.text).toContain('irradiance');
    expect(q.text).toContain('W/mm²');
    expect(q.right, 'bar right of the plot frame').toBe(true);
    expect(q.inside, 'labels inside the viewBox').toBe(true);
  }
  expect(r[3].vs, 'log ticks are whole decades').toEqual([0.01, 0.1, 1]);
});

// O2, irradiance: each Gaussian cell is the step of exp(-2 r^2 / w^2). oracle: closed-form, TEM00 irradiance with w = 1 mm, 128 x 128 cells
// over +-2 mm (plan item #402), linear over the grid's [min, max]; the gallery says the tile is synthetic.
test('gaussian irradiance tile', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-tile="irradiance-gaussian"] .eleo-plot__meta')).toHaveText([/synthetic/i, /synthetic/i]);
  await page.evaluate(o2Helpers);
  const r = await page.locator('.theme[data-theme="light"]').evaluate(async (el) => {
    const ELEO = window.ELEO, { grid } = window.__o2, lut = ELEO.colormap('ember', el);
    const n = 128, w = 1, h = 4 / n;
    const values = Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => {
      const x = -2 + (i + 0.5) * h, y = 2 - (j + 0.5) * h;
      return Math.exp((-2 * (x * x + y * y)) / (w * w));
    }));
    el.insertAdjacentHTML('beforeend', ELEO.map2D({ values, extent: [-2, 2, -2, 2], map: 'ember', x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, el }));
    const G = await grid(el.lastElementChild), flat = values.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
    let wrong = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const c = lut[Math.round(((values[j][i] - lo) / (hi - lo)) * 255)], o = (j * G.w + i) * 4;
      if (G.w !== n || G.h !== n || G.px[o + 3] !== 255 || [0, 1, 2].some((k) => Math.abs(G.px[o + k] - c[k]) > 1)) wrong++;
    }
    return { wrong };
  });
  expect(r.wrong, 'cells off their step').toBe(0);
});
