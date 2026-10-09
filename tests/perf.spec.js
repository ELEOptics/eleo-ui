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
