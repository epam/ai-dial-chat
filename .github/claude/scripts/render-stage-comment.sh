#!/usr/bin/env bash
# Validate the stage-output.json a Claude stage produced and render a
# human-readable sticky PR comment from it. The machine-readable form
# lives in the workflow artifact uploaded alongside; the comment links
# to the run page where the artifact is available.
#
# Emits three GitHub Actions outputs:
#   - json:    compact JSON payload (for needs.X.outputs.message)
#   - status:  passed | passed_with_findings | failed
#   - comment: markdown sticky PR comment body (header + findings table + link)
#
# Expects env:
#   STAGE_NAME           required
#   AGENT_VERSION        optional; defaults to "unknown"
#   GITHUB_REPOSITORY    auto-set by GHA
#   GITHUB_RUN_ID        auto-set by GHA
#   GITHUB_SERVER_URL    auto-set by GHA
#   GITHUB_EVENT_NAME    auto-set by GHA
#   GITHUB_REF           auto-set by GHA
#   GITHUB_SHA           auto-set by GHA
set -euo pipefail

CONTRACT_VERSION="0.1"
OUTPUT_FILE="${STAGE_OUTPUT_FILE:-stage-output.json}"

if [ -z "${STAGE_NAME:-}" ]; then
  echo "::error::STAGE_NAME env is required"
  exit 1
fi

if [ ! -f "$OUTPUT_FILE" ]; then
  echo "::error::Stage did not produce $OUTPUT_FILE. The prompt must instruct Claude to write this file at the repo root."
  exit 1
fi

if ! jq empty "$OUTPUT_FILE" 2>/dev/null; then
  echo "::error::$OUTPUT_FILE is not valid JSON"
  exit 1
fi

# Inject envelope fields (contract_version, agent_version, run_id, trigger.*) into
# the stage's output. The platform owns these values; if the stage wrote any of
# them, the envelope overrides — runtime is authoritative.
ENVELOPE="$(jq -n \
  --arg cv "$CONTRACT_VERSION" \
  --arg av "${AGENT_VERSION:-unknown}" \
  --arg rid "${GITHUB_RUN_ID:-}" \
  --arg ev "${GITHUB_EVENT_NAME:-}" \
  --arg ref "${GITHUB_REF:-}" \
  --arg sha "${GITHUB_SHA:-}" \
  '{
    contract_version: $cv,
    agent_version: $av,
    run_id: $rid,
    trigger: { event: $ev, ref: $ref, sha: $sha }
  }')"

jq --argjson env "$ENVELOPE" '. * $env' "$OUTPUT_FILE" > "${OUTPUT_FILE}.tmp"
mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"

for field in contract_version stage status summary; do
  if [ "$(jq -r --arg f "$field" 'has($f)' "$OUTPUT_FILE")" != "true" ]; then
    echo "::error::$OUTPUT_FILE missing required field: $field"
    exit 1
  fi
done

REPORTED_CONTRACT="$(jq -r '.contract_version' "$OUTPUT_FILE")"
if [ "$REPORTED_CONTRACT" != "$CONTRACT_VERSION" ]; then
  echo "::error::contract_version mismatch: platform=$CONTRACT_VERSION but payload=$REPORTED_CONTRACT"
  exit 1
fi

REPORTED_STAGE="$(jq -r '.stage' "$OUTPUT_FILE")"
if [ "$REPORTED_STAGE" != "$STAGE_NAME" ]; then
  echo "::error::stage field mismatch: workflow stage_name=$STAGE_NAME but JSON .stage=$REPORTED_STAGE"
  exit 1
fi

STATUS="$(jq -r '.status' "$OUTPUT_FILE")"
case "$STATUS" in
  passed|passed_with_findings|failed) ;;
  *) echo "::error::Invalid status: $STATUS (expected passed | passed_with_findings | failed)"; exit 1 ;;
esac

SUMMARY="$(jq -r '.summary' "$OUTPUT_FILE")"
JSON_COMPACT="$(jq -c . "$OUTPUT_FILE")"
FINDINGS_COUNT="$(jq '.findings // [] | length' "$OUTPUT_FILE")"
COST="$(jq -r '.cost_usd // empty' "$OUTPUT_FILE")"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"

case "$STATUS" in
  passed)               ICON="✅" ;;
  passed_with_findings) ICON="⚠️"  ;;
  failed)               ICON="❌" ;;
esac

FINDINGS_BLOCK=""
if [ "$FINDINGS_COUNT" -gt 0 ]; then
  TABLE_ROWS="$(jq -r '
    (.findings // [])[0:10]
    | map(
        "| `\(.severity)` | "
        + "`\(.file // "—")\(if .line then ":" + (.line | tostring) else "" end)`"
        + (if .requirement_ref then " (\(.requirement_ref))" else "" end)
        + " | \(.message | gsub("\\|"; "\\\\|") | gsub("\n"; " ")) |"
      )
    | join("\n")
  ' "$OUTPUT_FILE")"

  FINDINGS_BLOCK="| Severity | Location | Message |
|---|---|---|
${TABLE_ROWS}"

  if [ "$FINDINGS_COUNT" -gt 10 ]; then
    OVERFLOW=$((FINDINGS_COUNT - 10))
    FINDINGS_BLOCK="${FINDINGS_BLOCK}

_… and ${OVERFLOW} more — full output in the [run artifact](${RUN_URL})._"
  fi
fi

FOOTER="[Run details](${RUN_URL})"
if [ -n "$COST" ]; then
  FOOTER="${FOOTER} · \`\$${COST}\`"
fi

{
  echo "json=$JSON_COMPACT"
  echo "status=$STATUS"
  echo "comment<<COMMENT_EOF"
  echo "<!-- dial-sdlc:${STAGE_NAME} -->"
  echo "${ICON} **${STAGE_NAME}**: ${SUMMARY}"
  if [ -n "$FINDINGS_BLOCK" ]; then
    echo ""
    echo "$FINDINGS_BLOCK"
  fi
  echo ""
  echo "$FOOTER"
  echo "COMMENT_EOF"
} >> "$GITHUB_OUTPUT"

if [ "$STATUS" = "failed" ]; then
  echo "::error::Stage ${STAGE_NAME} reported status=failed: ${SUMMARY}"
  exit 1
fi