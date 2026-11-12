// Plan #1018, issue #1019: the gallery tests run in Chromium, Firefox and WebKit. Written skipped; #1026 unskips them.
// The tests do not read the config back: they run `playwright test --list --reporter=json` and assert on what each project resolves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const SKIP = 'unskipped by #1026';

// project name -> the spec files it lists; PERF and SHOTS turn on the opt-in specs, so the listing holds them
function listing() {
  const out = execFileSync('npx', ['playwright', 'test', '--list', '--reporter=json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: { ...process.env, PERF: '1', SHOTS: '1' },
  });
  const files = new Map();
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        if (!files.has(t.projectName)) files.set(t.projectName, new Set());
        files.get(t.projectName).add(spec.file.split('/').pop());
      }
    }
    for (const s of suite.suites ?? []) walk(s);
  };
  for (const s of JSON.parse(out).suites) walk(s);
  return files;
}

// oracle: user roadmap row S (2026-11-10): Chromium, Firefox and WebKit; spec Playwright projects (playwright.dev/docs/test-projects) (O1)
test('three browsers', { skip: SKIP }, () => {
  assert.deepEqual([...listing().keys()].sort(), ['chromium', 'firefox', 'webkit']);
  for (const path of ['scripts/check.sh', '.github/workflows/ci.yml']) {
    const line = read(path).split('\n').find((l) => /playwright install/.test(l));
    assert.ok(line, `${path} installs browsers`);
    for (const b of ['chromium', 'firefox', 'webkit']) assert.match(line, new RegExp(`\\b${b}\\b`), `${path} installs ${b}`);
  }
});

// oracle: spec Playwright: CDPSession and browser.startTracing are Chromium only (playwright.dev/docs/api/class-cdpsession); measurement roadmap U14: headless Chromium; user round 2 (2026-11-12): the PNG recording stays Chromium's (O2)
test('chromium-only specs', { skip: SKIP }, () => {
  const only = ['zoom-budget', 'perf', 'gallery-shots', 'pixel-ratio', 'map2d-sample'].map((n) => `${n}.spec.js`);
  const files = listing();
  for (const f of only) assert.ok(files.get('chromium')?.has(f), `chromium lists ${f}`);
  for (const p of ['firefox', 'webkit']) {
    for (const f of only) assert.ok(!files.get(p)?.has(f), `${p} does not list ${f}`);
  }
  for (const f of readdirSync(new URL('tests/', root)).filter((n) => n.endsWith('.spec.js'))) {
    const src = read(`tests/${f}`);
    assert.doesNotMatch(src, /test\.(skip|fixme)\([^)]*browserName/, `${f} conditions no skip on the browser`);
  }
});

// Plan #1018, issue #1020: Playwright 1.65.0, whose Firefox launches on macOS 27.2 without a workaround.
// oracle: user round 2 (2026-11-12): bump to 1.65.0; spec npm semver (package-lock.json resolves @playwright/test)
test('playwright version', () => {
  const lock = JSON.parse(read('package-lock.json'));
  const [maj, min] = lock.packages['node_modules/@playwright/test'].version.split('.').map(Number);
  assert.ok(maj > 1 || (maj === 1 && min >= 65), `lock resolves @playwright/test ${lock.packages['node_modules/@playwright/test'].version}`);
  assert.equal(JSON.parse(read('package.json')).devDependencies['@playwright/test'], '^1.65.0');
});
