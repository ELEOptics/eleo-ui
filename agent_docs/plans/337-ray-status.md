# Plan #337: Ray status in layout2D

Status: approved 2026-10-12
Branch: `plan/337-ray-status` PR: #348 Depends on: plan #284 (done) Roadmap: `agent_docs/roadmap.md`, row M

## Problem

phos draws the part of a ray after it stops being physical (aurora's `Virtual`, `Missed`, `Dead`) lighter and
dotted (ELEOptics/phos#310, the user: "a lower weight, dotted, line"). `layout2D` styles every ray alike, so
phos stacks a second `layout2D` layer of the non-alive tails with the same box and width (`layoutLayers` in
phos's `src/lib/prescription/layout.ts`) and deletes it on the plots release that closes #302. Row M draws
those tails in one call.

## Ground truth

- `layout2D` (`packages/plots/src/layout2d.js`) draws each picked ray as one `<polyline>` in a single
  `<g opacity=".85">`, stroke `idx(k)`, 1 px, the chief dashed `6 4` unless `rays: "chief"`; the axis is dashed
  `4 6`. `layout2d.test.js:716-731` asserts no `stroke-opacity` on any ray polyline (crossings don't darken).
  A glass polygon is drawn only for a surface with `glass` set and a next surface (`:106-110`).
- Rays are validated in `layout2D` (non-finite points only when boxed) and in `layoutBounds` (non-finite points),
  which name them differently (#136; `layout2d.test.js:606-608` expects `layoutBounds: layouts[0].rays[2][1] …`).
- `layoutBounds` frames every ray point; phos's box covers every point, dotted too.
- phos's semantics (`LayoutRay.ts`; `api.rs:607-619, 676-686`): each ray is cut at its first non-finite point
  (`map_while`), statuses are folded sticky, the solid layer is `points[0..c)` and the dotted
  `points[max(c - 1, 0)..]`, `c` the first non-alive index. A leading alive count per ray carries it.
- phos-core's Python client: `OpticalModel.visualize_system_2d(system, samples, num_rays)` →
  `ray_data.sources[k].rays[i].interfaces[j]` (`x`, `y`, `status`: `RayStatus.ALIVE`, `VIRTUAL`, `MISSED`,
  `DEAD_E`), and `system.elements[e].interfaces[i].points` (`Point2` lists, an `interface_type` string). aurora
  pushes every interface whatever the status, so a missed ray carries non-finite points (`visualize.rs:70-85`).
  The achromat and the Cooke keep every ray alive at their fields (probed 2026-10-12).
- The Wandersleb triplet (US 1,073,789, Carl Zeiss 1913, expired; phos `fixtures/triplet.toml`, with its stated
  assumptions) is ELEOptics/phos#310's lens: the 28° lower ray goes `Virtual` at S2, the 14° lower ray is
  vignetted. phos builds it with plano radius → `inf`, the plano stop typed `Aperture`, `image: Some(0.0)`
  (`phos/src-tauri/src/prescription.rs:241-266`). A first Python probe passed radius 0 as a real radius and
  killed every ray at S1. Python has `LensTable(image=…)`, `InterfaceType.aperture()`.
- `tests/unit/split.test.js` pins `layout2D`'s markup in `tests/fixtures/renderers-baseline.json`.
- `tests/unit/layout-size.test.js`: baseline 3278 B from row L's start; dist is 3405 B today.
- `tests/perf.spec.js` (`PERF=1`) has no `layout2D` measurement; U14's reference is 50 surfaces, 3 fields × 21 rays.
- Gallery: 20 tiles; `gallery/index.html:188-190` and `gallery.spec.js:60` hard-code the `achromat-` prefix.
- Prior art: no library; split polylines in the existing group. TOML through Python's stdlib `tomllib`.

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `RecordedLayout.alive?: number[][]` (leading alive points per `rays[field][ray]`) makes `layout2D` draw each ray's alive part solid and the rest, from its last alive point, dotted (`1 3`), in the same ray group; a layout without `alive` draws the same SVG as before for every ray point after the start (CR #381 moves collimated starts). The gallery draws the recorded Wandersleb triplet, its three lenses filled. | given the Wandersleb layout recorded by `scripts/record-phos-core.py`, when drawn with `rays: "fan"` at two widths, then for each ray with `0 < a < len` not marked `dead` the solid and dotted polylines share exactly its last alive point, and a `dead` ray is one solid polyline through its blocking point (CR #372) and together recover every point within 0.01 mm through the inverse transform; a ray with `a = 0` is one dotted polyline, with `a = len` one solid; at least one 28° ray has a dotted part; three glass polygons are drawn; the renderer baseline still holds | `fixture: phos-core visualize_system_2d of the Wandersleb triplet (US 1,073,789) recorded by scripts/record-phos-core.py` (user); `property: a layout without alive gives the same SVG for every ray point after the start` (tests/fixtures/renderers-baseline.json, re-recorded by CR #381); `user: the layout tiles in both themes and palettes` | `tests/unit/layout2d.test.js::recorded Wandersleb ray status round trip (U16)` |
| O2 | The typed API: `alive?: number[][]` on `RecordedLayout`. Bad `alive` and a non-finite ray point are named by `layout2D` itself, boxed or not (#136). | given `tests/types/layout2d-alive.ts`, when `tsc --strict` runs, then a layout with `alive` passes and `alive: [[true]]` fails; and `layout2D` without a box names `layout2D: fan 2 ray 1 has a non-finite point` | `spec roadmap Constraints (typed API alongside the old one)`; `spec #136` | `tests/unit/types.test.js::layout alive type-checks under --strict`, `tests/unit/layout2d.test.js::bad ray input is named by layout2D, boxed or not (#136)` |
| O3 | The release is planned: a plots minor. | given the branch, when `.changeset/ray-status.md` is parsed, then it is `{"@eleoptics/plots": "minor"}`; once consumed, its CHANGELOG entry | `spec roadmap Constraints; semver 0.x` | `tests/unit/release.test.js::ray-status changeset asks a plots minor` |

## Non-goals

- Virtual and Missed drawn differently: both stay dotted, as ELEOptics/phos#310 draws them. Dead is the exception: it stops at its blocking point, with no tail (CR #372, the user at the M1 demo).
- `layout3D`: row J. Panel fit and a ray-count input: phos's side of ELEOptics/phos#310.
- A plots-svelte change: `Layout2D.svelte` passes `data` through and takes its type from `index.d.ts`.
- The layout2D label hardening (#70, #125, #138, #139, #156, #160): deferred by the roadmap.

## Existing issues

| Issue | Bucket | Where or why |
| -- | -- | -- |
| #302 | absorb | the plan delivers it |
| #136 | absorb | reused as a work item in M2 (O2): the non-finite message moves from `layoutBounds` to `layout2D`, a user-visible rename named in the changeset |
| #70, #125, #138, #139, #156, #160 | related | layout2D hardening, deferred by the roadmap (2026-10-12) |

## Constraints and assumptions

- Roadmap constraints: typed alongside the old; every gallery tile keeps working (20 → 22, CR #352); `eleo-layout.js`
  within 2 kB of a baseline re-recorded at M's start; U14 for `layout2D`. Recorded fixtures: public lenses; the
  Wandersleb triplet joins the achromat and the Cooke (user, 2026-10-12).
- Assumption: phos-core's Python client, built as phos builds it, reproduces ELEOptics/phos#310's non-alive rays.

## Decisions

- Input: `alive?: number[][]`, `alive[k][i]` the number of leading alive points of `rays[k][i]` (after the
  cut at the first non-finite point), an integer in `0..len`; absent means every point alive. Named after aurora's
  `Alive`; phos maps its first non-alive index in one line (`c < 0 ? n : c`); considered phos-core's per-point
  statuses (four kinds drawn alike, a per-point enum in Core) and a new vocabulary (roadmap review finding 7).
- Drawing: a ray with `a < len` is two polylines in the ray group: points `[0, a)` as today, points
  `[max(a - 1, 0), len)` with `stroke-dasharray="1 3"` (25 % ink: lighter by its dash, no `stroke-opacity`, so
  `rays are 1 px at .85` holds and crossings don't darken; phos uses `1 4` today). `a = 0` draws one dotted
  polyline. A chief's dotted part replaces its `6 4` dash there; the M1 demo decides the chief's rule.
- Bounds: `layoutBounds` keeps every point, as phos's box does.
- Dead rays (CR #372): `dead?: boolean[][]` beside `alive`. A dead ray is drawn solid through point `alive` (where it was blocked) and stops there. Considered hiding the whole ray, dropping every tail, or a Cassegrain-only tile change.
- Mirrors (CR #360, CR #371): `mirror?`, `obscuration?` and `hole?` on `RecordedSurface`. A mirror is a body: the profile, a flat back at D/8 on the side away from the light, `--mech` fill with sparse hatching, and a `--mech-edge` outline. An annulus is drawn as two bodies. `layoutBounds` covers the bodies (#367).
- Ray starts (CR #381, the user: always on): a collimated fan's start points move along their first segments onto a line normal to the field, every field the same distance from the entrance pupil's centre, clearing the optics by 0.5 × the largest sd. A finite object keeps its starts. Mirror bodies are drawn over the rays. Considered a phos-core fix (a re-record, M1 waits) and an opt-in prop (old drawings stay as they were).
- Labels: a field label stays at its chief's last point, dotted or not.
- Core changes approved with the plan: `packages/plots/src/index.d.ts` (`alive?: number[][]` on
  `RecordedLayout`). The roadmap's U16 is edited to the approved wording (the last alive point; the Wandersleb
  fixture) in the plan commit.

## Milestones

### M1: The recorded Wandersleb triplet drawn with ray status (done 2026-10-30) GitHub: `P337 M1: Ray status`

Demo: before the first change the orchestrator screenshots main's gallery (both themes, three palettes) to
`review-assets`. At the demo, `npm run gallery` shows a new Layout2D tile of the Wandersleb triplet, its
non-alive tails dotted, in both themes and palettes; every other tile unchanged. Proves: O1

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #338 | O1 acceptance test, skipped; its own reader joins a ray's two polylines at the shared point (the existing `roundTrip` asserts one polyline per ray, `layout2d.test.js:91`); re-record `layout-size.test.js`'s `BASELINE` at M's start (#145's pattern) | forced (`workflow.md`, TDD); the baseline because the roadmap's budget is per row | `tests/unit/layout2d.test.js`, `tests/unit/layout-size.test.js` | `layout2d.test.js::recorded Wandersleb ray status round trip (U16)`, skipped; the size test green on the new baseline |  |
| #339 | `record-phos-core.py --only layout`: copies phos's `fixtures/triplet.toml` (with its source comment) to `tests/fixtures/phos-core/wandersleb.toml`, reads it with `tomllib`, builds the model as phos does (plano radius `inf`, `MaterialSpec.CONSTANT(name, index)`, `stop=4` (the TOML's 1-based 5), `FieldSpec.ANGLES([0, 14, 28])`, EPD 15.87, `image=0.0`, the stop typed `aperture()` if the table can't), records `visualize_system_2d` with 11 rays as a `RecordedLayout`: surfaces (`z` the profile's middle point as phos `layout.ts:13`, `sd` max \|y\|, 41-point `profile`, `stop` at position 4, `image` last, `glass: "crown"` after each lens's front surface else `null`; air-spaced, so no cemented dedup), each ray cut at its first non-finite point, `chief`, `alive` (first non-`ALIVE` index among the kept points, else `len`), the prescription and fields in the header; fixtures README. `python3 scripts/record-phos-core.py --phos <phos-core>/clients/python/src --only layout` → `wrote tests/fixtures/phos-core/wandersleb-layout.json (phos-core <sha>)`. Stop: the 28° lower ray isn't `VIRTUAL` at S2 or the 14° lower ray reaches the image, after matching phos's build | the uniffi client as for the other fixtures (user: wandersleb); the TOML copied, because one transcription of the patent serves the recorder and the test; considered constants in the script (a second transcription) | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/{wandersleb.toml,wandersleb-layout.json,README.md}`, `tests/unit/phos-core-fixtures.test.js` | `phos-core-fixtures.test.js::recorded Wandersleb layout is phos-core's trace of phos's triplet` |  |
| #340 | `layout2D` draws `alive` (Decisions) and validates it (shape matches `rays`, integers in `0..len`, named errors); `rays are 1 px at .85` extended to an `alive` layout; plots README layout section. Invocation: `layout2D({ data: { surfaces, rays: [[[[0,0],[5,1],[9,2]]]], alive: [[2]] }, rays: 'fan' })` → in the ray group a solid `<polyline points="0,0 5,1">` and `<polyline points="5,1 9,2" … stroke-dasharray="1 3">` | split polylines in the existing group, because each part inverts through the same transform and the group's opacity doesn't stack; considered a per-segment `<line>` (many marks, joins lost) and a sibling tails group at lower opacity (a second group for no reading the dash doesn't give) | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js`, `packages/plots/README.md` | `layout2d.test.js::alive splits a ray at its last alive point` (oracle: property: synthetic layouts; the parts share one point and recover the ray; `a = 0` and `a = len`; bad `alive` throws) | #338 |
| #341 | Gallery Wandersleb tile: `recorded(name, lens, file, draw)` and the loop's `[fixture, lens, tiles[]]` replace the `achromat-` prefix; `ELEOAdapters.layout(rec)` returns the `layout2D` props (`{ data: rec, rays: 'fan', width: 1000, labels: <the header's fields as °> }`, as `seidel` returns `bars` props), drawn `recTile('layout', ELEO.layout2D)`; `TILES` 21; `ownData` gains it | the classic-script adapter and `recTile` as for the other recorded tiles, because the labels come from the recording's header; considered drawing inline (the unit tests couldn't reuse the props) | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js::a missing phos-core fixture blanks only its tiles: wandersleb layout` (red first) | #339, #340 |
| #342 | Unskip O1 | forced (`workflow.md`, TDD) | `tests/unit/layout2d.test.js` | O1 | #338, #339, #340, #341 |
| #354 | CR #351: the O1 test calls `samePath`, not its own `startsWith` (review M1 r1 finding 1) | one comparator for one check, because the two bodies are identical; considered renaming `startsWith` | `tests/unit/layout2d.test.js` | O1 stays green (refactor) | #342 |
| #353 | Recorder hardening (review M1 r1 findings 4-6): fall back to the committed TOML when `--triplet` is missing, else a message; `tomllib` imported in `wandersleb()`; exit on an empty kept ray, and the fixture test asserts `ray.length > 0` | the review's named fixes, because each is one line in a file M1 changed; considered leaving them as backlog | `scripts/record-phos-core.py`, `tests/unit/phos-core-fixtures.test.js` | `phos-core-fixtures.test.js::recorded Wandersleb layout is phos-core's trace of phos's triplet` | #339 |
| #357 | CR #352: `record-phos-core.py --only layout` also records phos-core's tutorial Cassegrain (`models/src/example/cassegrain.rs`: f 500, EPD 100, annular primary 10..55, fields 0 / 0.35 / 0.5°, 1.55 µm) to `cassegrain-layout.json`, with `alive`; it exits unless the 0° chief is non-alive before the image | built in Python from that file's prescription (`MaterialSpec.MIRROR`, `Aperture.annular`, `insert_interface_direct`), because the client has no `cassegrain()` constructor; considered adding one to phos-core first (a cr if Python can't build it) | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/cassegrain-layout.json`, `tests/fixtures/phos-core/README.md`, `tests/unit/phos-core-fixtures.test.js` | `phos-core-fixtures.test.js::recorded Cassegrain layout obscures its axial chief` | |
| #361 | CR #360 (Core): `RecordedSurface` gains `mirror?: boolean` (`layout2D` strokes its profile) and `obscuration?: boolean` (an opaque bar at `z`, ±`sd`), documented; `tests/types/layout2d-mirror.ts` | forced (CLAUDE.md Core: `index.d.ts`; a test beside it, as #243); two flags, because a mirror is a curve and an obscuration a disc; considered one `kind` enum (a closed vocabulary for two cases) | `packages/plots/src/index.d.ts`, `tests/types/layout2d-mirror.ts`, `tests/unit/types.test.js` | `types.test.js::layout mirror and obscuration type-check under --strict` | |
| #362 | CR #360: the Cassegrain recording sets `mirror` on the primary and secondary and `obscuration` on the obscuration, written only when true (Wandersleb byte-identical) | the recorder reads the material and the aperture it built, because it knows them; considered inferring them in `layout2D` | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/cassegrain-layout.json`, `tests/fixtures/phos-core/README.md`, `tests/unit/phos-core-fixtures.test.js` | `phos-core-fixtures.test.js::recorded Cassegrain layout obscures its axial chief` | |
| #363 | CR #360: `layout2D` strokes a `mirror` profile and draws an `obscuration` as an opaque bar, under the rays; without the flags the baseline is byte-identical; plots README | in the geometry group as the glass polygons, because the same transform maps them; considered a separate optics group | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js`, `packages/plots/README.md` | `layout2d.test.js::mirrors are stroked and obscurations drawn opaque` | #361 |
| #358 | CR #352: `layout2D` draws the recorded Cassegrain's folded path, its 0° chief solid then dotted, its mirrors stroked and its obscuration opaque (CR #360); the parts recover every point within 0.01 mm at two widths | the Wandersleb round trip reused, because the drawing rule is the same; considered a synthetic folded layout (it doesn't show a real obscuration) | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::recorded Cassegrain stops its obscured chief at the obscuration` | #357, #362, #363 |
| #359 | CR #352: gallery tile `layout2D-cassegrain` after the Wandersleb tile; `TILES` 22 | the Wandersleb tile's path (`recorded`, `ELEOAdapters.layout`, `recTile`), because the adapter is lens-agnostic; considered a separate adapter | `gallery/index.html`, `tests/gallery.spec.js`, `tests/fixtures/phos-core/adapters.js` | `gallery.spec.js::a missing phos-core fixture blanks only its tiles: cassegrain layout` | #357, #358 |
| #365 | CR #364: `layout2d.js`'s header names `alive`, `mirror` and `obscuration`; review r2 finding 3: a profileless `mirror` throws a named error | the review's named fixes, because both are one line in a file M1 changed; considered a separate item each | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::mirrors are stroked and obscurations drawn opaque` | |
| #366 | Review r2 finding 5: the recorder checks the material and the aperture of each interface it flags, and exits on a mismatch | a guard on phos-core's element order, because the flags are set by position; considered trusting the fixture test alone | `scripts/record-phos-core.py` | the recording byte-identical at phos-core 580090e7 | |
| #369 | Review r3 finding 2: the recorder checks the recorded `surfaces` it flags (sd of the obscuration and of the primary) | the review's named fixes, because each is one line beside an M1 change; considered leaving them as backlog | `scripts/record-phos-core.py` | both recordings byte-identical at phos-core 580090e7 | |
| #373 | CR #371, #372 (Core): `hole?: number` on `RecordedSurface`, `dead?: boolean[][]` on `RecordedLayout`, documented; the mirror types file extended | forced (CLAUDE.md Core: `index.d.ts`; a test beside it); considered a status-kind enum per ray (three kinds for one drawing rule) | `packages/plots/src/index.d.ts`, `tests/types/layout2d-mirror.ts`, `tests/unit/types.test.js` | `types.test.js::layout mirror and obscuration type-check under --strict` | |
| #374 | CR #371, #372: the recordings carry `hole` (Cassegrain primary, 10) and `dead` (first non-alive status is Dead) | the recorder reads what it built and the statuses it traced; considered inferring `dead` in `layout2D` | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/wandersleb-layout.json`, `tests/fixtures/phos-core/cassegrain-layout.json`, `tests/fixtures/phos-core/README.md`, `tests/unit/phos-core-fixtures.test.js` | `phos-core-fixtures.test.js` (both recorded tests) | |
| #375 | CR #371: a mirror is a hatched `--mech` body with a flat back at D/8 away from the light, the hole open, no obscuration bar inside a body; `layoutBounds` covers bodies and every ray point (absorbs #367) | the user's mock A; the existing `mech` tokens, because they name mechanical parts and plots don't use them yet; considered a new mirror token | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js`, `packages/plots/README.md` | `layout2d.test.js::mirrors are drawn as bodies with a flat back` | #373 |
| #376 | CR #372: a `dead` ray is one solid polyline through its blocking point, no tail; validated; O1's and the Cassegrain test's readers follow | solid through the blocking point, because the Cassegrain's obscured rays have one alive point; considered stopping at the last alive point (draws nothing) | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js`, `packages/plots/README.md` | `layout2d.test.js::a dead ray stops at its blocking point` | #373, #374, #375 |
| #377 | CR #371: the mirror hatch spaced 32 px at render scale, as mock A (#375 used 8 px) | the user's mock, because they asked for light and sparse hatching; considered spacing in mm (varies with the drawing's scale) | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::mirrors are drawn as bodies with a flat back` | #376 |
| #379 | CR #378 (README hatch 32 px; `layoutBounds` comment) and review r5 findings 3-6 (validate `hole`; mirror direction from an alive ray; obscuration bar inside a hole kept; Cassegrain test renamed) | the review's named fixes, in the files M1 changed; one item, because the source comment needs a test beside it (the pre-commit hook); considered separate items | `packages/plots/src/layout2d.js`, `packages/plots/README.md`, `tests/unit/layout2d.test.js` | `layout2d.test.js::mirrors are drawn as bodies with a flat back` | |
| #380 | Review r6 findings 1, 2, 4: the mirror direction counts a dead ray's blocking point; it skips rays without an `alive` row; two wording fixes | the review's named fixes in a file M1 changed; considered leaving them as backlog | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::mirrors are drawn as bodies with a flat back` | |
| #382 | CR #381: collimated rays start on a pupil-centred arc, normal to each field, clear of the optics; mirror bodies over the rays; renderer baseline re-recorded | in `layout2D`, because for an object at infinity any point on the first segment is a valid start; considered phos-core's start plane (upstream, a re-record) | `packages/plots/src/layout2d.js`, `packages/plots/README.md`, `tests/unit/layout2d.test.js`, `tests/fixtures/renderers-baseline.json` | `layout2d.test.js::collimated rays start on a pupil-centred arc` | |
| #384 | CR #383 (baseline provenance in the recorder and split oracle; `layoutBounds` comment) and review r7 findings 2-4 (no-geometry guard; collimation decided over the layout; the oracle cites the PR's mock numbers) | the review's named fixes; one item, because each comment edit needs a test beside it; considered separate items | `packages/plots/src/layout2d.js`, `scripts/record-renderers.mjs`, `tests/unit/split.test.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::collimated rays start on a pupil-centred arc` | |

### M2: Types, #136, the redraw budget and the release GitHub: `P337 M2: Types and release`

Demo: `npm run test:unit`: the types test accepts `alive` and rejects `[[true]]`; `layout2D` names a bad ray
itself; the changeset plans a plots minor. `PERF=1 npx playwright test tests/perf.spec.js` prints the `layout2D`
median, written into the Change log. Proves: O2, O3

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #343 | O2 and O3 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/unit/types.test.js`, `tests/unit/release.test.js` | the tests, skipped | #342 |
| #344 | `index.d.ts`: `alive?: number[][]` on `RecordedLayout`, documented; `tests/types/layout2d-alive.ts`; O2's types test unskipped here | forced (CLAUDE.md Core: `index.d.ts`; the pre-commit hook needs a test beside it, as #243) | `packages/plots/src/index.d.ts`, `tests/types/layout2d-alive.ts`, `tests/unit/types.test.js` | O2 (types) | #343 |
| #136 reuse | `layout2D` names a non-finite ray point itself, boxed or not, before `layoutBounds`; `layout2d.test.js:606-608` updated; the header's shape literal gains `alive?: number[][]` (review M1 r3 finding 1, moved from #369) | the issue's named fix (O2), beside M1's `alive` validation; considered leaving `layoutBounds` to name it (two names for one input) | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::bad ray input is named by layout2D, boxed or not (#136)` | #343 |
| #345 | U14 for `layout2D` (50 surfaces with 41-point profiles built in the page, 3 fields of 21 rays, half with a dotted tail) | forced (roadmap Constraints: U14 for the renderers a row touches; the existing spec's method, `perf.spec.js:1-3`). Stop: a median over 16 ms is reported | `tests/perf.spec.js` | `perf.spec.js::layout2D redraw (U14)` | #343 |
| #346 | Changeset: plots minor; its body names `alive`, the chief's dotted tail and #136's message move; its consumed twin | forced (CLAUDE.md: a changeset per user-facing change; #279's twin; `.changeset/bars-limits.md` the model) | `.changeset/ray-status.md`, `tests/unit/release.test.js` | O3 | #343 |
| #347 | Unskip O2's #136 test and O3 | forced (`workflow.md`, TDD) | `tests/unit/layout2d.test.js`, `tests/unit/release.test.js` | O2, O3 | #343, #344, #136, #345, #346 |
| #386 | Review M2 r1 findings 1-3: the U14 benchmark's fans are collimated so `movedStarts` runs (re-measured); the release twin matches a phrase unique to this changeset, with its dead assert gone; the header literal gains `dead?` | the review's named fixes; one item, because the source comment needs a test beside it; considered three items | `tests/perf.spec.js`, `tests/unit/release.test.js`, `packages/plots/src/layout2d.js` | `perf.spec.js::layout2D redraw (U14)` | |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| phos-core's Python client doesn't reproduce the triplet's non-alive rays | O1's fixture has nothing to show | the recorder item matches phos's build and checks two of ELEOptics/phos#310's facts; its stop goes to the user |
| A dotted chief reads as a marginal | the demo misreads fields | the M1 demo decides the chief's rule |
| `layoutBounds` counting virtual points widens the box | the drawing shrinks | the recorded box checked at M1; phos already uses all points |

## Change log

- 2026-10-12 (user): U16's oracle is the recorded Wandersleb triplet (US 1,073,789), adding a third public lens to the fixtures; approved as worded in O1 (the parts share the last alive point, as phos draws them).
- 2026-10-12 headless: scope from roadmap row M, absorbing #302 and #136 (row: Choose, add or reorder rows). Input shape `alive?: number[][]`, bounds over every point, a dotted chief and dash-only tails decided under the same row.
- 2026-10-12 (user): plan approved; publish without starting work.
- 2026-10-12: critique (general-purpose, claude-fable-5-1), all 22 findings applied: crown fills; dash-only tails (no `stroke-opacity`); rays cut at the first non-finite point; phos's build and two ELEOptics/phos#310 facts as the recorder's stop; the prescription in the header and checked against the TOML; O1 wording for `a = 0` and `a = len`; U16 reworded in the roadmap; #136 in O2; U14 cell; themes and palettes; the `achromat-` prefix; the adapter returns props; the size baseline re-recorded; the recorder's surface mapping; the changeset's body; `ELEOptics/phos#310`; O1's own reader; the TOML copied with `tomllib`.
- 2026-10-12 #349 (user): accepted, fix phos-core first. phos-core's Python client saves `MaterialSpec.CONSTANT` glasses into a cloned config, so `visualize_system_2d` kills every Wandersleb ray at S1; the fix (private glasses resolvable in analyses, the stop's interface type) lands in ELEOptics/phos-core, and #339 waits on it, then runs unchanged.
- 2026-10-29: #339's row repaired (an unescaped `|` had dropped its Files and Test cells); stop at position 4, the TOML's 1-based 5 (worker, a535935). ELEOptics/phos-core#495 closed by ELEOptics/phos-core#1813, so #339 ran at phos-core 580090e7. Recorded: the on-axis marginal rays go `VIRTUAL` at the stop's rim (phos-core numerics), so their tails will show dotted at the M1 demo.
- 2026-10-29: review M1 round 1 (2 blocking, 5 backlog). CR #351 accepted (item #354). CR #352 (no non-alive chief in the recording) is queued for the user. Findings 4-6 pulled in as #353. Findings 3 and 7 are backlog #355 and #356.
- 2026-10-29 CR #352 (user): "Use an on-axis Cassegrain system, where the chief ray is typically vignetted by the central obscuration." Accepted as items #357, #358 and #359 from phos-core's tutorial Cassegrain. The M1 demo decides the chief's rule on its tile, and the gallery goes from 21 to 22 tiles.
- 2026-10-29 CR #360 (user): `mirror`. Optional `mirror?` and `obscuration?` on `RecordedSurface` (Core, approved through the CR), as items #361, #362 and #363; #358 now runs after them and asserts the optics drawn. M2's changeset (#346) names the two flags too.
- 2026-10-29: review M1 round 2 (1 blocking, 5 backlog). CR #364 accepted, with finding 3, as item #365. Finding 5 pulled in as #366. Finding 6: this file's Constraints line now reads 20 → 22. Findings 2 and 4 are backlog #367 and #368.
- 2026-10-30: review M1 round 3 (0 blocking, 2 backlog). Both findings pulled in as #369. Carried CRs #349, #351, #352, #360 and #364 all closed.
- 2026-10-30: #369 re-scoped to the recorder guard (566e4da). Review r3 finding 1 (`alive?` in `layout2d.js`'s header literal) moved to #136: the pre-commit hook refuses a source change without a test, and #136 edits `layout2d.js` with its test.
- 2026-10-30: M1 done. Review round 4 says 0 blocking with nothing pulled in (its one finding, a speculative guard gap, is backlog #370); CI green on 2a3a54e.
- 2026-10-30 M1 demo (user): no-go. "I like option A the best" (mirror bodies, mocks on the PR), with the primary's hole and suggestions 2-5 → CR #371. "we should not show the vignetted rays", clarified as "Dead tails only" → CR #372. Items #373, #374, #375 and #376; #367 absorbed. M1 unticked until the re-demo.
- 2026-10-30: #375's hatch (8 px, the orchestrator's spec) is denser than mock A; item #377 sets it to 32 px.
- 2026-10-30: review M1 round 5 (2 blocking, 4 backlog). CR #378 accepted. Findings 3 to 6 pulled in with it as #379. Carried CRs #371 and #372 closed.
- 2026-10-30: review M1 round 6 (0 blocking, 4 backlog). Findings 1, 2 and 4 pulled in as #380. Finding 3 (`index.d.ts` wording, Core) added to M2's #344. All carried CRs closed. The user's ray-start feedback is mocked and awaits a decision.
- 2026-10-30 (user): ray starts "layout2D, as mocked", scope "Always on" → CR #381, item #382. O1's byte-identical property reworded to "after the start", and the renderer baseline is re-recorded.
- 2026-10-30: #382's collimation tolerance is 1e-3 rad, not the CR's 1e-6: the recordings round to 4 decimals (the orchestrator's spec error).
- 2026-10-30: review M1 round 7 (1 blocking, 3 backlog). The O1 Outcome cell and roadmap U16 reworded to "after the start" (the user's CR #381 choice). CR #383 and findings 2 to 4 → #384. All carried CRs closed.
- 2026-10-30: M1 done again. Review round 8 says 0 blocking with nothing pulled in (its one finding is backlog #385); CI green on 1d47126. Re-demo requested.
- 2026-10-30 M1 demo (user): go. On field labels at the image plane: "A standard legend may be the right call, but at this level (3 fields) I'm okay with it", added to #70 (deferred label hardening).
- 2026-10-30: U14 layout2D redraw median 2.10 ms (20 redraws; 50 surfaces with 41-point profiles, 3 fields of 21 rays, half dotted; budget 16 ms). Same run: curve 1.30, panels 0.90, spot 3.20, bars 1.20 ms.
- 2026-10-30: review M2 round 1 (0 blocking, 3 backlog). All three pulled in as #386. The 2.10 ms U14 median did not run the collimated-start path, so it is re-measured there.
- 2026-10-30: U14 layout2D re-measured on the collimated path (#386, starts moved, zmin -5.38): median 2.20 ms (runs 2.30, 2.20, 2.20; budget 16 ms). It replaces the 2.10 ms above, which skipped movedStarts.
