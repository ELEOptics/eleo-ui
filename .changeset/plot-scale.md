---
"@eleoptics/plots": minor
---

Plots draw at their width in px and size their text by one rule (ADR-0003). Framed renderers (`curve`, `rayFan`, `bars`, `map2D`, `spot`, `throughFocus`) take it from the plot frame's width F: `F / 18` px inside a 9 to 13 px band, growing slowly above it, with margins, label room and line pitch following the text and strokes and dots growing above the band. `layout2D` takes it from its drawing width W: `W / 70` px, labels hidden under 9 px, text and strokes growing above 910 px. Rendered text and stroke widths change.

`fit` redraws a plot at its container's measured width, and `PLOT_SIZES` publishes each renderer's minimum column for the rule.
