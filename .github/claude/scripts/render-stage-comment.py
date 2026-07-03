#!/usr/bin/env python3
# Validate stage-output.json, inject envelope fields, render sticky PR comment.
# Stdlib only — no PyYAML, no jq dependency. The machine-readable form (with
# envelope) is written back to the file so the uploaded artifact contains the
# enriched payload; the human-readable form goes to GITHUB_OUTPUT for the
# sticky comment.
#
# Emits three GitHub Actions outputs:
#   - json:    compact JSON payload (for needs.X.outputs.message)
#   - status:  passed | passed_with_findings | failed
#   - comment: markdown sticky PR comment body
#
# Expects env:
#   STAGE_NAME           required
#   AGENT_VERSION        optional; defaults to "unknown"
#   STAGE_OUTPUT_FILE    optional; defaults to "stage-output.json"
#   GITHUB_*             auto-set by GHA
import json
import os
import sys
from pathlib import Path

CONTRACT_VERSION = "0.1"
ICON = {"passed": "✅", "passed_with_findings": "⚠️", "failed": "❌"}
MESSAGE_FIELDS = ("message", "title", "description", "details", "reason", "evidence")


def fail(msg):
    sys.stderr.write(f"::error::{msg}\n")
    sys.exit(1)


def deep_merge(base, override):
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def finding_message(finding):
    parts = []
    for field in MESSAGE_FIELDS:
        value = finding.get(field)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    suggested_fix = finding.get("suggested_fix")
    if isinstance(suggested_fix, str) and suggested_fix.strip():
        parts.append(f"Suggested fix: {suggested_fix.strip()}")
    if parts:
        return " ".join(parts)
    return "No finding message provided by agent."


def build_findings_block(findings, run_url):
    sticky_findings = [
        f for f in findings
        if not ((f.get("inline_comment") or {}).get("posted") is True)
    ]
    inline_count = len(findings) - len(sticky_findings)

    if not sticky_findings:
        if inline_count:
            return ["", f"_{inline_count} finding(s) posted as inline review comments._"]
        return []

    lines = ["", "| Severity | Location | Message |", "|---|---|---|"]
    for f in sticky_findings[:10]:
        sev = f.get("severity", "info")
        file_path = f.get("file", "—")
        line_num = f.get("line")
        loc = f"`{file_path}{':' + str(line_num) if line_num else ''}`"
        req = f.get("requirement_ref")
        if req:
            loc += f" ({req})"
        msg = finding_message(f).replace("|", "\\|").replace("\n", " ")
        lines.append(f"| `{sev}` | {loc} | {msg} |")
    overflow = len(sticky_findings) - 10
    if overflow > 0:
        lines.append("")
        lines.append(f"_… and {overflow} more — full output in the [run artifact]({run_url})._")
    if inline_count:
        lines.append("")
        lines.append(f"_{inline_count} finding(s) posted as inline review comments._")
    return lines


def main():
    output_file = Path(os.environ.get("STAGE_OUTPUT_FILE", "stage-output.json"))
    stage_name = os.environ.get("STAGE_NAME")
    if not stage_name:
        fail("STAGE_NAME env is required")
    agent_version = os.environ.get("AGENT_VERSION", "unknown")

    if not output_file.exists():
        fail(f"Stage did not produce {output_file}. The prompt must instruct Claude to write this file at the repo root.")

    try:
        payload = json.loads(output_file.read_text())
    except json.JSONDecodeError as e:
        # Dump what the agent actually wrote so we can see WHERE the escaping
        # went wrong. JSON parse errors give char offsets that are hard to
        # interpret without seeing the source text. 1500 chars is enough to
        # cover the offset of typical failures while staying readable in
        # the GHA log.
        raw = output_file.read_text()
        sys.stderr.write("::group::stage-output.json (first 1500 chars)\n")
        sys.stderr.write(raw[:1500])
        if len(raw) > 1500:
            sys.stderr.write(f"\n... [truncated; total {len(raw)} bytes]")
        sys.stderr.write("\n::endgroup::\n")
        fail(f"{output_file} is not valid JSON: {e}. File contents logged above.")

    envelope = {
        "contract_version": CONTRACT_VERSION,
        "agent_version": agent_version,
        "run_id": os.environ.get("GITHUB_RUN_ID", ""),
        "trigger": {
            "event": os.environ.get("GITHUB_EVENT_NAME", ""),
            "ref": os.environ.get("GITHUB_REF", ""),
            "sha": os.environ.get("GITHUB_SHA", ""),
        },
    }
    payload = deep_merge(payload, envelope)
    output_file.write_text(json.dumps(payload, indent=2))

    for field in ("contract_version", "stage", "status", "summary"):
        if field not in payload:
            fail(f"{output_file} missing required field: {field}")

    if payload["contract_version"] != CONTRACT_VERSION:
        fail(f"contract_version mismatch: platform={CONTRACT_VERSION} but payload={payload['contract_version']}")

    if payload["stage"] != stage_name:
        fail(f"stage field mismatch: workflow stage_name={stage_name} but JSON .stage={payload['stage']}")

    status = payload["status"]
    if status not in ICON:
        fail(f"Invalid status: {status} (expected passed | passed_with_findings | failed)")

    summary = payload["summary"]
    agent_payload = payload.get("payload") or {}
    findings = agent_payload.get("findings") or []
    override_md = agent_payload.get("comment_markdown")
    cost = payload.get("cost_usd")
    run_url = (
        f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}"
        f"/{os.environ.get('GITHUB_REPOSITORY')}"
        f"/actions/runs/{os.environ.get('GITHUB_RUN_ID')}"
    )

    parts = [f"<!-- dial-sdlc:{stage_name} -->", f"{ICON[status]} **{stage_name}**: {summary}"]
    # Body precedence: explicit comment_markdown wins; otherwise render findings
    # table when present; otherwise leave the summary line alone.
    if override_md:
        parts.append("")
        parts.append(override_md)
    else:
        parts.extend(build_findings_block(findings, run_url))
    parts.append("")
    footer = f"[Run details]({run_url})"
    if cost is not None:
        footer += f" · `${cost}`"
    parts.append(footer)

    comment = "\n".join(parts)
    compact_json = json.dumps(payload, separators=(",", ":"))

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a") as out:
            out.write(f"json={compact_json}\n")
            out.write(f"status={status}\n")
            out.write("comment<<COMMENT_EOF\n")
            out.write(comment)
            out.write("\nCOMMENT_EOF\n")

    # NOTE: a well-formed status=failed is NOT an error here — this renderer must
    # exit 0 so the downstream steps (scrub, job summary, PR comment) still run
    # and the blocking findings reach the PR. The job is failed by a dedicated
    # gate step AFTER the comment is posted (see run-claude-stage/action.yml).
    # Only genuine render errors above (bad JSON, missing/invalid fields) exit 1.


if __name__ == "__main__":
    main()
