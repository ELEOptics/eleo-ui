// map2D sample call (plan #389). Chromium only: its recorded PNGs are Chromium's canvas encoding. Run after `npm run build`.
// oracle: fixture sample canvas PNGs recorded by scripts/record-map2d-baseline.mjs from main's build at the plan's base
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
    // A fresh canvas in that theme's column (colors come from the element), drawn with the renderer's default size, not the gallery's.
    const png = await page.locator(`.theme[data-theme="${theme}"]`).evaluate((col, k) => {
      const c = document.createElement('canvas');
      col.appendChild(c);
      window.ELEO.map2D(c, { kind: k });
      const url = c.toDataURL('image/png');
      c.remove();
      return url;
    }, kind);
    expect(png === baseline[`${kind}-${theme}`], `${kind} in ${theme} differs from the recording`).toBe(true);
  }
});
