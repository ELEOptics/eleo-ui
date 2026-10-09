// Helpers every renderer shares. One copy, so the field order can't drift between modules.

/* The standard order: field token behind --series-k. Must match the `:root, [data-theme]` block in plots.css. */
export const STANDARD = [1, 7, 8, 3, 4, 6, 2, 5];
export const NS = 'vector-effect="non-scaling-stroke"';
/* Index color: 1..8 direct, 9..16 reuse with a hollow marker (see marker() in color.js). --series-k follows the
   palette; the fallback is the standard order when plots.css is not loaded. */
export function idx(i) { var k = i % 8; return "var(--series-" + (k + 1) + ", var(--field-" + STANDARD[k] + "))"; }
export function svg(w, h, body, label) { return '<svg viewBox="0 0 ' + w + " " + h + '" shape-rendering="geometricPrecision" role="img" aria-label="' + label + '">' + body + "</svg>"; }
/* Text for SVG/HTML: escapes & < > " (safe in element text and in a double-quoted attribute). */
export function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
