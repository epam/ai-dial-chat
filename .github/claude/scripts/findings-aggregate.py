#!/usr/bin/env python3
# Render a COUNTS-ONLY markdown report from a stage-output.json envelope, safe to
# post on a PUBLIC repo (PR sticky comment / job summary) for `private_output`
# (sensitive) agents. It emits ONLY aggregate numbers — never file paths, code,
# messages, Jira descriptions, or any per-finding detail.
#
# Usage: findings-aggregate.py <stage-output.json>   (prints markdown to stdout)
import json, sys
from collections import Counter

VERDICT_ORDER = ["CONFIRMED", "NEEDS_REVIEW", "DUPLICATE",
                 "NOT_APPLICABLE", "FALSE_POSITIVE"]
SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]


def table(title, rows):
    out = [f"| {title} | Count |", "|---|---:|"]
    out += [f"| {k} | {v} |" for k, v in rows if v]
    return "\n".join(out) if len(out) > 2 else ""


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "stage-output.json"
    doc = json.load(open(path))
    stage = doc.get("stage", "stage")
    status = doc.get("status", "")
    payload = doc.get("payload") or {}

    # IMPORTANT: never echo the agent-authored `summary` (or any free text) on
    # this PUBLIC surface — agents put per-finding specifics (vuln class, code
    # symbols, mechanisms) there. This report is machine-generated from the
    # structured counts only; the free-text summary stays in the (encrypted)
    # artifact.
    lines = [f"## {stage}", "", f"**Status:** `{status}`", ""]

    findings = payload.get("findings") or []
    if findings:
        v = Counter((f.get("verdict") or "UNKNOWN").upper() for f in findings)
        s = Counter((f.get("severity") or "unknown").lower() for f in findings)
        lines += [f"**Findings triaged:** {len(findings)}", ""]
        vt = table("Verdict", [(k, v.get(k, 0)) for k in VERDICT_ORDER]
                   + [(k, c) for k, c in v.items() if k not in VERDICT_ORDER])
        if vt:
            lines += [vt, ""]
        st = table("Adjusted severity", [(k, s.get(k, 0)) for k in SEVERITY_ORDER]
                   + [(k, c) for k, c in s.items() if k not in SEVERITY_ORDER])
        if st:
            lines += [st, ""]

    # Producer (ingest) counts, if present — all numbers, no detail.
    jira = payload.get("jira") or {}
    counts = [(k, jira.get(k)) for k in
              ("fetched_count", "matched_count", "dropped_count", "analyzed_count")
              if isinstance(jira.get(k), int)]
    if counts:
        lines += [table("Ingest", counts), ""]

    lines += ["_Details withheld: this repo is public; per-finding data is internal "
              "and is not published here._"]
    print("\n".join(lines))


if __name__ == "__main__":
    main()