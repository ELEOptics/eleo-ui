---
"@eleoptics/plots": patch
---

Fix: `layout2D` draws a stop bar at every stop it labels STO, including a stop on a glass surface (it ended at the glass before).
It also no longer draws a zero-length stop bar for a glass stop cropped below its aperture.
