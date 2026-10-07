// Per-glass fills (plan #90, O1). Each fill is a CSS color built from the band tokens --glass-band-hi and
// --glass-band-lo, so the browser resolves it per theme and a theme switch needs no redraw.

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
