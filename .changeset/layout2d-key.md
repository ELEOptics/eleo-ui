---
"@eleoptics/plots": minor
---

`layout2D` takes a `key`: entries (a line swatch in the palette slot `index`) and `"glass"` (the swatches `glassLegend` gives) in one row under the drawing, at the layout's text size. Not drawn below a width of 630. A `key` that is not `"glass"` or an array, an entry that is neither `"glass"` nor an object, an object without a string `label`, or an `index` that is not a non-negative integer throws a `TypeError`.
