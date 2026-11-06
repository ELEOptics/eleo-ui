# Plan #677: Gallery polish from the #642 M2 demo

Status: approved 2026-11-06
Branch: `plan/677-gallery-polish` PR: #702 Depends on: none (plan #642 merged 2026-11-06, PR #652) Roadmap: `agent_docs/roadmap.md`, row R

## Problem

At plan #642's M2 demo (2026-11-06) the user listed nine gallery defects: "The legend items in the beam footprint
diagram are too small. They should use the same font scaling rules as the text in the caption. Same for the
transverse ray aberration plots. The OPD plots also need legend items. The colorbar in the PSF plot needs more
ticks than just 0 and 1. The Map2D plots all need x,y axes and labels like the Cooke triplet PSF. The grid lines
should go over top the image, and should be configurable: number of major and minor ticks with lines. The curve
plot needs a legend, with each curve labeled. The vertical line in the MTF, requirements limit needs a label too.
The layout3D plot shows the image plane in front of the rays, but it should be behind them."
## Ground truth (gallery at 1440 px on main after PR #652, 2026-11-06)

| Request | What the code does today | Where |
| -- | -- | -- |
| 1, 2 Legend size | Footer legends are HTML at a fixed 11 px (`.eleo-plot__ft`); the SVG text beside them is 15 px (fans) to 23 px (footprint), ADR-0003. The recorded fan tile's footer keys its wavelengths (#616, `data-legend="rayFan"`) | `plots.css:114`, `legend.js`, gallery `data-legend` |
| 2, 3 Fan keys | The fans are panels per field and pupil axis (`<angle>° · Py` / `Px`), every series solid by wavelength; there is no T/S line style and no diffraction-limit series | `tests/fixtures/phos-core/adapters.js:144-176`, `fan.js:14-21` |
| 3 OPD legend | The `rayFan-opd` tile (sample `rayFan({ kind: "opd" })`) has no footer | `gallery/index.html` |
| 4 PSF colorbar | The sample canvas `psf` tile's colorbar is HTML `1`/`0`; the recorded linear `psf-recorded` tile has no colorbar (its adapter passes no `value`) | `gallery/index.html`, `adapters.js` |
| 5 Map2D axes | Only the sample canvas `psf` and `wavefront` tiles lack axes (`map2D(canvas, {kind})`, ADR-0003-exempt); the four typed tiles have them | `map2d.js:107,127` |
| 6 Grid over image | `plotCell` emits grid lines with the tick text in one string, drawn before the `<image>`, which covers them; no grid option. `--plot-grid` is ≈1.2:1 against ember's light end, so the token alone cannot show over a map | `curve.js:82-83`, `map2d.js:107-108`, `packages/tokens/src/tokens.json` |
| 7 Curve legend | `CurveSeries` has no `label`; `bars` draws an in-SVG key row from `BarSeries.label`, deciding rows before the frame height (`Hf`) | `bars.js:35-72` |
| 8 MTF limit label | `PlotLimitX.label` exists and draws; the gallery's `{ x: 50 }` passes none | `gallery/index.html` `MTF_LIMITS`, `limits.js:43-56` |
| 9 layout3D | The image-plane quad is painted last; in the iso view the plane is the nearest object, so painter's order by depth would keep it on top: rays over the plane is a convention (rays end on it), not depth | `layout3d.js:31-48` |

Prior art: none needed. The key row is `bars`' own, extracted (`bars.js` imports `curve.js`, so a shared module avoids
a cycle); nice ticks are `axisTicks` (`curve.js:26`); text size is `frameText`/`layoutText` (`scale.js`). No new
dependency. The Svelte wrappers spread their props (`CurvePlot.svelte`, `Map2D.svelte`), so plots-svelte needs no change.

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `curve` keys its series in the SVG: a `label` per series, or an explicit `key` of `{ label, role?, index? }` entries, placed below the x-axis label (default) or in a plot corner by `keyAt`; key text follows ADR-0003. The mtf, mtf-limits, fieldCurvature and distortion tiles key each curve; the MTF x limit reads "50 cycles/mm". | given those tiles at 1440, 1100, 700 px and at their `minWidth` / when drawn / then each key text's size equals t(F) within 1%, each distinct label has one key, no key text box overlaps another key or an axis label, wrapped lines stay inside the SVG (a lone over-long entry may overrun, bars' rule), and mtf-limits shows "50 cycles/mm" | `closed-form ADR-0003 (t(F))`; `fixture: recorded ModulationTransfer2d, FieldCurvature, Distortion field and orientation names` | `tests/gallery.spec.js::curve keys` |
| O2 | The footprint, TRA and OPD tiles key in the SVG at ADR-0003's size, with no HTML footer: the footprint one key per field with its angle, the fans one per wavelength. | given the three tiles at 1440, 1100, 700 px and `minWidth` / when drawn / then key texts equal t(F) within 1%, the footprint's keys read each recorded field angle, the fans' each wavelength in nm, no overlap with captions or axis labels, and no `.eleo-plot__ft` | `closed-form ADR-0003`; `fixture: cooke-footprint.json fieldAngleDeg, the fans fixture's wavelengths, sample.json wl` | `tests/gallery.spec.js::fan and footprint keys` |
| O3 | Every remaining Map2D tile has x,y axes and a colorbar with nice ticks (the two sample canvas tiles are dropped, user round 1), and the grid draws over the image, per axis by `grid: { x: { major, minor }, y: { major, minor } }` (`false` none), in a grid token of its colormap (`--map-grid-<map>` and `--map-grid-<map>-minor`, new in `@eleoptics/tokens`). | given each typed map tile / when drawn / then x and y axis labels, a colorbar with at least 3 ticks, and grid lines after the `<image>`; given `grid: { x: { major: 5, minor: 4 } }` / then the x majors are `axisTicks`' nice ticks for 5, labelled, with 4 minors in each interval; each map's `--map-grid-<map>` has contrast ≥ 3:1, and its minor ≥ 1.5:1, against that map's lowest and highest stops in both themes (ember, wave, viridis, gray) | `closed-form axisTicks's 1-2-5 rule (curve.js:26)`; `spec WCAG 2.1 contrast ratio, each grid token against its map's end stops` | `tests/map2d.spec.js::grid over the image` |
| O4 | `layout3D` paints the rays over the image plane they end on. | given the gallery's layout3D drawn with `rays: false` and with rays / when compared / then the `--mech` pixels with rays are a strict subset of those without | `user: rays over the plane they end on (request 9)`; `property: subset of plane pixels` | `tests/gallery.spec.js::layout3D rays over the image plane` |
| O5 | `layout2D` keys its fans or glasses in the SVG (`key`: entries or `"glass"`) at `layoutText(W)`, hidden below 630 px like its labels; the layout tiles lose their HTML footers. Clamped field labels no longer stack (#669). | given the layout2D, layout2D-fan and layout2D-glasses tiles at 1440, 1100, 700 px / when drawn / then key text equals `layoutText(W)` within 1%, entries match `legend()`/`glassLegend()` in order, no footer; given merit-before with a box of ylo/yhi ÷ 4 / then the 12° and 24° label baselines differ by at least 1 em | `closed-form ADR-0003 (layoutText)`; `reference: legend() and glassLegend() output`; `property: clamped labels 1 em apart` | `tests/gallery.spec.js::layout keys`, `tests/unit/layout2d.test.js::clamped labels do not stack` |

## Non-goals

- `bars` gets no `keyAt`, and its SVG stays byte-identical: not asked.
- Grid configuration on `curve`, `bars`, `spot`: asked for Map2D only. Next plan if wanted.
- A key on `chromaticFocus`: one curve on the legacy `kind` path (row J removes it); a one-entry key explains nothing.
- T/S line styles or a diffraction-limit key on the fans: the fans have neither (panels are Py and Px, all solid).
- Removing `legend()`, `glassLegend()`, `.eleo-plot__ft` or `Legend.svelte`: public API; removal is row J's major.
- Legend placement outside the plot (#534): waits for a phos consumer.
- Axes on the canvas `map2D(canvas, ...)`: its two gallery tiles are dropped instead (user, round 1); the API stays until row J.
- Keys on `throughFocus` and the sample `spot` tile: not asked.

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| #669 | absorb (user, round 1) | M4, reused as the work item |
| #556 | absorb (user, round 1) | M1, reused as the work item |
| #534 | related | Legend placement outside the footer; waits for phos |
| #586 | related | margins hand-copied; the key module reduces it, does not fix it |
| #639 | related | sample canvas wavefront rim; the canvas API stays |

## Constraints and assumptions

- Roadmap constraint "every gallery tile keeps working": the sample canvas `psf` and `wavefront` tiles are dropped by the user's decision (round 1), logged as a deviation in row R.
- Existing callers see no change unless they opt in: `curve` and `spot` key only when a series has a `label` or `key` is given; `rayFan` only with `key: true`; `layout2D` only with `key`. `map2D`'s default grid (majors at the axis ticks) now draws over the image in its map's grid token: a visible change on every typed map, the point of request 6.
- Key placement is the caller's (user, round 3: "Inside or below, with the plotting logic exposing this decision"): `keyAt: "below" | "top-left" | "top-right" | "bottom-left" | "bottom-right"`, default `"below"`. Below: under the x-axis label; with no `height`, the SVG grows by the key's lines, rounded to a whole px (ADR-0003); with a `height`, the frame gives up the lines (bars' rule). `PLOT_SIZES.*.aspect` describes the unkeyed default. In a corner: a box on `--surface` with no `--plot-grid` stroke (the #587 floor test reads grid-stroked rects as frames); it never resizes the frame. `minWidth` is unchanged (keys wrap).
- Each feature item ships its own changeset and README paragraph (`CLAUDE.md`; `packages/plots/README.md` owns usage); the last item names them in `release.test.js`. Tests named in a Test cell may be edited by the item.

## Decisions

ADRs relied on: ADR-0001 (key swatches take a role and index, never a color; grid lines take a token per colormap, never a literal), ADR-0003 (key text at t(F) / layoutText(W), gaps in text units, whole-px default heights). No new ADR.

Core changes (approved with the plan), all in `packages/plots/src/index.d.ts`, each typed by its feature item and
checked in `tests/types/keys.ts`:

- `PlotKeyEntry { label: string; role?: CurveSeries["role"]; index?: number }`; `PlotKeyAt = "below" | "top-left" | "top-right" | "bottom-left" | "bottom-right"`.
- `CurveSeries.label?: string`; `key?: PlotKeyEntry[]`, `keyAt?: PlotKeyAt` on `CurveSeriesProps` and `CurvePanelsProps`.
- `RayFanProps.key?: boolean`, `RayFanProps.keyAt?: PlotKeyAt`.
- `SpotSeries.label?: string`; `keyAt?: PlotKeyAt` on `SpotPanelsProps`.
- `Map2DGridProps.grid?: { x?: { major?: number; minor?: number }; y?: { major?: number; minor?: number } } | false`.
- `Layout2DProps.key?: PlotKeyEntry[] | "glass"`.

No `exports` change in any `package.json`.

## Milestones

### M1: Curve keys (done 2026-11-06) GitHub: `P677 M1: Curve keys`

Demo: `npm run gallery`: the MTF and field curvature tiles key each curve below the x label at the plot's
text size; the distortion tile keys in the top-right corner (`keyAt: "top-right"`, CR #718); mtf-limits' vertical line reads "50 cycles/mm". Proves: O1

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #678 | O1 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/gallery.spec.js` | `curve keys` |  |
| #679 | Record `seidel` and `seidel-terms` into the renderer baseline from main's build, before the extraction | forced (`split.test.js:6-8`: a baseline is recorded from the code before the change, as #642 did); without it "bars unchanged" has no oracle | `scripts/record-renderers.mjs`, `tests/fixtures/renderers-baseline.json` | `tests/unit/split.test.js::bars baseline` |  |
| #680 | Key module: `keyLayout(entries, t, { L, R, maxRow })` → rows and places, then `keyMarkup(places, entries, t, y)`; swatch by kind (square, line in the role's dash, dot); bars draws through it | two phases because bars sets the frame height from the rows before it places the key (`bars.js:36-44,71`); a module because `bars.js` imports `curve.js` (a cycle otherwise); considered a copy per renderer (#586's drift) | `packages/plots/src/key.js`, `packages/plots/src/bars.js` | `tests/unit/key.test.js` (property: wrapped lines never pass the right edge); `split.test.js::bars baseline` byte-identical | #679 |
| #681 | `curve` draws the key: one entry per distinct `label` (first use's role and index), or `key`; `keyAt`; below the x label, default height `round(H + 1.4 t · lines)`. `curve({ series: [{ points, index: 0, role: "tangential", label: "0.0° T" }] })` → a line swatch and "0.0° T" under "Spatial frequency, cycles/mm" | in `curve.js` because the frame solve lives there; considered corner-only keys (no height rule, but the user asked for below too, round 3) | `packages/plots/src/curve.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `.changeset/curve-key.md`, `tests/unit/types.test.js` (runs keys.ts) | `tests/unit/curve.test.js::key`, `tests/types/keys.ts` | #680 |
| #682 | Gallery curve tiles labelled: the MTF, field curvature and distortion adapters set `label` from the recorded field and orientation; mtf-limits' x limit `label: "50 cycles/mm"` (user) | in the adapters because `phos-core-fixtures.test.js` unit-tests them against the recordings; considered labels in the gallery's tile definitions (untested) | `tests/fixtures/phos-core/adapters.js`, `gallery/index.html` | `tests/unit/phos-core-fixtures.test.js::labels` | #681 |
| #556 reuse | Limit label offsets in text units (`right - 4`, `dy="-3"`, `top + 10` become 0.4 t, 0.3 t, 1 t) | forced (#556's named fix, `plotCell`'s t / 10 rule) | `packages/plots/src/limits.js`, `.changeset/limit-labels.md`, `packages/plots/src/curve.js`, `tests/fixtures/renderers-baseline.json` (`seidel` only, CR #703) | `tests/unit/curve.test.js::limit label offsets scale` |  |
| #704 | A below key's first row clears the x-axis label: baselines 1.4 t apart, the extra 0.2 t from the SVG (no `height`) or the frame | in `curve.js` because `placeBelow` owns the key's top and the height rule; considered a gap inside key.js (bars' baseline must stay byte-identical) | `packages/plots/src/curve.js`, `packages/plots/README.md` | `tests/unit/curve.test.js::key clears the x label` | #681 |
| #683 | Unskip O1 acceptance tests | forced (`workflow.md`, TDD: the last item unskips them) | `tests/gallery.spec.js` | `curve keys` | #678, #679, #680, #681, #682, #556, #704 |
| #735 | Changeset for the scaled sagittal dash (round 5, finding 1) | forced (a changeset per user-facing change) | `.changeset/sagittal-dash.md` | none |  |
| #736 | `series round trip` checks the sagittal polyline's own dash (finding 2) | forced (finding 2) | `tests/unit/curve.test.js` | `tests/unit/curve.test.js::series round trip` |  |
| #737 | A key line swatch takes its role's line cap (finding 3) | in `keyDrawn`/`keyMarkup` because style is curve.js's and markup key.js's; considered round caps for all (a limit is butt) | `packages/plots/src/key.js`, `packages/plots/src/curve.js` | `tests/unit/curve.test.js::key swatch takes the role's cap` | #736 |
| #730 | Sagittal dash in units of the stroke weight (about `4w 2.5w`); the renderer baseline's sagittal curve entries re-recorded (CR #726, user) | in `roleStyle` because it owns each role's dash and gets `wt`; considered a fixed bolder pattern (user chose scaling) | `packages/plots/src/curve.js`, `packages/plots/README.md` (the baseline has no sagittal curve entry, so it is unchanged) | `tests/unit/curve.test.js::sagittal dash scales with the stroke` |  |
| #731 | Key line swatch about 2 t, two dash periods; the width estimate counts it (CR #726) | in key.js because it owns swatch geometry and the estimate; considered curve.js only | `packages/plots/src/key.js` | `tests/unit/key.test.js::line swatch is two dash periods` | #730 |
| #725 | `PlotKeyEntry`'s doc comment names the role's colour (CR #723) | forced (CR #723: the comment misstated the swatch since #714) | `packages/plots/src/index.d.ts` | none (doc comment; `tests/types/keys.ts` green) |  |
| #724 | The corner key test's header and oracle line name the plot frame (round 3, finding 2) | forced (finding 2) | `tests/unit/curve.test.js` | `tests/unit/curve.test.js::corner key stays in the plot` |  |
| #720 | A corner key's box starts inside the plot on both axes; one that fits lies wholly inside; a larger one overruns only the far edges (CR #716) | clamp the start, overrun the far edges, because O1 lets a lone over-long entry overrun and a corner key never resizes the frame; considered a below fallback (overrides the caller's `keyAt`) or rows bounded by the height (moves the overrun right) | `packages/plots/src/curve.js`, `tests/unit/curve.test.js` | `tests/unit/curve.test.js::corner key stays in the plot` (four corners, fits and overruns) |  |
| #721 | README:99: the swatch in the role's colour; how a corner key wraps and overruns (CRs #716, #717) | forced (CRs #716, #717) | `packages/plots/README.md` | none (doc only) | #720 |
| #722 | Drop the redundant `limitLabels uses the t it is given` test (CR #719) | forced (CR #719) | `tests/unit/curve.test.js` | none (removal) | #720 |
| #713 | The distortion tile keys in the top-right corner (CR #705) | forced (CR #705: the M1 Demo names a `keyAt: "top-right"` tile) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::curve keys` (the corner key inside the frame) |  |
| #714 | A `reference` or `limit` key swatch in `--ink`, as its curve: `col` from roleStyle (CR #706) | `col` from roleStyle because the role decides the curve's colour (ADR-0001); considered an `ink` flag in key.js (a second role table) | `packages/plots/src/key.js`, `packages/plots/src/curve.js` | `tests/unit/curve.test.js::key swatch follows the role` |  |
| #715 | `limitLabels` without the dead `t` default (CR #708) | forced (CR #708: the only caller passes t) | `packages/plots/src/limits.js` | `tests/unit/curve.test.js::limit label offsets scale` (CR #719) |  |
| #709 | A corner key on a short plot wraps and stays in the plot (review M1, finding 5) | in `cornerKey` because it owns the box; considered a throw on a short plot | `packages/plots/src/curve.js` | `tests/unit/curve.test.js::corner key stays in the plot` | #714 |
| #710 | `keyLayout` returns `right`; `cornerKey` sizes from it (finding 6) | in key.js because it owns the width estimate (#586); considered an exported helper | `packages/plots/src/key.js`, `packages/plots/src/curve.js` | `tests/unit/key.test.js::layout reports its right edge` | #709 |
| #711 | README height rule: line 91's default names the below key, line 99 "the SVG's height becomes" (CR #707, finding 7) | forced (CR #707, finding 7) | `packages/plots/README.md` | none (doc only) |  |
| #712 | Adapter headers name their labels; the `labels` test's oracle line (findings 8, 9) | forced (findings 8, 9) | `tests/fixtures/phos-core/adapters.js`, `tests/unit/phos-core-fixtures.test.js` | `tests/unit/phos-core-fixtures.test.js::labels` |  |

### M2: Fan and footprint keys (done 2026-11-06) GitHub: `P677 M2: Fan and footprint keys`

Demo: the footprint, TRA and OPD tiles keyed inside the SVG at the plot's text size at 1440, 1100 and 700 px; no
footers. Proves: O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #684 | O2 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/gallery.spec.js` | `fan and footprint keys` | #683 |
| #685 | `rayFan({ kind: "opd", key: true })` → one key per sample wavelength ("486.1 nm", ...) below the fans, through `curve`'s `key` | in `fan.js` because `fanPanels` is not on ELEO, so a caller cannot build the panels itself; considered per-series labels (each wavelength keyed once per panel) | `packages/plots/src/fan.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `.changeset/rayfan-key.md` | `tests/unit/fan.test.js::key` | #683 |
| #686 | `spot` keys labelled series (dot swatches) below the captions or in a corner; the key's lines join `footM` (and the height-fit `frameOf(height − 9, footM)`). `spot({ panels: [{ series: [{ points, index: 0, label: "F1 0.0°" }] }] })` → a dot and "F1 0.0°" under the caption lines | in `spot.js` because its figure height comes from `foot(side)` (`spot.js:50-58`); considered spot's caption lines with a colored tspan (captions are ink-only, ADR-0001) | `packages/plots/src/spot.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `.changeset/spot-key.md` | `tests/unit/spot.test.js::key` | #683 |
| #687 | Adapters: the footprint labels each field "F<k> <angle>°", the fans carry their wavelengths as `key` | in the adapters because they read the recordings; considered parsing `legend()` HTML | `tests/fixtures/phos-core/adapters.js` | `tests/unit/phos-core-fixtures.test.js::keys` | #686 |
| #688 | Gallery: the footprint, recorded fan and OPD tiles key in the SVG; their footers removed; the footer tests (`the footprint tile has a field legend from the recording`, `a missing footprint fixture leaves its legend empty`, `the recorded fan footer keys its wavelengths (#616)`) replaced by in-SVG key checks on the same fixtures | in the tile definitions because they own the draw calls; considered keeping footers beside the keys (two legends) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::fan and footprint keys` | #685, #687 |
| #689 | Unskip O2 acceptance tests | forced (`workflow.md`, TDD) | `tests/gallery.spec.js` | `fan and footprint keys` | #684, #685, #686, #687, #688 |
| #739 | CR #738: `rayFan({ key: true, keyAt })` draws its key in a corner box of each panel through `curve`'s `keyAt`; a bad `keyAt` throws | forward `o.keyAt` to curve because curve validates and draws it; considered validating in fan.js | `packages/plots/src/fan.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `.changeset/rayfan-key.md` | `tests/unit/fan.test.js::rayFan key` | #689 |
| #740 | Types: `SpotPanelsProps.keyAt` is `PlotKeyAt`; `tests/types/keys.ts` checks spot's `label`/`keyAt` and rayFan's `key`/`keyAt`; `SpotSeries.label`'s doc names the corner | reuse `PlotKeyAt` because the plan names it for both; considered the inline union | `packages/plots/src/index.d.ts`, `tests/types/keys.ts` | `tests/unit/types.test.js` | #739 |
| #741 | `spot` keys a series only when its `label` is truthy, as `curve` does | curve's rule because one key module serves both; considered keying `0` | `packages/plots/src/spot.js` | `tests/unit/spot.test.js::key` | #689 |
| #742 | `key.js` exports `KEY_AT` and `cornerBox`; `curve` and `spot` use them (output unchanged); spot's foot comment names the key rows | in key.js because #680 put the key there to stop drift (#586); considered two copies | `packages/plots/src/key.js`, `packages/plots/src/curve.js`, `packages/plots/src/spot.js` | `tests/unit/key.test.js::corner box` | #741 |
| #745 | CR #744: `rayFan` passes `keyAt: o.keyAt` in its spec literal, no guard | in the literal because curve reads a missing `keyAt` as "below"; considered keeping the guard | `packages/plots/src/fan.js` | `tests/unit/fan.test.js::rayFan key keyAt` | #739 |

### M3: Maps and the 3D image plane GitHub: `P677 M3: Maps and the 3D image plane`

Demo: every Map2D tile with axes, a ticked colorbar and a grid over the image in its map's grid token; one tile with
`grid: { x: { major: 5, minor: 4 }, y: { major: 5, minor: 4 } }`; the sample canvas PSF and wavefront tiles gone;
layout3D's rays over the image plane. Proves: O3, O4

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #690 | O3 and O4 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/map2d.spec.js`, `tests/gallery.spec.js` | `grid over the image`, `layout3D rays over the image plane` |  |
| #691 | `plotCell` takes `grid: false`: tick text without grid lines | in `curve.js` because `plotCell` emits both in one string (`curve.js:82-83`); considered stripping lines from its output by regex in map2D (brittle) | `packages/plots/src/curve.js` | `tests/unit/curve.test.js::plotCell without grid` |  |
| #692 | Grid tokens: `map-grid-<map>` and `map-grid-<map>-minor` for ember, wave, viridis and gray, light and dark, in `@eleoptics/tokens` (user, approval: a token per map) | forced (user: a token per colormap; ADR-0001 bans a literal in `packages/plots/src`); values chosen to clear the contrast test | `packages/tokens/src/tokens.json`, `packages/tokens/README.md`, `.changeset/map-grid-tokens.md` | `tests/unit/tokens.test.js::map grid contrast` |  |
| #693 | `map2D` grid after the `<image>`, per axis: majors at `axisTicks` for `major` (labelled; the right margin's tick loop uses the same ticks), `minor` between, `false` none; each line in its map's `--map-grid-<map>` (minors in `-minor`). `map2D({ ..., grid: { x: { major: 5, minor: 4 } } })` → 5 labelled x majors, 4 minors per interval, after the `<image>` | a token per colormap (user) because `--plot-grid` is ≈1.2:1 on ember's light end and wave's ends and middle differ in lightness; considered an `--ink` line on a `--surface` halo (user chose tokens) or `mix-blend-mode` (fails export) | `packages/plots/src/map2d.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `.changeset/map2d-grid.md` | `tests/map2d.spec.js::grid option` | #691, #692 |
| #694 | Gallery: drop the sample canvas `psf` and `wavefront` tiles (user) with their `.map` colorbar branch; the linear recorded PSF gets a colorbar (`value`: "Intensity, relative"); one map tile shows the `grid` option; tests updated: `TILES`, blanked-tile rows, `maps follow their theme`, `canvas tiles redraw` (canvas count), `sample call unchanged` re-pointed at a detached canvas so the canvas API keeps its baseline | forced (user, round 1: drop the two tiles); the colorbar from the adapter because the log tile's already passes `value` | `gallery/index.html`, `tests/fixtures/phos-core/adapters.js` | `tests/gallery.spec.js::map tiles`, `tests/map2d.spec.js::sample call unchanged` | #693 |
| #695 | `layout3D` paints the image plane just before whichever `seg("out")` runs (`layout3d.js:40` or `:46`) | forced (request 9: rays end on the plane, so they paint over it; in the iso view the plane is nearest, so a depth sort would not do it) | `packages/plots/src/layout3d.js`, `.changeset/layout3d-plane.md` | `tests/gallery.spec.js::layout3D rays over the image plane` |  |
| #696 | Unskip O3 and O4 acceptance tests | forced (`workflow.md`, TDD) | `tests/map2d.spec.js`, `tests/gallery.spec.js` | both | #690, #691, #692, #693, #694, #695 |
| #746 | `map2D` `grid: null` (or an axis `null`) is the default; `minor` above 20 throws; docs say `major` is about that many nice ticks | null as undefined because the Svelte wrapper spreads props; considered no cap on minors | `packages/plots/src/map2d.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `tests/map2d.spec.js` | `tests/map2d.spec.js::grid option` | #696 |
| #747 | The grid token is the drawn colormap's (ember fallback), so no caller string reaches the markup | as colormap falls back; considered escaping the raw name | `packages/plots/src/map2d.js`, `tests/map2d.spec.js` | `tests/map2d.spec.js::grid option` | #746 |
| #748 | A linear colorbar has at least 3 ticks in range | retry niceTicks with a larger target, tolerance relative to the step; considered a power-of-ten label scale | `packages/plots/src/map2d.js`, `tests/map2d.spec.js` | `tests/map2d.spec.js::colorbar ticks` | #747 |
| #749 | Each grid token's usage names its own map | a test on the 16 copied strings; considered a one-off edit | `packages/tokens/src/tokens.json`, `tests/unit/tokens.test.js` | `tests/unit/tokens.test.js::map grid contrast` | #696 |
| #750 | Gallery: drop the dead `[data-bar]` loop | forced (review finding) | `gallery/index.html` | the full gallery suite | #696 |

### M4: Layout keys GitHub: `P677 M4: Layout keys`

Demo: the layout2D tiles keyed in the SVG at the layout's text size, no footers, no keys below 630 px; merit-before
with a cropped box shows its 12° and 24° labels apart; the release planned. Proves: O5

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #697 | O5 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/gallery.spec.js` | `layout keys` | #683 |
| #698 | `layout2D({ key })`: entries (a line swatch in idx(index)) or `"glass"` (the swatches `glassLegend` gives), a row under the drawing at `layoutText(W)`, not drawn below 630 with no room kept. `layout2D({ key: [{ label: "F1 0.0°", index: 0 }] })` → a line swatch and "F1 0.0°" under the drawing | in `layout2d.js` through the key module because the drawing's height and the 630 rule live there; considered the HTML footer scaled by a CSS variable (two mechanisms, user round 2) | `packages/plots/src/layout2d.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `.changeset/layout2d-key.md` | `tests/unit/layout2d.test.js::key` | #680 |
| #699 | Gallery: the layout tiles pass `key` (fields or wavelengths from the sample, glasses for the Cooke tile); their footers removed | in the tile definitions because they own the data; considered keeping `data-legend` | `gallery/index.html` | `tests/gallery.spec.js::layout keys` | #698 |
| #669 reuse | Clamped field labels 1 em apart: sort by y, push each down | forced (#669's named fix) | `packages/plots/src/layout2d.js`, `.changeset/layout2d-labels.md` | `tests/unit/layout2d.test.js::clamped labels do not stack` | #698 |
| #700 | Release planned: `release.test.js` names row R's changesets (plots minor, tokens minor; plots-svelte unplanned, its wrappers spread props) | forced (`release.test.js`'s per-row changeset tests, as row Q's) | `tests/unit/release.test.js` | `release.test.js::row R changesets` | all above |
| #732 | Drop the merit before/after tile and the tests only it uses (CR #727, user) | forced (CR #727) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js` (tile lists) |  |
| #733 | A stop bar wherever STO is labelled; the renderer baseline's layout2D entries re-recorded (CR #729, user) | in `layout2d.js` because it draws the label and the bar; considered a per-tile `marks` option (the user asked for every plot) | `packages/plots/src/layout2d.js`, `tests/fixtures/renderers-baseline.json`, `.changeset/layout2d-stop-bar.md` | `tests/unit/layout2d.test.js::a labelled stop has its bar` |  |
| #701 | Unskip O5 acceptance tests | forced (`workflow.md`, TDD) | `tests/gallery.spec.js` | `layout keys` | #697, #698, #699, #669, #700, #732, #733 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| A corner key covers data | a misleading plot | the caller's choice (`keyAt`); default `below` |
| Keys wrap to many lines at a tile's minimum width | squat frames | acceptance tests at `minWidth`; with no `height`, the SVG grows |
| A grid token clears its map's ends but not wave's near-white middle | lines fade mid-map on wave | known limit (user, approval); judged at M3's demo |
| Dropping two tiles breaks unlisted tests | red gate | the gallery item lists them (critic finding 12) |

## Change log

- 2026-11-06 draft from the #642 M2 demo requests.
- 2026-11-06 round 1 (user): issues confirmed (absorb #669, #556; related #534, #586, #639); legends in the SVG as a key row; layout2D footers included; the two sample canvas map tiles dropped.
- 2026-11-06 round 2 (user): series `label` plus an optional explicit `key`; grid set per axis; layout2D keys in the SVG via a `key` option; roadmap row R with new outcomes.
- 2026-11-06 round 3 (user): key placement "Inside or below, with the plotting logic exposing this decision"; MTF x limit "50 cycles/mm"; pre-mortem guards: keys at narrow width, grid on dark maps.
- 2026-11-06 critic (fable): applied findings 1 (#642 merged: re-measured, M4 gate dropped), 2 (fans key wavelengths only), 3 (layout3D: a convention, before each `seg("out")`, subset test), 4 (bars baseline recorded first), 5 (two-phase key module), 6 (key below the x label), 7 (whole-px height), 8 (`plotCell` `grid: false`), 9 (halo, no token), 10 (corner box stroke), 11 (`chromaticFocus` cut), 12 and 15 (tests named), 13 (row R added at publish), 14, 16 (`tests/types/keys.ts`), 17 (README and changeset per item), 20 (spot `footM`). Contested: layout2D `key` for field tiles vs reusing the fan-end `labels` (asked at approval).
- 2026-11-06 approval (user): outcomes, acceptance tests and oracles approved; one plan; layout2D `key` row on every layout tile (the critic's fan-end `labels` alternative declined); key rules (a) as written; grid lines in a new token per colormap instead of the halo, with O3's oracle restated: each map's grid token ≥ 3:1 (minor ≥ 1.5:1) against its own map's end stops, both themes.
- 2026-11-06 roadmap row R added with outcomes U19 to U23; deviation: the sample canvas `psf` and `wavefront` tiles dropped (user, round 1).
- 2026-11-06 CR #703 accepted (user): #556's scaled offsets move the recorded `seidel` baseline entry (t = 20.2 px); #556 re-records only that entry and takes `curve.js` (one line, `t` to `limitLabels`) into its Files.
- 2026-11-06 orchestrator: #681 takes `tests/unit/types.test.js` into its Files, which lists each type file, so `check.sh` compiles `tests/types/keys.ts`; #680 adds `keyMarkup`'s `{ mark }` opt-in for `data-key` (the #678 test's selector), so bars' baseline holds.
- 2026-11-06 orchestrator: #704 added to M1 (#682's worker ran `curve keys` unskipped: the below key's first row overlaps the x label, a #681 placement defect); #683 runs after it.
- 2026-11-06 review M1 round 1 (4 blocking, 5 backlog): CRs #705, #706, #707, #708 accepted (orchestrator: each keeps every invariant), fixed by #713, #714, #711, #715; backlog #709, #710, #711, #712 into M1.
- 2026-11-06 review M1 round 2 (4 blocking): CRs #716 to #719 accepted (orchestrator: each keeps every invariant), fixed by #720, #721, #722 and this plan's M1 Demo (CR #718: the distortion tile keys top-right).
- 2026-11-06 review M1 round 3 (1 blocking, 1 backlog): CR #723 accepted (orchestrator: a doc comment in `index.d.ts`, Core but listed for #681), fixed by #725; backlog #724 into M1.
- 2026-11-06 orchestrator: #724 and #725 share one commit because `check-tests-touched.sh` refuses #725's comment-only `index.d.ts` change without a test touched, and a test written only to pass the hook was round 2's finding 4 (CR #719).
- 2026-11-06 M1 reviewed in 4 rounds (9, 4, 2, 0 counting pulled-in items); round 4 says 0 blocking; ticked.
- 2026-11-06 M1 demo (user): no go yet. CR #726 (sagittal dashes scale with the stroke, a longer key line swatch; user chose scaling) reopens M1 with #730, #731. For M4: CR #727 drops the merit before/after tile (#732); CR #728 adds the glass key to the field key (#698 and #699 amended); CR #729 draws a stop bar wherever STO is labelled (#733). The user asked whether eleo-ui should adopt an existing plotting library instead (answered on the PR).
- 2026-11-06 paused after M1 (user): a library spike, #734, runs first; M1's CR #726 items (#730, #731) and M2 to M4 wait on its ADR.
- 2026-11-06 #734 (user): ADR-0004 accepted, Observable Plot not adopted; the plan resumes with M1's #730 and #731.
- 2026-11-06 review M1 round 5 (0 blocking, 3 backlog): #735, #736, #737 into M1; the milestone ticks after a round with nothing pulled in.
- 2026-11-06 M1 reviewed again after the demo (rounds 5 and 6; round 6: 0 blocking, nothing pulled in); ticked.
- 2026-11-06 M1 demo (user): go; M1 accepted.
- 2026-11-06 review M2 round 1 (1 blocking, 4 backlog): CR #738 accepted (orchestrator: restores the plan's approved `RayFanProps.keyAt`), fixed by #739; backlog #740 to #742 into M2 (#743, finding 5's comments, folded into #740 and #742, since a comment-only item needs a hook-only test).
- 2026-11-06 review M2 round 2 (1 blocking, 1 backlog): CR #744 accepted (orchestrator: a simplification inside #739's Files), fixed by #745. Finding 2: #742's "byte-identical" holds for curve but not spot, whose corner box now rounds with key.js's `toFixed(2)` (76 of 22704 sweep calls differ by 0.01 px); accepted as is (orchestrator) because spot corner keys are new in this plan (#686) and unreleased, so no shipped output changes; considered changing spot's `r2` (moves every spot value, re-records its baselines).
- 2026-11-06 M2 reviewed in 3 rounds (5, 2, 0 counting pulled-in items); round 3 says 0 blocking; ticked.
- 2026-11-06 M2 demo (user): go; M2 accepted.
- 2026-11-06 orchestrator: #695 and #696 share one commit because #695's only test is the O4 acceptance test #696 unskips, and `check-tests-touched.sh` refuses #695's source change alone.
- 2026-11-06 review M3 round 1 (0 blocking, 8 backlog): findings 1, 3, 8 into #746; 2 into #747; 4 (pre-existing colorbar ticks) into #748; 6 into #749; 7 into #750. Finding 5 (wave's major grid token fainter than its minor at zero) is #751, left to the user at M3's demo, as the Risks row says.
