import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fanPanels } from '../../packages/plots/src/fan.js';

// Plan #232, issue #235.
// oracle: reference packages/plots/src/sample.json fans and opdFans: each panel's points are the sample's values at pupil -1 + 2i/(N - 1)
const sample = JSON.parse(readFileSync(new URL('../../packages/plots/src/sample.json', import.meta.url), 'utf8'));

test("fanPanels carries the sample's fans", () => {
  for (const [kind, key, unit] of [['tra', 'fans', 'µm'], ['opd', 'opdFans', 'waves']]) {
    const src = structuredClone(sample[key]);
    src[1].T[0][3] = null; // a vignetted ray
    const s = { ...sample, [key]: src };
    const n = src.length, { panels, columns, x, y } = fanPanels(s, { kind });
    assert.equal(columns, n, `${kind}: a column per field`);
    assert.equal(panels.length, 2 * n, `${kind}: rows T and S`);
    assert.deepEqual(x.range, [-1, 1]);
    assert.equal(x.label, 'Pupil');
    assert.ok(y.range && y.range[0] === -y.range[1] && y.range[1] > 0, `${kind}: y range symmetric`);
    assert.ok(y.label && y.unit === unit, `${kind}: y names the quantity and unit`);
    ['T', 'S'].forEach((row, r) => src.forEach((F, c) => {
      const p = panels[r * n + c];
      assert.equal(p.title, `${s.fields[c].toFixed(1)}° · ${row === 'T' ? 'Py' : 'Px'}`);
      assert.equal(p.series.length, F[row].length);
      F[row].forEach((vals, wi) => {
        assert.equal(p.series[wi].index, wi);
        assert.equal(p.series[wi].points.length, vals.length);
        vals.forEach((v, i) => {
          const [px, py] = p.series[wi].points[i];
          assert.ok(Math.abs(px - (-1 + 2 * i / (vals.length - 1))) < 1e-12);
          assert.equal(py, v);
        });
      });
    }));
    assert.equal(panels[1].series[0].points[3][1], null, `${kind}: null kept`);
    // every value fits the range
    for (const p of panels) for (const se of p.series) for (const [, v] of se.points) if (v !== null) assert.ok(Math.abs(v) <= y.range[1]);
  }
  const f = fanPanels(sample, { fields: [2, 0], fullScale: 77 });
  assert.equal(f.columns, 2);
  assert.deepEqual(f.y.range, [-77, 77]);
  assert.equal(f.panels[0].title, `${sample.fields[2].toFixed(1)}° · Py`);
  assert.equal(f.panels[1].series[0].points[5][1], sample.fans[0].T[0][5]);
});
