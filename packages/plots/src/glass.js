// Per-glass fills (plan #90, O1). Each fill is a CSS color built from the band tokens --glass-band-hi and
// --glass-band-lo, so the browser resolves it per theme and a theme switch needs no redraw.
import { esc } from './common.js';

// Eight slots [mix % of --glass-band-hi, oklch chroma, hue shift in degrees], darkest first. L rises with the slot
// (it is the mix's L), and hue and chroma alternate so that any two slots are ΔE2000 ≥ 10 apart in both themes
// (searched and checked with culori against tokens.json; any subset keeps that spacing).
const SLOTS = [[0, 0.061, -12], [2, 0.089, 22], [30, 0.04, 20], [44, 0.04, -22], [46, 0.098, 1], [75, 0.089, -22], [77, 0.06, 22], [100, 0.04, -6]];

const css = ([p, c, d]) =>
  `oklch(from color-mix(in oklch, var(--glass-band-hi) ${p}%, var(--glass-band-lo)) l ${c} calc(h ${d < 0 ? '-' : '+'} ${Math.abs(d)}))`;

/**
 * A fill per distinct glass name: `glasses` is a layout's `{name, nd, vd}` glasses (names may repeat; the first
 * wins). The distinct set, sorted by (vd, nd, name), takes well-spread slots in that order, so a lower vd never
 * gets a lighter fill. Up to 8 glasses are pairwise ΔE2000 ≥ 8; beyond 8 the fills stay ordered but may sit closer.
 * @param {{name: string, nd: number, vd: number}[]} glasses
 * @returns {Map<string, string>} name → CSS fill
 */
export function glassFill(glasses) {
  const byName = new Map();
  for (const g of glasses) if (!byName.has(g.name)) byName.set(g.name, g);
  const set = [...byName.values()].sort((a, b) => a.vd - b.vd || a.nd - b.nd || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const k = set.length, n = SLOTS.length;
  return new Map(set.map((g, i) => [g.name, css(
    k === 1 ? SLOTS[4]
      : k <= n ? SLOTS[Math.round(i * (n - 1) / (k - 1))]
        : [Math.round(100 * i / (k - 1)), 0.07, i % 2 ? 20 : -20],
  )]));
}

// A glass as JSON for the error message, safe for what JSON.stringify throws on: a BigInt shows as 1n, a cycle as String(g).
function show(g) {
  if (typeof g === 'bigint') return `${g}n`;
  try { return JSON.stringify(g, (_, v) => (typeof v === 'bigint' ? `${v}n` : v)); } catch { return String(g); }
}

/**
 * The glasses a layout draws, in surface order with repeats: a {name, nd, vd} glass on a surface that has a next
 * surface (layout2D's lens polygons). Shorthand "crown"/"flint" and null are left out. Any other glass, on any surface,
 * throws `<fn>: surface i glass <json> is not crown, flint, null or {name, nd, vd}`; `fn` names the caller
 * (layout2D, the drawing, unless told otherwise).
 * @param {{glass: *}[]} surfaces
 * @param {string} [fn]
 */
export function drawnGlasses(surfaces, fn = 'layout2D') {
  surfaces.forEach((s, i) => {
    const g = s.glass;
    if (g == null || g === 'crown' || g === 'flint') return;
    if (typeof g === 'object' && typeof g.name === 'string' && Number.isFinite(g.nd) && Number.isFinite(g.vd)) return;
    throw new Error(`${fn}: surface ${i} glass ${show(g)} is not crown, flint, null or {name, nd, vd}`);
  });
  return surfaces.filter((s, i) => s.glass && typeof s.glass === 'object' && surfaces[i + 1]).map((s) => s.glass);
}

/**
 * Legend keys for a layout's glasses: one swatch key per distinct drawn glass, in first-use order, filled as
 * layout2D fills it. `data` is a recorded layout or a system carrying one in `layout`, else in `layoutWl` (both carry
 * the same glasses). "" when no named glass is drawn. Throws a named error for anything else.
 * @param {{surfaces?: object[], layout?: {surfaces: object[]}, layoutWl?: {surfaces: object[]}}} data
 * @returns {string}
 */
export function glassLegend(data) {
  const L = data && (data.surfaces ? data : data.layout || data.layoutWl);
  if (!L || !Array.isArray(L.surfaces) || !Array.isArray(L.rays)) {
    throw new Error('glassLegend: data is not a recorded layout ({surfaces, rays}) or a system carrying one in layout or layoutWl');
  }
  const glasses = drawnGlasses(L.surfaces, 'glassLegend'), fills = glassFill(glasses);
  return [...new Set(glasses.map((g) => g.name))].map((n) => `<span class="eleo-key eleo-key--swatch" style="--c:${fills.get(n)}">${esc(n)}</span>`).join('');
}
