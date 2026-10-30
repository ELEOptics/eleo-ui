# Plan #389: `map2D` on typed grids

Status: approved 2026-10-30
Branch: `plan/389-map2d-typed` PR: #409 Depends on: none Roadmap: `agent_docs/roadmap.md`, row F

## Problem

`map2D` draws only the sample's PSF and wavefront through an analysis `kind`, so phos can't draw a phos-core PSF or
wavefront with it. Row F gives it a typed grid (extent, values, masked cells, linear or log, sequential or diverging)
and rebuilds the gallery's map tiles from phos-core results. It was blocked on a recorded PointSpread until
phos-core plan 1799 (2026-10-30) put PointSpread in the Python client.

## Ground truth

- `packages/plots/src/map2d.js` (canvas, 25 lines): `kind` "psf" (sample `D.psf[i].img`, n × n, linear or a fixed
  4-decade log) or "wavefront" (sample `D.wavefront.map`, null masked, symmetric range, clipped to a circle with an
  axis ring). Draws the grid to an offscreen n × n canvas, then scales it to `size` (default 320) with high-quality
  smoothing. Returns `{ lo, hi }`. Maps: ember, wave (theme tokens `--map-*-0..8`), viridis, gray (`color.js`).
- `Map2DProps` in `index.d.ts:146` (Core): `data`, `kind`, `map`, `scale`, `index`, `size`. No typed call yet.
- `plots-svelte`: `Map2D.svelte` passes props through and binds `range`; `Colorbar.svelte` takes `map` and
  caller-written `labels`.
- Gallery: two Map2D tiles (`psf`, `wavefront`) on the sample, with hard-coded colorbar labels (`1 0`, `+ 0 −`).
  Only test: `tests/gallery.spec.js::canvas maps follow their theme` (a corner pixel per theme). Canvas needs a
  browser, so map tests are Playwright, not vitest.
- phos-core Python client (main, after plan 1799):
  - `PointSpreadSettings.run(model)` → per source `PointSpread`: `num_x`, `num_y`, `coordinates()` (image-plane mm,
    row-major) and `irradiance()` (flat, same order), `wavelengths()`. A real grid.
  - `WavefrontErrorSettings.run(model)` → per source `WavefrontError`: `results()` per wavelength, a list of
    `(pupil x, pupil y, OPD waves)` points; `pupil_radius()`, `statistics()`. Whether the list is a full rectangular
    grid with NaN outside the pupil or only the live samples is not documented (assumption A1).
  - `ModulationTransfer2d`: `tangential()` and `sagittal()` lists of 2D points: curves, not a grid. The roadmap's
    "2D MTF" map has no phos-core source.
  - Irradiance: `Detector.total_irradiance()` from a `NonsequentialRayTrace`: needs a nonsequential model, which the
    recorder has never built.
- `scripts/record-phos-core.py` records with `--only seidel|layout`; fixtures and their README in
  `tests/fixtures/phos-core/`; gallery adapters in `tests/fixtures/phos-core/adapters.js`.
- U14 harness: `tests/perf.spec.js`, `PERF=1`, median of 20 redraws, reported not asserted.
- ADR-0001: roles, not colors; named colormaps are an exempt literal. `map` names a colormap, not a series color.
- Prior art: no library needed. Canvas `ImageData` is the drawing; culori (dev dependency) is not needed.
## Outcomes

Grid convention for every outcome: `values[row][col]`, row 0 at the top of `extent` (its largest y), as an image and as
phos-core's Detector (A2). A cell is masked when its value is null or NaN.

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `map2D(props)` takes a typed grid (`values`, `extent`, `x`/`y` as `CurveAxis`, `map`, `el`, `width`, `height`) and returns SVG: curve's frame and ticks, the grid as one `<image>` drawn nearest-neighbour at equal px per unit on x and y, its colors read from `el`'s tokens; the gallery's PSF tile is built from a recorded phos-core PointSpread, per theme column | given the recorded Cooke PointSpread at 0 deg, when drawn, then the image maps `extent` onto the plot area within 0.5 px with px per mm equal on x and y, row 0 at the top, and each cell's pixel in the decoded image is its value's step in `colormap(map, el)`; a masked cell is alpha 0 in the image and `--surface` on the composited page; the light and dark columns' images differ as their tokens do | `fixture: phos-core PointSpread recorded by scripts/record-phos-core.py` (roadmap U8) | `tests/map2d.spec.js::recorded PSF cells (U8)` |
| O2 | `scale: "log"` over `decades` (default 4); a range symmetric about 0 for `wave`; an `aperture` circle that cuts the grid's edge round and draws its ring; a colorbar right of the plot with nice ticks, the value's label and unit; the gallery's wavefront tile from a recorded WavefrontError, a log PSF tile, and an irradiance tile from a Gaussian beam | given the recorded Cooke WavefrontError, when drawn with `wave` and its pupil as `aperture`, then each live cell inside the circle is its value's step on [−m, m] and every pixel outside the circle is `--surface`; given values 10^−k on a D-decade log scale, each draws step (D − k)/D, and values at or below 10^−D of the max (zeros included) draw step 0; each colorbar tick sits at its value within 0.5 px; each Gaussian cell is the step of exp(−2r²/w²) | `fixture: phos-core WavefrontError recorded by scripts/record-phos-core.py (NaN-masked)` (roadmap U8); `property: log steps, colorbar tick round trip`; `closed-form: TEM00 irradiance exp(−2r²/w²)` | `tests/map2d.spec.js::recorded wavefront cells (U8)`, `::log decades`, `::colorbar ticks`, `::gaussian irradiance tile` |
| O3 | the typed call reaches Svelte (`<Map2D values extent … />`), the sample call `map2D(canvas, { kind })` draws what it drew at the row's start, and a release is planned | `svelte-check` passes a `<Map2D>` with typed props; the sample PSF and wavefront canvases match the PNGs recorded from main's build in both themes; changesets plan a plots minor and a plots-svelte minor, the peer at `>=0.5.0`, and the CHANGELOGs carry them once consumed | `spec roadmap Constraints (typed API alongside the old; release on consumer pull)`; `fixture: sample canvas PNGs recorded by scripts/record-map2d-baseline.mjs from main's build at the plan's base` | `npm run check` (`svelte-check`, in `check.sh`), `tests/map2d.spec.js::sample call unchanged`, `tests/unit/release.test.js::map2D changeset asks minors`, `::map2D changeset became minors` |

U14 (roadmap): the typed `map2D` at 256 × 256, median of 20 redraws, PNG encode and markup (the harness forces layout,
not the image's decode), recorded in the Change log (a measurement, not a gate; kill criterion D–J / U14 applies).

## Non-goals

- 2D MTF map: phos-core's `ModulationTransfer2d` is tangential and sagittal curves, which `curve` already draws (user,
  round 1). At publish, row F's scope and U8 drop "2D MTF" and say irradiance is a synthetic Gaussian tile.
- Recorded irradiance: needs a nonsequential trace with a Detector (user, round 1). Next plan if phos asks.
- Hover, zoom and a readout on maps: row H. Export: row I (the single SVG embeds the PNG already).
- Drawing the typed map on the server: the image needs a canvas, so `Map2D.svelte` draws in `$effect`, as today.
- A shared U14 harness ([#281]): F adds its measurement the existing way.
- New colormap names: the typed call keeps ember, wave, viridis and gray (user, round 1).

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| [#333] | absorb | `#333 reuse` in M3: plots-svelte peer `>=0.5.0` (0.5.0 is on npm) |
| [#310] | absorb | M1's recorder-guard item, in the script M1 extends |
| [#370] | absorb | M1's recorder-guard item, same script |
| [#387] | absorb | M3's U14 item: assert the layout2D benchmark takes the moved-starts path |
| [#281] | related | shared U14 harness; deferred until a review asks |
| [#257] | related | typed-array ranges in `curve`; `map2D`'s grid takes plain arrays |

## Constraints and assumptions

- Roadmap Constraints: the typed API sits alongside `kind` (J removes it); U14 budget; every tile keeps working.
- A1: `WavefrontError.results()` is either a full grid with NaN outside the pupil or the live samples only. The
  recorder finds which and writes a full row-major grid with `null` outside, plus `pupilRadius`, either way, at the
  reference wavelength only (the tile draws that one, as the adapters' `atRef` does).
- A2: row 0 of `values` is the top of `extent`. The recorder writes rows top-down whatever phos-core's order is, and its
  test checks it against `coordinates()`.
- The typed map's colors are baked into its PNG at draw time from `el`'s tokens, like today's canvas maps: a theme or
  palette change redraws it (`Map2D.svelte` already redraws on `themeTick`; the gallery draws it per column with that
  column's tile).
- Fixture size: one source (0 deg) per lens, PointSpread at pupil 64, pad 64 (a 128 × 128 grid), about 100 kB per
  file at 6 significant digits; the README row states it.
- [#333] edits `packages/plots-svelte/package.json`, a dependency manifest: a security trigger, so `director/merge.sh`
  refuses and the user merges this PR.
- Public lenses only: the achromat and the Cooke triplet.

## Decisions

ADR-0001 holds: `map` names a colormap (exempt literals), not a series color; the frame is curve's `plotCell`. No new
ADR: the single-SVG shape (round 2) follows `curve` and `bars`, which return markup. Core change: `index.d.ts` gains
`Map2DGridProps` (with `el?: Element`) and `map2D(props: Map2DGridProps): string` beside the canvas call (approved with
the plan).

## Milestones

`After` cites work-item issues.

### M1: a recorded PSF through the typed SVG map GitHub: `P389 M1: typed map, recorded PSF`

Demo: `npm run gallery`; the PSF tile is the recorded Cooke PSF at 0 deg, crisp cells, mm ticks on both axes, square
cells, right in both theme columns; `python3 scripts/record-phos-core.py --phos <client> --only maps` writes the four
grid files and refuses a swapped Seidel or Cassegrain order. Proves: O1

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #390 | O1 acceptance tests, skipped; the sample-call baseline recorded from main's build and its test, live | forced (`workflow.md`, TDD: the first item writes them skipped); the baseline is recorded before `map2d.js` changes because O3's oracle is the row's start, as `record-renderers.mjs` did for plan 162 | `tests/map2d.spec.js`, `scripts/record-map2d-baseline.mjs` (+ `tests/fixtures/map2d-baseline.json`) | `tests/map2d.spec.js::recorded PSF cells (U8)` (skipped), `::sample call unchanged` | |
| #391 | Recorder `--only maps`: PointSpread (pupil 64, pad 64) and WavefrontError (pupil 64, reference wavelength) at 0 deg for the achromat and the Cooke, as `<lens>-psf.json` and `<lens>-wavefront.json` (rows top-down, `extent` mm, null outside the pupil, `pupilRadius`); README rows with sizes | `--only` because it re-records nothing else at the new sha, as seidel and layout did; considered re-recording every analysis, which rewrites committed fixtures for no outcome | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/README.md` | `tests/unit/phos-core-fixtures.test.js::psf and wavefront recorded as grids` | |
| #392 | Recorder guards, absorbed [#310], [#370]: Seidel term length against the surface count; the Cassegrain obscuration told from the secondary by its flat profile, not by sd | one item because both are refusals in the script item 2 opens; considered a later plan, which reopens the file for two lines | `scripts/record-phos-core.py` | `tests/unit/phos-core-fixtures.test.js::recorder guards refuse bad orders` | #391 |
| #393 | `Map2DGridProps` (`values`, `extent: [x0, x1, y0, y1]`, `x`/`y: CurveAxis`, `map`, `scale`, `decades`, `range`, `aperture`, `value: CurveAxis` for the colorbar, `el`, `width`, `height`, `label`) and the typed `map2D(props): string` overload; the plots README's map section and the "canvas renderers" sentences (`README.md:21`, the `index.d.ts`/`index.js` headers) say the typed map is SVG with a baked image | forced (Core: `index.d.ts`, approved with the plan); considered a separate `map` export, refused because U8 names `map2D` | `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `tests/types/map2d.ts` | `tests/unit/types.test.js::map2D typed grid type-checks` | |
| #394 | Typed `map2D(props)`: cells through `colormap(map, el)` (physics.js) into one offscreen canvas, `toDataURL`, placed in px after `plotCell`'s frame (`body: ""`) as `<image x=X(x0) y=Y(y1) width height style="image-rendering: pixelated">`; the axes' ranges are the extent padded on the shorter side so px per unit is equal, ticks by `niceTicks` over the padded ranges; masked cells alpha 0, so the tile's `--surface` ground shows through; linear over [min, max]. Invocation: `map2D({ values, extent: [-0.02, 0.02, -0.02, 0.02], x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, map: 'ember', el })` → `<svg viewBox="0 0 460 360" role="img" aria-label="Map">` with the frame, ticks and one `<image>` | one `<image>` because a rect per cell is 65 536 elements at 256²; in px, not in plotCell's data group, because that group flips y and would draw row 0 at the bottom; considered `<foreignObject>` with a canvas, which breaks standalone SVG (row I); masked cells alpha 0 rather than baked `--surface` (user, approval: one token read and one baked color fewer) | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::typed map places its extent` | #390, #393 |
| #395 | Gallery PSF tile from the recorded Cooke PointSpread through an adapter, drawn per theme column with the tile as `el`; `gallery.spec.js`'s tile list, `ownData`, missing-fixture loop and the theme test move to the typed map (corner pixel of the decoded image per column) | an adapter in `adapters.js` because the recorded tiles go through it ([#226]); considered inlining in the gallery page, which the other recorded tiles moved away from | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::recorded PSF tile draws`, `::maps follow their theme` | #391, #394 |
| #396 | Unskip O1 acceptance tests | forced (`workflow.md`, TDD: the last item unskips them) | `tests/map2d.spec.js` | `tests/map2d.spec.js::recorded PSF cells (U8)` | all above |

### M2: scales, aperture, colorbar; wavefront, log and irradiance tiles GitHub: `P389 M2: scales, colorbar, wavefront`

Demo: the wavefront tile is the recorded Cooke wavefront, a round pupil with its ring, diverging map, a colorbar in
waves; a log PSF tile; a Gaussian irradiance tile marked synthetic; both themes and the three palettes. Proves: O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #397 | O2 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/map2d.spec.js` | `::recorded wavefront cells (U8)`, `::log decades`, `::colorbar ticks`, `::gaussian irradiance tile` (skipped) | #396 |
| #398 | `scale: "log"` with `decades` (default 4) below the max, values at or under max·10^−D (zeros, negatives) at step 0; a range symmetric about 0 when `map` is `wave`; `range` overrides | symmetric only for `wave` because a diverging map's middle step means 0; considered a `symmetric` flag, an option no caller asked for | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::log decades` | #397 |
| #399 | `aperture: { x, y, r }` in extent units: an even-odd `--surface` path over the image outside the circle and a 1 px `--plot-axis` ring | the mask cuts the nearest-neighbour stair edge of the null cells round (the round pupil the user asked for, round 2), and covers grids that come unmasked; an even-odd path because it needs no `clipPath` id (ADR-0001); considered the ring alone, which leaves the stair edge | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::aperture masks outside` (on an unmasked grid and on the recorded wavefront) | #398 |
| #400 | Colorbar right of the plot (the frame's right margin widened for it): the LUT as a 1 × 256 `<image>`, `niceTicks` over the range (whole decades on log), `value`'s label and unit | reuse `niceTicks` (axis.js) as curve does; 256 steps because nine stop rects show bands the map doesn't have; considered `Colorbar.svelte`, which serves only Svelte (round 2 put the bar in the SVG) | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::colorbar ticks` | #399 |
| #401 | Gallery wavefront tile (recorded Cooke WavefrontError, `wave`, its pupil as `aperture`) and a log PSF tile; `gallery.spec.js`'s tile count and lists | an adapter, as item 6's (the recorded tiles go through `adapters.js`, [#226]) | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::recorded wavefront tile draws` | #391, #400 |
| #402 | Gallery irradiance tile: a TEM00 Gaussian (w = 1 mm, 128² over ±2 mm), meta "synthetic"; the tile count | closed form because phos-core's irradiance needs a nonsequential trace (Non-goals); considered sample data, which has no irradiance | `gallery/index.html`, `tests/gallery.spec.js` | `tests/map2d.spec.js::gaussian irradiance tile` | #401 |
| #403 | Unskip O2 acceptance tests | forced (`workflow.md`, TDD) | `tests/map2d.spec.js` | all O2 tests | all above |

### M3: Svelte, U14 and the release GitHub: `P389 M3: Svelte and release`

Demo: the plots-svelte README's `<Map2D>` line and `npm run check` green on it; `npx changeset status` plans plots and
plots-svelte minors; the U14 median in the Change log. Proves: O3

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #404 | O3 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/unit/release.test.js` | `::map2D changeset asks minors`, `::map2D changeset became minors` (skipped) | #403 |
| #405 | `Map2D.svelte` takes the typed props: given `values` it renders the returned SVG with `{@html}` in `$effect` after `themeTick`, its host `<div>` as `el`; else the canvas, as today. Invocation: `<Map2D values={grid} extent={[-2, 2, -2, 2]} x={{ label: 'x', unit: 'mm' }} y={{ label: 'y', unit: 'mm' }} map="wave" label="Wavefront" />` → `div.eleo-svg[role=img]` holding the SVG. README (root and plots-svelte) show it | one component because phos imports `Map2D` already; considered a `MapPlot.svelte`, a second name for one renderer | `packages/plots-svelte/src/lib/Map2D.svelte`, `packages/plots-svelte/README.md`, `README.md` | `npm run check` (`svelte-check` on `Map2DGridProps`) | #404 |
| #406 | U14 for the typed `map2D` at 256 × 256 (encode and markup); absorbs [#387]: assert the layout2D benchmark takes the moved-starts path | forced ([#281] deferred: F adds its measurement the existing way) | `tests/perf.spec.js` | `tests/perf.spec.js::map2D redraw (U14)` | #404 |
| #333 reuse | plots-svelte peer `@eleoptics/plots` `>=0.5.0 <1` and a patch changeset | forced ([#333]'s Do: 0.5.0 is on npm; the workspace's plots is 0.5.0, so `npm ci` resolves) | `packages/plots-svelte/package.json`, `.changeset/` | `tests/unit/release.test.js::plots-svelte peers plots >=0.5.0` | #404 |
| #407 | Changesets: plots minor (typed `map2D`) and plots-svelte minor (`Map2D` typed props) | forced (roadmap Constraints: release on consumer pull, planned by changesets) | `.changeset/` | `tests/unit/release.test.js::map2D changeset asks minors` | #405, #333 |
| #408 | Unskip O3 acceptance tests | forced (`workflow.md`, TDD) | `tests/unit/release.test.js` | all O3 tests | all above |

20 items over 3 milestones: above the 15-item guideline because round 1 added axes and an irradiance tile and round 2
the colorbar and aperture; none is cut to fit.
## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| PNG encode per redraw at 256² misses 16 ms | U14, kill criterion D–J / U14 | measured in M3; the fallback is `createImageBitmap` plus a blob URL, no dependency |
| A1: WavefrontError gives only live samples, unordered | the recorder can't form a grid without a sampling rule | item 2 bins by pupil coordinates at the set sampling; a CR if the samples aren't on a grid |
| Nearest-neighbour makes a 128² PSF blocky | the demo rejects the look | the user chose nearest (round 2); the oracle needs it |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-30 round 1 (user): buckets as proposed (absorb #333, #310, #370, #387; #281, #257 related). 2D MTF cut
  (phos-core's is curves). Irradiance kept as a gallery tile on synthetic data. Full axes on maps (ticks and labels in
  curve's frame), not just the extent. The typed call keeps the four map names (ember, wave, viridis, gray).
- 2026-10-30 round 2 (user): one SVG (typed `map2D(props)` returns markup with the grid as an `<image>` in curve's
  frame); colorbar inside the SVG with nice ticks; cells drawn nearest-neighbour. Pre-mortem: losing the wavefront's
  round pupil and a fixed size would disappoint, so `aperture` and `width`/`height` with equal x and y scale are in.
- 2026-10-30: critique (general-purpose, claude-fable-5-1)
  - 1: accepted: `el` on the typed props; tiles pass their own element.
  - 2: accepted: the `<image>` is placed in px after the frame.
  - 3: accepted: the gallery items list `tests/gallery.spec.js` and its edits.
  - 4: accepted: the extent is padded on the shorter axis; the colorbar widens the right margin.
  - 5: accepted: the sample baseline is PNGs recorded from main's build by a script.
  - 6: accepted: one source per lens, size in the README.
  - 7: rejected: the mask cuts the null cells' stair edge round, which the ring alone doesn't; tested on an unmasked grid too.
  - 8: accepted: log floor at max·10^−D.
  - 9: accepted: reference wavelength only.
  - 10: accepted: the guards move to M1 after the recorder item.
  - 11: accepted: `svelte-check` is the Svelte test; the demo is the README line.
  - 12: accepted: the irradiance wording joins the roadmap edit at publish.
  - 13: accepted: READMEs and the canvas-renderer sentences added to Files.
  - 14: accepted: `colormap(map, el)` and `CurveAxis` reused.
  - 15: accepted: invocations and outputs added.
  - 16: accepted: `tests/types/map2d.ts` added.
  - 17: accepted: the `became` twin named.
  - 18: accepted: security trigger noted in Constraints.
  - 19: accepted: U14 measures encode and markup.
  - 20: contested; the user chose alpha 0 at approval.
  - 21: rejected: 256 steps; nine rects band.
  - 22: accepted: the U14 cell is `forced`; item 12 cites item 6.
- 2026-10-30 approval (user): plan and oracles O1–O3 approved; masked cells alpha 0 (finding 20).
