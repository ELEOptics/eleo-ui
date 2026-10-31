---
"@eleoptics/plots": minor
---

New: `map2D` takes a typed grid. `map2D(props)` with `values` (rows of numbers, row 0 at the top; a cell that is `NaN`, `null` or otherwise not a finite number is masked and shows the page's `--surface`) and `extent: [x0, x1, y0, y1]` returns one SVG string: curve's frame with axes from `x` and `y`, a pixelated image of the cells, and an optional colorbar from `value`. Options: `map` (the brand maps `ember`, `wave`, `viridis` and `gray`; `wave` gets a range symmetric about 0), `range`, `scale: 'log'` with `decades`, `aperture: { x, y, r }`, and `polar: { radii, angles }` for ring × spoke samples. Colors come from `el`'s tokens at draw time, so call it again after a theme or palette change. Bad input throws a `TypeError`. The sample call `map2D(canvas, { kind })` draws as before. New type: `Map2DGridProps`.
