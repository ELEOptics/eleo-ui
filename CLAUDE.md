# eleo-ui (agent entry)

ELEO's shared visual layer: design tokens, optical plot renderers and their Svelte components, published to npm as `@eleoptics/*`. Read `agent_docs/agents/workflow.md` before any task.
Plans: `agent_docs/plans/`. Decisions: `agent_docs/adr/`. Humans: `README.md`.

## Commands

- Setup: `npm ci && npm run build`
- Tests: `npm run test:unit` (needs a build), `npx playwright test` (gallery)
- Gallery: `npm run gallery`
- Release notes: `npx changeset` per user-facing change
- Everything CI runs: `scripts/check.sh`
- Fast gate, per work item: `scripts/check.sh --fast`
- Hooks: `git config core.hooksPath .githooks` once per clone.

Keep this section to commands. No counts or dated measurements: they rot.

## Workflow

Parallel waves: off

## Invariants

- <A rule the code must keep. Each one testable.>

## Core (change request required, see agent_docs/agents/workflow.md)

`agent_docs/adr/`, this file, \<contract, schema, public API paths>.

## Gotchas

- Tooling slowed you down? Append to `~/code/papercuts.md` (date · symptom · fix · <repo>).
