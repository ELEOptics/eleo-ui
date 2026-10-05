# Plan #<n>: <title>

Status: draft | approved YYYY-MM-DD | done YYYY-MM-DD
Branch: `plan/<n>-<slug>` PR: #<pr> Depends on: plan #<m> | none Roadmap: `agent_docs/roadmap.md`, row <k> | none

## Problem

Two to four sentences in the user's words: who is blocked, how, why now.

## Outcomes

What is observably true when this plan is done. Each one has an acceptance test.

Oracle: where the expected values come from, `<kind> <source>` (`agent_docs/agents/workflow.md`, Oracles).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 |  |  |  | `path::name` |

## Non-goals

Asked for or tempting, and cut on purpose. One line each, with the reason ("next plan" is a reason).

## Existing issues

Open issues related to the goal, and what this plan does with them. Absorbed and superseded ones close with the PR.

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |

## Constraints and assumptions

Facts the plan builds on. An assumption that proves false becomes a CR.

## Decisions

ADRs this plan relies on, and ADRs it will write (as work items). Core changes it needs (approved with the plan).

## Milestones

### M1: <thinnest end-to-end slice> GitHub: `P<n> M1: <title>`

Demo: what you will see and how to run it. Proves: O1

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |

<!-- An absorbed issue reused as the work item: "#<i> reuse". -->

<!-- Approach: why this shape, in one of two forms:
  `<shape> because <reason>; considered <alternative>` (the reason rules the alternative out), or
  `forced (<what forces it>)` (a rule, a file or a decision you can cite).
  A user-facing item shows the exact invocation and its output. A cell the user decided ends `(user)`. -->

| # | O1 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | | | |
| # | | | | | |
| # | Unskip O1 acceptance tests | forced (`workflow.md`, TDD: the last item unskips them) | | | all above |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |

## Change log

One bullet per entry (bare lines render as one paragraph).

- YYYY-MM-DD CR #<n>: what changed in scope.
