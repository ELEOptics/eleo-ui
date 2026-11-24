// Acceptance tests for plan #1193 (agent_docs/plans/1193-layout3d-typed-major.md), outcome O1.
// oracle: closed-form orthographic projection (rotation written below) of each recorded layout's revolved profile; property glassFill per glass name
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sample from '../../packages/plots/src/sample.js';
import { glassFill, drawnGlasses } from '../../packages/plots/src/glass.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/layouts/${name}.json`, import.meta.url)));
const LAYOUTS = { achromat: sample.layout, cooke: fixture('analysis-glasses'), wandersleb: JSON.parse(readFileSync(new URL('../fixtures/phos-core/wandersleb-layout.json', import.meta.url))) };
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
    if (r >= y0 - 1e-5 && r <= y1 + 1e-5) return z0 + ((z1 - z0) * (r - y0)) / (y1 - y0 || 1);
  }
  return null;
}

// Plan #1193, item #1228 (review M1 round 1, finding 6): a bad chief index names layout3D, not layout2D.
// oracle: layout2D's message for the same defect, with the caller's name in its place
const air = (L) => ({ ...L, surfaces: L.surfaces.map((s) => ({ ...s, glass: null })) });
test('bad chief names layout3D', async () => {
  const { layout3dScene } = await three(), L = air(sample.layout);
  for (const chief of [[9, 9, 9], [-1, 0, 0], [1.5, 0, 0]]) {
    assert.throws(() => layout3dScene({ ...L, chief }, {}, () => 0x808080), { message: 'layout3D: chief[0] is not a ray of fan 0' }, `chief ${JSON.stringify(chief)}`);
  }
});

// Plan #1193, item #1197 (CR #1219): the guard runs before the canvas is touched.
test('layout3D without data throws', async () => {
  const { layout3D } = await mesh();
  for (const o of [undefined, {}, { data: undefined }]) assert.throws(() => layout3D({}, o), { name: 'TypeError', message: 'layout3D: pass { data: RecordedLayout }' });
});

// Plan #1193, item #1226 (review M1 round 1, finding 7): the projection test exempts the image plane and the stop ring, so their shape is checked here.
test('image plane and stop ring', async () => {
  const { layout3dScene } = await three();
  const L = LAYOUTS.wandersleb, { scene } = layout3dScene(L, { width: 560, height: 320 }, () => 0x808080), img = [], ring = [];
  scene.traverse((o) => { if (o.isMesh && o.userData.image) img.push(o); if (o.isMesh && o.userData.stop) ring.push(o); });
  const pts = (o) => { const a = o.geometry.attributes.position; return Array.from({ length: a.count }, (_, i) => [a.getX(i), a.getY(i), a.getZ(i)]); };
  // oracle: the layout's own image surface (sd, z): the plane is the square [-sd, sd]^2 at that z, written out corner by corner
  const im = L.surfaces.find((s) => s.image);
  assert.equal(img.length, 1, 'wandersleb: one image plane');
  const corners = pts(img[0]), want = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [a * im.sd, b * im.sd, im.z]);
  for (const w of want) assert.ok(corners.some((p) => p.every((c, n) => Math.abs(c - w[n]) < 1e-3)), `wandersleb: image plane has the corner ${w}`);
  for (const p of corners) assert.ok(want.some((w) => p.every((c, n) => Math.abs(c - w[n]) < 1e-3)), `wandersleb: image plane has no other vertex than ${p}`);
  // oracle: layout2D's stop tick length (2.5 mm) and the profile's edge point: every stop-ring vertex has radius in [sd, sd + 2.5] and z at the last profile point
  const st = L.surfaces.find((s) => s.stop), ze = st.profile[st.profile.length - 1][0];
  assert.ok(ring.length > 0, 'wandersleb: a stop ring');
  for (const p of ring.flatMap(pts)) {
    const r = Math.hypot(p[0], p[1]);
    assert.ok(r >= st.sd - 1e-4 && r <= st.sd + 2.5 + 1e-4, `stop ring radius ${r} within [${st.sd}, ${st.sd + 2.5}]`);
    assert.ok(Math.abs(p[2] - ze) < 1e-4, `stop ring z ${p[2]} at the profile edge ${ze}`);
  }
});

// Plan #1193, issue #1243 (review M1 round 7, finding 4): a layout with no glazed surface, stop or image has no edges; layout3dScene still returns a scene.
// oracle: the same layout's rays, which an air-only layout still draws: no mesh and no rim exist, so the scene's objects are exactly the ray lines
test('empty scene', async () => {
  const { layout3dScene } = await three(), L = air(sample.layout), bare = { ...L, surfaces: L.surfaces.map((s) => ({ ...s, stop: false, image: false })) };
  const kinds = (o) => { const out = []; layout3dScene(bare, o, () => 0x808080).scene.traverse((n) => { if (n.isMesh) out.push(n.isLineSegments2 ? (n.userData.ray ? 'ray' : 'edge') : n.isMesh ? 'mesh' : null); }); return out; };
  const k = kinds({});
  assert.ok(k.length > 0 && k.every((x) => x === 'ray'), 'only ray lines');
  assert.deepEqual(kinds({ rays: false }), []);
});

// Plan #1193 M2, issue #1249: the three.js path's acceptance tests, written skipped; #1250 built layout3dScene(layout, o, resolve) -> { scene, camera } in
// packages/plots/src/layout3dThree.js, and #1256 unskipped them (the painter and its tests died in #1253).
const three = async () => import('../../packages/plots/src/layout3dThree.js');
// Project a world point through an orthographic camera's matrices to px (y down) for a w x h canvas.
const viaCamera = (camera, [x, y, z], w, h) => {
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  const p = { x, y, z }, m = camera.projectionMatrix.elements, v = camera.matrixWorldInverse.elements;
  const e = [v[0] * p.x + v[4] * p.y + v[8] * p.z + v[12], v[1] * p.x + v[5] * p.y + v[9] * p.z + v[13], v[2] * p.x + v[6] * p.y + v[10] * p.z + v[14]];
  const nx = m[0] * e[0] + m[12], ny = m[5] * e[1] + m[13];
  return [((nx + 1) / 2) * w, ((1 - ny) / 2) * h];
};

// O1. oracle: closed-form orthographic projection (ortho above: yaw about y, pitch about x) of each recorded layout's revolved profile; every mesh vertex, projected by the camera's matrices, is within 0.5 px of it.
// The camera centres the fitted bounds, ortho centres (0, 0, zc) at ORIGIN: the two differ by one translation, taken from where the camera puts (0, 0, zc), so rotation and scale are still checked.
test('revolved profiles project', async () => {
  const { layout3dScene } = await three();
  for (const [name, layout] of Object.entries(LAYOUTS)) for (const v of [{ view: 'iso' }, { yaw: 20, pitch: -10 }]) {
    const { scene, camera } = layout3dScene(layout, { ...v, width: 560, height: 320, scale: SCALE }, () => 0x808080);
    const zc = layout.surfaces[layout.surfaces.length - 1].z / 2;
    const yp = v.view === 'iso' ? { yaw: -45, pitch: 35.264 } : v;
    const c0 = viaCamera(camera, [0, 0, zc], 560, 320), dx = c0[0] - ORIGIN[0], dy = c0[1] - ORIGIN[1];
    let n = 0;
    scene.traverse((o) => {
      if (!o.isMesh || o.isLineSegments2 || o.userData.image || o.userData.stop) return; // a fat line's position attribute is its instanced quad template, not scene points
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
        const r = Math.hypot(p[0], p[1]), phi = Math.atan2(p[1], p[0]);
        const best = Math.min(...layout.surfaces.map((s) => {
          const z = profileZ(s, r);
          if (z === null) return Infinity;
          const want = ortho([r * Math.cos(phi), r * Math.sin(phi), z], yp, zc);
          const got = viaCamera(camera, p, 560, 320);
          return Math.hypot(got[0] - dx - want[0], got[1] - dy - want[1]);
        }), Infinity);
        assert.ok(best <= 0.5, `${name}: vertex ${p} is ${best.toFixed(2)} px from the revolved profile`);
        n++;
      }
    });
    assert.ok(n > 0, `${name}: vertices`);
  }
});

// O1. oracle: property, glassFill per glass name; each element's material colour is resolve(fill) and userData.fill is glassFill's fill.
test('glass fills per element', async () => {
  const { layout3dScene } = await three();
  const cooke = LAYOUTS.cooke, glasses = drawnGlasses(cooke.surfaces), fills = glassFill(glasses);
  const seen = new Set(), hex = new Map();
  // the CSS fill is a browser's to resolve: stand in a distinct colour per fill, so a mesh coloured from the wrong fill differs
  const resolve = (fill) => { if (!hex.has(fill)) hex.set(fill, 0x101010 + 0x101010 * hex.size); return hex.get(fill); };
  const { scene } = layout3dScene(cooke, { width: 560, height: 320 }, resolve);
  scene.traverse((o) => {
    if (!o.isMesh || o.userData.glass === undefined) return;
    assert.equal(o.userData.fill, fills.get(o.userData.glass), `a ${o.userData.glass} mesh carries glassFill's fill`);
    assert.equal(o.material.color.getHex(), resolve(fills.get(o.userData.glass)), `a ${o.userData.glass} mesh is coloured resolve(its fill)`);
    seen.add(o.userData.glass);
  });
  for (const g of new Set(glasses.map((x) => x.name))) assert.ok(seen.has(g), `${g} has a mesh`);
});

// O8. oracle: reference, layout2D's SVG: its matrix(s 0 0 s tx ty) and polygon[data-surface] points; the front-view mesh's meridian vertices (x = 0) lie within 0.5 px of them under that matrix.
test('front view matches layout2D', async () => {
  const { layout2D } = await import('../../packages/plots/src/layout2d.js');
  const { layout3dScene } = await three();
  for (const name of ['achromat', 'cooke']) {
    const layout = LAYOUTS[name], svg = layout2D({ data: layout });
    const m = svg.match(/matrix\(([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+)\)/).slice(1).map(Number);
    const polys = [...svg.matchAll(/<polygon points="([^"]+)"[^>]*data-surface="(\d+)"/g)].map((q) => ({
      i: Number(q[2]),
      pts: q[1].trim().split(/\s+/).map((p) => p.split(',').map(Number)).map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]),
    }));
    // layout2D centres its own box; the camera centres its fitted bounds: one translation apart, taken at the first surface's axis point
    const s0 = layout.surfaces[0], a0 = [m[0] * s0.profile[0][0] + m[4], m[5]];
    const { scene, camera } = layout3dScene(layout, { view: 'front', width: 560, height: 320, scale: m[0] }, () => 0x808080);
    const c0 = viaCamera(camera, [0, 0, s0.profile[0][0]], 560, 320), dx = c0[0] - a0[0], dy = c0[1] - a0[1];
    let checked = 0;
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.glass === undefined) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i)) > 1e-9) continue;
        const got = viaCamera(camera, [pos.getX(i), pos.getY(i), pos.getZ(i)], 560, 320).map((c, a) => c - (a ? dy : dx));
        const d = Math.min(...polys.flatMap((q) => q.pts.map((p) => Math.hypot(got[0] - p[0], got[1] - p[1]))));
        assert.ok(d <= 0.5, `${name}: meridian vertex is ${d.toFixed(2)} px from layout2D's polygons`);
        checked++;
      }
    });
    assert.ok(checked > 0, `${name}: meridian vertices`);
  }
});

// Plan #1193 M2, issue #1251: rays and edges of the three.js scene are fat lines (LineSegments2 / LineMaterial), depth-tested, linewidth in CSS px.
// oracles: the segments each ray draws, written here from the recorded points (the M1 rules: through the first Dead point, none from a Virtual point, none inside glass); the rim and silhouette points in closed form.
const lines = (scene, pick) => { const out = []; scene.traverse((o) => { if (o.isLineSegments2 && pick(o.userData)) out.push(o); }); return out; };
const segsOf = (l) => { const a = l.geometry.attributes.instanceStart, b = l.geometry.attributes.instanceEnd; return Array.from({ length: a.count }, (_, n) => [[a.getX(n), a.getY(n), a.getZ(n)], [b.getX(n), b.getY(n), b.getZ(n)]]); };
const drawn = (L, k, i, js) => js.map((j) => [[0, L.rays[k][i][j - 1][1], L.rays[k][i][j - 1][0]], [0, L.rays[k][i][j][1], L.rays[k][i][j][0]]]);
const same = (got, want, msg) => { assert.equal(got.length, want.length, msg); got.forEach((g, n) => g.flat().forEach((c, m) => assert.ok(Math.abs(c - want[n].flat()[m]) < 1e-4, msg))); };
const rayIn = async (L, k, i) => { const { scene } = (await three()).layout3dScene(L, { rays: 'fan', width: 560, height: 320 }, () => 0x808080); return lines(scene, (u) => u.ray && u.k === k && u.i === i).flatMap(segsOf); };

test('dead and virtual cut', async () => {
  const L = air(sample.layout), withAlive = (alive, dead) => ({ ...L, alive: L.rays.map((f, k) => f.map((_, i) => (k === 0 && i === 0 ? alive : 4))), dead: L.rays.map((f, k) => f.map((_, i) => k === 0 && i === 0 && dead)) });
  same(await rayIn(L, 0, 0), drawn(L, 0, 0, [1, 2, 3, 4]), 'air: every segment');
  same(await rayIn(withAlive(2, false), 0, 0), drawn(L, 0, 0, [1]), 'Virtual from point 2');
  same(await rayIn(withAlive(2, true), 0, 0), drawn(L, 0, 0, [1, 2]), 'Dead at point 2: through it, no further');
  const st = (s) => ({ ...L, status: L.rays.map((f, k) => f.map((_, i) => (k === 0 && i === 0 ? s : Array(5).fill('Alive')))) });
  same(await rayIn(st(['Alive', 'Alive', 'Dead', 'Virtual', 'Virtual']), 0, 0), drawn(L, 0, 0, [1, 2]), '');
  same(await rayIn(st(['Alive', 'Virtual', 'Virtual', 'Virtual', 'Virtual']), 0, 0), drawn(L, 0, 0, [1]), '');
  // the achromat's two glass gaps draw no ray: only the air segments before the first surface and after the last
  same(await rayIn(sample.layout, 0, 0), drawn(sample.layout, 0, 0, [1, 4]), '');
});

test('ray sets, width and depth test', async () => {
  const { layout3dScene } = await three(), L = sample.layout;
  const per = (rays) => new Set(lines(layout3dScene(L, { rays }, () => 0x808080).scene, (u) => u.ray && u.k === 0).map((l) => l.userData.i)).size;
  assert.equal(per(undefined), 3);
  assert.equal(per('chief'), 1);
  assert.equal(per('fan'), L.rays[0].length);
  assert.equal(per(false), 0);
  const { scene } = layout3dScene(L, { width: 560, height: 320, rayWidth: 2, edgeWidth: 3 }, () => 0x808080);
  for (const l of lines(scene, () => true)) {
    assert.equal(l.material.linewidth, l.userData.ray ? 2 : 3, 'linewidth is the CSS px asked for');
    assert.equal(l.material.depthTest, true);
    assert.deepEqual([l.material.resolution.x, l.material.resolution.y], [560, 320], 'resolution is the CSS size');
    assert.equal(l.material.worldUnits, false);
  }
  assert.ok(lines(scene, (u) => u.ray && u.chief).every((l) => l.material.dashed), 'the chief is dashed');
});

test('empty fan is skipped', async () => {
  const { layout3dScene } = await three(), L = air(sample.layout), withEmpty = { ...L, rays: [[], ...L.rays] };
  const at = (X) => lines(layout3dScene(X, {}, () => 0x808080).scene, (u) => u.ray).map((l) => [l.userData.i, segsOf(l)]);
  const got = lines(layout3dScene(withEmpty, {}, () => 0x808080).scene, (u) => u.ray);
  assert.ok(got.length > 0 && got.every((l) => l.userData.k >= 1), 'only the non-empty fans draw');
  assert.deepEqual(got.map((l) => l.userData.i), at(L).map((x) => x[0]));
  got.forEach((l, n) => same(segsOf(l), at(L)[n][1], 'same segments'));
});

test('the camera fits the drawn ray points, not Virtual or in-glass ones', async () => {
  const { layout3dScene } = await three(), L = air(sample.layout);
  // a Virtual tail far off axis would widen the fit if it counted
  const far = { ...L, rays: L.rays.map((f, k) => f.map((r, i) => (k === 0 && i === 0 ? r.map((p, j) => (j >= 2 ? [p[0], 500] : p)) : r))) };
  const alive = { ...far, alive: far.rays.map((f, k) => f.map((_, i) => (k === 0 && i === 0 ? 2 : 4))) };
  const o = { view: 'front', width: 560, height: 320 };
  const a = layout3dScene(L, o, () => 0x808080).camera, b = layout3dScene(alive, o, () => 0x808080).camera;
  const nofar = { ...L, rays: far.rays.map((f, k) => f.map((r, i) => (k === 0 && i === 0 ? r.slice(0, 2) : r))) };
  const c = layout3dScene({ ...nofar, alive: nofar.rays.map((f, k) => f.map((_, i) => (k === 0 && i === 0 ? 2 : 4))) }, o, () => 0x808080).camera;
  assert.equal(b.top, c.top, 'the Virtual tail does not move the fit');
  assert.ok(Math.abs(b.top - a.top) < 5, 'and is not a 500 mm tail');
});

test('edge outlines', async () => {
  const { layout3dScene } = await three();
  for (const name of ['achromat', 'cooke']) for (const v of [{ view: 'iso' }, { yaw: 20, pitch: -10 }, { view: 'front' }]) {
    const L = LAYOUTS[name], S = L.surfaces, { scene, camera } = layout3dScene(L, { ...v, width: 560, height: 320 }, () => 0x808080), N = 128;
    const rimPt = (i, j) => { const top = S[i].profile.filter((p) => p[1] >= -1e-9).reduce((a, p) => (p[1] > a[1] ? p : a)); const t = 2 * Math.PI * j / N; return [top[1] * Math.cos(t), top[1] * Math.sin(t), top[0]]; };
    const glazed = S.map((s, i) => i).filter((i) => !S[i].image && (S[i].glass || (S[i - 1] && S[i - 1].glass)));
    const near = (a, b) => a.every((c, n) => Math.abs(c - b[n]) < 1e-4);
    const rims = lines(scene, (u) => u.edge === 'rim');
    assert.deepEqual(rims.map((l) => l.userData.surface).sort((a, b) => a - b), glazed, `${name}: a rim on each glazed surface, no other`);
    for (const l of rims) {
      const sg = segsOf(l); assert.equal(sg.length, N, 'a closed ring of 128 segments');
      sg.forEach(([a, b], j) => assert.ok(near(a, rimPt(l.userData.surface, j)) && near(b, rimPt(l.userData.surface, (j + 1) % N)), `${name} rim ${l.userData.surface} segment ${j}`));
    }
    const gaps = S.map((s, i) => i).filter((i) => S[i].glass && glazed.includes(i + 1)), sil = lines(scene, (u) => u.edge === 'silhouette');
    assert.equal(sil.length, 2 * gaps.length, `${name}: two silhouette lines per element`);
    for (const i of gaps) {
      const py = Array.from({ length: N }, (_, j) => viaCamera(camera, rimPt(i, j), 560, 320)[1]);
      for (const j of [py.indexOf(Math.min(...py)), py.indexOf(Math.max(...py))]) assert.ok(sil.some((l) => l.userData.element === i && near(segsOf(l)[0][0], rimPt(i, j)) && near(segsOf(l)[0][1], rimPt(i + 1, j))), `${name} element ${i}: silhouette at ring point ${j}, first rim to last`);
    }
  }
});

// View convention (#1262): yaw about y, then pitch about x; at yaw 0, pitch 0 the viewer looks along +x, +z is to the right and +y up. `front` is that view.
test('view convention', async () => {
  const { layout3dScene } = await three();
  const o = { width: 560, height: 320, scale: SCALE };
  const { camera } = layout3dScene(sample.layout, { ...o, yaw: 0, pitch: 0 }, () => 0x808080);
  const look = new (camera.position.constructor)(0, 0, -1).applyQuaternion(camera.quaternion);
  assert.ok(look.distanceTo({ x: 1, y: 0, z: 0 }) < 1e-9, `looks along +x, got ${look.x} ${look.y} ${look.z}`);
  const c0 = viaCamera(camera, [0, 0, 0], 560, 320), cz = viaCamera(camera, [0, 0, 1], 560, 320), cy = viaCamera(camera, [0, 1, 0], 560, 320);
  assert.ok(cz[0] - c0[0] > 1 && Math.abs(cz[1] - c0[1]) < 1e-6, 'a +z step projects right');
  assert.ok(c0[1] - cy[1] > 1 && Math.abs(cy[0] - c0[0]) < 1e-6, 'a +y step projects up');
  const f = layout3dScene(sample.layout, { ...o, view: 'front' }, () => 0x808080).camera;
  assert.deepEqual(f.quaternion.toArray(), camera.quaternion.toArray(), 'front is yaw 0, pitch 0');
});

// Plan #1193 M2, issue #1276 (review M2 r1 finding 6): the shared renderer keeps GPU state per geometry id until dispose(), so a redraw must not make new silhouette geometries.
// oracle: property (the geometry objects of the silhouette lines are the same objects on every call for one layout and view).
test('silhouettes do not grow per redraw', async () => {
  const { layout3dScene } = await three(), L = LAYOUTS.achromat, geoms = new Set();
  for (let n = 0; n < 10; n++) for (const l of lines(layout3dScene(L, { view: 'front', width: 560, height: 320 }, () => 0x808080).scene, (u) => u.edge === 'silhouette')) geoms.add(l.geometry);
  assert.ok(geoms.size > 0);
  assert.equal(geoms.size, lines(layout3dScene(L, { view: 'front', width: 560, height: 320 }, () => 0x808080).scene, (u) => u.edge === 'silhouette').length, '10 redraws leave one geometry per silhouette line');
});

// Plan #1193 M2, issue #1278 (review M2 r1 finding 8): only the preset table's own keys name a view; inherited ones must not build a NaN camera.
// oracle: spec (the named error in the issue; Object.prototype names are not views).
test('unknown view names throw', async () => {
  const { layout3dScene } = await three();
  for (const view of ['toString', 'constructor', 'side']) assert.throws(() => layout3dScene(sample.layout, { view }, () => 0x808080), { name: 'TypeError', message: 'layout3dScene: view is iso, front or top' }, view);
});

// Plan #1193 M3, issue #1200: outcome O3's acceptance tests, written skipped (an obscuration inside a mirror body has no disc, as in layout2D; a standalone one is one opaque disc of its sd); #1201 builds the mirror bodies in layout3dScene and exports `mirrorBodies` from layout2d.js, #1202 unskips them.
// Assumed shape for #1201 to meet (the tests pin it): every mesh of a mirror's body has userData.mirror = the surface index, the obscuration disc userData.obscuration = the surface index.
// oracle: reference layout2D's mirrorBodies(L, i) (U17's tested polygons, [z, y]): one polygon per side of the hole, the k = -1 side with y < 0, or one polygon spanning -sd..sd when there is no hole; a body point (z, y) revolves to radius |y|; closed-form as O1 (ortho above); property no face inside the hole
const CASSEGRAIN = JSON.parse(readFileSync(new URL('../fixtures/phos-core/cassegrain-layout.json', import.meta.url)));
const O3 = {};
const meshesOf = (scene, key) => { const out = []; scene.traverse((o) => { if (o.isMesh && !o.isLineSegments2 && o.userData[key] !== undefined) out.push(o); }); return out; };
const vertsOf = (o) => { const a = o.geometry.attributes.position; return Array.from({ length: a.count }, (_, i) => [a.getX(i), a.getY(i), a.getZ(i)]); };
// the nearest point to (z, r) on a polygon's boundary, as [z, r]
function nearestOnPolygon(poly, z, r) {
  let best = null, bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [z0, y0] = poly[i], [z1, y1] = poly[(i + 1) % poly.length], dz = z1 - z0, dy = y1 - y0, len2 = dz * dz + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((z - z0) * dz + (r - y0) * dy) / len2)) : 0, p = [z0 + t * dz, y0 + t * dy], d = Math.hypot(p[0] - z, p[1] - r);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

test('mirror bodies revolve', O3, async () => {
  const { layout3dScene } = await three(), { mirrorBodies } = await import('../../packages/plots/src/layout2d.js');
  const L = CASSEGRAIN, zc = L.surfaces[L.surfaces.length - 1].z / 2;
  for (const v of [{ view: 'iso' }, { yaw: 20, pitch: -10 }]) {
    const { scene, camera } = layout3dScene(L, { ...v, width: 560, height: 320, scale: SCALE }, () => 0x808080);
    const yp = v.view === 'iso' ? { yaw: -45, pitch: 35.264 } : v;
    const c0 = viaCamera(camera, [0, 0, zc], 560, 320), dx = c0[0] - ORIGIN[0], dy = c0[1] - ORIGIN[1];
    L.surfaces.forEach((s, i) => {
      if (!s.mirror) return;
      const polys = mirrorBodies(L, i), meshes = meshesOf(scene, 'mirror').filter((m) => m.userData.mirror === i);
      assert.ok(polys.length > 0 && meshes.length > 0, `surface ${i}: a body polygon and a mesh`);
      const all = meshes.flatMap(vertsOf);
      for (const p of all) {
        const r = Math.hypot(p[0], p[1]), phi = Math.atan2(p[1], p[0]);
        // every vertex lies on one of the polygons, at the same angle: its px is within 0.5 of the independent projection of that polygon point
        // (a polygon point at y < 0 is at radius |y|, so the vertex's radius is tried on both signs of y)
        const best = Math.min(...polys.flatMap((poly) => [r, -r].map((q) => {
          const [z, y] = nearestOnPolygon(poly, p[2], q), want = ortho([Math.abs(y) * Math.cos(phi), Math.abs(y) * Math.sin(phi), z], yp, zc), got = viaCamera(camera, p, 560, 320);
          return Math.hypot(got[0] - dx - want[0], got[1] - dy - want[1]);
        })));
        assert.ok(best <= 0.5, `surface ${i}: vertex ${p} is ${best.toFixed(2)} px from the revolved body`);
      }
      // and every polygon corner is revolved: some vertex sits on it (the flat back and the hole's edge included)
      for (const [z, y] of polys.flat()) assert.ok(all.some((p) => Math.abs(p[2] - z) < 1e-3 && Math.abs(Math.hypot(p[0], p[1]) - Math.abs(y)) < 1e-3), `surface ${i}: polygon corner (${z}, ${y}) is revolved`);
    });
    // the obscuration of the Cassegrain lies inside the secondary's body: no disc (as layout2D leaves its line out)
    L.surfaces.forEach((s, i) => { if (s.obscuration) assert.equal(meshesOf(scene, 'obscuration').filter((m) => m.userData.obscuration === i).length, 0, `surface ${i}: no disc inside a mirror body`); });
  }
});

test('a standalone obscuration is one opaque disc', O3, async () => {
  const { layout3dScene } = await three();
  // the Cassegrain with its mirror flags removed: the obscuration lies in no mirror body
  const L = JSON.parse(JSON.stringify(CASSEGRAIN));
  L.surfaces.forEach((s) => { delete s.mirror; });
  const { scene } = layout3dScene(L, { view: 'iso', width: 560, height: 320, scale: SCALE }, () => 0x808080);
  let n = 0;
  L.surfaces.forEach((s, i) => {
    if (!s.obscuration) return;
    n++;
    const discs = meshesOf(scene, 'obscuration').filter((m) => m.userData.obscuration === i);
    assert.equal(discs.length, 1, `surface ${i}: one obscuration disc`);
    const pts = vertsOf(discs[0]);
    assert.ok(pts.every((p) => Math.abs(p[2] - s.z) < 1e-3 && Math.hypot(p[0], p[1]) <= s.sd + 1e-3), `surface ${i}: the disc lies at z ${s.z} within sd ${s.sd}`);
    assert.ok(Math.abs(Math.max(...pts.map((p) => Math.hypot(p[0], p[1]))) - s.sd) < 1e-3, `surface ${i}: the disc reaches sd ${s.sd}`);
    assert.ok(!discs[0].material.transparent && discs[0].material.opacity === 1, `surface ${i}: the disc is opaque`);
  });
  assert.ok(n > 0, 'the layout has an obscuration');
});

// Plan #1193 M3, issue #1291 (CR #1288): a mirror body has the edge outlines a lens element has.
// oracle: reference layout2D's mirrorBodies(L, i) (U17's tested polygons): the rims are the polygon's points at its greatest |y| (the face's and the flat back's outer edge) and, with a hole, at |y| = hole (both faces); a point on the axis is no rim; property of the limb rule as in "edge outlines"
test('mirror edge outlines', async () => {
  const { layout3dScene } = await three(), { mirrorBodies } = await import('../../packages/plots/src/layout2d.js'), N = 128;
  const near = (a, b) => a.every((c, n) => Math.abs(c - b[n]) < 1e-4);
  let checked = 0;
  for (const v of [{ view: 'iso' }, { yaw: 20, pitch: -10 }]) {
    const { scene, camera } = layout3dScene(CASSEGRAIN, { ...v, width: 560, height: 320 }, () => 0x808080);
    CASSEGRAIN.surfaces.forEach((s, i) => {
      if (!s.mirror) return;
      const pts = mirrorBodies(CASSEGRAIN, i)[0].map(([z, y]) => [z, Math.abs(y)]), top = Math.max(...pts.map((p) => p[1])), hole = s.hole > 0 ? s.hole : -1;
      const want = [];
      for (const p of pts) if ((Math.abs(p[1] - top) < 1e-6 || Math.abs(p[1] - hole) < 1e-6) && !want.some((w) => near(w, p))) want.push(p);
      const rims = lines(scene, (u) => u.edge === 'rim' && u.mirror === i);
      assert.equal(rims.length, want.length, `surface ${i}: one rim per real corner (${want.length}), none on the axis`);
      for (const [z, r] of want) {
        const rim = rims.find((l) => segsOf(l).every(([a]) => Math.abs(a[2] - z) < 1e-4 && Math.abs(Math.hypot(a[0], a[1]) - r) < 1e-4));
        assert.ok(rim, `surface ${i}: a rim at z ${z}, radius ${r}`);
        const sg = segsOf(rim); assert.equal(sg.length, N, 'a closed ring of 128 segments');
        sg.forEach(([, b], j) => assert.ok(near(b, sg[(j + 1) % N][0]), `surface ${i}: ring closes at segment ${j}`));
      }
      if (hole > 0) assert.ok(want.filter((w) => Math.abs(w[1] - hole) < 1e-6).length === 2, `surface ${i}: the hole's edge on both faces`);
      // the side's silhouette: the outer rims' points of greatest and least projected y, face to back
      const outer = want.filter((w) => Math.abs(w[1] - top) < 1e-6), sil = lines(scene, (u) => u.edge === 'silhouette' && u.mirror === i);
      assert.equal(sil.length, 2, `surface ${i}: two silhouette lines`);
      const ring = ([z, r], j) => [r * Math.cos(2 * Math.PI * j / N), r * Math.sin(2 * Math.PI * j / N), z];
      const py = Array.from({ length: N }, (_, j) => viaCamera(camera, ring(outer[0], j), 560, 320)[1]);
      for (const j of [py.indexOf(Math.min(...py)), py.indexOf(Math.max(...py))]) assert.ok(sil.some((l) => { const [a, b] = segsOf(l)[0]; return [outer[0], outer[1]].some((p, n) => near(a, ring(p, j)) && near(b, ring(outer[1 - n], j))); }), `surface ${i}: silhouette at ring point ${j}`);
      checked++;
    });
  }
  assert.ok(checked > 0);
});

// Plan #1193 M3, issue #1296 (review M3 round 1, finding 3): a mirror keeps its two silhouette lines when its recorded numbers are inexact.
// oracle: the unmodified fixture's counts (U17's polygons, "mirror edge outlines"): two silhouette lines and the same rims per mirror
test('mirror silhouettes survive inexact numbers', async () => {
  const { layout3dScene } = await three(), counts = (L) => {
    const { scene } = layout3dScene(L, { width: 560, height: 320 }, () => 0x808080), out = {};
    L.surfaces.forEach((s, i) => { if (s.mirror) out[i] = [lines(scene, (u) => u.edge === 'silhouette' && u.mirror === i).length, lines(scene, (u) => u.edge === 'rim' && u.mirror === i).length]; });
    return out;
  };
  const base = counts(CASSEGRAIN), L = JSON.parse(JSON.stringify(CASSEGRAIN)), ms = Object.keys(base).map(Number);
  assert.ok(ms.length >= 2);
  L.surfaces[ms[0]].sd = 54.9;
  L.surfaces[ms[1]].profile[0][0] += 1e-12;
  const got = counts(L);
  for (const i of ms) { assert.equal(base[i][0], 2, `surface ${i}: two silhouette lines in the fixture`); assert.deepEqual(got[i], base[i], `surface ${i}: same silhouette and rim counts`); }
});

// Plan #1193 M3, issue #1301 (review M3 round 2, finding 2): corners that are one rim but fall either side of a rounding boundary are still one rim.
// oracle: the unmodified fixture's counts; a holeless mirror's flat back has two corners at one z, one at -y and one at y, so their |y| can straddle a half micron
test('mirror rims merge corners by tolerance', async () => {
  const { layout3dScene } = await three(), counts = (L, i) => {
    const { scene } = layout3dScene(L, { width: 560, height: 320 }, () => 0x808080);
    return [lines(scene, (u) => u.edge === 'silhouette' && u.mirror === i).length, lines(scene, (u) => u.edge === 'rim' && u.mirror === i).length];
  };
  const i = CASSEGRAIN.surfaces.findIndex((s) => s.mirror && !(s.hole > 0)), L = JSON.parse(JSON.stringify(CASSEGRAIN));
  assert.ok(i >= 0, 'a mirror without a hole');
  const pr = L.surfaces[i].profile, v = (Math.floor(Math.abs(pr[pr.length - 1][1]) * 1e6) + 0.5) / 1e6, key = (y) => Math.round(y * 1e6);
  assert.notEqual(key(v), key(v - 1e-13), 'the two radii straddle a rounding boundary');
  pr[0][1] = -v; pr[pr.length - 1][1] = v - 1e-13;
  assert.deepEqual(counts(L, i), counts(CASSEGRAIN, i), 'same silhouette and rim counts as the fixture');
  assert.equal(counts(L, i)[0], 2);
});

// Plan #1193 M3, issue #1303 (CR #1302): a mirror rim's cache name is the rim's index; a redraw finds the geometry again. A characterization: it passes before and after the key became an index.
// oracle: property (the geometry objects of the mirror rim lines are the same objects on every call for one layout).
test('mirror rims do not grow per redraw', async () => {
  const { layout3dScene } = await three(), rims = () => lines(layout3dScene(CASSEGRAIN, { width: 560, height: 320 }, () => 0x808080).scene, (u) => u.edge === 'rim' && u.mirror !== undefined);
  const a = rims(), b = rims();
  assert.ok(a.length > 0);
  assert.equal(b.length, a.length);
  a.forEach((l, k) => assert.equal(b[k].geometry, l.geometry, 'rim line ' + k));
});

test('holes stay open', O3, async () => {
  const { layout3dScene } = await three(), { scene } = layout3dScene(CASSEGRAIN, { width: 560, height: 320 }, () => 0x808080);
  let checked = 0;
  CASSEGRAIN.surfaces.forEach((s, i) => {
    if (!s.mirror || !(s.hole > 0)) return;
    const meshes = meshesOf(scene, 'mirror').filter((m) => m.userData.mirror === i);
    assert.ok(meshes.length > 0, `surface ${i}: a mirror mesh`);
    for (const m of meshes) {
      const a = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count : a.count, at = (k) => (idx ? idx.getX(k) : k);
      assert.ok(n >= 3, `surface ${i}: faces`);
      for (let f = 0; f < n; f += 3) {
        const rs = [0, 1, 2].map((c) => Math.hypot(a.getX(at(f + c)), a.getY(at(f + c))));
        // every vertex of every face lies at radius >= hole, so no face reaches into the hole
        assert.ok(Math.min(...rs) >= s.hole - 1e-4, `surface ${i}: face ${f / 3} has a vertex at radius ${Math.min(...rs)} under hole ${s.hole}`);
      }
      checked += n / 3;
    }
  });
  assert.ok(checked > 0, 'a mirror with a hole was checked');
});

// Plan #1193, issue #1293 (CR #1290, user: "small pitch and yaw, looking primarily down the Z axis"; object side, 20 deg yaw, 15 deg pitch). oracle: closed-form direction cosines from the camera's own matrices, not the module's yaw/pitch numbers.
test('default view', async () => {
  const { layout3dScene } = await three();
  const L = sample.layout, deg = Math.PI / 180;
  const dir = (o) => {
    const { camera } = layout3dScene(L, { width: 560, height: 320, ...o }, () => 0x808080);
    camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
    const e = camera.matrixWorld.elements; // the camera looks along its local -z
    return { d: [-e[8], -e[9], -e[10]], camera };
  };
  const { d, camera } = dir({});
  assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-6, 'view direction is not unit length');
  assert.ok(Math.abs(d[2] - Math.cos(20 * deg) * Math.cos(15 * deg)) < 1e-6, `view z ${d[2]}`);
  assert.ok(Math.abs(d[1] + Math.sin(15 * deg)) < 1e-6, `camera is not above the axis: view y ${d[1]}`);
  const sx = (z) => viaCamera(camera, [0, 0, z], 560, 320)[0];
  assert.ok(sx(10) > sx(0), '+Z does not project to the right');
  const iso = dir({ view: 'iso' }).d; // unchanged: yaw -45, pitch 35.264 looks back toward -Z
  assert.ok(Math.abs(iso[2] + Math.SQRT1_2 * Math.cos(35.264 * deg)) < 1e-6 && Math.abs(iso[1] - Math.sin(35.264 * deg)) < 1e-6, 'iso changed');
  const yawOnly = dir({ yaw: d0yaw(d) }).d; // a missing pitch takes the default's pitch
  assert.ok(yawOnly.every((c, i) => Math.abs(c - d[i]) < 1e-6), 'yaw alone does not take the default pitch');
});
// the default yaw, read back from the view direction in the module's convention (yaw about y, then pitch about x; at 0, 0 the viewer looks along +x)
const d0yaw = (d) => Math.atan2(d[2], d[0]) * 180 / Math.PI;
