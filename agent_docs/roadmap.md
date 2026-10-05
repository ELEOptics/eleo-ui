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
| U1 | Every renderer colors fields in a colour-blind-safe order: the first three fields stay distinguishable under protanopia, deuteranopia and tritanopia, and none reads as amber. Today they use fields 1, 2, 3, and field 2 reads as amber; the website uses 1, 7, 8, recorded as passing. | `paper Machado, Oliveira & Fernandes 2009, via culori's deficiency filters and CIEDE2000; property: in both themes and under each simulation, the order's first three colors are pairwise at least as far apart as fields 1, 7 and 8 measure today, and each is at least as far from --accent as field 1 is` | A |
| U2 | The segmented control marks the selected option in glass, not amber, so a view keeps one amber accent. | `user ELEO design system (claude.ai/artifact/JRXsjqrJmdRspmiPEtvEMt): one amber accent per view` | A |
| U3 | `layout2D` draws any recorded sequential system: surfaces with their real profiles, crown or flint glass, a standalone stop, the image plane and a ray fan per field, labelled at the image, with an optional shared-scale `box`. The format is typed in `index.d.ts`, and the sample is one instance of it. | `fixture: the website's layouts recorded by its scripts/layout.py, plus the sample: inverting each SVG's transform recovers every surface profile and ray within 0.01 mm` | Layouts |
| U4 | A page without a bundler can load `layout2D` alone, as it can the physics helpers (`eleo-physics.js`). | `property: the entry loads in a page with no other ELEO script and draws U3's fixtures` | Layouts |

## Plans

In order. A row becomes a plan (`agent_docs/plans/<n>-<slug>.md`) only when it is next.

Row letters and the Plan column: `agent_docs/agents/workflow.md`, Artifacts (Roadmap).

| Row | Plan | Scope | Exit criterion | Status |
| -- | -- | -- | -- | -- |
| A | #2 | Brand fixes: one CVD-safe field order used by every renderer (`layout2D`, `layout3D`, `spot`, `rayFan`, `curve`, `legend`), tested with culori; `.eleo-seg` marked in glass. | U1's test passes; gallery checked in both themes and approved. | next |
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
| A / U1 | Measured, fields 1, 7 and 8 fall below ΔE2000 10 apart under a simulation (the recorded pass doesn't hold), so a better order or a token change is needed | pivot, cut, or continue? |
| Layouts / U3 | The sample achromat can't be expressed in the new format without a special case | pivot, cut, or continue? |

## Shared tables

Anything several plans draw from and that changes as they land (a hook list, a unit order, a catalog
coverage table). Each row names the plan that delivers it.

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-05 approval (user): outcomes U1–U4 and their oracles approved; culori approved as a dev dependency; rows filed as #2 and #3.
- 2026-10-05: drafted with ELEOptics/eleo-website's roadmap, from that repo's review of its local UI code; scope after that roadmap's review (roadmap-reviewer, claude-fable-5-1, findings 1 to 4, 11, 13, 15).
