// Plan #4 (agent_docs/plans/4-brand-fixes.md), issue #16: the --series-k blocks in plots.css.
// oracle: property (each palette block maps --series-1..8 to a permutation of --field-1..8); spec CSS Cascade (equal specificity: the later declaration wins, so the standard block must come first)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../packages/plots/src/plots.css', import.meta.url), 'utf8');

// Every rule block that declares --series-k, in source order: its selector and its k -> n mapping.
const blocks = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, sel, body]) => ({
    selector: sel.trim().replace(/\s+/g, ' '),
    pairs: [...body.matchAll(/--series-(\d+)\s*:\s*var\(\s*--field-(\d+)\s*\)/g)].map(([, k, n]) => [Number(k), Number(n)]),
  }))
  .filter((b) => b.pairs.length);

const palette = (name) => `[data-palette="${name}"], [data-palette="${name}"] [data-theme]`;
const EXPECTED = [':root, [data-theme]', palette('standard'), palette('red-green'), palette('blue-yellow')];

test('each palette maps all 8 fields once, standard block first', () => {
  assert.deepEqual(blocks.map((b) => b.selector), EXPECTED, 'the four blocks, standard first, in this order');
  for (const { selector, pairs } of blocks) {
    assert.deepEqual(pairs.map(([k]) => k), [1, 2, 3, 4, 5, 6, 7, 8], `${selector}: --series-1..8 in order`);
    assert.deepEqual(pairs.map(([, n]) => n).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8], `${selector}: each field once`);
  }
  const order = (i) => blocks[i].pairs.map(([, n]) => n);
  assert.deepEqual(order(1), order(0), 'data-palette="standard" restates the :root order');
});
