/* Export a plot as a standalone SVG string (plan #1076). The clone carries each element's computed values as a style attribute, so it draws
   without ELEO's CSS or tokens: Inkscape, PowerPoint and rsvg do not resolve var(), so only resolved values travel. The background rect is the
   tile's computed --surface, in the theme the plot is drawn under. Fonts: each readable @font-face rule matching the clone's text (family, weight, style,
   unicode-range) is embedded as its cssText with url() swapped for a data URL; `{ fonts: false }` skips it. */
const NS = 'http://www.w3.org/2000/svg';
const PROPS = [
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style',
  'font-variant-numeric', 'text-anchor', 'dominant-baseline', 'paint-order', 'image-rendering',
];

const toDataUrl = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const blob = await res.blob();
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
};
const unquote = (v) => v.trim().replace(/^["']|["']$/g, '');
const KEYWORD_WEIGHT = { normal: 400, bold: 700 };
const weightOf = (v) => KEYWORD_WEIGHT[v.toLowerCase()] ?? Number(v);
const inWeight = (w, spec) => {
  const [lo, hi = lo] = spec.trim().split(/\s+/).map(weightOf);
  return w >= lo && w <= hi;
};
// Generic families resolve to system fonts and never have an @font-face.
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|math|emoji|fangsong|-apple-system|BlinkMacSystemFont)$/i;
const covers = (range, chars) => {
  if (!range) return true;
  const spans = range.split(',').map((u) => {
    const [a, b = a] = u.trim().replace(/^U\+/i, '').split('-');
    return a.includes('?') ? [parseInt(a.replace(/\?/g, '0'), 16), parseInt(a.replace(/\?/g, 'F'), 16)] : [parseInt(a, 16), parseInt(b, 16)];
  });
  return chars.some((c) => spans.some(([lo, hi]) => c >= lo && c <= hi));
};

async function embedFonts(clone) {
  const uses = [...clone.querySelectorAll('text, tspan')].map((t) => ({
    fam: unquote(t.style.fontFamily.split(',')[0] || ''), wt: weightOf(t.style.fontWeight) || 400, sty: t.style.fontStyle || 'normal',
    chars: [...(t.textContent || '')].map((c) => c.codePointAt(0)),
  })).filter((u) => u.fam && u.chars.length);
  const rules = [];
  const walk = (list) => {
    for (const r of list) {
      if (r.type === CSSRule.FONT_FACE_RULE) { rules.push(r); continue; }
      if (r.media && !matchMedia(r.media.mediaText).matches) continue;
      if (r.styleSheet) { try { walk(r.styleSheet.cssRules); } catch { /* unreadable import: its faces are warned about below */ } } else if (r.cssRules) walk(r.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules); } catch { /* cross-origin sheet: its faces are warned about below */ }
  }
  const kept = new Set(), served = new Set();
  for (const r of rules) {
    const fam = unquote(r.style.getPropertyValue('font-family'));
    const wt = r.style.getPropertyValue('font-weight') || '400', sty = r.style.getPropertyValue('font-style') || 'normal';
    const range = r.style.getPropertyValue('unicode-range');
    for (const u of uses) {
      if (u.fam.toLowerCase() === fam.toLowerCase() && inWeight(u.wt, wt) && u.sty === sty && covers(range, u.chars)) { kept.add(r); served.add(u.fam); }
    }
  }
  const lost = new Set(uses.map((u) => u.fam).filter((f) => !served.has(f) && !GENERIC.test(f)));
  const failed = new Set(), embedded = new Set();
  const css = (await Promise.all([...kept].map(async (r) => {
    const base = r.parentStyleSheet.href || document.baseURI;
    let text = r.cssText;
    try {
      for (const m of [...new Set([...text.matchAll(/url\(\s*["']?([^"')]+?)["']?\s*\)/g)].map((x) => x[1]))]) {
        if (!m.startsWith('data:')) text = text.split(m).join(await toDataUrl(new URL(m, base).href));
      }
    } catch {
      failed.add(unquote(r.style.getPropertyValue('font-family')));
      return null;
    }
    embedded.add(unquote(r.style.getPropertyValue('font-family')).toLowerCase());
    return text;
  }))).filter(Boolean);
  const partly = [...failed].filter((f) => embedded.has(f.toLowerCase()));
  for (const f of failed) if (!embedded.has(f.toLowerCase())) lost.add(f);
  const parts = [];
  if (lost.size) parts.push(`no readable @font-face for these fonts, so they are not embedded: ${[...lost].join(', ')}`);
  if (partly.length) parts.push(`some faces failed to load for these fonts, so they are only partly embedded: ${partly.join(', ')}`);
  if (parts.length) console.warn(`standalone: ${parts.join('; ')}`);
  if (!css.length) return;
  const style = document.createElementNS(NS, 'style');
  style.textContent = css.join('\n');
  clone.insertBefore(style, clone.firstChild);
}

/* The clone standalone serialises, with the source and clone element lists so png can walk both. */
async function build(svg, options) {
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
  if (!options || options.fonts !== false) await embedFonts(clone);
  return { clone, src, dst, box };
}

export async function standalone(svg, options) {
  return new XMLSerializer().serializeToString((await build(svg, options)).clone);
}

// Computed style keeps % as %, and only px or unitless values are screen pixels; em and rem arrive as px.
const PX = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?(px)?$/i;

/* PNG of the plot: the standalone clone with its root sized box times `scale` (viewBox unchanged), drawn at its intrinsic size on a canvas of that size, so every
   browser rasterises at the target size. A vector-effect="non-scaling-stroke" stroke stays in screen pixels, so its width, dasharray and dashoffset are multiplied
   by `scale` here (CR #1102); the SVG that standalone returns keeps them. `img.decode()` runs before drawing because WebKit can fire
   `onload` before the data-URL fonts are ready. A tainted canvas makes toBlob throw; that is not handled here (plan #1076, escalate). */
export async function png(svg, options) {
  const scale = (options && options.scale) || 1;
  const { clone, src, dst, box } = await build(svg, options);
  src.forEach((el, i) => {
    if (getComputedStyle(el).getPropertyValue('vector-effect') !== 'non-scaling-stroke') return;
    const to = dst[i], sw = to.style.getPropertyValue('stroke-width');
    if (PX.test(sw)) to.style.setProperty('stroke-width', `${parseFloat(sw) * scale}px`);
    const da = to.style.getPropertyValue('stroke-dasharray');
    if (da && da !== 'none') to.style.setProperty('stroke-dasharray', da.split(/[\s,]+/).map((v) => (PX.test(v) ? `${parseFloat(v) * scale}px` : v)).join(', '));
    const off = parseFloat(to.getAttribute('stroke-dashoffset'));
    if (Number.isFinite(off)) to.setAttribute('stroke-dashoffset', String(off * scale));
  });
  const width = Math.round(box.width * scale), height = Math.round(box.height * scale);
  clone.setAttribute('width', `${width}px`);
  clone.setAttribute('height', `${height}px`);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return await new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('png: toBlob gave no blob'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
