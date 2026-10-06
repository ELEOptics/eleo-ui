# Roadmap: Shared plot types for ELEO

Status: active
Goal: Make `@eleoptics/plots` the one plot layer for eleoptics.com and for the phos GUI. First draw what
eleoptics.com draws today with local copies, starting with the lens layout (group "Plots the website can
share", coordinated with ELEOptics/eleo-website's Switch row). Then turn every renderer into a generic plot
type that takes typed data and a role per series, covering every result shape phos-core produces. Callers
(phos, the website, the gallery) build their analyses from those types; eleo-ui keeps the look on the
design system by default.
ADRs: none yet (row D writes the first).
Constraints: group "Plots the website can share" ships one minor release at its end, carrying rows A and B;
the sample and every gallery tile keep working through every row. Group "Plot types for phos": each row adds its typed API alongside the old one; a release ships when a
consumer pulls (after C for phos, then whenever phos adopts the next converted renderer), and J removes
`kind` and the sample-shaped `data` in one major release. Recorded phos-core fixtures cover public lenses
only (the sample achromat, the Cooke triplet). From row D on, each row keeps U14's redraw budget for the
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
| U1 | With no palette set, every renderer colors index 1 to 8 in the standard order (1, 7, 8, 3, 4, 6, 2, 5: no amber in the first three); `data-palette="red-green"` or `"blue-yellow"` on any element switches to an order chosen for that vision condition; the order is public as `--series-1..8`. No token changes. | `paper Machado, Oliveira & Fernandes 2009 via culori's deficiency filters, CIEDE2000; property: rule R (triple with the largest minimum ΔE2000 pairwise and to --accent, both themes, under the palette's conditions; greedy tail) and floor F (triple min ≥ 10)` | A |
| U2 | The segmented control marks the selected option in glass, not amber, so a view keeps one amber accent. | `user ELEO design system (claude.ai/artifact/JRXsjqrJmdRspmiPEtvEMt): one amber accent per view` | A |
| U3 | `layout2D` draws any recorded sequential system: surfaces with their real profiles, crown or flint glass, a standalone stop, the image plane and a ray fan per field, labelled at the image, with an optional shared-scale `box`. The format is typed in `index.d.ts`, and the sample is one instance of it. | `fixture: the website's layouts recorded by its scripts/layout.py, plus the sample: inverting each SVG's transform recovers every surface profile and ray within 0.01 mm` | B |
| U4 | A page without a bundler can load `layout2D` alone, as it can the physics helpers (`eleo-physics.js`). | `property: the entry loads in a page with no other ELEO script and draws U3's fixtures` | B |
| U5 | An ADR fixes the boundary and the styling rule, and weighs Observable Plot and d3 as the alternative. eleo-ui ships renderers by data shape (layout, points, curves, maps, bars) and the plot shell (`PlotCard`, legend, colorbar, hover readout, zoom, export), emits interaction events, and holds no app state. phos's app components (editors, workflow, tables) stay in phos, and one moves here only once a second consumer needs it. A renderer's options carry data, labels and a role per series (field k, wavelength k, tangential, sagittal, reference, limit), never a color, font or stroke width; that option-name rule is checked at each row's review. CSS custom properties on an ancestor are the one override. | `property: a unit test finds no color literal or font name in packages/plots/src outside plots.css, the named colormaps and listed exemptions (layout3D's tone composition and label font)` | D |
| U6 | `curve` draws any set of typed series (points, role, axis labels and units, optional panels) with no analysis `kind`. MTF, field curvature, distortion, the ray and OPD fans and a cumulative probability curve are each built by the caller from it, in the gallery from recorded phos-core results; chromatic focus stays on sample data until phos-core computes it. | `fixture: phos-core results recorded by scripts/record-phos-core.py for the sample achromat and the Cooke triplet (ModulationTransfer2d, FieldCurvature, Distortion, TransverseRayError, MonteCarloTolerance): inverting each SVG's transform recovers every point within 0.5 px` | D, E |
| U7 | `spot` draws typed points per series and panel, with an optional reference circle and centroid; spot diagrams and beam footprints are caller-built from recorded phos-core results; through-focus stays on sample data until phos-core computes it. | `fixture: recorded phos-core SpotDiagram and BeamFootprint results: every point recovered within 0.5 px; property: one common scale across panels when asked` | E |
| U8 | `map2D` draws a typed grid (extent, values, null or NaN as masked, linear or log scale, sequential or diverging map); wavefront, PSF, irradiance and 2D MTF are caller-built. | `fixture: recorded phos-core WavefrontError (NaN-masked) and PointSpread results: each sampled pixel matches its value's colormap step; masked samples draw the surface color` | F |
| U9 | `bars` draws signed grouped bars by category and series with a total, and every curve and bar plot takes limit lines and bands (e.g. a requirement such as MTF ≥ 0.3 at 50 lp/mm). | `fixture: recorded phos-core SeidelCoefficients for the sample: every bar's height recovered within 0.5 px; user: the gallery tile in both themes and palettes` | G |
| U10 | `layout3D` takes typed input (phos-core's 3D surface points and normals from `OpticalModel::visualize`, or the 2D layout revolved, as today) with U12's glass fills. The interactive 3D viewport stays in phos (three.js through threlte). | `fixture: recorded phos-core 3D visualize of the sample: projected surface points match an independent projection within 0.5 px` | J |
| U11 | Cut (review 2026-10-05, finding 2): adapters from phos-core types stay in phos, which already imports `@eleo/aurora-types`, until a second consumer needs them. | n/a | n/a |
| U12 | Each glass in a layout has its own fill, so reused and paired glasses are visible: `glass` also takes `{name, nd, vd}` (crown and flint stay as shorthand). Hue and lightness move from the crown token toward the flint token as vd falls, nd shifts lightness, the same name always gets the same fill, and a glass too close to an earlier one is nudged apart. The legend lists glass names with swatches. phos draws its 2D layout with `layout2D` and deletes its own `src/lib/render/render2d.ts`. | `property: over designs of up to 8 distinct glasses drawn from a committed table of public catalog values (name, nd, vd), pairwise ΔE2000 ≥ 8 between fills in both themes (culori); the same name gives the same fill; at equal nd, a lower vd never gives a lighter fill` | C |
| U13 | Every 2D plot emits typed events (hover with the nearest data point, its series role and values; click on a series, surface or field) and the plot shell shows a hover readout; curves, points and maps zoom and pan by rewriting the `viewBox` (maps by redrawing the window), with a reset. Marks carry their data (`data-*`) so hover needs no second pass. eleo-ui handles no app logic: phos decides what a click does. | `property: a synthetic pointer event at a data point's drawn position emits that point (round trip through the inverse transform), in every 2D renderer; zoom, pan and reset restore the original view exactly` | H |
| U14 | Plots redraw fast enough for live updates during optimization: at reference sizes (10 000 spot points, a 256 × 256 map, 20 curves of 200 points, a 50-surface layout with 3 fields of 21 rays) each renderer redraws in under 16 ms. | `measurement: performance.now() in the Playwright gallery tests, median of 20 redraws in headless Chromium on the developer's machine, recorded in the plan's Change log by each row that changes a renderer's drawing (not a CI gate)` | D–J |
| U15 | Any plot saves as a standalone SVG (tokens resolved to the current theme through computed styles, as svg-crowbar does, so it renders with no ELEO CSS) and as PNG at a chosen scale (`canvas.toBlob`); canvas plots save as PNG. No new dependency. | `property: an exported SVG opened in a page with no ELEO CSS matches the on-screen plot within 1% of pixels; a PNG's size is the plot's size times the scale` | I |

## Plans

In order. A row becomes a plan (`agent_docs/plans/<n>-<slug>.md`) only when it is next.

Row letters and the Plan column: `agent_docs/agents/workflow.md`, Artifacts (Roadmap).

### Plots the website can share

| Row | Plan | Scope | Exit criterion | Status |
| -- | -- | -- | -- | -- |
| A | [#4] | Brand fixes: standard field order and two vision palettes (red-green, blue-yellow) as `--series-k` in `plots.css`, selected by `data-palette`, used by every renderer (`layout2D`, `layout3D`, `spot`, `rayFan`, `curve`, `legend`), tested with culori; `.eleo-seg` marked in glass. | U1's tests pass; gallery checked in both themes and palettes, approved. | done |
| B | #30 | Layouts: `layout2D` on the recorded format, fixtures copied from the website, the sample converted, a `box` option, the standalone entry, Svelte wrapper and gallery tile updated. Then one minor release (`npx changeset`, the user merges the Version packages PR), after fixing its setup: [#21] (a peer bump would release `plots-svelte` as 1.0.0) and [#28] (dev-only audit findings under `@changesets/cli`; `npm audit --omit=dev` documented). Absorbs [#27] (stale "theme change" comments: this row edits three of its four files). | U3 and U4 pass; every gallery tile unchanged apart from U1's colors and the sample's shorter image line (user, 2026-10-06); `npx changeset status` plans a patch of `plots-svelte` and `npm audit` reports 0; the release is on npm. | active |

B waited on A (both edit `renderers.js`). Not here: `fmt` units.

### Plot types for phos

Each row converts renderers from the sample's untyped `data` and analysis `kind` to typed, generic
inputs (C extends the layout format), keeps every gallery tile (rebuilt by gallery adapters from recorded
phos-core results where phos-core computes them, on sample data otherwise), and updates the Svelte wrappers.
C follows B (both edit the layout). D splits `renderers.js` into modules, so E, F and G touch disjoint
renderers and are independent of each other after D; H and I follow them (they touch every renderer).

| Row | Plan | Scope | Exit criterion | Status |
| -- | -- | -- | -- | -- |
| C | | Glass identity: `glass` takes `{name, nd, vd}`, a fill per glass on the glass-map rule, a glass legend, a committed table of public catalog glasses, in `layout2D` and its Svelte wrapper. Then phos switches its 2D layout to `layout2D` (adapter in phos). | U12 passes; the website's crown and flint layouts unchanged; phos's `render2d.ts` deleted. | later |
| D | | First item: split `renderers.js` into one module per renderer plus a typed data module, and capture the gallery's Playwright screenshots as the baseline. Then `scripts/record-phos-core.py` (phos-core's Python client; the legacy REST client for results the uniffi client lacks), the ADR (boundary, styling rule, why not Observable Plot), the source lint, and `curve` generic; the gallery builds MTF, field curvature and distortion from recorded results. | U5 passes; U6 passes for MTF, field curvature, distortion. | later |
| E | | Fans as paneled curves (`rayFan` a thin wrapper), the cumulative probability curve, `spot` on typed points (spot, footprint). | U6 and U7 pass. | later |
| F | | `map2D` on typed grids (masks, log, diverging); wavefront, PSF, irradiance tiles. | U8 passes. | later |
| G | | `bars` (new renderer and Svelte wrapper) for Seidel; limit lines and bands on curves and bars. | U9 passes. | later |
| H | | Interaction: typed hover and click events, `data-*` on marks, the hover readout in `PlotCard`, zoom, pan and reset by `viewBox`. | U13 passes. | later |
| I | | Export: a small `standalone(svg)` helper modelled on svg-crowbar, PNG through `canvas.toBlob`, a save action in `PlotCard`. | U15 passes. | later |
| J | | `layout3D` on typed input with U12's glass fills; then the major release removing `kind` and the sample-shaped `data`. | U10 passes; the major release is on npm. | later |

Not here, owned by phos: workflow management, the design editor, the requirements table builder, the
prescription table editor, the 3D viewport (threlte), and the adapters from phos-core types (until a second
consumer needs them). Not here, owned by phos-core: TypeScript exports of
its analysis results (ELEOptics/phos-core#223), and the analyses it lacks (encircled energy, Strehl, chromatic focal shift and
lateral color as analyses, relative illumination, through-focus, Zernike fit of the wavefront), and 3D ray
paths outside its server.

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
| U3 | The gallery in both themes and palettes before row B | pending: approved at B's M1 demo |
| U2 | ELEO design system, claude.ai/artifact/JRXsjqrJmdRspmiPEtvEMt | approved (brand book) |
| U5–U10, U12, U13, U15 | The gallery's Playwright screenshots at each row's start (both themes and palettes); the ELEO design system | the diff approved at each row's M1 demo |

## Kill criteria

Per row, the signal that makes the agent stop and ask the user whether to pivot. Measurable where possible.

| Row | Signal | Ask |
| -- | -- | -- |
| B / U3 | The sample achromat can't be expressed in the new format without a special case | pivot, cut, or continue? |
| C / U12 | Two glasses from the committed catalog table fall under ΔE2000 8 and the nudge can't separate them without leaving the crown–flint range | pivot, cut, or continue? |
| D / U6 | `curve` can't redraw the current MTF, field curvature or distortion tile without an analysis-specific branch | pivot, cut, or continue? |
| D–J | A converted tile's Playwright screenshot differs from the baseline captured at the row's start in anything but data (look, labels, layout) | pivot, cut, or continue? |
| D–J / U14 | A renderer's recorded median misses 16 ms at the reference sizes and the fix needs a new dependency or a WebGL path | pivot, cut, or continue? |
| D / U5 | The styling rule forces a color, font or stroke option that phos or the website needs and a role can't express | amend the ADR, or continue? |

## Shared tables

Anything several plans draw from and that changes as they land (a hook list, a unit order, a catalog
coverage table). Each row names the plan that delivers it.

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-06 (user, plan #30 M1 review finding 4): row B's exit allows the sample's shorter image line (the recorded-format rule) as an exception to 'tiles unchanged'.
- 2026-10-05 approval (user): outcomes U5–U10 and U12–U15 and their oracles approved, rows C–J, decision rights and kill criteria; releases on consumer pull (review finding 4). Upstream issue filed: ELEOptics/phos-core#223.
- 2026-10-05: review (roadmap-reviewer, claude-fable-5-1)
  - 1: rejected: the second-consumer rule is for app components; hover, zoom and export are the plot shell, which the user asked for (round 3). U5 now says so. Finding 13's smaller tool taken.
  - 2: accepted: U11 and row K cut; phos already imports `@eleo/aurora-types`, so adapters stay in phos until a second consumer.
  - 3: accepted: U14 measured locally in the Playwright gallery tests and recorded per plan, not a CI gate; kill criterion kept.
  - 4: accepted (user, at approval): release on consumer pull, not per row.
  - 5: accepted: chromatic focus and through-focus stay on sample data until phos-core computes them.
  - 6: accepted: `scripts/record-phos-core.py` named as the fixture source, first in row D.
  - 7: accepted in part: phos-core has 3D surfaces (`models/src/optical_model/visualize.rs`, `OpticalModel::visualize`, ts-exported) but no 3D rays outside its server; U10 takes the surfaces or the revolved 2D layout, 3D rays listed under phos-core.
  - 8: accepted: type test dropped; option-name rule in the ADR, checked at review; lint lists layout3D's exemptions.
  - 9: accepted: a committed table of public catalog glasses; kill signal on that table.
  - 10: accepted: baseline is the Playwright screenshots at each row's start; the demo approves the diff.
  - 11: accepted: phos keeps its threlte 3D viewport; J is typed input and glass fills for the existing `layout3D`.
  - 12: accepted: export is a small helper modelled on svg-crowbar plus `canvas.toBlob`; no dependency.
  - 13: accepted: zoom and pan by `viewBox`, hover through `data-*` on marks.
  - 14: accepted: the ADR weighs Observable Plot and d3.
  - 15: accepted: D splits `renderers.js` into modules first; E, F, G independent after D.
  - 16: accepted: C's exit criterion is phos deleting `render2d.ts`, with the adapter in phos.
  - 17: accepted: size constraint on the standalone layout entry (≤ 2 kB gzipped growth per row).
- 2026-10-05 round 3 (user): pre-mortem adds interaction (U13, row H), a redraw budget (U14, a constraint on rows D–J) and export (U15, row I); 3D and the adapters move to J and K. Decision rights unchanged.
- 2026-10-05 round 2 (user): U12 is its own row C right after B (rows shift to D–I); color by glass-map position (vd, nd); oracle floor 8 glasses at ΔE2000 ≥ 8. File an issue on ELEOptics/phos-core for TypeScript exports of every analysis result at publish.
- 2026-10-05 round 1 (user): B's format checked against phos-core's `VisualizeSystem2dResponse` (elements, `interface_type`, per-point status and wavelength; no glass class). The user wants a fill per glass, not crown/flint, following the crown–flint trend: new outcome U12. Release: add typed APIs alongside the old in minor releases, one major at the end. Fixtures: recorded phos-core results for public lenses only. Row order as drafted.
- 2026-10-05 update (draft, user asked): group "Plot types for phos" proposed (U5–U11, rows C–H) from a survey of phos-core's analyses (ELEOptics/phos-core, every result shape) and the renderers here. The user agreed: eleo-ui ships plot types by data shape and the plot shell, not one component per analysis; phos's app UI stays in phos; the design system is the default. Title and goal broadened.

- 2026-10-05 next (director): B (Layouts, [#3]) next, the order as written. Its release step absorbs [#21], [#27] and [#28], since it edits their files (`.changeset/`, `plots-svelte/package.json`, the plots README, `renderers.js`). [#21] reopened (user): closed with plan [#4] but unfixed, PR [#29] still plans `plots-svelte` 1.0.0. Runner-up: a release-hygiene row ([#21], [#28]) ahead of Layouts, passed over as a plan for two config edits the release step rewrites anyway. 0 issues deferred. U1, U2 design baseline recorded as approved at plan [#4]'s M1 demo.

- 2026-10-05 plan [#4] done (user: M1 go): row A done. Standard order 1, 7, 8, …, red-green and blue-yellow palettes as `--series-k` behind `data-palette`, `.eleo-seg` in glass. Follow-ups [#21] (changesets would release plots-svelte as 1.0.0) and [#27] (stale "theme change" comments).

- 2026-10-05 plan [#4] revised (user, CR [#14]): no single order is safe for every vision condition at once (dark theme, spike [#6]). U1 now covers a standard order for normal vision plus opt-in red-green and blue-yellow palettes (`data-palette`, `--series-k`) and drops the field-7/8 retune and the WCAG clause. The A / U1 kill criterion is retired.

- 2026-10-05 plan [#4] (user): A / U1 kill criterion fired before approval (fields 1–7 at ΔE2000 6.8, dark protan; the approved accent clause admits only blues); user chose to pivot: field-7/8 retuned through a spike, U1's oracle reworded (accent floor 20, contrast 3:1 added). Row A planned as [#4], absorbing [#2].

- 2026-10-05 approval (user): outcomes U1–U4 and their oracles approved; culori approved as a dev dependency; rows filed as [#2] and [#3].

- 2026-10-05: drafted with ELEOptics/eleo-website's roadmap, from that repo's review of its local UI code; scope after that roadmap's review (roadmap-reviewer, claude-fable-5-1, findings 1 to 4, 11, 13, 15).

[#14]: https://github.com/ELEOptics/eleo-ui/issues/14
[#2]: https://github.com/ELEOptics/eleo-ui/issues/2
[#21]: https://github.com/ELEOptics/eleo-ui/issues/21
[#27]: https://github.com/ELEOptics/eleo-ui/issues/27
[#28]: https://github.com/ELEOptics/eleo-ui/issues/28
[#29]: https://github.com/ELEOptics/eleo-ui/issues/29
[#3]: https://github.com/ELEOptics/eleo-ui/issues/3
[#4]: https://github.com/ELEOptics/eleo-ui/issues/4
[#6]: https://github.com/ELEOptics/eleo-ui/issues/6
