// Plan #804 (agent_docs/plans/804-interaction.md), roadmap Design references: the gallery's tile screenshots at a row's start, both themes and palettes.
// oracle: user the tile screenshots the user approves at the M1 demo (roadmap, Design references)
// Opt-in (SHOTS=1), so a normal run neither runs nor lists it. Writes test-results/shots/<tile>--<theme>--<palette>.png, 4 per tile.
// The PNGs go to the draft `review-assets` release, never into git.
// SHOTS_BASE=<dir> also compares each shot, pixel for pixel, with <dir>/<same name>.png (decoded in the page, canvas getImageData),
// lists the differing tiles and fails if any differ (a missing base PNG or a different size counts as differing).
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { drawn3D } from './page-helpers.js';

const THEMES = ['light', 'dark'];
const PALETTES = ['standard', 'red-green'];
const BASE = process.env.SHOTS_BASE;

// Number of differing pixels between two PNGs (base64), or -1 when the sizes differ.
const diffPixels = ([a, b]) => Promise.all([a, b].map(async (b64) => {
  const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
  const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, bmp.width, bmp.height);
})).then(([x, y]) => {
  if (x.width !== y.width || x.height !== y.height) return -1;
  let n = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2] || x.data[i + 3] !== y.data[i + 3]) n++;
  }
  return n;
});

if (process.env.SHOTS === '1') test('gallery tile screenshots', async ({ page }) => {
  test.setTimeout(300000);
  mkdirSync('test-results/shots', { recursive: true });
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const tiles = await page.locator('.theme[data-theme="light"] [data-tile]').evaluateAll((els) => els.map((el) => el.dataset.tile));
  const differing = [];
  for (const palette of PALETTES) {
    await page.locator(`input[name="palette"][value="${palette}"]`).check();
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    for (const theme of THEMES) for (const tile of tiles) {
      const el = page.locator(`.theme[data-theme="${theme}"] [data-tile="${tile}"]`);
      await el.scrollIntoViewIfNeeded();
      // A layout3D tile draws when it is near the viewport and after a palette change (#1263): wait for it.
      const c3 = el.locator('[data-canvas^="layout3D"]');
      if (await c3.count()) await drawn3D(c3);
      const name = `${tile}--${theme}--${palette}`;
      const shot = await el.screenshot({ path: `test-results/shots/${name}.png`, animations: 'disabled' });
      if (!BASE) continue;
      const basePath = `${BASE}/${name}.png`;
      const n = existsSync(basePath) ? await page.evaluate(diffPixels, [shot.toString('base64'), readFileSync(basePath).toString('base64')]) : -1;
      if (n !== 0) differing.push(`${name} (${n < 0 ? 'missing or different size' : `${n} px`})`);
    }
  }
  if (BASE) console.log(`SHOTS_BASE ${BASE}: ${differing.length} differing\n${differing.join('\n')}`);
  expect(differing, `shots differing from ${BASE}`).toEqual([]);
});
