# Plan #1193: Typed layout3D, then the breaking minor

Status: approved 2026-11-18
Branch: `plan/1193-layout3d-typed-major` PR: #<pr> Depends on: none Roadmap: `agent_docs/roadmap.md`, row J
Course check: M1 — it tests the riskiest assumption, a painter-sorted canvas mesh drawing 50 revolved surfaces in 16 ms at a face budget whose look the user accepts. Switch signal: item 3's first flushed median at the 50-surface reference size is over 16 ms with the item-2 face budget met, or the user rejects the M1 3D tiles in two demo rounds.

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

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `layout3D(canvas, { data: RecordedLayout })` draws any recorded lens system in 3D: each surface revolved from its profile, each glass gap filled with U12's fill for that glass (the `"crown"`/`"flint"` shorthand keeps its tokens), the meridional rays by layout2D's ray sets, a stop ring, and the image plane at the image surface's `sd`; framed to fit the canvas by default. (U10) | given the recorded sample achromat, Cooke glasses and Wandersleb layouts at full density and an explicit `scale`, when each mesh vertex is projected at yaw −38, pitch 16 and at yaw 20, pitch −10, then it lies within 0.5 px of an independent orthographic projection of the revolved profile point, and every face of an element carries `glassFill`'s fill for that element's glass name | `closed-form` orthographic projection, rotation matrices written in the test, of the recorded layouts (U10's oracle, changed by the user in round 1); `property` U12's fill per glass name | `tests/unit/layout3d.test.js` "revolved profiles project", "glass fills per element" |
| O2 | layout3D keeps U14. | given the 50-surface, 3-field, 21-ray reference layout, when layout3D redraws 20 times, each followed by a 1 px `getImageData` read, then the median, recorded in the Change log, is under 16 ms | `measurement` U14's (roadmap) | `tests/perf.spec.js` "layout3D redraw (U14)" |
| O3 | Mirrors, obscurations and annular holes draw in 3D: a mirror as its layout2D body (flat back, D/8) revolved, a hole left open, an obscuration as an opaque disc. | given the recorded Cassegrain layout, when the mesh is built, then each mirror body's revolved points project within 0.5 px of the independent projection of layout2D's body polygon, no mirror face lies at a radius under its `hole`, and the obscuration is one disc of its `sd` | `reference` layout2D's `mirrorBodies` (U17's tested polygons); `closed-form` as O1; `property` no face inside the hole | `tests/unit/layout3d.test.js` "mirror bodies revolve", "holes stay open" |
| O4 | The 3D tiles look as good as today's. | given today's layout3D tile shots (both themes, captured at the plan base) beside the new achromat, Cooke and Cassegrain tiles, then the user approves them at the M1 and M2 demos | `user` the gallery's layout3D tiles at the M1 and M2 demos (round 3) | the demo |
| O5 | No renderer reads the sample or takes an analysis `kind`; each removed call throws a named error. The gallery draws every sample tile from data it passes, through its own adapters, and each draws the same SVG as before. | given the built package, when the removed calls are compiled and called, then each fails the type check and throws `<fn>: <what> was removed in 0.11; see the README migration table`, `./sample` and `./eleo-plots-sample.js` are not exported and no `dist` file carries the sample, and every `renderers-baseline.json` entry drawn through `gallery/sample-adapters.js` and a typed call equals its recorded string | `spec` this plan's removal list; `fixture` `tests/fixtures/renderers-baseline.json` (recorded from the plan base, `chromaticFocus` and `rayFan-opd` added by item 11 from the base build, never re-recorded in J) | `tests/types/removed.ts` (through `types.test.js`), `tests/unit/sample-free.test.js`, `tests/unit/split.test.js` |
| O6 | `throughFocus` is typed: the caller passes the defocus values and a row of spot series per field. | given the sample's through-focus spots adapted by the gallery, when `throughFocus` draws them, then the SVG equals the baseline's `throughFocus` entry | `fixture` `renderers-baseline.json` `throughFocus` | `tests/unit/split.test.js` |
| O7 | The breaking release is ready: plots and plots-svelte bump the next minor (plots-svelte's peer `>=<that version> <1`), tokens a patch ([#158]), and the README migration table names each removed call and its typed replacement, padded glass names included. | given `npx changeset status`, then plots and plots-svelte bump minor and tokens patch, the peer equals the next plots version, and the migration table names every removal in O5 | `spec` semver for 0.x (a minor may break) and this plan's removal list | `tests/unit/release.test.js` "J changesets", "migration table" |

## Non-goals

- 1.0: waits until a consumer has used the API (user, round 3).
- phos-core's 3D `visualize` as input: its Python client does not expose it; next plan, once phos-core does.
- Sagittal or skew rays in 3D: a `RecordedLayout` holds meridional rays only (user, round 2).
- Ray status styles in 3D (dotted, `show`): a ray is drawn solid through its first Dead point and never through a Virtual point; next plan if asked.
- An interactive 3D viewport (phos's, threlte), hover on layout3D, WebGL.
- `colorBy` on layout3D: a RecordedLayout's rays are coloured by fan, as in layout2D.
- Publishing to npm: the user merges the Version Packages PR after the plan PR; row J turns done at the plan PR's merge, and its exit is reworded at publish to "the breaking minor's changesets are on `main`".
- Moving `sample.json`: it stays in `packages/plots/src` as a dev fixture; no entry imports it (user, round 3).

## Existing issues

| Issue | Bucket | Where or why |
| -- | -- | -- |
| [#158] | absorb | item 5: layout3D draws rays at `--stroke-ray`; its text becomes "Rays in 3D drawings." |
| [#139] | absorb | item 20: reject padded glass names, a breaking change that belongs in this release |
| [#125] | supersede | item 18: `LayoutSystem` (`layout` vs `layoutWl`) goes |
| [#639] | supersede | item 17: the sample canvas `map2D` goes |
| [#424] | supersede | item 17: its test (`map2d-sample.spec.js`) goes with the sample canvas |
| [#132] | supersede | item 21: `iife.js`'s sample getter goes with `eleo-plots-sample.js` |
| [#133] | supersede | item 21: `classic-merge.html` loses `eleo-plots-sample.js` |
| [#86] | related | J needs no `release.yml` edit; CR [#79] (user) kept the line |
| others | related | untouched |

## Constraints and assumptions

- A1: no consumer calls anything O5 removes (checked in phos and eleo-website, 2026-11-18).
- A2: the sample tiles stay; the gallery adapts `sample.json` itself through `gallery/sample-adapters.js`, a classic
  script setting a global as `tests/fixtures/phos-core/adapters.js` does.
- A3: every removal lands after the gallery and `record-renderers.mjs` stop using it (items 12-13 before 14-21), and
  each item carries every test, type file and README section its change breaks, so each commit keeps the gate green.
- A4: a removal item lists the README section it invalidates; item 22 adds only the migration table.
- A5: PR 1143 may merge before or after J; nothing in J names a literal version.
- Kill criterion (roadmap, D on / U14): a layout3D median over 16 ms whose fix needs WebGL stops and asks.

## Decisions

- ADR-0001: layout3D's tone composition stays a style-lint exemption; the exemption's regex follows the code (item 3).
- No ADR: the 0.x policy (no 1.0 until a consumer uses the API) goes in the roadmap's Constraints at publish.
- Roadmap edits at publish (user decisions, rounds 1 and 3): U10's oracle; row J's "major release" becomes "the
  breaking minor", and its exit as in Non-goals.
- `PLOT_SIZES.rayFan` and `minWidth('rayFan', props)` stay as the fan-panel size: the gallery's recorded fan tile uses
  them (`gallery/index.html:54,115`); `minWidth('rayFan')` reads curve panels props instead of the sample.
- Core changes: `packages/plots/src/index.d.ts`: `Layout3DProps` (required props), `ThroughFocusProps`,
  `Layout2DProps.data`, `glassLegend`'s parameter, `SpotDiagramProps`, `legend`'s doc, the named exports; removes
  `CurveKindProps`, `RayFanProps`, `Map2DProps`, `SpotSampleProps`, `LayoutSystem`, `sample`, `useSample`, `rayFan`,
  `map2D(canvas)`. `packages/plots/package.json`: exports drop `./sample` and `./eleo-plots-sample.js`, `sideEffects`
  drops `./dist/sample.js`.

## Milestones

### M1: layout3D draws any recorded lens system GitHub: `P1193 M1: typed layout3D for lens systems`

Demo: `npm run gallery`: the achromat (the sample's recorded layout) and Cooke glasses 3D tiles in both themes beside
the base shots (`SHOTS=1 npx playwright test gallery-shots`, item 1's base in `review-assets`);
`PERF=1 npx playwright test perf -g layout3D` prints the median. Proves: O1, O2, O4 (lenses)

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1194 | O1, O2 acceptance tests, skipped; the 50-surface reference layout shared by the layout2D and layout3D perf tests; base gallery shots uploaded to `review-assets` | forced (`workflow.md`, TDD: the first item writes them skipped); the shots before item 3 changes the tile, because O4 compares against them | `tests/unit/layout3d.test.js`, `tests/perf.spec.js` | the two O1 tests, "layout3D redraw (U14)" |  |
| #1195 | `layout3dMesh(layout, { width })`: unprojected faces, each surface's profile (y ≥ 0 half) revolved, elements as runs of glass gaps with rims, a stop ring for an air-air stop, the image plane square at the image surface's `sd`; segments per surface `min(today's, budget / surfaces)` within a 3,500-face budget, full density for small systems; `project(p, view)` separate; the default view fits the rotated bounds into width × height, `scale` in px/mm overrides; a named error on anything but a RecordedLayout | mesh and projection apart because the face budget is tested without a view and O1 projects the same vertices; considered a mesh already projected, which couples both tests to one view | `packages/plots/src/layout3d.js`, `tests/unit/layout3d.test.js` | "revolved profiles project", "face budget at 50 surfaces" | #1194 |
| #1196 | layout3D draws the mesh: each distinct U12 fill resolved once per draw by a probe element in the canvas's subtree (computed `color`, painted 1 px, read back as RGB) and shaded by today's light; rays by layout2D's ray sets (`rays: "marginal-chief"` default, `"fan"`, `"chief"`, `false`), drawn through the first Dead point and never through a Virtual one, each air segment painter-sorted at its mid depth, segments in glass not drawn, at `--stroke-ray`'s width; the gallery's layout3D tile passes `data: sample.layout`; first flushed median recorded | export a `raySet(L, k, set)` and the status cut from `layout2d.js` because U3 and U17 define them; considered layout3D's own picker, a second definition. The probe because `glassFill` returns CSS that only the browser resolves; considered an OKLCH parser, which still cannot read `var()` | `packages/plots/src/layout3d.js`, `packages/plots/src/layout2d.js`, `gallery/index.html`, `tests/unit/layout3d.test.js`, `tests/unit/style-lint.test.js`, `tests/unit/field-order.test.js`, `tests/gallery.spec.js`, `tests/pixel-ratio.spec.js` | "rays sort with the faces", "dead and virtual cut", gallery.spec "layout3D rays over the image plane" (U22) | #1195 |
| #1197 | `Layout3DProps` typed (`data: RecordedLayout`, `rays`, `yaw`, `pitch`, `scale`, `width`, `height`), `<Layout3D data={layout} />`, the README section, a minor changeset: `layout3D(canvas, { data: layout, rays: "fan" })` draws; `layout3D(canvas, {})` throws `layout3D: pass { data: RecordedLayout }` | forced (core: `index.d.ts`, approved with this plan) | `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/Layout3D.svelte`, `packages/plots/README.md`, `packages/plots-svelte/README.md`, `.changeset/layout3d-typed.md`, `tests/types/layout3d.ts`, `tests/unit/types.test.js` | types.test.js "layout3d.ts" | #1196 |
| #158 reuse | `--stroke-ray`'s usage text: "Rays in 3D drawings." and a tokens patch changeset | the text follows item 3, which makes layout3D its one user; considered dropping the token, a breaking tokens release for a text fix | `packages/tokens/src/tokens.json`, `.changeset/stroke-ray-3d.md`, `tests/unit/tokens.test.js` | tokens.test.js "--stroke-ray usage" | #1196 |
| #1198 | Gallery: a layout3D tile on the Cooke glasses (`analysis-glasses.json`) | one new tile because O1 must show U12 fills and the sample has only crown and flint; considered a Wandersleb tile, whose elements are all `"crown"` | `gallery/index.html`, `tests/gallery.spec.js` | gallery.spec "layout3D glasses tile draws" (two distinct non-surface fills on the canvas, three browsers) | #1197 |
| #1199 | Unskip O1 and O2; record the U14 median in the Change log | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/layout3d.test.js`, `tests/perf.spec.js` | O1, O2 | #1194, #1195, #1196, #1197, #158, #1198 |

### M2: mirrors in 3D GitHub: `P1193 M2: mirrors, holes and obscurations in 3D`

Demo: the Cassegrain 3D tile in both themes, `layout3D(canvas, { data: cassegrain })`. Proves: O3, O4 (mirrors)

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1200 | O3 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/layout3d.test.js` | "mirror bodies revolve", "holes stay open" | #1199 |
| #1201 | A mirror's layout2D body (its y ≥ 0 polygon from `mirrorBodies`, exported) revolved, shaded `--mech`, open inside `hole`; an obscuration as an opaque disc | revolve the body layout2D already settles (the back's side, the hole's crossing, U17) because a second rule would let 2D and 3D disagree; considered building the body from the profile alone | `packages/plots/src/layout3d.js`, `packages/plots/src/layout2d.js`, `tests/unit/layout3d.test.js` | the O3 tests | #1200 |
| #1202 | Gallery: the Cassegrain 3D tile; unskip O3 | forced (`workflow.md`, TDD: the last item unskips them); the tile is O4's demo | `gallery/index.html`, `tests/gallery.spec.js`, `tests/unit/layout3d.test.js` | gallery.spec "layout3D cassegrain tile draws", O3 | #1201 |

### M3: the breaking minor GitHub: `P1193 M3: no sample, no kind`

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

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| 3,500 faces at 50 surfaces still misses 16 ms, or looks too coarse | O2 or O4 fails; kill criterion (WebGL) | item 2 tests the budget, item 3 records a flushed median (course check) |
| Revolved meshes look worse than today's sphere mesh | O4 rejected | M1 demo beside the base shots (course check) |
| The fill probe differs across browsers | wrong fills in WebKit or Firefox | item 6's tile test runs in all three |
| A moved adapter drifts from its baseline string | O5 fails late | item 12 runs split.test.js through the adapters before any removal |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-18 draft.
- 2026-11-18 round 1 (user): buckets confirmed (absorb [#158], [#139]; supersede [#125], [#639], [#424], [#132], [#133]; [#86] related). layout3D takes a RecordedLayout, revolved; O1's oracle changes to the closed-form projection of the recorded layouts plus U12's fill per glass (U10's oracle, changed by the user). throughFocus is typed, not removed. `./sample` and `eleo-plots-sample.js` are removed; the gallery loads sample.json itself.
- 2026-11-18 round 2 (user): meridional rays only. Mirrors, obscurations and annular holes are drawn in 3D (a Cassegrain 3D tile). Pre-mortem: "I don't think we're ready for a 1.0 release because no client has really used eleo-ui, so much of the API is untested in the real world", and "3D looks worse".
- 2026-11-18 round 3 (user): a breaking 0.x minor, not 1.0: 1.0 waits until a consumer has used the API (the roadmap's "major release" changes to this, the user's call). The 3D look is the user's approval at the M1 demo, today's screenshot beside the new tiles. One plan, not two rows. `sample.json` stays in place.
- 2026-11-18 critique (plan critic, claude-fable-5-1): 26 findings. Applied: 1 (sizes.js; `PLOT_SIZES.rayFan` kept), 2 (every breaking test in its item's Files), 3 (`record-renderers.mjs`), 4 (throughFocus tile in item 13), 5 (the existing tile switches in item 3), 6 (3,500-face budget, flushed timing, O1 at full density, face-count test), 7 (ray occlusion rule), 8 (fill probe), 9 (default framing, `scale` in px/mm), 10 (stop ring, Dead/Virtual cut), 11 (`colorBy` dropped from layout3D), 12 (throughFocus RMS, frame, unit, half), 13 (no literal version: PR 1143), 14 (two baseline entries recorded from the base), 15 (move only what the gallery draws), 16 (padded names in O5/O7; row J's exit reworded), 17 (items 16 and 17 split), 18 (types.test.js), 19 (named errors), 20 (fixture path), 21 (READMEs per item), 22 (gallery-shots), 23 (Core list), 24 (dist check), 25 (O2 recorded, not asserted; shared fixture), 26 (count; `sample-layout.mjs` deleted). Approach alternatives taken: item 2 (mesh and projection apart), item 3 (`raySet` export), item 9 (y ≥ 0 polygon), item 12 (classic script). Rejected: item 13's `cells[j] = { series }`, because nothing asks a cell for a title or stats and the old SVG has none. 22 items.

[#125]: https://github.com/ELEOptics/eleo-ui/issues/125
[#132]: https://github.com/ELEOptics/eleo-ui/issues/132
[#133]: https://github.com/ELEOptics/eleo-ui/issues/133
[#139]: https://github.com/ELEOptics/eleo-ui/issues/139
[#158]: https://github.com/ELEOptics/eleo-ui/issues/158
[#424]: https://github.com/ELEOptics/eleo-ui/issues/424
[#639]: https://github.com/ELEOptics/eleo-ui/issues/639
[#79]: https://github.com/ELEOptics/eleo-ui/issues/79
[#86]: https://github.com/ELEOptics/eleo-ui/issues/86
