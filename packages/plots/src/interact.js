// Pointer interaction on a drawn plot. The listeners sit on the host, not on the marks: a redraw replaces the markup, and a host listener survives it.
import { fmt } from "./color.js";
var REACH = 24; // client px: a pointer farther than this from every point hovers nothing

/* The finite [x, y] pairs of a polyline's points or a path's data, in data coordinates. Path data is M/L pairs and `h0` dots, which add no point. A pair with a non-finite coordinate (a polyline's "NaN") is dropped whole, so it never shifts the pairs after it. */
function pairs(mark) {
  var s = mark.getAttribute("points") || mark.getAttribute("d") || "", out = [];
  var n = s.replace(/h\s*-?[\d.]+/g, " ").replace(/[ML]/g, " ").split(/[\s,]+/).filter(Boolean).map(Number);
  for (var i = 0; i + 1 < n.length; i += 2) if (isFinite(n[i]) && isFinite(n[i + 1])) out.push([n[i], n[i + 1]]);
  return out;
}

/* The nearest drawn point to the client position, through the inverse of its data group's screen matrix, or null. */
function nearest(host, cx, cy) {
  var best = null;
  host.querySelectorAll("[data-series]").forEach(function (mark) {
    var g = mark.parentNode, m = g.getScreenCTM && g.getScreenCTM();
    if (!m) return;
    var at = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    pairs(mark).forEach(function (p, i) {
      var dx = (p[0] - at.x) * m.a, dy = (p[1] - at.y) * m.d, d = Math.hypot(dx, dy);
      if (d <= REACH && (!best || d < best.d)) best = { d: d, mark: mark, index: i, x: p[0], y: p[1] };
    });
  });
  return best;
}

/* The overlay layer's three parts: a dot and two 1 px drop lines, as divs positioned in host px. */
function overlay() {
  var layer = document.createElement("div");
  layer.className = "eleo-hover";
  ["v", "h", "dot"].forEach(function (k) { var d = document.createElement("div"); d.className = "eleo-hover__" + k; layer.appendChild(d); });
  return layer;
}

/* Puts the dot on the hovered point and the drop lines from it to the plot frame's bottom and left edges (the nested viewport's box). The layer is re-added when a redraw replaced the host's markup. */
function showMarks(host, layer, b) {
  var g = b.mark.parentNode, m = g.getScreenCTM(), vp = g.closest("svg"), vm = vp && vp.getScreenCTM();
  if (!m || !vm) return;
  var hb = host.getBoundingClientRect(), ox = hb.left + host.clientLeft - host.scrollLeft, oy = hb.top + host.clientTop - host.scrollTop;
  var pt = new DOMPoint(b.x, b.y).matrixTransform(m), x = pt.x - ox, y = pt.y - oy;
  var left = new DOMPoint(0, 0).matrixTransform(vm).x - ox, bottom = new DOMPoint(0, vp.height.baseVal.value).matrixTransform(vm).y - oy;
  var v = layer.children[0], h = layer.children[1], dot = layer.children[2];
  v.style.cssText = "left:" + (x - 0.5) + "px;top:" + y + "px;height:" + Math.max(0, bottom - y) + "px";
  h.style.cssText = "top:" + (y - 0.5) + "px;left:" + left + "px;width:" + Math.max(0, x - left) + "px";
  dot.style.cssText = "left:" + x + "px;top:" + y + "px;background:" + (b.mark.getAttribute("stroke") || "var(--ink)");
  if (layer.parentNode !== host) host.appendChild(layer);
}

/* interact(el, { onhover }): calls onhover({ x, y, series: { index, label, role }, panel? }) for the point nearest the pointer, and onhover(null) when the pointer leaves it or the host. While a point is hovered it also draws a dot on it and drop lines to the plot frame's axes in an overlay on the host, unless `opts.marks` is false. Returns stop(). */
export function interact(el, opts) {
  var onhover = (opts && opts.onhover) || function () {}, last = "", marks = !(opts && opts.marks === false), layer = marks && overlay();
  if (marks) el.classList.add("eleo-hover-host");
  function emit(ev, key) { if (key === last) return; last = key; onhover(ev); }
  function move(e) {
    var b = nearest(el, e.clientX, e.clientY);
    if (!b) return leave();
    if (marks) showMarks(el, layer, b);
    var d = b.mark.dataset, ev = { x: b.x, y: b.y, series: { index: +d.series, label: d.label, role: d.role } };
    if (d.panel !== undefined) ev.panel = +d.panel;
    emit(ev, [d.panel, d.series, b.index].join());
  }
  function leave() { if (marks) layer.remove(); emit(null, ""); }
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  return function stop() { if (marks) { layer.remove(); el.classList.remove("eleo-hover-host"); } el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
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
