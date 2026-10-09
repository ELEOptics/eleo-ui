import { STANDARD } from "./common.js";
import { data } from "./data.js";
import { css, rgb } from "./color.js";

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
  c.lineCap = "round"; c.lineJoin = "round";
  line([[0, 0, -12], [0, 0, D.zimg + 4]], C("plot-axis"), .75, [3, 5]);
  var fields = [0, 1, 2].map(function (k) { return C("series-" + (k + 1)) || C("field-" + STANDARD[k]); });
  var rays = D.rays3d.map(function (rs, k) { return { k: k, rs: rs.filter(function (_, i) { return i % 2 === 0 || i === rs.length - 1; }) }; });
  function seg(which) { if (!showRays) return; rays.forEach(function (R) { R.rs.forEach(function (r, i) { var chief = i === R.rs.length - 1; line(which === "in" ? [r[0], r[1]] : [r[3], r[4]], fields[R.k], 1.1, chief ? [5, 4] : null); }); }); }
  if (!inFront) seg("in"); if (!outFront) seg("out");
  prj.forEach(function (f) { c.beginPath(); f.q.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fillStyle = f.col; c.fill(); c.strokeStyle = f.col; c.lineWidth = .7; c.stroke(); });
  var edge = C("glass-edge");
  [g1, g2, g3].forEach(function (g) { line(g[ringN].concat([g[ringN][0]]), edge, 1.25); });
  var top = 0, tv = 1e9; for (var j = 0; j < segN; j++) { var q = S2(g1[ringN][j]); if (q[1] < tv) { tv = q[1]; top = j; } }
  [top, (top + segN / 2) % segN].forEach(function (j) { line([g1[ringN][j], g3[ringN][j]], edge, 1.25); });
  if (inFront) seg("in"); if (outFront) seg("out");
  var s0 = 4.5, zi = D.zimg, sen = [[-s0, -s0, zi], [s0, -s0, zi], [s0, s0, zi], [-s0, s0, zi]].map(S2);
  c.beginPath(); sen.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fillStyle = C("mech"); c.fill(); c.strokeStyle = C("ink"); c.lineWidth = 1.25; c.stroke();
  var t0 = [40, Hc - 28]; c.font = '10px "Fira Code", monospace'; c.fillStyle = C("ink-muted"); c.strokeStyle = C("ink-muted"); c.lineWidth = 1;
  [["X", [1, 0, 0]], ["Y", [0, 1, 0]], ["Z", [0, 0, 1]]].forEach(function (a) { var q = R3(a[1]), e = [t0[0] + q[0] * 20, t0[1] - q[1] * 20]; c.beginPath(); c.moveTo(t0[0], t0[1]); c.lineTo(e[0], e[1]); c.stroke(); c.fillText(a[0], e[0] + 3, e[1] + 3); });
}
