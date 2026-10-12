# @eleoptics/plots

Optical plots for the web, without a framework: lens layouts in 2D and 3D, spot diagrams, ray fans, PSF and wavefront maps, MTF, field curvature, distortion and chromatic focus shift, plus ELEO's optical icons. Geometry is exact and true to scale; colors come from [`@eleoptics/tokens`](https://www.npmjs.com/package/@eleoptics/tokens), so every plot follows the light or dark theme.

```bash
npm install @eleoptics/tokens @eleoptics/plots
```

```js
import '@eleoptics/tokens/tokens.css';
import '@eleoptics/plots/plots.css';
import { layout2D, spot, map2D, gradient } from '@eleoptics/plots';

layoutEl.innerHTML = layout2D({ data: system, colorBy: 'field', rays: 'fan' });
spotEl.innerHTML = spot({ data: system });
map2D(psfCanvas, { data: system, kind: 'psf', scale: 'log' });
colorbarEl.style.background = gradient('ember');
```

- **SVG renderers** (`layout2D`, `spot`, `throughFocus`, `rayFan`, `curve`, `bars`, `legend`, `icon`) return markup whose colors are CSS variables: one drawing works in both themes. `legend` needs no sample: without one, `field`/`wavelength` draw `n` index keys without values (`F1`.., `λ1`..), and none when `n` is omitted; `ts` and `rays` are unchanged.
- **Canvas renderers** (`map2D`, `layout3D`) read the variables when they draw: call them again after a theme or palette change.
- **Data:** pass your traced system as `data`. To try things out, `import '@eleoptics/plots/sample'` makes a traced achromat the default (190 KB, so it is opt-in).
- **Fonts:** Fira Sans and Fira Code. Load them yourself.

## Lens layouts

`layout2D` draws any sequential system recorded in this format (eleoptics.com's `scripts/layout.py` writes it). Every length is in mm, in the YZ section:

```js
{
  surfaces: [{ z, sd, stop, image, glass, profile }],  // glass: null | 'crown' | 'flint' | { name, nd, vd }, the material after the surface
  rays: [[[[z, y], ...], ...], ...],                    // rays[fan][ray] is a polyline
  chief: [3, 3, 2],                                     // optional: one ray index per fan
}
```

`profile` is the surface's section as `[z, y]` points. `data` is a recorded layout, or a system whose `layout` (colored by field) and `layoutWl` (colored by wavelength) are recorded layouts; `colorBy` picks which one.

- **`glass`:** `'crown'` and `'flint'` fill with `--glass-crown` and `--glass-flint`. A `{ name, nd, vd }` glass gets its own fill inside the glass-blue band (`--glass-band-hi` to `--glass-band-lo`): lower `vd` sits toward flint, the same name gets the same fill within a drawing, and up to 8 distinct glasses stay distinct. A fill depends on the drawing's whole glass set, so one glass can fill differently in designs with different glasses. The fill is a CSS color function on `style`, resolved per theme with no redraw.
- **Chief ray:** `chief[k]` for fan k; without `chief`, the fan's middle ray, `floor(n / 2)`. That is eleoptics.com's rule, and it can be wrong for a vignetted fan, so record `chief` when you know it. An index outside the fan throws an error naming the fan.
- **`box`:** the `{zmin, zmax, ylo, yhi}` the drawing shows, in mm. It defaults to `layoutBounds([layout])`. Drawings with the same `box`, `width` and labels share one scale, so they compare true to size.
- **`layoutBounds(layouts)`:** the box that frames every layout given: z covers the rays, y covers 0, the rays and every surface edge but the image's, padded 4%.
- **`glassLegend(data)`:** legend keys for a layout's `{ name, nd, vd }` glasses: one `eleo-key eleo-key--swatch` span per distinct glass the drawing fills, by name, in order of first use, its swatch in that glass's polygon fill. `data` is a recorded layout or a system carrying one in `layout`, else `layoutWl`. Shorthand `'crown'`/`'flint'` and a glass on the last surface (which draws nothing) get no key; with no named glass it returns `''`.
- **`labels`:** one text per fan, drawn 6 px past the image plane, beside the end of that fan's chief ray, with room kept for them (6 px and 6 px a character of the longest, on the right). A fan with no rays gets none. A `null` entry skips that fan; more labels than fans throws. A `width` that the 4 px pad and the label room fill throws.
- **`marks`:** `false` drops the STO and IMA labels. Default `true`.

```js
import { layout2D, layoutBounds } from '@eleoptics/plots';

const box = layoutBounds([before, after]);
const labels = ['0°', '12°', '24°'];
beforeEl.innerHTML = layout2D({ data: before, box, labels, marks: false });
afterEl.innerHTML = layout2D({ data: after, box, labels, marks: false });
```

### Migration: `data.layout` is a recorded layout

This is a breaking change. `data.layout` used to be a bare rays array (`layout[field][ray]` of `[z, y]` points), drawn against `data.profiles` and `data.zimg`. It is now a recorded layout, `{surfaces, rays, chief?}`, and so is `data.layoutWl` (previously `{field, rays}`). Record your system in the format above: each lens surface becomes a `surfaces` entry with its `profile` and the `glass` after it, the stop and the image become surfaces with `stop` or `image` set, and the old rays array moves to `rays`. `layout2D` throws on the old shape. `layout3D` is unchanged: it still reads `profiles` and `rays3d`.

## Curves

`curve` draws line series against two axes. Pass data, labels and a role per series; there is no color, font or stroke-width option. Restyle by setting the CSS custom properties (`--series-1..8`, `--ink`, `--plot-axis`) on an ancestor.

```js
import { curve } from '@eleoptics/plots';

el.innerHTML = curve({
  series: [
    { points: [[0, 1], [100, 0.62], [200, 0.3]], index: 0, role: 'tangential' },
    { points: [[0, 1], [100, 0.7], [200, 0.4]], index: 0, role: 'sagittal' },
  ],
  x: { label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400] },
  y: { label: 'Modulus', range: [0, 1] },
  width: 460, height: 260,
});
```

- **`series`:** `{ points: [[x, y], ...], index?, role? }` each, drawn in order. `index` k takes the k-th series color. `role`: `tangential` (solid, the default), `sagittal` (dash `5 3`), or `reference` (`--ink`, dash `1 3`; ignores `index`). Every role draws a 1 px stroke.
- **`x`, `y`:** `{ label, unit?, range?, ticks? }`, drawn as `label, unit`. `range` defaults to the nice range of the data and `ticks` to nice ticks over the range. A range that is not two finite numbers (empty, or with a NaN or infinite end) is dropped and the axis uses the data's nice range; a reversed or zero-width range is widened to a unit either side of its start. Every point is drawn and the plot area clips what lies outside the range.
- **Zero line:** an axis range that straddles 0 draws a line at 0 in `--plot-axis`.
- **Drawing:** the series sit in a nested `<svg>` that clips them, inside one `<g transform="matrix(...)">` in data coordinates under a non-scaling stroke. Inverting that matrix recovers the data.
- **`panels`:** `curve({ panels: [{ title?, series }], columns?, x, y, width?, height? })` draws a grid of plots (`columns` defaults to one row) on one x and one y range: the given `range`, else the nice range over every panel's data. Each panel has its own nested `<svg>` and `<g transform="matrix(...)">` in data coordinates, its `title` above it, and the axis labels are drawn once. A series is a `<path>`: a point with a `null`, NaN or infinite coordinate breaks it, and the next point starts a new subpath (`M`); a run of one point is a dot. Without `panels`, a series is a `<polyline>` as before.
- **`rayFan`:** draws the sample's ray fans (`kind: 'opd'` for optical path difference) through `curve`'s `panels`: tangential (`Py`) above sagittal (`Px`), a column per field (`fields` picks them), one shared y range of ±`fullScale` (default: the next step above the largest value). `panelWidth` (default 170) is each plot area's width in px.
- **`kind`:** the older `curve({ kind: 'mtf' | 'fieldCurvature' | 'distortion' | 'chromaticFocus' })` still draws from the sample.

## Bars

`bars` draws signed, grouped bars in `curve`'s frame: a group per category, a bar per series. Pass data, labels and an `index` per series; there is no color, font or width option.

```js
import { bars } from '@eleoptics/plots';
el.innerHTML = bars({
  categories: ['1', '2', '3'],
  series: [{ values: [0.012, -0.004, 0.001], index: 0, label: 'SI' }],
  total: 'Σ',
  y: { label: 'Seidel sum', unit: 'mm' },
});
```

- **Bars:** each is a `<rect>` in the data-space `<g transform="matrix(...)">`, in category order then series order, with `y = min(0, v)` and `height = |v|` in data units, so inverting the transform recovers `v`. Category k occupies x from k to k + 1; bars fill 80 % of it.
- **`total`:** a string appends a group of per-series sums after a half-band gap, labelled with that string.
- **Dividers:** a thin dotted line (`--plot-grid`, 1 px, dash `1 3`) at each boundary between category groups and midway in the gap before the `total` group, the frame's full height, drawn outside the data-space group so it holds only bars.
- **Range:** `y.range`, else the nice range of the values and 0; a zero line is drawn only when the range straddles 0. When a band is under 14 px, only every k-th category label is drawn, at its band centre.
- **Key:** one entry for each series with a `label`. The row starts a new line when an entry would pass the frame's right edge, and each extra line takes 14 px from the plot area's height, down to a frame 1 px taller than its margins (a very small drawing stops wrapping and the row runs past the right edge), so every series stays named. An `index` that is not a non-negative integer, or a `null` or non-object entry in `series`, throws a `TypeError`.
- **Skipped values:** a value that is not a finite number (`NaN`, a string, `undefined`, `true`) draws no rect and is left out of the `total` sum and the range. A series with no finite value still draws a zero-height Σ bar, which keeps the Σ group's order fixed per series.

## Spot diagrams

`spot({ data })` draws the sample's spots. `spot({ panels })` draws points you give it, one square panel each. RMS and GEO are computed from each panel's drawn points about the reference:

```js
el.innerHTML = spot({
  panels: [{ title: '1.0°', series: [{ points: [[0.4, -1.2], [1.1, 0.3], [-0.8, 0.5]], index: 0 }], airy: 2.87 }],
  unit: 'µm', reference: 'centroid',
});
```

The panel's notes read `RMS 1.09 µm` and `GEO 1.21 µm`, and the caption under the panels has one line per active setting:

```
Reference: centroid
Airy radius 2.87 µm
RMS, GEO
```

- **`panels`:** `{ title?, series: [{ points: [[x, y], ...], index? }], airy?, notes? }` each. `index` k takes the k-th series color. `airy` is the diffraction-limit radius in data units, drawn as a circle centred on the origin; `notes` are your own text lines under the panel, after the computed RMS and GEO. A point that is not two finite numbers is skipped.
- **`origin`, `reference`:** `reference` is `'chief'` (the default: points as given, about the origin) or `'centroid'` (each panel re-centred on the centroid of all its points). Case and surrounding spaces are ignored; anything else means chief. The sample's `spot({ data })` defaults to `'centroid'`. `origin` is the label for the `'chief'` reference (default `chief ray`), e.g. `'paraxial chief ray'`; the caption reads `Reference: <origin>`.
- **`showStats`, `showAiry`:** both default on. `showStats: false` drops the RMS and GEO notes and their caption part. `showAiry: false` hides the Airy circles and their caption part, which names the radius when every panel has the same one and says `Airy circle` otherwise.
- **`scale`, `half`, `unit`:** `common` (the default) gives every panel one half-width, `half` if given, else the next nice step above the largest coordinate or `airy` of any panel; `auto` fits each panel's points and circle (`half` is ignored). `half` and `airy` each count only when finite and above 0. Each panel is labelled `±half unit`; `unit` also follows the RMS and GEO values and the Airy radius in the caption. `width` and `height` size the figure: a height too small for the notes and caption grows to fit, and with no `width` the figure is at least as wide as its longest caption line.
- **`label`:** the SVG's `aria-label` (default `Spot diagrams`).
- **Drawing:** each panel is a nested `<svg>` holding one `<g transform="matrix(...)">` in data coordinates, with the same scale on both axes and a non-scaling stroke; inverting the matrix recovers the points. A series is one `<path>` of dots, each `M x,y h0` under a round cap (2.2 px across).

## Palettes

Plots color index 1 to 8 in the standard order. For readers with color vision deficiency, set a palette on the page:

```html
<html data-palette="red-green">
```

The values are `standard` (the default), `red-green` (protanopia and deuteranopia) and `blue-yellow` (tritanopia). Use one palette per page, on `<html>`. SVG plots recolor at once; canvas plots (`map2D`, `layout3D`) redraw as on a theme change.

`--series-1` to `--series-8` are the index colors for any chart on the page. They follow the palette and theme. The token number is not the index.

## Physics helpers

```js
import { airy, airyRadius, j1, slabMode, colormap, mtfDiffraction } from '@eleoptics/plots/physics';

airy(r, 0.5876, 4);      // Airy intensity at r µm for f/4 at 587.6 nm, peak 1
airyRadius(0.5876, 4);   // 2.87 µm: first dark ring, 1.22 λN
slabMode(y, 5);          // TE0 mode of a slab waveguide with a 5-unit core half-width
colormap('ember');       // 256 [r, g, b] entries in the current theme
mtfDiffraction(nu, 0.0005876, 4); // nu in cycles/mm, lambda in mm; 0 past cutoff
```

## Without a bundler

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="plots.css">
<script src="eleo-plots.js"></script>         <!-- window.ELEO -->
<script src="eleo-plots-sample.js"></script>  <!-- optional: the sample system -->
```

`eleo-physics.js` is the physics helpers alone (1 KB). `eleo-layout.js` is `layout2D`, `layoutBounds` and `glassLegend` alone, with no sample, for drawing recorded layouts. It styles its own texts, so `tokens.css` is all it needs (a size test caps its growth at 2 KB gzipped per roadmap row).

For Svelte, see [`@eleoptics/plots-svelte`](https://www.npmjs.com/package/@eleoptics/plots-svelte). MIT licensed. Part of [eleo-ui](https://github.com/ELEOptics/eleo-ui).
