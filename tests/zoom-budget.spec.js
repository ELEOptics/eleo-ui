// Zoom budget (plan #804, CR #984, issue #985): a 1000x zoom redraws within a browser-work budget, and draws nothing far from its window. Run after `npm run build`.
// oracle: measurement CR #984: Chromium trace (devtools.timeline) summed over RasterTask and RunTask per redraw at 1000x (Wandersleb 4380 ms, Cooke 1966 ms, MTF 5032 ms, MTF limits 6642 ms; 1x 6-23 ms); performance.now around a frame is no oracle, headless frames are capped at 16.7 / 33.3 ms
// The drawn-point test reads each point through its own group's matrix and the frame from `data-band` (layout) or the series viewport (curve), never getScreenCTM.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BUDGET_MS = 150;
const SLACK_PX = 32;
const TILES = ['layout2D-wandersleb', 'layout2D-glasses', 'layout2D-cassegrain', 'mtf', 'mtf-limits'];
const LIGHT = '.theme[data-theme="light"]';

async function ready(page, tile) {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.locator(`${LIGHT} [data-tile="${tile}"]`).scrollIntoViewIfNeeded();
}

// In the page: the 1000x view of a tile, from its unzoomed drawing. The window is centred on drawn geometry: the midpoint of the middle segment of a layout's longest ray, or of a curve's longest series; half-width frame/2/1000 per axis.
function windowOf(body) {
  const layout = body.querySelector('g[data-view="layout"]');
  const g = layout || body.querySelector('svg[width] > g[transform^="matrix("]');
  if (!g) throw new Error('no data group');
  const [a, , , d] = g.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
  const vp = g.parentNode;
  const [bw, bh] = layout ? layout.getAttribute('data-band').split(/\s+/).map(Number).slice(2)
    : ['width', 'height'].map((q) => +vp.getAttribute(q));
  const marks = layout ? [...g.querySelectorAll('polyline[data-ray]')] : [...g.querySelectorAll('polyline[data-series], path[data-series]')];
  let best = null;
  for (const el of marks) {
    const n = (el.getAttribute('points') || el.getAttribute('d') || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
    if (!best || n.length > best.length) best = n;
  }
  if (!best || best.length < 4) throw new Error('no segment to centre on');
  const i = Math.floor((best.length / 2 - 1) / 2) * 2; // the middle segment starts at point i/2
  const cx = (best[i] + best[i + 2]) / 2, cy = (best[i + 1] + best[i + 3]) / 2;
  const hx = Math.abs(bw / 2 / 1000 / a), hy = Math.abs(bh / 2 / 1000 / d);
  return { layout: !!layout, x: [cx - hx, cx + hx], y: [cy - hy, cy + hy] };
}

test('a 1000x zoom redraws within budget', async ({ page, browser }, info) => { // #985, unskipped by #991
  test.setTimeout(900000);
  const medians = {};
  for (const tile of TILES) {
    await ready(page, tile);
    const sel = `${LIGHT} [data-tile="${tile}"] .eleo-plot__body`;
    const w = await page.evaluate(`(${windowOf.toString()})(document.querySelector(${JSON.stringify(sel)}))`);
    const view1000 = { x: w.x, y: w.y };
    const costs = [];
    for (let i = 0; i < 5; i++) {
      const path = info.outputPath(`${tile}-${i}.json`);
      await browser.startTracing(page, { path, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
      await page.evaluate(({ sel, view }) => new Promise((res) => {
        const body = document.querySelector(sel);
        body._view = view; body._redraw();
        requestAnimationFrame(() => setTimeout(res, 0));
      }), { sel, view: view1000 });
      await browser.stopTracing();
      const events = JSON.parse(readFileSync(path, 'utf8')).traceEvents || [];
      costs.push(events.filter((ev) => ev.ph === 'X' && (ev.name === 'RasterTask' || ev.name === 'RunTask')).reduce((s, ev) => s + (ev.dur || 0), 0) / 1000);
    }
    costs.sort((p, q) => p - q);
    medians[tile] = costs[2];
  }
  console.log('1000x redraw browser work (ms):', JSON.stringify(medians));
  for (const tile of TILES) expect(medians[tile], `${tile} at 1000x`).toBeLessThan(BUDGET_MS);
});

// The window test reports the farthest point of every polyline, polygon and line of the data group, through its screen matrix, from the frame.
test('a zoomed plot draws only near its window', async ({ page }) => { // #985, unskipped by #991
  for (const tile of TILES) {
    await ready(page, tile);
    const sel = `${LIGHT} [data-tile="${tile}"] .eleo-plot__body`;
    const w = await page.evaluate(`(${windowOf.toString()})(document.querySelector(${JSON.stringify(sel)}))`);
    const worst = await page.evaluate(({ sel, view, slack }) => new Promise((res) => {
      const body = document.querySelector(sel);
      body._view = view; body._redraw();
      requestAnimationFrame(() => setTimeout(() => {
        const layout = body.querySelector('g[data-view="layout"]');
        const groups = layout ? [layout] : [...body.querySelectorAll('svg[width] > g[transform^="matrix("]')];
        let far = 0, count = 0;
        for (const g of groups) {
          const [a, , , d, e, f] = g.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
          const vp = g.parentNode;
          const [vx, vy] = layout ? [0, 0] : [+vp.getAttribute('x') || 0, +vp.getAttribute('y') || 0];
          const [fx, fy, fw, fh] = layout ? layout.getAttribute('data-band').split(/\s+/).map(Number)
            : ['x', 'y', 'width', 'height'].map((q) => +vp.getAttribute(q));
          const pts = [];
          for (const el of g.querySelectorAll('polyline, polygon')) {
            const n = el.getAttribute('points').split(/[\s,]+/).filter(Boolean).map(Number);
            for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
          }
          for (const el of g.querySelectorAll('line')) {
            pts.push([+el.getAttribute('x1'), +el.getAttribute('y1')], [+el.getAttribute('x2'), +el.getAttribute('y2')]);
          }
          for (const [x, y] of pts) {
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const px = vx + a * x + e, py = vy + d * y + f;
            far = Math.max(far, fx - px, px - (fx + fw), fy - py, py - (fy + fh));
            count++;
          }
        }
        res({ far, count });
      }, 0));
    }), { sel, view: { x: w.x, y: w.y }, slack: SLACK_PX });
    expect(worst.count, `${tile} draws points to measure`).toBeGreaterThan(0);
    expect(worst.far, `${tile}: farthest point outside the frame, px`).toBeLessThanOrEqual(SLACK_PX);
  }
});
