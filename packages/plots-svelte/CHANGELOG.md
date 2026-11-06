# @eleoptics/plots-svelte

## 0.5.1

### Patch Changes

- 2201b7a: Peer `@eleoptics/plots` is now `>=0.8.0 <1`: the wrappers draw at a width, which plots 0.7.0 ignores.

## 0.5.0

### Minor Changes

- 5f79c92: The framed wrappers measure their container and draw at its width; on the server they draw their default width.
  
  `Legend` takes `values`: explicit field angles or wavelengths for `field` and `wavelength` keys.

### Patch Changes

- c3b7e70: Peer `@eleoptics/plots` is now `>=0.7.0 <1`, the release that ships the typed `map2D` behind `<Map2D values>`.

## 0.4.0

### Minor Changes

- da6a3b1: New: `Map2D` takes typed props. `<Map2D values extent … />` renders the SVG of `map2D(props)` in a `div.eleo-svg` and redraws when the theme or palette changes; without `values` it draws the canvas as before. The typed props need `@eleoptics/plots` 0.7.0 or newer.

### Patch Changes

- 246b9bc: Raise the `@eleoptics/plots` peer range to `>=0.5.0 <1`: `BarPlot` needs `bars`, first published in plots 0.5.0.

## 0.3.0

### Minor Changes

- 4f59562: New `BarPlot` component draws the `bars` renderer from `@eleoptics/plots`, with `BarPlotProps`.
  
  `BarPlot` needs `@eleoptics/plots` 0.5.0 or later; with an older plots, rendering it throws `BarPlot needs @eleoptics/plots 0.5.0 or later (bars)`, and the rest of the package still loads.

## 0.2.0

### Minor Changes

- 36557b0: `Legend` takes `kind="glass"` with `data`, a recorded layout or a system carrying one: one swatch key per glass `Layout2D` draws, by name, in order of first use, in its lenses' fill. The `@eleoptics/tokens` peer is now `>=0.1.0 <1`, so tokens 0.2 satisfies it.

## 0.1.1

### Patch Changes

- 14338b6: Index colors follow a pinned field order per palette: `--series-1` to `--series-8` map to fields for the standard, red-green and blue-yellow palettes (`<html data-palette>`), every renderer colors through them, and the segmented control marks its selection in glass instead of amber. Svelte canvases redraw on a palette change.
- fc377a9: Widens the `@eleoptics/plots` peer range to `>=0.1.0 <1`, so it accepts the new plots.
