---
name: refactoring-audit
description: >-
  Deep codebase refactoring audit for AI DIAL Chat. Collects metrics, compares
  with prior local plans, and writes or updates refactoring-backend.md,
  refactoring-frontend.md, and refactoring.md index docs (git-excluded). Use when
  the user asks for a refactoring plan, tech-debt review, god-module analysis,
  architecture audit, or updated refactoring documents.
context: fork
---

# Refactoring audit

Produce **local-only** refactoring plans for this monorepo. Output is planning material for humans — not code changes unless the user explicitly asks to implement something.

**Language:** All audit outputs MUST be written in **English**.

## Stability rule — no pinned source paths in skill docs

This skill, its templates, and `repo-rules-checklist.md` describe **patterns, thresholds, and grep commands** — not specific source file paths. File paths move, split, and get deleted; hardcoded paths in instructions go stale.

- **Skill artifacts** → patterns + metrics only.
- **Audit output docs** (`refactoring*.md`) → list paths **discovered during the current run** (from `collect-metrics.sh` + reads). Regenerate tables each audit; do not copy example paths from templates.
- **Phase milestones** → verify with grep/counts (see Step 4), not memorized filenames.

## Outputs (never commit)

| File                               | Scope                                   |
| ---------------------------------- | --------------------------------------- |
| `refactoring.md`                   | Index + scorecard                       |
| `refactoring-backend.md`           | `apps/chat-api`                         |
| `refactoring-frontend.md`          | `apps/chat` + hand-authored `libs/*`    |
| `docs/{change}-openspec-prompt.md` | Only if user wants next OpenSpec prompt |

**Git rule:** These files MUST stay out of git. After writing, ensure each path is listed in `.git/info/exclude`. Run `git check-ignore -v <file>` and confirm `git ls-files` does not list them. **Never** `git add` refactoring docs. Do not add them to `.gitignore` unless the user explicitly wants team-wide ignore rules in the repo.

## When to use

- User asks for refactoring plan, tech-debt review, or codebase analysis
- User asks to refresh refactoring docs after major merges/archives
- User wants backend vs frontend debt split
- Periodic audit (compare with previous `refactoring*.md` date and Δ line counts)

## Prerequisites

Read before analyzing:

- `openspec/config.yaml` — stack, architecture, lib isolation
- `AGENTS.md` — skill routing, RTL, Nx conventions
- Previous local docs if they exist (`refactoring.md`, `refactoring-backend.md`, `refactoring-frontend.md`)
- Archived OpenSpec for completed refactors: `openspec/changes/archive/*split-*`, `*dial-core*`, `*dedupe*`

Invoke `./.agents/skills/nx-workspace/SKILL.md` if unsure about project names or targets.

## Workflow

Copy this checklist and track progress:

```
Refactoring audit:
- [ ] 1. Collect metrics
- [ ] 2. Read prior docs + OpenSpec archives
- [ ] 3. Deep dive (top entries from metrics — not a fixed file list)
- [ ] 3b. Structural smells pass (else-if ladders, key dispatch, large switches, nested ternaries)
- [ ] 3c. Convention violations pass (AGENTS.md / RTL / lib isolation / imports)
- [ ] 4. Verify completed phases from code (grep/counts, not memory)
- [ ] 5. Write/update three docs (English) — paths from this run only
- [ ] 6. Ensure .git/info/exclude
- [ ] 7. Optional: next OpenSpec prompt
- [ ] 8. Summarize for user
```

### Step 1 — Collect metrics

Run:

```bash
bash .claude/skills/refactoring-audit/scripts/collect-metrics.sh
```

This is the **primary source of truth** for which files to inspect. Treat every ranked list and smell section as the candidate set for Steps 3–3c.

Optionally run verification (note result in docs if WIP branch):

```bash
npm exec nx test chat-api
npm exec nx test chat
```

Supplement with targeted greps (see [repo-rules-checklist.md](repo-rules-checklist.md)):

```bash
npm exec nx show projects --type=lib
ls openspec/changes | rg -v '^archive$'
rg "extends AppService|MUST stay in sync" apps/chat-api apps/chat --glob "*.{ts,tsx}"
```

### Step 2 — Compare with prior audit

If previous docs exist:

- Carry forward **completed** items with OpenSpec archive evidence
- Compute **Δ** line counts for god modules that appear in **both** audits (match by path from prior doc + current metrics)
- Close items that landed (e.g. archived `split-files-service`, `split-use-dial-file-manager`)
- Do not revert completed checkboxes without code proof
- **Drop** prior-doc rows for files that no longer appear in metrics (refactored away)

If no prior docs: establish baseline; skip Δ column.

### Step 3 — Deep dive (metrics-driven)

**Do not** use a fixed checklist of filenames. Instead, for each area, read the **top N from Step 1** plus any smell/violation hits:

| Area                  | Source in metrics output               | Read depth                                            |
| --------------------- | -------------------------------------- | ----------------------------------------------------- |
| Backend services      | "Backend services (top 20)"            | Top 5 + any >400 lines not yet split                  |
| Backend tests         | "Backend test specs (top 15)"          | Specs >1000 lines tied to unsplit services            |
| Frontend app          | "Frontend app sources (top 25)"        | Top 5 components/hooks/contexts                       |
| Frontend tests        | "Frontend test specs (top 15)"         | Specs >1000 lines                                     |
| Libs                  | "Libs total LOC" + "Lib largest files" | Libs >5000 LOC or files >400 lines                    |
| Structural smells     | All smell sections                     | Every prod hit (exclude `*.spec.*` when prioritizing) |
| Convention violations | All violation sections                 | Every non-zero category; sample-read hits             |

While reading, classify **patterns** (god service, facade already split, dispatch ladder, etc.) — not whether a file matches a historical name.

**OpenSpec:** active changes + recent archives since last audit date.

### Step 3b — Structural smells pass (mandatory)

Uses metrics script output (see [repo-rules-checklist.md](repo-rules-checklist.md) for thresholds). For each hit, **read the file** and classify by **pattern type**:

| Pattern                                                          | Smell                            | Typical fix                                                     |
| ---------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| `for (…) { if (def.key === 'a') … else if (def.key === 'b') … }` | Stringly-typed registry dispatch | Handler map / resolver table co-located with config definitions |
| `else if` chain on enum/string (≥8 per file)                     | Open/closed violation            | Lookup object, strategy map, or polymorphism                    |
| `switch (x) { case … }` with ≥10 cases                           | Same                             | Discriminated union + handler record                            |
| Duplicate branch bodies (`typeof x === 'string' ? x : null`)     | Copy-paste dispatch              | Shared coerce helpers keyed by type                             |
| `a ? b : c ? d : e` on one line                                  | Nested ternary                   | `if/else`, early return, named intermediate, helper function    |

Document in **Structural smells** sections. Columns: path (from this run), pattern type, branch/count, suggested fix, priority (usually P2 unless actively growing). **Do not skip** small files when metrics flagged them.

### Step 3c — Convention violations pass (mandatory)

Cross-check against **AGENTS.md**, **openspec/config.yaml**, **eslint.config.mjs**, RTL rules. Full grep mapping: [repo-rules-checklist.md](repo-rules-checklist.md).

Use metrics script violation sections + anti-patterns grep. For each non-zero category, sample-read hits and document in **Convention violations** (path from this run, rule violated, detail, fix, priority).

**Do not** treat every grep hit as debt — confirm context (tests, generated code, documented exceptions). **Do** flag patterns that contradict documented architecture.

### Step 4 — Score phases honestly

Use the phase checklist in [templates.md](templates.md). Mark ✅ only with **grep/count evidence from this run**:

| Milestone      | How to verify (no fixed paths)                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DialCoreModule | `extends AppService` count = 0; `DialClientService` present under chat-api                                                                                    |
| Files split    | Files domain facade service <250 lines in metrics; multiple sub-services under same domain                                                                    |
| FM hook split  | Composer hook for file manager <300 lines; sibling sub-hooks in same folder                                                                                   |
| Phase 1.6 open | Inline file-manager open state in conversation view without shared hook — grep `isDialFileManagerOpen` vs `useDialFileManagerState` in conversation view area |

### Step 5 — Write documents

Follow section structure in [templates.md](templates.md). **English only.** Populate tables from **Step 1 output only** — templates show column shapes, not real paths.

Quality bar:

- Every god-module row includes **line count** from metrics
- Priorities P0–P3 with concrete next OpenSpec change names
- Separate backend vs frontend debt
- Name archived OpenSpec changes with dates when marking complete
- Include verification note if tests were not green

### Step 6 — Git exclude maintenance

Append to `.git/info/exclude` if missing:

```
refactoring.md
refactoring-backend.md
refactoring-frontend.md
docs/split-*-openspec-prompt.md
docs/*-openspec-prompt.md
```

Do not commit `.git/info/exclude` changes (it is local by design).

### Step 7 — Optional OpenSpec prompt

When user wants the next refactoring step or P0 item needs OpenSpec:

- Create `docs/{kebab-case-change}-openspec-prompt.md` (**English**)
- Use the prompt template in [templates.md](templates.md)
- Add path to `.git/info/exclude`

### Step 8 — User summary

Reply in **English** with:

- Audit date
- Top 3 backend + top 3 frontend debts (from current metrics)
- Top structural smell + convention categories (with counts; name paths only from this run)
- What closed since last audit
- Recommended next 2–3 actions (OpenSpec names)
- Confirm docs are git-excluded

## Analysis heuristics

**God module candidates:** service/hook/component >400 lines, or spec >1000 lines (from metrics).

**Structural smell candidates:** metrics smell sections — else-if ≥8, `def.key ===` dispatch ≥3, switch ≥10 cases, nested ternary on same line.

**Convention violation candidates:** metrics violation sections + repo-rules-checklist greps.

**Backend smells:** Express types in services, duplicate DTO enums, route sync comments, monolithic controller specs, config registry dispatch in service instead of handler map.

**Frontend smells:** hooks with many `server-api` imports, god contexts, hardcoded user-facing strings in utils, duplicated inline state when a hook exists, large switch/else-if in components.

**Lib smells:** libs importing app/server-api/i18n; lib total LOC >8000 without split plan; spec larger than implementation; mega-switch (≥10 cases).

**Do not recommend:** drive-by refactors unrelated to ranked debt; rewriting generated `chat-api-client`; committing planning docs.

## Incremental vs full audit

| User request                           | Scope                                            |
| -------------------------------------- | ------------------------------------------------ |
| "Update refactoring plan" / full audit | All three docs                                   |
| "Backend only"                         | `refactoring-backend.md` + index backend columns |
| "Frontend + libs only"                 | `refactoring-frontend.md` + index                |
| "Prepare OpenSpec prompt for X"        | Prompt file only + index pointer                 |

## Additional resources

- Document templates: [templates.md](templates.md)
- Repo rules → grep mapping: [repo-rules-checklist.md](repo-rules-checklist.md)
- Metrics script: [scripts/collect-metrics.sh](scripts/collect-metrics.sh)
