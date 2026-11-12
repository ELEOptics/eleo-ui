// U14 (plan #162): curve redraw budget, measured in the gallery page. Run: PERF=1 npx playwright test tests/perf.spec.js
// oracle: measurement roadmap U14: median of 20 redraws of ELEO.curve with 20 series of 200 points, innerHTML set then layout forced, by performance.now() in headless Chromium; over 16 ms is reported (kill criterion D-J), not asserted
import { test, expect } from '@playwright/test';

// U14 is a measurement, not a gate: the test exists only when PERF=1 (opt-in), so a normal run neither runs nor lists it.
if (process.env.PERF === '1') test('curve redraw (U14)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body[data-ready]')).toHaveCount(1);
  const median = await page.evaluate(() => {
    const series = Array.from({ length: 20 }, (_, s) => ({
      index: s,
      points: Array.from({ length: 200 }, (_, i) => [i / 199, 0.5 + 0.4 * Math.sin(i / 20 + s)]),
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const times = [];
    for (let r = 0; r < 20; r++) {
      const t0 = performance.now();
      host.innerHTML = window.ELEO.curve({ series, x: { label: 'x', range: [0, 1] }, y: { label: 'y', range: [0, 1] }, width: 600, height: 400 });
      host.getBoundingClientRect();
      if (!host.querySelector('svg')) throw new Error('curve drew no svg');
      times.push(performance.now() - t0);
    }
    host.remove();
    times.sort((a, b) => a - b);
    return (times[9] + times[10]) / 2;
  });
  console.log(`curve redraw median: ${median.toFixed(2)} ms`);
  test.info().annotations.push({ type: 'median-ms', description: median.toFixed(2) });
});

// U14 for the panels call (plan #232): 6 panels, 3 series of 41 points, same method as above.
if (process.env.PERF === '1') test('curve panels redraw (U14)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body[data-ready]')).toHaveCount(1);
  const median = await page.evaluate(() => {
    const panels = Array.from({ length: 6 }, (_, p) => ({
      title: `${p}.0°`,
      series: Array.from({ length: 3 }, (_, s) => ({
        index: s,
        points: Array.from({ length: 41 }, (_, i) => [i / 40, 0.5 + 0.4 * Math.sin(i / 5 + s + p)]),
      })),
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const times = [];
    for (let r = 0; r < 20; r++) {
      const t0 = performance.now();
      host.innerHTML = window.ELEO.curve({ panels, columns: 3, x: { label: 'x', range: [0, 1] }, y: { label: 'y', range: [0, 1] }, width: 600, height: 400 });
      host.getBoundingClientRect();
      if (!host.querySelector('svg')) throw new Error('curve panels drew no svg');
      times.push(performance.now() - t0);
    }
    host.remove();
    times.sort((a, b) => a - b);
    return (times[9] + times[10]) / 2;
  });
  console.log(`curve panels redraw median: ${median.toFixed(2)} ms`);
  test.info().annotations.push({ type: 'median-ms', description: median.toFixed(2) });
});

// U14 for spot (plan #232): 3 panels, 10 000 points in total, stats and the Airy circle on (the defaults).
if (process.env.PERF === '1') test('spot redraw (U14)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body[data-ready]')).toHaveCount(1);
  const median = await page.evaluate(() => {
    const panels = Array.from({ length: 3 }, (_, p) => ({ title: `${p}.0°`, airy: 2.5, series: [{ index: 0, points: [] }] }));
    for (let i = 0; i < 10000; i++) {
      const a = i * 2.399963, r = 3 * Math.sqrt((i % 3334) / 3334);
      panels[i % 3].series[0].points.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    const host = document.createElement('div');
    document.body.appendChild(host);
    const times = [];
    for (let r = 0; r < 20; r++) {
      const t0 = performance.now();
      host.innerHTML = window.ELEO.spot({ panels, unit: 'µm', width: 600, height: 300 });
      host.getBoundingClientRect();
      if (!host.querySelector('svg')) throw new Error('spot drew no svg');
      times.push(performance.now() - t0);
    }
    host.remove();
    times.sort((a, b) => a - b);
    return (times[9] + times[10]) / 2;
  });
  console.log(`spot redraw median: ${median.toFixed(2)} ms`);
  test.info().annotations.push({ type: 'median-ms', description: median.toFixed(2) });
});

// U14 for bars (plan #284): 50 categories x 7 series plus the total, with one y limit, same method as above.
if (process.env.PERF === '1') test('bars redraw (U14)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body[data-ready]')).toHaveCount(1);
  const median = await page.evaluate(() => {
    const categories = Array.from({ length: 50 }, (_, c) => `S${c}`);
    const series = Array.from({ length: 7 }, (_, s) => ({
      index: s,
      label: `T${s}`,
      values: categories.map((_, c) => 0.01 * Math.sin(c / 5 + s) * (s + 1)),
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const times = [];
    for (let r = 0; r < 20; r++) {
      const t0 = performance.now();
      host.innerHTML = window.ELEO.bars({ categories, series, total: 'Σ', limits: [{ y: 0.05, label: 'limit' }], y: { label: 'y' }, width: 600, height: 400 });
      host.getBoundingClientRect();
      if (!host.querySelector('svg')) throw new Error('bars drew no svg');
      times.push(performance.now() - t0);
    }
    host.remove();
    times.sort((a, b) => a - b);
    return (times[9] + times[10]) / 2;
  });
  console.log(`bars redraw median: ${median.toFixed(2)} ms`);
  test.info().annotations.push({ type: 'median-ms', description: median.toFixed(2) });
});

// U14 for layout2D (plan #337, #345): 50 surfaces with 41-point profiles, 3 fields of 21 rays, half with a dotted tail (alive), collimated fans (parallel first segments, so the starts move), same method as above.
if (process.env.PERF === '1') test('layout2D redraw (U14)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body[data-ready]')).toHaveCount(1);
  const median = await page.evaluate(() => {
    const surfaces = Array.from({ length: 50 }, (_, s) => {
      const sd = 10, z = s * 5, c = 0.02 * Math.cos(s);
      return {
        z, sd, stop: s === 25, image: s === 49,
        glass: s === 49 ? null : s % 2 ? null : (s % 4 === 0 ? 'crown' : 'flint'),
        profile: Array.from({ length: 41 }, (_, i) => { const y = -sd + (2 * sd * i) / 40; return [z + c * y * y, y]; }),
      };
    });
    // one slope per fan on the first segment (collimated), so the moved-starts path runs; the rays converge after it
    const pts = (f, r) => Array.from({ length: 51 }, (_, k) => [k * 5, (r / 20 - 0.5) * 18 * (1 - Math.max(0, k - 1) / 60) + f * k * 0.05]);
    const rays = Array.from({ length: 3 }, (_, f) => Array.from({ length: 21 }, (_, r) => pts(f, r)));
    const alive = rays.map((fan) => fan.map((_, r) => (r % 2 ? 30 : 51)));
    const data = { surfaces, rays, alive };
    // the fixture must take the moved-starts path (#387): the drawn starts of collimated fans sit left of the first surface (z 0)
    if (!(window.ELEO.layoutBounds([data]).zmin < 0)) throw new Error('layout2D fixture does not take the moved-starts path');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const times = [];
    for (let r = 0; r < 20; r++) {
      const t0 = performance.now();
      host.innerHTML = window.ELEO.layout2D({ data, rays: 'fan', width: 800 });
      host.getBoundingClientRect();
      if (!host.querySelector('svg')) throw new Error('layout2D drew no svg');
      times.push(performance.now() - t0);
    }
    host.remove();
    times.sort((a, b) => a - b);
    return (times[9] + times[10]) / 2;
  });
  console.log(`layout2D redraw median: ${median.toFixed(2)} ms`);
  test.info().annotations.push({ type: 'median-ms', description: median.toFixed(2) });
});

// U14 for the typed map2D (plan #389): 256 x 256 cells, a Gaussian spot, PNG encode and markup, same method as above (the image's decode is not forced).
if (process.env.PERF === '1') test('map2D redraw (U14)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body[data-ready]')).toHaveCount(1);
  const median = await page.evaluate(() => {
    const n = 256;
    const values = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => {
      const x = (c / (n - 1) - 0.5) * 2, y = (r / (n - 1) - 0.5) * 2;
      return Math.exp(-2 * (x * x + y * y) / 0.25);
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const times = [];
    for (let r = 0; r < 20; r++) {
      const t0 = performance.now();
      host.innerHTML = window.ELEO.map2D({ values, extent: [-1, 1, -1, 1], x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, map: 'ember', el: host, width: 460, height: 360 });
      host.getBoundingClientRect();
      const img = host.querySelector('svg image');
      if (!img || !String(img.getAttribute('href')).startsWith('data:image/png')) throw new Error('map2D drew no PNG image');
      times.push(performance.now() - t0);
    }
    host.remove();
    times.sort((a, b) => a - b);
    return (times[9] + times[10]) / 2;
  });
  console.log(`map2D redraw median: ${median.toFixed(2)} ms`);
  test.info().annotations.push({ type: 'median-ms', description: median.toFixed(2) });
});

// U14 for hover (plan #804, O7, issue #813): one pointer move on a 10 000-point spot and on a 256 x 256 typed map resolves in under 16 ms.
// oracle: measurement roadmap U14: median of 20 pointer moves, each a synthetic `pointermove` dispatched on the interact host and timed with performance.now() around the dispatch (the handler is synchronous, so the dispatch returns once the hover is resolved, the tooltip placed and the dot drawn), in headless Chromium; each move lands on a different dot or cell, so no move is a repeat that interact skips. Unlike the redraw tests above, it asserts: over 16 ms fails (kill criterion D-J), which is how #815 chooses a bucketed scan early.
// The pointers are placed from the data group's `matrix(...)` attribute (spot) or the <image>'s x/y/width/height (map) and the root's getBoundingClientRect, never getScreenCTM.
if (process.env.PERF === '1') test('hover (U14)', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body[data-ready]')).toHaveCount(1);
  const medians = await page.evaluate(() => {
    const median = (times) => { times.sort((a, b) => a - b); return (times[9] + times[10]) / 2; };
    const move = (host, [x, y]) => { host.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true })); };
    const timed = (host, at) => at.map((q) => { const t0 = performance.now(); move(host, q); return performance.now() - t0; });
    const mount = (html) => {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:0;top:0;width:600px;background:#fff;z-index:9';
      host.innerHTML = html;
      document.body.appendChild(host);
      return host;
    };
    // spot: the U14 spot reference (3 panels, 10 000 points in all); 20 dots of the first panel's series, spread along it
    const panels = Array.from({ length: 3 }, (_, p) => ({ title: `${p}.0°`, airy: 2.5, series: [{ index: 0, points: [] }] }));
    for (let i = 0; i < 10000; i++) {
      const a = i * 2.399963, r = 3 * Math.sqrt((i % 3334) / 3334);
      panels[i % 3].series[0].points.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    const spotHost = mount(window.ELEO.spot({ panels, unit: 'µm', width: 600, height: 300 }));
    const stopSpot = window.ELEO.interact(spotHost, { onhover: () => {} });
    const mark = spotHost.querySelector('path[data-series]');
    if (!mark) throw new Error('spot marks carry no data-series');
    const group = mark.closest('g[transform^="matrix("]'), [a, , , d, e, f] = group.getAttribute('transform').match(/matrix\(([^)]*)\)/)[1].split(/[\s,]+/).map(Number);
    const vp = group.closest('svg'), root = vp.ownerSVGElement || vp, box = root.getBoundingClientRect(), k = box.width / root.viewBox.baseVal.width;
    const n = mark.getAttribute('d').replace(/h\s*-?[\d.]+/g, ' ').replace(/M/g, ' ').split(/[\s,]+/).filter(Boolean).map(Number);
    const dots = Array.from({ length: 20 }, (_, j) => { const i = 100 + j * 150; return [box.left + (+vp.getAttribute('x') + a * n[2 * i] + e) * k, box.top + (+vp.getAttribute('y') + d * n[2 * i + 1] + f) * k]; });
    const spot = median(timed(spotHost, dots));
    stopSpot(); spotHost.remove();
    // map: the U14 map reference (256 x 256 Gaussian); 20 cells down the diagonal, values given so the value lookup is timed too
    const N = 256, values = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => {
      const x = (c / (N - 1) - 0.5) * 2, y = (r / (N - 1) - 0.5) * 2;
      return Math.exp(-2 * (x * x + y * y) / 0.25);
    }));
    const mapHost = mount('');
    mapHost.innerHTML = window.ELEO.map2D({ values, extent: [-1, 1, -1, 1], x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, map: 'ember', el: mapHost, width: 460, height: 360 });
    const stopMap = window.ELEO.interact(mapHost, { values, onhover: () => {} });
    const img = mapHost.querySelector('svg image'), mroot = img.ownerSVGElement, mbox = mroot.getBoundingClientRect(), mk = mbox.width / mroot.viewBox.baseVal.width;
    const [ix, iy, iw, ih] = ['x', 'y', 'width', 'height'].map((q) => +img.getAttribute(q));
    const cells = Array.from({ length: 20 }, (_, j) => { const c = 10 + j * 11; return [mbox.left + (ix + (c + 0.5) / N * iw) * mk, mbox.top + (iy + (c + 0.5) / N * ih) * mk]; });
    const map = median(timed(mapHost, cells));
    stopMap(); mapHost.remove();
    return { spot, map };
  });
  console.log(`hover median: spot ${medians.spot.toFixed(2)} ms, map ${medians.map.toFixed(2)} ms`);
  test.info().annotations.push({ type: 'median-ms', description: `spot ${medians.spot.toFixed(2)}, map ${medians.map.toFixed(2)}` });
  expect(medians.spot, '10 000-point spot hover under 16 ms').toBeLessThan(16);
  expect(medians.map, '256 x 256 map hover under 16 ms').toBeLessThan(16);
});
