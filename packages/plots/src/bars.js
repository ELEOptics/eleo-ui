import { idx, svg, esc } from "./common.js";
import { scales, plotCell, limitBody } from "./curve.js";
import { frameText, frameOf } from "./scale.js";
import { checkLimits } from "./limits.js";
import { keyLayout, keyMarkup } from "./key.js";

var GAP = 0.5, FILL = 0.8;
var r2 = function (v) { return +v.toFixed(2); };

/* Signed grouped bars in curve's frame (ADR-0001: roles and indexes, no colors; text, margins and the key to ADR-0003, in units of the text size t(F) of the plot frame's width F). Category k occupies x in [k, k + 1] in data units;
   bars fill 80 % of it, split among the series; `total` appends a group of per-series sums after a half-band gap.
   Each bar is a <rect> in the data-space group with y = min(0, v) and height = |v|, so the transform inverts to the value. */
export function bars(o) {
  o = o || {};
  var cats = o.categories || [], series = o.series || [], y = o.y || {}, W = o.width || 460, H = o.height || Math.round(W * 260 / 460), m = series.length;
  series.forEach(function (s) {
    if (s === null || typeof s !== "object") throw new TypeError("bars: each series must be an object");
    var i = s.index === undefined ? 0 : s.index;
    if (typeof i !== "number" || !isFinite(i) || Math.floor(i) !== i || i < 0) throw new TypeError("bars: index must be a non-negative integer");
  });
  /* y limits only: the same look as curve's (limits.js); a category axis has no x value to draw at. */
  var lim = checkLimits(o.limits, "bars");
  lim.forEach(function (l) { if (l.axis === "x") throw new TypeError("bars: x limits are not supported"); });
  /* A value that is not a finite number is missing: no bar, no share of the sum or the range. */
  var num = function (v) { return typeof v === "number" && isFinite(v); };
  var val = function (v) { return num(v) ? v : 0; };
  var hasTotal = o.total !== undefined && o.total !== null, n = cats.length;
  var sums = series.map(function (s) { return cats.reduce(function (a, _, c) { return a + val((s.values || [])[c]); }, 0); });
  var span = hasTotal ? n + GAP + 1 : n;
  var all = [0].concat(hasTotal ? sums : []);
  series.forEach(function (s) { cats.forEach(function (_, c) { all.push(val((s.values || [])[c])); }); });
  var sc = scales({ x: { range: [0, span], ticks: [] }, y: y, limits: lim }, [[{ points: all.map(function (v) { return [0, v]; }) }]], false);
  /* ADR-0003's margins in text units, as curve's: 4.6 left, 3.6 bottom, 2.6 top, the right one from the ticks (none here). */
  var F = frameOf(W, 4.6 + sc.Rt), t = frameText(F), L = r2(4.6 * t), T = r2(2.6 * t), Bm = 3.6 * t, R = sc.Rt * t, KEY_LINE = 1.4 * t, MIN_BAND_PX = 1.4 * t;
  var ts = ' style="font-size:' + +t.toFixed(3) + 'px"';
  /* The key row starts a new line when an entry would pass the frame's right edge; each extra line takes KEY_LINE from the frame, down to a frame 1 px tall; past that the row runs on. */
  var maxRow = Math.max(0, Math.floor((H - T - Bm - 1) / KEY_LINE));
  var keyed = series.filter(function (s) { return s.label; }).map(function (s) { return { label: s.label, index: s.index || 0 }; });
  var kl = keyLayout(keyed, t, { L: L, R: W - R, maxRow: maxRow }), row = kl.rows ? kl.rows - 1 : 0;
  var Hf = r2(H - KEY_LINE * row);
  var rects = "";
  function bar(x0, s, j, v) {
    if (!num(v)) return;
    var w = FILL / m;
    rects += '<rect x="' + +(x0 + (1 - FILL) / 2 + j * w).toFixed(9) + '" y="' + +Math.min(0, v).toFixed(12) + '" width="' + +w.toFixed(9) + '" height="' + +Math.abs(v).toFixed(12) + '" fill="' + idx(s.index || 0) + '"/>';
  }
  cats.forEach(function (_, c) { series.forEach(function (s, j) { bar(c, s, j, (s.values || [])[c]); }); });
  if (hasTotal) series.forEach(function (s, j) { bar(n + GAP, s, j, sums[j]); });
  /* Category labels in px at each band centre, every k-th when a band is under 1.4 text units; the total's label is always drawn. */
  var pw = r2(Math.max(1, W - L - R)), px = pw / span, ph = r2(Math.max(1, Hf - T - Bm)), step = Math.max(1, Math.ceil(MIN_BAND_PX / px));
  /* Solid dividers, frame decoration in px outside the data group, drawn before plotCell so they sit with the gridlines under the data and the limit labels: at every step-th boundary between category groups (each separates labelled groups) and mid-gap before the total. */
  var cuts = cats.map(function (_, c) { return c + 1; }).slice(0, -1).filter(function (k) { return k % step === 0; });
  if (hasTotal && n > 0) cuts.push(n + GAP / 2);
  var g = "";
  cuts.forEach(function (k) {
    var dx = (L + k * px).toFixed(1);
    g += '<line x1="' + dx + '" y1="' + T + '" x2="' + dx + '" y2="' + r2(T + ph) + '" stroke="var(--plot-grid)"/>';
  });
  g += plotCell(sc, [], W, Hf, T, false, limitBody(lim, sc, rects), lim, o.grid === false ? { L: L, B: Bm, R: R, t: t, grid: false } : { L: L, B: Bm, R: R, t: t });
  var label = function (k, txt) { return '<text class="eleo-tick" x="' + (L + (k + 0.5) * px).toFixed(1) + '" y="' + r2(T + ph + 1.3 * t) + '" text-anchor="middle"' + ts + '>' + esc(txt) + "</text>"; };
  cats.forEach(function (txt, c) { if (c % step === 0) g += label(c, txt); });
  if (hasTotal) g += label(n + GAP, o.total);
  var lab = function (a) { return esc(a.label || "") + (a.unit ? ", " + esc(a.unit) : ""); };
  g += '<text class="eleo-tick" x="' + r2(0.4 * t) + '" y="' + r2(t) + '"' + ts + '>' + lab(y) + "</text>";
  /* The key row: a swatch and the label of each series that has one, on lines from the frame's bottom edge down. */
  g += keyMarkup(kl.places, keyed, t, Hf - 1.2 * t);
  return svg(W, H, g, lab(y) + " by category bar plot");
}
