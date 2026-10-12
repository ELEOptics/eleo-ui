---
"@eleoptics/plots": minor
---

**Breaking:** `curve` now throws a `TypeError` on a series `role` that is not one of the four roles (`tangential`, `sagittal`, `reference`, `limit`), `null` included; on an `index` that is not a non-negative integer, `null` and numeric strings such as `'1'` included; and on `limits` given together with `kind`. Migrate by passing one of the four roles, an integer `index`, and `limits` only on the typed call (not with `kind`). New: `bars` draws grouped bars with categories, series, an optional `total`, and an axis from `y`. `curve` and `bars` take `limits`, limit lines and bands drawn in the data-space group, in the new `limit` role. A single-plot `curve` now leaves 26 px above its frame for the y-axis title, as `bars` does, so the frame and its contents move down 12 px. New types: `BarPlotProps`, `BarSeries`, `PlotLimit`.
