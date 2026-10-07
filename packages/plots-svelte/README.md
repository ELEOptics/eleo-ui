# @eleoptics/plots-svelte

Svelte 5 components for [`@eleoptics/plots`](https://www.npmjs.com/package/@eleoptics/plots): `PlotCard`, `Layout2D`, `Layout3D`, `SpotDiagram`, `RayFan`, `CurvePlot`, `Map2D`, `Icon`, `Legend` and `Colorbar`. Canvas plots redraw when their props, the theme or the palette change.

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
  {#snippet footer()}<Legend kind="field" />{/snippet}
</PlotCard>

<PlotCard title="PSF" meta="0.0°, linear">
  <Map2D data={system} kind="psf" bind:range label="Point spread function" />
  <Colorbar map="ember" labels={['1', '0']} />
</PlotCard>
```

`Layout2D` takes `layout2D`'s options: `data` is a recorded layout or a system carrying one (see the [plots README](https://www.npmjs.com/package/@eleoptics/plots) for the format and the migration from the old `data.layout`). To compare two designs at one scale, give both the same `box`:

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

`Legend` takes `kind` (`field`, `wavelength`, `ts`, `rays`) and `n`, or `kind="glass"` with `data`, a recorded layout or a system carrying one: one swatch key per drawn glass, by name, in order of first use, in the fill `Layout2D` gives its lenses (`glassLegend` in `@eleoptics/plots`):

```svelte
<PlotCard title="Layout">
  <Layout2D data={layout} label="Lens layout" />
  {#snippet footer()}<Legend kind="glass" data={layout} />{/snippet}
</PlotCard>
```

`PlotCard` takes `state` (`loading`, `empty`, `error`, `stale`) and `message` for the states between results, `paper` for a light figure inside the dark theme, and `compact` and `selected` for dashboards.

Load Fira Sans and Fira Code in your app. MIT licensed. Part of [eleo-ui](https://github.com/ELEOptics/eleo-ui).
