import { data } from "./data.js";
import { css, rgb, ramp, mapStops } from "./color.js";

/* ---------------- Map2D (canvas) ---------------- */
export function map2D(canvas, o) {
  o = o || {}; var D = data(o), kind = o.kind || "psf", map = o.map || (kind === "wavefront" ? "wave" : "ember"), scale = o.scale || "linear";
  var grid, lo = 0, hi = 1;
  if (kind === "wavefront") { grid = D.wavefront.map; var m = 0; grid.forEach(function (r) { r.forEach(function (v) { if (v !== null) m = Math.max(m, Math.abs(v)); }); }); lo = -m; hi = m; }
  else grid = D.psf[o.index || 0].img;
  var stops = mapStops(canvas, map), n = grid.length, off = document.createElement("canvas"); off.width = n; off.height = n;
  var ctx = off.getContext("2d"), im = ctx.createImageData(n, n), ground = rgb(css(canvas, "surface"));
  for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
    var v = grid[y][x], i = (y * n + x) * 4, col;
    if (v === null) col = ground;
    else { var t = kind === "wavefront" ? (v - lo) / (hi - lo) : scale === "log" ? Math.max(0, (Math.log10(Math.max(v, 1e-6)) + 4) / 4) : v; col = ramp(stops, t); }
    im.data[i] = col[0]; im.data[i + 1] = col[1]; im.data[i + 2] = col[2]; im.data[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  var Sz = o.size || 320; canvas.width = Sz; canvas.height = Sz; var c2 = canvas.getContext("2d"); c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = "high";
  if (kind === "wavefront") { c2.fillStyle = css(canvas, "surface"); c2.fillRect(0, 0, Sz, Sz); c2.save(); c2.beginPath(); c2.arc(Sz / 2, Sz / 2, Sz / 2 - 1, 0, 2 * Math.PI); c2.clip(); c2.drawImage(off, 0, 0, Sz, Sz); c2.restore(); c2.strokeStyle = css(canvas, "plot-axis"); c2.lineWidth = 1; c2.beginPath(); c2.arc(Sz / 2, Sz / 2, Sz / 2 - 1, 0, 2 * Math.PI); c2.stroke(); }
  else c2.drawImage(off, 0, 0, Sz, Sz);
  return { lo: lo, hi: hi };
}
