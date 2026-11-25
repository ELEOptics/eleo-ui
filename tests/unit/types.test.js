// Layout2DProps.labels accepts null entries and still rejects non-text, under tsc --strict (#72, CR #71).
// RecordedSurface.glass takes a {name, nd, vd} Glass and rejects a bare catalog name (#96, tests/types/glass.ts).
// curve.ts: CurvePlotProps takes typed series, rejects a color option and an unknown role (#178).
// panels.ts: SpotPanelsProps accepts their documented options under --strict (#280, #283).
// oracle: spec #67's shipped layout2D: a null label skips that fan (packages/plots/src/layout2d.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const files = ['layout2d-labels.ts', 'glass.ts'].map((f) => fileURLToPath(new URL(`../types/${f}`, import.meta.url)));

test('layout2D labels type-checks null entries under --strict, against src/index.d.ts', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', ...files], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('curve typed series type-check under --strict', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/curve.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #232, O3 (issue #242; #243 types panels and spot, #246 unskips; #280 sample-call options showStats and reference, no label).
// oracle: spec roadmap Constraints (typed API alongside the old one)
test('panels and spot points type-check under --strict', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/panels.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #284, O3 (issue #295; #296 types bars and limits and unskips). tests/types/bars.ts:
// a Seidel call, a merit-share call (one unsigned series by operand name), a curve call with limits and role 'limit',
// and @ts-expect-error on a color key and on an x limit in bars.
// oracle: spec roadmap Constraints (typed API alongside the old one)
test('bars and limits type-check under --strict', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/bars.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #337, O1 (issues #361, #373; CR #360, #371, #372). tests/types/layout2d-mirror.ts: a layout with mirror, obscuration
// and annular (hole) surfaces and dead rays, and @ts-expect-error on mirror: "yes" and dead: [[1]].
// oracle: CR #360, #371, #372 (RecordedSurface gains optional mirror, obscuration and hole; RecordedLayout gains dead)
test('layout mirror and obscuration type-check under --strict', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/layout2d-mirror.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #337, O2 (issues #343, #344). tests/types/layout2d-alive.ts: a layout with `alive` passes layout2D,
// and @ts-expect-error on alive: [[true]].
// oracle: spec roadmap Constraints (typed API alongside the old one)
test('layout alive type-checks under --strict', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/layout2d-alive.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #642, O1 and O2 (issue #645). tests/types/layout2d-status.ts: a layout with `status` and a call with `show` pass,
// and @ts-expect-error on status: [[["ALIVE"]]] and show: "Dead".
// oracle: the Rust RayStatus names (Alive, Virtual, Dead), row M's rule
test('layout status and show type-check under --strict', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/layout2d-status.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #389, O1 (issue #393). tests/types/map2d.ts: a typed grid call (PSF, wavefront with aperture and colorbar, log, polar samples),
// the sample canvas call unchanged, and @ts-expect-error on a missing extent, non-numeric values, a color map and polar without angles.
// oracle: spec roadmap Constraints (typed API alongside the old one)
test('map2D typed grid type-checks', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--lib', 'es2022,dom',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/map2d.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #603 (issue #610). tests/types/sizes.ts: minWidth(name, props) returns a number on the module and on ELEO,
// and @ts-expect-error on an unknown renderer name and a missing name.
// oracle: spec roadmap Constraints (typed API alongside the old one)
test('minWidth type-checks', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--lib', 'es2022,dom',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/sizes.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #677, O1 (#681). tests/types/keys.ts: a labelled series, a key of entries and keyAt compile on both curve calls,
// and @ts-expect-error on an unknown keyAt and a color on a key entry.
// oracle: spec ADR-0001 (roles and indexes, never a color)
test('curve keys type-check under --strict', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--lib', 'es2022,dom',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/keys.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #804 M1 (issue #809). tests/types/interact.ts: interact with and without onhover, a HoverEvent with and without label, role and panel,
// readout with axis specs and a null event, on the default object too, and @ts-expect-error on a string handler, a string digits,
// a selector in place of an element.
// oracle: spec packages/plots/src/interact.js (interact, readout)
test('interact types', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--lib', 'es2022,dom',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/interact.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #1076 M1 (issue #1081). tests/types/export.ts: standalone and png compile on the module and on ELEO with and without options,
// and @ts-expect-error on a div, a string scale, a string fonts and a missing svg.
// oracle: spec plan 1076 (#1081 Behaviour: the two signatures)
test('standalone and png type-check', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--lib', 'es2022,dom',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/export.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #1193, item #1197. tests/types/layout3d.ts: Layout3DProps takes a RecordedLayout and a ray set; @ts-expect-error on missing data, rays: true and a non-layout data.
test('layout3d.ts', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/layout3d.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Plan #1193, item #1254. layout3D is its own entry: the main entry has no layout3D, ./layout3d has it, and no ESM file but the layout3d entry's own chunks holds three's source.
// oracle: spec plan #1193 item #1254 (Behaviour: three is an optional peer, external in the ESM build)
test('layout3D is only in the ./layout3d entry, and three is not bundled into the ESM build', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../../packages/plots/package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.exports['./layout3d'], './layout3d is exported');
  assert.deepEqual(pkg.peerDependenciesMeta, { three: { optional: true } });
  assert.equal(pkg.peerDependencies.three, '>=0.170 <1');
  const dist = new URL('../../packages/plots/dist/', import.meta.url);
  const main = await import(new URL('index.js', dist));
  assert.equal('layout3D' in main, false, 'the main entry has no layout3D');
  assert.equal('layout3D' in main.default, false, 'the default object has no layout3D');
  assert.equal(typeof (await import(new URL('layout3d.js', dist))).layout3D, 'function');
  const esm = [...readdirSync(dist).filter((f) => f.endsWith('.js') && !f.startsWith('eleo-')), ...readdirSync(new URL('chunks/', dist)).map((f) => `chunks/${f}`)];
  for (const f of esm) assert.doesNotMatch(readFileSync(new URL(f, dist), 'utf8'), /class WebGLRenderer|class LatheGeometry/, `${f} holds no three source`);
  assert.match(readFileSync(new URL('layout3d.js', dist), 'utf8'), /from ?"three"/, 'dist/layout3d.js imports three');
  assert.doesNotMatch(readFileSync(new URL('eleo-plots.js', dist), 'utf8'), /layout3D|WebGLRenderer/, 'eleo-plots.js has no layout3D');
  assert.match(readFileSync(new URL('eleo-layout3d.js', dist), 'utf8'), /LatheGeometry/, 'eleo-layout3d.js bundles three');
});

// Plan #1193, item #1275 (CR #1271). layout3d.js re-exports render3d as layout3D: the entry exports exactly layout3D, and it is render3d.
// oracle: spec plan #1193 item #1275 (Behaviour: export { render3d as layout3D })
test('./layout3d exports exactly layout3D, which is render3d', async () => {
  const entry = await import('../../packages/plots/src/layout3d.js');
  const three = await import('../../packages/plots/src/layout3dThree.js');
  assert.deepEqual(Object.keys(entry), ['layout3D']);
  assert.equal(entry.layout3D, three.render3d);
});

// Plan #1258, O5 (issue #1203; each removal item appends its block). tests/types/removed.ts: every removed call fails the type check under @ts-expect-error.
// oracle: spec plan #1258's removal table (Milestones)
test('removed calls fail the type check', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--lib', 'es2022,dom',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/removed.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
