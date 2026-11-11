---
"@eleoptics/plots-svelte": minor
---

New: the wrappers take `onhover`, `onselect` and, on the zoomable ones (`CurvePlot`, `RayFan`, `SpotDiagram`, `Map2D`, `Layout2D`), `onview`; `BarPlot` takes the first two. They call `interact` from `@eleoptics/plots`. Hovering a plot shows the default tooltip near the pointer, with the wrapper's own axes and units (`Map2D` also its value). A zoomable wrapper keeps its view across data changes until reset, is controlled when the caller passes `view`, and resets on `view={null}`. The peer `@eleoptics/plots` is now `>=0.10.0 <1`, the first plots with `interact`.
