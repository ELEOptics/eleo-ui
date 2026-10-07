# @eleoptics/plots

## 0.2.0

### Minor Changes

- 14338b6: Index colors follow a pinned field order per palette: `--series-1` to `--series-8` map to fields for the standard, red-green and blue-yellow palettes (`<html data-palette>`), every renderer colors through them, and the segmented control marks its selection in glass instead of amber. Svelte canvases redraw on a palette change.
- 52bb60d: **Breaking:** `data.layout` and `data.layoutWl` are now recorded layouts, `{surfaces, rays, chief?}`, instead of a bare rays array (and `{field, rays}`), and `layout2D` throws on the old shape. To migrate, record each surface with its `profile` and `glass` and move the old rays array to `rays`: see the plots README's `### Migration` section. New: `layoutBounds`; `layout2D` takes `box`, `labels`, `marks` and reads a recorded `chief`; the types `RecordedLayout`, `RecordedSurface`, `LayoutBox` and `LayoutSystem`; and the `./eleo-layout.js` export (`layout2D` and `layoutBounds` alone).
