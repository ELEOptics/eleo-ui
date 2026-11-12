---
"@eleoptics/plots": patch
---

`curve`: a single plot's series with a NaN or infinite coordinate is drawn as a path that breaks at the bad point, as in panels, instead of nothing at all in Chromium.

`interact`: a hover or click no longer rewrites the plot's `transform` attribute in Firefox, which shortened its numbers.
