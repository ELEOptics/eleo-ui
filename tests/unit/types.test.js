// Layout2DProps.labels accepts null entries and still rejects non-text, under tsc --strict (#72, CR #71).
// oracle: spec #67's shipped layout2D: a null label skips that fan (packages/plots/src/layout2d.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const file = fileURLToPath(new URL('../types/layout2d-labels.ts', import.meta.url));

test('layout2D labels type-checks null entries under --strict, against src/index.d.ts', () => {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
