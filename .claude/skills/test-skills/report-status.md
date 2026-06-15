# Skill: Report Agent Status

Two-tier status reporting: artifacts during the run, committed summary on completion.

## Mid-run progress (every major step)

Write `progress.json` to a workflow artifact named `progress-<agent>`:

```json
{
  "agent": "<name>",
  "status": "running",
  "step": "<current step description>",
  "started_at": "<iso timestamp>",
  "updated_at": "<iso timestamp>",
  "details": "<optional progress text, e.g. '12/45 tests complete'>"
}
```

Upload via `actions/upload-artifact` pinned to SHA. The Status Assistant reads these via `gh run download` for in-flight visibility.

## Final summary (on completion only)

Commit to `.state/status/<agent-name>.json`:

```json
{
  "agent": "<name>",
  "status": "passed" | "failed",
  "started_at": "<iso timestamp>",
  "completed_at": "<iso timestamp>",
  "trigger": "<trigger description, e.g. 'workflow_dispatch · commit abc123'>",
  "result": { "passed": <n>, "total": <n>, "rate": <0..1> },
  "allure_url": "<url>",
  "component": "<component>",
  "commit_author_login": "<login>"
}
```

Commit message: `chore(state): <agent> <passed|failed>`.

## Rules

- Overwrite, don't append — one summary file per agent, latest run replaces previous.
- **You only write the files; you do NOT run git.** A workflow step that runs AFTER your turn picks up any changes under `.state/` and commits + pushes them. Do not invoke `git add` / `git commit` / `git push` — those commands are not in your allowed tools and will be denied.
- Use the native `Write` tool (not `mkdir` / `echo` shell). `Write` creates parent directories automatically.
- Optional fields (`allure_url`, `component`, `commit_author_login`) — omit if not applicable to the agent.
- If the agent fails before reaching the final-summary step, the previous status file remains untouched. `pipeline-health.yml` posts the failure separately.
