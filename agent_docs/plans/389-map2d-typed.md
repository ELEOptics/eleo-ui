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
| O2 | `scale: "log"` over `decades` (default 4); a range symmetric about 0 for `wave`; an `aperture` circle that cuts the grid's edge round and draws its ring; a colorbar right of the plot with nice ticks, the value's label and unit; the gallery's wavefront tile from a recorded WavefrontError, a log PSF tile, and an irradiance tile from a Gaussian beam | given the recorded Cooke WavefrontError (polar samples, CR #410), when drawn with `wave` and its pupil as `aperture`, then each sample's annular sector is its value's step on [−m, m] and every pixel outside the circle is `--surface`; given values 10^−k on a D-decade log scale, each draws step (D − k)/D, and values at or below 10^−D of the max (zeros included) draw step 0; each colorbar tick sits at its value within 0.5 px; each Gaussian cell is the step of exp(−2r²/w²) | `fixture: phos-core WavefrontError recorded by scripts/record-phos-core.py (64 rings × 64 spokes)` (roadmap U8); `property: log steps, colorbar tick round trip`; `closed-form: TEM00 irradiance exp(−2r²/w²)` | `tests/map2d.spec.js::recorded wavefront cells (U8)`, `::log decades`, `::colorbar ticks`, `::gaussian irradiance tile` |
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
- A1 (resolved by CR #410): `WavefrontError.results()` is 64 rings × 64 spokes of live polar samples, no NaN. The
  recorder writes them as `{ radii, angles, values[ring][spoke], pupilRadius }`, at the reference wavelength only (the
  tile draws that one, as the adapters' `atRef` does), and the typed `map2D` draws each as an annular sector.
- A2: row 0 of `values` is the top of `extent`. The recorder writes rows top-down whatever phos-core's order is, and its
  test checks it against `coordinates()`.
- The typed map's colors are baked into its PNG at draw time from `el`'s tokens, like today's canvas maps: a theme or
  palette change redraws it (`Map2D.svelte` already redraws on `themeTick`; the gallery draws it per column with that
  column's tile).
- Fixture size: one source (0 deg) per lens, PointSpread at pupil 64, pad 64 (a 192 × 192 grid: the pad adds to the
  sampling, CR #410), about 440 kB per file at 6 significant digits; the README row states it.
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

### M1: a recorded PSF through the typed SVG map (done 2026-10-30) GitHub: `P389 M1: typed map, recorded PSF`

Demo: `npm run gallery`; the PSF tile is the recorded Cooke PSF at 0 deg, crisp cells, mm ticks on both axes, square
cells, right in both theme columns; `python3 scripts/record-phos-core.py --phos <client> --only maps` writes the four
grid files and refuses a swapped Seidel or Cassegrain order. Proves: O1

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #390 | O1 acceptance tests, skipped; the sample-call baseline recorded from main's build and its test, live | forced (`workflow.md`, TDD: the first item writes them skipped); the baseline is recorded before `map2d.js` changes because O3's oracle is the row's start, as `record-renderers.mjs` did for plan 162 | `tests/map2d.spec.js`, `scripts/record-map2d-baseline.mjs` (+ `tests/fixtures/map2d-baseline.json`) | `tests/map2d.spec.js::recorded PSF cells (U8)` (skipped), `::sample call unchanged` | |
| #411 | Recorder `--only maps`: PointSpread (pupil 64, pad 64: 192 × 192) at 0 deg for the achromat and the Cooke, as `<lens>-psf.json` (rows top-down, `extent` mm); README rows with sizes (split from #391, CR #410) | `--only` because it re-records nothing else at the new sha, as seidel and layout did; considered re-recording every analysis, which rewrites committed fixtures for no outcome | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/README.md` | `tests/unit/phos-core-fixtures.test.js::psf recorded as grids` | |
| #392 | Recorder guards, absorbed [#310], [#370]: Seidel term length against the surface count; the Cassegrain obscuration told from the secondary by its flat profile, not by sd | one item because both are refusals in the script item 2 opens; considered a later plan, which reopens the file for two lines | `scripts/record-phos-core.py` | `tests/unit/phos-core-fixtures.test.js::recorder guards refuse bad orders` | #411 |
| #393 | `Map2DGridProps` (`values`, `extent: [x0, x1, y0, y1]`, `x`/`y: CurveAxis`, `map`, `scale`, `decades`, `range`, `aperture`, `value: CurveAxis` for the colorbar, `el`, `width`, `height`, `label`) and the typed `map2D(props): string` overload; the plots README's map section and the "canvas renderers" sentences (`README.md:21`, the `index.d.ts`/`index.js` headers) say the typed map is SVG with a baked image | forced (Core: `index.d.ts`, approved with the plan); considered a separate `map` export, refused because U8 names `map2D` | `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `tests/types/map2d.ts` | `tests/unit/types.test.js::map2D typed grid type-checks` | |
| #394 | Typed `map2D(props)`: cells through `colormap(map, el)` (physics.js) into one offscreen canvas, `toDataURL`, placed in px after `plotCell`'s frame (`body: ""`) as `<image x=X(x0) y=Y(y1) width height style="image-rendering: pixelated">`; the axes' ranges are the extent padded on the shorter side so px per unit is equal, ticks by `niceTicks` over the padded ranges; masked cells alpha 0, so the tile's `--surface` ground shows through; linear over [min, max]. Invocation: `map2D({ values, extent: [-0.02, 0.02, -0.02, 0.02], x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, map: 'ember', el })` → `<svg viewBox="0 0 460 360" role="img" aria-label="Map">` with the frame, ticks and one `<image>` | one `<image>` because a rect per cell is 65 536 elements at 256²; in px, not in plotCell's data group, because that group flips y and would draw row 0 at the bottom; considered `<foreignObject>` with a canvas, which breaks standalone SVG (row I); masked cells alpha 0 rather than baked `--surface` (user, approval: one token read and one baked color fewer) | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::typed map places its extent` | #390, #393 |
| #395 | Gallery PSF tile from the recorded Cooke PointSpread through an adapter, drawn per theme column with the tile as `el`; `gallery.spec.js`'s tile list, `ownData`, missing-fixture loop and the theme test move to the typed map (corner pixel of the decoded image per column) | an adapter in `adapters.js` because the recorded tiles go through it ([#226]); considered inlining in the gallery page, which the other recorded tiles moved away from | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::recorded PSF tile draws`, `::maps follow their theme` | #411, #394 |
| #396 | Unskip O1 acceptance tests | forced (`workflow.md`, TDD: the last item unskips them) | `tests/map2d.spec.js` | `tests/map2d.spec.js::recorded PSF cells (U8)` | all above |
| #417 | Plots README: the typed map is not in the theme-independent SVG sentence (CR #415) | one sentence because the next bullet owns the typed map; considered a parenthesis on the SVG line, which says it twice | `packages/plots/README.md` | none (docs): `scripts/check.sh --fast` | |
| #418 | Typed map draws given `x.ticks`/`y.ticks` through `axisTicks` exported from `curve.js` (CR #416) | reuse `axisTicks` because `curve` resolves a `CurveAxis` that way; considered a copy in map2d.js, two rules for one type | `packages/plots/src/curve.js`, `packages/plots/src/map2d.js` | `tests/map2d.spec.js::typed map draws given ticks` | |
| #419 | Typed map throws a `TypeError` on an empty, ragged or reversed grid (review M1, finding 4) | a TypeError as `curve` throws on bad roles; considered drawing what it can, which shifts every step | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::typed map refuses bad grids` | #418 |
| #420 | Right margin from the padded x ticks, the larger of the two (review M1, finding 5) | recompute after padding because the drawn ticks are the padded ones; considered padding first, which needs the margin | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::padded x ticks stay inside the viewBox` | #419 |
| #421 | Fixtures README: PSF and layout files in the common-keys exception; size in kB as the other rows (review M1, finding 6) | name the exceptions where the keys are defined; considered a note per row | `tests/fixtures/phos-core/README.md` | none (docs): `scripts/check.sh --fast` | |
| #422 | `psf()`'s orientation and size refusals tested on stand-ins (review M1, finding 7) | stand-ins as for seidel because the real client never returns a bad grid; considered a broken fixture, data no source produced | `tests/unit/phos-core-fixtures.test.js` | `tests/unit/phos-core-fixtures.test.js::recorder guards refuse bad orders` | |
| #426 | Source headers (`index.js`, `renderers.js`, `index.d.ts`) carry the README's carve-out: the typed map bakes its cells, redraw on a theme change (CR #425) | the README's wording because each file opens with that claim; considered dropping the claim, which leaves the canvas rule unstated | `packages/plots/src/index.js`, `packages/plots/src/renderers.js`, `packages/plots/src/index.d.ts`, `tests/unit/headers.test.js` | `tests/unit/headers.test.js::source headers carve out the typed map` (the TDD hook needs a test; it pins the drift round 2 found) | |
| #427 | `map2d.js`'s margin-loop comment states the right reason (review M1 round 2, finding 2) | the reviewer's wording, which matches the code; considered deleting it, which leaves the loop unexplained | `packages/plots/src/map2d.js`, `tests/map2d.spec.js` | `tests/map2d.spec.js::margin growth re-pads: image stays centred` (red under a one-pass loop; renamed by #428) | #426 |
| #428 | Rename the re-pad test after what it catches (`margin growth re-pads: image stays centred`), centring asserted first (review M1 round 3, finding 2) | rename because the name should say what fails; considered dropping the aspect assertion, which still guards px per unit | `tests/map2d.spec.js` | `tests/map2d.spec.js::margin growth re-pads: image stays centred` | |

### M2: scales, aperture, colorbar; wavefront, log and irradiance tiles (done 2026-10-30) GitHub: `P389 M2: scales, colorbar, wavefront`

Demo: the wavefront tile is the recorded Cooke wavefront, a round pupil with its ring, a sequential `ember` map
over its full range, a colorbar in waves; a log PSF tile; a Gaussian irradiance tile marked synthetic; both themes and the three palettes. Proves: O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #397 | O2 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/map2d.spec.js` | `::recorded wavefront cells (U8)`, `::log decades`, `::colorbar ticks`, `::gaussian irradiance tile` (skipped) | #396 |
| #398 | `scale: "log"` with `decades` (default 4) below the max, values at or under max·10^−D (zeros, negatives) at step 0; a range symmetric about 0 when `map` is `wave`; `range` overrides | symmetric only for `wave` because a diverging map's middle step means 0; considered a `symmetric` flag, an option no caller asked for | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::log decades` | #397 |
| #399 | `aperture: { x, y, r }` in extent units: an even-odd `--surface` path over the image outside the circle and a 1 px `--plot-axis` ring | the mask cuts the nearest-neighbour stair edge of the null cells round (the round pupil the user asked for, round 2), and covers grids that come unmasked; an even-odd path because it needs no `clipPath` id (ADR-0001); considered the ring alone, which leaves the stair edge | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::aperture masks outside` (on an unmasked grid and on the recorded wavefront) | #398 |
| #400 | Colorbar right of the plot (the frame's right margin widened for it): the LUT as a 1 × 256 `<image>`, `niceTicks` over the range (whole decades on log), `value`'s label and unit | reuse `niceTicks` (axis.js) as curve does; 256 steps because nine stop rects show bands the map doesn't have; considered `Colorbar.svelte`, which serves only Svelte (round 2 put the bar in the SVG) | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::colorbar ticks` | #399 |
| #412 | Recorder `--only maps` also writes WavefrontError (pupil 64, reference wavelength) at 0 deg for the achromat and the Cooke as `<lens>-wavefront.json`: `{ radii, angles, values[ring][spoke], pupilRadius }`, samples as `results()` gives them; refuses samples that are not rings × spokes (split from #391) | polar as recorded because a grid would be invented cells (CR #410, user); considered resampling onto a grid, refused by the user | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/README.md` | `tests/unit/phos-core-fixtures.test.js::wavefront recorded as polar samples` | #411 |
| #413 | `Map2DGridProps` gains `polar?: { radii, angles }`: with it `values[ring][spoke]` are polar samples about the extent's origin; plots README says so | forced (Core: `index.d.ts`, accepted through CR #410); one prop because frame, colormap, aperture and colorbar are shared; considered a `polarMap` export, a second name for one renderer | `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `tests/types/map2d.ts` | `tests/unit/types.test.js::map2D typed grid type-checks` | #400 |
| #414 | Given `polar`, each sample's annular sector (edges midway between neighbouring radii and spokes) fills with its value's step in the one `<image>`; pixels in no sector alpha 0 | nearest sector, not interpolation, because each pixel shows a recorded value (CR #410); considered 4096 SVG paths, heavy markup with anti-aliased seams | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::polar samples fill their sectors` | #413 |
| #401 | Gallery wavefront tile (recorded Cooke WavefrontError as polar samples, `wave`, its pupil as `aperture`) and a log PSF tile; `gallery.spec.js`'s tile count and lists | an adapter, as item 6's (the recorded tiles go through `adapters.js`, [#226]) | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::recorded wavefront tile draws` | #412, #414 |
| #402 | Gallery irradiance tile: a TEM00 Gaussian (w = 1 mm, 128² over ±2 mm), meta "synthetic"; the tile count | closed form because phos-core's irradiance needs a nonsequential trace (Non-goals); considered sample data, which has no irradiance | `gallery/index.html`, `tests/gallery.spec.js` | `tests/map2d.spec.js::gaussian irradiance tile` | #401 |
| #403 | Unskip O2 acceptance tests | forced (`workflow.md`, TDD) | `tests/map2d.spec.js` | all O2 tests | all above |
| #432 | O2 Gaussian test reads the gallery tile's 128² cells against exp(−2r²/w²) (CR #430) | read the tile because O2 names it; considered the self-drawn grid, which tests map2D, not the tile | `tests/map2d.spec.js` | `tests/map2d.spec.js::gaussian irradiance tile` | |
| #433 | Fixtures README: each wavefront file's reference wavelength (CR #431) | name both because the files differ; considered dropping the number | `tests/fixtures/phos-core/README.md` | none (docs): `scripts/check.sh --fast` | |
| #434 | U8 says spoke orientation is proven by the polar test, and asserts the fixture's per-ring symmetry (review M2, finding 3) | assert the symmetry the comment rests on; considered an off-axis recording | `tests/map2d.spec.js` | `tests/map2d.spec.js::recorded wavefront cells (U8)` | #432 |
| #435 | Gallery test checks the wavefront tile's `wave` map and aperture and psf-log's decades (review M2, finding 4) | assert visible effects because the mutants passed; considered asserting adapter output | `tests/gallery.spec.js` | `tests/gallery.spec.js::recorded wavefront tile draws with its map and aperture, the log PSF with whole decades` | |
| #436 | Colorbar test checks the bar runs lut[255] at the top to lut[0] at the bottom (review M2, finding 5) | decode the bar; considered a screenshot, which mixes in the outline | `tests/map2d.spec.js` | `tests/map2d.spec.js::colorbar ticks` | #434 |
| #437 | Per-tick colorbar decimals; the PSF adapter normalizes to the peak (review M2, finding 6) | per-tick decimals because one precision pads every label; considered 10^k labels. Normalize so "relative" is true; considered dropping the unit | `packages/plots/src/map2d.js`, `tests/fixtures/phos-core/adapters.js` | `tests/map2d.spec.js::colorbar ticks sit at their values` | |
| #438 | Polar sectors found by binary search; unsorted angles refused (review M2, finding 7) | binary search serves uneven spokes; considered a direct index for even spokes only | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::polar samples fill their sectors` | #437 |
| #439 | Log scale spans `range` [lo, hi] when 0 < lo < hi (review M2, finding 8) | follow index.d.ts's existing promise (no Core change); considered documenting that log ignores lo | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::typed map log scale and wave range` | #438 |
| #440 | Colorbar hardening: no ticks unless lo < hi; `cbw`; one color.js import (review M2, findings 9–11) | one item because all three are the colorbar block; considered three commits for a few lines | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::colorbar ticks sit at their values: an empty range draws no ticks` | #439 |
| #442 | Plots README: polar angles must be sorted; unsorted throw (from #438) | the README, the caller's doc and not Core; considered index.d.ts's comment, a Core edit | `packages/plots/README.md` | none (docs): `scripts/check.sh --fast` | #440 |
| #444 | Gallery test: the log PSF colorbar tops out at 1 (review M2 round 2, finding 2) | assert the top tick because the no-normalization mutant passed; considered asserting adapter output | `tests/gallery.spec.js` | `tests/gallery.spec.js::recorded wavefront tile draws with its map and aperture, the log PSF with whole decades` | |
| #445 | Log colorbar keeps decade ticks on a constant positive grid (review M2 round 2, finding 3) | `log ? hi > 0 : lo < hi` because a log span comes from decades; considered no ticks for any constant grid | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::colorbar ticks sit at their values: a constant positive log grid keeps its decade ticks` | |
| #446 | Polar angles within one turn, refused otherwise; README says so (review M2 round 2, finding 4) | refuse because the search folds into one turn; considered folding the angles, which reorders them against values | `packages/plots/src/map2d.js`, `packages/plots/README.md` | `tests/map2d.spec.js::typed map refuses bad polar samples` | #445 |
| #447 | index.d.ts and README: a positive range sets the log span, `decades` then ignored (CR #443) | say the rule where each prop is documented; considered decades winning, which reopens round 1's finding 8 | `packages/plots/src/index.d.ts`, `packages/plots/README.md` | `tests/map2d.spec.js::a positive log range overrides decades` | #446 |
| #449 | Polar one-turn check tolerates rounding (2π·(1 + 1e-12)) on a closed ring (review M2 round 3, finding 1) | a relative tolerance because the overshoot is float rounding; considered rounding the angles, which changes the caller's data | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::typed map refuses bad polar samples` | |
| #451 | README: the polar one-turn rule allows float rounding (review M2 round 4, finding 1) | the reviewer's wording; considered stating 1e-12, a number callers don't need | `packages/plots/README.md` | none (docs): `scripts/check.sh --fast` | |
| #452 | Gallery wavefront tile on `ember` over its full range; #435's test asserts the ember step (M2 demo, user) | sequential because the recorded OPD has no sign change, so a diverging map claims a zero that isn't there (user); considered `wave` stretched over [min, max] (white at 0.39 waves) and removing piston (changes the values) | `tests/fixtures/phos-core/adapters.js`, `tests/gallery.spec.js` | `tests/gallery.spec.js::recorded wavefront tile draws with its map and aperture, the log PSF with whole decades` | |
| #454 | Gallery wavefront test comment names the mutant it catches (`wave`, not a dropped `ember`) (review M2 round 6, finding 2) | the reviewer's wording, since ember is the default; considered asserting the prop, which tests source, not drawing | `tests/gallery.spec.js` | `tests/gallery.spec.js::recorded wavefront tile draws with its map and aperture, the log PSF with whole decades` | |

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

50 items over 3 milestones (CR #410 split #391 into two and added two; review M1 added nine; review M2 added seventeen; the M2 demo one): above the 15-item guideline because round 1 added axes and an irradiance tile and round 2
the colorbar and aperture; none is cut to fit.
## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| PNG encode per redraw at 256² misses 16 ms | U14, kill criterion D–J / U14 | measured in M3; the fallback is `createImageBitmap` plus a blob URL, no dependency |
| A1: WavefrontError gives only live samples, unordered | the recorder can't form a grid without a sampling rule | happened: polar rings × spokes; CR #410 draws them as sectors (#412–#414) |
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
- 2026-10-30 CR #410 (user): WavefrontError is 64 rings × 64 spokes of polar samples, not a grid. Polar renderer:
  #391 split into #411 (PSF, M1) and #412 (wavefront polar samples, M2); #413 adds `polar` to `Map2DGridProps` (Core,
  through the CR) and #414 draws the sectors; O2's wavefront acceptance reads sectors, not cells. PSF kept at pupil 64,
  pad 64, which is 192 × 192 (about 440 kB), not 128 × 128.
- 2026-10-30 review M1 round 1: 2 blocking, CR #415 (README) and CR #416 (ticks), accepted by the orchestrator (keep
  every invariant) as #417 and #418. Backlog pulled into M1 as small and named: #419 (bad grids), #420 (padded margin),
  #421 (fixtures README), #422 (psf refusals tested). Plain backlog: #423 (M2 props, fixed by M2), #424 (PNG bytes,
  deferred until a mismatch shows: a tolerance changes an approved oracle's form).
- 2026-10-30 review M1 round 2: 1 blocking, CR #425 (source headers), accepted by the orchestrator (comments only;
  `index.d.ts`'s header was in #393's approved Files) as #426; backlog #427 (loop comment) pulled in. Carried #410, #415,
  #416 resolved.
- 2026-10-30 review M1 round 3: 0 blocking; carried #410, #415, #416, #425 resolved. #426 and #427 rows list the tests
  they added (finding 1). #428 (test rename, finding 2) pulled in. `headers.test.js` kept (finding 3): it pins the
  header drift round 2 found.
- 2026-10-30 review M1 round 4: 1 blocking, CR #429 (row #427 named the test #428 renamed), fixed here by the
  orchestrator (the plan is its file). Carried #410, #415, #416, #425 resolved.
- 2026-10-30 M1 done: review round 5 says 0 blocking with nothing pulled in (rounds: 2+4, 1+1, 0+1, 1+0, 0+0); CI
  green on every pushed head; demo pending.
- 2026-10-30 M1 demoed (user: go).
- 2026-10-30 review M2 round 1: 2 blocking, CR #430 (Gaussian test reads the tile) and CR #431 (wavefront README
  wavelength), accepted by the orchestrator as #432 and #433. Backlog pulled in: #434 (U8 symmetry), #435 (gallery
  tile checks), #436 (colorbar colors), #437 (log labels, PSF normalized), #438 (polar binary search), #439 (log
  honours range[0], as index.d.ts says), #440 (colorbar hardening). Plain backlog: #441 (roadmap U8, at plan end).
- 2026-10-30 #442 added (from #438, which refuses unsorted polar angles): the README says so. #435 and #440 rows name
  the tests they added. #438: the gallery wavefront draw went from about 25 ms to 8 ms.
- 2026-10-30 review M2 round 2: 1 blocking, CR #443 (index.d.ts's log/decades docs, made false by #439), accepted by
  the orchestrator (doc comments in Files #393 and #413 already approved) as #447. Backlog pulled in: #444 (normalization
  tested), #445 (log ticks on a constant grid), #446 (polar angles within one turn). Plain backlog: #448. Carried #430,
  #431 resolved.
- 2026-10-30 review M2 round 3: 0 blocking; carried #430, #431, #443 resolved. #449 (one-turn tolerance) pulled in;
  #450 (dead guard) deferred with #448.
- 2026-10-30 review M2 round 4: 0 blocking; carried CRs resolved; #451 (README wording for #449) pulled in.
- 2026-10-30 M2 done: review round 5 says 0 blocking with nothing pulled in (rounds: 2+8, 1+3, 0+1, 0+1, 0+0); CI
  green on every earlier pushed head; demo pending.
- 2026-10-30 M2 demo (user): the Cooke 0 deg wavefront is all positive (0.002 to 0.77 waves), so the symmetric `wave`
  scale used half the bar. User chose a sequential map over the full range: #452. M2 reopened until #452 lands and is
  reviewed. The `wave` symmetric rule stays for signed data.
- 2026-10-30 review M2 round 6: 1 blocking, CR #453 (M2 Demo line said diverging), fixed here by the orchestrator;
  #454 (test comment) pulled in. Carried CRs resolved.
- 2026-10-30 review M2 round 7: 0 blocking, nothing pulled in; the item count is 50 (the #391 split had been counted as
  no change; finding 1, fixed here). M2 done again after #452: demo pending.
- 2026-10-31 M2 demoed: go (user, sequential ember wavefront tile).
