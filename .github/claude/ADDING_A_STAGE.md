# Adding an Agent to the DIAL SDLC Pipeline

This is the team-facing recipe. The runtime is **manifest-driven**: a dispatcher
discovers agents from `agents/<name>/agent.yml` files and runs them via a
reusable workflow. You declare a manifest and a prompt — the platform handles
GHA wiring, permissions, concurrency, kill switches, output validation, sticky
comments, and artifacts.

For architectural background, see
[`dial-claude-sdlc-orchestration.md`](../../dial-claude-sdlc-orchestration.md)
and the research companion
[`dial-claude-sdlc-orchestration-research.md`](../../dial-claude-sdlc-orchestration-research.md).

---

## File layout

```
agents/
├── _template/                          # copy this for new agents
│   ├── agent.yml                       # 4 required fields + optional metadata
│   └── prompt.md                       # starter prompt
└── code-review/                        # one worked example
    ├── agent.yml
    └── prompt.md

.github/
├── actions/run-claude-stage/action.yml # composite action; do not edit per-agent
├── claude/
│   ├── ADDING_A_STAGE.md               # this doc
│   ├── prompts/_template.md            # (legacy template; agents/_template/ supersedes it)
│   ├── schemas/stage-message.schema.json
│   └── scripts/render-stage-comment.sh
└── workflows/
    ├── dispatch-pr.yml                 # the dispatcher; do not edit per-agent
    ├── run-agent.yml                   # reusable per-agent runner; do not edit per-agent
    └── stage-security-review.yml       # specialized self-triggered exception

tools/
└── match-agents.py                     # dispatcher matcher
```

Two agent shapes:

- **Manifest-driven agent** — the common case. Declare in `agents/<name>/`. The
  dispatcher picks it up. **Use this for new agents.**
- **Specialized self-triggered workflow** — for purpose-built actions (Trivy,
  `claude-code-security-review`) that don't fit the composite action's generic
  shape. `stage-security-review.yml` is the reference. Documented exception;
  don't copy unless you also have a specialized action.

---

## Framework relationship

This repo is the first consumer of the
[`ai-native-sdlc-framework`](https://gitlab.deltixhub.com/Deltix/openai-apps/poc/ai-native-sdlc-framework).
Several artifacts here are **framework-bound** — designed to move upstream
once the abstractions stress-test against more agents. Until then, they live
here as the canonical version; downstream changes happen here first, framework
PRs come later.

**Framework-bound** (extracted when agent #3 lands, or after ~4 weeks of use,
whichever comes first):

- `.github/actions/run-claude-stage/` — composite action
- `.github/claude/scripts/render-stage-comment.sh`
- `.github/claude/schemas/stage-message.schema.json`
- `.github/workflows/dispatch-pr.yml`, `.github/workflows/run-agent.yml`
- `tools/match-agents.py`
- `agents/_template/`
- `.github/claude/ADDING_A_STAGE.md` *(this file)*
- The three `dial-claude-sdlc-orchestration*.md` design docs at the repo root

**Consumer-local** (stays in this repo permanently):

- `agents/<name>/` directories (the manifests + prompts for our agents)
- `.github/workflows/stage-security-review.yml` (specialized, won't migrate)
- `STAGE_*_ENABLED` repo variables
- The skills under `.claude/skills/` that agent prompts wrap

Keep the framework-bound surface DIAL-name-free. When the extraction happens,
it should be a mechanical `git mv` + filename rename, not a refactor.

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
- Optional: set `agent_version`, `description`, `phase`, `cost_class`

`agents/my-agent/prompt.md`:

- Replace placeholders with your agent's name
- Describe the task (often: "Invoke `/skill-name` and map findings to the
  output schema below")

Commit. The next PR runs the agent automatically — no workflow YAML to edit,
no dispatcher changes, no orchestrator entry.

---

## What the manifest declares

```yaml
contract_version: "0.1"
name: code-review
agent_version: "0.1.0"
description: "AI code review via the /code-review-and-quality skill."
triggers: [pull_request]
allowed_tools: "Read,Grep,Glob,Bash(git diff:*),Skill"
phase: pilot
cost_class: light
# kill_switch_var: STAGE_CODE_REVIEW_ENABLED  # derived from name; override only if needed
```

| Field | Required? | What |
|---|---|---|
| `contract_version` | Yes | Pin the schema version. Currently `"0.1"` |
| `name` | Yes | Kebab-case. Appears in PR comments, artifacts, and the kill-switch var name |
| `triggers` | Yes | List of events. `[pull_request]` for PR-triggered agents. Long form supports filters in v0.2 |
| `allowed_tools` | Yes | Comma-separated Claude tool allowlist (see tier table below) |
| `agent_version` | No | Appears in the output envelope; semver-ish, defaults to `"unknown"` |
| `description` | No | One-line description for the catalog |
| `phase` | No | `sandbox` / `pilot` / `production` — governance metadata |
| `cost_class` | No | `light` (<$0.50/run) / `medium` / `heavy` |
| `kill_switch_var` | No | Override the derived var name (rarely needed) |

### Tool tiers

Use the smallest set your prompt actually needs.

| Tier | `allowed_tools` value |
|---|---|
| read-only | `Read,Grep,Glob,mcp__dial-context__*` |
| read-only + skill | `Read,Grep,Glob,Skill,mcp__dial-context__*` |
| read-only + git diff | `Read,Grep,Glob,Bash(git diff:*)` |
| read-only + git diff + skill | `Read,Grep,Glob,Bash(git diff:*),Skill` |

Write-permission tiers (`Edit` scoped to `specs/`, `docs/`, test paths) are
not exposed via the current dispatcher — `run-agent.yml` hardcodes
`contents: read` for safety. When a write-needing agent appears, it gets a
sibling reusable workflow with the appropriate scopes.

---

## Kill switch

To disable an agent without merging a PR, set its kill-switch variable to
`false` in **Settings → Variables → Actions** (repo or org scope).

The variable name is derived mechanically from `name:`:

| Manifest `name` | Variable name |
|---|---|
| `code-review` | `STAGE_CODE_REVIEW_ENABLED` |
| `threat-model` | `STAGE_THREAT_MODEL_ENABLED` |

(Uppercase, hyphens → underscores, prefix `STAGE_`, suffix `_ENABLED`.)

When set to `"false"`, the matcher omits the agent at discovery time — the
matrix doesn't include it, no runner time is spent. To re-enable, delete the
variable or set it to anything other than `"false"`.

---

## Using a ready skill

A "ready skill" is a packaged Claude skill that implements the work your
agent needs. Two sources today:

1. **Local skill** — already in this repo at `.claude/skills/{skill}/`.
   Available automatically after `actions/checkout`. Reference it as
   `/{skill}` in your prompt. **Default.**
2. **Inlined skill** — copy the skill's `SKILL.md` content into your agent's
   `prompt.md`. Drops the skill mechanism; useful for purely prompt-based
   skills with no scripts.

### Example: wrapping a local skill

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

- Review `SKILL.md` and any bundled scripts at adoption time.
- Use the smallest `allowed_tools` set the skill documents needing.
- If the skill bundles MCP servers, treat those as external dependencies and
  review the same way.

> Marketplace plugins (e.g. `code-review@claude-plugins-official`) are
> supported by `anthropics/claude-code-action` but not wired into our
> composite action yet. Add the `plugin_marketplaces` + `plugins` inputs to
> the composite when the first real marketplace agent arrives.

---

## Output contract — what the agent must write

Every manifest-driven agent writes **`stage-output.json`** at the repo root
before exiting. Schema: `.github/claude/schemas/stage-message.schema.json`.

Minimum viable payload:

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
      "requirement_ref": "FR-2",
      "file": "libs/foo/src/Bar.tsx",
      "line": 42,
      "message": "Component prop name doesn't match the libs/* convention",
      "suggested_fix": "Rename `data` to `items` per libs styling guide"
    }
  ],
  "cost_usd": 0.31
}
```

`render-stage-comment.sh` validates required fields and fails the job loudly
if the payload is malformed or missing.

### Envelope fields — auto-injected, do not write

The platform injects four fields into `stage-output.json` after the agent
exits but before validation:

- `contract_version` — the schema contract version (currently `"0.1"`).
- `agent_version` — from the manifest's `agent_version:` (defaults to `"unknown"`).
- `run_id` — `$GITHUB_RUN_ID`, the correlation ID across logs and artifacts.
- `trigger` — `{ event, ref, sha }` from the workflow context.

**Agents must not write these.** Any values an agent provides are overwritten
by the platform — runtime is authoritative.

---

## Context tiers — what workspace the agent sees

Adopted from the `ai-native-sdlc-framework` ADR-0001. Three tiers describe
how much of the world the runner can read:

| Tier | Workspace | When to use |
|---|---|---|
| **A** | The triggering repo only (single `actions/checkout`) | Default for PR-triggered agents. The dispatcher uses this today. |
| **B** | Triggering repo + sibling repos via additional `actions/checkout` with pinned SHA | When the spec lives in a separate repo, or the agent must verify against a vendored library. Requires a cross-repo token (GitHub App or fine-grained PAT). |
| **C** | A prebuilt context bundle (versioned tarball) produced upstream | Heavy or scheduled runs that assemble inputs once and reuse them. Out of scope for v0.1. |

Tier A is the dispatcher's default. Tier B requires extending `run-agent.yml`
to honor a `sibling_repos:` manifest field — not implemented yet, but the
manifest field is reserved.

---

## Cross-run state — reading a prior agent's output

Every agent's `stage-output.json` is uploaded as a workflow artifact named
`stage-output-{name}` and kept for 90 days. The composite action handles the
upload; you don't add anything per-agent.

### Same workflow run

Agents in the same dispatcher run can read each other via
`needs.{job}.outputs.message` if a `needs:` dependency exists. (Currently
the matrix runs agents in parallel without dependencies — adding inter-agent
deps is a v0.2 dispatcher feature.)

### Different workflow run

Use `actions/download-artifact@v4` and the GitHub API to find the prior run:

```yaml
- name: Find prior dispatcher run on this PR
  id: prior
  env:
    GH_TOKEN: ${{ github.token }}
    PR_NUMBER: ${{ github.event.pull_request.number }}
    HEAD_SHA: ${{ github.event.pull_request.head.sha }}
  run: |
    PRIOR_RUN_ID=$(gh api \
      "repos/${{ github.repository }}/actions/workflows/dispatch-pr.yml/runs?event=pull_request&status=completed" \
      --jq ".workflow_runs[] | select(.pull_requests[]?.number==${PR_NUMBER}) | select(.head_sha!=\"${HEAD_SHA}\") | .id" \
      | head -n1)
    echo "run-id=${PRIOR_RUN_ID}" >> "$GITHUB_OUTPUT"

- name: Download prior agent's output
  if: steps.prior.outputs.run-id != ''
  uses: actions/download-artifact@v4
  with:
    name: stage-output-security-review
    path: prior-runs/
    run-id: ${{ steps.prior.outputs.run-id }}
    github-token: ${{ github.token }}
```

**Do not** parse the sticky PR comment to recover prior state. The sticky
comment is for humans; the artifact is for machines. Mixing the two creates
an implicit contract on comment shape that rots.

---

## What you do *not* have to know

- How `pull_request` events route to your agent (dispatcher does it).
- How GHA `permissions:` blocks are wired (`run-agent.yml` does it).
- How concurrency groups work (reusable workflow declares it per agent).
- How `secrets:` propagate (`secrets: inherit` in the dispatcher).
- How sticky comments are posted (composite action handles it).
- How `stage-output.json` is validated (script handles it).
- How envelope fields are injected (script handles it).
- How artifacts are uploaded (composite action handles it).
- How the kill switch is wired (matcher checks `vars.STAGE_*_ENABLED`).

## What requires a doc update (not just a manifest change)

- Adding a new event trigger (`schedule`, `workflow_run`, `repository_dispatch`):
  needs a new dispatcher workflow + matcher support.
- Adding a new permission tier (e.g., spec-edit, docs-edit): needs platform
  changes — `run-agent.yml` hardcodes `contents: read`. Likely a sibling
  reusable workflow with write scopes.
- Changing the output schema (`stage-message.schema.json`).
- Changing the sticky-comment format (`render-stage-comment.sh`).
- Adding inter-agent dependencies (`needs:` between matrix jobs in
  `dispatch-pr.yml`) — not supported in v0.1; a future matcher could emit
  topologically-ordered groups.

If your change touches any of those, update this doc and the design doc in
the same PR.
