// layout2D on the recorded format (eleoptics.com's scripts/layout.py, plus an optional `chief`):
// {surfaces: [{z, sd, stop, image, glass, profile: [[z, y] × 41]}], rays: [field][ray][[z, y]…], chief?: number[]}, in mm.
// Geometry is drawn in mm inside one <g transform="matrix(s 0 0 -s tx ty)">; text, the chief dot and the scale bar in px.
import { idx, svg, NS } from './common.js';

// The fan's chief ray: `chief[k]` when recorded, else the middle ray (the site's rule; wrong for a vignetted fan).
function chiefOf(L, k) { var c = L.chief && L.chief[k]; return c != null ? c : Math.floor(L.rays[k].length / 2); }
// A stop with no glass on either side is drawn as two ticks, reaching sd + 2.5.
function standalone(S, i) { return S[i].stop && !S[i].glass && !(S[i - 1] && S[i - 1].glass); }
function reach(S, i) { return standalone(S, i) ? S[i].sd + 2.5 : S[i].sd; }

/* A port of the site's bounds(): z covers the rays; y covers the rays and every surface's reach, padded 4%. */
export function layoutBounds(layouts) {
  var zmin = Infinity, zmax = -Infinity, ylo = Infinity, yhi = -Infinity;
  layouts.forEach(function (L) {
    L.rays.forEach(function (fan) { fan.forEach(function (r) { r.forEach(function (p) {
      zmin = Math.min(zmin, p[0]); zmax = Math.max(zmax, p[0]); ylo = Math.min(ylo, p[1]); yhi = Math.max(yhi, p[1]);
    }); }); });
    L.surfaces.forEach(function (_, i) { var h = reach(L.surfaces, i); ylo = Math.min(ylo, -h); yhi = Math.max(yhi, h); });
  });
  var pad = 0.04 * (yhi - ylo);
  return { zmin: zmin, zmax: zmax, ylo: ylo - pad, yhi: yhi + pad };
}

// `data` is a recorded layout, or a system carrying one in `layout` (by field) and `layoutWl` (by wavelength).
export function recorded(D, colorBy) { return D.surfaces ? D : colorBy === "wavelength" ? D.layoutWl : D.layout; }

export function layout2D(o) {
  var D = o.data, colorBy = o.colorBy || "field", set = o.rays || "marginal-chief", L = recorded(D, colorBy), S = L.surfaces;
  var B = o.box || layoutBounds([L]), W = o.width || 1000, s = W / (B.zmax - B.zmin), top = 3;
  var H = Math.round((B.yhi - B.ylo) * s) + 30, tx = -B.zmin * s, ty = top + B.yhi * s;
  function n(v) { return +v.toFixed(3); }
  function pts(r) { return r.map(function (p) { return n(p[0]) + "," + n(p[1]); }).join(" "); }
  function X(z) { return (z * s + tx).toFixed(2); } function Y(y) { return (ty - y * s).toFixed(2); }
  function line(z1, y1, z2, y2, rest) { return '<line x1="' + n(z1) + '" y1="' + n(y1) + '" x2="' + n(z2) + '" y2="' + n(y2) + '" ' + rest + " " + NS + "/>"; }
  var M = +s.toFixed(6), g = '<g transform="matrix(' + M + " 0 0 " + -M + " " + +tx.toFixed(3) + " " + +ty.toFixed(3) + ')">';
  g += line(B.zmin + 1, 0, B.zmax - 1, 0, 'stroke="var(--plot-axis)" style="stroke-width:var(--stroke-hair)" stroke-dasharray="4 6"');
  S.forEach(function (a, i) {
    var b = S[i + 1];
    if (a.glass && b) g += '<polygon points="' + pts(a.profile.concat(b.profile.slice().reverse())) + '" fill="var(--glass-' + (a.glass === "flint" ? "flint" : "crown") + ')" stroke="var(--glass-edge)" style="stroke-width:var(--stroke-edge)" stroke-linejoin="round" ' + NS + "/>";
    if (standalone(S, i)) [1, -1].forEach(function (k) { g += line(a.z, k * a.sd, a.z, k * (a.sd + 2.5), 'stroke="var(--ink)" style="stroke-width:var(--stroke-edge)" stroke-linecap="round"'); });
  });
  var dots = "";
  L.rays.forEach(function (rays, k) {
    var c = chiefOf(L, k), pick = set === "fan" ? rays.map(function (_, i) { return i; }) : set === "chief" ? [c] : [0, c, rays.length - 1];
    pick.filter(function (i, j) { return pick.indexOf(i) === j; }).forEach(function (i) {
      g += '<polyline points="' + pts(rays[i]) + '" fill="none" stroke="' + idx(k) + '" style="stroke-width:var(--stroke-ray)" stroke-linecap="round" stroke-linejoin="round"' + (i === c && set !== "chief" ? ' stroke-dasharray="6 4"' : "") + " " + NS + "/>";
    });
    var last = rays[c][rays[c].length - 1]; dots += '<circle cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="2.4" fill="' + idx(k) + '"/>';
  });
  var img = S.filter(function (x) { return x.image; })[0];
  if (img) g += line(img.z, img.sd, img.z, -img.sd, 'stroke="var(--ink)" style="stroke-width:var(--stroke-curve)" stroke-linecap="round"');
  g += "</g>" + dots;
  function label(z, y, t) { return '<text class="eleo-tick" x="' + X(z) + '" y="' + Math.max(10, Y(y) - 5).toFixed(2) + '" text-anchor="' + (X(z) > W - 16 ? "end" : "middle") + '">' + t + "</text>"; }
  S.forEach(function (x, i) { if (x.stop) g += label(x.z, reach(S, i), "STO"); });
  if (img) g += label(img.z, img.sd, "IMA");
  var sb = 10 * s, by = H - 8;
  g += '<path d="M8,' + (by - 4) + " V" + (by + 4) + " M8," + by + " H" + (8 + sb).toFixed(1) + " M" + (8 + sb).toFixed(1) + "," + (by - 4) + " V" + (by + 4) + '" fill="none" stroke="var(--ink)" style="stroke-width:var(--stroke-edge)" ' + NS + '/><text class="eleo-tick" x="' + (16 + sb).toFixed(1) + '" y="' + (by + 3) + '">10 mm · true scale</text>';
  return svg(W, H, g, "Lens layout, YZ section, true scale, colored by " + colorBy);
}
