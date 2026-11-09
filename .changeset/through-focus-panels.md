---
"@eleoptics/plots": minor
---

Changed: `throughFocus` draws each cell as `spot` draws a panel: a grid under the dots, a centre cross and round-cap dots; `grid: false` draws no grid lines. It labels its outer edges' ticks (x under the bottom row, y left of the left column) and captions the figure "x, y in µm"; the row label gains 2.4 text units of room for the y labels (more when the labels are longer than three characters), so a panel is a little narrower at a given `width`, and the `throughFocus` minimum width in `PLOT_SIZES` grows by 21.6 px.
