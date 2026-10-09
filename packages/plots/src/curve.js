import { idx, svg } from "./common.js";
import { data } from "./data.js";
import { fmt } from "./color.js";

export function curve(o) {
  o = o || {}; var D = data(o), kind = o.kind || "mtf", W = o.width || 460, H = o.height || 260, L = 46, R = 12, T = 14, Bm = 36;
  var pw = W - L - R, ph = H - T - Bm, g = "", series = [], xr, yr, xl, yl, xt, yt;
  if (kind === "mtf") {
    var df = D.mtf.df, fx = function (arr) { return arr.map(function (v, i) { return [i * df, v]; }).filter(function (p) { return p[0] <= 400; }); };
    series.push({ pts: fx(D.mtf.diff), col: "var(--ink)", dash: "1 3", w: 1.25 });
    D.mtf.fields.forEach(function (f, i) { series.push({ pts: fx(f.T), col: idx(i) }); series.push({ pts: fx(f.S), col: idx(i), dash: "5 3" }); });
    xr = [0, 400]; yr = [0, 1]; xl = "Spatial frequency, cycles/mm"; yl = "Modulus"; xt = [0, 100, 200, 300, 400]; yt = [0, .2, .4, .6, .8, 1];
  } else if (kind === "fieldCurvature") {
    series.push({ pts: D.fieldCurv.map(function (r) { return [r[1], r[0]]; }), col: idx(0) });
    series.push({ pts: D.fieldCurv.map(function (r) { return [r[2], r[0]]; }), col: idx(0), dash: "5 3" });
    xr = [-0.2, 0.2]; yr = [0, 2]; xl = "Focus shift, mm"; yl = "Field, °"; xt = [-0.2, -0.1, 0, 0.1, 0.2]; yt = [0, 0.5, 1, 1.5, 2];
  } else if (kind === "distortion") {
    series.push({ pts: D.distortion.map(function (r) { return [r[1], r[0]]; }), col: idx(0) });
    xr = [-0.2, 0.2]; yr = [0, 2]; xl = "Distortion, %"; yl = "Field, °"; xt = [-0.2, -0.1, 0, 0.1, 0.2]; yt = [0, 0.5, 1, 1.5, 2];
  } else {
    series.push({ pts: D.chromFocus.map(function (r) { return [r[1], r[0]]; }), col: idx(0) });
    xr = [-50, 200]; yr = [450, 700]; xl = "Focus shift, µm"; yl = "Wavelength, nm"; xt = [-50, 0, 50, 100, 150, 200]; yt = [450, 500, 550, 600, 650, 700];
  }
  function X(v) { return (L + (v - xr[0]) / (xr[1] - xr[0]) * pw).toFixed(1); } function Y(v) { return (T + ph - (v - yr[0]) / (yr[1] - yr[0]) * ph).toFixed(1); }
  g += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="var(--plot-grid)"/>';
  xt.forEach(function (v) { g += '<line x1="' + X(v) + '" y1="' + T + '" x2="' + X(v) + '" y2="' + (T + ph) + '" stroke="' + (v === 0 && kind !== "mtf" ? "var(--plot-axis)" : "var(--plot-grid)") + '"/><text class="eleo-tick" x="' + X(v) + '" y="' + (T + ph + 13) + '" text-anchor="middle">' + fmt(v, Math.abs(v) < 1 && v !== 0 ? 1 : 0) + "</text>"; });
  yt.forEach(function (v) { g += '<line x1="' + L + '" y1="' + Y(v) + '" x2="' + (L + pw) + '" y2="' + Y(v) + '" stroke="var(--plot-grid)"/><text class="eleo-tick" x="' + (L - 6) + '" y="' + Y(v) + '" dy="3" text-anchor="end">' + (kind === "mtf" ? v.toFixed(1) : v) + "</text>"; });
  series.forEach(function (s) { g += '<polyline points="' + s.pts.map(function (p) { return X(p[0]) + "," + Y(p[1]); }).join(" ") + '" fill="none" stroke="' + s.col + '" stroke-width="' + (s.w || 1.5) + '" stroke-linecap="round" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + "/>"; });
  g += '<text class="eleo-tick" x="' + (L + pw) + '" y="' + (H - 4) + '" text-anchor="end">' + xl + '</text><text class="eleo-tick" x="4" y="' + (T - 4) + '">' + yl + "</text>";
  return svg(W, H, g, kind + " plot");
}
