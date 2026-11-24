---
'@eleoptics/plots': minor
'@eleoptics/plots-svelte': minor
---

Breaking: `layout3D` moved out of the main entry to `@eleoptics/plots/layout3d` (and its own `eleo-layout3d.js` IIFE for classic pages), and draws through three.js, an optional peer (`npm i three`). `import { layout3D } from '@eleoptics/plots'` no longer works. `layout3D(canvas, { data: layout, rays: "fan", view: "front" })` is typed as `Layout3DProps` (`data: RecordedLayout`, `rays: "marginal-chief" | "fan" | "chief" | false`, `view: "iso" | "front" | "top"`; with no `view`, `yaw` or `pitch` the camera looks mainly along +z from the object side, turned 20° in yaw and 15° in pitch off the optical axis, i.e. yaw 70, pitch -15, a missing `yaw` or `pitch` taking those values; `"iso"` is true isometric at yaw -45, pitch 35.264), and `<Layout3D data={layout} />` takes the same props. It no longer reads `profiles` or `rays3d`, and throws `layout3D: pass { data: RecordedLayout }` without `data`.

Breaking, `@eleoptics/plots-svelte`: `Layout3D` moved out of the index to `@eleoptics/plots-svelte/layout3d` (`import { Layout3D } from '@eleoptics/plots-svelte/layout3d'`), so an app that imports only the 2D wrappers bundles without `three`; `three` is needed only for that subpath.
