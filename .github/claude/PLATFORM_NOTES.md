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

## Cross-run state — consuming a prior agent's artifact

Every agent's `stage-output.json` is uploaded as a workflow artifact named
`stage-output-{name}` and kept for 90 days. The composite action handles the
upload; agents don't add anything per-stage.

### Same workflow run

Agents in the same dispatcher run can read each other via
`needs.{job}.outputs.message` if a `needs:` dependency exists. Currently the
matrix in `dispatch-pr.yml` runs agents in parallel without dependencies —
adding inter-agent deps is a v0.2 dispatcher feature.

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
- Adding inter-agent dependencies (`needs:` between matrix jobs in
  `dispatch-pr.yml`) — not supported in v0.1; a future matcher could emit
  topologically-ordered groups.
- Wiring the reserved `sibling_repos:` manifest field (Tier B context).

If your change touches any of those, update `ADDING_AN_AGENT.md` and the
[design docs](../../docs/sdlc/orchestration-research.md) in the same PR.