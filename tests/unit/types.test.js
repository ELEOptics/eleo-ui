// Layout2DProps.labels accepts null entries and still rejects non-text, under tsc --strict (#72, CR #71).
// RecordedSurface.glass takes a {name, nd, vd} Glass and rejects a bare catalog name (#96, tests/types/glass.ts).
// curve.ts: CurvePlotProps takes typed series, rejects a color option and an unknown role (#178).
// panels.ts: SpotPanelsProps and SpotSampleProps accept their documented options under --strict (#280, #283).
// oracle: spec #67's shipped layout2D: a null label skips that fan (packages/plots/src/layout2d.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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

// Plan #337, O2 (issue #343; #344 types alive and unskips). tests/types/layout2d-alive.ts: a layout with `alive` passes layout2D,
// and @ts-expect-error on alive: [[true]].
// oracle: spec roadmap Constraints (typed API alongside the old one)
test('layout alive type-checks under --strict', { skip: 'plan #337 #344 types alive' }, () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', fileURLToPath(new URL('../types/layout2d-alive.ts', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
