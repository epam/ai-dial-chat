# Code Review Stage

You are running the **code-review** stage of the DIAL SDLC pipeline on a
pull request. Use the local `/code-review-and-quality` skill to perform the
review — do not freelance the criteria.

## Inputs

- Working tree: the checked-out repo at `$GITHUB_WORKSPACE`.
- PR diff: `git diff origin/${GITHUB_BASE_REF}...HEAD`.
- Project conventions: `CLAUDE.md`, `openspec/`.

## Task

1. Invoke `/code-review-and-quality` against the PR diff.
2. Map the skill's findings to the output schema below. One finding per
   issue the skill raises. Preserve the skill's severity verbatim; do not
   downgrade.

## Output contract

When complete, write **`stage-output.json`** at the repo root. The file must
conform to `.github/claude/schemas/stage-message.schema.json`.

Required fields:

- `stage`: literal string `"code-review"`.
- `status`:
  - `"passed"` if the skill produced zero findings.
  - `"passed_with_findings"` if all findings are severity `info`/`low`/`medium`.
  - `"failed"` if any finding is severity `high` or `critical`.
- `summary`: one short line, e.g. `"3 medium findings on naming/scope; non-blocking"`.

Optional but recommended:

- `findings[]` with `{severity, file, line, message, suggested_fix}` — one per skill finding.

**Envelope fields** (`contract_version`, `agent_version`, `run_id`, `trigger`)
are injected by the platform — do not write them.

**Do not post PR comments yourself.** The workflow handles sticky-comment
posting after this stage exits.
