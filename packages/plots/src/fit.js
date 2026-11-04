// fit(el, draw): draw(content width: the border box minus padding and borders, 2 decimals) now (not at a width of 0: a hidden container waits for its first width), then again when the width changes (ADR-0003). One ResizeObserver serves every
// element; a redraw runs at most once per animation frame and only for a changed width above 0, so a height the draw sets
// never loops. getBoundingClientRect includes a CSS transform on an ancestor, so a scaled box measures scaled. Returns stop().
var ro = null, items = new Map();
function measure(el) {
  var c = getComputedStyle(el);
  return +(el.getBoundingClientRect().width - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight) - parseFloat(c.borderLeftWidth) - parseFloat(c.borderRightWidth)).toFixed(2);
}
function redraw(it) {
  it.raf = 0;
  var w = measure(it.el);
  if (w > 0 && w !== it.w) it.draw(it.w = w);
}
export function fit(el, draw) {
  var it = { el: el, draw: draw, w: 0, raf: 0 };
  redraw(it);
  ro = ro || new ResizeObserver(function (entries) {
    entries.forEach(function (e) {
      var i = items.get(e.target);
      if (i && !i.raf) i.raf = requestAnimationFrame(function () { redraw(i); });
    });
  });
  items.set(el, it);
  ro.observe(el);
  return function stop() {
    if (items.get(el) === it) {
      cancelAnimationFrame(it.raf);
      items.delete(el);
      ro.unobserve(el);
    }
  };
}
