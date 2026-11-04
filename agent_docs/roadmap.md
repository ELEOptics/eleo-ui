# Roadmap: Shared plot types for ELEO

Status: active
Goal: Make `@eleoptics/plots` the one plot layer for eleoptics.com and for the phos GUI. First draw what
eleoptics.com draws today with local copies, starting with the lens layout (group "Plots the website can
share", coordinated with ELEOptics/eleo-website's Switch row). Then turn every renderer into a generic plot
type that takes typed data and a role per series, covering every result shape phos-core produces. Callers
(phos, the website, the gallery) build their analyses from those types; eleo-ui keeps the look on the
design system by default.
ADRs: `agent_docs/adr/` (0001 plot boundary, accepted at D; 0002 LayerChart weighed, not adopted; row O writes 0003).
Constraints: group "Plots the website can share" releases when the website pulls (one minor carried rows A and B; L ships the next);
the sample and every gallery tile keep working through every row. Group "Plot types for phos": each row adds its typed API alongside the old one; a release ships when a
consumer pulls (after C for phos, then whenever phos adopts the next converted renderer), and J removes
`kind` and the sample-shaped `data` in one major release. Recorded phos-core fixtures cover public lenses
only (the sample achromat, the Cooke triplet, the Wandersleb triplet). From row D on, each row keeps U14's redraw budget for the
renderers it touches. The standalone layout entry (U4, shipped to the website) grows by at most 2 kB gzipped
per row, checked by a size test.

The one living roadmap of this repo: the only agent_docs artifact edited and appended as work lands. The
planner scopes the next plan from it; the orchestrator ticks the plan's row at plan end. A goal that needs
several plans is a group of rows under its own `### <goal>` heading in Plans. Done rows stay one line.

## Outcomes

What the roadmap delivers, each with the oracle its acceptance test will cite (`<kind> <source>`, kinds in
workflow.md TDD > Oracles). Agents propose the oracles; the user approves the column in one batch.

| ID | Outcome | Oracle | Plan |
| -- | -- | -- | -- |
| U1 | Every renderer colors series in the standard order (1, 7, 8, 3, 4, 6, 2, 5); `data-palette` picks a red-green or blue-yellow order; public as `--series-1..8`. | `paper Machado, Oliveira & Fernandes 2009 via culori's deficiency filters, CIEDE2000; property: rule R (triple with the largest minimum ΔE2000 pairwise and to --accent, both themes, under the palette's conditions; greedy tail) and floor F (triple min ≥ 10)` | A |
| U2 | The segmented control marks the selected option in glass, not amber, so a view keeps one amber accent. | `user ELEO design system (claude.ai/artifact/JRXsjqrJmdRspmiPEtvEMt): one amber accent per view` | A |
| U3 | `layout2D` draws any recorded sequential system (surfaces, glass, stop, image plane, labelled ray fans, optional shared `box`), typed in `index.d.ts`. | `fixture: the website's layouts recorded by its scripts/layout.py, plus the sample: inverting each SVG's transform recovers every surface profile and ray within 0.01 mm` | B |
| U4 | A page without a bundler can load `layout2D` alone, as it can the physics helpers (`eleo-physics.js`). | `property: the entry loads in a page with no other ELEO script and draws U3's fixtures` | B |
| U5 | ADR-0001 fixes the boundary and styling rule: renderers by data shape and the plot shell here, app state in phos, roles never colors, CSS the one override. | `property: a unit test finds no color literal or font name in packages/plots/src outside plots.css, the named colormaps and listed exemptions (layout3D's tone composition and label font)` | D |
| U6 | `curve` draws any set of typed series (points, role, axis labels and units, optional panels) with no analysis `kind`. MTF, field curvature, distortion, the ray and OPD fans (in panels) and a cumulative probability curve are each built by the caller from it, in the gallery from recorded phos-core results; chromatic focus stays on sample data until phos-core computes it, and the ray fans until TransverseRayError marks dead rays (ELEOptics/phos-core#2142; user, plan [#464]). | `fixture: phos-core results recorded by scripts/record-phos-core.py for the sample achromat and the Cooke triplet (ModulationTransfer2d, FieldCurvature, Distortion; MonteCarloTolerance in row tolerance-curve): inverting each SVG's transform recovers every point within 0.5 px`; `fixture: sample.json fans and opdFans` for the fans until row recorded-fans (ELEOptics/phos-core#2142; user, plan [#464]) | D, E, recorded-fans, tolerance-curve |
| U7 | `spot` draws typed points per series and panel, with optional reference circle and centroid; spot diagrams and footprints are caller-built from recordings. | `fixture: recorded phos-core SpotDiagram results (E) and BeamFootprint results (row N: the Cooke triplet's stop, its semi-diameter as a labelled `circle`): every point recovered within 0.5 px; property: one common scale across panels when asked` | E, N |
| U8 | `map2D` draws a typed grid or polar samples (masked, linear or log, sequential or diverging) with a colorbar; wavefront and PSF caller-built from recordings. | `fixture: recorded phos-core WavefrontError (polar rings × spokes, drawn as sectors) and PointSpread results: each sampled pixel matches its value's colormap step; masked samples draw the surface color` | F |
| U9 | `bars` draws signed grouped bars by category and series with a total, and every curve and bar plot takes limit lines and bands. | `fixture: recorded phos-core SeidelCoefficients for the sample: every bar's height recovered within 0.5 px; user: the gallery tile in both themes and palettes` | G |
| U10 | `layout3D` takes typed input (phos-core's 3D surface points and normals from `OpticalModel::visualize`, or the 2D layout revolved, as today) with U12's glass fills. The interactive 3D viewport stays in phos (three.js through threlte). | `fixture: recorded phos-core 3D visualize of the sample: projected surface points match an independent projection within 0.5 px` | J |
| U11 | Cut (review 2026-10-05, finding 2): adapters from phos-core types stay in phos, which already imports `@eleo/aurora-types`, until a second consumer needs them. | n/a | n/a |
| U12 | Each glass in a layout gets its own fill (8 slots by rank in vd in a glass-blue band, pairwise ΔE2000 ≥ 8) and a legend entry; `glass` takes `{name, nd, vd}`. | `property: over designs of up to 8 distinct glasses drawn from a committed table of public catalog values (name, nd, vd), pairwise ΔE2000 ≥ 8 between fills in both themes (culori); the same name gives the same fill; at equal nd, a lower vd never gives a lighter fill` | C |
| U13 | Every 2D plot emits typed events (hover with the nearest data point, its series role and values; click on a series, surface or field) and the plot shell shows a hover readout; curves, points and maps zoom and pan by rewriting the `viewBox` (maps by redrawing the window), with a reset. Marks carry their data (`data-*`) so hover needs no second pass. eleo-ui handles no app logic: phos decides what a click does. | `property: a synthetic pointer event at a data point's drawn position emits that point (round trip through the inverse transform), in every 2D renderer; zoom, pan and reset restore the original view exactly` | H |
| U14 | Plots redraw fast enough for live updates during optimization: at reference sizes (10 000 spot points, a 256 × 256 map, 20 curves of 200 points, a 50-surface layout with 3 fields of 21 rays, 50 surfaces × 7 Seidel terms of bars plus the total) each renderer redraws in under 16 ms. | `measurement: performance.now() in the Playwright gallery tests, median of 20 redraws in headless Chromium on the developer's machine, recorded in the plan's Change log by each row that changes a renderer's drawing (not a CI gate)` | D on |
| U15 | Any plot saves as a standalone SVG (tokens resolved to the current theme through computed styles, as svg-crowbar does, so it renders with no ELEO CSS) and as PNG at a chosen scale (`canvas.toBlob`); canvas plots save as PNG. No new dependency. | `property: an exported SVG opened in a page with no ELEO CSS matches the on-screen plot within 1% of pixels; a PNG's size is the plot's size times the scale` | I |
| U16 | `layout2D` draws the part of a ray past its last physical point lighter and dotted beside its solid real part, from optional per-ray input in `RecordedLayout`. | `fixture: phos-core visualize_system_2d of the Wandersleb triplet (US 1,073,789, public domain) recorded by scripts/record-phos-core.py: for each ray the solid and dotted polylines share exactly its last alive point and together recover the ray within 0.01 mm`; `property: a layout without the input gives the same SVG for every ray point after the start`; `user: the layout tiles in both themes and palettes` (approved 2026-10-12, plan [#337]) | M |
| U17 | `layout2D` takes each kept ray point's phos-core status (`Alive`, `Virtual`, `Dead`: the Rust `RayStatus` variant names) as optional input in `RecordedLayout`, draws each segment in its own status's style (a segment takes the status of its end point), and a `show` option hides the segments of any status; callers choose what a layout shows, so a model where virtual rays are expected keeps them. `Missed` points are non-finite, so they end a ray and never draw. A layout with only `alive` and `dead` draws as today: its tail reads as `Virtual`, whose style stays today's dotted tail. (User, 2026-11-01.) | `fixture: the Wandersleb and Cassegrain layouts re-recorded by scripts/record-phos-core.py at the fixtures' pinned phos-core sha, with each kept point's status: for each ray, the polylines drawn for each status recover exactly that status's segments within 0.01 mm, and a hidden status draws none`; `property: a layout with only alive and dead, or none, gives the same SVG as before`; `user: a Cassegrain tile with show hiding Dead (the obscured rays), in both themes and palettes` | ray-visibility |
| U18 | Every framed plot (curve, rayFan, bars, map2D, spot, throughFocus), drawn at its rendered width, sizes its SVG text from its plot frame's width F: F/18 px inside a 9 to 13 px band, 9 px below it, 13·(F/234)^(1/3) above it, with margins and label room in text units and strokes and dots growing by √(F/234) above the band; layout2D sizes its text at W/70 of its drawing width, hides its labels where that is under 9 px and grows by √(W/910) above 910; canvas tiles (layout3D, the sample PSF, wavefront and Airy maps) are exempt, as U5's lint exempts layout3D. `fit(el, draw)` draws at a container's width and redraws on resize; a table publishes each renderer's default width, aspect and minimum width per panel, and the gallery sizes its rows from it. Tile chrome (titles, meta, footer legends) stays fixed px and is not covered. The rule is ADR-0003, which supersedes ADR-0001's 1 px strokes; renderers draw to it by default, so phos and eleoptics.com get it when they bump; plots-svelte's framed wrappers measure their box. The plots-svelte `Legend` takes `values` ([#486]). (User, 2026-11-04, [#498]; the knee and `fit` from plan [#512]'s interview.) | `closed-form ADR-0003: a unit test on each framed renderer's SVG (map2D's in Playwright) finds every text size and growing stroke width equal to ADR-0003's formulas below, inside and above the band; Playwright, superseding N's footprint ratio test in tests/gallery.spec.js, finds every framed tile's rendered text equal to the formula for its rendered frame within 1% and at least 9 px, at 1440, 1100 and 700 px`; `user: the gallery in both themes and palettes, and the website's U3 layout fixtures, at the row's M1 demo` (oracle changed by the user at plan \[#512\]: the knee in place of the ceiling) | plot-scale |

## Plans

In order. A row becomes a plan (`agent_docs/plans/<n>-<slug>.md`) only when it is next.

Row letters and the Plan column: `agent_docs/agents/workflow.md`, Artifacts (Roadmap).

### Plots the website can share

| Row | Plan | Scope | Exit criterion | Status |
| -- | -- | -- | -- | -- |
| A | [#4] | Brand fixes: the standard field order and two vision palettes as `--series-k` behind `data-palette` in every renderer; `.eleo-seg` marked in glass. | - | done |
| B | [#30] | `layout2D` on the recorded format with the website's fixtures, a `box` option, the standalone entry and the Svelte wrapper; then one minor release. | - | done |
| L | [#144] | Layout defaults for the website ([#126]): no end dot, field labels past the image plane, 1 px rays at .85, the scale bar; then one minor release. | - | done |

B waited on A (both edit `renderers.js`). L, added after C, is the website's pull: eleoptics.com bumps to its release. It edits `layout2d.js` and no file D splits, so it is independent of D. D to J keep the letters they got at seeding; rows added later take the next free letter when they become next, so those letters follow execution order. Not here: `fmt` units.

### Plot types for phos

Each row converts renderers from the sample's untyped `data` and analysis `kind` to typed, generic
inputs (C extends the layout format), keeps every gallery tile (rebuilt by gallery adapters from recorded
phos-core results where phos-core computes them, on sample data otherwise), and updates the Svelte wrappers.
C follows B (both edit the layout). D splits `renderers.js` into modules, so E, F and G touch disjoint
renderers and are independent of each other after D; H and I follow them (they touch every renderer).

| Row | Plan | Scope | Exit criterion | Status |
| -- | -- | -- | -- | -- |
| C | [#90] | Glass identity: `glass` takes `{name, nd, vd}`, a fill per glass on the glass-map rule, a glass legend and a committed catalog table, in `layout2D`. | - | done |
| D | [#162] | `renderers.js` split into modules, the phos-core recorder, ADR-0001, the style lint and `curve` generic, drawing recorded MTF, field curvature and distortion. | - | done |
| E | [#232] | `curve` panels (`rayFan` a wrapper) on the sample's fans and `spot` on typed points from recorded SpotDiagram; the footprint and cumulative curve split out. | - | done |
| N | [#464] | The beam footprint through `spot` (`SpotPanel.circle`, `legend` values, `textScale`), recorded at the Cooke stop; the ray fans split to row recorded-fans. | - | done |
| recorded-fans |  | The ray fans moved to recorded TransverseRayError for the achromat and the Cooke triplet (`--only fans` in `scripts/record-phos-core.py`, an adapter to `curve` panels, the gallery's ray fan tile on the recorded achromat); the OPD fans stay on the sample's data. Split from N by the user (plan [#464]); its wait, ELEOptics/phos-core#2142 (dead rays marked), closed 2026-11-02 (phos-core plan ELEOptics/phos-core#2167), so the fans record at that sha or later (each fixture file carries its own sha). Shares the recorder and `tests/fixtures/phos-core/` with ray-visibility. | U6 passes for the ray fans on recorded TransverseRayError (U6's fixture oracle for the ray fans moves from `sample.json` to it, approved by the user at plan [#464]). | later |
| tolerance-curve |  | The cumulative probability curve (MonteCarloTolerance) through `curve`, recorded by `scripts/record-phos-core.py`, once ELEOptics/phos-core#372 puts MonteCarloTolerance in phos-core's Python client. | U6 passes for the cumulative curve. | later |
| ray-visibility |  | Per-point ray status and visibility toggles in `layout2D` (U17), from the user (2026-11-01): `alive[f][r]` is one prefix count and `dead[f][r]` only how the ray ends, so a ray that goes Alive, Virtual, then Dead loses its virtual part, and no caller can switch a kind of segment off. Adds optional `status[field][ray][point]` (the Rust `RayStatus` names, mapped once from the Python client's `ALIVE`, `VIRTUAL`, `DEAD_E`; row M's rule: never a new vocabulary) and a `show` prop on `Layout2DProps` (the Svelte wrapper spreads its props, so it needs no edit). `alive`/`dead` stay; a legacy tail reads as `Virtual`. Each status keeps a stroke from the existing set (solid, the `1 3` dotted tail, the chief's `6 4` dash on its `Alive` part) or a role, never a caller color (U5). Hidden segments still count toward `layoutBounds`, so toggling `show` never reflows a drawing. `scripts/record-phos-core.py` computes every point's status over all interfaces and drops it: it writes each kept point's status (truncated to `rays`), re-recording at the fixtures' pinned sha so U16's recorded facts hold. The plan settles only the default `show` (recommended: all shown, today's drawing). A new gallery tile: the Cassegrain layout with `Dead` hidden. Typed in `index.d.ts` (Core: the plan opens with a change request). Shares the recorder and `tests/fixtures/phos-core/` with N: runs after N or rebases on it. Not here: which statuses phos-core assigns (whether a mirror's reflection latches `Virtual`), and its adapter passing `status` after this row's release. | U17 passes; U16, U3 and U4 still pass; every existing layout tile unchanged; the Cassegrain `Dead`-hidden tile approved; the release is planned (changesets). | later |
| O | [#512] | One system for how plots render and at what ratios ([#498]; the user at plan [#464]'s M1 demo, 2026-11-04: "a unified system for how plots are rendered and at what ratios"). Measured state: [#498] (each renderer sizes text in its own viewBox units and each tile stretches its SVG to its column, so text size and ratio drift by renderer and tile width; the footprint took three CRs, [#487], [#492], [#496], for want of a rule). Writes ADR-0003 (Core: the plan opens with a change request): one text-to-plot-side ratio for framed renderers, layout2D's text relative to its viewBox width, a px floor at the gallery's narrowest tile and a ceiling, and a per-renderer table of viewBox width, aspect ratio, text size and minimum container width; every renderer in `packages/plots/src/` draws to it by default; `gallery/index.html` takes its tile spans from the table; a unit test checks the ratio on each renderer's SVG, and N's footprint ratio test in `tests/gallery.spec.js` grows to check the floor on every framed tile. Absorbs [#486]'s `values` (plots-svelte `Legend` passes `legend()`'s values); its caller-chosen placement waits for a consumer (phos) that places a legend outside the footer, so the plan files it as its own issue (user, 2026-11-04, review finding 2). Absorbs [#156] (`layout2d.js` sizes label room at a fixed px per character, the assumption this row's ratio replaces), [#330] (`curve.js`'s frame-height clamp: the table's minimum sizes are its rule) and the plots README nits [#311], [#320], [#328] (this row documents the table there). Then a plots minor and a plots-svelte minor, the changesets naming the visible change. Shares `gallery/index.html` and `tests/gallery.spec.js` with recorded-fans and `layout2d.js` with ray-visibility, so neither runs beside it; their new tiles then draw under its rule. | U18 passes; U3, U4, U6–U9 and U16 still pass; every tile's change is text size, plot size or tile span only, approved at M1's demo in both themes and palettes, with the website's U3 layout fixtures (eleoptics.com's look, row L); the release is planned (changesets). | active |
| M | [#337] | Ray status in `layout2D` ([#302]): a ray's non-physical part drawn lighter and dotted from optional per-ray input; Wandersleb and Cassegrain layouts recorded. | - | done 2026-10-30 |
| F | [#389] | `map2D` on typed grids and polar samples with a colorbar, and its Svelte wrapper; the gallery's wavefront and PSF tiles recorded, irradiance from a Gaussian. | - | done 2026-10-31 |
| G | [#284] | `bars` (renderer and Svelte wrapper) for recorded Seidel coefficients; limit lines and bands on curves and bars. | - | done |
| H |  | Interaction: typed hover and click events, `data-*` on marks, the hover readout in `PlotCard`, zoom, pan and reset by `viewBox`. | U13 passes. | later |
| I |  | Export: a small `standalone(svg)` helper modelled on svg-crowbar, PNG through `canvas.toBlob`, a save action in `PlotCard`. | U15 passes. | later |
| J |  | `layout3D` on typed input with U12's glass fills; then the major release removing `kind` and the sample-shaped `data`. | U10 passes; the major release is on npm. | later |

Not here, owned by phos: workflow management, the design editor, the requirements table builder, the
prescription table editor, the 3D viewport (threlte), and the adapters from phos-core types (until a second
consumer needs them). Not here, owned by phos-core: TypeScript exports of
its analysis results (ELEOptics/phos-core#223), the analyses it lacks (encircled energy, Strehl, chromatic focal shift and
lateral color as analyses, relative illumination, through-focus, Zernike fit of the wavefront), 3D ray
paths outside its server, and which statuses a ray's points carry (whether a mirror's reflection latches `Virtual`).

## Decision rights

Who decides what. The default below; change a row only with the user. Anything not listed goes one level up.

| Decision | Owner |
| -- | -- |
| How to implement an item inside its Files | worker |
| Split, CR triage, commit order, wave dispatch | orchestrator |
| Choose, add or reorder rows (`/roadmap next`), milestone acceptance within the plan | director |
| Merge a plan PR that `director/merge.sh` accepts | director |
| Security triggers, superseding an ADR, deviating from this roadmap, changing an oracle or acceptance test, adding a dependency, disputes after two rounds | user |

## Design references

What the UI must look like: screenshots, Figma or Design-canvas links, tokens, apps to match. Each UI
outcome names the baseline the user approves; that baseline is its oracle (`user <artifact>`).

| Outcome | Reference | Baseline |
| -- | -- | -- |
| U1, U2 | The gallery in both themes and palettes before row A | approved 2026-10-05 (plan [#4] M1 demo) |
| U3 | The gallery's layout tiles in both themes after row L's defaults ([#126]) | approved 2026-10-07 (plan [#144] M1 demo; B's of 2026-10-06 replaced) |
| U2 | ELEO design system, claude.ai/artifact/JRXsjqrJmdRspmiPEtvEMt | approved (brand book) |
| U12 | The gallery's Cooke-glasses tile, both themes | approved 2026-10-06 (plan [#90] M1 demo) |
| U5–U10, U13, U15, U18 | The gallery's Playwright screenshots at each row's start (both themes and palettes); the ELEO design system | the diff approved at each row's M1 demo |

## Kill criteria

Per row, the signal that makes the agent stop and ask the user whether to pivot. Measurable where possible.

| Row | Signal | Ask |
| -- | -- | -- |
| D on | A converted tile's Playwright screenshot differs from the baseline captured at the row's start in anything but data (look, labels, layout) | pivot, cut, or continue? |
| D on / U14 | A renderer's recorded median misses 16 ms at the reference sizes and the fix needs a new dependency or a WebGL path | pivot, cut, or continue? |
| O / U18 | A single panel of a framed renderer needs more than a 240 px gallery column to meet the 9 px floor at 1/18, or holding the knee needs a renderer-specific branch (reworded per panel by the user at plan [#512]) | pivot, cut, or continue? |

## Shared tables

Anything several plans draw from and that changes as they land (a hook list, a unit order, a catalog
coverage table). Each row names the plan that delivers it.

## Deferred

Open issues no row cites, each with what it waits for. `/roadmap next` rewrites this table at every pick;
it is the only record of a deferral (no issue comments), and `git log -p` is its history.

| Issue | Waits for | Since |
| -- | -- | -- |
| [#70] | a layout we draw with crowding field labels: the user accepted three fields at plan [#337]'s M1 demo (2026-10-30) and named a legend in place of image-plane labels as the option to weigh then | 2026-10-06 |
| [#125] | the next plan editing `glass.js` or its tests (J's glass fills) | 2026-10-07 |
| [#138] | the next plan editing `layout2d.js`'s input validation (ray-visibility's `status` input); outranked by O | 2026-10-07 |
| [#139] | the next plan editing `glass.js` (J) | 2026-10-07 |
| [#160] | the next plan editing `layout2d.js`'s label placement; outranked by O | 2026-10-08 |
| [#355] | the next plan editing `tests/unit/phos-core-fixtures.test.js` or re-recording the Wandersleb layout (ray-visibility); outranked by O | 2026-10-30 |
| [#356] | the next plan editing `tests/fixtures/phos-core/README.md` (recorded-fans or ray-visibility); outranked by O | 2026-10-30 |
| [#368] | the next plan editing `tests/unit/layout2d.test.js` (ray-visibility); outranked by O | 2026-10-30 |
| [#385] | a fixture made only of one-ray fans, or the next plan editing `tests/unit/layout2d.test.js` (ray-visibility) | 2026-10-30 |
| [#263] | the next plan editing `common.js` or `axis.js`'s exports (its fix dedupes `curve.js` and `spot.js`; O edits `axis.js`'s text, not its exports) | 2026-10-12 |
| [#424] | a Chromium bump or CI run that changes the sample map's PNG bytes (a pixel tolerance changes an approved oracle, the user's) | 2026-10-31 |
| [#448] | the next plan editing `map2d.js`'s range handling | 2026-10-31 |
| [#450] | the next plan editing `map2d.js`'s range handling, with [#448] | 2026-10-31 |
| [#257] | a consumer passing a typed-array range (outside `index.d.ts`'s contract) | 2026-10-12 |
| [#281] | a review asking for a shared U14 harness (O re-measures the renderers it touches the existing way) | 2026-10-12 |
| [#230] | the next plan editing the style lint's exemptions | 2026-10-09 |
| [#323] | the next plan editing `limits.js` or `plotCell` | 2026-10-12 |
| [#336] | the next plan editing `tests/unit/bars.test.js` | 2026-10-12 |
| [#86] | row J's release (edits `release.yml`) | 2026-10-06 |
| [#132] | row J's release (edits `iife.js`) | 2026-10-07 |
| [#133] | row J's release (edits the classic-build tests) | 2026-10-07 |
| [#158] | row J (decides whether `--stroke-ray` stays) | 2026-10-08 |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-04 plan (user): O planned as [#512] (3 milestones, 21 items). Interview: one ratio 1/18 of the frame width with a 9 px floor; text keeps growing above 13 px by the cube root (layout2D: W/70, √ above 910, labels hidden under 9 px); strokes and dots grow by √ above the band; renderers draw at their rendered width through a new `fit(el, draw)`; ADR-0003 supersedes ADR-0001's 1 px strokes. U18's text and oracle rewritten to match (the knee in place of the ceiling, the table per panel), its kill criterion reworded per panel, and N's footprint test superseded by U18's Playwright test.
- 2026-11-04 next (director): O (plot-scale, [#498]) next, ahead of ray-visibility and recorded-fans. Row N is done (PR [#470]); its plots minor and plots-svelte patch ship when the user merges Version Packages (PR [#511]). ELEOptics/phos-core#2142 closed 2026-11-02 (phos-core plan ELEOptics/phos-core#2167: each fan sample's ray status in the Python client), so recorded-fans is unblocked and its Status drops the wait; tolerance-curve still waits on ELEOptics/phos-core#372. O first because it is the user's latest ask (N's one tile took seven demo passes for want of a rule) and sets the rule every later tile draws under: recorded-fans' fan tile and ray-visibility's Cassegrain tile would otherwise be approved twice. O absorbs [#156] (layout2D's per-character label room), [#330] (curve's frame-height clamp) and the plots README nits [#311], [#320], [#328]. Runner-up: recorded-fans, the continuation of N and the smallest plan, which shares `gallery/index.html` and `tests/gallery.spec.js` with O, so it waits; ray-visibility third, sharing `layout2d.js` with O and the recorder with recorded-fans. No ADR since 2026-10-31; no kill criterion fired. Done rows and outcomes cut to one line and the Change log trimmed to its newest 10 bullets (the trim rule; `git log -p` keeps the rest). 22 issues deferred.
- 2026-11-04 plan [#464]: row N done again (PR [#470]). After the first ready, the user reshaped the footprint tile over seven demo passes (CRs [#487], [#492], [#496], [#499], [#502], [#507]): it now draws as the spot tile does, with `spot`'s new `textScale` (Core, user) keeping its caption at the meta's size and tight to the plot, and the tile as wide as its plot. The general rule is row plot-scale ([#498]).
- 2026-11-04: U18 and row plot-scale (later, after N) added by the user ([#498], at plan [#464]'s M1 demo): one rule for viewBox width, aspect ratio and text-to-plot ratio across every renderer and gallery tile. Interview (user): text scales with the plot at one ratio plus a px floor, and the gallery sizes tiles so no plot outgrows its text; aspect ratios and tile sizes in scope; renderer defaults change (a plots minor), not the gallery only; the rule is ADR-0003; [#486] absorbed (Legend `values` and placement); oracle measured on every tile; kill on a ratio-versus-floor clash. Review (below) narrowed the ratio to framed renderers, moved it to a unit test (it is viewport-independent), kept the floor in Playwright, and named the website's fixtures at M1.
- 2026-11-04: review (roadmap-reviewer, claude-opus-5-5)
  - 1: accepted
  - 2: accepted (user): `values` only; placement waits for a consumer
  - 3: accepted
  - 4: accepted
  - 5: accepted
  - 6: accepted
  - 7: accepted
  - 8: accepted
  - 9: accepted (user): a ceiling beside the floor
  - 10: accepted
  - 11: accepted
- 2026-11-02 plan [#464]: row N back to active: the user asked for the footprint tile's caption text in line with its title (CR [#487]).
- 2026-11-02 plan [#464]: row N done (PR [#470]). Beyond the row: `legend(kind, n, values)` takes explicit field angles or wavelengths, so the footprint tile keys its recorded fields (user, CR [#483]); plots-svelte's `Legend` passing `values`, placeable anywhere (user), left as [#486], a plots-svelte minor.
- 2026-11-01: N planned as [#464], footprint only. The user split the ray fans into new later row recorded-fans, waiting on ELEOptics/phos-core#2142 (filed at the plan: TransverseRayError takes a dead ray's last location as its error); U6's Plan and oracle text follow. U7's "semi-diameter as `reference`" became a new `SpotPanel.circle` (`reference` already names spot's recentring mode).
- 2026-11-01: U17 and row ray-visibility (later) added by the user: per-point ray status and `show` toggles in `layout2D`, so callers choose which segments a layout shows. ELEOptics/phos-core#2100 closed 2026-11-01 with decision `virtual` (phos-core keeps Virtual points and passes them as alive), so once this row ships and phos-core's adapter passes `status`, its Virtual stretches change from solid to the Virtual style: a visible change for phos-core's plan that bumps the pin.
- 2026-11-01: review (roadmap-reviewer, claude-fable-5-1)
  - 1: accepted
  - 2: accepted
  - 3: accepted
  - 4: accepted
  - 5: accepted
  - 6: accepted
  - 7: accepted
  - 8: accepted
  - 9: accepted
  - 10: accepted

[#125]: https://github.com/ELEOptics/eleo-ui/issues/125
[#126]: https://github.com/ELEOptics/eleo-ui/issues/126
[#132]: https://github.com/ELEOptics/eleo-ui/issues/132
[#133]: https://github.com/ELEOptics/eleo-ui/issues/133
[#138]: https://github.com/ELEOptics/eleo-ui/issues/138
[#139]: https://github.com/ELEOptics/eleo-ui/issues/139
[#144]: https://github.com/ELEOptics/eleo-ui/issues/144
[#156]: https://github.com/ELEOptics/eleo-ui/issues/156
[#158]: https://github.com/ELEOptics/eleo-ui/issues/158
[#160]: https://github.com/ELEOptics/eleo-ui/issues/160
[#162]: https://github.com/ELEOptics/eleo-ui/issues/162
[#230]: https://github.com/ELEOptics/eleo-ui/issues/230
[#232]: https://github.com/ELEOptics/eleo-ui/issues/232
[#257]: https://github.com/ELEOptics/eleo-ui/issues/257
[#263]: https://github.com/ELEOptics/eleo-ui/issues/263
[#281]: https://github.com/ELEOptics/eleo-ui/issues/281
[#284]: https://github.com/ELEOptics/eleo-ui/issues/284
[#30]: https://github.com/ELEOptics/eleo-ui/issues/30
[#302]: https://github.com/ELEOptics/eleo-ui/issues/302
[#311]: https://github.com/ELEOptics/eleo-ui/issues/311
[#320]: https://github.com/ELEOptics/eleo-ui/issues/320
[#323]: https://github.com/ELEOptics/eleo-ui/issues/323
[#328]: https://github.com/ELEOptics/eleo-ui/issues/328
[#330]: https://github.com/ELEOptics/eleo-ui/issues/330
[#336]: https://github.com/ELEOptics/eleo-ui/issues/336
[#337]: https://github.com/ELEOptics/eleo-ui/issues/337
[#355]: https://github.com/ELEOptics/eleo-ui/issues/355
[#356]: https://github.com/ELEOptics/eleo-ui/issues/356
[#368]: https://github.com/ELEOptics/eleo-ui/issues/368
[#385]: https://github.com/ELEOptics/eleo-ui/issues/385
[#389]: https://github.com/ELEOptics/eleo-ui/issues/389
[#4]: https://github.com/ELEOptics/eleo-ui/issues/4
[#424]: https://github.com/ELEOptics/eleo-ui/issues/424
[#448]: https://github.com/ELEOptics/eleo-ui/issues/448
[#450]: https://github.com/ELEOptics/eleo-ui/issues/450
[#464]: https://github.com/ELEOptics/eleo-ui/issues/464
[#470]: https://github.com/ELEOptics/eleo-ui/issues/470
[#483]: https://github.com/ELEOptics/eleo-ui/issues/483
[#486]: https://github.com/ELEOptics/eleo-ui/issues/486
[#487]: https://github.com/ELEOptics/eleo-ui/issues/487
[#492]: https://github.com/ELEOptics/eleo-ui/issues/492
[#496]: https://github.com/ELEOptics/eleo-ui/issues/496
[#498]: https://github.com/ELEOptics/eleo-ui/issues/498
[#499]: https://github.com/ELEOptics/eleo-ui/issues/499
[#502]: https://github.com/ELEOptics/eleo-ui/issues/502
[#507]: https://github.com/ELEOptics/eleo-ui/issues/507
[#511]: https://github.com/ELEOptics/eleo-ui/issues/511
[#512]: https://github.com/ELEOptics/eleo-ui/issues/512
[#70]: https://github.com/ELEOptics/eleo-ui/issues/70
[#86]: https://github.com/ELEOptics/eleo-ui/issues/86
[#90]: https://github.com/ELEOptics/eleo-ui/issues/90
