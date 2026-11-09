import { idx, esc } from "./common.js";

var r2 = function (v) { return +v.toFixed(2); };

/* The key row shared by the renderers (ADR-0001: swatches take an index and a dash, never a color; ADR-0003: sizes and gaps in text units of t). Two phases, because a renderer sets its frame height from the number of rows before it knows where the key goes.
   An entry is { label, index?, col?, kind?, dash?, cap? } (`col`: the role's colour, which wins over `index`; bars passes none): kind "square" (default), "line" (stroked in `dash`, with `cap` as its stroke-linecap when given) or "dot". */

/* A swatch's width: 0.8 t, and 2 t for a line, so two periods of its dash show (the dash is 6.5 times the stroke, 0.15 t). The label follows 0.4 t after. */
function sw(e, t) { return (e.kind === "line" ? 2 : 0.8) * t; }
/* Where the label starts, from the swatch's left edge (one multiplication, so a square's 1.2 t is exact). */
function off(e, t) { return (e.kind === "line" ? 2.4 : 1.2) * t; }

/* Phase one: rows and places. An entry starts a new line when it would pass x = R (the key's right edge); each line is one row, at most maxRow + 1 of them, and the last one runs on. Returns { rows, places, right } with places[k] = [x, row] and right the widest extent (L when empty). */
export function keyLayout(entries, t, o) {
  var L = o.L, R = o.R, maxRow = o.maxRow, kx = L, row = 0, places = [], right = L;
  entries.forEach(function (e) {
    var wd = off(e, t) + 0.6 * t * Array.from(String(e.label)).length;
    if (row < maxRow && kx > L && kx + wd > R) { row++; kx = L; }
    places.push([kx, row]);
    right = Math.max(right, kx + wd);
    kx += wd + t;
  });
  return { rows: entries.length ? row + 1 : 0, places: places, right: right };
}

/* A swatch's fill: a bare var() colour as the fill attribute; any other (a CSS colour function, such as a glass's relative colour) through style, since a colour function in a presentation attribute is not safe. */
function fillOf(col) { return col.indexOf("var(") === 0 ? ' fill="' + col + '"' : ' style="fill:' + col + '"'; }

/* Phase two: the markup, the first row's top at y, a row every 1.4 t below. `o.mark` puts data-key on each label's <text>. */
export function keyMarkup(places, entries, t, y, o) {
  var mk = o && o.mark ? " data-key" : "", ts = ' style="font-size:' + +t.toFixed(3) + 'px"', g = "";
  entries.forEach(function (e, k) {
    var x = r2(places[k][0]), ky = r2(y + 1.4 * t * places[k][1]), col = e.col || idx(e.index || 0), s = r2(sw(e, t)), kind = e.kind || "square";
    if (kind === "line") g += '<line x1="' + x + '" y1="' + r2(ky + 0.4 * t) + '" x2="' + r2(x + s) + '" y2="' + r2(ky + 0.4 * t) + '" stroke="' + col + '" stroke-width="' + r2(0.15 * t) + '"' + (e.cap ? ' stroke-linecap="' + e.cap + '"' : "") + (e.dash ? ' stroke-dasharray="' + e.dash + '"' : "") + ' fill="none"/>';
    else if (kind === "dot") g += '<circle cx="' + r2(x + 0.4 * t) + '" cy="' + r2(ky + 0.4 * t) + '" r="' + r2(0.3 * t) + '"' + fillOf(col) + "/>";
    else g += '<rect x="' + x + '" y="' + ky + '" width="' + s + '" height="' + s + '"' + fillOf(col) + "/>";
    g += '<text class="eleo-tick"' + mk + ' x="' + r2(places[k][0] + off(e, t)) + '" y="' + r2(ky + 0.8 * t) + '"' + ts + '>' + esc(e.label) + "</text>";
  });
  return g;
}

export var KEY_AT = ["below", "top-left", "top-right", "bottom-left", "bottom-right"];

/* A corner key: a box on --surface (no stroke: a grid-stroked rect reads as a frame) inside the plot area (x0, y0, pw by ph), wrapped at the plot's width whether or not its rows fit the height, the start clamped inside the plot on both axes (a box that fits lies wholly inside, a larger one overruns only the far edges). `at` is one of the four corners; entries are as keyMarkup draws them. */
export function cornerBox(ents, at, t, x0, y0, pw, ph) {
  var pad = 0.4 * t, kl = keyLayout(ents, t, { L: 0, R: Math.max(0, pw - 4 * pad), maxRow: 1000 });
  var bw = r2(kl.right + 2 * pad), bh = r2(1.4 * t * kl.rows + 2 * pad - 0.4 * t);
  var bx = at.slice(-4) === "left" ? x0 + pad : x0 + pw - pad - bw, by = at.slice(0, 3) === "top" ? y0 + pad : y0 + ph - pad - bh;
  bx = Math.max(x0 + pad, bx); by = Math.max(y0 + pad, by);
  var places = kl.places.map(function (p) { return [bx + pad + p[0], p[1]]; });
  return '<rect class="eleo-key" x="' + r2(bx) + '" y="' + r2(by) + '" width="' + bw + '" height="' + bh + '" fill="var(--surface)"/>' + keyMarkup(places, ents, t, by + pad - 0.2 * t, { mark: true });
}
