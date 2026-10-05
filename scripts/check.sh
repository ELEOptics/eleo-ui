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
  # The unit tests read packages/*/dist, so build first; the Playwright gallery tests wait for the full gate.
  npm run build
  npm run check
  npm run test:unit
  exit 0
fi

# developer site: full gate only; a repo without zensical.toml skips it
[ ! -f zensical.toml ] || uvx zensical@0.0.67 build --strict
# the steps of .github/workflows/ci.yml
npm ci
npm run build
npm run check
npm run test:unit
npx playwright install chromium
npx playwright test
