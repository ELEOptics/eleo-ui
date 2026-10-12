import { idx, svg, esc, NS } from "./common.js";
import { data } from "./data.js";
import { fmt } from "./color.js";

/* The smallest 1, 2, 2.5, 4, 5 or 10 times a power of ten that holds v. */
function niceHalf(v) {
  if (!(v > 0) || !isFinite(v)) return 1;
  var e = Math.pow(10, Math.floor(Math.log10(v))), m = [1, 2, 2.5, 4, 5, 10].find(function (k) { return k * e >= v * (1 - 1e-12); });
  return m * e;
}
var live = function (p) { return !!p && isFinite(p[0]) && isFinite(p[1]) && p[0] !== null && p[1] !== null; };
/* Spot panels (ADR-0001): per panel a square frame and one data-space group, the same scale on both axes; a dot is `M x,y h0` under a round cap, one path per series. */
function typedSpot(o) {
  var cen = String(o.reference == null ? "" : o.reference).trim().toLowerCase() === "centroid", ref = cen ? "centroid" : o.origin || "chief ray";
  var airyOf = function (p) { return o.showAiry !== false && isFinite(p.airy) && p.airy > 0 ? +p.airy : 0; };
  var anyStats = false;
  var panels = o.panels.map(function (p) {
    var sx = 0, sy = 0, k = 0, series = p.series || [];
    series.forEach(function (se) { (se.points || []).forEach(function (q) { if (live(q)) { sx += +q[0]; sy += +q[1]; k++; } }); });
    var mx = cen && k ? sx / k : 0, my = cen && k ? sy / k : 0;
    var q2 = 0, geo = 0, np = 0;
    var drawn = series.map(function (se) { return Object.assign({}, se, { points: (se.points || []).map(function (q) { if (!live(q)) return q; var x = q[0] - mx, y = q[1] - my; q2 += x * x + y * y; geo = Math.max(geo, Math.hypot(x, y)); np++; return [x, y]; }) }); });
    var stats = o.showStats !== false && np ? ["RMS " + Math.sqrt(q2 / np).toPrecision(3) + (o.unit ? " " + o.unit : ""), "GEO " + geo.toPrecision(3) + (o.unit ? " " + o.unit : "")] : [];
    if (stats.length) anyStats = true;
    return Object.assign({}, p, { series: drawn, notes: stats.concat(p.notes || []) });
  }), n = panels.length, gap = 22, unit = o.unit ? " " + esc(o.unit) : "", g = "";
  var notesMax = Math.max.apply(null, [0].concat(panels.map(function (p) { return (p.notes || []).length; })));
  /* One caption line per active setting, each at x=0 and short enough for a one-panel figure. */
  var radii = panels.map(airyOf).filter(Boolean), r3 = function (r) { return +r.toPrecision(3); };
  var cap = ["Reference: " + ref];
  if (radii.length) cap.push(radii.length === n && radii.every(function (r) { return r3(r) === r3(radii[0]); }) ? "Airy radius " + r3(radii[0]) + (o.unit ? " " + o.unit : "") : "Airy circle");
  if (anyStats) cap.push("RMS, GEO");
  var foot = 28 + 15 * notesMax + 1 + 15 * cap.length, side = o.width ? (o.width - (n - 1) * gap) / Math.max(n, 1) : 150;
  if (o.height) side = Math.min(side, o.height - foot - 8);
  side = Math.max(side, 1);
  var W = o.width || Math.max(n * side + (n - 1) * gap, 6 * Math.max.apply(null, cap.map(function (t) { return t.length; }))), H = Math.max(o.height || 0, side + 8 + foot), top = 4;
  var ext = panels.map(function (p) { var m = airyOf(p); (p.series || []).forEach(function (s) { (s.points || []).forEach(function (q) { if (live(q)) m = Math.max(m, Math.abs(q[0]), Math.abs(q[1])); }); }); return m; });
  var common = isFinite(o.half) && o.half > 0 ? +o.half : niceHalf(Math.max.apply(null, [0].concat(ext)));
  panels.forEach(function (p, i) {
    var half = (o.scale || "common") === "auto" ? niceHalf(ext[i]) : common, s = (side / 2) / half, ox = i * (side + gap), cx = side / 2;
    g += '<rect x="' + (ox + .5) + '" y="' + (top + .5) + '" width="' + (side - 1) + '" height="' + (side - 1) + '" rx="3" fill="none" stroke="var(--plot-grid)"/>';
    g += '<path d="M' + (ox + 6) + "," + (top + cx) + " H" + (ox + side - 6) + " M" + (ox + cx) + "," + (top + 6) + " V" + (top + side - 6) + '" fill="none" stroke="var(--plot-grid)"/>';
    g += '<svg x="' + +ox.toFixed(2) + '" y="' + top + '" width="' + +side.toFixed(2) + '" height="' + +side.toFixed(2) + '"><g transform="matrix(' + [s, 0, 0, -s, cx, cx].join(" ") + ')">';
    (p.series || []).forEach(function (se) {
      var d = (se.points || []).filter(live).map(function (q) { return "M" + +q[0] + "," + +q[1] + " h0"; }).join(" ");
      g += '<path d="' + d + '" fill="none" stroke="' + idx(se.index || 0) + '" stroke-width="2.2" stroke-linecap="round" stroke-opacity=".85" ' + NS + "/>";
    });
    if (airyOf(p)) g += '<circle cx="0" cy="0" r="' + airyOf(p) + '" fill="none" stroke="var(--ink)" stroke-width=".8" ' + NS + "/>";
    g += "</g></svg>";
    var ty = top + side + 18;
    g += (p.title ? '<text class="eleo-val" x="' + ox + '" y="' + ty + '">' + esc(p.title) + "</text>" : "") + '<text class="eleo-tick" x="' + (ox + side) + '" y="' + ty + '" text-anchor="end">±' + +half.toPrecision(6) + unit + "</text>";
    (p.notes || []).forEach(function (t, j) { g += '<text class="eleo-tick" x="' + ox + '" y="' + (ty + 15 * (j + 1)) + '">' + esc(t) + "</text>"; });
  });
  cap.forEach(function (t, j) { g += '<text class="eleo-tick" x="0" y="' + (top + side + 18 + 15 * notesMax + 15 * (j + 1)) + '">' + esc(t) + "</text>"; });
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
  ["scale", "half", "width", "height", "origin", "reference", "showStats", "showAiry"].forEach(function (k) { if (o[k] != null) r[k] = o[k]; });
  return r;
}
export function spot(o) {
  o = o || {};
  return typedSpot(o.panels ? o : spotPanels(data(o), o));
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
