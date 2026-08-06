#!/usr/bin/env bash
# Collect dead-code candidates for the refactoring audit.
# This script never fixes or deletes code.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KNIP_BIN="${REFACTORING_AUDIT_KNIP_BIN:-$ROOT/node_modules/.bin/knip}"
KNIP_CONFIG="$SCRIPT_DIR/../knip-audit.json"
SUMMARIZER="$SCRIPT_DIR/summarize-knip.mjs"

cd "$ROOT"

echo "=== DEAD-CODE AUDIT ==="
echo "date: $(date -u +%Y-%m-%d)"
echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
echo

if [ ! -x "$KNIP_BIN" ]; then
  echo "coverage: PARTIAL"
  echo "reason: local Knip binary is unavailable at $KNIP_BIN"
  echo "action: run Nx typecheck and project-graph checks; ask before adding Knip to package.json"
  exit 0
fi

if [ ! -f "$KNIP_CONFIG" ]; then
  echo "coverage: PARTIAL"
  echo "reason: Knip audit configuration is missing at $KNIP_CONFIG"
  exit 1
fi

if [ ! -f "$SUMMARIZER" ]; then
  echo "coverage: PARTIAL"
  echo "reason: Knip result summarizer is missing at $SUMMARIZER"
  exit 1
fi

run_knip() {
  local label="$1"
  shift

  echo "## $label"
  echo
  "$KNIP_BIN" \
    --directory "$ROOT" \
    --config "$KNIP_CONFIG" \
    --no-progress \
    --no-exit-code \
    --include files,dependencies,unlisted,unresolved,exports,nsExports,types,nsTypes,enumMembers,namespaceMembers \
    --reporter json \
    "$@" \
    | node "$SUMMARIZER"
  echo
}

echo "collector-status: COMPLETE"
echo "coverage-note: mark Full only after typecheck, configuration-gap review, and manual classification"
echo

run_knip "Production mode" --production
run_knip "Comprehensive mode (production + tests/tooling)"
