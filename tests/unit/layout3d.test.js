// Acceptance tests for plan #1193 (agent_docs/plans/1193-layout3d-typed-major.md), outcome O1. Written skipped; #1199 unskips them.
// oracle: closed-form orthographic projection (rotation written below) of each recorded layout's revolved profile; property glassFill per glass name
// Assumed mesh API (#1195): layout3dMesh(layout, { width }) -> { faces: [{ v: [[x, y, z], ...], glass, fill }] } with z the optical axis;
// project(p, view) -> [px, py, depth] with view { yaw, pitch, scale, center: [x, y, z], origin: [ox, oy] }.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sample from '../../packages/plots/src/sample.js';
import { glassFill, drawnGlasses } from '../../packages/plots/src/glass.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/layouts/${name}.json`, import.meta.url)));
const LAYOUTS = { achromat: sample.layout, cooke: fixture('analysis-glasses'), wandersleb: JSON.parse(readFileSync(new URL('../fixtures/phos-core/wandersleb-layout.json', import.meta.url))).layout };
const VIEWS = [{ yaw: -38, pitch: 16 }, { yaw: 20, pitch: -10 }];
const SCALE = 6, ORIGIN = [280, 160]; // px/mm, px
const mesh = async () => import('../../packages/plots/src/layout3d.js');

// Independent orthographic projection: yaw about the y axis, then pitch about the x axis; px right, py down.
function ortho([x, y, z], { yaw, pitch }, zc) {
  const th = yaw * Math.PI / 180, ph = pitch * Math.PI / 180, q = z - zc;
  const h = q * Math.cos(th) - x * Math.sin(th), d = q * Math.sin(th) + x * Math.cos(th);
  return [ORIGIN[0] + h * SCALE, ORIGIN[1] - (y * Math.cos(ph) - d * Math.sin(ph)) * SCALE];
}
// z of a surface's profile at radius r (profile is [z, y] pairs, y from -sd to sd; the y >= 0 half is interpolated)
function profileZ(s, r) {
  const half = s.profile.filter((p) => p[1] >= -1e-9);
  for (let i = 0; i + 1 < half.length; i++) {
    const [z0, y0] = half[i], [z1, y1] = half[i + 1];
    if (r >= y0 - 1e-9 && r <= y1 + 1e-9) return z0 + ((z1 - z0) * (r - y0)) / (y1 - y0 || 1);
  }
  return null;
}

test.skip('revolved profiles project', async () => {
  const { layout3dMesh, project } = await mesh();
  for (const [name, layout] of Object.entries(LAYOUTS)) for (const v of VIEWS) {
    const { faces } = layout3dMesh(layout, { width: 560 });
    const zc = layout.surfaces[layout.surfaces.length - 1].z / 2;
    const view = { ...v, scale: SCALE, center: [0, 0, zc], origin: ORIGIN };
    assert.ok(faces.length > 0, `${name}: faces`);
    for (const f of faces) for (const p of f.v) {
      const r = Math.hypot(p[0], p[1]), phi = Math.atan2(p[1], p[0]);
      const got = project(p, view);
      const best = Math.min(...layout.surfaces.map((s) => {
        const z = profileZ(s, r);
        if (z === null) return Infinity;
        const want = ortho([r * Math.cos(phi), r * Math.sin(phi), z], v, zc);
        return Math.hypot(got[0] - want[0], got[1] - want[1]);
      }), Infinity);
      // the image plane is square, not revolved: its corners are exempt
      if (f.image) continue;
      assert.ok(best <= 0.5, `${name} yaw ${v.yaw} pitch ${v.pitch}: vertex ${p} is ${best.toFixed(2)} px from the revolved profile`);
    }
  }
});

test.skip('glass fills per element', async () => {
  const { layout3dMesh } = await mesh();
  // {name, nd, vd} glasses: every glazed face carries glassFill's fill for its glass name, and every glass has faces
  const cooke = LAYOUTS.cooke, glasses = drawnGlasses(cooke.surfaces), fills = glassFill(glasses);
  const named = layout3dMesh(cooke, { width: 560 }).faces.filter((f) => !f.image && f.glass !== undefined);
  assert.ok(named.length > 0, 'cooke: glazed faces');
  for (const f of named) {
    assert.ok(fills.has(f.glass), `cooke: glassFill has an entry for ${f.glass}`);
    assert.equal(f.fill, fills.get(f.glass), `cooke: a ${f.glass} face carries glassFill's fill`);
  }
  for (const g of new Set(glasses.map((x) => x.name))) assert.ok(named.some((f) => f.glass === g), `cooke: ${g} has faces`);
  // The "crown"/"flint" shorthand is not in glassFill's map (it takes {name, nd, vd} only), so its elements keep their
  // tokens instead: one fill per shorthand, the same in every layout, and crown differs from flint.
  const tone = (layout, g) => new Set(layout3dMesh(layout, { width: 560 }).faces.filter((f) => !f.image && f.glass === g).map((f) => f.fill));
  const crown = tone(LAYOUTS.achromat, 'crown'), flint = tone(LAYOUTS.achromat, 'flint'), wand = tone(LAYOUTS.wandersleb, 'crown');
  assert.equal(crown.size, 1, 'crown has one fill');
  assert.equal(flint.size, 1, 'flint has one fill');
  assert.notEqual([...crown][0], [...flint][0], 'crown and flint differ');
  assert.deepEqual([...wand], [...crown], 'wandersleb crown elements keep the crown token');
});
