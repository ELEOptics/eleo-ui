# Plan #232: Paneled curves for the fans, and spot on typed points

Status: approved 2026-10-11
Branch: `plan/232-panels-spot` PR: #247 Depends on: plan #162 (done) Roadmap: `agent_docs/roadmap.md`, row E

## Problem

phos wants to draw its ray fans and spot diagrams from eleo-ui's plot types (roadmap U6's fans, U7). Today
`rayFan` and `spot` read only the sample's own shapes and draw in pixel space, so phos can't pass its own
results. Row E as written also had the gallery record TransverseRayError, MonteCarloTolerance and
BeamFootprint through phos-core's Python client, but only SpotDiagram is there (ELEOptics/phos-core#371 and
ELEOptics/phos-core#372 are open and unscheduled; the REST server left phos-core in `48241ffd`). The user chose a split
(2026-10-11): E ships `curve` panels with the fans on sample data, and `spot` on typed points from the recorded
SpotDiagram; the cumulative probability curve and the beam footprint move to a later row.

## Ground truth

- `curve` (`packages/plots/src/curve.js`, 80 lines) draws typed `{ series, x, y, width, height }` in one plot:
  axes from `axisRange` (given range, else `niceRange` of the data) and `axisTicks`, a nested `<svg>` viewport
  holding a `<g transform="matrix(…)">` in data coordinates, one `<polyline>` per series under
  `vector-effect="non-scaling-stroke"` (ADR-0001, Curve drawing). Roles: `index` → `idx(k)`, `sagittal`
  dash `5 3`, `reference` ink dash `1 3`, all 1 px. A zero line in `--plot-axis` when a range straddles 0.
  `kind` builds series from the sample through `curveAdapters`.
- `curve.js:14-16`: a range that doesn't coerce to two finite numbers fills the transform with NaN (#207).
  `axis.js:21-30`: `niceTicks` repeats or misses the data on spans of 2 to 500 ulps (#208).
- `rayFan` (`fan.js`, 30 lines) reads `D.fans` or `D.opdFans` (per field `{ T, S }`, per wavelength 41 values
  over the pupil −1..1, `null` where a ray is vignetted), draws 2 rows (T, S) × fields of pixel-space `<path>`s
  with `M`/`L` breaks at nulls, a full scale from fixed steps, and per-panel field titles. Options `kind`,
  `fields`, `fullScale`, `panelWidth`.
- `spot` (`spot.js`) reads `D.spots[field][wavelength]` (`[x, y]` µm, 331 points each), `D.spotStats`
  (`rms`, `geo`), `D.airy` (µm): one 150 px box per field, a `<circle>` per point in px space, the Airy circle,
  RMS and GEO text; `scale` `common` or `auto`, `half`, `colorBy`, `airy`. `throughFocus` shares the file and
  stays on sample data (U7).
- `tests/unit/split.test.js` asserts every SVG renderer in `scripts/record-renderers.mjs`'s `draws()` equals
  `tests/fixtures/renderers-baseline.json` (main's markup at plan #162's base), keys included. `spot`,
  `rayFan` and `rayFan-opd` are in it.
- `tests/unit/curve.test.js` has the round-trip helpers (`seriesGroup`, `toData`, `frame`, `assertPinned`)
  inside the test file; `frame()` reads only the first nested `<svg>`, and `seriesGroup` parses `M`/`L` only.
  `npm run test:unit` runs `tests/unit/*.test.js`, so a `tests/unit/helpers/` module is not run as a test.
- `tests/gallery.spec.js:221` reads the spot tile's `circle[fill^="var(--series-k"]` for the palette test;
  `:53` loops the recorded tiles for the missing-fixture test; `:109` lists `ownData`.
- The recorded achromat's back focal distance is 97.22 mm against the sample's 97.126 (best RMS focus,
  `tests/fixtures/phos-core/README.md`): about 94 µm of defocus, so its recorded spots are larger than the
  sample's.
- phos-core's uniffi Python client (`~/code/ELEOptics/phos-core/clients/python/src/phos/phos.py`, built at
  phos-core e9c5fbc1): `SpotDiagramSettings` (`set_system_index`, `set_sources`, `set_pupil_sampling_x/_y`,
  `run(model) -> [SpotDiagram]`), `SpotDiagram` (`ray_errors() -> List[List[Point2]]`, `wavelengths()`,
  `source_index()`, `enclosing_radius(wavelength_index)`). Verified in phos-core's source (critique,
  `analyses/src/spot_diagram.rs:139-160, 258-270, 452-470`): `ray_errors()` is one list per wavelength (in
  `wavelengths()` order) of the rays alive at the image (vignetted rays dropped, so lengths vary), in mm,
  relative to the paraxial chief ray at the system's reference wavelength (the same origin for every
  wavelength of a source; not the centroid). `enclosing_radius(i)` is the smallest enclosing circle in mm;
  `None` gives the polychromatic one. No centroid or RMS is exposed. Default pupil sampling 32 × 32 (about 800
  live rays per wavelength). `Point2` is a `[x, y]` list. No TransverseRayError, MonteCarloTolerance or
  BeamFootprint wrappers (their Rust analyses exist in `phos-core/analyses/src/`).
- `scripts/record-phos-core.py` records MTF, field curvature and distortion of the achromat and the Cooke
  triplet; `tests/fixtures/phos-core/adapters.js` (a classic script) turns them into curve calls;
  `gallery/index.html` fetches them through `recorded(name, file, draw)` into `REC` (#226 wants one helper).
- `physics.js` has `airyRadius`.
- `tests/perf.spec.js` measures `curve` under `PERF=1` (U14: 1.1–1.2 ms).
- `index.d.ts` (Core) types `SpotDiagramProps`, `RayFanProps`, `CurveSeries`, `CurveAxis`, `CurvePlotProps`.
- Prior art: no library needed. Faceting is a grid of the existing plot; a dot per point under a data-space
  transform is a zero-length subpath with a round cap (SVG 2 §13.6 "zero-length subpaths… round cap draws a
  circle"; written `M x y h0`, since a lone `M` draws nothing), one `<path>` per series.

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `curve` draws panels: `{ panels: [{ title?, series }], columns?, x, y }`, one x and one y range shared by every panel (given, or the nice range of all panels' data); a `null` point breaks a series' line. `rayFan` is a thin wrapper that builds panels (rows T and S, a column per field, titled with the field angle and the pupil axis, `Py` or `Px`) from the sample's fans and calls it. | given the sample's `fans` and `opdFans` built into panels by `rayFan`'s adapter, when drawn at two widths, then inverting each panel's series transform recovers every non-null point within 0.5 px, every panel maps the same ranges to its own box, and a null splits its series into separate subpaths | `fixture: packages/plots/src/sample.json fans and opdFans (TransverseRayError waits on ELEOptics/phos-core#371; user 2026-10-11)`, changing U6's oracle for the fans | `tests/unit/curve.test.js::sample fans round trip through panels (U6)` |
| O2 | `spot` draws typed points per series and panel: `{ panels: [{ title?, series: [{ points, index }], airy?, notes? }], origin?, reference?: 'chief' \| 'centroid', showStats?, showAiry?, scale, half?, unit?, label? }`, in a square data-space group per panel with one scale on both axes, re-centred on the chosen reference; RMS and GEO computed about it, the Airy circle from the panel's radius, each behind its toggle, and a caption naming each active setting (CR #270, user); `scale: "common"` gives every panel one scale. The gallery's spot tile is built from the recorded SpotDiagram of the achromat. | given the recorded SpotDiagram of the achromat and the Cooke triplet, built into panels by `adapters.js`, when drawn with `scale: "common"` and `"auto"`, then inverting each panel's transform recovers every point within 0.5 px; each transform has `|a| = |d|`; with `common` all panels' transforms share one scale; the Airy circle's radius maps to the given `airy` within 0.5 px | `fixture: phos-core SpotDiagram recorded by scripts/record-phos-core.py (roadmap U7)`; `property: one common scale across panels when asked (roadmap U7)` | `tests/unit/spot.test.js::recorded spot round trip (U7)` |
| O3 | The typed API is public: `CurvePanel` and `panels` on `CurvePlotProps`, `SpotPanel`/`SpotSeries` on `SpotDiagramProps`, alongside the sample calls; the Svelte wrappers document a typed call. | given `tests/types/panels.ts` with a typed panel call of each, when `tsc --strict` runs against `index.d.ts`, then it passes, and a call with a `color` key fails | `spec roadmap Constraints (typed API alongside the old one)` | `tests/unit/types.test.js::panels and spot points type-check under --strict` |
| O4 | The release is planned: a plots minor. | given the branch, when `.changeset/panels-spot.md`'s front matter is parsed, then it is `{"@eleoptics/plots": "minor"}` | `spec roadmap Constraints (a typed API added alongside the old ships as a minor); semver 0.x` | `tests/unit/release.test.js::panels-spot changeset asks a plots minor` |

## Non-goals

- The cumulative probability curve (MonteCarloTolerance) and the beam footprint (BeamFootprint): a later row,
  after phos-core exposes them in its Python client (ELEOptics/phos-core#372 and ELEOptics/phos-core#440). User, 2026-10-11.
- Recorded fans (TransverseRayError): wait on ELEOptics/phos-core#371; the fans stay on sample data, as
  chromatic focus does.
- A Rust recorder or adding the wrappers to phos-core from here: the user chose the split over both.
- `throughFocus` on typed points: U7 keeps it on sample data until phos-core computes it.
- Per-panel ranges or axis labels: the fans need one shared scale, and titles name each panel. Next plan if
  phos asks.
- (Dropped by CR #270, user 2026-10-12: `spot` now computes RMS and GEO about the chosen reference.) The real
  chief ray and per-wavelength centroids as references: they wait for phos-core to expose them.
- Limit lines and bands (G), hover and zoom (H), export (I).
- A plots-svelte release: comments only.
- #199 (unknown roles): the roadmap holds it for row G's role table.

## Existing issues

| Issue | Bucket | Where or why |
| -- | -- | -- |
| #207 | absorb | reused as a work item in M1: the axis code panels reuse |
| #208 | absorb | reused as a work item in M1: same |
| #226 | absorb | reused as a work item in M2: the spot tile is the fourth recorded tile |
| #199 | related | waits on row G (roadmap 2026-10-09) |
| #70, #125, #136, #138, #139, #156, #160 | related | layout2D hardening; E doesn't edit `layout2d.js` or `glass.js` |
| #86, #132, #133, #158, #230 | related | untouched files |

## Constraints and assumptions

- Roadmap constraints: typed API alongside the old one (`kind`, `rayFan`'s and `spot`'s sample calls stay
  until J); every gallery tile keeps working; recorded fixtures cover public lenses only; U14's budget for the
  renderers E touches (`curve` with panels, `spot` at 10 000 points); `eleo-layout.js` doesn't grow (E doesn't
  touch `layout2d.js` or `common.js`).
- `spot`'s and `rayFan`'s markup changes, so their entries leave `renderers-baseline.json` and `draws()`;
  re-recording them from the new code would make the code its own oracle (as #173 did for `curve`). Their
  sample paths are covered by metamorphic tests (the sample call equals the typed call on the adapter's output).
- `SpotDiagram.ray_errors()` facts are in Ground truth. The recorder writes `lengthUnit: "mm"` and
  `reference: "paraxial chief ray at the reference wavelength"` as constants.
- Assumption: Chromium draws a zero-length subpath with a round cap under `non-scaling-stroke` as a dot. M2's
  first item checks it in the gallery; if not, a short `h` segment of 1e-9 × range, recorded in Risks.
- The roadmap edit (row E's scope and exit, U6's and U7's wording, a later row for the cumulative curve and the
  footprint) is made by the planner when the plan is published, citing the user's 2026-10-11 decision; the
  footprint issue is ELEOptics/phos-core#440.
- The Airy circle in the gallery comes from `airyRadius` at the reference wavelength and working f-number.

## Decisions

- ADR-0001 holds: roles, not colors; data-space drawing under a non-scaling stroke so the transform inverts to
  the data; no style options. Panels and spot extend the same rule; no new ADR.
- A panel grid shares one x and one y range (the fans' full scale is common today); a panel carries a title and
  series only.
- `spot` draws a dot per point as a zero-length round-capped subpath, `M x y h0`, in one `<path>` per series
  inside the data-space group, so U7's oracle inverts the transform as U6's does; considered ADR-0001's reserved
  px-space alternative (`<circle>`s with `data-x`/`data-y`), which the ADR keeps for the curve case only.
- Dots are marks, not lines: 2.2 px across (today's `r="1.1"`), with `fill-opacity` .85 as today. ADR-0001's 1 px
  rule is for line strokes. The M2 reviewer reads this line.
- `rayFan`'s panel titles carry the field angle and the pupil axis (`1.0° · Py` in the T row, `1.0° · Px` in the
  S row), replacing today's per-panel `Py`/`Px` labels; the shared x label is `Pupil` and the y label names the
  quantity and unit.
- Core changes approved with the plan: `packages/plots/src/index.d.ts` (`CurvePanel`, `panels`, `columns`;
  `SpotPanel`, `SpotSeries`, the typed `SpotDiagramProps` alongside the sample call). No `exports` change.

## Milestones

### M1: Fans as paneled curves (done 2026-10-11) GitHub: `P232 M1: Fans as paneled curves`

Demo: before the first change, the orchestrator screenshots main's gallery at the plan's base (every tile, both
themes, standard and both vision palettes, `page.screenshot` per tile from a scratchpad script, named
`e-base-<sha>-<theme>-<palette>-<tile>.png`) and uploads them with `gh release upload review-assets --clobber`
(never committed). At the demo, `npm run gallery` shows the TRA and OPD fan tiles drawn through `curve`'s panels
beside their baselines, every other tile unchanged. Proves: O1

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #233 | O1 acceptance test, skipped; the round-trip helpers move to a shared module and learn panels (one nested `<svg>` and group per panel) and `M`/`L`/`h` path data | a plain module under `tests/unit/helpers/`, because importing `curve.test.js` from another test re-registers its tests and O2 needs the same inversion; considered copying the helpers into each test (two copies of the oracle's arithmetic) | `tests/unit/helpers/svg.js`, `tests/unit/curve.test.js` | `curve.test.js::sample fans round trip through panels (U6)`, skipped; the existing curve tests stay green on the moved helpers |  |
| #207 reuse | A range that doesn't coerce to two finite numbers falls back to the data | the issue's named fix, extending the README's rule (a bad range is widened) because a caller's typo should not blank phos's plot; considered throwing a named error as `layout2D` does for bad recorded data (a range is a display hint, not data) | `packages/plots/src/curve.js`, `tests/unit/curve.test.js` | `curve.test.js::a non-numeric range falls back to the data (#207)` (oracle: spec #207) |  |
| #248 | CR (#207's worker, stale doc): the plots README's range rule says a range that isn't two finite numbers falls back to the data | forced (stale doc: `packages/plots/README.md:79` since #207) | `packages/plots/README.md` | none: doc only | #207 |
| #208 reuse | `niceTicks` takes the `[lo, hi]` fallback when its ticks repeat or miss the data | the issue's named fix, absorbed as the roadmap's pick because E owns `axis.js` while it rewrites the axes for panels; considered deduplicating ticks with a `Set` (still misses the data at the top end) | `packages/plots/src/axis.js`, `tests/unit/axis.test.js` | `axis.test.js::spans of a few hundred ulps cover the data without repeats (#208)` (oracle: property: ticks strictly increase and cover [lo, hi]) |  |
| #234 | `curve({ panels, columns, x, y })`: a grid of plots sharing one x and y range (given, or the nice range over all panels), a title per panel, axis labels once; a `null` point breaks a series; README `curve` entry. Invocation: `curve({ panels: [{ title: '1.0° · Py', series: [{ points: [[-1, 2], [0, 0], [0.5, null], [1, -3]], index: 0 }] }], columns: 3, x: { label: 'Pupil', range: [-1, 1] }, y: { label: 'Ray error', unit: 'µm' } })` → one `<svg>` with a nested `<svg>` and transform group per panel, the series a `<path d="M… L… M…">` | `typedCurve`'s frame drawn once per cell with ranges and ticks computed once, because the fans need one full scale and the inversion then holds per panel; a series becomes a `<path>` with a new `M` after each `null`, because a polyline can't break. Considered composing whole `typedCurve` strings per panel with a no-labels flag (two ranges passes, labels repeated per cell) and the caller splitting a series at nulls (every caller, phos included, repeats roles per segment) | `packages/plots/src/curve.js`, `tests/unit/curve.test.js`, `packages/plots/README.md` | `curve.test.js::panels share ranges and break at nulls` (oracle: property: synthetic points round-trip within 0.5 px; every panel maps the same ranges to its box) | #233, #207, #208 |
| #235 | `rayFan` builds panels from the sample with an exported `fanPanels(sample, o)` (rows T and S, a column per picked field, titles `<angle>° · Py` / `· Px`, y range ±`fullScale` or today's step rule, x `Pupil` −1..1) and calls `curve`; its two entries leave `renderers-baseline.json` and `draws()`; the gallery's fan tiles need no change; README gains one line under Curves for `rayFan` | forced (roadmap row E: `rayFan` a thin wrapper; Constraints: the sample call stays until J); considered re-recording the baseline (the code as its own oracle) | `packages/plots/src/fan.js`, `scripts/record-renderers.mjs`, `tests/fixtures/renderers-baseline.json`, `tests/unit/fan.test.js`, `packages/plots/README.md` | `fan.test.js::fanPanels carries the sample's fans` (oracle: reference packages/plots/src/sample.json: each panel's non-null points are the sample's values at pupil −1 + 2i/(N − 1); nulls kept; `fields` and `fullScale` honoured) | #234 |
| #249 | CR (#235's worker, stale comment): `split.test.js` says `rayFan` left the guard | forced (stale comment since #235) | `tests/unit/split.test.js` | none: comment only | #235 |
| #236 | Unskip O1 | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/curve.test.js` | O1 | #233, #207, #208, #234, #235 |
| #250 | CR (review M1 finding 1): `niceTicks`' fallback tolerates one ulp of noise at the ends | a tolerance of 1e-6 of a step, as the finding names, because exact comparison sends ordinary noisy spans to raw ticks; considered rounding lo and hi first (moves the data) | `packages/plots/src/axis.js`, `tests/unit/axis.test.js` | `axis.test.js::float noise at the ends keeps nice ticks` | #208 |
| #251 | CR (finding 2): the README stops naming `fanPanels` | drop the sentence, because a public export would touch Core `index.d.ts`, unlisted; considered exporting it | `packages/plots/README.md` | none: doc only | #235 |
| #252 | Backlog findings 3 and 4: a non-finite or null point breaks a panel series; the single plot's range as before | the findings' named fixes in one item, because both are `curve.js`'s rule for bad points; considered two items (one file, one rule) | `packages/plots/src/curve.js`, `tests/unit/curve.test.js` | `curve.test.js::non-finite points break panel series`, `::single plot range unchanged by nulls` | #234 |
| #253 | Backlog finding 5: O1 runs a pass with one fan value nulled | as the finding names | `tests/unit/curve.test.js` | O1 with the extra pass | #236 |
| #254 | CR (#252's worker, stale doc): the README's `panels` bullet names NaN and infinite breaks | forced (stale doc: `packages/plots/README.md:82` since #252) | `packages/plots/README.md` | none: doc only | #252 |
| #255 | Backlog (review M1 round 2 findings 1-3): a non-array range falls back; `plotCell`'s comment; dead conditions dropped | the findings' named fixes in one item, because all are `curve.js` and none changes valid output; considered three items | `packages/plots/src/curve.js`, `tests/unit/curve.test.js` | `curve.test.js::a non-numeric range falls back to the data (#207)` with non-arrays | #252 |
| #256 | Backlog (review M1 round 3 findings 1, 3): panel points not drawn don't set the range; a null entry breaks | one `drawn(p)` rule for the path and the range, because the two had drifted; considered two separate checks | `packages/plots/src/curve.js`, `tests/unit/curve.test.js` | `curve.test.js::non-finite points break panel series` extended | #255 |

### M2: Spot on typed points from the recorded SpotDiagram (done 2026-10-12) GitHub: `P232 M2: Spot on typed points`

Demo: `npm run gallery`: the spot tile draws the recorded achromat (three fields, colored by wavelength), the Airy
circle, RMS and GEO about the reference in each panel's notes, and a caption naming each setting (`Reference: paraxial
chief ray`, `Airy radius 2.87 µm`, `RMS, GEO`). The through-focus tile is unchanged, and a missing spot fixture blanks
only that tile. Proves: O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #237 | O2 acceptance test, skipped | forced (`workflow.md`, TDD) | `tests/unit/spot.test.js` | `::recorded spot round trip (U7)`, skipped | #236 |
| #238 | `record-phos-core.py` records SpotDiagram per source of both lenses at pupil sampling 32 × 32: points per wavelength (mm), wavelengths, source angles, `enclosing_radius` per wavelength and polychromatic, `lengthUnit` and `reference` constants; fixtures README. `python3 scripts/record-phos-core.py --phos <phos-core>/clients/python/src` → `wrote tests/fixtures/phos-core/{achromat,cooke}-{mtf,field-curvature,distortion,spot}.json (phos-core <sha>)`; the other fixtures unchanged | the uniffi client as for the other fixtures, because SpotDiagram is the one row-E analysis it has (user, 2026-10-11); considered 64 × 64 as for MTF (about 500 kB per lens fetched by the gallery, for no visible gain) | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/*-spot.json`, `tests/fixtures/phos-core/README.md` | `phos-core-fixtures.test.js::spot recorded per source and wavelength` (oracle: reference `sample.json` and the MTF recordings for the sources, angles and wavelengths; property: 0 < points per wavelength ≤ 32², every coordinate within `firstOrder.paraxialImageHeight`, the polychromatic radius ≥ every per-wavelength radius). Never compared with `sample.spotStats` (different focus) | #236 |
| #239 | `spot({ panels, scale, half, unit })`: per panel a square frame, a data-space group with one scale on both axes and one `<path>` of `M x y h0` dots per series (2.2 px, round caps, non-scaling), an optional `circle` (data units), an optional `centroid` cross at the given point, the title and `notes` lines, `±half unit` per panel; README `spot` entry. Invocation: `spot({ panels: [{ title: '1.0°', series: [{ points: [[0.4, -1.2], [1.1, 0.3]], index: 0 }], circle: 2.87, notes: ['100 % 6.53 µm'] }], unit: 'µm', scale: 'common' })` → an `<svg>` with one nested `<svg>` and transform group per panel, a dot path per series | the data-space group (Decisions), because U7's oracle recovers points by inverting it as U6's does; considered `<circle>`s with `data-x`/`data-y` (ADR-0001's reserved alternative, kept for the curve case). First check in the gallery that Chromium draws the dots (Risks) | `packages/plots/src/spot.js`, `tests/unit/spot.test.js`, `packages/plots/README.md` | `spot.test.js::typed points round trip, common and auto scale` (oracle: property: synthetic points recovered within 0.5 px; `|a| = |d|`; one scale under `common`; the circle and centroid where given) | #237 |
| #240 | `spot()` on the sample becomes an adapter (`spotPanels(sample, o)`): panels from `spots`, `airy` as the circle, `spotStats` as RMS and GEO notes (the sample's own values), `colorBy`, `scale`, `half`; its entry leaves `renderers-baseline.json` and `draws()`; the palette test reads the dot paths' `stroke` | forced (roadmap Constraints: the sample call stays until J; the palette test reads `circle` fills that no longer exist); considered re-recording the baseline (the code as its own oracle) | `packages/plots/src/spot.js`, `scripts/record-renderers.mjs`, `tests/fixtures/renderers-baseline.json`, `tests/unit/spot.test.js`, `tests/gallery.spec.js` | `spot.test.js::spotPanels carries the sample's spots` (oracle: reference packages/plots/src/sample.json: points, Airy radius and stats are the sample's); `gallery.spec.js::palette switch recolors both themes` on `path[stroke^="var(--series-k"]` | #239 |
| #226 reuse | Gallery spot tile from the recorded achromat: `ELEOAdapters.spot(rec)` (panels per field titled with its angle, a series per wavelength in µm, the Airy circle from `airyRadius` at the reference wavelength and working f-number, the polychromatic enclosing radius as a `100 %` note), drawn `spot(REC.spot)`; the recorded tiles go through one `recTile(k)` helper (#226); the tile joins `ownData` and the missing-fixture loop, 17 tiles kept | the classic-script adapter as for MTF (U11 keeps adapters out of `packages/`), and #226's helper because the spot tile is the fourth copy it names; considered adapting in the page (the unit tests couldn't reuse it) | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js::a missing phos-core fixture blanks only its tile: spot` (new, red first); `::a missing sample script blanks only the sample tiles` with `spot` in `ownData`; O2 covers the points | #238, #239, #240 |
| #241 | Unskip O2 | forced (`workflow.md`, TDD) | `tests/unit/spot.test.js` | O2 | #237, #238, #239, #240, #226 |
| #259 | CR (review M2 round 1 finding 1): `gallery.spec.js`'s comment names spot among the own-data tiles | forced (stale comment since #226) | `tests/gallery.spec.js` | none: comment only | #226 |
| #260 | Backlog finding 2: the half holds the reference circle | the finding's named fix, because a circle beyond the spot was clipped away; considered a fixed 5 µm floor as the old rule (unit-bound) | `packages/plots/src/spot.js`, `tests/unit/spot.test.js` | `spot.test.js::the half holds the reference circle` | #239 |
| #261 | Backlog findings 3, 4, 6, 8: centroid coerced, empty panels, no fill-opacity, aria-label names colorBy | the findings' named fixes in one item, because all are `spot.js` markup hardening; considered four items (one file) | `packages/plots/src/spot.js`, `tests/unit/spot.test.js` | `spot.test.js::typed spot hardening` | #260 |
| #262 | Backlog finding 5: spot sources recorded in source order | as the finding names | `tests/unit/phos-core-fixtures.test.js` | the fixtures test's order check | #238 |
| #264 | CR (#261's worker, stale doc): the README's spot section names the optional `label` | forced (stale doc since #261) | `packages/plots/README.md` | none: doc only | #261 |
| #265 | CR (review M2 round 2 findings 1, 3): `label` escaped; a non-finite `circle` ignored | the findings' named fixes in one item, because both are `spot.js` input guards; considered escaping in `common.js`'s `svg()` (every renderer's label, outside M2's files) | `packages/plots/src/spot.js`, `tests/unit/spot.test.js` | `spot.test.js::typed spot hardening` extended | #261 |
| #266 | CR (finding 2): the README's half rule names the circle | forced (stale doc since #260) | `packages/plots/README.md` | none: doc only | #265 |
| #267 | Backlog (review M2 round 3 finding 1): a non-finite `half` is ignored | the finding's named fix, as #265 did for `circle`; considered clamping to a maximum (an arbitrary bound) | `packages/plots/src/spot.js`, `tests/unit/spot.test.js` | `spot.test.js::typed spot hardening` extended | #265 |
| #268 | CR (#267's worker, stale doc): the README says `half` counts only when finite | forced (stale doc since #267) | `packages/plots/README.md` | none: doc only | #267 |
| #271 | CR #270 (user, M2 demo): `reference: 'chief' \| 'centroid'` with the input's `origin`, labelled in a caption line; the caller-given centroid cross goes | re-centre each panel before drawing, scaling and stats, because every later quantity is about the reference; considered a centroid mark only (the user asked for the reference to change) (user) | `packages/plots/src/spot.js`, `tests/unit/spot.test.js` | `spot.test.js::reference centroid re-centres each panel` | #268 |
| #272 | CR #270: RMS and GEO about the reference, toggled by `showStats` | computed in `spot` from the drawn points (user); considered caller-supplied stats (they would have to be recomputed per reference) | `packages/plots/src/spot.js`, `tests/unit/spot.test.js` | `spot.test.js::stats about the reference` | #271 |
| #273 | CR #270: the Airy circle as panel data (`airy`), toggled by `showAiry` and labelled | data plus a toggle, because `spot` has no wavelength or f-number (user); considered computing it from λ and N in `spot` | `packages/plots/src/spot.js`, `tests/unit/spot.test.js`, `tests/fixtures/phos-core/adapters.js` (key rename, orchestrator) | `spot.test.js::Airy circle toggled and labelled` | #272 |
| #274 | CR #270: the adapters pass `origin` and `airy`, no stats notes; README documents the settings and caption | forced (CR #270: the renderer now computes the stats the adapters wrote) | `packages/plots/src/spot.js`, `tests/fixtures/phos-core/adapters.js`, `packages/plots/README.md` | `spot.test.js::spotPanels carries the sample's spots` updated; O2 and the gallery green | #273 |
| #275 | CR (review M2 round 5 finding 1, with 3–8): the caption one line per setting, inside the figure; stats at 3 significant digits; the sample captioned centroid; reference parsed leniently; no stats clause without stats | one line per clause, because a single line can't fit a one-panel figure at any font; considered wrapping at the figure width (needs text measurement) | `packages/plots/src/spot.js`, `tests/gallery.spec.js` | `spot.test.js::caption lines and stats labels`, `gallery.spec.js::spot caption stays inside the viewBox` | #274 |
| #276 | CR (review M2 round 6 finding 1, with 2–4): a one-panel figure fits its caption; `Airy circle` unless every panel shares a radius; RMS and GEO at 3 significant digits; a small height grows | widen to the longest caption line at 6 px a character (layout2D's estimate), because the caption must stay inside without text measurement; considered shortening the origin label (the user asked for clear labels) | `packages/plots/src/spot.js` | `spot.test.js::caption lines and stats labels` extended | #275 |
| #277 | CR (review M2 round 7 finding 1, with 2–4): one number formatter for RMS, GEO and the Airy radius (no exponents); the README's sizing sentence; a one-panel margin checked in the browser | 3 significant digits below 1000 and whole numbers above, because exponents are not clear labels (CR #270); considered `toFixed(2)` everywhere (round 5's `0.00 mm`) | `packages/plots/src/spot.js`, `packages/plots/README.md`, `tests/gallery.spec.js` | `spot.test.js::caption lines and stats labels`, `gallery.spec.js::spot caption stays inside the viewBox` extended | #276 |

### M3: The typed API, the redraw budget and the release GitHub: `P232 M3: Typed API and release`

Demo: `npm run test:unit`: the types test passes a typed panel and spot call and rejects a `color` key; the
changeset plans a plots minor. `PERF=1 npx playwright test tests/perf.spec.js` prints the medians for `curve`
with 6 panels and `spot` with 10 000 points in total, which the orchestrator writes into the Change log.
Proves: O3, O4

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #242 | O3 and O4 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/unit/types.test.js`, `tests/unit/release.test.js` | the two tests in Outcomes, skipped | #241 |
| #243 | `index.d.ts`: `CurvePanel`, `panels`/`columns`, `SpotSeries`, `SpotPanel`, the typed `SpotDiagramProps`; the Svelte wrappers' header comments (`CurvePlot`, `SpotDiagram`) and the plots-svelte README show the same typed calls as `tests/types/panels.ts` | forced (CLAUDE.md Core: `index.d.ts` types the public API; roadmap Constraints: typed alongside the old; the wrappers pass props through, so their docs show the typed call once it type-checks) | `packages/plots/src/index.d.ts`, `tests/types/panels.ts`, `tests/unit/types.test.js` (O3 unskipped here, orchestrator), `packages/plots-svelte/src/lib/CurvePlot.svelte`, `packages/plots-svelte/src/lib/SpotDiagram.svelte`, `packages/plots-svelte/README.md` | O3 | #242 |
| #244 | U14 for `curve` with panels (6 panels, 3 series of 41 points) and `spot` (3 panels, 10 000 points in total) | the existing `PERF=1` spec, because U14's oracle names it; considered a Node benchmark (U14 names headless Chromium). Stop: a median over 16 ms is reported (kill criterion D–J / U14), not fixed | `tests/perf.spec.js` | `perf.spec.js::spot redraw (U14)`, `::curve panels redraw (U14)` | #241 |
| #245 | Changeset: plots minor | forced (CLAUDE.md: a changeset per user-facing change; roadmap: minors until J) | `.changeset/panels-spot.md`, `tests/unit/release.test.js` | O4 | #242 |
| #246 | Unskip O3, O4 | forced (`workflow.md`, TDD) | `tests/unit/types.test.js`, `tests/unit/release.test.js` | O3, O4 | #242, #243, #244, #245 |
| #279 | CR (review M3 round 1 finding 1, with 5): the panels-spot changeset test skips once consumed, with a CHANGELOG twin; the changeset's layout wording | forced (`release.test.js:212`: `changeset version` deletes the file; the curve-typed pattern) | `tests/unit/release.test.js`, `.changeset/panels-spot.md` | `release.test.js::panels-spot changeset became a plots minor` | #246 |
| #280 | Backlog findings 2–4: `SpotSampleProps` types what the sample call honours; `SpotSeries.points`' doc | the findings' named fixes in one item, because all are the spot types; considered three items (one file) | `packages/plots/src/index.d.ts`, `tests/types/panels.ts` | `types.test.js::panels and spot points type-check under --strict` extended | #243 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| Zero-length round-capped subpaths don't draw under `non-scaling-stroke` in Chromium | spot draws nothing | the spot item's first check in the gallery; fallback a segment of 1e-9 of the range (still invertible) |
| `ray_errors()` unit or reference unclear | O2's fixture can't be read | the recorder item's stop |
| The paneled fan tiles differ from their baselines in look (ticks, frames) | kill criterion D–J fires | M1 demo by eye against main's screenshots: the user approves or rejects the diff, as at D's M1 |
| A shared y range across 6 fan panels squeezes the small field's fan | fans unreadable | `fullScale` stays an option; the demo decides |
| The recorded achromat's spots differ from the sample tile's | the M2 demo reads it as a regression | measured at M2 review round 1: the 100 % radii (6.5, 13.1, 33.0 µm) match the sample's GEO (6.5, 13.7, 34.8 µm); the planner's 94 µm defocus estimate was wrong |

## Change log

- 2026-10-11 (user): row E split: TransverseRayError, MonteCarloTolerance and BeamFootprint are not in phos-core's Python client; E ships panels with the fans on sample data and `spot` on the recorded SpotDiagram; the cumulative curve and the footprint move to a later row.
- 2026-10-11 headless: scope from roadmap row E as split, absorbing #207, #208 and #226 as the roadmap pick named (row: Choose, add or reorder rows).
- 2026-10-11: critique (general-purpose, claude-fable-5-1), all 18 findings applied: spot's reference, unit and sampling from phos-core's source; `M x y h0` dots; the gallery palette test moved into the spot-adapter item; pupil axes in the fan titles; #208's reason; the larger recorded spots in Risks and the demo; `centroid` given by the caller; one scale on both spot axes; dot size in Decisions; the roadmap edit and footprint issue at publish; #226 merged into the tile item; the tautological metamorphic clauses replaced by sample references; shared test helpers; `ownData` and the fixture loop; recorder bounds; no RMS in the adapter (the recorded 100 % radius instead); the Svelte docs merged into the types item; a `rayFan` README line. The panels approach keeps per-cell frames over composing whole `curve` strings (ranges once, labels once).
- 2026-10-11 headless: Approach cells decided, none contested (row: Choose, add or reorder rows).
- 2026-10-11 (user): oracles O1–O4 approved; publish approved with the roadmap edit and the phos-core footprint issue (ELEOptics/phos-core#440).
- 2026-10-11 headless: plan approved (row: Choose, add or reorder rows).
- 2026-10-11 CR #248 (accepted, orchestrator: a non-Core doc): the plots README's range rule, stale since #207.
- 2026-10-11 CR #249 (accepted, orchestrator: a test comment): `split.test.js` still said `rayFan` was guarded.
- 2026-10-11 (orchestrator): #248 and #208 ran at the same time in one tree, against `Parallel waves: off`; their files were disjoint and each was verified and committed alone. Not repeated.
- 2026-10-11 review M1 round 1: 2 blocking (CRs #250, #251, accepted by the orchestrator: a regression fix in #208's file and a non-Core doc). Backlog #252 (findings 3, 4) and #253 (finding 5) into M1 (headless: backlog into M1, row: milestone acceptance within the plan).
- 2026-10-11 CR #254 (accepted, orchestrator: a non-Core doc): the README's panels bullet, stale since #252.
- 2026-10-11 review M1 round 2: 0 blocking. Backlog #255 (findings 1-3) into M1 (headless: backlog into M1, row: milestone acceptance within the plan).
- 2026-10-11 review M1 round 3: 0 blocking. Backlog #256 (findings 1, 3) into M1 (headless: backlog into M1, row: milestone acceptance within the plan); #257 (finding 2, typed-array ranges outside the contract) stays a plain issue.
- 2026-10-11 review M1 round 4: 0 blocking, nothing pulled in; #258 stays a plain issue (after round 3). M1 done, pending the user's demo.
- 2026-10-11 (user, M1 demo): go. The paneled fan tiles are row E's fan baseline.
- 2026-10-11 review M2 round 1: 1 blocking (CR #259, accepted by the orchestrator: a test comment). Backlog #260 (finding 2), #261 (findings 3, 4, 6, 8) and #262 (finding 5) into M2 (headless: backlog into M2, row: milestone acceptance within the plan); #263 (finding 7, shared helpers outside M2's files) stays a plain issue. Finding 9: the M2 demo line and the Risks row said the recorded spots would be larger; they match the sample's size, corrected here.
- 2026-10-11 CR #264 (accepted, orchestrator: a non-Core doc): the README's spot section, stale since #261. `index.d.ts`'s `label?` on `SpotDiagramProps` goes into #243 (Core, approved with the plan's typed spot props).
- 2026-10-12 review M2 round 2: 2 blocking (CRs #265, with backlog finding 3, and #266, accepted by the orchestrator: an input guard in the milestone's file and a non-Core doc).
- 2026-10-12 review M2 round 3: 0 blocking. Backlog #267 into M2 (headless: backlog into M2, row: milestone acceptance within the plan).
- 2026-10-12 CR #268 (accepted, orchestrator: a non-Core doc): the README's half rule, stale since #267.
- 2026-10-12 review M2 round 4: 0 blocking, nothing pulled in; #269 stays a plain issue (after round 3). M2 done, pending the user's demo.
- 2026-10-12 (user, M2 demo): no-go. CR #270 (the user's decision, plan scope): `spot` gains `reference` ('chief' with the input's `origin`, or 'centroid'), RMS and GEO computed about the reference behind `showStats`, the Airy circle as panel data (`airy`) behind `showAiry`, and a caption line naming the active settings. Work items #271–#274 in M2; the non-goal on renderer stats is dropped; #243 types the new options.
- 2026-10-12 review M2 round 5 (after CR #270): 2 blocking. CR #275 (finding 1, accepted by the orchestrator) folds in findings 3–8, which bear on the user's "clear labels"; finding 2 (O2 and the M2 demo line predated CR #270) corrected here.
- 2026-10-12 review M2 round 6: 1 blocking (CR #276, accepted by the orchestrator), findings 2–4 folded in (the same caption code, as in round 5).
- 2026-10-12 review M2 round 7: 1 blocking (CR #277, accepted by the orchestrator), findings 2–4 folded in.
- 2026-10-12 review M2 round 8: 0 blocking, nothing pulled in; #278 stays a plain issue. M2 done again after CR #270, pending the user's demo.
- 2026-10-12 (user, M2 demo after CR #270): go. The spot tile and its settings are row E's spot baseline.
- 2026-10-12 (orchestrator): #243 unskips O3 itself, because the pre-commit hook needs a test beside the `index.d.ts` change; #246 unskips O4 only.
- 2026-10-12: U14 (headless Chromium, median of 20 redraws, 3 runs): `curve` with 6 panels of 3 × 41 points 0.85–0.90 ms; `spot` with 10 000 points, stats and Airy on, 3.15–3.30 ms; `curve` 1.20 ms. All under 16 ms.
- 2026-10-12 review M3 round 1: 1 blocking (CR #279, accepted by the orchestrator, with finding 5). Backlog #280 (findings 2–4) into M3 (headless: backlog into M3, row: milestone acceptance within the plan); #281 (finding 6, optional) a plain issue.
