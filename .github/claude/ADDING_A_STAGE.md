# Adding a Stage to the DIAL SDLC Pipeline

This is the team-facing recipe for adding a new Claude-powered stage. If you
follow the conventions below, the new stage should take ~15–20 minutes to
wire up and reviewers don't have to re-read the whole orchestrator.

For the architectural background, see
[`dial-claude-sdlc-orchestration.md`](../../dial-claude-sdlc-orchestration.md)
and the research companion
[`dial-claude-sdlc-orchestration-research.md`](../../dial-claude-sdlc-orchestration-research.md).

---

## File layout

```
.github/
├── actions/run-claude-stage/action.yml   # composite action; do not edit per-stage
├── claude/
│   ├── prompts/
│   │   ├── _template.md                  # starter prompt — copy this
│   │   └── {stage-name}.md               # one per stage
│   ├── schemas/stage-message.schema.json # output contract
│   ├── scripts/render-stage-comment.sh    # validates Claude's output
│   └── ADDING_A_STAGE.md                 # this doc
└── workflows/
    ├── pr-workflows-orchestrator.yml     # routing only; register your stage here
    ├── stage-security-review.yml         # specialized: uses claude-code-security-review
    ├── stage-code-review.yml             # generic Claude stage — reference example
    └── stage-{name}.yml                  # one per generic stage
```

Two stage shapes exist:

- **Generic Claude stage** — the common case. Custom prompt + tool allowlist.
  Driven by the composite action `run-claude-stage`. `stage-code-review.yml` is the
  reference. **Use this for new stages.**
- **Specialized action stage** — when a purpose-built Action exists (Trivy,
  `claude-code-security-review`, etc.). `stage-security-review.yml` is the reference.
  Documented exception; don't copy unless you also have a specialized action.

---

## Framework relationship

This repo is the first consumer of the
[`ai-native-sdlc-framework`](https://gitlab.deltixhub.com/Deltix/openai-apps/poc/ai-native-sdlc-framework).
Several artifacts here are **framework-bound** — designed to move upstream
once the abstractions are stress-tested against more stages. Until then,
they live here as the canonical version; downstream changes happen here
first, framework PRs come later.

**Framework-bound** (extracted when stage #3 lands, or after ~4 weeks of
use, whichever comes first):

- `.github/actions/run-claude-stage/` — composite action
- `.github/claude/scripts/render-stage-comment.sh`
- `.github/claude/schemas/stage-message.schema.json`
- `.github/claude/prompts/_template.md`
- `.github/claude/ADDING_A_STAGE.md` *(this file)*
- The three `dial-claude-sdlc-orchestration*.md` design docs at the repo root

**Consumer-local** (stays in this repo permanently):

- `.github/workflows/pr-workflows-orchestrator.yml`
- `.github/workflows/stage-{name}.yml`
- `.github/claude/prompts/{name}.md`
- `STAGE_*_ENABLED` repo variables
- The skills under `.claude/skills/` that stage prompts wrap

Keep the framework-bound surface deliberately generic — no DIAL-specific
names, paths, or assumptions. When the extraction happens, it should be a
mechanical `git mv` + `s/dial-//` on the doc filenames, not a refactor.

---

## The 6-step recipe

### 1. Pick a name

kebab-case. Examples: `spec-review`, `threat-model`, `test-gen`, `conformance`.

This name appears in five places, all mechanically:

- workflow filename: `.github/workflows/stage-{name}.yml`
- prompt filename: `.github/claude/prompts/{name}.md`
- orchestrator job key: `{name}:`
- composite action `stage_name` input
- the `stage` field your Claude run writes into `stage-output.json`

### 2. Write the prompt

Copy `_template.md` and edit:

```bash
cp .github/claude/prompts/_template.md .github/claude/prompts/{name}.md
```

Replace the `<...>` placeholders. Keep the **Output contract** section intact —
the composite action depends on it.

**If you're wrapping a ready skill** (local skill in `.claude/skills/` or a
marketplace plugin), the prompt body is usually 5 lines:

```markdown
1. Invoke `/your-skill-name` against the PR diff.
2. Map the skill's findings into the schema below.
```

See `prompts/code-review.md` for a worked example using
`/code-review-and-quality`.

### 3. Pick a permission tier

Stages must use a published tier; do not invent free-form `allowed_tools`
strings. Append `,Skill` when the stage uses a Claude skill.

| Tier | `allowed_tools` value |
|---|---|
| `read-only` | `Read,Grep,Glob,mcp__dial-context__*` |
| `read-only + skill` | `Read,Grep,Glob,Skill,mcp__dial-context__*` |
| `read-only + git diff` | `Read,Grep,Glob,Bash(git diff:*)` |
| `read-only + git diff + skill` | `Read,Grep,Glob,Bash(git diff:*),Skill` |
| `spec-edit` | read-only + `Edit` scoped to `specs/` |
| `docs-edit` | read-only + `Edit` scoped to `docs/` |
| `test-edit` | read-only + `Edit` scoped to test paths + Bash for test runner |

Rule: minimize. If the skill only needs `Read,Grep`, don't grant `Bash` "just
in case." Tier choices are reviewable in `stage-{name}.yml`.

### 4. Copy the stage skeleton

Use `stage-code-review.yml` as the template:

```bash
cp .github/workflows/stage-code-review.yml .github/workflows/stage-{name}.yml
```

oChange three things:

- `name:` header: `SDLC Stage / {Display Name}`
- `stage_name:` input on the composite action: `{name}`
- `concurrency.group`: replace the literal `code-review` with `{name}`

Set `allowed_tools` to the tier you picked. The rest of the file is identical
across stages — do not edit it without a follow-up to this doc. The skeleton
already handles concurrency (cancels stale runs on rapid pushes), artifact
upload (90-day retention of `stage-output.json`), and sticky-comment posting.

### 5. Register in the orchestrator

Add a job in `.github/workflows/pr-workflows-orchestrator.yml`:

```yaml
{name}:
  if: vars.STAGE_{NAME_UPPER}_ENABLED != 'false'
  uses: ./.github/workflows/stage-{name}.yml
  secrets: inherit
```

Replace `{NAME_UPPER}` with the stage name uppercased and hyphens converted
to underscores (e.g. `code-review` → `CODE_REVIEW`, `threat-model` →
`THREAT_MODEL`). The `if:` is the **kill switch**: by default the variable
is absent and the stage runs; DevOps disables a misbehaving stage instantly
by setting the corresponding repo or org variable to `false` in the GitHub
UI — no revert PR required.

Every enabled stage runs on every PR against `development-1.0`. There is no
per-stage label gate. If you need conditional execution beyond the kill
switch, prefer `paths:` filters on the orchestrator's `pull_request:` block
over per-job `if:` expressions.

If your stage depends on another (e.g. `test` should only run after
`conformance` passes), add `needs:` and gate on the prior stage's
`outputs.status`:

```yaml
test:
  needs: conformance
  if: |
    vars.STAGE_TEST_ENABLED != 'false' &&
    needs.conformance.outputs.status != 'failed'
  uses: ./.github/workflows/stage-test.yml
  secrets: inherit
```

### 6. Test it

1. Open a draft PR against `development-1.0`.
2. The orchestrator dispatches every registered stage; the composite action
   posts a sticky comment keyed on `<!-- dial-sdlc:{name} -->`.
3. Push a new commit. The same comment updates in place rather than appending.

If the stage fails because Claude didn't write `stage-output.json`, that's a
prompt problem — re-read the **Output contract** section of your prompt.

---

## Using a ready skill

A "ready skill" is a packaged Claude skill that already implements the work
your stage needs. Two sources today:

1. **Local skill** — already in this repo at `.claude/skills/{skill}/`.
   Available automatically after `actions/checkout`. Reference it as
   `/{skill}` in your prompt. **Default for new stages.**
2. **Inlined skill** — copy the skill's `SKILL.md` content into your stage
   prompt. Drops the skill mechanism. Use when the skill is purely a prompt
   and you want zero external dependencies.

### Local skill (path 1)

```yaml
- id: stage
  uses: ./.github/actions/run-claude-stage
  with:
    stage_name: code-review
    allowed_tools: "Read,Grep,Glob,Bash(git diff:*),Skill"
```

And in `prompts/code-review.md`:

```markdown
1. Invoke `/code-review-and-quality` against the PR diff.
2. Map the skill's findings into the schema below.
```

### Trust posture for any external skill

- Review `SKILL.md` and any bundled scripts at adoption time.
- Use the smallest `allowed_tools` set the skill documents needing.
- If the skill bundles MCP servers, treat those as additional external
  dependencies and review the same way.

> Marketplace plugins (e.g. `code-review@claude-plugins-official`) are
> supported by `anthropics/claude-code-action` but not wired into our
> composite action yet. Add the `plugin_marketplaces` + `plugins` inputs
> when the first real marketplace stage arrives; until then, the composite
> stays simple.

---

## Output contract — what the stage must write

Every generic Claude stage writes **`stage-output.json`** at the repo root
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
  "spec_id": "issue-4521",
  "spec_version": "1.2",
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
  "next_recommended": ["dev:apply_fix"],
  "cost_usd": 0.31
}
```

The `render-stage-comment.sh` script validates required fields and fails the
job loudly if the payload is malformed or missing.

### Envelope fields — auto-injected, do not write

The platform injects four fields into `stage-output.json` after the stage exits
but before validation:

- `contract_version` — the schema contract version (currently `"0.1"`).
- `agent_version` — the stage/agent version from the workflow's `agent_version`
  input (defaults to `"unknown"`).
- `run_id` — `$GITHUB_RUN_ID`, the correlation ID across logs and artifacts.
- `trigger` — `{ event, ref, sha }` from the workflow context.

**Stages must not write these fields.** Any values you provide are overwritten
by the platform. This keeps the envelope authoritative regardless of which
stage produced the payload.

The artifact (`stage-output-{name}`) contains the envelope-enriched JSON, not
the raw output Claude wrote — downstream consumers always see the complete
shape.

---

## Context tiers — what workspace the stage sees

Adopted from the `ai-native-sdlc-framework` ADR-0001. Three tiers describe how
much of the world a stage's runner can read:

| Tier | Workspace | When to use |
|---|---|---|
| **A** | The triggering repo only (single `actions/checkout`) | Default for PR-triggered stages — code review, security review, conformance. |
| **B** | Triggering repo + one or more sibling repos via additional `actions/checkout` steps with pinned SHA | When the spec lives in a separate repo, or a stage must verify against a vendored library |
| **C** | A prebuilt context bundle (versioned tarball) produced by an upstream job | Heavy or scheduled runs that assemble inputs once and reuse them; avoids re-cloning expensive corpora |

The current `stage-code-review.yml` skeleton is tier A. Promoting a stage to
tier B is purely additive: add another `actions/checkout` step with the
sibling repo and a pinned SHA, plus a cross-repo token (PAT, GitHub App
installation token, or OIDC). Tier C requires a producer job — outside the
scope of this doc.

**Note on tokens for tier B.** Cross-repo `contents: read` requires a token
the stage's `GITHUB_TOKEN` doesn't have. Use a GitHub App installation token
or a fine-grained PAT scoped to read-only on the target repo.

---

## Cross-run state — reading a prior stage's output

Every stage's `stage-output.json` is uploaded as a workflow artifact named
`stage-output-{stage-name}` and kept for 90 days. The composite action
handles the upload; you don't add anything per-stage to produce it.

Two ways another job or workflow can consume that artifact:

### Same workflow run

Stages in the same orchestrator run should use `needs.{job}.outputs.message`
— it's strictly cheaper than going through the artifact store.

### Different workflow run (cross-commit on the same PR, or another workflow)

Use `actions/download-artifact@v4` and the GitHub API to find the prior run:

```yaml
- name: Find prior orchestrator run on this PR
  id: prior
  env:
    GH_TOKEN: ${{ github.token }}
    PR_NUMBER: ${{ github.event.pull_request.number }}
    HEAD_SHA: ${{ github.event.pull_request.head.sha }}
  run: |
    PRIOR_RUN_ID=$(gh api \
      "repos/${{ github.repository }}/actions/workflows/pr-workflows-orchestrator.yml/runs?event=pull_request&status=completed" \
      --jq ".workflow_runs[] | select(.pull_requests[]?.number==${PR_NUMBER}) | select(.head_sha!=\"${HEAD_SHA}\") | .id" \
      | head -n1)
    echo "run-id=${PRIOR_RUN_ID}" >> "$GITHUB_OUTPUT"

- name: Download prior security-review output
  if: steps.prior.outputs.run-id != ''
  uses: actions/download-artifact@v4
  with:
    name: stage-output-security-review
    path: prior-runs/
    run-id: ${{ steps.prior.outputs.run-id }}
    github-token: ${{ github.token }}

- name: Compare findings
  if: steps.prior.outputs.run-id != ''
  run: |
    jq -s '.[0].findings as $prev | .[1].findings as $curr
           | { regressions: ($curr - $prev), fixed: ($prev - $curr) }' \
       prior-runs/stage-output.json stage-output.json
```

Use this pattern when a stage needs to **compare against a prior commit's
result** on the same PR — e.g. "did this commit introduce a new
high-severity finding the previous commit didn't have?" The artifact is
the durable form; the sticky comment is the human-readable form.

**Do not** parse the sticky PR comment to recover prior state. The
sticky comment is for humans; the artifact is for machines. Mixing the
two creates an implicit contract on the comment shape that nobody
will remember to maintain.

### When artifacts run out

Artifacts are scoped to a single repo and indexed by workflow run, not by
PR or change. They cover:

- Cross-run within one repo — yes
- 90-day audit trail — yes
- Cross-repo coordination — no
- Cross-PR queries (`show me all security findings this week`) — no, you'd be
  scraping the artifact list

When those limits become real, see
[`dial-claude-sdlc-orchestration-app.md`](../../dial-claude-sdlc-orchestration-app.md).

---

## What you do *not* have to know

- How to wire `outputs:` between jobs — the skeleton handles it.
- How to post sticky PR comments — composite action handles it.
- How to validate Claude's output — script handles it.
- How `secrets:` flow into the stage — orchestrator passes `secrets: inherit`;
  the stage puts `ANTHROPIC_API_KEY` into env once, composite reads it.

## What requires a doc update (not just a YAML change)

- Adding a new `permission tier` to the table above.
- Adding a new event source to the orchestrator (e.g. `workflow_dispatch`,
  `issues`). Affects routing semantics for the whole pipeline.
- Changing the sticky-comment format (`render-stage-comment.sh`).
- Changing the JSON schema (`stage-message.schema.json`).

If your change touches any of those, update this doc and the design doc in
the same PR.