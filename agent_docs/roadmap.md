# Roadmap: Plots the website can share

Status: active
Goal: Make `@eleoptics/plots` draw what eleoptics.com draws today with local copies, starting with the lens
layout, and fix the shared renderers where the site found them lacking. Coordinated with ELEOptics/eleo-website's
roadmap, whose Switch row consumes the release this one ends with.
ADRs: none yet.
Constraints: one minor release at the end, carrying every row; the sample and every gallery tile keep working.

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
| U3 | `layout2D` draws any recorded sequential system: surfaces with their real profiles, crown or flint glass, a standalone stop, the image plane and a ray fan per field, labelled at the image, with an optional shared-scale `box`. The format is typed in `index.d.ts`, and the sample is one instance of it. | `fixture: the website's layouts recorded by its scripts/layout.py, plus the sample: inverting each SVG's transform recovers every surface profile and ray within 0.01 mm` | Layouts |
| U4 | A page without a bundler can load `layout2D` alone, as it can the physics helpers (`eleo-physics.js`). | `property: the entry loads in a page with no other ELEO script and draws U3's fixtures` | Layouts |

## Plans

In order. A row becomes a plan (`agent_docs/plans/<n>-<slug>.md`) only when it is next.

Row letters and the Plan column: `agent_docs/agents/workflow.md`, Artifacts (Roadmap).

| Row | Plan | Scope | Exit criterion | Status |
| -- | -- | -- | -- | -- |
| A | #4 | Brand fixes: standard field order and two vision palettes (red-green, blue-yellow) as `--series-k` in `plots.css`, selected by `data-palette`, used by every renderer (`layout2D`, `layout3D`, `spot`, `rayFan`, `curve`, `legend`), tested with culori; `.eleo-seg` marked in glass. | U1's tests pass; gallery checked in both themes and palettes, approved. | active |
| Layouts | #3 | `layout2D` on the recorded format, fixtures copied from the website, the sample converted, a `box` option, the standalone entry, Svelte wrapper and gallery tile updated. Then one minor release (`npx changeset`, the user merges the Version packages PR). | U3 and U4 pass; every gallery tile unchanged apart from U1's colors; the release is on npm. | later |

Layouts waits on A (both edit `renderers.js`). Not here: a shared line chart, histogram and sensitivity bars
(the website keeps its own until Phos needs them), and `fmt` units.

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
| U1, U2, U3 | The gallery in both themes before each row | pending: approved at each plan's M1 demo |
| U2 | ELEO design system, claude.ai/artifact/JRXsjqrJmdRspmiPEtvEMt | approved (brand book) |

## Kill criteria

Per row, the signal that makes the agent stop and ask the user whether to pivot. Measurable where possible.

| Row | Signal | Ask |
| -- | -- | -- |
| Layouts / U3 | The sample achromat can't be expressed in the new format without a special case | pivot, cut, or continue? |

## Shared tables

Anything several plans draw from and that changes as they land (a hook list, a unit order, a catalog
coverage table). Each row names the plan that delivers it.

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-05 plan #4 revised (user, CR #14): no single order is safe for every vision condition at once (dark theme, spike #6). U1 now covers a standard order for normal vision plus opt-in red-green and blue-yellow palettes (`data-palette`, `--series-k`) and drops the field-7/8 retune and the WCAG clause. The A / U1 kill criterion is retired.

- 2026-10-05 plan #4 (user): A / U1 kill criterion fired before approval (fields 1–7 at ΔE2000 6.8, dark protan; the approved accent clause admits only blues); user chose to pivot: field-7/8 retuned through a spike, U1's oracle reworded (accent floor 20, contrast 3:1 added). Row A planned as #4, absorbing #2.

- 2026-10-05 approval (user): outcomes U1–U4 and their oracles approved; culori approved as a dev dependency; rows filed as #2 and #3.
- 2026-10-05: drafted with ELEOptics/eleo-website's roadmap, from that repo's review of its local UI code; scope after that roadmap's review (roadmap-reviewer, claude-fable-5-1, findings 1 to 4, 11, 13, 15).
