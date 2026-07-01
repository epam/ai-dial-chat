---
name: dep-triage
description: Reviews dependency-scan findings against repo source to mark each as confirmed (real risk) or false_positive (not exploitable in this codebase context). Use after /dep-scan emits CVE findings; reduces reviewer noise before human review.
---

# Dependency Triage

## Overview

Reads upstream scan findings, evaluates each in the repo's actual usage
context, and emits the same findings augmented with `triage_outcome`
(`confirmed` | `false_positive`) and a one-sentence `triage_reason`.

This is the **triage step** — does not run scanners itself. Always
downstream of `/dep-scan` (or another scan agent emitting the same
finding shape: `cve`, `package`, `installed_version`, `fixed_version`).

## When to use

- After `/dep-scan` in a chained agent (`needs: [scan-deps]`).
- Whenever raw scanner output needs filtering before human review.
- Periodically (e.g., scheduled re-triage to update prior-run outcomes
  as the codebase evolves).

## Required tools

- `Read`, `Grep`, `Glob` — to inspect repo source for package usage
- `Bash(git diff:*)` — to scope which dependencies the PR touched
- `Skill` — invocation only
- `Write` — auto-granted; for `stage-output.json`

## Inputs

- `upstream/scan-deps/stage-output.json` — scan findings from the
  upstream `scan-deps` agent (or compatible scanner)

## Triage rubric

For each finding under `payload.findings[]`:

### Confirmed (`triage_outcome: confirmed`)

Mark confirmed if **all three** hold:

1. The package is imported by repo source under `apps/`, `libs/`, or
   `packages/`.
2. The vulnerable code path is plausibly reachable from a request,
   user input, or build output.
3. The package is NOT exclusively a dev-time dependency.

### False positive (`triage_outcome: false_positive`)

Mark FP if **any one** of these holds:

1. **Not a runtime dep.** Listed only under `devDependencies` /
   `peerDependencies` and not exposed at build/runtime (test fixtures,
   type generators, bundler internals).
2. **Vulnerable function unused.** The specific CVE-affected
   function/API is not called anywhere in `apps/`, `libs/`, or
   `packages/`.
3. **Network/host context excludes risk.** E.g., DoS vuln on internal
   service the project doesn't expose; SSRF on URL the project never
   constructs; XSS in a sanitizer the project doesn't reach.
4. **Already mitigated transitively.** Repo's package overrides /
   resolutions pin a safe version.
5. **Out-of-scope target.** Scanner flagged a vendored binary,
   build artifact, or test fixture not part of the deployed
   application.

### Conservative tie-break

If you can't establish FP via one of the rules above, mark
`confirmed`. Better one extra reviewer click than missing a real CVE.
Capture uncertainty in `triage_reason` so the reviewer can re-evaluate
quickly.

## Process

1. **Read upstream output.** `upstream/scan-deps/stage-output.json` —
   parse `payload.findings[]`.

2. **For each finding**, follow the rubric:
   - Use `Grep` to find imports of `package` in `apps/`, `libs/`,
     `packages/`.
   - If imports exist, `Read` the importing files to check whether the
     vulnerable API is actually used.
   - Inspect `package.json` files to determine `dependencies` vs
     `devDependencies` (path matters — root `package.json` vs
     workspace `package.json`s differ in semantics).
   - Consider transitive resolutions: check `pnpm-lock.yaml` /
     `package-lock.json` for pinned-safe versions.

3. **Augment each finding** with two new fields:
   - `triage_outcome`: `"confirmed"` or `"false_positive"`
   - `triage_reason`: one short sentence explaining the call. Reference
     the rule number (1-5) for FPs.

4. **Recompute summary.** Update the top-level `summary` field to
   reflect post-triage counts:
   `"trivy: <N> raw → <C> confirmed, <F> false_positive"`.

## Output

Same top-level shape as the upstream scan, with two augmentations:

```
{
  "stage": "triage-deps",
  "status": "<see below>",
  "summary": "trivy: <N> raw → <C> confirmed, <F> false positive",
  "payload": {
    "findings": [
      {
        "severity": "high",
        "file": "package-lock.json",
        "message": "<CVE>: ... (unchanged from scan)",
        "suggested_fix": "...",
        "cve": "...",
        "package": "lodash",
        "installed_version": "4.17.20",
        "fixed_version": "4.17.21",
        "triage_outcome": "confirmed",
        "triage_reason": "Imported by libs/foo and the vulnerable .pickBy() is called in src/utils/groupBy.ts."
      },
      {
        "severity": "high",
        "file": "package-lock.json",
        "message": "<CVE>: ...",
        ...,
        "triage_outcome": "false_positive",
        "triage_reason": "FP rule 2: vulnerable .template() function is not called anywhere under apps/ or libs/."
      }
    ],
    "triage_summary": {
      "raw": <N>,
      "confirmed": <C>,
      "false_positive": <F>
    }
  }
}
```

### Status

- `passed` — all findings false_positive (no confirmed real risks)
- `passed_with_findings` — confirmed findings exist but only at
  `info`/`low`/`medium` severity
- `failed` — any confirmed finding at `high` or `critical` severity

### Severity discipline

**Do not downgrade severity.** A confirmed-but-low-likelihood finding
keeps its original severity (high/critical); the human reviewer
decides whether to accept the risk. Triage filters the noise; it does
not soften the signal.

## Heuristics

- **Grep first, read second.** Don't blindly Read every file in
  `libs/`. A focused `Grep` for `from '<package>'` or
  `require('<package>')` scopes the work.
- **Multiple CVEs per package are independent.** Same package can have
  one confirmed CVE (vulnerable function called) and one FP CVE
  (different function unused). Evaluate each on its own.
- **Capture audit context in `triage_reason`.** A future scheduled
  re-triage can diff outcomes only if the reasoning is preserved.
- **Don't fabricate file paths.** If you can't find an import of the
  affected package in the repo, that's FP rule 1 (not a runtime dep)
  or rule 5 (out-of-scope target). Mark it accordingly, don't invent
  evidence.

## Output preservation vs sticky-comment filtering

Emit **all** findings (confirmed and FP) under `payload.findings[]` for
the artifact — the artifact is the audit trail. The renderer (which
posts the sticky PR comment) can filter to confirmed-only for the
human view; the artifact retains the full record.
