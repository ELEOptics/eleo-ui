// CR #113, issues #116 and #118: the READMEs state no gzipped size for the standalone layout entry, so no figure can go stale.
// CR #800, issue #801: the entry has no size budget; only this README check remains.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('README states no gzipped size for the entry', () => {
  for (const path of ['../../README.md', '../../packages/plots/README.md']) {
    const lines = readFileSync(new URL(path, import.meta.url), 'utf8').split('\n')
      .filter((line) => line.includes('`eleo-layout.js`'));
    assert.ok(lines.length > 0, `${path} has no line about eleo-layout.js`);
    for (const line of lines) {
      assert.doesNotMatch(line, /\d+ KB (gzipped|minified)/i, `${path} states the entry's size: ${line}`);
    }
  }
});
