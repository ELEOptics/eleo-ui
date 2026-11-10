---
"@eleoptics/plots": patch
---

Fixed: `layout3D` paints the image plane before the outgoing rays, so the rays that end on it are drawn over it (the plane was drawn last and hid them).
