---
"@eleoptics/plots": minor
---

Changed: `map2D` draws no grid unless asked (a continuous color wants none): no `grid`, `grid: null` or `grid: false` draws no lines, over or under the image, and keeps the tick labels. New: `grid: true` draws the default majors over the image, in the map's `--map-grid-<map>` token (the grid was drawn under the image, hidden), and `grid: { x: { major, minor }, y: { ... } }` sets the labelled ticks (`major`) and the minor lines per interval (`minor`, a count; `minor: false` draws no minors, as does leaving it out); in an object an axis set to `false` draws no lines on that axis, and an axis set to `null` or left out has the default majors.
