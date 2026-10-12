import { idx, svg, esc, NS } from "./common.js";
import { data } from "./data.js";
import { fmt } from "./color.js";
import { niceTicks, niceRange } from "./axis.js";

/* Role to style (ADR-0001). Callers give a role and an index, never a color, font or stroke width. */
function roleStyle(s) {
  if (s.role === "reference") return { col: "var(--ink)", dash: "1 3", w: 1 };
  return { col: idx(s.index || 0), dash: s.role === "sagittal" ? "5 3" : "", w: 1 };
}
var inside = function (v, r) { return v >= r[0] && v <= r[1]; };
/* An axis range: the given one, else the nice range of the data; never empty or reversed. */
function axisRange(a, vals) {
  var r = a.range && a.range.map(Number);
  /* A range that is not two finite numbers is dropped: the axis falls back to the data. */
  if (r && !(r.length >= 2 && isFinite(r[0]) && isFinite(r[1]))) r = null;
  if (!r) { var lo = Infinity, hi = -Infinity; vals.forEach(function (v) { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); r = lo <= hi ? [lo, hi] : [0, 1]; if (lo < hi) { var nr = niceRange(lo, hi, 6); r = [nr.lo, nr.hi]; } }
  return r[0] < r[1] ? [r[0], r[1]] : [r[0] - 1, r[0] + 1];
}
function axisTicks(a, r) {
  if (!a.ticks) return niceTicks(r[0], r[1], 6);
  /* The fewest decimals at which every tick prints exactly (within float noise). */
  var ts = a.ticks.map(Number), d = 0;
  while (d < 20 && !ts.every(function (v) { return Math.abs(Number(v.toFixed(d)) - v) <= 1e-9 * Math.abs(v); })) d++;
  return { ticks: ts, decimals: d };
}
/* A series as path data in data coordinates: a point with a null coordinate ends the run, and the next live point starts a new subpath (a polyline can't break). A run of one point is a dot: M x,y h0 under a round cap. */
function seriesPath(pts) {
  var d = "", run = [];
  function flush() { if (run.length) d += (d ? " " : "") + "M" + run.join(" L") + (run.length === 1 ? " h0" : ""); run = []; }
  pts.forEach(function (p) { if (p[0] === null || p[1] === null || p[0] === undefined || p[1] === undefined) flush(); else run.push(String(+p[0]) + "," + String(+p[1])); });
  flush();
  return d;
}
function seriesMarkup(s, panel) {
  var st = roleStyle(s), pts = s.points || [];
  var attrs = ' fill="none" stroke="' + st.col + '" stroke-width="' + st.w + '" stroke-linecap="round" stroke-linejoin="round"' + (st.dash ? ' stroke-dasharray="' + st.dash + '"' : "") + " " + NS + "/>";
  if (panel) return '<path d="' + seriesPath(pts) + '"' + attrs;
  return '<polyline points="' + pts.map(function (p) { return String(+p[0]) + "," + String(+p[1]); }).join(" ") + '"' + attrs;
}
/* The ranges and ticks, computed once over every series of every panel, and the right margin they need. */
function scales(o, groups) {
  var all = [].concat.apply([], groups.map(function (g) { return g.map(function (s) { return s.points || []; }); })), x = o.x || {}, y = o.y || {};
  var live = function (p) { return p[0] !== null && p[1] !== null; };
  var xr = axisRange(x, [].concat.apply([], all.map(function (p) { return p.filter(live).map(function (q) { return q[0]; }); })));
  var yr = axisRange(y, [].concat.apply([], all.map(function (p) { return p.filter(live).map(function (q) { return q[1]; }); })));
  var xt = axisTicks(x, xr), yt = axisTicks(y, yr);
  /* The right margin: 12 px, or half the rightmost shown x label's width (6 px a character, as layout2D estimates) when that is more. */
  var shown = xt.ticks.filter(function (v) { return inside(v, xr); }), R = 12;
  if (shown.length) R = Math.max(R, 3 * Array.from(fmt(Math.max.apply(null, shown), xt.decimals)).length);
  return { xr: xr, yr: yr, xt: xt, yt: yt, R: R };
}
/* One plot: the frame, ticks, zero lines and series, in a box of w by h; ox, oy is its corner. */
function plotCell(sc, series, w, h, T, panel) {
  var L = 46, Bm = 36, ph = h - T - Bm, g = "", xr = sc.xr, yr = sc.yr, xt = sc.xt, yt = sc.yt;
  var pw = w - L - sc.R, sx = pw / (xr[1] - xr[0]), sy = ph / (yr[1] - yr[0]);
  function X(v) { return (L + (v - xr[0]) * sx).toFixed(1); } function Y(v) { return (T + ph - (v - yr[0]) * sy).toFixed(1); }
  g += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="var(--plot-grid)"/>';
  xt.ticks.filter(function (v) { return inside(v, xr); }).forEach(function (v) { g += '<line x1="' + X(v) + '" y1="' + T + '" x2="' + X(v) + '" y2="' + (T + ph) + '" stroke="var(--plot-grid)"/><text class="eleo-tick" x="' + X(v) + '" y="' + (T + ph + 13) + '" text-anchor="middle">' + fmt(v, xt.decimals) + "</text>"; });
  yt.ticks.filter(function (v) { return inside(v, yr); }).forEach(function (v) { g += '<line x1="' + L + '" y1="' + Y(v) + '" x2="' + (L + pw) + '" y2="' + Y(v) + '" stroke="var(--plot-grid)"/><text class="eleo-tick" x="' + (L - 6) + '" y="' + Y(v) + '" dy="3" text-anchor="end">' + fmt(v, yt.decimals) + "</text>"; });
  if (xr[0] < 0 && xr[1] > 0) g += '<line x1="' + X(0) + '" y1="' + T + '" x2="' + X(0) + '" y2="' + (T + ph) + '" stroke="var(--plot-axis)"/>';
  if (yr[0] < 0 && yr[1] > 0) g += '<line x1="' + L + '" y1="' + Y(0) + '" x2="' + (L + pw) + '" y2="' + Y(0) + '" stroke="var(--plot-axis)"/>';
  /* The series in data coordinates: px = M * data, inside a viewport that clips at the plot area. */
  var M = [sx, 0, 0, -sy, -xr[0] * sx, ph + yr[0] * sy].map(String);
  g += '<svg x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"><g transform="matrix(' + M.join(" ") + ')">';
  series.forEach(function (s) { g += seriesMarkup(s, panel); });
  return g + "</g></svg>";
}
function typedCurve(o) {
  var W = o.width || 460, H = o.height || 260, x = o.x || {}, y = o.y || {};
  var lab = function (a) { return esc(a.label || "") + (a.unit ? ", " + esc(a.unit) : ""); };
  var labels = function (top) { return '<text class="eleo-tick" x="' + (W - sc.R) + '" y="' + (H - 4) + '" text-anchor="end">' + lab(x) + '</text><text class="eleo-tick" x="4" y="' + top + '">' + lab(y) + "</text>"; };
  var sc, g = "";
  if (o.panels) {
    /* A grid of plots on one scale: the title above each, the axis labels once for the whole figure. */
    var panels = o.panels, n = panels.length, cols = Math.max(1, Math.min(n || 1, Math.floor(+o.columns) || n || 1)), rows = Math.max(1, Math.ceil(n / cols));
    var top = 14, cw = W / cols, ch = (H - top) / rows, T = 22;
    sc = scales(o, panels.map(function (p) { return p.series || []; }));
    panels.forEach(function (p, i) {
      var cx = (i % cols) * cw, cy = top + Math.floor(i / cols) * ch;
      g += '<g transform="translate(' + +cx.toFixed(2) + " " + +cy.toFixed(2) + ')">' + (p.title ? '<text class="eleo-tick" x="46" y="' + (T - 6) + '">' + esc(p.title) + "</text>" : "") + plotCell(sc, p.series || [], cw, ch, T, true) + "</g>";
    });
    return svg(W, H, g + labels(10), lab(y) + " against " + lab(x) + " plot");
  }
  sc = scales(o, [o.series]);
  g = plotCell(sc, o.series, W, H, 14, false) + labels(10);
  return svg(W, H, g, lab(y) + " against " + lab(x) + " plot");
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
  if (o.series || o.panels) return typedCurve(o);
  var a = curveAdapters[Object.prototype.hasOwnProperty.call(curveAdapters, o.kind || "mtf") ? o.kind || "mtf" : "chromaticFocus"](data(o));
  return typedCurve({ series: a.series, x: a.x, y: a.y, width: o.width, height: o.height });
}
