import { idx, svg, esc, NS, drawn } from "./common.js";
import { data } from "./data.js";
import { fmt } from "./color.js";
import { niceTicks, niceRange } from "./axis.js";
import { frameText, frameWeight, frameOf, CURVE_MARGINS } from "./scale.js";
import { checkLimits, limitValues, limitMarks, limitLabels } from "./limits.js";
import { keyLayout, keyMarkup, cornerBox, KEY_AT } from "./key.js";
import { clipPolyline, dashOffset } from "./clip.js";

/* Role to style (ADR-0001, weights ADR-0003). Callers give a role and an index, never a color, font or stroke width; `wt` is the series stroke weight, frameWeight(F). A sagittal dash is in units of `wt` (4 wt, 2.5 wt; CR #726). */
function roleStyle(s, wt) {
  var r = s.role, i = s.index === undefined ? 0 : s.index;
  if (r !== undefined && r !== "tangential" && r !== "sagittal" && r !== "reference" && r !== "limit") throw new TypeError('curve: unknown role "' + r + '"');
  if (typeof i !== "number" || !isFinite(i) || Math.floor(i) !== i || i < 0) throw new TypeError("curve: index must be a non-negative integer");
  if (r === "reference") return { col: "var(--ink)", dash: "1 3", w: wt, cap: "round" };
  if (r === "limit") return { col: "var(--ink)", dash: "6 3 1 3", w: wt, cap: "butt", fill: "var(--ink)", fillOpacity: 0.06 };
  return { col: idx(i), dash: r === "sagittal" ? +(4 * wt).toFixed(3) + " " + +(2.5 * wt).toFixed(3) : "", w: wt, cap: "round" };
}
var inside = function (v, r) { return v >= r[0] && v <= r[1]; };
/* An axis range: the given one, else the nice range of the data; never empty or reversed. */
function axisRange(a, vals) {
  var r = Array.isArray(a.range) ? a.range.map(Number) : null;
  /* A range that is not two finite numbers is dropped: the axis falls back to the data. */
  if (r && !(r.length >= 2 && isFinite(r[0]) && isFinite(r[1]))) r = null;
  if (!r) { var lo = Infinity, hi = -Infinity; vals.forEach(function (v) { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); r = lo <= hi ? [lo, hi] : [0, 1]; if (lo < hi) { var nr = niceRange(lo, hi, 6); r = [nr.lo, nr.hi]; } }
  return r[0] < r[1] ? [r[0], r[1]] : [r[0] - 1, r[0] + 1];
}
/* A view range (`view.x`, `view.y`): two finite increasing numbers, else null and the axis keeps its own range. */
function viewRange(v) {
  var r = Array.isArray(v) ? v.map(Number) : null;
  return r && r.length >= 2 && isFinite(r[0]) && isFinite(r[1]) && r[0] < r[1] ? [r[0], r[1]] : null;
}
export function axisTicks(a, r) {
  if (!a.ticks) return niceTicks(r[0], r[1], 6);
  /* The fewest decimals at which every tick prints exactly (within float noise). */
  var ts = a.ticks.map(Number), d = 0;
  while (d < 20 && !ts.every(function (v) { return Math.abs(Number(v.toFixed(d)) - v) <= 1e-9 * Math.abs(v); })) d++;
  return { ticks: ts, decimals: d };
}
/* A series as path data in data coordinates: a null entry, or a point with a null or non-finite coordinate, ends the run (and doesn't count toward the range), and the next live point starts a new subpath (a polyline can't break). A run of one point is a dot: M x,y h0 under a round cap. */
function seriesPath(pts) {
  var d = "", run = [];
  function flush() { if (run.length) d += (d ? " " : "") + "M" + run.join(" L") + (run.length === 1 ? " h0" : ""); run = []; }
  pts.forEach(function (p) { if (!drawn(p)) flush(); else run.push(String(+p[0]) + "," + String(+p[1])); });
  flush();
  return d;
}
/* CR #984: with a view a series is cut to the plot area plus 32 px. The cut is in px (the axes scale differently): `z` is { sc, pw, ph }, the ranges and the plot area, and px = ((x - xr0) * sx, ph - (y - yr0) * sy) as the group's matrix has it. Each run (a panel's path run, or a single plot's whole polyline) gives its pieces { from, points }: `from` is the uncut index of the piece's first point within its run, and the points are data units, a data point being the caller's own (not a round trip) and a cut point mapped back. 31.9 px, 0.1 short of 32, so the rounding of the written points never leaves a cut end past 32. */
function cutPieces(run, z) {
  var xr = z.sc.xr, yr = z.sc.yr, sx = z.pw / (xr[1] - xr[0]), sy = z.ph / (yr[1] - yr[0]), m = 31.9, rect = [-m, -m, z.pw + m, z.ph + m];
  var px = run.map(function (p) { return [(p[0] - xr[0]) * sx, z.ph - (p[1] - yr[0]) * sy]; }), at = new Map();
  px.forEach(function (q, i) { at.set(q, run[i]); });
  if (px.length === 1) return px[0][0] >= rect[0] && px[0][0] <= rect[2] && px[0][1] >= rect[1] && px[0][1] <= rect[3] ? [{ from: 0, points: [run[0]] }] : [];
  return clipPolyline(px, rect).map(function (c) {
    return { from: c.from, cut: c.cut, points: c.points.map(function (q) { return at.get(q) || [xr[0] + q[0] / sx, yr[0] + (z.ph - q[1]) / sy]; }) };
  });
}
/* `si` is the series index and `pi` the panel index (panels only); they, the role and the label go on the mark as data-* for hover and click. `z` (zoomed only, see cutPieces) cuts the series: one mark per piece, each carrying `data-from` (the piece's first uncut index in the mark, omitted when 0) and otherwise the same attributes; a series wholly outside draws nothing. */
function seriesMarkup(s, panel, wt, si, pi, z) {
  var st = roleStyle(s, wt), pts = s.points || [];
  var ids = si === undefined ? "" : ' data-series="' + si + '"' + (s.role !== undefined ? ' data-role="' + s.role + '"' : "") + (s.label !== undefined && s.label !== null ? ' data-label="' + esc(s.label) + '"' : "") + (panel && pi !== undefined ? ' data-panel="' + pi + '"' : "");
  var head = ' fill="none" stroke="' + st.col + '" stroke-width="' + st.w + '" stroke-linecap="' + st.cap + '" stroke-linejoin="round"' + (st.dash ? ' stroke-dasharray="' + st.dash + '"' : ""), attrs = head + " " + NS + "/>";
  var num = function (p) { return String(+p[0]) + "," + String(+p[1]); };
  if (!z) {
    if (panel) return '<path d="' + seriesPath(pts) + '"' + ids + attrs;
    return '<polyline points="' + pts.map(num).join(" ") + '"' + ids + attrs;
  }
  var out = "", base = 0;
  function emit(piece, off) {
    var from = off + piece.from;
    out += (panel ? '<path d="M' + piece.points.map(num).join(" L") + (piece.points.length === 1 ? " h0" : "") + '"' : '<polyline points="' + piece.points.map(num).join(" ") + '"') + ids + (from ? ' data-from="' + from + '"' : "") + head + dashOffset(st.dash, piece.cut) + " " + NS + "/>";
  }
  if (panel) {
    var runs = [], run = [];
    pts.forEach(function (p) { if (!drawn(p)) { if (run.length) runs.push(run); run = []; } else run.push([+p[0], +p[1]]); });
    if (run.length) runs.push(run);
    /* data-from of a piece is its uncut index across the path's runs: the finite points of the runs before it, plus its index in its own run. */
    runs.forEach(function (r) { cutPieces(r, z).forEach(function (c) { emit(c, base); }); base += r.length; });
  } else {
    var all = pts.map(function (p) { return [+p[0], +p[1]]; }).filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
    if (all.length) cutPieces(all, z).forEach(function (c) { emit(c, 0); });
  }
  return out;
}
/* The ranges and ticks, computed once over every series of every panel, and the right margin they need. */
export function scales(o, groups, panel) {
  var all = [].concat.apply([], groups.map(function (g) { return g.map(function (s) { return s.points || []; }); })), x = o.x || {}, y = o.y || {};
  /* Panels leave out the points they don't draw; the single plot counts every point, as it always has, so its polyline stays inside the range. */
  var live = function (p) { return !panel || drawn(p); };
  /* `o.limits`, when given, is checkLimits' output: an auto range contains every limit. */
  var lim = o.limits || [];
  var xr = axisRange(x, [].concat.apply(limitValues(lim, "x"), all.map(function (p) { return p.filter(live).map(function (q) { return q[0]; }); })));
  var yr = axisRange(y, [].concat.apply(limitValues(lim, "y"), all.map(function (p) { return p.filter(live).map(function (q) { return q[1]; }); })));
  /* `o.view` overrides the ranges (every panel shares it); the ticks of an overridden axis are the nice ticks of the view, not the caller's `ticks`. */
  var vw = o.view || {}, vx = viewRange(vw.x), vy = viewRange(vw.y);
  if (vx) xr = vx;
  if (vy) yr = vy;
  var xt = axisTicks(vx ? {} : x, xr), yt = axisTicks(vy ? {} : y, yr);
  /* The right margin Rt, in text units: 1.2, or half the rightmost shown x label's width (0.6 em a character) when that is more. */
  var shown = xt.ticks.filter(function (v) { return inside(v, xr); }), Rt = 1.2, n = 0;
  if (shown.length) { n = Array.from(fmt(Math.max.apply(null, shown), xt.decimals)).length; Rt = Math.max(Rt, 0.3 * n); }
  return { xr: xr, yr: yr, xt: xt, yt: yt, Rt: Rt };
}
var r2 = function (v) { return +v.toFixed(2); };
/* The plot area's size in px for a cell of w by h, its top margin T and margins mg: plotCell's, shared with the cut. */
function plotArea(w, h, T, mg) { return { pw: r2(Math.max(1, w - r2(mg.L) - mg.R)), ph: r2(Math.max(1, h - r2(T) - mg.B)) }; }
/* One plot: the frame, ticks, zero lines and series, in a box of w by h, drawn at 0,0; panels place it with a translate. */
/* `body`, when given, is the series group's markup in data units (bars draw rects); `series` is then unused. An x axis with `ticks: []` draws none. */
/* `limits`, when given, is checkLimits' output: their labels are drawn in px over the frame (the marks belong in `body`, see limitBody). */
/* `mg` is the margins in px: { L, B, R, t? }, required: each renderer passes its own. `grid: false` draws the tick text without the grid lines (the frame and the zero axes stay). With `t`, every text gets that inline size and its offsets scale with it (10 px is the class size). The frame is at least 1 px each way. */
export function plotCell(sc, series, w, h, T, panel, body, limits, mg) {
  /* The frame is rounded to 2 decimals once, here: everything below derives from these, so the markup is small and doesn't depend on Math.cbrt's last bits. */
  T = r2(T);
  var L = r2(mg.L), Bm = mg.B, ph = plotArea(w, h, T, mg).ph, g = "", xr = sc.xr, yr = sc.yr, xt = sc.xt, yt = sc.yt;
  var grid = mg.grid !== false, u = mg.t ? mg.t / 10 : 1, ts = mg.t ? ' style="font-size:' + +mg.t.toFixed(3) + 'px"' : "", o = function (v) { return +(v * u).toFixed(2); };
  var pw = plotArea(w, h, T, mg).pw, sx = pw / (xr[1] - xr[0]), sy = ph / (yr[1] - yr[0]);
  function X(v) { return (L + (v - xr[0]) * sx).toFixed(1); } function Y(v) { return (T + ph - (v - yr[0]) * sy).toFixed(1); }
  var fr = 'x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"', Bt = r2(T + ph), Rt = r2(L + pw);
  g += '<rect ' + fr + ' fill="none" stroke="var(--plot-grid)"/>';
  xt.ticks.filter(function (v) { return inside(v, xr); }).forEach(function (v) { g += (grid ? '<line x1="' + X(v) + '" y1="' + T + '" x2="' + X(v) + '" y2="' + Bt + '" stroke="var(--plot-grid)"/>' : "") + '<text class="eleo-tick" x="' + X(v) + '" y="' + r2(T + ph + o(13)) + '" text-anchor="middle"' + ts + '>' + fmt(v, xt.decimals) + "</text>"; });
  yt.ticks.filter(function (v) { return inside(v, yr); }).forEach(function (v) { g += (grid ? '<line x1="' + L + '" y1="' + Y(v) + '" x2="' + Rt + '" y2="' + Y(v) + '" stroke="var(--plot-grid)"/>' : "") + '<text class="eleo-tick" x="' + r2(L - o(6)) + '" y="' + Y(v) + '" dy="' + o(3) + '" text-anchor="end"' + ts + '>' + fmt(v, yt.decimals) + "</text>"; });
  if (xr[0] < 0 && xr[1] > 0) g += '<line x1="' + X(0) + '" y1="' + T + '" x2="' + X(0) + '" y2="' + Bt + '" stroke="var(--plot-axis)"/>';
  if (yr[0] < 0 && yr[1] > 0) g += '<line x1="' + L + '" y1="' + Y(0) + '" x2="' + Rt + '" y2="' + Y(0) + '" stroke="var(--plot-axis)"/>';
  /* The series in data coordinates: px = M * data, inside a viewport that clips at the plot area. */
  var M = [sx, 0, 0, -sy, -xr[0] * sx, ph + yr[0] * sy].map(String);
  g += '<svg ' + fr + '><g transform="matrix(' + M.join(" ") + ')">';
  if (body !== undefined) g += body; else series.forEach(function (s) { g += seriesMarkup(s, panel); });
  g += "</g></svg>";
  if (limits) g += limitLabels(limits, xr, yr, { X: X, Y: Y, right: Rt, top: T }, mg.t).replace(/<text [^>]*/g, function (m) { return m + ts; });
  return g;
}
/* The `limit` role's style, as attributes for a line and for a band; the `limits` option's marks stay 1 px. */
export function limitStyle() {
  var st = roleStyle({ role: "limit" }, 1);
  return { line: 'fill="none" stroke="' + st.col + '" stroke-width="' + st.w + '" stroke-linecap="' + st.cap + '" stroke-dasharray="' + st.dash + '"', band: 'fill="' + st.fill + '" fill-opacity="' + st.fillOpacity + '" stroke="none"' };
}
/* A series group's markup with the limits: bands under `inner`, lines over it. */
export function limitBody(limits, sc, inner) {
  var m = limitMarks(limits, sc.xr, sc.yr, limitStyle());
  return m.under + inner + m.over;
}
/* ADR-0003's margins in text units (scale.js CURVE_MARGINS: left, bottom, top), the right one from the ticks. The cell's width gives the frame width F, which gives the text size and the series weight. */
function curveMargins(sc, w) {
  var F = frameOf(w, CURVE_MARGINS.L + sc.Rt), t = frameText(F);
  return { L: CURVE_MARGINS.L * t, B: CURVE_MARGINS.B * t, R: sc.Rt * t, t: t, wt: +frameWeight(F).toFixed(3) };
}
/* The key's entries: `key` when given ({ label, role?, index? }), else one per distinct series `label` (the first use's role and index). A line swatch in the role's dash. Without either: none. */
function keyEntries(o) {
  var src = o.key;
  if (src !== undefined && !Array.isArray(src)) throw new TypeError("curve: key must be an array of entries");
  if (!src) {
    var seen = {};
    src = [];
    (o.panels ? [].concat.apply([], o.panels.map(function (p) { return p.series || []; })) : o.series).forEach(function (s) {
      if (s.label && !Object.prototype.hasOwnProperty.call(seen, s.label)) { seen[s.label] = 1; src.push(s); }
    });
  }
  return src.map(function (e) {
    if (e === null || typeof e !== "object" || typeof e.label !== "string") throw new TypeError("curve: a key entry needs a string label");
    var st = roleStyle(e, 1);
    return { label: String(e.label), index: e.index === undefined ? 0 : e.index, col: st.col, kind: "line", dash: st.dash, cap: st.cap, src: e };
  });
}
/* The entries (cap kept) with each swatch's dash in units of the swatch's own stroke, 0.15 t (as keyMarkup draws it). */
function keyDrawn(ents, t) {
  return ents.map(function (e) { return { label: e.label, index: e.index, col: e.col, kind: e.kind, dash: roleStyle(e.src, r2(0.15 * t)).dash, cap: e.cap }; });
}
/* A corner key over the plot area of the cell, which it never resizes (cornerBox). */
function cornerKey(ents, at, t, w, h, T, mg) {
  var L = r2(mg.L);
  return cornerBox(keyDrawn(ents, t), at, t, L, T, r2(Math.max(1, w - L - mg.R)), r2(Math.max(1, h - T - mg.B)));
}
function typedCurve(o) {
  var W = o.width || 460, H0 = o.height || Math.round(W * 260 / 460), x = o.x || {}, y = o.y || {};
  var ents = keyEntries(o), at = o.keyAt === undefined ? "below" : o.keyAt;
  if (KEY_AT.indexOf(at) < 0) throw new TypeError('curve: unknown keyAt "' + at + '"');
  var corner = ents.length > 0 && at !== "below";
  var Hf = H0, Hs = H0, below = "";
  /* The key under the x label, from the margins' text size t: rows of 1.4 t after a 0.2 t gap. With a `height` the frame gives up the rows and the gap; without, the SVG grows by them, rounded to a whole px. `fixed` is what the frame and margins take above the key. */
  function placeBelow(t, L, R, fixed) {
    var line = 1.4 * t, gap = 0.2 * t, maxRow = o.height ? Math.max(0, Math.floor((H0 - fixed - gap - 1) / line) - 1) : 1000;
    var kl = keyLayout(ents, t, { L: L, R: R, maxRow: maxRow });
    Hf = o.height ? r2(H0 - line * kl.rows - gap) : H0;
    Hs = o.height ? H0 : Math.round(H0 + line * kl.rows + gap);
    /* The key's top is 0.2 t under the frame, so its first baseline (0.8 t down) is 1.4 t under the x label's (0.4 t above the frame). */
    below = keyMarkup(kl.places, keyDrawn(ents, t), t, Hf + gap, { mark: true });
  }
  var lab = function (a) { return esc(a.label || "") + (a.unit ? ", " + esc(a.unit) : ""); };
  var labels = function (mg) { return '<text class="eleo-tick" x="' + r2(W - mg.R) + '" y="' + r2(Hf - 0.4 * mg.t) + '" text-anchor="end" style="font-size:' + +mg.t.toFixed(3) + 'px">' + lab(x) + '</text><text class="eleo-tick" x="' + r2(0.4 * mg.t) + '" y="' + r2(mg.t) + '" style="font-size:' + +mg.t.toFixed(3) + 'px">' + lab(y) + "</text>"; };
  var sc, g = "", lim = checkLimits(o.limits, "curve");
  /* A valid view axis zooms: the series are cut to the plot area plus 32 px (cutPieces). */
  var zoomed = !!(o.view && (viewRange(o.view.x) || viewRange(o.view.y)));
  var cell = function (series, w, h, T, panel, mg, pi) { var z = zoomed && Object.assign({ sc: sc }, plotArea(w, h, T, mg)); return plotCell(sc, series, w, h, T, panel, limitBody(lim, sc, series.map(function (s, si) { return seriesMarkup(s, panel, mg.wt, si, pi, z); }).join("")), lim, mg) + (corner ? cornerKey(ents, at, mg.t, w, h, T, mg) : ""); };
  if (o.panels) {
    /* A grid of plots on one scale: the title above each, the axis labels once for the whole figure. */
    var panels = o.panels, n = panels.length, cols = Math.max(1, Math.min(n || 1, Math.floor(+o.columns) || n || 1)), rows = Math.max(1, Math.ceil(n / cols));
    var cw = W / cols;
    sc = scales({ x: x, y: y, limits: lim, view: o.view }, panels.map(function (p) { return p.series || []; }), true);
    var mg = curveMargins(sc, cw), top = 1.4 * mg.t, T = 2.2 * mg.t;
    mg.grid = o.grid;
    if (ents.length && !corner) placeBelow(mg.t, mg.L, W - mg.R, top + T + mg.B);
    var ch = (Hf - top) / rows;
    panels.forEach(function (p, i) {
      var cx = (i % cols) * cw, cy = top + Math.floor(i / cols) * ch;
      g += '<g transform="translate(' + +cx.toFixed(2) + " " + +cy.toFixed(2) + ')">' + (p.title ? '<text class="eleo-tick" x="' + r2(mg.L) + '" y="' + r2(T - 0.6 * mg.t) + '" style="font-size:' + +mg.t.toFixed(3) + 'px">' + esc(p.title) + "</text>" : "") + cell(p.series || [], cw, ch, T, true, mg, i) + "</g>";
    });
    return svg(W, Hs, g + labels(mg) + below, lab(y) + " against " + lab(x) + " plot");
  }
  sc = scales({ x: x, y: y, limits: lim, view: o.view }, [o.series]);
  var m1 = curveMargins(sc, W);
  m1.grid = o.grid;
  if (ents.length && !corner) placeBelow(m1.t, m1.L, W - m1.R, CURVE_MARGINS.T * m1.t + m1.B);
  g = cell(o.series, W, Hf, CURVE_MARGINS.T * m1.t, false, m1) + labels(m1) + below;
  return svg(W, Hs, g, lab(y) + " against " + lab(x) + " plot");
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
  if (o.limits != null) throw new TypeError("curve: limits need series or panels");
  var a = curveAdapters[Object.prototype.hasOwnProperty.call(curveAdapters, o.kind || "mtf") ? o.kind || "mtf" : "chromaticFocus"](data(o));
  return typedCurve({ series: a.series, x: a.x, y: a.y, width: o.width, height: o.height, grid: o.grid, view: o.view });
}
