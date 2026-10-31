---
"@eleoptics/plots-svelte": minor
---

New: `Map2D` takes typed props. `<Map2D values extent … />` renders the SVG of `map2D(props)` in a `div.eleo-svg` and redraws when the theme or palette changes; without `values` it draws the canvas as before. The typed props need `@eleoptics/plots` 0.7.0 or newer.
