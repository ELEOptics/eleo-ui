// layout2D on the recorded format (eleoptics.com's scripts/layout.py, plus an optional `chief`):
// {surfaces: [{z, sd, stop, image, glass, profile: [[z, y] × 41]}], rays: [field][ray][[z, y]…], chief?: number[]}, in mm.
// Geometry is drawn in mm inside one <g transform="matrix(s 0 0 -s tx ty)">; text, the chief dot and the scale bar in px.
import { idx, svg, NS, esc } from './common.js';
import { glassFill, drawnGlasses } from './glass.js';

// plots.css `.eleo-tick` as presentation attributes, so the standalone entry needs only tokens.css; any CSS rule still wins over them.
var TICK = 'class="eleo-tick" fill="var(--ink-muted)" font-family="var(--font-mono)" font-size="10" font-weight="400"';

// The fan's chief ray: `chief[k]` when recorded, else the middle ray (the site's rule; wrong for a vignetted fan).
function chiefOf(L, k) {
  var c = L.chief && L.chief[k];
  if (c == null) return Math.floor(L.rays[k].length / 2);
  if (!Number.isInteger(c) || c < 0 || c >= L.rays[k].length) throw new Error("layout2D: chief[" + k + "] is not a ray of fan " + k);
  return c;
}
// A [z, y] pair of finite numbers.
function finitePoint(p) { return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]); }
// Every surface but the image needs a profile of finite [z, y] pairs: layoutBounds and reach() read profile[0], the
// glass polygon all of it. The error's tail, or "" for a drawable surface.
function badProfile(s) {
  if (s.image) return "";
  if (!Array.isArray(s.profile) || !s.profile.length) return " has no profile";
  return s.profile.every(finitePoint) ? "" : " has a profile with a non-finite point";
}
// A stop with no glass on either side is drawn as two ticks, reaching sd + 2.5.
function standalone(S, i) { return S[i].stop && !S[i].glass && !(S[i - 1] && S[i - 1].glass); }
// A lens stop reaches its profile edge, |profile[0][1]| (layoutBounds' rule), so its label clears the glass.
function reach(S, i) { return standalone(S, i) ? S[i].sd + 2.5 : Math.abs(S[i].profile[0][1]); }

/* A port of eleo-website@39d19e4 public/layout.js bounds(): z from the rays' ends; y from 0, the rays and every
   surface but the image (a standalone stop reaches sd + 2.5, a lens |profile[0][1]|), padded 4%. */
export function layoutBounds(layouts) {
  if (!Array.isArray(layouts) || !layouts.length) throw new Error("layoutBounds: no layouts");
  layouts.forEach(function (L, k) {
    if (!L || !Array.isArray(L.rays) || !Array.isArray(L.surfaces)) throw new Error("layoutBounds: layouts[" + k + "] is not a recorded layout");
    var n = 0;
    L.rays.forEach(function (fan, j) {
      if (!Array.isArray(fan)) throw new Error("layoutBounds: layouts[" + k + "].rays[" + j + "] is not an array");
      fan.forEach(function (r, i) {
        if (!Array.isArray(r) || !r.length) throw new Error("layoutBounds: layouts[" + k + "].rays[" + j + "][" + i + "]: ray has no points");
        if (!r.every(finitePoint)) throw new Error("layoutBounds: layouts[" + k + "].rays[" + j + "][" + i + "] has a non-finite point");
      });
      n += fan.length;
    });
    if (!n) throw new Error("layoutBounds: layouts[" + k + "] has no rays");
    L.surfaces.forEach(function (s, i) { var e = badProfile(s); if (e) throw new Error("layoutBounds: layouts[" + k + "].surfaces[" + i + "]" + e); });
  });
  var zmin = Infinity, zmax = -Infinity, ylo = 0, yhi = 0;
  layouts.forEach(function (L) {
    L.rays.forEach(function (fan) { fan.forEach(function (r) {
      zmin = Math.min(zmin, r[0][0]); zmax = Math.max(zmax, r[r.length - 1][0]);
      r.forEach(function (p) { ylo = Math.min(ylo, p[1]); yhi = Math.max(yhi, p[1]); });
    }); });
    L.surfaces.forEach(function (s) {
      if (s.image) return;
      var e = s.stop && !s.glass ? s.sd + 2.5 : Math.abs(s.profile[0][1]);
      ylo = Math.min(ylo, -e); yhi = Math.max(yhi, e);
    });
  });
  var pad = (yhi - ylo) * 0.04;
  return { zmin: zmin, zmax: zmax, ylo: ylo - pad, yhi: yhi + pad };
}

export function layout2D(o) {
  var D = o.data, colorBy = o.colorBy || "field", set = o.rays || "marginal-chief";
  // `data` is a recorded layout, or a system carrying one in `layout` (by field) and `layoutWl` (by wavelength).
  var L = D.surfaces ? D : colorBy === "wavelength" ? D.layoutWl : D.layout;
  if (!L || !Array.isArray(L.surfaces) || !Array.isArray(L.rays)) throw new Error("layout2D: data is not a recorded layout ({surfaces, rays}); see the plots README migration note");
  L.rays.forEach(function (fan, k) {
    if (!Array.isArray(fan)) throw new Error("layout2D: fan " + k + " is not an array of rays");
    fan.forEach(function (r, i) {
      if (!Array.isArray(r) || !r.length) throw new Error("layout2D: fan " + k + " ray " + i + " has no points");
      // A box skips layoutBounds, which names a non-finite point; without one, layoutBounds names it first.
      if (o.box != null && !r.every(finitePoint)) throw new Error("layout2D: fan " + k + " ray " + i + " has a non-finite point");
    });
  });
  if (!L.rays.some(function (fan) { return fan.length; })) throw new Error("layout2D: no rays");
  if (o.labels != null && !Array.isArray(o.labels)) throw new Error("layout2D: labels must be an array (a string or null per fan)");
  if (o.labels && o.labels.length > L.rays.length) throw new Error("layout2D: labels has " + o.labels.length + " entries for " + L.rays.length + " fans");
  var S = L.surfaces;
  S.forEach(function (x, i) { var e = badProfile(x); if (e) throw new Error("layout2D: surface " + i + e); });
  var B = o.box != null ? o.box : layoutBounds([L]);
  // A drawable box: finite, with room in z and y (`!(a < b)` also catches NaN).
  if (!B || ![B.zmin, B.zmax, B.ylo, B.yhi].every(Number.isFinite) || !(B.zmin < B.zmax) || !(B.ylo < B.yhi)) throw new Error("layout2D: box needs finite zmin < zmax and ylo < yhi");
  var W = o.width || 1000, s = W / (B.zmax - B.zmin);
  // Room above the geometry for the labels, 15 px whatever the stops reach, so one box gives one transform.
  var top = 15;
  var H = Math.round((B.yhi - B.ylo) * s + top) + 27, tx = -B.zmin * s, ty = top + B.yhi * s;
  function n(v) { return +v.toFixed(3); }
  function pts(r) { return r.map(function (p) { return n(p[0]) + "," + n(p[1]); }).join(" "); }
  function X(z) { return (z * s + tx).toFixed(2); } function Y(y) { return (ty - y * s).toFixed(2); }
  function line(z1, y1, z2, y2, rest) { return '<line x1="' + n(z1) + '" y1="' + n(y1) + '" x2="' + n(z2) + '" y2="' + n(y2) + '" ' + rest + " " + NS + "/>"; }
  var M = +s.toFixed(6), g = '<g transform="matrix(' + M + " 0 0 " + -M + " " + +tx.toFixed(3) + " " + +ty.toFixed(3) + ')">';
  g += line(B.zmin + 1, 0, B.zmax - 1, 0, 'stroke="var(--plot-axis)" style="stroke-width:var(--stroke-hair)" stroke-dasharray="4 6"');
  // A {name, nd, vd} glass fills per name (glassFill over drawnGlasses, the rule glassLegend uses), through style: a CSS color function
  // in a presentation attribute is not safe. A style with var() is never dropped, so the fill attribute never applies to these;
  // glassFill falls back from the band tokens to crown and flint itself. "crown" and "flint" draw as before.
  var fills = glassFill(drawnGlasses(S));
  S.forEach(function (a, i) {
    var b = S[i + 1], obj = a.glass && typeof a.glass === "object";
    if (a.glass && b) g += '<polygon points="' + pts(a.profile.concat(b.profile.slice().reverse())) + '" fill="var(--glass-' + (a.glass === "flint" ? "flint" : "crown") + ')" stroke="var(--glass-edge)" style="' + (obj ? "fill:" + fills.get(a.glass.name) + ";" : "") + 'stroke-width:var(--stroke-edge)" stroke-linejoin="round" ' + NS + "/>";
    if (standalone(S, i)) [1, -1].forEach(function (k) { g += line(a.z, k * a.sd, a.z, k * (a.sd + 2.5), 'stroke="var(--ink)" style="stroke-width:var(--stroke-edge)" stroke-linecap="round"'); });
  });
  var dots = "", ends = [];
  L.rays.forEach(function (rays, k) {
    if (!rays.length) return; // every ray of this fan was dead: layout.py dropped them all
    var c = chiefOf(L, k), pick = set === "fan" ? rays.map(function (_, i) { return i; }) : set === "chief" ? [c] : [0, c, rays.length - 1];
    pick.filter(function (i, j) { return pick.indexOf(i) === j; }).forEach(function (i) {
      g += '<polyline points="' + pts(rays[i]) + '" fill="none" stroke="' + idx(k) + '" style="stroke-width:var(--stroke-ray)" stroke-linecap="round" stroke-linejoin="round"' + (i === c && set !== "chief" ? ' stroke-dasharray="6 4"' : "") + " " + NS + "/>";
    });
    var last = rays[c][rays[c].length - 1]; ends[k] = last; dots += '<circle cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="2.4" fill="' + idx(k) + '"/>';
  });
  var img = S.filter(function (x) { return x.image; })[0];
  if (img) g += line(img.z, Math.min(img.sd, B.yhi), img.z, Math.max(-img.sd, B.ylo), 'stroke="var(--ink)" style="stroke-width:var(--stroke-curve)" stroke-linecap="round"');
  g += "</g>" + dots;
  // A text's baseline 5 px above y (mm), kept 10 px inside the top.
  function above(y) { return +Math.max(10, Y(y) - 5).toFixed(2); }
  function label(z, py, t) { return '<text ' + TICK + ' x="' + X(z) + '" y="' + py.toFixed(2) + '" text-anchor="' + (X(z) < 16 ? "start" : X(z) > W - 16 ? "end" : "middle") + '">' + t + "</text>"; }
  // Each field's label sits 5 px above its chief's image end; an empty fan or a null label draws none.
  var tags = [];
  (o.labels || []).forEach(function (t, k) { if (ends[k] && t != null) tags.push({ z: ends[k][0], py: above(ends[k][1]), t: esc(t) }); });
  if (o.marks !== false) {
    S.forEach(function (x, i) { if (x.stop) g += label(x.z, above(reach(S, i)), "STO"); });
    if (img) {
      // With labels, IMA goes below the image line's lower end and a 12 px line below the lowest label.
      // Its baseline drops the text's height (9 px: the ascent of plots.css `.eleo-tick`'s 10 px font) plus the 5 px gap `above` leaves.
      var IMA_DROP = 9 + 5, ys = tags.map(function (a) { return a.py; });
      g += label(img.z, ys.length ? Math.max(+Y(Math.max(-img.sd, B.ylo)) + IMA_DROP, Math.max.apply(null, ys) + 12) : above(img.sd), "IMA");
    }
  }
  tags.forEach(function (a) { g += label(a.z, a.py, a.t); });
  var sb = 10 * s, by = H - 8;
  g += '<path d="M8,' + (by - 4) + " V" + (by + 4) + " M8," + by + " H" + (8 + sb).toFixed(1) + " M" + (8 + sb).toFixed(1) + "," + (by - 4) + " V" + (by + 4) + '" fill="none" stroke="var(--ink)" style="stroke-width:var(--stroke-edge)" ' + NS + '/><text ' + TICK + ' x="' + (16 + sb).toFixed(1) + '" y="' + (by + 3) + '">10 mm · true scale</text>';
  return svg(W, H, g, "Lens layout, YZ section, true scale, colored by " + colorBy);
}
