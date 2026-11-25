# Roadmap: Shared plot types for ELEO

Status: active
Goal: Make `@eleoptics/plots` the one plot layer for eleoptics.com and the phos GUI: first the plots the website
draws today (the lens layout first), then every renderer as a generic plot type on typed data with a role per
series, covering every phos-core result shape; callers build their analyses from those types on the design system.
ADRs: `agent_docs/adr/` (0001 plot boundary, accepted at D; 0002 LayerChart weighed, not adopted; 0003 plot scale, accepted at O).
Constraints: group "Plots the website can share" releases when the website pulls (one minor carried rows A and B; L ships the next);
the sample and every gallery tile keep working through every row. Group "Plot types for phos": each row adds its typed API alongside the old one; a release ships when a
consumer pulls (after C for phos, then whenever phos adopts the next converted renderer), and K removes
`kind` and the sample-shaped `data` in one breaking minor; 1.0 waits until a consumer has used the API (user, plan #1193). Recorded phos-core fixtures cover public lenses
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
| U10 | `layout3D` takes a recorded layout (`RecordedLayout`, revolved: phos-core's 3D `visualize` is not in its Python client) with U12's glass fills; mirrors, holes and obscurations included. Drawn with three.js (an optional peer, `@eleoptics/plots/layout3d`), an orthographic camera, by default near the optical axis from the object side (yaw 70, pitch -15; plan #1193 CR #1290, user), `iso` a preset. The interactive 3D viewport stays in phos (three.js through threlte). | `closed-form: an orthographic projection with rotation matrices written in the test, of the recorded sample achromat, Cooke glasses and Wandersleb layouts: every revolved profile point, projected through layout3D's three.js camera, within 0.5 px`; `reference: layout2D's element polygons for the same layout: the front view's meridian vertices within 0.5 px` (added by the user at the plan #1193 re-plan); `property: every face of an element carries glassFill's fill for its glass`; `reference: layout2D's mirrorBodies, revolved, for the Cassegrain` (oracle changed by the user at plan #1193) | J |
| U11 | Cut (review 2026-10-05, finding 2): adapters from phos-core types stay in phos, which already imports `@eleo/aurora-types`, until a second consumer needs them. | n/a | - |
| U14 | Plots redraw fast enough for live updates during optimization: at reference sizes (10 000 spot points, a 256 × 256 map, 20 curves of 200 points, a 50-surface layout with 3 fields of 21 rays, 50 surfaces × 7 Seidel terms of bars plus the total) each renderer redraws in under 16 ms. | `measurement: performance.now() in the Playwright gallery tests, median of 20 redraws in headless Chromium on the developer's machine, recorded in the plan's Change log by each row that changes a renderer's drawing (not a CI gate)` | T, J |

## Plans

Order: the rows run in file order; a row becomes a plan (`agent_docs/plans/<n>-<slug>.md`) only when it is next.
J is done (#1193, 2026-11-24); tolerance-curve waits on ELEOptics/phos-core#372.
Row letters and the Plan column: `agent_docs/agents/workflow.md`, Artifacts (Roadmap).

| Row | Plan | Topic | After | Scope | Exit criterion | Status |
| -- | -- | -- | -- | -- | -- | -- |
| tolerance-curve |  | Plot types for phos |  | The cumulative probability curve (MonteCarloTolerance) through `curve`, recorded by `scripts/record-phos-core.py`, once ELEOptics/phos-core#372 puts MonteCarloTolerance in phos-core's Python client. | U6 passes for the cumulative curve. | later |
| J | #1193 | Plot types for phos |  | `layout3D` on a typed `RecordedLayout` (revolved) with U12's glass fills, drawn with three.js (re-planned after the M1 course check stop, user 2026-11-20), mirrors in 3D. | U10 passes in Chromium, Firefox and WebKit. | done 2026-11-24 |
| K | #1258 | Plot types for phos | J | The breaking minor removing `kind` and the sample-shaped `data` (0.x: no 1.0 until a consumer has used the API, user 2026-11-18); split from #1193 at its re-plan (user 2026-11-20), carrying its old O5-O7 and items #1203-#1213, #139. | The breaking minor's changesets are on `main` (the npm publish is the user's, by the Version Packages PR). | active |

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

- 2026-11-24 done (orchestrator): J (#1193) done: `layout3D` draws a recorded layout through three.js, mirrors, holes and obscurations included, in Chromium, Firefox and WebKit. U10's wording follows the user's default-view decision (near-axis from the object side, `iso` a preset; plan #1193 CR #1290).
- 2026-11-18 plan (user): J planned as #1193 (3 milestones, 22 items). Interview: layout3D takes a `RecordedLayout` revolved, and U10's oracle becomes its closed-form projection (phos-core's 3D `visualize` is Rust only); mirrors drawn in 3D; `throughFocus` typed; `./sample` and `eleo-plots-sample.js` removed; the release is a breaking 0.x minor, not 1.0 ("no client has really used eleo-ui"). Absorbs #158 and #139; supersedes #125, #639, #424, #132 and #133, so their Deferred rows drop at the next pick.
- 2026-11-18 next (director): J (typed `layout3D`, then the major release) next, the order as written. T is done (PR #1182). T left one keyboard measurement over 16 ms: an arrow on the 10,000-point spot with 10% dead points takes about 19.5 ms (plan #1175's base). Row U (key response) was drafted ahead of J. The user deferred it: no row, and U14 is not extended to key response. It is filed as #1192 and deferred, with #850 (its candidate fix) still deferred. Runner-up: none. tolerance-curve still waits on ELEOptics/phos-core#372 (open, last touched 2026-10-20). No open plan and no row pin. No kill criterion fired: T's redraw and hover medians are under 16 ms. 20 issues deferred: the 18 before, plus #1191 and #1192.
- 2026-11-18 (user): row U dropped before it was published. The 19.5 ms keyboard path goes to the backlog (#1192), and U14 stays about renderer redraws.
- 2026-11-18: review (roadmap-reviewer, claude-opus-5-5) of row U's draft
  - 1: accepted (cold measure), moot: row dropped; carried into #1192
  - 2: accepted (profile before the cache), moot: row dropped; carried into #1192
  - 3: accepted: put to the user, who did not extend U14
  - 4: accepted, moot: row dropped
  - 5: accepted, moot: row dropped
  - 6: accepted: #1191 deferred to the next change to `interact.js:11`
  - 7: accepted: put to the user, who deferred the row
