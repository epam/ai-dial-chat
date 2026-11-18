#!/usr/bin/env bash
# Collect dead-code candidates for the refactoring audit.
# This script never fixes or deletes code.
#
# Runs Knip in production and comprehensive mode with the repository config
# (knip.ts) and the root-manifest preprocessor. Each mode runs even when the
# other fails. Knip exits 0 (no findings) or 1 (findings) on success; any
# other exit code, or a JSON report the summarizer cannot parse, is a tool
# failure and keeps coverage PARTIAL.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KNIP_BIN="${REFACTORING_AUDIT_KNIP_BIN:-$ROOT/node_modules/.bin/knip}"
KNIP_CONFIG="$ROOT/knip.ts"
PREPROCESSOR="$ROOT/tools/knip/drop-root-manifest-repeats.mjs"
SUMMARIZER="$SCRIPT_DIR/summarize-knip.mjs"
REPORT_DIR="${REFACTORING_AUDIT_REPORT_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/dead-code-audit.XXXXXX")}"

cd "$ROOT"

echo "=== DEAD-CODE AUDIT ==="
echo "date: $(date -u +%Y-%m-%d)"
echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
echo

for required in "$KNIP_CONFIG" "$PREPROCESSOR" "$SUMMARIZER"; do
  if [ ! -f "$required" ]; then
    echo "collector-status: FAILED"
    echo "coverage: PARTIAL"
    echo "reason: required file is missing at $required"
    exit 1
  fi
done

if [ ! -x "$KNIP_BIN" ]; then
  echo "collector-status: UNAVAILABLE"
  echo "coverage: PARTIAL"
  echo "reason: local Knip binary is unavailable at $KNIP_BIN (run npm install)"
  echo "action: run Nx typecheck and project-graph checks"
  exit 0
fi

mkdir -p "$REPORT_DIR"
echo "knip-version: $("$KNIP_BIN" --version)"
echo "raw-reports: $REPORT_DIR"
echo

failed_modes=()

run_knip() {
  local mode="$1"
  shift
  local json_report="$REPORT_DIR/knip-$mode.json"
  local text_report="$REPORT_DIR/knip-$mode.txt"

  echo "## Knip $mode mode"
  echo

  # The JSON reporter carries findings only; configuration hints and load
  # errors come from the text reporter, written alongside it.
  rm -f "$json_report"
  "$KNIP_BIN" \
    --directory "$ROOT" \
    --config "$KNIP_CONFIG" \
    --preprocessor "$PREPROCESSOR" \
    --no-progress \
    --reporter symbols \
    --reporter json \
    --output-file "json=$json_report" \
    "$@" \
    >"$text_report" 2>&1
  local knip_status=$?

  echo "knip-exit: $knip_status"
  if grep -q '^ERROR:' "$text_report"; then
    echo "load-errors:"
    grep '^ERROR:' "$text_report" | sed 's/^/  /'
  fi
  if grep -q '^Configuration hints' "$text_report"; then
    sed -n '/^Configuration hints/,$p' "$text_report"
  else
    echo "Configuration hints (0)"
  fi

  local summary_status=1
  if [ -f "$json_report" ]; then
    node "$SUMMARIZER" <"$json_report"
    summary_status=$?
  else
    echo "summary-status: FAILED (no JSON report written)"
  fi

  if [ "$knip_status" -gt 1 ] || [ "$summary_status" -ne 0 ]; then
    echo "mode-status: FAILED"
    failed_modes+=("$mode")
  else
    echo "mode-status: COMPLETE"
  fi
  echo
}

run_knip production --production
run_knip comprehensive

if [ "${#failed_modes[@]}" -eq 0 ]; then
  echo "collector-status: COMPLETE"
  echo "coverage-note: mark Full only after typecheck, configuration-hint and unresolved-import review, and manual classification"
else
  echo "collector-status: FAILED (${failed_modes[*]})"
  echo "coverage: PARTIAL"
  exit 1
fi
