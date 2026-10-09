import { idx, svg } from "./common.js";
import { data } from "./data.js";
import { fmt } from "./color.js";

export function rayFan(o) {
  o = o || {}; var D = data(o), kind = o.kind || "tra", src = kind === "opd" ? D.opdFans : D.fans, pick = o.fields || src.map(function (_, i) { return i; });
  var all = []; pick.forEach(function (fi) { ["T", "S"].forEach(function (k) { src[fi][k].forEach(function (a) { a.forEach(function (v) { if (v !== null) all.push(Math.abs(v)); }); }); }); });
  var mx = Math.max.apply(null, all), steps = kind === "opd" ? [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10] : [5, 10, 20, 25, 50, 100, 200];
  var nice = o.fullScale || steps.find(function (v) { return v >= mx; }) || Math.ceil(mx);
  var pw = o.panelWidth || 170, ph = 92, gx = 26, gy = 30, left = 34, W = left + pick.length * pw + (pick.length - 1) * gx + 4, H = 2 * ph + gy + 54, g = "";
  var unit = kind === "opd" ? "waves" : "µm";
  ["T", "S"].forEach(function (k, r) {
    pick.forEach(function (fi, c) {
      var F = src[fi], ox = left + c * (pw + gx), oy = 18 + r * (ph + gy);
      function X(t) { return (ox + (t + 1) / 2 * pw).toFixed(1); } function Y(v) { return (oy + ph / 2 - v / nice * (ph / 2)).toFixed(1); }
      g += '<rect x="' + ox + '" y="' + oy + '" width="' + pw + '" height="' + ph + '" rx="2" fill="none" stroke="var(--plot-grid)"/>';
      g += '<line x1="' + X(0) + '" y1="' + oy + '" x2="' + X(0) + '" y2="' + (oy + ph) + '" stroke="var(--plot-grid)"/><line x1="' + ox + '" y1="' + Y(0) + '" x2="' + (ox + pw) + '" y2="' + Y(0) + '" stroke="var(--plot-axis)"/>';
      F[k].forEach(function (vals, wi) {
        var d = "", pen = false, N = vals.length;
        vals.forEach(function (v, i) { if (v === null) { pen = false; return; } d += (pen ? " L" : " M") + X(-1 + 2 * i / (N - 1)) + "," + Y(v); pen = true; });
        g += '<path d="' + d + '" fill="none" stroke="' + idx(wi) + '" style="stroke-width:var(--stroke-curve)" stroke-linecap="round" stroke-linejoin="round"/>';
      });
      if (r === 0) g += '<text class="eleo-val" x="' + ox + '" y="' + (oy - 6) + '">' + fmt(D.fields[fi], 1) + "°</text>";
      if (c === 0) g += '<text class="eleo-tick" x="' + (ox - 6) + '" y="' + (oy + 8) + '" text-anchor="end">+' + nice + '</text><text class="eleo-tick" x="' + (ox - 6) + '" y="' + (oy + ph) + '" text-anchor="end">−' + nice + '</text><text class="eleo-tick" x="' + (ox - 6) + '" y="' + Y(0) + '" dy="3" text-anchor="end">0</text>';
      g += '<text class="eleo-tick" x="' + (ox + pw) + '" y="' + (oy + ph + 12) + '" text-anchor="end">' + (k === "T" ? "Py" : "Px") + "</text>";
    });
  });
  g += '<text class="eleo-tick" x="' + left + '" y="' + (H - 4) + '">' + (kind === "opd" ? "Optical path difference" : "Transverse ray aberration") + ", " + unit + ", full scale ±" + nice + " · top: tangential · bottom: sagittal</text>";
  return svg(W, H, g, (kind === "opd" ? "OPD" : "Ray") + " fan plots, tangential and sagittal");
}
