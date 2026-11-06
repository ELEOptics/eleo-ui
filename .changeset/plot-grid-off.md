---
"@eleoptics/plots": minor
---

New: `grid: false` on `curve` (a single plot or `panels`), `rayFan` and `bars` draws no grid lines; the tick labels, frame, zero axes and `bars`' category dividers stay. Without it the SVG is unchanged. `CurvePlot`, `RayFan` and `BarPlot` pass it through.
