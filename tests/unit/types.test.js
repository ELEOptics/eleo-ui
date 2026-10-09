// Layout2DProps.labels accepts null entries and still rejects non-text, under tsc --strict (#72, CR #71).
// RecordedSurface.glass takes a {name, nd, vd} Glass and rejects a bare catalog name (#96, tests/types/glass.ts).
// curve.ts: CurvePlotProps takes typed series, rejects a color option and an unknown role (#178).
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
