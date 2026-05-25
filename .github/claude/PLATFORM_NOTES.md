# Platform Notes — DIAL SDLC Pipeline

For **platform maintainers**, not agent authors. The author-facing recipe is
[`ADDING_AN_AGENT.md`](./ADDING_AN_AGENT.md).

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
- `.github/claude/schemas/stage-message.schema.json`
- `.github/workflows/dispatch-pr.yml`, `.github/workflows/run-agent.yml`
- `.github/claude/scripts/match-agents.py`
- `agents/_template/`
- `.github/claude/ADDING_AN_AGENT.md`, `.github/claude/PLATFORM_NOTES.md`
- The three `docs/sdlc/orchestration*.md` design docs

**Consumer-local** (stays in this repo permanently):

- `agents/<name>/` directories (the manifests + prompts for our agents)
- `.github/workflows/stage-security-review.yml` (specialized, won't migrate)
- `STAGE_*_ENABLED` repo variables
- The skills under `.claude/skills/` that agent prompts wrap

Keep the framework-bound surface DIAL-name-free. When extraction happens, it
should be a mechanical `git mv` + filename rename, not a refactor.

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
  are stripped — the platform injects them after the agent exits.
- `stage` is pinned via `const: "<agent-name>"` so the agent can't write a
  mismatched stage name.

Claude's Agent SDK constrains generation to the schema and re-prompts on
mismatch. The validated payload appears as the
`structured_output` step output of `anthropics/claude-code-action@v1`. The
composite action materializes it to `stage-output.json` for the artifact
upload and downstream consumption. If Claude exhausts its retry budget,
the action returns subtype `error_max_structured_output_retries` and the
job fails — no malformed output ever reaches the renderer.

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
the downstream prompt reads them directly. See `ADDING_AN_AGENT.md` →
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
- **Adopting a non-reviewer agent type** (test-gen, spec-author, benchmark,
  migration, doc-gen, etc.): the current schema's `findings[]` shape is
  reviewer-flavored. First non-reviewer agent should pick one of:
  (a) loosen `additionalProperties: false` to `true` at the top level so
  the agent can add its own fields directly, or (b) add a `payload: object`
  envelope for agent-specific data. Decide at adoption with the agent's
  actual output shape in hand — not before.

If your change touches any of those, update `ADDING_AN_AGENT.md` and the
[design docs](../../docs/sdlc/orchestration-research.md) in the same PR.