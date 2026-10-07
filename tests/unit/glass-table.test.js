// Plan #90 (agent_docs/plans/90-glass-identity.md), issue #91: the test-only glass table behind O1's fills.
// oracle: fixture tests/fixtures/glasses.json (manufacturer catalog values, one source URL per row; see glasses.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const glasses = JSON.parse(readFileSync(new URL('../fixtures/glasses.json', import.meta.url), 'utf8'));

test('table rows are sourced, distinct, in range', () => {
  assert.ok(Array.isArray(glasses), 'the table is an array of rows');
  assert.ok(glasses.length >= 24 && glasses.length <= 40, `24 to 40 rows, got ${glasses.length}`);
  for (const row of glasses) {
    const { name, catalog, nd, vd, source } = row;
    assert.deepEqual(Object.keys(row).sort(), ['catalog', 'name', 'nd', 'source', 'vd'], `${name}: exactly the five columns`);
    assert.ok(typeof name === 'string' && name.length > 0, 'a name');
    assert.ok(['Schott', 'Ohara', 'CDGM'].includes(catalog), `${name}: catalog Schott, Ohara or CDGM, got ${catalog}`);
    assert.ok(Number.isFinite(nd) && nd >= 1.4 && nd <= 2.1, `${name}: nd in [1.4, 2.1], got ${nd}`);
    assert.ok(Number.isFinite(vd) && vd >= 15 && vd <= 100, `${name}: vd in [15, 100], got ${vd}`);
    assert.match(source, /^https:\/\/\S+$/, `${name}: an https source URL`);
    assert.ok(source.includes(encodeURIComponent(name)) || source.includes(name), `${name}: the source names the glass`);
  }
  const names = glasses.map((g) => g.name);
  assert.equal(new Set(names).size, names.length, 'names are distinct');
  const keys = glasses.map((g) => `${g.nd}/${g.vd}`);
  assert.equal(new Set(keys).size, keys.length, '(nd, vd) pairs are distinct');
  for (const catalog of ['Schott', 'Ohara', 'CDGM']) {
    assert.ok(glasses.some((g) => g.catalog === catalog), `at least one ${catalog} glass`);
  }
  // The Cooke triplet fixture (#97) uses these two.
  for (const name of ['N-SK16', 'F2']) assert.ok(names.includes(name), `includes ${name}`);
});
