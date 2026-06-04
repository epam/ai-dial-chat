#!/usr/bin/env python3
# Convert a stage-output.json envelope's `payload.findings[]` into a SARIF 2.1.0
# document for GitHub code scanning (Security tab). Keeps the triage skill clean
# — it emits findings[]; the platform produces SARIF here.
#
# Mapping:
#   severity -> SARIF level (critical/high=error, medium=warning, low/info=note)
#   file/line -> physicalLocation
#   jira_key -> partialFingerprints (stable dedup across daily runs)
#   verdict  -> message prefix + properties; triaged-away verdicts
#              (FALSE_POSITIVE / NOT_APPLICABLE / DUPLICATE) are emitted as
#              SARIF `suppressions` so they show as dismissed, leaving only
#              CONFIRMED / NEEDS_REVIEW as open alerts.
#
# Usage: findings-to-sarif.py <stage-output.json> <out.sarif>
import json, sys

SEV2LEVEL = {"critical": "error", "high": "error", "medium": "warning",
             "low": "note", "info": "note"}
OPEN_VERDICTS = {"CONFIRMED", "NEEDS_REVIEW"}


def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else "stage-output.json"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "triage.sarif"

    doc = json.load(open(src_path))
    findings = (doc.get("payload") or {}).get("findings") or []

    rules = {}
    results = []
    for f in findings:
        verdict = (f.get("verdict") or "").upper()
        sev = (f.get("severity") or "info").lower()
        level = SEV2LEVEL.get(sev, "note")
        # Rule grouping: prefer an explicit `rule`, else group all triage
        # findings under one rule. jira_key distinguishes individual alerts.
        rule_id = f.get("rule") or "snyk-sast-triage"
        rules.setdefault(rule_id, {
            "id": rule_id,
            "name": rule_id,
            "shortDescription": {"text": "Snyk SAST finding (AI-triaged)"},
        })

        msg = f"[{verdict or 'UNTRIAGED'}] {f.get('message', '')}".strip()
        result = {
            "ruleId": rule_id,
            "level": level,
            "message": {"text": msg},
            "properties": {
                "verdict": verdict,
                "jira_key": f.get("jira_key", ""),
                "original_severity": f.get("original_severity", ""),
            },
        }
        if f.get("file"):
            phys = {"artifactLocation": {"uri": f["file"]}}
            line = f.get("line")
            if isinstance(line, int) and line >= 1:
                phys["region"] = {"startLine": line}
            result["locations"] = [{"physicalLocation": phys}]
        if f.get("jira_key"):
            result["partialFingerprints"] = {"jiraKey": f["jira_key"]}
        # Dismiss triaged-away findings so only actionable ones alert.
        if verdict and verdict not in OPEN_VERDICTS:
            result["suppressions"] = [{
                "kind": "external",
                "justification": f"AI triage verdict: {verdict}",
            }]
        results.append(result)

    sarif = {
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {"driver": {
                "name": "DIAL Snyk Triage",
                "informationUri": "https://github.com/epam/ai-dial-chat",
                "rules": list(rules.values()),
            }},
            # Distinct analysis category so triage results coexist with any other
            # code-scanning tools instead of overwriting each other.
            "automationDetails": {"id": "snyk-triage/"},
            "results": results,
        }],
    }
    with open(out_path, "w") as fh:
        json.dump(sarif, fh, indent=2)
    print(f"Wrote {out_path}: {len(results)} result(s), "
          f"{sum(1 for r in results if 'suppressions' not in r)} open / "
          f"{sum(1 for r in results if 'suppressions' in r)} suppressed.")


if __name__ == "__main__":
    main()