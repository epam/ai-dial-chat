---
name: spec-validation
description: Validates that OpenSpec specs and the PR's code changes stay consistent. Use during PR review when `openspec/` is the active spec system; flags missing specs, divergence, and drift.
---

# Spec Validation

## Overview

Validate that a pull request's spec artifacts (under `openspec/`) and the
PR's code changes stay consistent. Three layers, run in order:

1. **Structural floor (deterministic)** — `openspec validate --strict --all`
   catches malformed `openspec/changes/*` and `openspec/specs/*` with zero
   LLM cost.
2. **Judgment pass (LLM)** — `/opsx:verify <change>` runs the
   completeness/correctness/coherence rubric per touched change.
3. **Drift check (LLM)** — answer one question: did the PR change behavior
   under `libs/`, `apps/`, or `packages/` that should have updated a spec
   under `openspec/specs/` but didn't?

## When to use

- During PR review when `openspec/` is the active spec system in this repo.
- Before approving a change that touches both `openspec/` and source code.
- Before archiving a change (use `/opsx:verify <name>` directly for that).

## Inputs

- Working tree: the current checkout (repo root). Use `Read` / `Grep` /
  `Glob` tools to inspect — do NOT reference `$GITHUB_WORKSPACE` in
  Bash commands (Claude Code's Bash tool denies shell-variable
  expansion).
- PR diff: the agent-wrapper prompt provides the exact `git diff`
  command with the literal base ref already substituted. Use that
  command verbatim. Do NOT re-introduce `${GITHUB_BASE_REF}` — it
  will be denied.
- Spec workspace: `openspec/` — config at `openspec/config.yaml`,
  active changes under `openspec/changes/`, living specs under
  `openspec/specs/`. Use the `Read` tool to inspect specific files.

## Process

### 1. Structural floor

Run the OpenSpec CLI validator:

```bash
openspec validate --strict --all
```

Any non-zero exit is a `high`-severity finding — record stderr verbatim in
the finding's `message`. Do not proceed to step 2 until you have noted the
result.

### 2. Judgment pass (per touched change)

Determine which OpenSpec changes are in scope for this PR:

1. Use the literal `git diff --name-only` command provided by the
   agent-wrapper prompt (it substitutes the actual base ref — never
   re-introduce `${GITHUB_BASE_REF}`; the Bash tool denies commands
   containing shell variable expansion).
2. Parse the file list **in-Claude**: pick entries whose path starts
   with `openspec/changes/`, extract the change-name segment (the path
   component immediately after `openspec/changes/`), deduplicate.
3. Do NOT pipe through bash `grep`/`awk`/`sort` — those are not in
   `allowed_tools`. Use the Grep tool (or just iterate the list in
   reasoning) instead.

For each touched change:

1. Invoke `/opsx:verify <change-name>`.
2. Map every issue to one entry in `findings[]`. Severity mapping:
   - CRITICAL → `high`
   - WARNING → `medium`
   - SUGGESTION → `low`

   Preserve verbatim; do not downgrade.
3. Cite file paths and line ranges from `openspec/specs/<capability>/spec.md`
   (or the touched delta) for each finding. If you cannot point at a real
   line range, demote the finding one severity step.

If no `openspec/changes/` paths are in the diff, skip step 2 entirely.

### 3. Drift check

Answer one question explicitly, regardless of step 2's result:

> Did this PR touch behavior under `libs/`, `apps/`, or `packages/` that
> should have updated a spec under `openspec/specs/` but didn't?

Use `Grep` and `Read` to compare touched source files against the living
specs that name them or their capability. If you find likely drift:

- Add a `medium`-severity finding with `file` set to the source file and
  `message` describing what spec it likely belongs to.
- Be conservative — prefer `low` over `medium` when uncertain.

## Output

When invoked from a SDLC agent:

- Emit each finding as one entry under `payload.findings[]` with
  `{severity, file, line?, message, suggested_fix?}`.
- Set `status` to `"passed"` (no findings), `"passed_with_findings"`
  (only `info`/`low`/`medium`), or `"failed"` (any `high` or `critical`).
- `summary` is one short line, e.g.
  `"2 medium findings; add-auth missing scenario coverage; no structural errors"`.

When invoked interactively, return a markdown report grouped by severity.

## Heuristics

- **Cite line ranges.** Anchor every finding to a real spec line range, or
  demote it. Hallucinated citations are the highest-cost failure mode.
- **Be conservative.** When uncertain about drift, prefer `low` over
  `medium`; prefer `medium` over `high`.
- **Don't conflate concerns.** Structural errors (step 1) and judgment
  issues (step 2) and drift (step 3) are different findings — file them
  separately even if they touch the same file.

## Required tools

- `Bash(openspec:*)` — to run the CLI and helper subcommands.
- `Bash(git diff:*)` — to enumerate touched paths.
- `Read`, `Grep` — to compare source against specs in step 3.
- `Skill` — to invoke `/opsx:verify`.