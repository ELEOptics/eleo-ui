// fit(el, draw): draw(content width: box minus padding, 2 decimals) now (not at a width of 0: a hidden container waits for its first width), then again when the width changes (ADR-0003). One ResizeObserver serves every
// element; a redraw runs at most once per animation frame and only for a changed width above 0, so a height the draw sets
// never loops. Returns stop().
var ro = null, items = new Map();
export function fit(el, draw) {
  var it = function () {
    var c = getComputedStyle(el), w = +(el.getBoundingClientRect().width - c.paddingLeft.slice(0, -2) - c.paddingRight.slice(0, -2)).toFixed(2);
    it.r = 0;
    if (w > 0 && w !== it.w) draw(it.w = w);
  };
  it();
  ro = ro || new ResizeObserver(function (entries) {
    entries.forEach(function (e) {
      var i = items.get(e.target);
      if (i && !i.r) i.r = requestAnimationFrame(i);
    });
  });
  items.set(el, it);
  ro.observe(el);
  return function stop() {
    if (items.get(el) === it) {
      cancelAnimationFrame(it.r);
      items.delete(el);
      ro.unobserve(el);
    }
  };
}
