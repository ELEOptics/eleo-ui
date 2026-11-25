// Plan #1144, issue #1146: the parsers the specs share, run in the page (every parse site is inside an evaluate or the timed rAF harness).
// `pageHelpers(page)` defines window.H = { matrixOf, subpaths, pointsOf, nums } from the helpers' own source, before any page script runs; call it before page.goto.
import { expect } from '@playwright/test';
import { matrixOf, subpaths, pointsOf, nums } from './unit/helpers/svg.js';

const SOURCE = `window.H = (() => {
  const nums = ${nums};
  ${subpaths};
  ${pointsOf};
  ${matrixOf};
  return { matrixOf, subpaths, pointsOf, nums };
})();`;

export const pageHelpers = (page) => page.addInitScript(SOURCE);

// The pixel the browser delivers for a computed client point: Firefox and WebKit truncate pointer coordinates to whole pixels (#1030), so the specs aim at the nearest one.
export const moveTo = (page, x, y) => page.mouse.move(Math.round(x), Math.round(y));

// Plan #1193, #1263: the gallery draws a layout3D canvas only when it is near the viewport and then sets data-drawn on it. Scroll the canvas locator into view and wait for that attribute, so a test that reads its pixels reads a drawn canvas.
export const drawn3D = async (locator, timeout = 60_000) => {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toHaveAttribute('data-drawn', 'true', { timeout });
};

// Scroll every 3D canvas into view in turn and wait for its data-drawn; `skip` names the kinds that are expected never to draw.
export const draw3D = async (page, skip = []) => {
  const ids = await page.locator('[data-canvas^="layout3D"]').evaluateAll((els) => els.map((c) => [c.dataset.canvas, c.closest('.theme').dataset.theme]));
  for (const [k, theme] of ids) {
    const c = page.locator(`.theme[data-theme="${theme}"] [data-canvas="${k}"]`);
    if (skip.includes(k)) await c.scrollIntoViewIfNeeded(); else await drawn3D(c);
  }
};
