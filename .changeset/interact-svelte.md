---
"@eleoptics/plots-svelte": minor
---

New: the wrappers take `onhover`, `onselect` and, on the zoomable ones (`CurvePlot`, `RayFan`, `SpotDiagram`, `Map2D`, `Layout2D`), `onview`; `BarPlot` takes the first two. They call `interact` from `@eleoptics/plots`. Hovering a plot shows the default tooltip near the pointer, with the wrapper's own axes and units (`Map2D` also its value). A zoomable wrapper keeps its view across data changes until reset, is controlled when the caller passes `view`, and resets on `view={null}`. Every wrapper's box, `BarPlot`'s included, is now a tab stop (`tabindex="0"` unless set) and takes the keys described in the plots README's Keyboard section.
