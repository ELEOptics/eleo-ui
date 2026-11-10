---
"@eleoptics/plots": patch
---

Fix: `layout2D` field labels that a cropping `box` clamps to the top no longer stack on one spot; they keep the drawing's top-to-bottom order and sit 1 em apart.
