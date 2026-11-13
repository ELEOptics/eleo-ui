/* Export a plot as a standalone SVG string (plan #1076). The clone carries each element's computed values as a style attribute, so it draws
   without ELEO's CSS or tokens: Inkscape, PowerPoint and rsvg do not resolve var(), so only resolved values travel. The background rect is the
   tile's computed --surface, in the theme the plot is drawn under. Fonts arrive in a later item: `fonts` is accepted and not used yet. */
const NS = 'http://www.w3.org/2000/svg';
const PROPS = [
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style',
  'font-variant-numeric', 'text-anchor', 'dominant-baseline', 'paint-order', 'image-rendering', 'stop-color', 'stop-opacity',
];

export async function standalone(svg, options) {
  void options;
  const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll('*')];
  const dst = [clone, ...clone.querySelectorAll('*')];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el), to = dst[i];
    for (const p of PROPS) {
      if ((to.getAttribute(p) || '').includes('var(')) to.removeAttribute(p);
      to.style.setProperty(p, cs.getPropertyValue(p));
    }
  });
  // The root's own box is the page's business, not the file's.
  clone.removeAttribute('class');
  clone.style.cssText = '';
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox && svg.viewBox.baseVal;
  const [x, y, w, h] = vb && vb.width ? [vb.x, vb.y, vb.width, vb.height] : [0, 0, box.width, box.height];
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('width', `${box.width}px`);
  clone.setAttribute('height', `${box.height}px`);
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', h);
  bg.setAttribute('fill', getComputedStyle(svg).getPropertyValue('--surface').trim());
  clone.insertBefore(bg, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}
