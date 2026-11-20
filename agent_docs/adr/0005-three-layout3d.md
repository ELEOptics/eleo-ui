# ADR-0005: layout3D on three.js

Status: proposed
Date: 2026-11-20

## Context

Plan [#1193] re-plans layout3D onto three.js: the painter's-algorithm canvas drawing cannot depth-test, and M1's
fixes (seams, edge outlines, clipping) cost more than the drawing. The spike ([#1249]) drew a full-density synthetic
lens (50 surfaces x 128 x 16, `LatheGeometry`, 192,000 faces) through one offscreen `WebGLRenderer` copied onto a 2D
canvas with `drawImage`, in Chromium, Firefox and WebKit headless. It creates a WebGL context in all three locally. The U14
timing (median of 20 redraws, each followed by a 1 px `getImageData`) is 1.3-1.6 ms on an Apple M2 Max with
`--use-angle=metal`, and 85-105 ms in headless Chromium on software WebGL (SwiftShader), which is what CI's
GPU-less runner has.

## Decision

`three` is an optional peer dependency of `@eleoptics/plots` (`>=0.170 <1`, matching phos's 0.176) and a
devDependency. layout3D moves to the `./layout3d` export and its own IIFE `eleo-layout3d.js`, the only bundle that
carries three. The camera is orthographic, isometric by default, and the scene is rendered once (no controls).
U14 for layout3D is a local GPU measurement: `PERF=1 GPU=1 npx playwright test gallery.spec -g "layout3D tiles draw" --project=chromium` launches Chromium
with `--use-angle=metal --ignore-gpu-blocklist`. CI asserts that the 3D tiles draw in all three browsers and times
nothing (CR [#1257], option 2).

## Consequences

- Depth testing, smooth shading and lit faces come from the library, and the hand-written painter, clipping and face
  code can go.
- The 16 ms budget is met on a GPU with large headroom. On software WebGL (CI, remote desktops with no GPU) full
  density is about six times over it; the budget is not enforced there.
- A regular dependency was rejected (every 2D user downloads three), as was a lazy `import('three')` (async, no
  classic IIFE) and a 2D overlay for lines (no depth test).
- Revisit if a consumer must run on software WebGL at full density (cap the segments per surface, as M1 did), or if
  three's peer range breaks.

[#1193]: https://github.com/ELEOptics/eleo-ui/issues/1193
[#1249]: https://github.com/ELEOptics/eleo-ui/issues/1249
[#1257]: https://github.com/ELEOptics/eleo-ui/issues/1257
