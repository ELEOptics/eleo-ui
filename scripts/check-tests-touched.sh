#!/usr/bin/env sh
# Fails when a change touches source without touching a test. TDD enforcement, not a suggestion.
# Usage: check-tests-touched.sh [<git range>]   (default: staged changes). Paths: scripts/workflow.env.
set -eu
cd "$(git rev-parse --show-toplevel)"
. scripts/workflow.env
range=${1:-}
changed() { if [ -n "$range" ]; then git diff "$range" "$@"; else git diff --cached "$@"; fi; }
# a file as committed at the range's end, or as staged
blob() { git show "${range:+${range##*..}}:$1"; }

files=$(changed --name-only)

# every added test file names its oracle: a comment line `oracle: <kind> <source>` of a known kind
kinds='spec|paper|url|fixture|closed-form|property|metamorphic|reference|measurement|user'
bad=0
for t in $(changed --name-only --diff-filter=A | grep -E "$TEST_RE" || true); do
  lines=$(blob "$t" | grep -E '^[^[:alnum:]]*oracle:' || true)
  printf '%s\n' "$lines" | grep -qE "oracle: ($kinds) [^ ]" \
    && ! printf '%s\n' "$lines" | grep -vqE "oracle: ($kinds) [^ ]" && continue
  echo "check-tests-touched: $t needs one comment line 'oracle: <kind> <source>', kind one of: ${kinds}" >&2
  bad=1
done
[ "$bad" = 0 ] || { echo "See TDD > Oracles in agent_docs/agents/workflow.md." >&2; exit 1; }

src=$(printf '%s\n' "$files" | grep -E "$SRC_RE" | grep -vE "$TEST_RE" || true)
[ -z "$src" ] && exit 0

# a test file changed
printf '%s\n' "$files" | grep -qE "$TEST_RE" && exit 0
# or a source diff adds an inline test (Rust #[cfg(test)], ...)
[ -n "$INLINE_RE" ] && changed -- $src | grep -qE "^\+.*($INLINE_RE)" && exit 0

echo "check-tests-touched: source changed without a test${range:+ in $range}:" >&2
printf '  %s\n' $src >&2
echo "Write the failing test first (agent_docs/agents/workflow.md). Do not use --no-verify." >&2
exit 1
