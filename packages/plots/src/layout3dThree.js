// layout3D on three.js (plan #1193 M2, #1250): the scene and camera of a recorded layout. Rays and edges (#1251) and rendering (#1252) come after.
// Pure three.js objects and no DOM, so node tests run it; `resolve(fill)` is injected for the one thing only a browser can answer.
import {
  AmbientLight, Color, DirectionalLight, DoubleSide, Group, LatheGeometry, Matrix4, Mesh, MeshLambertMaterial,
  OrthographicCamera, PlaneGeometry, Quaternion, RingGeometry, Scene, SRGBColorSpace, Vector2, Vector3,
} from 'three';
import { glassFill, drawnGlasses } from './glass.js';
import { statusOf } from './layout2d.js';

const SEGMENTS = 128, STOP_TICK = 2.5, PAD = 16;
// Views as layout3dMesh's convention: yaw about y, then pitch about x; the viewer looks along +x at yaw 0, pitch 0 with +z to the right and +y up.
const PRESETS = { iso: { yaw: -45, pitch: 35.264 }, front: { yaw: 0, pitch: 0 }, top: { yaw: 0, pitch: -90 } };

const isRecorded = (L) => L != null && typeof L === 'object' && Array.isArray(L.surfaces) && L.surfaces.length > 0 && Array.isArray(L.rays)
  && L.surfaces.every((s) => s && Array.isArray(s.profile) && s.profile.length > 1
    && s.profile.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) && s.profile.some((p) => p[1] >= -1e-9));
// The y >= 0 half of a surface's [z, y] profile, ascending in y.
const halfProfile = (s) => s.profile.filter((p) => p[1] >= -1e-9).map(([z, y]) => [z, Math.max(0, y)]).sort((a, b) => a[1] - b[1]);
// A lathe turns (radius, height) about y; baking a quarter turn about x puts the axis on z, so the position attributes are in the layout's frame.
const lathe = (pts) => { const g = new LatheGeometry(pts.map(([z, r]) => new Vector2(r, z)), SEGMENTS); g.rotateX(Math.PI / 2); return g; };

// The geometry of a layout, built once per `data` object: { parts: [{ geometry, key, glass?, stop?, image? }], rays: [[x, y, z]] }.
const CACHE = new WeakMap();
function build(layout) {
  const S = layout.surfaces, parts = [];
  // the element a surface belongs to: its own glass, else the glass gap it closes; keyed by the gap's first surface
  const own = (i) => (S[i].image ? null : S[i].glass ? [i, S[i].glass] : S[i - 1] && S[i - 1].glass ? [i - 1, S[i - 1].glass] : null);
  S.forEach((s, i) => {
    if (s.image) return;
    const e = own(i), h = halfProfile(s);
    if (e) {
      parts.push({ geometry: lathe(h), element: e[0], glass: e[1] });
      const n = S[i + 1];
      if (s.glass && n) { // the rim: a two-point lathe between the gap's two edges
        const r = h[h.length - 1][1], hn = halfProfile(n);
        parts.push({ geometry: lathe([[h[h.length - 1][0], r], [hn[hn.length - 1][0], hn[hn.length - 1][1]]]), element: i, glass: s.glass });
      }
    } else if (s.stop && !s.glass && !(S[i - 1] && S[i - 1].glass)) {
      const g = new RingGeometry(s.sd, s.sd + STOP_TICK, SEGMENTS); g.translate(0, 0, h[h.length - 1][0]);
      parts.push({ geometry: g, stop: true });
    }
  });
  const im = S.find((s) => s.image);
  if (im) { const g = new PlaneGeometry(2 * im.sd, 2 * im.sd); g.translate(0, 0, im.z); parts.push({ geometry: g, image: true }); }
  const rays = [];
  layout.rays.forEach((fan, k) => fan.forEach((r, i) => {
    const st = statusOf(layout, k, i), end = st && st.indexOf('Dead') >= 0 ? st.indexOf('Dead') : r.length - 1;
    for (let j = 0; j <= end; j++) rays.push([0, r[j][1], r[j][0]]);
  }));
  return { parts, rays };
}

const colour = (c) => (Array.isArray(c) ? new Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, SRGBColorSpace) : new Color(c));

/**
 * The scene and camera of a recorded layout, z the optical axis: each glazed surface a `LatheGeometry` of its profile's y >= 0 half, a two-point lathe for the rim of each glass gap,
 * an air-air stop a `RingGeometry` (sd to sd + 2.5 mm, `userData.stop`), the image plane a square at the image surface's sd (`userData.image`). One `MeshLambertMaterial` per element,
 * its `userData.fill` the element's CSS fill (glassFill's, or the crown / flint token) and its colour `resolve(fill)`: anything `Color.set` takes, or [r, g, b] in 0..255.
 * Every mesh of an element has `userData.glass` (its name) and `userData.fill`. Geometry is cached per `data` object; materials are made per call.
 * @param {*} layout a RecordedLayout
 * @param {{ width?: number, height?: number, view?: 'iso' | 'front' | 'top', yaw?: number, pitch?: number, scale?: number }} [o] `yaw` and `pitch` (degrees) win over `view`; `scale` (px/mm) overrides the fit
 * @param {(fill: string) => *} resolve
 * @returns {{ scene: Scene, camera: OrthographicCamera }}
 */
export function layout3dScene(layout, o, resolve) {
  if (!isRecorded(layout)) throw new TypeError('layout3dScene: expected a RecordedLayout ({ surfaces, rays }) with a profile on every surface');
  o = o || {};
  const W = o.width || 560, H = o.height || 320, S = layout.surfaces;
  let geo = CACHE.get(layout);
  if (!geo) CACHE.set(layout, geo = build(layout));
  const fills = glassFill(drawnGlasses(S, 'layout3dScene'));
  const fillOf = (g) => (typeof g === 'object' ? fills.get(g.name) : g === 'flint' ? 'var(--glass-flint)' : 'var(--glass-crown)');
  const nameOf = (g) => (typeof g === 'object' ? g.name : g);

  const scene = new Scene(), group = new Group(), mats = new Map();
  const material = (key, fill) => {
    if (!mats.has(key)) { const m = new MeshLambertMaterial({ color: colour(resolve(fill)), side: DoubleSide }); m.userData.fill = fill; mats.set(key, m); }
    return mats.get(key);
  };
  for (const p of geo.parts) {
    const fill = p.glass ? fillOf(p.glass) : p.stop ? 'var(--ink)' : 'var(--mech)';
    const mesh = new Mesh(p.geometry, material(p.glass ? 'e' + p.element : p.stop ? 'stop' : 'image', fill));
    mesh.userData = { fill };
    if (p.glass) mesh.userData.glass = nameOf(p.glass);
    if (p.stop) mesh.userData.stop = true;
    if (p.image) mesh.userData.image = true;
    group.add(mesh);
  }
  scene.add(group);
  const sun = new DirectionalLight(0xffffff, 2.2); sun.position.set(-0.35, 0.75, -0.55);
  scene.add(sun, new AmbientLight(0xffffff, 0.9));

  // the camera: basis from yaw and pitch (right, up, forward = away from the viewer), the bounds of every face and drawn ray point in that basis
  const v = o.yaw != null || o.pitch != null ? { yaw: o.yaw ?? PRESETS.iso.yaw, pitch: o.pitch ?? PRESETS.iso.pitch } : PRESETS[o.view || 'iso'];
  if (!v) throw new TypeError('layout3dScene: view is iso, front or top');
  const th = v.yaw * Math.PI / 180, ph = v.pitch * Math.PI / 180;
  const right = new Vector3(-Math.sin(th), 0, Math.cos(th)), up = new Vector3(-Math.cos(th) * Math.sin(ph), Math.cos(ph), -Math.sin(th) * Math.sin(ph));
  const fwd = new Vector3(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], q = new Vector3();
  const grow = (x, y, z) => { q.set(x, y, z); [q.dot(right), q.dot(up), q.dot(fwd)].forEach((c, a) => { lo[a] = Math.min(lo[a], c); hi[a] = Math.max(hi[a], c); }); };
  for (const p of geo.parts) { const a = p.geometry.attributes.position; for (let i = 0; i < a.count; i++) grow(a.getX(i), a.getY(i), a.getZ(i)); }
  for (const r of geo.rays) grow(r[0], r[1], r[2]);
  const s = o.scale > 0 ? o.scale : Math.min((W - 2 * PAD) / ((hi[0] - lo[0]) || 1), (H - 2 * PAD) / ((hi[1] - lo[1]) || 1));
  const mid = right.clone().multiplyScalar((lo[0] + hi[0]) / 2).addScaledVector(up, (lo[1] + hi[1]) / 2).addScaledVector(fwd, (lo[2] + hi[2]) / 2);
  const reach = (hi[2] - lo[2]) / 2 + 1;
  const camera = new OrthographicCamera(-W / (2 * s), W / (2 * s), H / (2 * s), -H / (2 * s), 0.5, 2 * reach + 1);
  camera.position.copy(mid).addScaledVector(fwd, -(reach + 0.5));
  camera.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, up, fwd.clone().negate()));
  camera.updateMatrixWorld(true);
  scene.add(camera);
  return { scene, camera };
}
