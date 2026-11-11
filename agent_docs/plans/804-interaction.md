# Plan #804: Hover, click, zoom and pan on every 2D plot

Status: approved 2026-11-10
Branch: `plan/804-interaction` PR: #840 Depends on: none Roadmap: `agent_docs/roadmap.md`, row H

## Problem

phos needs to read values off its plots and to act when the user clicks a series, a surface or a field
(roadmap U13). Today every `@eleoptics/plots` renderer returns static SVG markup: nothing tells a caller
which series is under the pointer or what its value is, and `PlotCard` has nowhere to show it. Row H comes
next on the roadmap (2026-11-10): rows Q and R are done and no plan is open.

## Ground truth

- Every SVG renderer returns a markup string (`renderers.js`, `index.js`); the Svelte wrappers put it in a
  `div.eleo-svg` with `{@html}` (`CurvePlot.svelte`, `Map2D.svelte`, ...). No renderer listens to events.
- Every framed renderer draws its marks in data units in one
  `<g transform="matrix(...)">`, inside a nested `<svg>` viewport in `curve.js:89` (`plotCell`, also used by `bars` and `map2D`) and `spot.js:67`, bare in
  `layout2d.js:245`. So the browser's `getScreenCTM().inverse()` on that group maps a pointer to data
  coordinates, and a polyline's or path's own points are the data: hover needs no copy of the data, only the
  identity of each mark (series index, role, label, panel).
- Marks today: `curve` a `<polyline>` (single plot) or `<path>` (panels) per series; `spot` one `<path>` of
  `M x,y h0` dots per series; `bars` one `<rect>` per value; typed `map2D` one pixelated `<image>` (its
  values are not in the markup); `layout2D` polylines per ray run (`data-status`), surfaces as polygons and lines (corrected at #818).
  Existing `data-*`: `data-status` (layout runs), `data-key` (key labels), `data-grid` (spot grid).
- `fit(el, draw)` (`fit.js`) redraws at the element's width; a hover layer must survive a redraw
  (`innerHTML` replaced).
- `PlotCard.svelte` is a frame: header (title, meta, colorKey, actions), body (children), footer. No state.
- Tests: `node --test tests/unit/*.test.js` (string markup, no DOM layout), Playwright (`tests/*.spec.js`)
  on the gallery for anything needing `getScreenCTM`. U14's redraw measurement is `tests/perf.spec.js` (`PERF=1`).
- Core: `packages/plots/src/index.d.ts` (new props and the event types) and, if a new module is exported,
  `packages/plots/package.json`'s `exports` (not needed if it is re-exported from `index.js`).
- ADR-0001: renderers by data shape here, app state in phos; roles, never colors. ADR-0003: text sizes from
  the frame width (the hover tooltip is HTML in `interact`'s overlay, outside the SVG, so ADR-0003 doesn't bind it; CR #863).
  ADR-0004: Observable Plot not adopted; revisit "if hover, zoom and export turn out to be most of a plan".
- Prior art: pointer-to-data mapping is the DOM's `getScreenCTM`/`DOMPoint.matrixTransform`; nearest point
  is a linear scan (20 × 200 points, a 10 000-point spot: well under a frame). No library needed. d3-zoom
  (zoom/pan) and Observable Plot's `tip` were weighed in ADR-0004 and not adopted.

## Outcomes

U13's roadmap oracle covers O1, O2 and O5. O5's wording changes U13 (user, round 2): zoom redraws at the
zoomed range instead of rewriting the `viewBox`.

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | Hovering any 2D plot (`curve` and `rayFan`, `spot`, `throughFocus` and the footprint, `bars`, typed `map2D`, `layout2D`) emits the nearest data point with its series (index, role, label), panel and values (a layout's lens element: its glass and properties, CR #958), or, away from a point on a drawn line, the line's linearly interpolated reading flagged `interpolated` (CR #874); a map reports the sample's indices and, given the values, its value. | given each gallery tile, when a synthetic pointer event lands at a data point's drawn position (computed from the `matrix(...)` attribute and the viewport's `x`/`y` plus the SVG's `getBoundingClientRect`, never from `getScreenCTM`), then the hover event carries that point's data coordinates within 0.5 px (`toData`, `TOL_PX` in `tests/unit/helpers/svg.js`), its series and panel | `property: round trip through the inverse transform (roadmap U13)`; for maps, `fixture: the recorded value at that sample (tests/fixtures/phos-core/)` | `tests/interact.spec.js::hover emits the point under the pointer` |
| O2 | Clicking a series, a bar, a layout surface or a field fan emits a select event naming it; eleo-ui does nothing else with it. | given each tile, when a click lands on a mark, then one select event names its series (or bar, surface, field) and the markup is unchanged | `property: the event names the clicked mark's own data-* identity` | `tests/interact.spec.js::click selects a mark` |
| O3 | While a point is hovered, `interact` draws a dot on it, thin drop lines to both axes and a tooltip near the pointer with `readout(event, axes)` (CR #856, user); the plots-svelte wrappers take `onhover` and `onselect` and pass their axes (CR #857: no PlotCard footer line). | given a CurvePlot on the Svelte test page and the gallery's curve tiles, when the pointer moves over a curve, then the dot sits on the point, the lines end on the frame's bottom and left edges, and the tooltip near the pointer shows that point's label and values | `closed-form: readout() of the event's fields and the caller's axis specs`; `property: the dot is the hovered point within 0.5 px (from the matrix attribute)`; `user: the hover marks and tooltip in both themes and palettes at M1's re-demo` | `tests/svelte.spec.js::CurvePlot hover tooltip` |
| O4 | With no listener attached, every renderer draws the base markup apart from the new `data-*` attributes, every tile looks as at the plan's start, and U14's redraw budget holds for every renderer the plan touches. | given the recorded renderers and the gallery, when drawn, then the markup with `data-*` stripped equals `renderers-baseline.json`, and the tile screenshots match those recorded at the plan's start | `fixture: tests/fixtures/renderers-baseline.json (scripts/record-renderers.mjs, main at the plan's base)`; `user: the tile screenshots at M1's demo (roadmap, Design references)`; `measurement: tests/perf.spec.js, redraw medians logged in the Change log (U14)` | `tests/unit/split.test.js::SVG renderers draw the base markup` |
| O5 | `curve` (and `rayFan`), `spot` (and `throughFocus`), typed `map2D` and `layout2D` (CR #957) zoom about the pointer on the wheel, pan on drag and reset on double-click or `reset()`, by redrawing at the zoomed range (`view`); panels zoom together; the view survives data redraws until reset. | given a curve, spot and map tile, when wheel, drag and double-click events land, then the redrawn axes span the expected ranges, the data point under the pointer stays under it through a wheel zoom, a data redraw keeps the view, and reset restores the original markup exactly | `closed-form: zoom about a point (range' = p + (range - p) / k)`; `property: reset restores the original markup byte for byte (roadmap U13)` | `tests/interact.spec.js::zoom pan and reset` |
| O6 | The keyboard reaches everything: a focused plot steps through points with ←/→, series with ↑/↓, selects with Enter, clears with Escape, zooms with + and −, resets with 0. | given a focused curve tile, when those keys are pressed, then the same hover, select and view events fire as for the pointer | `property: each key's event equals the pointer event at the same point` | `tests/interact.spec.js::keyboard` |
| O7 | Hover keeps up on big data: one pointer move on a 10 000-point spot or a 256 × 256 map resolves in under 16 ms. | given the U14 reference sizes, when 20 pointer moves are timed, then the median is under 16 ms | `measurement: performance.now() in tests/perf.spec.js, median of 20 moves (U14's method, PERF=1, not a CI gate)` | `tests/perf.spec.js::hover (U14)` |

## Non-goals

- Box zoom and touch gestures (round 2: wheel, drag and double-click only).
- Zoom on `bars`: U13 zooms curves, points and maps (`layout2D` zooms since CR #957, user).
- Export (row I).
- Hover on the canvas renderers (`layout3D`, the sample canvas `map2D`): `layout3D`'s viewport is phos's (threlte); the sample canvas path goes in J.
- What a click does (phos decides, U13). PlotCard holds no hover state (round 1: props wiring).
- Legend placement outside the plot ([#534], waits for phos).
- The `interact` Svelte action as public API: it is internal to plots-svelte (phos calls `interact` from `@eleoptics/plots` for its own plots).

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| [#585] | absorb (user, round 1) | M2, reused: `curve.js`'s dead `PLOT_L/B/T` and `plotCell`'s default margins |
| [#586] | absorb (user, round 1) | M2, reused plus two items: the margins in one export, used by `curve`, `bars`, `map2D`, `spot` and `PLOT_SIZES` (`sizes.js`) |
| [#263] | absorb (user, round 1) | M2, reused: one drawn-point predicate and step rule for `curve.js` and `spot.js`, which hover's scan also uses |
| [#803] | absorb (user, round 1) | M2, reused: `curve` rejects a non-string key label (own changeset) |
| [#659] | absorb (user, round 1) | M2, reused with \[#662\]: `layout2d.js`'s redundant `virt` field |
| [#662] | absorb (user, round 1) | M2, folded into [#659]'s item: the mirror-bodies test anchor |
| [#588] | absorb (user, round 1) | M2, folded into [#586]'s items: stale test comments in `scale` and `curve` tests |
| [#336] | absorb (user, round 1) | M2, folded into the bars `data-*` item: `bars.test.js`'s old-plots stub |
| [#448] | absorb (user, round 1) | M3, reused: `map2d.js`'s range test, next to the map `view` |
| [#450] | absorb (user, round 1) | M3, reused: `map2d.js`'s dead log-tick guard |
| [#554] | absorb (user, round 1) | M3, reused: `fit` measures every element before drawing any; the gallery's zoom and live-update demo redraws under `fit`, otherwise unrelated to interaction |
| [#323] | related | `limits.js` and `plotCell`'s body: interaction doesn't change how limits enter |
| [#534] | related | legend placement, waits for phos |

## Constraints and assumptions

- U14: interaction adds no work to a redraw. Listeners attach once to the host element (delegation), not per
  draw, so a `fit` redraw or a Svelte `{@html}` swap keeps them.
- The markup stays a string (plots-svelte SSR: the server draws, the client hydrates); `interact` is client-only.
- Assumption: `getScreenCTM()` on the data group is exact in Chromium inside `curve`'s and `spot`'s nested
  `<svg>` viewports and on `layout2D`'s bare group (M1 proves it on `curve`; if not, `interact` computes the
  matrix from the `transform` attribute and the viewport's `x`/`y`).
- A map's values are not in its markup; the hover event carries the sample's indices (from the `<image>`'s
  extent and shape attributes) and fills `value` only when the caller passes `values` (the wrappers do).
- `interact` and `readout` join the `ELEO` object (`index.js`'s `Object.assign`), so the IIFE the gallery and
  `tests/svelte.spec.js` load has them.
- Tile screenshots for review go to the draft `review-assets` release, never into git.

## Decisions

- ADR-0004's revisit trigger ("hover, zoom and export most of a plan") is met by this plan. Weighed again
  at the interview: the work here is mark identity, the readout and keyboard, which no library gives; zoom by
  range is a few lines of arithmetic on the ranges the renderers already take (d3-zoom manages a transform
  this plan doesn't use). No dependency, no new ADR; the plan's approval records it.
- No other ADR: ADR-0001 already puts app logic in phos.
- Core (approved with the plan): `packages/plots/src/index.d.ts` (the `interact` export, `HoverEvent`,
  `SelectEvent`, `View`, `InteractOptions`, `readout`, the `view` prop on `CurvePlotProps`, `RayFanProps`,
  `SpotPanelsProps`, `ThroughFocusProps`, `Map2DGridProps`). `interact` is re-exported from `index.js`, so no
  `exports` change. Roadmap U13's text: "by redrawing at the zoomed range" for "by rewriting the `viewBox`".

## Milestones

### M1: hover on a curve, end to end GitHub: `P804 M1: Curve hover`

Done 2026-11-10 (fourth tick): re-demo 2 (CR #890, user) reopened it at 3d03c1e; reviewed again to round 12 (Review M1: 0 blocking), full gate green on 76a85bc; accepted at re-demo 3 (user: go). Before that the re-demo (CRs #872, #874) reopened it at b45569c, the first demo (CRs #856, #857) at 200ef61. Earlier: the first demo's CRs #856, #857 reopened it at 200ef61.

Demo: `npm run gallery`, hover the MTF tile: a dot on the curve, thin drop lines to both axes and a tooltip near the pointer, e.g.
`Tangential · 120 cycles/mm, 0.62` (CRs #856, #857); on the Svelte test page a CurvePlot shows the same tooltip. The tile screenshots from the
plan's start (both themes and palettes) on the `review-assets` release, beside today's. Proves: O1 (curve), O3

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #805 | O1 and O3 acceptance tests, skipped; an opt-in screenshot test (`SHOTS=1`) that writes every tile in both themes and palettes to `test-results/` | forced (`workflow.md`, TDD: the first item writes them skipped; roadmap Design references: screenshots at the row's start) | `tests/interact.spec.js`, `tests/svelte.spec.js`, `tests/gallery-shots.spec.js` | the new tests, skipped; `SHOTS=1 npx playwright test tests/gallery-shots.spec.js` writes 4 PNGs per tile | none |
| #806 | `curve` marks carry `data-series` (the series index), `data-role`, `data-label` and `data-panel`; `split.test.js` strips `data-*` before comparing with the baseline | identity on the existing element because the points are the polyline's own and a click must name the series, not a point; considered a point index per vertex, which repeats the polyline | `packages/plots/src/curve.js`, `tests/unit/split.test.js` | `tests/unit/curve.test.js::series data attributes` | #805 |
| #807 | `interact(el, opts)`: one delegated `pointermove` on the host maps the pointer to data through the data group's `getScreenCTM().inverse()`, scans the marks' points, emits `onhover(HoverEvent)` (or `null` on leave); returns `stop()`; added to the `ELEO` object | delegation on the host because the markup is replaced on every redraw; considered binding per mark, which a redraw drops | `packages/plots/src/interact.js`, `packages/plots/src/index.js` | `tests/interact.spec.js::curve hover round trip` | #806 |
| #808 | `readout(event, { x, y })`: the readout text from the event and the caller's axis specs, `<label> · <x> <unit>, <y> <unit>`, with `fmt`; documented in the plots README | the caller's axis specs because the wrappers and the gallery already hold them; considered labels and units on the root `<svg>`, an attribute on every framed renderer (critic) | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/unit/readout.test.js::readout text` | #807 |
| #809 | Types: `interact`, `InteractOptions`, `HoverEvent`, `readout` | forced (Core: `index.d.ts`, listed in this plan) | `packages/plots/src/index.d.ts`, `tests/types/interact.ts` | `tests/unit/types.test.js::interact types` | #807 |
| #810 | `CurvePlot` takes `onhover`/`onselect` through an internal `interact` action; `PlotCard` takes `readout` and shows it in a footer line; the SSR stubs gain `interact` and `readout` | an action because every wrapper reuses it (M2); the `readout` prop (round 1: props wiring, user; considered the existing `footer` snippet, critic) | `packages/plots-svelte/src/lib/interact.svelte.js`, `packages/plots-svelte/src/lib/CurvePlot.svelte`, `packages/plots-svelte/src/lib/PlotCard.svelte`, `packages/plots-svelte/README.md`, `tests/unit/plots-svelte.test.js` | `tests/unit/plots-svelte.test.js::PlotCard readout` | #808, #809 |
| #811 | Gallery: a readout line under every tile, filled by `interact` and `readout`; `tests/svelte.spec.js`'s stub and a `PlotCard` harness (`tests/fixtures/svelte/ReadoutHarness.svelte`) | forced (round 1: the demo, user); a harness because `svelte.spec.js` compiles only the wrappers | `gallery/index.html`, `tests/fixtures/svelte/ReadoutHarness.svelte` | `tests/gallery.spec.js::readout line under every tile` | #810 |
| #812 | Unskip M1's acceptance tests | forced (`workflow.md`, TDD: the last item unskips them) | `tests/interact.spec.js`, `tests/svelte.spec.js` | the M1 tests | #805, #806, #807, #808, #809, #810, #811 |
| #851 | `curve`'s `data-label` escapes once (CR #841) | forced (CR #841, review M1 finding 1: `esc` already escapes `"`) | `packages/plots/src/curve.js` | `tests/unit/curve.test.js::series data attributes` | #812 |
| #842 | `HoverEvent.series.index` documented as the series position, not its palette slot | forced (review M1 finding 2) | `packages/plots/src/index.d.ts`, `packages/plots-svelte/README.md` | `tests/unit/types.test.js::interact types` | #812 |
| #843 | The `hover` action binds `interact` only when a callback is given | forced (review M1 finding 3: O4's "with no listener attached") | `packages/plots-svelte/src/lib/interact.svelte.js` | `tests/unit/plots-svelte.test.js::hover binds only with a callback` | #812 |
| #844 | `split.test.js` strips only the plan's `data-*` names, keeping `data-grid` guarded | forced (review M1 finding 5) | `tests/unit/split.test.js` | `tests/unit/split.test.js::SVG renderers draw the base markup` | #812 |
| #845 | `interact` drops a non-finite point instead of shifting the pairs after it | forced (review M1 finding 6) | `packages/plots/src/interact.js` | `tests/interact.spec.js::non-finite points are skipped` | #812 |
| #846 | `readout` prints `0`, never `−0` | forced (review M1 finding 7) | `packages/plots/src/interact.js` | `tests/unit/readout.test.js::no negative zero` | #845 |
| #847 | Gallery readout units from each tile's recording, not a hand-kept table | forced (review M1 finding 8: O3's "x and y with units") | `gallery/index.html` | `tests/gallery.spec.js::readout units from each tile's recording` | #812 |
| #848 | `gallery.spec.js`'s footer comment names the readout line | forced (review M1 finding 9) | `tests/gallery.spec.js` | `tests/gallery.spec.js::fan and footprint keys` | #847 |
| #849 | The two curve hover tests share one helper | forced (review M1 finding 10) | `tests/interact.spec.js` | `tests/interact.spec.js::curve hover round trip` | #845 |
| #852 | The gallery units test matches `readout()`'s U+2212 minus and unit spacing | forced (review M1 round 2 finding 1) | `tests/gallery.spec.js` | `tests/gallery.spec.js::readout units from each tile's recording` | #849 |
| #853 | The test helpers parse drawn points as `pairs()` does since #845 | forced (review M1 round 2 finding 2) | `tests/interact.spec.js`, `tests/gallery.spec.js` | `tests/interact.spec.js::non-finite points are skipped` | #852 |
| #854 | Gallery `readoutAxes` returns the recording itself | forced (review M1 round 2 finding 3) | `gallery/index.html` | `tests/gallery.spec.js::readout units from each tile's recording` | #849 |
| #858 | `interact` draws a hover dot and drop lines to both axes in an overlay on the host (CR #856) | an overlay layer because the plot markup must stay byte-identical and is replaced on redraw; considered marks inside the plot SVG, which a redraw drops | `packages/plots/src/interact.js`, `packages/plots/src/plots.css` | `tests/interact.spec.js::hover marks the point and its drop lines` | #854 |
| #859 | `interact` shows the readout as a tooltip near the pointer (CR #856) | in `interact` so every caller gets it (user); considered a PlotCard tooltip, which plain-JS callers rebuild | `packages/plots/src/interact.js`, `packages/plots/src/plots.css`, `packages/plots/README.md` | `tests/interact.spec.js::tooltip follows the pointer` | #858 |
| #860 | `InteractOptions` types `axes`, `marks`, `tooltip` (CR #856) | forced (Core: `index.d.ts`, listed in this plan) | `packages/plots/src/index.d.ts` | `tests/unit/types.test.js::interact types` | #859 |
| #861 | PlotCard drops `readout`; CurvePlot passes its axes to the tooltip (CR #857) | forced (CR #857, user) | `packages/plots-svelte/src/lib/PlotCard.svelte`, `packages/plots-svelte/src/lib/CurvePlot.svelte`, `packages/plots-svelte/README.md` | `tests/svelte.spec.js::CurvePlot hover tooltip` | #860 |
| #862 | The gallery's readout line becomes each tile's tooltip (CR #857) | forced (CR #857, user) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::tooltip on every curve tile` | #860 |
| #864 | `interact` reference-counts the hover host class across calls | forced (review M1 round 4 finding 2) | `packages/plots/src/interact.js` | `tests/interact.spec.js::two interact calls on one host` | #862 |
| #865 | The hover tooltip is an aria-live region | forced (review M1 round 4 finding 3: the removed readout lines were live regions) | `packages/plots/src/interact.js` | `tests/interact.spec.js::tooltip is a live region` | #864 |
| #866 | The gallery tooltip test hovers a non-curve tile before asserting none | forced (review M1 round 4 finding 4) | `tests/gallery.spec.js` | `tests/gallery.spec.js::tooltip on every curve tile` | #862 |
| #868 | The plots README describes the hover overlay's lifetime and live region (CR #867) | forced (CR #867: stale doc since #865) | `packages/plots/README.md` | none (docs) | #865 |
| #869 | The tooltip's live region is back before the first hover after a redraw | forced (review M1 round 5 finding 2: the gallery and CurvePlot replace the markup after `interact`) | `packages/plots/src/interact.js` | `tests/interact.spec.js::live region survives a redraw` | #868 |
| #870 | The empty tooltip collapses through a CSS `:empty` rule | forced (review M1 round 5 finding 3) | `packages/plots/src/interact.js`, `packages/plots/src/plots.css` | `tests/interact.spec.js::tooltip is a live region` | #869 |
| #871 | The hover overlay is re-added when a redraw happens under the pointer | forced (review M1 round 6 finding 1: #869 covers only redraw-then-enter) | `packages/plots/src/interact.js` | `tests/interact.spec.js::live region survives a redraw under the pointer` | #870 |
| #873 | Drop lines dashed in the grid style, ending exactly on each axis (CR #872) | forced (CR #872, user: "a dashed version of the grid lines"; the horizontal overshot the y axis, the vertical fell short of the x axis) | `packages/plots/src/interact.js`, `packages/plots/src/plots.css` | `tests/interact.spec.js::hover marks the point and its drop lines` | #871 |
| #875 | Hover reads the line between data points by linear interpolation; snaps within 6 px of a point (CR #874) | projection onto the nearest segment because a steep segment has no single reading at the pointer's x; considered reading at the pointer's x (user: "read data along the linear segments") | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/interact.spec.js::hover reads between data points` | #873 |
| #876 | `HoverEvent` types `interpolated` and `segment` (CR #874) | forced (Core: `index.d.ts`, listed in this plan) | `packages/plots/src/index.d.ts` | `tests/unit/types.test.js::interact types` | #875 |
| #878 | `index.d.ts` hover docs cover the interpolated reading (CR #877) | forced (CR #877, review M1 round 8 findings 1-2: the docs said nearest point only, and that `interpolated` is never a data point) | `packages/plots/src/index.d.ts` | `tests/unit/types.test.js::interact types` | #876 |
| #879 | The plots-svelte README covers the interpolated hover (CR #877) | forced (CR #877, finding 3) | `packages/plots-svelte/README.md` | none (docs) | #876 |
| #880 | `interact` reads no segment a polyline with NaN never draws | forced (review M1 round 8 finding 4: a browser draws nothing of a polyline holding NaN) | `packages/plots/src/interact.js` | `tests/interact.spec.js::non-finite points are skipped` | #876 |
| #881 | The tooltip rewrites its live region only when the text changes | forced (review M1 round 8 finding 5, the part pulled in; the announcement rate is #883) | `packages/plots/src/interact.js` | `tests/interact.spec.js::tooltip writes only changed text` | #880 |
| #882 | Test comments cite `runs()`, not `pairs()` | forced (review M1 round 8 finding 6) | `tests/interact.spec.js`, `tests/gallery.spec.js` | none (comments) | #881 |
| #885 | `interact` reads a polyline's points from the browser's own parse | forced (review M1 round 9 finding 1: browsers differ on a points list with NaN) | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/interact.spec.js::non-finite points are skipped` | #882 |
| #886 | Test helper comments describe what the helpers do | forced (review M1 round 9 finding 2) | `tests/interact.spec.js`, `tests/gallery.spec.js` | none (comments) | #885 |
| #887 | The plots-svelte README puts the tooltip example after the tooltip | forced (review M1 round 9 finding 3) | `packages/plots-svelte/README.md` | none (docs) | #882 |
| #888 | NaN-polyline test comments name Chromium, not every browser | forced (review M1 round 10 finding 2) | `tests/interact.spec.js` | none (comments) | #887 |
| #891 | Dashed drop lines in `--line-strong` (CR #890) | forced (CR #890, user: "too faint ... keep the dash, but go back to a light grey") | `packages/plots/src/plots.css` | `tests/interact.spec.js::hover marks the point and its drop lines` | #888 |

### M2: hover and click on every 2D plot GitHub: `P804 M2: Every plot`

Done 2026-11-10: accepted (user: go at the demo, with the tooltip fixes CRs #920, #921 added before the tick); reviewed in 10 rounds (Review M2: 0 blocking, round 10), full gate green on a6c97a7.

Demo: every gallery tile's hover dot and tooltip follow the pointer (spot dots, bars, map samples with their value, layout
rays with field and status); clicking a series, bar, surface or field fan logs its select event in the browser console (`ELEO.interact(el, { onselect: console.log })`; CR #863); the
`PERF=1` hover medians. Proves: O1, O2, O4, O7

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #813 | O1 (the rest), O2 and O7 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/interact.spec.js`, `tests/perf.spec.js` | the new tests, skipped | M1 (all items) |
| #263 reuse | One drawn-point predicate and one step rule for `curve.js` and `spot.js` | forced ([#263], absorbed); first because the spot hover scan reads the same predicate | `packages/plots/src/common.js`, `packages/plots/src/spot.js` | `tests/unit/spot.test.js::shared drawn-point rule` | #813 |
| #814 | `spot`, `throughFocus` and the footprint: `data-series` and `data-panel` on each series path, `data-cell` (row, column) on throughFocus cells | identity on the path because one path holds a series' dots and a click names the series; considered one element per dot, 10 000 elements | `packages/plots/src/spot.js` | `tests/unit/spot.test.js::series data attributes` | #263 |
| #815 | Hover timing at U14's reference sizes (10 000 spot points, a 256 × 256 map) | forced (round 2 pre-mortem: hover on big data, user); measured here, before zoom builds on the same scan, so a bucketed scan is chosen early if needed | `tests/perf.spec.js` | `tests/perf.spec.js::hover (U14)` | #814 |
| #816 | `bars`: `data-series` and `data-category` on each `<rect>`; `bars.test.js`'s old-plots stub exports nothing, as [#336] asks | identity on the rect because its height is its value through the transform; considered a value attribute, which repeats it | `packages/plots/src/bars.js`, `tests/unit/bars.test.js` | `tests/unit/bars.test.js::bar data attributes` | #813 |
| #817 | Typed `map2D`: the `<image>` carries the extent and the grid's shape (or rings and spokes); `interact` maps the pointer to the sample's indices and fills `value` from `opts.values` | attributes on the `<image>` because it already holds the box; considered a root `data-map`, the same data one level up (critic) | `packages/plots/src/map2d.js`, `packages/plots/src/interact.js` | `tests/interact.spec.js::map hover value` | #813 |
| #818 | `layout2D`: `data-field` and `data-ray` on ray runs, `data-surface` on surfaces | identity on the run and the surface because O2 selects a field or a surface; considered a point index, which can't name a surface | `packages/plots/src/layout2d.js` | `tests/unit/layout2d.test.js::layout data attributes` | #813 |
| #893 | `interact` hovers a bar: the rect under the pointer, its value through the transform (CR #892) | forced (CR #892: O1's bars hover had no item; `nearest()` reads only points) | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/interact.spec.js::bar hover` | #816 |
| #894 | `interact` hovers a `layout2D` ray: snap to a ray point or read along a run (CR #892) | forced (CR #892: O1's layout hover had no item) | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/interact.spec.js::layout ray hover` | #818 |
| #819 | `interact`: `onselect(SelectEvent)` on click: the clicked mark's series, bar, surface or field | the event target's nearest `data-*` ancestor because the identity is already on the mark; considered the hover's nearest point, which can't pick a surface | `packages/plots/src/interact.js`, `packages/plots/src/index.d.ts` | `tests/interact.spec.js::select events` | #814, #816, #817, #818 |
| #820 | `SpotDiagram`, `RayFan` take `onhover`/`onselect` through the M1 action | one line each because the action holds the wiring; considered per-wrapper listeners, repeated five times | `packages/plots-svelte/src/lib/SpotDiagram.svelte`, `packages/plots-svelte/src/lib/RayFan.svelte`, `tests/unit/plots-svelte.test.js` | `tests/unit/plots-svelte.test.js::spot and fan callbacks` | #819 |
| #821 | `BarPlot`, `Map2D` (passing `values`) and `Layout2D` take `onhover`/`onselect`; the map SSR stub gains `interact` | as above | `packages/plots-svelte/src/lib/BarPlot.svelte`, `packages/plots-svelte/src/lib/Map2D.svelte`, `packages/plots-svelte/src/lib/Layout2D.svelte`, `tests/unit/map2d-svelte.test.js` | `tests/unit/plots-svelte.test.js::bar, map and layout callbacks` | #819 |
| #585 reuse | Drop `curve.js`'s dead `PLOT_L/B/T`, `plotCell`'s default margins and `scales()`' px R | forced ([#585], absorbed) | `packages/plots/src/curve.js` | `tests/unit/curve.test.js::plotCell requires margins` | M1 (all items) |
| #586 reuse | The margins (4.6, 2.6, 3.6 text units) as one export in `scale.js`, used by `curve.js`; the stale comments in `scale.test.js` and `curve.test.js` ([#588]) | forced ([#586], [#588], absorbed) | `packages/plots/src/scale.js`, `packages/plots/src/curve.js` | `tests/unit/scale.test.js::curve reads the margin export` | #585 |
| #822 | `bars.js` and `sizes.js` (`PLOT_SIZES`) use the export | the rest of [#586], split to keep two files | `packages/plots/src/bars.js`, `packages/plots/src/sizes.js` | `tests/unit/scale.test.js::bars and PLOT_SIZES read the margin export` | #586, #816 |
| #823 | `map2d.js` and `spot.js` use the export | the rest of [#586] | `packages/plots/src/map2d.js`, `packages/plots/src/spot.js` | `tests/unit/scale.test.js::map2D and spot read the margin export` | #586, #814, #817 |
| #803 reuse | `curve` rejects a non-string key label, as `layout2D` does; a patch changeset | forced ([#803], absorbed) | `packages/plots/src/curve.js`, `.changeset/curve-key-label.md` | `tests/unit/curve.test.js::key label must be a string` | #585 |
| #659 reuse | `layout2D` runs drop the redundant `virt` field; the mirror-bodies test anchors on the `.85` group and the unused `under` locator goes ([#662]) | forced ([#659], [#662], absorbed); the anchor fix is the red-first test | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `tests/unit/layout2d.test.js::mirror bodies come after the ray group` | #818 |
| #824 | Unskip M2's acceptance tests | forced (`workflow.md`, TDD) | `tests/interact.spec.js`, `tests/perf.spec.js` | the M2 tests | #813, #263, #814, #815, #816, #817, #818, #819, #820, #821, #585, #586, #822, #823, #803, #659 |
| #900 | plots-svelte README covers select and every hover wrapper (CR #896) | forced (CR #896) | `packages/plots-svelte/README.md` | none (docs) | #824 |
| #901 | `index.d.ts` types readout's value axis; panel and value docs match the code (CR #897) | forced (CR #897, finding 9) | `packages/plots/src/index.d.ts` | `tests/unit/types.test.js::interact types` | #824 |
| #902 | Readout docs give the value suffix; Map2D passes its value axis (CR #897) | forced (CR #897, finding 10) | `packages/plots/src/interact.js`, `packages/plots-svelte/src/lib/Map2D.svelte`, `packages/plots/README.md` | `tests/unit/plots-svelte.test.js::bar, map and layout callbacks` | #901 |
| #903 | Gallery map tiles show their value in the tooltip (CR #898) | forced (CR #898, findings 10, 12: M2's demo shows map values) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::map tiles show their value` | #902 |
| #904 | `dataGroup` is `closest()` alone (CR #899) | forced (CR #899) | `packages/plots/src/interact.js` | `tests/interact.spec.js` | #902 |
| #905 | The curve label changeset names series labels | forced (finding 5) | `.changeset/curve-key-label.md` | none | #824 |
| #906 | Tiny bars hover within 6 px of their value end | forced (finding 6: 7 of 28 Seidel bars are under 1 px) | `packages/plots/src/interact.js` | `tests/interact.spec.js::bar hover` | #904 |
| #907 | Layout ray hover draws no drop lines | forced (finding 7: a layout has no axes frame) | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/interact.spec.js::layout ray hover` | #906 |
| #908 | Wrappers type `onselect` without null | forced (finding 8) | `packages/plots-svelte/src/lib/interact.svelte.js`, the six wrappers' JSDoc | `tests/unit/plots-svelte.test.js` | #902 |
| #910 | A masked map sample's value is null (CR #909) | forced (CR #909: the type says null, the code sent NaN) | `packages/plots/src/interact.js` | `tests/interact.spec.js::map hover value` | #908 |
| #911 | `interact` ignores data-series marks outside a matrix group | forced (review M2 round 2 finding 3) | `packages/plots/src/interact.js` | `tests/interact.spec.js::foreign data-series markup is ignored` | #910 |
| #912 | The gallery's log map tooltip reads faint cells | forced (finding 2: 6151 cells read 0.000) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::map tiles show their value` | #908 |
| #913 | plots-svelte README names the value spec; changeset says non-empty labels | forced (findings 4, 5) | `packages/plots-svelte/README.md`, `.changeset/curve-key-label.md` | none (docs) | #908 |
| #915 | plots README gives a masked sample's null value (CR #914) | forced (CR #914) | `packages/plots/README.md` | none (docs) | #913 |
| #916 | The masked-sample tooltip check reads the test's own tooltip | forced (review M2 round 3 finding 2: the check was vacuous) | `tests/interact.spec.js` | `tests/interact.spec.js::map hover value` | #913 |
| #917 | Click ignores data-series marks outside a matrix group | forced (finding 3) | `packages/plots/src/interact.js` | `tests/interact.spec.js::foreign data-series markup is ignored` | #916 |
| #918 | Click's foreign-mark check sits in its series branch | forced (review M2 round 4 finding 1) | `packages/plots/src/interact.js` | `tests/interact.spec.js::foreign data-series markup is ignored` | #917 |
| #919 | The masked-sample tooltip check asserts real text | forced (review M2 round 4 finding 2) | `tests/interact.spec.js` | `tests/interact.spec.js::map hover value` | #918 |
| #922 | Bar rects carry their series label and category label (CR #920) | forced (CR #920, user) | `packages/plots/src/bars.js`, `tests/unit/split.test.js` | `tests/unit/bars.test.js::bar data attributes` | #919 |
| #923 | Bar tooltip reads series · category, value (CR #920) | forced (CR #920, user: "SI · 2, −0.07 mm") | `packages/plots/src/interact.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md` | `tests/interact.spec.js::bar hover` | #922 |
| #924 | Layout ray tooltip names field and ray (CR #921) | forced (CR #921, user) | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/unit/readout.test.js::ray readout` | #923 |
| #925 | Gallery spot and layout tooltips carry units (CR #921) | forced (CR #921, user) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::gallery tooltips carry units` (renamed at #933) | #924 |
| #928 | Every gallery bar and spot tile's tooltip carries its unit (CR #926) | forced (CR #926, finding 4) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::gallery tooltips carry units` (renamed at #933) | #925 |
| #929 | plots README's bar select event names `series.label` (CR #927) | forced (CR #927) | `packages/plots/README.md` | none (docs) | #925 |
| #930 | An empty bar category label falls back to its index | forced (finding 3) | `packages/plots/src/interact.js` | `tests/unit/readout.test.js::empty category label` | #925 |
| #932 | Readout docs give the empty-category fallback (CR #931) | forced (CR #931) | `packages/plots/README.md`, `packages/plots/src/index.d.ts` | `tests/unit/types.test.js::interact types` | #930 |
| #933 | Gallery tooltip units come from each tile's own recording key | forced (review M2 round 7 findings 2, 3: the name table is how CR #926 happened) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::gallery tooltips carry units` | #930 |
| #934 | `tileAxes` drops its dead name fallback; every recorded tile resolves its axes | forced (review M2 round 8 findings 1, 3) | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::gallery tooltips carry units` | #933 |
| #935 | The recorded-tile guard checks an axis unit, not just keys | forced (review M2 round 9 finding 1) | `tests/gallery.spec.js` | `tests/gallery.spec.js::gallery tooltips carry units` | #934 |

### M3: zoom, pan and reset GitHub: `P804 M3: Zoom and pan`

Reopened 2026-11-10 at the demo (user): text selection on pan, layout2D zoom, lens hover (CRs #956-#958). First reviewed in 4 rounds (Review M3: 0 blocking, round 4), full gate green on 5b2a47d.

Demo: on the MTF, spot and PSF map tiles, the wheel zooms about the pointer with the axes redrawn, a drag
pans, a double-click resets; the spot's panels zoom together; the gallery's live-update toggle redraws the data
and the view stays. Proves: O5

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #825 | O5 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/interact.spec.js` | the new tests, skipped | M2 (all items) |
| #826 | `curve` (and `rayFan` through it) takes `view: { x?, y? }`, which overrides the ranges for every panel | forced (round 2: zoom redraws at the range, user); a `view` beside `x.range` because reset returns to the caller's range | `packages/plots/src/curve.js`, `packages/plots/src/fan.js` | `tests/unit/curve.test.js::view overrides the range` | #825 |
| #827 | `spot` and `throughFocus` take `view: { center, half }`, a square window for every panel; a wheel zoom off-centre shifts the centre | a square window because a spot panel has one scale on both axes (`spot.js:48-49`); considered curve's `{ x, y }`, which a square panel can't hold | `packages/plots/src/spot.js` | `tests/unit/spot.test.js::view windows every panel` | #825 |
| #828 | Typed `map2D` takes `view`: the panel ranges change, the `<image>` stays at its extent and the viewport clips it | the ranges only because re-baking the bitmap per wheel tick is the costly part; considered redrawing the image over the window (U13's "maps by redrawing the window" is met by the redraw of the frame) | `packages/plots/src/map2d.js` | `tests/map2d.spec.js::view window` | #825 |
| #448 reuse | `map2d.js`'s valid-range test hoisted into one boolean | forced ([#448], absorbed); after the view item, which edits the lines beside it | `packages/plots/src/map2d.js` | `tests/map2d.spec.js` (unchanged) | #828 |
| #450 reuse | `map2d.js`'s dead `hi > 0` guard in the log tick branch goes | forced ([#450], absorbed) | `packages/plots/src/map2d.js` | `tests/map2d.spec.js` (unchanged) | #448 |
| #829 | `interact`: wheel zooms about the pointer, drag pans, double-click resets; `onview(view)` and `reset()`; the caller redraws | the caller redraws because the markup is the caller's (SSR, `fit`); considered `interact` redrawing itself, which would need the renderer and its props | `packages/plots/src/interact.js`, `packages/plots/src/index.d.ts` | `tests/interact.spec.js::wheel zooms about the pointer` | #826, #827, #828 |
| #830 | The zoomable wrappers keep the view across data changes until reset (CurvePlot, SpotDiagram, Map2D, RayFan) | forced (round 2 pre-mortem: live updates keep the zoom, user); the view is wrapper state passed to the renderer, controlled when the caller passes `view` (CR #936) | `packages/plots-svelte/src/lib/{CurvePlot,RayFan,SpotDiagram,Map2D}.svelte`, `packages/plots-svelte/src/lib/interact.svelte.js`, `packages/plots-svelte/README.md`, `tests/fixtures/svelte/ViewHarness.svelte` | `tests/svelte.spec.js::view survives a data redraw` | #829 |
| #554 reuse | `fit` measures every changed element before drawing any | forced ([#554], absorbed) | `packages/plots/src/fit.js` | `tests/unit/fit.test.js::measure before draw` | #825 |
| #831 | Gallery: zoom wired on the curve, spot and map tiles, and a live-update toggle that redraws the MTF tile's data every frame | forced (round 2 pre-mortem: the view survives live updates, user; the demo shows it) | `gallery/index.html` | `tests/gallery.spec.js::zoom survives live update` | #829 |
| #832 | Roadmap U13's text: zoom by redrawing at the zoomed range | forced (round 2, user) | `agent_docs/roadmap.md` | none (docs) | #825 |
| #833 | Unskip M3's acceptance tests | forced (`workflow.md`, TDD) | `tests/interact.spec.js` | the M3 tests | #825, #826, #827, #828, #448, #450, #829, #830, #554, #831, #832 |
| #942 | spot's auto-scale margin ignores panel order (CR #937) | forced (CR #937) | `packages/plots/src/spot.js` | `tests/unit/spot.test.js::auto-scale margin ignores panel order` | #833 |
| #943 | interact tells spots from curves by spot's own marker (CR #938) | forced (CR #938: a sparse panel curve looked like a spot) | `packages/plots/src/spot.js`, `packages/plots/src/interact.js` | `tests/interact.spec.js::a sparse panel curve zooms as a curve` | #942 |
| #944 | Zoomed plots hover only inside their frame (CR #939) | forced (CR #939) | `packages/plots/src/interact.js` | `tests/interact.spec.js::zoomed plots hover only inside the frame` | #943 |
| #945 | The sample spot forwards view (CR #940) | forced (CR #940) | `packages/plots/src/spot.js` | `tests/unit/spot.test.js::the sample spot takes view` | #943 |
| #946 | A wrapper's `view={null}` resets (CR #941) | forced (CR #941) | the four zoomable wrappers, `packages/plots-svelte/README.md` | `tests/svelte.spec.js::a controlled view resets with null` | #833 |
| #947 | map2D ignores an invalid view, as curve and spot do | forced (review M3 round 1 finding 6: one rule for one prop) | `packages/plots/src/map2d.js`, `packages/plots/src/index.d.ts` | `tests/map2d.spec.js::an invalid view is ignored` | #833 |
| #948 | Wrappers keep one interact binding across data changes | forced (finding 7: a live data frame dropped a pan) | `packages/plots-svelte/src/lib/interact.svelte.js`, `packages/plots-svelte/src/lib/Map2D.svelte` | `tests/unit/plots-svelte.test.js::a data change keeps one interact binding` | #946 |
| #949 | A double-click selects once | forced (finding 8) | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/interact.spec.js::a double-click selects once` | #944 |
| #950 | A horizontal wheel scrolls past a plot | forced (finding 9) | `packages/plots/src/interact.js` | `tests/interact.spec.js::a horizontal wheel is not prevented` | #949 |
| #951 | The Svelte view test covers every zoomable wrapper | forced (finding 10) | `tests/svelte.spec.js`, `tests/fixtures/svelte/ViewHarness.svelte` | `tests/svelte.spec.js::view survives a data redraw` | #948 |
| #952 | A mostly horizontal swipe scrolls past a plot | forced (review M3 round 2 finding 1) | `packages/plots/src/interact.js` | `tests/interact.spec.js::a horizontal wheel is not prevented` | #951 |
| #953 | The double-click select rule applies only where a double-click resets | forced (finding 2) | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/interact.spec.js::a double-click on a non-zoom host selects twice` | #952 |
| #954 | interact reads axes and values at event time; the action drops its Proxy | forced (finding 3: smaller than getters and a Proxy) | `packages/plots/src/interact.js`, `packages/plots-svelte/src/lib/interact.svelte.js` | `tests/interact.spec.js::options read at event time` | #953 |
| #955 | A Svelte test covers the action's update of axes and values | forced (review M3 round 3 finding 1) | `tests/svelte.spec.js` | `tests/svelte.spec.js::a data change updates the tooltip` | #954 |
| #959 | Demo-feedback acceptance tests, skipped (CRs #956, #957, #958) | forced (`workflow.md`, TDD) | `tests/interact.spec.js` | `tests/interact.spec.js`: `a pan or double-click selects no text`, `layout zoom pan and reset`, `lens hover reads the element`, all `test.skip` | none |
| #960 | A pan or double-click on a zoom host selects no text (CR #956) | preventDefault on the mousedown that starts a pan inside a frame because that is where the selection starts and text outside a frame stays selectable; considered `user-select: none` on the host, which also blocks copying the axis labels | `packages/plots/src/interact.js` | `tests/interact.spec.js::a pan or double-click selects no text` | #959 |
| #961 | Vertex radius fit and thick-lens focal length (CR #958) | a new internal module because layout2d.js is already 326 lines and the fit is pure math; a least-squares circle through the profile's points within sd/2 of the vertex (sd/4 in the first draft: z recorded to 0.001 mm moves a weak surface 3%) because the recorded format has no radius and an asphere's base radius is the vertex curvature; considered the three-point circle, which a 41-point profile's sampling noise moves | `packages/plots/src/lens.js` | `tests/unit/lens.test.js::vertex radius and thick-lens focal length` (oracle: closed-form lensmaker equation, 1/f = (n−1)[1/R1 − 1/R2 + (n−1)ct/(n R1 R2)]; a spherical profile sampled from a known R returns R within 1e-3 relative; a flat profile returns Infinity)` | #959 |
| #962 | layout2D's glass polygons carry the element's properties (CR #958) | data-* on the polygon because the renderer holds the surfaces and interact reads marks, as for every other hover; considered interact taking the layout data, which the SSR markup path does not have | `packages/plots/src/layout2d.js`, `tests/unit/split.test.js` | `tests/unit/layout2d.test.js::glass polygons carry element properties` | #961 |
| #963 | Hovering a lens element emits its properties and the tooltip shows them (CR #958) | a glass polygon hovers only when no ray run is within reach, because rays are drawn over the glass; the tooltip breaks lines on `\n` because the user chose the five-line layout (user), with `white-space: pre` (orchestrator) so a one-line tooltip never wraps | `packages/plots/src/interact.js`, `packages/plots/src/index.d.ts`, `packages/plots/src/plots.css`, `packages/plots/README.md` | `tests/interact.spec.js::lens hover reads the element`; `tests/unit/readout.test.js::a lens element reads in five lines` | #962, #960 |
| #964 | layout2D takes `view: { x, y }` and draws that window at one scale (CR #957) | the window is fitted into the frame at one scale and centred, as layoutBounds is today, because a layout is drawn true to shape; geometry clipped to the viewport; the scale bar picks a 1-2-5 mm length at the new scale; considered spot's `{ center, half }`, which assumes a square panel | `packages/plots/src/layout2d.js`, `packages/plots/src/index.d.ts` | `tests/unit/layout2d.test.js::view windows the layout` | #962 |
| #965 | interact zooms, pans and resets a layout (CR #957) | kind `layout` read from a `data-view="layout"` marker on the data group, as spot's marker (CR #938); the drawn window is the group's inverse matrix over the viewport | `packages/plots/src/interact.js`, `packages/plots/src/layout2d.js`, `packages/plots/README.md` | `tests/interact.spec.js::layout zoom pan and reset` | #964, #963 |
| #966 | The Layout2D wrapper keeps its view like the other zoomable wrappers (CR #957) | forced (CR #936's pattern: wrapper state, controlled when the caller passes `view`, `view={null}` resets) | `packages/plots-svelte/src/lib/Layout2D.svelte`, `packages/plots-svelte/README.md`, `tests/fixtures/svelte/ViewHarness.svelte` | `tests/svelte.spec.js::view survives a data redraw` (adds Layout2D)` | #965 |
| #967 | Gallery: layout tiles zoom, and lens hover reads in the tooltip (CRs #957, #958) | forced (the demo shows it) | `gallery/index.html` | `tests/gallery.spec.js::layout tiles zoom and read lenses` | #966 |
| #968 | Unskip the demo-feedback acceptance tests | forced (`workflow.md`, TDD) | `tests/interact.spec.js` | the three tests from the first item | #959, #960, #961, #962, #963, #964, #965, #966, #967 |
| #971 | A zoomed mirror draws only the hatch lines in the window (CR #969) | forced (CR #969) | `packages/plots/src/layout2d.js` | `tests/unit/layout2d.test.js::zoomed hatch stays bounded` | #968 |
| #972 | A zoomed layout hovers only inside its window (CR #970) | forced (CR #970: CR #939's rule on the layout path) | `packages/plots/src/interact.js` | `tests/interact.spec.js::zoomed plots hover only inside the frame` (adds a layout case) | #971 |
| #973 | A zoomed layout fits its window into the geometry band, clear of the labels, scale bar and key | forced (review M3 round 5 finding 3: the base view keeps those bands clear, and a lens under the key text got no hover); the band carried on the data group as a data attribute so `frames()` reads the same window | `packages/plots/src/layout2d.js`, `packages/plots/src/interact.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `tests/unit/split.test.js` | `tests/unit/layout2d.test.js::view fits the geometry band`; `tests/interact.spec.js::layout zoom pan and reset` (window read from the band) | #972 |
| #974 | The `{ x, y }` view lists name layout2D, and interact's header names the lens hover | forced (review M3 round 5 finding 4) | `packages/plots/src/index.d.ts`, `packages/plots/src/interact.js` | none (docs) | #973 |
| #975 | The controlled-view reset test covers every zoomable wrapper | forced (review M3 round 5 finding 5) | `tests/svelte.spec.js` | `tests/svelte.spec.js::a controlled view resets with null` (loops over ZOOMABLE) | #968 |
| #976 | A lens hover's x and y follow the pointer | the pointer in the emit key because x and y are documented as the pointer; considered documenting them as the entry point, which a caller reading a position would not expect | `packages/plots/src/interact.js` | `tests/interact.spec.js::a lens hover follows the pointer` | #974 |
| #977 | The mirror hatch loop ends for any valid view | an integer index (`k = kb + j * step`) because float accumulation stalls below half an ulp; considered rejecting small spans in layout2D, a second rule beside interact's `viewOf` | `packages/plots/src/layout2d.js` | `tests/unit/layout2d.test.js::a tiny view still draws the hatch` | #976 |
| #978 | A view-less layout hovers rays drawn outside its band | the band test only where the group carries the band clip, because only then is the geometry clipped to it; considered clipping the view-less layout too, which changes the base markup | `packages/plots/src/interact.js` | `tests/interact.spec.js::a cropped layout hovers rays past its band` | #977 |
| #981 | The hatch loop counts from zero and skips an unbounded body (CR #979) | count from zero because a large integer index stalls past 2^53 as a float one does below an ulp; the 1e4 skip because no drawable window needs that many lines; considered rejecting tiny spans in layout2D, a second rule beside interact's `viewOf` | `packages/plots/src/layout2d.js` | `tests/unit/layout2d.test.js::a tiny view still draws the hatch` | #978 |
| #982 | The README says the band is the hover frame only with a view (CR #980) | forced (CR #980) | `packages/plots/README.md` | none (docs) | #981 |

### M4: keyboard and release GitHub: `P804 M4: Keyboard and release`

Demo: Tab into the MTF tile, step points with the arrows, select with Enter, zoom with + and −, reset with 0;
the `PERF=1` redraw medians for every touched renderer; the changesets. Proves: O6, O4 (U14)

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #834 | O6 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/interact.spec.js` | the new tests, skipped | M3 (all items) |
| #835 | `interact`: the host is focusable (`tabindex="0"` unless set); ←/→ step points, ↑/↓ series, Enter selects, Escape clears, + − 0 zoom and reset, each emitting the pointer's events; the keys in the plots README | forced (round 2 pre-mortem: keyboard access, user); the same events as the pointer so callers write one handler | `packages/plots/src/interact.js`, `packages/plots/README.md` | `tests/interact.spec.js::keyboard` | #834 |
| #836 | Redraw medians for `spot` (10 000 points), typed `map2D` (256 × 256), `bars` and `layout2D` at U14's sizes, beside `curve`'s | forced (roadmap constraint: each row keeps U14 for the renderers it touches; U14's oracle) | `tests/perf.spec.js` | `tests/perf.spec.js::redraw (U14)` | #834 |
| #837 | plots README: an Interaction section (`interact`, the events, `view`) | forced (`workflow.md`, Docs: the package README is its front door) | `packages/plots/README.md` | none (docs) | #835 |
| #838 | Changesets: plots minor (`interact`, `readout`, `view`, `data-*`), plots-svelte minor (callbacks, the default hover tooltip; CR #863) | forced (roadmap row H's exit: the release is planned) | `.changeset/interact.md`, `.changeset/interact-svelte.md` | `tests/unit/release.test.js::row H changesets` | #835, #836, #837 |
| #839 | Unskip M4's acceptance tests | forced (`workflow.md`, TDD) | `tests/interact.spec.js` | the M4 tests | #834, #835, #836, #837, #838 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| `getScreenCTM` on nested `<svg>` viewports is off by the viewport offset | hover lands on the wrong point | M1 proves it on `curve` with an oracle that never calls `getScreenCTM`; the fallback (matrix from attributes) is named in Constraints |
| A 10 000-point linear scan misses 16 ms | O7 fails | M2 measures right after the spot item; a grid bucket per draw is the fallback, inside `interact.js` |
| Spot's `view` fights `half` and the chief/centroid centring | panels jump on reset | `view` only while set; reset clears it, so the drawing returns to today's byte for byte (O5's oracle) |
| A zoomed polar map shows the bitmap's pixels (baked at the extent's px) | a blocky PSF or wavefront when zoomed far | accepted for zoom ≤ 4×; if the M3 demo finds it ugly, a CR re-bakes past a threshold |
| The plan is 43 items, past the 15-item guideline | long plan | the user kept all of U13 in one plan (round 1); 8 items are absorbed nits |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-10 draft (planner): from roadmap row H.
- 2026-11-10 round 1 (user): all of U13 in H (zoom, pan and reset stay in this plan, no split); issue buckets as proposed, so [#448], [#450] and [#554] (proposed for "the zoom row") are absorbed by H's zoom milestone; readout by props wiring (wrappers take `onhover`/`onselect`, `PlotCard` a `readout` prop); demo: a live readout line under every gallery tile, clicks logged there, plus the Svelte page's PlotCard.
- 2026-11-10 round 2 (user): zoom redraws at the zoomed range (U13's wording changes from 'rewriting the viewBox'); wheel, drag and double-click only (no box zoom, no touch); panels zoom together; pre-mortem: hover must keep up on big data (O7), the keyboard must reach everything (O6), and live data updates must keep the zoom (O5).
- 2026-11-10 critique (plan critic, claude-fable-5-1): 21 findings. Accepted 1 (O4 is `split.test.js` with `data-*` stripped; no second baseline), 2, 3, 4, 5 (hover timing moved to M2), 6 (spot `view` is a square window), 7, 8 (tile screenshots at the plan start, opt-in `SHOTS=1`, to the `review-assets` release), 9, 10, 11, 12, 13 (`sizes.js` joins [#586]; one test per item), 14, 15 (the action is internal), 16 (`readout` takes the caller's axis specs), 17, 18 (map zoom changes the ranges, the image stays at its extent), 20, 21 (folds: [#336], [#588], [#662]). Rejected 19 (the `footer` snippet instead of a `readout` prop): the user chose the prop in round 1.
- 2026-11-10 approved (user); published: plan issue #804, milestones P804 M1-M4, work items #805-#839 plus reused #263, #585, #586, #803, #659, #448, #450, #554.
- 2026-11-10 review M1 round 1 (code-reviewer, claude-opus-5-5): 1 blocking, CR #841 accepted (orchestrator: keeps every invariant), item #851; backlog #842-#849 pulled into M1 (small, named, in files M1 changed); #850 (parse cache) stays a plain issue until M2 #815 times hover. Earlier: the M1 wave's full gate went red on four gallery footer counts that #811's readout line matched; fixed by #811's second commit (cdf79ae), the counts skip `.eleo-plot__readout`.
- 2026-11-10 review M1 round 2 (code-reviewer, claude-opus-5-5): 0 blocking, CR #841 resolved; backlog #852, #853, #854 pulled into M1 (small, named, in files M1 changed), so round 3 reviews them before the tick.
- 2026-11-10 review M1 round 3 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in; backlog #855 (one shared test parser). M1 ticked.
- 2026-11-10 M1 demo (user): no-go. CR #856 accepted by the user: hovering draws a dot on the point, thin drop lines from it to the x and y axes (not a full crosshair) and the readout as a tooltip near the pointer, all drawn by `interact` in an overlay, on by default. CR #857 accepted by the user: PlotCard's `readout` prop and the gallery's readout line go (unreleased). O3's text, test and oracle changed (user); the Non-goal "a readout drawn over the plot" dropped. Items #858-#862; M1 reopened.
- 2026-11-10 review M1 round 4 (code-reviewer, claude-opus-5-5): 1 blocking, CR #863 (stale readout wording in this plan and roadmap row H) accepted and fixed in this commit; carried #856, #857 resolved; backlog #864, #865, #866 pulled into M1. Per-round count (blocking + pulled in): 9, 3, 0, 4.
- 2026-11-10 CR #867 (stale doc, from #865's worker) accepted (orchestrator: not Core), item #868.
- 2026-11-10 review M1 round 5 (code-reviewer, claude-opus-5-5): 1 blocking: carried CR #863 still open (M2 Demo and roadmap row H's exit still named the readout line), fixed in this commit; backlog #869, #870 pulled into M1. Per-round count: 9, 3, 0, 4, 3.
- 2026-11-10 review M1 round 6 (code-reviewer, claude-opus-5-5): 0 blocking, every carried CR resolved; backlog #871 pulled into M1. Per-round count: 9, 3, 0, 4, 3, 1.
- 2026-11-10 review M1 round 7 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. M1 ticked again; re-demo pending.
- 2026-11-10 M1 re-demo (user): no-go. CR #872 accepted by the user: the drop lines are too bold; draw them as dashed grid lines, and end each exactly on its axis (the horizontal overshot the y axis, the vertical fell short of the x axis). Item #873; M1 reopened.
- 2026-11-10 M1 re-demo (user): CR #874 accepted by the user: hover reads the line between data points by linear interpolation; within 6 px of a point it snaps (dot shown); between points the tooltip and dashed drop lines show the interpolated reading, no dot; the event says `interpolated` with its `segment`. O1's text extended. Items #875, #876, after #873.
- 2026-11-10 review M1 round 8 (code-reviewer, claude-opus-5-5): 3 blocking, one CR #877 (the hover docs in index.d.ts and the plots-svelte README still described nearest-point only) accepted (orchestrator: wording, Core path already approved), items #878, #879; backlog #880, #881, #882 pulled into M1; #883 (live-region announcement rate) waits for M4's keyboard item. Carried #872 and #874 resolved. Per-round count: 9, 3, 0, 4, 3, 1, 0, 6.
- 2026-11-10 review M1 round 9 (code-reviewer, claude-opus-5-5): 0 blocking, every carried CR resolved (#877 too); backlog #885, #886, #887 pulled into M1. Per-round count: 9, 3, 0, 4, 3, 1, 0, 6, 3.
- 2026-11-10 review M1 round 10 (code-reviewer, claude-opus-5-5): 0 blocking; backlog #888 pulled into M1; #889 (the polyline isFinite guard, optional) waits for row cross-browser. Per-round count: 9, 3, 0, 4, 3, 1, 0, 6, 3, 1.
- 2026-11-10 review M1 round 11 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. M1 ticked again; re-demo pending.
- 2026-11-10 M1 re-demo 2 (user): no-go. CR #890 accepted by the user: the dashed drop lines are too faint in `--plot-grid`; keep the dash, back to the light grey `--line-strong`. Item #891; M1 reopened.
- 2026-11-10 review M1 round 12 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. M1 ticked again; re-demo pending.
- 2026-11-10 M1 accepted (user: go at re-demo 3). No ADR was exercised.
- 2026-11-10 CR #892 (orchestrator): M2 had no item making `interact` read bars or layout rays (O1); items #893, #894 added before #819.
- 2026-11-10 #815 (measurement, U14/O7): hover, median of 20 pointer moves in headless Chromium on the developer's machine, 3 runs: spot of 10 000 points 6.30, 6.40, 6.35 ms; 256 x 256 map 0.10, 0.05, 0.05 ms. Both under 16 ms, so #850 (parse cache) is not needed now; spot at 40% of the budget is the one to watch.
- 2026-11-10 review M2 round 1 (code-reviewer, claude-opus-5-5): 4 blocking, CRs #896 (plots-svelte README), #897 (readout's value axis untyped), #898 (gallery maps show no value: M2's demo), #899 (dataGroup) accepted (orchestrator); backlog findings 5-10 and 12 pulled into M2; finding 11 (plots-svelte's peer range) goes to #838. Items #900-#908. Carried #892, #895 resolved.
- 2026-11-10 review M2 round 2 (code-reviewer, claude-opus-5-5): 1 blocking, CR #909 (a NaN-masked map sample sent NaN, not the documented null) accepted; backlog findings 2-5 pulled in. Items #910, #911, #912, #913. Carried #892, #895-#899 resolved. Per-round count: 11, 5.
- 2026-11-10 review M2 round 3 (code-reviewer, claude-opus-5-5): 1 blocking, CR #914 (plots README predates #910's null) accepted; backlog #916, #917 pulled in. Carried CRs all resolved. Per-round count: 11, 5, 3.
- 2026-11-10 review M2 round 4 (code-reviewer, claude-opus-5-5): 0 blocking, every carried CR resolved; backlog #918, #919 pulled in. Per-round count: 11, 5, 3, 2.
- 2026-11-10 review M2 round 5 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. M2 ticked; demo pending.
- 2026-11-10 M2 demo (user): go, with tooltip fixes added before the tick and reviewed, no re-demo. CR #920 (bar tooltip names its series and category label: "SI · 2, −0.07 mm") and CR #921 (spot tooltips carry units; layout ray tooltips read "field f · ray r · z mm, y mm"), accepted by the user. Items #922, #923, #924, #925.
- 2026-11-10 review M2 round 6 (code-reviewer, claude-opus-5-5): 2 blocking, CRs #926 (seidel-terms tooltip had no unit), #927 (README bar select) accepted; backlog findings 3, 4 pulled in. Items #928, #929, #930. User CRs #920, #921 resolved. Per-round count: 11, 5, 3, 2, 0, 5 (the rise is the user's demo CRs' round).
- 2026-11-10 review M2 round 7 (code-reviewer, claude-opus-5-5): 1 blocking, CR #931 (readout docs miss #930's fallback) accepted; backlog findings 2, 3 pulled in. Items #932, #933. Carried #926, #927 resolved. Per-round count since the demo: 5, 3.
- 2026-11-10 review M2 round 8 (code-reviewer, claude-opus-5-5): 0 blocking, every carried CR resolved (#931 too); backlog findings 1 and 3 pulled in as #934; finding 2 (two plan Tests cells named the test before #933's rename) fixed in this commit. Per-round count since the demo: 5, 3, 1.
- 2026-11-10 review M2 round 9 (code-reviewer, claude-opus-5-5): 0 blocking; backlog #935 pulled in. Per-round count since the demo: 5, 3, 1, 1.
- 2026-11-10 review M2 round 10 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. M2 ticked and accepted (the user's go at the demo, conditional on the tooltip fixes, now done and reviewed).
- 2026-11-10 CR #936 (from #830's worker) accepted (orchestrator): the view is wrapper state, so #830's Files widen to the four zoomable wrappers and a test harness; controlled when the caller passes view.
- 2026-11-10 review M3 round 1 (code-reviewer, claude-opus-5-5): 5 blocking, CRs #937 (spot margin by panel order), #938 (sparse panel curve read as a spot), #939 (zoomed plots hover outside the frame), #940 (sample spot ignores view), #941 (view={null} doesn't reset) accepted (orchestrator); backlog findings 6-10 pulled in (map2D ignores an invalid view like the others; one interact binding across data; a double-click selects once; horizontal wheel not swallowed; Svelte view test for all wrappers). Items #942-#951. Carried #936 resolved.
- 2026-11-10 review M3 round 2 (code-reviewer, claude-opus-5-5): 0 blocking, carried CRs #936-#941 resolved; backlog #952, #953, #954 pulled in. Per-round count: 10, 3.
- 2026-11-10 review M3 round 3 (code-reviewer, claude-opus-5-5): 0 blocking; backlog #955 pulled in. Per-round count: 10, 3, 1.
- 2026-11-10 review M3 round 4 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. M3 ticked; demo pending.
- 2026-11-10 M3 demo (user): no-go with feedback. CR #956 (a pan or double-click selects the axis text), CR #957 (zoom and pan on layout2D, reversing that Non-goal) and CR #958 (lens hover with glass and properties; the user chose radii and an estimated thick-lens f over recorded values only) accepted. Items #959-#968; M3 reopened.
- 2026-11-10 review M3 round 5 (code-reviewer, claude-opus-5-5): 2 blocking, CRs #969 (unbounded mirror hatch on deep zoom) and #970 (zoomed layout hovers outside its window) accepted (orchestrator); backlog findings 3, 4, 5, 7 pulled in, 6 fixed here (#963's cell: `pre`, not `pre-line`). Items #971-#976. Per-round count: 10, 3, 1, 0, 7.
- 2026-11-10 review M3 round 6 (code-reviewer, claude-opus-5-5): 0 blocking, carried CRs #936-#941, #956-#958, #969, #970 resolved; backlog #977, #978 pulled in. Per-round count: 10, 3, 1, 0, 7, 2.
- 2026-11-10 review M3 round 7 (code-reviewer, claude-opus-5-5): 2 blocking, CRs #979 (a 1-ulp view hangs the hatch loop) and #980 (README: the band is the hover frame only with a view) accepted (orchestrator); backlog 3 and 4 (test nesting, child path quoting) folded into #981. Items #981, #982. Per-round count: 10, 3, 1, 0, 7, 2, 4.
