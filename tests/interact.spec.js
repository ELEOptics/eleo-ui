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
    // The drawn points, parsed by the rule interact's pairs() states: strip M/L and h<n>, split on commas and spaces, drop a pair with a non-finite coordinate.
    const n = (mark.getAttribute('points') || mark.getAttribute('d') || '').replace(/h\s*-?[\d.]+/g, ' ').replace(/[ML]/g, ' ').split(/[\s,]+/).filter(Boolean).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < n.length; i += 2) if (Number.isFinite(n[i]) && Number.isFinite(n[i + 1])) pts.push([n[i], n[i + 1]]);
    const [x, y] = pts[index];
    const vp = group.closest('svg');
    const root = vp.ownerSVGElement || vp;
    const box = root.getBoundingClientRect();
    const k = box.width / root.viewBox.baseVal.width;
    const vx = +(vp.getAttribute('x') || 0), vy = +(vp.getAttribute('y') || 0);
    return { data: [x, y], clientX: box.left + (vx + a * x + e) * k, clientY: box.top + (vy + d * y + f) * k, k, a, d };
  }, index);

// The body shared by both hover tests: hover points 0, 3 and 7 of the MTF tile's first series, check each event
// against the inverse transform, check that leaving emits null, then stop(). Returns the tile name.
async function hoverRoundTrip(page) {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const tile = 'mtf';
  await page.evaluate((tile) => {
    window.HOVER = [];
    const body = document.querySelector(`.theme[data-theme="light"] [data-tile="${tile}"] .eleo-plot__body`);
    window.STOP = window.ELEO.interact(body, { onhover: (ev) => window.HOVER.push(ev) });
  }, tile);
  await page.locator(`.theme[data-theme="light"] [data-tile="${tile}"]`).scrollIntoViewIfNeeded(); // the MTF tile sits far below the viewport
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
  return tile;
}

test('hover emits the point under the pointer', async ({ page }) => {
  await hoverRoundTrip(page);
});

// #807: the same round trip, live. The points checked are the ends and the middle of the first series of the MTF tile.
test('curve hover round trip', async ({ page }) => {
  const tile = await hoverRoundTrip(page);
  const n = await page.evaluate(() => window.HOVER.length);
  const p = await drawnAt(page.locator('.theme[data-theme="light"]'), tile, 0, 3);
  await page.mouse.move(p.clientX, p.clientY);
  expect(await page.evaluate(() => window.HOVER.length), 'stop() detaches').toBe(n);
});

// #845: a non-finite coordinate drops its point; it never shifts x and y of the points after it.
test('non-finite points are skipped', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const p = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'nan-host';
    host.style.cssText = 'position:fixed;left:0;top:0;width:400px;background:#fff;z-index:9';
    host.innerHTML = window.ELEO.curve({ series: [{ points: [[0, 1], [1, NaN], [2, 3], [3, 4]], index: 0 }], x: { range: [0, 3] }, y: { range: [0, 5] }, width: 400, height: 300 });
    document.body.append(host);
    window.HOVER = [];
    window.STOP = window.ELEO.interact(host, { onhover: (ev) => window.HOVER.push(ev) });
    const mark = host.querySelector('[data-series]');
    const group = mark.parentNode;
    const [a, , , d, e, f] = group.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
    const vp = group.closest('svg');
    const root = vp.ownerSVGElement || vp;
    const box = root.getBoundingClientRect();
    const k = box.width / root.viewBox.baseVal.width;
    const vx = +(vp.getAttribute('x') || 0), vy = +(vp.getAttribute('y') || 0);
    return { clientX: box.left + (vx + a * 2 + e) * k, clientY: box.top + (vy + d * 3 + f) * k, a, d, k };
  });
  await page.mouse.move(p.clientX, p.clientY);
  const ev = await page.evaluate(() => window.HOVER.at(-1));
  expect(ev, 'point [2,3] hovered').toBeTruthy();
  expect(Math.abs(ev.x - 2) * Math.abs(p.a) * p.k, 'x within TOL_PX').toBeLessThanOrEqual(TOL_PX);
  expect(Math.abs(ev.y - 3) * Math.abs(p.d) * p.k, 'y within TOL_PX').toBeLessThanOrEqual(TOL_PX);
  await page.evaluate(() => window.STOP());
});

// #858: hovering draws a dot on the point and drop lines to the frame's bottom (x axis) and left (y axis) edges, in an overlay on the host.
test('hover marks the point and its drop lines', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const tile = 'mtf', light = page.locator('.theme[data-theme="light"]');
  await page.evaluate((tile) => {
    const body = document.querySelector(`.theme[data-theme="light"] [data-tile="${tile}"] .eleo-plot__body`);
    window.STOP = window.ELEO.interact(body, { onhover: () => {} });
  }, tile);
  await light.locator(`[data-tile="${tile}"]`).scrollIntoViewIfNeeded();
  const p = await drawnAt(light, tile, 0, 3);
  // The frame: the nested viewport's box from its x/y/width/height attributes and the root's client box, no getScreenCTM.
  const frame = await light.locator(`[data-tile="${tile}"] polyline[data-series="0"], [data-tile="${tile}"] path[data-series="0"]`).first().evaluate((mark) => {
    const vp = mark.parentNode.closest('svg'), root = vp.ownerSVGElement || vp, box = root.getBoundingClientRect(), k = box.width / root.viewBox.baseVal.width;
    const vx = +(vp.getAttribute('x') || 0), vy = +(vp.getAttribute('y') || 0);
    return { left: box.left + vx * k, bottom: box.top + (vy + +vp.getAttribute('height')) * k };
  });
  await page.mouse.move(p.clientX, p.clientY);
  const rect = (sel) => light.locator(`[data-tile="${tile}"] ${sel}`).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
  const dot = await rect('.eleo-hover__dot'), v = await rect('.eleo-hover__v'), h = await rect('.eleo-hover__h');
  expect(Math.abs((dot.left + dot.right) / 2 - p.clientX), 'dot x').toBeLessThanOrEqual(0.5);
  expect(Math.abs((dot.top + dot.bottom) / 2 - p.clientY), 'dot y').toBeLessThanOrEqual(0.5);
  expect(Math.abs((v.left + v.right) / 2 - p.clientX), 'vertical line at x').toBeLessThanOrEqual(0.5);
  expect(Math.abs(v.bottom - frame.bottom), 'vertical line ends on the bottom edge').toBeLessThanOrEqual(0.5);
  expect(Math.abs((h.top + h.bottom) / 2 - p.clientY), 'horizontal line at y').toBeLessThanOrEqual(0.5);
  expect(Math.abs(h.left - frame.left), 'horizontal line ends on the left edge').toBeLessThanOrEqual(0.5);
  await page.mouse.move(2, 2);
  await expect(light.locator(`[data-tile="${tile}"] .eleo-hover__dot`), 'gone on leave').toHaveCount(0);
  await page.evaluate(() => window.STOP());
});

// #859: while a point is hovered a tooltip with readout(event, axes) sits near the pointer, inside the host, off the dot; it hides on leave and `tooltip: false` removes it.
test('tooltip follows the pointer', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  // Own host: the gallery binds interact on its tiles too, without axes.
  const tile = 'own', light = page.locator('body');
  await page.evaluate(() => {
    const body = document.createElement('div');
    body.dataset.tile = 'own';
    body.style.cssText = 'position:fixed;left:0;top:0;width:460px;background:#fff;z-index:9';
    body.innerHTML = window.ELEO.curve({ series: [{ points: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 3.5], [5, 5], [6, 4], [7, 2]], index: 0, label: 'S' }], x: { range: [0, 7] }, y: { range: [0, 5] }, width: 460, height: 260 });
    document.body.append(body);
    window.AXES = { x: { unit: 'cycles/mm', digits: 1 }, y: { digits: 3 } };
    window.HOVER = [];
    window.STOP = window.ELEO.interact(body, { axes: window.AXES, onhover: (ev) => window.HOVER.push(ev) });
  });
  const tip = light.locator(`[data-tile="${tile}"] .eleo-hover__tip`);
  for (const index of [3, 7]) {
    const p = await drawnAt(light, tile, 0, index);
    await page.mouse.move(p.clientX, p.clientY);
    const want = await page.evaluate(() => window.ELEO.readout(window.HOVER.at(-1), window.AXES));
    await expect(tip.first()).toHaveText(want);
    expect(want).toContain('cycles/mm');
    const box = await tip.first().evaluate((el) => {
      const r = el.getBoundingClientRect(), h = el.closest('.eleo-hover-host').getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, hl: h.left, hr: h.right, ht: h.top, hb: h.bottom };
    });
    expect(box.l, 'inside host left').toBeGreaterThanOrEqual(box.hl - 0.5);
    expect(box.r, 'inside host right').toBeLessThanOrEqual(box.hr + 0.5);
    expect(box.t, 'inside host top').toBeGreaterThanOrEqual(box.ht - 0.5);
    expect(box.b, 'inside host bottom').toBeLessThanOrEqual(box.hb + 0.5);
    const covers = p.clientX >= box.l - 4 && p.clientX <= box.r + 4 && p.clientY >= box.t - 4 && p.clientY <= box.b + 4;
    expect(covers, 'does not cover the dot').toBe(false);
    const dx = Math.max(box.l - p.clientX, 0, p.clientX - box.r), dy = Math.max(box.t - p.clientY, 0, p.clientY - box.b);
    expect(Math.hypot(dx, dy), 'near the pointer').toBeLessThanOrEqual(40);
  }
  await page.mouse.move(2, 2);
  await expect(tip, 'gone on leave').toHaveCount(0);
  await page.evaluate(() => window.STOP());
  // tooltip: false
  await page.evaluate(() => { window.STOP = window.ELEO.interact(document.querySelector('[data-tile="own"]'), { tooltip: false }); });
  const p = await drawnAt(light, tile, 0, 3);
  await page.mouse.move(p.clientX, p.clientY);
  await expect(light.locator(`[data-tile="${tile}"] .eleo-hover__dot`).first()).toHaveCount(1);
  await expect(tip, 'tooltip off').toHaveCount(0);
  await page.evaluate(() => window.STOP());
});

test('two interact calls on one host', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const tile = 'twice', light = page.locator('body');
  // Own host, statically positioned by CSS: only the hover-host class makes it a containing block.
  await page.evaluate(() => {
    const body = document.createElement('div');
    body.dataset.tile = 'twice';
    body.style.cssText = 'width:460px;margin:40px;background:#fff';
    body.innerHTML = window.ELEO.curve({ series: [{ points: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 3.5], [5, 5], [6, 4], [7, 2]], index: 0, label: 'S' }], x: { range: [0, 7] }, y: { range: [0, 5] }, width: 460, height: 260 });
    document.body.append(body);
    window.STOPS = [window.ELEO.interact(body), window.ELEO.interact(body)];
  });
  const host = light.locator(`[data-tile="${tile}"]`);
  await page.evaluate(() => window.STOPS[0]());
  await expect(host).toHaveClass(/eleo-hover-host/);
  await host.scrollIntoViewIfNeeded();
  const p = await drawnAt(light, tile, 0, 3);
  await page.mouse.move(p.clientX, p.clientY);
  const dot = host.locator('.eleo-hover__dot');
  await expect(dot).toHaveCount(1);
  const at = await dot.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  expect(Math.abs(at.x - p.clientX), 'dot x').toBeLessThanOrEqual(0.5);
  expect(Math.abs(at.y - p.clientY), 'dot y').toBeLessThanOrEqual(0.5);
  await expect(host).toHaveClass(/eleo-hover-host/);
  await page.evaluate(() => window.STOPS[1]());
  await expect(host).not.toHaveClass(/eleo-hover-host/);
});
