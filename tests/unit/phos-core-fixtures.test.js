// Fixture checks for plan #162 (agent_docs/plans/162-curve-typed.md), work item #169.
// oracle: reference packages/plots/src/sample.json, the achromat's independent trace (efl, fields, wavelengths)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (url) => JSON.parse(readFileSync(new URL(url, import.meta.url), 'utf8'));
const sample = read('../../packages/plots/src/sample.json');
const dir = new URL('../fixtures/phos-core/', import.meta.url);
const ANALYSES = ['mtf', 'field-curvature', 'distortion'];

test('recorded achromat is the sample', () => {
  for (const name of ANALYSES) {
    const file = `achromat-${name}.json`;
    assert.ok(existsSync(new URL(file, dir)), `${file} is recorded`);
    const f = read(`../fixtures/phos-core/${file}`);
    assert.ok(Math.abs(f.firstOrder.efl - sample.efl) / sample.efl <= 0.001, `${file}: efl within 0.1% of sample.efl`);
    if (name === 'mtf') assert.deepEqual(f.fieldAnglesDeg, sample.fields, `${file}: fields equal the sample's`); // the sweeps have their own test
    assert.equal(f.wavelengthsNm.length, sample.wl.length, `${file}: wavelength count`);
    f.wavelengthsNm.forEach((w, i) => assert.ok(Math.abs(w - sample.wl[i]) <= 1e-3, `${file}: wavelength ${i} equals the sample's`));
    assert.match(f.phosCore.sha, /^[0-9a-f]{40}$/, `${file}: phos-core sha`);
  }
});

test('recorded fixtures carry what the adapters need', () => {
  for (const lens of ['achromat', 'cooke']) {
    const m = read(`../fixtures/phos-core/${lens}-mtf.json`);
    assert.equal(m.frequencyUnit, 'cycles/mm');
    assert.ok(m.referenceWavelengthNm > 0 && m.firstOrder.fNumber > 0 && m.firstOrder.epd > 0, `${lens}: reference wavelength, f-number and EPD`);
    assert.ok(m.wavelengthsNm.includes(m.referenceWavelengthNm), `${lens}: referenceWavelengthNm ${m.referenceWavelengthNm} is one of ${m.wavelengthsNm}`);
    assert.equal(m.sources.length, m.fieldAnglesDeg.length);
    m.sources.forEach((s, i) => {
      assert.equal(s.sourceIndex, i, `${lens}: sources are in source order (position ${i} holds sourceIndex ${s.sourceIndex})`);
      for (const k of ['tangential', 'sagittal']) assert.ok(s[k].length > 4 && s[k][0][0] === 0, `${lens} source ${i} ${k} runs from zero frequency`);
    });
    for (const name of ['field-curvature', 'distortion']) {
      const f = read(`../fixtures/phos-core/${lens}-${name}.json`);
      assert.equal(f.sources.length, f.fieldAnglesDeg.length, `${lens} ${name}: one result per source`);
    }
  }
});

// Plan #162 CR #211. oracle: the earlier 3-source recording of the achromat (values copied from it, 0/1/2 degrees, three wavelengths each).
const EARLIER = {
  'field-curvature': {
    tangential: [[0.0609639, 0.0956746, 0.17759], [0.00691863, 0.0416841, 0.12358], [-0.155059, -0.12013, -0.0382945]],
    sagittal: [[0.0609639, 0.0956746, 0.17759], [0.0355863, 0.0703268, 0.152233], [-0.0405155, -0.0056857, 0.0761938]],
    chiefHeight: [[0, 0, 0], [1.7459, 1.74605, 1.74614], [3.49277, 3.49308, 3.49325]],
    astigmatism: [[0, 0, 0], [-0.0286677, -0.0286427, -0.0286538], [-0.114544, -0.114444, -0.114488]],
  },
  distortion: {
    realHeight: [[0, 0, 0], [1.7459, 1.74605, 1.74614], [3.49277, 3.49308, 3.49325]],
    paraxialHeight: [[0, 0, 0], [1.74592, 1.74607, 1.74616], [3.4929, 3.49321, 3.49338]],
    percent: [[0, 0, 0], [-0.000934195, -0.000939542, -0.000941331], [-0.00373882, -0.00376023, -0.00376739]],
  },
};

test('field curvature and distortion sweep 11 fields', () => {
  for (const lens of ['achromat', 'cooke']) {
    const maxField = Math.max(...read(`../fixtures/phos-core/${lens}-mtf.json`).fieldAnglesDeg);
    for (const name of ['field-curvature', 'distortion']) {
      const f = read(`../fixtures/phos-core/${lens}-${name}.json`);
      assert.equal(f.sources.length, 11, `${lens} ${name}: 11 sources`);
      assert.equal(f.fieldAnglesDeg.length, 11, `${lens} ${name}: 11 field angles`);
      f.sources.forEach((s, i) => {
        assert.ok(Math.abs(s.fieldAngleDeg - f.fieldAnglesDeg[i]) <= 1e-9, `${lens} ${name}: source ${i} angle matches fieldAnglesDeg`);
        assert.ok(Math.abs(s.fieldAngleDeg - (i * maxField) / 10) <= 1e-6, `${lens} ${name}: source ${i} is ${(i * maxField) / 10} degrees, got ${s.fieldAngleDeg}`);
      });
    }
  }
  for (const [name, keys] of Object.entries(EARLIER)) {
    const f = read(`../fixtures/phos-core/achromat-${name}.json`);
    [0, 5, 10].forEach((srcIdx, k) => {
      for (const [key, rows] of Object.entries(keys)) {
        rows[k].forEach((want, w) => {
          const got = f.sources[srcIdx].results[w][key];
          assert.ok(Math.abs(got - want) <= 1e-9 * Math.max(Math.abs(want), 1e-12), `achromat ${name} ${srcIdx / 5} deg ${key}[${w}]: ${got} vs earlier ${want}`);
        });
      }
    });
  }
});
