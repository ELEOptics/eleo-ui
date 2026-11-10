---
"@eleoptics/plots": patch
---

`curve` throws a `TypeError` for a key entry whose `label` is not a string, as `layout2D` does; it used to draw a number or other value. Series labels must be strings too: a series with a non-string `label` and no `key` now throws "curve: a key entry needs a string label", where it used to draw the label as text. Only a truthy label makes a key entry, so a series with a falsy label (`label: 0` or `false`) is skipped, not thrown on; a non-empty non-string label throws.
