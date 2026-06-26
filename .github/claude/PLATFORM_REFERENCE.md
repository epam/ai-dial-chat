# Platform Reference — DIAL SDLC Pipeline

For **platform maintainers**, not agent authors. The author quickstart is
[`ADDING_AN_AGENT.md`](./ADDING_AN_AGENT.md); exhaustive author detail is
in [`AGENT_REFERENCE.md`](./AGENT_REFERENCE.md).

Covers: framework relationship, dispatch architecture, the security model
(ADR-0005), the `analysis_ref` overlay, private/encrypted output, context
tiers, cross-run state consumption, and triggers for updating platform docs.

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
- `.github/actions/pr-trust-gate/` — round-0 trust gate (ADR-0005 M1/M2)
- `.github/claude/scripts/render-stage-comment.py`
- `.github/claude/scripts/match-agents.py`
- `.github/claude/scripts/scrub-output.py` — M4 output post-processor
- `.github/claude/scripts/findings-to-sarif.py` — `emit_sarif` converter
- `.github/claude/scripts/findings-aggregate.py` — counts-only public surface
- `.github/claude/schemas/stage-message.schema.json`
- `.github/claude/schemas/agent-manifest.schema.json`
- `.github/claude/prompts/agent-wrapper.md`
- `.github/workflows/dispatch-core.yml` — shared dispatch pipeline
- `.github/workflows/dispatch-pr.yml`, `.github/workflows/dispatch-schedule.yml` — trigger entry points
- `.github/workflows/run-agent.yml`
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

## Dispatch architecture

One reusable core, multiple trigger-specific entry points:

```
dispatch-pr.yml         (on: pull_request)        ─┐
dispatch-schedule.yml   (on: schedule,             ├─→ dispatch-core.yml ─→ run-agent.yml (per agent)
                             workflow_dispatch)    ─┘     gate → discover → round1..3
```

- **`dispatch-core.yml`** (`workflow_call`) — the shared pipeline. Reads the
  caller's event from `github.event_name`, runs the round-0 **trust gate**, then
  the matcher, then fans agents into topologically-sorted rounds via
  `run-agent.yml`. One core serves every trigger without modification.
- **`dispatch-pr.yml`** — `on: pull_request` (PR-gating agents).
- **`dispatch-schedule.yml`** — `on: schedule` (cron) + `workflow_dispatch`
  (manual). For batch agents over a standing backlog. See
  [`scheduled-batch-agents.md`](../../docs/sdlc/scheduled-batch-agents.md).

**Default-branch constraint:** GitHub registers `schedule` /
`workflow_dispatch` only when the workflow file is on the repository's default
branch. On a non-default sandbox base neither fires; batch agents keep a
temporary `pull_request` trigger for sandbox testing until the framework lands
on the default branch.

The job graph is `gate → discover → round1 → round2 → round3`. A failed gate
skips `discover`, and the rounds gate on `discover` succeeding, so a gate
failure blocks the entire dispatch.

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

Every workflow layer declares the union as its job permissions:
`run-agent.yml`, the shared `dispatch-core.yml`, and both entry points
(`dispatch-pr.yml`, `dispatch-schedule.yml`). Manifests that omit the
`permissions:` field get the same union (the runner runs with those scopes;
the validator is permissive about absence).

Every layer also grants `actions: read` — **not** an agent-requestable tier,
so it is absent from `SUPPORTED_PERMISSIONS`. It exists purely so the
upstream-artifact step (`gh run download` in `run-agent.yml`) can hit the
Actions API; without it, any `needs:`-based chain fails the download with a
403. Because a reusable workflow's token is capped by its caller, the grant
must appear at **every** caller layer (entry point → core → runner), not just
`run-agent.yml`. Don't remove it while `needs:`-based chaining exists.

The trust gate (`pr-trust-gate`) needs no extra tier — it reads PR files with
the existing `pull-requests` scope. `issues: write` is **not** in the set; the
deferred `issue` output channel would add it (see the scheduled-agents archive).

To add a new tier (e.g., `contents: write` for spec-edit agents that
commit to `specs/`):

1. Add it to `SUPPORTED_PERMISSIONS` in `match-agents.py`.
2. Grant it in every workflow layer's top-level `permissions:`
   (`dispatch-pr.yml`, `dispatch-schedule.yml`, `dispatch-core.yml`,
   `run-agent.yml`).
3. Document the new tier in this section + `AGENT_REFERENCE.md` → *Tool tiers*.

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

**Filters apply to PR events only.** They read `github.event.pull_request`,
which is absent for `schedule` / `workflow_dispatch` — so a scheduled agent
matches purely on the trigger, and its analyzed branch is controlled by
`analysis_ref` (and the workflow's checkout), not by a `branches:` filter.

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

## Security model (ADR-0005)

The framework's CI AI-agent threat model is
[`adr/0005-ci-ai-agent-threat-model.md`](https://gitlab.deltixhub.com/Deltix/openai-apps/poc/ai-native-sdlc-framework/-/blob/master/adr/0005-ci-ai-agent-threat-model.md).
This platform is its "Worked example 2 — orchestrator." The trust boundary
hinges on **where the PR branch lives, not the trigger name**:

- **Internal** (same-repo branch, `pull_request`) — author had write access ⇒
  trusted. Baseline controls only. **This is the current tier.**
- **External** (fork) under `pull_request_target` — untrusted; requires the
  full M1–M6 stack.

### Round-0 trust gate (`pr-trust-gate`)

Runs first in `dispatch-core.yml`; `discover` depends on it. Two controls:

- **Fork gate (M1):** classifies the PR source — trusted if same-repo branch /
  `author_association ∈ {OWNER,MEMBER,COLLABORATOR}` / a configured
  `trust_label` is present; otherwise a fork. Hard-blocks untrusted PRs by
  default (`fail_on_untrusted: true`), or emits a `trusted` output for
  fork-facing flows to branch on.
- **M2 reject:** fails the run if the PR diff touches **agent-trust paths**
  (`.claude/**`, `**/CLAUDE.md`, `.mcp.json`, `.claude.json`,
  `.github/workflows/**`, `.github/actions/**`, **`agents/**`**) or adds
  symlinks. `agents/**` is in the set because a manifest drives `tools.extra` /
  `secrets:` / `allowed_tools` — an orchestrator-specific trust surface the
  ADR's generic list omits.

The gate is a **no-op for `schedule` / `workflow_dispatch`** (no PR, trusted
default branch).

### M2 scrub — overlay exclusions

The `analysis_ref` overlay (below) excludes `.github` / `.claude` / `agents`,
so an overlaid ref's trust files are never mounted. This is the "scrub before
mount" half of M2, enforced structurally rather than by step ordering.

### M4 output post-processor (`scrub-output.py`)

Deterministic, LLM-free, fail-closed gate on the rendered **public** body
before any posting step:

- **Secret scan** → fails the stage (nothing posted) on `sk-ant-` / `sk-` /
  `AKIA|ASIA` / `ghp_` / `github_pat_` / Slack / JWT / PEM, plus a guarded
  high-entropy backstop (skips git SHAs / numeric ids). Stops "Comment and
  Control" credential exfiltration.
- **URL/HTML neutralize** → strips zero-click images, non-allowlisted links,
  bare autolinks, and outbound-capable HTML tags; allowlists the GitHub host so
  the run-details footer survives.

For `private_output` agents the public surface is **counts-only aggregate**, a
stronger-than-M4 control (no free text reaches the public surface at all), so
M4 primarily guards non-private agents.

### Baseline (all tiers)

SHA-pin every `uses:`; per-agent kill switch; **persist input AND output** as
audit artifacts (`stage-input-<name>`, `stage-output-<name>`); structured
output + advisory verdict (no auto-merge — M6).

### Flipping to `pull_request_target`

`pull_request_target` loads the workflow + secrets from the base branch, so PR
runs get the framework from base natively (the sandbox-base host becomes
unnecessary). But it puts secrets in scope for fork PRs — crossing into the
untrusted tier. Activation checklist: set `trust_label` + `fail_on_untrusted:
false` on the gate; pin PR-head overlays to `head.sha` (not `head.ref`); lock
the agent tool surface (M3 — no `Bash`/`WebFetch`/`WebSearch`/MCP on fork
flows); migrate the inference key to OIDC (ADR-0004). Until then the platform
stays on internal-only `pull_request`.

---

## Analysis-ref overlay

When a manifest declares `analysis_ref: <branch>`, the agent inspects **that
ref's code** instead of the triggering checkout — so a batch agent can run
*from* the default branch while triaging findings scanned against another
branch. `run-agent.yml`:

```bash
git fetch --depth=1 origin "$ANALYSIS_REF"
git checkout FETCH_HEAD -- . ':(exclude).github' ':(exclude).claude' ':(exclude)agents'
# capture FETCH_HEAD sha → ANALYSIS_SHA / ANALYSIS_REF_FULL for SARIF scoping
```

It is an **overlay, not a checkout**: the analyzed ref's source replaces the
working tree *except* the framework paths (`.github`, `.claude`, `agents`),
which would otherwise be stripped (they live only on the framework branch). The
exclusions double as the **security boundary** — the analyzed ref can supply
inert source for the agent to read, but never a skill, workflow, action, or
manifest the platform would execute. The captured SHA scopes any `emit_sarif`
upload to the scanned commit.

Limitations: branch tips only (`refs/heads/<ref>`); single ref per agent; the
overlay is uncommitted, so an agent's `git diff` shows it as changes vs the base
HEAD.

---

## Private output, SARIF, and the public surface

Three manifest fields control how a sensitive agent's output is handled (this
repo is **public**, so artifacts and the job summary are world-readable):

- **`private_output: true`** — `stage-output.json` is AES-encrypted
  (`openssl`, key from `SDLC_ARTIFACT_KEY`) before upload; plaintext is consumed
  on the runner first (render / SARIF / aggregate) then removed. A downstream
  agent's `run-agent.yml` decrypts the upstream `.enc` artifact it consumes.
  The input audit artifact is encrypted the same way.
- **Aggregate public surface** — instead of a full sticky comment, sensitive
  agents publish **counts only** (`findings-aggregate.py`) to the Actions **job
  summary**. No file paths or per-finding verdicts on the public surface.
- **`emit_sarif: true`** — converts `payload.findings[]` to SARIF 2.1.0 and
  uploads to GitHub code scanning (the Security tab, a write-gated surface),
  scoped to `analysis_ref`'s branch/commit. Non-actionable verdicts upload as
  dismissed. Currently paused for the snyk chain while encryption + the
  aggregate surface are validated.

Non-private agents keep the full path: M4-scrubbed sticky PR comment + full job
summary + plaintext artifact.

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

1. Composite action composes the prompt (4 placeholders: `{{stage}}`,
   `{{skill}}`, `{{base_ref}}`, `{{upstream_inputs}}`) and the agent-facing
   schema.
2. `anthropics/claude-code-action` runs Claude; tool calls stream live
   (no buffering since no `--json-schema`).
3. **Persist input** — the composed prompt + schema upload as
   `stage-input-<name>` (encrypted for `private_output`), with `always()` so a
   failed run is still auditable.
4. Agent uses the `Write` tool to save its JSON to `stage-output.json`.
   `Write` is appended to `allowed_tools` automatically.
5. "Verify stage-output.json" confirms the file exists (it does **not** cat the
   contents — public repo, world-readable logs).
6. `render-stage-comment.py` validates required fields, injects envelope,
   renders the sticky-comment body.
7. **M4 scrub** (`scrub-output.py`, non-private agents) — secret scan
   (fail-closed) + URL/HTML neutralize on the rendered body; posting steps
   consume the scrubbed output.
8. **`emit_sarif`** (if enabled) → `findings-to-sarif.py` → Security tab,
   scoped to `analysis_ref`.
9. **Aggregate** (`private_output` agents) → counts-only to the job summary.
10. **Encrypt** (`private_output`) → `stage-output.json.enc`, plaintext removed.
11. `upload-artifact` ships `stage-output-<name>` (plaintext or `.enc`,
    90-day retention).
12. Non-private agents: full job summary + sticky PR comment (scrubbed body)
    via `gh api`.

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
`stage-output-{name}` and kept for 90 days (the composed input prompt is
uploaded alongside as `stage-input-{name}`). For `private_output` agents both
are AES-encrypted; `run-agent.yml` decrypts an upstream's `.enc` artifact
before a downstream agent reads it. The composite action handles all of this;
agents don't add anything per-stage.

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

- A new event trigger beyond those wired (`pull_request`, `schedule`,
  `workflow_dispatch` are done — see *Dispatch architecture*). A new one
  (`workflow_run`, `repository_dispatch`) needs a new entry-point workflow
  delegating to `dispatch-core.yml`; the core + matcher already handle any
  `github.event_name`.
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