---
"@eleoptics/plots": minor
---

New: `grid: false` on `curve` (a single plot, `panels` or the `kind` call), `rayFan` and `bars` draws no grid lines, as it already does on `map2D`; the tick labels, frame, zero axes and `bars`' category dividers stay. Without it the SVG is unchanged. `CurvePlot`, `RayFan` and `BarPlot` pass it through.
