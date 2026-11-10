import { idx, svg, esc, NS } from "./common.js";
import { data } from "./data.js";
import { fmt } from "./color.js";
import { keyLayout, keyMarkup, cornerBox, KEY_AT } from "./key.js";
import { niceTicks } from "./axis.js";
import { frameText, frameWeight, frameOf, SPOT_LABEL_M } from "./scale.js";

var r2 = function (v) { return Math.round(v * 100) / 100; };

/* The smallest 1, 2, 2.5, 4, 5 or 10 times a power of ten that holds v. */
function niceHalf(v) {
  if (!(v > 0) || !isFinite(v)) return 1;
  var e = Math.pow(10, Math.floor(Math.log10(v))), m = [1, 2, 2.5, 4, 5, 10].find(function (k) { return k * e >= v * (1 - 1e-12); });
  return m * e > 0 ? m * e : 1;
}
/* v to p significant digits, never an exponent (a number below 1e-100 prints as 0). */
function plain(v, p) {
  var s = v.toPrecision(p);
  if (!/e/.test(s)) return s;
  if (Math.abs(v) < 1e-100) return "0";
  return Math.abs(v) >= 1 ? v.toFixed(0) : v.toFixed(Math.min(100, p - 1 - Math.floor(Math.log10(Math.abs(v)))));
}
/* A tick as label text: no exponent, no trailing zeros, a true minus sign. */
var tickText = function (v) { return plain(v, 6).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace("-", "\u2212"); };
/* The grid's ticks, strictly inside ±half, as { v, s } (value, label text). */
var tickList = function (half) { return niceTicks(-half, half, 5).ticks.filter(function (tk) { return Math.abs(tk) < half; }).map(function (tk) { return { v: tk, s: tickText(tk) }; }); };
/* The left margin (text units) a panel needs for its y labels: 0.6 per character plus 0.6, at least SPOT_LABEL_M. */
export var labelM = function (half) { return Math.max(SPOT_LABEL_M, 0.6 * Math.max.apply(null, [0].concat(tickList(half).map(function (k) { return k.s.length; }))) + 0.6); };
var sig3 = function (v) { return plain(v, 3); };
var live = function (p) { return !!p && isFinite(p[0]) && isFinite(p[1]) && p[0] !== null && p[1] !== null; };
var airyR = function (o, p) { return o.showAiry !== false && isFinite(p.airy) && p.airy > 0 ? +p.airy : 0; };
var circleR = function (p) { return p.circle && isFinite(p.circle.radius) && p.circle.radius > 0 ? +p.circle.radius : 0; };
/* The halves typedSpot draws with (one per panel: the common one, or each panel's own under scale "auto", where `half` is ignored) and the left margin LM (text units) they need, for o and its raw panels: the half comes from the data (about the centroid under that reference) when no `half` is given. typedSpot and minWidth both call it, so they agree. */
export function spotLM(o, panels) {
  var cen = String(o.reference == null ? "" : o.reference).trim().toLowerCase() === "centroid";
  var ext = panels.map(function (p) {
    var pts = [], m = Math.max(airyR(o, p), circleR(p)), sx = 0, sy = 0;
    (p.series || []).forEach(function (se) { (se.points || []).forEach(function (q) { if (live(q)) { pts.push(q); sx += +q[0]; sy += +q[1]; } }); });
    var mx = cen && pts.length ? sx / pts.length : 0, my = cen && pts.length ? sy / pts.length : 0;
    pts.forEach(function (q) { m = Math.max(m, Math.abs(q[0] - mx), Math.abs(q[1] - my)); });
    return m;
  });
  var common = isFinite(o.half) && o.half > 0 && isFinite(75 / o.half) ? +o.half : niceHalf(Math.max.apply(null, [0].concat(ext)));
  var halves = panels.map(function (p, i) { var h = (o.scale || "common") === "auto" ? niceHalf(ext[i]) : common; return isFinite(75 / h) ? h : 1; });
  return { halves: halves, LM: Math.max.apply(null, [SPOT_LABEL_M].concat(halves.map(labelM))) };
}
/* One square spot panel at (x, y), side `side`, the same scale `side / 2 / half` on both axes: the frame (stroke `frame`, default --plot-grid), the grid strictly inside ±half under the dots (`grid` not false), the centre cross, then in a nested svg (which clips) one round-cap dot path per series and a circle per positive radius in `circles`. wt is the dot weight, frameWeight(side). typedSpot and throughFocus both draw their panels with it; `o.labels` ({ x, y } flags, with `o.t` the text size in px) writes the tick labels of the same ticks outside the frame: x centred under the bottom edge, y right-aligned left of the left edge, every other one dropped until neighbours clear each other; the caller adds anything else outside the frame. */
function spotPanel(x, y, side, half, o) {
  var s = (side / 2) / half, cx = side / 2, g = "", fy = r2(y);
  g += '<rect x="' + r2(x + .5) + '" y="' + r2(y + .5) + '" width="' + r2(side - 1) + '" height="' + r2(side - 1) + '" rx="3" fill="none" stroke="' + (o.frame || "var(--plot-grid)") + '"/>';
  if (o.grid !== false) tickList(half).forEach(function (k) {
    var u = r2(cx + k.v * s);
    g += '<path d="M' + r2(x + u) + "," + fy + " V" + r2(y + side) + '" fill="none" stroke="var(--plot-grid)" data-grid="x"/>';
    g += '<path d="M' + x + "," + r2(y + u) + " H" + r2(x + side) + '" fill="none" stroke="var(--plot-grid)" data-grid="y"/>';
  });
  if (o.labels && (o.labels.x || o.labels.y)) {
    var tl = tickList(half), t = o.t, sty = ' style="font-size:' + +t.toFixed(2) + 'px"', wide = Math.max.apply(null, [0].concat(tl.map(function (k) { return k.s.length; }))) * 0.6 * t;
    var step = 1, pitch = tl.length > 1 ? Math.abs(tl[1].v - tl[0].v) * s : side;
    while (step * pitch < wide + 0.5 * t && step < tl.length) step++;
    var zi = Math.max(0, tl.findIndex(function (q) { return q.v === 0; }));
    tl.filter(function (k, i) { return (i - zi) % step === 0; }).forEach(function (k) {
      if (o.labels.x) g += '<text class="eleo-tick"' + sty + ' x="' + r2(x + cx + k.v * s) + '" y="' + r2(y + side + 1.2 * t) + '" text-anchor="middle">' + k.s + "</text>";
      if (o.labels.y) g += '<text class="eleo-tick"' + sty + ' x="' + r2(x - 0.4 * t) + '" y="' + r2(y + cx - k.v * s + 0.35 * t) + '" text-anchor="end">' + k.s + "</text>";
    });
  }
  g += '<path d="M' + r2(x + 6) + "," + r2(y + cx) + " H" + r2(x + side - 6) + " M" + r2(x + cx) + "," + r2(y + 6) + " V" + r2(y + side - 6) + '" fill="none" stroke="var(--plot-grid)"/>';
  g += '<svg x="' + +x.toFixed(2) + '" y="' + +y.toFixed(2) + '" width="' + +side.toFixed(2) + '" height="' + +side.toFixed(2) + '"><g transform="matrix(' + [s, 0, 0, -s, r2(cx), r2(cx)].join(" ") + ')">';
  (o.series || []).forEach(function (se) {
    var d = (se.points || []).filter(live).map(function (q) { return "M" + +q[0] + "," + +q[1] + " h0"; }).join(" ");
    g += '<path d="' + d + '" fill="none" stroke="' + idx(se.index || 0) + '" stroke-width="' + +(2.2 * o.wt).toFixed(3) + '" stroke-linecap="round" stroke-opacity=".85" ' + NS + "/>";
  });
  (o.circles || []).forEach(function (r) { if (r) g += '<circle cx="0" cy="0" r="' + r + '" fill="none" stroke="var(--ink)" stroke-width=".8" ' + NS + "/>"; });
  return g + "</g></svg>";
}
/* Spot panels (ADR-0001): per panel a square frame and one data-space group, the same scale on both axes; a dot is `M x,y h0` under a round cap, one path per series. */
function typedSpot(o) {
  var cen = String(o.reference == null ? "" : o.reference).trim().toLowerCase() === "centroid", ref = cen ? "centroid" : o.origin || "chief ray";
  var anyStats = false, ts = isFinite(o.textScale) && o.textScale > 0 ? +o.textScale : 1;
  var panels = o.panels.map(function (p) {
    var sx = 0, sy = 0, k = 0, series = p.series || [];
    series.forEach(function (se) { (se.points || []).forEach(function (q) { if (live(q)) { sx += +q[0]; sy += +q[1]; k++; } }); });
    var mx = cen && k ? sx / k : 0, my = cen && k ? sy / k : 0;
    var q2 = 0, geo = 0, np = 0;
    var drawn = series.map(function (se) { return Object.assign({}, se, { points: (se.points || []).map(function (q) { if (!live(q)) return q; var x = q[0] - mx, y = q[1] - my; q2 += x * x + y * y; geo = Math.max(geo, Math.hypot(x, y)); np++; return [x, y]; }) }); });
    var stats = o.showStats !== false && np ? ["RMS " + sig3(Math.sqrt(q2 / np)) + (o.unit ? " " + o.unit : ""), "GEO " + sig3(geo) + (o.unit ? " " + o.unit : "")] : [];
    if (stats.length) anyStats = true;
    return Object.assign({}, p, { series: drawn, notes: stats.concat(p.notes || []) });
  }), n = panels.length, gap = 22, unit = o.unit ? " " + esc(o.unit) : "", g = "";
  var notesMax = Math.max.apply(null, [0].concat(panels.map(function (p) { return (p.notes || []).length; })));
  /* One caption line per active setting, each at the first panel's left edge and short enough for a one-panel figure. */
  var radii = panels.map(function (p) { return airyR(o, p); }).filter(Boolean);
  var cap = ["Reference: " + ref];
  if (radii.length) cap.push(radii.length === n && radii.every(function (r) { return sig3(r) === sig3(radii[0]); }) ? "Airy radius " + sig3(radii[0]) + (o.unit ? " " + o.unit : "") : "Airy circle");
  var circles = panels.filter(circleR), labelOf = function (p) { return String(p.circle.label == null ? "" : p.circle.label).trim(); }, cl = circles.length ? labelOf(circles[0]) : "";
  var shared = circles.length > 0 && circles.length === n && circles.every(function (p) { return sig3(circleR(p)) === sig3(circleR(circles[0])) && labelOf(p) === cl; });
  var line = shared && cl ? (cl + " " + sig3(circleR(circles[0])) + (o.unit ? " " + o.unit : "")).trim() : cl;
  if (circles.length && line) cap.push(line);
  if (anyStats) cap.push("RMS, GEO");
  if (o.unit) cap.push("x, y in " + o.unit);
  /* ADR-0003: a panel's side is the frame F; the text is frameText(F) times textScale, and the layout below the panel is in text units (a text line of 1.5 under it for the x labels, 1.8 more to the title, 1.5 a line, a foot of 4.3 + 1.5 a line, plus 0.7 + 1.4 a key row; a left margin of labelM(half) before each panel). */
  var tOf = function (F) { return frameText(F) * ts; };
  /* The key: one dot entry per distinct series label (the first use's index): below the captions (`keyAt` "below", default), or in a corner of each panel, for that panel's own labels. */
  var at = o.keyAt === undefined ? "below" : o.keyAt;
  if (KEY_AT.indexOf(at) < 0) throw new TypeError('spot: unknown keyAt "' + at + '"');
  var entsOf = function (ps) {
    var out = [];
    ps.forEach(function (p) { (p.series || []).forEach(function (se) { if (se.label && !out.some(function (e) { return e.label === String(se.label); })) out.push({ label: String(se.label), index: se.index || 0, kind: "dot" }); }); });
    return out;
  };
  var sl = spotLM(o, o.panels), halves = sl.halves, LM = sl.LM, lmOf = function (F) { return LM * frameText(F) * ts; };
  var ents = at === "below" ? entsOf(panels) : [];
  var side = o.width ? frameOf((o.width - (n - 1) * gap) / Math.max(n, 1), LM * ts) : 150;
  var keyW = function (F) { return o.width || n * (F + lmOf(F)) + (n - 1) * gap; };
  var keyRows = function (F) { return ents.length ? keyLayout(ents, tOf(F), { L: lmOf(F), R: keyW(F), maxRow: 1000 }).rows : 0; };
  var rows = keyRows(side), footM, footOf = function (F) { return footM * frameText(F) + 1; }, fit = function () {
    footM = (4.3 + 1.5 * (notesMax + cap.length) + (rows ? 0.7 + 1.4 * rows : 0)) * ts;
    var F = side0;
    if (o.height && F + 8 + footOf(F) > o.height) F = frameOf(o.height - 9, footM);
    return F;
  }, side0 = side;
  /* Without a width the key wraps at n * F + gaps, which shrinks with F: recount the rows at the fitted side and fit again until they hold (rows only grow, so it ends). */
  for (var it = 0; it <= ents.length; it++) { side = fit(); var need = keyRows(Math.max(Math.floor(side * 100) / 100, 1)); if (need <= rows) break; rows = need; }
  side = Math.max(Math.floor(side * 100) / 100, 1);
  var t = tOf(side), lm = lmOf(side), foot = footOf(side), wt = frameWeight(side), sty = ' style="font-size:' + +t.toFixed(2) + 'px"';
  var W = o.width || Math.max(n * (side + lm) + (n - 1) * gap, lm + 0.6 * t * Math.max.apply(null, cap.map(function (c) { return c.length; })) + 12), H = Math.max(o.height || 0, side + 8 + foot), top = 4;
  panels.forEach(function (p, i) {
    var half = halves[i];
    var ox = r2(lm + i * (side + lm + gap));
    g += spotPanel(ox, top, side, half, { series: p.series || [], circles: [airyR(o, p), circleR(p)], grid: o.grid !== false, wt: wt, labels: { x: true, y: true }, t: t });
    var pe = at === "below" ? [] : entsOf([p]);
    if (pe.length) g += cornerBox(pe, at, t, ox, top, side, side);
    var ty = r2(top + side + 3.3 * t);
    g += (p.title ? '<text class="eleo-val"' + sty + ' x="' + ox + '" y="' + ty + '">' + esc(p.title) + "</text>" : "");
    (p.notes || []).forEach(function (nt, j) { g += '<text class="eleo-tick"' + sty + ' x="' + ox + '" y="' + r2(ty + 1.5 * t * (j + 1)) + '">' + esc(nt) + "</text>"; });
  });
  cap.forEach(function (ct, j) { g += '<text class="eleo-tick"' + sty + ' x="' + r2(lm) + '" y="' + r2(top + side + 3.3 * t + 1.5 * t * (notesMax + j + 1)) + '">' + esc(ct) + "</text>"; });
  if (ents.length) {
    var kl = keyLayout(ents, t, { L: lm, R: keyW(side), maxRow: 1000 });
    g += keyMarkup(kl.places, ents, t, top + side + 3.3 * t + 1.5 * t * (notesMax + cap.length) + 0.7 * t, { mark: true });
  }
  return svg(+W.toFixed(2), +H.toFixed(2), g, esc(o.label || "Spot diagrams"));
}
/* The sample's spots as typed panels: a series per wavelength (per field with colorBy "field"), the Airy radius as `airy`; RMS and GEO are the renderer's. */
export function spotPanels(D, o) {
  o = o || {}; var byField = o.colorBy === "field";
  var panels = D.spots.map(function (per, fi) {
    var p = {
      title: fmt(D.fields[fi], 1) + "°",
      series: per.map(function (pts, wi) { return { points: pts, index: byField ? fi : wi }; })
    };
    if (o.airy !== false) p.airy = D.airy;
    return p;
  });
  var r = { panels: panels, reference: "centroid", unit: "µm", label: "Spot diagrams, colored by " + (o.colorBy || "wavelength") };
  ["scale", "half", "width", "height", "textScale", "origin", "reference", "showStats", "showAiry", "grid"].forEach(function (k) { if (o[k] != null) r[k] = o[k]; });
  return r;
}
export function spot(o) {
  o = o || {};
  return typedSpot(o.panels ? o : spotPanels(data(o), o));
}
/* throughFocus (ADR-0003): a panel's side B is the frame; text is frameText(B), the row label's room 4.2 text units plus labelM(half) for the y tick labels, and the rows' gaps are in text units. With `width`, B solves lw + cols * (B + gap) = width; without, B is 92. Only the outer edges are labelled (every cell shares one scale): x under the bottom row, y left of the left column, and a caption line "x, y in µm" under the figure. Each RMS line sits 1.3 text units under its panel, the bottom row's 2.5 (under its x labels). */
export function throughFocus(o) {
  o = o || {}; var D = data(o), T = D.throughFocus, gap = 10, LW = 4.2;
  var cols = T.defocus.length, rows = T.spots.length, g = "", half = o.half || 40, YM = labelM(half);
  var B = isFinite(o.width) && o.width > 0 && cols ? r2(Math.floor(frameOf((+o.width - cols * gap) / cols, (LW + YM) / cols) * 100) / 100) : 92;
  var t = frameText(B), sty = ' style="font-size:' + +t.toFixed(2) + 'px"', wt = frameWeight(B);
  var lw = r2((LW + YM) * t), th = r2(2.2 * t), pitch = r2(B + 2.6 * t), W = r2(Math.max(lw + cols * (B + gap), isFinite(o.width) ? +o.width : 0)), H = r2(th + rows * pitch + 2.7 * t);
  T.defocus.forEach(function (dz, j) { g += '<text class="eleo-tick"' + sty + ' x="' + r2(lw + j * (B + gap) + B / 2) + '" y="' + r2(1.2 * t) + '" text-anchor="middle">' + (dz > 0 ? "+" : dz < 0 ? "−" : "") + Math.abs(dz) + " µm</text>"; });
  T.spots.forEach(function (row, i) {
    var oy = r2(th + i * pitch);
    g += '<text class="eleo-val"' + sty + ' x="0" y="' + r2(oy + B / 2 + 0.4 * t) + '">' + fmt(D.fields[i], 1) + "°</text>";
    row.forEach(function (cell, j) {
      var ox = r2(lw + j * (B + gap));
      g += spotPanel(ox, oy, B, half, { series: cell.pts.map(function (pts, wi) { return { points: pts, index: wi }; }), grid: o.grid !== false, wt: wt, frame: j === 2 ? "var(--ink-subtle)" : "var(--plot-grid)", labels: { x: i === rows - 1, y: j === 0 }, t: t });
      g += '<text class="eleo-tick"' + sty + ' x="' + ox + '" y="' + r2(oy + B + (i === rows - 1 ? 2.5 : 1.3) * t) + '">RMS <tspan class="eleo-val"' + sty + '>' + cell.rms.toFixed(1) + "</tspan></text>";
    });
  });
  g += '<text class="eleo-tick"' + sty + ' x="' + lw + '" y="' + r2(th + rows * pitch + 1.5 * t) + '">x, y in µm</text>';
  return svg(W, H, g, "Through-focus spot diagrams, fields by rows, focus shift by columns");
}
