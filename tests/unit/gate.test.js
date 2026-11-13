// Plan #1018, issue #1019: the gallery tests run in Chromium, Firefox and WebKit. Written skipped; #1026 unskips them.
// The tests do not read the config back: they run `playwright test --list --reporter=json` and assert on what each project resolves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

// project -> [{ file, name }]; a test's name is its describe titles and its title.
// PERF and SHOTS turn on the opt-in specs, which are all Chromium-only files, so one listing serves every test.
// listed once per run: the spawn is the cost, and the three callers only read the result
let cache;
const listing = () => (cache ??= list());
function list() {
  const out = execFileSync('npx', ['playwright', 'test', '--list', '--reporter=json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: { ...process.env, PERF: '1', SHOTS: '1' },
  });
  const byProject = new Map();
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        if (!byProject.has(t.projectName)) byProject.set(t.projectName, []);
        byProject.get(t.projectName).push({ file: spec.file.split('/').pop(), name: [...path, spec.title].join(' ') });
      }
    }
    for (const s of suite.suites ?? []) walk(s, [...path, s.title]);
  };
  for (const s of JSON.parse(out).suites) walk(s, []);
  return byProject;
}

// oracle: user roadmap row S (2026-11-10): Chromium, Firefox and WebKit; spec Playwright projects (playwright.dev/docs/test-projects) (O1)
test('three browsers', () => {
  assert.deepEqual([...listing().keys()].sort(), ['chromium', 'firefox', 'webkit']);
  for (const path of ['scripts/check.sh', '.github/workflows/ci.yml']) {
    const line = read(path).split('\n').find((l) => /playwright install/.test(l));
    assert.ok(line, `${path} installs browsers`);
    for (const b of ['chromium', 'firefox', 'webkit']) assert.match(line, new RegExp(`\\b${b}\\b`), `${path} installs ${b}`);
  }
});

// oracle: spec Playwright: CDPSession and browser.startTracing are Chromium only (playwright.dev/docs/api/class-cdpsession); measurement roadmap U14: headless Chromium; user round 2 (2026-11-12): the PNG recording stays Chromium's (O2)
test('chromium-only specs', () => {
  const only = ['zoom-budget', 'perf', 'gallery-shots', 'pixel-ratio', 'map2d-sample'].map((n) => `${n}.spec.js`);
  const byProject = listing();
  const lists = (p, f) => (byProject.get(p) ?? []).some((t) => t.file === f);
  for (const f of only) assert.ok(lists('chromium', f), `chromium lists ${f}`);
  for (const p of ['firefox', 'webkit']) {
    for (const f of only) assert.ok(!lists(p, f), `${p} does not list ${f}`);
  }
  for (const f of readdirSync(new URL('tests/', root)).filter((n) => n.endsWith('.spec.js'))) {
    const src = read(`tests/${f}`);
    // match on the file: a skip can take a condition computed from the browser (browserName, or the project name, which is the browser) earlier
    assert.ok(!(/browserName|project\??\.name|projectName/.test(src) && /\.(skip|fixme|fail)\(/.test(src)), `${f} conditions no skip on the browser`);
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

// Plan #1018, issue #1023: the gate and CI install all three browsers before the projects exist.
// oracle: spec Playwright CLI: `playwright install [--with-deps] <browsers>`, `test --project=<name>` (playwright.dev/docs/browsers, playwright.dev/docs/test-cli)
test('installs', () => {
  const installLine = (path) => read(path).split('\n').find((l) => /playwright install/.test(l));
  for (const path of ['scripts/check.sh', '.github/workflows/ci.yml', 'README.md']) {
    const line = installLine(path);
    assert.ok(line, `${path} has an install line`);
    for (const b of ['chromium', 'firefox', 'webkit']) assert.match(line, new RegExp(`\\b${b}\\b`), `${path} installs ${b}`);
  }
  assert.match(installLine('.github/workflows/ci.yml'), /--with-deps/);
  const readme = read('README.md');
  assert.match(readme, /npx playwright test --project=firefox/);
  assert.doesNotMatch(readme, /--browser/);
  assert.match(readme, /three browsers/);
});

// Plan #1018, issues #1024, #1039: the gallery tests run in three projects.
// oracle: spec Playwright projects (playwright.dev/docs/test-projects)
test('projects', () => {
  assert.deepEqual([...listing().keys()].sort(), ['chromium', 'firefox', 'webkit']);
});

// Plan #1018, issue #1029: no interaction test is pending. Written skipped; #1035 unskipped it.
// oracle: each test's own oracle, unchanged (U13: a pointer at a drawn point emits that point); a per-browser tolerance only through a CR the user accepts (O3)
test('interact runs everywhere', () => {
  const byProject = listing();
  const wanted = byProject.get('chromium').filter((t) => t.file === 'interact.spec.js' || t.name === 'tooltip on every curve tile');
  assert.ok(wanted.some((t) => t.file === 'interact.spec.js'), 'chromium lists the interact tests');
  assert.ok(wanted.some((t) => t.name === 'tooltip on every curve tile'), 'chromium lists the tooltip test');
  for (const p of ['firefox', 'webkit']) {
    const listed = new Set(byProject.get(p).map((t) => `${t.file} ${t.name}`));
    const missing = wanted.filter((t) => !listed.has(`${t.file} ${t.name}`)).map((t) => t.name);
    assert.deepEqual(missing, [], `${p} lists every interaction test`);
  }
});

// Plan #1018, issue #1036: no title is pending in any browser. Written skipped; #1040 unskips it.
// oracle: each test's own oracle, unchanged; a browser differs from Chromium only by the Chromium-only files (O4)
const SKIP_O4 = 'unskipped by #1040';
test('nothing pending', { skip: SKIP_O4 }, async () => {
  const config = (await import(new URL('playwright.config.js', root))).default;
  assert.ok(!('PENDING' in (await import(new URL('playwright.config.js', root)))), 'the config exports no pending list');
  for (const p of config.projects) assert.equal(p.grepInvert, undefined, `${p.name} inverts no grep`);
  const byProject = listing();
  const only = ['zoom-budget', 'perf', 'gallery-shots', 'pixel-ratio', 'map2d-sample'].map((n) => `${n}.spec.js`);
  const full = byProject.get('chromium').filter((t) => !only.includes(t.file)).map((t) => `${t.file} ${t.name}`).sort();
  for (const p of ['firefox', 'webkit']) {
    assert.deepEqual(byProject.get(p).map((t) => `${t.file} ${t.name}`).sort(), full, `${p} lists every test chromium does, bar the Chromium-only files`);
  }
});
