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

// Plan #512, issue #517. oracle: closed-form ADR-0003: a rayFan of width W has columns of W / columns, each frame frameOf(W / columns, 4.6 + 1.2)
test('rayFan draws each panel to the rule', async () => {
  const { frameOf } = await import('../../packages/plots/src/scale.js');
  const { rayFan } = await import('../../packages/plots/src/fan.js');
  for (const width of [450, 900, 3600]) {
    const svg = rayFan({ data: sample, width }), cols = sample.fans.length;
    const frames = [...svg.matchAll(/<rect [^>]*width="([\d.]+)"[^>]*stroke="var\(--plot-grid\)"/g)].map((m) => +m[1]);
    assert.equal(frames.length, 2 * cols);
    frames.forEach((f) => assert.ok(Math.abs(f - frameOf(width / cols, 4.6 + 1.2)) <= 0.01, `${width}: frame ${f}`));
  }
});

// Plan #677, issue #685. oracle: reference sample.json `wl` (486.1327, 587.5618, 656.2725 nm), keyed to one decimal
test('rayFan key', async () => {
  const { rayFan } = await import('../../packages/plots/src/fan.js');
  const labels = (svg) => [...svg.matchAll(/<text [^>]*data-key[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  for (const kind of ['tra', 'opd']) {
    assert.deepEqual(labels(rayFan({ data: sample, kind, key: true })), ['486.1 nm', '587.6 nm', '656.3 nm'], `${kind}: one key per wavelength`);
    assert.deepEqual(labels(rayFan({ data: sample, kind })), [], `${kind}: no key by default`);
  }
});
