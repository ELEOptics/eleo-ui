// Interaction (plan #804, agent_docs/plans/804-interaction.md), M1 outcome O1 for curve (issue #805; #812 unskips). Run after `npm run build`.
// oracle: property round trip through the inverse transform (roadmap U13).
// The pointer is placed at a data point's drawn position computed from the
// data group's `matrix(...)` attribute, the nested viewport's x/y and the SVG's getBoundingClientRect, never from getScreenCTM, which `interact` uses;
// the hover event must carry that point's data coordinates within TOL_PX (tests/unit/helpers/svg.js).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TOL_PX } from './unit/helpers/svg.js';

// The data group of a tile's first series, and where data point (dx, dy) is drawn in client px.
const drawnAt = (page, tile, series, index) => page.locator(`[data-tile="${tile}"] polyline[data-series="${series}"], [data-tile="${tile}"] path[data-series="${series}"]`).first()
  .evaluate((mark, index) => {
    const group = mark.parentNode;
    const [a, , , d, e, f] = group.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
    // The drawn points: parse the attribute string (strip M/L and h<n>, split on commas and spaces) and drop non-finite pairs only. Not used on a polyline holding NaN: interact's runs() reads those points from the browser's own parse (mark.points), which this does not mirror.
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

// #904: a series mark's matrix group, found by closest(), is its parentNode on a curve tile.
test('a series mark sits directly in its matrix data group', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const same = await page.locator('.theme[data-theme="light"] [data-tile="mtf"] [data-series]').first()
    .evaluate((mark) => mark.closest('g[transform^="matrix("]') === mark.parentNode);
  expect(same).toBe(true);
});

// #845: a non-finite coordinate drops its point; it never shifts x and y of the points after it.
test('non-finite points are skipped', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  // A panels curve draws a <path> that breaks at the gap, so each side reads and the gap reads nothing; Chromium draws nothing of a single-plot <polyline> holding a NaN, so it reads nothing, before the NaN or after.
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
  // the oracle this rests on: Chromium parses no point of a polyline holding a NaN, and hover reads the browser's parse
  expect(await page.evaluate(() => document.querySelector('#nan-host polyline').points.numberOfItems), 'Chromium parses no point of the NaN polyline').toBe(0);
  // Chromium draws nothing of a polyline with a NaN: nothing before it, nothing after it
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
  // The lines are --line-strong and dashed: their painted colour is the resolved --line-strong (read off a probe in the same themed tile), not --plot-grid's, and the paint is a repeating gradient, not a solid fill.
  const colours = await light.locator(`[data-tile="${tile}"]`).evaluate((tileEl) => {
    const resolve = (v) => { const probe = document.createElement('i'); probe.style.color = `var(${v})`; tileEl.appendChild(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; };
    return { strong: resolve('--line-strong'), grid: resolve('--plot-grid') };
  });
  expect(colours.strong, '--line-strong differs from --plot-grid').not.toBe(colours.grid);
  for (const k of ['v', 'h']) {
    const css = await light.locator(`[data-tile="${tile}"] .eleo-hover__${k}`).first().evaluate((el) => { const c = getComputedStyle(el); return { img: c.backgroundImage, bg: c.backgroundColor }; });
    expect(css.img, `${k} line is dashed`).toContain('repeating-linear-gradient');
    expect(css.img, `${k} line in --line-strong`).toContain(colours.strong);
    expect(css.img, `${k} line not in the grid colour`).not.toContain(colours.grid);
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

// ---- Plan #804 M2 (issue #813): O1 for the rest of the 2D plots and O2.
// oracle: property round trip through the inverse transform (roadmap U13), as above: the pointer is placed from the data group's `matrix(...)` attribute (the nearest `g[transform^="matrix("]` of the mark, since layout2D nests its runs in opacity groups),
// the nested viewport's x/y, any `translate(...)` between it and the root, and the root's getBoundingClientRect, never getScreenCTM. The expected values come from the recorded fixtures (tests/fixtures/phos-core/) for the recorded tiles;
// throughFocus and the synthetic hosts are checked against the drawn point itself.
// Contract these tests fix for the M2 items (index.d.ts is written by #819): the event names a mark by the same keys as its data-* attributes: `series` ({ index, label?, role? }), `panel`, `category` (the bar's data-category, compared as text),
// `field`, `ray`, `status` (layout runs), `surface` (select only); a bar's `y` is its value; a map's hover carries `row` and `column` (rows top-down as `values[row][column]`) and, given `opts.values`, `value`.

const LIGHT = '.theme[data-theme="light"]';
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/phos-core/${name}.json`, import.meta.url), 'utf8'));
// The reference-wavelength result of a Seidel recording and the recorded wavelength nearest the reference, as adapters.js reads them.
const nearestTo = (list, ref) => list.reduce((best, v, i) => (Math.abs(v - ref) < Math.abs(list[best] - ref) ? i : best), 0);

// Page-side helpers on window.T, installed once per page after the gallery is ready. All geometry comes from attributes, never getScreenCTM.
const install = (page) => page.evaluate(() => {
  const nums = (s) => s.replace(/h\s*-?[\d.]+/g, ' ').replace(/[ML]/g, ' ').split(/[\s,]+/).filter(Boolean).map(Number);
  // A mark's drawn points in its data units: the finite pairs of a polyline, polygon or path (a dot's `h0` adds none), the centre of a rect, a line's ends.
  const pts = (m) => {
    if (m.tagName === 'rect') { const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => +m.getAttribute(k)); return [[x + w / 2, y + h / 2]]; }
    if (m.tagName === 'line') return [[+m.getAttribute('x1'), +m.getAttribute('y1')], [+m.getAttribute('x2'), +m.getAttribute('y2')]];
    const n = nums(m.getAttribute('points') || m.getAttribute('d') || ''), out = [];
    for (let i = 0; i + 1 < n.length; i += 2) if (Number.isFinite(n[i]) && Number.isFinite(n[i + 1])) out.push([n[i], n[i + 1]]);
    return out;
  };
  // data -> client px for a mark: its data group's matrix, the viewport's x/y, the translate of a panel wrapper, the root's client box.
  const proj = (m) => {
    const group = m.closest('g[transform^="matrix("]');
    const [a, , , d, e, f] = group.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
    const vp = group.closest('svg'), root = vp.ownerSVGElement || vp, box = root.getBoundingClientRect(), k = box.width / root.viewBox.baseVal.width;
    let tx = 0, ty = 0;
    if (vp !== root) for (let g = vp.parentNode; g && g !== root; g = g.parentNode) {
      const t = (g.getAttribute('transform') || '').match(/translate\(([^)]*)\)/);
      if (t) { const [u, v] = t[1].split(/[\s,]+/).map(Number); tx += u; ty += v || 0; }
    }
    const vx = vp === root ? 0 : +(vp.getAttribute('x') || 0), vy = vp === root ? 0 : +(vp.getAttribute('y') || 0);
    const to = (p) => [box.left + (tx + vx + a * p[0] + e) * k, box.top + (ty + vy + d * p[1] + f) * k];
    return Object.assign(to, { a, d, k });
  };
  const MARKS = '[data-series],[data-field],[data-surface]';
  // Every identified mark of the host with its points in client px.
  const all = (host) => [...host.querySelectorAll(MARKS)].map((m) => { const to = proj(m); return { m, to, c: pts(m).map((p) => to(p)) }; });
  // True when no drawn point of any mark but (skip, i) lies within px client px of (x, y).
  const clear = (list, x, y, px, skip, i) => list.every((o) => o.c.every((c, j) => (o.m === skip && j === i) || Math.hypot(c[0] - x, c[1] - y) >= px));
  window.T = {
    pts, proj,
    // The first point of mark m (searching from its middle) that no other drawn point lies within px of, with its client position and the scales; null when none.
    pick(host, m, px, lo, hi) {
      m.scrollIntoView({ block: 'center' });
      const list = all(host), me = list.find((o) => o.m === m), n = me.c.length, start = Math.floor(n / 2);
      for (let s = 0; s < n; s++) {
        const i = (start + s) % n;
        if (i < (lo || 0) || i > n - 1 - (hi || 0)) continue;
        if (clear(list, me.c[i][0], me.c[i][1], px, m, i)) return { i, data: pts(m)[i], x: me.c[i][0], y: me.c[i][1], a: me.to.a, d: me.to.d, k: me.to.k, ds: { ...m.dataset } };
      }
      return null;
    },
    // A long segment of one of the marks matching sel whose middle is at least px from every drawn point: where to read along a line.
    midpoint(host, sel, px, minLen) {
      for (const m of host.querySelectorAll(sel)) {
        m.scrollIntoView({ block: 'center' });
        const list = all(host), me = list.find((o) => o.m === m), p = pts(m);
        for (let i = 1; i < p.length; i++) {
          const [x0, y0] = me.c[i - 1], [x1, y1] = me.c[i], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          if (Math.hypot(x1 - x0, y1 - y0) >= minLen && clear(list, mx, my, px)) {
            return { segment: [i - 1, i], data: [(p[i - 1][0] + p[i][0]) / 2, (p[i - 1][1] + p[i][1]) / 2], x: mx, y: my, a: me.to.a, d: me.to.d, k: me.to.k, ds: { ...m.dataset } };
          }
        }
      }
      return null;
    },
    // The first point (vertex, segment middle or fill centre) of a mark matching sel at which the browser's own hit test finds that mark: where a click lands on it.
    hit(host, sel) {
      for (const m of host.querySelectorAll(sel)) {
        m.scrollIntoView({ block: 'center' });
        const to = proj(m), p = pts(m), probes = p.slice();
        for (let i = 1; i < p.length; i++) probes.push([(p[i - 1][0] + p[i][0]) / 2, (p[i - 1][1] + p[i][1]) / 2]);
        if (p.length > 2) probes.push([p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]);
        for (const q of probes) { const [x, y] = to(q); if (document.elementFromPoint(x, y) === m) return { x, y, ds: { ...m.dataset } }; }
      }
      return null;
    },
    // Where fraction (fx, fy) of the first (map) <image> lies in client px, and its box, from its x/y/width/height attributes and the root's client box.
    image(host, fx, fy) {
      const img = host.querySelector('svg image'), root = img.ownerSVGElement, box = root.getBoundingClientRect(), k = box.width / root.viewBox.baseVal.width;
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((q) => +img.getAttribute(q));
      img.scrollIntoView({ block: 'center' });
      const b2 = root.getBoundingClientRect();
      return { x: b2.left + (x + fx * w) * k, y: b2.top + (y + fy * h) * k, wpx: w * k, hpx: h * k, left: b2.left + x * k, top: b2.top + y * k };
    },
  };
});

// Opens the gallery with the helpers, binds interact on a light tile's body and returns once the tile is in view. `values` is a map's recorded values.
async function bind(page, tile, values) {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await install(page);
  await page.evaluate(({ tile, values }) => {
    window.HOVER = []; window.SELECT = [];
    window.HOST = document.querySelector(`.theme[data-theme="light"] [data-tile="${tile}"] .eleo-plot__body`);
    window.STOP = window.ELEO.interact(window.HOST, { values, onhover: (ev) => window.HOVER.push(ev), onselect: (ev) => window.SELECT.push(ev) });
  }, { tile, values });
  await page.locator(`${LIGHT} [data-tile="${tile}"]`).scrollIntoViewIfNeeded();
}
// The hover event after the pointer arrives at (x, y) from outside the host (null when nothing is hovered).
async function hoverAt(page, x, y) {
  await page.mouse.move(2, 2);
  await page.evaluate(() => { window.HOVER = []; });
  await page.mouse.move(x, y);
  return page.evaluate(() => window.HOVER.at(-1) ?? null);
}
// The event's (x, y) against the wanted data point, in client px along each axis, using the scales of the mark it was placed on.
const within = (ev, want, p, what) => {
  expect(Math.abs(ev.x - want[0]) * Math.abs(p.a) * p.k, `${what} x within TOL_PX`).toBeLessThanOrEqual(TOL_PX);
  expect(Math.abs(ev.y - want[1]) * Math.abs(p.d) * p.k, `${what} y within TOL_PX`).toBeLessThanOrEqual(TOL_PX);
};
// The event names the mark's own data-* identity.
const names = (ev, ds, what) => {
  expect(ev.series.index, `${what} series`).toBe(+ds.series);
  if (ds.panel !== undefined) expect(ev.panel, `${what} panel`).toBe(+ds.panel);
  else expect(ev.panel, `${what} has no panel`).toBeUndefined();
};

// #814 (O1, spot): the recorded achromat spot tile. A dot under the pointer reads that dot, with its panel (field) and series (wavelength); the recorded point is the oracle, in µm as the adapter draws it.
test('spot hover emits the dot under the pointer', async ({ page }) => {
  const rec = fixture('achromat-spot');
  await bind(page, 'spot');
  const panel = rec.sources.length - 1, series = 1;
  const p = await page.evaluate(({ panel, series }) => window.T.pick(window.HOST, window.HOST.querySelector(`path[data-panel="${panel}"][data-series="${series}"]`), 8), { panel, series });
  expect(p, 'an isolated dot on the largest field').not.toBeNull();
  const ev = await hoverAt(page, p.x, p.y);
  expect(ev, 'dot hovered').not.toBeNull();
  names(ev, p.ds, 'spot');
  expect(ev.series.index).toBe(series);
  expect(ev.panel).toBe(panel);
  expect(ev.interpolated, 'dots snap only').toBeUndefined();
  within(ev, rec.sources[panel].points[series][p.i].map((v) => v * 1000), p, 'recorded point');
  await page.mouse.move(2, 2);
  expect(await page.evaluate(() => window.HOVER.at(-1)), 'leaving emits null').toBeNull();
  await page.evaluate(() => window.STOP());
});

// #814 (O1, footprint): the recorded Cooke beam footprint at the stop, in mm, one series per field at the reference wavelength.
test('footprint hover emits the point under the pointer', async ({ page }) => {
  const rec = fixture('cooke-footprint');
  await bind(page, 'footprint');
  const series = 1, w = nearestTo(rec.sources[series].wavelengths, rec.referenceWavelengthNm);
  const p = await page.evaluate((series) => window.T.pick(window.HOST, window.HOST.querySelector(`path[data-series="${series}"]`), 8), series);
  expect(p, 'an isolated point on field 1').not.toBeNull();
  const ev = await hoverAt(page, p.x, p.y);
  expect(ev, 'point hovered').not.toBeNull();
  names(ev, p.ds, 'footprint');
  expect(ev.series.index).toBe(series);
  within(ev, rec.sources[series].points[w][p.i], p, 'recorded point');
  await page.evaluate(() => window.STOP());
});

// #814 (O1, throughFocus): the synthetic through-focus tile has no recording; the drawn dot is the oracle, with the series and panel its mark carries.
test('throughFocus hover emits the dot under the pointer', async ({ page }) => {
  await bind(page, 'throughFocus');
  const p = await page.evaluate(() => { for (const m of window.HOST.querySelectorAll('path[data-series][data-panel]')) { const q = window.T.pick(window.HOST, m, 8); if (q) return q; } return null; });
  expect(p, 'an isolated dot').not.toBeNull();
  const ev = await hoverAt(page, p.x, p.y);
  expect(ev, 'dot hovered').not.toBeNull();
  names(ev, p.ds, 'throughFocus');
  expect(ev.interpolated, 'dots snap only').toBeUndefined();
  within(ev, p.data, p, 'drawn dot');
  await page.evaluate(() => window.STOP());
});

// #814: dots are not joined. Own host, three far-apart dots: 12 px off a dot (outside the 6 px snap, inside the 24 px reach) still reads that dot, never an interpolation; the middle of the gap between two dots reads nothing.
test('spot dots are never interpolated', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await install(page);
  const p = await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:400px;background:#fff;z-index:9';
    host.innerHTML = window.ELEO.spot({ panels: [{ title: 'a', series: [{ index: 0, points: [[0, 0], [1, 1], [-1, 0.5]] }] }], width: 400 });
    document.body.append(host);
    window.HOST = host; window.HOVER = [];
    window.STOP = window.ELEO.interact(host, { onhover: (ev) => window.HOVER.push(ev) });
    const m = host.querySelector('path[data-series]'), to = window.T.proj(m), pts = window.T.pts(m);
    return { dot: to(pts[0]), other: to(pts[1]), a: to.a, d: to.d, k: to.k };
  });
  const ev = await hoverAt(page, p.dot[0] + 12, p.dot[1]);
  expect(ev, 'a dot 12 px away still reads').not.toBeNull();
  within(ev, [0, 0], p, 'the dot');
  expect(ev.interpolated, 'a dot is not a line').toBeUndefined();
  expect(ev.segment).toBeUndefined();
  expect(await hoverAt(page, (p.dot[0] + p.other[0]) / 2, (p.dot[1] + p.other[1]) / 2), 'between two dots reads nothing').toBeNull();
  await page.evaluate(() => window.STOP());
});

// #893 (O1, bars): the recorded achromat Seidel tile. The pointer in the middle of the bar with the largest recorded value reads that bar: its series, its category and its value (the rect's height through the transform).
test('bar hover', async ({ page }) => {
  const rec = fixture('achromat-seidel');
  const res = rec.results[nearestTo(rec.results.map((r) => r.wavelengthNm), rec.referenceWavelengthNm)];
  const terms = ['spherical', 'coma', 'astigmatism', 'fieldCurvature', 'distortion', 'axialColor', 'lateralColor'];
  let best = { v: 0 };
  terms.forEach((t, s) => res.terms[t].slice(0, -1).forEach((v, c) => { if (Math.abs(v) > Math.abs(best.v)) best = { v, s, c }; }));
  await bind(page, 'seidel');
  const p = await page.evaluate(({ s, c }) => {
    const m = window.HOST.querySelectorAll(`rect[data-series="${s}"]`)[c];
    m.scrollIntoView({ block: 'center' });
    const to = window.T.proj(m), [x, y] = to(window.T.pts(m)[0]);
    return { x, y, a: to.a, d: to.d, k: to.k, ds: { ...m.dataset } };
  }, best);
  const ev = await hoverAt(page, p.x, p.y);
  expect(ev, `bar of series ${best.s}, category ${best.c} hovered`).not.toBeNull();
  expect(ev.series.index).toBe(best.s);
  expect(String(ev.category), 'the rect\'s own category').toBe(p.ds.category);
  expect(Math.abs(ev.y - best.v) * Math.abs(p.d) * p.k, 'value within TOL_PX').toBeLessThanOrEqual(TOL_PX);
  // Nothing between bars: the gap after this category's group (data x = category + 1, at half the bar's height), and just past the bar's value end.
  const q = await page.evaluate(({ s, c, v }) => {
    const m = window.HOST.querySelectorAll(`rect[data-series="${s}"]`)[c], to = window.T.proj(m), dy = 9 / (Math.abs(to.d) * to.k);
    return { gap: to([+m.dataset.category + 1, v / 2]), past: to([+m.getAttribute('x') + +m.getAttribute('width') / 2, v + Math.sign(v) * dy]) };
  }, best);
  expect(await hoverAt(page, q.gap[0], q.gap[1]), 'the gap between bars hovers nothing').toBeNull();
  expect(await hoverAt(page, q.past[0], q.past[1]), 'above the bar\'s value end hovers nothing').toBeNull();
  await page.mouse.move(p.x, p.y);
  await page.mouse.move(2, 2);
  expect(await page.evaluate(() => window.HOVER.at(-1)), 'leaving emits null').toBeNull();
  // A bar under a pixel tall (the light Seidel tile has them) is hovered within SNAP of its value end, 3 px past it; 9 px past it nothing.
  const tiny = await page.evaluate(({ terms, n }) => {
    let best = null;
    for (let s = 0; s < terms; s++) window.HOST.querySelectorAll(`rect[data-series="${s}"]`).forEach((m, c) => {
      const to = window.T.proj(m), h = +m.getAttribute('height') * Math.abs(to.d) * to.k;
      if (h < 1 && (!best || h < best.h)) best = { s, c, h };
    });
    if (!best) return null;
    const m = window.HOST.querySelectorAll(`rect[data-series="${best.s}"]`)[best.c];
    m.scrollIntoView({ block: 'center' });
    const to = window.T.proj(m);
    const ry = +m.getAttribute('y'), rh = +m.getAttribute('height'), v = ry < 0 ? ry : rh, sg = v < 0 ? -1 : 1, px = +m.getAttribute('x') + +m.getAttribute('width') / 2;
    const at = (k) => to([px, v + sg * k / (Math.abs(to.d) * to.k)]);
    return { s: best.s, h: best.h, v, near: at(3), far: at(9) };
  }, { terms: terms.length, n: 0 });
  expect(tiny, 'a sub-pixel bar exists on the tile').not.toBeNull();
  const tev = await hoverAt(page, tiny.near[0], tiny.near[1]);
  expect(tev, 'sub-pixel bar hovered 3 px past its value end').not.toBeNull();
  expect(tev.series.index).toBe(tiny.s);
  expect(await hoverAt(page, tiny.far[0], tiny.far[1]), '9 px past a sub-pixel bar hovers nothing').toBeNull();
  // CR #920: the tooltip reads `<series label> · <category label as drawn>, <value> <unit>`; the first surface is labelled 1, so category index c reads c + 1. The event carries both labels.
  await page.evaluate(() => window.STOP());
  await page.evaluate(() => {
    window.HOVER = [];
    window.STOP = window.ELEO.interact(window.HOST, { axes: { y: { unit: 'mm' } }, onhover: (ev) => window.HOVER.push(ev) });
  });
  const lab = ['SI', 'SII', 'SIII', 'SIV', 'SV', 'CL', 'CT'][best.s], cat = String(best.c + 1);
  const p2 = await page.evaluate(({ s, c }) => {
    const m = window.HOST.querySelectorAll(`rect[data-series="${s}"]`)[c];
    m.scrollIntoView({ block: 'center' });
    const [x, y] = window.T.proj(m)(window.T.pts(m)[0]);
    return { x, y };
  }, best);
  const lev = await hoverAt(page, p2.x, p2.y);
  expect(lev, 'the bar is hovered again').not.toBeNull();
  expect(lev.series.label, 'the event carries the series label').toBe(lab);
  expect(lev.categoryLabel, 'the event carries the category label as drawn').toBe(cat);
  const v2 = Math.abs(best.v).toFixed(2).replace(/\.?0+$/, '');
  expect(await page.locator(`${LIGHT} [data-tile="seidel"] .eleo-hover__tip`).last().textContent()).toBe(`${lab} · ${cat}, ${best.v < 0 ? '\u2212' : ''}${v2} mm`);
  await page.evaluate(() => window.STOP());
});

// #817 (O1, typed map): the recorded Cooke PSF tile. The pointer at the centre of cell (row, column) reads the cell's indices, the data coordinates of its centre and, given the recorded values, its value (the recording is the oracle, cells chosen to differ).
test('map hover value', async ({ page }) => {
  const rec = fixture('cooke-psf');
  const rows = rec.values.length, cols = rec.values[0].length, [x0, x1, y0, y1] = rec.extent;
  const cells = [[Math.floor(rows / 2), Math.floor(cols / 2)], [10, 150], [170, 20]];
  expect(new Set(cells.map(([r, c]) => rec.values[r][c])).size, 'the chosen cells hold different values').toBe(3);
  await bind(page, 'psf-recorded', rec.values);
  for (const [r, c] of cells) {
    const q = await page.evaluate(([fx, fy]) => window.T.image(window.HOST, fx, fy), [(c + 0.5) / cols, (r + 0.5) / rows]);
    const ev = await hoverAt(page, q.x, q.y);
    expect(ev, `cell ${r},${c} hovered`).not.toBeNull();
    expect(ev.row, 'row').toBe(r);
    expect(ev.column, 'column').toBe(c);
    expect(ev.value, 'recorded value').toBe(rec.values[r][c]);
    expect(Math.abs(ev.x - (x0 + (c + 0.5) * (x1 - x0) / cols)) * q.wpx / (x1 - x0), 'x of the cell centre within TOL_PX').toBeLessThanOrEqual(TOL_PX);
    expect(Math.abs(ev.y - (y1 - (r + 0.5) * (y1 - y0) / rows)) * q.hpx / (y1 - y0), 'y of the cell centre within TOL_PX').toBeLessThanOrEqual(TOL_PX);
  }
  // beyond the image, inside the host: nothing
  const q = await page.evaluate(() => window.T.image(window.HOST, 0, 0));
  expect(await hoverAt(page, q.left - 6, q.top - 6), 'outside the image reads nothing').toBeNull();
  await page.evaluate(() => window.STOP());
  // #910: a masked (NaN) cell reads value null and the tooltip carries no " = "
  const [mr, mc] = cells[0], masked = rec.values.map((row) => row.slice());
  masked[mr][mc] = NaN;
  await page.evaluate((values) => { window.STOP = window.ELEO.interact(window.HOST, { values, onhover: (ev) => window.HOVER.push(ev) }); }, masked);
  const mq = await page.evaluate(([fx, fy]) => window.T.image(window.HOST, fx, fy), [(mc + 0.5) / cols, (mr + 0.5) / rows]);
  const mev = await hoverAt(page, mq.x, mq.y);
  expect([mev.row, mev.column], 'masked cell hovered').toEqual([mr, mc]);
  expect(mev.value, 'a NaN cell reads null').toBeNull();
  const tip = await page.evaluate(() => { const t = window.HOST.querySelectorAll('.eleo-hover__tip'); return t.length ? t[t.length - 1].textContent : null; });
  expect(tip, 'the tooltip names the cell').toMatch(/\d/);
  expect(tip, 'no value in the tooltip').not.toContain(' = ');
  await page.evaluate(() => window.STOP());
  // without values the indices are still read and no value is claimed
  await page.evaluate(() => { window.STOP = window.ELEO.interact(window.HOST, { onhover: (ev) => window.HOVER.push(ev) }); });
  const [r, c] = cells[0], m = await page.evaluate(([fx, fy]) => window.T.image(window.HOST, fx, fy), [(cells[0][1] + 0.5) / cols, (cells[0][0] + 0.5) / rows]);
  const ev = await hoverAt(page, m.x, m.y);
  expect([ev.row, ev.column], 'indices without values').toEqual([r, c]);
  expect(ev.value, 'no value without opts.values').toBeUndefined();
  await page.evaluate(() => window.STOP());
});

// #817 (O1, polar map): the recorded Cooke wavefront tile. The pointer on a recorded sample reads its ring and spoke (indices into the recorded radii and angles), its value and its position; beyond the outer ring nothing.
test('polar map hover value', async ({ page }) => {
  const rec = fixture('cooke-wavefront'), [R, A] = [rec.radii, rec.angles], e = rec.pupilRadius * 1.05;
  const samples = [[5, 7], [40, 30], [60, 50]].filter(([i, j]) => rec.values[i][j] != null);
  expect(samples.length, 'unmasked samples chosen').toBe(3);
  await bind(page, 'wavefront-recorded', rec.values);
  for (const [i, j] of samples) {
    const wx = R[i] * Math.cos(A[j]), wy = R[i] * Math.sin(A[j]);
    const q = await page.evaluate(([fx, fy]) => window.T.image(window.HOST, fx, fy), [(wx + e) / (2 * e), (e - wy) / (2 * e)]);
    const ev = await hoverAt(page, q.x, q.y);
    expect(ev, `sample ${i},${j} hovered`).not.toBeNull();
    expect([ev.ring, ev.spoke], 'ring and spoke').toEqual([i, j]);
    expect(ev.value, 'recorded value').toBe(rec.values[i][j]);
    expect(Math.hypot(ev.x - wx, ev.y - wy) * q.wpx / (2 * e), 'position of the sample within TOL_PX').toBeLessThanOrEqual(TOL_PX);
  }
  const q = await page.evaluate(() => window.T.image(window.HOST, 0, 0));
  expect(await hoverAt(page, q.left + 1, q.top + 1), 'beyond the outer ring reads nothing').toBeNull();
  await page.evaluate(() => window.STOP());
});

// #894 (O1, layout): the recorded Wandersleb layout. A ray point reads that run's field, ray and status and the point (z, y in mm); the point is also one the recording holds.
test('layout ray hover', async ({ page }) => {
  const rec = fixture('wandersleb-layout');
  await bind(page, 'layout2D-wandersleb');
  const sel = 'polyline[data-field="0"][data-ray="0"]';
  const p = await page.evaluate((sel) => {
    for (const m of window.HOST.querySelectorAll(sel)) { const p = window.T.pick(window.HOST, m, 2, 1, 1); if (p) return p; }
    return null;
  }, sel);
  expect(p, 'an isolated interior point on field 0, ray 0').not.toBeNull();
  const ev = await hoverAt(page, p.x, p.y);
  expect(ev, 'ray point hovered').not.toBeNull();
  expect(ev.field, 'field').toBe(+p.ds.field);
  expect(ev.ray, 'ray').toBe(+p.ds.ray);
  expect(ev.status, 'status of the run').toBe(p.ds.status);
  expect(ev.interpolated, 'snapped, not interpolated').toBeUndefined();
  within(ev, p.data, p, 'drawn point');
  expect(rec.rays[0][0].some((q) => Math.hypot(q[0] - ev.x, q[1] - ev.y) <= 0.01), 'the point is one the recording holds').toBe(true);
  // #907: a layout has no axes frame, so the hover draws the dot and the tooltip but no drop lines.
  const vis = (sel) => page.evaluate((sel) => [...window.HOST.querySelectorAll(sel)].filter((e) => !e.hidden).length, sel);
  expect(await vis('.eleo-hover__dot'), 'dot shown').toBeGreaterThan(0);
  expect(await vis('.eleo-hover__v'), 'no vertical drop line').toBe(0);
  expect(await vis('.eleo-hover__h'), 'no horizontal drop line').toBe(0);
  await page.evaluate(() => window.STOP());
});

// #894: between two points of a run the reading is along the run, flagged interpolated, with the run's field and ray.
test('layout ray hover reads along a run', async ({ page }) => {
  await bind(page, 'layout2D-wandersleb');
  const p = await page.evaluate(() => window.T.midpoint(window.HOST, 'polyline[data-field][data-ray]', 8, 40));
  expect(p, 'a long segment whose middle is clear of every drawn point').not.toBeNull();
  const ev = await hoverAt(page, p.x, p.y);
  expect(ev, 'segment middle hovered').not.toBeNull();
  expect(ev.interpolated).toBe(true);
  expect(ev.field).toBe(+p.ds.field);
  expect(ev.ray).toBe(+p.ds.ray);
  within(ev, p.data, p, 'segment middle');
  await page.evaluate(() => window.STOP());
});

// #819 (O2): a click on a mark emits one select event naming that mark by its own data-* identity, and changes no markup. Marks are found with the browser's own hit test, so the click lands on the mark.
test('select events', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await install(page);
  const cases = [
    ['mtf', 'polyline[data-series], path[data-series]', (ev, ds) => { names(ev, ds, 'curve'); }],
    ['spot', 'path[data-series][data-panel]', (ev, ds) => { names(ev, ds, 'spot'); }],
    ['seidel', 'rect[data-series][data-category]', (ev, ds) => { expect(ev.series.index, 'bar series').toBe(+ds.series); expect(String(ev.category), 'bar category').toBe(ds.category); }],
    ['layout2D-wandersleb', '[data-surface]', (ev, ds) => { expect(String(ev.surface), 'surface').toBe(ds.surface); }],
    ['layout2D-wandersleb', 'polyline[data-field][data-ray]', (ev, ds) => { expect(String(ev.field), 'field').toBe(ds.field); expect(ev.ray, 'a run names its field only').toBeUndefined(); }],
  ];
  for (const [tile, sel, check] of cases) {
    await bind(page, tile);
    const before = await page.evaluate(() => window.HOST.querySelector('svg').outerHTML);
    const p = await page.evaluate((sel) => window.T.hit(window.HOST, sel), sel);
    expect(p, `${tile}: a mark matching ${sel} the hit test finds`).not.toBeNull();
    await page.mouse.click(p.x, p.y);
    const got = await page.evaluate(() => window.SELECT);
    expect(got, `${tile}: one select event`).toHaveLength(1);
    check(got[0], p.ds);
    expect(await page.evaluate(() => window.HOST.querySelector('svg').outerHTML), `${tile}: markup unchanged`).toBe(before);
    await page.evaluate(() => window.STOP());
  }
});

// #911: a [data-series] mark outside any matrix group is foreign markup: interact skips it, hovers nothing and throws nothing.
test('foreign data-series markup is ignored', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await install(page);
  await page.evaluate(() => {
    window.HOVER = [];
    window.SELECT = [];
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;background:#fff;z-index:9999';
    host.innerHTML = '<svg width="200" height="200" viewBox="0 0 200 200"><path data-series="0" d="M0,0 L10,10" stroke="red"/><path data-field="2" data-series="0" d="M20,20 L30,30" stroke="blue"/></svg>';
    document.body.appendChild(host);
    window.HOST = host;
    window.STOP = window.ELEO.interact(host, { onhover: (ev) => window.HOVER.push(ev), onselect: (ev) => window.SELECT.push(ev) });
  });
  await page.mouse.move(150, 150);
  await page.mouse.move(5, 5);
  await page.mouse.move(6, 6);
  expect(await page.evaluate(() => window.HOVER.filter((ev) => ev !== null).length), 'nothing hovered').toBe(0);
  await page.evaluate(() => window.HOST.querySelector('path').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(await page.evaluate(() => window.SELECT.length), 'nothing selected').toBe(0);
  await page.evaluate(() => window.HOST.querySelectorAll('path')[1].dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(await page.evaluate(() => window.SELECT), 'a field mark carrying a stray data-series still selects its field').toEqual([{ field: 2 }]);
  expect(errors, 'no page error').toEqual([]);
  await page.evaluate(() => { window.STOP(); window.HOST.remove(); });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Zoom, pan and reset (plan #804 M3, outcome O5; issue #825 wrote them skipped, #833 unskipped them).
// oracle: closed-form zoom about a point (range' = p + (range - p) / k); property reset restores the original markup byte for byte (roadmap U13).
//
// The API these tests assume (#829 builds it; #826, #827, #828 add the renderers' `view`):
//  - `interact(el, { ..., onview })` still returns a function, so M1 and M2's `stop()` callers work. The function also has a `reset` method:
//    `stop.reset()`. A wheel over a plot zooms about the pointer (the default is prevented, so the page does not scroll), a pointer drag pans
//    (the data point grabbed stays under the pointer), a double-click resets. Each of these calls `onview(view)` and draws nothing itself:
//    the caller redraws with `view`. `interact` reads the current ranges from the drawn markup each time, so it holds no view of its own
//    and the caller's redraw (or a data redraw that keeps the caller's view) is the only state. Reset calls `onview(null)`: the caller then
//    redraws with no `view`, at its own ranges, which is why the markup comes back byte for byte.
//  - The `view` of each renderer, which is also the `onview` payload:
//      curve and rayFan  `{ x: [lo, hi], y: [lo, hi] }`, data units, either key optional on input (an absent one keeps the caller's range); both present on output.
//      spot, throughFocus `{ center: [cx, cy], half }`, a square window in the panel's unit, shared by every panel (the panels' common scale).
//      typed map2D       `{ x: [lo, hi], y: [lo, hi] }` in extent units; the <image> keeps its data extent, so its px box grows and moves, and the viewport clips it.
//  - The wheel factor per notch is the implementation's choice, so the tests read k off the event: k = old span / new span, equal on every axis
//    (and so for every panel), above 1 for deltaY < 0, and the reverse notch gives 1 / k.
//  - Geometry comes from attributes, never getScreenCTM: a data group's matrix(...), its nested viewport's x/y/width/height, the translate of a panel
//    wrapper, the root's viewBox and client box; a map's <image> x/y/width/height.
// ---------------------------------------------------------------------------------------------------------------------------

// Page-side: window.Z reads the drawn ranges of every data group of a host (the groups holding a [data-series] mark, in document order) and converts
// between data and client px with the matrix attribute alone.
const installZ = (page) => page.evaluate(() => {
  const frames = (host) => [...host.querySelectorAll('g[transform^="matrix("]')].filter((g) => g.querySelector('[data-series]')).map((g) => {
    const [a, , , d, e, f] = g.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
    const vp = g.closest('svg'), root = vp.ownerSVGElement || vp, box = root.getBoundingClientRect(), k = box.width / root.viewBox.baseVal.width;
    let tx = 0, ty = 0;
    if (vp !== root) for (let n = vp.parentNode; n && n !== root; n = n.parentNode) {
      const t = (n.getAttribute('transform') || '').match(/translate\(([^)]*)\)/);
      if (t) { const [u, v] = t[1].split(/[\s,]+/).map(Number); tx += u; ty += v || 0; }
    }
    const vx = vp === root ? 0 : +(vp.getAttribute('x') || 0), vy = vp === root ? 0 : +(vp.getAttribute('y') || 0), vw = +vp.getAttribute('width'), vh = +vp.getAttribute('height');
    return { a, d, k, box, tx: tx + vx, ty: ty + vy, e, f, x: [(0 - e) / a, (vw - e) / a].sort((u, v) => u - v), y: [(0 - f) / d, (vh - f) / d].sort((u, v) => u - v) }; // (0 - e), not -e: a zero offset must read 0, not -0
  });
  const client = (fr, p) => [fr.box.left + (fr.tx + fr.a * p[0] + fr.e) * fr.k, fr.box.top + (fr.ty + fr.d * p[1] + fr.f) * fr.k];
  const data = (fr, c) => [((c[0] - fr.box.left) / fr.k - fr.tx - fr.e) / fr.a, ((c[1] - fr.box.top) / fr.k - fr.ty - fr.f) / fr.d];
  // a map: its <image> box in root px, and the client px of its fraction (fx, fy)
  const image = (host) => {
    const img = host.querySelector('svg image');
    let root = img.ownerSVGElement; while (root.ownerSVGElement) root = root.ownerSVGElement; // the outermost svg: a zoomed map's image sits in a nested viewport
    const box = root.getBoundingClientRect(), k = box.width / root.viewBox.baseVal.width;
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((q) => +img.getAttribute(q));
    return { x, y, w, h, at: (fx, fy) => [box.left + (x + fx * w) * k, box.top + (y + fy * h) * k], frac: (c) => [((c[0] - box.left) / k - x) / w, ((c[1] - box.top) / k - y) / h] };
  };
  window.Z = {
    read: (host) => frames(host).map(({ a, d, k, x, y }) => ({ a, d, k, x, y })),
    toClient: (host, i, p) => client(frames(host)[i], p),
    toData: (host, i, c) => data(frames(host)[i], c),
    image: (host) => { const m = image(host); return { x: m.x, y: m.y, w: m.w, h: m.h }; },
    imageAt: (host, fx, fy) => image(host).at(fx, fy),
    imageFrac: (host, c) => image(host).frac(c),
  };
});

// Mounts a plot of `kind` on a fresh host in the light column, with interact bound; a redraw is `host.innerHTML = draw(view)`, and the caller keeps no other state.
// The data comes from the call (`window.DATA`), so a test can redraw with other data and the same view. Returns once the host is in view.
async function mountZoom(page, kind) {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await installZ(page);
  await page.evaluate((kind) => {
    const wave = (ph, amp) => Array.from({ length: 41 }, (_, i) => [i / 4, amp * Math.sin(i / 4 + ph)]);
    const spots = (s) => [0, 1].map((p) => ({ title: `f${p}`, airy: 4, series: [{ label: 'a', index: 0, points: Array.from({ length: 30 }, (_, i) => [s * (10 + 3 * Math.cos(i + p)) * Math.cos(i * 0.7) , s * (10 + 3 * Math.sin(i * p)) * Math.sin(i * 0.9)]) }] }));
    const host = document.createElement('div');
    host.style.cssText = 'width:600px;margin:20px auto';
    document.querySelector('.theme[data-theme="light"]').appendChild(host);
    const E = window.ELEO;
    window.DATA = 1;
    const draw = {
      curve: (view) => E.curve({ series: [{ points: wave(0, window.DATA), label: 'a' }, { points: wave(1, window.DATA), label: 'b', role: 'sagittal', index: 1 }], x: { range: [0, 10], label: 'x' }, y: { range: [-1, 1], label: 'y' }, width: 600, ...(view ? { view } : {}) }),
      spot: (view) => E.spot({ panels: spots(window.DATA), unit: 'µm', width: 600, ...(view ? { view } : {}) }),
      map: (view) => E.map2D({ values: Array.from({ length: 8 }, (_, r) => Array.from({ length: 12 }, (_, c) => r * c + 1)), extent: [-6, 6, -4, 4], x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, el: host, width: 600, ...(view ? { view } : {}) }),
    }[kind];
    window.HOST = host; window.DRAW = draw; window.VIEWS = []; window.LAST = undefined;
    host.innerHTML = draw(null);
    window.ORIG = host.innerHTML;
    window.STOP = E.interact(host, { onview(v) { window.VIEWS.push(v); window.LAST = v; host.innerHTML = draw(v); } });
    host.scrollIntoView({ block: 'center' });
  }, kind);
}
const frames = (page) => page.evaluate(() => window.Z.read(window.HOST));
const toClient = (page, i, p) => page.evaluate(([i, p]) => window.Z.toClient(window.HOST, i, p), [i, p]);
const toData = (page, i, c) => page.evaluate(([i, c]) => window.Z.toData(window.HOST, i, c), [i, c]);
const views = (page) => page.evaluate(() => window.VIEWS);
// The host's markup without interact's own hover overlay (a live region it keeps in the host), which is not the caller's draw.
const markup = (page) => page.evaluate(() => { const c = window.HOST.cloneNode(true); c.querySelectorAll('.eleo-hover').forEach((n) => n.remove()); return c.innerHTML; });
const closeTo = (got, want, tol, what) => expect(Math.abs(got - want), `${what}: ${got} vs ${want} (tol ${tol})`).toBeLessThanOrEqual(tol);
// A range pair against the wanted one, within TOL_PX of the frame's scale along that axis.
const rangeIs = (got, want, scale, what) => { closeTo(got[0], want[0], TOL_PX / scale, `${what} low`); closeTo(got[1], want[1], TOL_PX / scale, `${what} high`); };
// The zoom factor a wheel notch applied, from the old and new spans of one axis.
const span = (r) => r[1] - r[0];

// #829 (O5, curve): one wheel notch zooms about the pointer: the point under it stays under it, the range is p + (range - p) / k with one k on both axes, the event is the drawn range, and the page does not scroll.
test('wheel zooms about the pointer', async ({ page }) => {
  await mountZoom(page, 'curve');
  const f0 = (await frames(page))[0], p = [3, 0.4], c0 = await toClient(page, 0, p);
  await page.mouse.move(c0[0], c0[1]);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -100);
  expect(await views(page), 'one view event per notch').toHaveLength(1);
  expect(await page.evaluate(() => window.scrollY), 'the wheel does not scroll the page').toBe(scrollBefore);
  const f1 = (await frames(page))[0], k = span(f0.x) / span(f1.x);
  expect(k, 'a notch toward the screen zooms in').toBeGreaterThan(1);
  closeTo(span(f0.y) / span(f1.y), k, 1e-6 * k, 'the same factor on y');
  rangeIs(f1.x, [p[0] + (f0.x[0] - p[0]) / k, p[0] + (f0.x[1] - p[0]) / k], Math.abs(f1.a) * f1.k, 'x range');
  rangeIs(f1.y, [p[1] + (f0.y[0] - p[1]) / k, p[1] + (f0.y[1] - p[1]) / k], Math.abs(f1.d) * f1.k, 'y range');
  const under = await toData(page, 0, c0);
  closeTo(under[0], p[0], TOL_PX / (Math.abs(f1.a) * f1.k), 'data x under the pointer');
  closeTo(under[1], p[1], TOL_PX / (Math.abs(f1.d) * f1.k), 'data y under the pointer');
  const v1 = (await views(page))[0];
  rangeIs(v1.x, f1.x, Math.abs(f1.a) * f1.k, 'event x');
  rangeIs(v1.y, f1.y, Math.abs(f1.d) * f1.k, 'event y');
  await page.evaluate(() => window.STOP());
});

// #950 (review M3): a horizontal-only wheel or trackpad swipe over a plot is not swallowed: it is not prevented and no view fires; a vertical wheel still is.
test('a horizontal wheel is not prevented', async ({ page }) => {
  await mountZoom(page, 'curve');
  const c0 = await toClient(page, 0, [3, 0.4]);
  await page.mouse.move(c0[0], c0[1]);
  const prevented = await page.evaluate(([x, y]) => {
    const fire = (dx, dy) => { const e = new WheelEvent('wheel', { deltaX: dx, deltaY: dy, clientX: x, clientY: y, bubbles: true, cancelable: true }); window.HOST.querySelector('svg').dispatchEvent(e); return e.defaultPrevented; };
    return [fire(50, 0), fire(0, -100), fire(50, 2)];
  }, c0);
  expect(prevented[0], 'a horizontal wheel is not prevented').toBe(false);
  expect(prevented[1], 'a vertical wheel still is').toBe(true);
  expect(prevented[2], 'a mostly horizontal swipe (50, 2) is not prevented').toBe(false);
  expect(await views(page), 'only the vertical wheel fired a view').toHaveLength(1);
  await page.evaluate(() => window.STOP());
});

// #829: a drag that pans does not also select the mark it started on; a plain click still does.
test('a drag does not select', async ({ page }) => {
  await mountZoom(page, 'curve');
  await page.evaluate(() => { window.SELECT = []; window.STOP(); window.STOP = window.ELEO.interact(window.HOST, { onview(v) { window.HOST.innerHTML = window.DRAW(v); }, onselect: (ev) => window.SELECT.push(ev) }); });
  const c = await toClient(page, 0, [2.5, Math.sin(2.5)]);
  await page.mouse.move(c[0], c[1]);
  await page.mouse.down();
  await page.mouse.move(c[0] + 30, c[1] + 5, { steps: 4 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.SELECT), 'the mouseup of a drag selects nothing').toEqual([]);
  const d = await toClient(page, 0, [4, Math.sin(4)]);
  await page.mouse.click(d[0], d[1]);
  expect((await page.evaluate(() => window.SELECT)).length, 'a plain click still selects').toBe(1);
  await page.evaluate(() => window.STOP());
});

// #825 (O5, curve): wheel zoom about the pointer (closed form), drag pans, double-click and reset() restore the first markup exactly, the page does not scroll.
test('zoom pan and reset', async ({ page }) => {
  await mountZoom(page, 'curve');
  expect(await page.evaluate(() => typeof window.STOP), 'interact still returns a function').toBe('function');
  expect(await page.evaluate(() => typeof window.STOP.reset), 'with a reset method').toBe('function');
  const f0 = (await frames(page))[0];
  expect(f0.x, 'the caller\'s x range drawn').toEqual([0, 10]);
  expect(f0.y, 'the caller\'s y range drawn').toEqual([-1, 1]);

  // wheel in: the point under the pointer stays under it, and the range is p + (range - p) / k
  const p = [3, 0.4], c0 = await toClient(page, 0, p);
  await page.mouse.move(c0[0], c0[1]);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -100);
  expect(await views(page), 'one view event per notch').toHaveLength(1);
  expect(await page.evaluate(() => window.scrollY), 'the wheel does not scroll the page').toBe(scrollBefore);
  const f1 = (await frames(page))[0], k = span(f0.x) / span(f1.x);
  expect(k, 'a notch toward the screen zooms in').toBeGreaterThan(1);
  closeTo(span(f0.y) / span(f1.y), k, 1e-6 * k, 'the same factor on y');
  rangeIs(f1.x, [p[0] + (f0.x[0] - p[0]) / k, p[0] + (f0.x[1] - p[0]) / k], Math.abs(f1.a) * f1.k, 'x range');
  rangeIs(f1.y, [p[1] + (f0.y[0] - p[1]) / k, p[1] + (f0.y[1] - p[1]) / k], Math.abs(f1.d) * f1.k, 'y range');
  const under = await toData(page, 0, c0);
  closeTo(under[0], p[0], TOL_PX / (Math.abs(f1.a) * f1.k), 'data x under the pointer');
  closeTo(under[1], p[1], TOL_PX / (Math.abs(f1.d) * f1.k), 'data y under the pointer');
  // the event is the drawn range
  const v1 = (await views(page))[0];
  rangeIs(v1.x, f1.x, Math.abs(f1.a) * f1.k, 'event x');
  rangeIs(v1.y, f1.y, Math.abs(f1.d) * f1.k, 'event y');

  // the reverse notch at the same pointer undoes it
  await page.mouse.wheel(0, 100);
  const f2 = (await frames(page))[0];
  closeTo(span(f2.x), span(f0.x), TOL_PX / (Math.abs(f2.a) * f2.k) * 2, 'zoom out restores the x span');
  closeTo(f2.x[0], f0.x[0], TOL_PX / (Math.abs(f2.a) * f2.k) * 2, 'and the x range start');
  closeTo(f2.y[0], f0.y[0], TOL_PX / (Math.abs(f2.d) * f2.k) * 2, 'and the y range start');

  // zoom in again, then drag: the data point grabbed stays under the pointer, the spans do not change
  await page.mouse.wheel(0, -100);
  const f3 = (await frames(page))[0], start = await toClient(page, 0, p), grabbed = await toData(page, 0, start);
  await page.mouse.move(start[0], start[1]);
  await page.mouse.down();
  await page.mouse.move(start[0] + 20, start[1] - 10, { steps: 4 });
  await page.mouse.move(start[0] + 40, start[1] - 25, { steps: 4 });
  await page.mouse.up();
  const f4 = (await frames(page))[0];
  closeTo(span(f4.x), span(f3.x), 1e-6 * span(f3.x), 'a drag keeps the x span');
  closeTo(span(f4.y), span(f3.y), 1e-6 * span(f3.y), 'a drag keeps the y span');
  const end = [start[0] + 40, start[1] - 25], now = await toData(page, 0, end);
  closeTo(now[0], grabbed[0], TOL_PX / (Math.abs(f4.a) * f4.k), 'the grabbed x is under the pointer');
  closeTo(now[1], grabbed[1], TOL_PX / (Math.abs(f4.d) * f4.k), 'the grabbed y is under the pointer');
  // the shift in data units is the drag in px over the scale: right is toward lower x, up is toward lower y (y is drawn upward)
  closeTo(f4.x[0] - f3.x[0], -40 / (f3.a * f3.k), 2 * TOL_PX / (Math.abs(f3.a) * f3.k), 'x shifted by the drag distance in data units');
  closeTo(f4.y[0] - f3.y[0], 25 / (f3.d * f3.k), 2 * TOL_PX / (Math.abs(f3.d) * f3.k), 'y shifted by the drag distance in data units');
  expect((await markup(page)) !== (await page.evaluate(() => window.ORIG)), 'the view is not the original').toBe(true);

  // double-click resets: onview(null), and the markup is the first draw's, byte for byte
  await page.mouse.dblclick(end[0], end[1]);
  expect(await page.evaluate(() => window.LAST), 'reset reports null').toBeNull();
  expect(await markup(page), 'double-click restores the original markup').toBe(await page.evaluate(() => window.ORIG));

  // reset() does the same from code
  await page.mouse.move(c0[0], c0[1]);
  await page.mouse.wheel(0, -100);
  expect(await markup(page) !== (await page.evaluate(() => window.ORIG)), 'zoomed again').toBe(true);
  await page.evaluate(() => window.STOP.reset());
  expect(await page.evaluate(() => window.LAST), 'reset() reports null').toBeNull();
  expect(await markup(page), 'reset() restores the original markup').toBe(await page.evaluate(() => window.ORIG));

  // stopped: no more events
  const n = (await views(page)).length;
  await page.evaluate(() => window.STOP());
  await page.mouse.wheel(0, -100);
  expect((await views(page)).length, 'stop() removes the zoom listeners').toBe(n);
});

// #825 (O5, curve): a data redraw that passes the caller's view keeps the axes; the next wheel zooms from the redrawn range, not from a remembered one.
test('a data redraw keeps the view', async ({ page }) => {
  await mountZoom(page, 'curve');
  const f0 = (await frames(page))[0], c = await toClient(page, 0, [6, 0]);
  await page.mouse.move(c[0], c[1]);
  await page.mouse.wheel(0, -100);
  const view = await page.evaluate(() => window.LAST), f1 = (await frames(page))[0];
  await page.evaluate(() => { window.DATA = 0.5; window.HOST.innerHTML = window.DRAW(window.LAST); });
  const f2 = (await frames(page))[0], s = Math.abs(f2.a) * f2.k;
  rangeIs(f2.x, f1.x, s, 'x range after the data changed');
  rangeIs(f2.y, f1.y, Math.abs(f2.d) * f2.k, 'y range after the data changed');
  expect(await page.evaluate(() => window.VIEWS.length), 'redrawing sends no view event').toBe(1);
  expect(view.x, 'the event the caller kept').toHaveLength(2);
  // zooming again compounds on the redrawn range
  const c2 = await toClient(page, 0, [6, 0]);
  await page.mouse.move(c2[0], c2[1]);
  await page.mouse.wheel(0, -100);
  const f3 = (await frames(page))[0], k = span(f1.x) / span(f3.x);
  expect(k, 'a second notch zooms in again').toBeGreaterThan(1);
  closeTo(k, span(f0.x) / span(f1.x), 1e-6 * k, 'by the same factor as the first');
  // and reset returns to the caller's range for the new data
  await page.mouse.dblclick(c2[0], c2[1]);
  const f4 = (await frames(page))[0];
  expect([f4.x, f4.y], 'reset: the caller\'s ranges').toEqual([f0.x, f0.y]);
  await page.evaluate(() => window.STOP());
});

// #943 (O5, curve): a panels curve whose points are all isolated draws dots-only paths, like a spot; it still zooms as a curve ({ x, y }), because only spot's own panels carry its marker.
test('a sparse panel curve zooms as a curve', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await installZ(page);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'width:600px;margin:20px auto';
    document.querySelector('.theme[data-theme="light"]').appendChild(host);
    host.innerHTML = window.ELEO.curve({ panels: [{ series: [{ points: [[2, 0.2], [3, NaN], [7, 0.7]], index: 0 }] }], x: { range: [0, 10], label: 'x' }, y: { range: [0, 1], label: 'y' }, width: 600 });
    window.HOST = host; window.VIEWS = [];
    window.STOP = window.ELEO.interact(host, { onview(v) { window.VIEWS.push(v); } });
    host.scrollIntoView({ block: 'center' });
  });
  const f0 = (await frames(page))[0], c = await toClient(page, 0, [5, 0.5]);
  await page.mouse.move(c[0], c[1]);
  await page.mouse.wheel(0, -100);
  const v = await views(page);
  expect(v, 'one view event').toHaveLength(1);
  expect(Object.keys(v[0]).sort(), 'a curve view, not a spot view').toEqual(['x', 'y']);
  expect(span(v[0].x), 'zoomed in').toBeLessThan(span(f0.x));
  await page.evaluate(() => window.STOP());
});

// #825 (O5, spot): the panels zoom together. The window is square, the same in every panel; a wheel off-centre shifts the centre by p + (c - p) / k.
test('spot panels share one view', async ({ page }) => {
  await mountZoom(page, 'spot');
  const f0 = await frames(page);
  expect(f0.length, 'two panels').toBe(2);
  const half0 = span(f0[0].x) / 2, c0x = (f0[0].x[0] + f0[0].x[1]) / 2, c0y = (f0[0].y[0] + f0[0].y[1]) / 2;
  closeTo(span(f0[0].y) / 2, half0, 1e-9 * half0, 'a square window');
  expect(f0[1].x, 'panels share the scale').toEqual(f0[0].x);

  // wheel in over the second panel, off its centre
  const p = [c0x + 0.5 * half0, c0y - 0.3 * half0], c = await toClient(page, 1, p);
  await page.mouse.move(c[0], c[1]);
  await page.mouse.wheel(0, -100);
  expect(await views(page), 'one event').toHaveLength(1);
  const v = (await views(page))[0], f1 = await frames(page), k = half0 / (span(f1[0].x) / 2);
  expect(k, 'zooms in').toBeGreaterThan(1);
  closeTo(v.half, half0 / k, 1e-6 * half0, 'event half');
  closeTo(v.center[0], p[0] + (c0x - p[0]) / k, TOL_PX / (Math.abs(f1[0].a) * f1[0].k), 'event centre x');
  closeTo(v.center[1], p[1] + (c0y - p[1]) / k, TOL_PX / (Math.abs(f1[0].d) * f1[0].k), 'event centre y');
  const want = { x: [v.center[0] - v.half, v.center[0] + v.half], y: [v.center[1] - v.half, v.center[1] + v.half] };
  f1.forEach((fr, i) => {
    rangeIs(fr.x, want.x, Math.abs(fr.a) * fr.k, `panel ${i} x range`);
    rangeIs(fr.y, want.y, Math.abs(fr.d) * fr.k, `panel ${i} y range`);
  });
  const under = await toData(page, 1, c);
  closeTo(under[0], p[0], TOL_PX / (Math.abs(f1[1].a) * f1[1].k), 'data x under the pointer, panel 1');
  closeTo(under[1], p[1], TOL_PX / (Math.abs(f1[1].d) * f1[1].k), 'data y under the pointer, panel 1');

  // drag in the first panel pans every panel by the drag distance
  const s = await toClient(page, 0, [v.center[0], v.center[1]]);
  await page.mouse.move(s[0], s[1]);
  await page.mouse.down();
  await page.mouse.move(s[0] - 30, s[1] + 15, { steps: 5 });
  await page.mouse.up();
  const f2 = await frames(page);
  f2.forEach((fr, i) => {
    closeTo(span(fr.x), span(f1[i].x), 1e-6 * span(f1[i].x), `panel ${i}: the span does not change`);
    closeTo(fr.x[0] - f1[i].x[0], 30 / (f1[i].a * f1[i].k), 2 * TOL_PX / (Math.abs(f1[i].a) * f1[i].k), `panel ${i}: x shifted by the drag`);
    closeTo(fr.y[0] - f1[i].y[0], -15 / (f1[i].d * f1[i].k), 2 * TOL_PX / (Math.abs(f1[i].d) * f1[i].k), `panel ${i}: y shifted by the drag`);
  });
  expect(f2[1].x, 'still one view for both panels').toEqual(f2[0].x);

  // reset
  await page.mouse.dblclick(s[0] - 30, s[1] + 15);
  expect(await markup(page), 'double-click restores the original markup').toBe(await page.evaluate(() => window.ORIG));
  await page.evaluate(() => window.STOP());
});

// #825 (O5, typed map): the ranges change and the <image> keeps its data extent: its px box scales by k about the pointer and the viewport clips it.
// The map has no matrix group, so the oracle is the image box itself: the extent point under the pointer stays under it, and the box is the old one scaled by k.
test('map zoom keeps the image at its extent', async ({ page }) => {
  await mountZoom(page, 'map');
  const img0 = await page.evaluate(() => window.Z.image(window.HOST));
  const fx = 0.3, fy = 0.65, ext = [-6, 6, -4, 4];
  const c = await page.evaluate(([fx, fy]) => window.Z.imageAt(window.HOST, fx, fy), [fx, fy]);
  await page.mouse.move(c[0], c[1]);
  await page.mouse.wheel(0, -100);
  expect(await views(page), 'one event').toHaveLength(1);
  const v = (await views(page))[0], img1 = await page.evaluate(() => window.Z.image(window.HOST));
  const k = img1.w / img0.w;
  expect(k, 'zoomed in').toBeGreaterThan(1);
  closeTo(img1.h / img0.h, k, 1e-6 * k, 'the image scales by one factor on both axes (px per unit equal)');
  // the extent point under the pointer
  const p = [ext[0] + fx * (ext[1] - ext[0]), ext[3] - fy * (ext[3] - ext[2])];
  const frac = await page.evaluate((c) => window.Z.imageFrac(window.HOST, c), c);
  closeTo(frac[0], fx, TOL_PX / img1.w, 'the image fraction under the pointer, x');
  closeTo(frac[1], fy, TOL_PX / img1.h, 'the image fraction under the pointer, y');
    // the window drawn before the zoom is the extent padded on its shorter side (data-range), and zooming about p scales that window
  const r0 = await page.evaluate(() => window.ORIG.match(/data-range="([^"]*)"/)[1].split(' ').map(Number));
  rangeIs(v.x, [p[0] + (r0[0] - p[0]) / k, p[0] + (r0[1] - p[0]) / k], (img1.w / (ext[1] - ext[0])), 'event x');
  rangeIs(v.y, [p[1] + (r0[2] - p[1]) / k, p[1] + (r0[3] - p[1]) / k], (img1.h / (ext[3] - ext[2])), 'event y');
  // the axes read the new range: every x tick label lies inside it
  const ticks = await page.evaluate(() => [...window.HOST.querySelectorAll('text.eleo-tick')].map((t) => t.textContent.trim().replace('−', '-')).map(Number).filter(Number.isFinite));
  const tol = 1e-9;
  expect(ticks.length, 'tick labels drawn').toBeGreaterThan(0);
  expect(ticks.every((t) => (t >= v.x[0] - tol && t <= v.x[1] + tol) || (t >= v.y[0] - tol && t <= v.y[1] + tol)), 'every tick lies in the zoomed x or y range').toBe(true);
  // reset
  await page.mouse.dblclick(c[0], c[1]);
  expect(await markup(page), 'double-click restores the original markup').toBe(await page.evaluate(() => window.ORIG));
  await page.evaluate(() => window.STOP());
});

// #944 (O5, map and curve): hover happens only inside the drawn window. A zoomed plot's data (the map's <image>, a curve's points) extends past the clipped frame, so a pointer in the margin must emit nothing, and one just inside still hovers.
// oracle: property the frame is the nested viewport box computed from its x/y/width/height and the ancestors' translate() with the root's client box, never getScreenCTM (as installZ).
test('zoomed plots hover only inside the frame', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await installZ(page);
  const frameBox = (kind) => page.evaluate((kind) => {
    const host = window.HOST, mark = host.querySelector(kind === 'map' ? 'image[data-extent]' : 'polyline[data-series], path[data-series]');
    const vp = mark.closest('svg'), root = vp.ownerSVGElement, box = root.getBoundingClientRect(), k = box.width / root.viewBox.baseVal.width;
    let tx = 0, ty = 0;
    for (let n = vp.parentNode; n && n !== root; n = n.parentNode) {
      const t = (n.getAttribute('transform') || '').match(/translate\(([^)]*)\)/);
      if (t) { const [u, v] = t[1].split(/[\s,]+/).map(Number); tx += u; ty += v || 0; }
    }
    const x = +vp.getAttribute('x') + tx, y = +vp.getAttribute('y') + ty, w = +vp.getAttribute('width'), h = +vp.getAttribute('height');
    return { left: box.left + x * k, top: box.top + y * k, right: box.left + (x + w) * k, bottom: box.top + (y + h) * k };
  }, kind);
  for (const kind of ['map', 'curve']) {
    await page.evaluate((kind) => {
      const host = document.createElement('div');
      host.style.cssText = 'width:600px;margin:20px auto';
      document.querySelector('.theme[data-theme="light"]').appendChild(host);
      const E = window.ELEO, wave = Array.from({ length: 81 }, (_, i) => [i / 8, Math.sin(i / 8)]);
      host.innerHTML = kind === 'map'
        ? E.map2D({ values: Array.from({ length: 8 }, (_, r) => Array.from({ length: 12 }, (_, c) => r * c + 1)), extent: [-6, 6, -4, 4], x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, el: host, width: 600, view: { x: [-2, 2], y: [-1.5, 1.5] } })
        : E.curve({ series: [{ points: wave, label: 'a' }], x: { range: [0, 10], label: 'x' }, y: { range: [-1, 1], label: 'y' }, width: 600, view: { x: [4, 6], y: [-1.2, 1.2] } });
      window.HOST = host; window.HOVER = [];
      window.STOP = E.interact(host, { values: kind === 'map' ? Array.from({ length: 8 }, () => Array(12).fill(1)) : undefined, onhover: (ev) => window.HOVER.push(ev) });
      host.scrollIntoView({ block: 'center' });
    }, kind);
    const f = await frameBox(kind), mid = [(f.left + f.right) / 2, (f.top + f.bottom) / 2];
    // inside: just in from the left edge, at mid height (a curve is hovered at its own point, so aim at the data there)
    const inside = kind === 'curve' ? await toClient(page, 0, [4.2, Math.sin(4.2)]) : [f.left + 5, mid[1]];
    expect(inside[0] > f.left && inside[0] < f.right && inside[1] > f.top && inside[1] < f.bottom, `${kind}: the inside probe is inside`).toBe(true);
    expect(await hoverAt(page, inside[0], inside[1]), `${kind}: inside the frame still hovers`).not.toBeNull();
    // outside: 10 px past each edge, level with the inside probe or the middle; the data lies there, clipped
    const outs = kind === 'curve'
      ? [await toClient(page, 0, [3.9, Math.sin(3.9)]), await toClient(page, 0, [6.1, Math.sin(6.1)])]
      : [[f.left - 10, mid[1]], [f.right + 10, mid[1]], [mid[0], f.top - 10], [mid[0], f.bottom + 10]];
    if (kind === 'curve') { outs[0][0] = Math.min(outs[0][0], f.left - 10); outs[1][0] = Math.max(outs[1][0], f.right + 10); }
    for (const [x, y] of outs) expect(await hoverAt(page, x, y), `${kind}: ${x.toFixed(0)},${y.toFixed(0)} is outside the frame`).toBeNull();
    await page.evaluate(() => { window.STOP(); window.HOST.remove(); });
  }
  // #972 (CR #970, layout): a zoomed layout is clipped by its root viewBox, so a ray run's point or interpolated spot outside that window is not drawn and must not hover. The Cooke triplet at view y [-1, 1] puts rays past the top and bottom edges within reach of a pointer on them.
  // oracle: property every emitted ray event lies inside the window computed from the data group's matrix attribute and the viewBox (window.L.frame), to half a client px.
  await mountLayout(page, layoutFixture('analysis-glasses'));
  await page.evaluate(() => {
    window.STOP();
    window.HOVER = [];
    window.HOST.innerHTML = window.DRAW({ x: [1, 9], y: [-1, 1] });
    window.STOP = window.ELEO.interact(window.HOST, { onhover: (ev) => window.HOVER.push(ev) });
  });
  const lf = await lframe(page), slack = 0.5 / (lf.a * lf.k);
  const box = await page.evaluate(() => { const r = window.HOST.querySelector('svg').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
  let seen = 0;
  for (const y of [box.top + 1, box.bottom - 1]) {
    for (let x = box.left + 5; x < box.right - 5; x += 3) {
      await page.evaluate(([x, y]) => { window.HOVER = []; window.HOST.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true })); }, [x, y]);
      for (const ev of await page.evaluate(() => window.HOVER)) {
        if (ev === null || ev.ray === undefined) continue;
        seen++;
        expect(ev.y, `layout: a ray hover at ${x.toFixed(0)},${y.toFixed(0)} lies inside the window's y range`).toBeGreaterThanOrEqual(lf.y[0] - slack);
        expect(ev.y, `layout: a ray hover at ${x.toFixed(0)},${y.toFixed(0)} lies inside the window's y range`).toBeLessThanOrEqual(lf.y[1] + slack);
        expect(ev.x, 'and its x range').toBeGreaterThanOrEqual(lf.x[0] - slack);
        expect(ev.x, 'and its x range').toBeLessThanOrEqual(lf.x[1] + slack);
      }
    }
  }
  expect(seen, 'the edge sweep still hovers rays inside the window').toBeGreaterThan(0);
  await page.evaluate(() => window.STOP());
});

// #949 (review M3 r1 finding 8): a double-click is click(detail 1), click(detail 2), dblclick. It resets the view and selects once, for the first click.
test('a double-click selects once', async ({ page }) => {
  await mountZoom(page, 'curve');
  await page.evaluate(() => {
    window.STOP();
    window.SELECT = [];
    window.STOP = window.ELEO.interact(window.HOST, { onselect: (ev) => window.SELECT.push(ev), onview(v) { window.VIEWS.push(v); window.LAST = v; window.HOST.innerHTML = window.DRAW(v); } });
  });
  const c = await toClient(page, 0, [2, Math.sin(2)]);
  await page.mouse.move(c[0], c[1]);
  await page.mouse.wheel(0, -100);
  expect(await page.evaluate(() => window.LAST), 'zoomed first').not.toBeNull();
  const fire = (page2) => page2.evaluate(() => {
    const m = window.HOST.querySelector('[data-series]');
    const ev = (type, detail) => m.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, detail }));
    ev('click', 1); ev('click', 2); ev('dblclick', 2);
  });
  await fire(page);
  expect(await page.evaluate(() => window.SELECT), 'one select event, for the first click').toHaveLength(1);
  expect(await page.evaluate(() => window.LAST), 'the double-click reset the view').toBeNull();
});

// #953 (review M3 r2 finding 2): the one-select rule holds only where a double-click resets (hosts with onview). A host without zoom (bars, layouts, hover-only) has no reset, so each click selects.
test('a double-click on a non-zoom host selects twice', async ({ page }) => {
  await mountZoom(page, 'curve');
  await page.evaluate(() => {
    window.STOP();
    window.SELECT = [];
    window.STOP = window.ELEO.interact(window.HOST, { onselect: (ev) => window.SELECT.push(ev) });
    const m = window.HOST.querySelector('[data-series]');
    const ev = (type, detail) => m.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, detail }));
    ev('click', 1); ev('click', 2);
  });
  expect(await page.evaluate(() => window.SELECT), 'each click selects: no zoom, no reset').toHaveLength(2);
});

// #954 (review M3 r2 finding 3): interact reads opts.axes and opts.values when an event fires, so a caller that replaces them on its options object, without rebinding, sees the next tooltip change.
// oracle: property the tooltip text, with the pointer placed from the frame box and Z.toClient (never getScreenCTM).
test('options read at event time', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await installZ(page);
  const tip = () => page.evaluate(() => window.HOST.querySelector('.eleo-hover__tip').textContent);
  // a curve: the unit of x
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'width:600px;margin:20px auto';
    document.querySelector('.theme[data-theme="light"]').appendChild(host);
    const E = window.ELEO, wave = Array.from({ length: 81 }, (_, i) => [i / 8, Math.sin(i / 8)]);
    host.innerHTML = E.curve({ series: [{ points: wave, label: 'a' }], x: { range: [0, 10], label: 'x' }, y: { range: [-1, 1], label: 'y' }, width: 600 });
    window.HOST = host; window.OPTS = { axes: { x: { unit: 'qa' } }, onhover() {} };
    window.STOP = E.interact(host, window.OPTS);
    host.scrollIntoView({ block: 'center' });
  });
  const c = await toClient(page, 0, [4, Math.sin(4)]);
  await page.mouse.move(2, 2);
  await page.mouse.move(c[0], c[1]);
  expect(await tip(), 'bound axes read').toContain('qa');
  await page.evaluate(() => { window.OPTS.axes = { x: { unit: 'qb' } }; });
  await page.mouse.move(2, 2);
  await page.mouse.move(c[0], c[1]);
  const t = await tip();
  expect(t, 'replaced axes read at the next hover').toContain('qb');
  expect(t).not.toContain('qa');
  await page.evaluate(() => { window.STOP(); window.HOST.remove(); });
  // a map: the value
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'width:600px;margin:20px auto';
    document.querySelector('.theme[data-theme="light"]').appendChild(host);
    const E = window.ELEO, grid = (n) => Array.from({ length: 8 }, () => Array(12).fill(n));
    host.innerHTML = E.map2D({ values: grid(1), extent: [-6, 6, -4, 4], x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, el: host, width: 600 });
    window.HOST = host; window.OPTS = { values: grid(7), onhover() {} };
    window.STOP = E.interact(host, window.OPTS);
    window.GRID9 = grid(9);
    host.scrollIntoView({ block: 'center' });
  });
  const q = await page.evaluate(() => {
    const img = window.HOST.querySelector('image[data-extent]'), r = img.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(2, 2);
  await page.mouse.move(q.x, q.y);
  expect(await tip(), 'bound values read').toContain('= 7');
  await page.evaluate(() => { window.OPTS.values = window.GRID9; });
  await page.mouse.move(2, 2);
  await page.mouse.move(q.x, q.y);
  expect(await tip(), 'replaced values read at the next hover').toContain('= 9');
  await page.evaluate(() => { window.STOP(); window.HOST.remove(); });
});

// ---------------------------------------------------------------------------------------------------------------------------
// M3 demo feedback (plan #804, issue #959; CRs #956, #957, #958). All three are skipped until #968 unskips them.
// oracle: property (no text selection starts in a frame; the zoom closed form range' = p + (range - p) / k; the point under the pointer stays under it; reset restores the markup byte for byte) and
// closed-form (the lens radius is the circle through three profile points, the focal length the thick-lens lensmaker equation, both written out in the test from tests/fixtures/layouts/analysis-glasses.json, never from the code under test).
//
// Contract these tests fix for #960 to #968:
//  - layout2D takes `view: { x: [lo, hi], y: [lo, hi] }` (mm) and `interact` reports it through `onview`, as for a curve. The data group is the one `matrix(M 0 0 -M tx ty)` group (one scale on both axes);
//    the window it draws is its inverse matrix over the root svg's viewBox (plan #965).
//  - A glass polygon hover emits { element, glass, nd, vd, r1, r2, ct, diameter, f } and no field or ray. `element` counts the glass-bearing surfaces from 1, `glass` is the name, r1 and r2 are the signed vertex radii
//    in mm (positive when the centre of curvature lies at greater z), `ct` the vertex thickness, `diameter` twice the largest |y| of the drawn polygon, `f` the thick-lens focal length in air. The tooltip is five lines joined by "\n" (CR #958).
// ---------------------------------------------------------------------------------------------------------------------------

const layoutFixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/layouts/${name}.json`, import.meta.url), 'utf8'));

// #956 (O5, spot): a pan or a double-click inside a frame starts no text selection; text elsewhere on the page stays selectable. The host is rebound without a redraw, so a selection that did start would still be in the markup.
test('a pan or double-click selects no text', async ({ page }) => {
  await mountZoom(page, 'spot');
  await page.evaluate(() => {
    window.STOP();
    window.STOP = window.ELEO.interact(window.HOST, { onview(v) { window.VIEWS.push(v); } });
    const p = document.createElement('p');
    p.id = 'outside'; p.textContent = 'words outside any plot';
    window.HOST.before(p);
    window.STARTS = [];
    document.addEventListener('selectstart', (e) => window.STARTS.push(e.target.nodeName), true);
    window.HOST.scrollIntoView({ block: 'center' });
  });
  const geo = await page.evaluate(() => {
    const frame = window.HOST.querySelector('g[transform^="matrix("]').closest('svg').getBoundingClientRect();
    const inside = (r) => { const x = r.left + r.width / 2, y = r.top + r.height / 2; return x >= frame.left && x <= frame.right && y >= frame.top && y <= frame.bottom; };
    const label = [...window.HOST.querySelectorAll('svg text')].map((t) => t.getBoundingClientRect()).find((r) => r.width > 0 && !inside(r));
    return { cx: frame.left + frame.width / 2, cy: frame.top + frame.height / 2, label: label ? { x: label.left + label.width / 2, y: label.top + label.height / 2 } : null };
  });
  expect(geo.label, 'axis text outside the frame to drag across').not.toBeNull();
  const selected = () => page.evaluate(() => window.getSelection().toString());
  // a pan that sweeps across the axis text
  await page.mouse.move(geo.cx, geo.cy);
  await page.mouse.down();
  await page.mouse.move(geo.label.x, geo.label.y, { steps: 8 });
  await page.mouse.up();
  expect(await views(page), 'the drag panned').not.toHaveLength(0);
  expect(await selected(), 'a pan selects no text').toBe('');
  // a double-click in the frame
  await page.mouse.dblclick(geo.cx, geo.cy);
  expect(await selected(), 'a double-click selects no text').toBe('');
  expect(await page.evaluate(() => window.STARTS), 'no selection started in the frame').toEqual([]);
  // text elsewhere on the page still selects
  const w = await page.locator('#outside').boundingBox();
  await page.mouse.dblclick(w.x + 8, w.y + w.height / 2);
  expect(await selected(), 'text outside a frame stays selectable').not.toBe('');
  await page.evaluate(() => { window.STOP(); document.getElementById('outside').remove(); });
});

// Mounts the Cooke triplet's layout (the glasses fixture) on a fresh host with interact bound; a redraw is `host.innerHTML = draw(view)`.
async function mountLayout(page, layout) {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate((layout) => {
    const host = document.createElement('div');
    host.style.cssText = 'width:600px;margin:20px auto';
    document.querySelector('.theme[data-theme="light"]').appendChild(host);
    const E = window.ELEO;
    window.HOST = host; window.VIEWS = []; window.LAST = undefined;
    window.DRAW = (view) => E.layout2D({ data: layout, width: 600, ...(view ? { view } : {}) });
    host.innerHTML = window.DRAW(null);
    window.ORIG = host.innerHTML;
    window.STOP = E.interact(host, { onview(v) { window.VIEWS.push(v); window.LAST = v; host.innerHTML = window.DRAW(v); } });
    // The drawn frame from the data group's matrix alone: scale M (a = M, d = -M), the window over the root viewBox, and data <-> client px.
    window.L = {
      frame() {
        const g = host.querySelector('svg > g[transform^="matrix("]'), root = g.ownerSVGElement;
        const [a, b, c, d, e, f] = g.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
        const box = root.getBoundingClientRect(), vb = root.viewBox.baseVal, k = box.width / vb.width;
        return { a, b, c, d, e, f, k, x: [(0 - e) / a, (vb.width - e) / a], y: [(f - vb.height) / a, (f - 0) / a], at: (p) => [box.left + (a * p[0] + e) * k, box.top + (d * p[1] + f) * k] };
      },
      ray: (c) => !!document.elementFromPoint(c[0], c[1])?.closest('polyline[data-field]'),
    };
    host.scrollIntoView({ block: 'center' });
  }, layout);
}
const lframe = (page) => page.evaluate(() => window.L.frame());
const onRay = (page, c) => page.evaluate((c) => window.L.ray(c), c);

// #957 (O5, layout2D): wheel zooms about the pointer at one scale on both axes, drag pans, double-click and reset() restore the first markup byte for byte; the glass and the rays follow the view.
// The pointer rests on a vertex of the recorded fan, so the rays are checked by the browser's own hit test at that vertex's position computed from the fixture and the group's matrix.
test('layout zoom pan and reset', async ({ page }) => {
  const layout = layoutFixture('analysis-glasses');
  await mountLayout(page, layout);
  // a vertex of the recorded fan (field 0, ray 0) at which the browser's hit test finds a ray run (the renderer may drop collinear vertices, so not every one is drawn)
  const fan = layout.rays[0][0];
  const drawn = await page.evaluate((fan) => fan.map((p) => window.L.ray(window.L.frame().at(p))), fan);
  expect(drawn.includes(true), 'a fan vertex with a ray drawn on it').toBe(true);
  const pv = fan[drawn.indexOf(true)];
  const f0 = await lframe(page), c0 = await page.evaluate((p) => window.L.frame().at(p), pv);
  expect([f0.b, f0.c, Math.abs(f0.a) - Math.abs(f0.d)], 'one scale on both axes, no skew').toEqual([0, 0, 0]);
  expect(await onRay(page, c0), 'the pointer rests on the fan vertex').toBe(true);

  // wheel in: the point under the pointer stays under it, and the range is p + (range - p) / k
  await page.mouse.move(c0[0], c0[1]);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -100);
  expect(await views(page), 'one view event per notch').toHaveLength(1);
  expect(await page.evaluate(() => window.scrollY), 'the wheel does not scroll the page').toBe(scrollBefore);
  const f1 = await lframe(page), k = f1.a / f0.a, s1 = f1.a * f1.k;
  expect(k, 'a notch toward the screen zooms in').toBeGreaterThan(1);
  closeTo(Math.abs(f1.d), f1.a, 1e-9 * f1.a, 'one scale on both axes after the zoom');
  rangeIs(f1.x, [pv[0] + (f0.x[0] - pv[0]) / k, pv[0] + (f0.x[1] - pv[0]) / k], s1, 'x range');
  rangeIs(f1.y, [pv[1] + (f0.y[0] - pv[1]) / k, pv[1] + (f0.y[1] - pv[1]) / k], s1, 'y range');
  const under = await page.evaluate((p) => window.L.frame().at(p), pv);
  closeTo(under[0], c0[0], TOL_PX, 'the vertex stays under the pointer in x');
  closeTo(under[1], c0[1], TOL_PX, 'and in y');
  const v1 = (await views(page))[0];
  rangeIs(v1.x, f1.x, s1, 'event x');
  rangeIs(v1.y, f1.y, s1, 'event y');
  // the drawn glass and rays follow: the fan vertex is still a ray under the pointer, and element 2 sits where the fixture puts it
  expect(await onRay(page, c0), 'a ray is still drawn at the fan vertex').toBe(true);
  const el = [2, 3].flatMap((i) => layout.surfaces[i].profile);
  const box = await page.evaluate(() => { const r = window.HOST.querySelector('polygon[data-element="2"]').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  const lo = await page.evaluate(([zs, ys]) => { const F = window.L.frame(); return [F.at([Math.min(...zs), Math.max(...ys)]), F.at([Math.max(...zs), Math.min(...ys)])]; }, [el.map((p) => p[0]), el.map((p) => p[1])]);
  // within TOL_PX plus the 1 px edge stroke, in case the browser's box includes it
  closeTo(box[0], lo[0][0], TOL_PX + 1, 'element 2 left edge'); closeTo(box[1], lo[0][1], TOL_PX + 1, 'element 2 top edge');
  closeTo(box[2], lo[1][0], TOL_PX + 1, 'element 2 right edge'); closeTo(box[3], lo[1][1], TOL_PX + 1, 'element 2 bottom edge');

  // the reverse notch at the same pointer undoes it
  await page.mouse.wheel(0, 100);
  const f2 = await lframe(page);
  closeTo(f2.a, f0.a, 0.02 * f0.a, 'zoom out restores the scale');
  closeTo(f2.x[0], f0.x[0], 2 * TOL_PX / (f2.a * f2.k), 'and the x range start');

  // zoom in again, then drag: the vertex grabbed stays under the pointer, the scale does not change
  await page.mouse.wheel(0, -100);
  const f3 = await lframe(page), start = await page.evaluate((p) => window.L.frame().at(p), pv);
  await page.mouse.move(start[0], start[1]);
  await page.mouse.down();
  await page.mouse.move(start[0] + 20, start[1] - 10, { steps: 4 });
  await page.mouse.move(start[0] + 40, start[1] - 25, { steps: 4 });
  await page.mouse.up();
  const f4 = await lframe(page), end = [start[0] + 40, start[1] - 25], now = await page.evaluate((p) => window.L.frame().at(p), pv);
  closeTo(f4.a, f3.a, 1e-9 * f3.a, 'a drag keeps the scale');
  closeTo(now[0], end[0], TOL_PX, 'the grabbed vertex is under the pointer in x');
  closeTo(now[1], end[1], TOL_PX, 'and in y');
  closeTo(f4.x[0] - f3.x[0], -40 / (f3.a * f3.k), 2 * TOL_PX / (f3.a * f3.k), 'x shifted by the drag distance in data units');
  closeTo(f4.y[0] - f3.y[0], 25 / (f3.d * f3.k), 2 * TOL_PX / (f3.a * f3.k), 'y shifted by the drag distance in data units');
  expect(await onRay(page, end), 'the rays moved with the drag').toBe(true);
  expect((await markup(page)) !== (await page.evaluate(() => window.ORIG)), 'the view is not the original').toBe(true);

  // double-click resets: onview(null), and the markup is the first draw's, byte for byte
  await page.mouse.dblclick(end[0], end[1]);
  expect(await page.evaluate(() => window.LAST), 'reset reports null').toBeNull();
  expect(await markup(page), 'double-click restores the original markup').toBe(await page.evaluate(() => window.ORIG));

  // reset() does the same from code
  await page.mouse.move(c0[0], c0[1]);
  await page.mouse.wheel(0, -100);
  expect(await markup(page) !== (await page.evaluate(() => window.ORIG)), 'zoomed again').toBe(true);
  await page.evaluate(() => window.STOP.reset());
  expect(await page.evaluate(() => window.LAST), 'reset() reports null').toBeNull();
  expect(await markup(page), 'reset() restores the original markup').toBe(await page.evaluate(() => window.ORIG));
  await page.evaluate(() => window.STOP());
});

// #958 (O1, layout2D): the pointer on a glass polygon, away from any ray, emits the element and the tooltip shows it. Expected values are computed here from the fixture's profile points:
// R = the circle through three profile points (the vertex and two points either side of it, centre on the axis), signed positive when its centre lies at greater z; f = the lensmaker equation for a thick lens in air,
// 1/f = (n - 1) [1/R1 - 1/R2 + (n - 1) ct / (n R1 R2)], with ct the vertex thickness. The fit may use other points of the profile, so R and f are compared within the sampling noise of a 41-point profile.
test('lens hover reads the element', async ({ page }) => {
  const layout = layoutFixture('analysis-glasses'), S = layout.surfaces;
  // The centre z of the circle through p, q, r (circumcentre formula), minus the vertex z, is the signed radius when the centre is on the axis.
  const radius = (prof) => {
    const [[ax, ay], [bx, by], [cx, cy]] = [prof[5], prof[20], prof[35]], D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    return ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D - prof[20][0];
  };
  const want = [[0, 1], [2, 3], [4, 5]].map(([i, j], n) => {
    const g = S[i].glass, r1 = radius(S[i].profile), r2 = radius(S[j].profile), ct = S[j].z - S[i].z;
    return { element: n + 1, surface: i, glass: g.name, nd: g.nd, vd: g.vd, r1, r2, ct, diameter: 2 * Math.max(...S[i].profile.concat(S[j].profile).map((p) => Math.abs(p[1]))), f: 1 / ((g.nd - 1) * (1 / r1 - 1 / r2 + (g.nd - 1) * ct / (g.nd * r1 * r2))) };
  });
  expect(want.map((w) => w.glass), 'the triplet\'s glasses').toEqual(['N-SK16', 'F2', 'N-SK16']);
  expect(want[1].f, 'the middle element is the diverging flint').toBeLessThan(0);
  await bind(page, 'layout2D-glasses');
  const rel = (got, exp, tol, what) => expect(Math.abs(got - exp), `${what}: ${got} vs ${exp}`).toBeLessThanOrEqual(tol * Math.abs(exp));
  for (const w of want) {
    // the point of the polygon (where the browser's hit test finds the polygon) farthest from every drawn ray run, by distance to the runs' segments in client px
    const at = await page.evaluate((i) => {
      const poly = window.HOST.querySelector(`polygon[data-surface="${i}"]`), to = window.T.proj(poly), pts = window.T.pts(poly);
      poly.scrollIntoView({ block: 'center' });
      const segs = [];
      window.HOST.querySelectorAll('polyline[data-field]').forEach((m) => { const q = window.T.pts(m).map((p) => window.T.proj(m)(p)); for (let j = 1; j < q.length; j++) segs.push([q[j - 1], q[j]]); });
      const dist = (c, [u, v]) => { const dx = v[0] - u[0], dy = v[1] - u[1], t = Math.max(0, Math.min(1, ((c[0] - u[0]) * dx + (c[1] - u[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(c[0] - u[0] - t * dx, c[1] - u[1] - t * dy); };
      const zs = pts.map((p) => p[0]), z0 = Math.min(...zs), z1 = Math.max(...zs), y1 = Math.max(...pts.map((p) => p[1]));
      let best = null;
      for (let a = 0; a <= 100; a++) for (let b = 0; b <= 100; b++) {
        const [x, y] = to([z0 + (z1 - z0) * (0.1 + 0.8 * a / 100), y1 * (-0.95 + 1.9 * b / 100)]);
        if (document.elementFromPoint(x, y) !== poly) continue;
        const clear = Math.min(...segs.map((s) => dist([x, y], s)));
        if (!best || clear > best.clear) best = { x, y, clear };
      }
      return best;
    }, w.surface);
    expect(at, `element ${w.element}: a polygon point to hover`).not.toBeNull();
    expect(at.clear, `element ${w.element}: farther than interact's 24 px reach from every ray run`).toBeGreaterThan(24.5);
    const ev = await hoverAt(page, at.x, at.y);
    expect(ev, `element ${w.element} hovered`).not.toBeNull();
    expect([ev.field, ev.ray, ev.series], 'a lens is not a ray or a series').toEqual([undefined, undefined, undefined]);
    expect(ev.element, 'element').toBe(w.element);
    expect(ev.glass, 'glass').toBe(w.glass);
    expect(ev.nd, 'nd').toBe(w.nd);
    expect(ev.vd, 'vd').toBe(w.vd);
    rel(ev.r1, w.r1, 0.03, `element ${w.element} R1`);
    rel(ev.r2, w.r2, 0.03, `element ${w.element} R2`);
    expect(Math.abs(ev.ct - w.ct), 'ct').toBeLessThanOrEqual(0.01);
    expect(Math.abs(ev.diameter - w.diameter), 'diameter').toBeLessThanOrEqual(0.01);
    rel(ev.f, w.f, 0.015, `element ${w.element} f`);
    // the tooltip: five lines in the user's layout, numbers to the CR's digits (R and f 1 decimal, CT and diameter 2, nd 4, vd 2), a true minus sign
    const lines = (await page.evaluate(() => window.HOST.querySelector('.eleo-hover__tip').textContent)).split('\n');
    expect(lines, 'five lines').toHaveLength(5);
    const num = (s) => +s.replace('−', '-');
    expect(lines[0], 'line 1').toBe(`element ${w.element} · ${w.glass}`);
    expect(lines[1], 'line 2').toBe(`nd ${w.nd.toFixed(4)} · vd ${w.vd.toFixed(2)}`);
    const l3 = lines[2].match(/^R1 (\S+) · R2 (\S+) mm$/), l4 = lines[3].match(/^CT (\d+\.\d{2}) · ⌀ (\d+\.\d{2}) mm$/), l5 = lines[4].match(/^f ≈ (\S+) mm$/);
    expect(l3, `line 3 "${lines[2]}"`).not.toBeNull();
    expect(l4, `line 4 "${lines[3]}"`).not.toBeNull();
    expect(l5, `line 5 "${lines[4]}"`).not.toBeNull();
    for (const t of [l3[1], l3[2], l5[1]]) expect(t, 'one decimal, a true minus').toMatch(/^[−]?\d+\.\d$/);
    rel(num(l3[1]), w.r1, 0.03, 'tooltip R1'); rel(num(l3[2]), w.r2, 0.03, 'tooltip R2');
    closeTo(+l4[1], w.ct, 0.01, 'tooltip CT'); closeTo(+l4[2], w.diameter, 0.01, 'tooltip diameter');
    rel(num(l5[1]), w.f, 0.015, 'tooltip f');
  }
  await page.evaluate(() => window.STOP());
});
