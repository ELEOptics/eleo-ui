// fit(el, draw): draw(el.clientWidth) now (not at a width of 0: a hidden container waits for its first width), then again when the width changes (ADR-0003). One ResizeObserver serves every
// element; a redraw runs at most once per animation frame and only for a changed width above 0, so a height the draw sets
// never loops. Returns stop().
var ro = null, items = new Map();
function frame(it) {
  it.raf = 0;
  var w = it.el.clientWidth;
  if (w > 0 && w !== it.w) { it.w = w; it.draw(w); }
}
export function fit(el, draw) {
  var it = { el: el, draw: draw, w: el.clientWidth, raf: 0 };
  if (it.w > 0) draw(it.w);
  ro = ro || new ResizeObserver(function (entries) {
    entries.forEach(function (e) {
      var i = items.get(e.target);
      if (i && !i.raf) i.raf = requestAnimationFrame(function () { frame(i); });
    });
  });
  items.set(el, it);
  ro.observe(el);
  return function stop() {
    if (items.get(el) !== it) return;
    if (it.raf) cancelAnimationFrame(it.raf);
    items.delete(el);
    ro.unobserve(el);
  };
}
