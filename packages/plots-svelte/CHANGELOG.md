# @eleoptics/plots-svelte

## 0.2.0

### Minor Changes

- 36557b0: `Legend` takes `kind="glass"` with `data`, a recorded layout or a system carrying one: one swatch key per glass `Layout2D` draws, by name, in order of first use, in its lenses' fill. The `@eleoptics/tokens` peer is now `>=0.1.0 <1`, so tokens 0.2 satisfies it.

## 0.1.1

### Patch Changes

- 14338b6: Index colors follow a pinned field order per palette: `--series-1` to `--series-8` map to fields for the standard, red-green and blue-yellow palettes (`<html data-palette>`), every renderer colors through them, and the segmented control marks its selection in glass instead of amber. Svelte canvases redraw on a palette change.
- fc377a9: Widens the `@eleoptics/plots` peer range to `>=0.1.0 <1`, so it accepts the new plots.
