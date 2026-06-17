---
name: snyk-jira-ingest
description: Pull REAL Snyk SAST findings from EPAM Jira (Data Center) via the search-export API using a Personal Access Token, and emit them as a stage-output.json artifact for a downstream triage stage. Use when you want the actual Jira-tracked Snyk findings (the same set a human gets by clicking Export on the security filter) rather than a synthetic fixture.
---

# Snyk → Jira Ingest

Pull the real Snyk SAST findings tracked in EPAM Jira for the downstream triage
stage. All the work — fetch, filter to this repo, cap, and writing a schema-valid
`stage-output.json` — is done by the committed script `fetch.sh`; you only run it
and confirm the result. (Config and behaviour are documented in that script.)

## Procedure

1. Run the script:

   ```
   bash .claude/skills/snyk-jira-ingest/fetch.sh
   ```

2. Read `stage-output.json` to confirm it exists. **The script already wrote a
   valid envelope — do not overwrite it.** Then finish.

3. **Only** if the script is denied or errors before that file exists: write a
   failed result naming what went wrong. Never fabricate findings or a synthetic
   export.