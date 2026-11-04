// The plot scale rule of ADR-0003: text and heavy strokes sized from the drawing width, in px. Pure functions, no DOM.

/* Framed renderers: F is the plot frame's width. Text is 9 px below F_LO, F / 18 up to F_HI (13 px), then the knee. */
export const TEXT_MIN = 9;
export const TEXT_MAX = 13;
export const F_LO = 162;
export const F_HI = 234;
/* layout2D: W is the drawing width. Labels are W / 70 px from W_LO to W_HI, hidden below W_LO. */
export const W_LO = 630;
export const W_HI = 910;

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
