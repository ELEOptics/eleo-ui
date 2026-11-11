import { data } from "./data.js";
import { css, rgb, ramp, mapStops, fmt } from "./color.js";
import { svg, esc } from "./common.js";
import { niceTicks } from "./axis.js";
import { scales, axisTicks, plotCell } from "./curve.js";
import { frameText, frameOf, frameWeight, CURVE_MARGINS } from "./scale.js";
import { colormap } from "./physics.js";

var r2 = function (v) { return +v.toFixed(2); };

/* An axis's grid option, as { major, minor } (counts, 0 for none). `grid: false` or an axis `false` is no lines; no `grid`, `true`, or an axis left out (`null` too), is the default majors and no minors. Whether lines are drawn at all is the draw site's: `o.grid &&`. */
function gridOf(g, k) {
  var a = g === false ? false : g && g[k];
  if (a === null) a = undefined;
  if (a === false) return { major: 0, minor: 0 };
  if (a === undefined) return { major: 6, minor: 0, dflt: true };
  var ok = function (v, lo, hi) { return typeof v === "number" && Number.isInteger(v) && v >= lo && !(v > hi); };
  if (a.major !== undefined && !ok(a.major, 2)) throw new TypeError("map2D: grid." + k + ".major must be an integer of at least 2");
  if (a.minor !== undefined && a.minor !== false && !ok(a.minor, 0, 20)) throw new TypeError("map2D: grid." + k + ".minor must be a whole number of lines per interval, at most 20, or false");
  return { major: a.major || 6, minor: a.minor || 0, dflt: a.major === undefined };
}
/* The axis with its ticks fixed to `major` nice ticks over `r`, unless it has its own `ticks` or no `major`: scales, plotCell's labels and the grid then use the same ticks. */
function withMajor(a, g, r) {
  if (!g || g.dflt || !g.major || a.ticks) return a;
  var o = {}; for (var k in a) o[k] = a[k];
  o.ticks = niceTicks(r[0], r[1], g.major).ticks;
  return o;
}

/* The margins of a typed map, in text units: L the left one and R the right one, which the colorbar and the x ticks widen (the loop below). map2D draws with them and minWidth counts them, so the floor cannot drift from the drawing. `o` is the map's props, valid as typedMap checks. */
function margins(o, W, H) {
  var x = o.x || {}, e = o.extent, rows = o.values, gx = gridOf(o.grid, "x");
  var live = function (v) { return typeof v === "number" && isFinite(v); };
  var lo = Infinity, hi = -Infinity;
  rows.forEach(function (r) { r.forEach(function (v) { if (live(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
  /* Value range: the data's, symmetric about 0 for "wave" (a diverging map's middle step means 0); `range` overrides. */
  if (o.map === "wave" && lo <= hi) { var mx = Math.max(Math.abs(lo), Math.abs(hi)); lo = -mx; hi = mx; }
  if (Array.isArray(o.range) && o.range.length === 2 && live(o.range[0]) && live(o.range[1])) { lo = o.range[0]; hi = o.range[1]; }
  var log = o.scale === "log", dec = o.decades > 0 ? o.decades : 4;
  /* A log scale with a range 0 < lo < hi spans exactly [lo, hi]; otherwise it spans `decades` below hi. */
  if (log && lo > 0 && lo < hi && Array.isArray(o.range) && o.range.length === 2 && live(o.range[0]) && live(o.range[1])) dec = Math.log10(hi / lo);
  /* Colorbar (only with `value`): ticks over the color scale, whole decades on log. Its width joins the right margin, in text units: 1.2 gap, 1 bar, 0.4, the widest label (0.6 a character), 0.4. */
  var vb = o.value, cbt = null, CB = 0;
  if (vb) {
    var cl = log ? hi * Math.pow(10, -dec) : lo, vt;
    if (!(log ? hi > 0 : lo < hi)) vt = { ticks: [], decimals: 0 };
    else if (vb.ticks) vt = axisTicks(vb, [cl, hi]);
    else if (log) { vt = { ticks: [], decimals: 0 }; if (hi > 0) for (var k = Math.ceil(Math.log10(cl) - 1e-9); k <= Math.floor(Math.log10(hi) + 1e-9); k++) vt.ticks.push(Math.pow(10, k)); vt.decimals = null; }
    else {
      /* niceTicks rounds its step up, so a span like [0.01, 1.2] can leave two ticks inside: ask for more labels until three fall in the range (a step of a tenth of the span is within the limit). */
      var inside = function (v) { return v >= cl - 1e-9 * (hi - cl) && v <= hi + 1e-9 * (hi - cl); };
      for (var nt = 6; nt <= 60; nt++) { vt = niceTicks(cl, hi, nt); if (vt.ticks.filter(inside).length >= 3) break; }
    }
    var cbpos = function (v) { return log ? (Math.log10(v / hi) + dec) / dec : hi > cl ? (v - cl) / (hi - cl) : 0; };
    cbt = vt.ticks.filter(function (v) { var t = cbpos(v); return t >= -1e-9 && t <= 1 + 1e-9; }).map(function (v) { return { t: cbpos(v), s: fmt(v, vt.decimals == null ? (v < 1 ? Math.max(0, -Math.floor(Math.log10(v) + 1e-9)) : 0) : vt.decimals) }; });
    CB = 3 + 0.6 * Math.max.apply(null, [0].concat(cbt.map(function (q) { return Array.from(q.s).length; })));
  }
  /* The drawn window: the extent, or `view`'s ranges (extent units) per axis; padded below like the extent. */
  var vw = o.view || {}, bx = vw.x || [e[0], e[1]], by = vw.y || [e[2], e[3]];
  /* Ranges: the window (the extent without a `view`) padded on the shorter side so the plot area's px per unit are equal. The right margin (text units) is the one the extent's x ticks need, repeated until it stops growing: the padded range's ticks (the ones drawn) can need a wider margin than the extent's, and a wider margin narrows the padded range (pads x less), so the ticks are measured again. The text size follows the margin, since it follows the frame. */
  var Rt0 = scales({ x: { range: [e[0], e[1]], ticks: withMajor(x, gx, bx).ticks }, y: { range: by } }, [[]]).Rt + CB, Rt = Rt0, F, t, L, T, Bm, R, pw, ph, dx = bx[1] - bx[0], dy = by[1] - by[0], xr, yr;
  for (var it = 0; it < 8; it++) {
    F = frameOf(W, CURVE_MARGINS.L + Rt); t = frameText(F); L = r2(CURVE_MARGINS.L * t); T = r2(CURVE_MARGINS.T * t); Bm = CURVE_MARGINS.B * t; R = Rt * t;
    pw = r2(Math.max(1, W - L - R)); ph = r2(Math.max(1, H - T - Bm)); xr = [bx[0], bx[1]]; yr = [by[0], by[1]];
    if (dx / dy < pw / ph) { var px = dy * pw / ph; xr = [bx[0] - (px - dx) / 2, bx[1] + (px - dx) / 2]; }
    else { var py = dx * ph / pw; yr = [by[0] - (py - dy) / 2, by[1] + (py - dy) / 2]; }
    var need = Math.max(Rt0, scales({ x: { range: xr, ticks: withMajor(x, gx, xr).ticks }, y: { range: yr } }, [[]]).Rt + CB);
    if (need <= Rt + 1e-9) break;
    Rt = need;
  }
  return { L: CURVE_MARGINS.L, R: Rt, F: F, t: t, T: T, Bm: Bm, pw: pw, ph: ph, xr: xr, yr: yr, lo: lo, hi: hi, log: log, dec: dec, cbt: cbt, CB: CB, Rt: Rt };
}

export function mapMargins(o) {
  var W = o.width || 460, m = margins(o, W, o.height || Math.round(W * 360 / 460));
  return { L: m.L, R: m.R };
}

/* The typed map (Map2DGridProps): the frame, ticks and axis labels of a plot, and the cells as one pixelated <image> in px. Text, margins and the colorbar follow ADR-0003, in units of the text size t(F) of the plot frame's width F (curve's margins, scale.js CURVE_MARGINS: left, bottom, top, the right one from the ticks and the colorbar); the aperture ring grows by frameWeight(F).
   Not in plotCell's data group: that group flips y and would draw row 0 at the bottom. Masked cells are alpha 0. */
function typedMap(o) {
  var W = o.width || 460, H = o.height || Math.round(W * 360 / 460), x = o.x || {}, y = o.y || {}, e = o.extent, rows = o.values, nr = rows && rows.length, nc = nr && rows[0] ? rows[0].length : 0;
  var live = function (v) { return typeof v === "number" && isFinite(v); };
  if (!Array.isArray(rows) || !nr || !Array.isArray(rows[0]) || !nc) throw new TypeError("map2D: values must be a non-empty array of non-empty rows");
  if (rows.some(function (r) { return !Array.isArray(r) || r.length !== nc; })) throw new TypeError("map2D: every row of values must have the same length");
  if (!Array.isArray(e) || e.length !== 4 || !e.every(live) || !(e[0] < e[1]) || !(e[2] < e[3])) throw new TypeError("map2D: extent must be [x0, x1, y0, y1] with x0 < x1 and y0 < y1");
  var vw = o.view;
  if (vw !== undefined && vw !== null) {
    var okr = function (a) { return a === undefined || a === null || (Array.isArray(a) && a.length === 2 && live(a[0]) && live(a[1]) && a[0] < a[1]); };
    if (typeof vw !== "object" || !okr(vw.x) || !okr(vw.y)) throw new TypeError("map2D: view must be { x?: [lo, hi], y?: [lo, hi] } with finite lo < hi");
    o = Object.assign({}, o, { view: { x: vw.x || undefined, y: vw.y || undefined } });
  }
  var pol = o.polar, pr, pa;
  if (pol) {
    pr = pol.radii; pa = pol.angles;
    if (!Array.isArray(pr) || !Array.isArray(pa) || !pr.length || !pa.length || !pr.every(live) || !pa.every(live) || pr[0] < 0 || pr.some(function (q, i) { return i && !(q > pr[i - 1]); }) || pa.some(function (q, i) { return i && q < pa[i - 1]; }) || pa[pa.length - 1] - pa[0] > 2 * Math.PI * (1 + 1e-12)) throw new TypeError("map2D: polar needs non-empty radii (finite, increasing, from 0 up) and angles (finite, sorted, within one turn)");
    if (nr !== pr.length || nc !== pa.length) throw new TypeError("map2D: polar values need one row per radius and one value per angle");
  }
  var M = margins(o, W, H), vb = o.value, lo = M.lo, hi = M.hi, log = M.log, dec = M.dec, cbt = M.cbt, CB = M.CB, Rt = M.Rt, F = M.F, t = M.t, T = M.T, Bm = M.Bm, pw = M.pw, ph = M.ph, xr = M.xr, yr = M.yr, L = r2(CURVE_MARGINS.L * t), R = Rt * t;
  var ts = ' style="font-size:' + +t.toFixed(3) + 'px"', wt = +frameWeight(F).toFixed(3);
  var gx = gridOf(o.grid, "x"), gy = gridOf(o.grid, "y");
  var sc = { xr: xr, yr: yr, xt: axisTicks(withMajor(x, gx, xr), xr), yt: axisTicks(withMajor(y, gy, yr), yr), Rt: Rt };
  var lut = colormap(o.map || "ember", o.el), cv = document.createElement("canvas"), span = hi - lo;
  var sx = pw / (xr[1] - xr[0]), sy = ph / (yr[1] - yr[0]);
  /* The cell's color: the value's step on the scale, null for a masked value. */
  var paint = function (v) {
    if (!live(v)) return null;
    var t = log ? (hi > 0 && v > hi * Math.pow(10, -dec) ? (Math.log10(v / hi) + dec) / dec : 0) : span > 0 ? (v - lo) / span : 0;
    return lut[Math.max(0, Math.min(255, Math.round(t * 255)))];
  };
  var bw = nc, bh = nr;
  if (pol) {
    /* Polar: the bitmap has one pixel per px the image shows (the plot area's px, so never more), which resolves a sector wherever it is at least a pixel wide at the outer ring. */
    /* A view does not re-bake: the bitmap is sized at the scale without it. */
    var M0 = vw ? margins(Object.assign({}, o, { view: undefined }), W, H) : M, sx0 = M0.pw / (M0.xr[1] - M0.xr[0]), sy0 = M0.ph / (M0.yr[1] - M0.yr[0]);
    bw = Math.max(1, Math.round((e[1] - e[0]) * sx0)); bh = Math.max(1, Math.round((e[3] - e[2]) * sy0));
  }
  cv.width = bw; cv.height = bh;
  var ctx = cv.getContext("2d"), im = ctx.createImageData(bw, bh), put = function (k, c) {
    im.data[k] = Math.round(c[0]); im.data[k + 1] = Math.round(c[1]); im.data[k + 2] = Math.round(c[2]); im.data[k + 3] = 255;
  };
  if (pol) {
    /* Nearest sample: radial edges midway between neighbouring radii (the first sector from 0, the last half a step past the outer radius), angular edges midway between spokes. Pixels in no sector stay alpha 0. */
    var nrg = pr.length, rout = pr[nrg - 1] + (nrg > 1 ? pr[nrg - 1] - pr[nrg - 2] : pr[0]) / 2, TAU = 2 * Math.PI;
    var cols = rows.map(function (r) { return r.map(paint); }), mid = pr.slice(1).map(function (q, k) { return (pr[k] + q) / 2; }), na = pa.length;
    for (var j = 0; j < bh; j++) for (var i = 0; i < bw; i++) {
      var qx = e[0] + (i + 0.5) * (e[1] - e[0]) / bw, qy = e[3] - (j + 0.5) * (e[3] - e[2]) / bh, rr = Math.hypot(qx, qy);
      if (rr > rout) continue;
      /* Binary search: the first ring whose outer edge is above rr; the last spoke at or before the angle (shifted into [pa[0], pa[0] + TAU)) and its successor, which wraps to the first spoke + TAU. A pixel exactly on a ring edge takes the outer ring; an angular tie takes the first spoke in order. */
      var lo2 = 0, hi2 = mid.length; while (lo2 < hi2) { var m2 = (lo2 + hi2) >> 1; if (rr >= mid[m2]) lo2 = m2 + 1; else hi2 = m2; }
      var ri = lo2, ang = pa[0] + ((Math.atan2(qy, qx) - pa[0]) % TAU + TAU) % TAU, a0 = 0, a1 = na; while (a0 < a1) { var m3 = (a0 + a1) >> 1; if (pa[m3] <= ang) a0 = m3 + 1; else a1 = m3; }
      var ai = a0 - 1, nx = a0 < na ? a0 : 0, dn = (a0 < na ? pa[a0] : pa[0] + TAU) - ang, dp = ang - pa[ai];
      while (ai > 0 && pa[ai - 1] === pa[ai]) ai--;
      if (dn < dp || (dn === dp && nx < ai)) ai = nx;
      if (cols[ri][ai]) put((j * bw + i) * 4, cols[ri][ai]);
    }
  } else rows.forEach(function (r, j) { r.forEach(function (v, i) { var c = paint(v); if (c) put((j * nc + i) * 4, c); }); });
  ctx.putImageData(im, 0, 0);
  var X = function (v) { return +(L + (v - xr[0]) * sx).toFixed(2); }, Y = function (v) { return +(T + ph - (v - yr[0]) * sy).toFixed(2); };
  var lab = function (a) { return esc(a.label || "") + (a.unit ? ", " + esc(a.unit) : ""); };
  var g = plotCell(sc, [], W, H, T, false, "", undefined, { L: L, B: Bm, R: R, t: t, grid: false });
  /* What interact reads off the image: the extent in data units and the grid's shape, or the polar map's radii and angles. */
  var shape = ' data-range="' + [xr[0], xr[1], yr[0], yr[1]].map(function (v) { return +v.toFixed(9); }).join(" ") + '" data-extent="' + e.join(" ") + '"' + (pol ? ' data-radii="' + pr.join(" ") + '" data-angles="' + pa.join(" ") + '"' : ' data-rows="' + nr + '" data-columns="' + nc + '"');
  var vp = o.view && (o.view.x || o.view.y);
  if (vp) g += '<svg x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" viewBox="' + L + " " + T + " " + pw + " " + ph + '">';
  g += '<image x="' + X(e[0]) + '" y="' + Y(e[3]) + '" width="' + +((e[1] - e[0]) * sx).toFixed(2) + '" height="' + +((e[3] - e[2]) * sy).toFixed(2) + '" preserveAspectRatio="none" style="image-rendering: pixelated"' + shape + ' href="' + cv.toDataURL("image/png") + '"/>';
  /* The grid, over the image and under the aperture: a line at each major tick inside the image, `minor` evenly spaced lines in each interval between ticks, in the grid tokens of the map colormap draws (an unknown map falls back to ember, as colormap does). */
  {
    var gm = ["ember", "wave", "viridis", "gray"].indexOf(o.map) < 0 ? "ember" : o.map, majS = ' stroke="var(--map-grid-' + gm + ')"/>', minS = ' stroke="var(--map-grid-' + gm + '-minor)"/>';
    var gl = function (gr, ticks, lo, hi, P, mk) {
      var maj = "", min = "", ts2 = ticks.slice().sort(function (p, q) { return p - q; }), eps = 1e-9 * (hi - lo);
      ts2.forEach(function (v) { if (v >= lo - eps && v <= hi + eps) maj += mk(P(v)) + majS; });
      if (gr.minor) ts2.slice(1).forEach(function (b, i) { var a = ts2[i]; for (var q = 1; q <= gr.minor; q++) { var v = a + q * (b - a) / (gr.minor + 1); if (v >= lo - eps && v <= hi + eps) min += mk(P(v)) + minS; } });
      return maj + min;
    };
    if (o.grid && gx.major) g += gl(gx, sc.xt.ticks, e[0], e[1], X, function (px) { return '<line x1="' + px + '" y1="' + Y(e[3]) + '" x2="' + px + '" y2="' + Y(e[2]) + '"'; });
    if (o.grid && gy.major) g += gl(gy, sc.yt.ticks, e[2], e[3], Y, function (py) { return '<line x1="' + X(e[0]) + '" y1="' + py + '" x2="' + X(e[1]) + '" y2="' + py + '"'; });
  }
  /* Aperture: an even-odd --surface path (the image's rect and the circle) over the image outside the circle, so the null cells' stair edge is cut round and an unmasked grid is cut too; no clipPath id (ADR-0001). A --plot-axis ring on top, 1 px up to the band and frameWeight(F) above. */
  var ap = o.aperture;
  if (ap && live(ap.x) && live(ap.y) && live(ap.r) && ap.r > 0) {
    var ax = X(ap.x), ay = Y(ap.y), ar = +(ap.r * sx).toFixed(2), ix0 = X(e[0]), ix1 = X(e[1]), iy0 = Y(e[3]), iy1 = Y(e[2]);
    g += '<path fill-rule="evenodd" fill="var(--surface)" d="M' + ix0 + " " + iy0 + "H" + ix1 + "V" + iy1 + "H" + ix0 + "ZM" + +(ax - ar).toFixed(2) + " " + ay + "a" + ar + " " + ar + " 0 1 0 " + 2 * ar + " 0a" + ar + " " + ar + " 0 1 0 " + -2 * ar + ' 0Z"/>';
    g += '<circle cx="' + ax + '" cy="' + ay + '" r="' + ar + '" fill="none" stroke="var(--plot-axis)" stroke-width="' + wt + '"/>';
  }
  if (vp) g += "</svg>";
  if (cbt) {
    var bc = document.createElement("canvas"); bc.width = 1; bc.height = 256;
    var bctx = bc.getContext("2d"), bim = bctx.createImageData(1, 256);
    for (var r = 0; r < 256; r++) { var cc = lut[255 - r]; bim.data[r * 4] = Math.round(cc[0]); bim.data[r * 4 + 1] = Math.round(cc[1]); bim.data[r * 4 + 2] = Math.round(cc[2]); bim.data[r * 4 + 3] = 255; }
    bctx.putImageData(bim, 0, 0);
    var bx = r2(W - (CB - 1.2) * t), cbw = r2(t), tk = r2(0.3 * t);
    g += '<image x="' + bx + '" y="' + T + '" width="' + cbw + '" height="' + ph + '" preserveAspectRatio="none" style="image-rendering: pixelated" href="' + bc.toDataURL("image/png") + '"/>';
    g += '<rect x="' + bx + '" y="' + T + '" width="' + cbw + '" height="' + ph + '" fill="none" stroke="var(--plot-grid)"/>';
    cbt.forEach(function (q) { var ty = +(T + ph - q.t * ph).toFixed(2); g += '<line x1="' + r2(bx + cbw) + '" y1="' + ty + '" x2="' + r2(bx + cbw + tk) + '" y2="' + ty + '" stroke="var(--plot-grid)"/><text class="eleo-tick" x="' + r2(bx + cbw + 0.4 * t) + '" y="' + ty + '" dy="' + r2(tk) + '"' + ts + '>' + q.s + "</text>"; });
    g += '<text class="eleo-tick" x="' + r2(W - 0.4 * t) + '" y="' + r2(T - 0.8 * t) + '" text-anchor="end"' + ts + '>' + lab(vb) + "</text>";
  }
  g += '<text class="eleo-tick" x="' + r2(W - R) + '" y="' + r2(H - 0.4 * t) + '" text-anchor="end"' + ts + '>' + lab(x) + '</text><text class="eleo-tick" x="' + r2(0.4 * t) + '" y="' + r2(t) + '"' + ts + '>' + lab(y) + "</text>";
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
