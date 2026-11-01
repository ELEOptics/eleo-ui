// Records the sample canvases map2D(canvas, { kind }) draws in the gallery, as PNG data URLs per theme column.
// Run it against a build of the plan's base (agent_docs/plans/389-map2d-typed.md, O3); tests/map2d.spec.js
// then asserts the current build draws the same pixels. Never re-record from code under test.
//   npm run build && node scripts/record-map2d-baseline.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const port = 4599;
const server = spawn(process.execPath, [new URL('../gallery/serve.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${port}/gallery/`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${port}/gallery/`);
  await page.waitForSelector('body[data-ready="true"]');
  const recorded = {};
  for (const theme of ['light', 'dark']) for (const kind of ['psf', 'wavefront']) {
    recorded[`${kind}-${theme}`] = await page.locator(`.theme[data-theme="${theme}"] [data-canvas="${kind}"]`).evaluate((c) => c.toDataURL('image/png'));
  }
  await browser.close();
  writeFileSync(new URL('../tests/fixtures/map2d-baseline.json', import.meta.url), JSON.stringify(recorded, null, 1) + '\n');
  console.log(`wrote tests/fixtures/map2d-baseline.json (${Object.keys(recorded).length} canvases)`);
} finally { server.kill(); }
