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
| U13 | Every 2D plot emits typed hover and click events and shows a hover readout; curves, points and maps zoom, pan and reset by redrawing at `view`. | `property: a synthetic pointer event at a data point's drawn position emits that point (round trip through the inverse transform), in every 2D renderer; zoom, pan and reset restore the original view exactly` | H |
| U14 | Plots redraw fast enough for live updates during optimization: at reference sizes (10 000 spot points, a 256 × 256 map, 20 curves of 200 points, a 50-surface layout with 3 fields of 21 rays, 50 surfaces × 7 Seidel terms of bars plus the total) each renderer redraws in under 16 ms. | `measurement: performance.now() in the Playwright gallery tests, median of 20 redraws in headless Chromium on the developer's machine, recorded in the plan's Change log by each row that changes a renderer's drawing (not a CI gate)` | D on |
| U15 | Any SVG plot saves as a standalone SVG (tokens resolved to the current theme through computed styles, as svg-crowbar does, the fonts its text uses embedded, on the tile's surface, so it renders with no ELEO CSS) and as PNG at a chosen scale (`canvas.toBlob`). No new dependency. | `property: an exported SVG opened in a page with no ELEO CSS matches the on-screen plot within 0.5% of pixels, and every face its text uses is embedded and loads with the network blocked; a PNG's size is the plot's size times the scale and at scale 1 its pixels match the exported SVG within 0.5%, and at scale k, box-averaged to 1×, it matches the on-screen plot drawn at device scale k and box-averaged the same way within 1% outside text with a 1-px neighbourhood; the scale-1 comparisons are exact` (canvas clause dropped, font and PNG pixel checks added by the user at plan [#1076]; scale-k rule by the user, CRs [#1104], [#1112], [#1116], [#1119]) | I |
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
renderers and are independent of each other after D; H and I follow them (they touch every renderer). S (cross-browser, the
user's placement of 2026-11-10) sat between H and I; I follows S (the pick of 2026-11-13), and interaction-polish, H's backlog
batched, follows I and is independent of it.

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
| H | [#804] | Interaction (U13): typed hover and click events, `data-*` on marks, the hover readout, zoom, pan and reset by `view`; ten renderer nits absorbed. | - | done 2026-11-11 |
| S | [#1018] | The Playwright tests in Chromium, Firefox and WebKit: one project per browser, Chromium-only specs by `testIgnore`, [#884]'s NaN gap fixed, two oracles changed by CR. | - | done 2026-11-12 |
| I | [#1076] | Export (U15): a small `standalone(svg)` helper that inlines resolved styles and embeds the plot fonts as `@font-face` (modelled on saveSvgAsPng, which does both, rather than svg-crowbar, which embeds no fonts; tokens through `css()` in `color.js`), and PNG through `canvas.toBlob` at a chosen scale; no new dependency unless the interview puts saveSvgAsPng to the user (ADR-0004 names export as the point to weigh a library again). The caller owns the button: one gallery tile shows a save button in `PlotCard`'s existing `actions` snippet, and `PlotCard` is unchanged. It exports what the current `view` draws (H's lesson, PR [#840]) and none of H's hover marks (`interact.js` draws them as HTML `div`s on the host; the plan checks it). For the interview, all the user's (U15 is an approved outcome): a `theme` option (a dark-theme user exporting for a paper), checking the exported text's font (a fallback font can pass the 1% pixel rule), comparing the PNG's pixels and not only its size, and dropping U15's canvas clause (`layout3D` is J's, and a `<canvas>` already has `toBlob`). A text-measuring test measures the em box (CR [#1070]). Not here: a server-side or headless export, phos's save dialog, legend placement outside the tile ([#534]). | U15 passes. | active |
| interaction-polish |  | H's backlog batched (nits never get a row alone; one row once they add up to a plan): the keyboard gaps [#1004] (the pointer sets the current point, `stop()` drops the `tabindex` it added, bars and rays step by arrow), the hover tooltip's live region announcing every interpolated move [#883], dashed limit lines crawling on a pan [#996], and the specs' shared helpers: one drawn-points parser [#855], one anchored matrix parser [#1067] and `moveTo` at S's ~30 fractional pointer sites [#1064] (all three sit in the same spec files). The plan's Existing issues table confirms each against its Files; one it leaves alone goes back to Deferred. Not here: export (I), legend placement outside the tile ([#534], waits for phos), [#850] and [#997] (their triggers, a hover or zoomed-map redraw over budget, have not fired). | Arrow keys step bars and rays and start from the hovered point; `stop()` leaves the host's `tabindex` as it found it; the live region announces only rested or snapped points; dashes hold still on a pan; every tile's Playwright screenshot unchanged; U14 holds for `interact`. | later |
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
| I | An exported SVG or PNG draws its text in a fallback font in any of the three browsers (Fira, loaded from Google Fonts by the gallery, does not reach an SVG drawn into an `<img>` or a standalone file on CI's Linux), or embedding the fonts adds more than 100 KB per export | pivot (system fonts in exports), cut, or continue? |

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
| [#639] | row J, which removes the sample canvas path (`map2d.js:184`'s 1 bitmap px wavefront rim, a hairline at dpr 2–3) and makes it moot: R dropped its two gallery tiles, so no tile shows it; a plan editing that path first takes it | 2026-11-05 |
| [#257] | a consumer passing a typed-array range (outside `index.d.ts`'s contract) | 2026-10-12 |
| [#281] | a review asking for a shared U14 harness (O and H measured the renderers they touched the existing way; H added the hover test to `perf.spec.js` the same way) | 2026-10-12 |
| [#230] | the next plan editing the style lint's exemptions | 2026-10-09 |
| [#534] | a consumer (phos) that places a legend outside a tile's footer (user, roadmap review 2026-11-04) | 2026-11-05 |
| [#671] | the next plan editing `scripts/record-phos-core.py` (tolerance-curve, once ELEOptics/phos-core#372 closes) | 2026-11-10 |
| [#602] | the user's decision on ADR-0003's wording (the wrappers measure the layout size, `fit` the transformed size), or a consumer that scales a wrapper's ancestor | 2026-11-05 |
| [#86] | row J's release (edits `release.yml`) | 2026-10-06 |
| [#132] | row J's release (edits `iife.js`) | 2026-10-07 |
| [#133] | row J's release (edits the classic-build tests) | 2026-10-07 |
| [#158] | row J (decides whether `--stroke-ray` stays) | 2026-10-08 |
| [#850] | a hover measurement over 16 ms (U14) on a slower machine or in CI: H measured at most 2.40 ms | 2026-11-11 |
| [#997] | a zoomed map whose redraw slows as CR [#984]'s did: measured flat from 1x to 1000x on 2026-11-11 | 2026-11-11 |
| [#424] | a Chromium bump or CI run that changes the sample map's PNG bytes (a pixel tolerance changes an approved oracle, the user's); plan [#1018] keeps the test Chromium-only (user, 2026-11-12) | 2026-10-31 |
| [#1007] | PR [#676] (Version Packages) merged and plots 0.10.0 on npm; the next pick after that takes it, as [#598] went to P | 2026-11-11 |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-13 plan (user): I planned as [#1076] (2 milestones, 12 items). Interview: no `theme` option (typed `map2D` bakes its cells; the README gives the light-redraw recipe); U15's canvas clause dropped; O1 adds an embedded-and-loadable font check and O2 a PNG pixel check; exports draw the tile's `--surface`; [#1007] absorbed (plots 0.10.0 published by PR [#676]); a WebKit canvas taint on maps escalates. saveSvgAsPng weighed and not added (ADR-0004's export trigger).
- 2026-11-13: review (roadmap-reviewer, claude-opus-5-5)
  - 1: accepted
  - 2: accepted in part: U15's canvas clause is an approved outcome, so row I lists dropping it for the user at the interview
  - 3: accepted in part: the independence is said once, in the group's intro; the em-box lesson stays in row I (export measures text), the rest is cut; rejected moving lessons to workflow.md, which adopt.sh owns
  - 4: accepted
  - 5: accepted in part: an oracle change is the user's, so row I lists the font check for the interview
  - 6: accepted in part: the PNG pixel comparison listed for the user at the interview, as finding 5
  - 7: accepted
  - 8: accepted
  - 9: accepted in part: the `theme` option listed for the user at the interview (it changes U15's wording)
- 2026-11-13 next (director): I (export, U15) next, moved above interaction-polish: the pick the roadmap left open after S. Row S is done (PR [#1041] merged 2026-11-13); no open plan and no row pin, so the independence rule binds nothing. I first by the user's placement (after cross-browser, 2026-11-10); neither row has a consumer asking for it, and the two share no source file. After the review its row drops `PlotCard`'s save action (the caller's button goes in the existing `actions` snippet), models the helper on saveSvgAsPng's style and font inlining, lists four U15 questions for the user at the interview (a `theme` option, a font check, PNG pixels, the canvas clause), and gets a kill criterion on the real risk, fonts falling back in an export. Runner-up: interaction-polish, which takes S's two spec leftovers [#1064] and [#1067] beside [#855] (the same spec files); tolerance-curve still waits on ELEOptics/phos-core#372 (open 2026-11-13); J (the major release) last, as seeded. [#1045] closed: fixed elsewhere by item [#1059] (dd5e932, PR [#1041]), the fix the issue named. The backlog holds no verified bug ([#1064] and [#1067] are hardening: every spec passes today). No kill criterion fired: S's first run found 12 failures under its 20. Done row S cut to one sentence and its kill criterion deleted; the Change log trimmed to its newest 10 bullets. 18 issues deferred.
- 2026-11-12 (orchestrator): row S done: plan [#1018] accepted at its M4 demo, PR [#1041] ready for review. The tests run in Chromium, Firefox and WebKit with no pending list; two oracles changed, each through a CR the user accepted ([#1070], [#1073]); [#1072] changed what one test measures (the frame's fill box), not its oracle.
- 2026-11-12 plan (user): S planned as [#1018] (4 milestones, 23 items). The first run on Playwright 1.63.0 found 12 distinct failures outside the Chromium-only APIs (7 hover and click tests in both Firefox and WebKit, 4 in Firefox alone, and [#424]'s PNG bytes), under the kill criterion's 20. Interview: Playwright goes to 1.65.0 because its Firefox does not launch on macOS 27 (`Could not find profile folder`; `CFFIXED_USER_HOME` is the fallback), and the failures are measured again as the plan's first step; `sample call unchanged` stays a Chromium-only test, so [#424] is back in Deferred and no oracle changes; [#884] covers NaN and infinite coordinates, a null still draws as 0; tolerances loosen only through a CR the user accepts; one serial CI job.
- 2026-11-11: review (roadmap-reviewer, claude-opus-5-5)
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
- 2026-11-11 next (director): cross-browser is S, next, the order as written: the user's placement of 2026-11-10 (after H, before I). Row H is done (PR [#840] merged); no open plan and no row pin, so the independence rule binds nothing. S takes [#884], the backlog's one verified bug (a single-plot `curve` series with one NaN point draws nothing: `curve.js` draws only panels through `seriesPath`, confirmed against the code; what a browser does with a NaN in a `points` list is the browser's, so it is S's), [#889] in the same item, and the one-line README fix [#983]. After the review, S's scope also names CI's browser install, the Chromium-only specs and tolerances that hold on macOS and Linux, its exit is green in all three with every first-run failure fixed or tolerated, and it has a kill criterion (more than 20 real failures: split or continue; the threshold is the director's guess, the user's to change). Row interaction-polish added, later, after S: H's backlog in `interact.js`, `limits.js` and the specs ([#1004], [#883], [#996], [#855]), which add up to a plan and which neither S, I nor J edits; it is independent of I, so the pick after S weighs the two. Runner-up: I (export), which the user placed after cross-browser; its row now says it exports what the current `view` draws (H's lesson). tolerance-curve still waits on ELEOptics/phos-core#372 (open 2026-11-11); J (the major release) last, as seeded. Newly deferred: [#850] and [#997] (their triggers have not fired) and [#1007] (plots-svelte's peer on plots `>=0.10.0`, waits for PR [#676]). [#323] and [#554] closed with H; [#424] is cited by S, so its Deferred row is dropped. No kill criterion fired: H's redraw medians are 0.95-3.70 ms and hover at most 2.40 ms, under 16 ms. Done row H and outcome U13 cut to one sentence; the Change log trimmed to its newest 10 bullets. 17 issues deferred.
- 2026-11-11 (orchestrator): row H done: plan [#804] accepted at its M4 demo, PR [#840] ready for review.
- 2026-11-10 (user): row cross-browser added, later, after H: the Playwright tests in Chromium, Firefox and WebKit, as its own plan after [#804] (the user's choice over folding it into [#804]). Found at [#804]'s M1 re-demo: the drop lines overshot the y axis in Firefox only (CR [#872]), which the Chromium-only tests could not see.
- 2026-11-10 next (director): H (interaction, U13) next, the order as written. Rows Q (PR [#652]) and R (PR [#702]) are done; no open plan and no row pin, so the independence rule binds nothing. H first because it is the oldest open row the user has not held back, ADR-0004 (2026-11-06, Observable Plot weighed again, not adopted) names hover, zoom and export (H and I) as the point to weigh a library again, and ten nits wait on the renderer files it rewrites ([#263], [#336], [#448], [#450], [#585], [#586], [#588], [#659], [#662], [#803]): named in its row as absorbs, so their Deferred rows are dropped; [#323] and [#554] stay deferred until H's interview says whether it edits `limits.js` and `fit.js`. Runner-up: I (export), which shares `PlotCard` and every renderer with H, so it follows; tolerance-curve still waits on ELEOptics/phos-core#372 (open 2026-11-10); J (the major release) last, as seeded. New backlog since the last pick: [#659], [#662], [#671] (Q's reviews) and [#803] (R's); [#671] is the recorder's, deferred to tolerance-curve. [#639] now waits for J: R dropped the two sample canvas map tiles, so nothing shows its rim until J removes the path. The backlog holds no verified bug ([#803] is hardening: `curve` accepts what `layout2D` rejects, and no consumer sends it; the rest nits). No kill criterion fired: R changed every tile beyond its data at the user's own asks, and no redraw measured over 16 ms. R left two ADR lines to the user (ADR-0002:18's size budget, ADR-0003:74-75's widths) and one gallery data fix with no issue (the fan tile's three wavelengths coincide, so one colour shows under a three-entry key). No row added or moved, so no review. Done rows Q and R and outcomes U17, U19 and U21 cut to one sentence; the Change log trimmed to its newest 10 bullets. 17 issues deferred.
- 2026-11-09 plan [#677]: row R done (PR [#702]). Keys are drawn in the SVG on `curve`, `rayFan`, `spot` and `layout2D`, and the HTML footers are gone; the MTF limit is labelled; Map2D tiles have axes and nice colorbar ticks with no grid by default; `layout3D` paints rays over the image plane. The user's demos reshaped it: four M3 rounds put every spot panel (spot and through-focus) on one panel function with tick labels on the outer edges, the merit tile was dropped, and CR [#800] dropped the 2 kB per-row size budget (ADR-0002:18 still cites it, and ADR-0003:74-75's spot and through-focus widths are now about 595 and 919 px: both the user's to amend). Absorbed [#556] and [#669]; [#556]'s Deferred row is dropped. [#803] (`curve` accepts a non-string key label) is new backlog.


[#1004]: https://github.com/ELEOptics/eleo-ui/issues/1004
[#1007]: https://github.com/ELEOptics/eleo-ui/issues/1007
[#1018]: https://github.com/ELEOptics/eleo-ui/issues/1018
[#1041]: https://github.com/ELEOptics/eleo-ui/issues/1041
[#1045]: https://github.com/ELEOptics/eleo-ui/issues/1045
[#1059]: https://github.com/ELEOptics/eleo-ui/issues/1059
[#1064]: https://github.com/ELEOptics/eleo-ui/issues/1064
[#1067]: https://github.com/ELEOptics/eleo-ui/issues/1067
[#1070]: https://github.com/ELEOptics/eleo-ui/issues/1070
[#1072]: https://github.com/ELEOptics/eleo-ui/issues/1072
[#1073]: https://github.com/ELEOptics/eleo-ui/issues/1073
[#125]: https://github.com/ELEOptics/eleo-ui/issues/125
[#126]: https://github.com/ELEOptics/eleo-ui/issues/126
[#132]: https://github.com/ELEOptics/eleo-ui/issues/132
[#133]: https://github.com/ELEOptics/eleo-ui/issues/133
[#138]: https://github.com/ELEOptics/eleo-ui/issues/138
[#139]: https://github.com/ELEOptics/eleo-ui/issues/139
[#144]: https://github.com/ELEOptics/eleo-ui/issues/144
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
[#323]: https://github.com/ELEOptics/eleo-ui/issues/323
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
[#498]: https://github.com/ELEOptics/eleo-ui/issues/498
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
[#676]: https://github.com/ELEOptics/eleo-ui/pull/676
[#677]: https://github.com/ELEOptics/eleo-ui/issues/677
[#70]: https://github.com/ELEOptics/eleo-ui/issues/70
[#702]: https://github.com/ELEOptics/eleo-ui/pull/702
[#800]: https://github.com/ELEOptics/eleo-ui/issues/800
[#803]: https://github.com/ELEOptics/eleo-ui/issues/803
[#804]: https://github.com/ELEOptics/eleo-ui/issues/804
[#840]: https://github.com/ELEOptics/eleo-ui/pull/840
[#850]: https://github.com/ELEOptics/eleo-ui/issues/850
[#855]: https://github.com/ELEOptics/eleo-ui/issues/855
[#86]: https://github.com/ELEOptics/eleo-ui/issues/86
[#872]: https://github.com/ELEOptics/eleo-ui/issues/872
[#883]: https://github.com/ELEOptics/eleo-ui/issues/883
[#884]: https://github.com/ELEOptics/eleo-ui/issues/884
[#889]: https://github.com/ELEOptics/eleo-ui/issues/889
[#90]: https://github.com/ELEOptics/eleo-ui/issues/90
[#983]: https://github.com/ELEOptics/eleo-ui/issues/983
[#984]: https://github.com/ELEOptics/eleo-ui/issues/984
[#996]: https://github.com/ELEOptics/eleo-ui/issues/996
[#997]: https://github.com/ELEOptics/eleo-ui/issues/997
[#1076]: https://github.com/ELEOptics/eleo-ui/issues/1076
[#1104]: https://github.com/ELEOptics/eleo-ui/issues/1104
[#1116]: https://github.com/ELEOptics/eleo-ui/issues/1116
[#1119]: https://github.com/ELEOptics/eleo-ui/issues/1119
[#1112]: https://github.com/ELEOptics/eleo-ui/issues/1112
