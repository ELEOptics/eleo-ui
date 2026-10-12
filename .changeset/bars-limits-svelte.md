---
"@eleoptics/plots-svelte": minor
---

New `BarPlot` component draws the `bars` renderer from `@eleoptics/plots`, with `BarPlotProps`.

`BarPlot` needs `@eleoptics/plots` 0.5.0 or later; with an older plots, rendering it throws `BarPlot needs @eleoptics/plots 0.5.0 or later (bars)`, and the rest of the package still loads.
