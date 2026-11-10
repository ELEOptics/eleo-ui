---
"@eleoptics/plots": patch
---

`curve` throws a `TypeError` for a key entry whose `label` is not a string, as `layout2D` does; it used to draw a number or other value.
