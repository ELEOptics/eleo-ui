# @eleoptics/plots

## 0.10.0

### Minor Changes

- 146bbf4: New: a layout's per-point `status` (`Alive`, `Virtual`, `Dead`) is drawn, and `layout2D` takes `show`, an array of the statuses to draw (default all three). With `status`, a ray is drawn to its last point. Virtual (dotted) and Dead (solid) runs are drawn faded, at opacity .35, under the Alive runs, and each segment takes its start point's status. Layouts without `status` draw their rays as before.

### Patch Changes

- 400d7f4: Fix: a field label stays at least 1 em below the top of a cropping `box`. A glass before an image whose profile is missing, empty or non-finite now throws a named `layout2D: surface i` error.

## 0.9.0

### Minor Changes

- 2201b7a: New: `minWidth(name, props)` returns the narrowest drawing width, in px, of a call: the width at which its plot frame is 162 px and its text is at the 9 px floor, counting the call's own margins (a colorbar's labels, the x tick labels) and its panels. It is on the module and on `window.ELEO`.

## 0.8.0

### Minor Changes

- 3cd943b: `spot` panels take `circle: { radius, label }`: a labelled circle drawn like the Airy circle, counted in the box size and named in the caption.
  
  `spot` takes `textScale`, which multiplies its text size and the text layout (gap, line pitch, foot and caption width) with it.
  
  `legend(kind, n?, values?)` takes explicit field angles or wavelengths for `field` and `wavelength` keys.
- 5f79c92: Plots draw at their width in px and size their text by one rule (ADR-0003). Framed renderers (`curve`, `rayFan`, `bars`, `map2D`, `spot`, `throughFocus`) take it from the plot frame's width F: `F / 18` px inside a 9 to 13 px band, growing slowly above it, with margins, label room and line pitch following the text and strokes and dots growing above the band. `layout2D` takes it from its drawing width W: `W / 70` px, labels hidden under 9 px, text and strokes growing above 910 px. Rendered text and stroke widths change.
  
  `fit` redraws a plot at its container's measured width, and `PLOT_SIZES` publishes each renderer's minimum column for the rule.

## 0.7.0

### Minor Changes

- da6a3b1: New: `map2D` takes a typed grid. `map2D(props)` with `values` (rows of numbers, row 0 at the top; a cell that is `NaN`, `null` or otherwise not a finite number is masked and shows the page's `--surface`) and `extent: [x0, x1, y0, y1]` returns one SVG string: curve's frame with axes from `x` and `y`, a pixelated image of the cells, and an optional colorbar from `value`. Options: `map` (the brand maps `ember`, `wave`, `viridis` and `gray`; `wave` gets a range symmetric about 0), `range`, `scale: 'log'` with `decades`, `aperture: { x, y, r }`, and `polar: { radii, angles }` for ring × spoke samples. Colors come from `el`'s tokens at draw time, so call it again after a theme or palette change. Bad input throws a `TypeError`. The sample call `map2D(canvas, { kind })` draws as before. New type: `Map2DGridProps`.

## 0.6.0

### Minor Changes

- be30828: **Visible change:** every collimated `layout2D` drawing changes. Collimated ray starts now move onto a pupil-centred arc, normal to each field and clear of the optics, so the rays no longer start inside the first surface. `layoutBounds` frames the moved starts, every ray point and the mirror bodies, so the drawing's box changes too. New: `RecordedLayout` takes `alive?: number[][]`, the per-ray alive points: a ray's non-alive tail is drawn dotted `1 3`, and a chief's dotted part replaces its `6 4` dash. `RecordedLayout` also takes `dead?: boolean[][]`: a dead ray stops at its blocking point with no tail, and a dead chief keeps its `6 4` dash. `RecordedSurface` takes `mirror?`, `obscuration?` and `hole?`: a mirror is a hatched `--mech` body with a flat back at D/8 away from the light, an annulus leaves its hole open, and an obscuration bar is hidden inside a body. The new validation errors for `alive`, `dead` and `hole` name `layout2D`. Message change (#136): an unboxed non-finite ray point is now reported as `layout2D: fan K ray I has a non-finite point`, where it was `layoutBounds: layouts[0].rays[K][I] …`.

## 0.5.0

### Minor Changes

- 4f59562: **Breaking:** `curve` now throws a `TypeError` on a series `role` that is not one of the four roles (`tangential`, `sagittal`, `reference`, `limit`), `null` included; on an `index` that is not a non-negative integer, `null` and numeric strings such as `'1'` included; and on `limits` given together with `kind`. Migrate by passing one of the four roles, an integer `index`, and `limits` only on the typed call (not with `kind`). New: `bars` draws grouped bars with categories, series, an optional `total`, and an axis from `y`. `curve` and `bars` take `limits`, limit lines and bands drawn in the data-space group, in the new `limit` role. A single-plot `curve` now leaves 26 px above its frame for the y-axis title, as `bars` does, so the frame and its contents move down 12 px. New types: `BarPlotProps`, `BarSeries`, `PlotLimit`, `PlotLimitX`, `PlotLimitY`.
- b6a5d06: A typed curve: `curve({ series, x, y })` draws any series, each with a role (`tangential`, `sagittal`, `reference`, `index`), 1 px strokes, nice default axes, and a viewport clip. `kind` works as before; its tick labels print at one shared precision. New in physics: `mtfDiffraction`. `legend` draws without the sample. `CurvePlotProps` is now a union type, so a consumer that `extends` it as an interface writes `type X = CurvePlotProps & { ... }` instead.
- 6f5f532: Curve panels and a typed spot diagram. `curve` takes `panels`, each a `CurvePanel` of `CurvePanelSeries`, laid out in a grid (`columns`, default one row) with shared ranges; a `null` point breaks the line. `rayFan` now draws through curve panels, so its look changes. `spot` takes typed panels (`SpotPanel` of `SpotSeries`) with a `reference`: `'chief'`, labelled with `origin`, or `'centroid'`. `showStats` prints RMS and GEO radii computed about that reference. `showAiry` draws the Airy circle as the panel's `airy`. A caption names each active setting. The sample `spot()` call now draws through the typed path: dots instead of circles, with RMS and GEO computed. New types: `CurvePanel`, `CurvePanelSeries`, `SpotPanel`, `SpotSeries`. `CurvePlotProps` and `SpotDiagramProps` are now unions, so a consumer that `extends` either as an interface writes `type X = CurvePlotProps & { ... }` instead.

## 0.4.0

### Minor Changes

- 6f38935: `layout2D`'s new defaults: no dot at the chief ray's end; field labels 6 px past the image plane, with room kept for them; rays 1 px at .85 opacity; the scale bar reads `10 mm`; nothing drawn outside the viewBox; texts styled without `plots.css`.

## 0.3.0

### Minor Changes

- 36557b0: Per-glass fills: a surface's `glass` can now be `{ name, nd, vd }`, and `layout2D` gives each distinct glass its own fill inside the glass-blue band (`--glass-band-hi` to `--glass-band-lo`), lower `vd` toward flint, the same name the same fill within a drawing. `'crown'` and `'flint'` still draw `--glass-crown` and `--glass-flint`. New: `glassLegend(data)`, one swatch key per drawn glass in first-use order, also in the standalone `./eleo-layout.js` entry, and the `Glass` type. Bad recorded data now fails with a named error: a glass other than `'crown'`, `'flint'`, `null` or `{ name, nd, vd }` with a non-blank `name` throws instead of drawing as crown, even one `JSON.stringify` cannot print; `layoutBounds` and `layout2D` name a surface with no `profile` or with a non-finite profile point, `layoutBounds` names a non-finite ray point, and so does `layout2D` when given a `box`. The classic build exposes `window.ELEO.sample`. The `@eleoptics/tokens` peer is now `>=0.1.0 <1`, so tokens 0.2 satisfies it. Per-glass fills need tokens 0.2 (its band tokens); with tokens 0.1 they fall back to fills between `--glass-crown` and `--glass-flint`, which sit closer together (under ΔE 8); use tokens 0.2 for distinct fills.

## 0.2.0

### Minor Changes

- 14338b6: Index colors follow a pinned field order per palette: `--series-1` to `--series-8` map to fields for the standard, red-green and blue-yellow palettes (`<html data-palette>`), every renderer colors through them, and the segmented control marks its selection in glass instead of amber. Svelte canvases redraw on a palette change.
- 52bb60d: **Breaking:** `data.layout` and `data.layoutWl` are now recorded layouts, `{surfaces, rays, chief?}`, instead of a bare rays array (and `{field, rays}`), and `layout2D` throws on the old shape. To migrate, record each surface with its `profile` and `glass` and move the old rays array to `rays`: see the plots README's `### Migration` section. New: `layoutBounds`; `layout2D` takes `box`, `labels`, `marks` and reads a recorded `chief`; the types `RecordedLayout`, `RecordedSurface`, `LayoutBox` and `LayoutSystem`; and the `./eleo-layout.js` export (`layout2D` and `layoutBounds` alone).
