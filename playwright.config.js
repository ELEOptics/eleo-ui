import { defineConfig } from '@playwright/test';

// Specs that need Chromium's CDP or its tracing, or record Chromium's PNGs (plan #1018, O2).
const CHROMIUM_ONLY = ['zoom-budget', 'perf', 'gallery-shots', 'pixel-ratio', 'map2d-sample'].map((n) => `**/${n}.spec.js`);

// U14 for the 3D spike runs on a GPU-backed Chromium, locally and only with PERF=1 GPU=1 (plan #1193, CR #1257): CI's WebGL is
// software (SwiftShader, 85-105 ms) and times nothing. Run: PERF=1 GPU=1 npx playwright test gallery.spec -g "layout3D tiles draw" --project=chromium
const GPU = process.env.PERF === '1' && process.env.GPU === '1';

// Chromium's WebGL backend. CI has no GPU: SwiftShader, explicitly allowed (newer Chromium refuses the fallback otherwise).
const SOFT_GL = GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : process.env.CI ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.js',
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'node gallery/serve.mjs', url: 'http://localhost:4173/gallery/', reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: { args: SOFT_GL } } },
    { name: 'firefox', use: { browserName: 'firefox' }, testIgnore: CHROMIUM_ONLY },
    { name: 'webkit', use: { browserName: 'webkit' }, testIgnore: CHROMIUM_ONLY },
  ],
});
