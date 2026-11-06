---
"@eleoptics/plots": minor
---

Changed: `map2D` draws its grid over the image, in the map's `--map-grid-<map>` token (it was drawn under the image, hidden). New: `grid: { x: { major, minor }, y: { ... } }` sets the labelled ticks (`major`) and the minor lines per interval (`minor`, a count; `minor: false` draws no minors, as does leaving it out); an axis set to `false`, or `grid: false`, draws no lines on that axis or at all; `grid: null`, or an axis set to `null`, is the same as leaving it out.
