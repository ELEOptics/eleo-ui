---
"@eleoptics/plots": minor
---

New: `minWidth(name, props)` returns the narrowest drawing width, in px, of a call: the width at which its plot frame is 162 px and its text is at the 9 px floor, counting the call's own margins (a colorbar's labels, the x tick labels) and its panels. It is on the module and on `window.ELEO`.
