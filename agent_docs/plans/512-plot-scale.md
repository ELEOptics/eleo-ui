# Plan [#512]: One scale system for plots

Status: approved 2026-11-04
Branch: `plan/512-plot-scale` PR: [#533] Depends on: plan [#464] (done) Roadmap: `agent_docs/roadmap.md`, row O

## Problem

The user, at plan [#464]'s M1 demo (2026-11-04): "a unified system for how plots are rendered and at what ratios".
Each renderer sizes its text in its own viewBox units and every gallery tile stretches its SVG to its column, so
rendered text runs from 4.3 px (rayFan) to 13.7 px (full-row maps) at the gallery's 1440 px viewport ([#498]), and
the footprint tile alone took six CRs ([#487] to [#507]) to look right. phos and eleoptics.com get whatever ratio a
renderer happens to draw.

## Ground truth

- Every SVG renderer writes its text with class `eleo-tick` (10 viewBox units, `plots.css:127`) or `eleo-val`
  (10.5); `layout2d.js:8` repeats 10 inline. Only `spot` scales it (`textScale`, plan [#464], Core).
- Default viewBoxes: `curve` and `bars` 460 × 260 (`curve.js:96`, `bars.js:12`), `map2D` 460 × 360
  (`map2d.js:11`), `spot` a 150-unit square panel (`spot.js:47`), `throughFocus` 92-unit panels (`spot.js:94`),
  `rayFan` columns × (170 + 58) × 314 (`fan.js:31`), `layout2D` 1000 wide (`layout2d.js:184`).
- Frame margins are fixed viewBox units, not tied to text: `PLOT_L 46, PLOT_B 36, PLOT_T 26` (`curve.js:64`),
  shared by `bars` and `map2D`; `bars` keys at 14 units a line; label room is 6 units a character in `curve.js:58`
  and `layout2d.js:184` ([#156]).
- So today text over frame width is 10/402 ≈ 0.025 for a single `curve`, 10/150 ≈ 0.067 for `spot`, 10/1000 for
  `layout2D`; the gallery CSS (`.eleo-plot__body svg { width: 100% }`) then scales each to its column.
- The gallery's rows are `repeat(auto-fit, minmax(240px, 1fr))` (`gallery/index.html:22`); the footprint tile has a
  one-off width rule (`:25-26`) that this plan replaces.
- `tests/gallery.spec.js:77-110` measures the footprint's rendered text and ratio at 1440, 1100 and 700 px: the
  pattern O3's Playwright test generalises.
- Canvas tiles (layout3D, the sample PSF, wavefront, Airy) are exempt (U18, as U5's lint exempts layout3D).
- plots-svelte's wrappers pass fixed `width`s (`CurvePlot.svelte:5` 460, `SpotDiagram.svelte:3` 300) and never
  measure their container. `Legend.svelte` calls `legend(kind, n)` with no `values` ([#486]).
- Prior art: no library sets an SVG text-to-plot ratio; container bands are plain CSS (`min-width`/`max-width`).
  No new dependency.

## Outcomes

Proposed, from roadmap U18 and its oracle (approved 2026-11-04).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | Every framed renderer (curve, rayFan, bars, map2D, spot, throughFocus), given its drawing width in px, sizes its text from its plot frame's width F: `F / 18` px inside the band (9 to 13 px), 9 px below it, `13 * (F / 234)^(1/3)` above it; margins, label room and line pitch follow the text; above the band strokes and dots grow by `sqrt(F / 234)`. layout2D does the same from its drawing width W: `W / 70`, labels hidden where that is under 9 px, `13 * sqrt(W / 910)` text and strokes above 910 | given each renderer called at widths below, inside and above its band / when its SVG is drawn / then every text's font size and every stroke's width equal ADR-0003's formulas for that F or W (within 0.01 px) | `closed-form ADR-0003` (the user's rules, rounds 1b and 3, 2026-11-04) | `tests/unit/scale.test.js::text and weight per renderer (U18)` (curve, rayFan, bars, spot, throughFocus, layout2D); `tests/map2d.spec.js::text follows ADR-0003` (map2D draws a canvas, so Playwright) |
| O2 | The gallery draws every framed and layout tile at its measured width through `fit` and redraws on resize; each row's minimum column comes from the published table | given the gallery at 1440, 1100 and 700 px in both themes / when each framed or layout tile is measured / then its rendered text size (computed size times `getScreenCTM().a`) equals ADR-0003's formula for its rendered frame (within 1%), and is at least 9 px | `closed-form ADR-0003` (U18: Playwright, extending N's footprint ratio test) | `tests/gallery.spec.js::text follows ADR-0003 on every framed tile (U18)` |
| O3 | plots-svelte's wrappers measure their container and pass its width, and `Legend` takes `values` | given each of the six framed wrappers compiled for the client and mounted in a 300 px and a 900 px box / when rendered / then its SVG's viewBox is that width; on the server (no layout) it draws its default width; given `<Legend kind="field" values={[0, 17, 24]} />` / then it prints what `legend('field', 3, [0, 17, 24])` prints | `reference` the renderers and `legend()` in `@eleoptics/plots` | `tests/svelte.spec.js::wrappers draw at their width` (Playwright), `tests/unit/plots-svelte.test.js::wrappers pass width through on the server`, `tests/unit/legend.test.js::Legend passes values (#486)` |
| O4 | The release is planned: a plots minor and a plots-svelte minor naming the visible change | given the changesets / when `npx changeset status` runs / then it plans those two minors | `spec roadmap Constraints` | `tests/unit/release.test.js::row O changesets` |
| O5 | The user approves the result | the gallery in both themes and palettes, and the website's U3 layout fixtures, at M1's demo | `user` (U18) | demo |

## Non-goals

- Legend placement anywhere ([#486]'s second half): waits for a consumer that places one outside the footer
  (user, roadmap review 2026-11-04, finding 2); filed as its own issue at publish.
- Tile chrome (titles, meta, footer legends): stays fixed px (U18).
- Canvas tiles: exempt (U18).
- Uniform zoom (text and strokes in viewBox units at one ratio, no ceiling): weighed in round 1, not chosen.
- `fit` in the website's standalone layout entry is in (M1); the website's own adoption of it is its plan, not this one.
- `rayFan`'s `panelWidth` stays (removal is breaking, row J).

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| [#498] | absorb | the row's own issue |
| [#486] | absorb (`values` only) | O3; placement filed apart |
| [#156] | absorb | label room becomes text-relative in `layout2d.js`, which this plan edits |
| [#330] | absorb | `curve.js`'s frame clamp: the table's minimum sizes are its rule |
| [#311], [#320], [#328] | absorb | plots README nits, in the README this plan documents the table in |
| [#263] | related | shared bad-point predicate; this plan edits text, not `common.js`/`axis.js` exports |
| [#160], [#70] | related | layout2D label placement and crowding; labels change size, not place |
| [#138] | related | layout2D input validation |

## Constraints and assumptions

- U14 redraw budget holds for every renderer touched (re-measured with `PERF=1 npx playwright test tests/perf.spec.js`,
  logged here); `fit` redraws at most once per animation frame per element.
- The standalone layout entry grows by at most 2 kB gzipped (`tests/unit/layout-size.test.js`); `scale.js` is bundled
  into it.
- A caller that passes no `width` gets today's default drawing width with the rule applied at that width, stretched
  by CSS as today: a default `curve` (F = 402) draws 15.6 px text and about 72-unit margins in place of 10 and 46, a
  default `layout2D` (1000) 13.6 px, a default `spot` panel (150) 9 px, a default `rayFan` panel (170) 9.4 px. Only a
  caller that passes its rendered width (through `fit` or its own measuring) gets exact px. The ADR lists these.
- F and the text-unit margins define each other: `scale.js` exports `frameOf(W, m)` (W the drawing width, m the
  margins in text units), solved in closed form per branch (floor, band, knee: the branch whose F lands in its own
  range), shared by curve, bars and map2D.
- What grows above the band: series strokes, rays and spot dots; the frame, grid, glass edges and the image line stay
  1 px (ADR-0003 lists them).
- Edges: layout labels show at W / 70 >= 9 exactly (unrounded); `fit` and the wrappers ignore a width \<= 0 and redraw
  only when the width changed (no `ResizeObserver` loop from the height a draw sets).
- Text is written as an inline `style="font-size:…px"`, as `spot` does since CR [#504] (`.eleo-tick` in `plots.css`
  beats a `font-size` attribute).
- Assumption: the 6-units-a-character label estimate (`curve.js:58`, `layout2d.js:184`) scales as 0.6 em.

## Decisions

- Writes ADR-0003, "Plot scale" (proposed; M1 exercises it; verdict at M1's demo): the framed and layout rules of O1,
  the floor (9 px), the knee (13 px), the stroke weight, `fit`, and the published size table. It supersedes ADR-0001's
  "every role draws a 1 px stroke at any plot size" (user, round 1b); the rest of ADR-0001 stands.
- Core changes, approved with this plan: `agent_docs/adr/0003-plot-scale.md`; `packages/plots/src/index.d.ts` gains
  `fit`, the `scale` exports and the size table's type, and the `width` doc of each framed renderer's props.
- Roadmap edits at publish: U18 reads the knee in place of the ceiling (user, round 3) and the table's per-panel
  minimum in place of the 240 px column; kill criterion plot-scale / U18 as approved at step 5.
- Recorded baselines this plan changes (the user's, decided at approval: re-record at each verdict, supersede the footprint test): `tests/fixtures/renderers-baseline.json`
  (`tests/unit/split.test.js`: five `layout2D` calls at width 1000 and `throughFocus()`), and the footprint test at
  `tests/gallery.spec.js:77-110` (meta-size text, 447 px plot), which O2's test supersedes.
- `spot`'s `textScale` stays (removal is breaking, row J) and multiplies the rule's size; the gallery stops using it
  (user, round 2).

## Milestones

Independent of every open plan (none open). Shares the recorder-free files only: recorded-fans (gallery,
`gallery.spec.js`) and ray-visibility (`layout2d.js`) wait for it.

### M1: one rule, curve and layout2D, in the gallery (done 2026-11-04) GitHub: `P512 M1: Scale rule for curve and layout2D`

Demo: `npm run gallery` at 1440, 1100 and 700 px and while dragging the window: every curve, rayFan and layout tile
at its measured width, text per ADR-0003 (layout labels shown at 1440 and 1100, hidden at 700, where the body is
under 630 px); the website's U3 layout fixtures (`tests/fixtures/layouts/`) at 600 and 1200 px beside main's
drawing (at 600 they lose STO/IMA, the field labels and the "10 mm" text). Proves: O1 and O2 for curve, rayFan and
layout2D; O5.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#513] | O1, O2 acceptance tests for curve, rayFan and layout2D, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/scale.test.js`, `tests/gallery.spec.js` | the two tests, skipped citing this issue | none |
| [#514] | ADR-0003 "Plot scale", proposed: the rules, `frameOf`'s solution, the edges, what grows, the default-width numbers, `fit` | forced (U18: "The rule is ADR-0003"); the formulas are the user's (rounds 1b, 3) | `agent_docs/adr/0003-plot-scale.md`, `dev_docs/adr/0003-plot-scale.md` (symlink), `zensical.toml` | the site builds (`zensical build --strict`, full gate) | none |
| [#515] | `scale.js`: `frameText(F)`, `frameWeight(F)`, `frameOf(W, m)`, `layoutText(W)` (null when hidden), `layoutWeight(W)`, the constants; typed | its own module because `layout2D`'s standalone entry needs it without `curve.js` (the 2 kB budget); considered the functions in `curve.js`, which bars and map2D already import, ruled out by that budget | `packages/plots/src/scale.js`, `packages/plots/src/index.d.ts`, `tests/types/curve.ts` | `tests/unit/scale.test.js::formulas at the band's edges` (closed-form ADR-0003) | [#514] |
| [#516] | `fit(el, draw)`: draws `draw(el.clientWidth)` synchronously, then redraws through one module-level `ResizeObserver` at most once per frame and only when the width changed (> 0); returns `stop()`; exported from the module, classic and standalone layout builds | a shared `ResizeObserver` because it reports container-only changes (a tile reflowing in its grid) in one callback for all tiles; considered a window `resize` listener, which misses them. The first draw is synchronous so the gallery's `data-ready` still means drawn. `ELEO.fit(body, (w) => ELEO.curve({ ...d, width: w }))` returns `stop`. Four files, one-line exports in three | `packages/plots/src/fit.js`, `packages/plots/src/index.js`, `packages/plots/src/renderers.js`, `packages/plots/src/iife-layout.js`, `packages/plots/src/index.d.ts` (CR [#535]) | `tests/unit/fit.test.js::draws now, coalesces, ignores height-only and zero widths` (stubbed `ResizeObserver` and `requestAnimationFrame`); `tests/types/curve.ts` | [#515] |
| [#517] | `curve` and `rayFan` draw to the rule: `plotCell` takes its margins as a parameter, `curve` passes margins in text units (46/36/26 become 4.6/3.6/2.6 text) from `frameOf`, `bars` and `map2D` pass today's constants until M2; label room 0.6 em; panel titles and series strokes by `frameWeight`; a missing height keeps 260/460 of the width; the frame height clamps to 1 (absorbs [#330]); `rayFan` gains `width` (panel width derived) | margins as a parameter so bars and map2D stay aligned in M1; considered fixed px margins sized for 13 px, ruled out because they waste 30% of a 216 px tile. Rewrites `curve.test.js`'s margin oracles and `fan.test.js`'s figure width to the ADR | `packages/plots/src/curve.js`, `packages/plots/src/fan.js` (and `README.md`'s curve and rayFan entries, the 1 px stroke line) | `tests/unit/curve.test.js::text and margins follow ADR-0003` | [#515] |
| [#518] | `layout2D` draws to its rule: label and scale-bar text from `layoutText(W)`, omitted when null; label room from the text size, East Asian wide characters double (absorbs [#156]); rays by `layoutWeight`; README's label-room line | the rule in the renderer because the website calls `layout2D` without the gallery; considered hiding labels with CSS, ruled out because the room would still be reserved. Rewrites `layout2d.test.js:359-402`'s room and top oracles ([#155], [#63]) to the ADR | `packages/plots/src/layout2d.js`, `packages/plots/README.md` | `tests/unit/layout2d.test.js::labels follow ADR-0003, hidden below 630` (both sides of 630 by 0.01) | [#515] |
| [#519] | Re-record the `layout2D` entries of the renderer baseline from this branch at the M1 verdict | forced (user, at approval 2026-11-04; as CR [#381]) | `tests/fixtures/renderers-baseline.json`, `scripts/record-renderers.mjs` | `tests/unit/split.test.js` green | [#518] |
| [#539] | `fit` draws at the element's fractional content width (`getBoundingClientRect` minus padding), not `clientWidth` (CR [#538]) | forced (user, 2026-11-04: fix the cause of #520's workarounds); considered integer widths, which draw up to 0.5 px too wide in a fractional grid column | `packages/plots/src/fit.js`, `packages/plots/src/index.d.ts` | `tests/unit/fit.test.js::draws at the fractional content width` | [#516] |
| [#540] | `curve` and `rayFan` default heights are whole px (CR [#538]) | forced (user, as [#539]); a fractional height lays an auto-height SVG out by height at scale 0.99997 | `packages/plots/src/curve.js`, `packages/plots/src/fan.js` | `tests/unit/curve.test.js::default heights are whole px` | [#517] |
| [#542] | README: curve's and rayFan's default heights are rounded to whole px (CR [#541]) | forced (stale after [#540]) | `packages/plots/README.md` | none (a doc line) | [#540] |
| [#520] | Gallery: curve, rayFan and layout tiles draw through `fit` at their body width | `fit` because O2 asks the formula at the rendered frame, which today's CSS stretch of a default drawing misses | `gallery/index.html` | the O2 test, for these tiles | [#516], [#517], [#518], [#539], [#540] |
| [#537] | `index.d.ts`: `RayFanProps` gains `width` and `height`; curve's and layout2D's `width` docs and curve's 1 px stroke line follow ADR-0003 (CR [#536]) | forced (the plan's Decisions approve these docs; no M1 item listed them) | `packages/plots/src/index.d.ts`, `tests/types/curve.ts` | `tests/types/curve.ts`: `rayFan({ width, height })` compiles | [#517] |
| [#546] | The scale rule's exports on the default `ELEO`, flat, so the classic build carries them (CR [#545]) | forced (the plan's Decisions approve the scale exports; the gallery loads the classic build); considered an `ELEO.scale` namespace, unlike `physics`, which is flat | `packages/plots/src/index.js`, `packages/plots/src/index.d.ts` | `tests/unit/fit.test.js::index exports fit and the scale rule at runtime` | [#539] |
| [#543] | Gallery: the rayFan row's minimum column is `columns × (F_LO + m · TEXT_MIN)` plus the tile's 26 px of chrome, from the scale rule, capped at the row (CR [#544]; the floor frame is asserted at 1100 only, CR [#547]) | forced (user, 2026-11-04: pull the rayFan row's minimum into M1, computed); considered waiting for [#527], which leaves M1's rayFan tiles unusable | `gallery/index.html`, `tests/gallery.spec.js` | `tests/gallery.spec.js::the rayFan row gives each panel a floor frame (#544)` | [#520], [#546] |
| [#521] | Unskip O1, O2 for curve, rayFan, layout2D; log U14 for curve, panels and layout2D | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/scale.test.js`, `tests/gallery.spec.js` | both tests green | [#513]-[#520], [#537], [#539]-[#543], [#546] |
| [#569] | `limitLabels` rounds its four positions to 2 decimals; one module-level `r2` in `curve.js` (CR [#568]) | forced (review M1 round 3 findings 1 and 2: [#565]'s promise held only at the test's three widths); considered rounding in `plotCell`'s replace pass, which leaves bars' labels (M2) unrounded | `packages/plots/src/limits.js`, `packages/plots/src/curve.js` | `tests/unit/curve.test.js::frame geometry has at most 2 decimals`, swept 120 to 1600 | [#565] |
| [#564] | README: `fit` subtracts borders too (CR [#563]) | forced (review M1 round 2 finding 1) | `packages/plots/README.md` | none (a doc line) | [#562] |
| [#565] | `curve` rounds T, L, pw and ph once, so every line and text beside the frame has at most 2 decimals | forced (review M1 round 2 finding 2, pulled in: [#557] rounded only the rect) | `packages/plots/src/curve.js` | `tests/unit/curve.test.js::frame geometry has at most 2 decimals`, extended | [#557] |
| [#566] | `layout2d.test.js`: the ray weight test's `oracle:` line names ADR-0003 | forced (review M1 round 2 finding 4, pulled in) | `tests/unit/layout2d.test.js` | the test, unchanged | [#558] |
| [#559] | `curve`'s `limit` role draws at ADR-0003's weight; `index.d.ts`'s layout2D `marks` and `width` docs name STO and IMA below 630 (CRs [#548], [#551]) | forced (review M1 findings 1 and 4: ADR-0003 doesn't exempt `limit`; the doc lines ride with a tested change for the hook); considered documenting `limit` as 1 px, which edits the ADR's list | `packages/plots/src/curve.js`, `packages/plots/src/index.d.ts` | `tests/unit/curve.test.js::every role draws a stroke of ADR-0003 weight` | [#517] |
| [#560] | plots-svelte README: the stroke weight follows ADR-0003 (CR [#549]) | forced (review M1 finding 2) | `packages/plots-svelte/README.md` | none (a doc line) | [#517] |
| [#561] | READMEs: `eleo-layout.js` carries `fit`; `fit` and the scale exports documented (CR [#550]) | forced (review M1 finding 3) | `packages/plots/README.md`, `README.md` | none (doc lines) | [#546] |
| [#552] | `layout-size.test.js`'s baseline re-recorded at row O's start | forced (review M1 finding 5; the user, 2026-11-04: re-record at 5028 B, as rows L and M did) | `tests/unit/layout-size.test.js` | the test, against 614422c's measured size | none |
| [#562] | `fit` subtracts borders as well as padding; `fit.js` written plainly again | forced (review M1 finding 7, pulled in); considered keeping the compacted form, which the old budget forced | `packages/plots/src/fit.js`, `packages/plots/src/index.d.ts` | `tests/unit/fit.test.js::subtracts borders` | [#552], [#539] |
| [#557] | `curve` rounds its frame geometry to 2 decimals | forced (review M1 finding 9, pulled in) | `packages/plots/src/curve.js` | `tests/unit/curve.test.js::frame geometry has at most 2 decimals` | [#517] |
| [#558] | `layout2d.test.js`: the ray weight test's name and comment say ADR-0003 | forced (review M1 finding 12, pulled in) | `tests/unit/layout2d.test.js` | the renamed test | [#518] |

### M2: every framed renderer, and the table GitHub: `P512 M2: Scale rule for every framed renderer`

Demo: the whole gallery at 1440, 1100 and 700 px, both themes and three palettes; the footprint tile without its
stopgap (about 18 px text at 1440, full row). Proves: O1, O2 for every framed renderer.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#522] | O1, O2 cases for bars, map2D, spot and throughFocus, skipped | forced (`workflow.md`, TDD) | `tests/unit/scale.test.js`, `tests/map2d.spec.js` | the new cases, skipped | [#521] |
| [#523] | `bars` draws to the rule (margins through `plotCell`, key line pitch, category labels, strokes); README bars wording (absorbs [#311], [#320]) | `curve`'s `frameOf` and margins, which `bars` already imports; considered its own margins, ruled out (two frames would drift). Rewrites `bars.test.js`'s 14 px key-line oracle | `packages/plots/src/bars.js`, `packages/plots/README.md` | `tests/unit/bars.test.js::text follows ADR-0003`, and [#320]'s adapter labels | [#522] |
| [#524] | `map2D` draws to the rule (axes, colorbar ticks, strokes) | forced (map2D's frame is `curve.js`'s `plotCell`, its colorbar text is axis text); considered leaving the colorbar at 10 units, ruled out (two text sizes in one tile) | `packages/plots/src/map2d.js`, `tests/map2d.spec.js` | `tests/map2d.spec.js::text follows ADR-0003` | [#522] |
| [#525] | `spot` and `throughFocus` draw to the rule from their panel side; `textScale` multiplies it; `throughFocus` gains `width` | the panel side is the frame (U18 measured spot at the panel); considered the whole figure's width, ruled out because a 3-panel spot would get 3× the text. Rewrites `spot.test.js:394-421`'s "10 × ts" oracle; README `width`/`textScale` lines | `packages/plots/src/spot.js`, `tests/unit/spot.test.js` (and README) | `tests/unit/spot.test.js::text follows ADR-0003 per panel` | [#522] |
| [#526] | The size table: `PLOT_SIZES` per renderer (default width, aspect, minimum width per panel: one frame at 9 px plus its margins), typed; README section, `limits.js` moved to the helpers sentence (absorbs [#328]) | computed from `scale.js` and each renderer's margins so it can't drift; per panel because a 3-panel spot at its floor (530 px) or throughFocus (about 894 px) would overflow a 630 px gallery column; considered a hand-written table, ruled out by drift | `packages/plots/src/scale.js`, `packages/plots/README.md`, `tests/types/curve.ts`, `packages/plots/src/index.d.ts` (CR [#573]) | `tests/unit/scale.test.js::table matches each renderer's floor width` | [#523], [#524], [#525] |
| [#575] | README: `limits.js` among the shared helpers, not the renderers (CR [#574]; [#328], which [#526] absorbed, is in the root README) | forced ([#328]'s fix as written) | `README.md` | none (a doc line) | [#526] |
| [#527] | Gallery: every framed tile through `fit`; one `--row-min` per row, set from `PLOT_SIZES`; the footprint tile drops `textScale` and its width rule; the footprint test's text and plot-size checks (`gallery.spec.js:77-110`) give way to O2's, its key-alignment check stays (user, at approval) | a row variable because a new tile then can't undercut the floor; considered per-tile CSS minimums, ruled out (hand numbers drift). `.row { grid-template-columns: repeat(auto-fit, minmax(var(--row-min), 1fr)) }` | `gallery/index.html`, `tests/gallery.spec.js` | the O2 test over every framed tile | [#526] |
| [#570] | Re-record the `throughFocus` entry of the renderer baseline right after [#525] | forced (user, at approval: re-record at the M2 verdict; recorded now, as [#519], because a red gate pushes nothing) | `tests/fixtures/renderers-baseline.json`, `scripts/record-renderers.mjs` | `tests/unit/split.test.js` green | [#525] |
| [#572] | `index.d.ts`: `ThroughFocusProps` with `width`; spot's `textScale` docs name ADR-0003 (CR [#571]) | forced (the plan's Decisions approve a `width` doc per framed renderer, as CR [#536]) | `packages/plots/src/index.d.ts`, `tests/types/curve.ts` | `tests/types/curve.ts`: `throughFocus({ width })` compiles | [#525] |
| [#528] | Unskip M2's cases (`scale.test.js`; map2D's was unskipped at [#524]); re-run the baseline script before the M2 verdict if `throughFocus()`'s output moved since [#570] (user, at approval); log U14 for bars, map2D, spot | forced (`workflow.md`, TDD) | `tests/unit/scale.test.js`, `tests/map2d.spec.js`, `tests/fixtures/renderers-baseline.json` | green | [#522]-[#527], [#570], [#572], [#575] |

### M3: Svelte and the release GitHub: `P512 M3: plots-svelte and release`

Demo: `npx playwright test tests/svelte.spec.js --headed`: each framed wrapper in a 300 and a 900 px box; then
`npx changeset status` printing a plots minor and a plots-svelte minor. Proves: O3, O4.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#529] | O3, O4 acceptance tests, skipped; the Playwright page compiles the wrappers with `svelte/compiler` (client) and mounts them | forced (`workflow.md`, TDD); a compiled page because SSR has no layout, so `clientWidth` is never measured there | `tests/svelte.spec.js`, `tests/unit/release.test.js` | skipped | [#528] |
| [#530] | The six framed wrappers (`CurvePlot`, `RayFan`, `BarPlot`, `Map2D`, `SpotDiagram`, `Layout2D`) bind their box's `clientWidth` and pass it as `width` when the caller gives none and it is > 0; README notes the server draws the default and the client redraws on hydration | `bind:clientWidth` because it is Svelte's own resize observer and keeps `{@html}` reactive and SSR-safe; considered `fit` as an action, ruled out because it writes `innerHTML` behind Svelte's back. One line per wrapper, one behaviour, six files | `packages/plots-svelte/src/lib/*.svelte` (the six), `packages/plots-svelte/README.md` | `tests/svelte.spec.js::wrappers draw at their width`, `tests/unit/plots-svelte.test.js::wrappers pass width through on the server` | [#529] |
| [#486] reuse | `Legend` takes `values` | forced ([#486]'s fix as written) | `packages/plots-svelte/src/lib/Legend.svelte`, `packages/plots-svelte/README.md` | `tests/unit/legend.test.js::Legend passes values (#486)` | [#529] |
| [#531] | Changesets: `"@eleoptics/plots": minor` (the rule, `fit`, the table; visible text and stroke change), `"@eleoptics/plots-svelte": minor` (measuring wrappers, `Legend` values) | forced (roadmap row O, release). `npx changeset status` lists both as minor | `.changeset/plot-scale.md`, `.changeset/plots-svelte-scale.md` | `tests/unit/release.test.js::row O changesets` | [#529] |
| [#532] | Unskip O3, O4 | forced (`workflow.md`, TDD) | the test files | green | [#529], [#530], [#486], [#531] |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| Redraw on resize misses U14's 16 ms | janky resize | `fit` coalesces to one draw per frame; U14 re-measured per renderer |
| Kill criterion plot-scale / U18 as worded ("a renderer at its default panel count needs a plot wider than one 240 px column") fires for 3-panel `spot` (530 px), 3-column `rayFan` (about 700) and `throughFocus` (about 894) | stop and ask | reworded per panel at approval (user) |
| Text-unit margins change every tile's frame position | every framed tile's screenshot changes | expected (U18: "text size, plot size or tile span only"); approved at M1 and M2 demos |
| The website's layouts under 630 px lose their labels | eleoptics.com shows unlabelled layouts at narrow widths when it bumps | shown at M1's demo with its fixtures at 600 and 1200 px; the gallery's layout tiles at 700 px too |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-04 draft from roadmap row O.

- 2026-11-04 round 1 (user): buckets confirmed; width bands (then replaced, below); floor 9 px, ceiling 13 px; ratio 1/18 of the frame width
  after a side-by-side page (1/18, 1/25, 1/40 at the floor and ceiling), "but the plots and text should also work at
  the larger sizes too", possibly scaling plot lines and data weighting to fill the extra space.

- 2026-11-04 round 1b (user): after a second page (1/18 at 500 to 1200 px bodies: uniform zoom, text only, text
  capped), "C. Text capped": renderers draw at the container's px width, text `clamp(F / 18, 9, 13)` px, strokes and
  dots grow by the square root of the size factor above the band; the gallery and plots-svelte measure and redraw;
  ADR-0003 supersedes ADR-0001's 1 px strokes; U18's oracle reads "ratio inside the band, clamp outside".

- 2026-11-04 round 2 (user): layout2D takes the clamp, "but on larger plots, its text reads too small. This could
  require an increase in the ratio, or possibly a different scaling rule. At small layout plot sizes, the text may
  also need to be hidden"; no width passed: "the plot should span the full width of the space it is in"; spot's
  `textScale` kept, unused by the gallery; pre-mortem: phos looks different, tiles still mismatch.

- 2026-11-04 round 3 (user), from a third page (recorded Wandersleb and MTF at 300 to 1600 px): layout2D "Knee,
  1/70"; framed plots above the band "Knee, gentler" (cube root); a `fit(el, draw)` helper, yes.

- 2026-11-04 critique (plan critic, claude-fable-5-1): 23 findings; all accepted; 3 and 12 (acceptance-test changes) put to the user at approval.

- 2026-11-04 approval (user): one PR, 3 milestones, 21 items; acceptance tests and oracles approved in one batch; kill
  criterion plot-scale / U18 reworded per panel; the renderer baseline re-recorded at the M1 and M2 verdicts; the
  footprint test's text and size checks superseded by O2.

- 2026-11-04 CR [#535] (orchestrator): accepted; #516 needs `fit` declared in `index.d.ts`, a Core change the Decisions
  already approve; `index.d.ts` joins #516's Files, no new item. #516 also adds `scale.js`'s runtime export to `index.js`.

- 2026-11-04 CR [#536] (orchestrator): accepted; `rayFan` reads `width` since [#517] but `RayFanProps` lacks it; new item [#537]
  in M1, [#521] after it.

- 2026-11-04 measured at [#517]: a default `curve` (460 wide, x ticks to 400) gets F = 372.0, 15.17 px text, a 69.8 px left
  and 18.2 px right margin, not Constraints' F = 402, 15.6 px, about 72 (the right margin was left out); ADR-0003's
  Default widths carries the same figure, rewritten as built at the M1 verdict.

- 2026-11-04 orchestrator: [#519] records the `layout2D` baseline right after [#518], not at the demo, because the
  gate is red until it does and a red gate pushes nothing; if a later M1 change moves `layout2D`'s output, its script
  re-runs before the verdict, so the recorded baseline is the verdict's drawing (the user's choice at approval).

- 2026-11-04 hook (user): `scripts/workflow.env` counts `tests/types/` as tests, for [#537]'s type-only change.

- 2026-11-04 CR [#538] (user: "Fix the cause first"): [#520]'s first attempt needed a hand-set `--row-min: 400px` and a
  rayFan height hardcoding three columns, both rounding workarounds. New items [#539] (`fit` at the fractional content
  width) and [#540] (whole-px default heights) run before [#520]; ADR-0003's "draws `el.clientWidth`" changes at the M1
  verdict.

- 2026-11-04 CR [#541] (orchestrator): accepted; the README's default heights are stale after [#540]; item [#542].
  `index.d.ts`'s rayFan `height` doc stays (accurate; a doc-only source edit has no test for the hook).

- 2026-11-04 CR [#544] (user: "Pull its row minimum in"): since [#520] the rayFan tiles draw at a ~320 px column, three
  panels under the floor frame, with colliding ticks; the O2 test checks text only. Item [#543] computes the rayFan row's
  minimum in M1; [#527] generalises it from `PLOT_SIZES`.

- 2026-11-04 CR [#545] (orchestrator): accepted; the classic build's `window.ELEO` lacks the scale constants [#543] needs;
  item [#546] puts `scale.js`'s exports on the default `ELEO`, flat, as `physics` is.

- 2026-11-04 CR [#547] (orchestrator): accepted; at 1440 the gallery's two theme columns leave the rayFan row 656 px,
  short of the 668.6 px three floor frames need, so [#543] asserts the floor frame at 1100 only (157.8 px at 1440, up from
  46.5). The two-theme layout at 1440 goes to the M1 demo.

- 2026-11-04 review M1 round 1 (code-reviewer): 4 blocking, all published docs and types behind the code: CRs [#548] to
  [#551], accepted (orchestrator; for `limit`, the code follows ADR-0003), items [#559] to [#561]. Backlog pulled into M1
  (within the milestone): [#557], [#558], [#562]. Plain issues: [#553] (ADR-0001, at the verdict), [#554], [#555], [#556].

- 2026-11-04 [#552] (user: "Re-record at 5028 B"): `layout-size.test.js`'s 2 kB budget re-recorded at row O's start, as rows
  L and M did; `fit.js` is written plainly again in [#562].

- 2026-11-04 review M1 round 2: 1 blocking (CR [#563], accepted: the README's `fit` line lagged [#562]; item [#564]);
  round 1's CRs fixed. Pulled in: [#565], [#566]. Plain issue: [#567] (ADR-0003's 1 px list, at the verdict). Breaker counts:
  round 1, 4 blocking + 4 pulled in; round 2, 1 + 2.

- 2026-11-04 review M1 round 3: 1 blocking (CR [#568], accepted: limit label positions carry float noise beside the
  rounded frame) and 1 backlog pulled in, both item [#569]; carried CRs fixed. Breaker count 1 + 1 (falling: 8, 3, 2).

- 2026-11-04 review M1 round 4: 0 blocking, nothing pulled in. CI green on b6322e1.

- 2026-11-04 M1 demo (user): "Go". ADR-0003 accepted, its Decision rewritten as built (`fit`'s content box, whole-px
  default heights, the `limit` role's weight and the `limits` marks at 1 px ([#567]), rounded frame geometry, the default
  figures) with a Verdict; ADR-0001's 1 px rule marked superseded in its Status line ([#553]). The `layout2D` baseline
  recorded at [#519] still holds (no `layout2D` output change since; `split.test.js` green), so it is not re-recorded.

- 2026-11-04 measured at [#521]: U14 (`PERF=1 npx playwright test tests/perf.spec.js`, median of 20 redraws, budget 16 ms) for the M1 renderers:
  curve 1.30 ms, curve panels 0.90 ms, layout2D 2.20 ms. Bars, map2D and spot are logged at [#528].

- 2026-11-04 orchestrator: [#524] unskipped map2D's `text follows ADR-0003` case, its own named test, so [#528] has no map2D case left;
  `recorded PSF cells (U8)` draws its masked copy at 600 px, since the larger margins leave a default drawing's cells under the 2 px its
  one-pixel screenshot needs (U8's oracle unchanged).

- 2026-11-04 orchestrator: [#570] records the `throughFocus` baseline right after [#525], as [#519] did for `layout2D` in M1: the gate is
  red until it does and a red gate pushes nothing; [#528] re-runs the script before the verdict if the output moves again.

- 2026-11-04 CR [#571] (orchestrator): accepted; `throughFocus` reads `width` since [#525] but `index.d.ts` lacks it, and spot's `textScale`
  docs predate ADR-0003; item [#572] in M2, [#528] after it.

- 2026-11-04 orchestrator: wave 2's full gate went red in `tests/gallery.spec.js`, which `--fast` skips: [#524]'s colorbar (found
  by a 10 px width) and [#525]'s footprint tile (text at the meta size). Fixed forward in one `M2 #<i>` commit each, not reverted, because
  [#570] and [#572] build on [#525]. The footprint test's text, plot-size and ratio checks give way to O2's now, not at [#527]
  (the user's approval, at the plan's approval, moved earlier); its key-alignment check stays.

- 2026-11-04 CR [#573] (orchestrator): accepted; [#526]'s table is typed, which needs its `index.d.ts` declaration, a Core change the
  Decisions already approve; `index.d.ts` joins [#526]'s Files, no new item (as CR [#535]).

- 2026-11-04 CR [#574] (orchestrator): accepted; [#328]'s line is in the root `README.md`, not `packages/plots/README.md` as [#526]'s
  Files had it; item [#575] in M2, [#528] after it.

[#138]: https://github.com/ELEOptics/eleo-ui/issues/138
[#155]: https://github.com/ELEOptics/eleo-ui/issues/155
[#156]: https://github.com/ELEOptics/eleo-ui/issues/156
[#160]: https://github.com/ELEOptics/eleo-ui/issues/160
[#263]: https://github.com/ELEOptics/eleo-ui/issues/263
[#311]: https://github.com/ELEOptics/eleo-ui/issues/311
[#320]: https://github.com/ELEOptics/eleo-ui/issues/320
[#328]: https://github.com/ELEOptics/eleo-ui/issues/328
[#330]: https://github.com/ELEOptics/eleo-ui/issues/330
[#381]: https://github.com/ELEOptics/eleo-ui/issues/381
[#464]: https://github.com/ELEOptics/eleo-ui/issues/464
[#486]: https://github.com/ELEOptics/eleo-ui/issues/486
[#487]: https://github.com/ELEOptics/eleo-ui/issues/487
[#498]: https://github.com/ELEOptics/eleo-ui/issues/498
[#504]: https://github.com/ELEOptics/eleo-ui/issues/504
[#507]: https://github.com/ELEOptics/eleo-ui/issues/507
[#512]: https://github.com/ELEOptics/eleo-ui/issues/512
[#513]: https://github.com/ELEOptics/eleo-ui/issues/513
[#514]: https://github.com/ELEOptics/eleo-ui/issues/514
[#515]: https://github.com/ELEOptics/eleo-ui/issues/515
[#516]: https://github.com/ELEOptics/eleo-ui/issues/516
[#517]: https://github.com/ELEOptics/eleo-ui/issues/517
[#518]: https://github.com/ELEOptics/eleo-ui/issues/518
[#519]: https://github.com/ELEOptics/eleo-ui/issues/519
[#520]: https://github.com/ELEOptics/eleo-ui/issues/520
[#521]: https://github.com/ELEOptics/eleo-ui/issues/521
[#522]: https://github.com/ELEOptics/eleo-ui/issues/522
[#523]: https://github.com/ELEOptics/eleo-ui/issues/523
[#524]: https://github.com/ELEOptics/eleo-ui/issues/524
[#525]: https://github.com/ELEOptics/eleo-ui/issues/525
[#526]: https://github.com/ELEOptics/eleo-ui/issues/526
[#527]: https://github.com/ELEOptics/eleo-ui/issues/527
[#528]: https://github.com/ELEOptics/eleo-ui/issues/528
[#529]: https://github.com/ELEOptics/eleo-ui/issues/529
[#530]: https://github.com/ELEOptics/eleo-ui/issues/530
[#531]: https://github.com/ELEOptics/eleo-ui/issues/531
[#532]: https://github.com/ELEOptics/eleo-ui/issues/532
[#533]: https://github.com/ELEOptics/eleo-ui/issues/533
[#535]: https://github.com/ELEOptics/eleo-ui/issues/535
[#536]: https://github.com/ELEOptics/eleo-ui/issues/536
[#537]: https://github.com/ELEOptics/eleo-ui/issues/537
[#538]: https://github.com/ELEOptics/eleo-ui/issues/538
[#539]: https://github.com/ELEOptics/eleo-ui/issues/539
[#540]: https://github.com/ELEOptics/eleo-ui/issues/540
[#541]: https://github.com/ELEOptics/eleo-ui/issues/541
[#542]: https://github.com/ELEOptics/eleo-ui/issues/542
[#543]: https://github.com/ELEOptics/eleo-ui/issues/543
[#544]: https://github.com/ELEOptics/eleo-ui/issues/544
[#545]: https://github.com/ELEOptics/eleo-ui/issues/545
[#546]: https://github.com/ELEOptics/eleo-ui/issues/546
[#547]: https://github.com/ELEOptics/eleo-ui/issues/547
[#548]: https://github.com/ELEOptics/eleo-ui/issues/548
[#549]: https://github.com/ELEOptics/eleo-ui/issues/549
[#550]: https://github.com/ELEOptics/eleo-ui/issues/550
[#551]: https://github.com/ELEOptics/eleo-ui/issues/551
[#552]: https://github.com/ELEOptics/eleo-ui/issues/552
[#553]: https://github.com/ELEOptics/eleo-ui/issues/553
[#554]: https://github.com/ELEOptics/eleo-ui/issues/554
[#555]: https://github.com/ELEOptics/eleo-ui/issues/555
[#556]: https://github.com/ELEOptics/eleo-ui/issues/556
[#557]: https://github.com/ELEOptics/eleo-ui/issues/557
[#558]: https://github.com/ELEOptics/eleo-ui/issues/558
[#559]: https://github.com/ELEOptics/eleo-ui/issues/559
[#560]: https://github.com/ELEOptics/eleo-ui/issues/560
[#561]: https://github.com/ELEOptics/eleo-ui/issues/561
[#562]: https://github.com/ELEOptics/eleo-ui/issues/562
[#563]: https://github.com/ELEOptics/eleo-ui/issues/563
[#564]: https://github.com/ELEOptics/eleo-ui/issues/564
[#565]: https://github.com/ELEOptics/eleo-ui/issues/565
[#566]: https://github.com/ELEOptics/eleo-ui/issues/566
[#567]: https://github.com/ELEOptics/eleo-ui/issues/567
[#568]: https://github.com/ELEOptics/eleo-ui/issues/568
[#569]: https://github.com/ELEOptics/eleo-ui/issues/569
[#570]: https://github.com/ELEOptics/eleo-ui/issues/570
[#571]: https://github.com/ELEOptics/eleo-ui/issues/571
[#572]: https://github.com/ELEOptics/eleo-ui/issues/572
[#573]: https://github.com/ELEOptics/eleo-ui/issues/573
[#574]: https://github.com/ELEOptics/eleo-ui/issues/574
[#575]: https://github.com/ELEOptics/eleo-ui/issues/575
[#63]: https://github.com/ELEOptics/eleo-ui/issues/63
[#70]: https://github.com/ELEOptics/eleo-ui/issues/70
