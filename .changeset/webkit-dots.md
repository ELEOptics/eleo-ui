---
'@eleoptics/plots': patch
---

Dots in spot and curve plots draw at their true opacity in WebKit: a dot is a round-cap segment 0.01 px long, not a zero-length one.
