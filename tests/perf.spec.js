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
