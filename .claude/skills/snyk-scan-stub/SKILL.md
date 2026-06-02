---
name: snyk-scan-stub
description: Synthetic scanner-report producer for SDLC chain validation. Emits a fixed set of Snyk-Code-shaped findings under payload.findings so a downstream triage agent has deterministic input. NOT a real scanner — replace with stage-snyk.yml when the real Snyk pipeline lands.
---

# Synthetic Snyk-Scan Stub (chain-validation fixture)

This is a **test fixture**, not a real scanner. Its only job is to emit a
deterministic, scanner-shaped report so the `snyk-triage` agent has something
to consume — exercising the `needs:` → `gh run download` →
`upstream/<name>/stage-output.json` chain end-to-end.

Do **not** read the diff, scan the repo, or invent new findings. Ignore the
working tree. Emit exactly the two findings below, verbatim.

## Output

Set:

- `status`: `"passed_with_findings"`
- `summary`: `"Synthetic scanner stub: 2 findings emitted for triage-chain validation."`
- `payload.scanner`: `"snyk-code-stub"`
- `payload.report_format`: `"normalized-json/v0"`
- `payload.findings`: the array below, copied exactly.

```json
[
  {
    "rule_id": "javascript/OpenRedirect",
    "title": "Unvalidated redirect from user-controlled callbackUrl",
    "severity": "high",
    "file": "apps/chat-api/src/auth/auth.controller.ts",
    "line": 315,
    "message": "The `callbackUrl` query parameter flows into res.redirect() in the OIDC callback handler. An attacker can supply an arbitrary URL to redirect victims to a phishing site (open redirect).",
    "cwe": "CWE-601"
  },
  {
    "rule_id": "javascript/CodeInjection",
    "title": "Dynamic eval of request-derived expression",
    "severity": "critical",
    "file": "apps/chat-api/src/legacy/unsafe-eval.ts",
    "line": 42,
    "message": "User-controlled input is passed to eval(), allowing arbitrary code execution.",
    "cwe": "CWE-94"
  }
]
```

These are intentionally checkable against the repo:

- Finding 1 points at a **real** file whose redirect targets are
  allowlist-validated (`resolveCallbackUrl` + `isOriginAllowed`), so a correct
  triage verdict is **FALSE_POSITIVE** with that mitigation as evidence.
- Finding 2 points at a **non-existent** file, so a correct triage verdict is
  **NOT_APPLICABLE** (sink not present in the repo).

The point of the fixture is the chain plumbing; the verdicts above are the
secondary signal that triage actually read this report.