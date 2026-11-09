---
"@eleoptics/plots": minor
---

`spot` panels label their grid ticks (x under the panel, y left of it, also with `grid: false`) and drop the `±half` label; with a `unit` the caption gains "x, y in <unit>". Each panel has a left margin for the labels, so the panel side shrinks to keep `width`, and the `spot` minimum width in `PLOT_SIZES` grows by 21.6 px per panel.
