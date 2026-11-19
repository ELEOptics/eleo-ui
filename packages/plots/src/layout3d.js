import { STANDARD } from "./common.js";
import { css } from "./color.js";
import { glassFill, drawnGlasses } from "./glass.js";
import { raySet, statusOf, segmentStatus } from "./layout2d.js";

/* ---------------- Layout3D (canvas): the mesh, painter-sorted with the rays ---------------- */
var LIGHT = (function () { var v = [-0.35, 0.75, -0.55], m = Math.hypot(v[0], v[1], v[2]); return v.map(function (x) { return x / m; }); })();

/**
 * What layout3D paints, far to near: the mesh's faces shaded by the light, and the air segments of the chosen ray sets (never inside glass, through the first Dead
 * point, never a Virtual segment) at their mid depth. `resolve(fill)` returns the [r, g, b] of a face's CSS fill, called once per distinct fill.
 * @returns {{ view: object, items: object[] }} faces `{ kind: "face", q: [px, py][], depth, color }`, segments `{ kind: "ray", k, i, j, p: [[px, py], [px, py]], depth, chief }`
 */
export function layout3dScene(layout, o, resolve) {
  o = o || {};
  var W = o.width || 560, H = o.height || 320, mesh = layout3dMesh(layout, { width: W });
  var S = layout.surfaces, set = o.rays === undefined ? "marginal-chief" : o.rays;
  function collect(which) {
    var out = [];
    layout.rays.forEach(function (fan, k) {
      if (!fan.length) return;
      var c = raySet(layout, k, "chief", "layout3D")[0];
      raySet(layout, k, which, "layout3D").forEach(function (i) {
        var r = fan[i], st = statusOf(layout, k, i) || r.map(function () { return "Alive"; }), end = st.indexOf("Dead") < 0 ? r.length - 1 : st.indexOf("Dead");
        for (var j = 1; j <= end; j++) {
          if (segmentStatus(layout, st, j) === "Virtual" || (j >= 2 && S[j - 2] && S[j - 2].glass)) continue;
          out.push({ k: k, i: i, j: j, a: [0, r[j - 1][1], r[j - 1][0]], b: [0, r[j][1], r[j][0]], chief: i === c && which !== "chief" });
        }
      });
    });
    return out;
  }
  // The view fits every recorded ray's drawable segments, whichever set is drawn, so the `rays` option never moves it.
  var pts = []; collect("fan").forEach(function (g) { pts.push(g.a, g.b); });
  var segs = set === false ? [] : collect(set);
  var view = fitView(mesh, { width: W, height: H, yaw: o.yaw, pitch: o.pitch, scale: o.scale, points: pts });
  var items = [], tone = new Map(), s = view.scale;
  function toneOf(fill) { if (!tone.has(fill)) tone.set(fill, resolve(fill)); return tone.get(fill); }
  mesh.faces.forEach(function (f) {
    var q = f.v.map(function (p) { return project(p, view); }), a = q.map(function (p) { return [p[0] / s, -p[1] / s, p[2]]; });
    var u = [0, 1, 2].map(function (i) { return a[2][i] - a[0][i]; }), w = [0, 1, 2].map(function (i) { return a[3][i] - a[1][i]; });
    var n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nm = Math.hypot(n[0], n[1], n[2]) || 1;
    var k = f.image ? 1 : 0.82 + 0.18 * Math.abs((n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / nm);
    items.push({ kind: "face", q: q.map(function (p) { return [p[0], p[1]]; }), depth: q.reduce(function (d, p) { return d + p[2]; }, 0) / q.length, color: "rgb(" + toneOf(f.fill).map(function (v) { return Math.min(255, Math.round(v * k)); }) + ")", image: !!f.image, stop: !!f.stop });
  });
  segs.forEach(function (g) {
    var a = project(g.a, view), b = project(g.b, view);
    items.push({ kind: "ray", k: g.k, i: g.i, j: g.j, p: [[a[0], a[1]], [b[0], b[1]]], depth: (a[2] + b[2]) / 2, chief: g.chief });
  });
  // The plane is drawn under the rays that end on it, from whichever side they are seen: its depth is no nearer than theirs.
  var im = S.findIndex(function (x) { return x.image; });
  items.forEach(function (f) { if (f.image) items.forEach(function (r) { if (r.kind === "ray" && r.j === im + 1 && r.depth > f.depth) f.depth = r.depth; }); });
  items.sort(function (a, b) { return b.depth - a.depth; });
  return { view: view, items: items };
}

export function layout3D(canvas, o) {
  if (!o || !o.data) throw new TypeError("layout3D: pass { data: RecordedLayout }");
  var dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1)), Wc = o.width || 560, Hc = o.height || 320;
  canvas.width = Wc * dpr; canvas.height = Hc * dpr; var c = canvas.getContext("2d"); c.scale(dpr, dpr);
  var C = function (n) { return css(canvas, n); };
  c.fillStyle = C("surface"); c.fillRect(0, 0, Wc, Hc);
  // Each distinct fill is CSS that only the browser resolves (var(), oklch()): a probe in the canvas's subtree takes its computed `color`, a 1 px canvas paints it, and the pixel is read back. A fill the browser rejects leaves `color` empty and takes the crown token, as layout2D's SVG does.
  var probe = document.createElement("span"), px = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  px.canvas.width = px.canvas.height = 1; canvas.appendChild(probe);
  function resolve(fill) { probe.style.color = ""; probe.style.color = fill; if (!probe.style.color) probe.style.color = "var(--glass-crown)"; px.clearRect(0, 0, 1, 1); px.fillStyle = getComputedStyle(probe).color; px.fillRect(0, 0, 1, 1); return Array.prototype.slice.call(px.getImageData(0, 0, 1, 1).data, 0, 3); }
  var sc;
  try { sc = layout3dScene(o.data, { width: Wc, height: Hc, rays: o.rays, yaw: o.yaw, pitch: o.pitch, scale: o.scale }, resolve); } finally { canvas.removeChild(probe); }
  var view = sc.view, fields = function (k) { return C("series-" + (k + 1)) || C("field-" + STANDARD[k % STANDARD.length]); };
  function path(pts) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); }
  c.lineCap = "round"; c.lineJoin = "round";
  var zs = o.data.surfaces.map(function (x) { return x.z; }), axis = [-10, 4].map(function (d, i) { var q = project([0, 0, i ? Math.max.apply(null, zs) + d : Math.min.apply(null, zs) + d], view); return [q[0], q[1]]; });
  path(axis); c.strokeStyle = C("plot-axis"); c.lineWidth = .75; c.setLineDash([3, 5]); c.stroke(); c.setLineDash([]);
  var rw = parseFloat(C("stroke-ray")) || 1.1;
  sc.items.forEach(function (f) {
    path(f.p || f.q);
    if (f.kind === "ray") { c.strokeStyle = fields(f.k); c.lineWidth = rw; c.setLineDash(f.chief ? [5, 4] : []); c.stroke(); c.setLineDash([]); return; }
    c.closePath(); c.fillStyle = f.color; c.fill(); c.strokeStyle = f.color; c.lineWidth = .7; c.stroke();
  });
  var t0 = [40, Hc - 28], flat = { yaw: view.yaw, pitch: view.pitch, scale: 1, center: [0, 0, 0], origin: [0, 0] };
  c.font = '10px "Fira Code", monospace'; c.fillStyle = C("ink-muted"); c.strokeStyle = C("ink-muted"); c.lineWidth = 1;
  [["X", [1, 0, 0]], ["Y", [0, 1, 0]], ["Z", [0, 0, 1]]].forEach(function (a) { var q = project(a[1], flat), e = [t0[0] + q[0] * 20, t0[1] + q[1] * 20]; c.beginPath(); c.moveTo(t0[0], t0[1]); c.lineTo(e[0], e[1]); c.stroke(); c.fillText(a[0], e[0] + 3, e[1] + 3); });
}

/* ---------------- Layout3D mesh (plan #1193, item 2): unprojected faces, and the projection apart ---------------- */
var FACE_BUDGET = 3500, FULL_RINGS = 16, FULL_SEGS = 128;

// The y >= 0 half of a surface's [z, y] profile, ascending in y.
function halfProfile(s) {
  var h = s.profile.filter(function (p) { return p[1] >= -1e-9; }).map(function (p) { return [p[0], Math.max(0, p[1])]; });
  return h.sort(function (a, b) { return a[1] - b[1]; });
}
// z of the half profile at radius r, linear between its points (the same polyline layout2D draws).
function zAt(h, r) {
  for (var i = 0; i + 1 < h.length; i++) if (r <= h[i + 1][1] + 1e-12) { var d = h[i + 1][1] - h[i][1]; return h[i][0] + (d > 0 ? (h[i + 1][0] - h[i][0]) * (r - h[i][1]) / d : 0); }
  return h[h.length - 1][0];
}
function isRecorded(L) {
  return L != null && typeof L === "object" && Array.isArray(L.surfaces) && L.surfaces.length > 0 && Array.isArray(L.rays) &&
    L.surfaces.every(function (s) { return s && Array.isArray(s.profile) && s.profile.length > 1 && s.profile.every(function (p) { return Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]); }) && s.profile.some(function (p) { return p[1] >= -1e-9; }); });
}

/**
 * The faces of a recorded layout, unprojected, z the optical axis: each glazed surface (one with a glass, or the exit of a glass gap) revolved from the
 * y >= 0 half of its profile, a rim per glass gap, a flat ring outside an air-air stop's aperture (sd to sd + 2.5 mm, `stop: true`), and the image plane as a square at the image surface's sd (`image: true`).
 * Each face is `{ v: [[x, y, z], ...], glass?, fill }`; `glass` is the element's name ("crown", "flint" or a {name} glass's name) and `fill` its CSS fill.
 * Faces per surface are min(full density, 3,500 / surfaces), so a 50-surface system stays within the budget.
 * @param {*} layout a RecordedLayout
 * @param {{ width?: number }} [o]
 */
export function layout3dMesh(layout, o) {
  if (!isRecorded(layout)) throw new TypeError("layout3dMesh: expected a RecordedLayout ({ surfaces, rays }) with a profile on every surface");
  var S = layout.surfaces, glasses = drawnGlasses(S, "layout3dMesh"), fills = glassFill(glasses), faces = [];
  var nameOf = function (g) { return typeof g === "object" ? g.name : g; };
  var fillOf = function (g) { return typeof g === "object" ? fills.get(g.name) : g === "flint" ? "var(--glass-flint)" : "var(--glass-crown)"; };
  // the element a surface's faces belong to: its own glass, else the glass gap it closes
  var own = function (i) { var g = S[i].glass ? S[i].glass : S[i - 1] && S[i - 1].glass ? S[i - 1].glass : null; return S[i].image ? null : g; };
  var stopRing = function (i) { return S[i].stop && !S[i].glass && !(S[i - 1] && S[i - 1].glass) && !S[i].image; };
  var units = S.filter(function (s, i) { return own(i) || stopRing(i); }).length;
  var A = Math.floor((FACE_BUDGET - 1) / Math.max(1, units));
  var rings = Math.max(2, Math.min(FULL_RINGS, Math.round(Math.sqrt(A / 8)))), segs = Math.max(3, Math.min(FULL_SEGS, Math.floor(A / (rings + 1))));
  var ang = function (j) { return 2 * Math.PI * (j % segs) / segs; };
  var ringAt = function (h, r, j) { return [r * Math.cos(ang(j)), r * Math.sin(ang(j)), zAt(h, r)]; };
  var radii = function (h, n) { var r0 = h[0][1], r1 = h[h.length - 1][1], out = []; for (var i = 0; i <= n; i++) out.push(r0 + (r1 - r0) * i / n); return out; };
  function add(v, g) { var f = { v: v }; if (g) { f.glass = nameOf(g); f.fill = fillOf(g); } else f.fill = "var(--mech)"; faces.push(f); }
  S.forEach(function (s, i) {
    if (s.image) return;
    var g = own(i), h = halfProfile(s);
    if (g) {
      var rs = radii(h, rings);
      for (var a = 0; a < rings; a++) for (var j = 0; j < segs; j++) add([ringAt(h, rs[a], j), ringAt(h, rs[a], j + 1), ringAt(h, rs[a + 1], j + 1), ringAt(h, rs[a + 1], j)], g);
      var n = S[i + 1];
      if (s.glass && n) { var hn = halfProfile(n), ro = h[h.length - 1][1], rn = hn[hn.length - 1][1]; for (var k = 0; k < segs; k++) add([ringAt(h, ro, k), ringAt(h, ro, k + 1), ringAt(hn, rn, k + 1), ringAt(hn, rn, k)], s.glass); }
    } else if (stopRing(i)) {
      // A flat annulus outside the aperture, from sd out by 2.5 mm (layout2D's stop tick length), at the profile's edge z: the marginal rays pass near sd, so the ring stays clear of them.
      var ze = h[h.length - 1][0], ri = s.sd, ro2 = s.sd + 2.5, at = function (r, j) { return [r * Math.cos(ang(j)), r * Math.sin(ang(j)), ze]; };
      for (var m = 0; m < segs; m++) { add([at(ri, m), at(ri, m + 1), at(ro2, m + 1), at(ro2, m)], null); faces[faces.length - 1].stop = true; faces[faces.length - 1].fill = "var(--ink)"; }
    }
  });
  var im = S.filter(function (s) { return s.image; })[0];
  if (im) { var e = im.sd; faces.push({ v: [[-e, -e, im.z], [e, -e, im.z], [e, e, im.z], [-e, e, im.z]], image: true, fill: "var(--mech)" }); }
  return { faces: faces, segments: segs, rings: rings };
}

/**
 * Orthographic projection of a mesh point: yaw about y, then pitch about x, about `view.center`; px right, py down at `view.scale` px/mm from `view.origin`.
 * @returns {[number, number, number]} [px, py, depth]; a larger depth is farther from the viewer
 */
export function project(p, view) {
  var th = view.yaw * Math.PI / 180, ph = view.pitch * Math.PI / 180, c = view.center, x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
  var h = z * Math.cos(th) - x * Math.sin(th), d = z * Math.sin(th) + x * Math.cos(th);
  var v = y * Math.cos(ph) - d * Math.sin(ph), dep = y * Math.sin(ph) + d * Math.cos(ph);
  return [view.origin[0] + h * view.scale, view.origin[1] - v * view.scale, dep];
}

/**
 * The default view of a mesh: yaw -38, pitch 16 unless given, the rotated bounds centred in width x height with a 16 px margin and fitted
 * (`scale`, px/mm, overrides the fit). `points` (3D, like the mesh's) are fitted with the faces.
 * @param {{ faces: { v: number[][] }[] }} mesh
 * @param {{ width?: number, height?: number, yaw?: number, pitch?: number, scale?: number, points?: number[][] }} [o]
 */
export function fitView(mesh, o) {
  o = o || {};
  var W = o.width || 560, H = o.height || 320, view = { yaw: o.yaw == null ? -38 : o.yaw, pitch: o.pitch == null ? 16 : o.pitch, scale: 1, center: [0, 0, 0], origin: [0, 0] };
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  function grow(p) { var q = project(p, view); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  mesh.faces.forEach(function (f) { f.v.forEach(grow); });
  (o.points || []).forEach(grow);
  var pad = 16, s = o.scale > 0 ? o.scale : Math.min((W - 2 * pad) / ((x1 - x0) || 1), (H - 2 * pad) / ((y1 - y0) || 1));
  view.scale = s; view.origin = [W / 2 - s * (x0 + x1) / 2, H / 2 - s * (y0 + y1) / 2];
  return view;
}
