# Roadmap: Shared plot types for ELEO

Status: active
Goal: Make `@eleoptics/plots` the one plot layer for eleoptics.com and the phos GUI: first the plots the website
draws today (the lens layout first), then every renderer as a generic plot type on typed data with a role per
series, covering every phos-core result shape; callers build their analyses from those types on the design system.
ADRs: `agent_docs/adr/` (0001 plot boundary, accepted at D; 0002 LayerChart weighed, not adopted; 0003 plot scale, accepted at O).
Constraints: group "Plots the website can share" releases when the website pulls (one minor carried rows A and B; L ships the next);
the sample and every gallery tile keep working through every row. Group "Plot types for phos": each row adds its typed API alongside the old one; a release ships when a
consumer pulls (after C for phos, then whenever phos adopts the next converted renderer), and J removes
`kind` and the sample-shaped `data` in one major release. Recorded phos-core fixtures cover public lenses
only (the sample achromat, the Cooke triplet, the Wandersleb triplet). From row D on, each row keeps U14's redraw budget for the
renderers it touches.

The one living roadmap of this repo: the only agent_docs artifact edited and appended as work lands. The
planner scopes the next plan from it; the orchestrator ticks the plan's row at plan end. A goal that needs
several plans is a set of rows in Plans that share a Topic cell. Done rows, done outcomes and old log entries move to `roadmap-history.md` (`director/roadmap-archive.sh`).

## Outcomes

What the roadmap delivers, each with the oracle its acceptance test will cite (`<kind> <source>`, kinds in
workflow.md TDD > Oracles). Agents propose the oracles; the user approves the column in one batch.

| ID | Outcome | Oracle | Plan |
| -- | -- | -- | -- |
| U6 | `curve` draws any set of typed series (points, role, axis labels and units, optional panels) with no analysis `kind`. MTF, field curvature, distortion, the ray and OPD fans (in panels) and a cumulative probability curve are each built by the caller from it, in the gallery from recorded phos-core results; chromatic focus stays on sample data until phos-core computes it; the ray fans are recorded TransverseRayError measured from each field's chief ray at the reference wavelength (row P; the chief ray chosen by the user at plan #603), the OPD fans stay on sample data. | `fixture: phos-core results recorded by scripts/record-phos-core.py for the sample achromat and the Cooke triplet (ModulationTransfer2d, FieldCurvature, Distortion; MonteCarloTolerance in row tolerance-curve): inverting each SVG's transform recovers every point within 0.5 px`; `fixture: phos-core TransverseRayError recorded by scripts/record-phos-core.py --only fans, minus each field's chief ray at referenceWavelengthNm` for the ray fans (row P, plan #603); `fixture: sample.json opdFans` for the OPD fans | D, E, P, tolerance-curve |
| U10 | `layout3D` takes typed input (phos-core's 3D surface points and normals from `OpticalModel::visualize`, or the 2D layout revolved, as today) with U12's glass fills. The interactive 3D viewport stays in phos (three.js through threlte). | `fixture: recorded phos-core 3D visualize of the sample: projected surface points match an independent projection within 0.5 px` | J |
| U11 | Cut (review 2026-10-05, finding 2): adapters from phos-core types stay in phos, which already imports `@eleo/aurora-types`, until a second consumer needs them. | n/a | - |
| U14 | Plots redraw fast enough for live updates during optimization: at reference sizes (10 000 spot points, a 256 × 256 map, 20 curves of 200 points, a 50-surface layout with 3 fields of 21 rays, 50 surfaces × 7 Seidel terms of bars plus the total) each renderer redraws in under 16 ms. | `measurement: performance.now() in the Playwright gallery tests, median of 20 redraws in headless Chromium on the developer's machine, recorded in the plan's Change log by each row that changes a renderer's drawing (not a CI gate)` | K, J |

## Plans

Order: the rows run in file order; a row becomes a plan (`agent_docs/plans/<n>-<slug>.md`) only when it is next.
K (interaction-polish) and J share no source file, so they are independent; tolerance-curve waits on ELEOptics/phos-core#372.
Row letters and the Plan column: `agent_docs/agents/workflow.md`, Artifacts (Roadmap).

| Row | Plan | Topic | After | Scope | Exit criterion | Status |
| -- | -- | -- | -- | -- | -- | -- |
| tolerance-curve |  | Plot types for phos |  | The cumulative probability curve (MonteCarloTolerance) through `curve`, recorded by `scripts/record-phos-core.py`, once ELEOptics/phos-core#372 puts MonteCarloTolerance in phos-core's Python client. | U6 passes for the cumulative curve. | later |
| K |  | Plot types for phos |  | H's backlog batched: the keyboard gaps #1004, the tooltip's live region #883, dashed limits crawling on a pan #996 (and #323 in `limits.js`), the specs' shared helpers #855, #1067, #1064, #1126, and `export.spec.js`'s flakes #1118, #1125 and duplicate helpers #1098. Not here: #534, #850, #997. | Arrow keys step bars and rays and start from the hovered point; `stop()` leaves the host's `tabindex` as it found it; the live region announces only rested or snapped points; dashes hold still on a pan; every tile's Playwright screenshot unchanged; U14 holds for `interact`. | next |
| J |  | Plot types for phos |  | `layout3D` on typed input with U12's glass fills; then the major release removing `kind` and the sample-shaped `data`. | U10 passes; the major release is on npm. | later |

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
| U1, U2 | The gallery in both themes and palettes before row A | approved 2026-10-05 (plan #4 M1 demo) |
| U3 | The gallery's layout tiles in both themes after row L's defaults (#126) | approved 2026-10-07 (plan #144 M1 demo; B's of 2026-10-06 replaced) |
| U2 | ELEO design system, claude.ai/artifact/JRXsjqrJmdRspmiPEtvEMt | approved (brand book) |
| U12 | The gallery's Cooke-glasses tile, both themes | approved 2026-10-06 (plan #90 M1 demo) |
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

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-17 next (director): K (interaction-polish) next, the order as written: H's backlog batched, the runner-up of the pick of 2026-11-13. Row I is done (PR #1088 merged 2026-11-17); no open plan and no row pin, so the independence rule binds nothing. K also takes plan #1076's leftovers in its files: #323 (`limits.js`, which #996 edits), #1126 (the same spec files as #855 and #1067), and `export.spec.js`'s two flakes #1118 and #1125 (verified by run logs, 2 of 11 and 1 full-gate run; the gate's one source of red today) with its duplicate helpers #1098. Runner-up: J (the major release), last as seeded: no consumer asks for typed `layout3D` yet, and its glass-fill and release leftovers (#125, #139, #86, #132, #133, #158, #639) wait on it; tolerance-curve still waits on ELEOptics/phos-core#372 (open 2026-11-17). From I, for later rows: dots are 0.01 px segments since CRs #1119, #1122 and #1123 (a row that draws dots or re-records baselines inherits it), a canvas raster needs `willReadFrequently: true` on WebKit (CR #1134), and pixel-exact work reads CI at each wave, not only at milestone end. No kill criterion fired: I's largest export embeds 66.8 KB of fonts under the 100 KB ask. #1007 closed with PR #1088, so its Deferred row is dropped. No row added or moved, so no review. 17 issues deferred.
- 2026-11-17 archive: the roadmap migrated to the archive shape (`director/roadmap-archive.sh`): done rows, done outcomes and kill criteria, Change log bullets past the newest 3, Deferred and the Plans prose moved to `agent_docs/roadmap-history.md`; the Plans table folded to seven columns; the Goal cut to three lines and interaction-polish's Scope to 300 characters, their old text word for word in history's Row notes; U11's Plan cell `-`, U14's names the live rows that change a renderer's drawing.
- 2026-11-16 done: I (#1076) finished, U15 passes in Chromium, Firefox and WebKit on macOS and Linux. `standalone` and `png` export every SVG tile; the gallery's MTF tile saves itself. The user set U15's scale-1 rule to exact at 0.5% (CR #1119) with PNG against the tile at a 1-px neighbourhood (CR #1124); WebKit's double-painted dots were fixed in the renderer (CR #1119). Left open: #1118, #1125, #1126.
