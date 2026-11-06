# Plan [#642]: Ray status per point and visibility in layout2D

Status: approved 2026-11-05
Branch: `plan/642-ray-visibility` PR: [#652] Depends on: none Roadmap: `agent_docs/roadmap.md`, row Q

## Problem

`layout2D` knows a ray's status only as `alive[f][r]`, one count of leading alive points, and `dead[f][r]`, how the ray ends
(user, 2026-11-01). A ray that goes Alive, Virtual, then Dead loses its virtual part, and no caller can switch a kind of
segment off: phos wants to hide the obscured rays of a Cassegrain while a model where virtual rays are expected keeps
them. The recorder already computes every point's status and throws it away.

## Ground truth

- **layout2D** (`packages/plots/src/layout2d.js:228-241`): per drawn ray, `a = alive[k][i]` (or its length). A dead ray is one
  polyline `r[0..a]` (the chief keeps `6 4`); otherwise `r[0..a)` solid and `r[a-1..)` dotted `1 3`. Every polyline has the same
  attributes but `points` and the dash, inside one `<g opacity=".85">`. Validation of `alive` and `dead` at `:159-177`.
  `layoutBounds` reads every ray point, whatever its status (`:128`), so hidden segments already count toward the box.
  `mirrorBodies` (`:40-61`) reads `alive`/`dead` to find the light's direction past a mirror.
- **Types** (`packages/plots/src/index.d.ts:31-58`, Core): `RecordedLayout.alive?`, `dead?`; `Layout2DProps` has no `show`.
  `tests/unit/types.test.js` type-checks one named `tests/types/*.ts` file per test under `tsc --strict` (`:14`, `:50`, `:59`).
- **Svelte**: `packages/plots-svelte/src/lib/Layout2D.svelte:9` spreads its props into `layout2D`, so `show` passes with no edit.
- **Recorder** `scripts/record-phos-core.py:316-344` `layout_rays`: keeps each ray's points up to the first non-finite one,
  computes `status` per interface (class names `ALIVE`, `VIRTUAL`, `DEAD_E`, ...) for its own checks, and writes only `alive`
  and `dead`. `status_name()` (`:597`, row P) maps the client's classes to the Rust names Alive, Virtual, Missed, Dead.
- **Fixtures** `tests/fixtures/phos-core/{wandersleb,cassegrain}-layout.json`, phos-core `580090e`. Wandersleb: 9 points a ray;
  alive counts 5 (on-axis marginals, the stop-rim `VIRTUAL`, [#355]), 2 (the 28° lower ray), one dead ray (14° lower). Cassegrain:
  5 points a ray, rays 4-6 of each fan dead at point 1 (the obscuration) with points 2-4 still finite.
- **Gallery** `gallery/index.html:46-47`: the Wandersleb and Cassegrain tiles through `recTile` and `adapters.layout`
  (`tests/fixtures/phos-core/adapters.js:116`, `rays: 'fan'`, labels from `fieldsDeg`). Since plan [#603] the gallery is one tile
  per line, each tile's floor from `ELEO.minWidth`; U18's gallery test enumerates tiles from the page, but `tests/gallery.spec.js:6`
  hand-keeps `TILES = 27`, `ownData` (`:173`) lists the tiles that must draw, and `:54-66` the tiles each missing fixture blanks.
  `REC.fans` is the adapter's output and keeps no wavelengths (`gallery/index.html:286`).
  `tileMin` special-cases `rayFan` (`:203`, [#617]); the recorded fan tile's footer is the fixed T/S key (`:231`, [#616]).
- **Tests**: `tests/unit/layout2d.test.js:821` (Wandersleb status round trip, U16), `:1014` (Cassegrain), `:868`, `:908`; both U16
  tests assert a dead ray is one polyline (`:836`, `:1031`) and `drawnStarts` (`:1079-1087`) counts one polyline per dead ray;
  `tests/unit/phos-core-fixtures.test.js:147`, `:192`.
- **Docs**: `packages/plots/README.md:36-46` (`alive`, `dead`); `tests/fixtures/phos-core/README.md:26-27`.
- **Baseline**: `scripts/record-renderers.mjs:20-27` already records `layout2D` on the sample and the website's merit and glasses
  layouts at 1000 px, and `tests/unit/split.test.js` asserts each entry byte for byte (plan [#162] O2).
- **Release**: a plots minor through a changeset; `tests/unit/release.test.js` checks each row's changesets.
- **Probe** (2026-11-05): the local phos-core client is out of date with its bindings and will not load, so the per-point
  statuses are not known yet. The recording item builds the client at `580090e` in a scratch clone.
- **Prior art**: nothing to adopt. The input is a per-point enum array and the drawing is grouping runs; no library does
  that better than a loop.

## Outcomes

Oracle: where the expected values come from, `<kind> <source>` (`agent_docs/agents/workflow.md`, Oracles).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `layout2D` draws each kept point's recorded status: each segment in its end point's status's style, a ray drawn through its first `Dead` point and no further | Given the Wandersleb and Cassegrain layouts re-recorded with `status`, when drawn with `rays: 'fan'` at 1000 and 600 px, then inverting the transform, the polylines carrying each `data-status` recover exactly that status's segments within 0.01 mm | `fixture: the Wandersleb and Cassegrain layouts re-recorded by scripts/record-phos-core.py at the fixtures' pinned phos-core sha, with each kept point's status` (roadmap U17) | `tests/unit/layout2d.test.js::recorded ray status per point (U17)` |
| O2 | `show` hides the segments of any status, and the drawing does not reflow | Given each recorded layout, when drawn with `show` leaving out one status at a time, then that status draws no polyline, the others are as in O1, and the transform and viewBox equal the drawing with every status shown | same fixture (U17) | `tests/unit/layout2d.test.js::show hides a status (U17)` |
| O3 | A layout with no `status` draws as before | Given the sample, the website's layouts and the Wandersleb and Cassegrain recordings with `status` deleted (fan rays, the adapter's labels, 1000 and 600 px), when drawn, then the SVG is byte-identical to the base build's. The tiles that now draw from `status` (a dead ray past its first point becomes two runs) are checked by eye at O5 | `property: a layout with only alive and dead, or none, gives the same SVG as before` (U17), the baseline recorded by `scripts/record-renderers.mjs` from a build of the plan's base | `tests/unit/split.test.js::SVG renderers draw the base markup` (gains the two recordings) |
| O4 | The recorder writes `status`, and the re-recorded rays, `alive` and `dead` are unchanged | Given the re-recorded fixtures, when the fixture test reads them, then `status` has one Rust name per kept point, `alive` and `dead` follow from `status` (first non-Alive index; first non-Alive is Dead), and U16's recorded facts hold | `fixture: phos-core 580090e` (U16, U17) | `tests/unit/phos-core-fixtures.test.js::recorded layouts carry each point's status (U17)` |
| O5 | The Cassegrain tile with `Dead` hidden, approved in both themes and palettes; the Wandersleb with `Virtual` hidden shown once as a review image | Demo | `user` (U17) | M1 demo |
| O6 | The release is planned: a plots minor naming `status` and `show` | Given the repo, when the release test reads the changesets, then a plots minor names `status` and `show` | `spec semver` (a new optional input is a minor) | `tests/unit/release.test.js::row Q changesets` |

## Non-goals

- Which statuses phos-core assigns (whether a mirror's reflection latches `Virtual`): phos-core's (roadmap, Not here).
- phos's adapter passing `status`: phos, after this row's release.
- Dropping `alive`/`dead`: they stay (U17); J's major release decides.
- A legend or key for the statuses: no consumer asks.

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| [#616] | absorb | roadmap row Q: the recorded fan tile's footer keyed from its recorded wavelengths (`gallery/index.html`) |
| [#617] | absorb | roadmap row Q: `tileMin`'s `rayFan` special case (`gallery/index.html`) |
| [#138] | absorb | `layout2d.js`'s input validation, which this plan extends with `status` |
| [#355] | absorb | the Wandersleb checks in `phos-core-fixtures.test.js` and the recorder's 14° check, which this plan edits and re-records; per-point status lets the check name where the ray dies |
| [#368] | absorb | the duplicated status round-trip loop in `layout2d.test.js`, which O1's test would copy a third time |
| [#385] | absorb | `arcProperties` in `layout2d.test.js`, which this plan edits |
| [#160] | absorb | round 1 (user): field labels clamped inside a cropping box (`layout2d.js`) |

## Constraints and assumptions

- Re-recorded at phos-core `580090e` (the fixtures' sha): any change to `rays`, `alive`, `dead` or `surfaces` is a stop (U16's facts).
- Assumption: a kept point's status is Alive, Virtual or Dead (Missed points are non-finite and cut). A kept Missed stops the recorder.
- When `status` is present, `alive` and `dead` are ignored by `layout2D` (the fixture test checks they agree).
- `Missed` is a Rust `RayStatus` the type leaves out (U17): Missed points are non-finite and never kept; `index.d.ts` says so.
- Plan end edits the roadmap: row Q done, the Deferred rows of the absorbed issues dropped, U17 cut, as plan [#603] did.

## Decisions

- Core: `packages/plots/src/index.d.ts` gains `RayStatus = "Alive" | "Virtual" | "Dead"`, `RecordedLayout.status?: RayStatus[][][]`
  and `Layout2DProps.show?` (approved with the plan).
- No new ADR: U5 (roles and strokes, never caller colors) and ADR-0003 (stroke widths) hold.

## Milestones

Each item unskips its own acceptance case (the commit hook refuses a source change with no test; plan [#512], CR [#593]),
so no milestone ends with an empty unskip item.

### M1: recorded status drawn, `show`, the Cassegrain tile GitHub: `P642 M1: Status per point`

Demo: `npm run gallery`; the Wandersleb and Cassegrain tiles drawn from recorded `status` (unchanged to the eye), the new
Cassegrain tile with `show: ["Alive", "Virtual"]` (no obscured rays), both themes and palettes; a review image of the
Wandersleb with `show: ["Alive", "Dead"]` (the draft `review-assets` release, never committed). Proves: O1 to O5

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#643] | O1, O2 and O4 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/layout2d.test.js`, `tests/unit/phos-core-fixtures.test.js` | the three cases, skipped citing this issue | |
| [#644] | O3 baseline: `scripts/record-renderers.mjs` gains `layout2D-wandersleb` and `layout2D-cassegrain` at 1000 and 600 px (`rays: 'fan'`, labels from `fieldsDeg` as `adapters.layout` gives them), from the committed recordings, recorded from a build of the plan's base; every old entry comes back identical | new entries in the existing baseline because `split.test.js` already asserts every entry byte for byte; considered a second baseline file and test, which repeats it | `scripts/record-renderers.mjs`, `tests/fixtures/renderers-baseline.json` | `split.test.js::SVG renderers draw the base markup` green with the new entries | |
| [#645] | Types: `RayStatus = "Alive" \| "Virtual" \| "Dead"`, `RecordedLayout.status?: RayStatus[][][]` (one per kept point; `Missed` points are non-finite and never kept), `Layout2DProps.show?: RayStatus[]` (the statuses drawn, default all); the `alive` and `dead` JSDoc gain "ignored when `status` is present" | forced (Core `index.d.ts`, approved with this plan; the Rust `RayStatus` names, row M's rule); `show` as an array of drawn statuses (user, round 1) | `packages/plots/src/index.d.ts`, `tests/types/layout2d-status.ts`, `tests/unit/types.test.js` | `types.test.js::layout status and show type-check under --strict` (new case naming the file; `@ts-expect-error` on `status: [[["ALIVE"]]]` and `show: "Dead"`) | |
| [#646] | Recorder writes `status[f][r][p]` for each kept point through `status_name()`, refuses a kept `Missed` (untested: no recording has one), and refuses to write a layout whose `rays`, `alive`, `dead` or `surfaces` differ from the committed file; both layouts re-recorded at phos-core `580090e` in a scratch clone; the module docstring and the fixtures README document `status`; unskips O4 | `status_name()` because row P made it the one mapping to the Rust names; considered the client's class names (`DEAD_E`), a second vocabulary (row M's rule). The refusal makes the Constraints' stop observable (one-line JSON shows no readable diff). A build failure at `580090e` stops the item (user, round 2) | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/{wandersleb,cassegrain}-layout.json`, `tests/fixtures/phos-core/README.md`, `tests/unit/phos-core-fixtures.test.js` | `phos-core-fixtures.test.js::recorded layouts carry each point's status (U17)` | [#643] |
| [#368] reuse | One `statusRoundTrip(L, parts)` for the Wandersleb, Cassegrain and O1 tests, and `drawnStarts`, each deriving the expected runs from `status` when present (the legacy rule otherwise); `arcProperties` keeps `dirs` only when a fan of two or more rays has one and returns early with no non-image surface ([#385]) | one helper, in M1 before the drawing change, because the U16 tests (`:836`, `:1031`) and `drawnStarts` (`:1079`) assume one polyline per dead ray and would go red once the recordings draw by status; considered changing them inside the drawing item, a fourth file there | `tests/unit/layout2d.test.js` | the U16, Cassegrain and arc tests green, unchanged in what they assert on today's drawing | [#646] |
| [#654] | O3 baseline draws the recordings with `status` deleted (CR [#653]): `scripts/record-renderers.mjs` deletes `status` from a copy of each recording before drawing `layout2D-{wandersleb,cassegrain}-{1000,600}`; the baseline file is unchanged | delete `status` in the recorder because O3 defines those entries as the recordings with `status` deleted; considered re-recording them from #648's output, which records the code under test | `scripts/record-renderers.mjs`, `tests/unit/split.test.js` | `split.test.js::the recorded layout entries draw without status (O3, CR #653)` | |
| [#647] | `layout2D` validates `status`: one array per fan, per ray, per point, each `"Alive"`, `"Virtual"` or `"Dead"`, each mismatch a named error (`layout2D: status[1][4][2] is not Alive, Virtual or Dead`) | one named error per shape, as `alive` and `dead` do (`layout2d.js:159-177`), through one shared shape walk for the three; considered accepting any string as Alive, which hides a recorder bug | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::status is validated` | [#645] |
| [#648] | `layout2D` draws by status, one path for every layout: a per-point status `st` (from `status`, else `Alive` below `alive`, `Virtual` from it, and with `dead` `Dead` at the blocking point); a ray drawn through its first `Dead` point and no further (user, round 1); runs split by each segment's end-point status; `Alive` and `Dead` solid (the chief's `6 4`), `Virtual` `1 3` (user, round 1). With `status`, each run is a polyline with `data-status`; without it, adjacent solid runs join and no `data-status` is written. `mirrorBodies` reads `st`. The plots README's `status` paragraph. Unskips O1 | one derived `st` because legacy and recorded layouts then share runs and `show`, and joining solid runs only without `status` keeps O3's bytes; considered keeping the legacy two-part code beside a status path, which leaves `show` nothing to filter on a legacy dead ray | `packages/plots/src/layout2d.js`, `packages/plots/README.md`, `tests/unit/layout2d.test.js` | `layout2d.test.js::recorded ray status per point (U17)`; O3 still green | [#644], [#368], [#647], [#654] |
| [#649] | `show`: runs whose status is not in `show` are not drawn (a legacy dead ray with `Dead` hidden draws `r[0..a)`); validated (an array of the three names); bounds, transform and `mirrorBodies` read every point whatever `show` says. The plots README's `show` paragraph. Unskips O2 | filtering built runs because bounds already read every point (`layout2d.js:128`), so nothing reflows; considered dropping hidden points before drawing, which moves the box | `packages/plots/src/layout2d.js`, `packages/plots/README.md`, `tests/unit/layout2d.test.js` | `layout2d.test.js::show hides a status (U17)` | [#648] |
| [#650] | Gallery: tile `layout2D-cassegrain-dead-hidden` (`data-size="layout2D"`, meta "Cassegrain, recorded, Dead hidden"), the recorded Cassegrain through `adapters.layout` with `show: ["Alive", "Virtual"]`; `TILES` 28, the tile in `ownData` and in the cassegrain row of the blanked-tiles test | a gallery tile because the roadmap names it (U17's user oracle); its floor through `ELEO.minWidth('layout2D')`; considered a review image only, which leaves no tile to keep checking | `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js::the Cassegrain Dead-hidden tile draws no Dead run (U17)` | [#649] |
| [#656] | README: `show` on a legacy dead ray draws points 0 to `alive[k][i]` - 1 (CR [#655], review M1 round 1, finding 1) | the reviewer's wording because the `dead` paragraph reads "0 to `alive[k][i]`" inclusively; considered `r[0..a)` alone, notation the README does not use | `packages/plots/README.md` | none to write: `show is validated and hides a legacy dead ray (U17)` already green | [#650] |
| [#657] | A legacy one-point ray with `alive` 0 draws its dotted single-point polyline again, as before [#648] (review M1 round 1, finding 2) | a lone dotted `[r[0]]` head without `status` when Virtual is shown, the one case a 6603-drawing fuzz found; considered documenting it away, which breaks U17's property | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::a one-point ray with alive 0 draws its dotted point (O3)` | [#656] |
| [#658] | `alive` and `dead` are not validated when `status` is present (review M1 round 1, finding 3) | skip their `perRay` calls beside `status`, as the Constraints and the Core JSDoc say; considered rewording the docs, which edits Core `index.d.ts` | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::alive and dead are ignored when status is present` | [#657] |

### M2: absorbed fixes and the release GitHub: `P642 M2: Fixes and release`

Demo: `npm run gallery`; the recorded fan tile's footer keys its recorded wavelengths ([#616]); `npx changeset status` lists a
plots minor. Proves: O6, and the absorbed issues

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#138] reuse | A glass surface whose next surface is an image with no profile throws `layout2D: surface i has no profile` (today a bare TypeError at `layout2d.js:210`) | the fix the issue names, beside `badProfile`, which exempts the image; considered requiring a profile on every image, which breaks the website's fixtures | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layoutBounds names a bad input` gains the case | M1 |
| [#160] reuse | A field label's baseline is clamped to at least 1 em below the top (`above()`'s floor), so a cropping `box` keeps it inside | the clamp the issue names, because `above()` already keeps STO inside; considered documenting that labels follow their chief out of the box, which leaves text outside the viewBox | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::labels stay inside a cropping box (#160)` | [#138] |
| [#355] reuse | The Wandersleb fixture test names the stop-rim artifact from `status`: the on-axis marginals are `Virtual` at the stop (`status[0][0][5]`), and the 14° lower ray is `Dead` at the stop (`status[1][10][5]`), each citing [#355] and ELEOptics/phos#310; the recorder's 14° check asserts where the ray dies as recorded (the stop), not only that it dies | assert the recorded facts because phos-core `580090e` kills that ray at the stop (`surfaces[4]`), so a lens-rim check could never pass; considered filing the stop-rim numerics upstream, a comment on the issue at plan end, not an item | `tests/unit/phos-core-fixtures.test.js`, `scripts/record-phos-core.py` | `phos-core-fixtures.test.js::recorded Wandersleb layout is phos-core's trace of phos's triplet` | M1 |
| [#616] reuse | The recorded fan tile: `data-size="curve"`, `REC.rayFan` and `REC.rayFanWavelengths` (kept from the recording's first source, as `REC.footprintAngles` is), footer `data-legend="rayFan"` keyed `ELEO.legend('wavelength', n, REC.rayFanWavelengths)`, empty when the recording failed; `tileMin` loses its `rayFan` case ([#617]) | one item for both issues because they rewrite the same lines of one tile; keyed from the recording, the gallery's rule (`gallery/index.html:211`), and `tileMin`'s generic branch takes `REC[tile]` (`:205`); considered dropping the footer, which leaves the colors unexplained | `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js::the recorded fan footer keys its wavelengths (#616)`; `every tile at its minimum has the floor frame (#587)` green with the case gone | M1 |
| [#651] | Release planned: a plots minor changeset naming `status` and `show`, and its release test with a consumed twin | forced (`CLAUDE.md`: a changeset per user-facing change); the twin as rows O and P did (`release.test.js:441-460`) | `.changeset/layout-status.md`, `tests/unit/release.test.js` | `release.test.js::row Q changesets` | M1 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| phos-core `580090e` will not build with today's toolchain | no re-record | the recording item stops and reports; fallback: record at the fans' sha `e0f14aa`, an oracle change (user) |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-05 round 1 (user): buckets confirmed, and [#160] absorbed too (+1 item: field labels clamped inside a cropping box); a ray with `status` draws through its first `Dead` point and no further; a `Dead` segment is solid as today (the chief keeps `6 4`); `show?: RayStatus[]`, the statuses drawn, default all three.
- 2026-11-05 round 2 (user): pre-mortem, Virtual never seen hidden: the M1 demo adds a review image of the Wandersleb with `Virtual` hidden; a build failure at `580090e` stops and asks; two milestones.
- 2026-11-05 critique (general-purpose, claude-fable-5-1): all 15 findings accepted. 1: the test helper item ([#368], with [#385]) moved into M1 before the drawing change, deriving expected runs from `status`; 2: one derived per-point status for every layout, solid runs joined only without `status`, `mirrorBodies` reads it; 3: the [#355] check asserts the recorded stop death (a lens-rim check cannot pass at `580090e`); 4: the gallery item names `TILES`, `ownData` and the blanked-tiles row; 5: the recorder refuses a changed `rays`/`alive`/`dead`/`surfaces`; 6: O3 extends the existing baseline with the two recordings at 1000 and 600 px; 7: the types test names its file; 8: O3/O5 split stated, roadmap edits at plan end; 9: `Missed` in the JSDoc, its refusal untested; 10: [#616] and [#617] one item; 11: [#138]'s surface is the profile-less image; 12: the recorder docstring in item 4; 13: `alive`/`dead` JSDoc; 14, 15: no change. Approach: the validation shares one shape walk (applied).
- 2026-11-05 approved (user): as drafted, the oracles O1 to O6 in one batch, the Core `index.d.ts` change with it; published as [#642], items [#643] to [#651] and reused [#368], [#138], [#160], [#355], [#616].
- 2026-11-05 CR [#653] (orchestrator, accepted): #648's first attempt showed the four recorded baseline entries (#644) would draw from `status` once #646 re-recorded them; O3 defines them as the recordings with `status` deleted, so +1 item [#654] in M1 before [#648], keeping every invariant.
- 2026-11-05 review M1 round 1 (code-reviewer, claude-opus-5-5): 1 blocking, CR [#655] accepted (README off by one, item [#656]); backlog [#657], [#658], [#659] pulled into M1 (small, named, in files M1 changed).
- 2026-11-05 [#659] back to the backlog, out of M1 (orchestrator): a pure refactor, so it has no test to write first, and the commit hook refuses a source change without one; the next item that touches the run building carries it.

[#138]: https://github.com/ELEOptics/eleo-ui/issues/138
[#160]: https://github.com/ELEOptics/eleo-ui/issues/160
[#355]: https://github.com/ELEOptics/eleo-ui/issues/355
[#368]: https://github.com/ELEOptics/eleo-ui/issues/368
[#385]: https://github.com/ELEOptics/eleo-ui/issues/385
[#603]: https://github.com/ELEOptics/eleo-ui/issues/603
[#616]: https://github.com/ELEOptics/eleo-ui/issues/616
[#617]: https://github.com/ELEOptics/eleo-ui/issues/617
[#162]: https://github.com/ELEOptics/eleo-ui/issues/162
[#512]: https://github.com/ELEOptics/eleo-ui/issues/512
[#593]: https://github.com/ELEOptics/eleo-ui/issues/593
[#642]: https://github.com/ELEOptics/eleo-ui/issues/642
[#643]: https://github.com/ELEOptics/eleo-ui/issues/643
[#644]: https://github.com/ELEOptics/eleo-ui/issues/644
[#645]: https://github.com/ELEOptics/eleo-ui/issues/645
[#646]: https://github.com/ELEOptics/eleo-ui/issues/646
[#647]: https://github.com/ELEOptics/eleo-ui/issues/647
[#648]: https://github.com/ELEOptics/eleo-ui/issues/648
[#649]: https://github.com/ELEOptics/eleo-ui/issues/649
[#650]: https://github.com/ELEOptics/eleo-ui/issues/650
[#651]: https://github.com/ELEOptics/eleo-ui/issues/651

[#653]: https://github.com/ELEOptics/eleo-ui/issues/653
[#654]: https://github.com/ELEOptics/eleo-ui/issues/654
[#655]: https://github.com/ELEOptics/eleo-ui/issues/655
[#656]: https://github.com/ELEOptics/eleo-ui/issues/656
[#657]: https://github.com/ELEOptics/eleo-ui/issues/657
[#658]: https://github.com/ELEOptics/eleo-ui/issues/658
[#659]: https://github.com/ELEOptics/eleo-ui/issues/659

[#652]: https://github.com/ELEOptics/eleo-ui/pull/652
