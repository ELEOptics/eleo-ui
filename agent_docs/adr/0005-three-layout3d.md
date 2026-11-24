# ADR-0005: layout3D on three.js

Status: accepted
Date: 2026-11-20

## Context

Plan [#1193] re-plans layout3D onto three.js: the painter's-algorithm canvas drawing cannot depth-test, and M1's
fixes (seams, edge outlines, clipping) cost more than the drawing. The spike ([#1249]) drew a full-density synthetic
lens (50 surfaces x 128 x 16, `LatheGeometry`, 192,000 faces) through one offscreen `WebGLRenderer` copied onto a 2D
canvas with `drawImage`, in Chromium, Firefox and WebKit headless. It creates a WebGL context in all three locally. The U14
timing (median of 20 redraws, each followed by a 1 px `getImageData`) is 1.3-1.6 ms on an Apple M2 Max with
`--use-angle=metal`, and 85-105 ms in headless Chromium on software WebGL (SwiftShader), which is what CI's
GPU-less runner has. M2 of plan [#1193] exercised it; the Decision below is written as built, and the Verdict says
what changed.

## Decision

`three` is an optional peer dependency of `@eleoptics/plots` (`>=0.170 <1`, matching phos's 0.176) and a
devDependency. layout3D moves to the `./layout3d` export and its own IIFE `eleo-layout3d.js`, the only bundle that
carries three. In plots-svelte, `Layout3D` likewise lives only at `@eleoptics/plots-svelte/layout3d`, so a 2D Svelte
app bundles without three (CR [#1267]). The camera is orthographic and the scene is rendered once (no controls). By
default it looks mainly along the optical axis from the object side, 20° in yaw and 15° in pitch off it (yaw 70, pitch
-15 in layout3D's convention; CR [#1290]); `iso` (true isometric, yaw -45, pitch 35.264), `front` and `top` are
presets. U14 for layout3D is a local GPU measurement: `PERF=1 GPU=1 npx playwright test perf -g layout3D
--project=chromium` launches Chromium with `--use-angle=metal --ignore-gpu-blocklist` and asserts the median under 16
ms. CI asserts that the 3D tiles draw in all three browsers and times nothing (CR [#1257], option 2); Firefox runs
there under `xvfb-run`, because its headless WebGL needs an X display on the runner ([#1260]).

## Consequences

- Depth testing, smooth shading and lit faces come from the library, and the hand-written painter, clipping and face
  code can go.
- The 16 ms budget is met on a GPU, but tightly: the full layout3D (scene, materials, fill probes, fat lines and the
  2D overlay per redraw) is 14.55-15.50 ms, about ten times the spike's bare mesh. On software WebGL (CI, remote
  desktops with no GPU) full density is about eight times over it; the budget is not enforced there.
- A three.js tile costs about 0.35 s to draw on software WebGL. When the gallery drew every 3D tile on every load, the
  full gate went from about 7 to about 16 minutes and test timeouts were raised; since [#1263] the gallery draws a 3D
  tile only when it scrolls near the viewport, and the gate is back to about 9 minutes.
- A regular dependency was rejected (every 2D user downloads three), as was a lazy `import('three')` (async, no
  classic IIFE) and a 2D overlay for lines (no depth test).
- Revisit if a consumer must run on software WebGL at full density (cap the segments per surface, as M1 did), or if
  three's peer range breaks.

## Verdict

Go (the user, plan [#1193] M2 demo, 2026-11-20). The achromat and Cooke tiles drew through three.js in iso and
front views in both themes, after two rejections of the canvas painter at M1. The front view's meridian vertices lie
within 0.5 px of layout2D's element polygons (O8), the tiles draw in Chromium, Firefox and WebKit locally and in CI
(O9), and U14 held on the GPU at 14.55-15.50 ms (O2). What changed because of it: U14 is timed on a GPU only
(CR [#1257]), Firefox in CI needs `xvfb-run` ([#1260]), and plots-svelte gained its own `./layout3d` subpath
(CR [#1267]).

Amended 2026-11-24 (the user, plan [#1193] M3, CR [#1290]): the default view was isometric when this ADR was
accepted. On seeing the Cassegrain in it (the camera sat on the image side and showed the primary's back), the user
chose a near-axis view from the object side as the default for every system.

[#1193]: https://github.com/ELEOptics/eleo-ui/issues/1193
[#1249]: https://github.com/ELEOptics/eleo-ui/issues/1249
[#1257]: https://github.com/ELEOptics/eleo-ui/issues/1257
[#1260]: https://github.com/ELEOptics/eleo-ui/issues/1260
[#1263]: https://github.com/ELEOptics/eleo-ui/issues/1263
[#1267]: https://github.com/ELEOptics/eleo-ui/issues/1267
[#1290]: https://github.com/ELEOptics/eleo-ui/issues/1290
