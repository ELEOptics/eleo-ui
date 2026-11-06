import { idx, esc } from "./common.js";

var r2 = function (v) { return +v.toFixed(2); };

/* The key row shared by the renderers (ADR-0001: swatches take an index and a dash, never a color; ADR-0003: sizes and gaps in text units of t). Two phases, because a renderer sets its frame height from the number of rows before it knows where the key goes.
   An entry is { label, index?, kind?, dash? }: kind "square" (default), "line" (stroked in `dash`) or "dot". */

/* Phase one: rows and places. An entry starts a new line when it would pass x = R (the key's right edge); each line is one row, at most maxRow + 1 of them, and the last one runs on. Returns { rows, places } with places[k] = [x, row]. */
export function keyLayout(entries, t, o) {
  var L = o.L, R = o.R, maxRow = o.maxRow, kx = L, row = 0, places = [];
  entries.forEach(function (e) {
    var wd = 1.2 * t + 0.6 * t * Array.from(String(e.label)).length;
    if (row < maxRow && kx > L && kx + wd > R) { row++; kx = L; }
    places.push([kx, row]);
    kx += wd + t;
  });
  return { rows: entries.length ? row + 1 : 0, places: places };
}

/* Phase two: the markup, the first row's top at y, a row every 1.4 t below. `o.mark` puts data-key on each label's <text>. */
export function keyMarkup(places, entries, t, y, o) {
  var mk = o && o.mark ? " data-key" : "", ts = ' style="font-size:' + +t.toFixed(3) + 'px"', g = "";
  entries.forEach(function (e, k) {
    var x = r2(places[k][0]), ky = r2(y + 1.4 * t * places[k][1]), col = idx(e.index || 0), s = r2(0.8 * t), kind = e.kind || "square";
    if (kind === "line") g += '<line x1="' + x + '" y1="' + r2(ky + 0.4 * t) + '" x2="' + r2(x + s) + '" y2="' + r2(ky + 0.4 * t) + '" stroke="' + col + '" stroke-width="' + r2(0.15 * t) + '"' + (e.dash ? ' stroke-dasharray="' + e.dash + '"' : "") + ' fill="none"/>';
    else if (kind === "dot") g += '<circle cx="' + r2(x + 0.4 * t) + '" cy="' + r2(ky + 0.4 * t) + '" r="' + r2(0.3 * t) + '" fill="' + col + '"/>';
    else g += '<rect x="' + x + '" y="' + ky + '" width="' + s + '" height="' + s + '" fill="' + col + '"/>';
    g += '<text class="eleo-tick"' + mk + ' x="' + r2(places[k][0] + 1.2 * t) + '" y="' + r2(ky + 0.8 * t) + '"' + ts + '>' + esc(e.label) + "</text>";
  });
  return g;
}
