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

export function curve(o) {
  o = o || {};
  if (o.series) return typedCurve(o); var D = data(o), kind = o.kind || "mtf", W = o.width || 460, H = o.height || 260, L = 46, R = 12, T = 14, Bm = 36;
  var pw = W - L - R, ph = H - T - Bm, g = "", series = [], xr, yr, xl, yl, xt, yt;
  if (kind === "mtf") {
    var df = D.mtf.df, fx = function (arr) { return arr.map(function (v, i) { return [i * df, v]; }).filter(function (p) { return p[0] <= 400; }); };
    series.push({ pts: fx(D.mtf.diff), col: "var(--ink)", dash: "1 3", w: 1.25 });
    D.mtf.fields.forEach(function (f, i) { series.push({ pts: fx(f.T), col: idx(i) }); series.push({ pts: fx(f.S), col: idx(i), dash: "5 3" }); });
    xr = [0, 400]; yr = [0, 1]; xl = "Spatial frequency, cycles/mm"; yl = "Modulus"; xt = [0, 100, 200, 300, 400]; yt = [0, .2, .4, .6, .8, 1];
  } else if (kind === "fieldCurvature") {
    series.push({ pts: D.fieldCurv.map(function (r) { return [r[1], r[0]]; }), col: idx(0) });
    series.push({ pts: D.fieldCurv.map(function (r) { return [r[2], r[0]]; }), col: idx(0), dash: "5 3" });
    xr = [-0.2, 0.2]; yr = [0, 2]; xl = "Focus shift, mm"; yl = "Field, °"; xt = [-0.2, -0.1, 0, 0.1, 0.2]; yt = [0, 0.5, 1, 1.5, 2];
  } else if (kind === "distortion") {
    series.push({ pts: D.distortion.map(function (r) { return [r[1], r[0]]; }), col: idx(0) });
    xr = [-0.2, 0.2]; yr = [0, 2]; xl = "Distortion, %"; yl = "Field, °"; xt = [-0.2, -0.1, 0, 0.1, 0.2]; yt = [0, 0.5, 1, 1.5, 2];
  } else {
    series.push({ pts: D.chromFocus.map(function (r) { return [r[1], r[0]]; }), col: idx(0) });
    xr = [-50, 200]; yr = [450, 700]; xl = "Focus shift, µm"; yl = "Wavelength, nm"; xt = [-50, 0, 50, 100, 150, 200]; yt = [450, 500, 550, 600, 650, 700];
  }
  function X(v) { return (L + (v - xr[0]) / (xr[1] - xr[0]) * pw).toFixed(1); } function Y(v) { return (T + ph - (v - yr[0]) / (yr[1] - yr[0]) * ph).toFixed(1); }
  g += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="var(--plot-grid)"/>';
  xt.forEach(function (v) { g += '<line x1="' + X(v) + '" y1="' + T + '" x2="' + X(v) + '" y2="' + (T + ph) + '" stroke="' + (v === 0 && kind !== "mtf" ? "var(--plot-axis)" : "var(--plot-grid)") + '"/><text class="eleo-tick" x="' + X(v) + '" y="' + (T + ph + 13) + '" text-anchor="middle">' + fmt(v, Math.abs(v) < 1 && v !== 0 ? 1 : 0) + "</text>"; });
  yt.forEach(function (v) { g += '<line x1="' + L + '" y1="' + Y(v) + '" x2="' + (L + pw) + '" y2="' + Y(v) + '" stroke="var(--plot-grid)"/><text class="eleo-tick" x="' + (L - 6) + '" y="' + Y(v) + '" dy="3" text-anchor="end">' + (kind === "mtf" ? v.toFixed(1) : v) + "</text>"; });
  series.forEach(function (s) { g += '<polyline points="' + s.pts.map(function (p) { return X(p[0]) + "," + Y(p[1]); }).join(" ") + '" fill="none" stroke="' + s.col + '" stroke-width="' + (s.w || 1.5) + '" stroke-linecap="round" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + "/>"; });
  g += '<text class="eleo-tick" x="' + (L + pw) + '" y="' + (H - 4) + '" text-anchor="end">' + xl + '</text><text class="eleo-tick" x="4" y="' + (T - 4) + '">' + yl + "</text>";
  return svg(W, H, g, kind + " plot");
}
