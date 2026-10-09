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
    assert.deepEqual(f.fieldAnglesDeg, sample.fields, `${file}: fields equal the sample's`);
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
    assert.equal(m.sources.length, m.fieldAnglesDeg.length);
    m.sources.forEach((s, i) => {
      assert.equal(s.fieldAngleDeg, m.fieldAnglesDeg[i]);
      for (const k of ['tangential', 'sagittal']) assert.ok(s[k].length > 4 && s[k][0][0] === 0, `${lens} source ${i} ${k} runs from zero frequency`);
    });
    for (const name of ['field-curvature', 'distortion']) {
      const f = read(`../fixtures/phos-core/${lens}-${name}.json`);
      assert.equal(f.sources.length, f.fieldAnglesDeg.length, `${lens} ${name}: one result per source`);
    }
  }
});
