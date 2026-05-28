---
name: dep-scan
description: Runs Trivy filesystem scan against the repo root and emits structured vulnerability findings (CVE, package, versions) in the SDLC reviewer schema. Use when an agent needs to detect known CVEs in project dependencies for downstream triage or human review.
---

# Dependency Scan (Trivy)

## Overview

Filesystem scan for known CVEs. Trivy autodetects lockfiles
(`package-lock.json`, `pnpm-lock.yaml`, etc.) and produces a JSON
report; this skill parses that report and emits findings in the SDLC
reviewer shape so downstream agents (e.g., `/dep-triage`) and human
reviewers can consume them uniformly.

This is the **scan step only** — no triage, no false-positive analysis.
That happens downstream.

## When to use

- PR-time dependency check (chained before `/dep-triage`).
- Scheduled dependency scans (nightly, weekly).
- Any flow needing machine-readable vulnerability output that another
  agent or process will consume.

## Required tools

- `Bash(trivy:*)` — to invoke the CLI
- `Write` — to produce `stage-output.json` (auto-granted by the platform)
- `Read`, `Glob` — to inspect lockfiles or scan output if needed

## Process

### 1. Run Trivy

Filesystem scan from repo root, JSON output, medium severity and above.
**Use Trivy's `--output` flag, not shell redirection (`>`)** — Claude
Code's Bash tool rejects shell-redirection operators and would deny the
command:

```bash
trivy fs --format json --severity HIGH,CRITICAL,MEDIUM --quiet --output /tmp/trivy.json .
```

Same effect: writes report to `/tmp/trivy.json`. No `>`, no `|`, no
shell-variable expansion — exactly what `Bash(trivy:*)` allows.

Notes:

- `--quiet` suppresses interactive UI noise.
- If `/tmp/trivy.json` is missing or zero-length after the command,
  treat it as a scanner failure (see *Heuristics*).

### 2. Parse the report

**Use the `Read` tool** to load `/tmp/trivy.json` into your reasoning
context. **Do NOT** attempt to use `cat`, `head`, `tail`, `jq`, `grep`,
`awk`, or any other shell command to inspect the file — those aren't
in the agent's `allowed_tools` (only `Bash(trivy:*)` is) and the Bash
tool will deny them, burning turns on retries. The Read tool is the
intended path for inspecting on-disk JSON.

The file is on the order of tens-to-hundreds of KB; one Read call
loads it cleanly.

Trivy's structure:

```
{
  "Results": [
    {
      "Target": "package-lock.json",
      "Type": "npm",
      "Vulnerabilities": [
        {
          "VulnerabilityID": "CVE-...",
          "PkgName": "lodash",
          "InstalledVersion": "4.17.20",
          "FixedVersion": "4.17.21",
          "Severity": "HIGH",
          "Title": "..."
        }
      ]
    }
  ]
}
```

A `Result` may have no `Vulnerabilities` array if the target is clean
— skip it.

### 3. Map each vulnerability to a finding

Lowercase severity; carry through CVE, package, versions:

```
{
  "severity": "high",
  "file": "package-lock.json",
  "message": "<CVE>: <Title>. Affected: <pkg>@<version>. Fixed in <fixed>.",
  "suggested_fix": "Upgrade <pkg> to >=<fixed>.",
  "cve": "<CVE>",
  "package": "<pkg>",
  "installed_version": "<installed>",
  "fixed_version": "<fixed>",
  "target_type": "<npm|gomod|...>"
}
```

The `cve`, `package`, `installed_version`, `fixed_version`, and
`target_type` fields are the contract for `/dep-triage` — don't omit
them.

### 4. Set status

- `passed` — no findings at MEDIUM+
- `passed_with_findings` — findings exist but all are MEDIUM (no HIGH/CRITICAL)
- `failed` — any HIGH or CRITICAL finding

### 5. Write `stage-output.json`

Use the **Write tool** to save at the repo root. Include
`payload.scan_summary` so downstream consumers don't have to recount:

```
{
  "stage": "scan-deps",
  "status": "<above>",
  "summary": "Trivy fs: <N> findings (<H> high, <M> medium).",
  "payload": {
    "scan_summary": {
      "total": <N>,
      "by_severity": { "critical": <c>, "high": <h>, "medium": <m> },
      "scanner": "trivy fs"
    },
    "findings": [ ... ]
  }
}
```

## Heuristics

- **Scanner failure → high-severity finding.** If `trivy` exits
  non-zero or `/tmp/trivy.json` is empty/malformed, emit one
  high-severity finding with `file: null` and `message` quoting the
  stderr verbatim, then set `status: failed`. Don't silently produce
  empty findings.
- **Truncate verbose descriptions.** Trivy's `Description` field can
  be very long; keep it brief in the `message` field or move detail to
  `cve` lookups elsewhere.
- **Don't filter by reachability here.** That's `/dep-triage`'s job.
  Emit every CVE Trivy finds at the configured severity threshold.

## Output for downstream

The exact shape above is the contract for `/dep-triage`. The triage
skill keys off `cve`, `package`, and `installed_version` to look up
usage in the repo. Omit those fields and triage degrades to "every
finding marked confirmed."