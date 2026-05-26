# Platform Reference — DIAL SDLC Pipeline

For **platform maintainers**, not agent authors. The author quickstart is
[`ADDING_AN_AGENT.md`](./ADDING_AN_AGENT.md); exhaustive author detail is
in [`AGENT_REFERENCE.md`](./AGENT_REFERENCE.md).

Covers: framework relationship, context tiers, cross-run state consumption,
and triggers for updating platform docs.

---

## Framework relationship

This repo is the first consumer of the
[`ai-native-sdlc-framework`](https://gitlab.deltixhub.com/Deltix/openai-apps/poc/ai-native-sdlc-framework).
Several artifacts here are **framework-bound** — designed to move upstream
once the abstractions stress-test against more agents. Until then, they live
here as canonical; downstream changes happen here first, framework PRs later.

**Framework-bound** (extract when agent #3 lands, or after ~4 weeks of use,
whichever comes first):

- `.github/actions/run-claude-stage/` — composite action
- `.github/claude/scripts/render-stage-comment.py`
- `.github/claude/scripts/match-agents.py`
- `.github/claude/schemas/stage-message.schema.json`
- `.github/claude/schemas/agent-manifest.schema.json`
- `.github/claude/prompts/agent-wrapper.md`
- `.github/workflows/dispatch-pr.yml`, `.github/workflows/run-agent.yml`
- `agents/_template/agent.yml`
- `.github/claude/ADDING_AN_AGENT.md`, `.github/claude/AGENT_REFERENCE.md`, `.github/claude/PLATFORM_REFERENCE.md`
- The three `docs/sdlc/orchestration*.md` design docs

**Consumer-local** (stays in this repo permanently):

- `agents/<name>/agent.yml` — the manifests for our agents
- `.github/workflows/stage-security-review.yml` (specialized, won't migrate)
- `STAGE_*_ENABLED` repo variables
- The skills under `.claude/skills/` and commands under `.claude/commands/`
  that agent manifests wrap (consumer-owned — each repo brings its own)

Keep the framework-bound surface DIAL-name-free. When extraction happens, it
should be a mechanical `git mv` + filename rename, not a refactor.

---

## Manifest validation

Every `agents/<name>/agent.yml` is validated against
`.github/claude/schemas/agent-manifest.schema.json` at discovery time
(matcher first step). Schema violations fail the dispatcher with a clear
JSON Pointer to the offending field — no broken agent reaches the matrix.

The schema accepts most of the framework's v0.1 manifest field set, plus
a **required `skill:` field**. Per-agent `prompt.md` is not permitted —
`run-agent.yml` fails loudly if it finds one. All reusable agent logic
lives in `.claude/skills/<skill>/SKILL.md` (or
`.claude/commands/<group>/<skill>.md`). The composite action composes
the full prompt from the manifest at runtime.

**Some manifest fields are still recorded only**, not yet acted on at
runtime — the schema documents which ones (look for `Recorded only` /
`not yet wired` notes).

The schema is also referenced by `validate-manifest` if/when we add a CI
check on `agents/**/agent.yml` changes (framework ROADMAP §4.3, deferred).

### Why the platform forbids per-agent prompts

Two failure modes a freeform per-agent prompt path made easy:

1. **Output-contract drift** — authors editing `prompt.md` could (and did)
   contradict the schema constraint by including custom "respond as
   markdown" instructions copied from internet prompts. Forcing prompt
   composition into the platform removes that surface.
2. **Hidden reusable logic** — multi-step prompts (CLI floor + LLM
   judgment + drift check) trapped real value in a per-agent file. As a
   skill, the same logic is interactively callable, versioned, and
   reusable across agents.

Trade-off: every agent requires a skill. For "found a prompt online"
adoption this means saving the prompt as `.claude/skills/<name>/SKILL.md`
with frontmatter — a 30-second step that pays back in audit/reuse.

---

## Supported permissions

The matcher rejects manifests requesting permissions outside this set:

| Scope | Allowed levels |
|---|---|
| `contents` | `read` |
| `pull-requests` | `write` |
| `checks` | `write` |
| `security-events` | `read`, `write` |

`run-agent.yml` and `dispatch-pr.yml` both declare the union as their job
permissions. Manifests that omit the `permissions:` field get the same
union (the runner runs with those scopes; the validator is permissive
about absence).

To add a new tier (e.g., `contents: write` for spec-edit agents that
commit to `specs/`):

1. Add it to `SUPPORTED_PERMISSIONS` in `match-agents.py`.
2. Grant it in `dispatch-pr.yml`'s top-level `permissions:`.
3. Grant it in `run-agent.yml`'s top-level `permissions:`.
4. Document the new tier in this section + `AGENT_REFERENCE.md` → *Tool tiers*.

Don't widen permissions speculatively — every grant is a real privilege
exposure.

---

## Trigger filters

The matcher honors:

- **`branches`**: PR target branch (`github.event.pull_request.base.ref`)
  must be in the manifest's `branches:` list.
- **`labels`**: PR must carry **all** labels listed in `labels:`.

Both are passed to the matcher via `--event-context /tmp/event.json` (dump
of `toJSON(github.event)` set by the dispatcher).

`paths` is reserved (schema accepts it) but **not yet evaluated** — that
needs a `git diff` against the PR base, which the matcher would do in the
discover job. Defer until a real path-scoped agent appears.

---

## Specialized self-triggered workflows

Third-party GHA actions (Trivy, Semgrep, `claude-code-security-review`,
etc.) don't fit the generic Claude composite action. Each gets its own
`.github/workflows/stage-<name>.yml` that fires on PR directly — it does
not enter the dispatcher's matrix. The matcher does not need to handle
these; they're outside the manifest-driven flow.

`stage-security-review.yml` is the reference. When a second specialized
agent is needed, copy that file.

**Why not a centralized "wrapped runner"?** GHA's `uses:` field doesn't
accept expressions, so a single runner can't dynamically dispatch to
`org/action@<sha>` chosen at runtime. Each specialized workflow hardcodes
its third-party reference. Framework's ROADMAP §4.5 imagines a centralized
adapter pattern; we deferred it until the first real third-party adoption
demands more uniformity than per-file copying provides.

---

## Context tiers — what workspace the agent sees

Adopted from `ai-native-sdlc-framework` ADR-0001.

| Tier | Workspace | Status |
|---|---|---|
| **A** | The triggering repo only (single `actions/checkout`) | **Implemented; the dispatcher uses this today.** |
| **B** | Triggering repo + sibling repos via additional `actions/checkout` with pinned SHA | Reserved. Requires extending `run-agent.yml` to honor a `sibling_repos:` manifest field, plus a cross-repo token (GitHub App or fine-grained PAT). |
| **C** | A prebuilt context bundle (versioned tarball) produced upstream | Out of scope for v0.1. |

The manifest field `sibling_repos:` is reserved but not yet read. Don't
document it as available to authors until Tier B is wired through.

---

## How agents emit output — Claude `structured_output`

The composite action passes a JSON Schema to Claude via
`--json-schema=<temp-path>` in `claude_args`. The agent-facing schema is a
runtime-derived subset of `stage-message.schema.json`:

- Envelope fields (`contract_version`, `agent_version`, `run_id`, `trigger`)
  are stripped — the renderer injects them after the agent exits.
- `stage` is pinned via `const: "<agent-name>"` so the agent can't write a
  mismatched stage name.

Top-level is open (`additionalProperties: true`) so non-reviewer agents
can extend without schema churn. Agent-specific structured data goes
under `payload` (also open). The renderer recognizes two `payload`
conventions:

- **`payload.findings[]`** — reviewer convention. Rendered as a table.
  Item shape: `{severity, file?, line?, message, suggested_fix?, requirement_ref?}`.
- **`payload.comment_markdown`** — override. Replaces the renderer's
  default body with verbatim markdown. Use for test results, benchmarks,
  generated code summaries, etc.

These are conventions, not schema requirements. Agents free to put any
keys under `payload`; the renderer just falls back to summary-only display
when neither convention is present.

Claude's Agent SDK constrains generation to the schema and re-prompts on
mismatch. The validated payload appears as the `structured_output` step
output of `anthropics/claude-code-action@v1`. The composite action
materializes it to `stage-output.json` for the artifact upload and
downstream consumption. If Claude exhausts its retry budget, the action
returns subtype `error_max_structured_output_retries` and the job fails —
no malformed output ever reaches the renderer.

**Model requirement**: Claude Sonnet 4.5+, Opus 4.5+, Haiku 4.5+ (GA 2026).
Older models silently lack structured_output support; the composite action
fails with a clear error if the action's output is empty.

---

## Cross-run state — consuming a prior agent's artifact

Every agent's `stage-output.json` is uploaded as a workflow artifact named
`stage-output-{name}` and kept for 90 days. The composite action handles the
upload; agents don't add anything per-stage.

### Same workflow run

Agents declare upstream dependencies via the manifest's `needs:` field. The
matcher topologically sorts agents into rounds (capped at 3); the dispatcher
runs each round as a separate matrix job with sequential `needs:`. Before a
downstream agent runs, `run-agent.yml` downloads each declared upstream's
`stage-output-{name}` artifact into `upstream/{name}/stage-output.json` —
the downstream prompt reads them directly. See `AGENT_REFERENCE.md` →
*Chaining* for the author-facing recipe.

### Different workflow run

Use `actions/download-artifact@v4` plus the GitHub API to find the prior run:

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
    name: stage-output-code-review
    path: prior-runs/
    run-id: ${{ steps.prior.outputs.run-id }}
    github-token: ${{ github.token }}
```

**Do not** parse the sticky PR comment to recover prior state. The sticky
comment is for humans; the artifact is for machines. Mixing them creates an
implicit contract on comment shape that rots.

---

## What requires a doc update (not just a manifest change)

Touching any of these means changing platform code, not just an
`agents/<name>/agent.yml` manifest:

- A new event trigger (`schedule`, `workflow_run`, `repository_dispatch`):
  new dispatcher workflow + matcher support.
- A new permission tier (spec-edit, docs-edit, etc.): `run-agent.yml`
  hardcodes `contents: read`; needs a sibling reusable workflow with write
  scopes.
- Changing the output schema (`stage-message.schema.json`) — affects every
  agent's compliance.
- Changing the sticky-comment format (`render-stage-comment.py`).
- Raising `MAX_ROUNDS` past 3 in the matcher: requires adding `roundN`
  outputs to the discover job and a matching matrix job to `dispatch-pr.yml`.
- Wiring the reserved `sibling_repos:` manifest field (Tier B context).
- Lifting the skill-only restriction (e.g., supporting raw task bodies
  via a `task_file:` manifest field): would require restoring a
  prompt-file path in the composite action and `run-agent.yml`, plus
  rewriting the prompt-composition logic to handle both shapes. The
  restriction is deliberate (see *Why the platform forbids per-agent
  prompts* above). Reopen only when there's a concrete agent that
  demonstrably can't be expressed as a skill.

If your change touches any of those, update `ADDING_AN_AGENT.md` and the
[design docs](../../docs/sdlc/orchestration-research.md) in the same PR.