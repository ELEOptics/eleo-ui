#!/usr/bin/env sh
# Everything CI runs, in one place (the full gate also builds the developer site). Green here = green in CI (modulo OS).
# --fast: per work item, only what the uncommitted change affects (seconds, not minutes).
#         The orchestrator runs the full gate after each wave (agent_docs/agents/workflow.md).
set -eu
cd "$(dirname "$0")/.."

if [ "${1:-}" = --fast ]; then
  # What the worker touched: tracked changes plus new files.
  changed=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u)
  [ -n "$changed" ] || { echo "check.sh --fast: nothing changed"; exit 0; }
  # Replace with lint and tests scoped to $changed. Examples:
  #   Rust: cargo clippy -p <crate> && cargo nextest run -p <crate>, crates from the changed paths
  #   TS:   npx eslint $changed && npx vitest related --run $changed
  #   Py:   ruff check $changed && pytest <test files for $changed>
  echo "check.sh: replace this line with the repo's fast gate" >&2
  exit 1
fi

# developer site: full gate only; a repo without zensical.toml skips it
[ ! -f zensical.toml ] || uvx zensical@0.0.67 build --strict
echo "check.sh: replace this line with the repo's lint, type check and test commands" >&2
exit 1
