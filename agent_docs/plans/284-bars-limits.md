# Plan #284: Bars for Seidel, and limit lines and bands

Status: approved 2026-10-12
Branch: `plan/284-bars-limits` PR: #<pr> Depends on: plan #232 (done) Roadmap: `agent_docs/roadmap.md`, row G

## Problem

phos wants to draw Seidel aberration bars and its merit share (one bar per operand, phos roadmap R6) from
eleo-ui's plot types, and to mark requirements on its plots (roadmap U9: "MTF ≥ 0.3 at 50 lp/mm"). eleo-ui
has no bar renderer and no way to draw a limit: today a caller would fake a limit as a solid series, which
reads as data. Row G adds `bars` on typed input, recorded from phos-core's SeidelCoefficients, and limit
lines and bands on `curve` and `bars`.

## Ground truth

- No bar renderer exists. `curve` (`packages/plots/src/curve.js`) draws typed series (single plot as
  `<polyline>`s, panels as `<path>`s) in a nested `<svg>` holding a `<g transform="matrix(…)">` in data
  coordinates under `vector-effect="non-scaling-stroke"` (ADR-0001, Curve drawing). `scales(o, groups, panel)`
  computes ranges (`axisRange`: a given range if two finite numbers, else the nice range of the data) and
  ticks once; `plotCell(sc, series, w, h, T, panel)` draws one frame, its ticks, a zero line only when a range
  straddles 0 (`curve.js:64-65`), and the series group. No renderer baseline guards `curve`
  (`scripts/record-renderers.mjs` `draws()` has no curve entry): its round-trip tests and the gallery
  screenshots (kill criterion D–J) do.
- `roleStyle` (`curve.js:7-10`) matches roles exactly: an unknown role (`Sagittal`, `ref`) draws solid, and
  `idx(-1)` (`common.js`) gives `var(--series-0, var(--field-undefined))` (#199). `common.js` ships in the
  standalone `eleo-layout.js` (U4's size test: ≤ 2 kB gzipped growth per row). Every series has
  `stroke-linecap="round"` (`curve.js:39`).
- ADR-0001 (accepted, never edited): roles, not colors; one table in the renderers maps role to style; every
  role a 1 px stroke; U5's role list already names `limit`. The style-lint test forbids color literals and
  font names in `packages/plots/src` outside listed exemptions. ADR-0001 reserves `data-*` on marks for row H.
- Tokens (`packages/tokens/src/tokens.json`): `--ink`, `--ink-muted`, `--plot-axis`, `--plot-grid`,
  `--series-1..8`; `--danger` is "errors and destructive actions, with an icon and a word", `--success` "not
  a plot color", `--accent` "never in plots". No limit token.
- phos-core's uniffi Python client (`~/code/ELEOptics/phos-core/clients/python/src/phos/phos.py:10577-10730`):
  `SeidelSettings()` (`set_system_index`, `set_chromatic_lines`, `run(model) -> SeidelCoefficients`, raises
  on error); `SeidelCoefficients.results()`, one `SeidelCoefficientData` per wavelength (`wavelengths()`),
  each with `spherical`, `coma`, `astigmatism`, `field_curvature`, `distortion`, `axial_color`,
  `lateral_color` (and `petzval_curvature`, 1/mm, not a Seidel sum): per `analyses/src/seidel_coefficients.rs:290-296`
  "the coefficients at every optical surface and the final value in the vec is the sum total", image surface
  excluded, all seven in mm. No source or field. `SeidelSettings` exists at `6bd53311`, the sha the existing
  fixtures were recorded at (phos-core HEAD is 58 commits on, one touching `phos.py`).
- `scripts/record-phos-core.py` rewrites all eight fixtures on every run, each stamped with the current
  phos-core sha, and rounds to 6 significant digits (`SIG = 6`, `rnd`).
  `tests/fixtures/phos-core/adapters.js` (a classic script, `globalThis.ELEOAdapters`) turns recordings into
  renderer calls; `gallery/index.html` draws recorded tiles through `recTile(k)` from `REC`.
- `tests/gallery.spec.js`: five tests pin `toBe(17)` tiles (`:27,43,63,90,112`); the missing-fixture loop
  (`:52`) pairs one fixture with one blanked tile; `ownData` (`:109`) lists the tiles that draw without the
  sample script.
- `tests/unit/helpers/svg.js` reads every `<path>`/`<polyline>` in the first transform group as a series
  (`:24-50`); tests assert `paths.length === series.length`.
- Exports: `renderers.js` builds the API object, `index.js` re-exports its names, `iife.js` puts it on
  `window.ELEO`. The root `README.md:65` names each renderer module and says a new renderer gets a gallery
  tile, a type in `index.d.ts` and a Svelte wrapper. plots-svelte's `exports` has only `.`: a new component
  needs no Core change there.
- `tests/unit/release.test.js`: one changeset bumping two packages writes the same body into both
  CHANGELOGs (#85, `:142-147` area), so each package gets its own file; `changeset version` deletes the file,
  so each changeset test has a consumed twin reading the CHANGELOG (#279). plots 0.4.0, plots-svelte 0.2.0
  on main; #232's plots minor is pending in Version Packages (#231).
- `tests/perf.spec.js` (`PERF=1`) measures `curve`, panels and `spot`; U14's reference for bars is 50
  surfaces × 7 Seidel terms plus the total. The roadmap review accepted that G adds its U14 test the existing
  way (#281 waits).
- Merit share (phos R6, Opal `src/lib/compare.ts`): one unsigned value per named operand
  (`objective_merits`), no total. The same type covers it: categories are operand names, one series.
- Prior art: no library. Grouped bars are rects on a band scale; a limit is a line or rect in the existing
  data-space group. Observable Plot was weighed and not adopted (ADR-0001).

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `bars({ categories, series: [{ values, index?, label? }], total?, y?, width?, height? })` draws signed grouped bars inside `curve`'s frame: a group per category, a bar per series, as `<rect>`s in the data-space group (category bands on x, values on y) so the transform inverts to the data; a zero line when the range straddles 0, as `curve`; `total` appends a group of per-series sums labelled with its string; a key row names the series' `label`s; an index that isn't a non-negative integer throws. The gallery's Seidel tile draws the recorded achromat at its reference wavelength. | given the recorded SeidelCoefficients of the achromat and the Cooke triplet built by `ELEOAdapters.seidel` (surface contributions only, the recorded total stripped), when drawn at two widths with `total: 'Σ'`, then inverting the transform recovers every bar's height within 0.5 px, and each Σ bar's height matches phos-core's recorded total (the last element) within 0.5 px | `fixture: recorded phos-core SeidelCoefficients for the sample (roadmap U9)`; `user: the gallery tile in both themes and palettes (roadmap U9)` | `tests/unit/bars.test.js::recorded Seidel round trip (U9)` |
| O2 | `curve` (single and panels) and `bars` take `limits: [{ x? \| y?: number \| [lo, hi], label? }]`: a number draws a limit line (`<line class="eleo-limit">`) across the plot, a pair a band (`<rect class="eleo-limit">`); both in the data-space group in the `limit` style, bands under the series and lines over them; a limit counts toward an auto range; a `curve` series may take `role: 'limit'`. `curve` throws on an unknown role; `curve` and `bars` throw on an index that isn't a non-negative integer (#199); `bars` throws on an `x` limit. | given the recorded achromat MTF with `limits: [{ y: 0.3, label: 'MTF ≥ 0.3' }, { x: 50 }, { y: [0, 0.3] }]`, and the Seidel bars with a `y` line and band, when drawn single and paneled, then inverting each limit's transform recovers its value or ends within 0.5 px, an auto range contains every limit, and the requirement tile shows in the gallery in both themes and palettes | `property: synthetic and recorded limits recovered through the inverse transform within 0.5 px; an auto range contains every limit` (new); `user: the gallery tile in both themes and palettes (roadmap U9)` | `tests/unit/curve.test.js::limit lines and bands round trip (U9)`, `tests/unit/bars.test.js::bar limits round trip (U9)` |
| O3 | The typed API is public: `BarPlotProps`, `BarSeries`, `PlotLimit` (`BarPlotProps.limits` y-only), `limits` on the typed curve props and `role: 'limit'`; `BarPlot.svelte` in plots-svelte; a merit-share call (one unsigned series by operand name) type-checks. | given `tests/types/bars.ts` with a Seidel call, a merit-share call and a curve call with limits, when `tsc --strict` runs against `index.d.ts`, then it passes, and a call with a `color` key or an `x` limit on bars fails | `spec roadmap Constraints (typed API alongside the old one)` (new) | `tests/unit/types.test.js::bars and limits type-check under --strict` |
| O4 | The release is planned: a plots minor and a plots-svelte minor (a new component), one changeset file each. | given the branch, when `.changeset/bars-limits.md` and `.changeset/bars-limits-svelte.md` are parsed, then their front matter is `{"@eleoptics/plots": "minor"}` and `{"@eleoptics/plots-svelte": "minor"}`; once consumed, each CHANGELOG carries its entry | `spec roadmap Constraints (a typed API added alongside the old ships as a minor); semver 0.x` (new) | `tests/unit/release.test.js::bars-limits changesets ask plots and plots-svelte minors` |

## Non-goals

- Horizontal bars, stacked bars, sorting: Seidel and merit share are both grouped by category; next plan if
  phos's merit share needs long operand names drawn across.
- A merit-share gallery tile: phos-core records no merit share; the type test and a synthetic unit test cover
  the shape.
- Limits on the `kind` call of `curve`, on `spot` and on `map2D`: `kind` goes in row J; U9 names curves and bars.
- Per-limit styles (pass/fail coloring, warning vs failure): one `limit` role; a requirement verdict is app
  logic (phos R9).
- Petzval curvature and CODE V transverse coefficients: not Seidel sums in mm; the caller can pass them as
  another `bars` call.
- Hover on bars (H), export (I), the tolerance-footprint row.
- #263 (shared bad-point predicate with `spot`), #281 (one U14 harness): related, untouched.

## Existing issues

| Issue | Bucket | Where or why |
| -- | -- | -- |
| #199 | absorb | reused as a work item in M2: the role table grows `limit` and rejects the rest |
| #258 | absorb | reused as a work item in M2: the README `curve` section M2 edits for limits |
| #263, #269, #278 | related | wait on the next plan editing `spot.js` |
| #281 | related | G adds one measurement to `perf.spec.js` the existing way (roadmap review) |
| #257 | related | typed-array ranges, outside `index.d.ts`'s contract |
| #230 | related | the next plan editing the style lint |
| #70, #125, #136, #138, #139, #156, #160 | related | layout2D hardening; G doesn't edit `layout2d.js` or `glass.js` |
| #314 | absorb | folded into #316 (CR #315 rewrites the Dividers bullet) |
| #86, #132, #133, #158 | related | wait on row J's release or untouched files |

## Constraints and assumptions

- Roadmap constraints: typed API alongside the old one; every gallery tile keeps working (17 → 20: two Seidel tiles and
  the MTF requirement tile); recorded fixtures cover public lenses only; U14 for `bars` at 50 × 7 + total;
  `eleo-layout.js` grows ≤ 2 kB (only #199's `idx` wrap reaches it).
- The adapter draws the surface contributions at the system's reference wavelength (the recorder writes it)
  and strips phos-core's total, which `bars` recomputes; the seven terms keep phos-core's sign and mm.
- Existing tiles are unchanged: limits are opt-in, and `plotCell`'s new parameter is additive, so `curve`'s
  default markup is unchanged (its round-trip tests and the M1 screenshots check it).
- The existing eight fixtures stay as recorded at `6bd53311`; the Seidel ones carry their own sha.

## Decisions

- ADR-0001 holds: bars and limits draw in the data-space group and take roles, not colors. No new ADR, and no
  ADR edit: the `limit` row lives in `roleStyle` and the plots README.
- `bars` reuses `curve`'s frame: `plotCell` gains an additive `body` argument (markup in data units for the
  series group) and accepts an x axis with no ticks; `bars` passes its rects and draws category labels in px.
  Considered a separate frame in `bars.js` (a second tick, margin and zero-line implementation) and moving
  `plotCell` to its own module (a larger diff for no gain).
- `bars` geometry: category k occupies x ∈ [k, k + 1] in data units; bars fill 80 % of it, split evenly
  among series; the total group sits after a gap of half a band. Bars are `<rect>`s with `y = min(0, v)`,
  `height = |v|` in data units; a zero-height bar is drawn. When a band is under 14 px, only every k-th
  category label is drawn, each at its band centre.
- The `limit` role and marks: `var(--ink)` 1 px, `stroke-linecap="butt"`, dash `6 3 1 3` (dash-dot, distinct
  from `reference`'s `1 3`); a band fills `var(--ink)` at `fill-opacity` .06 with no stroke. Limit marks carry
  `class="eleo-limit"` (no `data-*`: row H's). A limit's label is px-space `eleo-tick` text at the line's right
  (y) or top (x) end. The M2 demo approves the look.
- Errors (#199): `TypeError('curve: unknown role "<r>"')`, `TypeError('<renderer>: index must be a non-negative integer')`, `TypeError('bars: x limits are not supported')`, as `layout2D` throws on bad
  recorded data. `idx` keeps its signature and takes `((k % 8) + 8) % 8` of an integer (the issue's fix; it
  guards `spot` and `layout2D`, which don't validate).
- Core changes approved with the plan: `packages/plots/src/index.d.ts` (`BarPlotProps`, `BarSeries`,
  `PlotLimit`, `limits`, `role: 'limit'`, `bars` on `ELEO`). No `exports` change.

## Milestones

### M1: Seidel bars from the recorded achromat (done 2026-10-12) GitHub: `P284 M1: Seidel bars`

Demo: before the first change, the orchestrator screenshots main's gallery at the plan's base (every tile,
both themes, standard and both vision palettes) and uploads them with `gh release upload review-assets --clobber` (never committed). At the demo, `npm run gallery` shows the new Seidel tile (the achromat's seven
terms per surface and the Σ group, a key row naming the terms) in both themes and palettes, every other tile
unchanged. Proves: O1

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #285 | O1 acceptance test, skipped; `helpers/svg.js` gains `marks(group, tag)` for `<rect>` and `<line>`, and its series readers skip `class="eleo-limit"` | forced (`workflow.md`, TDD: the first item writes them skipped); one generic reader because O2 reads lines and rects too; considered a rect-only reader (a second helper edit in M2) | `tests/unit/bars.test.js`, `tests/unit/helpers/svg.js` | `bars.test.js::recorded Seidel round trip (U9)`, skipped (its comment documents the adapter's contract: total stripped); existing tests green on the helper |  |
| #286 | `record-phos-core.py --only <analysis>` and SeidelCoefficients of both lenses (default chromatic lines): wavelengths, the reference wavelength, per wavelength the seven terms per surface plus the total, `lengthUnit: "mm"`; fixtures README. `python3 scripts/record-phos-core.py --phos <phos-core>/clients/python/src --only seidel` → `wrote tests/fixtures/phos-core/{achromat,cooke}-seidel.json (phos-core <sha>)`; without `--only`, as today. Stop: `run` raises, or a term's length isn't the surface count plus one | the uniffi client as for the other fixtures (roadmap row G: `SeidelSettings` is in it); `--only` because a full run rewrites the eight existing fixtures at a newer sha; considered checking phos-core out at `6bd53311` (an extra step every rerun) and `code_v_transverse()` (another unit and columns; U9 names SeidelCoefficients) | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/*-seidel.json`, `tests/fixtures/phos-core/README.md`, `tests/unit/phos-core-fixtures.test.js` | `phos-core-fixtures.test.js::seidel recorded per wavelength` (oracle: closed-form phos-core's documented total: `abs(sum - last) <= (n + 1) * 1e-6 * max(abs(term))`, the 6-digit rounding; reference `sample.json` and the MTF recordings for the wavelengths; property: each term has one entry per surface plus one) |  |
| #287 | `bars` through `plotCell`'s new `body` argument (Decisions), category labels with thinning, the total group, a key row from series labels, index validation; `ELEO.bars`, `import { bars }`, `window.ELEO.bars`; plots README `bars` section; root README's module list. Invocation: `bars({ categories: ['1', '2', '3'], series: [{ values: [0.012, -0.004, 0.001], index: 0, label: 'SI' }], total: 'Σ', y: { label: 'Seidel sum', unit: 'mm' } })` → an `<svg role="img" aria-label="Seidel sum, mm by category bar plot">` with a nested `<svg>`, one `<g transform="matrix(…)">` holding four `<rect>`s, labels `1 2 3 Σ` and a key `SI` | data-space rects inside `curve`'s frame, because U9's oracle inverts the transform as U6's does and one frame keeps ticks and zero lines alike; considered px-space rects with `data-v` (ADR-0001's reserved alternative, kept for curves) and a frame of its own (Decisions) | `packages/plots/src/bars.js`, `packages/plots/src/curve.js` (`plotCell`'s `body`, x without ticks), `packages/plots/src/renderers.js`, `packages/plots/src/index.js`, `tests/unit/bars.test.js`, `packages/plots/README.md`, `README.md` | `bars.test.js::synthetic bars round trip, signed and unsigned` (oracle: property: synthetic values recovered within 0.5 px; an unsigned set's range starts at 0 and draws no zero line; total bars are the series sums; 50 categories at 460 px draw every k-th label at its band centre; a bad index throws; `bars` is on every entry); existing `curve.test.js` green | #285 |
| #288 | Gallery Seidel tile: `ELEOAdapters.seidel(rec)` (categories the surface numbers, the recorded total stripped, a series per term labelled `SI`…`SV`, `CL`, `CT`, index 0–6, `total: 'Σ'`, y `Seidel sum, mm`) at the reference wavelength, drawn through `recTile`; one `TILES` constant for the five tile counts (18); the tile joins the missing-fixture loop, restructured to `[fixture, blankedTiles[]]`, and `ownData` | the classic-script adapter and `recTile` as for the spot tile (#226); considered adapting in the page (the unit tests couldn't reuse it) | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js::a missing phos-core fixture blanks only its tiles: seidel` (new, red first); `::a missing sample script blanks only the sample tiles` with `seidel` in `ownData`; the counts at 18 | #286, #287 |
| #289 | Unskip O1 | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/bars.test.js` | O1 | #285, #286, #287, #288 |
| #303 | CR (review M1 round 1 finding 1): the fixtures README's common keys name what the Seidel files carry | forced (stale doc: `tests/fixtures/phos-core/README.md:26` since #286) | `tests/fixtures/phos-core/README.md` | none: doc only | #286 |
| #304 | CR (finding 2, with backlog finding 4): the adapter returns `total: 'Σ'`, the gallery passes `ELEO.bars` straight through; the Seidel tile in its own row | the finding's sketch, because the adapter owns the call's data as for spot; its own row because a third tile reflows the spot row; considered keeping the wrapper (no reason given) | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/unit/bars.test.js` | `bars.test.js::recorded Seidel round trip (U9)` asserts the adapter's `total` | #288 |
| #305 | Backlog findings 3 and 5: no rect for a non-numeric value; label margins from `curve.js` | the findings' named fixes in one item, because both are `bars.js`'s geometry and input rules; considered two items | `packages/plots/src/bars.js`, `packages/plots/src/curve.js`, `tests/unit/bars.test.js` | `bars.test.js::non-numeric values draw no bar` | #287 |
| #306 | Backlog finding 6: the test helper skips paths without data | the finding's named fix; considered asserting on such tags | `tests/unit/helpers/svg.js` | `curve.test.js::helpers skip a path with no data` | #285 |
| #307 | CR (review M1 round 2 finding 1, with 3–5): the README names skipped values; the key row wraps; a null series throws; `bars.js` tidied | the findings' named fixes in one item, because all are `bars.js` and its README section; wrap rather than clip, because every series stays named; considered stopping at the edge | `packages/plots/src/bars.js`, `packages/plots/README.md`, `tests/unit/bars.test.js` | `bars.test.js::key row wraps inside the viewBox and null series throw` | #305 |
| #308 | Backlog finding 2: the Seidel adapter labels terms by name | the finding's named fix, because labels must follow names; considered relying on the recorder's order | `tests/fixtures/phos-core/adapters.js` | `bars.test.js::seidel adapter labels by term name` | #304 |
| #309 | CR (review M1 round 3 finding 1, with 2, 3, 4, 6): the README's key line wording and zero Σ bar; a small drawing keeps a positive frame; O1 pairs totals by name; `TOP` and comment order | the findings' named fixes in one item, because all are `bars` and its docs and tests; document the zero Σ bar, because the Σ group keeps one rect per series; considered skipping it (shifts rects read by position) | `packages/plots/src/bars.js`, `packages/plots/README.md`, `packages/plots/src/curve.js` (comment order), `tests/unit/bars.test.js` | `bars.test.js::a small drawing keeps a positive frame` | #307, #308 |
| #312 | CR #312 (user, M1 demo): dotted dividers between category groups and before Σ; more room under the y-axis title | dividers in px space beside the gridlines, because they are frame decoration and keep the series group to data; a larger top margin in `bars` only, because a `curve` change would move every curve tile; considered `<line>`s in the data group and `curve`'s shared margin (user) | `packages/plots/src/bars.js`, `packages/plots/README.md`, `tests/unit/bars.test.js` | `bars.test.js::group dividers and title room` | #309 |
| #313 | CR (review M1 round 5 finding 1, with 2, 3): the divider code computes the width once; dividers follow the label step; the test's oracle wording | the findings' named fixes in one item, because all are #312's divider code; dividers follow the label step, because a divider separates labelled groups; considered none when thinned | `packages/plots/src/bars.js`, `packages/plots/README.md`, `tests/unit/bars.test.js` | `bars.test.js::group dividers and title room` extended | #312 |
| #316 | CR #315 (user, M1 demo): solid dividers in the grid colour; the README names the thinning as the labels' (#314) | solid lines in the grid colour (user); considered `--plot-axis` (reads as a zero line) | `packages/plots/src/bars.js`, `packages/plots/README.md`, `tests/unit/bars.test.js` | `bars.test.js::group dividers and title room` (no dash) | #313 |
| #317 | CR #315: the recorded Seidel grouped by coefficient (with a caller-built Σ series) and as a subset, tested; README example | a test and a README example, because `bars` already takes any categories and series (user: "caller"); considered a per-category `total` option (user chose caller) | `tests/unit/bars.test.js`, `packages/plots/README.md` | `bars.test.js::recorded Seidel grouped by coefficient and as a subset` (oracle: fixture phos-core SeidelCoefficients; metamorphic: either grouping or a subset gives the same heights) | #316 |
| #318 | CR #315: gallery Seidel tile grouped by coefficient (`ELEOAdapters.seidel(rec, { by: 'term' })`); `TILES` 19 | an adapter option, because the transposition is the caller's (U11); considered a second fixture (same data) (user: "tile") | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js::a missing phos-core fixture blanks only its tiles: seidel` (both Seidel tiles); counts at 19 | #317 |
| #319 | CR (review M1 round 7 finding 1, with 2–4): the README's subsets wording; the adapter's `by` strict and its by-term output tested; the example's names defined | the findings' named fixes in one item, because all are #317/#318's docs, adapter and test; considered four items | `packages/plots/README.md`, `tests/fixtures/phos-core/adapters.js`, `tests/unit/bars.test.js` | `bars.test.js::recorded Seidel grouped by coefficient and as a subset` extended | #318 |

### M2: Limit lines and bands GitHub: `P284 M2: Limits`

Demo: `npm run gallery`: a new MTF requirement tile (the recorded achromat MTF with `MTF ≥ 0.3` as a line,
50 cycles/mm as a line and the failing band below 0.3) and the Seidel tile with a limit, in both themes and
palettes; every other tile unchanged. Proves: O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #290 | O2 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/unit/curve.test.js`, `tests/unit/bars.test.js` | the two O2 tests, skipped | #289 |
| #199 reuse | The role table gains `limit` (Decisions) and rejects the rest: `curve` throws on an unknown role or an index that isn't a non-negative integer; `idx` wraps negatives | the issue's named fix, because a typo should fail loudly rather than draw as data; considered falling back to solid (today's silent behaviour, the issue's complaint) | `packages/plots/src/curve.js`, `packages/plots/src/common.js`, `tests/unit/curve.test.js` | `curve.test.js::unknown roles and bad indexes throw (#199)` (oracle: spec #199) | #290 |
| #321 | CR (#199's worker, stale doc): the README's curve roles name `limit` and the throws | forced (stale doc: `packages/plots/README.md:78` since #199) | `packages/plots/README.md` | none: doc only | #199 |
| #291 | `limits.js`: a limit list to `{ under, over }` markup in data units given the ranges, its validation, and the fold into an auto range; `curve` (single and panels) passes them through `plotCell`'s `body`; plots README; root README's module list. Invocation: `curve({ series, x: { label: 'Spatial frequency', unit: 'cycles/mm' }, y: { label: 'Modulus' }, limits: [{ y: 0.3, label: 'MTF ≥ 0.3' }, { x: 50 }, { y: [0, 0.3] }] })` → in the data group, a `<rect class="eleo-limit">` under the series and two `<line class="eleo-limit">`s over them; labels as `eleo-tick` text at the line's right or top end | one module, because `curve` and `bars` must draw limits alike; considered limits as caller series with `role: 'limit'` (the caller would need the auto range before drawing, and bands have no series form) | `packages/plots/src/limits.js`, `packages/plots/src/curve.js`, `tests/unit/curve.test.js`, `packages/plots/README.md`, `README.md` | `curve.test.js::limits draw single and paneled` (oracle: property: synthetic limits recovered within 0.5 px; an auto range contains every limit; a given range clips them) | #199 |
| #292 | `bars` takes `limits` (y only). Invocation: `bars({ …, limits: [{ y: 0.01 }] })` → one `<line class="eleo-limit">` in the group; `{ x: 1 }` → `TypeError('bars: x limits are not supported')` | `limits.js` reused, because the look must match `curve`'s; considered x limits as category markers (no outcome needs them) | `packages/plots/src/bars.js`, `tests/unit/bars.test.js`, `packages/plots/README.md` | `bars.test.js::bar limits draw and x limits throw` | #291 |
| #258 reuse | README and `seriesPath`'s comment: a `null` entry, or a point with a `null`, NaN or infinite coordinate, breaks a panel series and doesn't count toward the range | forced (#258: `packages/plots/README.md:82` and `curve.js:29` stale since #256; serves O2, the README section it edits) | `packages/plots/README.md`, `packages/plots/src/curve.js` (comment) | none: docs only | #291 |
| #293 | Gallery: an MTF requirement tile reusing `REC.mtf` with the three limits, and a `y` limit on the Seidel tile; `TILES` 20 (CR #315 adds a tile in M1); the missing-fixture loop blanks both MTF tiles for `mtf`; `ownData` gains the tile | forced (roadmap U9's oracle: `user` the gallery tile in both themes and palettes); considered adding limits to the existing MTF tile (moves a tile the D–J kill criterion guards) | `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js::a missing phos-core fixture blanks only its tiles: mtf` (both tiles); the counts at 20 | #292 |
| #294 | Unskip O2 | forced (`workflow.md`, TDD) | `tests/unit/curve.test.js`, `tests/unit/bars.test.js` | O2 | #290, #199, #291, #292, #258, #293 |
| #322 | CR (review M2 round 1 finding 1, with 3, 4, 6, 7): a partly drawn band keeps its label; the band's fill in the `limit` role row; panels' auto range with limits tested; the README's range sentences; `kind` with `limits` throws | the findings' named fixes in one item, because all are the limits code, its role row, docs and test; considered five items | `packages/plots/src/limits.js`, `packages/plots/src/curve.js`, `packages/plots/README.md`, `tests/unit/curve.test.js` | `curve.test.js::limits draw single and paneled`, `::limit lines and bands round trip (U9)` extended | #294 |
| #324 | CR (review M2 round 2 finding 1, with 2, 3): the bars README names limit marks in the group; x limit labels stay inside; README role wording | the findings' named fixes in one item, because all are the limits docs and label placement; considered three items | `packages/plots/README.md`, `packages/plots/src/limits.js`, `tests/unit/curve.test.js` | `curve.test.js::limits draw single and paneled` extended | #322 |
| #325 | Backlog (review M2 round 3 findings 1–3): x band labels inside the band; bars dividers under the limit labels; a zero-width band throws | the findings' named fixes in one item, because all are limit-label placement and validation; dividers first by appending `limitLabels` in `bars`; considered a `plotCell` argument for dividers | `packages/plots/src/limits.js`, `packages/plots/src/bars.js`, `tests/unit/curve.test.js`, `tests/unit/bars.test.js` | `curve.test.js::limits draw single and paneled`, `bars.test.js::bar limits draw and x limits throw` extended | #324 |
| #326 | CR (#325's worker, stale doc): the README's limit bullets name the zero-width throw, the x band label and dividers under labels | forced (stale doc since #325) | `packages/plots/README.md` | none: doc only | #325 |
| #327 | CR (review M2 round 4 finding 1): `bars` draws dividers before `plotCell`, dropping the copied px maths | the reviewer's sketch, because it removes two copied functions and an import and adds nothing; considered #325's shape | `packages/plots/src/bars.js`, `packages/plots/README.md`, `tests/unit/bars.test.js` | `bars.test.js::bar limits draw and x limits throw`, `::group dividers and title room` | #326 |

### M3: The typed API, the Svelte wrapper, the redraw budget and the release GitHub: `P284 M3: Typed API and release`

Demo: `npm run test:unit`: the types test passes a Seidel, a merit-share and a limited curve call and
rejects a `color` key and an `x` limit on bars; the changesets plan plots and plots-svelte minors. `PERF=1 npx playwright test tests/perf.spec.js` prints the `bars` median at 50 × 7 + total, written into the Change log.
Proves: O3, O4

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #295 | O3 and O4 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/unit/types.test.js`, `tests/unit/release.test.js` | the two tests in Outcomes, skipped | #294 |
| #296 | `index.d.ts`: `BarSeries`, `BarPlotProps` (y-only `limits`), `PlotLimit`, `limits` on `CurveSeriesProps` and `CurvePanelsProps`, `role: 'limit'`, `bars` on `ELEO`; `tests/types/bars.ts` (`@ts-expect-error` on `color` and on a bars `x` limit); `CurvePlot.svelte`'s comment and the plots-svelte README's `limits` sentence | forced (CLAUDE.md Core: `index.d.ts` types the public API; roadmap Constraints: typed alongside the old; wrapper docs show the typed call once it type-checks, as #243) | `packages/plots/src/index.d.ts`, `tests/types/bars.ts`, `tests/unit/types.test.js` (O3 unskipped here, as #243 did), `packages/plots-svelte/src/lib/CurvePlot.svelte`, `packages/plots-svelte/README.md` | O3 | #295 |
| #297 | `BarPlot.svelte` (`bars(props)` through `{@html}`, as `CurvePlot`), exported; its header comment and the plots-svelte README show the call. Invocation: `<BarPlot categories={['1','2','3']} series={[{ values: [0.012, -0.004, 0.001], index: 0, label: 'SI' }]} total="Σ" y={{ label: 'Seidel sum', unit: 'mm' }} label="Seidel sums" />` → a `div.eleo-svg` with `role="img"`, `aria-label="Seidel sums"` and the `bars` SVG | forced (roadmap row G and root README: a new renderer gets a Svelte wrapper; the wrappers pass props through) | `packages/plots-svelte/src/lib/BarPlot.svelte`, `packages/plots-svelte/src/lib/index.js`, `packages/plots-svelte/README.md`, `README.md` and `packages/plots/README.md` (BarPlot in their lists: review M1 round 3 finding 5) | svelte-check in `check.sh` against the types item's `BarPlotProps` | #296 |
| #298 | U14 for `bars` (50 categories × 7 series plus the total, with one limit) | forced (roadmap review: G adds its U14 test the existing way; #281 waits). Stop: a median over 16 ms is reported (kill criterion D–J / U14), not fixed | `tests/perf.spec.js` | `perf.spec.js::bars redraw (U14)` | #295 |
| #299 | Changesets: `bars-limits.md` (plots minor), `bars-limits-svelte.md` (plots-svelte minor), each test with its consumed twin | forced (CLAUDE.md: a changeset per user-facing change; #85: one file per package; #279: the consumed twin) | `.changeset/bars-limits.md` (starts **Breaking:** for #199's throws: review M2 round 1 finding 2), `.changeset/bars-limits-svelte.md`, `tests/unit/release.test.js` | O4 | #295 |
| #300 | Unskip O4 | forced (`workflow.md`, TDD) | `tests/unit/release.test.js` | O4 | #295, #296, #297, #298, #299 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| The seven Seidel terms differ by orders of magnitude (spherical vs lateral color), so small terms read as zero | the tile is unreadable | the M1 demo decides; a caller-side scale (waves) is phos's, not a renderer option |
| `plotCell`'s `body` argument changes `curve`'s default markup | curve tiles move | the argument is additive; curve's round-trip tests and the M1 screenshots compare every curve tile |
| The dash-dot limit reads as a series under a palette | requirement confused with data | the M2 demo by eye in all palettes; the role table is the one place to change |
| `SeidelSettings` defaults (chromatic lines) differ between the two lenses' wavelength sets | CL and CT not comparable across lenses | recorded with defaults, named in the fixtures README |

## Change log

- 2026-10-12 headless: scope from roadmap row G, absorbing #199 and #258 as the roadmap pick named (row: Choose, add or reorder rows).
- 2026-10-12 headless: bars type checked against phos's merit share (one unsigned series by operand name): covered by the same call; no merit tile (row: Choose, add or reorder rows).
- 2026-10-12: critique (general-purpose, claude-fable-5-1), all 32 findings applied: the fixture sum tolerance for 6-digit rounding; `--only seidel` so the eight fixtures stay at `6bd53311`; the missing-fixture loop as `[fixture, tiles[]]` and the requirement tile on `REC.mtf`; O2's role and index wording; bars inside `curve`'s frame through `plotCell`'s `body` (replacing a second frame); zero line as `curve`; the limit's butt cap and `6 3 1 3` dash; `class="eleo-limit"` and a generic `marks()` helper in M1; #258's cell; `kind` limits a non-goal; `ownData`; one `TILES` constant; two changesets with consumed twins; root README module lists; the adapter strips the total; a label-thinning test; the export merged into the bars item; invocations on the limits, bars-limits and BarPlot items; the perf cell cites the roadmap review; no ADR edit.
- 2026-10-12 (user): oracles O1–O4 approved, plan approved.
- 2026-10-12 headless: Approach cells decided, none contested (row: Choose, add or reorder rows).
- 2026-10-12 (orchestrator): the Seidel fixture test's tolerance is `(n + 1) * 5e-6 * max|term|`, not the plan's 1e-6: each value is rounded to 6 significant digits (#286; the M1 reviewer confirmed it).
- 2026-10-12 review M1 round 1: 2 blocking (CRs #303 and #304, accepted by the orchestrator: a non-Core doc and the gallery adapter, with finding 4). Backlog #305 (findings 3, 5) and #306 (finding 6) into M1 (headless: backlog into M1, row: milestone acceptance within the plan).
- 2026-10-12 review M1 round 2: 1 blocking (CR #307, accepted by the orchestrator: a non-Core doc, with backlog findings 3–5 in the same file). Backlog #308 (finding 2) into M1 (headless: backlog into M1, row: milestone acceptance within the plan).
- 2026-10-12 review M1 round 3: 1 blocking (CR #309, accepted by the orchestrator: a non-Core doc, with backlog findings 2, 3, 4, 6 in the same files). Finding 5 (BarPlot in the package lists) added to #297 in M3, which edits the Svelte docs (headless: row: milestone acceptance within the plan).
- 2026-10-12 review M1 round 4: 0 blocking, nothing pulled in; #310 and #311 stay plain issues (after round 3). M1 done, pending the user's demo (O1's oracle includes `user`).
- 2026-10-12 (user, M1 demo): no-go. CR #312 (the user's feedback): "The title 'Seidel sum, mm' is too close to the top of the axis" and thin dotted dividers between the x-axis groups. `bars` only; `curve`'s matching title spacing left unchanged unless the user asks.
- 2026-10-12 review M1 round 5 (after CR #312): 1 blocking (CR #313, accepted by the orchestrator), findings 2 and 3 folded in (they bear on the user's dividers).
- 2026-10-12 review M1 round 6: 0 blocking, nothing pulled in; #314 stays a plain issue. M1 done again after CR #312, pending the user's demo.
- 2026-10-12 (user, M1 demo again): no-go. CR #315 (the user's decision): "The divider lines are too light. Let's try solid lines instead." Asked whether `bars` is fixed to its column labels: no, categories and series come from the caller, and the Seidel layout is the gallery adapter's. The user wants subsets and grouping by coefficient shown to work. Chosen in the demo thread: "caller, tile". A by-coefficient total is a caller-built Σ series (no new option), and the gallery gets a second Seidel tile grouped by coefficient. Work items #316–#318 in M1; #314 folded into #316; M2's tile count moves to 20 (#293).
- 2026-10-12 review M1 round 7 (after CR #315): 1 blocking (CR #319, accepted by the orchestrator), findings 2–4 folded in (they bear on the user's CR #315).
- 2026-10-12 review M1 round 8: 0 blocking, nothing pulled in; #320 stays a plain issue. M1 done again after CR #315, pending the user's demo.
- 2026-10-12 (user, M1 demo after CR #315): go. The two Seidel tiles are row G's bars baseline.
- 2026-10-12 CR #321 (accepted, orchestrator: a non-Core doc): the README's curve roles, stale since #199. #199 sent back once: its worker added a throw to `idx`, which the plan's Decisions keep to a wrap.
- 2026-10-12 review M2 round 1: 1 blocking (CR #322, accepted by the orchestrator, with backlog findings 3, 4, 6, 7 in the same files). Finding 2 (the changeset says **Breaking:** for #199's throws) added to #299; #323 (finding 5) a plain issue. #258's `seriesPath` comment landed in #294's commit (5b4f166): the pre-commit hook refuses a source change without a test.
- 2026-10-12 review M2 round 2: 1 blocking (CR #324, accepted by the orchestrator, with backlog findings 2, 3 in the same files).
- 2026-10-12 review M2 round 3: 0 blocking. Backlog #325 (findings 1–3) into M2 (headless: backlog into M2, row: milestone acceptance within the plan).
- 2026-10-12 CR #326 (accepted, orchestrator: a non-Core doc): the README's limit bullets, stale since #325.
- 2026-10-12 review M2 round 4: 1 blocking (CR #327, accepted by the orchestrator: necessity, in #325's files); #328 (finding 2, after round 3) a plain issue.
