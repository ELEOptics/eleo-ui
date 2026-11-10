// Plan #804 (agent_docs/plans/804-interaction.md), roadmap Design references: the gallery's tile screenshots at a row's start, both themes and palettes.
// oracle: user the tile screenshots the user approves at the M1 demo (roadmap, Design references)
// Opt-in (SHOTS=1), so a normal run neither runs nor lists it. Writes test-results/shots/<tile>--<theme>--<palette>.png, 4 per tile.
// The PNGs go to the draft `review-assets` release, never into git.
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const THEMES = ['light', 'dark'];
const PALETTES = ['standard', 'red-green'];

if (process.env.SHOTS === '1') test('gallery tile screenshots', async ({ page }) => {
  test.setTimeout(300000);
  mkdirSync('test-results/shots', { recursive: true });
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const tiles = await page.locator('.theme[data-theme="light"] [data-tile]').evaluateAll((els) => els.map((el) => el.dataset.tile));
  for (const palette of PALETTES) {
    await page.locator(`input[name="palette"][value="${palette}"]`).check();
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    for (const theme of THEMES) for (const tile of tiles) {
      const el = page.locator(`.theme[data-theme="${theme}"] [data-tile="${tile}"]`);
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: `test-results/shots/${tile}--${theme}--${palette}.png`, animations: 'disabled' });
    }
  }
});
