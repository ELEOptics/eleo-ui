// fit(el, draw): draw(content width: the border box minus padding and borders, 2 decimals) now (not at a width of 0: a hidden container waits for its first width), then again when the width changes (ADR-0003). One ResizeObserver serves every
// element; one shared frame measures every changed element, then draws each, at most once per animation frame and only for a changed width above 0, so a height the draw sets
// never loops. getBoundingClientRect includes a CSS transform on an ancestor, so a scaled box measures scaled. Returns stop().
var ro = null, items = new Map();
function measure(el) {
  var c = getComputedStyle(el);
  return +(el.getBoundingClientRect().width - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight) - parseFloat(c.borderLeftWidth) - parseFloat(c.borderRightWidth)).toFixed(2);
}
function redraw(it) {
  var w = measure(it.el);
  if (w > 0 && w !== it.w) it.draw(it.w = w);
}
// One frame serves every pending element: all are measured before any draws, so no read follows a write.
var pending = new Set(), raf = 0;
function frame() {
  raf = 0;
  var todo = [];
  pending.forEach(function (it) { todo.push({ it: it, w: measure(it.el) }); });
  pending.clear();
  todo.forEach(function (t) {
    if (items.get(t.it.el) === t.it && t.w > 0 && t.w !== t.it.w) t.it.draw(t.it.w = t.w);
  });
}
export function fit(el, draw) {
  var it = { el: el, draw: draw, w: 0 };
  redraw(it);
  ro = ro || new ResizeObserver(function (entries) {
    entries.forEach(function (e) {
      var i = items.get(e.target);
      if (i) pending.add(i);
    });
    if (pending.size && !raf) raf = requestAnimationFrame(frame);
  });
  items.set(el, it);
  ro.observe(el);
  return function stop() {
    if (items.get(el) === it) {
      pending.delete(it);
      items.delete(el);
      ro.unobserve(el);
    }
  };
}
