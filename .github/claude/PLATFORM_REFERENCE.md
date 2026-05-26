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

## How agents emit output — the `Write`-tool path

The composite action does **not** use `claude-code-action`'s
`--json-schema` / `structured_output` enforcement. Instead, the agent
writes its JSON response to `stage-output.json` at the repo root via the
`Write` tool, and the renderer reads + validates that file. Reasons
(empirical, established across the v0.1 smoke-test cycle):

- **`--json-schema` buffers all output.** Setting `--json-schema=<path>`
  in `claude_args` causes the action to hold every tool-use event and
  every assistant message until end-of-run. No live streaming, no
  visibility for 5-15 minutes per run, regardless of action version
  (reproduced on both v1.0.100 and v1.0.133). `--verbose` and
  `show_full_output: 'true'` don't pierce it.
- **Without `--json-schema`, the action streams every event live.** A
  failing or slow agent is debuggable as it runs.
- **What we give up by not using `--json-schema`**: automatic retry on
  schema violation (the SDK would re-prompt Claude up to N times if its
  output didn't match the schema). Modern Claude models are reliable
  enough at producing valid JSON when given a clear schema description
  in the prompt + an example that we accept this trade. If the agent
  ever emits malformed JSON, the renderer fails loudly with a clear
  error — same end state.

The composite action's prompt-prep step still generates the agent-facing
schema (subset of `stage-message.schema.json` with envelope fields
stripped, `stage` pinned via `const`) and writes it to disk. The
**prompt** describes this schema as the required output shape; the
**Claude runtime** doesn't enforce it. This keeps the schema as
documentation + a quick re-enable surface if upstream ships a fix.

### Output shape — conventions, not enforcement

Top-level is open (`additionalProperties: true`) so non-reviewer agents
can extend without schema churn. Agent-specific structured data goes
under `payload` (also open). The renderer recognizes two `payload`
conventions:

- **`payload.findings[]`** — reviewer convention. Rendered as a table.
  Item shape: `{severity, file?, line?, message, suggested_fix?, requirement_ref?}`.
- **`payload.comment_markdown`** — override. Replaces the renderer's
  default body with verbatim markdown. Use for test results, benchmarks,
  generated code summaries, etc.

These are conventions, not schema requirements. Agents are free to put
any keys under `payload`; the renderer falls back to summary-only display
when neither convention is present.

### Runtime path

1. Composite action composes the prompt and writes `stage-output.json`
   instruction into it.
2. `anthropics/claude-code-action` runs Claude; tool calls stream live
   (no buffering since no `--json-schema`).
3. Agent uses the `Write` tool to save its JSON to `stage-output.json`.
   `Write` is appended to `allowed_tools` automatically by the composite
   action — agents don't need to declare it.
4. Composite action's "Verify stage-output.json" step confirms the file
   exists and dumps its contents to the GHA log.
5. `render-stage-comment.py` validates required fields, injects envelope,
   renders sticky comment markdown.
6. Sticky-comment step posts (or updates) the comment via `gh api`.
7. `upload-artifact` ships `stage-output-<name>` (90-day retention).

**Model requirement**: any Claude model that supports the `Write` tool
and produces valid JSON when instructed — i.e., any modern Claude. The
older `--json-schema` requirement (Sonnet 4.5+, Opus 4.5+, Haiku 4.5+)
no longer applies.

### Debug visibility

Three surfaces are gated on the `show_full_output` composite input
(default `'false'`) so production runs stay quiet:

- The pre-flight state dump step (cwd, env, skill discovery paths,
  composed prompt, agent-facing schema) — runs only when toggled on.
- `--verbose` in `claude_args` — emits richer tool-use event JSON when
  toggled on; otherwise the action streams at its default verbosity.
- `show_full_output: 'true'` passed to `claude-code-action` itself —
  surfaces Claude's prompts and responses in the log instead of
  obscuring them for security.

All three flip with one input. If an agent is misbehaving, set
`show_full_output: 'true'` (either temporarily in `run-agent.yml` or via
a per-stage manifest field if/when we expose one) and re-run.

### Why we still keep the schema file

`stage-message.schema.json` remains the canonical contract. The renderer
re-validates required fields against it as defense in depth. If
`anthropics/claude-code-action` ships a fix for the `--json-schema`
buffering behavior, the path back to constitutional enforcement is one
line: re-add `--json-schema=${SCHEMA_PATH}` to `ARGS` in the composite
action. Keep watching:
<https://github.com/anthropics/claude-code-action/issues>.

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