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

/* The hovered spot for the client position, through the inverse of each data group's screen matrix, or null. Within SNAP client px of a drawn point it is that point (the nearest one). Otherwise it is the nearest spot within REACH of a drawn segment (between consecutive points of one run), the pointer projected onto the segment and clamped to it, its data coordinates linearly interpolated, with `interpolated` and `segment` [i, i + 1] (indices into the mark's finite points); a point with no segment (a dot) is hovered within REACH as itself. */
function nearest(host, cx, cy) {
  var snap = null, best = null, bar = null;
  host.querySelectorAll("[data-series]").forEach(function (mark) {
    var g = mark.parentNode, m = g.getScreenCTM && g.getScreenCTM();
    if (!m) return;
    var at = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    if (mark.localName === "rect") { // a bar is hovered only with the pointer inside its box; its value is its y when below zero, else its height
      var rx = +mark.getAttribute("x"), ry = +mark.getAttribute("y"), rw = +mark.getAttribute("width"), rh = +mark.getAttribute("height");
      if (at.x >= rx && at.x <= rx + rw && at.y >= ry && at.y <= ry + rh && rh > 0) bar = { d: 0, mark: mark, index: 0, bar: true, x: +mark.dataset.category, y: ry < 0 ? ry : rh, px: rx + rw / 2 };
      return;
    }
    var r = runs(mark), p = r.p;
    var linked = function (i) { return r.join[i] || r.join[i + 1]; };
    p.forEach(function (q, i) {
      var d = Math.hypot((q[0] - at.x) * m.a, (q[1] - at.y) * m.d), c = { d: d, mark: mark, index: i, x: q[0], y: q[1] };
      if (d <= SNAP && (!snap || d < snap.d)) snap = c;
      if (d <= REACH && !linked(i) && (!best || d < best.d)) best = c;
    });
    for (var i = 1; i < p.length; i++) {
      if (!r.join[i]) continue;
      var ax = p[i - 1][0] * m.a, ay = p[i - 1][1] * m.d, vx = p[i][0] * m.a - ax, vy = p[i][1] * m.d - ay, len = vx * vx + vy * vy;
      var t = len ? Math.max(0, Math.min(1, ((at.x * m.a - ax) * vx + (at.y * m.d - ay) * vy) / len)) : 0;
      var d = Math.hypot(ax + t * vx - at.x * m.a, ay + t * vy - at.y * m.d);
      if (d <= REACH && (!best || d < best.d)) best = { d: d, mark: mark, index: i - 1, x: p[i - 1][0] + t * (p[i][0] - p[i - 1][0]), y: p[i - 1][1] + t * (p[i][1] - p[i - 1][1]), segment: [i - 1, i] };
    }
  });
  return bar || snap || best;
}

/* The sample of a typed map under the client position, or null: the map's `<image>` holds its extent and shape (`data-extent`, and `data-rows` and `data-columns` or, polar, `data-radii` and `data-angles`). A grid cell is { row, column } (rows top-down) at its centre; a polar sample is { ring, spoke } at its radius and angle, the nearest sample as map2D draws it (a ring ends midway to the next radius, the last half a step past the outer one). `x`, `y` are in the extent's data units. Nothing outside the image, or past the outer ring. */
function mapAt(host, cx, cy) {
  var img = host.querySelector("image[data-extent]"), m = img && img.getScreenCTM && img.getScreenCTM();
  if (!m) return null;
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
  var g = b.mark.parentNode, m = g.getScreenCTM(), vp = g.closest("svg"), t = g.transform.baseVal.consolidate();
  if (!m || !vp) return;
  /* The viewport's own matrix is taken from the data group's, undoing the group's transform: an <svg>'s getScreenCTM leaves out its x/y in Firefox and Safari. */
  var vm = t ? m.multiply(t.matrix.inverse()) : m;
  var hb = host.getBoundingClientRect(), ox = hb.left + host.clientLeft - host.scrollLeft, oy = hb.top + host.clientTop - host.scrollTop;
  var pt = new DOMPoint(b.bar ? b.px : b.x, b.y).matrixTransform(m), x = pt.x - ox, y = pt.y - oy;
  var left = new DOMPoint(0, 0).matrixTransform(vm).x - ox, bottom = new DOMPoint(0, vp.height.baseVal.value).matrixTransform(vm).y - oy;
  for (var i = 0; i < 3; i++) layer.children[i].hidden = false;
  if (b.segment) layer.children[2].hidden = true; // an interpolated spot has no point to dot
  var v = layer.children[0], h = layer.children[1], dot = layer.children[2];
  v.style.cssText = "left:" + (x - 0.5) + "px;top:" + y + "px;height:" + Math.max(0, bottom - y) + "px";
  h.style.cssText = "top:" + (y - 0.5) + "px;left:" + left + "px;width:" + Math.max(0, x - left) + "px";
  dot.style.cssText = "left:" + x + "px;top:" + y + "px;background:" + (b.mark.getAttribute("stroke") || "var(--ink)");
  if (layer.parentNode !== host) host.appendChild(layer);
}

var hosts = new WeakMap(); // host -> number of live interact calls holding its `eleo-hover-host` class

/* interact(el, { onhover, axes, marks, tooltip }): calls onhover({ x, y, series: { index, label, role }, panel? }) for the point nearest the pointer (or the spot on the line between two points, see README), and onhover(null) when the pointer leaves it or the host. While a point is hovered it also draws a dot on it and drop lines to the plot frame's axes in an overlay on the host, unless `opts.marks` is false, and a tooltip near the pointer with `readout(event, opts.axes)`, unless `opts.tooltip` is false. Returns stop(). */
export function interact(el, opts) {
  var onhover = (opts && opts.onhover) || function () {}, last = "", marks = !(opts && opts.marks === false), tip = !(opts && opts.tooltip === false), axes = opts && opts.axes, values = opts && opts.values, layer = (marks || tip) && overlay(marks, tip);
  if (layer) { el.appendChild(layer); hosts.set(el, (hosts.get(el) || 0) + 1); el.classList.add("eleo-hover-host"); }
  function emit(ev, key) { if (key === last) return; last = key; onhover(ev); }
  function move(e) {
    var b = nearest(el, e.clientX, e.clientY);
    if (!b) return mapMove(e);
    if (marks) showMarks(el, layer, b);
    var d = b.mark.dataset, ev = { x: b.x, y: b.y, series: { index: +d.series, label: d.label, role: d.role } };
    if (b.bar) ev.category = b.x;
    if (b.segment) { ev.interpolated = true; ev.segment = b.segment; }
    if (d.panel !== undefined) ev.panel = +d.panel;
    if (tip) showTip(el, layer, readout(ev, axes), e.clientX, e.clientY);
    emit(ev, [d.panel, d.series, b.index, b.segment ? b.x + "," + b.y : "", b.bar ? d.category : ""].join());
  }
  // a typed map: the sample under the pointer, its value from opts.values; no dot or drop lines (a cell has no point to mark)
  function mapMove(e) {
    var s = mapAt(el, e.clientX, e.clientY);
    if (!s) return leave();
    var ev = { x: s.x, y: s.y }, polar = s.ring !== undefined, v = values && (polar ? values[s.ring] && values[s.ring][s.spoke] : values[s.row] && values[s.row][s.column]);
    if (polar) { ev.ring = s.ring; ev.spoke = s.spoke; } else { ev.row = s.row; ev.column = s.column; }
    if (values) ev.value = v;
    if (layer) for (var i = 0; i < layer.children.length - (tip ? 1 : 0); i++) layer.children[i].hidden = true;
    if (tip) showTip(el, layer, readout(ev, axes), e.clientX, e.clientY);
    emit(ev, polar ? "r" + s.ring + "," + s.spoke : "c" + s.row + "," + s.column);
  }
  function leave() { if (layer) hide(layer, tip); emit(null, ""); }
  // a redraw replaced the markup: the empty live region is back at once (a microtask), before any text is set. Appending only when detached keeps the observer from looping on its own mutation.
  var watch = layer && new MutationObserver(function () { if (layer.parentNode !== el) el.appendChild(layer); });
  if (watch) watch.observe(el, { childList: true });
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  var stopped = false;
  return function stop() {
    if (layer && !stopped) { layer.remove(); stopped = true; var n = hosts.get(el) - 1; hosts.set(el, n); if (!n) el.classList.remove("eleo-hover-host"); } if (watch) watch.disconnect(); el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave);
  };
}

/* One value as text: `fmt` to `spec.digits` decimals, or to at most 2 with trailing zeros dropped, then a space and `spec.unit`. */
function value(v, spec) {
  var s = spec || {}, t = fmt(v, s.digits);
  if (s.digits == null && t.indexOf(".") >= 0) t = t.replace(/\.?0+$/, "");
  if (!/[1-9]/.test(t)) t = t.replace(/^[−-]/, "");
  return s.unit ? t + " " + s.unit : t;
}

/* readout(event, { x, y }): the text of a hover event, `<label> · <x> <unit>, <y> <unit>`, from the caller's axis specs `{ unit?, digits? }`. A null event gives "". */
export function readout(ev, axes) {
  if (!ev) return "";
  var a = axes || {}, label = ev.series && ev.series.label, xy = value(ev.x, a.x) + ", " + value(ev.y, a.y);
  if (ev.value != null) xy += " = " + value(ev.value, a.value);
  return label ? label + " · " + xy : xy;
}
