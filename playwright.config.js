import { defineConfig } from '@playwright/test';

// Specs that need Chromium's CDP or its tracing, or record Chromium's PNGs (plan #1018, O2).
const CHROMIUM_ONLY = ['zoom-budget', 'perf', 'gallery-shots', 'pixel-ratio'].map((n) => `**/${n}.spec.js`);

// U14 for the 3D spike runs on a GPU-backed Chromium, locally and only with PERF=1 GPU=1 (plan #1193, CR #1257): CI's WebGL is
// software (SwiftShader, 85-105 ms) and times nothing. Run: PERF=1 GPU=1 npx playwright test gallery.spec -g "layout3D tiles draw" --project=chromium
const GPU = process.env.PERF === '1' && process.env.GPU === '1';

// Chromium's WebGL backend: Metal only for the local GPU timing. CI passes no GL args: ANGLE flags there change how Chromium
// rasterises 2D canvases and drift the pixel recordings (#1260), and Chromium falls back to SwiftShader on its own (run 44765032622).
const GL_ARGS = GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : [];

// Firefox on a GPU-less Linux runner has no hardware GL: force WebGL on so it takes the software path (Mesa llvmpipe; Playwright's
// Firefox already sets webgl.forbid-software false). Prefs from Mozilla's all.js: webgl.force-enabled overrides the blocklist.
const FIREFOX_PREFS = { 'webgl.disabled': false, 'webgl.force-enabled': true, 'webgl.forbid-software': false };

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.js',
  // 60 s, not Playwright's 30 s: the gallery's eight 3D canvases (four kinds, two themes) draw on software WebGL when they scroll near the viewport (#1263),
  // and a test that draws them ran 21-30 s of 30 s under the full gate's parallel load ("select events" timed out, alone 15 s). A load that
  // does not scroll to them pays nothing. CI times nothing (ADR-0005, CR #1257).
  timeout: 60_000,
  // The same load stretches the 5 s default of expect.poll: "canvas tiles redraw at their width" (#632) missed it on the gate that had 60 s.
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'node gallery/serve.mjs', url: 'http://localhost:4173/gallery/', reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: { args: GL_ARGS } } },
    { name: 'firefox', use: { browserName: 'firefox', launchOptions: { firefoxUserPrefs: FIREFOX_PREFS } }, testIgnore: CHROMIUM_ONLY },
    { name: 'webkit', use: { browserName: 'webkit' }, testIgnore: CHROMIUM_ONLY },
  ],
});
