// layout2D on the recorded format (eleoptics.com's scripts/layout.py, plus optional `chief`, `alive`, `dead` and the surface flags `mirror`, `hole` and `obscuration`):
// {surfaces: [{z, sd, stop, image, glass, profile: [[z, y] × 41], mirror?, hole?, obscuration?}], rays: [field][ray][[z, y]…], chief?: number[]}, in mm.
// Geometry is drawn in mm inside one <g transform="matrix(s 0 0 -s tx ty)">; text and the scale bar in px.
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
// Every surface but the image (a mirror image included) needs a profile of finite [z, y] pairs: layoutBounds and reach() read profile[0], the
// glass polygon all of it. The error's tail, or "" for a drawable surface.
function badProfile(s) {
  if (s.image && !s.mirror) return "";
  if (!Array.isArray(s.profile) || !s.profile.length) return " has no profile";
  return s.profile.every(finitePoint) ? "" : " has a profile with a non-finite point";
}
// A stop with no glass on either side is drawn as two ticks, reaching sd + 2.5.
function standalone(S, i) { return S[i].stop && !S[i].glass && !(S[i - 1] && S[i - 1].glass); }
// A lens stop reaches its profile edge, |profile[0][1]| (layoutBounds' rule), so its label clears the glass.
function reach(S, i) { return standalone(S, i) ? S[i].sd + 2.5 : Math.abs(S[i].profile[0][1]); }

// A mirror's body: the profile plus a flat back D/8 (sd/4) behind its far z, on the side away from the light, with |y| < hole left open.
// The light's way is the ray's step from its point at surface i to its point at surface i + 1 (rays carry one point per surface after their start;
// a mirror with no next point takes its incoming step), from a ray alive past the mirror before any ray. A polygon per side of the hole, or one.
function mirrorBodies(L, i) {
  var a = L.surfaces[i], t = a.sd / 4, dir = 0, h = a.hole > 0 ? a.hole : 0;
  // A ray alive past the mirror first (alive plus its blocking point, if dead, >= i + 3; or no `alive`): a dead ray's dotted tail may run any way.
  [true, false].forEach(function (strict) { L.rays.forEach(function (fan, k) { fan.forEach(function (r, j) {
    if (dir || (L.alive && !(L.alive[k] && L.alive[k][j] != null))) return;
    if (strict && L.alive && !(L.alive[k][j] + (L.dead && L.dead[k] && L.dead[k][j] ? 1 : 0) >= i + 3)) return;
    if (r[i + 2]) dir = Math.sign(r[i + 2][0] - r[i + 1][0]);
    else if (!strict && r[i + 1] && !L.surfaces[i + 1]) dir = -Math.sign(r[i + 1][0] - r[i][0]);
  }); }); });
  var zs = a.profile.map(function (p) { return p[0]; }), zb = dir < 0 ? Math.max.apply(null, zs) + t : Math.min.apply(null, zs) - t;
  function side(k) {
    // The profile's points with k·y >= hole, the crossing at ±hole interpolated.
    var out = [], q = a.profile;
    q.forEach(function (p, j) {
      var u = k * p[1], w = q[j - 1], v = w && k * w[1];
      if (w && (u >= h) !== (v >= h)) out.push([w[0] + (p[0] - w[0]) * (k * h - w[1]) / (p[1] - w[1]), k * h]);
      if (u >= h) out.push(p);
    });
    return out.length > 1 ? out.concat([[zb, out[out.length - 1][1]], [zb, out[0][1]]]) : null;
  }
  return (h ? [side(1), side(-1)] : [a.profile.concat([[zb, a.profile[a.profile.length - 1][1]], [zb, a.profile[0][1]]])]).filter(Boolean);
}

// CR #381: a collimated fan (every ray's first segment parallel to the first ray's within 1e-3 rad) starts on a line normal to its direction d. Every such
// line is R from c, the entrance pupil's centre (the mean axis crossing of the off-axis chiefs' first-segment lines, else the first surface's vertex);
// R clears every non-image profile point and mirror-body vertex, plus 0.5 x the largest non-image sd. Each start moves along its first segment's line;
// the other points stay. A fan that is not collimated keeps its starts. Returns the rays, the layout's own when nothing moves.
function movedStarts(L) {
  var S = L.surfaces, dirs = [], cz = [], geo = [], sd = 0, R = -Infinity, any = false;
  L.rays.forEach(function (fan, k) {
    var d = null, ok = fan.length > 0;
    fan.forEach(function (r) {
      var e = r.length > 1 && finitePoint(r[0]) && finitePoint(r[1]) ? Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) : 0;
      if (!(e > 0)) { ok = false; return; }
      e = [(r[1][0] - r[0][0]) / e, (r[1][1] - r[0][1]) / e];
      if (!d) d = e;
      else if (Math.abs(d[0] * e[1] - d[1] * e[0]) >= 1e-3 || d[0] * e[0] + d[1] * e[1] <= 0) ok = false;
    });
    dirs[k] = ok ? d : null;
    if (!ok) return;
    any = true;
    var ci = L.chief && L.chief[k], r = fan[Number.isInteger(ci) && fan[ci] ? ci : Math.floor(fan.length / 2)];
    var h = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), dy = (r[1][1] - r[0][1]) / h; // the chief's own first segment
    if (Math.abs(dy) > 1e-9) cz.push(r[0][0] - r[0][1] * (r[1][0] - r[0][0]) / (r[1][1] - r[0][1]));
  });
  if (!any) return L.rays;
  S.forEach(function (s, i) {
    if (s.image) return;
    if (s.sd > sd) sd = s.sd;
    geo = geo.concat(s.profile);
    if (s.mirror) mirrorBodies(L, i).forEach(function (b) { geo = geo.concat(b); });
  });
  var c = [cz.length ? cz.reduce(function (a, b) { return a + b; }) / cz.length : S[0].z, 0];
  dirs.forEach(function (d) { if (d) geo.forEach(function (g) { R = Math.max(R, -((g[0] - c[0]) * d[0] + (g[1] - c[1]) * d[1])); }); });
  R += sd / 2;
  return L.rays.map(function (fan, k) {
    var d = dirs[k];
    return !d ? fan : fan.map(function (r) {
      var t = -R - ((r[0][0] - c[0]) * d[0] + (r[0][1] - c[1]) * d[1]);
      return [[r[0][0] + t * d[0], r[0][1] + t * d[1]]].concat(r.slice(1));
    });
  });
}

/* A port of eleo-website@39d19e4 public/layout.js bounds(), widened for mirrors: z from every ray point, every non-image profile and every mirror body (#367); y from 0, the rays and every
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
    movedStarts(L).forEach(function (fan) { fan.forEach(function (r) {
      r.forEach(function (p) { zmin = Math.min(zmin, p[0]); zmax = Math.max(zmax, p[0]); ylo = Math.min(ylo, p[1]); yhi = Math.max(yhi, p[1]); });
    }); });
    L.surfaces.forEach(function (s, i) {
      if (s.image && !s.mirror) return;
      s.profile.forEach(function (p) { zmin = Math.min(zmin, p[0]); zmax = Math.max(zmax, p[0]); });
      if (s.mirror) mirrorBodies(L, i).forEach(function (b) { b.forEach(function (p) { zmin = Math.min(zmin, p[0]); zmax = Math.max(zmax, p[0]); }); });
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
  // `alive[k][i]`: the number of leading alive points of rays[k][i], an integer in 0..len; absent means all.
  if (L.alive != null) {
    if (!Array.isArray(L.alive) || L.alive.length !== L.rays.length) throw new Error("layout2D: alive needs one array per fan (" + L.rays.length + ")");
    L.alive.forEach(function (row, k) {
      if (!Array.isArray(row) || row.length !== L.rays[k].length) throw new Error("layout2D: alive[" + k + "] needs one count per ray of fan " + k + " (" + L.rays[k].length + ")");
      row.forEach(function (a, i) { if (!Number.isInteger(a) || a < 0 || a > L.rays[k][i].length) throw new Error("layout2D: alive[" + k + "][" + i + "] is not an integer in 0.." + L.rays[k][i].length); });
    });
  }
  // `dead[k][i]`: true where ray i of fan k was blocked at point a = alive[k][i] (< len); it is drawn solid through that point, no dotted part.
  if (L.dead != null) {
    if (L.alive == null) throw new Error("layout2D: dead comes only with alive");
    if (!Array.isArray(L.dead) || L.dead.length !== L.rays.length) throw new Error("layout2D: dead needs one array per fan (" + L.rays.length + ")");
    L.dead.forEach(function (row, k) {
      if (!Array.isArray(row) || row.length !== L.rays[k].length) throw new Error("layout2D: dead[" + k + "] needs one flag per ray of fan " + k + " (" + L.rays[k].length + ")");
      row.forEach(function (d, i) {
        if (typeof d !== "boolean") throw new Error("layout2D: dead[" + k + "][" + i + "] is not a boolean");
        if (d && !(L.alive[k][i] < L.rays[k][i].length)) throw new Error("layout2D: dead[" + k + "][" + i + "] is true but alive[" + k + "][" + i + "] is not below the ray's length");
      });
    });
  }
  if (o.labels != null && !Array.isArray(o.labels)) throw new Error("layout2D: labels must be an array (a string or null per fan)");
  if (o.labels && o.labels.length > L.rays.length) throw new Error("layout2D: labels has " + o.labels.length + " entries for " + L.rays.length + " fans");
  var S = L.surfaces;
  S.forEach(function (x, i) { var e = badProfile(x); if (e) throw new Error("layout2D: surface " + i + e); });
  S.forEach(function (x, i) { if (x.hole != null && !(typeof x.hole === "number" && x.hole >= 0 && x.hole < x.sd)) throw new Error("layout2D: surfaces[" + i + "].hole is not a number from 0 up to, but below, sd"); });
  var B = o.box != null ? o.box : layoutBounds([L]);
  // A drawable box: finite, with room in z and y (`!(a < b)` also catches NaN).
  if (!B || ![B.zmin, B.zmax, B.ylo, B.yhi].every(Number.isFinite) || !(B.zmin < B.zmax) || !(B.ylo < B.yhi)) throw new Error("layout2D: box needs finite zmin < zmax and ylo < yhi");
  // The drawing is padded 2 px in z at each end (more than half the widest stroke, --stroke-curve), so the image line and the ray caps sit inside the viewBox.
  // Labels start 6 px past the image plane, so the right end keeps room = 6 + 6 px a character of the longest non-null one
  // (0 without), whatever its fan holds: the same box, width and labels give one scale. A null entry draws no label.
  var drawn = (o.labels || []).map(function (t) { return t != null ? String(t).length : 0; }).filter(Boolean);
  var W = o.width || 1000, PAD = 2, room = drawn.length ? 6 + 6 * Math.max.apply(null, drawn) : 0, s = (W - 2 * PAD - room) / (B.zmax - B.zmin);
  // A width the pad and the label room fill leaves no scale (a negative one mirrors the drawing); `!(a > 0)` also catches NaN.
  if (!(W - 2 * PAD - room > 0)) throw new Error("layout2D: width too narrow for the 4 px pad and the labels");
  // Room above the geometry for the labels, 15 px whatever the stops reach, so one box gives one transform.
  var top = 15;
  var H = Math.round((B.yhi - B.ylo) * s + top) + 27, tx = PAD - B.zmin * s, ty = top + B.yhi * s;
  function n(v) { return +v.toFixed(3); }
  function pts(r) { return r.map(function (p) { return n(p[0]) + "," + n(p[1]); }).join(" "); }
  function X(z) { return (z * s + tx).toFixed(2); } function Y(y) { return (ty - y * s).toFixed(2); }
  function line(z1, y1, z2, y2, rest) { return '<line x1="' + n(z1) + '" y1="' + n(y1) + '" x2="' + n(z2) + '" y2="' + n(y2) + '" ' + rest + " " + NS + "/>"; }
  var M = +s.toFixed(6), g = '<g transform="matrix(' + M + " 0 0 " + -M + " " + +tx.toFixed(3) + " " + +ty.toFixed(3) + ')">';
  g += line(B.zmin + 1, 0, B.zmax - 1, 0, 'stroke="var(--plot-axis)" style="stroke-width:var(--stroke-hair)" stroke-dasharray="4 6"');
  // A {name, nd, vd} glass fills per name (glassFill over drawnGlasses, the rule glassLegend uses), through style: a CSS color function
  // in a presentation attribute is not safe. A style with var() is never dropped, so the fill attribute never applies to these;
  // glassFill falls back from the band tokens to crown and flint itself. "crown" and "flint" draw as before.
  var fills = glassFill(drawnGlasses(S)), bodies = ""; // mirror bodies, drawn after the rays (CR #381)
  S.forEach(function (a, i) {
    var b = S[i + 1], obj = a.glass && typeof a.glass === "object";
    if (a.glass && b) g += '<polygon points="' + pts(a.profile.concat(b.profile.slice().reverse())) + '" fill="var(--glass-' + (a.glass === "flint" ? "flint" : "crown") + ')" stroke="var(--glass-edge)" style="' + (obj ? "fill:" + fills.get(a.glass.name) + ";" : "") + 'stroke-width:var(--stroke-edge)" stroke-linejoin="round" ' + NS + "/>";
    // A mirror is a --mech body with a flat back (CR #371), drawn after the ray group (CR #381), hatched at 45 degrees every 32 px (mock A); its clipPath id is a hash of its points, so it is
    // deterministic and one polygon never gets two ids. An obscuration is an opaque bar from -sd to +sd (CR #360; the image line's ink and width),
    // left out when it lies within a mirror body (its z inside, its sd from the mirror's hole up to the mirror's sd).
    if (a.mirror) mirrorBodies(L, i).forEach(function (b) {
      var P = pts(b), id = "eleo-m", zs = b.map(function (p) { return p[0]; }), ys = b.map(function (p) { return p[1]; }), z0 = Math.min.apply(null, zs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), d = "";
      for (var j = 0, h = 5381; j < P.length; j++) h = (h * 33 ^ P.charCodeAt(j)) >>> 0;
      id += h.toString(36);
      for (var k = z0 - (y1 - y0); k <= Math.max.apply(null, zs); k += 32 / s) d += "M" + n(k) + "," + n(y0) + "L" + n(k + y1 - y0) + "," + n(y1);
      bodies += '<clipPath id="' + id + '"><polygon points="' + P + '"/></clipPath><polygon points="' + P + '" fill="var(--mech)" stroke="var(--mech-edge)" style="stroke-width:var(--stroke-edge)" stroke-linejoin="round" ' + NS + '/>'
        + '<path d="' + d + '" clip-path="url(#' + id + ')" fill="none" stroke="var(--mech-edge)" style="stroke-width:var(--stroke-hair)" ' + NS + "/>";
    });
    if (a.obscuration && !S.some(function (m, j) { return m.mirror && Math.abs(a.sd) <= m.sd && Math.abs(a.sd) >= (m.hole || 0) && mirrorBodies(L, j).some(function (b) { return a.z >= Math.min.apply(null, b.map(function (p) { return p[0]; })) - 1e-9 && a.z <= Math.max.apply(null, b.map(function (p) { return p[0]; })) + 1e-9; }); })) g += line(a.z, -a.sd, a.z, a.sd, 'stroke="var(--ink)" style="stroke-width:var(--stroke-curve)" stroke-linecap="round"');
    if (standalone(S, i)) [1, -1].forEach(function (k) { g += line(a.z, k * a.sd, a.z, k * (a.sd + 2.5), 'stroke="var(--ink)" style="stroke-width:var(--stroke-edge)" stroke-linecap="round"'); });
  });
  var RAYS = movedStarts(L), ends = [], img = S.filter(function (x) { return x.image; })[0];
  // One group holds every ray, so its opacity does not darken where rays cross (a per-polyline stroke-opacity would).
  g += '<g opacity=".85">';
  RAYS.forEach(function (rays, k) {
    if (!rays.length) return; // every ray of this fan was dead: layout.py dropped them all
    var c = chiefOf(L, k), pick = set === "fan" ? rays.map(function (_, i) { return i; }) : set === "chief" ? [c] : [0, c, rays.length - 1];
    pick.filter(function (i, j) { return pick.indexOf(i) === j; }).forEach(function (i) {
      // A ray with a < len alive points is two polylines sharing point a - 1: [0, a) as before, [max(a - 1, 0), len) dotted.
      var r = rays[i], a = L.alive ? L.alive[k][i] : r.length;
      function part(q, dash) { return '<polyline points="' + pts(q) + '" fill="none" stroke="' + idx(k) + '" style="stroke-width:1px" stroke-linecap="round" stroke-linejoin="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : "") + " " + NS + "/>"; }
      // A dead ray is one polyline through its blocking point a, with no dotted part (a chief keeps its 6 4 dash).
      if (L.dead && L.dead[k][i]) { g += part(r.slice(0, a + 1), i === c && set !== "chief" ? "6 4" : ""); return; }
      if (a > 0) g += part(r.slice(0, a), i === c && set !== "chief" ? "6 4" : "");
      if (a < r.length) g += part(r.slice(Math.max(a - 1, 0)), "1 3");
    });
    ends[k] = rays[c][rays[c].length - 1];
  });
  g += "</g>" + bodies;
  if (img) g += line(img.z, Math.min(img.sd, B.yhi), img.z, Math.max(-img.sd, B.ylo), 'stroke="var(--ink)" style="stroke-width:var(--stroke-curve)" stroke-linecap="round"');
  g += "</g>";
  // A text's baseline 5 px above y (mm), kept 10 px inside the top.
  function above(y) { return +Math.max(10, Y(y) - 5).toFixed(2); }
  function label(z, py, t, anchor) { return '<text ' + TICK + ' x="' + (anchor ? z.toFixed(2) : X(z)) + '" y="' + py.toFixed(2) + '" text-anchor="' + (anchor || (X(z) < 16 ? "start" : X(z) > W - 16 ? "end" : "middle")) + '">' + t + "</text>"; }
  // Each field's label starts 6 px past the image plane (its own chief end's z with no image surface), its baseline 4 px
  // below its chief's end; the room kept on the right keeps its text inside the pad. An empty fan or a null label draws none.
  var tags = [];
  (o.labels || []).forEach(function (t, k) { if (ends[k] && t != null) tags.push({ x: +X(img ? img.z : ends[k][0]) + 6, py: +Y(ends[k][1]) + 4, t: esc(t) }); });
  if (o.marks !== false) {
    S.forEach(function (x, i) { if (x.stop) g += label(x.z, above(reach(S, i)), "STO"); });
    if (img) {
      // With labels, IMA goes below the image line's lower end and a 12 px line below the lowest label.
      // Its baseline drops the text's height (9 px: the ascent of plots.css `.eleo-tick`'s 10 px font) plus the 5 px gap `above` leaves.
      var IMA_DROP = 9 + 5, ys = tags.map(function (a) { return a.py; });
      g += label(img.z, ys.length ? Math.max(+Y(Math.max(-img.sd, B.ylo)) + IMA_DROP, Math.max.apply(null, ys) + 12) : above(img.sd), "IMA");
    }
  }
  tags.forEach(function (a) { g += label(a.x, a.py, a.t, "start"); });
  var sb = 10 * s, by = H - 8;
  g += '<path d="M8,' + (by - 4) + " V" + (by + 4) + " M8," + by + " H" + (8 + sb).toFixed(1) + " M" + (8 + sb).toFixed(1) + "," + (by - 4) + " V" + (by + 4) + '" fill="none" stroke="var(--ink)" style="stroke-width:var(--stroke-edge)" ' + NS + '/><text ' + TICK + ' x="' + (16 + sb).toFixed(1) + '" y="' + (by + 3) + '">10 mm</text>';
  return svg(W, H, g, "Lens layout, YZ section, true scale, colored by " + colorBy);
}
