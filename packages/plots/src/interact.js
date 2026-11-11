// Pointer interaction on a drawn plot. The listeners sit on the host, not on the marks: a redraw replaces the markup, and a host listener survives it.
import { fmt } from "./color.js";
var TIP_GAP = 14; // px between the pointer and the tooltip
var REACH = 24; // client px: a pointer farther than this from every point and segment hovers nothing
var SNAP = 6; // client px: within this of a point the hover is that point, not the line beside it

/* The drawn points of a polyline or path, in data coordinates: `p` the finite [x, y] pairs in order and `join[i]` true when p[i] continues the run of p[i - 1], so a segment joins them. A polyline is one run of the browser's own parse of its points (`mark.points`), so hover follows whatever that browser draws (Chromium parses none of a list holding a NaN). A path's `d` is parsed here: its `M` starts a new run, and so does a pair with a non-finite coordinate, which is dropped whole so it never shifts the pairs after it; `h0` dots add no point. */
function runs(mark) {
  var p = [], join = [], open = false; // `open`: the previous pair was kept and ended a run still open
  if (mark.points) {
    for (var k = 0; k < mark.points.numberOfItems; k++) {
      var q = mark.points.getItem(k);
      if (isFinite(q.x) && isFinite(q.y)) { p.push([q.x, q.y]); join.push(open); open = true; } else open = false;
    }
    return { p: p, join: join };
  }
  (mark.getAttribute("d") || "").split(/(?=[ML])/).forEach(function (t) {
    if (t.charAt(0) === "M") open = false;
    var n = t.replace(/h\s*-?[\d.]+/g, " ").replace(/[ML]/g, " ").split(/[\s,]+/).filter(Boolean).map(Number);
    for (var i = 0; i + 1 < n.length; i += 2) {
      if (isFinite(n[i]) && isFinite(n[i + 1])) { p.push([n[i], n[i + 1]]); join.push(open); open = true; } else open = false;
    }
  });
  return { p: p, join: join };
}

/* The mm data group a hoverable mark is drawn in: its nearest matrix group. Every hoverable mark (series paths and polylines, bar rects, layout2D ray runs below their opacity group) sits inside one. */
function dataGroup(mark) { return mark.closest('g[transform^="matrix("]'); }

/* The data window a group's nested viewport clips to, as a test on a data point: the viewport's width and height through the group's matrix. Half a client px of slack keeps a point on the frame's edge in. Always true where there is no matrix or no finite viewport (a layout has no frame). */
function inFrameOf(g, m) {
  var vp = g.closest("svg"), t = g.transform.baseVal.consolidate();
  if (!vp || !t || !vp.hasAttribute("width")) return function () { return true; };
  var a = t.matrix.a, d = t.matrix.d, e = t.matrix.e, f = t.matrix.f, w = +vp.getAttribute("width"), h = +vp.getAttribute("height");
  if (!(a && d && isFinite(a + d + e + f + w + h))) return function () { return true; };
  var x0 = Math.min(-e / a, (w - e) / a), x1 = Math.max(-e / a, (w - e) / a), y0 = Math.min(-f / d, (h - f) / d), y1 = Math.max(-f / d, (h - f) / d), ex = 0.5 / Math.abs(m.a), ey = 0.5 / Math.abs(m.d);
  return function (x, y) { return x >= x0 - ex && x <= x1 + ex && y >= y0 - ey && y <= y1 + ey; };
}

/* The hovered spot for the client position, through the inverse of each data group's screen matrix, or null. Within SNAP client px of a drawn point it is that point (the nearest one). Otherwise it is the nearest spot within REACH of a drawn segment (between consecutive points of one run), the pointer projected onto the segment and clamped to it, its data coordinates linearly interpolated, with `interpolated` and `segment` [i, i + 1] (indices into the mark's finite points); a point with no segment (a dot) is hovered within REACH as itself. A bar is hovered inside its rect, or within SNAP client px of its value end inside its x span (a zero-height bar too), the nearest end winning, and it beats a point or a segment. A pointer outside a curve's or spot's frame (a zoomed plot's clipped window) hovers nothing, and so does one outside a map's drawn window. */
function nearest(host, cx, cy) {
  var snap = null, best = null, bar = null;
  host.querySelectorAll("[data-series], polyline[data-ray]").forEach(function (mark) {
    var g = dataGroup(mark), m = g && g.getScreenCTM();
    if (!m) return;
    var at = new DOMPoint(cx, cy).matrixTransform(m.inverse()), inside = mark.dataset.ray !== undefined || mark.localName === "rect" ? function () { return true; } : inFrameOf(g, m);
    if (!inside(at.x, at.y)) return; // the pointer is outside the clipped frame: a zoomed curve's points out there are not drawn
    if (mark.localName === "rect") { // a bar is hovered with the pointer inside its box or within SNAP client px of its value end inside its x span (so a bar under a pixel tall, or of zero height, can be); its value is its y when below zero, else its height, and the bar whose value end is nearest wins
      var rx = +mark.getAttribute("x"), ry = +mark.getAttribute("y"), rw = +mark.getAttribute("width"), rh = +mark.getAttribute("height");
      var v = ry < 0 ? ry : rh, dv = Math.abs(at.y - v) * Math.abs(m.d);
      if (at.x >= rx && at.x <= rx + rw && ((at.y >= ry && at.y <= ry + rh) || dv <= SNAP) && (!bar || dv < bar.d)) bar = { d: dv, mark: mark, index: 0, bar: true, x: +mark.dataset.category, y: v, px: rx + rw / 2 };
      return;
    }
    var r = runs(mark), p = r.p;
    var linked = function (i) { return r.join[i] || r.join[i + 1]; };
    p.forEach(function (q, i) {
      var d = Math.hypot((q[0] - at.x) * m.a, (q[1] - at.y) * m.d), c = { d: d, mark: mark, index: i, x: q[0], y: q[1] };
      if (!inside(q[0], q[1])) return;
      if (d <= SNAP && (!snap || d < snap.d)) snap = c;
      if (d <= REACH && !linked(i) && (!best || d < best.d)) best = c;
    });
    for (var i = 1; i < p.length; i++) {
      if (!r.join[i]) continue;
      var ax = p[i - 1][0] * m.a, ay = p[i - 1][1] * m.d, vx = p[i][0] * m.a - ax, vy = p[i][1] * m.d - ay, len = vx * vx + vy * vy;
      var t = len ? Math.max(0, Math.min(1, ((at.x * m.a - ax) * vx + (at.y * m.d - ay) * vy) / len)) : 0;
      var d = Math.hypot(ax + t * vx - at.x * m.a, ay + t * vy - at.y * m.d);
      var sx = p[i - 1][0] + t * (p[i][0] - p[i - 1][0]), sy = p[i - 1][1] + t * (p[i][1] - p[i - 1][1]);
      if (d <= REACH && inside(sx, sy) && (!best || d < best.d)) best = { d: d, mark: mark, index: i - 1, x: sx, y: sy, segment: [i - 1, i] };
    }
  });
  return bar || snap || best;
}

/* The sample of a typed map under the client position, or null: the map's `<image>` holds its extent and shape (`data-extent`, and `data-rows` and `data-columns` or, polar, `data-radii` and `data-angles`). A grid cell is { row, column } (rows top-down) at its centre; a polar sample is { ring, spoke } at its radius and angle, the nearest sample as map2D draws it (a ring ends midway to the next radius, the last half a step past the outer one). `x`, `y` are in the extent's data units. Nothing outside the image, or past the outer ring. */
function mapAt(host, cx, cy) {
  var img = host.querySelector("image[data-extent]"), m = img && img.getScreenCTM && img.getScreenCTM();
  if (!m) return null;
  if (img.hasAttribute("data-range") && !pick(host, cx, cy)) return null; // a zoomed map's image extends past its clipped frame
  var at = new DOMPoint(cx, cy).matrixTransform(m.inverse()), w = +img.getAttribute("width"), h = +img.getAttribute("height");
  var fx = (at.x - +img.getAttribute("x")) / w, fy = (at.y - +img.getAttribute("y")) / h;
  if (!(fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1)) return null;
  var e = img.dataset.extent.split(" ").map(Number), x = e[0] + fx * (e[1] - e[0]), y = e[3] - fy * (e[3] - e[2]);
  if (img.dataset.radii) {
    var pr = img.dataset.radii.split(" ").map(Number), pa = img.dataset.angles.split(" ").map(Number), n = pr.length, rr = Math.hypot(x, y), TAU = 2 * Math.PI;
    if (rr > pr[n - 1] + (n > 1 ? pr[n - 1] - pr[n - 2] : pr[0]) / 2) return null;
    var ring = 0; while (ring < n - 1 && rr >= (pr[ring] + pr[ring + 1]) / 2) ring++;
    var ang = Math.atan2(y, x), spoke = 0, best = Infinity;
    pa.forEach(function (a, i) { var d = Math.abs(((ang - a) % TAU + 3 * Math.PI) % TAU - Math.PI); if (d < best) { best = d; spoke = i; } });
    return { ring: ring, spoke: spoke, x: pr[ring] * Math.cos(pa[spoke]), y: pr[ring] * Math.sin(pa[spoke]) };
  }
  var nr = +img.dataset.rows, nc = +img.dataset.columns, row = Math.min(nr - 1, Math.floor(fy * nr)), col = Math.min(nc - 1, Math.floor(fx * nc));
  return { row: row, column: col, x: e[0] + (col + 0.5) * (e[1] - e[0]) / nc, y: e[3] - (row + 0.5) * (e[3] - e[2]) / nr };
}

/* The overlay layer: the dot and two 1 px drop lines (children 0 to 2) unless `marks` is false, then the tooltip (the last child) unless `tip` is false; divs positioned in host px. The tooltip is a polite live region (`role=status`), so it is made here, empty, and kept for the life of the call: a region created together with its text is often not announced. */
function overlay(marks, tip) {
  var layer = document.createElement("div");
  layer.className = "eleo-hover";
  (marks ? ["v", "h", "dot"] : []).concat(tip ? ["tip"] : []).forEach(function (k) { var d = document.createElement("div"); d.className = "eleo-hover__" + k; layer.appendChild(d); });
  if (tip) { var t = layer.lastChild; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); }
  hide(layer, tip);
  return layer;
}

/* Hides the overlay without removing it: the marks by `hidden`, the tooltip by emptying its text (the stylesheet collapses an empty tip), so it stays in the accessibility tree as an empty live region. */
function hide(layer, tip) {
  var kids = layer.children, n = kids.length - (tip ? 1 : 0);
  for (var i = 0; i < n; i++) kids[i].hidden = true;
  if (tip) { var t = kids[n]; t.textContent = ""; }
}

/* Sets the tooltip's text and puts it TIP_GAP px right of and below the pointer, flipped to the other side of the pointer where it would pass the host's edge, then clamped inside the host. The layer is re-added when a redraw replaced the host's markup. */
function showTip(host, layer, text, cx, cy) {
  var tip = layer.lastChild, hb = host.getBoundingClientRect();
  if (layer.parentNode !== host) host.appendChild(layer);
  if (tip.textContent !== text) tip.textContent = text; // a live region is rewritten only when its text changes
  var ox = hb.left + host.clientLeft - host.scrollLeft, oy = hb.top + host.clientTop - host.scrollTop, x = cx - ox, y = cy - oy;
  var w = tip.offsetWidth, h = tip.offsetHeight, W = host.clientWidth, H = host.clientHeight;
  var left = x + TIP_GAP + w > W ? x - TIP_GAP - w : x + TIP_GAP, top = y + TIP_GAP + h > H ? y - TIP_GAP - h : y + TIP_GAP;
  tip.style.left = Math.max(0, Math.min(left, W - w)) + "px";
  tip.style.top = Math.max(0, Math.min(top, H - h)) + "px";
}

/* Puts the dot on the hovered point and the drop lines from it to the plot frame's bottom and left edges (the nested viewport's box). The layer is re-added when a redraw replaced the host's markup. */
function showMarks(host, layer, b) {
  var g = dataGroup(b.mark), m = g.getScreenCTM(), vp = g.closest("svg"), t = g.transform.baseVal.consolidate();
  if (!m || !vp) return;
  /* The viewport's own matrix is taken from the data group's, undoing the group's transform: an <svg>'s getScreenCTM leaves out its x/y in Firefox and Safari. */
  var vm = t ? m.multiply(t.matrix.inverse()) : m;
  var hb = host.getBoundingClientRect(), ox = hb.left + host.clientLeft - host.scrollLeft, oy = hb.top + host.clientTop - host.scrollTop;
  var pt = new DOMPoint(b.bar ? b.px : b.x, b.y).matrixTransform(m), x = pt.x - ox, y = pt.y - oy;
  var left = new DOMPoint(0, 0).matrixTransform(vm).x - ox, bottom = new DOMPoint(0, vp.height.baseVal.value).matrixTransform(vm).y - oy;
  for (var i = 0; i < 3; i++) layer.children[i].hidden = false;
  if (b.segment) layer.children[2].hidden = true; // an interpolated spot has no point to dot
  if (b.mark.dataset.ray !== undefined) layer.children[0].hidden = layer.children[1].hidden = true; // a layout has no axes frame: its ray hover has no drop lines
  var v = layer.children[0], h = layer.children[1], dot = layer.children[2];
  v.style.cssText = "left:" + (x - 0.5) + "px;top:" + y + "px;height:" + Math.max(0, bottom - y) + "px";
  h.style.cssText = "top:" + (y - 0.5) + "px;left:" + left + "px;width:" + Math.max(0, x - left) + "px";
  dot.style.cssText = "left:" + x + "px;top:" + y + "px;background:" + (b.mark.getAttribute("stroke") || "var(--ink)");
  if (layer.parentNode !== host) host.appendChild(layer);
}

var hosts = new WeakMap(); // host -> number of live interact calls holding its `eleo-hover-host` class

/* ---- Zoom, pan and reset. interact holds no view: each gesture reads the drawn ranges off the markup, makes the new view and hands it to onview; the caller redraws. ---- */
var WHEEL_RATE = 0.0015; // per px of wheel delta: one 100 px notch zooms by exp(0.15)
var DRAG_PX = 3; // client px a pointer must travel before a press is a drag, not a click

/* The data frames of a host, in document order: for each data group (a matrix group holding a series mark) the inverse of its screen matrix and the data ranges its nested viewport shows, read from the group's matrix and the viewport's width and height. */
function frames(host) {
  var seen = [], out = [];
  host.querySelectorAll("[data-series]").forEach(function (mark) {
    var g = dataGroup(mark);
    if (!g || seen.indexOf(g) >= 0) return;
    seen.push(g);
    var vp = g.closest("svg"), m = g.getScreenCTM(), t = g.transform.baseVal.consolidate();
    if (!vp || !m || !t) return;
    var a = t.matrix.a, d = t.matrix.d, e = t.matrix.e, f = t.matrix.f, w = +vp.getAttribute("width"), h = +vp.getAttribute("height");
    if (!(a && d && isFinite(a + d + e + f + w + h))) return;
    out.push({ inv: m.inverse(), x: [-e / a, (w - e) / a].sort(function (u, v) { return u - v; }), y: [-f / d, (h - f) / d].sort(function (u, v) { return u - v; }) });
  });
  return out;
}

/* Which kind of plot a host holds, from its markup: "map" (an image carrying data-range), "spot" (panels carrying spot's own data-view="spot" marker), "curve" (the other series paths and polylines), or null (bars, layouts, nothing drawn). */
function kindOf(host) {
  if (host.querySelector("image[data-range]")) return "map";
  var marks = host.querySelectorAll("[data-series]");
  if (!marks.length || host.querySelector("rect[data-series]")) return null;
  if (host.querySelector('[data-view="spot"]')) return "spot";
  return "curve";
}

/* What is under the client position: { kind, index, p: the data point there, x, y: the drawn ranges of its frame }, or null. With `index` the frame is that one (a drag keeps its frame) wherever the pointer is; otherwise the frame whose ranges hold the pointer. */
function pick(host, cx, cy, index) {
  var kind = kindOf(host), at, x, y;
  if (!kind) return null;
  if (kind === "map") {
    var img = host.querySelector("image[data-range]"), m = img.getScreenCTM();
    if (!m) return null;
    var q = new DOMPoint(cx, cy).matrixTransform(m.inverse()), e = img.dataset.extent.split(" ").map(Number), r = img.dataset.range.split(" ").map(Number);
    at = { x: e[0] + (q.x - +img.getAttribute("x")) / +img.getAttribute("width") * (e[1] - e[0]), y: e[3] - (q.y - +img.getAttribute("y")) / +img.getAttribute("height") * (e[3] - e[2]) };
    x = [r[0], r[1]]; y = [r[2], r[3]];
    if (!(isFinite(at.x + at.y + r[0] + r[1] + r[2] + r[3]))) return null;
    return index === undefined && !(at.x >= x[0] && at.x <= x[1] && at.y >= y[0] && at.y <= y[1]) ? null : { kind: kind, index: 0, p: [at.x, at.y], x: x, y: y };
  }
  var fs = frames(host);
  for (var i = 0; i < fs.length; i++) {
    if (index !== undefined && i !== index) continue;
    var pt = new DOMPoint(cx, cy).matrixTransform(fs[i].inv);
    if (index !== undefined || (pt.x >= fs[i].x[0] && pt.x <= fs[i].x[1] && pt.y >= fs[i].y[0] && pt.y <= fs[i].y[1])) return { kind: kind, index: i, p: [pt.x, pt.y], x: fs[i].x, y: fs[i].y };
  }
  return null;
}

/* The view for ranges x and y: { center, half } for a spot (its window is square: half is x's), else { x, y }; null where a range collapsed or left the finite numbers. */
function viewOf(kind, x, y) {
  var okr = function (r) { return isFinite(r[0] + r[1]) && r[1] > r[0] && r[1] - r[0] > 1e-12 * Math.max(Math.abs(r[0]), Math.abs(r[1])); };
  if (!okr(x) || !okr(y)) return null;
  return kind === "spot" ? { center: [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2], half: (x[1] - x[0]) / 2 } : { x: x, y: y };
}

/* interact(el, { onhover, onselect, axes, marks, tooltip, values }): calls onhover({ x, y, series: { index, label, role }, panel?, category?, categoryLabel? }) (`series` is absent on a layout ray hover, and on a map's) for the point nearest the pointer (or the spot on the line between two points, see README), and onhover(null) when the pointer leaves it or the host. With `opts.onview`, a wheel zooms about the pointer (k per notch, the same on every axis and panel), a drag pans (the grabbed data point stays under the pointer), a double-click resets: each calls onview(view) with the new view (`{ x, y }` for a curve, ray fan or typed map; `{ center, half }` for a spot or through-focus) and draws nothing, and reset calls onview(null). While a point is hovered it also draws a dot on it and drop lines to the plot frame's axes in an overlay on the host, unless `opts.marks` is false, and a tooltip near the pointer with `readout(event, opts.axes)`, unless `opts.tooltip` is false. `opts.axes` and `opts.values` are read when each event fires, so a caller may replace them on its options object without rebinding; the callbacks, `marks`, `tooltip` and `onview` are read once, at the call. Returns stop(), which has a reset() method: onview(null). */
export function interact(el, opts) {
  var onhover = (opts && opts.onhover) || function () {}, onselect = opts && opts.onselect, last = "", marks = !(opts && opts.marks === false), tip = !(opts && opts.tooltip === false), onview = opts && typeof opts.onview === "function" && opts.onview, layer = (marks || tip) && overlay(marks, tip);
  if (layer) { el.appendChild(layer); hosts.set(el, (hosts.get(el) || 0) + 1); el.classList.add("eleo-hover-host"); }
  function emit(ev, key) { if (key === last) return; last = key; onhover(ev); }
  function move(e) {
    var b = nearest(el, e.clientX, e.clientY);
    if (!b) return lensMove(e) || mapMove(e);
    if (marks) showMarks(el, layer, b);
    var d = b.mark.dataset, ev = { x: b.x, y: b.y };
    if (d.ray !== undefined) { ev.field = +d.field; ev.ray = +d.ray; if (d.status !== undefined) ev.status = d.status; } // a layout2D ray run: z, y in mm
    else ev.series = { index: +d.series, label: d.label, role: d.role };
    if (b.bar) { ev.category = b.x; if (d.categoryLabel !== undefined) ev.categoryLabel = d.categoryLabel; }
    if (b.segment) { ev.interpolated = true; ev.segment = b.segment; }
    if (d.panel !== undefined) ev.panel = +d.panel;
    if (tip) showTip(el, layer, readout(ev, opts && opts.axes), e.clientX, e.clientY);
    emit(ev, [d.panel, d.series, d.field, d.ray, d.status, b.index, b.segment ? b.x + "," + b.y : "", b.bar ? d.category : ""].join());
  }
  // a glass polygon under the pointer with no ray run in reach (rays are drawn over the glass): the element's own data-*, no dot or drop lines. r1 and r2 may read "Infinity" (a flat surface). Returns false where the pointer is on no glass.
  function lensMove(e) {
    var poly = e.target && e.target.closest && e.target.closest("polygon[data-element]"), g = poly && el.contains(poly) && dataGroup(poly), m = g && g.getScreenCTM();
    if (!m) return false;
    var d = poly.dataset, at = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()), ev = { x: at.x, y: at.y, element: +d.element, glass: d.glass };
    ["nd", "vd", "r1", "r2", "ct", "diameter", "f"].forEach(function (k) { if (d[k] !== undefined) ev[k] = +d[k]; });
    if (layer) for (var i = 0; i < layer.children.length - (tip ? 1 : 0); i++) layer.children[i].hidden = true;
    if (tip) showTip(el, layer, readout(ev, opts && opts.axes), e.clientX, e.clientY);
    emit(ev, "e" + d.element);
    return true;
  }
  // a typed map: the sample under the pointer, its value from opts.values; no dot or drop lines (a cell has no point to mark)
  function mapMove(e) {
    var s = mapAt(el, e.clientX, e.clientY);
    if (!s) return leave();
    var values = opts && opts.values, ev = { x: s.x, y: s.y }, polar = s.ring !== undefined, v = values && (polar ? values[s.ring] && values[s.ring][s.spoke] : values[s.row] && values[s.row][s.column]);
    if (polar) { ev.ring = s.ring; ev.spoke = s.spoke; } else { ev.row = s.row; ev.column = s.column; }
    if (values) ev.value = typeof v === "number" && isFinite(v) ? v : null; // a masked sample (NaN, Infinity, null, missing) has no value
    if (layer) for (var i = 0; i < layer.children.length - (tip ? 1 : 0); i++) layer.children[i].hidden = true;
    if (tip) showTip(el, layer, readout(ev, opts && opts.axes), e.clientX, e.clientY);
    emit(ev, polar ? "r" + s.ring + "," + s.spoke : "c" + s.row + "," + s.column);
  }
  /* A click selects the mark under it by the mark's own data-*: the target's nearest ancestor in the host that names a surface, a layout field or a series. A ray run names its field only (a ray is several runs); nothing else changes. */
  function click(e) {
    if (dragged) { dragged = false; return; } // the mouseup of a drag is not a selection
    if (onview && e.detail > 1) return; // where a double-click resets (onview), its second click selects nothing: the first click already did
    var m = e.target.closest && e.target.closest("[data-surface], [data-field], [data-series]");
    if (!m || !el.contains(m) || !onselect) return;
    var d = m.dataset, ev;
    if (d.surface !== undefined) ev = { surface: +d.surface };
    else if (d.field !== undefined) ev = { field: +d.field };
    else { if (!dataGroup(m)) return; // foreign markup: a series mark outside a matrix group, as hover skips it
      ev = { series: { index: +d.series, label: d.label, role: d.role } }; if (d.panel !== undefined) ev.panel = +d.panel; if (d.category !== undefined) ev.category = +d.category; }
    onselect(ev);
  }
  var dragged = false, drag = null, stopped = false, ended = false;
  function emitView(v) { if (v) onview(v); }
  function wheel(e) {
    var hit = pick(el, e.clientX, e.clientY);
    if (!hit) return;
    var dy = Math.max(-400, Math.min(400, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1))), k = Math.exp(-dy * WHEEL_RATE);
    if (!dy || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // a horizontal or mostly horizontal wheel or swipe is not ours: leave it to the page
    e.preventDefault();
    var about = function (r, c) { return [c + (r[0] - c) / k, c + (r[1] - c) / k]; };
    emitView(viewOf(hit.kind, about(hit.x, hit.p[0]), about(hit.y, hit.p[1])));
  }
  function down(e) {
    dragged = false; drag = null;
    if (e.button !== 0) return;
    var hit = pick(el, e.clientX, e.clientY);
    if (hit) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, g: hit.p, index: hit.index, moved: false };
  }
  /* The mousedown that starts a pan (or the second of a double-click) inside a frame has its default prevented: that is where a text selection would start. Text outside a frame stays selectable. */
  function press(e) { if (e.button === 0 && pick(el, e.clientX, e.clientY)) e.preventDefault(); }
  function pan(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) <= DRAG_PX) return;
      drag.moved = true; dragged = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer: keep going without capture */ }
    }
    var hit = pick(el, e.clientX, e.clientY, drag.index);
    if (!hit) return;
    var sx = drag.g[0] - hit.p[0], sy = drag.g[1] - hit.p[1];
    emitView(viewOf(hit.kind, [hit.x[0] + sx, hit.x[1] + sx], [hit.y[0] + sy, hit.y[1] + sy]));
  }
  function up(e) { if (drag && e.pointerId === drag.id) drag = null; }
  function reset() { if (onview && !ended) onview(null); }
  function leave() { if (layer) hide(layer, tip); emit(null, ""); }
  // a redraw replaced the markup: the empty live region is back at once (a microtask), before any text is set. Appending only when detached keeps the observer from looping on its own mutation.
  var watch = layer && new MutationObserver(function () { if (layer.parentNode !== el) el.appendChild(layer); });
  if (watch) watch.observe(el, { childList: true });
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  el.addEventListener("click", click);
  if (onview) {
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down);
    el.addEventListener("mousedown", press);
    el.addEventListener("pointermove", pan);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("dblclick", reset);
  }
  function stop() {
    el.removeEventListener("wheel", wheel); el.removeEventListener("pointerdown", down); el.removeEventListener("mousedown", press); el.removeEventListener("pointermove", pan); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("dblclick", reset);
    drag = null; ended = true;
    if (layer && !stopped) { layer.remove(); stopped = true; var n = hosts.get(el) - 1; hosts.set(el, n); if (!n) el.classList.remove("eleo-hover-host"); } if (watch) watch.disconnect(); el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); el.removeEventListener("click", click);
  }
  stop.reset = reset;
  return stop;
}

/* One value as text: `fmt` to `spec.digits` decimals, or to at most 2 with trailing zeros dropped, then a space and `spec.unit`. */
function value(v, spec) {
  var s = spec || {}, t = fmt(v, s.digits);
  if (s.digits == null && t.indexOf(".") >= 0) t = t.replace(/\.?0+$/, "");
  if (!/[1-9]/.test(t)) t = t.replace(/^[−-]/, "");
  return s.unit ? t + " " + s.unit : t;
}

/* The five lines of a lens element (CR #958): `element <n> · <glass>`, `nd <nd> · vd <vd>` and `f ≈ <f> mm` left out where absent, `R1 <r1> · R2 <r2> mm` (∞ for a flat surface), `CT <ct> · ⌀ <diameter> mm`. */
function lens(ev) {
  var R = function (r) { return r === Infinity || r === -Infinity ? "∞" : fmt(r, 1); }, out = ["element " + ev.element + " · " + ev.glass];
  if (ev.nd != null && ev.vd != null) out.push("nd " + fmt(ev.nd, 4) + " · vd " + fmt(ev.vd, 2));
  out.push("R1 " + R(ev.r1) + " · R2 " + R(ev.r2) + " mm", "CT " + fmt(ev.ct, 2) + " · ⌀ " + fmt(ev.diameter, 2) + " mm");
  if (ev.f != null) out.push("f ≈ " + fmt(ev.f, 1) + " mm");
  return out.join("\n");
}

/* readout(event, { x, y, value }): the text of a hover event, `<label> · <x> <unit>, <y> <unit>[ = <value> <unit>]`, from the caller's axis specs `{ unit?, digits? }`; the ` = <value>` suffix is there when the event's `value` is not null (a map's sample), formatted by `axes.value`. A bar (an event with a non-empty `categoryLabel`) reads `<label> · <categoryLabel>, <y> <unit>`: the category label as drawn, with no x unit; an empty or absent label falls back to the formatted x. An event with `element` (a lens) reads in the five lines of `lens`. A null event gives "". */
export function readout(ev, axes) {
  if (!ev) return "";
  if (ev.element !== undefined) return lens(ev);
  var a = axes || {}, label = ev.series && ev.series.label, xy = (typeof ev.categoryLabel === "string" && ev.categoryLabel !== "" ? ev.categoryLabel : value(ev.x, a.x)) + ", " + value(ev.y, a.y);
  if (ev.value != null) xy += " = " + value(ev.value, a.value);
  if (ev.field !== undefined && ev.ray !== undefined && !label) return "field " + ev.field + " · ray " + ev.ray + " · " + xy; // a layout ray has no series label
  return label ? label + " · " + xy : xy;
}
