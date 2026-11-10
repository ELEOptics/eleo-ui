# @eleoptics/plots-svelte

Svelte 5 components for [`@eleoptics/plots`](https://www.npmjs.com/package/@eleoptics/plots): `PlotCard`, `Layout2D`, `Layout3D`, `SpotDiagram`, `RayFan`, `CurvePlot`, `BarPlot`, `Map2D`, `Icon`, `Legend` and `Colorbar`. Canvas plots redraw when their props, the theme or the palette change.

```bash
npm install @eleoptics/tokens @eleoptics/plots @eleoptics/plots-svelte
```

It peers `@eleoptics/plots` `>=0.8.0 <1`: the wrappers draw at their width, which plots 0.7.0 ignores.

```svelte
<script>
  import '@eleoptics/tokens/tokens.css';
  import '@eleoptics/plots/plots.css';
  import { PlotCard, Layout2D, Map2D, Colorbar, Legend } from '@eleoptics/plots-svelte';
  let { system } = $props();
  let range = $state();
</script>

<PlotCard title="Layout" meta="YZ" colorKey="Color: field">
  <Layout2D data={system} rays="fan" label="Lens layout with traced rays" />
  {#snippet footer()}<Legend kind="field" n={3} />{/snippet}
</PlotCard>

<PlotCard title="PSF" meta="0.0°, linear">
  <Map2D data={system} kind="psf" bind:range label="Point spread function" />
  <Colorbar map="ember" labels={['1', '0']} />
</PlotCard>
```

`Map2D` draws a typed grid as one SVG with axes and a colorbar (`values` and `extent`, see `Map2DGridProps` in the plots README), colored by its own element's tokens and redrawn on a theme or palette change. Without `values` it draws the canvas sample above:

```svelte
<Map2D values={grid} extent={[-2, 2, -2, 2]} x={{ label: 'x', unit: 'mm' }} y={{ label: 'y', unit: 'mm' }} map="wave" label="Wavefront" />
```

`Layout2D` takes `layout2D`'s options: `data` is a recorded layout or a system carrying one (see the [plots README](https://www.npmjs.com/package/@eleoptics/plots) for the format and the migration from the old `data.layout`). To compare two designs at one scale, give both the same `box` and `width`, and the same labels (drawings with one box, width and labels share a scale):

```svelte
<script>
  import { layoutBounds } from '@eleoptics/plots';
  import { Layout2D } from '@eleoptics/plots-svelte';
  let { before, after } = $props();
  const box = $derived(layoutBounds([before, after]));
  const labels = ['0°', '12°', '24°'];
</script>

<Layout2D data={before} {box} {labels} marks={false} label="Layout before optimization" />
<Layout2D data={after} {box} {labels} marks={false} label="Layout after optimization" />
```

`CurvePlot` takes typed `series` (`points`, `index`, `role`: `tangential`, `sagittal`, `reference` or `limit`) with `x` and `y` axes (`label`, `unit`, `range`, `ticks`), or an analysis `kind` (`mtf`, `fieldCurvature`, `distortion`, `chromaticFocus`). Every role, `limit` included, draws the same stroke: 1 px up to a 234 px plot frame and `sqrt(F / 234)` px above it (F is the frame's width, [ADR-0003](../../agent_docs/adr/0003-plot-scale.md)). The plot area clips, and a range left out is the nice range of the data. There is no color option:

```svelte
<CurvePlot
  series={[{ points: [[0, 1], [100, 0.62], [200, 0.31]], index: 0, role: 'tangential' }]}
  x={{ label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400] }}
  y={{ label: 'Modulus', range: [0, 1] }}
  label="MTF at 0°"
/>
```

`CurvePlot` also takes `panels` (each with a `title` and `series`) and `columns`: a grid of plots on one shared scale with the axis labels drawn once. Both take `limits`, `[{ x | y: number | [lo, hi], label? }]`: a number draws a limit line across the plot and a pair a band, in every panel, e.g. `limits={[{ y: 0.5, label: 'spec' }]}`; a range left out grows to contain them. `grid={false}` drops the grid lines of `CurvePlot` and `SpotDiagram`. `SpotDiagram` takes typed `panels` (`title`, `series` of `points` and `index`, `airy` radius), with `origin`, `reference` (`chief` or `centroid`), `showStats`, `showAiry`, `scale`, `half`, `grid`, `unit` and `width`; the wrapper's `label` names the figure; without `panels` it draws the sample by `colorBy`. Neither has a color option:

```svelte
<CurvePlot
  panels={[{ title: '1.0° · Py', series: [{ points: [[-1, 2], [0, 0], [1, -3]], index: 0 }] }]}
  columns={3}
  x={{ label: 'Pupil', range: [-1, 1] }}
  y={{ label: 'Ray error', unit: 'µm' }}
/>
<SpotDiagram
  panels={[{ title: '0.0°', series: [{ points: [[0.1, -0.2], [0.3, 0.4]], index: 0 }], airy: 2.4 }]}
  origin="chief ray" reference="centroid" unit="µm" half={5}
/>
```

`CurvePlot` takes `onhover` and `onselect`: `onhover({ x, y, series: { index, label?, role? }, panel?, interpolated?, segment? })` fires for the curve point within 6 px of the pointer and, when none is, for the spot on a drawn segment within 24 px of it: the pointer projected onto the line between two points and clamped to it (`interpolated: true`, `segment: [i, i + 1]`, the indices of the two points; at a segment's end `x` and `y` can equal a data point). It fires `onhover(null)` when the pointer leaves (`series.index` is the series' position in `series`, or in its panel, not its `index` palette slot); `onselect(SelectEvent)` fires on a click on a mark (a series, bar, surface or field: `series`, `panel`, `category`, `surface` or `field`) and sends nothing for a click on no mark. `CurvePlot`, `SpotDiagram`, `RayFan`, `BarPlot`, `Map2D` (typed `values` only; the canvas sample has no pointer) and `Layout2D` all take `onhover` and `onselect`. With no callback they still draw a hover dot (only on a data point, none on an interpolated reading), dashed drop lines to the axes (on framed plots; not on `Layout2D`) and a tooltip near the pointer, `Tangential · 120 cycles/mm, 0.62`. The tooltip's axes: `CurvePlot` takes the units of its `x` and `y` specs, typed `Map2D` those of its `x`, `y` and `value` specs (the value after ` = `; a masked sample shows none), `SpotDiagram` x and y in `µm`, `RayFan` y in `µm` (`waves` for `kind="opd"`), `BarPlot` y from its `y` spec, `Layout2D` x and y in `mm`. `PlotCard` has no readout line.

`BarPlot` draws signed, grouped bars: a group per category, a bar per series (`values`, `index`, `label`), with `total` appending a group of per-series sums and `y` the value axis (`label`, `unit`, `range`, `ticks`). `limits` pass through as in `CurvePlot`, y only (`[{ y: number | [lo, hi], label? }]`): a category axis has no x value, so an `x` limit throws. `BarPlot` needs `@eleoptics/plots` 0.5.0 or later (`bars`); with an older plots, rendering it throws `BarPlot needs @eleoptics/plots 0.5.0 or later (bars)`, and the other components still work. There is no color option:

```svelte
<BarPlot
  categories={['1', '2', '3']}
  series={[{ values: [0.012, -0.004, 0.001], index: 0, label: 'SI' }]}
  total="Σ"
  y={{ label: 'Seidel sum', unit: 'mm' }}
  limits={[{ y: [-0.005, 0.005], label: 'tolerance' }]}
  label="Seidel sums"
/>
```

`Legend` takes `kind` (`field`, `wavelength`, `ts`, `rays`) and `n` (`field` and `wavelength` need `n` or `values` when there is no sample; `values` is an optional array of recorded field angles or wavelengths that labels each key, as `legend` in `@eleoptics/plots` takes), or `kind="glass"` with `data`, a recorded layout or a system carrying one: one swatch key per drawn glass, by name, in order of first use, in the fill `Layout2D` gives its lenses (`glassLegend` in `@eleoptics/plots`):

```svelte
<PlotCard title="Layout">
  <Layout2D data={layout} label="Lens layout" />
  {#snippet footer()}<Legend kind="glass" data={layout} />{/snippet}
</PlotCard>
```

`CurvePlot`, `RayFan`, `BarPlot`, `Map2D` (typed), `SpotDiagram` and `Layout2D` measure their box and draw at its width when you give no `width`; the server draws the default width and the client redraws on hydration (`Layout2D` draws its default in a box of 8 px or less).

`PlotCard` takes `state` (`loading`, `empty`, `error`, `stale`) and `message` for the states between results, `paper` for a light figure inside the dark theme, and `compact` and `selected` for dashboards.

Load Fira Sans and Fira Code in your app. MIT licensed. Part of [eleo-ui](https://github.com/ELEOptics/eleo-ui).
