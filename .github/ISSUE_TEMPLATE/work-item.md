---
name: Work item
about: One behaviour, one or two files, test first. Created by the planner or from an accepted CR.
labels: work-item
---

Plan: `agent_docs/plans/<n>-<slug>.md` Milestone: M<k> Outcome: O<n> After: #<issue> | none

## Behaviour

One sentence. What is true after this item that was not before.

## Files

- `path` (one or two; tests not counted)

## Test first

`path::test_name`: what it asserts.

## Stop condition

The test passes, `scripts/check.sh` is green, and nothing outside Files changed.

## Out of scope

What you will see and must not touch.
