import { defineConfig } from '@playwright/test';

// Specs that need Chromium's CDP or its tracing, or record Chromium's PNGs (plan #1018, O2).
const CHROMIUM_ONLY = ['zoom-budget', 'perf', 'gallery-shots', 'pixel-ratio', 'map2d-sample'].map((n) => `**/${n}.spec.js`);

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.js',
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'node gallery/serve.mjs', url: 'http://localhost:4173/gallery/', reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' }, testIgnore: CHROMIUM_ONLY },
    { name: 'webkit', use: { browserName: 'webkit' }, testIgnore: CHROMIUM_ONLY },
  ],
});
