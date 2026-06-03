---
name: snyk-jira-ingest
description: Pull REAL Snyk SAST findings from EPAM Jira (Data Center) via the search-export API using a Personal Access Token, and emit them as a stage-output.json artifact for a downstream triage stage. Use when you want the actual Jira-tracked Snyk findings (the same set a human gets by clicking Export on the security filter) rather than a synthetic fixture.
---

# Snyk → Jira Ingest (real findings, REST + PAT)

This skill pulls the **real** Snyk SAST findings already tracked in EPAM Jira —
the same set a human gets by opening the security filter and clicking
**Export → XML**. It writes the SDLC stage envelope to `stage-output.json` and the
raw export to `jira-export.xml` at the repo root. What consumes the artifact next
is the orchestrator's concern, not this skill's.

All the work is done by a committed helper script:
**`.claude/skills/snyk-jira-ingest/fetch.sh`**. The script fetches the export,
**filters the issues down to this repository**, and writes a schema-valid
`stage-output.json`. Your job as the agent is only to run it and confirm the
file exists.

## Repo filtering (important)

The Jira filter spans **all DIAL repositories** and the tickets carry no per-repo
label. The only per-repo signal is the **repo-prefixed file path** in each
issue's `Location:` section (e.g. `ai-dial-chat/apps/chat/src/...`). The script
keeps an issue **only if** its body references a `<REPO_NAME>/...` path, drops the
rest as cross-repo, and **normalizes** the kept paths to repo-relative (strips the
`<REPO_NAME>/` prefix) under `issue.files[]` so triage's file lookups work
directly. This happens before triage, so the expensive triage agent never spends
turns on other repos' findings.

The match is **positive-only and boundary-anchored**: `ai-dial-chat/` matches but
`ai-dial-chat-themes/` does not. An issue with no parseable `<REPO_NAME>/` path
(including issues with no Location section) is treated as out-of-repo and dropped.
Every dropped key is logged and counted; the counts surface in the sticky comment
summary and under `payload.jira` / `payload.dropped` for audit.

After repo filtering, an optional cap (`JIRA_MAX_FINDINGS`, default `0` = no cap)
limits how many matched findings are handed to triage. Set it to `N` to keep only
the top-`N` highest-priority findings (the JQL is priority-ordered) when triage's
turn budget is tight; the rest are recorded under `payload.deferred` (keys only) so
nothing is lost. Default `0` analyzes all matched findings.

---

## Why a script (and why REST + PAT, not the Atlassian MCP)

- **PAT, not MCP:** the wired Atlassian MCP (`mcp.atlassian.com`) is the **Cloud**
  server and cannot reach a self-hosted **Data Center** instance like
  `jiraeu.epam.com`. So we call the Jira DC search-export API directly with
  `Authorization: Bearer <PAT>`.
- **Script, not inline curl:** the secret must never be typed into a Bash tool
  call (the agent-wrapper rejects shell variable expansion, pipes, and
  redirections). `fetch.sh` reads `JIRA_PAT` from the environment internally, so
  the token is never seen or typed by the model. You invoke the script by its
  literal path — nothing else.

---

## Inputs (environment variables, read by `fetch.sh`)

| Var | Required | Default | Notes |
|---|---|---|---|
| `JIRA_PAT` | **yes** | — | Jira Data Center Personal Access Token. Injected by the platform from the manifest's declared `secrets:`. |
| `JIRA_BASE_URL` | no | `https://jiraeu.epam.com` | No trailing slash needed. |
| `JIRA_JQL` | no | see below | Full JQL. Overrides the `JIRA_FILTER_ID` default if set. |
| `JIRA_FILTER_ID` | no | `189402` | Used only to build the default JQL. |
| `JIRA_MAX` | no | `1000` | `tempMax` cap on exported issues. |
| `JIRA_REPO_NAME` | no | `$GITHUB_REPOSITORY` name, else cwd basename | Repo to keep issues for; matched against the `<name>/...` Location path prefix. |
| `JIRA_MAX_FINDINGS` | no | `0` | Optional cap on repo-matched findings handed to triage (`0` = no cap; `N` keeps the top-N priority findings, rest deferred). Use to keep triage within its turn budget. |

**Default JQL** (matches the security filter the human exports):

```
filter = 189402 AND status not in (Closed, "Security Review") ORDER BY priority
```

---

## Procedure

1. **Run the fetch script** with a single Bash tool call — exactly:

   ```
   bash .claude/skills/snyk-jira-ingest/fetch.sh
   ```

   Do not add flags, pipes, redirections, or environment assignments — the
   script reads everything it needs from the environment. This is the only
   command in your Bash allowlist.

2. **Confirm the output.** Read `stage-output.json` (Read tool) to confirm the
   script wrote it. The script produces a schema-valid envelope for you:
   - `status: "passed_with_findings"` when ≥1 issue matched this repo (`matched_count > 0`),
   - `status: "passed"` when none matched (0 fetched, or all were cross-repo),
   - `status: "failed"` when the PAT is missing or the export did not return 200.

3. **Do not overwrite it.** The script already wrote the correct
   `stage-output.json`; do **not** Write your own envelope over it. Just finish.

4. **If the script command is denied or errors before writing the file**, then —
   and only then — use the Write tool to create `stage-output.json` yourself with
   `status: "failed"` and a `summary` naming what went wrong. Never fabricate
   findings or a synthetic export.

---

## Output contract (written by `fetch.sh`)

```json
{
  "stage": "snyk-jira-ingest",
  "status": "passed_with_findings",
  "summary": "Pulled <N> Snyk SAST finding(s) from Jira filter 189402 for downstream triage.",
  "payload": {
    "scanner": "snyk-code",
    "source": "jira",
    "report_format": "jira-searchrequest-xml",
    "report_location": "jira-export.xml",
    "jira": {
      "base_url": "https://jiraeu.epam.com",
      "filter_id": 189402,
      "jql": "filter = 189402 AND status not in (Closed, \"Security Review\") ORDER BY priority",
      "repo_name": "ai-dial-chat",
      "fetched_count": 73,
      "matched_count": 34,
      "dropped_count": 39,
      "analyzed_count": 34,
      "max_findings": 0
    },
    "issues": [
      {
        "key": "EPMDIAL-1020",
        "title": "[SAST] Python/HardcodedNonCryptoSecret in file utils.py",
        "link": "https://jiraeu.epam.com/browse/EPMDIAL-1020",
        "summary": "...",
        "priority": "Major",
        "status": "Open",
        "resolution": "Unresolved",
        "labels": ["CWE-547", "SAST", "SnykSAST"],
        "created": "...",
        "updated": "...",
        "description": "<raw HTML description with file/line>",
        "environment": "Issue Hash: 85b438d367bb58e6f53e26e95f74e2d2cb82ae1801...",
        "files": ["apps/chat/src/utils/server/api-slug-handler.ts"]
      }
    ],
    "deferred": [],
    "dropped": ["EPMDIAL-2222", "EPMDIAL-3333"]
  }
}
```

The kept findings are **inlined** under `payload.issues` so the stage-output.json
artifact is self-contained: the platform uploads only `stage-output.json`, so a
separate `jira-export.xml` would not reach a downstream agent. The raw export is
still written to `jira-export.xml` at the repo root for local debugging.
`description` and `environment` are preserved raw — they carry the file/line and
Issue Hash a triage agent extracts; `files[]` is the repo-relative path(s)
extracted by the repo filter. `payload.dropped` lists the cross-repo issue keys
filtered out; `payload.deferred` lists repo-matched keys held back by the
`JIRA_MAX_FINDINGS` cap; and `payload.jira` carries the
`fetched_count`/`matched_count`/`dropped_count`/`analyzed_count`/`max_findings`
counters for audit.

---

## Guardrails

- **Secret hygiene:** the PAT lives only inside `fetch.sh`, read from env. Never
  echo, log, print, or write it into any artifact. Do not type it into a Bash
  command — you cannot, and you must not try.
- **Non-determinism is expected:** this pulls live data; counts change between
  runs.
- **Failure ≠ fabricate:** on any failure the envelope is `status: "failed"` with
  the reason. Never substitute invented or synthetic findings — doing so would
  hide a broken Jira connection.
- **Scope:** this skill only *ingests*. It does not triage, classify, or modify
  source — it just produces the export artifact.