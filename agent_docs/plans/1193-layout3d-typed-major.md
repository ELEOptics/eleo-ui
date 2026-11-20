# Plan #1193: Typed layout3D on three.js

Status: approved 2026-11-20
Branch: `plan/1193-layout3d-typed-major` PR: #1214 Depends on: none Roadmap: `agent_docs/roadmap.md`, row J
Course check: M2 — it tests the re-plan's riskiest assumptions, WebGL through three.js in all three Playwright browsers in CI and a full-density mesh in 16 ms, and the user's look. Switch signal: #1249's spike finds a browser with no WebGL in CI that a launch flag cannot fix, or its full-density median is over 16 ms, or the user rejects the M2 tiles at the demo (a third rejection overall).

## Problem

`layout3D` is the last renderer that reads only the sample's own shape (`profiles`, `rays3d`, `zimg`, three
hard-coded spheres). No caller can draw their own system in 3D, and its crown/flint tones ignore U12's per-glass
fills. Once it is typed, the sample-shaped paths (`kind`, `useSample`, sample defaults) have no reason to stay, and
row J removes them in one breaking release. That release is the next 0.x minor, not 1.0: no client has used the API in
the real world yet (user, round 3).

## Ground truth (2026-11-18)

- `packages/plots/src/layout3d.js` (50 lines): canvas, painter's sort of revolved quads (128 segments × 16 rings per
  surface), `D.profiles[0..2]` spheres by `R`/`sd`, `D.rays3d` (4 marginal + chief per field), the incoming and outgoing
  ray segments drawn before or after the whole mesh by view direction (`:37-38,45`: works for one cemented group only),
  image plane a fixed 9 mm square at `D.zimg`, centre `zimg / 2 + 2` and 4.6 px/mm fixed (`:14`), two tones
  `--glass-crown`/`--glass-flint` shaded in RGB (`:24-29`), rays at a literal 1.1 px, axis triad.
- phos-core: `OpticalModel::visualize` (3D surface points and normals, no rays) is Rust only
  (`models/src/optical_model/visualize.rs:21`); `uniffi/src/visualize.rs` exports only `visualize_system_2d`, so
  `scripts/record-phos-core.py` cannot record U10's original oracle.
- Layout fixtures are `RecordedLayout`s: `sample.json` `layout`/`layoutWl`, `tests/fixtures/layouts/analysis-glasses.json`
  (the Cooke glasses tile, `gallery/index.html:292`), `tests/fixtures/phos-core/wandersleb-layout.json` (three
  `"crown"` elements, a standalone stop, Virtual and Dead points), `cassegrain-layout.json` (mirrors, a hole, an
  obscuration, Dead points). Profiles and rays are meridional `[z, y]`, a ray point per surface.
- `layout2d.js` has what 3D reuses: the ray set expression (`:328`), the status rules (`statusOf`, the no-status end
  rule `:332`), mirror bodies with a flat back and an open hole (`mirrorBodies`, `:54`). U12's fills are
  `glassFill(drawnGlasses(S))` (`glass.js:22,49`), but they are CSS `oklch(from color-mix(… var(…)))` strings
  (`glass.js:12-13`): a canvas cannot use them as given, and `color.js:8` parses hex only.
- Sample-shaped API still shipped: `curve({kind})` (`curve.js:230-256`), `rayFan` (`fan.js`, sample only, `kind: tra|opd`), the `spot` sample call (`spotPanels`, `spot.js:155`), `throughFocus` (sample only, `spot.js:174`; RMS read
  from the sample, the 0-defocus column framed as `j === 2`, "µm" and `half` 40 hard-coded), `map2D(canvas, {kind})`
  (`map2d.js:187`), `legend` reading the sample's values, `layout2D`/`glassLegend` taking a `LayoutSystem` and
  defaulting to the sample, `useSample`/`sample` (`data.js`), `minWidth`'s sample reads (`sizes.js:5,9-10,28-36`), the
  `./sample` and `./eleo-plots-sample.js` exports and `sideEffects` entry, `sample.d.ts`, `iife-sample.js`, `iife.js`'s
  sample getter. The Svelte wrappers mirror them (`RayFan.svelte`, `CurvePlot`'s kind, `Map2D`'s canvas branch,
  `SpotDiagram`'s sample unit, `Legend`'s `LayoutSystem` typedef, `Layout3D`).
- Consumers: phos calls `layout2D`, `layoutBounds` and the `RecordedLayout` types (plots 0.4.0); the website loads
  `eleo-layout.js` (`layout2D`, `layoutBounds`) and `eleo-physics.js`. Neither calls anything J removes.
- Gallery tiles on the sample shape: `layout2D`, `layout2D-fan`, `throughFocus`, `rayFan-opd`, `chromaticFocus`,
  `layout3D`, and the key labels (`legendKey` reads `ELEO.sample`); the page loads `eleo-plots-sample.js`.
  `tests/fixtures/phos-core/adapters.js` is the precedent for gallery adapters: a classic script that sets a global,
  loaded by the gallery and imported by node.
- `tests/fixtures/renderers-baseline.json` holds the sample output of `layout2D`, `layout2D-fan`, `throughFocus` and
  `legend-*`, drawn by `scripts/record-renderers.mjs` (`draws`), which `tests/unit/split.test.js` imports; no entry for
  `chromaticFocus` or `rayFan-opd`. The critic checked that typed calls reproduce every existing entry (throughFocus
  with RMS computed from the points at one decimal, all 15 cells).
- Type tests run only through per-file cases in `tests/unit/types.test.js`; `check.sh --fast` runs `npm run check`
  (svelte-check) and `test:unit`. `tests/gallery-shots.spec.js` writes per-tile PNGs (`SHOTS=1`) and fails on any
  tile differing from `SHOTS_BASE`; the PNGs go to the draft `review-assets` release, never git.
- Release: changesets on `main`. The Version Packages PR 1143 is open with a plots `minor` (export), so J's release is
  0.11.0 if J merges first, 0.12.0 if 1143 does. The npm publish follows a merged Version Packages PR and the `npm`
  environment's reviewer.
- U14 is measured in `tests/perf.spec.js` (`PERF=1`, median of 20 redraws, reported, not asserted). Its layout2D test
  builds the 50-surface reference layout inline (`:127-139`). Canvas 2D is deferred: an unflushed timing reads ~5x low.
  The critic's synthetic timing (headless Chromium, dpr 2, surfaces only) puts 16 ms at about 3,500 faces in total:
  today's density is about 2,000 faces per surface.

### Ground truth at the re-plan (2026-11-20)

- M1 stopped at its course check: the user rejected the canvas, painter-sorted layout3D twice (orientation,
  shading/depth, edges and rays, round 1 of the re-plan) and asked for three.js and a CAD-style projection.
- `packages/plots/src/layout3d.js` is 288 lines: `layout3dMesh`, `project`/`fitView`, `layout3dScene` (painter sort,
  edge depth bias, the `clipEdges` grid), the CSS fill probe. Everything after the mesh emulates a depth buffer.
- No three.js in eleo-ui. phos has `three@^0.176` through threlte (`phos/src/lib/Scene.svelte`): an
  `OrthographicCamera` with `TrackballControls`, a directional and an ambient light.
- layout3D ships in the main entry (`packages/plots/src/renderers.js:11,25`, `index.js:18`) and the `eleo-plots.js`
  IIFE; `build.mjs:9-11` bundles with no `external`. No consumer calls layout3D (A1).
- layout2D draws a section (`layout2d.js:304`) under an SVG `matrix(...)` whose scale is internal (`:275`).

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `layout3D(canvas, { data })` from `@eleoptics/plots/layout3d` draws a recorded lens system with three.js: an orthographic camera, true isometric by default (`view: "iso" \| "front" \| "top" \| { yaw, pitch }`), lit faces depth-tested, U12 fills per glass, meridional rays, rims and silhouettes. | given the achromat, Cooke and Wandersleb layouts at full density (128 × 16) and an explicit `scale`, when each mesh vertex is projected through the layout3D camera's matrices in the iso view and at yaw 20, pitch −10, then it lies within 0.5 px of the test's own orthographic projection, and each element's material carries `glassFill`'s colour for its glass | `closed-form` as U10 (rotation matrices written in the test); `property` U12's fill per glass | `tests/unit/layout3d.test.js` "revolved profiles project", "glass fills per element" |
| O8 | The 3D camera agrees with the 2D drawing. | given the achromat and Cooke layouts, when layout3D builds the `view: "front"` scene with `scale` set to the `s` of the `matrix(...)` parsed from layout2D's SVG for the same layout, then the mesh's meridian vertices (x = 0), projected by the front camera, lie within 0.5 px of layout2D's `polygon[data-surface]` points under that matrix (meridian, not silhouette: a concave face's side-on silhouette is its rim chord) | `reference` layout2D's element polygons (round 2, user: new oracle) | `tests/unit/layout3d.test.js` "front view matches layout2D" |
| O2 | layout3D keeps U14 at full density. | given the 50-surface, 3-field, 21-ray reference layout, when layout3D redraws 20 times, each followed by a 1 px `getImageData` read, on a GPU-backed Chromium (`--use-angle=metal`, locally; CI has only software WebGL and times nothing, CR [#1257]), then the median is under 16 ms | `measurement` U14 | `tests/perf.spec.js` "layout3D redraw (U14)" |
| O3 | Mirrors, obscurations and annular holes draw in 3D: a mirror as its layout2D body (flat back, D/8) revolved, a hole left open, an obscuration as an opaque disc. | given the recorded Cassegrain layout, when the mesh is built, then each mirror body's revolved points project within 0.5 px of the independent projection of layout2D's body polygon, no mirror face lies at a radius under its `hole`, and the obscuration is one disc of its `sd` | `reference` layout2D's `mirrorBodies` (U17's tested polygons); `closed-form` as O1; `property` no face inside the hole | `tests/unit/layout3d.test.js` "mirror bodies revolve", "holes stay open" |
| O4 | The 3D tiles look right to the user: a standard CAD view, real shading and occlusion, crisp edges, rays at token width. | given the M1 base shots and M1's rejected shots beside the new achromat, Cooke (M2) and Cassegrain (M3) tiles in both themes, then the user approves them | `user` at the M2 and M3 demos | the demo |
| O9 | The 3D tiles draw in Chromium, Firefox and WebKit, locally and in CI. | given the gallery, when the 3D tile tests run in all three Playwright projects, then each tile has two distinct non-background fills and no console error | `property` (round 2, user: must pass all three) | `tests/gallery.spec.js` "layout3D tiles draw" |

## Non-goals

- The breaking minor (no sample, no `kind`; O5-O7, items #1203-#1213, #139): roadmap row K, its own plan (user,
  re-plan round 1). Its outcomes and items are kept below under "Moved to row K" for that planner.
- Interactive orbit or trackball controls, hover: phos keeps the interactive viewport (re-plan round 1).
- A perspective camera (re-plan round 1).
- three.js through threlte in plots-svelte: the Svelte wrapper keeps calling the framework-free renderer.
- 1.0: waits until a consumer has used the API (user, round 3).
- phos-core's 3D `visualize` as input: its Python client does not expose it; next plan, once phos-core does.
- Sagittal or skew rays in 3D: a `RecordedLayout` holds meridional rays only (user, round 2).
- Ray status styles in 3D (dotted, `show`): a ray is drawn solid through its first Dead point and never through a Virtual point; next plan if asked.
- `colorBy` on layout3D: a RecordedLayout's rays are coloured by fan, as in layout2D.
- Publishing to npm: the user merges the Version Packages PR.

## Existing issues

| Issue | Bucket | Where or why |
| -- | -- | -- |
| [#158] | absorb (done in M1) | layout3D draws rays at `--stroke-ray` |
| [#139], [#125], [#639], [#424], [#132], [#133] | moved to row K | with the breaking minor (re-plan round 1) |
| #1232, #1221 | related | M1 review backlog, outside 3D |
| [#86] | related | untouched |
| others | related | untouched |

## Constraints and assumptions

- A1: no consumer calls layout3D (checked in phos and eleo-website, 2026-11-18).
- A3: each item carries every test, type file and README section its change breaks, so each commit keeps the gate
  green; the three.js path is built beside the painter (#1250-#1252) and swapped in by one item (#1253).
- A5: PR 1143 may merge before or after J; nothing in J names a literal version.
- A6: Playwright's Chromium, Firefox and WebKit can create a WebGL context headless in CI (#1249 tests it).

## Decisions

- ADR-0005 (`proposed` in #1249, M2 exercises it): `three` is an optional peer dependency of `@eleoptics/plots`
  (`>=0.170 <1`, matching phos's 0.176) and a devDependency; layout3D moves to the `./layout3d` export and its own
  IIFE `eleo-layout3d.js`, the only bundle that carries three; an orthographic camera, isometric by default, rendered
  once (no controls). Considered: a regular dependency (every 2D user downloads three), a lazy `import('three')`
  (async, no classic IIFE), a 2D overlay for lines (no depth test).
- ADR-0001: layout3D's tone composition stays a style-lint exemption; the exemption follows the code (#1253).
- Moving layout3D out of the main entry is breaking: it rides the plots minor M1's changeset already makes (#1255).
- Roadmap edits (re-plan, user): row J is 3D only; new row K carries the breaking minor; U10's oracle gains O8's
  front-view reference.
- Core changes: `packages/plots/package.json` (`exports` gains `./layout3d` and `./eleo-layout3d.js`;
  `peerDependencies` and `peerDependenciesMeta` gain `three`), `packages/plots/src/index.d.ts` (layout3D and
  `Layout3DProps` move to `layout3d.d.ts`, with `view`), ADR-0005, the roadmap.

## Milestones

### M1: layout3D draws any recorded lens system GitHub: `P1193 M1: typed layout3D for lens systems`

Done 2026-11-19: review round 11 (Review M1: 0 blocking, nothing pulled in; backlog #1232, #1221 outside M1); full gate green on 7f653fd (556 passed); CI on 7f653fd: build, check and unit passed, playwright pending at the tick. O2 met at 13.1-14.1 ms. Demo round 1 (with the course check): no-go, "Bring back edge outlines" (CR [#1237]); the edge outlines landed in #1238, #1239, #1241, #1243, #1245, #1246 and #1248. Demo round 2 (with the triggered course check): no-go; the run stopped for /plan.

Demo: `npm run gallery`: the achromat (the sample's recorded layout) and Cooke glasses 3D tiles in both themes beside
the base shots (`SHOTS=1 npx playwright test gallery-shots`, item 1's base in `review-assets`);
`PERF=1 npx playwright test perf -g layout3D` prints the median. Proves: O1, O2, O4 (lenses)

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1194 | O1, O2 acceptance tests, skipped; the 50-surface reference layout shared by the layout2D and layout3D perf tests; base gallery shots uploaded to `review-assets` | forced (`workflow.md`, TDD: the first item writes them skipped); the shots before item 3 changes the tile, because O4 compares against them | `tests/unit/layout3d.test.js`, `tests/perf.spec.js` | the two O1 tests, "layout3D redraw (U14)" |  |
| #1195 | `layout3dMesh(layout, { width })`: unprojected faces, each surface's profile (y ≥ 0 half) revolved, elements as runs of glass gaps with rims, a stop ring for an air-air stop, the image plane square at the image surface's `sd`; segments per surface `min(today's, budget / surfaces)` within a 3,500-face budget, full density for small systems; `project(p, view)` separate; the default view fits the rotated bounds into width × height, `scale` in px/mm overrides; a named error on anything but a RecordedLayout | mesh and projection apart because the face budget is tested without a view and O1 projects the same vertices; considered a mesh already projected, which couples both tests to one view | `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js` | "revolved profiles project", "face budget at 50 surfaces" | #1194 |
| #1196 | layout3D draws the mesh: each distinct U12 fill resolved once per draw by a probe element in the canvas's subtree (computed `color`, painted 1 px, read back as RGB) and shaded by today's light; rays by layout2D's ray sets (`rays: "marginal-chief"` default, `"fan"`, `"chief"`, `false`), drawn through the first Dead point and never through a Virtual one, each air segment painter-sorted at its mid depth, segments in glass not drawn, at `--stroke-ray`'s width; the gallery's layout3D tile passes `data: sample.layout`; first flushed median recorded | export a `raySet(L, k, set)` and the status cut from `layout2d.js` because U3 and U17 define them; considered layout3D's own picker, a second definition. The probe because `glassFill` returns CSS that only the browser resolves; considered an OKLCH parser, which still cannot read `var()` | `packages/plots/src/layout3d.js`, `packages/plots/src/layout2d.js`, `gallery/index.html`, `tests/unit/layout3d.test.js`, `tests/unit/style-lint.test.js`, `tests/unit/field-order.test.js`, `tests/gallery.spec.js`, `tests/pixel-ratio.spec.js`, `tests/unit/layout2d.test.js` (CR [#1216]) | "rays sort with the faces", "dead and virtual cut", gallery.spec "layout3D rays over the image plane" (U22) | #1195 |
| #1197 | `Layout3DProps` typed (`data: RecordedLayout`, `rays`, `yaw`, `pitch`, `scale`, `width`, `height`), `<Layout3D data={layout} />`, the README section, a minor changeset: `layout3D(canvas, { data: layout, rays: "fan" })` draws; `layout3D(canvas, {})` throws `layout3D: pass { data: RecordedLayout }` | forced (core: `index.d.ts`, approved with this plan) | `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/Layout3D.svelte`, `packages/plots/README.md`, `packages/plots-svelte/README.md`, `.changeset/layout3d-typed.md`, `tests/types/layout3d.ts`, `tests/unit/types.test.js`, `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js` (CR [#1219]) | types.test.js "layout3d.ts" | #1196 |
| #158 reuse | `--stroke-ray`'s usage text: "Rays in 3D drawings." and a tokens patch changeset | the text follows item 3, which makes layout3D its one user; considered dropping the token, a breaking tokens release for a text fix | `packages/tokens/src/tokens.json`, `.changeset/stroke-ray-3d.md`, `tests/unit/tokens.test.js` | tokens.test.js "--stroke-ray usage" | #1196 |
| #1198 | Gallery: a layout3D tile on the Cooke glasses (`analysis-glasses.json`) | one new tile because O1 must show U12 fills and the sample has only crown and flint; considered a Wandersleb tile, whose elements are all `"crown"` | `gallery/index.html`, `tests/gallery.spec.js`, `tests/pixel-ratio.spec.js` (CR [#1220]) | gallery.spec "layout3D glasses tile draws" (two distinct non-surface fills on the canvas, three browsers) | #1197 |
| #1218 | layout3D's default view fits the faces and the drawn ray segments together, so no drawn ray leaves the canvas; an explicit `scale` still overrides (CR [#1217]) | fit the scene's projected bounds (faces plus the drawn segments' endpoints) because O1's "framed to fit" means everything layout3D draws; considered clipping the rays at the canvas edge, which hides where they start | `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js` | layout3d.test.js "rays framed" | #1196 |
| #1199 | Unskip O1 and O2; record the U14 median in the Change log | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/layout3d.test.js`, `tests/perf.spec.js` | O1, O2 | #1194, #1195, #1196, #1197, #158, #1198, #1218 |
| #1225 | layout3D skips a fan with no rays instead of throwing; a ray ends at its first Dead point, else its last point, so `statusEnd` is no longer exported (CRs [#1222], [#1223]) | both findings change the same loop, so one item; the empty-fan rule copies layout2D's; considered keeping statusEnd shared, whose `status` rule layout3D never uses | `packages/plots/src/layout3d.js`, `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js`, `tests/unit/layout3d.test.js` | layout3d.test.js "empty fan is skipped" | #1199 |
| #1226 | Tests: the image face is ±sd at the image surface's z, the stop ring's radii lie in [sd, sd + 2.5] (review M1 finding 7) | two assertions because the projection test exempts both faces; considered projecting them, which tests project() again | `tests/unit/layout3d.test.js` | layout3d.test.js "image plane and stop ring" | #1225 |
| #1227 | `layout3D(canvas, props: Layout3DProps)`: props required in the types (review M1 finding 5) | the type follows #1197's runtime guard; considered keeping props optional, which types a call that always throws | `packages/plots/src/index.d.ts`, `tests/types/layout3d.ts` | types.test.js "layout3d.ts" | #1226 |
| #1228 | A bad `chief` index under layout3D throws an error named layout3D (review M1 finding 6) | a name parameter as `drawnGlasses` takes; considered catch and rethrow, which loses the stack | `packages/plots/src/layout2d.js`, `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js` | layout3d.test.js "bad chief names layout3D" | #1227 |
| #1229 | layout3D falls back to the crown token for a fill the browser rejects (review M1 finding 4) | crown because layout2D's SVG falls back to it; considered throwing, which blanks a tile on an older browser | `packages/plots/src/layout3d.js`, `tests/gallery.spec.js` | gallery.spec "layout3D rejected fill falls back to crown" | #1228 |
| #1230 | layout3D fills faces without the per-face 0.7 px seam stroke, so the U14 median falls under 16 ms (CR [#1224]) | drop the stroke because it is about 11 ms of the 20.4 ms median; considered batching it (unmeasured) and loosening O2 (the user chose this) | `packages/plots/src/layout3d.js`, `tests/perf.spec.js` | perf.spec "layout3D redraw (U14)" median under 16 ms | #1229 |
| #1233 | layout3D's fill probe inherits crown from a wrapper, so a fill invalid at computed-value time draws crown (CR [#1231]) | inherit crown because CSS computes an invalid `var()` value as `unset`; considered `CSS.supports`, which can't evaluate `var()` | `packages/plots/src/layout3d.js`, `tests/gallery.spec.js`, `tests/unit/field-order.test.js` (CR [#1235]) | gallery.spec "layout3D rejected fill falls back to crown" (rewritten) | #1230 |
| #1234 | "empty fan is skipped" compares items, not only counts (review M1 round 2, finding 3) | deep-equal the tuples the test builds; considered counts per fan | `tests/unit/layout3d.test.js` | layout3d.test.js "empty fan is skipped" | #1233 |
| #1236 | The rejected-fill gallery test loses its unused `px` canvas and `rgb` helper (review M1 round 3, finding 1) | delete because nothing references them; considered using them, which nothing needs | `tests/gallery.spec.js` | gallery.spec "layout3D rejected fill falls back to crown" | #1234 |
| #1238 | layout3D draws edge outlines in `--glass-edge` at 1.25 px: each glazed surface's outer rim and each element's two silhouette lines, painter-sorted with the scene (CR [#1237], M1 demo no-go) | rims and silhouette lines as the base tile drew them, because the user asked for those edges back; considered outlining every face, which brings back the seam cost (#1230) | `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js`, `tests/perf.spec.js` | layout3d.test.js "edge outlines"; perf.spec "layout3D redraw (U14)" under 16 ms | #1236 |
| #1239 | Edges sort slightly nearer than their mid depth so faces sharing them paint first, and their width reads `--stroke-edge` (review M1 round 5, findings 1 and 2) | a small nearer bias because the shared face sorts at almost the same depth; considered drawing all edges after all faces, which lets a far rim show through a near lens | `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js` | layout3d.test.js "edge outlines" (extended) | #1238 |
| #1241 | Edge outlines both full width (no sharing face over an edge) and correctly hidden (no edge over a nearer face): each edge drawn after its sharing faces and clipped against nearer faces; bias over the faces' span; tests from the plane-depth sampling (CRs [#1240], [#1242]; review M1 round 6, findings 2 and 3) | the user chose both properties at more cost (CR [#1242]); considered the c765907 rule (Cooke over-draw) and mid depth (half-covered edges), each failing one property | `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js` | layout3d.test.js "edge outlines" ((a) and (b), achromat and Cooke, two views) | #1239 |
| #1243 | clipEdges returns early on an empty scene; no COUNTS log; faces drop `z`; silhouettes sampled and a gallery pixel check that the clip is applied (review M1 round 7, findings 1-4) | the reviewer's named fixes, each one or two lines; considered leaving 4 to the unit tests, which pass with the clip removed | `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js`, `tests/gallery.spec.js` | layout3d.test.js "empty scene", sampling with silhouettes; gallery.spec "layout3D clips edges behind nearer faces" | #1241 |
| #1245 | Face items never carry `z` (depths kept beside them), grid cells skipped for faces with no depth overlap with any edge, and the silhouette sampling asserted (CR [#1244]; review M1 round 8, finding 2) | depths beside the items because deleting a property on 3500 objects slows every later read; considered keeping `z` on faces, which leaks it to callers | `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js` | perf.spec U14 median at most 15 ms over five runs; "no item keeps its internal z"; silhouette assertion | #1243 |
| #1246 | clipEdges' grid covers the canvas rect plus a margin, cells clamped, so a large `scale` no longer runs out of memory (review M1 round 9, finding 1) | clamp the grid to the canvas because off-canvas geometry is never painted; considered a cell-size cap | `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js` | layout3d.test.js "large scale" | #1245 |
| #1248 | "large scale" hashes scene items with numbers rounded to 1e-6, so the hashes hold across Node builds (CR [#1247]) | round before hashing because last-bit float differences between V8 builds are not behaviour; considered a JSON fixture with a tolerance | `tests/unit/layout3d.test.js` | layout3d.test.js "large scale", locally and on CI | #1246 |

### M2: layout3D on three.js (lenses) GitHub: `P1193 M2: layout3D on three.js`

Demo: `npm run gallery`: achromat and Cooke 3D tiles in iso and an achromat front tile, both themes, beside the base
and M1 shots; `PERF=1 npx playwright test perf -g layout3D`. Proves O1, O2, O4 (lenses), O8, O9.

The three.js path is built beside the canvas painter (`layout3dThree.js`) and swapped in by one item (#1253), then
packaged (#1254, #1255), so every commit keeps the gate green (re-plan critique).

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1249 | Spike: `three` devDependency and lockfile; a fixture page rendering a full-density synthetic lens (50 × 128 × 16, LatheGeometry) through one offscreen WebGLRenderer + `drawImage`, timed as U14 (20 flushed redraws); it runs as the O9 test in all three Playwright projects, locally and in CI, with whatever launch flags WebGL needs; O1, O8, O9 written skipped; ADR-0005 `proposed`, its `dev_docs/adr/` link and `zensical.toml` nav line | the spike is the O9 test on a fixture page because the user requires all three browsers (round 2) and that page outlives the spike; considered a throwaway spike script, which proves nothing in CI. Stop and ask if a browser lacks WebGL in CI or the median is over 16 ms. After CR [#1257] (user): the U14 timing runs on a GPU-backed Chromium (`--use-angle=metal`, a `PERF=1` local project in `playwright.config.js`); in CI O9 asserts drawing only, with no timing, and ADR-0005 records that CI WebGL is software (SwiftShader) | `package.json`, `package-lock.json`, `tests/fixtures/layout3d-spike.html`, `tests/gallery.spec.js`, `tests/unit/layout3d.test.js`, `playwright.config.js`, `.github/workflows/ci.yml`, `agent_docs/adr/0005-three-layout3d.md`, `dev_docs/adr/`, `zensical.toml` | O9 spike test green in three browsers on CI; median in the Change log |  |
| #1260 | CI: headless Firefox gets WebGL on the runner (a pref or arg) and Chromium's 2D raster matches the recordings again (no CI-only ANGLE args on 2D tests); CI run 44767072059 on 4ffd6b2 failed 6 | CI config in the repo is a work item (Milestone end, CI); considered a CR, which is for code. Stop and return `cr` if no Firefox setting gives WebGL on the runner (switch signal) | `playwright.config.js`, `tests/gallery.spec.js`, `.github/workflows/ci.yml` | `CI=1` chromium export, map2d-sample, gallery red then green; CI playwright green in three browsers | #1249 |
| #1250 | `layout3dThree.js`: `layout3dScene(layout, o, resolve)` returns `{ scene, camera }`: per surface a `LatheGeometry` from its profile (rotated onto z), rims as two-point lathes, the stop a `RingGeometry`, the image plane a square at the image `sd`; `MeshLambertMaterial` per element, `userData.fill` = glassFill's fill, colour = `resolve(fill)` (injected, so node tests run); a directional + ambient light; `OrthographicCamera` presets `iso` (default) / `front` / `top` / `{ yaw, pitch }` fitted to faces and drawn rays, `scale` overrides; geometry cached per `data` | LatheGeometry because it is indexed with smooth normals and removes the hand face code (critic C); considered reusing `layout3dMesh`, whose non-indexed quads shade flat without `mergeVertices` and allocate per face per redraw | `packages/plots/src/layout3dThree.js`, `tests/unit/layout3d.test.js` | O1 "revolved profiles project", "glass fills per element"; O8 "front view matches layout2D" | #1249 |
| #1251 | Rays and edges in `layout3dThree.js`: `LineSegments2`/`LineMaterial` (`three/addons/lines/`), renderer at `setPixelRatio(dpr)` so `linewidth` is CSS px = `--stroke-ray` / `--stroke-edge`, depth-tested; rays by `raySet`, cut at the first Dead point, no Virtual or in-glass segment (M1 rules); rims as closed lines; silhouettes by M1's limb rule (the rim points of extreme projected y) | fat lines because WebGL lines are 1 px (round 2, user); considered `EdgesGeometry`, which finds rims but not a smooth surface's silhouette | `packages/plots/src/layout3dThree.js`, `tests/unit/layout3d.test.js` | "dead and virtual cut", "empty fan is skipped", "edge outlines" against the line objects | #1250 |
| #1252 | Render in `layout3dThree.js`: `render3d(canvas, props)` with one shared offscreen `WebGLRenderer`, the dpr clamp to 2-3 kept, `drawImage` into the caller's 2D canvas, then the dashed axis, XYZ triad and labels drawn as today's 2D overlay; `layout3D: WebGL is not available` when the context fails | one shared context because browsers cap live WebGL contexts (~16) and the gallery redraws on theme change; considered a renderer per canvas, which leaks contexts on redraw | `packages/plots/src/layout3dThree.js`, `tests/gallery.spec.js` | "no WebGL names layout3D" (stubbed `getContext`); "40 redraws, no context lost" | #1251 |
| #1253 | Swap: `layout3D` calls `render3d`; the painter, `project`, `fitView`, `clipEdges`, `layout3dMesh` and their tests ("face budget at 50 surfaces", "rays sort with the faces", "rays framed", "large scale") deleted; the style-lint exemption, gallery.spec's imports, field-order's call follow; gallery gets the achromat `front` tile, pixel-ratio and canvas counts follow | one swap because the old tests pin the old behaviour and must die with it; considered swapping in C, which leaves the gallery red until E | `packages/plots/src/layout3d.js`, `packages/plots/src/renderers.js`, `gallery/index.html`, `tests/unit/layout3d.test.js`, `tests/unit/style-lint.test.js`, `tests/unit/field-order.test.js`, `tests/gallery.spec.js`, `tests/pixel-ratio.spec.js` | all gallery and unit suites; O9 on the real tiles | #1252 |
| #1254 | Packaging: `three` optional peer (`>=0.170 <1`, `peerDependenciesMeta`); `./layout3d` export; esbuild `external: ['three', 'three/*']` for the ESM build, bundled in the new `eleo-layout3d.js` IIFE (`src/iife-layout3d.js` attaching to `window.ELEO`, as `iife-layout.js` does); layout3D out of `renderers.js`, `index.js`, `eleo-plots.js`; `index.d.ts` → `layout3d.d.ts` (with `view`), the `.d.ts` copy loop; the gallery's script tag | the user chose an own entry (round 1, user); considered a lazy `import('three')` in the main entry, which makes layout3D async and cannot run in the classic-script IIFE | `packages/plots/package.json`, `packages/plots/build.mjs`, `packages/plots/src/iife-layout3d.js`, `packages/plots/src/index.js`, `packages/plots/src/renderers.js`, `packages/plots/src/index.d.ts`, `packages/plots/src/layout3d.d.ts`, `gallery/index.html`, `tests/types/layout3d.ts`, `tests/unit/types.test.js` | types.test.js "layout3d.ts"; export test: main entry has no `layout3D`, `./layout3d` has, `dist/index.js` has no three | #1253 |
| #1255 | Docs and wrapper: `Layout3D.svelte` imports `@eleoptics/plots/layout3d` and passes `view`; both READMEs (the new import, `view`, the iso default, three as a peer); the changeset says layout3D moved | forced (A4: each change carries the docs it invalidates) | `packages/plots-svelte/src/lib/Layout3D.svelte`, `packages/plots/README.md`, `packages/plots-svelte/README.md`, `.changeset/layout3d-typed.md` | plots-svelte.test.js; svelte-check | #1254 |
| #1256 | Unskip O1, O2, O8, O9; record the U14 median | forced (`workflow.md`, TDD) | `tests/unit/layout3d.test.js`, `tests/perf.spec.js`, `tests/gallery.spec.js` | O1, O2, O8, O9 | #1255 |

### M3: mirrors in 3D, on three.js GitHub: `P1193 M3: mirrors, holes and obscurations in 3D`

Demo: the Cassegrain 3D tile in both themes, `layout3D(canvas, { data: cassegrain })`. Proves: O3, O4 (mirrors)

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1200 | O3 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/layout3d.test.js` | "mirror bodies revolve", "holes stay open" | #1256 |
| #1201 | A mirror's layout2D body (its y ≥ 0 polygon from `mirrorBodies`, exported) revolved as three geometry in `layout3dThree.js`, shaded `--mech`, open inside `hole`; an obscuration as a disc mesh | revolve the body layout2D already settles (the back's side, the hole's crossing, U17) because a second rule would let 2D and 3D disagree; considered building the body from the profile alone | `packages/plots/src/layout3dThree.js`, `packages/plots/src/layout2d.js`, `tests/unit/layout3d.test.js` | the O3 tests | #1200 |
| #1202 | Gallery: the Cassegrain 3D tile; unskip O3 | forced (`workflow.md`, TDD: the last item unskips them); the tile is O4's demo | `gallery/index.html`, `tests/gallery.spec.js`, `tests/unit/layout3d.test.js` | gallery.spec "layout3D cassegrain tile draws" (three browsers), O3 | #1201 |

Items #1249, #1253 and #1254 list more than two files: each moves one behaviour with the tests and wiring it
breaks (A3).

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| Firefox or WebKit has no WebGL headless in CI | O9 fails; the user requires all three | #1249's spike first; stop and ask (course check) |
| A full-density mesh misses 16 ms through WebGL + `drawImage` + readback | O2 fails | #1249 times the exact loop; geometry cached per `data` (#1250). Happened: SwiftShader 85-105 ms, Apple GPU 1.6 ms; U14 is timed on a GPU only (CR [#1257]) |
| Fat lines' width differs with dpr | rays and edges off-token | `setPixelRatio(dpr)`, `linewidth` in CSS px (#1251) |
| The look is rejected a third time | O4 | M2 demo with front and iso views beside the base and M1 shots (course check) |

## Moved to row K

O5-O7 and the old M3, kept as written for row K's planner (not run by this plan).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O5 | No renderer reads the sample or takes an analysis `kind`; each removed call throws a named error. The gallery draws every sample tile from data it passes, through its own adapters, and each draws the same SVG as before. | given the built package, when the removed calls are compiled and called, then each fails the type check and throws `<fn>: <what> was removed in 0.11; see the README migration table`, `./sample` and `./eleo-plots-sample.js` are not exported and no `dist` file carries the sample, and every `renderers-baseline.json` entry drawn through `gallery/sample-adapters.js` and a typed call equals its recorded string | `spec` this plan's removal list; `fixture` `tests/fixtures/renderers-baseline.json` (recorded from the plan base, `chromaticFocus` and `rayFan-opd` added by item 11 from the base build, never re-recorded in J) | `tests/types/removed.ts` (through `types.test.js`), `tests/unit/sample-free.test.js`, `tests/unit/split.test.js` |
| O6 | `throughFocus` is typed: the caller passes the defocus values and a row of spot series per field. | given the sample's through-focus spots adapted by the gallery, when `throughFocus` draws them, then the SVG equals the baseline's `throughFocus` entry | `fixture` `renderers-baseline.json` `throughFocus` | `tests/unit/split.test.js` |
| O7 | The breaking release is ready: plots and plots-svelte bump the next minor (plots-svelte's peer `>=<that version> <1`), tokens a patch ([#158]), and the README migration table names each removed call and its typed replacement, padded glass names included. | given `npx changeset status`, then plots and plots-svelte bump minor and tokens patch, the peer equals the next plots version, and the migration table names every removal in O5 | `spec` semver for 0.x (a minor may break) and this plan's removal list | `tests/unit/release.test.js` "J changesets", "migration table" |

### Old M3 (moved to roadmap row K; for its planner, not run here)

Demo: `SHOTS=1 SHOTS_BASE=<M2 shots> npx playwright test gallery-shots` (zero differing tiles);
`node --test tests/unit/types.test.js` (each removed call in `removed.ts` fails without its `@ts-expect-error`);
`npx changeset status`. Proves: O5, O6, O7

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1203 | O5, O6, O7 acceptance tests, skipped; `chromaticFocus` and `rayFan-opd` (gallery options) recorded into the baseline from the plan base's build | forced (`workflow.md`, TDD: the first item writes them skipped); the two entries because O5's oracle must be recorded before anything changes, never from code under test | `tests/types/removed.ts`, `tests/unit/types.test.js`, `tests/unit/sample-free.test.js`, `tests/unit/release.test.js`, `scripts/record-renderers.mjs`, `tests/fixtures/renderers-baseline.json` | as O5-O7 | #1202 |
| #1204 | `gallery/sample-adapters.js` (classic script, a global): the chromaticFocus adapter, `fanPanels` with rayFan's size and key lines, the two sample layouts and the key labels; the gallery fetches `sample.json` and draws those tiles by typed calls; `record-renderers.mjs` reads `sample.json` and draws through the adapters; `fan.test.js`'s `fanPanels` cases move to the adapters' test; the gallery.spec sample-script tests follow | a classic script with a global because the gallery is a classic-script page and `adapters.js` already works that way for node and the page; considered an ES module, which needs a module tag and an ordering change. Only what the gallery draws moves: the mtf, field curvature and distortion adapters and `spotPanels` die with their calls | `gallery/sample-adapters.js`, `gallery/index.html`, `scripts/record-renderers.mjs`, `tests/unit/sample-adapters.test.js`, `tests/gallery.spec.js` | split.test.js every entry, sample-adapters.test.js | #1203 |
| #1205 | Typed `throughFocus({ defocus: number[], rows: { title, series: SpotSeries[][] }[], unit, half, width, view, grid })`: `rows[i].series[j]` is the field's spots at `defocus[j]`; RMS computed from the points (1 decimal), the `--ink-subtle` frame on the 0-defocus column, `unit` in header and caption, `half` 40 by default; `minWidth('throughFocus', props)` from `defocus.length`; `throughFocus({})` throws `throughFocus: pass { defocus, rows }; the sample call was removed in 0.11`; the gallery tile and baseline entry go through the adapter | keep spot's panel function and replace only the input because O6's oracle is the old SVG; considered dropping throughFocus (user chose typed, round 1) | `packages/plots/src/spot.js`, `packages/plots/src/sizes.js`, `packages/plots/src/index.d.ts`, `gallery/sample-adapters.js`, `gallery/index.html`, `scripts/record-renderers.mjs`, `packages/plots/README.md`, `tests/unit/spot.test.js`, `tests/unit/scale.test.js`, `tests/unit/field-order.test.js`, `tests/types/keys.ts`, `tests/types/interact.ts` | split.test.js "throughFocus", sample-free.test.js "throughFocus error" | #1204 |
| #1206 | Remove curve `kind`: the adapters, `CurveKindProps`, CurvePlot's kind docs; `curve({ kind: "mtf" })` throws `curve: kind was removed in 0.11; pass series or panels (see the README migration table)` | forced (O5's removal list) | `packages/plots/src/curve.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/CurvePlot.svelte`, `packages/plots/README.md`, `tests/unit/curve.test.js`, `tests/unit/field-order.test.js`, `tests/unit/interact-matrix.test.js`, `tests/types/curve.ts`, `tests/unit/sample-free.test.js` | sample-free.test.js "curve kind", removed.ts "curve kind" | #1205 |
| #1207 | Remove `rayFan` and `RayFan.svelte`; `minWidth('rayFan', props)` from curve panels props; `PLOT_SIZES.rayFan` stays | forced (O5's removal list) | `packages/plots/src/fan.js` (deleted), `packages/plots/src/renderers.js`, `packages/plots/src/index.js`, `packages/plots/src/sizes.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/RayFan.svelte` (deleted), `packages/plots-svelte/src/lib/index.js`, the two READMEs, `tests/unit/fan.test.js` (deleted), `tests/unit/curve.test.js`, `tests/unit/scale.test.js`, `tests/unit/field-order.test.js`, `tests/unit/plots-svelte.test.js`, `tests/svelte.spec.js`, `tests/fixtures/svelte/ViewHarness.svelte` | removed.ts "rayFan" | #1206 |
| #1208 | Remove the spot sample call: `spotPanels`, SpotDiagram's sample unit, `minWidth('spot')`'s sample read; `spot({})` throws `spot: pass { panels }; the sample call was removed in 0.11` | forced (O5's removal list) | `packages/plots/src/spot.js`, `packages/plots/src/sizes.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/SpotDiagram.svelte`, the two READMEs, `tests/unit/spot.test.js`, `tests/unit/scale.test.js`, `tests/unit/field-order.test.js`, `tests/unit/interact-matrix.test.js`, `tests/unit/sample-free.test.js` | sample-free.test.js "spot sample", removed.ts "spot sample" | #1207 |
| #1209 | Remove `map2D(canvas, …)` and Map2D's canvas branch; `map2D(canvas)` throws `map2D: the canvas call was removed in 0.11; pass { values, extent }` | forced (O5's removal list); supersedes [#639], [#424] | `packages/plots/src/map2d.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/Map2D.svelte`, `packages/plots-svelte/src/fixtures/Map2DTypes.svelte`, the two READMEs, `tests/map2d-sample.spec.js` (deleted), `tests/fixtures/map2d-baseline.json` (deleted), `scripts/record-map2d-baseline.mjs` (deleted), `tests/unit/map2d-svelte.test.js`, `tests/types/map2d.ts`, `tests/unit/sample-free.test.js` | sample-free.test.js "map2D canvas", removed.ts "map2D canvas" | #1208 |
| #1210 | `layout2D` and `glassLegend` take a `RecordedLayout` only (no `LayoutSystem`, no sample default; `colorBy` stays as the aria-label word); `layout2D({})` keeps its `ELEO: pass { data }` error, `layout2D({ data: system })` throws `layout2D: pass a RecordedLayout; LayoutSystem was removed in 0.11` | forced (O5's removal list); supersedes [#125] | `packages/plots/src/renderers.js`, `packages/plots/src/glass.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/Legend.svelte`, `packages/plots/README.md`, `tests/unit/layout2d.test.js`, `tests/unit/glass.test.js`, `tests/unit/interact-matrix.test.js`, `tests/types/glass.ts`, `tests/unit/sample-free.test.js` | sample-free.test.js "LayoutSystem", removed.ts "LayoutSystem" | #1209 |
| #1211 | `legend` keys values only from `values` | forced (O5's removal list) | `packages/plots/src/legend.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `tests/unit/legend.test.js`, `tests/types/keys.ts` | legend.test.js "values only" | #1210 |
| #139 reuse | Reject padded glass names (`g.name === g.name.trim()`) with one case in "unknown glass string throws" | as the issue names it, because a trimmed name is the only form both legend and fill agree on; considered trimming silently, which hides a data error | `packages/plots/src/glass.js`, `packages/plots/README.md`, `tests/unit/glass.test.js` | glass.test.js "unknown glass string throws" | #1211 |
| #1212 | Remove `useSample`, `sample`, `data.js`, `sample.js`, `sample.d.ts`, `iife-sample.js` and `iife.js`'s sample getter; exports, `sideEffects` and the build without the sample; the classic merge test and gallery.spec's classic tests without it; `scripts/sample-layout.mjs` (spent) deleted | forced (O5's removal list; core: package.json exports); supersedes [#132], [#133] | `packages/plots/src/data.js`, `sample.js`, `sample.d.ts`, `iife-sample.js` (deleted), `packages/plots/src/iife.js`, `renderers.js`, `index.d.ts`, `packages/plots/package.json`, `packages/plots/build.mjs`, `packages/plots-svelte/src/lib/index.js`, the two READMEs, `scripts/sample-layout.mjs` (deleted), `tests/fixtures/classic-merge.html`, `tests/gallery.spec.js`, `tests/unit/data.test.js` (deleted), `tests/unit/curve.test.js`, `tests/unit/legend.test.js`, `tests/unit/layout2d.test.js`, `tests/types/interact.ts`, `tests/unit/sample-free.test.js` | sample-free.test.js "exports", "dist has no sample", removed.ts "useSample" | #139 |
| #1213 | Changesets (plots minor, plots-svelte minor with its peer at the next plots version, derived, not literal), the README migration table; unskip O5-O7 | forced (`workflow.md`, TDD: the last item unskips them; O7) | `.changeset/sample-free.md`, `packages/plots-svelte/package.json`, `packages/plots/README.md`, `tests/unit/release.test.js`, `tests/unit/sample-free.test.js`, `tests/types/removed.ts` | O5, O6, O7 | #1203, #1204, #1205, #1206, #1207, #1208, #1209, #1210, #1211, #139, #1212 |

Items 3, 13-18 and 21 list more than two files: each source change carries the tests, type files and README sections
it breaks (A3, A4), and each is one behaviour.

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-18 draft.
- 2026-11-18 round 1 (user): buckets confirmed (absorb [#158], [#139]; supersede [#125], [#639], [#424], [#132], [#133]; [#86] related). layout3D takes a RecordedLayout, revolved; O1's oracle changes to the closed-form projection of the recorded layouts plus U12's fill per glass (U10's oracle, changed by the user). throughFocus is typed, not removed. `./sample` and `eleo-plots-sample.js` are removed; the gallery loads sample.json itself.
- 2026-11-18 round 2 (user): meridional rays only. Mirrors, obscurations and annular holes are drawn in 3D (a Cassegrain 3D tile). Pre-mortem: "I don't think we're ready for a 1.0 release because no client has really used eleo-ui, so much of the API is untested in the real world", and "3D looks worse".
- 2026-11-18 round 3 (user): a breaking 0.x minor, not 1.0: 1.0 waits until a consumer has used the API (the roadmap's "major release" changes to this, the user's call). The 3D look is the user's approval at the M1 demo, today's screenshot beside the new tiles. One plan, not two rows. `sample.json` stays in place.
- 2026-11-18 critique (plan critic, claude-fable-5-1): 26 findings. Applied: 1 (sizes.js; `PLOT_SIZES.rayFan` kept), 2 (every breaking test in its item's Files), 3 (`record-renderers.mjs`), 4 (throughFocus tile in item 13), 5 (the existing tile switches in item 3), 6 (3,500-face budget, flushed timing, O1 at full density, face-count test), 7 (ray occlusion rule), 8 (fill probe), 9 (default framing, `scale` in px/mm), 10 (stop ring, Dead/Virtual cut), 11 (`colorBy` dropped from layout3D), 12 (throughFocus RMS, frame, unit, half), 13 (no literal version: PR 1143), 14 (two baseline entries recorded from the base), 15 (move only what the gallery draws), 16 (padded names in O5/O7; row J's exit reworded), 17 (items 16 and 17 split), 18 (types.test.js), 19 (named errors), 20 (fixture path), 21 (READMEs per item), 22 (gallery-shots), 23 (Core list), 24 (dist check), 25 (O2 recorded, not asserted; shared fixture), 26 (count; `sample-layout.mjs` deleted). Approach alternatives taken: item 2 (mesh and projection apart), item 3 (`raySet` export), item 9 (y ≥ 0 polygon), item 12 (classic script). Rejected: item 13's `cells[j] = { series }`, because nothing asks a cell for a title or stats and the old SVG has none. 22 items.
- 2026-11-19 orchestrator: #1195 face density is min(128 × 16, 3,499 / glazed surfaces) per surface, so the achromat gets about 10 rings × 79 segments, not full density. "Full density for small systems" cannot hold under the 3,500 budget for more than one surface. The user judges the look at the M1 demo (O4, course check).
- 2026-11-19 orchestrator: CR [#1216] accepted: #1196 adds `tests/unit/layout2d.test.js` to its Files, because its export-list test pins `layout2d.js` to two exports and #1196 exports `raySet` and the status rules. The package entry is unchanged.
- 2026-11-19 #1196 first attempt: the first flushed U14 median is 20.45 ms (chromium, reference layout, marginal-chief rays, about 3,400 faces), over 16 ms with the face budget met. This is the M1 switch signal; it is not yet profiled, and the median at #1199 is the one recorded for O2.
- 2026-11-19 #1196 (3109b7b): re-measured at 20.35-20.55 ms over three runs. About 3.5 ms is layout3dScene and about 16.5 ms is canvas painting, of which the per-face 0.7 px seam stroke is about 11 ms (8.85 ms without it, with hairline seams). Left for the M1 course check: dropping or batching the stroke changes the look (O4).
- 2026-11-19 orchestrator: CR [#1217] accepted: the default view leaves the drawn rays' starts outside the canvas (wave-end shot on #1196). New item #1218 before #1199.
- 2026-11-19 orchestrator: CR [#1219] accepted: #1197 adds `packages/plots/src/layout3d.js` and `tests/unit/layout3d.test.js` to its Files, because its `layout3D: pass { data: RecordedLayout }` error can only be thrown there.
- 2026-11-19 orchestrator: CR [#1220] accepted: #1198 adds `tests/pixel-ratio.spec.js` to its Files, whose canvas count (4) and `=== 'layout3D'` dpr branch a second canvas tile breaks.
- 2026-11-19 #1199: O2 median recorded: 20.55, 20.45 and 20.55 ms over three runs (PERF=1, chromium, the 50-surface reference layout, marginal-chief rays), over the 16 ms target. O2 is not met: this is the M1 switch signal (median over 16 ms with the face budget met), for the M1 course check. The perf test reports and does not assert, so the gate stays green.
- 2026-11-19 orchestrator: review M1 round 1: 3 blocking, 4 backlog. CRs [#1222] and [#1223] accepted (item #1225); CR [#1224] (O2 not met) is the user's, decided at the M1 course check; the 4 backlog findings are small and named, so they are pulled into M1 as #1226-#1229.
- 2026-11-19 CR [#1224] (user): Drop the seam stroke. Work item #1230; the look is judged at the M1 demo.
- 2026-11-19 #1230 (3b374f2): O2 met. The U14 median without the seam stroke is 8.80-9.20 ms over four runs, against 20.55-20.65 ms with it (chromium, the 50-surface reference, marginal-chief), under 16 ms. perf.spec now asserts it under PERF=1. Whether seams show is judged at the M1 demo (O4).
- 2026-11-19 orchestrator: review M1 round 2: 1 blocking, 2 backlog, all 7 carried CRs resolved. CR [#1231] accepted (item #1233); finding 3 pulled into M1 as #1234; finding 2's layout2D part filed as #1232 (unverified, outside the range).
- 2026-11-19 orchestrator: CR [#1235] accepted: #1233 adds `tests/unit/field-order.test.js` to its Files, whose fake span lacks the `appendChild` the crown wrapper needs.
- 2026-11-19 orchestrator: review M1 round 3: 0 blocking, 1 backlog, all 9 carried CRs resolved. The backlog finding is small and named, so it is pulled into M1 as #1236; round 4 follows.
- 2026-11-19 review M1 round 4 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in; all 9 CRs resolved. Rounds: 1 (3 blocking, 4 pulled in), 2 (1 blocking, 1 pulled in), 3 (0 blocking, 1 pulled in), 4 (0, 0). M1 ticked.
- 2026-11-19 course check M1 planned (user): no-go. "The 3D doesn't look good enough. Bring back edge outlines." Course reviewers (two passes) recommended continue; the user rejected the M1 tiles in demo round 1 (the switch signal fires at two). CR [#1237] (user): edge outlines back, item #1238; M1 is not accepted until a repeat demo says go.
- 2026-11-19 orchestrator: review M1 round 5: 0 blocking, 2 backlog, all 10 CRs resolved (#1237 by #1238). Both findings are small and named in layout3d.js, and finding 1 (shared faces cover the inner half of most edges) bears on the repeat demo, so they are pulled into M1 as #1239; round 6 follows.
- 2026-11-19 orchestrator: review M1 round 6: 1 blocking, 2 backlog. The breaker tripped (blocking + pulled in: r4 0, r5 1, r6 3, no fall for 2 rounds): "Review M1 stuck: 1 blocking, no fall for 2 rounds". stuck (user, 2026-11-19): continue. CR [#1240] accepted; findings 2 (the Cooke default view's back rim drawn over the front band, 79 wrong samples against 44 before #1239) and 3 pulled in; all three fixed in #1241; round 7 follows.
- 2026-11-19 CR [#1242] (user): Both, at more cost. One depth per edge cannot give full-width edges and correct occlusion together (#1241's counts: c765907 over-draws 77/73 Cooke samples, mid depth half-covers 283-306 edges), so #1241 draws each edge after its sharing faces, clipped against nearer faces, within O2.
- 2026-11-19 orchestrator: review M1 round 7: 0 blocking, 4 backlog; all 12 CRs resolved (#1240, #1242 by #1241). Pulling the 4 in tripped the breaker again (r4 0, r5 1, r6 3, r7 4). stuck (user, 2026-11-19): continue. Item #1243; round 8 follows.
- 2026-11-19 orchestrator: review M1 round 8: 1 blocking, 1 backlog (breaker count 2, down from 4). CR [#1244] accepted: #1243's `delete f.z` on face items raised the U14 median to about 16.1 ms (O2 failing 8 of 10 runs; the base was about 15.5 ms, failing 1 of 7). Item #1245 keeps depths off the items and restores headroom; finding 2 pulled in. Round 9 follows.
- 2026-11-19 orchestrator: review M1 round 9: 0 blocking, 1 backlog (breaker count 1, down from 2); all 13 CRs resolved (#1244 by #1245, U14 13.3-14.0 ms; scene items identical to #1243's in 28 cases). The finding (unbounded clip grid at large `scale`) is small and named, so it is pulled in as #1246; round 10 follows.
- 2026-11-19 orchestrator: review M1 round 10: 1 blocking, 0 backlog (breaker count 1, the same as round 9: one round without a fall). CR [#1247] accepted: CI run 44649623803 on 9d860e4 fails "large scale", whose sha256 depends on the Node build's last-bit floats. Item #1248 rounds before hashing. Round 11 follows.
- 2026-11-19 review M1 round 11 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in; all 14 CRs resolved. Rounds 5-11 (blocking + pulled in): 1, 3, 4, 2, 1, 1, 0. M1 re-ticked for demo round 2.
- 2026-11-19 course check M1 triggered (user): no-go. "I'm confused about the projection. It looks like the lens is rotated differently than the image plane. What kind of camera projection is being used? Leverage 3rd party libraries like 3js where possible. A typical CAD or engineering type of projection to accurately represent objects is necessary." Course reviewers (two passes) recommended continue on a go. The orchestrator checked: layout3D is an orthographic orbit camera (yaw -38 about the vertical, pitch 16 about the screen horizontal), and the lens and image plane share it (a rim-sized circle at the image z projects to the same 91 x 146 px ellipse as the rim), but the drawing does not read as consistent. Second demo rejection: the switch signal's demo arm fires.
- 2026-11-19 course check M1 stop (user): Stop, re-plan. layout3D moves to three.js with a CAD-style camera, which this plan's Non-goals (WebGL) and the roadmap's kill criterion leave to /plan (an ADR for the dependency, the camera, the demos, and whether the breaking minor, M3, splits off). M1's work stays on the branch; nothing is accepted.
- 2026-11-20 re-plan (from the course check M1 stop): round 1 (user): three as an optional peer with its own entry; an orthographic camera, isometric by default, static; the breaking minor splits off to a new roadmap row K; the M1 tiles read wrong in orientation, shading/depth, edges and rays.
- 2026-11-20 re-plan round 2 (user): a new oracle, the front view matches layout2D (O8); three's Line2 fat lines; the 3D tests must pass in all three browsers (a spike failure stops and asks); U14 kept at full density.
- 2026-11-20 re-plan critique (plan critic, claude-fable-5-1): 15 findings, all applied: three's devDependency in the spike; the three.js path built beside the painter and swapped by one item (#1253), packaging after (#1254, #1255), so the gate stays green; esbuild `external`, the `.d.ts` copy loop, `three/addons`; O8 on meridian vertices under layout2D's parsed matrix (a concave face's silhouette is its rim chord); the injected `resolve`; the spike times full density and the course check gains its count; the dpr clamp kept; `setPixelRatio` so line widths are CSS px; the axis overlay kept (#1252); `view` docs with the wrapper (#1255); CI flags folded into the spike; ADR site wiring; packaging split; a stubbed `getContext` and a context-cap test. Approach: #1250 takes LatheGeometry over reusing `layout3dMesh`; #1254's lazy-import alternative rejected (async, no classic IIFE); #1251 keeps M1's limb rule.
- 2026-11-20 re-plan approved (user). M1 stays as written (done, not accepted); new M2 #1249-#1256; old M2 is M3 (#1200-#1202, after #1256); old M3's items #1203-#1213 and #139 leave the P1193 milestones for row K.
- 2026-11-20 CR #1257 (user): GPU-only timing. Option 2: three.js stays at full density; U14 is measured locally on a GPU-backed Chromium (`--use-angle=metal`, 1.6 ms in the spike); CI runs O9 in all three browsers with no timing, because its WebGL is SwiftShader (85-105 ms). #1249 carries it.
- 2026-11-20 #1249: U14 spike median 1.30, 1.30, 1.60 ms (Apple M2 Max, Chromium `--use-angle=metal`, 50 × 128 × 16 LatheGeometry, 192,000 faces), under 16 ms; software WebGL (SwiftShader) 96-99 ms, not timed (CR [#1257]). WebGL draws in all three browsers locally; CI unverified until the push runs. ADR-0005 proposed, its verdict waits for the M2 demo.
- 2026-11-20 orchestrator: CI on 4ffd6b2 failed 6: Firefox has no WebGL context on the runner; Chromium's 2D raster tests drift under #1249's CI-only SwiftShader args. Work item #1260 (CI config), before #1251. WebKit and Chromium drew the spike in CI (Chromium 143.95 ms, software).

[#1257]: https://github.com/ELEOptics/eleo-ui/issues/1257
[#125]: https://github.com/ELEOptics/eleo-ui/issues/125
[#132]: https://github.com/ELEOptics/eleo-ui/issues/132
[#133]: https://github.com/ELEOptics/eleo-ui/issues/133
[#1216]: https://github.com/ELEOptics/eleo-ui/issues/1216
[#1217]: https://github.com/ELEOptics/eleo-ui/issues/1217
[#1219]: https://github.com/ELEOptics/eleo-ui/issues/1219
[#1220]: https://github.com/ELEOptics/eleo-ui/issues/1220
[#1222]: https://github.com/ELEOptics/eleo-ui/issues/1222
[#1223]: https://github.com/ELEOptics/eleo-ui/issues/1223
[#1224]: https://github.com/ELEOptics/eleo-ui/issues/1224
[#1231]: https://github.com/ELEOptics/eleo-ui/issues/1231
[#1235]: https://github.com/ELEOptics/eleo-ui/issues/1235
[#1237]: https://github.com/ELEOptics/eleo-ui/issues/1237
[#1240]: https://github.com/ELEOptics/eleo-ui/issues/1240
[#1242]: https://github.com/ELEOptics/eleo-ui/issues/1242
[#1244]: https://github.com/ELEOptics/eleo-ui/issues/1244
[#1247]: https://github.com/ELEOptics/eleo-ui/issues/1247
[#139]: https://github.com/ELEOptics/eleo-ui/issues/139
[#158]: https://github.com/ELEOptics/eleo-ui/issues/158
[#424]: https://github.com/ELEOptics/eleo-ui/issues/424
[#639]: https://github.com/ELEOptics/eleo-ui/issues/639
[#79]: https://github.com/ELEOptics/eleo-ui/issues/79
[#86]: https://github.com/ELEOptics/eleo-ui/issues/86
