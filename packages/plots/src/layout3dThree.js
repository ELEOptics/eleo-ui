// layout3D on three.js (plan #1193 M2, #1250, #1251): the scene and camera of a recorded layout, with its rays and edges as fat lines. `render3d` (#1252) draws it through one shared offscreen WebGL renderer.
// Pure three.js objects and no DOM, so node tests run it; `resolve(fill)` is injected for the one thing only a browser can answer.
import {
  AmbientLight, Color, DirectionalLight, DoubleSide, Group, LatheGeometry, Matrix4, Mesh, MeshLambertMaterial,
  OrthographicCamera, PlaneGeometry, RingGeometry, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { STANDARD } from './common.js';
import { css } from './color.js';
import { glassFill, drawnGlasses } from './glass.js';
import { raySet, statusOf, segmentStatus } from './layout2d.js';

const SEGMENTS = 128, STOP_TICK = 2.5, PAD = 16;
// View convention (pinned by the "view convention" test): yaw about y, then pitch about x; at yaw 0, pitch 0 the viewer looks along +x, with +z to the right and +y up.
const PRESETS = { iso: { yaw: -45, pitch: 35.264 }, front: { yaw: 0, pitch: 0 }, top: { yaw: 0, pitch: -90 } };

const isRecorded = (L) => L != null && typeof L === 'object' && Array.isArray(L.surfaces) && L.surfaces.length > 0 && Array.isArray(L.rays)
  && L.surfaces.every((s) => s && Array.isArray(s.profile) && s.profile.length > 1
    && s.profile.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) && s.profile.some((p) => p[1] >= -1e-9));
// The y >= 0 half of a surface's [z, y] profile, ascending in y.
const halfProfile = (s) => s.profile.filter((p) => p[1] >= -1e-9).map(([z, y]) => [z, Math.max(0, y)]).sort((a, b) => a[1] - b[1]);
// A lathe turns (radius, height) about y; baking a quarter turn about x puts the axis on z, so the position attributes are in the layout's frame.
const lathe = (pts) => { const g = new LatheGeometry(pts.map(([z, r]) => new Vector2(r, z)), SEGMENTS); g.rotateX(Math.PI / 2); return g; };

// The geometry of a layout, built once per `data` object: { parts: [{ geometry, element, glass?, stop?, image? }], segs: every drawable ray segment { k, i, j, a, b },
// rims: [{ surface, ring: [x, y, z][] }] per glazed surface, gaps: [{ element, a, b }] the rims either side of each glass gap, rayGeo: lazily per ray }.
const CACHE = new WeakMap();
function build(layout) {
  const S = layout.surfaces, parts = [], rims = new Map();
  // the element a surface belongs to: its own glass, else the glass gap it closes; keyed by the gap's first surface
  const own = (i) => (S[i].image ? null : S[i].glass ? [i, S[i].glass] : S[i - 1] && S[i - 1].glass ? [i - 1, S[i - 1].glass] : null);
  S.forEach((s, i) => {
    if (s.image) return;
    const e = own(i), h = halfProfile(s);
    if (e) {
      const rz = h[h.length - 1][0], rr = h[h.length - 1][1];
      rims.set(i, Array.from({ length: SEGMENTS }, (_, j) => { const t = 2 * Math.PI * j / SEGMENTS; return [rr * Math.cos(t), rr * Math.sin(t), rz]; }));
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
  // every drawable segment of every ray: through the first Dead point, none starting a Virtual segment, none inside glass (M1's rules)
  const segs = [];
  layout.rays.forEach((fan, k) => fan.forEach((r, i) => {
    const st = statusOf(layout, k, i) || r.map(() => 'Alive'), end = st.indexOf('Dead') < 0 ? r.length - 1 : st.indexOf('Dead');
    for (let j = 1; j <= end; j++) {
      if (segmentStatus(layout, st, j) === 'Virtual' || (j >= 2 && S[j - 2] && S[j - 2].glass)) continue;
      segs.push({ k, i, j, a: [0, r[j - 1][1], r[j - 1][0]], b: [0, r[j][1], r[j][0]] });
    }
  }));
  const gaps = [];
  S.forEach((x, i) => { if (x.glass && rims.has(i) && rims.has(i + 1)) gaps.push({ element: i, a: rims.get(i), b: rims.get(i + 1) }); });
  return { parts, segs, rims, gaps, rayGeo: new Map() };
}

const lineGeometry = (pairs) => { const g = new LineSegmentsGeometry(); g.setPositions(pairs.flat(2)); return g; };
const colour = (c) => (Array.isArray(c) ? new Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, SRGBColorSpace) : new Color(c));

/**
 * The scene and camera of a recorded layout, z the optical axis: each glazed surface a `LatheGeometry` of its profile's y >= 0 half, a two-point lathe for the rim of each glass gap,
 * an air-air stop a `RingGeometry` (sd to sd + 2.5 mm, `userData.stop`), the image plane a square at the image surface's sd (`userData.image`). One `MeshLambertMaterial` per element,
 * its `userData.fill` the element's CSS fill (glassFill's, or the crown / flint token) and its colour `resolve(fill)`: anything `Color.set` takes, or [r, g, b] in 0..255.
 * Every mesh of an element has `userData.glass` (its name) and `userData.fill`. Geometry is cached per `data` object; materials are made per call.
 * @param {*} layout a RecordedLayout
 * Rays and edges are fat lines (`LineSegments2` / `LineMaterial`, depth-tested, `linewidth` in CSS px for a renderer at `setPixelRatio(dpr)`): one object per drawn ray (`userData.ray`, `k`, `i`, `chief`; the set's
 * chief dashed unless the set is `chief`), one closed object per glazed surface's rim (`userData.edge = 'rim'`, `surface`) and two per glass gap for its silhouette (`edge = 'silhouette'`, `element`): the rim points of
 * greatest and least projected y, first rim to last. Rays are cut at the first Dead point with no Virtual or in-glass segment; the camera fits every such segment of every ray, whichever set is drawn.
 * @param {{ width?: number, height?: number, view?: 'iso' | 'front' | 'top', yaw?: number, pitch?: number, scale?: number, rays?: 'marginal-chief' | 'chief' | 'fan' | false, rayWidth?: number, edgeWidth?: number }} [o] `yaw` and `pitch` (degrees) win over `view`; `scale` (px/mm) overrides the fit; `rayWidth` and `edgeWidth` are CSS px (1.1 and 1.25)
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
  const v = o.yaw != null || o.pitch != null ? { yaw: o.yaw ?? PRESETS.iso.yaw, pitch: o.pitch ?? PRESETS.iso.pitch } : (Object.hasOwn(PRESETS, o.view || 'iso') ? PRESETS[o.view || 'iso'] : null);
  if (!v) throw new TypeError('layout3dScene: view is iso, front or top');
  const th = v.yaw * Math.PI / 180, ph = v.pitch * Math.PI / 180;
  const right = new Vector3(-Math.sin(th), 0, Math.cos(th)), up = new Vector3(-Math.cos(th) * Math.sin(ph), Math.cos(ph), -Math.sin(th) * Math.sin(ph));
  const fwd = new Vector3(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], q = new Vector3();
  const grow = (x, y, z) => { q.set(x, y, z); [q.dot(right), q.dot(up), q.dot(fwd)].forEach((c, a) => { lo[a] = Math.min(lo[a], c); hi[a] = Math.max(hi[a], c); }); };
  for (const p of geo.parts) { const a = p.geometry.attributes.position; for (let i = 0; i < a.count; i++) grow(a.getX(i), a.getY(i), a.getZ(i)); }
  for (const g of geo.segs) { grow(...g.a); grow(...g.b); }
  const s = o.scale > 0 ? o.scale : Math.min((W - 2 * PAD) / ((hi[0] - lo[0]) || 1), (H - 2 * PAD) / ((hi[1] - lo[1]) || 1));
  const mid = right.clone().multiplyScalar((lo[0] + hi[0]) / 2).addScaledVector(up, (lo[1] + hi[1]) / 2).addScaledVector(fwd, (lo[2] + hi[2]) / 2);
  const reach = (hi[2] - lo[2]) / 2 + 1;
  const camera = new OrthographicCamera(-W / (2 * s), W / (2 * s), H / (2 * s), -H / (2 * s), 0.5, 2 * reach + 1);
  camera.position.copy(mid).addScaledVector(fwd, -(reach + 0.5));
  camera.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, up, fwd.clone().negate()));
  camera.updateMatrixWorld(true);
  scene.add(camera);

  // the lines: materials per call, resolution in CSS px
  const lineMat = (fill, width, dashed) => {
    const m = new LineMaterial({ color: colour(resolve(fill)), linewidth: width, dashed: !!dashed, dashSize: 5 / s, gapSize: 4 / s, depthTest: true });
    m.resolution.set(W, H); m.userData.fill = fill; return m;
  };
  const line = (geometry, material, userData) => { const l = new LineSegments2(geometry, material); if (material.dashed) l.computeLineDistances(); l.userData = userData; scene.add(l); };
  const set = o.rays === undefined ? 'marginal-chief' : o.rays, rw = o.rayWidth ?? 1.1, ew = o.edgeWidth ?? 1.25;
  if (set !== false) {
    const picked = new Map(), chiefs = new Map(), byRay = new Map(), mats = new Map();
    for (const g of geo.segs) {
      if (!picked.has(g.k)) { picked.set(g.k, new Set(raySet(layout, g.k, set, 'layout3D'))); chiefs.set(g.k, raySet(layout, g.k, 'chief', 'layout3D')[0]); }
      if (!picked.get(g.k).has(g.i)) continue;
      const id = g.k + '/' + g.i; if (!byRay.has(id)) byRay.set(id, []); byRay.get(id).push(g);
    }
    for (const [id, list] of byRay) {
      const { k, i } = list[0], chief = i === chiefs.get(k) && set !== 'chief', key = k + (chief ? 'c' : '');
      if (!geo.rayGeo.has(id)) geo.rayGeo.set(id, lineGeometry(list.map((g) => [g.a, g.b])));
      if (!mats.has(key)) mats.set(key, lineMat(`var(--series-${k + 1}, var(--field-${STANDARD[k % STANDARD.length]}))`, rw, chief));
      line(geo.rayGeo.get(id), mats.get(key), { ray: true, k, i, chief });
    }
  }
  const edge = lineMat('var(--glass-edge)', ew), pairs = (ring) => ring.map((p, j) => [p, ring[(j + 1) % ring.length]]);
  for (const [surface, ring] of geo.rims) {
    if (!geo.rayGeo.has('rim' + surface)) geo.rayGeo.set('rim' + surface, lineGeometry(pairs(ring)));
    line(geo.rayGeo.get('rim' + surface), edge, { edge: 'rim', surface });
  }
  for (const gap of geo.gaps) {
    const h = gap.a.map((p) => q.set(...p).dot(up)), top = h.indexOf(Math.max(...h)), bot = h.indexOf(Math.min(...h));
    for (const j of [top, bot]) {
      const key = 'sil' + gap.element + '/' + j; // the segment is rim point j to rim point j, whatever the view: cached so a redraw makes no geometry for the renderer to keep
      if (!geo.rayGeo.has(key)) geo.rayGeo.set(key, lineGeometry([[gap.a[j], gap.b[j]]]));
      line(geo.rayGeo.get(key), edge, { edge: 'silhouette', element: gap.element });
    }
  }
  return { scene, camera };
}

// One offscreen renderer for every canvas: browsers cap live WebGL contexts (~16) and the gallery redraws on theme change. Made on first use, again if its context is lost.
let shared = null;
function renderer() {
  if (shared && !shared.getContext().isContextLost()) return shared;
  try { shared = new WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true }); } catch (e) { shared = null; throw new Error('layout3D: WebGL is not available'); }
  shared.setClearColor(0xffffff, 0);
  return shared;
}

/**
 * Draws a recorded layout into a 2D canvas: the scene through the shared renderer (the dpr clamped to 2-3), copied with `drawImage`, then the dashed axis, the XYZ triad and its labels in 2D.
 * Colours and widths come from the canvas's tokens (`--stroke-ray`, `--stroke-edge`); `resolve` turns a CSS fill into a colour through a probe element in the canvas's subtree.
 * @param {HTMLCanvasElement} canvas
 * @param {{ data: *, width?: number, height?: number, view?: 'iso' | 'front' | 'top', yaw?: number, pitch?: number, scale?: number, rays?: 'marginal-chief' | 'chief' | 'fan' | false }} o
 * @throws {Error} `layout3D: WebGL is not available` when no WebGL context can be made
 */
export function render3d(canvas, o) {
  if (!o || !o.data) throw new TypeError('layout3D: pass { data: RecordedLayout }');
  const gl = renderer();
  const dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1)), W = o.width || 560, H = o.height || 320;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  const C = (n) => css(canvas, n);
  c.fillStyle = C('surface'); c.fillRect(0, 0, W, H);
  // a fill is CSS only the browser resolves (var(), oklch()): a probe in the canvas's subtree takes its computed `color`, a 1 px canvas paints it and the pixel is read back. The probe sits in a wrapper coloured crown: a fill invalid at computed-value time computes as unset, which inherits, so it paints crown.
  const probe = document.createElement('span'), px = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  px.canvas.width = px.canvas.height = 1;
  const wrap = document.createElement('span'); wrap.style.color = 'var(--glass-crown)'; wrap.appendChild(probe); canvas.appendChild(wrap);
  const resolve = (fill) => { probe.style.color = ''; probe.style.color = fill; px.clearRect(0, 0, 1, 1); px.fillStyle = getComputedStyle(probe).color; px.fillRect(0, 0, 1, 1); return Array.from(px.getImageData(0, 0, 1, 1).data.slice(0, 3)); };
  let sc;
  try {
    sc = layout3dScene(o.data, { width: W, height: H, view: o.view, yaw: o.yaw, pitch: o.pitch, scale: o.scale, rays: o.rays, rayWidth: parseFloat(C('stroke-ray')) || undefined, edgeWidth: parseFloat(C('stroke-edge')) || undefined }, resolve);
  } finally { canvas.removeChild(wrap); }
  gl.setPixelRatio(dpr); gl.setSize(W, H, false);
  gl.render(sc.scene, sc.camera);
  c.drawImage(gl.domElement, 0, 0, W, H);
  sc.scene.traverse((n) => { if (n.material) n.material.dispose(); });

  // the 2D overlay: the dashed optical axis, then the XYZ triad with its labels
  const at = (p) => { const v = new Vector3(...p).project(sc.camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  const zs = o.data.surfaces.map((x) => x.z), axis = [Math.min(...zs) - 10, Math.max(...zs) + 4].map((z) => at([0, 0, z]));
  c.beginPath(); c.moveTo(...axis[0]); c.lineTo(...axis[1]); c.strokeStyle = C('plot-axis'); c.lineWidth = 0.75; c.setLineDash([3, 5]); c.stroke(); c.setLineDash([]);
  const r = new Vector3(1, 0, 0).applyQuaternion(sc.camera.quaternion), u = new Vector3(0, 1, 0).applyQuaternion(sc.camera.quaternion), t0 = [40, H - 28];
  c.font = `10px ${C('font-mono')}`; c.fillStyle = C('ink-muted'); c.strokeStyle = C('ink-muted'); c.lineWidth = 1;
  for (const [label, d] of [['X', new Vector3(1, 0, 0)], ['Y', new Vector3(0, 1, 0)], ['Z', new Vector3(0, 0, 1)]]) {
    const e = [t0[0] + d.dot(r) * 20, t0[1] - d.dot(u) * 20];
    c.beginPath(); c.moveTo(...t0); c.lineTo(...e); c.stroke(); c.fillText(label, e[0] + 3, e[1] + 3);
  }
}
