---
"@eleoptics/plots": patch
---

`curve`: a single plot's series with a NaN or infinite coordinate is drawn as a path that breaks at the bad point, as in panels, instead of nothing at all in Chromium.
