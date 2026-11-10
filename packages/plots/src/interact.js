// Pointer interaction on a drawn plot. The listeners sit on the host, not on the marks: a redraw replaces the markup, and a host listener survives it.
import { fmt } from "./color.js";
var TIP_GAP = 14; // px between the pointer and the tooltip
var REACH = 24; // client px: a pointer farther than this from every point and segment hovers nothing
var SNAP = 6; // client px: within this of a point the hover is that point, not the line beside it

/* The drawn points of a polyline or path, in data coordinates: `p` the finite [x, y] pairs in order and `join[i]` true when p[i] continues the run of p[i - 1], so a segment joins them. A path's `M` starts a new run, and so does a pair with a non-finite coordinate, which is dropped whole so it never shifts the pairs after it; `h0` dots add no point. A browser draws nothing of a polyline holding a non-finite coordinate (its whole points list is dropped, not just the part after it), so such a polyline has no points here. */
function runs(mark) {
  var p = [], join = [], pts = mark.getAttribute("points");
  var parts = pts != null ? [["L", pts]] : (mark.getAttribute("d") || "").split(/(?=[ML])/).map(function (t) { return [t.charAt(0) === "M" ? "M" : "L", t.replace(/h\s*-?[\d.]+/g, " ").replace(/[ML]/g, " ")]; });
  var open = false, bad = false; // `open`: the previous pair was kept and ended a run still open; `bad`: a polyline holds a non-finite pair
  parts.forEach(function (part, k) {
    if (part[0] === "M" || k === 0 && pts != null) open = false;
    var n = part[1].split(/[\s,]+/).filter(Boolean).map(Number);
    for (var i = 0; i + 1 < n.length; i += 2) {
      if (isFinite(n[i]) && isFinite(n[i + 1])) { p.push([n[i], n[i + 1]]); join.push(open); open = true; } else { open = false; bad = pts != null; }
    }
  });
  return bad ? { p: [], join: [] } : { p: p, join: join };
}

/* The hovered spot for the client position, through the inverse of each data group's screen matrix, or null. Within SNAP client px of a drawn point it is that point (the nearest one). Otherwise it is the nearest spot within REACH of a drawn segment (between consecutive points of one run), the pointer projected onto the segment and clamped to it, its data coordinates linearly interpolated, with `interpolated` and `segment` [i, i + 1] (indices into the mark's finite points); a point with no segment (a dot) is hovered within REACH as itself. */
function nearest(host, cx, cy) {
  var snap = null, best = null;
  host.querySelectorAll("[data-series]").forEach(function (mark) {
    var g = mark.parentNode, m = g.getScreenCTM && g.getScreenCTM();
    if (!m) return;
    var at = new DOMPoint(cx, cy).matrixTransform(m.inverse()), r = runs(mark), p = r.p;
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
  return snap || best;
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
  tip.textContent = text;
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
  var pt = new DOMPoint(b.x, b.y).matrixTransform(m), x = pt.x - ox, y = pt.y - oy;
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
  var onhover = (opts && opts.onhover) || function () {}, last = "", marks = !(opts && opts.marks === false), tip = !(opts && opts.tooltip === false), axes = opts && opts.axes, layer = (marks || tip) && overlay(marks, tip);
  if (layer) { el.appendChild(layer); hosts.set(el, (hosts.get(el) || 0) + 1); el.classList.add("eleo-hover-host"); }
  function emit(ev, key) { if (key === last) return; last = key; onhover(ev); }
  function move(e) {
    var b = nearest(el, e.clientX, e.clientY);
    if (!b) return leave();
    if (marks) showMarks(el, layer, b);
    var d = b.mark.dataset, ev = { x: b.x, y: b.y, series: { index: +d.series, label: d.label, role: d.role } };
    if (b.segment) { ev.interpolated = true; ev.segment = b.segment; }
    if (d.panel !== undefined) ev.panel = +d.panel;
    if (tip) showTip(el, layer, readout(ev, axes), e.clientX, e.clientY);
    emit(ev, [d.panel, d.series, b.index, b.segment ? b.x + "," + b.y : ""].join());
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
  return label ? label + " · " + xy : xy;
}
