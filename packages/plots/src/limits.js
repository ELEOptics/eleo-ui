import { esc, NS } from "./common.js";

/* Limit lines and bands, shared by curve and bars so the look matches (ADR-0001: a role's style, never a color).
   A limit is { x | y: number | [lo, hi], label? }: a number draws a line across the plot, a pair a band. */
var isNum = function (v) { return typeof v === "number" && isFinite(v); };

/* The limit list, checked and normalized to { axis, lo, hi, band, label }. `who` names the renderer in the error. */
export function checkLimits(limits, who) {
  if (limits === undefined || limits === null) return [];
  if (!Array.isArray(limits)) throw new TypeError(who + ": limits must be an array");
  return limits.map(function (l) {
    if (l === null || typeof l !== "object") throw new TypeError(who + ": each limit must be an object");
    var hasX = l.x !== undefined, hasY = l.y !== undefined;
    if (hasX === hasY) throw new TypeError(who + ": a limit takes exactly one of x and y");
    var axis = hasX ? "x" : "y", v = l[axis];
    var band = Array.isArray(v);
    if (band ? !(v.length === 2 && isNum(v[0]) && isNum(v[1])) : !isNum(v)) throw new TypeError(who + ": a limit is a finite number or a pair of them");
    if (l.label !== undefined && typeof l.label !== "string") throw new TypeError(who + ": a limit label must be a string");
    return { axis: axis, lo: band ? Math.min(v[0], v[1]) : v, hi: band ? Math.max(v[0], v[1]) : v, band: band, label: l.label };
  });
}
/* The values of one axis the range must contain: an auto range folds these in. */
export function limitValues(norm, axis) {
  var out = [];
  norm.forEach(function (l) { if (l.axis === axis) out.push(l.lo, l.hi); });
  return out;
}
/* Markup in data units for the series group, given the ranges: bands for under the series, lines for over them. `stroke` is the line's attributes (the `limit` role's style). */
export function limitMarks(norm, xr, yr, stroke) {
  var under = "", over = "";
  norm.forEach(function (l) {
    var h = l.axis === "y", span = h ? xr : yr;
    if (l.band) {
      under += h ? '<rect class="eleo-limit" x="' + span[0] + '" y="' + l.lo + '" width="' + (span[1] - span[0]) + '" height="' + (l.hi - l.lo) + '"' : '<rect class="eleo-limit" x="' + l.lo + '" y="' + span[0] + '" width="' + (l.hi - l.lo) + '" height="' + (span[1] - span[0]) + '"';
      under += ' fill="var(--ink)" fill-opacity="0.06" stroke="none"/>';
    } else {
      over += '<line class="eleo-limit" x1="' + (h ? span[0] : l.lo) + '" y1="' + (h ? l.lo : span[0]) + '" x2="' + (h ? span[1] : l.lo) + '" y2="' + (h ? l.lo : span[1]) + '" ' + stroke + " " + NS + "/>";
    }
  });
  return { under: under, over: over };
}
/* The labels as px-space text outside the data group: a y limit's at the plot's right end above its line (a band's at its upper edge), an x limit's at the top beside its line. `px` is { X, Y, right, top }, the cell's data to px functions and edges. A limit outside the range has no label. */
export function limitLabels(norm, xr, yr, px) {
  var g = "";
  norm.forEach(function (l) {
    if (!l.label) return;
    if (l.axis === "y") {
      if (l.hi < yr[0] || l.hi > yr[1]) return;
      g += '<text class="eleo-tick" x="' + (px.right - 4) + '" y="' + px.Y(l.hi) + '" dy="-3" text-anchor="end">' + esc(l.label) + "</text>";
    } else {
      if (l.lo < xr[0] || l.lo > xr[1]) return;
      g += '<text class="eleo-tick" x="' + (+px.X(l.lo) + 4) + '" y="' + (px.top + 10) + '">' + esc(l.label) + "</text>";
    }
  });
  return g;
}
