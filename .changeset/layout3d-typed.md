---
'@eleoptics/plots': minor
'@eleoptics/plots-svelte': minor
---

Breaking: `layout3D` moved out of the main entry to `@eleoptics/plots/layout3d` (and its own `eleo-layout3d.js` IIFE for classic pages), and draws through three.js, an optional peer (`npm i three`). `import { layout3D } from '@eleoptics/plots'` no longer works. `layout3D(canvas, { data: layout, rays: "fan", view: "front" })` is typed as `Layout3DProps` (`data: RecordedLayout`, `rays: "marginal-chief" | "fan" | "chief" | false`, `view: "iso" | "front" | "top"`, default iso), and `<Layout3D data={layout} />` takes the same props. It no longer reads `profiles` or `rays3d`, and throws `layout3D: pass { data: RecordedLayout }` without `data`.
