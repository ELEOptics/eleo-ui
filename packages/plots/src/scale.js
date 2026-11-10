// The plot scale rule of ADR-0003: text and heavy strokes sized from the drawing width, in px. Pure functions, no DOM.

/* Framed renderers: F is the plot frame's width. Text is 9 px below F_LO, F / 18 up to F_HI (13 px), then the knee. */
export const TEXT_MIN = 9;
export const TEXT_MAX = 13;
export const F_LO = 162;
export const F_HI = 234;
/* layout2D: W is the drawing width. Labels are W / 70 px from W_LO to W_HI, hidden below W_LO. */
export const W_LO = 630;
export const W_HI = 910;
/* spot: the room (text units) left of each panel for its y tick labels, at least this: three characters at 0.6 plus 0.6. */
export const SPOT_LABEL_M = 2.4;

/* Text size in px for a frame of width F. */
export function frameText(F) {
  return F < F_LO ? TEXT_MIN : F <= F_HI ? F / 18 : TEXT_MAX * Math.cbrt(F / F_HI);
}
/* Stroke weight (series, rays, dots) for a frame of width F: 1 up to F_HI, then sqrt(F / F_HI). */
export function frameWeight(F) {
  return F > F_HI ? Math.sqrt(F / F_HI) : 1;
}
/* The frame width F that solves F + m * frameText(F) = W, for margins m in text units; at least 1. One closed-form branch each. */
export function frameOf(W, m) {
  var F;
  if (W < F_LO + TEXT_MIN * m) F = W - TEXT_MIN * m;
  else if (W <= F_HI + TEXT_MAX * m) F = 18 * W / (18 + m);
  else {
    // u = (F / 234)^(1/3) solves u^3 + p u = q; one real root (Cardano).
    var p = m / 18, q = W / F_HI, s = Math.sqrt(q * q / 4 + p * p * p / 27);
    var u = Math.cbrt(q / 2 + s) + Math.cbrt(q / 2 - s);
    F = F_HI * u * u * u;
  }
  return Math.max(1, F);
}
/* layout2D text size in px for drawing width W, or null where labels and the scale bar are hidden (W / 70 under 9, unrounded). */
export function layoutText(W) {
  return W / 70 < TEXT_MIN ? null : W <= W_HI ? W / 70 : TEXT_MAX * Math.sqrt(W / W_HI);
}
/* layout2D ray stroke weight for drawing width W. */
export function layoutWeight(W) {
  return W > W_HI ? Math.sqrt(W / W_HI) : 1;
}

/* The size table of ADR-0003, from the functions above and the renderers' margins, so it cannot drift.
   Per renderer: `width` and `aspect` (height / width, null where the height follows the content) of its default drawing of one panel,
   `minWidth` the narrowest figure of one panel (its plot frame at F_LO, text at 9 px), and `panelStep` the width each further panel adds at that floor
   (rayFan's columns, spot's panels with their 22 px gap, throughFocus's columns with their 10 px gap, and its row label of 4.2 text units plus 2.4 for the y labels before the first; 0 for a single plot). A figure of n panels needs
   minWidth + (n - 1) * panelStep. The curve family (curve, rayFan, bars, map2D) has 4.6 text units of margin on the left and, at least, 1.2 on the right;
   wider tick labels, or map2D's colorbar, widen the right margin and need TEXT_MIN px more per text unit. */
/* ADR-0003's margins of the curve family, in text units: the one place they are written. The right margin comes from the ticks (at least 1.2). */
export var CURVE_MARGINS = Object.freeze({ L: 4.6, T: 2.6, B: 3.6 });
var CURVE_M = CURVE_MARGINS.L + 1.2, TF_LABEL = 4.2, SPOT_GAP = 22, TF_GAP = 10;
var curveMin = F_LO + TEXT_MIN * CURVE_M;
export var PLOT_SIZES = {
  curve: { width: 460, aspect: 260 / 460, minWidth: curveMin, panelStep: 0 },
  rayFan: { width: 228, aspect: 314 / 228, minWidth: curveMin, panelStep: curveMin },
  bars: { width: 460, aspect: 260 / 460, minWidth: curveMin, panelStep: 0 },
  map2D: { width: 460, aspect: 360 / 460, minWidth: curveMin, panelStep: 0 },
  spot: { width: 150, aspect: null, minWidth: F_LO + TEXT_MIN * SPOT_LABEL_M, panelStep: F_LO + SPOT_GAP + TEXT_MIN * SPOT_LABEL_M },
  throughFocus: { width: (TF_LABEL + SPOT_LABEL_M) * TEXT_MIN + 92 + TF_GAP, aspect: null, minWidth: (TF_LABEL + SPOT_LABEL_M) * TEXT_MIN + F_LO + TF_GAP, panelStep: F_LO + TF_GAP },
  layout2D: { width: 1000, aspect: null, minWidth: W_LO, panelStep: 0 },
};
