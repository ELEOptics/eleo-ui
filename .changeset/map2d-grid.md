---
"@eleoptics/plots": minor
---

Changed: `map2D` draws its grid over the image, in the map's `--map-grid-<map>` token (it was drawn under the image, hidden). New: `grid: { x: { major, minor }, y: { ... } }` sets the labelled ticks and the minors per interval; `false` draws none.
