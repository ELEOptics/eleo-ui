// Every renderer draws, in both themes, without errors. Run after `npm run build`.
import { test, expect } from '@playwright/test';

test('gallery renders every tile in both themes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(errors).toEqual([]);

  for (const theme of ['light', 'dark']) {
    const col = page.locator(`.theme[data-theme="${theme}"]`);
    const tiles = await col.locator('[data-tile]').evaluateAll((els) => els.map((el) => {
      const svg = el.querySelector('.eleo-plot__body svg');
      const canvas = el.querySelector('canvas');
      let inked = 0;
      if (canvas) {
        const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 3; i < data.length; i += 4) if (data[i]) inked++;
      }
      return { tile: el.dataset.tile, svgMarks: svg ? svg.querySelectorAll('path, line, circle, rect, polyline').length : 0, inked };
    }));
    expect(tiles.length).toBe(15);
    for (const t of tiles) expect(t.svgMarks + t.inked, `${theme} ${t.tile} drew nothing`).toBeGreaterThan(0);
  }
});

test('canvas maps follow their theme', async ({ page }) => {
  await page.goto('/gallery/');
  const corner = (theme) => page.locator(`.theme[data-theme="${theme}"] [data-canvas="psf"]`).evaluate((c) => [...c.getContext('2d').getImageData(1, 1, 1, 1).data.slice(0, 3)]);
  // Stop 0 of the ember map is the plot ground: near white in light, near black in dark.
  expect((await corner('light')).every((v) => v > 230)).toBe(true);
  expect((await corner('dark')).every((v) => v < 40)).toBe(true);
});
