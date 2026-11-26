# @eleoptics/plots-svelte

## 0.7.0

### Minor Changes

- b0ef1cb: Breaking: `layout3D` moved out of the main entry to `@eleoptics/plots/layout3d` (and its own `eleo-layout3d.js` IIFE for classic pages), and draws through three.js, an optional peer (`npm i three`). `import { layout3D } from '@eleoptics/plots'` no longer works. `layout3D(canvas, { data: layout, rays: "fan", view: "front" })` is typed as `Layout3DProps` (`data: RecordedLayout`, `rays: "marginal-chief" | "fan" | "chief" | false`, `view: "iso" | "front" | "top"`; with no `view`, `yaw` or `pitch` the camera looks mainly along +z from the object side, turned 20° in yaw and 15° in pitch off the optical axis, i.e. yaw 70, pitch -15, a missing `yaw` or `pitch` taking those values; `"iso"` is true isometric at yaw -45, pitch 35.264), and `<Layout3D data={layout} />` takes the same props. It no longer reads `profiles` or `rays3d`, and throws `layout3D: pass { data: RecordedLayout }` without `data`.
  
  Breaking, `@eleoptics/plots-svelte`: `Layout3D` moved out of the index to `@eleoptics/plots-svelte/layout3d` (`import { Layout3D } from '@eleoptics/plots-svelte/layout3d'`), so an app that imports only the 2D wrappers bundles without `three`; `three` is needed only for that subpath.
- d8c9ea5: Breaking: `RayFan` was removed (draw fans with `CurvePlot` and `panels`), and `CurvePlot`'s `kind`, `SpotDiagram`'s sample unit and `Map2D`'s canvas branch are gone with the plots sample: the wrappers draw only the data they are passed.

### Patch Changes

- 2628c93: A wrapper whose options change what its pointer action is made of (a callback or `values` turning on or off) keeps keyboard focus: the action now binds the new call before it stops the old one, so the box keeps its `tabindex`.
- f3f621d: Peer `@eleoptics/plots` is now `>=0.10.0 <1`: the wrappers import `interact`, first in plots 0.10.0.

## 0.6.0

### Minor Changes

- 5762087: New: the wrappers take `onhover`, `onselect` and, on the zoomable ones (`CurvePlot`, `RayFan`, `SpotDiagram`, `Map2D`, `Layout2D`), `onview`; `BarPlot` takes the first two. They call `interact` from `@eleoptics/plots`. Hovering a plot shows the default tooltip near the pointer, with the wrapper's own axes and units (`Map2D` also its value). A zoomable wrapper keeps its view across data changes until reset, is controlled when the caller passes `view`, and resets on `view={null}`. Every wrapper's box, `BarPlot`'s included, is now a tab stop (`tabindex="0"` unless set) and takes the keys described in the plots README's Keyboard section.

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
