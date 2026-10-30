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
