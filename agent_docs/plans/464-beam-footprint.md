# Plan #464: Beam footprint through spot

Status: approved 2026-11-01
Branch: `plan/464-beam-footprint` PR: #470 Depends on: none Roadmap: `agent_docs/roadmap.md`, row N


## Problem

phos-core's Python client gained BeamFootprint on 2026-10-30 (ELEOptics/phos-core#440), but no gallery tile
shows a footprint, so U7 is not proven on phos-core's own footprint results. Row N records one through
`scripts/record-phos-core.py` and draws it with `spot`. The recorded ray fans (also row N's scope) are split
out (user, round 2): phos-core's TransverseRayError uses a dead ray's last location as its error, so they wait
on a phos-core fix in a new row, recorded-fans.

## Ground truth

- `spot` typed path (`packages/plots/src/spot.js:15-58`, types `index.d.ts:74-113`) already turns stats
  (`showStats:false`) and the Airy circle (`showAiry:false`) off. `unit` is free text, `origin` names the
  zero point in the caption, and `label` sets the aria-label. Its only circle is the per-panel `airy`,
  captioned "Airy radius". `reference` already means the recentring mode (`"chief" | "centroid"`), so the
  roadmap's "semi-diameter as `reference`" needs a new field.
- phos-core client (`clients/python/src/phos/phos.py`, HEAD 755ce49e):
  - `BeamFootprintSettings` has `set_sources` and `set_pupil_sampling` (default 32×32).
  - `run(model)` returns one result per source. `locations(step)` gives global `[x,y,z]` in mm and
    `statuses(step)` gives each ray's status. Both are in emission order, wavelength by wavelength.
    Interface k is `step = k+1`.
  - The result carries no semi-diameter. `Interface.aperture().extent()` and `.normalization()` give it
    (`max(w, h, 2·norm)/2`, Rust `components/src/aperture.rs:404`).
  - The stop index comes from `system(0).aperture_stop_index()`, and the pose from
    `Interface.location()` / `.rotation()` (`[i, j, k, w]`, `uniffi/src/uniffi_types.rs:218`, as the
    recorder already reads it at :70-72). `CoordinateFrame` (`uniffi/src/tools.rs:51`) built from them
    maps global points to the surface's local frame (`inverse_transform_point_*`, `phos.py:6983`).
  - The Cooke stop (interface 2, `models/src/example/cooke_triplet.rs:72-84`) is an Optical interface with an
    auto-sized aperture that does not clip (`components/src/interface.rs:575-577`). Its semi-diameter comes
    from the on-axis marginal ray (`system.rs:396-404`), and the off-axis fields are ray-aimed onto the rim,
    so rim points can sit a ray-aiming tolerance outside it (critic, finding 3).
  - `extent()` returns a `Rectangle` record with `.width`/`.height` fields (`phos.py:15067`).
- `TransverseRayError` (`analyses/src/transverse_ray_error.rs:200-213`) uses every ray's last location, dead
  ones included, so a vignetted sample gives a false fan point.
- Recorder (`scripts/record-phos-core.py`, 574 lines):
  - Output is one `<lens>-<analysis>.json` per lens and analysis, with a camelCase header and
    `sources: [{fieldAngleDeg, …}]`.
  - CLI: `--only {seidel,layout,maps}`, and `--triplet` for the Cooke triplet
    (`OpticalModel.cooke_triplet_kingslake()`).
  - Guards are tested from Node with fake `phos` objects (`tests/unit/phos-core-fixtures.test.js:245, :362`).
  - The achromat's stop is surface 0 (its front face); the Cooke triplet's stop is interior.
- Adapters: `tests/fixtures/phos-core/adapters.js` (a classic script, `ELEOAdapters`; the spot adapter is at
  :51-67). Gallery tiles are in `gallery/index.html`, through `recorded(name, lens, file, draw)` (:221-252)
  and `recTile` (:105). phos-core's `clients/plots/adapters.mjs` was adapted from ours and reads its own
  snake_case `plots_json` records, none of which is a footprint.
- Tests to touch:
  - `tests/unit/spot.test.js`: U7 round trip :20, "Airy circle toggled and labelled" :226, captions :244.
  - `tests/unit/types.test.js:29`.
  - `tests/unit/phos-core-fixtures.test.js`.
  - `tests/gallery.spec.js`: `TILES = 26` :6, missing-fixture loop :56, `ownData` :112.
  - `tests/unit/release.test.js`: changesets run only in a temp workspace (:5-7); the #41 pattern
    (:160-205) parses named `.changeset/*.md` files and plans them with `withWorkspace`.
  - `tests/types/panels.ts`, the file `types.test.js:29-33` compiles.
  - `tests/unit/split.test.js` no longer covers spot (:18).
- Versions and release: plots 0.7.0 is on npm. plots-svelte 0.4.0 peers `>=0.5.0 <1`
  (`packages/plots-svelte/package.json:27`), with its README note at `packages/plots-svelte/README.md:29`.
  `.changeset/` has no pending changesets. `SpotDiagram.svelte` passes props straight through.

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 (U7) | `spot` draws a recorded beam footprint: the Cooke triplet stop's alive rays in its local x/y (mm), a series per field, its semi-diameter as a labelled circle, stats and Airy off; the gallery has a footprint tile. | given `cooke-footprint.json` / when the adapter's call is drawn at the SIZES, common and auto scale / then inverting the panel's transform recovers every alive point within 0.5 px, the circle's radius equals the recorded semi-diameter within 0.5 px, and no point lies more than 1e-4 × the semi-diameter outside it | `fixture: recorded phos-core BeamFootprint of the Cooke triplet (scripts/record-phos-core.py)` (U7's oracle, row N) | `tests/unit/spot.test.js::recorded footprint round trip (U7)` |
| O2 | The release is planned. | given `.changeset/footprint-circle.md` and `.changeset/plots-svelte-peer-0.7.md` / when parsed and planned in a temp workspace (`withWorkspace`, the #41 pattern, `release.test.js:160-205`) / then they bump only plots (minor) and only plots-svelte (patch), and plots-svelte's peer is `>=0.7.0 <1` | `spec: @changesets/cli's plan of the named files; #457` | `tests/unit/release.test.js::row N changesets` |

## Non-goals

- Recorded ray fans: next row, recorded-fans, which waits on ELEOptics/phos-core#2142 (user, round 2).
  U6's oracle change moves with it.
- A typed `rayFan` API (row J).
- OPD fans on recorded data: TransverseRayError has no OPD.
- A tile for a rotated or decentred surface: the recorder handles one through `CoordinateFrame`, but the
  gallery shows only the Cooke stop.
- A footprint of the achromat: its stop is its front face, so the footprint is just the pupil.
- A footprint perf case in `tests/perf.spec.js`: U14 is re-measured on the existing spot case.

## Existing issues

| Issue | Bucket | Where or why |
| -- | -- | -- |
| #269 | absorb (reuse) | spot hardening, in `spot.js`, which this plan edits (user, round 1) |
| #278 | absorb (reuse) | spot label formatter, in `spot.js`; the circle's caption uses `sig3` (user, round 1) |
| #457 | absorb (reuse) | plots-svelte peer `>=0.7.0 <1`, README note, patch changeset (user, round 1) |
| #263 | related | curve/spot shared predicate: a refactor across two renderers that N doesn't need |
| #281 | related | perf harness, untouched |
| #355 | related | Wandersleb fixture, untouched |

## Constraints and assumptions

- A1: local x/y come from `CoordinateFrame(location(), rotation())`'s inverse transform (critic, finding 13),
  not a hand-built vertex subtraction.
- A2: BeamFootprint's `step` for interface k is k+1 (verified, `uniffi/src/beam_footprint.rs:27-28`). The
  recorder writes each source's `maxRadius` and refuses one above `semiDiameter × (1 + 1e-4)`, a ray-aiming
  tolerance, since the Cooke stop doesn't clip (critic, finding 3).
- The roadmap's U14 constraint: spot's redraw median is re-measured at the milestone's end
  (`PERF=1 npx playwright test tests/perf.spec.js -g "spot redraw"`) and logged here.
- U4's standalone entry is untouched (spot is not in it).
- A spot call without `circle` (absent or `undefined`) draws the same markup as today, asserted in
  `spot.test.js::labelled circle` as `:236` does for Airy.

## Decisions

- ADR-0001 (styling rule): the circle takes a label, never a color or stroke; it draws in the Airy circle's
  style.
- Core change approved with this plan: `packages/plots/src/index.d.ts` gains
  `SpotPanel.circle?: { radius: number; label: string }` (user, round 1).

## Milestones

### M1: Beam footprint tile and release GitHub: `P464 M1: Beam footprint tile`

Demo: `npm run gallery`, the new footprint tile (Cooke triplet stop, three fields, a "Semi-diameter …
mm" circle) in both themes and palettes. Then `npx changeset status` shows a plots minor and a plots-svelte
patch. Proves: O1, O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #465 | O1 and O2 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/spot.test.js`, `tests/unit/release.test.js` | `spot.test.js::recorded footprint round trip (U7)`, `release.test.js::row N changesets` |  |
| #466 | `SpotPanel.circle {radius, label}`: drawn like the Airy circle, counted in the half, one caption line `<label> <r> <unit>` (shared like the Airy line when every panel's radius agrees); plots minor changeset | new field because `airy` is captioned "Airy radius" and `reference` is the recentring mode; considered reusing `airy` with a caption override (an Airy field that isn't Airy) (user) | `packages/plots/src/spot.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `tests/types/panels.ts`, `.changeset/footprint-circle.md` | `spot.test.js::labelled circle`, `types.test.js::panels and spot points type-check under --strict` | #465 |
| #269 reuse | spot: a subnormal half or extent gives a finite scale | forced (#269's named fix) | `packages/plots/src/spot.js` | `spot.test.js::typed spot hardening` | #466 |
| #278 reuse | spot: label formatter exponent edge cases | forced (#278's named fix) | `packages/plots/src/spot.js` | `spot.test.js::caption lines and stats labels` | #269 |
| #467 | Recorder `--only footprint`: the Cooke triplet's stop, per source `{fieldAngleDeg, wavelengths, points[w][[x,y]]}` (alive rays, local mm), `maxRadius`; header `surface`, `semiDiameter`; guards refuse no stop, a zero or non-finite semi-diameter, and A2; branches before the two-lens loop (as `layout` does, :537), extends `choices` (:526) and the docstring; guard fakes for `aperture().extent()/.normalization()`, `location()`, `rotation()`, `system().aperture_stop_index()`, and a `BeamFootprint` with `locations/statuses/num_steps`, in the `:362-375` shape; fixture recorded | `python scripts/record-phos-core.py --phos <path> --only footprint` writes `tests/fixtures/phos-core/cooke-footprint.json` (a guard prints e.g. `footprint: alive point 1.2e-3 beyond the semi-diameter`), camelCase like every fixture (user); considered snake_case `plots_json` keys (phos-core has no footprint record to match) | `scripts/record-phos-core.py`, `tests/unit/phos-core-fixtures.test.js`, `tests/fixtures/phos-core/README.md`, `cooke-footprint.json` | `phos-core-fixtures.test.js::footprint shape`, `::footprint recorder guards` |  |
| #468 | Adapter `footprint(d)` and gallery tile `footprint`: one panel, a series per field (index = field) at the reference wavelength, `unit:'mm'`, `origin:'stop vertex, local x/y'`, `circle:{radius: semiDiameter, label:'Semi-diameter'}`, `showStats:false`, `showAiry:false`, `label:'Beam footprint'` | one panel because every field fills the stop and the overlap is the point (user); considered a panel per field | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js`: `TILES` 27 (:6), `['footprint', 'cooke', ['footprint']]` in the missing-fixture loop (:56), `footprint` in `ownData` (:112) | #466, #467 |
| #457 reuse | plots-svelte peer `>=0.7.0 <1`, README's "needs plots ≥ 0.7.0" note dropped, patch changeset | forced (#457's named fix) | `packages/plots-svelte/package.json`, `packages/plots-svelte/README.md`, `.changeset/plots-svelte-peer-0.7.md` | `release.test.js` | #465 |
| #469 | Unskip O1 and O2; spot's U14 median logged in the Change log | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/spot.test.js`, `tests/unit/release.test.js` | O1, O2 | all above |
| #472 | CR #471: the plots README's `scale` bullet counts `circle.radius` in the half and the caption's unit | forced (CR #471's named fix, review M1 round 1 finding 1) | `packages/plots/README.md` | none (doc; the CR's example checked against `spot`) |  |
| #473 | spot: a value below 1e-100 prints as `0` | forced (review M1 round 1 finding 2's named fix, pulled in); considered stripping trailing zeros in `plain` (the half label already does) | `packages/plots/src/spot.js` | `spot.test.js::caption lines and stats labels` |  |
| #474 | spot: the circle caption shares a line only when every label agrees, and skips an empty label | forced (review M1 round 1 finding 3's named fix, pulled in) | `packages/plots/src/spot.js` | `spot.test.js::labelled circle` | #473 |
| #475 | recorder: the `--only layout` and `footprint` branches share their outdir lines | forced (review M1 round 1 finding 4's named fix, pulled in); considered an `out_dir(args)` helper | `scripts/record-phos-core.py` | `phos-core-fixtures.test.js` (unchanged, green) |  |
| #477 | CR #476: the plots README's `panels` bullet states the circle caption's label rule | forced (CR #476's named fix, a stale doc #474's worker noticed) | `packages/plots/README.md` | none (doc; checked against `labelled circle`) | #474 |
| #479 | spot: an empty, missing or whitespace circle label adds no caption line, shared or not | forced (review M1 round 2 findings 2 and 3, pulled in as one item: the same rule); considered rewording the README instead of the code | `packages/plots/src/spot.js` | `spot.test.js::labelled circle` |  |
| #481 | CR #478 and CR #480: `SpotPanel.circle`'s JSDoc and the README's `panels` bullet state one caption rule | forced (CR #478, accepted by the user; CR #480, a stale doc from #479); one item because both docs state the same rule | `packages/plots/src/index.d.ts` (core, JSDoc only), `packages/plots/README.md`, `tests/unit/spot.test.js` | `spot.test.js::circle caption rule stated alike in index.d.ts and README` (the pre-commit hook needs a test with `index.d.ts`) | #479 |
| #484 | CR #483: `legend('field' \| 'wavelength', n, values)` takes explicit angles or wavelengths | library, not gallery-only, so any app with recorded data draws the same keys (user, CR #483); considered building `eleo-key` spans in the gallery | `packages/plots/src/legend.js`, `packages/plots/src/index.d.ts` (core, CR #483), `packages/plots/README.md`, `.changeset/footprint-circle.md`, `tests/unit/legend.test.js` | `legend.test.js::field and wavelength keys take explicit values` |  |
| #485 | CR #483: the footprint tile's footer legend from the fixture's field angles | forced (CR #483); the footer like the other field-colored tiles | `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js`: footprint legend keys | #484 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| Rim rays ray-aimed just past the auto semi-diameter | O1's containment fails | A2's 1e-4 relative tolerance; `maxRadius` recorded so the margin is visible |
| `CoordinateFrame`'s constructor or transform is awkward from Python | local frame by hand | fall back to vertex subtraction plus a refusal unless `rotation() == [0,0,0,1]` |
| Stop semi-diameter not set on the Kingslake triplet (aperture unbounded) | no circle | the recorder refuses a non-finite or zero semi-diameter; then a CR (the circle from the marginal ray height) |

## Publish extras (approved with the plan)

- Filed ELEOptics/phos-core#2142: TransverseRayError should expose each sample's ray status (citing
  `analyses/src/transverse_ray_error.rs:200-213`) (user, round 2).
- Add roadmap row recorded-fans (`later`, waits on ELEOptics/phos-core#2142): `--only fans` for the achromat and the Cooke
  triplet, a fans adapter to `curve` panels, the gallery's ray fan tile on the recorded achromat, and U6's
  fixture oracle for the ray fans moved from `sample.json` to recorded TransverseRayError. Row N's scope and
  U7's Plan column are trimmed to match ("semi-diameter as `reference`" becomes "as `circle`"), and U6's
  Plan column swaps N for recorded-fans.

## Change log

- 2026-11-01 draft from roadmap row N.
- 2026-11-01 round 1 (user): buckets confirmed (absorb #269, #278, #457; related #263, #281, #355); new
  `SpotPanel.circle {radius, label}`; fixtures in our camelCase format; footprint = Cooke stop, one panel, a
  series per field at the reference wavelength.
- 2026-11-01 round 2 (user): TransverseRayError's dead rays: file an issue in phos-core and block the fans
  until it's fixed; fan tile on the achromat (for the later row).
- 2026-11-01 round 3 (user): split the fans into a new row, recorded-fans; file the phos-core issue at publish.
- 2026-11-01 critique (Fable): applied findings 1 (split.test.js doesn't cover spot), 2 (O2 through the #41
  temp-workspace pattern), 3 (ray-aiming tolerance, `maxRadius`), 4 (quaternion order known), 6 (branch
  before the lens loop), 7 (roadmap wording), 9 (`tests/types/panels.ts`), 10–12 (named gallery entries,
  U14 invocation, guard fakes), 13 (`CoordinateFrame` instead of the vertex subtraction). Rejected 14
  (merge #269 and #278): `workflow.md`'s one commit per work item keeps each issue's history apart.
- 2026-11-01 approved (user); published: plan issue #464, milestone P464 M1, work items #465–#469, #269, #278, #457 reused; ELEOptics/phos-core#2142 filed.
- 2026-11-02 M1 end: U14 re-measured, spot redraw median 3.30 ms (`PERF=1 npx playwright test tests/perf.spec.js -g "spot redraw"`); O1 and O2 unskipped and green.
- 2026-11-02 review M1 round 1: 1 blocking, filed as CR #471 and accepted by the orchestrator (a non-Core doc), fixed by #472; backlog findings 2–4 pulled into M1 as #473, #474, #475 (small, named, in files M1 changed).
- 2026-11-02 stale doc from #474's worker (`packages/plots/README.md:157`): CR #476, accepted by the orchestrator (a non-Core doc), fixed by #477.
- 2026-11-02 review M1 round 2: CRs #471 and #476 fixed; 1 blocking on Core `index.d.ts` (the `circle` JSDoc after #474), filed as CR #478 for the user; backlog findings 2 and 3 pulled in as #479.
- 2026-11-02 CR #478 accepted (user); stale doc from #479's worker (README:157, blank labels) filed as CR #480, accepted by the orchestrator; both fixed by #481.
- 2026-11-02 review M1 round 3: 0 blocking; CRs #471, #476, #478, #480 fixed; backlog #482 (row #481 omitted its test) fixed in the plan table here, nothing pulled in.
- 2026-11-02 M1 demo (user): no-go, "The field legend needs to exist." Filed CR #483, M1 unticked; the user chose the library option (`legend` takes explicit values, Core `index.d.ts`): items #484, #485.
