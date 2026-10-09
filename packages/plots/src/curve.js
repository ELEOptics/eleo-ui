import { idx, svg, esc, NS } from "./common.js";
import { data } from "./data.js";
import { fmt } from "./color.js";
import { niceTicks, niceRange } from "./axis.js";

/* Role to style (ADR-0001). Callers give a role and an index, never a color, font or stroke width. */
function roleStyle(s) {
  if (s.role === "reference") return { col: "var(--ink)", dash: "1 3", w: 1.25 };
  return { col: idx(s.index || 0), dash: s.role === "sagittal" ? "5 3" : "", w: 1.5 };
}
var inside = function (v, r) { return v >= r[0] && v <= r[1]; };
/* An axis range: the given one, else the nice range of the data; never empty or reversed. */
function axisRange(a, vals) {
  var r = a.range;
  if (!r) { var lo = Infinity, hi = -Infinity; vals.forEach(function (v) { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); r = lo <= hi ? [lo, hi] : [0, 1]; if (lo < hi) { var nr = niceRange(lo, hi, 6); r = [nr.lo, nr.hi]; } }
  return r[0] < r[1] ? [r[0], r[1]] : [r[0] - 1, r[0] + 1];
}
function axisTicks(a, r) {
  if (!a.ticks) return niceTicks(r[0], r[1], 6);
  var d = 0; a.ticks.forEach(function (v) { var m = /\.(\d+)$/.exec(String(v)); if (m) d = Math.max(d, m[1].length); });
  return { ticks: a.ticks, decimals: d };
}
function typedCurve(o) {
  var W = o.width || 460, H = o.height || 260, L = 46, R = 12, T = 14, Bm = 36, pw = W - L - R, ph = H - T - Bm, g = "";
  var x = o.x || {}, y = o.y || {}, all = o.series.map(function (s) { return s.points || []; });
  var xr = axisRange(x, [].concat.apply([], all.map(function (p) { return p.map(function (q) { return q[0]; }); })));
  var yr = axisRange(y, [].concat.apply([], all.map(function (p) { return p.map(function (q) { return q[1]; }); })));
  var xt = axisTicks(x, xr), yt = axisTicks(y, yr), sx = pw / (xr[1] - xr[0]), sy = ph / (yr[1] - yr[0]);
  function X(v) { return (L + (v - xr[0]) * sx).toFixed(1); } function Y(v) { return (T + ph - (v - yr[0]) * sy).toFixed(1); }
  g += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="var(--plot-grid)"/>';
  xt.ticks.filter(function (v) { return inside(v, xr); }).forEach(function (v) { g += '<line x1="' + X(v) + '" y1="' + T + '" x2="' + X(v) + '" y2="' + (T + ph) + '" stroke="var(--plot-grid)"/><text class="eleo-tick" x="' + X(v) + '" y="' + (T + ph + 13) + '" text-anchor="middle">' + fmt(v, xt.decimals) + "</text>"; });
  yt.ticks.filter(function (v) { return inside(v, yr); }).forEach(function (v) { g += '<line x1="' + L + '" y1="' + Y(v) + '" x2="' + (L + pw) + '" y2="' + Y(v) + '" stroke="var(--plot-grid)"/><text class="eleo-tick" x="' + (L - 6) + '" y="' + Y(v) + '" dy="3" text-anchor="end">' + fmt(v, yt.decimals) + "</text>"; });
  if (xr[0] < 0 && xr[1] > 0) g += '<line x1="' + X(0) + '" y1="' + T + '" x2="' + X(0) + '" y2="' + (T + ph) + '" stroke="var(--plot-axis)"/>';
  if (yr[0] < 0 && yr[1] > 0) g += '<line x1="' + L + '" y1="' + Y(0) + '" x2="' + (L + pw) + '" y2="' + Y(0) + '" stroke="var(--plot-axis)"/>';
  /* The series in data coordinates: px = M * data, inside a viewport that clips at the plot area. */
  var M = [+sx.toFixed(6), 0, 0, +(-sy).toFixed(6), +(-xr[0] * sx).toFixed(6), +(ph + yr[0] * sy).toFixed(6)];
  g += '<svg x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"><g transform="matrix(' + M.join(" ") + ')">';
  o.series.forEach(function (s) {
    var st = roleStyle(s), pts = s.points || [];
    g += '<polyline points="' + pts.map(function (p) { return +p[0].toFixed(6) + "," + +p[1].toFixed(6); }).join(" ") + '" fill="none" stroke="' + st.col + '" stroke-width="' + st.w + '" stroke-linecap="round" stroke-linejoin="round"' + (st.dash ? ' stroke-dasharray="' + st.dash + '"' : "") + " " + NS + "/>";
  });
  g += "</g></svg>";
  var lab = function (a) { return esc(a.label || "") + (a.unit ? ", " + esc(a.unit) : ""); };
  g += '<text class="eleo-tick" x="' + (L + pw) + '" y="' + (H - 4) + '" text-anchor="end">' + lab(x) + '</text><text class="eleo-tick" x="4" y="' + (T - 4) + '">' + lab(y) + "</text>";
  return svg(W, H, g, esc(lab(y) + " against " + lab(x)) + " plot");
}

/* Each analysis kind is an adapter: the sample in, { series, x, y } out, drawn by the typed path. */
export var curveAdapters = {
  mtf: function (D) {
    var df = D.mtf.df, fx = function (arr) { return arr.map(function (v, i) { return [i * df, v]; }); }, series = [{ points: fx(D.mtf.diff), role: "reference" }];
    D.mtf.fields.forEach(function (f, i) { series.push({ points: fx(f.T), index: i, role: "tangential" }); series.push({ points: fx(f.S), index: i, role: "sagittal" }); });
    return { series: series, x: { label: "Spatial frequency", unit: "cycles/mm", range: [0, 400], ticks: [0, 100, 200, 300, 400] }, y: { label: "Modulus", range: [0, 1], ticks: [0, .2, .4, .6, .8, 1] } };
  },
  fieldCurvature: function (D) {
    return { series: [{ points: D.fieldCurv.map(function (r) { return [r[1], r[0]]; }), index: 0, role: "tangential" }, { points: D.fieldCurv.map(function (r) { return [r[2], r[0]]; }), index: 0, role: "sagittal" }],
      x: { label: "Focus shift", unit: "mm", range: [-0.2, 0.2], ticks: [-0.2, -0.1, 0, 0.1, 0.2] }, y: { label: "Field", unit: "°", range: [0, 2], ticks: [0, 0.5, 1, 1.5, 2] } };
  },
  distortion: function (D) {
    return { series: [{ points: D.distortion.map(function (r) { return [r[1], r[0]]; }), index: 0 }],
      x: { label: "Distortion", unit: "%", range: [-0.2, 0.2], ticks: [-0.2, -0.1, 0, 0.1, 0.2] }, y: { label: "Field", unit: "°", range: [0, 2], ticks: [0, 0.5, 1, 1.5, 2] } };
  },
  chromaticFocus: function (D) {
    return { series: [{ points: D.chromFocus.map(function (r) { return [r[1], r[0]]; }), index: 0 }],
      x: { label: "Focus shift", unit: "µm", range: [-50, 200], ticks: [-50, 0, 50, 100, 150, 200] }, y: { label: "Wavelength", unit: "nm", range: [450, 700], ticks: [450, 500, 550, 600, 650, 700] } };
  }
};

export function curve(o) {
  o = o || {};
  if (o.series) return typedCurve(o);
  var a = (curveAdapters[o.kind || "mtf"] || curveAdapters.chromaticFocus)(data(o));
  return typedCurve({ series: a.series, x: a.x, y: a.y, width: o.width, height: o.height });
}
