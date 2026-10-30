import { data } from "./data.js";
import { css, rgb, ramp, mapStops } from "./color.js";
import { svg, esc } from "./common.js";
import { scales, axisTicks, plotCell, PLOT_L, PLOT_B, PLOT_T } from "./curve.js";
import { colormap } from "./physics.js";

/* The typed map (Map2DGridProps): the frame, ticks and axis labels of a plot, and the cells as one pixelated <image> in px.
   Not in plotCell's data group: that group flips y and would draw row 0 at the bottom. Masked cells are alpha 0. */
function typedMap(o) {
  var W = o.width || 460, H = o.height || 360, x = o.x || {}, y = o.y || {}, e = o.extent, rows = o.values, nr = rows && rows.length, nc = nr && rows[0] ? rows[0].length : 0;
  var live = function (v) { return typeof v === "number" && isFinite(v); };
  if (!Array.isArray(rows) || !nr || !Array.isArray(rows[0]) || !nc) throw new TypeError("map2D: values must be a non-empty array of non-empty rows");
  if (rows.some(function (r) { return !Array.isArray(r) || r.length !== nc; })) throw new TypeError("map2D: every row of values must have the same length");
  if (!Array.isArray(e) || e.length !== 4 || !e.every(live) || !(e[0] < e[1]) || !(e[2] < e[3])) throw new TypeError("map2D: extent must be [x0, x1, y0, y1] with x0 < x1 and y0 < y1");
  var lo = Infinity, hi = -Infinity;
  rows.forEach(function (r) { r.forEach(function (v) { if (live(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
  /* Ranges: the extent padded on the shorter side so the plot area's px per unit are equal. The right margin is the one the extent's x ticks need. */
  var R = scales({ x: { range: [e[0], e[1]], ticks: x.ticks }, y: { range: [e[2], e[3]] } }, [[]]).R;
  var pw = W - PLOT_L - R, ph = H - PLOT_T - PLOT_B, dx = e[1] - e[0], dy = e[3] - e[2], xr = [e[0], e[1]], yr = [e[2], e[3]];
  if (dx / dy < pw / ph) { var px = dy * pw / ph; xr = [e[0] - (px - dx) / 2, e[1] + (px - dx) / 2]; }
  else { var py = dx * ph / pw; yr = [e[2] - (py - dy) / 2, e[3] + (py - dy) / 2]; }
  var sc = { xr: xr, yr: yr, xt: axisTicks(x, xr), yt: axisTicks(y, yr), R: R };
  var lut = colormap(o.map || "ember", o.el), cv = document.createElement("canvas"); cv.width = nc; cv.height = nr;
  var ctx = cv.getContext("2d"), im = ctx.createImageData(nc, nr), span = hi - lo;
  rows.forEach(function (r, j) { r.forEach(function (v, i) {
    var k = (j * nc + i) * 4;
    if (!live(v)) return;
    var c = lut[span > 0 ? Math.round((v - lo) / span * 255) : 0];
    im.data[k] = Math.round(c[0]); im.data[k + 1] = Math.round(c[1]); im.data[k + 2] = Math.round(c[2]); im.data[k + 3] = 255;
  }); });
  ctx.putImageData(im, 0, 0);
  var sx = pw / (xr[1] - xr[0]), sy = ph / (yr[1] - yr[0]);
  var X = function (v) { return +(PLOT_L + (v - xr[0]) * sx).toFixed(2); }, Y = function (v) { return +(PLOT_T + ph - (v - yr[0]) * sy).toFixed(2); };
  var lab = function (a) { return esc(a.label || "") + (a.unit ? ", " + esc(a.unit) : ""); };
  var g = plotCell(sc, [], W, H, PLOT_T, false, "");
  g += '<image x="' + X(e[0]) + '" y="' + Y(e[3]) + '" width="' + +((e[1] - e[0]) * sx).toFixed(2) + '" height="' + +((e[3] - e[2]) * sy).toFixed(2) + '" preserveAspectRatio="none" style="image-rendering: pixelated" href="' + cv.toDataURL("image/png") + '"/>';
  g += '<text class="eleo-tick" x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">' + lab(x) + '</text><text class="eleo-tick" x="4" y="10">' + lab(y) + "</text>";
  return svg(W, H, g, esc(o.label || "Map"));
}

/* ---------------- Map2D (canvas) ---------------- */
export function map2D(canvas, o) {
  if (!(canvas && canvas.nodeType)) return typedMap(canvas);
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
