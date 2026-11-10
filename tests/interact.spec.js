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
