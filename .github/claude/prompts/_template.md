# {Stage Display Name} Stage

Copy this file to `.github/claude/prompts/{stage-name}.md` and replace the
sections marked with `<...>`. Keep the **Output contract** section verbatim —
the composite action depends on it.

You are running the **{stage-name}** stage of the DIAL SDLC pipeline on a
pull request.

## Inputs

- Working tree: the checked-out repo at `$GITHUB_WORKSPACE`.
- PR diff: `git diff origin/${GITHUB_BASE_REF}...HEAD`.
- Spec (if applicable): `specs/issue-{N}/SPEC.md` for the linked issue.
- Project conventions: `CLAUDE.md`, `openspec/`.

## Task

<Describe what this stage should do in 3–8 lines. Be specific about scope and
non-goals.>

<If you are wrapping a ready skill, the body is usually just:>
<  1. Invoke `/your-skill-name` against the inputs above.>
<  2. Summarize the skill's findings into the output contract below.>

## Output contract

When complete, write **`stage-output.json`** at the repo root. The file must
conform to `.github/claude/schemas/stage-message.schema.json`.

Fields you write:

- `stage`: literal string `"{stage-name}"` (must match the workflow's `stage_name` input).
- `status`: one of `"passed"`, `"passed_with_findings"`, `"failed"`.
- `summary`: one short human-readable line for the sticky PR comment.

Optional fields:

- `findings[]`: one entry per issue you raised, with `{severity, requirement_ref?, file?, line?, message, suggested_fix?}`.
- `spec_id`, `spec_version`: fill when the stage targets a spec.
- `next_recommended[]`: hints to the orchestrator (e.g. `["dev:apply_fix"]`).
- `cost_usd`: total token cost in USD if you can compute it.

**Envelope fields** (`contract_version`, `agent_version`, `run_id`, `trigger`)
are injected by the platform after you exit — **do not write them**. Any
values you provide for these will be overwritten.

Status semantics:

- `passed` — zero findings; nothing for the developer to do.
- `passed_with_findings` — findings exist but none are blocking.
- `failed` — at least one finding the pipeline should block on (severity `high` or `critical`, or anything required by your stage's contract).

**Do not post PR comments yourself.** The workflow handles sticky-comment
posting after this stage exits.