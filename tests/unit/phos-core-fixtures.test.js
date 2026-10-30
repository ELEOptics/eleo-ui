// Fixture checks for plan #162 (agent_docs/plans/162-curve-typed.md), work item #169.
// oracle: reference packages/plots/src/sample.json, the achromat's independent trace (efl, fields, wavelengths)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
      assert.ok(ray.length > 0 && ray.every((p) => p.every(Number.isFinite)), `field ${i} ray ${j}: non-empty, finite points`);
      assert.ok(Number.isInteger(f.alive[i][j]) && f.alive[i][j] >= 0 && f.alive[i][j] <= ray.length, `field ${i} ray ${j}: alive in 0..len`);
    });
  });
  const lower = (fan) => fan.reduce((k, r, j) => (r[0][1] < fan[k][0][1] ? j : k), 0);
  const l28 = lower(f.rays[2]);
  assert.equal(f.alive[2][l28], 2, 'the 28 degree lower ray is alive through S1 and Virtual at S2 (points: start, S1, S2)');
  const l14 = lower(f.rays[1]);
  assert.ok(f.alive[1][l14] < f.rays[1][l14].length, 'the 14 degree lower ray is vignetted: it does not reach the image alive');
  assert.deepEqual(f.alive[0].filter((a, j) => j > 0 && j < 10 && a !== f.rays[0][j].length), [], 'the on-axis fan is alive but for its marginal rays');
  // CR #372: dead[field][ray] is true when the first non-ALIVE status is a Dead kind (not Virtual or Missed).
  assert.equal(f.dead.length, 3);
  f.dead.forEach((fan) => assert.equal(fan.length, 11));
  assert.equal(f.dead[1][l14], true, 'the 14 degree lower ray is dead');
  assert.equal(f.dead.flat().filter(Boolean).length, 1, 'no other ray is dead');
  assert.equal(f.dead[2][l28], false, 'the 28 degree lower ray is virtual, not dead');
  assert.deepEqual(f.dead[0].filter((d, j) => j > 0 && j < 10 && d), [], 'the on-axis marginals are not dead');
});

// Plan #337 work item #357 (CR #352). oracle: user the tutorial Cassegrain of phos-core's models/src/example/cassegrain.rs: its
// secondary and the obscuration stop the on-axis chief, so the recorded 0 degree chief is not alive at the image.
test('recorded Cassegrain layout obscures its axial chief', () => {
  const f = read('../fixtures/phos-core/cassegrain-layout.json');
  assert.match(f.phosCore.sha, /^[0-9a-f]{40}$/);
  assert.equal(f.analysis, 'layout');
  assert.equal(f.rays.length, 3, 'fields 0, 0.35 and 0.5 degrees');
  assert.deepEqual(f.chief, [5, 5, 5]);
  f.rays.forEach((fan, i) => {
    assert.equal(fan.length, 11);
    assert.equal(f.alive[i].length, 11);
    fan.forEach((ray, j) => {
      assert.ok(ray.length > 0 && ray.every((p) => p.every(Number.isFinite)), `field ${i} ray ${j}: non-empty, finite points`);
      assert.ok(Number.isInteger(f.alive[i][j]) && f.alive[i][j] >= 0 && f.alive[i][j] <= ray.length, `field ${i} ray ${j}: alive in 0..len`);
    });
  });
  assert.ok(f.alive[0][5] < f.rays[0][5].length, 'the 0 degree chief is not alive at the end of its path');
  // CR #371, #372: the primary's hole, and the obscured rays 4-6 of each field are dead.
  assert.equal(f.surfaces[1].hole, 10, 'the primary\'s annular aperture starts at 10 mm');
  assert.equal(f.surfaces.filter((s) => 'hole' in s).length, 1, 'only the primary has a hole');
  assert.deepEqual(f.dead.map((fan) => fan.map((d, j) => (d ? j : -1)).filter((j) => j >= 0)), [[4, 5, 6], [4, 5, 6], [4, 5, 6]], 'rays 4-6 of each field are dead');
  // CR #360: the flags mark the optics, and are written only when true.
  assert.deepEqual(f.surfaces.filter((s) => s.mirror).map((s) => Math.round(s.z)), [0, -75], 'the primary (z 0) and the secondary (z -75) are mirrors');
  assert.deepEqual(f.surfaces.filter((s) => s.obscuration).map((s) => Math.round(s.z * 100) / 100), [-76.25], 'one obscuration, at z -76.25');
  assert.ok(f.surfaces.every((s) => s.mirror !== false && s.obscuration !== false), 'flags are written only when true');
  const w = read('../fixtures/phos-core/wandersleb-layout.json');
  assert.ok(w.surfaces.every((s) => !('mirror' in s) && !('obscuration' in s)), 'the Wandersleb recording has neither flag');
});

// Plan #389 work item #411. oracle: phos-core PointSpread at 0 deg (pupil 64, zero pad 64: 192 x 192), rows top-down as coordinates() gives them
test('psf recorded as grids', () => {
  for (const lens of ['achromat', 'cooke']) {
    const file = `${lens}-psf.json`;
    assert.ok(existsSync(new URL(file, dir)), `${file} is recorded`);
    const f = read(`../fixtures/phos-core/${file}`);
    assert.equal(f.analysis, 'psf', `${lens}: analysis`);
    assert.match(f.phosCore.sha, /^[0-9a-f]{40}$/);
    assert.equal(f.values.length, 192, `${lens}: 192 rows`);
    for (const row of f.values) {
      assert.equal(row.length, 192, `${lens}: 192 columns`);
      for (const v of row) assert.ok(Number.isFinite(v) && v >= 0, `${lens}: irradiance ${v} is finite and non-negative`);
    }
    const [x0, x1, y0, y1] = f.extent;
    assert.ok(x1 > x0 && y1 > y0, `${lens}: extent ${f.extent} is increasing`);
    assert.ok(x0 < 0 && x1 > 0 && y0 < 0 && y1 > 0, `${lens}: the on-axis PSF is inside its extent`);
    let best = [0, 0];
    f.values.forEach((row, r) => row.forEach((v, c) => { if (v > f.values[best[0]][best[1]]) best = [r, c]; }));
    const px = (best[1] + 0.5) / 192 * (x1 - x0) + x0, py = y1 - (best[0] + 0.5) / 192 * (y1 - y0);
    assert.ok(Math.abs(px) < 0.1 * (x1 - x0) && Math.abs(py) < 0.1 * (y1 - y0), `${lens}: the 0 deg peak at (${px}, ${py}) mm is near the origin`);
  }
});

// Plan #389 work item #392 (absorbs #310, #370). oracle: the recorder's own refusals, run on stand-ins for phos-core: the Seidel
// term length must be the surface count plus one, and the Cassegrain obscuration is told from the secondary by its flat profile.
test('recorder guards refuse bad orders', () => {
  const py = String.raw`
import importlib.util, json, sys, tempfile
from pathlib import Path
spec = importlib.util.spec_from_file_location("rec", "scripts/record-phos-core.py")
rec = importlib.util.module_from_spec(spec); spec.loader.exec_module(rec)

class R:
    wavelength = 0.55
    def __init__(self, n):
        for k in rec.SEIDEL_TERMS: setattr(self, k, [1.0] * n)
class Run:
    def __init__(self, n): self.n = n
    def results(self): return [R(self.n)]
class Settings:
    n = 0
    def set_system_index(self, i): pass
    def run(self, model): return Run(Settings.n)
class Phos: SeidelSettings = Settings

def seidel(n, want):
    Settings.n = n
    with tempfile.TemporaryDirectory() as d:
        try:
            rec.seidel(Phos, "lens", None, 550.0, Path(d), {}, want); return "ok"
        except SystemExit as e: return str(e)

flat = [[0.0, y] for y in (-1.0, 0.0, 1.0)]
bowl = [[y * y, y] for y in (-1.0, 0.0, 1.0)]
def surf(prof, sd): return {"sd": sd, "profile": prof}
def order(s):
    try: rec.check_cassegrain_order(s, 10.0); return "ok"
    except SystemExit as e: return str(e)

print(json.dumps({
  "seidelRight": seidel(4, 4), "seidelLong": seidel(5, 4), "seidelShort": seidel(3, 4),
  "orderRight": order([surf(flat, 10.0), surf(bowl, 55.0), surf(bowl, 10.0)]),
  "orderSwapped": order([surf(bowl, 10.0), surf(bowl, 55.0), surf(flat, 10.0)]),
}))
`;
  const r = spawnSync('python3', ['-I', '-c', py], { cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.seidelRight, 'ok', 'the expected term length passes');
  assert.match(out.seidelLong, /5 values.*plus one \(4\)/, 'a term one longer than the surface count plus one is refused');
  assert.match(out.seidelShort, /3 values.*plus one \(4\)/, 'a short term is refused');
  assert.equal(out.orderRight, 'ok', 'obscuration first, secondary third passes');
  assert.match(out.orderSwapped, /obscuration.*flat/, 'the secondary in the obscuration\'s place is refused though its sd matches');
});
