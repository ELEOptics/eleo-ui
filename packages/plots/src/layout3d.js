import { STANDARD } from "./common.js";
import { data } from "./data.js";
import { css, rgb } from "./color.js";
import { glassFill, drawnGlasses } from "./glass.js";

/* ---------------- Layout3D (canvas) ---------------- */
export function layout3D(canvas, o) {
  o = o || {}; var D = data(o), showRays = o.rays !== false;
  var dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1)), Wc = o.width || 560, Hc = o.height || 320;
  canvas.width = Wc * dpr; canvas.height = Hc * dpr; var c = canvas.getContext("2d"); c.scale(dpr, dpr);
  var C = function (n) { return css(canvas, n); };
  c.fillStyle = C("surface"); c.fillRect(0, 0, Wc, Hc);
  var th = (o.yaw == null ? -38 : o.yaw) * Math.PI / 180, ph = (o.pitch == null ? 16 : o.pitch) * Math.PI / 180;
  function R3(p) { var h = p[2] * Math.cos(th) - p[0] * Math.sin(th), d = p[2] * Math.sin(th) + p[0] * Math.cos(th); return [h, p[1] * Math.cos(ph) - d * Math.sin(ph), p[1] * Math.sin(ph) + d * Math.cos(ph)]; }
  var zc = D.zimg / 2 + 2, sc = (o.scale || 4.6) * Wc / 560, ox = Wc / 2 + 8, oy = Hc / 2 + 10;
  function S2(p) { var q = R3([p[0], p[1], p[2] - zc]); return [ox + q[0] * sc, oy - q[1] * sc, q[2]]; }
  var segN = 128, ringN = 16, faces = [];
  function sagf(pr, r) { return pr.R - Math.sign(pr.R) * Math.sqrt(pr.R * pr.R - r * r); }
  function surf(pr) { var out = []; for (var i = 0; i <= ringN; i++) { var r = pr.sd * i / ringN, z = pr.z + sagf(pr, r), row = []; for (var j = 0; j < segN; j++) { var a = 2 * Math.PI * j / segN; row.push([r * Math.cos(a), r * Math.sin(a), z]); } out.push(row); } return out; }
  var g1 = surf(D.profiles[0]), g2 = surf(D.profiles[1]), g3 = surf(D.profiles[2]);
  function quads(g, t) { for (var i = 0; i < ringN; i++) for (var j = 0; j < segN; j++) faces.push({ v: [g[i][j], g[i][(j + 1) % segN], g[i + 1][(j + 1) % segN], g[i + 1][j]], t: t }); }
  function rim(a, b, t) { for (var j = 0; j < segN; j++) faces.push({ v: [a[ringN][j], a[ringN][(j + 1) % segN], b[ringN][(j + 1) % segN], b[ringN][j]], t: t }); }
  quads(g1, 0); quads(g2, 1); quads(g3, 1); rim(g1, g2, 0); rim(g2, g3, 1);
  var Lv = [-0.35, 0.75, -0.55], m = Math.hypot(Lv[0], Lv[1], Lv[2]); Lv = Lv.map(function (x) { return x / m; });
  var tone = [rgb(C("glass-crown")), rgb(C("glass-flint"))];
  var prj = faces.map(function (f) {
    var a = f.v.map(function (p) { return R3([p[0], p[1], p[2] - zc]); });
    var u = [0, 1, 2].map(function (i) { return a[2][i] - a[0][i]; }), w = [0, 1, 2].map(function (i) { return a[3][i] - a[1][i]; });
    var n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nm = Math.hypot(n[0], n[1], n[2]) || 1;
    var k = 0.82 + 0.18 * Math.abs((n[0] * Lv[0] + n[1] * Lv[1] + n[2] * Lv[2]) / nm);
    return { q: f.v.map(S2), d: (a[0][2] + a[1][2] + a[2][2] + a[3][2]) / 4, col: "rgb(" + tone[f.t].map(function (v) { return Math.min(255, Math.round(v * k)); }) + ")" };
  }).sort(function (a, b) { return b.d - a.d; });
  function facing(v) { return R3(v)[2] < 0; }
  var inFront = facing([0, 0, -1]), outFront = facing([0, 0, 1]);
  function line(pts, col, w, dash) { c.beginPath(); pts.forEach(function (p, i) { var q = S2(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]); }
  function plane() { var s0 = 4.5, zi = D.zimg, sen = [[-s0, -s0, zi], [s0, -s0, zi], [s0, s0, zi], [-s0, s0, zi]].map(S2); c.beginPath(); sen.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fillStyle = C("mech"); c.fill(); c.strokeStyle = C("ink"); c.lineWidth = 1.25; c.stroke(); }
  c.lineCap = "round"; c.lineJoin = "round";
  line([[0, 0, -12], [0, 0, D.zimg + 4]], C("plot-axis"), .75, [3, 5]);
  var fields = [0, 1, 2].map(function (k) { return C("series-" + (k + 1)) || C("field-" + STANDARD[k]); });
  var rays = D.rays3d.map(function (rs, k) { return { k: k, rs: rs.filter(function (_, i) { return i % 2 === 0 || i === rs.length - 1; }) }; });
  function seg(which) { if (!showRays) return; rays.forEach(function (R) { R.rs.forEach(function (r, i) { var chief = i === R.rs.length - 1; line(which === "in" ? [r[0], r[1]] : [r[3], r[4]], fields[R.k], 1.1, chief ? [5, 4] : null); }); }); }
  if (!inFront) seg("in"); if (!outFront) { plane(); seg("out"); }
  prj.forEach(function (f) { c.beginPath(); f.q.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fillStyle = f.col; c.fill(); c.strokeStyle = f.col; c.lineWidth = .7; c.stroke(); });
  var edge = C("glass-edge");
  [g1, g2, g3].forEach(function (g) { line(g[ringN].concat([g[ringN][0]]), edge, 1.25); });
  var top = 0, tv = 1e9; for (var j = 0; j < segN; j++) { var q = S2(g1[ringN][j]); if (q[1] < tv) { tv = q[1]; top = j; } }
  [top, (top + segN / 2) % segN].forEach(function (j) { line([g1[ringN][j], g3[ringN][j]], edge, 1.25); });
  if (inFront) seg("in"); if (outFront) { plane(); seg("out"); }
  var t0 = [40, Hc - 28]; c.font = '10px "Fira Code", monospace'; c.fillStyle = C("ink-muted"); c.strokeStyle = C("ink-muted"); c.lineWidth = 1;
  [["X", [1, 0, 0]], ["Y", [0, 1, 0]], ["Z", [0, 0, 1]]].forEach(function (a) { var q = R3(a[1]), e = [t0[0] + q[0] * 20, t0[1] - q[1] * 20]; c.beginPath(); c.moveTo(t0[0], t0[1]); c.lineTo(e[0], e[1]); c.stroke(); c.fillText(a[0], e[0] + 3, e[1] + 3); });
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
 * (`scale`, px/mm, overrides the fit).
 * @param {{ faces: { v: number[][] }[] }} mesh
 * @param {{ width?: number, height?: number, yaw?: number, pitch?: number, scale?: number }} [o]
 */
export function fitView(mesh, o) {
  o = o || {};
  var W = o.width || 560, H = o.height || 320, view = { yaw: o.yaw == null ? -38 : o.yaw, pitch: o.pitch == null ? 16 : o.pitch, scale: 1, center: [0, 0, 0], origin: [0, 0] };
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  mesh.faces.forEach(function (f) { f.v.forEach(function (p) { var q = project(p, view); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }); });
  var pad = 16, s = o.scale > 0 ? o.scale : Math.min((W - 2 * pad) / ((x1 - x0) || 1), (H - 2 * pad) / ((y1 - y0) || 1));
  view.scale = s; view.origin = [W / 2 - s * (x0 + x1) / 2, H / 2 - s * (y0 + y1) / 2];
  return view;
}
