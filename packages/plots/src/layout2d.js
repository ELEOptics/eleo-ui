// layout2D on the recorded format (eleoptics.com's scripts/layout.py, plus optional `chief`, `alive`, `dead` and the surface flags `mirror`, `hole` and `obscuration`):
// {surfaces: [{z, sd, stop, image, glass, profile: [[z, y] × 41], mirror?, hole?, obscuration?}], rays: [field][ray][[z, y]…], chief?: number[], alive?: number[][], dead?: boolean[][]}, in mm.
// Geometry is drawn in mm inside one <g transform="matrix(s 0 0 -s tx ty)">; text and the scale bar in px.
import { idx, svg, NS, esc } from './common.js';
import { glassFill, drawnGlasses } from './glass.js';
import { layoutText, layoutWeight } from './scale.js';
import { keyLayout, keyMarkup } from './key.js';
import { vertexRadius, thickLensF } from './lens.js';

// plots.css `.eleo-tick` as presentation attributes, so the standalone entry needs only tokens.css; any CSS rule still wins over them.
// The size is an inline style on each text (ADR-0003), since the class's size would beat an attribute.
var TICK = 'class="eleo-tick" fill="var(--ink-muted)" font-family="var(--font-mono)" font-weight="400"';
// A label's width in characters: an East Asian wide or fullwidth character counts two (#156).
var WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{20000}-\u{3fffd}]/gu;
// Its length with each wide character doubled.
function cells(t) { return String(t).replace(WIDE, "  ").length; }

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
// A stop's bar runs from ±sd out to ±(sd + 2.5); on a glass surface it stops at the box (the glass already reaches sd), so it stays in view.
function stopEnd(S, i, k, B) { var e = S[i].sd + 2.5; return standalone(S, i) ? k * e : k > 0 ? Math.min(e, Math.max(B.yhi, S[i].sd)) : Math.max(-e, Math.min(B.ylo, -S[i].sd)); }
// A lens stop reaches its profile edge, |profile[0][1]| (layoutBounds' rule), so its label clears the glass.
function reach(S, i) { return standalone(S, i) ? S[i].sd + 2.5 : Math.abs(S[i].profile[0][1]); }

// The status of each point of rays[k][i], "Alive", "Virtual" or "Dead": `status` when present, else Alive below `alive`, Virtual from it, and with `dead`
// Dead at the blocking point; every point Alive with neither. null where the layout's shape does not reach this ray (layoutBounds runs unvalidated).
function statusOf(L, k, i) {
  var r = L.rays[k][i];
  if (L.status != null) { var s = L.status[k] && L.status[k][i]; return Array.isArray(s) ? s : null; }
  if (L.alive == null) return r.map(function () { return "Alive"; });
  var a = L.alive[k] && L.alive[k][i], d = L.dead && L.dead[k] && L.dead[k][i];
  return a == null ? null : r.map(function (_, j) { return d && j === a ? "Dead" : j < a ? "Alive" : "Virtual"; });
}
// A mirror's body: the profile plus a flat back D/8 (sd/4) behind its far z, on the side away from the light, with |y| < hole left open.
// The light's way is the ray's step from its point at surface i to its point at surface i + 1 (rays carry one point per surface after their start;
// a mirror with no next point takes its incoming step), from a ray alive past the mirror before any ray. A polygon per side of the hole, or one.
function mirrorBodies(L, i) {
  var a = L.surfaces[i], t = a.sd / 4, dir = 0, h = a.hole > 0 ? a.hole : 0;
  // A ray alive past the mirror first (its point i + 2 drawn and not Virtual): a virtual tail may run any way.
  [true, false].forEach(function (strict) { L.rays.forEach(function (fan, k) { fan.forEach(function (r, j) {
    var st = dir ? null : statusOf(L, k, j);
    if (dir || !st) return;
    if (strict && (st[i + 2] === "Virtual" || (st.indexOf("Dead") >= 0 && st.indexOf("Dead") < i + 2))) return;
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
// the other points stay. A fan that is not collimated keeps its starts. Collimation is decided over the layout: a one-ray fan moves only when some fan of two or
// more rays is collimated. With no non-image geometry nothing moves. Returns the rays, the layout's own when nothing moves.
function movedStarts(L) {
  var S = L.surfaces, dirs = [], cz = [], geo = [], sd = 0, R = -Infinity, multi = false;
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
    if (ok && fan.length > 1) multi = true;
  });
  if (!multi) return L.rays;
  L.rays.forEach(function (fan, k) {
    if (!dirs[k]) return;
    var ci = L.chief && L.chief[k], r = fan[Number.isInteger(ci) && fan[ci] ? ci : Math.floor(fan.length / 2)];
    var h = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), dy = (r[1][1] - r[0][1]) / h; // the chief's own first segment
    if (Math.abs(dy) > 1e-9) cz.push(r[0][0] - r[0][1] * (r[1][0] - r[0][0]) / (r[1][1] - r[0][1]));
  });
  S.forEach(function (s, i) {
    if (s.image) return;
    if (s.sd > sd) sd = s.sd;
    geo = geo.concat(s.profile);
    if (s.mirror) mirrorBodies(L, i).forEach(function (b) { geo = geo.concat(b); });
  });
  if (!geo.length) return L.rays;
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

/* A port of eleo-website@39d19e4 public/layout.js bounds(), widened for mirrors: z from every ray point (the drawn, moved starts), every non-image profile and every mirror body (#367); y from 0, the rays and every
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
      // layout2D names a non-finite point itself, boxed or not, before layoutBounds.
      if (!r.every(finitePoint)) throw new Error("layout2D: fan " + k + " ray " + i + " has a non-finite point");
    });
  });
  if (!L.rays.some(function (fan) { return fan.length; })) throw new Error("layout2D: no rays");
  // One shape walk for alive, dead and status: one array per fan, one `what` per ray of each; `check(value, k, i)` is the leaf check.
  function perRay(name, what, check) {
    var v = L[name];
    if (!Array.isArray(v) || v.length !== L.rays.length) throw new Error("layout2D: " + name + " needs one array per fan (" + L.rays.length + ")");
    v.forEach(function (row, k) {
      if (!Array.isArray(row) || row.length !== L.rays[k].length) throw new Error("layout2D: " + name + "[" + k + "] needs one " + what + " per ray of fan " + k + " (" + L.rays[k].length + ")");
      row.forEach(function (x, i) { check(x, k, i); });
    });
  }
  // `alive[k][i]`: the number of leading alive points of rays[k][i], an integer in 0..len; absent means all; not validated when `status` is present.
  if (L.status == null && L.alive != null) perRay("alive", "count", function (a, k, i) {
    if (!Number.isInteger(a) || a < 0 || a > L.rays[k][i].length) throw new Error("layout2D: alive[" + k + "][" + i + "] is not an integer in 0.." + L.rays[k][i].length);
  });
  // `dead[k][i]`: true where ray i of fan k was blocked at point a = alive[k][i] (< len); it is drawn solid through that point, no dotted part.
  if (L.status == null && L.dead != null) {
    if (L.alive == null) throw new Error("layout2D: dead comes only with alive");
    perRay("dead", "flag", function (d, k, i) {
      if (typeof d !== "boolean") throw new Error("layout2D: dead[" + k + "][" + i + "] is not a boolean");
      if (d && !(L.alive[k][i] < L.rays[k][i].length)) throw new Error("layout2D: dead[" + k + "][" + i + "] is true but alive[" + k + "][" + i + "] is not below the ray's length");
    });
  }
  // `status[k][i][j]`: the status of point j of rays[k][i], "Alive", "Virtual" or "Dead"; when present, `alive` and `dead` are ignored.
  if (L.status != null) perRay("status", "array", function (pts, k, i) {
    if (!Array.isArray(pts) || pts.length !== L.rays[k][i].length) throw new Error("layout2D: status[" + k + "][" + i + "] needs one status per point (" + L.rays[k][i].length + ")");
    pts.forEach(function (st, j) { if (st !== "Alive" && st !== "Virtual" && st !== "Dead") throw new Error("layout2D: status[" + k + "][" + i + "][" + j + "] is not Alive, Virtual or Dead"); });
  });
  // `show`: the statuses drawn, default all three; bounds, the transform and mirror bodies read every point whatever it says.
  var show = o.show == null ? ["Alive", "Virtual", "Dead"] : o.show;
  if (!Array.isArray(show) || show.some(function (x) { return x !== "Alive" && x !== "Virtual" && x !== "Dead"; })) throw new Error("layout2D: show must be an array of Alive, Virtual or Dead");
  if (o.labels != null && !Array.isArray(o.labels)) throw new Error("layout2D: labels must be an array (a string or null per fan)");
  if (o.labels && o.labels.length > L.rays.length) throw new Error("layout2D: labels has " + o.labels.length + " entries for " + L.rays.length + " fans");
  var S = L.surfaces;
  S.forEach(function (x, i) { var e = badProfile(x); if (e) throw new Error("layout2D: surface " + i + e); });
  // badProfile exempts the image, but a glass before it still draws its polygon from that profile.
  S.forEach(function (x, i) { var e = x.glass && S[i + 1] && badProfile(Object.assign({}, S[i + 1], { image: false })); if (e) throw new Error("layout2D: surface " + (i + 1) + e); });
  S.forEach(function (x, i) { if (x.hole != null && !(typeof x.hole === "number" && x.hole >= 0 && x.hole < x.sd)) throw new Error("layout2D: surfaces[" + i + "].hole is not a number from 0 up to, but below, sd"); });
  var B = o.box != null ? o.box : layoutBounds([L]);
  // A drawable box: finite, with room in z and y (`!(a < b)` also catches NaN).
  if (!B || ![B.zmin, B.zmax, B.ylo, B.yhi].every(Number.isFinite) || !(B.zmin < B.zmax) || !(B.ylo < B.yhi)) throw new Error("layout2D: box needs finite zmin < zmax and ylo < yhi");
  // The drawing is padded 2 px in z at each end (more than half the widest stroke, --stroke-curve), so the image line and the ray caps sit inside the viewBox.
  // The text size is ADR-0003's layoutText(W), null (no label, mark or scale bar, and no room) below W = 630; u is that size over the class's 10 px, which scales every text offset.
  // Labels start 0.6 em past the image plane, so the right end keeps room = 0.6 em + 0.6 em a character of the longest non-null one
  // (0 without), wide characters counted double, whatever its fan holds: the same box, width and labels give one scale. A null entry draws no label.
  var W = o.width || 1000, tx0 = layoutText(W), u = (tx0 || 10) / 10;
  var drawn = tx0 ? (o.labels || []).map(function (t) { return t != null ? cells(t) : 0; }).filter(Boolean) : [];
  var PAD = 2, room = drawn.length ? 6 * u * (1 + Math.max.apply(null, drawn)) : 0, s = (W - 2 * PAD - room) / (B.zmax - B.zmin);
  // A width the pad and the label room fill leaves no scale (a negative one mirrors the drawing); `!(a > 0)` also catches NaN.
  if (!(W - 2 * PAD - room > 0)) throw new Error("layout2D: width too narrow for the 4 px pad and the labels");
  // Room above the geometry for the labels, 1.5 em whatever the stops reach, so one box gives one transform; the pad alone when the text is hidden. The scale bar's room below is 2.7 em.
  var top = tx0 ? 15 * u : PAD;
  var Hg = (B.yhi - B.ylo) * s + top + (tx0 ? 27 * u : PAD), tx = PAD - B.zmin * s, ty = top + B.yhi * s;
  // `key`: entries ({ label, index }: a line swatch in idx(index)) and "glass" (one swatch per distinct drawn glass, filled as glassLegend fills it), in one row that wraps at the pad, under the scale bar at the layout text size; not drawn below W = 630, with no room kept.
  var KP = 8 * u, kents = [], kl = null;
  if (o.key != null) {
    if (o.key !== "glass" && !Array.isArray(o.key)) throw new TypeError('layout2D: key must be "glass" or an array of entries');
    if (o.key !== "glass") o.key.forEach(function (e) {
      if (e === "glass") return;
      if (e === null || typeof e !== "object") throw new TypeError('layout2D: key entries are "glass" or objects');
      if (typeof e.label !== "string") throw new TypeError("layout2D: key entries need a string label");
      if (e.index !== undefined && (!Number.isInteger(e.index) || e.index < 0)) throw new TypeError("layout2D: key index must be a non-negative integer");
    });
  }
  if (o.key != null && tx0) {
    (o.key === "glass" ? ["glass"] : o.key).forEach(function (e) {
      if (e === "glass") { var gs = drawnGlasses(S), gf = glassFill(gs); new Set(gs.map(function (x) { return x.name; })).forEach(function (name) { kents.push({ label: name, col: gf.get(name) }); }); }
      else kents.push({ label: e.label, index: e.index, kind: "line" });
    });
    kl = keyLayout(kents, tx0, { L: KP, R: W - KP, maxRow: 1000 });
  }
  var H = Math.round(Math.round(Hg) + (kl && kl.rows ? tx0 * (1.4 * kl.rows - 0.4) + 0.6 * tx0 : 0));
  // `view`: { x: [zlo, zhi], y: [ylo, yhi] } in mm, the window the whole viewBox shows, fitted at the largest one scale and centred. An axis that is not a finite lo < hi pair keeps the box's
  // range, as curve's does; with no valid axis there is no view. The viewport is the viewBox, which clips the geometry; the height is the view-less one.
  var vr = function (a) { return Array.isArray(a) && a.length === 2 && Number.isFinite(a[0]) && Number.isFinite(a[1]) && a[0] < a[1] ? a : null; };
  var vx = o.view && vr(o.view.x), vy = o.view && vr(o.view.y), s0 = s;
  if (vx || vy) {
    var wz = vx || [B.zmin, B.zmax], wy = vy || [B.ylo, B.yhi];
    s = Math.min(W / (wz[1] - wz[0]), H / (wy[1] - wy[0]));
    tx = W / 2 - (wz[0] + wz[1]) / 2 * s; ty = H / 2 + (wy[0] + wy[1]) / 2 * s;
  }
  function n(v) { return +v.toFixed(3); }
  function pts(r) { return r.map(function (p) { return n(p[0]) + "," + n(p[1]); }).join(" "); }
  function X(z) { return (z * s + tx).toFixed(2); } function Y(y) { return (ty - y * s).toFixed(2); }
  function line(z1, y1, z2, y2, rest, surf) { return '<line x1="' + n(z1) + '" y1="' + n(y1) + '" x2="' + n(z2) + '" y2="' + n(y2) + '" ' + rest + (surf == null ? "" : ' data-surface="' + surf + '"') + " " + NS + "/>"; }
  var M = +s.toFixed(6), g = '<g data-view="layout" transform="matrix(' + M + " 0 0 " + -M + " " + +tx.toFixed(3) + " " + +ty.toFixed(3) + ')">';
  g += line(B.zmin + 1, 0, B.zmax - 1, 0, 'stroke="var(--plot-axis)" style="stroke-width:var(--stroke-hair)" stroke-dasharray="4 6"');
  // A {name, nd, vd} glass fills per name (glassFill over drawnGlasses, the rule glassLegend uses), through style: a CSS color function
  // in a presentation attribute is not safe. A style with var() is never dropped, so the fill attribute never applies to these;
  // glassFill falls back from the band tokens to crown and flint itself. "crown" and "flint" draw as before.
  var fills = glassFill(drawnGlasses(S)), bodies = "", element = 0; // mirror bodies, drawn after the rays (CR #381)
  // CR #958: a glass polygon's element properties as data-* (1-based over glass polygons). r1 and r2 may read "Infinity" (a flat surface); any other non-finite value is left out.
  function elementAttrs(a, b) {
    var named = typeof a.glass === "object", name = named ? a.glass.name : a.glass, r1 = vertexRadius(a.profile), r2 = vertexRadius(b.profile), vz = function (p) { return p.reduce(function (v, q) { return Math.abs(q[1]) < Math.abs(v[1]) ? q : v; })[0]; };
    var ct = vz(b.profile) - vz(a.profile), d = 2 * Math.max.apply(null, a.profile.concat(b.profile).map(function (q) { return Math.abs(q[1]); }));
    var out = ' data-element="' + ++element + '" data-glass="' + esc(name) + '"';
    function put(k, v, inf) { if (Number.isFinite(v) || (inf && v === Infinity)) out += " data-" + k + '="' + v + '"'; }
    if (named) { put("nd", a.glass.nd); put("vd", a.glass.vd); }
    put("r1", r1, true); put("r2", r2, true); put("ct", ct); put("diameter", d);
    if (named) put("f", thickLensF(a.glass.nd, r1, r2, ct));
    return out;
  }
  S.forEach(function (a, i) {
    var b = S[i + 1], obj = a.glass && typeof a.glass === "object";
    if (a.glass && b) g += '<polygon points="' + pts(a.profile.concat(b.profile.slice().reverse())) + '" fill="var(--glass-' + (a.glass === "flint" ? "flint" : "crown") + ')" stroke="var(--glass-edge)" style="' + (obj ? "fill:" + fills.get(a.glass.name) + ";" : "") + 'stroke-width:var(--stroke-edge)" stroke-linejoin="round" data-surface="' + i + '"' + elementAttrs(a, b) + " " + NS + "/>";
    // A mirror is a --mech body with a flat back (CR #371), drawn after the ray group (CR #381), hatched at 45 degrees every 32 px (mock A); its clipPath id is a hash of its points, so it is
    // deterministic and one polygon never gets two ids. An obscuration is an opaque bar from -sd to +sd (CR #360; the image line's ink and width),
    // left out when it lies within a mirror body (its z inside, its sd from the mirror's hole up to the mirror's sd).
    if (a.mirror) mirrorBodies(L, i).forEach(function (b) {
      var P = pts(b), id = "eleo-m", zs = b.map(function (p) { return p[0]; }), ys = b.map(function (p) { return p[1]; }), z0 = Math.min.apply(null, zs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), d = "";
      for (var j = 0, h = 5381; j < P.length; j++) h = (h * 33 ^ P.charCodeAt(j)) >>> 0;
      id += h.toString(36);
      for (var k = z0 - (y1 - y0); k <= Math.max.apply(null, zs); k += 32 / s) d += "M" + n(k) + "," + n(y0) + "L" + n(k + y1 - y0) + "," + n(y1);
      bodies += '<clipPath id="' + id + '"><polygon points="' + P + '"/></clipPath><polygon points="' + P + '" fill="var(--mech)" stroke="var(--mech-edge)" style="stroke-width:var(--stroke-edge)" stroke-linejoin="round" data-surface="' + i + '" ' + NS + '/>'
        + '<path d="' + d + '" clip-path="url(#' + id + ')" fill="none" stroke="var(--mech-edge)" style="stroke-width:var(--stroke-hair)" ' + NS + "/>";
    });
    if (a.obscuration && !S.some(function (m, j) { return m.mirror && Math.abs(a.sd) <= m.sd && Math.abs(a.sd) >= (m.hole || 0) && mirrorBodies(L, j).some(function (b) { return a.z >= Math.min.apply(null, b.map(function (p) { return p[0]; })) - 1e-9 && a.z <= Math.max.apply(null, b.map(function (p) { return p[0]; })) + 1e-9; }); })) g += line(a.z, -a.sd, a.z, a.sd, 'stroke="var(--ink)" style="stroke-width:var(--stroke-curve)" stroke-linecap="round"', i);
    if (a.stop) [1, -1].forEach(function (k) { var m = k * a.sd, e = stopEnd(S, i, k, B); if (e - m) g += line(a.z, m, a.z, e, 'stroke="var(--ink)" style="stroke-width:var(--stroke-edge)" stroke-linecap="round"', i); });
  });
  var RAYS = movedStarts(L), ends = [], img = S.filter(function (x) { return x.image; })[0], imgAt = S.indexOf(img);
  // One group per opacity, so it does not darken where rays cross (a per-polyline stroke-opacity would). With `status`, Virtual and Dead runs go in a faded
  // group placed first, so live light sits on top; a layout without `status` has none and draws as it always did.
  var live = "", faded = "";
  RAYS.forEach(function (rays, k) {
    if (!rays.length) return; // every ray of this fan was dead: layout.py dropped them all
    var c = chiefOf(L, k), pick = set === "fan" ? rays.map(function (_, i) { return i; }) : set === "chief" ? [c] : [0, c, rays.length - 1];
    pick.filter(function (i, j) { return pick.indexOf(i) === j; }).forEach(function (i) {
      // With `status` the ray is drawn to its last point, else through its first Dead point and no further; segment j (point j - 1 to j) takes point j - 1's status with `status` (CR #663), else point j's. With `status`
      // each run of one status is a polyline with data-status; without it adjacent solid runs (Alive and Dead) join and Virtual runs are dotted (a chief's solid runs keep their 6 4 dash).
      var r = rays[i], st = statusOf(L, k, i), end = L.status || st.indexOf("Dead") < 0 ? r.length - 1 : st.indexOf("Dead"), runs = [];
      for (var j = 1; j <= end; j++) {
        var sj = L.status ? st[j - 1] : st[j], last = runs[runs.length - 1];
        if (show.indexOf(sj) < 0) { runs.push(null); continue; } // a hidden segment is a gap: no run continues over it
        if (last && (L.status ? last.st === sj : (last.st === "Virtual") === (sj === "Virtual"))) last.q.push(r[j]);
        else runs.push({ st: sj, q: [r[j - 1], r[j]] });
      }
      // Without `status` the legacy head stays: a lone solid point before the dots, or a ray with no segment. With it a run needs a segment.
      runs = runs.filter(Boolean);
      if (!L.status && st[0] !== "Virtual" && show.indexOf(st[0]) >= 0 && (!runs.length || runs[0].st === "Virtual")) runs.unshift({ st: st[0], q: [r[0]] });
      // A one-point ray with alive 0 is Virtual throughout: its lone point stays a dotted run, as before the status.
      if (!L.status && r.length === 1 && st[0] === "Virtual" && show.indexOf("Virtual") >= 0) runs.push({ st: "Virtual", q: [r[0]] });
      runs.forEach(function (u) {
        var dash = u.st === "Virtual" ? "1 3" : i === c && set !== "chief" ? "6 4" : "";
        var poly = '<polyline points="' + pts(u.q) + '" fill="none" stroke="' + idx(k) + '" style="stroke-width:' + n(layoutWeight(W)) + 'px" stroke-linecap="round" stroke-linejoin="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : "") + (L.status ? ' data-status="' + u.st + '"' : "") + ' data-field="' + k + '" data-ray="' + i + '" ' + NS + "/>";
        if (L.status && u.st !== "Alive") faded += poly; else live += poly;
      });
    });
    ends[k] = rays[c][rays[c].length - 1];
  });
  g += (faded ? '<g opacity=".35">' + faded + "</g>" : "") + '<g opacity=".85">' + live + "</g>" + bodies;
  if (img) g += line(img.z, Math.min(img.sd, B.yhi), img.z, Math.max(-img.sd, B.ylo), 'stroke="var(--ink)" style="stroke-width:var(--stroke-curve)" stroke-linecap="round"', imgAt);
  g += "</g>";
  if (!tx0) return svg(W, H, g, "Lens layout, YZ section, true scale, colored by " + colorBy);
  var tsz = ' style="font-size:' + n(tx0) + 'px"';
  // A text's baseline 0.5 em above y (mm), kept 1 em inside the top.
  function above(y) { return n(Math.max(10 * u, Y(y) - 5 * u)); }
  function label(z, py, t, anchor) { return '<text ' + TICK + ' x="' + (anchor ? n(z) : X(z)) + '" y="' + n(py) + '" text-anchor="' + (anchor || (X(z) < 16 * u ? "start" : X(z) > W - 16 * u ? "end" : "middle")) + '"' + tsz + '>' + t + "</text>"; }
  // Each field's label starts 6 px past the image plane (its own chief end's z with no image surface), its baseline 4 px
  // below its chief's end, never above 1 em from the top (a cropping box, #160); the room kept on the right keeps its text inside the pad. An empty fan or a null label draws none.
  var tags = [];
  (o.labels || []).forEach(function (t, k) { if (ends[k] && t != null) tags.push({ x: +X(img ? img.z : ends[k][0]) + 6 * u, q: +Y(ends[k][1]) + 4 * u, t: esc(t) }); });
  // Labels keep the drawing's top-to-bottom order (their unclamped baselines) and clear each other: top to bottom, a label within 1 em of a clamped or pushed one above (its baseline below the unclamped one) sits 1 em below it (#669, #798). With no clamped label nothing moves.
  tags.slice().sort(function (a, b) { return a.q - b.q; }).forEach(function (a, j, v) { var p = v[j - 1]; a.py = Math.max(10 * u, a.q, p && p.py > p.q ? p.py + 10 * u : 0); });
  if (o.marks !== false) {
    S.forEach(function (x, i) { if (x.stop) g += label(x.z, above(Math.max(reach(S, i), stopEnd(S, i, 1, B))), "STO"); });
    if (img) {
      // With labels, IMA goes below the image line's lower end and a 12 px line below the lowest label.
      // Its baseline drops the text's height (0.9 em: the ascent of plots.css `.eleo-tick`'s font) plus the 0.5 em gap `above` leaves.
      var ys = tags.map(function (a) { return a.py; });
      g += label(img.z, ys.length ? Math.max(+Y(Math.max(-img.sd, B.ylo)) + 14 * u, Math.max.apply(null, ys) + 12 * u) : above(img.sd), "IMA");
    }
  }
  tags.forEach(function (a) { g += label(a.x, a.py, a.t, "start"); });
  var Hd = Math.round(Hg), by = Hd - 8 * u;
  // 10 mm; zoomed, the longest 1-2-5 mm length no longer than the px that 10 mm takes at the first scale.
  var bar = 10;
  if (vx || vy) { var e = Math.floor(Math.log10(10 * s0 / s)); bar = [5, 2, 1].map(function (m) { return m * Math.pow(10, e); }).concat([5 * Math.pow(10, e - 1)]).filter(function (v) { return v * s <= 10 * s0 + 1e-9; })[0]; }
  g += '<path d="M' + n(8 * u) + "," + n(by - 4 * u) + "v" + n(8 * u) + "m0," + n(-4 * u) + "h" + n(bar * s) + "m0," + n(-4 * u) + "v" + n(8 * u) + '" fill="none" stroke="var(--ink)" style="stroke-width:var(--stroke-edge)" ' + NS + '/><text ' + TICK + ' x="' + n(bar * s + 16 * u) + '" y="' + n(by + 3 * u) + '"' + tsz + '>' + +bar.toPrecision(6) + ' mm</text>';
  if (kl && kl.rows) g += keyMarkup(kl.places, kents, tx0, Hd, { mark: true });
  return svg(W, H, g, "Lens layout, YZ section, true scale, colored by " + colorBy);
}
