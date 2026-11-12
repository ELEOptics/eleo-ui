// A pixel-ratio change redraws every canvas tile. Chromium only: the check drives the device pixel ratio through a CDP session.
import { test, expect } from '@playwright/test';

// CR #632 (issue #634, #638): canvas tiles draw through fit at their body's width and the device pixel ratio (layout3D's clamped to 2-3). A pixel-ratio change at the same CSS width redraws them.
// oracle: property backing width = rendered width x dpr
test('canvas tiles redraw at the device pixel ratio (#638)', async ({ page }) => {
  const widths = () => page.locator('[data-canvas]').evaluateAll((els) => els.map((c) => ({
    backing: c.width, rendered: c.getBoundingClientRect().width, dpr: c.dataset.canvas === 'layout3D' ? Math.max(2, Math.min(3, window.devicePixelRatio)) : window.devicePixelRatio,
  })));
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const cdp = await page.context().newCDPSession(page);
  // The height differs by 1 px: Chromium reports a pixel-ratio change to media queries only with a viewport change, and the width, which redraws the tiles by itself, stays.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 901, deviceScaleFactor: 2, mobile: false });
  await expect.poll(async () => (await widths()).every((c) => c.dpr === 2 && Math.abs(c.backing - c.rendered * c.dpr) <= 1), { message: 'backing follows the pixel ratio' }).toBe(true);
});
