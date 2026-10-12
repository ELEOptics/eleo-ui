# @eleoptics/plots-svelte

Svelte 5 components for [`@eleoptics/plots`](https://www.npmjs.com/package/@eleoptics/plots): `PlotCard`, `Layout2D`, `Layout3D`, `SpotDiagram`, `RayFan`, `CurvePlot`, `BarPlot`, `Map2D`, `Icon`, `Legend` and `Colorbar`. Canvas plots redraw when their props, the theme or the palette change.

```bash
npm install @eleoptics/tokens @eleoptics/plots @eleoptics/plots-svelte
```

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

`CurvePlot` takes typed `series` (`points`, `index`, `role`: `tangential`, `sagittal`, `reference` or `limit`) with `x` and `y` axes (`label`, `unit`, `range`, `ticks`), or an analysis `kind` (`mtf`, `fieldCurvature`, `distortion`, `chromaticFocus`). Every role draws 1 px, the plot area clips, and a range left out is the nice range of the data. There is no color option:

```svelte
<CurvePlot
  series={[{ points: [[0, 1], [100, 0.62], [200, 0.31]], index: 0, role: 'tangential' }]}
  x={{ label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400] }}
  y={{ label: 'Modulus', range: [0, 1] }}
  label="MTF at 0°"
/>
```

`CurvePlot` also takes `panels` (each with a `title` and `series`) and `columns`: a grid of plots on one shared scale with the axis labels drawn once. Both take `limits`, `[{ x | y: number | [lo, hi], label? }]`: a number draws a limit line across the plot and a pair a band, in every panel, e.g. `limits={[{ y: 0.5, label: 'spec' }]}`; a range left out grows to contain them. `SpotDiagram` takes typed `panels` (`title`, `series` of `points` and `index`, `airy` radius), with `origin`, `reference` (`chief` or `centroid`), `showStats`, `showAiry`, `scale`, `half`, `unit` and `width`; the wrapper's `label` names the figure; without `panels` it draws the sample by `colorBy`. Neither has a color option:

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

`BarPlot` draws signed, grouped bars: a group per category, a bar per series (`values`, `index`, `label`), with `total` appending a group of per-series sums and `y` the value axis (`label`, `unit`, `range`, `ticks`). `limits` pass through as in `CurvePlot`, y only (`[{ y: number | [lo, hi], label? }]`): a category axis has no x value, so an `x` limit throws. There is no color option:

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

`Legend` takes `kind` (`field`, `wavelength`, `ts`, `rays`) and `n` (`field` and `wavelength` need `n` when there is no sample), or `kind="glass"` with `data`, a recorded layout or a system carrying one: one swatch key per drawn glass, by name, in order of first use, in the fill `Layout2D` gives its lenses (`glassLegend` in `@eleoptics/plots`):

```svelte
<PlotCard title="Layout">
  <Layout2D data={layout} label="Lens layout" />
  {#snippet footer()}<Legend kind="glass" data={layout} />{/snippet}
</PlotCard>
```

`PlotCard` takes `state` (`loading`, `empty`, `error`, `stale`) and `message` for the states between results, `paper` for a light figure inside the dark theme, and `compact` and `selected` for dashboards.

Load Fira Sans and Fira Code in your app. MIT licensed. Part of [eleo-ui](https://github.com/ELEOptics/eleo-ui).
