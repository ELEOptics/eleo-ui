// Plan #804, issue #1013 (CR #1010): the interact and wrapper docs name the keys and the host's tab stop.
// oracle: spec packages/plots/README.md ### Keyboard (the one home of the key list; interact makes the host tabindex="0" unless set)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

// The doc comment (/** ... */) directly above the line that starts with `anchor`.
function docAbove(src, anchor) {
  const at = src.indexOf(anchor);
  assert.ok(at > 0, `${anchor} is in index.d.ts`);
  const start = src.lastIndexOf('/**', at);
  return src.slice(start, at).replace(/\s+/g, ' ');
}

test('index.d.ts: interact and onview doc comments name the keys and the focusable host', () => {
  const dts = read('packages/plots/src/index.d.ts');
  for (const anchor of ['onview?:', 'export declare function interact(']) {
    const doc = docAbove(dts, anchor);
    assert.match(doc, /Keyboard/, `${anchor} doc points to the Keyboard section`);
    assert.match(doc, /README/, `${anchor} doc points to the plots README`);
  }
  assert.match(docAbove(dts, 'onview?:'), /`\+`, `=`/, 'onview doc names the zoom keys');
  assert.match(docAbove(dts, 'export declare function interact('), /tabindex="0"/, 'interact doc names the host tab stop');
});

test('plots-svelte README and the svelte changeset name the keys and the tab stop', () => {
  const readme = read('packages/plots-svelte/README.md');
  assert.match(readme, /tab stop|tabindex="0"/, 'README says the wrapper box is a tab stop');
  assert.match(readme, /Keyboard/, 'README points to the Keyboard section');
  const cs = read('.changeset/interact-svelte.md');
  assert.match(cs, /tabindex="0"/, 'changeset names tabindex="0"');
  assert.match(cs, /BarPlot/, 'changeset names BarPlot');
});
