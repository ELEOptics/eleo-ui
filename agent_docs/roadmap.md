# Roadmap: Shared plot types for ELEO

Status: active
Goal: Make `@eleoptics/plots` the one plot layer for eleoptics.com and for the phos GUI. First draw what
eleoptics.com draws today with local copies, starting with the lens layout (group "Plots the website can
share", coordinated with ELEOptics/eleo-website's Switch row). Then turn every renderer into a generic plot
type that takes typed data and a role per series, covering every result shape phos-core produces. Callers
(phos, the website, the gallery) build their analyses from those types; eleo-ui keeps the look on the
design system by default.
ADRs: `agent_docs/adr/` (0001 plot boundary, accepted at D; 0002 LayerChart weighed, not adopted; 0003 plot scale, accepted at O).
Constraints: group "Plots the website can share" releases when the website pulls (one minor carried rows A and B; L ships the next);
the sample and every gallery tile keep working through every row. Group "Plot types for phos": each row adds its typed API alongside the old one; a release ships when a
consumer pulls (after C for phos, then whenever phos adopts the next converted renderer), and J removes
`kind` and the sample-shaped `data` in one major release. Recorded phos-core fixtures cover public lenses
only (the sample achromat, the Cooke triplet, the Wandersleb triplet). From row D on, each row keeps U14's redraw budget for the
renderers it touches.

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
| U6 | `curve` draws any set of typed series (points, role, axis labels and units, optional panels) with no analysis `kind`. MTF, field curvature, distortion, the ray and OPD fans (in panels) and a cumulative probability curve are each built by the caller from it, in the gallery from recorded phos-core results; chromatic focus stays on sample data until phos-core computes it; the ray fans are recorded TransverseRayError measured from each field's chief ray at the reference wavelength (row P; the chief ray chosen by the user at plan [#603]), the OPD fans stay on sample data. | `fixture: phos-core results recorded by scripts/record-phos-core.py for the sample achromat and the Cooke triplet (ModulationTransfer2d, FieldCurvature, Distortion; MonteCarloTolerance in row tolerance-curve): inverting each SVG's transform recovers every point within 0.5 px`; `fixture: phos-core TransverseRayError recorded by scripts/record-phos-core.py --only fans, minus each field's chief ray at referenceWavelengthNm` for the ray fans (row P, plan [#603]); `fixture: sample.json opdFans` for the OPD fans | D, E, P, tolerance-curve |
| U7 | `spot` draws typed points per series and panel, with optional reference circle and centroid; spot diagrams and footprints are caller-built from recordings. | `fixture: recorded phos-core SpotDiagram results (E) and BeamFootprint results (row N: the Cooke triplet's stop, its semi-diameter as a labelled `circle`): every point recovered within 0.5 px; property: one common scale across panels when asked` | E, N |
| U8 | `map2D` draws a typed grid or polar samples (masked, linear or log, sequential or diverging) with a colorbar; wavefront and PSF caller-built from recordings. | `fixture: recorded phos-core WavefrontError (polar rings × spokes, drawn as sectors) and PointSpread results: each sampled pixel matches its value's colormap step; masked samples draw the surface color` | F |
| U9 | `bars` draws signed grouped bars by category and series with a total, and every curve and bar plot takes limit lines and bands. | `fixture: recorded phos-core SeidelCoefficients for the sample: every bar's height recovered within 0.5 px; user: the gallery tile in both themes and palettes` | G |
| U10 | `layout3D` takes typed input (phos-core's 3D surface points and normals from `OpticalModel::visualize`, or the 2D layout revolved, as today) with U12's glass fills. The interactive 3D viewport stays in phos (three.js through threlte). | `fixture: recorded phos-core 3D visualize of the sample: projected surface points match an independent projection within 0.5 px` | J |
| U11 | Cut (review 2026-10-05, finding 2): adapters from phos-core types stay in phos, which already imports `@eleo/aurora-types`, until a second consumer needs them. | n/a | n/a |
| U12 | Each glass gets its own fill (8 slots by rank in vd in a glass-blue band, pairwise ΔE2000 ≥ 8) and a legend entry; `glass` takes `{name, nd, vd}`. | `property: over designs of up to 8 distinct glasses drawn from a committed table of public catalog values (name, nd, vd), pairwise ΔE2000 ≥ 8 between fills in both themes (culori); the same name gives the same fill; at equal nd, a lower vd never gives a lighter fill` | C |
| U13 | Every 2D plot emits typed events (hover with the nearest data point, its series role and values; click on a series, surface or field) and the plot shell shows a hover readout; curves, points and maps zoom and pan by rewriting the `viewBox` (maps by redrawing the window), with a reset. Marks carry their data (`data-*`) so hover needs no second pass. eleo-ui handles no app logic: phos decides what a click does. | `property: a synthetic pointer event at a data point's drawn position emits that point (round trip through the inverse transform), in every 2D renderer; zoom, pan and reset restore the original view exactly` | H |
| U14 | Plots redraw fast enough for live updates during optimization: at reference sizes (10 000 spot points, a 256 × 256 map, 20 curves of 200 points, a 50-surface layout with 3 fields of 21 rays, 50 surfaces × 7 Seidel terms of bars plus the total) each renderer redraws in under 16 ms. | `measurement: performance.now() in the Playwright gallery tests, median of 20 redraws in headless Chromium on the developer's machine, recorded in the plan's Change log by each row that changes a renderer's drawing (not a CI gate)` | D on |
| U15 | Any plot saves as a standalone SVG (tokens resolved to the current theme through computed styles, as svg-crowbar does, so it renders with no ELEO CSS) and as PNG at a chosen scale (`canvas.toBlob`); canvas plots save as PNG. No new dependency. | `property: an exported SVG opened in a page with no ELEO CSS matches the on-screen plot within 1% of pixels; a PNG's size is the plot's size times the scale` | I |
| U16 | `layout2D` draws the part of a ray past its last physical point lighter and dotted beside its solid real part, from optional per-ray input in `RecordedLayout`. | `fixture: phos-core visualize_system_2d of the Wandersleb triplet (US 1,073,789, public domain) recorded by scripts/record-phos-core.py: for each ray the solid and dotted polylines share exactly its last alive point and together recover the ray within 0.01 mm`; `property: a layout without the input gives the same SVG for every ray point after the start`; `user: the layout tiles in both themes and palettes` (approved 2026-10-12, plan [#337]) | M |
| U17 | `layout2D` takes each kept ray point's status (`Alive`, `Virtual`, `Dead`) as optional input, draws each segment in its status's style; `show` hides a status. | `fixture: the Wandersleb and Cassegrain layouts re-recorded by scripts/record-phos-core.py at the fixtures' pinned phos-core sha, with each kept point's status: for each ray, the polylines drawn for each status recover exactly that status's segments within 0.01 mm, and a hidden status draws none`; `property: a layout with only alive and dead, or none, gives the same SVG as before`; `user: a Cassegrain tile with show hiding Dead (the obscured rays), in both themes and palettes` | Q ([#642]) |
| U18 | Framed plots and `layout2D` size text and heavy strokes from their rendered width by ADR-0003's rule; `fit(el, draw)` and `PLOT_SIZES` carry it to callers. | `closed-form ADR-0003: a unit test on each framed renderer's SVG (map2D's in Playwright) finds every text size and growing stroke width equal to ADR-0003's formulas below, inside and above the band; Playwright, superseding N's footprint ratio test in tests/gallery.spec.js, finds every framed tile's rendered text equal to the formula for its rendered frame within 1% and at least 9 px, at 1440, 1100 and 700 px`; `user: the gallery in both themes and palettes, and the website's U3 layout fixtures, at the row's M1 demo` (oracle changed by the user at plan \[#512\]: the knee in place of the ceiling) | O |
| U19 | Keys are drawn in the SVG and scale with it (ADR-0003): `curve`, `rayFan`, `spot` and `layout2D` take a series `label` or a `key`, placed by `keyAt`. | `closed-form ADR-0003: every key text equals t(F) (layoutText(W) for layout2D) within 1% at 1440, 1100 and 700 px, no key overlaps another key or an axis label`; `fixture: the recorded field angles, orientations and wavelengths for the key labels`; `reference: legend() and glassLegend() for layout keys` | R |
| U20 | The MTF requirement x limit is labelled ("50 cycles/mm"), and limit label offsets scale with the text. | `closed-form ADR-0003`; `user: the mtf-limits tile` | R |
| U21 | Every Map2D tile has x,y axes and a ticked colorbar; no grid by default, and asked for it draws over the image per axis in a grid token per colormap. | `closed-form axisTicks's 1-2-5 rule`; `spec WCAG 2.1: each map's grid token ≥ 2:1 (minor ≥ 1.3:1) against its own map's end stops, under 2.6:1 (minor 1.7:1) against its ground stop (ember 0, wave 4) or, for viridis and gray, the nearer end (CR #765), both themes (CR #756)` | R |
| U22 | `layout3D` paints the rays over the image plane they end on. | `user: request 9 of 2026-11-06`; `property: the plane's pixels with rays are a strict subset of those without` | R |
| U23 | Clamped `layout2D` field labels no longer stack ([#669]). | `property: clamped labels 1 em apart` | R |

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
| P | [#603] | The ray fans on recorded TransverseRayError from each field's chief ray (CR [#621]); `minWidth`; the gallery one tile per line; canvas tiles redraw ([#632]). | - | done 2026-11-05 |
| tolerance-curve |  | The cumulative probability curve (MonteCarloTolerance) through `curve`, recorded by `scripts/record-phos-core.py`, once ELEOptics/phos-core#372 puts MonteCarloTolerance in phos-core's Python client. | U6 passes for the cumulative curve. | later |
| Q | [#642] | Per-point ray `status` and a `show` toggle in `layout2D` (U17), the Cassegrain `Dead`-hidden tile; the recorder writes each kept point's status. | - | done 2026-11-06 |
| R | [#677] | Gallery polish from Q's M2 demo: in-SVG keys on four renderers, the MTF limit labelled, map axes and grid, `layout3D` rays over the image plane. | - | done 2026-11-09 |
| O | [#512] | One scale rule for every plot (ADR-0003, [#498]): text at 1/18 of the frame, a 9 px floor, a knee; `fit(el, draw)`, `PLOT_SIZES`; two minors. | - | done 2026-11-05 |
| M | [#337] | Ray status in `layout2D` ([#302]): a ray's non-physical part drawn lighter and dotted from optional per-ray input; Wandersleb and Cassegrain layouts recorded. | - | done 2026-10-30 |
| F | [#389] | `map2D` on typed grids and polar samples with a colorbar, and its Svelte wrapper; the gallery's wavefront and PSF tiles recorded, irradiance from a Gaussian. | - | done 2026-10-31 |
| G | [#284] | `bars` (renderer and Svelte wrapper) for recorded Seidel coefficients; limit lines and bands on curves and bars. | - | done |
| H | [#804] | Interaction (U13): typed hover and click events, `data-*` on marks, a hover dot, drop lines and tooltip drawn by `interact`, zoom, pan and reset by `viewBox` (maps by redrawing the window). It rewrites every renderer and its unit tests, so it absorbs the nits waiting in those files, each in the item that touches its lines: [#585] and [#586] (`curve.js`'s dead `PLOT_L/B/T`, the margins hand-copied by `bars.js`, `map2d.js`, `spot.js` and `scale.js`), [#263] (one bad-point predicate and step rule for `curve.js` and `spot.js`), [#448] and [#450] (`map2d.js`'s range and log-tick branches, which the map window edits), [#803] (`curve` rejects a non-string key label as `layout2D` does: a released-API tightening with its own changeset), [#659] and [#662] (`layout2d.js`'s redundant `virt` field and its mirror-bodies test anchor), [#554] (`fit` measures before drawing, under the gallery's zoom demo), [#588] and [#336] (stale comments and the old-plots stub in `scale`, `bars` and `curve` tests). The plan's Existing issues table confirms each against its Files; one whose file H leaves alone goes back to Deferred. ADR-0004's revisit trigger (hover, zoom and export most of a plan) is weighed at its interview, not re-spiked. Not here: export (I), legend placement outside the plot ([#534], waits for phos), the fan tile's three coincident wavelengths (a gallery data fix, noted at R, no issue). | U13 passes; every tile's Playwright screenshot unchanged but for the readout; U14 holds for every renderer it touches; the release is planned (changesets). | active |
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
| [#139] | the next plan editing `glass.js` (J) | 2026-10-07 |
| [#424] | a Chromium bump or CI run that changes the sample map's PNG bytes (a pixel tolerance changes an approved oracle, the user's) | 2026-10-31 |
| [#639] | row J, which removes the sample canvas path (`map2d.js:184`'s 1 bitmap px wavefront rim, a hairline at dpr 2–3) and makes it moot: R dropped its two gallery tiles, so no tile shows it; a plan editing that path first takes it | 2026-11-05 |
| [#257] | a consumer passing a typed-array range (outside `index.d.ts`'s contract) | 2026-10-12 |
| [#281] | a review asking for a shared U14 harness (O re-measured the renderers it touched the existing way) | 2026-10-12 |
| [#230] | the next plan editing the style lint's exemptions | 2026-10-09 |
| [#323] | the next plan editing `limits.js` or how `plotCell` takes its body (H's interview buckets it: its hover marks may change `body`; O rewrote `plotCell`'s margins, not its inputs) | 2026-10-12 |
| [#534] | a consumer (phos) that places a legend outside a tile's footer (user, roadmap review 2026-11-04) | 2026-11-05 |
| [#671] | the next plan editing `scripts/record-phos-core.py` (tolerance-curve, once ELEOptics/phos-core#372 closes) | 2026-11-10 |
| [#602] | the user's decision on ADR-0003's wording (the wrappers measure the layout size, `fit` the transformed size), or a consumer that scales a wrapper's ancestor | 2026-11-05 |
| [#86] | row J's release (edits `release.yml`) | 2026-10-06 |
| [#132] | row J's release (edits `iife.js`) | 2026-10-07 |
| [#133] | row J's release (edits the classic-build tests) | 2026-10-07 |
| [#158] | row J (decides whether `--stroke-ray` stays) | 2026-10-08 |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-10 next (director): H (interaction, U13) next, the order as written. Rows Q (PR [#652]) and R (PR [#702]) are done; no open plan and no row pin, so the independence rule binds nothing. H first because it is the oldest open row the user has not held back, ADR-0004 (2026-11-06, Observable Plot weighed again, not adopted) names hover, zoom and export (H and I) as the point to weigh a library again, and ten nits wait on the renderer files it rewrites ([#263], [#336], [#448], [#450], [#585], [#586], [#588], [#659], [#662], [#803]): named in its row as absorbs, so their Deferred rows are dropped; [#323] and [#554] stay deferred until H's interview says whether it edits `limits.js` and `fit.js`. Runner-up: I (export), which shares `PlotCard` and every renderer with H, so it follows; tolerance-curve still waits on ELEOptics/phos-core#372 (open 2026-11-10); J (the major release) last, as seeded. New backlog since the last pick: [#659], [#662], [#671] (Q's reviews) and [#803] (R's); [#671] is the recorder's, deferred to tolerance-curve. [#639] now waits for J: R dropped the two sample canvas map tiles, so nothing shows its rim until J removes the path. The backlog holds no verified bug ([#803] is hardening: `curve` accepts what `layout2D` rejects, and no consumer sends it; the rest nits). No kill criterion fired: R changed every tile beyond its data at the user's own asks, and no redraw measured over 16 ms. R left two ADR lines to the user (ADR-0002:18's size budget, ADR-0003:74-75's widths) and one gallery data fix with no issue (the fan tile's three wavelengths coincide, so one colour shows under a three-entry key). No row added or moved, so no review. Done rows Q and R and outcomes U17, U19 and U21 cut to one sentence; the Change log trimmed to its newest 10 bullets. 17 issues deferred.
- 2026-11-09 plan [#677]: row R done (PR [#702]). Keys are drawn in the SVG on `curve`, `rayFan`, `spot` and `layout2D`, and the HTML footers are gone; the MTF limit is labelled; Map2D tiles have axes and nice colorbar ticks with no grid by default; `layout3D` paints rays over the image plane. The user's demos reshaped it: four M3 rounds put every spot panel (spot and through-focus) on one panel function with tick labels on the outer edges, the merit tile was dropped, and CR [#800] dropped the 2 kB per-row size budget (ADR-0002:18 still cites it, and ADR-0003:74-75's spot and through-focus widths are now about 595 and 919 px: both the user's to amend). Absorbed [#556] and [#669]; [#556]'s Deferred row is dropped. [#803] (`curve` accepts a non-string key label) is new backlog.
- 2026-11-06 plan [#642]: row Q done (PR [#652]). `layout2D` draws each kept point's recorded `status` and takes `show`. The user's M1 demo (three rounds) set the drawing: with `status` a ray runs to its last point, Virtual (dotted) and Dead (solid) are faded at .35 under the Alive runs, and a segment takes its start point's status (CRs [#660], [#663]); vignetting is Dead, not its own style (phos-core has no Vignetted status). Absorbed [#138], [#160], [#355], [#368], [#385], [#616], [#617]; their Deferred rows are dropped. U17 stays, as U16 did after M, worded for both segment rules ([#666]). The user's nine further gallery requests at the M2 demo (legend text size, OPD and curve legends, MTF limit label, PSF colorbar ticks, Map2D axes and grid, Layout3D image-plane order) go to a new row.
- 2026-11-05 next (director): ray-visibility is Q, next, ahead of H. Row P is done (PR [#612]); no open plan, so the independence rule binds nothing. Q is the order as written: the user's ask of 2026-11-01, held only for P, whose recorder and fixtures it shares; five deferred issues wait on its files ([#138], [#160], [#355], [#368], [#385]). It absorbs P's gallery leftovers [#616] and [#617] (both in `gallery/index.html`, which its Cassegrain tile edits), and carries P's lessons (the chief-ray fixtures' `referenceWavelengthNm`, `status_name()`, the tile floor from `minWidth`). Runner-up: H, which the `curve.js`, `limits.js` and `fit.js` cluster ([#323], [#554], [#556], [#585], [#586], [#588]) waits for; tolerance-curve still waits on ELEOptics/phos-core#372 (open). [#630] closed: fixed by CR [#632] in P's M3. [#639] (the sample wavefront rim at high pixel ratios, a `map2d.js` change) joins [#448] and [#450] in waiting for the next plan editing `map2d.js`. The backlog holds no verified bug; no kill criterion fired (P's fan tile changed beyond its data at the user's own asks). No row added or moved, so no review. Done row P cut to one sentence; the Change log trimmed to its newest 10 bullets. 29 issues deferred.
- 2026-11-05 plan [#603]: row P done (PR [#612]). The ray fans are recorded TransverseRayError for the achromat, the Cooke and a stop-clipped Cooke (dead samples as gaps), drawn from each field's chief ray at the reference wavelength: the user's no-go at M1, since phos-core measures from the paraxial image point (CR [#621]); U6's text and ray-fan oracle say so. `minWidth(name, props)` (a plots minor) sizes every gallery tile, so map tiles count their colorbar ([#587]). At the user's asks the gallery became one tile per line at the page width, light then dark (CR [#622]), its canvas tiles redraw at their width (CR [#632]), and ADR-0003's gallery wording was fixed (CR [#633]). plots-svelte peers plots `>=0.8.0 <1` ([#598]). Left for later: [#616] (the fan tile's footer key), [#617], [#639] (the wavefront rim at high pixel ratios).
- 2026-11-05 next (director): P (recorded-fans) next, ahead of ray-visibility. Row O is done (PR [#533], ADR-0003 accepted); its plots and plots-svelte minors shipped when the user merged Version Packages (PR [#511], 2026-11-05: plots 0.8.0, plots-svelte 0.5.0). No open plan, so the independence rule binds nothing. P is the order as written: N's continuation and the smallest plan, its wait (ELEOptics/phos-core#2142) closed 2026-11-02, and O's rule now sizes its fan tile, so the tile is approved once. It absorbs the gallery hardening from O's reviews that lives in the files it edits: [#555] (hand-kept `FIT` and tile lists) and [#587] (map `--row-min` without the colorbar), the fixture nit [#356], and [#598] (plots-svelte's peer on plots `>=0.8.0`), whose wait, PR [#511], has merged. Runner-up: ray-visibility (U17), which shares the recorder and `tests/fixtures/phos-core/` with P, so it waits; tolerance-curve still waits on ELEOptics/phos-core#372 (open). The backlog holds no verified bug: [#587] and [#554] are hardening (U18 and U14 hold at every tested size), the rest nits, each deferred to the plan that edits its files (H touches every renderer, so the `curve.js` and `limits.js` cluster [#323], [#556], [#585], [#586] waits for it). [#602] is the user's: an ADR-0003 wording call, deferred until made. No kill criterion fired. No row added or moved, so no review. Done row O and outcome U18 cut to one sentence; the Change log trimmed to its newest 10 bullets. 28 issues deferred.
- 2026-11-05 plan [#512]: row O done (PR [#533]). ADR-0003 accepted at M1; every framed renderer and `layout2D` draw to it, the gallery sizes rows from `PLOT_SIZES`, plots-svelte's wrappers measure their box, `Legend` takes `values`. Left open: [#598] (plots-svelte peer `>=0.8.0`, waits for the Version packages PR: raising it now breaks `npm ci`) and [#602] (wrappers ignore ancestor transforms; an ADR-0003 wording question).
- 2026-11-04 plan (user): O planned as [#512] (3 milestones, 21 items). Interview: one ratio 1/18 of the frame width with a 9 px floor; text keeps growing above 13 px by the cube root (layout2D: W/70, √ above 910, labels hidden under 9 px); strokes and dots grow by √ above the band; renderers draw at their rendered width through a new `fit(el, draw)`; ADR-0003 supersedes ADR-0001's 1 px strokes. U18's text and oracle rewritten to match (the knee in place of the ceiling, the table per panel), its kill criterion reworded per panel, and N's footprint test superseded by U18's Playwright test.
- 2026-11-04 next (director): O (plot-scale, [#498]) next, ahead of ray-visibility and recorded-fans. Row N is done (PR [#470]); its plots minor and plots-svelte patch ship when the user merges Version Packages (PR [#511]). ELEOptics/phos-core#2142 closed 2026-11-02 (phos-core plan ELEOptics/phos-core#2167: each fan sample's ray status in the Python client), so recorded-fans is unblocked and its Status drops the wait; tolerance-curve still waits on ELEOptics/phos-core#372. O first because it is the user's latest ask (N's one tile took seven demo passes for want of a rule) and sets the rule every later tile draws under: recorded-fans' fan tile and ray-visibility's Cassegrain tile would otherwise be approved twice. O absorbs [#156] (layout2D's per-character label room), [#330] (curve's frame-height clamp) and the plots README nits [#311], [#320], [#328]. Runner-up: recorded-fans, the continuation of N and the smallest plan, which shares `gallery/index.html` and `tests/gallery.spec.js` with O, so it waits; ray-visibility third, sharing `layout2d.js` with O and the recorder with recorded-fans. No ADR since 2026-10-31; no kill criterion fired. Done rows and outcomes cut to one line and the Change log trimmed to its newest 10 bullets (the trim rule; `git log -p` keeps the rest). 22 issues deferred.
- 2026-11-04 plan [#464]: row N done again (PR [#470]). After the first ready, the user reshaped the footprint tile over seven demo passes (CRs [#487], [#492], [#496], [#499], [#502], [#507]): it now draws as the spot tile does, with `spot`'s new `textScale` (Core, user) keeping its caption at the meta's size and tight to the plot, and the tile as wide as its plot. The general rule is row plot-scale ([#498]).

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
[#487]: https://github.com/ELEOptics/eleo-ui/issues/487
[#492]: https://github.com/ELEOptics/eleo-ui/issues/492
[#496]: https://github.com/ELEOptics/eleo-ui/issues/496
[#498]: https://github.com/ELEOptics/eleo-ui/issues/498
[#499]: https://github.com/ELEOptics/eleo-ui/issues/499
[#502]: https://github.com/ELEOptics/eleo-ui/issues/502
[#507]: https://github.com/ELEOptics/eleo-ui/issues/507
[#511]: https://github.com/ELEOptics/eleo-ui/issues/511
[#512]: https://github.com/ELEOptics/eleo-ui/issues/512
[#533]: https://github.com/ELEOptics/eleo-ui/issues/533
[#534]: https://github.com/ELEOptics/eleo-ui/issues/534
[#554]: https://github.com/ELEOptics/eleo-ui/issues/554
[#555]: https://github.com/ELEOptics/eleo-ui/issues/555
[#556]: https://github.com/ELEOptics/eleo-ui/issues/556
[#585]: https://github.com/ELEOptics/eleo-ui/issues/585
[#586]: https://github.com/ELEOptics/eleo-ui/issues/586
[#587]: https://github.com/ELEOptics/eleo-ui/issues/587
[#588]: https://github.com/ELEOptics/eleo-ui/issues/588
[#598]: https://github.com/ELEOptics/eleo-ui/issues/598
[#602]: https://github.com/ELEOptics/eleo-ui/issues/602
[#603]: https://github.com/ELEOptics/eleo-ui/issues/603
[#612]: https://github.com/ELEOptics/eleo-ui/pull/612
[#616]: https://github.com/ELEOptics/eleo-ui/issues/616
[#617]: https://github.com/ELEOptics/eleo-ui/issues/617
[#621]: https://github.com/ELEOptics/eleo-ui/issues/621
[#622]: https://github.com/ELEOptics/eleo-ui/issues/622
[#630]: https://github.com/ELEOptics/eleo-ui/issues/630
[#632]: https://github.com/ELEOptics/eleo-ui/issues/632
[#633]: https://github.com/ELEOptics/eleo-ui/issues/633
[#639]: https://github.com/ELEOptics/eleo-ui/issues/639
[#642]: https://github.com/ELEOptics/eleo-ui/issues/642
[#652]: https://github.com/ELEOptics/eleo-ui/pull/652
[#659]: https://github.com/ELEOptics/eleo-ui/issues/659
[#660]: https://github.com/ELEOptics/eleo-ui/issues/660
[#662]: https://github.com/ELEOptics/eleo-ui/issues/662
[#663]: https://github.com/ELEOptics/eleo-ui/issues/663
[#666]: https://github.com/ELEOptics/eleo-ui/issues/666
[#669]: https://github.com/ELEOptics/eleo-ui/issues/669
[#671]: https://github.com/ELEOptics/eleo-ui/issues/671
[#677]: https://github.com/ELEOptics/eleo-ui/issues/677
[#70]: https://github.com/ELEOptics/eleo-ui/issues/70
[#702]: https://github.com/ELEOptics/eleo-ui/pull/702
[#800]: https://github.com/ELEOptics/eleo-ui/issues/800
[#803]: https://github.com/ELEOptics/eleo-ui/issues/803
[#86]: https://github.com/ELEOptics/eleo-ui/issues/86
[#90]: https://github.com/ELEOptics/eleo-ui/issues/90
[#804]: https://github.com/ELEOptics/eleo-ui/issues/804
