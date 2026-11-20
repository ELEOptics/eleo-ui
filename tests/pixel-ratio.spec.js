// A pixel-ratio change redraws every canvas tile. Chromium only: the check drives the device pixel ratio through a CDP session.
import { test, expect } from '@playwright/test';

// CR #632 (issue #634, #638): canvas tiles draw through fit at their body's width and the device pixel ratio (layout3D's clamped to 2-3). A pixel-ratio change at the same CSS width redraws them.
// oracle: property backing width = rendered width x dpr
test('canvas tiles redraw at the device pixel ratio (#638)', async ({ page }) => {
  const widths = () => page.locator('[data-canvas]').evaluateAll((els) => els.map((c) => ({
    backing: c.width, rendered: c.getBoundingClientRect().width, dpr: c.dataset.canvas.startsWith('layout3D') ? Math.max(2, Math.min(3, window.devicePixelRatio)) : window.devicePixelRatio,
  })));
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(await widths(), 'airy, layout3D, layout3D-front and layout3D-glasses, in two themes').toHaveLength(8);
  const cdp = await page.context().newCDPSession(page);
  // The height differs by 1 px: Chromium reports a pixel-ratio change to media queries only with a viewport change, and the width, which redraws the tiles by itself, stays.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 901, deviceScaleFactor: 2, mobile: false });
  // The redraw includes six three.js tiles at about 0.3 s each on software WebGL (SwiftShader), more under the full gate's parallel load, so the poll waits 30 s, not 5 s.
  await expect.poll(async () => (await widths()).every((c) => c.dpr === 2 && Math.abs(c.backing - c.rendered * c.dpr) <= 1), { message: 'backing follows the pixel ratio', timeout: 30_000 }).toBe(true);
});
