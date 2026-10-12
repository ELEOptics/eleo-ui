import { idx, svg, esc } from "./common.js";
import { scales, plotCell, PLOT_L, PLOT_B } from "./curve.js";

var GAP = 0.5, FILL = 0.8, MIN_BAND_PX = 14, TOP = 14, KEY_LINE = 14;

/* Signed grouped bars in curve's frame (ADR-0001: roles and indexes, no colors). Category k occupies x in [k, k + 1] in data units;
   bars fill 80 % of it, split among the series; `total` appends a group of per-series sums after a half-band gap.
   Each bar is a <rect> in the data-space group with y = min(0, v) and height = |v|, so the transform inverts to the value. */
export function bars(o) {
  o = o || {};
  var cats = o.categories || [], series = o.series || [], y = o.y || {}, W = o.width || 460, H = o.height || 260, m = series.length;
  series.forEach(function (s) {
    if (s === null || typeof s !== "object") throw new TypeError("bars: each series must be an object");
    var i = s.index === undefined ? 0 : s.index;
    if (typeof i !== "number" || !isFinite(i) || Math.floor(i) !== i || i < 0) throw new TypeError("bars: index must be a non-negative integer");
  });
  /* A value that is not a finite number is missing: no bar, no share of the sum or the range. */
  var num = function (v) { return typeof v === "number" && isFinite(v); };
  var val = function (v) { return num(v) ? v : 0; };
  var hasTotal = o.total !== undefined && o.total !== null, n = cats.length;
  var sums = series.map(function (s) { return cats.reduce(function (a, _, c) { return a + val((s.values || [])[c]); }, 0); });
  var span = hasTotal ? n + GAP + 1 : n;
  var all = [0].concat(hasTotal ? sums : []);
  series.forEach(function (s) { cats.forEach(function (_, c) { all.push(val((s.values || [])[c])); }); });
  var sc = scales({ x: { range: [0, span], ticks: [] }, y: y }, [[{ points: all.map(function (v) { return [0, v]; }) }]], false);
  /* The key row starts a new line when an entry would pass the frame's right edge; each extra line takes KEY_LINE px from the frame, down to a frame TOP + PLOT_B + 1 px tall; past that the row runs on. */
  var maxRow = Math.max(0, Math.floor((H - TOP - PLOT_B - 1) / KEY_LINE));
  var keyed = series.filter(function (s) { return s.label; }), kx = PLOT_L, row = 0, place = [];
  keyed.forEach(function (s) {
    var wd = 12 + 6 * Array.from(String(s.label)).length;
    if (row < maxRow && kx > PLOT_L && kx + wd > W - sc.R) { row++; kx = PLOT_L; }
    place.push([kx, row]);
    kx += wd + 10;
  });
  var Hf = H - KEY_LINE * row;
  var rects = "";
  function bar(x0, s, j, v) {
    if (!num(v)) return;
    var w = FILL / m;
    rects += '<rect x="' + +(x0 + (1 - FILL) / 2 + j * w).toFixed(9) + '" y="' + +Math.min(0, v).toFixed(12) + '" width="' + +w.toFixed(9) + '" height="' + +Math.abs(v).toFixed(12) + '" fill="' + idx(s.index || 0) + '"/>';
  }
  cats.forEach(function (_, c) { series.forEach(function (s, j) { bar(c, s, j, (s.values || [])[c]); }); });
  if (hasTotal) series.forEach(function (s, j) { bar(n + GAP, s, j, sums[j]); });
  var g = plotCell(sc, [], W, Hf, TOP, false, rects);
  /* Category labels in px at each band centre, every k-th when a band is under 14 px; the total's label is always drawn. */
  var pw = W - PLOT_L - sc.R, px = pw / span, ph = Hf - TOP - PLOT_B, step = Math.max(1, Math.ceil(MIN_BAND_PX / px));
  var label = function (k, t) { return '<text class="eleo-tick" x="' + (PLOT_L + (k + 0.5) * px).toFixed(1) + '" y="' + (TOP + ph + 13) + '" text-anchor="middle">' + esc(t) + "</text>"; };
  cats.forEach(function (t, c) { if (c % step === 0) g += label(c, t); });
  if (hasTotal) g += label(n + GAP, o.total);
  var lab = function (a) { return esc(a.label || "") + (a.unit ? ", " + esc(a.unit) : ""); };
  g += '<text class="eleo-tick" x="4" y="10">' + lab(y) + "</text>";
  /* The key row: a swatch and the label of each series that has one, on lines from the frame's bottom edge down. */
  keyed.forEach(function (s, k) {
    var ky = Hf - 12 + KEY_LINE * place[k][1];
    g += '<rect x="' + place[k][0] + '" y="' + ky + '" width="8" height="8" fill="' + idx(s.index || 0) + '"/><text class="eleo-tick" x="' + (place[k][0] + 12) + '" y="' + (ky + 8) + '">' + esc(s.label) + "</text>";
  });
  return svg(W, H, g, lab(y) + " by category bar plot");
}
