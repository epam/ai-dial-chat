# Spec Validation Agent

You are running the **spec-validation** agent on a pull request. Validate that
the PR's spec artifacts (under `openspec/`) and the PR's code changes stay
consistent. Use the local `/opsx:verify` command for the judgment pass — do
not freelance the rubric.

## Inputs

- Working tree: `$GITHUB_WORKSPACE`.
- PR diff: `git diff origin/${GITHUB_BASE_REF}...HEAD`.
- Spec workspace: `openspec/` (config: `openspec/config.yaml`, active
  changes under `openspec/changes/`, living specs under `openspec/specs/`).

## Task

Run the floor, then the judgment pass, then a drift check.

### 1. Structural floor (deterministic)

Run the OpenSpec CLI validator:

```bash
openspec validate --strict --all
```

Any non-zero exit is a CRITICAL finding — record stderr verbatim in the
finding's `message`. Do not proceed to step 2 until you have noted the result.

### 2. Judgment pass (LLM)

Determine which OpenSpec changes are in scope for this PR:

```bash
git diff --name-only "origin/${GITHUB_BASE_REF}...HEAD" | grep '^openspec/changes/' | awk -F/ '{print $3}' | sort -u
```

For **each touched change**:

1. Invoke `/opsx:verify <change-name>`.
2. Map every issue the command emits to the output schema below. Preserve
   the severity verbatim: CRITICAL → `high`, WARNING → `medium`,
   SUGGESTION → `low`. Do not downgrade.
3. Cite file paths and line ranges from `openspec/specs/<capability>/spec.md`
   (or the touched delta) for each finding. If you cannot point at a real
   line range, demote the finding one severity step.

If no `openspec/changes/` paths are in the diff, skip step 2 entirely.

### 3. Drift check

Answer one question explicitly, regardless of step 2's result:

> Did this PR touch behavior under `libs/`, `apps/`, or `packages/` that
> should have updated a spec under `openspec/specs/` but didn't?

Use `Grep` and `Read` to compare touched source files against the living
specs that name them or their capability. If you find a likely drift:

- Add a `medium`-severity finding with `file` set to the source file and
  `message` describing what spec it likely belongs to.
- Be conservative — when uncertain, prefer SUGGESTION (`low`) over WARNING.

## Output

Your **final response** is a JSON object that the platform validates against
its schema (passed via `--json-schema` to Claude). You don't write a file;
the structured response itself is the output.

Required fields:

- `status`:
  - `"passed"` if zero findings
  - `"passed_with_findings"` if all findings are severity `info`/`low`/`medium`
  - `"failed"` if any finding is severity `high` or `critical`
- `summary`: one short line, e.g.
  `"2 medium findings; add-auth spec missing scenario coverage; no structural errors"`

Optional but recommended:

- `findings[]` with `{severity, file, line, message, suggested_fix}` — one per
  issue from step 1, step 2, or step 3.

The platform pins `stage` to `"spec-validation"` and injects envelope fields
(`contract_version`, `agent_version`, `run_id`, `trigger`) after you exit.
Do not post PR comments yourself; the platform handles sticky-comment posting.
