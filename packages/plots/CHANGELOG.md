# @eleoptics/plots

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
