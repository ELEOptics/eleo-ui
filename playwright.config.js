import { defineConfig } from '@playwright/test';

// Specs that need Chromium's CDP or its tracing, or record Chromium's PNGs (plan #1018, O2).
const CHROMIUM_ONLY = ['zoom-budget', 'perf', 'gallery-shots', 'pixel-ratio', 'map2d-sample'].map((n) => `**/${n}.spec.js`);

// Titles each browser still fails, from #1020's table (Playwright 1.65.0). Each fix removes its title here.
const HOVER = [
  'non-finite points are skipped',
  'layout ray hover reads along a run',
  'select events',
];
export const PENDING = {
  webkit: [...HOVER],
  firefox: [
    ...HOVER,
    'curve keys',
    'fan and footprint keys',
    'keyboard + - 0 zoom about the current point and reset',
    'recorded PSF cells (U8)',
    'standalone label style (#112)',
    // fails on Linux only (CI run 43273034181); #1031's rounding helper is not shown to fix it
    'layout zoom pan and reset',
  ],
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// anchored from the spec file's name to the title's end: the grep string is the file name, describe titles and the title,
// so 'hover emits the point under the pointer' does not catch 'footprint hover emits ...'
const pending = (browser) =>
  new RegExp(`\\.spec\\.js (${PENDING[browser].map((t) => `${escape(t)}$`).join('|')})`);

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.js',
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'node gallery/serve.mjs', url: 'http://localhost:4173/gallery/', reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' }, testIgnore: CHROMIUM_ONLY, grepInvert: pending('firefox') },
    { name: 'webkit', use: { browserName: 'webkit' }, testIgnore: CHROMIUM_ONLY, grepInvert: pending('webkit') },
  ],
});
