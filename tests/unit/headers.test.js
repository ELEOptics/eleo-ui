// Plan #389 (agent_docs/plans/389-map2d-typed.md), issue #426: the source headers carve out the typed map.
// oracle: spec packages/plots/README.md (the typed map bakes its cells: redraw on a theme change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The opening comment: the leading run of // lines, or the first /* ... */ block.
function header(path) {
  const src = readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
  const block = src.match(/^\s*\/\*[\s\S]*?\*\//);
  if (block) return block[0].replace(/\s+/g, ' ');
  return src.split('\n').filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith('//'))).join(' ').replace(/\s+/g, ' ');
}

test('source headers carve out the typed map', () => {
  for (const path of ['packages/plots/src/index.js', 'packages/plots/src/renderers.js', 'packages/plots/src/index.d.ts']) {
    const h = header(path);
    assert.match(h, /tokens\.css variables/, `${path} header states the SVG rule`);
    assert.match(h, /typed `?map2D\(props\)`?[^.]*bak(es|ed)/, `${path} header names the typed map2D(props) as baked`);
    assert.match(h, /again after a theme or palette change/, `${path} header says to redraw`);
  }
});
