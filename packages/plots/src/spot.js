import { idx, svg } from "./common.js";
import { data } from "./data.js";
import { fmt } from "./color.js";

export function spot(o) {
  o = o || {}; var D = data(o), colorBy = o.colorBy || "wavelength", scale = o.scale || "common", airy = o.airy !== false;
  var B = 150, gap = 22, n = D.spots.length, W = n * B + (n - 1) * gap, H = B + 58, g = "";
  var common = o.half || Math.max.apply(null, D.spotStats.map(function (s) { return s.geo; }));
  common = [5, 10, 20, 25, 40, 50, 100, 200].find(function (v) { return v >= common; }) || Math.ceil(common);
  D.spots.forEach(function (per, fi) {
    var half = scale === "auto" ? ([5, 10, 20, 25, 40, 50, 100, 200].find(function (v) { return v >= D.spotStats[fi].geo; }) || common) : common;
    var s = (B / 2) / half, ox = fi * (B + gap), cx = ox + B / 2, cy = B / 2 + 4;
    g += '<rect x="' + (ox + .5) + '" y="4.5" width="' + (B - 1) + '" height="' + (B - 1) + '" rx="3" fill="none" stroke="var(--plot-grid)"/>';
    g += '<path d="M' + (ox + 6) + "," + cy + " H" + (ox + B - 6) + " M" + cx + ",10 V" + (B - 2) + '" stroke="var(--plot-grid)"/>';
    per.forEach(function (pts, wi) { var col = colorBy === "field" ? idx(fi) : idx(wi); pts.forEach(function (p) { g += '<circle cx="' + (cx + p[0] * s).toFixed(1) + '" cy="' + (cy - p[1] * s).toFixed(1) + '" r="1.1" fill="' + col + '" fill-opacity=".85"/>'; }); });
    if (airy) g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (D.airy * s).toFixed(2) + '" fill="none" stroke="var(--ink)" stroke-width=".8"/>';
    var st = D.spotStats[fi];
    g += '<text class="eleo-val" x="' + ox + '" y="' + (B + 22) + '">' + fmt(D.fields[fi], 1) + '°</text><text class="eleo-tick" x="' + (ox + B) + '" y="' + (B + 22) + '" text-anchor="end">±' + half + ' µm</text>';
    g += '<text class="eleo-tick" x="' + ox + '" y="' + (B + 37) + '">RMS <tspan class="eleo-val">' + st.rms.toFixed(2) + '</tspan> µm</text>';
    g += '<text class="eleo-tick" x="' + ox + '" y="' + (B + 51) + '">GEO <tspan class="eleo-val">' + st.geo.toFixed(2) + '</tspan> µm</text>';
  });
  return svg(W, H, g, "Spot diagrams, colored by " + colorBy);
}
export function throughFocus(o) {
  o = o || {}; var D = data(o), T = D.throughFocus, B = 92, gap = 10, lw = 44, th = 22;
  var cols = T.defocus.length, rows = T.spots.length, W = lw + cols * (B + gap), H = th + rows * (B + 26), g = "", half = o.half || 40, s = (B / 2) / half;
  T.defocus.forEach(function (dz, j) { g += '<text class="eleo-tick" x="' + (lw + j * (B + gap) + B / 2) + '" y="12" text-anchor="middle">' + (dz > 0 ? "+" : dz < 0 ? "−" : "") + Math.abs(dz) + " µm</text>"; });
  T.spots.forEach(function (row, i) {
    var oy = th + i * (B + 26);
    g += '<text class="eleo-val" x="0" y="' + (oy + B / 2 + 4) + '">' + fmt(D.fields[i], 1) + "°</text>";
    row.forEach(function (cell, j) {
      var ox = lw + j * (B + gap), cx = ox + B / 2, cy = oy + B / 2;
      g += '<rect x="' + (ox + .5) + '" y="' + (oy + .5) + '" width="' + (B - 1) + '" height="' + (B - 1) + '" rx="3" fill="none" stroke="' + (j === 2 ? "var(--ink-subtle)" : "var(--plot-grid)") + '"/>';
      cell.pts.forEach(function (pts, wi) { pts.forEach(function (p) { var x = cx + p[0] * s, y = cy - p[1] * s; if (Math.abs(x - cx) < B / 2 && Math.abs(y - cy) < B / 2) g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r=".9" fill="' + idx(wi) + '" fill-opacity=".85"/>'; }); });
      g += '<text class="eleo-tick" x="' + ox + '" y="' + (oy + B + 13) + '">RMS <tspan class="eleo-val">' + cell.rms.toFixed(1) + "</tspan></text>";
    });
  });
  return svg(W, H, g, "Through-focus spot diagrams, fields by rows, focus shift by columns");
}
