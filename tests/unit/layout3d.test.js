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
const LAYOUTS = { achromat: sample.layout, cooke: fixture('analysis-glasses'), wandersleb: JSON.parse(readFileSync(new URL('../fixtures/phos-core/wandersleb-layout.json', import.meta.url))) };
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
      // the image plane is square and the stop ring a flat annulus outside the profile, neither revolved: their vertices are exempt
      if (f.image || f.stop) continue;
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

// The 50-surface reference layout of U14 (tests/perf.spec.js referenceLayout): surfaces only, the mesh reads no rays.
const reference = () => ({
  rays: [],
  surfaces: Array.from({ length: 50 }, (_, s) => {
    const sd = 10, z = s * 5, c = 0.02 * Math.cos(s);
    return {
      z, sd, stop: s === 25, image: s === 49, glass: s === 49 ? null : s % 2 ? null : (s % 4 === 0 ? 'crown' : 'flint'),
      profile: Array.from({ length: 41 }, (_, i) => { const y = -sd + (2 * sd * i) / 40; return [z + c * y * y, y]; }),
    };
  }),
});

test('face budget at 50 surfaces', async () => {
  const { layout3dMesh, project, fitView } = await mesh();
  const big = layout3dMesh(reference(), { width: 560 }).faces;
  assert.ok(big.length <= 3500, `50 surfaces: ${big.length} faces within 3,500`);
  assert.ok(big.length >= 2000, `50 surfaces: ${big.length} faces, not too coarse`);
  assert.ok(big.some((f) => f.image), 'the image plane is a face');
  // a small system keeps a higher density per surface than the 50-surface one
  const per = (L) => { const m = layout3dMesh(L, { width: 560 }); return m.segments * m.rings; };
  assert.ok(per(LAYOUTS.achromat) > per(reference()), 'achromat is denser per surface');
  // the default view fits the rotated bounds into width x height; an explicit scale wins
  const m = layout3dMesh(LAYOUTS.cooke, { width: 560 }), view = fitView(m, { width: 560, height: 320 });
  for (const f of m.faces) for (const p of f.v) { const q = project(p, view); assert.ok(q[0] >= -0.5 && q[0] <= 560.5 && q[1] >= -0.5 && q[1] <= 320.5, `fits: ${q}`); }
  assert.equal(fitView(m, { width: 560, height: 320, scale: 3 }).scale, 3);
  // anything but a RecordedLayout is a named error
  for (const bad of [null, {}, { surfaces: [] }, 'x']) assert.throws(() => layout3dMesh(bad, { width: 560 }), /layout3dMesh: expected a RecordedLayout/);
});

// Plan #1193, item 3 (#1196): layout3D draws the mesh. The drawing is a scene (faces and ray segments, painter-sorted) that the canvas then paints;
// layout3dScene(layout, { width, height, rays, yaw, pitch, scale }, resolve) -> { view, items }, `resolve(fill)` standing in for the browser probe.
const scene = async (layout, o = {}) => (await mesh()).layout3dScene(layout, { width: 560, height: 320, ...o }, () => [100, 100, 100]);
const air = (L) => ({ ...L, surfaces: L.surfaces.map((s) => ({ ...s, glass: null })) });
const segs = (items, k, i) => items.filter((x) => x.kind === 'ray' && x.k === k && x.i === i).map((x) => x.j);

test('rays sort with the faces', async () => {
  const { project } = await mesh();
  const { view, items } = await scene(sample.layout, { rays: 'fan' });
  const faces = items.filter((x) => x.kind === 'face'), rays = items.filter((x) => x.kind === 'ray');
  assert.ok(faces.length > 0 && rays.length > 0, 'faces and rays');
  for (let n = 1; n < items.length; n++) assert.ok(items[n - 1].depth >= items[n].depth - 1e-9, `item ${n} is not nearer than the one before it`);
  // a ray segment sits at its mid depth (larger is farther)
  const L = sample.layout;
  for (const r of rays.slice(0, 20)) {
    const a = L.rays[r.k][r.i][r.j - 1], b = L.rays[r.k][r.i][r.j];
    assert.ok(Math.abs(r.depth - (project([0, a[1], a[0]], view)[2] + project([0, b[1], b[0]], view)[2]) / 2) < 1e-6, `segment ${r.k}/${r.i}/${r.j} mid depth`);
  }
  // sorted with the faces, not before or after them all
  const at = items.map((x) => x.kind), first = at.indexOf('ray'), last = at.lastIndexOf('ray');
  assert.ok(at.slice(first, last).includes('face'), 'a face lies between two ray segments');
  // the achromat's two glass gaps draw no ray: only the air segments before the first surface and after the last
  assert.deepEqual(segs(items, 0, 0), [1, 4]);
  // the sets: marginal-chief is three rays per field, chief one, false none
  const per = async (set) => new Set((await scene(L, { rays: set })).items.filter((x) => x.kind === 'ray' && x.k === 0).map((x) => x.i)).size;
  assert.equal(await per(undefined), 3);
  assert.equal(await per('chief'), 1);
  assert.equal(await per('fan'), L.rays[0].length);
  assert.equal(await per(false), 0);
});

test('dead and virtual cut', async () => {
  const L = air(sample.layout), withAlive = (alive, dead) => ({ ...L, alive: L.rays.map((f, k) => f.map((_, i) => (k === 0 && i === 0 ? alive : 4))), dead: L.rays.map((f, k) => f.map((_, i) => k === 0 && i === 0 && dead)) });
  assert.deepEqual(segs((await scene(L, { rays: 'fan' })).items, 0, 0), [1, 2, 3, 4], 'air: every segment');
  // Virtual from point 2: the segments ending in a Virtual point are not drawn
  assert.deepEqual(segs((await scene(withAlive(2, false), { rays: 'fan' })).items, 0, 0), [1]);
  // Dead at point 2: drawn through it, no further
  assert.deepEqual(segs((await scene(withAlive(2, true), { rays: 'fan' })).items, 0, 0), [1, 2]);
  // status: a segment takes its start point's status; none after the first Dead point, none from a Virtual one
  const st = (s) => ({ ...L, status: L.rays.map((f, k) => f.map((_, i) => (k === 0 && i === 0 ? s : Array(5).fill('Alive')))) });
  assert.deepEqual(segs((await scene(st(['Alive', 'Alive', 'Dead', 'Virtual', 'Virtual']), { rays: 'fan' })).items, 0, 0), [1, 2]);
  assert.deepEqual(segs((await scene(st(['Alive', 'Virtual', 'Virtual', 'Virtual', 'Virtual']), { rays: 'fan' })).items, 0, 0), [1]);
});

// Plan #1193, item #1218 (CR #1217): the default view frames what is drawn, faces and ray segments together.
test('rays framed', async () => {
  for (const L of [LAYOUTS.achromat, LAYOUTS.cooke]) {
    const { items } = await scene(L);
    const rays = items.filter((x) => x.kind === 'ray');
    assert.ok(rays.length > 0, 'rays drawn');
    for (const r of rays) for (const p of r.p) assert.ok(p[0] >= 16 - 0.5 && p[0] <= 560 - 16 + 0.5 && p[1] >= 16 - 0.5 && p[1] <= 320 - 16 + 0.5, `ray endpoint in the margin: ${p}`);
    for (const f of items.filter((x) => x.kind === 'face')) for (const p of f.q) assert.ok(p[0] >= 16 - 0.5 && p[0] <= 560 - 16 + 0.5 && p[1] >= 16 - 0.5 && p[1] <= 320 - 16 + 0.5, `face point in the margin: ${p}`);
  }
  // an explicit scale still wins
  assert.equal((await scene(LAYOUTS.achromat, { scale: 3 })).view.scale, 3);
});

// Plan #1193, item #1197 (CR #1219): the guard runs before the canvas is touched.
test('layout3D without data throws', async () => {
  const { layout3D } = await mesh();
  for (const o of [undefined, {}, { data: undefined }]) assert.throws(() => layout3D({}, o), { name: 'TypeError', message: 'layout3D: pass { data: RecordedLayout }' });
});
