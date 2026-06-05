# Agent Reference

Exhaustive lookup material for agent authors. The quickstart is
[`ADDING_AN_AGENT.md`](./ADDING_AN_AGENT.md). Platform-maintainer concerns
live in [`PLATFORM_REFERENCE.md`](./PLATFORM_REFERENCE.md).

---

## File layout

```
agents/
├── _template/                          # copy this for new agents
│   └── agent.yml                       # manifest only — no per-agent prompt.md
├── snyk-jira-ingest/                   # worked example: batch producer (secrets)
│   └── agent.yml
└── snyk-triage/                        # worked example: batch chain + analysis_ref + private_output
    └── agent.yml
# (agents/_*/ are disabled pilots — underscore prefix; the matcher skips them.)

.claude/
├── skills/<skill>/SKILL.md             # reusable agent logic lives here
└── commands/<group>/<skill>.md         # slash-command-style skills (e.g. opsx:verify)

.github/
├── actions/
│   ├── run-claude-stage/action.yml     # composite action; do not edit per-agent
│   └── pr-trust-gate/action.yml        # round-0 trust gate (ADR-0005); do not edit per-agent
├── claude/
│   ├── ADDING_AN_AGENT.md              # quickstart
│   ├── AGENT_REFERENCE.md              # this doc
│   ├── PLATFORM_REFERENCE.md           # platform-maintainer reference
│   ├── prompts/agent-wrapper.md        # universal prompt template (intro + inputs + constraints + task + output)
│   ├── schemas/agent-manifest.schema.json
│   ├── schemas/stage-message.schema.json
│   └── scripts/{render-stage-comment.py, match-agents.py, scrub-output.py, findings-to-sarif.py, findings-aggregate.py}
└── workflows/
    ├── dispatch-core.yml               # shared dispatch pipeline; do not edit per-agent
    ├── dispatch-pr.yml                 # pull_request entry point
    ├── dispatch-schedule.yml           # schedule + workflow_dispatch entry point
    ├── run-agent.yml                   # reusable per-agent runner; do not edit per-agent
    └── stage-security-review.yml       # specialized self-triggered exception
```

## Two agent shapes

- **Manifest + skill agent** — the common case (and the only path supported
  by `agents/`). Declare `agent.yml`, point `skill:` at a local skill,
  commit. The dispatcher picks it up automatically.
- **Specialized self-triggered workflow** — for purpose-built actions
  (Trivy, Semgrep, `claude-code-security-review`, etc.) that don't fit the
  composite action's generic shape. Each gets its own
  `.github/workflows/stage-<name>.yml`. `stage-security-review.yml` is the
  reference. Documented exception; don't reach for it unless you have a
  specific third-party action to wrap.

---

## How the prompt is composed

You never write a prompt. The composite action loads a universal template
at [`prompts/agent-wrapper.md`](./prompts/agent-wrapper.md) and substitutes
four placeholders, all derived from your manifest / the run context:

- `{{stage}}` — your agent name.
- `{{skill}}` — the skill it wraps.
- `{{base_ref}}` — the PR base branch, expanded at compose time (the Bash
  tool rejects shell expansion, so the diff command can't use `$GITHUB_BASE_REF`).
- `{{upstream_inputs}}` — per-agent lines for each `needs:` artifact, or a
  "runs independently" note.

Identical shape for every agent — `## Inputs`, a `## Tool constraints`
section (the Bash allowlist denies un-listed commands, shell expansion,
pipes, redirects), a `## Turn budget` directive (write `stage-output.json`
before the limit — a partial result beats no file), `## Task` (invoke
`/{{skill}}`; the **wrapper owns input/output plumbing**, the skill owns
methodology), and `## Output` (write JSON via the `Write` tool; the platform
injects the envelope and posts — never the agent).

Authors cannot drift the inputs framing, the output contract, or the
envelope discipline by editing prompts, because there are no per-agent
prompts to edit. To change the wording everyone sees, edit the template
file directly — one place, one diff.

---

## What the manifest declares

```yaml
contract_version: "0.1"
name: code-review
skill: code-review-and-quality
agent_version: "0.1.0"
description: "AI code review wrapping the local /code-review-and-quality skill."
triggers: [pull_request]
allowed_tools: "Read,Grep,Glob,Bash(git diff:*),Skill"
model: claude-sonnet-4-6
phase: pilot
cost_class: light
```

| Field | Required? | What |
|---|---|---|
| `contract_version` | Yes | Pin the manifest schema version. Currently `"0.1"` |
| `name` | Yes | Kebab-case. Surfaces in PR comments and the kill-switch var |
| `skill` | Yes | The local skill the agent wraps. Must be addressable as `/<skill>` |
| `triggers` | Yes | List of events: `pull_request`, `schedule`, `workflow_dispatch`. A batch agent declares `[pull_request, schedule, workflow_dispatch]`. Filters apply to PR events only |
| `allowed_tools` | Yes | Comma-separated Claude tool allowlist (see tiers below) |
| `agent_version` | No | Recorded in the output envelope; defaults to `"unknown"` |
| `description` | No | One-line description for the catalog |
| `model` | No | Claude model (e.g. `claude-sonnet-4-6`); empty uses action default |
| `phase` | No | `sandbox` / `pilot` / `production` |
| `cost_class` | No | `light` (<$0.50/run) / `medium` / `heavy` |
| `needs` | No | List of upstream agent names. Platform downloads their `stage-output.json` into `upstream/{name}/` before this agent runs. See *Chaining* below |
| `timeout_minutes` | No | Per-agent timeout (default 15, max 360). Honored by `run-agent.yml` |
| `permissions` | No | GHA permissions the runner needs (e.g. `checks: write`). Validated against the platform-supported set; manifest rejected at discovery if it exceeds. See [`PLATFORM_REFERENCE.md`](./PLATFORM_REFERENCE.md) → *Supported permissions* |
| `concurrency` | No | `{group, cancel_in_progress}` override. Default group: `dispatch-pr-<name>-<ref>` |
| `triggers[].filters` | No | `{branches, labels}` filtering of triggers. `branches` matches PR target; `labels` requires all listed labels present. `paths` is reserved for v0.3 |
| `kill_switch_var` | No | Override the derived var name (rarely needed) |
| `tools.extra` | No | CLI tools to install on the runner before the agent runs. Items can be a string (npm package name) or `{name, install}` for non-npm tools. See *CLI dependencies* below |
| `max_turns` | No | Max Claude turns (default 18, max 60). Honored by the composite action |
| `secrets` | No | Secret names to inject into the agent's job env. `run-agent.yml` promotes **only** these from the inherited bag and fails loudly if any is absent. The model never types them — committed helper scripts read them from env. See *Secrets* below |
| `vars` | No | Non-secret config names injected from GitHub Actions Variables — tune knobs (e.g. `JIRA_MAX_FINDINGS`) without editing the skill |
| `analysis_ref` | No | Git ref whose source the platform overlays before the agent runs, so it inspects *that* branch's code (e.g. the branch a scanner ran on) instead of the checkout. Framework paths (`.github`/`.claude`/`agents`) are preserved. See [`PLATFORM_REFERENCE.md`](./PLATFORM_REFERENCE.md) → *Analysis-ref overlay* |
| `private_output` | No | `true` → the agent's `stage-output.json` (and audit input) are AES-encrypted (`SDLC_ARTIFACT_KEY`) before upload, and the public surface is **counts-only** to the job summary, not a sticky comment. For sensitive/batch agents on a public repo |
| `emit_sarif` | No | `true` → convert `payload.findings[]` to SARIF and upload to the Security tab, scoped to `analysis_ref`'s commit |
| `context_tier` | No | `A` (triggering repo only, default). `B`/`C` reserved; not yet wired |

Manifests are validated against [`schemas/agent-manifest.schema.json`](./schemas/agent-manifest.schema.json) at every dispatch. Schema violations fail the discover job with a clear path to the offending field — no broken agent reaches the matrix. Per-agent `prompt.md` files are rejected (the runner fails loudly if it finds one).

### CLI dependencies (`tools.extra`)

If your skill shells out to a CLI that the GitHub runner doesn't ship
by default (e.g., `openspec`, `trivy`, `prettier`), declare it in the
manifest. Three shapes, in order of complexity:

```yaml
tools:
  extra:
    # 1. String — npm package, latest stable.
    #    Quote scoped packages (YAML treats leading `@` as special).
    - "@fission-ai/openspec"

    # 2. Object with version — npm package, pinned to a specific version.
    #    Equivalent to: npm install -g @fission-ai/openspec@1.3.1
    - name: "@fission-ai/openspec"
      version: "1.3.1"

    # 3. Object with install — arbitrary shell command (non-npm tools).
    #    `{{version}}` placeholder in `install` is substituted from
    #    the sibling `version` field (or empty string if omitted).
    - name: trivy
      version: "0.69.0"
      install: "curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin v{{version}}"
```

The runner iterates `tools.extra` before invoking the agent:

- **String** or **`{name, version?}`** → `npm install -g <name>[@<version>]`
- **`{name, version?, install}`** → shell-execute `install` after
  substituting `{{version}}` with the sibling `version` value

Failure exits early — Claude isn't invoked if any dependency fails to
install (loud, not silent). Agents without `tools.extra` pay zero
install cost; the step is conditional on the array being non-empty.

After install, the binary the tool ships is on `$PATH` and any
`Bash(<binary>:*)` tool call the agent makes will work.

**Version pinning is recommended for reproducibility.** Bare strings
and `{name}` without `version` resolve to the latest stable, which
can silently change between runs. Pin the version unless you have a
specific reason to track latest.

Worked examples (currently disabled pilots — underscore-prefixed dirs):

- `agents/_spec-validation/agent.yml` — short form
  (`"@fission-ai/openspec"`, latest)
- `agents/_scan-deps/agent.yml` — long form with version pin
  (Trivy `v0.69.0` via the official curl-based installer)

### Secrets (`secrets:`)

If your skill's committed helper scripts need a credential (e.g. a Jira PAT),
declare the env-var name in `secrets:` and add the matching value under
**Settings → Secrets → Actions**. `run-agent.yml` promotes **only** the
declared names from the inherited secret bag into the job env (failing loudly
if any is absent) — adding a secret-using agent needs no platform edit.

The model **never types the secret**: the agent-wrapper forbids shell
expansion in Bash tool calls, so secrets are referenced only inside committed
scripts that read them from env. Keep the agent's `allowed_tools` scoped to the
exact committed script (e.g. `Bash(bash .claude/skills/<skill>/fetch.sh:*)`),
not a general `Bash`.

`SDLC_ARTIFACT_KEY` is the conventional key for `private_output` agents
(encrypts the output + audit artifacts). Worked example:
`agents/snyk-jira-ingest/agent.yml` (`secrets: [JIRA_PAT]`).

### Tool tiers

| Tier | `allowed_tools` value |
|---|---|
| read-only + skill | `Read,Grep,Glob,Skill,mcp__dial-context__*` |
| read-only + git diff + skill | `Read,Grep,Glob,Bash(git diff:*),Skill` |
| above + extra CLI (e.g. `openspec`) | `Read,Grep,Glob,Bash(git diff:*),Bash(openspec:*),Skill` |

`Skill` is always required (every agent invokes a skill). Tools should be
the smallest set the *skill* needs — review the skill's `Required tools`
section, mirror it here.

Write-permission tiers are not exposed today — `run-agent.yml` hardcodes
`contents: read` for safety. When a write-needing agent appears, it gets a
sibling reusable workflow with the appropriate scopes. See
[`PLATFORM_REFERENCE.md`](./PLATFORM_REFERENCE.md).

---

## Writing a skill for an agent

Skills are markdown files at `.claude/skills/<skill>/SKILL.md` with YAML
frontmatter. They are reusable, callable interactively (`/skill`), and
versioned as a unit. **Custom agent logic belongs here — never inlined
in the agent layer.**

Minimum SKILL.md:

```markdown
---
name: my-skill
description: One line describing what the skill does and when to use it.
---

# My Skill

## Overview
What this skill accomplishes.

## When to use
Concrete situations where this skill is the right tool.

## Process
The steps the model should follow.

## Output
If invoked from an SDLC agent: map output to `payload.findings[]` (for
reviewer-shaped output) or `payload.comment_markdown` (for everything
else). If invoked interactively: return a markdown report.

## Required tools
List of tools the skill expects (e.g. `Read`, `Grep`, `Bash(git diff:*)`,
`Skill`). The agent author copies this into `allowed_tools:`.
```

See `.claude/skills/code-review-and-quality/SKILL.md` and
`.claude/skills/spec-validation/SKILL.md` for worked examples — including
one (`spec-validation`) that does real orchestration (CLI floor +
`/opsx:verify` per change + drift check).

### Adopting a third-party skill

1. Review the upstream `SKILL.md` and any bundled scripts.
2. Copy it into `.claude/skills/<skill>/SKILL.md`.
3. Note any extra tools it needs and grant them in your agent manifest's
   `allowed_tools`.
4. Treat bundled MCP servers as external dependencies and review them too.

### What if I have a prompt, not a skill?

Convert it. A "prompt from the internet" is one frontmatter line away from
being a skill: save the body as `SKILL.md`, add `name:` + `description:`
frontmatter, strip any output-format instructions (replaced by the
platform's schema), and reference it from your agent. **Do not** paste it
into a `prompt.md` — the runner rejects per-agent prompt files.

---

## Kill switch

Disable an agent without merging a PR by setting a repo or org variable to
`"false"` in **Settings → Variables → Actions**. The variable name is
derived from `name:`:

| Manifest `name` | Variable name |
|---|---|
| `snyk-triage` | `STAGE_SNYK_TRIAGE_ENABLED` |
| `snyk-jira-ingest` | `STAGE_SNYK_JIRA_INGEST_ENABLED` |

(Uppercase, hyphens → underscores, prefix `STAGE_`, suffix `_ENABLED`.)

When set to `"false"`, the matcher omits the agent at discovery — no runner
time is spent. To re-enable, delete or change the variable.

---

## Chaining (depending on another agent)

If your agent needs another agent's output as input, declare it in the
manifest:

```yaml
# agents/snyk-triage/agent.yml (abridged)
contract_version: "0.1"
name: snyk-triage
skill: snyk-triage
triggers: [pull_request, schedule, workflow_dispatch]
allowed_tools: "Read,Grep,Glob,Bash(git diff:*),Bash(python3:*),Skill"
needs: [snyk-jira-ingest]       # ← the only chaining-specific line
```

The platform handles the rest:

- The matcher topologically sorts agents into rounds. Upstream agents go
  in earlier rounds; downstream agents wait until upstream completes.
- Before your agent runs, the platform downloads each upstream's
  `stage-output-{name}` artifact into `upstream/{name}/stage-output.json`.
- Your skill reads those files like any other input.

### Rules and limits

- **At most 3 rounds** of chaining (the dispatcher caps it).
- **Upstream killed → downstream skipped.** If `STAGE_SNYK_JIRA_INGEST_ENABLED`
  is `"false"`, the matcher drops `snyk-triage` too (with a warning).
- **Cycles fail loudly.** If A needs B and B needs A, the dispatcher
  aborts at discovery with `::error::Cycle detected in agent needs:`.
- **Same-run only.** The downloaded artifacts are from *this* dispatcher
  run, not historical.
- **Upstream must be in the matched set.** Agent in `needs:` must match
  the same trigger (e.g., both `pull_request`) and not be filtered out.

---

## Output contract — what the skill must produce

You don't write the output contract into your skill — the platform appends
it to the composed prompt automatically. What the contract says:

At the end of the run, the agent uses the **`Write` tool** to save a JSON
object to `stage-output.json` at the repo root. The renderer reads that
file, validates required fields, injects envelope fields
(`contract_version`, `agent_version`, `run_id`, `trigger`), and surfaces the
result. The schema lives at
[`schemas/stage-message.schema.json`](./schemas/stage-message.schema.json).

**You write the same JSON regardless of how it's surfaced** — the platform
decides the destination from your manifest:

- **Default (public agent):** the rendered body passes through the M4
  post-processor (secret scan → fail-closed; URL/HTML neutralize), then posts
  as a sticky PR comment + full job summary. The plaintext artifact uploads.
- **`private_output: true`:** only **counts** go to the job summary; the full
  `stage-output.json` is encrypted and uploaded. No sticky comment. Use this
  for sensitive/batch agents on a public repo.

Either way, the composed prompt + schema are persisted as `stage-input-<name>`
for audit (encrypted for private agents). You don't write or trigger any of
this — just produce valid `stage-output.json`.

`Write` is appended to `allowed_tools` automatically by the platform —
your manifest doesn't need to declare it.

Failure mode: if the agent doesn't write `stage-output.json`, the
"Verify stage-output.json" step fails loudly. If the file exists but
fields are missing or malformed, the renderer fails with a clear error.
Either way the job fails — no partial output reaches downstream.

> **Aside on `--json-schema`** — the platform used to pass the schema
> to Claude via `--json-schema=<path>` in `claude_args` for
> constitutional output enforcement. Empirically (across 9 smoke runs)
> that path buffers Claude's output for the entire run with no live
> streaming, regardless of action version. We removed it; the agent
> writes the file itself, the renderer does the shape validation, and
> we get live debugging for free. See
> [`PLATFORM_REFERENCE.md`](./PLATFORM_REFERENCE.md) → *How agents emit
> output* for the full story.

### Top-level shape

- `stage` (string) — pinned by the platform; you can't mismatch.
- `status` (enum) — `passed`, `passed_with_findings`, or `failed`.
- `summary` (string) — one short line for the sticky PR comment.
- `cost_usd` (number, optional) — token spend if you can compute it.
- `payload` (object, optional) — agent-specific structured data.

Envelope fields (`contract_version`, `agent_version`, `run_id`, `trigger`)
are injected by the renderer. **Agents must not write them.**

### Payload conventions (recognized by the renderer)

The schema is intentionally loose at the top level (`additionalProperties: true`)
and inside `payload` (also open). The renderer recognizes two conventions
under `payload`:

**`payload.findings[]`** — reviewer convention. Use when your skill emits
issues. Renderer shows a table.

```json
{
  "stage": "code-review",
  "status": "passed_with_findings",
  "summary": "3 medium findings on naming/scope; non-blocking",
  "payload": {
    "findings": [
      {
        "severity": "medium",
        "file": "libs/foo/src/Bar.tsx",
        "line": 42,
        "message": "Component prop name doesn't match the libs/* convention",
        "suggested_fix": "Rename `data` to `items`"
      }
    ]
  },
  "cost_usd": 0.31
}
```

**`payload.comment_markdown`** — override convention. Use when your output
isn't reviewer-shaped (test results, benchmark numbers, generated code
summaries, etc.). The string replaces the default body verbatim.

```json
{
  "stage": "test-gen",
  "status": "passed",
  "summary": "Generated 12 tests; 10 pass on first run.",
  "payload": {
    "comment_markdown": "| Suite | Generated | Passing |\n|---|---|---|\n| libs/foo | 5 | 4 |\n| libs/bar | 7 | 6 |\n\nFailures noted in [run artifact](…).",
    "tests_generated": 12,
    "tests_passing": 10
  }
}
```

Other keys under `payload` are passed through unchanged. Downstream agents
that declare `needs: [my-agent]` can read whatever schema you emit.

---

## What you do *not* have to know

- How `pull_request` events route to your agent — dispatcher does it.
- How GHA permissions, concurrency, secrets, sticky comments, and artifacts
  get wired — the reusable workflow and composite action handle all of it.
- How the prompt is built — the platform composes it from your manifest.
- How envelope fields are injected or outputs validated — the script does it.
- How the kill switch is checked — the matcher reads `vars.STAGE_*_ENABLED`.

If your change touches the platform (new trigger event, new permission
tier, output schema, sticky-comment format, inter-agent dependencies), see
[`PLATFORM_REFERENCE.md`](./PLATFORM_REFERENCE.md).
