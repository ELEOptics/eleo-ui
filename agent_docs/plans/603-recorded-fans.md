# Plan [#603]: Recorded ray fans

Status: approved 2026-11-05
Branch: `plan/603-recorded-fans` PR: [#612] Depends on: none Roadmap: `agent_docs/roadmap.md`, row P

## Problem

The gallery's ray fan tile still draws the sample's hand-made fans, while every other analysis tile draws
a phos-core recording. The fans waited on ELEOptics/phos-core#2142: a dead ray's last location came back as
an error. phos-core plan ELEOptics/phos-core#2167 (closed 2026-11-02) added `x_statuses()`/`y_statuses()`
beside `x_fan()`/`y_fan()`, so the fans can now be recorded with dead samples marked. Row O's reviews also
left two gaps in the gallery's checks that this row's files carry ([#555], [#587]), and plots-svelte's peer
still admits plots 0.7, which ignores `width` ([#598]).

## Ground truth

- **phos-core API** (Python client, `phos.TransverseRayErrorSettings`): `set_system_index`,
  `set_pupil_slice_angle` (0: x and y fans along the pupil axes), `set_num_samples`, `set_sources`;
  `run(model)` gives one `TransverseRayError` per source. Each has `wavelengths()` (µm), `x_fan()` /
  `y_fan()` = `[wavelength][sample]` of (normalized pupil coordinate, error in mm, from the paraxial
  location), `x_statuses()` / `y_statuses()` the same shape of `RayStatus`. A `Dead` sample's error is where
  the ray stopped, not an image error. phos-core's own test (`clients/python/tests/test_transverse_ray_error.py`)
  checks odd symmetry on axis and a clipped stop's dead tails.
- **The recorder** `scripts/record-phos-core.py` has `--only seidel|layout|maps|footprint`; each writes its
  own files and leaves the rest. Footprint is the closest model: per source, per wavelength, keeps `ALIVE`
  only, refuses bad shapes. `tests/fixtures/phos-core/README.md` documents every file.
- **The adapters** `tests/fixtures/phos-core/adapters.js` (classic script, `globalThis.ELEOAdapters`)
  turn recordings into typed calls; `spot` converts mm to µm.
- **Today's fans**: `packages/plots/src/fan.js` `fanPanels(sample, { kind })` builds curve panels from
  `sample.fans` (3 fields × T/S × 3 wavelengths × 41 samples, µm, pupil -1..1 evenly spaced; `null` = a
  vignetted ray): row T (Py) then row S (Px), a column per field, titles `<angle>° · Py`, a symmetric y
  range at the next nice step. `rayFan(o)` draws them through `curve` at `width`, height
  `width × 314 / (columns × 228)` (= `PLOT_SIZES.rayFan.aspect / columns`). `curve` splits a series at a
  `null` (tests/unit/curve.test.js `sample fans round trip through panels (U6)`).
- **Gallery** `gallery/index.html`: `rayFan` and `rayFan-opd` tiles draw the sample; recorded tiles go
  through `recorded()` + `recTile()`; every `[data-svg]` draws through `fit` since [#527] (so [#555]'s `FIT`
  list is gone; its other half, the hand lists `FRAMED_TILES` / `LAYOUT_TILES` in `tests/gallery.spec.js:108`,
  remains: a tile left out of them is never checked). `rowMins` sets each row's `--row-min` from
  `PLOT_SIZES`; `panelsOf('rayFan')` counts the sample's fans. Map rows use `PLOT_SIZES.map2D.minWidth`,
  which has no colorbar ([#587]; `map2d.js:43`: `CB = 3 + 0.6 × widest tick label`, text units).
- **Release**: PR [#511] merged 2026-11-05: plots 0.8.0, plots-svelte 0.5.0, peer still `>=0.7.0 <1` ([#598]).
  Fixtures, adapters and gallery are not published; only `minWidth` and the peer ship.
- **Roadmap**: U6's oracle for the ray fans moves from `sample.json` to recorded TransverseRayError
  (user, plan [#464]). OPD fans stay on the sample. The kill criterion "D on": a converted tile's screenshot
  differs from its baseline in anything but data.

## Outcomes

Oracle: where the expected values come from, `<kind> <source>` (`agent_docs/agents/workflow.md`, Oracles).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | The gallery's ray fan tile draws phos-core's recorded TransverseRayError (achromat; the Cooke triplet recorded too); a dead sample is a gap, never a point | Given `achromat-fans.json` and `cooke-fans.json`, when the adapter's panels are drawn by `curve` at the test sizes, then inverting each panel's transform recovers every alive sample (pupil, error in µm) within 0.5 px, and no dead sample is drawn (the series breaks there) | `fixture: phos-core TransverseRayError recorded by scripts/record-phos-core.py --only fans, minus each field's chief ray at referenceWavelengthNm` (roadmap U6, approved at plan [#464]; chief ray by the user at the M1 demo, CR [#621]) | `tests/unit/curve.test.js::recorded ray fans round trip (U6)` |
| O2 | `minWidth(name, props)` gives the narrowest figure for a call (its panels, and map2D's colorbar from its own tick labels); the gallery's rows take their minimum from it, so no map frame falls under F_LO ([#587]); U18's gallery test checks every framed and layout tile without a hand list ([#555]) | Given a map2D call with a colorbar, when it is drawn at `minWidth('map2D', props)`, then its frame is at least F_LO = 162 px and at 1 px less it is under (closed form); given the gallery at 1440, 1100, 700 px, when the U18 test enumerates tiles by `data-size`, then the set equals every SVG and map tile on the page, each meets ADR-0003, and where a tile's rendered width reaches its row's `--row-min` its frame is at least 162 px | `closed-form ADR-0003` (F_LO, `frameOf`; map2d.js's margins: colorbar `3 + 0.6 × widest label`, x ticks `max(1.2, 0.3 × widest label)` text units) | `tests/unit/scale.test.js::minWidth gives the floor frame (#587)`, `tests/gallery.spec.js::text follows ADR-0003 on every framed tile (U18)`, `tests/gallery.spec.js::rows give each frame the floor (#587)` (replaces the `#544` rayFan-row test) |
| O3 | Release planned: a plots minor (`minWidth`) and a plots-svelte patch peering `@eleoptics/plots >=0.8.0 <1` ([#598]) | Given the repo, when the release test reads the changesets and plots-svelte's package.json, then a plots minor names `minWidth`, a plots-svelte patch names the peer, and the peer is `>=0.8.0 <1` | `spec semver` (the peer admits only plots that draw at a width) | `tests/unit/release.test.js::row P changesets` and its consumed twin |
| O4 | The recorded fan tile approved in both themes and palettes, with the Cooke triplet's recorded fans that have dead samples (the default 24° field, or the clipped Cooke) shown once as a review image, not a tile | Demo | `user` | M1 demo |

## Non-goals

- OPD fans recorded: phos-core has no OPD fan analysis in the client; the `rayFan-opd` tile stays on the sample (roadmap row P).
- `rayFan` taking typed fans: a Core change (`index.d.ts`) no consumer asks for; the recorded tile draws through `curve` as the MTF tile does. J removes the sample shape.
- `colorBy: field` fans, other pupil slice angles: no consumer.

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| [#555] | absorb | O2: the gallery test's tile lists derived from the page (the `FIT` half was done by [#527]) |
| [#587] | absorb | O2: map rows' `--row-min` counts the colorbar |
| [#356] | absorb | the fixtures README says `wandersleb.toml`'s header names phos's paths (the recorder copies the TOML unchanged, so the header stays) |
| [#598] | absorb | O3 |
| [#355], [#368], [#385] | related | ray-visibility's files (`phos-core-fixtures.test.js`'s Wandersleb checks, `layout2d.test.js`) |
| [#554] | related | `fit.js`: H |

## Constraints and assumptions

- The recording runs at a phos-core sha at or after ELEOptics/phos-core#2167's merge (each fixture carries its sha).
- 41 samples per fan, pupil slice angle 0, the lens's own sources and wavelengths: the sample's shape.
- The default Cooke triplet likely has no dead fan sample: its footprint keeps 795 of 1024 rays at every field
  alike (the square grid's corners outside the pupil, not vignetting), and phos-core's own test clips the stop to
  0.65 to get dead tails. So the recorder records the clipped Cooke when the default has none (item 2), and O1's and
  O4's dead-ray gaps come from whichever file has them; O1 also nulls one sample on a clone, as the sample fans test does.
- `minWidth` with no sample loaded counts one panel (the gallery's no-sample test asserts no page error).
- This PR edits `package-lock.json`, a `director/merge.sh` security trigger: the user merges it.
- Package changes: `minWidth` (a plots minor) and [#598]'s peer (a plots-svelte patch).

## Decisions

- ADR-0001 (adapters stay outside the package, U11), ADR-0003 (the tile draws at its width; `minWidth` is computed from its functions, as `PLOT_SIZES` is, so it cannot drift).
- Core: `packages/plots/src/index.d.ts` gains `minWidth(name, props)` (user, round 2). No ADR: `minWidth` applies ADR-0003's table to one call, it adds no rule.

## Milestones

### M1: Recorded fans in the gallery, every row at the floor (done 2026-11-05) GitHub: `P603 M1: Recorded fans`

Demo: `npm run gallery`: the RayFan TRA tile reads "Achromat, recorded" and draws phos-core's fans, in both themes and
palettes, at 1440, 1100 and 700 px; the Cooke triplet's 24° fans as a review image (draft `review-assets` release), their
dead tails as gaps (the clipped Cooke if the default has none); a map row at its `--row-min` with its frame at the floor. Proves: O1 to O4.

Each item unskips its own acceptance case (the commit hook refuses a source change with no test, so a separate unskip item ends empty: plan [#512], CR [#593]).

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#604] | O1 to O3 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/curve.test.js`, `tests/unit/scale.test.js`, `tests/gallery.spec.js`, `tests/unit/release.test.js` | the named cases, skipped citing their items |  |
| [#605] | `record-phos-core.py --only fans`: TransverseRayError of the achromat and the Cooke triplet, 41 samples, slice angle 0, the lens's sources and wavelengths (nm, as the other fixtures; the API gives µm); per source `{fieldAngleDeg, wavelengths, x: {points, statuses}, y: {points, statuses}}`, points `[pupil, error mm]` as recorded, statuses through one `status_name()` helper mapping the client's four classes to the Rust names `Alive`, `Virtual`, `Missed`, `Dead` (row M's rule; ray-visibility reuses it); refuses unequal shapes or a non-finite alive sample. If the default Cooke has no `Dead` sample, it also records the stop-clipped Cooke of phos-core's own test (stop aperture 0.65 × its normalization) as `cooke-clipped-fans.json`, and refuses to write unless that file has dead tails. Writes `tests/fixtures/phos-core/{achromat,cooke}-fans.json`; the README gains their rows, the merge sha of ELEOptics/phos-core#2167 as text, and a line that `wandersleb.toml`'s own header names phos's paths ([#356]) | dead samples kept with their status because the adapter, not the recorder, decides what draws, and a gap's position is data; considered dropping them as the footprint does, which loses where the gap is | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/README.md` | `tests/unit/phos-core-fixtures.test.js::recorded fans facts`: each fan `[wavelength][41]` with a `statuses` array of the same shape (the API ELEOptics/phos-core#2167 added), statuses in the four names, alive samples finite, a 40-hex sha | [#604] |
| [#606] | `ELEOAdapters.fans(rec)` → `{ panels, columns, x, y }` in `fanPanels`' shape: row T (`y` fan, Py) then row S (`x` fan, Px), a column per field titled `<angle>° · Py`, a series per wavelength, errors in µm, every non-`Alive` sample `null` (a virtual, missed or dead ray's error is not an image error), a symmetric y range by `fanPanels`' step rule (copied: adapters.js is a classic script and `fanPanels` is not on `ELEO`); unskips O1 | `fanPanels`' shape because the recorded tile then reads as today with only the data changed (kill criterion D on); considered `curve`'s auto range, which makes the scale asymmetric. The copied step rule is pinned by the test (oracle: reference `fan.js`), so drift fails | `tests/fixtures/phos-core/adapters.js` | `tests/unit/curve.test.js::recorded ray fans round trip (U6)`, which also asserts `y.range` equals `fanPanels`' rule on the same maximum | [#605] |
| [#607] | Gallery: the `rayFan` tile draws the recorded achromat through `curve` (`height` = width × `PLOT_SIZES.rayFan.aspect` / columns, as `rayFan` does), meta "Achromat, recorded, TRA, µm"; `rayFan-opd` stays on the sample | `curve` because the adapter gives curve panels, as the MTF tile does; considered `rayFan({ data })`, which takes only the sample's shape (non-goal) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::rayFan tile draws the recording`: its panel titles carry the recording's field angles and its path count is the adapter's series count; `rayFan` joins the `ownData` list of `a missing sample script blanks only the sample tiles` | [#606] |
| [#608] | map2d.js: `mapMargins(props)` → `{ L, R }` in text units, the margin loop of `typedMap` (value range, colorbar ticks and width `3 + 0.6 × widest label`, x-tick right margin, the padded-range iteration) factored out of it; `typedMap` calls it once | one function because `map2D` and `minWidth` must agree on every margin or the floor drifts (the x ticks of `cooke-psf.json`, "−0.05", widen R past 1.2, critic finding 4); considered `colorbarUnits(props)` alone, which misses the x-tick margin and makes `typedMap` scan the grid twice | `packages/plots/src/map2d.js` | `tests/unit/scale.test.js::mapMargins gives map2D's margins`: closed form for a linear and a log colorbar and a 5-character x tick; every existing map2D test unchanged | [#604] |
| [#609] | `minWidth(name, props)` in a new `sizes.js`: `F_LO + TEXT_MIN × (L + R) + (panels − 1) × panelStep`, margins from the renderer (`mapMargins` for map2D; curve's `scales(...)` right margin for the curve family; the table's otherwise), panels from `columns` or `panels.length`, a sample `rayFan`'s fields, a sample `throughFocus`'s defocus columns, 1 with no sample; unskips O2's unit case | a new file because `scale.js` is imported by `map2d.js` and `curve.js`, so importing them back is a cycle; considered `renderers.js`, which `README.md` says only assembles the API | `packages/plots/src/sizes.js`, `README.md` (the module list) | `tests/unit/scale.test.js::minWidth gives the floor frame (#587)`: the PSF and wavefront props drawn at `minWidth` have a frame of at least 162 px, and at 1 px less under it | [#608] |
| [#610] | Export `minWidth` on the module and the classic build's `window.ELEO`, typed in `index.d.ts` (Core); the plots README's `PLOT_SIZES` entry and `index.d.ts`'s comment point to it in place of their "9 px more per text unit" caveat | forced (Core: `index.d.ts` lists every public export; approved with the plan) | `packages/plots/src/index.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md` | `tests/types/sizes.ts` (with its `oracle:` line: a typed call compiles, a wrong name fails) and `tests/unit/types.test.js` | [#609] |
| [#611] | Gallery: `rowMins` from `ELEO.minWidth(data-size, the tile's props)`, `panelsOf` removed; the new floor test replaces the rayFan row's `#544` test, asserting the floor only where a tile's rendered width reaches its row's `--row-min` (the two-theme grid at 1440 and 700 px is narrower than a 3-column row needs, CR [#547]) and no sideways scroll elsewhere; unskips O2's floor case | the renderer's own count because a hand rule per renderer (`panelsOf`) is what let maps undercut; considered adding a colorbar case to `panelsOf` | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::rows give each frame the floor (#587)` | [#607], [#610] |
| [#555] reuse | U18's gallery test enumerates tiles by `data-size`, checked against every section holding a `[data-svg]` or `[data-map]` (so the equality is not tautological); the layout tiles gain `data-size="layout2D"`, `psf-recorded` and `irradiance-gaussian` gain `data-size="map2D"` (outside any `.row`, so `rowMins` changes no layout); no `FRAMED_TILES` / `LAYOUT_TILES` | the page as the list because a tile left out of a hand list is never checked; considered asserting the hand list equals the page, which still needs an edit per tile | `tests/gallery.spec.js`, `gallery/index.html` | `tests/gallery.spec.js::text follows ADR-0003 on every framed tile (U18)` | [#611] |
| [#598] reuse | plots-svelte peers `@eleoptics/plots >=0.8.0 <1` (package.json, the lock file, its README); changesets, one file per package (one body is written into every package it bumps, [#85]): `min-width.md` (plots minor) and `plots-svelte-peer-0.8.md` (patch); unskips O3 | forced ([#598]: plots 0.7 ignores `width`; PR [#511] merged plots 0.8.0, so `npm ci` resolves the raised peer) | `packages/plots-svelte/package.json`, `package-lock.json`, `packages/plots-svelte/README.md`, `.changeset/min-width.md`, `.changeset/plots-svelte-peer-0.8.md`, `tests/unit/release.test.js` | `tests/unit/release.test.js::row P changesets` and its consumed twin (reads the CHANGELOGs once `changeset version` ran, as row N's) | [#610] |
| [#613] | Review M1 findings 2 and 6: the missing-fixture table gains `['fans', 'achromat', ['rayFan']]`; the `--row-min` CSS comment names `ELEO.minWidth` | the table's own row because every other recorded tile has one; considered a separate test, which duplicates the loop | `tests/gallery.spec.js`, `gallery/index.html` | `tests/gallery.spec.js::a missing phos-core fixture blanks only its tiles` | [#555] |
| [#614] | Review M1 findings 3 and 4: `fan_axis` writes `null` for a non-finite non-`Alive` coordinate; `record_fans` deletes a stale `cooke-clipped-fans.json` when the default Cooke has a `Dead` sample | `null` because a dead sample's position is still data and the adapter nulls it anyway; considered refusing it, which stops a re-record over one dead ray | `scripts/record-phos-core.py`, `tests/unit/phos-core-fixtures.test.js` | `tests/unit/phos-core-fixtures.test.js::fan_axis keeps a non-Alive NaN as null and record_fans removes a stale clipped file` | [#605] |
| [#615] | Review M1 finding 5: `ELEOAdapters.fans` titles format the angle as `fanPanels`' `fmt` (U+2212 for a negative) | copied, as the step rule is, because adapters.js is a classic script; considered `fmt` on `ELEO`, a public API change | `tests/fixtures/phos-core/adapters.js`, `tests/unit/curve.test.js` | `tests/unit/curve.test.js::recorded ray fans round trip (U6)` with a negative-angle clone | [#606] |
| [#619] | CR [#618] (review M1 round 2, finding 1): the fixtures README's fans row names the `null` a non-finite non-`Alive` coordinate becomes, and the stale clipped file's deletion | the README row because it is the fixture format's one owner; considered the recorder's docstring alone | `tests/fixtures/phos-core/README.md`, `tests/unit/phos-core-fixtures.test.js` | `tests/unit/phos-core-fixtures.test.js::recorded fans facts` (every coordinate finite or `null`, `null` only off `Alive`) | [#614] |
| [#620] | Review M1 round 3 findings 1 and 2: the recorder's `fans` docstring names [#614]'s `null` and the clipped file's deletion; the README fans row's paraxial parenthetical follows `x_fan()`/`y_fan()` | both in one item because both restate [#614]'s facts where the fans are described; considered the README alone, which leaves the script's header stale | `scripts/record-phos-core.py` (docstring), `tests/fixtures/phos-core/README.md` | none: docs only (not source under `SRC_RE`) | [#619] |

### M2: Chief-ray fans, full-width gallery GitHub: `P603 M2: Chief-ray fans, full-width gallery`

From the user's no-go at the M1 demo (2026-11-05): CRs [#621] (the fans relative to the chief ray) and [#622] (every gallery tile full width, the light theme then the dark), both accepted by the user.

Demo: `npm run gallery`: every tile is alone on its line across the page, all light tiles then all dark ones; resizing the window redraws each at that width, and below its minimum a tile scrolls inside itself. The RayFan TRA tile draws the achromat relative to the chief ray (the reference wavelength crosses 0 at pupil 0 in every field); the Cooke's fans as a review image, on their aberration scale. Proves: O1 (chief ray), O2 (the floor in the new layout), O4.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#623] | The fan fixtures name `referenceWavelengthNm` (587.562 nm achromat, 550 nm Cooke), re-recorded at `e0f14aa` with points and statuses unchanged; the recorder refuses one not among every source's wavelengths; the README row names it | read where the wavefront and footprint recorders read it, so every fixture of a lens agrees; considered the adapter picking the middle wavelength, right for the Cooke by accident | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/{achromat,cooke,cooke-clipped}-fans.json`, `tests/fixtures/phos-core/README.md`, `tests/unit/phos-core-fixtures.test.js` | `tests/unit/phos-core-fixtures.test.js::recorded fans facts` | [#620] |
| [#624] | `ELEOAdapters.fans` subtracts each field's chief-ray error (the pupil-0 sample at `referenceWavelengthNm`, per axis) from every sample; a non-`Alive` chief ray throws; the tile meta names the chief ray | the reference wavelength's chief ray because that is the ray-fan convention and keeps lateral color; considered each wavelength's own chief ray, which hides it | `tests/fixtures/phos-core/adapters.js`, `tests/unit/curve.test.js`, `gallery/index.html` (meta), `tests/gallery.spec.js` (meta) | `tests/unit/curve.test.js::recorded ray fans round trip (U6)` (oracle: the recording minus the chief ray) | [#623] |
| [#627] | CR [#626] (from [#625]): `tests/map2d.spec.js::recorded wavefront cells (U8)` draws its injected tile at a fixed 650 px, so the full-width gallery doesn't push its ticks past the 2 px margin; the pixel oracle is unchanged | a fixed width because the test checks cells, not layout; considered widening the excluded margin, which loosens the oracle | `tests/map2d.spec.js` | `tests/map2d.spec.js::recorded wavefront cells (U8)` in both layouts | [#624] |
| [#625] | The gallery: every tile alone on its line at the page width, the light section then the dark; below its `ELEO.minWidth` a tile draws at that minimum and scrolls inside itself, never the page | one tile per line because resizing then shows every plot at every width (the user's ask); considered rows with a one-column option, two layouts to test | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::every tile is the page width, the light theme before the dark (#622)`, `tests/gallery.spec.js::every tile at its minimum has the floor frame (#587)` | [#624], [#627] |

End of plan (orchestrator, not a work item): the roadmap's U6 text and oracle name the recorded fans; row P done.

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| Building phos-core's Python client (cargo, minutes) | the recorder item is slow | the recorder's header documents `dev.sh`; a local checkout exists |
| Recorded scale differs from the sample's (another full scale, other aberrations) | the tile's look changes beyond data | that is data (the kill criterion allows it); approved at the demo |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-05 round 1 (user): buckets confirmed (absorb [#555], [#587], [#356], [#598]); the achromat replaces the sample TRA tile; one milestone; [#587] through `PLOT_SIZES` (Core), not a gallery allowance.
- 2026-11-05 round 2 (user): the colorbar minimum as `minWidth(name, props)`, exact for any labels (+2 items, Core `index.d.ts`); pre-mortem: dead rays must be seen once, so the M1 demo shows the Cooke 24° fans as a review image.
- 2026-11-05 critique (general-purpose, claude-fable-5-1): all 17 findings accepted. 1: the default Cooke likely has no dead fan sample (its footprint loss is the grid's corners), so the recorder records the stop-clipped Cooke when needed; 2: the sha check is structural (the `statuses` arrays), the merge sha goes in the README; 3: four status names through one helper, the adapter nulls every non-`Alive` sample; 4 and 15: `colorbarUnits` became `mapMargins` (the x-tick margin was missing); 5: the floor test asserts only where a row reaches its minimum and replaces the `#544` test; 6: `rayFan` joins `ownData`; 7: `psf-recorded` and `irradiance-gaussian` gain `data-size`; 8: no sample counts one panel; 9: roadmap edits at plan end; 10: lock file and plots-svelte README in [#598]'s Files, the user merges; 11: two changesets and a consumed twin; 12: README docs in items 6 and 7; 13: the copied step rule pinned against `fan.js`, wavelengths in nm; 14: the types test's `oracle:` line; 16: `sizes.js` kept, its cell now cites `README.md`; 17: no change.
- 2026-11-05 orchestrator: [#605]'s clipped-Cooke trigger is "no `Dead` sample", not "no non-`Alive` sample" (the default Cooke's 24° y fan has 9 `Virtual` samples and no `Dead` one; the Constraints, the M1 demo and round 2's pre-mortem ask for dead tails).
- 2026-11-05 review M1 round 1 (code-reviewer, claude-opus-5-5): 0 blocking, 7 backlog. Findings 2 to 6 are small and named, pulled into M1 as [#613], [#614], [#615]; finding 1 ([#616], the rayFan footer) is for the M1 demo; finding 7 ([#617]) stays backlog.
- 2026-11-05 review M1 round 2 (code-reviewer, claude-opus-5-5): 1 blocking (the fixtures README after [#614]), filed as CR [#618], accepted by the orchestrator (a non-Core doc, every invariant kept), item [#619].
- 2026-11-05 review M1 round 3 (code-reviewer, claude-opus-5-5): 0 blocking, 2 backlog; CR [#618] resolved. Both findings small and named, pulled into M1 as [#620].
- 2026-11-05 review M1 round 4 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in; M1 ticked (rounds: 0+3, 1, 0+1, 0). Awaiting the user's M1 demo (O4).
- 2026-11-05 M1 demo (user): no-go. "No go. use the chief ray. Additionally, in the gallery, make every plot have its own full space across the width of the page. That way, resizing the page allows me to see them all at different sizes / scales. The color schemes can be shown one after the other (i.e. first all the light theme, then all the dark theme)". CRs [#621] and [#622], accepted by the user; M2 with items [#623], [#624], [#625]. The orchestrator chose the reference wavelength's chief ray (the ray-fan convention) over each wavelength's own.
- 2026-11-05 [#625] returned a CR: the full-width layout breaks `map2d.spec.js`'s U8 wavefront test (its ticks pass its 2 px margin). CR [#626] accepted by the orchestrator (test only, the oracle unchanged); item [#627] runs before [#625], whose first attempt is discarded.

[#355]: https://github.com/ELEOptics/eleo-ui/issues/355
[#356]: https://github.com/ELEOptics/eleo-ui/issues/356
[#368]: https://github.com/ELEOptics/eleo-ui/issues/368
[#385]: https://github.com/ELEOptics/eleo-ui/issues/385
[#464]: https://github.com/ELEOptics/eleo-ui/issues/464
[#511]: https://github.com/ELEOptics/eleo-ui/issues/511
[#512]: https://github.com/ELEOptics/eleo-ui/issues/512
[#527]: https://github.com/ELEOptics/eleo-ui/issues/527
[#547]: https://github.com/ELEOptics/eleo-ui/issues/547
[#554]: https://github.com/ELEOptics/eleo-ui/issues/554
[#555]: https://github.com/ELEOptics/eleo-ui/issues/555
[#587]: https://github.com/ELEOptics/eleo-ui/issues/587
[#593]: https://github.com/ELEOptics/eleo-ui/issues/593
[#598]: https://github.com/ELEOptics/eleo-ui/issues/598
[#603]: https://github.com/ELEOptics/eleo-ui/issues/603
[#604]: https://github.com/ELEOptics/eleo-ui/issues/604
[#605]: https://github.com/ELEOptics/eleo-ui/issues/605
[#606]: https://github.com/ELEOptics/eleo-ui/issues/606
[#607]: https://github.com/ELEOptics/eleo-ui/issues/607
[#608]: https://github.com/ELEOptics/eleo-ui/issues/608
[#609]: https://github.com/ELEOptics/eleo-ui/issues/609
[#610]: https://github.com/ELEOptics/eleo-ui/issues/610
[#611]: https://github.com/ELEOptics/eleo-ui/issues/611
[#612]: https://github.com/ELEOptics/eleo-ui/issues/612
[#613]: https://github.com/ELEOptics/eleo-ui/issues/613
[#614]: https://github.com/ELEOptics/eleo-ui/issues/614
[#615]: https://github.com/ELEOptics/eleo-ui/issues/615
[#616]: https://github.com/ELEOptics/eleo-ui/issues/616
[#617]: https://github.com/ELEOptics/eleo-ui/issues/617
[#618]: https://github.com/ELEOptics/eleo-ui/issues/618
[#619]: https://github.com/ELEOptics/eleo-ui/issues/619
[#620]: https://github.com/ELEOptics/eleo-ui/issues/620
[#621]: https://github.com/ELEOptics/eleo-ui/issues/621
[#622]: https://github.com/ELEOptics/eleo-ui/issues/622
[#623]: https://github.com/ELEOptics/eleo-ui/issues/623
[#624]: https://github.com/ELEOptics/eleo-ui/issues/624
[#625]: https://github.com/ELEOptics/eleo-ui/issues/625
[#626]: https://github.com/ELEOptics/eleo-ui/issues/626
[#627]: https://github.com/ELEOptics/eleo-ui/issues/627
[#85]: https://github.com/ELEOptics/eleo-ui/issues/85
