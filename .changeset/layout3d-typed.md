---
'@eleoptics/plots': minor
'@eleoptics/plots-svelte': minor
---

`layout3D` draws a recorded layout: `layout3D(canvas, { data: layout, rays: "fan" })`, typed as `Layout3DProps` (`data: RecordedLayout`, `rays: "marginal-chief" | "fan" | "chief" | false`), and `<Layout3D data={layout} />`. It no longer reads `profiles` or `rays3d`, and throws `layout3D: pass { data: RecordedLayout }` without `data`.
