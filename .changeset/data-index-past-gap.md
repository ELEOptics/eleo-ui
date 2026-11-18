---
'@eleoptics/plots': patch
---

`curve` and `spot` write `data-skip` (the data indices of the points a series dropped) on its marks, so a hovered or keyboard-picked point past a gap reports its index in the caller's data.
