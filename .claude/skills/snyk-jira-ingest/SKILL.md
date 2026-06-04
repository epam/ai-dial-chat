---
name: snyk-jira-ingest
description: Pull REAL Snyk SAST findings from EPAM Jira (Data Center) via the search-export API using a Personal Access Token, and emit them as a stage-output.json artifact for a downstream triage stage. Use when you want the actual Jira-tracked Snyk findings (the same set a human gets by clicking Export on the security filter) rather than a synthetic fixture.
---

# Snyk → Jira Ingest

Pull the real Snyk SAST findings tracked in EPAM Jira and write them to
`stage-output.json` for the downstream triage stage. All the work — fetch,
filter to this repo, cap, and writing a schema-valid envelope — is done by the
committed script `fetch.sh`; you only run it. (Config and behaviour are
documented in that script.)

## Procedure

1. Run exactly this single Bash command — the only one in your allowlist:

   ```
   bash .claude/skills/snyk-jira-ingest/fetch.sh
   ```

2. Confirm `stage-output.json` exists (Read it). The script already wrote a valid
   envelope — do **not** overwrite it. Then finish.

3. **Only** if that command is denied or errors before the file is written: use
   Write to create `stage-output.json` with `status: "failed"` and a `summary`
   naming what went wrong. Never fabricate findings or a synthetic export.