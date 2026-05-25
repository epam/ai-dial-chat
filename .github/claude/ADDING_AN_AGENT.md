# Adding an Agent to the DIAL SDLC Pipeline

The runtime is **manifest-driven**: declare a manifest and a prompt, the
platform handles GHA wiring, permissions, concurrency, kill switches,
output validation, sticky comments, and artifacts.

For platform-maintainer details (framework relationship, context tiers,
cross-run state, doc-update triggers), see
[`PLATFORM_NOTES.md`](./PLATFORM_NOTES.md).

---

## File layout

```
agents/
├── _template/                          # copy this for new agents
│   ├── agent.yml
│   └── prompt.md
└── code-review/                        # one worked example
    ├── agent.yml
    └── prompt.md

.github/
├── actions/run-claude-stage/action.yml # composite action; do not edit per-agent
├── claude/
│   ├── ADDING_AN_AGENT.md              # this doc
│   ├── PLATFORM_NOTES.md               # platform-maintainer concerns
│   ├── schemas/stage-message.schema.json
│   └── scripts/render-stage-comment.py
└── workflows/
    ├── dispatch-pr.yml                 # the dispatcher; do not edit per-agent
    ├── run-agent.yml                   # reusable per-agent runner; do not edit per-agent
    └── stage-security-review.yml       # specialized self-triggered exception

tools/
└── match-agents.py                     # dispatcher matcher
```

Two agent shapes:

- **Manifest-driven agent** — the common case. A Claude prompt + tool
  allowlist. Declare in `agents/<name>/`; the dispatcher picks it up
  automatically. **Use this for new agents.**
- **Specialized self-triggered workflow** — for purpose-built actions
  (Trivy, Semgrep, `claude-code-security-review`, etc.) that don't fit the
  composite action's generic shape. Each gets its own
  `.github/workflows/stage-<name>.yml`. `stage-security-review.yml` is the
  reference. Documented exception; don't reach for it unless you have a
  specific third-party action to wrap.

---

## The 2-step recipe

### 1. Copy the template

```bash
cp -r agents/_template agents/my-agent
```

### 2. Edit two files

`agents/my-agent/agent.yml`:

- Change `name:` to `my-agent`
- Change `allowed_tools:` to the smallest set your agent needs
- Optional: `agent_version`, `description`, `model`, `phase`, `cost_class`

`agents/my-agent/prompt.md`:

- Replace placeholders with your agent's name
- Describe the task (often: "Invoke `/skill-name` and map findings to the
  output schema below")

Commit. The next PR runs the agent automatically — no workflow YAML to edit,
no dispatcher changes.

---

## What the manifest declares

```yaml
contract_version: "0.1"
name: code-review
agent_version: "0.1.0"
description: "AI code review via the /code-review-and-quality skill."
triggers: [pull_request]
allowed_tools: "Read,Grep,Glob,Bash(git diff:*),Skill"
model: claude-sonnet-4-6
phase: pilot
cost_class: light
```

| Field | Required? | What |
|---|---|---|
| `contract_version` | Yes | Pin the schema version. Currently `"0.1"` |
| `name` | Yes | Kebab-case. Surfaces in PR comments and the kill-switch var |
| `triggers` | Yes | List of events. `[pull_request]` for PR-triggered agents |
| `allowed_tools` | Yes | Comma-separated Claude tool allowlist (see tiers below) |
| `agent_version` | No | Recorded in the output envelope; defaults to `"unknown"` |
| `description` | No | One-line description for the catalog |
| `model` | No | Claude model (e.g. `claude-sonnet-4-6`); empty uses action default |
| `phase` | No | `sandbox` / `pilot` / `production` |
| `cost_class` | No | `light` (<$0.50/run) / `medium` / `heavy` |
| `needs` | No | List of upstream agent names. Platform downloads their `stage-output.json` into `upstream/{name}/` before this agent runs. See *Chaining* below |
| `timeout_minutes` | No | Per-agent timeout (default 15, max 360). Honored by `run-agent.yml` |
| `permissions` | No | GHA permissions the runner needs (e.g. `checks: write`). Validated against the platform-supported set; manifest rejected at discovery if it exceeds. See [`PLATFORM_NOTES.md`](./PLATFORM_NOTES.md) → *Supported permissions* |
| `concurrency` | No | `{group, cancel_in_progress}` override. Default group: `dispatch-pr-<name>-<ref>` |
| `triggers[].filters` | No | `{branches, labels}` filtering of triggers. `branches` matches PR target; `labels` requires all listed labels present. `paths` is reserved for v0.3 |
| `kill_switch_var` | No | Override the derived var name (rarely needed) |

Manifests are validated against [`schemas/agent-manifest.schema.json`](./schemas/agent-manifest.schema.json) at every dispatch. Schema violations fail the discover job with a clear path to the offending field — no broken agent reaches the matrix.

### Tool tiers

| Tier | `allowed_tools` value |
|---|---|
| read-only | `Read,Grep,Glob,mcp__dial-context__*` |
| read-only + skill | `Read,Grep,Glob,Skill,mcp__dial-context__*` |
| read-only + git diff | `Read,Grep,Glob,Bash(git diff:*)` |
| read-only + git diff + skill | `Read,Grep,Glob,Bash(git diff:*),Skill` |

Write-permission tiers are not exposed today — `run-agent.yml` hardcodes
`contents: read` for safety. When a write-needing agent appears, it gets a
sibling reusable workflow with the appropriate scopes. See PLATFORM_NOTES.

---

## Kill switch

Disable an agent without merging a PR by setting a repo or org variable to
`"false"` in **Settings → Variables → Actions**. The variable name is
derived from `name:`:

| Manifest `name` | Variable name |
|---|---|
| `code-review` | `STAGE_CODE_REVIEW_ENABLED` |
| `threat-model` | `STAGE_THREAT_MODEL_ENABLED` |

(Uppercase, hyphens → underscores, prefix `STAGE_`, suffix `_ENABLED`.)

When set to `"false"`, the matcher omits the agent at discovery — no runner
time is spent. To re-enable, delete or change the variable.

---

## Chaining (depending on another agent)

If your agent needs another agent's output as input, declare it in the
manifest:

```yaml
# agents/triage-deps/agent.yml
contract_version: "0.1"
name: triage-deps
triggers: [pull_request]
allowed_tools: "Read,Grep,Skill"
needs: [scan-deps]              # ← the only chaining-specific line
```

The platform handles the rest:

- The matcher topologically sorts agents into rounds. Upstream agents go
  in earlier rounds; downstream agents wait until upstream completes.
- Before your agent runs, the platform downloads each upstream's
  `stage-output-{name}` artifact into `upstream/{name}/stage-output.json`.
- Your prompt reads those files like any other input.

### Worked example: scan → triage

```yaml
# agents/triage-deps/prompt.md
# Triage Dependencies Agent

You triage the findings produced by the `scan-deps` agent.

## Inputs
- Upstream scan output: `upstream/scan-deps/stage-output.json`
  (read the `findings[]` array — each entry has `severity`, `file`, etc.)

## Task
1. Read upstream/scan-deps/stage-output.json.
2. Filter false positives. Classify remaining findings by exploitability.
3. Write your output to stage-output.json with one finding per actionable
   item.
```

### Rules and limits

- **At most 3 rounds** of chaining (the dispatcher caps it). Round 1 →
  Round 2 → Round 3 is enough for any realistic pipeline; chains longer
  than that are usually a smell.
- **Upstream killed → downstream skipped.** If `STAGE_SCAN_DEPS_ENABLED`
  is `"false"`, the matcher drops `triage-deps` too (with a warning).
  Triage of nothing is nonsense.
- **Cycles fail loudly.** If A needs B and B needs A, the dispatcher
  aborts at discovery with `::error::Cycle detected in agent needs:`.
- **Same-run only.** The downloaded artifacts are from *this* dispatcher
  run, not historical. The current commit's output feeds the current
  commit's triage.
- **Upstream must be in the matched set.** Agent in `needs:` must match
  the same trigger (e.g., both `pull_request`) and not be filtered out.

---

## Using a ready skill

Two sources today:

1. **Local skill** — already in this repo at `.claude/skills/{skill}/`.
   Reference as `/{skill}` in your prompt. **Default.**
2. **Inlined skill** — paste the skill's `SKILL.md` content into your prompt.

### Example: wrapping `/code-review-and-quality`

`agents/code-review/agent.yml`:

```yaml
contract_version: "0.1"
name: code-review
allowed_tools: "Read,Grep,Glob,Bash(git diff:*),Skill"
triggers: [pull_request]
```

`agents/code-review/prompt.md`:

```markdown
1. Invoke `/code-review-and-quality` against the PR diff.
2. Map the skill's findings into the output schema below.
```

### Trust posture for external skills

- Review `SKILL.md` and any bundled scripts at adoption.
- Use the smallest `allowed_tools` set the skill documents needing.
- If the skill bundles MCP servers, treat those as external dependencies and
  review the same way.

---

## Output contract — what the agent must write

The agent's **final response** is a JSON object validated against the
schema at `.github/claude/schemas/stage-message.schema.json`. The platform
passes the schema to Claude via `--json-schema`, so the model is
constitutionally constrained to match it — there is no separate "write a
file" step. The platform materializes the validated response to
`stage-output.json` for the artifact upload.

Failure mode: if Claude can't satisfy the schema within its retry budget,
the action emits `error_max_structured_output_retries` and the job fails.
No partial / malformed output ever reaches downstream.

Minimum payload:

```json
{
  "stage": "code-review",
  "status": "passed_with_findings",
  "summary": "3 medium findings on naming/scope; non-blocking"
}
```

Richer payload:

```json
{
  "stage": "code-review",
  "status": "passed_with_findings",
  "summary": "3 medium findings on naming/scope; non-blocking",
  "findings": [
    {
      "severity": "medium",
      "file": "libs/foo/src/Bar.tsx",
      "line": 42,
      "message": "Component prop name doesn't match the libs/* convention",
      "suggested_fix": "Rename `data` to `items`"
    }
  ],
  "cost_usd": 0.31
}
```

`render-stage-comment.py` re-validates required fields as defense in depth
(structured_output already enforces the schema) and fails the job loudly if
something slipped through.

### Envelope fields — auto-injected, do not write

The platform injects four fields after the agent exits but before validation:

- `contract_version`, `agent_version`, `run_id`, `trigger.{event,ref,sha}`.

**Agents must not write these.** Any values an agent provides are overwritten
by the platform — runtime is authoritative.

---

## What you do *not* have to know

- How `pull_request` events route to your agent — dispatcher does it.
- How GHA permissions, concurrency, secrets, sticky comments, and artifacts
  get wired — the reusable workflow and composite action handle all of it.
- How envelope fields are injected or outputs validated — the script does it.
- How the kill switch is checked — the matcher reads `vars.STAGE_*_ENABLED`.

If your change touches the platform (new trigger event, new permission tier,
output schema, sticky-comment format, inter-agent dependencies), see
[`PLATFORM_NOTES.md`](./PLATFORM_NOTES.md).
