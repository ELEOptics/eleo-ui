// oracle: spec DOM MutationObserver attributeFilter
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileModule } from 'svelte/compiler';

const root = fileURLToPath(new URL('../../', import.meta.url));
const src = readFileSync(join(root, 'packages/plots-svelte/src/lib/theme.svelte.js'), 'utf8');

test('a data-palette change bumps the tick', async () => {
  // Under node_modules so the compiled output resolves svelte/internal/client.
  const dir = mkdtempSync(join(root, 'node_modules', '.theme-tick-'));
  const observers = [];
  globalThis.window = globalThis;
  globalThis.document = { documentElement: {} };
  globalThis.MutationObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
  };
  globalThis.matchMedia = () => ({ addEventListener() {} });
  try {
    const file = join(dir, 'theme.svelte.js');
    writeFileSync(file, compileModule(src, { generate: 'client', filename: 'theme.svelte.js' }).js.code);
    const { themeTick } = await import(pathToFileURL(file).href);

    const before = themeTick();
    assert.equal(observers.length, 1);
    assert.equal(observers[0].target, document.documentElement);
    assert.ok(observers[0].options.attributeFilter.includes('data-palette'), `attributeFilter: ${observers[0].options.attributeFilter}`);
    observers[0].cb([{ attributeName: 'data-palette' }]);
    observers[0].cb([{ attributeName: 'data-palette' }]);
    assert.equal(themeTick(), before + 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    for (const k of ['window', 'document', 'MutationObserver', 'matchMedia']) delete globalThis[k];
  }
});
