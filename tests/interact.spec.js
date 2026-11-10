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
  // A panels curve draws a <path> that breaks at the gap, so each side reads and the gap reads nothing; a single-plot <polyline> holding a NaN is not drawn at all by a browser, so it reads nothing, before the NaN or after.
  const pts = [[0, 1], [1, 2], [2, null], [3, 4], [4, 5]], nan = [[0, 1], [1, 2], [2, NaN], [3, 4], [4, 5]];
  await page.evaluate(([pts, nan]) => {
    const make = (id, top, html) => { const host = document.createElement('div'); host.id = id; host.style.cssText = `position:fixed;left:0;top:${top}px;width:400px;background:#fff;z-index:9`; host.innerHTML = html; document.body.append(host); window.ELEO.interact(host, { onhover: (ev) => window.HOVER.push(ev) }); };
    window.HOVER = [];
    const axes = { x: { range: [0, 4] }, y: { range: [0, 6] }, width: 400 };
    make('gap-host', 0, window.ELEO.curve({ panels: [{ series: [{ points: pts, index: 0 }] }], ...axes }));
    make('nan-host', 260, window.ELEO.curve({ series: [{ points: nan, index: 0 }], ...axes }));
    // Where data point (x, y) of a host's mark is drawn in client px, from the data group's matrix attribute, never getScreenCTM.
    window.AT = (id, x, y) => {
      const group = document.querySelector(`#${id} [data-series]`).parentNode;
      const [a, , , d, e, f] = group.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
      const vp = group.closest('svg'), root = vp.ownerSVGElement || vp, box = root.getBoundingClientRect(), k = box.width / root.viewBox.baseVal.width;
      // a panels drawing wraps its panels in a <g transform="translate(tx ty)"> between the root and the viewport
      let tx = 0, ty = 0;
      for (let g = vp.parentNode; g && g !== root.parentNode; g = g.parentNode) { const t = (g.getAttribute && g.getAttribute('transform') || '').match(/translate\(([^)]*)\)/); if (t) { const [u, v] = t[1].split(/[\s,]+/).map(Number); tx += u; ty += v || 0; } }
      return { clientX: box.left + (tx + (+vp.getAttribute('x') || 0) + a * x + e) * k, clientY: box.top + (ty + (+vp.getAttribute('y') || 0) + d * y + f) * k, a, d, k };
    };
  }, [pts, nan]);
  const read = async (id, x, y) => {
    const p = await page.evaluate(([id, x, y]) => window.AT(id, x, y), [id, x, y]);
    await page.mouse.move(0, 700);
    await page.evaluate(() => { window.HOVER = []; });
    await page.mouse.move(p.clientX, p.clientY);
    return { ev: await page.evaluate(() => window.HOVER.at(-1) || null), p };
  };
  // each side of the gap: the midpoint of segment [0, 1] and of [3, 4] reads interpolated values on that segment
  for (const [x, y] of [[0.5, 1.5], [3.5, 4.5]]) {
    const { ev, p } = await read('gap-host', x, y);
    expect(ev, `segment at ${x} hovered`).toBeTruthy();
    expect(ev.interpolated, `${x} interpolated`).toBe(true);
    expect(Math.abs(ev.x - x) * Math.abs(p.a) * p.k, `x of ${x} within TOL_PX`).toBeLessThanOrEqual(TOL_PX);
    expect(Math.abs(ev.y - y) * Math.abs(p.d) * p.k, `y of ${x} within TOL_PX`).toBeLessThanOrEqual(TOL_PX);
  }
  // across the gap, between (1, 2) and (3, 4), no segment is drawn: nothing is hovered
  expect((await read('gap-host', 2, 3)).ev, 'gap hovers nothing').toBeNull();
  // a polyline with a NaN is not drawn: nothing before it, nothing after it
  for (const [x, y] of [[0.5, 1.5], [3.5, 4.5]]) expect((await read('nan-host', x, y)).ev, `NaN polyline at ${x} hovers nothing`).toBeNull();
});

// #858: hovering draws a dot on the point and drop lines to the frame's bottom (x axis) and left (y axis) edges, in an overlay on the host.
test('hover marks the point and its drop lines', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const tile = 'mtf', light = page.locator('.theme[data-theme="light"]');
  await page.evaluate((tile) => {
    // Firefox and Safari report a nested <svg>'s own screen matrix without its x/y (Chromium includes them): emulate that, so the lines must not take the frame edges from it.
    const own = SVGSVGElement.prototype.getScreenCTM;
    SVGSVGElement.prototype.getScreenCTM = function () { const m = own.call(this); return this.ownerSVGElement ? m.translate(-(+this.getAttribute('x') || 0), -(+this.getAttribute('y') || 0)) : m; };
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
  // The lines are the grid's colour and dashed: their painted colour is a drawn grid line's resolved stroke, and the paint is a repeating gradient, not a solid fill.
  const grid = await light.locator(`[data-tile="${tile}"] line[stroke="var(--plot-grid)"]`).first().evaluate((el) => getComputedStyle(el).stroke);
  for (const k of ['v', 'h']) {
    const css = await light.locator(`[data-tile="${tile}"] .eleo-hover__${k}`).first().evaluate((el) => { const c = getComputedStyle(el); return { img: c.backgroundImage, bg: c.backgroundColor }; });
    expect(css.img, `${k} line is dashed`).toContain('repeating-linear-gradient');
    expect(css.img, `${k} line in the grid colour`).toContain(grid);
    expect(css.bg, `${k} line has no solid fill`).toBe('rgba(0, 0, 0, 0)');
  }
  expect(v.right - v.left, 'vertical line is 1 px').toBeCloseTo(1, 1);
  expect(h.bottom - h.top, 'horizontal line is 1 px').toBeCloseTo(1, 1);
  expect(Math.abs((dot.left + dot.right) / 2 - p.clientX), 'dot x').toBeLessThanOrEqual(0.5);
  expect(Math.abs((dot.top + dot.bottom) / 2 - p.clientY), 'dot y').toBeLessThanOrEqual(0.5);
  expect(Math.abs((v.left + v.right) / 2 - p.clientX), 'vertical line at x').toBeLessThanOrEqual(0.5);
  expect(Math.abs(v.bottom - frame.bottom), 'vertical line ends on the bottom edge').toBeLessThanOrEqual(0.5);
  expect(Math.abs((h.top + h.bottom) / 2 - p.clientY), 'horizontal line at y').toBeLessThanOrEqual(0.5);
  expect(Math.abs(h.left - frame.left), 'horizontal line ends on the left edge').toBeLessThanOrEqual(0.5);
  await page.mouse.move(2, 2);
  await expect(light.locator(`[data-tile="${tile}"] .eleo-hover__dot:visible`), 'hidden on leave').toHaveCount(0);
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
  await expect(tip, 'gone on leave').toBeHidden();
  await page.evaluate(() => window.STOP());
  // tooltip: false
  await page.evaluate(() => { window.STOP = window.ELEO.interact(document.querySelector('[data-tile="own"]'), { tooltip: false }); });
  const p = await drawnAt(light, tile, 0, 3);
  await page.mouse.move(p.clientX, p.clientY);
  await expect(light.locator(`[data-tile="${tile}"] .eleo-hover__dot`).first()).toHaveCount(1);
  await expect(tip, 'tooltip off').toHaveCount(0);
  await page.evaluate(() => window.STOP());
});

// #865: the tooltip is a polite live region that exists before its text changes and is the same element for the life of the call; on leave it is emptied and hidden, not removed.
test('tooltip is a live region', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const light = page.locator('body');
  await page.evaluate(() => {
    const body = document.createElement('div');
    body.dataset.tile = 'live';
    body.style.cssText = 'position:fixed;left:0;top:0;width:460px;background:#fff;z-index:9';
    body.innerHTML = window.ELEO.curve({ series: [{ points: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 3.5], [5, 5], [6, 4], [7, 2]], index: 0, label: 'S' }], x: { range: [0, 7] }, y: { range: [0, 5] }, width: 460, height: 260 });
    document.body.append(body);
    window.STOP = window.ELEO.interact(body);
  });
  const tip = light.locator('[data-tile="live"] .eleo-hover__tip');
  await expect(tip, 'exists before any hover').toHaveCount(1);
  await expect(tip).toHaveAttribute('role', 'status');
  await expect(tip).toHaveAttribute('aria-live', 'polite');
  await expect(tip).toHaveText('');
  await expect(tip).toBeHidden();
  await tip.evaluate((el) => { window.TIP = el; });
  const p = await drawnAt(light, 'live', 0, 3);
  await page.mouse.move(p.clientX, p.clientY);
  await expect(tip).toBeVisible();
  await expect(tip).not.toHaveText('');
  await page.mouse.move(2, 2);
  await expect(tip, 'hidden again on leave').toBeHidden();
  await expect(tip).toHaveText('');
  expect(await tip.evaluate((el) => el === window.TIP), 'same element').toBe(true);
  expect(await tip.evaluate((el) => el.style.padding + el.style.borderWidth), 'hidden by CSS :empty, not inline style').toBe('');
  await page.mouse.move(p.clientX, p.clientY);
  await expect(tip).toBeVisible();
  expect(await tip.evaluate((el) => el === window.TIP), 'same element after re-hover').toBe(true);
  await page.evaluate(() => window.STOP());
  await expect(tip, 'removed by stop').toHaveCount(0);
});

// #869, #871: a redraw after interact replaces the host's markup; the observer puts the empty live region back at once.
test('live region survives a redraw', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => {
    const body = document.createElement('div');
    body.dataset.tile = 'redraw';
    body.style.cssText = 'position:fixed;left:0;top:0;width:460px;height:260px;background:#fff;z-index:9';
    document.body.append(body);
    window.STOP = window.ELEO.interact(body);
    body.innerHTML = window.ELEO.curve({ series: [{ points: [[0, 1], [1, 2], [2, 3]], index: 0, label: 'S' }], x: { range: [0, 7] }, y: { range: [0, 5] }, width: 460, height: 260 });
  });
  const tip = page.locator('[data-tile="redraw"] .eleo-hover__tip');
  await page.mouse.move(700, 500);
  await page.mouse.move(440, 4); // onto the host, far from every point
  await expect(tip, 'back after the redraw').toHaveCount(1);
  await expect(tip).toHaveAttribute('role', 'status');
  await expect(tip).toHaveText('');
  await page.evaluate(() => window.STOP());
  await expect(tip, 'removed by stop').toHaveCount(0);
  await page.mouse.move(700, 500);
  await page.mouse.move(440, 4);
  await expect(tip, 'no listener after stop').toHaveCount(0);
});

// #881: the live region is written only when its text changes; moves that keep the text leave it untouched.
test('tooltip writes only changed text', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const light = page.locator('body');
  await page.evaluate(() => {
    const body = document.createElement('div');
    body.dataset.tile = 'writes';
    body.style.cssText = 'position:fixed;left:0;top:0;width:460px;background:#fff;z-index:9';
    body.innerHTML = window.ELEO.curve({ series: [{ points: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 3.5], [5, 5], [6, 4], [7, 2]], index: 0, label: 'S' }], x: { range: [0, 7] }, y: { range: [0, 5] }, width: 460, height: 260 });
    document.body.append(body);
    window.STOP = window.ELEO.interact(body);
  });
  const tip = light.locator('[data-tile="writes"] .eleo-hover__tip');
  const p = await drawnAt(light, 'writes', 0, 3);
  await page.mouse.move(p.clientX, p.clientY);
  await expect(tip).not.toHaveText('');
  const text = await tip.textContent();
  await tip.evaluate((el) => {
    window.MUT = 0;
    window.OBS = new MutationObserver((r) => { window.MUT += r.length; });
    window.OBS.observe(el, { childList: true, characterData: true, subtree: true });
  });
  for (const d of [0, 0, 0.2, -0.2, 0]) await page.mouse.move(p.clientX + d, p.clientY);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
  expect(await tip.textContent(), 'text unchanged by the tiny moves').toBe(text);
  expect(await page.evaluate(() => window.MUT + window.OBS.takeRecords().length), 'no mutation for unchanged text').toBe(0);
  const q = await drawnAt(light, 'writes', 0, 5);
  await page.mouse.move(q.clientX, q.clientY);
  await expect(tip, 'a changed reading is written').not.toHaveText(text);
  await page.evaluate(() => { window.OBS.disconnect(); window.STOP(); });
});

// #871: a redraw under a pointer already inside the host re-adds the empty live region at once, with no move.
test('live region survives a redraw under the pointer', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => {
    const body = document.createElement('div');
    body.dataset.tile = 'under';
    body.style.cssText = 'position:fixed;left:0;top:0;width:460px;height:260px;background:#fff;z-index:9';
    document.body.append(body);
    window.DRAW = () => { body.innerHTML = window.ELEO.curve({ series: [{ points: [[0, 1], [1, 2], [2, 3]], index: 0, label: 'S' }], x: { range: [0, 7] }, y: { range: [0, 5] }, width: 460, height: 260 }); };
    window.DRAW();
    window.STOP = window.ELEO.interact(body);
  });
  const tip = page.locator('[data-tile="under"] .eleo-hover__tip');
  await page.mouse.move(700, 500);
  await page.mouse.move(440, 4); // inside the host, far from every point
  await expect(tip).toHaveCount(1);
  await page.evaluate(() => window.DRAW());
  await expect(tip, 'back with no move').toHaveCount(1);
  await expect(tip).toHaveAttribute('role', 'status');
  await expect(tip).toHaveText('');
  await page.evaluate(() => window.STOP());
  await expect(tip, 'removed by stop').toHaveCount(0);
  await page.evaluate(() => window.DRAW());
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
  await expect(tip, 'nothing re-added after stop').toHaveCount(0);
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

// #875 (CR #874): between two points of a drawn segment the hover is the pointer projected onto the segment, its data coordinates linearly interpolated; within 6 px of a point it snaps.
test('hover reads between data points', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  // Where data (x, y) is drawn in client px: the group's matrix attribute, the viewport's x/y and the root's client box, never getScreenCTM.
  const setup = (points) => page.evaluate((points) => {
    document.querySelectorAll('#seg-host').forEach((h) => h.remove());
    const host = document.createElement('div');
    host.id = 'seg-host';
    host.style.cssText = 'position:fixed;left:0;top:0;width:400px;background:#fff;z-index:9';
    host.innerHTML = window.ELEO.curve({ series: [{ points, index: 0 }], x: { range: [0, 10] }, y: { range: [0, 10] }, width: 400, height: 300 });
    document.body.append(host);
    window.HOVER = [];
    window.STOP = window.ELEO.interact(host, { onhover: (ev) => window.HOVER.push(ev) });
    const group = host.querySelector('[data-series]').parentNode;
    const [a, , , d, e, f] = group.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
    const vp = group.closest('svg'), root = vp.ownerSVGElement || vp, box = root.getBoundingClientRect(), k = box.width / root.viewBox.baseVal.width;
    const vx = +(vp.getAttribute('x') || 0), vy = +(vp.getAttribute('y') || 0);
    window.AT = (x, y) => [box.left + (vx + a * x + e) * k, box.top + (vy + d * y + f) * k];
    return { a, d, k };
  }, points);
  const at = (x, y) => page.evaluate(([x, y]) => window.AT(x, y), [x, y]);
  const last = () => page.evaluate(() => window.HOVER.at(-1));
  const vis = (sel) => page.locator(`#seg-host ${sel}:visible`).count();

  const m = await setup([[0, 0], [10, 10]]);
  let [px, py] = await at(5, 5);
  await page.mouse.move(px, py);
  let ev = await last();
  expect(ev, 'midpoint hovered').toBeTruthy();
  expect(Math.abs(ev.x - 5) * Math.abs(m.a) * m.k, 'x within 0.5 px').toBeLessThanOrEqual(0.5);
  expect(Math.abs(ev.y - 5) * Math.abs(m.d) * m.k, 'y within 0.5 px').toBeLessThanOrEqual(0.5);
  expect(ev.interpolated).toBe(true);
  expect(ev.segment).toEqual([0, 1]);
  await expect(page.locator('#seg-host .eleo-hover__tip')).toHaveText('5, 5');
  expect(await vis('.eleo-hover__v'), 'vertical drop line shown').toBe(1);
  expect(await vis('.eleo-hover__h'), 'horizontal drop line shown').toBe(1);
  expect(await vis('.eleo-hover__dot'), 'dot hidden').toBe(0);

  // 3 px from (10, 10), along the line: snaps to the point.
  [px, py] = await at(10, 10);
  await page.mouse.move(px - 2, py + 2);
  ev = await last();
  expect(ev.x).toBe(10);
  expect(ev.y).toBe(10);
  expect(ev.interpolated, 'snapped, not interpolated').toBeUndefined();
  expect(await vis('.eleo-hover__dot'), 'dot shown on a snap').toBe(1);

  // Across a NaN gap nothing interpolates: the pointer over the middle of the dropped stretch hovers nothing.
  await page.evaluate(() => window.STOP());
  await setup([[0, 0], [5, NaN], [10, 10]]);
  [px, py] = await at(5, 5);
  await page.mouse.move(2, 2);
  await page.mouse.move(px, py);
  expect(await page.evaluate(() => window.HOVER.filter(Boolean)), 'no segment across the gap').toEqual([]);
  await page.evaluate(() => window.STOP());
});
