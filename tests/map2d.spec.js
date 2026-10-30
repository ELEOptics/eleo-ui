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

// O1: the typed map places the recorded Cooke PSF. oracle: fixture, phos-core PointSpread recorded by
// scripts/record-phos-core.py (roadmap U8). Skipped until the last item of M1 (#396).
test.skip('recorded PSF cells (U8)', async ({ page }) => {
  const psf = fixture('phos-core/cooke-psf.json');
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const cells = async (theme) => page.locator(`.theme[data-theme="${theme}"]`).evaluate(async (el, p) => {
    const ELEO = window.ELEO;
    el.insertAdjacentHTML('beforeend', ELEO.map2D({ values: p.values, extent: p.extent, x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, map: 'ember', el }));
    const svg = el.lastElementChild, img = svg.querySelector('image');
    const bitmap = await createImageBitmap(await (await fetch(img.getAttribute('href'))).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height), g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const px = g.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const lut = ELEO.colormap('ember', el);
    const flat = p.values.flat().filter((v) => v !== null && !Number.isNaN(v));
    const lo = Math.min(...flat), hi = Math.max(...flat);
    let wrong = 0, masked = 0;
    p.values.forEach((row, r) => row.forEach((v, k) => {
      const o = (r * bitmap.width + k) * 4;
      if (v === null || Number.isNaN(v)) { if (px[o + 3] !== 0) masked++; return; }
      const s = lut[Math.round(((v - lo) / (hi - lo)) * 255)];
      if (Math.abs(px[o] - s[0]) > 1 || Math.abs(px[o + 1] - s[1]) > 1 || Math.abs(px[o + 2] - s[2]) > 1) wrong++;
    }));
    const box = img.getBoundingClientRect(), [x0, x1, y0, y1] = p.extent;
    return { wrong, masked, w: box.width, h: box.height, ppmX: box.width / (x1 - x0), ppmY: box.height / (y1 - y0) };
  }, psf);
  for (const theme of ['light', 'dark']) {
    const r = await cells(theme);
    expect(r.wrong, `${theme} cells off their step`).toBe(0);
    expect(r.masked, `${theme} masked cells drawn`).toBe(0);
    expect(Math.abs(r.ppmX - r.ppmY), `${theme} px per mm`).toBeLessThan(0.5 / Math.max(r.w, r.h));
  }
});
