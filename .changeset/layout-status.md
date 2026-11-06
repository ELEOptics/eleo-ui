---
"@eleoptics/plots": minor
---

New: a layout's per-point `status` (`Alive`, `Virtual`, `Dead`) is drawn, and `layout2D` takes `show`, an array of the statuses to draw (default all three). With `status`, a ray is drawn to its last point. Virtual (dotted) and Dead (solid) runs are drawn faded, at opacity .35, under the Alive runs, and each segment takes its start point's status. Layouts without `status` draw exactly as before.
