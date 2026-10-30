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

// Plan #232 M2, work item #238. oracle: reference sample.json and the MTF recordings for the sources, angles and wavelengths
test('spot recorded per source and wavelength', () => {
  for (const lens of ['achromat', 'cooke']) {
    const mtf = read(`../fixtures/phos-core/${lens}-mtf.json`);
    const f = read(`../fixtures/phos-core/${lens}-spot.json`);
    assert.equal(f.analysis, 'spot', `${lens}: analysis`);
    assert.equal(f.lengthUnit, 'mm');
    assert.equal(f.pupilSampling, 32);
    assert.match(f.reference, /paraxial chief ray/);
    assert.match(f.phosCore.sha, /^[0-9a-f]{40}$/);
    assert.deepEqual(f.wavelengthsNm, mtf.wavelengthsNm, `${lens}: wavelengths are the MTF recording's`);
    assert.deepEqual(f.fieldAnglesDeg, mtf.fieldAnglesDeg, `${lens}: sources are the MTF recording's`);
    assert.equal(f.sources.length, mtf.sources.length, `${lens}: one entry per source`);
    const h = f.firstOrder.paraxialImageHeight;
    f.sources.forEach((s, i) => {
      assert.equal(s.sourceIndex, i, `${lens} source ${i}: sourceIndex is its position`);
      assert.equal(s.fieldAngleDeg, mtf.fieldAnglesDeg[i], `${lens} source ${i}: angle`);
      assert.equal(s.points.length, f.wavelengthsNm.length, `${lens} source ${i}: points per wavelength`);
      assert.equal(s.wavelengths.length, f.wavelengthsNm.length, `${lens} source ${i}: wavelengths`);
      s.wavelengths.forEach((w, k) => assert.ok(Math.abs(w - f.wavelengthsNm[k]) <= 1e-3, `${lens} source ${i}: wavelength ${k}`));
      assert.equal(s.enclosingRadius.length, s.points.length, `${lens} source ${i}: a radius per wavelength`);
      s.points.forEach((pts, k) => {
        assert.ok(pts.length > 0 && pts.length <= 32 * 32, `${lens} source ${i} wavelength ${k}: 0 < ${pts.length} <= 1024`);
        for (const [x, y] of pts) assert.ok(Math.abs(x) <= h && Math.abs(y) <= h, `${lens} source ${i} wavelength ${k}: (${x}, ${y}) within paraxialImageHeight ${h}`);
        assert.ok(s.enclosingRadiusAll >= s.enclosingRadius[k], `${lens} source ${i}: polychromatic radius >= wavelength ${k}'s`);
      });
    });
  }
});

// Plan #284 M1, work item #286. oracle: closed-form, phos-core's documented total is the sum of the per-surface values (each rounded to 6 significant digits: relative error up to 5e-6); reference sample.json and the MTF recordings for the wavelengths
const TERMS = ['spherical', 'coma', 'astigmatism', 'fieldCurvature', 'distortion', 'axialColor', 'lateralColor'];
test('seidel recorded per wavelength', () => {
  for (const lens of ['achromat', 'cooke']) {
    const mtf = read(`../fixtures/phos-core/${lens}-mtf.json`);
    const file = `${lens}-seidel.json`;
    assert.ok(existsSync(new URL(file, dir)), `${file} is recorded`);
    const f = read(`../fixtures/phos-core/${file}`);
    assert.equal(f.analysis, 'seidel', `${lens}: analysis`);
    assert.equal(f.lengthUnit, 'mm');
    assert.match(f.phosCore.sha, /^[0-9a-f]{40}$/);
    assert.equal(f.referenceWavelengthNm, mtf.referenceWavelengthNm, `${lens}: reference wavelength is the MTF recording's`);
    assert.ok(f.results.length > 0, `${lens}: a result per wavelength`);
    for (const r of f.results) assert.ok(mtf.wavelengthsNm.some((w) => Math.abs(w - r.wavelengthNm) <= 1e-3), `${lens}: ${r.wavelengthNm} nm is one of ${mtf.wavelengthsNm}`);
    assert.ok(f.results.some((r) => Math.abs(r.wavelengthNm - f.referenceWavelengthNm) <= 1e-3), `${lens}: the reference wavelength is recorded`);
    const n = f.results[0].terms.spherical.length - 1;
    if (lens === 'achromat') assert.equal(n, sample.rx.filter((r) => typeof r.R === 'number').length, 'achromat: one entry per surface of the sample');
    for (const r of f.results) {
      assert.deepEqual(Object.keys(r.terms), TERMS, `${lens} ${r.wavelengthNm}: the seven terms in order`);
      for (const [k, t] of Object.entries(r.terms)) {
        assert.equal(t.length, n + 1, `${lens} ${r.wavelengthNm} ${k}: one entry per surface plus the total`);
        const sum = t.slice(0, n).reduce((a, b) => a + b, 0);
        const tol = (n + 1) * 5e-6 * Math.max(...t.map(Math.abs));
        assert.ok(Math.abs(sum - t[n]) <= tol, `${lens} ${r.wavelengthNm} ${k}: sum ${sum} vs total ${t[n]}`);
      }
    }
  }
});

// Plan #337 work item #339. oracle: user the Wandersleb triplet as ELEOptics/phos#310 states it (28 degree lower ray Virtual at S2,
// 14 degree lower ray vignetted) and phos's fixtures/triplet.toml, which the recording copies.
test('recorded Wandersleb layout is phos-core\'s trace of phos\'s triplet', () => {
  const toml = readFileSync(new URL('wandersleb.toml', dir), 'utf8');
  assert.match(toml, /US 1,073,789/, 'the TOML keeps its source comment');
  const f = read('../fixtures/phos-core/wandersleb-layout.json');
  assert.match(f.phosCore.sha, /^[0-9a-f]{40}$/);
  assert.equal(f.analysis, 'layout');
  assert.deepEqual(f.fieldsDeg, [0, 14, 28]);
  const n = 7; // the TOML's surfaces; the image makes eight
  assert.equal(f.surfaces.length, n + 1, 'seven surfaces and the image');
  assert.deepEqual(f.surfaces.map((s) => s.glass), ['crown', null, 'crown', null, null, 'crown', null, null], 'glass after each lens front surface');
  assert.deepEqual(f.surfaces.map((s) => s.stop), f.surfaces.map((_, i) => i === 4), 'the diaphragm, the TOML\'s fifth surface, is the stop');
  assert.deepEqual(f.surfaces.map((s) => s.image), f.surfaces.map((_, i) => i === n), 'the image is last');
  for (const s of f.surfaces) {
    assert.equal(s.profile.length, 41, 'a 41-point profile');
    assert.ok(s.profile.every((p) => p.every(Number.isFinite)), 'finite profile');
    assert.equal(s.z, s.profile[20][0], 'z is the profile\'s middle point');
    assert.equal(s.sd, Math.max(...s.profile.map((p) => Math.abs(p[1]))), 'sd is the largest |y|');
  }
  assert.equal(f.rays.length, 3);
  assert.deepEqual(f.chief, [5, 5, 5]);
  f.rays.forEach((fan, i) => {
    assert.equal(fan.length, 11);
    assert.equal(f.alive[i].length, 11);
    fan.forEach((ray, j) => {
      assert.ok(ray.every((p) => p.every(Number.isFinite)), `field ${i} ray ${j}: finite points`);
      assert.ok(Number.isInteger(f.alive[i][j]) && f.alive[i][j] >= 0 && f.alive[i][j] <= ray.length, `field ${i} ray ${j}: alive in 0..len`);
    });
  });
  const lower = (fan) => fan.reduce((k, r, j) => (r[0][1] < fan[k][0][1] ? j : k), 0);
  const l28 = lower(f.rays[2]);
  assert.equal(f.alive[2][l28], 2, 'the 28 degree lower ray is alive through S1 and Virtual at S2 (points: start, S1, S2)');
  const l14 = lower(f.rays[1]);
  assert.ok(f.alive[1][l14] < f.rays[1][l14].length, 'the 14 degree lower ray is vignetted: it does not reach the image alive');
  assert.deepEqual(f.alive[0].filter((a, j) => j > 0 && j < 10 && a !== f.rays[0][j].length), [], 'the on-axis fan is alive but for its marginal rays');
});
