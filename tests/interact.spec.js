// Interaction (plan #804, agent_docs/plans/804-interaction.md), M1 outcome O1 for curve (issue #805; #812 unskips). Run after `npm run build`.
// oracle: property round trip through the inverse transform (roadmap U13).
// The pointer is placed at a data point's drawn position computed from the
// data group's `matrix(...)` attribute, the nested viewport's x/y and the SVG's getBoundingClientRect, never from getScreenCTM, which `interact` uses;
// the hover event must carry that point's data coordinates within TOL_PX (tests/unit/helpers/svg.js).
import { test, expect } from '@playwright/test';
import { TOL_PX } from './unit/helpers/svg.js';

// The data group of a tile's first series, and where data point (dx, dy) is drawn in client px.
const drawnAt = (page, tile, series, index) => page.locator(`[data-tile="${tile}"] polyline[data-series="${series}"], [data-tile="${tile}"] path[data-series="${series}"]`).first()
  .evaluate((mark, index) => {
    const group = mark.parentNode;
    const [a, , , d, e, f] = group.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
    const nums = (mark.getAttribute('points') || mark.getAttribute('d')).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
    const [x, y] = [nums[2 * index], nums[2 * index + 1]];
    const vp = group.closest('svg');
    const root = vp.ownerSVGElement || vp;
    const box = root.getBoundingClientRect();
    const k = box.width / root.viewBox.baseVal.width;
    const vx = +(vp.getAttribute('x') || 0), vy = +(vp.getAttribute('y') || 0);
    return { data: [x, y], clientX: box.left + (vx + a * x + e) * k, clientY: box.top + (vy + d * y + f) * k, k, a, d };
  }, index);

test.skip('hover emits the point under the pointer', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const tile = 'mtf';
  await page.evaluate((tile) => {
    window.HOVER = [];
    const body = document.querySelector(`.theme[data-theme="light"] [data-tile="${tile}"] .eleo-plot__body`);
    window.STOP = window.ELEO.interact(body, { onhover: (ev) => window.HOVER.push(ev) });
  }, tile);
  for (const index of [0, 3, 7]) {
    const p = await drawnAt(page.locator('.theme[data-theme="light"]'), tile, 0, index);
    await page.mouse.move(p.clientX, p.clientY);
    const ev = await page.evaluate(() => window.HOVER.at(-1));
    expect(ev, `point ${index} hovered`).not.toBeNull();
    expect(ev.series.index).toBe(0);
    expect(typeof ev.series.label).toBe('string');
    expect(ev.series.role).toBeTruthy();
    expect(Math.abs(ev.x - p.data[0]) * Math.abs(p.a) * p.k, 'x within TOL_PX').toBeLessThanOrEqual(TOL_PX);
    expect(Math.abs(ev.y - p.data[1]) * Math.abs(p.d) * p.k, 'y within TOL_PX').toBeLessThanOrEqual(TOL_PX);
  }
  await page.mouse.move(2, 2);
  expect(await page.evaluate(() => window.HOVER.at(-1)), 'leaving emits null').toBeNull();
  await page.evaluate(() => window.STOP());
});
