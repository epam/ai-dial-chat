---
name: refactoring-audit
description: >-
  Deep codebase refactoring audit for AI DIAL Chat. Collects metrics, compares
  with prior local plans, detects dead-code candidates, audits the test suite
  for focused, skipped, duplicate, mergeable and stale tests, and writes or
  updates refactoring-backend.md, refactoring-frontend.md, and refactoring.md
  index docs (git-excluded). On explicit request it also merges and deletes the
  redundant tests it confirmed, guarded by test counts and coverage. Use when
  the user asks for a refactoring plan, tech-debt review, god-module analysis,
  dead/unused-code analysis, test-suite review or cleanup, architecture audit,
  or updated refactoring documents.
context: fork
---

# Refactoring audit

Produce **local-only** refactoring plans for this monorepo. Output is planning material for humans — not code changes unless the user explicitly asks to implement something. The one implementation path built into this skill is [Test cleanup mode](#test-cleanup-mode-explicit-request-only), and it runs only on an explicit request to merge or delete tests.

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

## Excluded areas

Leave celebration code out of every audit: the `celebrations` Nx project (`@epam/ai-dial-celebrations`), the chat-api celebration domain and anything it owns (`celebration`-named services, types and config), and the `UI_EVENT*` env vars. The feature is still under development, so do not collect metrics, smells, dead-code candidates or phase items for it, and do not propose moving, splitting or renaming it, even when it trips a threshold. Mention the exclusion once in `refactoring.md`.

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
- [ ] 3d. Dead-code pass (unused files, exports/types, dependencies, orphan projects)
- [ ] 3e. Test-suite pass (focused/skipped, duplicate, mergeable, stale tests)
- [ ] 4. Verify completed phases from code (grep/counts, not memory)
- [ ] 5. Write/update three docs (English) — paths from this run only
- [ ] 6. Ensure .git/info/exclude
- [ ] 7. Optional: next OpenSpec prompt
- [ ] 8. Summarize for user
- [ ] 9. Test cleanup mode — only when the user explicitly asks to merge/delete tests
```

### Step 1 — Collect metrics

Run:

```bash
bash .claude/skills/refactoring-audit/scripts/collect-metrics.sh
```

This is the **primary source of truth** for which files to inspect. Treat every ranked list, smell, violation, and dead-code section as the candidate set for Steps 3–3d.

Run the dedicated dead-code collector separately because it is slower. It uses the root devDependency `knip` with the repository config [`knip.ts`](../../../knip.ts):

```bash
bash .claude/skills/refactoring-audit/scripts/collect-dead-code.sh
```

Run the test-health collector. It is static (TypeScript parser, no test run) and takes seconds; the JSON keeps every hit that the capped text lists truncate:

```bash
node .claude/skills/refactoring-audit/scripts/collect-test-health.mjs --json <scratchpad>/test-health.json
```

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

| Area                  | Source in metrics output               | Read depth                                                                                                   |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Backend services      | "Backend services (top 20)"            | Top 5 + any >400 lines not yet split                                                                         |
| Backend tests         | "Backend test specs (top 15)"          | Specs >1000 lines tied to unsplit services                                                                   |
| Frontend app          | "Frontend app sources (top 25)"        | Top 5 components/hooks/contexts                                                                              |
| Frontend tests        | "Frontend test specs (top 15)"         | Specs >1000 lines                                                                                            |
| Libs                  | "Libs total LOC" + "Lib largest files" | Libs >5000 LOC or files >400 lines                                                                           |
| Structural smells     | All smell sections                     | Every prod hit (exclude `*.spec.*` when prioritizing)                                                        |
| Convention violations | All violation sections                 | Every non-zero category; sample-read hits                                                                    |
| Dead code             | Dead-code collector                    | Every production hit; sample default-mode-only hits                                                          |
| Test suite            | Test-health collector                  | Every focused/skipped/empty/no-assertion hit and exact duplicate; largest clone, same-body and family groups |

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

### Step 3d — Dead-code pass (mandatory)

Use three complementary signals; no single signal is sufficient:

1. Run TypeScript checks across every configured project to catch unused local declarations and imports (`noUnusedLocals` is enabled in the workspace):

   ```bash
   npm exec -- nx run-many --target=typecheck
   ```

2. Run [scripts/collect-dead-code.sh](scripts/collect-dead-code.sh). It runs Knip in production and comprehensive mode with [`knip.ts`](../../../knip.ts) and the [`drop-root-manifest-repeats`](../../../tools/knip/drop-root-manifest-repeats.mjs) preprocessor (the same as `npm run knip:production` / `npm run knip`), prints each mode's exit code, load errors, configuration hints and findings, and keeps the raw JSON and text reports in the printed `raw-reports` folder. A mode with Knip exit code above 1 or an unparseable report is `FAILED`, and the collector then ends with `collector-status: FAILED` and coverage `PARTIAL`. The production pass identifies code kept alive only by tests/tooling; the comprehensive pass also covers unused test and tooling code.
3. Inspect the Nx project graph for projects with no in-repo dependents:

   ```bash
   npm exec -- nx graph --print \
     | jq -r '.graph as $g | ($g.nodes | keys[]) as $name | select([ $g.dependencies[]?[]? | select(.target == $name) ] | length == 0) | $name'
   ```

Classify every production Knip hit, and sample-read default-mode-only hits, as one of:

- **Confirmed dead** — no runtime, configuration, public API, or external-consumer reachability.
- **Reachability/config gap** — Knip is missing an entry, plugin, generated artifact, dynamic import, or path mapping.
- **Intentional public API** — exported for consumers outside this repository.
- **False positive / framework-managed** — loaded by NestJS metadata/DI, Vite/Webpack, Nx targets, scripts, or another convention that static imports do not expose.
- **Needs owner confirmation** — evidence is insufficient for safe deletion.

Review candidates in cascade order: unused production files first, then their exports/types/members, then dependencies. One unreachable file can cause all downstream symbols and dependencies to appear unused.

Coverage rules:

- Mark **Full** only when typecheck and both Knip passes complete, configuration hints and unresolved imports are investigated, and production hits are manually classified.
- Mark **Partial** when Knip is unavailable/fails, typecheck cannot complete, or reachability/configuration gaps remain. List the missing signal explicitly; never report “no dead code” from partial coverage.
- If the collector reports `UNAVAILABLE` (no `node_modules/.bin/knip`), the local install is stale: do not download Knip or install anything during the audit. Continue with TypeScript/Nx signals, mark coverage Partial, and ask the user to run `npm install`.
- An Nx project with zero inbound edges is only a candidate: applications are graph roots, and publishable libraries may have external consumers.
- Exclude generated `chat-api-client` findings. Do not hand-edit or recommend deleting generated client code.
- Never run `knip --fix`, delete files, or remove dependencies during an audit. Produce planning findings only unless the user separately authorizes implementation. Test cleanup mode is the only built-in exception, and it touches test files only.

Document dead-code findings in a dedicated **Dead code** section. Include: path/package, candidate kind, source signal and mode, classification, evidence/consumer check, suggested action, and priority. Keep confirmed findings separate from unverified candidates.

### Step 3e — Test-suite pass (mandatory)

Signals, from cheapest to most expensive:

1. **Static** — [scripts/collect-test-health.mjs](scripts/collect-test-health.mjs) (Step 1). It parses every tracked and untracked-but-not-ignored test file and lists focused (`.only`), skipped, conditional, todo, empty and assertion-less tests; duplicate names; identical bodies, split into **exact duplicates** (same body, same imported bindings, same suite setup) and **same body, different subject or setup**; **clone groups** (one suite, one body shape, different literals); small **spec families** for one subject (with their shared `vi.mock`s); specs not named after a source file (those with no first-party import first); `.test.*` names and unit specs outside `tests/`; and the largest test files next to their subject's size. It excludes celebrations and the generated client.
2. **Dead test code** — the default-mode-only (comprehensive) Knip hits from Step 3d: unused test helpers, fixtures, mocks and setup files.
3. **Runtime (optional; record when skipped)** — `npm run test:full:quiet` for pass/fail. To rank slow tests of a project:

   ```bash
   npm exec nx test <project> --skip-nx-cache -- --reporter=json --outputFile=<abs>/vitest.json
   jq -r '.testResults[] | .name as $f | .assertionResults[] | "\(.duration // 0 | floor)ms  \($f)  \(.fullName)"' <abs>/vitest.json | sort -rn | head -15
   ```

   `--skip-nx-cache` is required: a cache hit replays the log and writes no report file. Resolve `<project>` with `nx show projects` (lib projects are named after their package).

Read every hit you classify; collector output alone is never evidence. Classify as:

| Class                        | Meaning                                                                                                                                                                                                                                                       | Action                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Delete**                   | Redundant: an exact duplicate; an app test that repeats a lib test after an extraction while the app module only re-exports or thinly wraps the lib one; a test of behaviour that no longer exists; a skipped or todo test with no reason that guards nothing | Delete, naming the test that keeps the behaviour covered |
| **Merge**                    | One behaviour spread out: literal-only clones (one `it.each`); one body against several subjects or setups (`describe.each` or a shared contract helper); a small family of specs for one subject sharing render/mock setup; two spec files for one subject   | Merge, keeping every distinct case                       |
| **Fix**                      | Meant to protect something but does not: a focused test, a test with no assertion, a skip or todo that hides a case still worth running, a title that does not state the outcome                                                                              | Fix in place; never delete a test only to shorten a list |
| **Keep**                     | Intentional: a concern split above the merge threshold or with its own setup, a characterization/contract/package-boundary spec that reads files instead of importing code, unit and integration specs of one subject                                         | None                                                     |
| **Needs owner confirmation** | Evidence is insufficient                                                                                                                                                                                                                                      | List it                                                  |

Rules:

- A **Delete** row needs a covering test that asserts the same behaviour — read in source, not inferred from a matching title or from coverage of the same lines.
- **Same body, different subject or setup** is a Merge candidate, not a Delete one, unless the subjects differ only by a re-export or a thin wrapper — read the app module before calling the app copy redundant, and keep one wiring test when the wrapper injects host values.
- Never re-merge a family that a previous spec split produced (big concern-split files, the output of a spec-split OpenSpec change); the collector's merge threshold keeps those out, so a family above it is Keep.
- A unit spec outside `tests/` in `apps/chat-api` follows the NestJS co-location rule in `.claude/rules/nestjs-best-practices.md`; elsewhere it breaks `.claude/rules/spec.md`. Either way, a subject with specs in both places shows up as a spec family — merge those.
- Priorities: focused tests **P0** (they silently disable the rest of the file), unexplained skips and assertion-less tests **P1**, exact duplicates, app/lib duplicates and clones **P2**, families, naming drift and placement **P3**.

Document findings in the **Test suite** section of each doc ([templates.md](templates.md)): which signals ran, counts per collector category, then rows with path:line, category, class, evidence (the covering test, or the reason to keep), action and priority. Keep Delete/Merge rows apart from Fix, Keep and unverified rows, and drop rows that Test cleanup mode applied.

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
- Every audit states dead-code coverage (**Full** or **Partial**) and the signals that ran
- Every confirmed dead-code row includes manual reachability evidence; tool output alone is not confirmation
- Priorities P0–P3 with concrete next OpenSpec change names
- Separate backend vs frontend debt
- Name archived OpenSpec changes with dates when marking complete
- Include verification note if tests were not green
- Every test-suite Delete row names its covering test; every Merge row names the target file or the `it.each`/`describe.each` shape

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

A test-only cleanup (Delete/Merge rows from Step 3e) changes no behaviour, contract or spec, so it needs no OpenSpec change: the plan points at Test cleanup mode instead. A cleanup that belongs to a planned split (a spec that must follow its component's split) goes into that split's prompt.

### Step 8 — User summary

Reply in **English** with:

- Audit date
- Top 3 backend + top 3 frontend debts (from current metrics)
- Top structural smell + convention categories (with counts; name paths only from this run)
- Dead-code coverage, confirmed counts, and unverified candidate counts by kind
- Test-suite signals that ran, Delete/Merge/Fix counts, and the top cleanup candidates by project
- What closed since last audit
- Recommended next 2–3 actions (OpenSpec names)
- Confirm docs are git-excluded

## Analysis heuristics

**God module candidates:** service/hook/component >400 lines, or spec >1000 lines (from metrics).

**Structural smell candidates:** metrics smell sections — else-if ≥8, `def.key ===` dispatch ≥3, switch ≥10 cases, nested ternary on same line.

**Convention violation candidates:** metrics violation sections + repo-rules-checklist greps.

**Dead-code candidates:** TypeScript unused-local diagnostics; Knip unused files, exports, types/members, and dependencies; Nx projects with zero in-repo dependents. Treat all as candidates until reachability and external-consumer checks are complete.

**Backend smells:** Express types in services, duplicate DTO enums, route sync comments, monolithic controller specs, config registry dispatch in service instead of handler map.

**Frontend smells:** hooks with many `server-api` imports, god contexts, hardcoded user-facing strings in utils, duplicated inline state when a hook exists, large switch/else-if in components.

**Lib smells:** libs importing app/server-api/i18n; lib total LOC >8000 without split plan; spec larger than implementation; mega-switch (≥10 cases).

**Test smells:** focused, skipped or todo tests; tests with no assertion; exact duplicate bodies; an app spec repeating a lib spec after an extraction; clone groups differing only in literals; small spec families for one subject with shared mocks; specs several times larger than their subject.

**Do not recommend:** drive-by refactors unrelated to ranked debt; rewriting generated `chat-api-client`; deleting code or tests directly from unverified static-analysis output; re-merging specs a previous split separated; committing planning docs.

## Test cleanup mode (explicit request only)

Runs only when the user explicitly asks to merge or delete tests — "clean up the tests", "merge the duplicate specs", "почисти тесты", "apply the test cleanup from the plan". A plain audit or plan refresh never edits a test.

Preconditions:

- Act only on Step 3e rows classified **Delete** or **Merge** with evidence from this session; run Step 3e for the target project first if needed. Apply **Fix** rows only when the user asks for fixes too.
- One Nx project per slice. Touch test files only — never product code, the generated client, celebrations or OpenSpec.
- If `git status` shows uncommitted edits in a target file, stop and report instead of editing. Never commit, push or open a pull request; leave the changes in the working tree for the user.

Per slice:

1. **Baseline.** Run the touched specs plus the specs holding each named covering test, with a JSON report and coverage limited to the subjects:

   ```bash
   npm exec nx test <project> --skip-nx-cache -- <spec paths relative to the project root> \
     --reporter=json --outputFile=<abs>/before.json \
     --coverage.enabled --coverage.provider=v8 --coverage.reporter=json-summary \
     --coverage.reportsDirectory=<abs>/before-coverage --coverage.include='<subject glob relative to the project root>'
   ```

   Write the expected change of `numTotalTests` down before editing: −1 per deleted test; an `it.each` of N rows counts as N tests, so turning N clones into one table changes nothing.

2. **Edit.** Delete the redundant test; merge a family into the main spec with its setup hoisted once (render helper per `.claude/rules/spec.md`); turn clones into `it.each`/`describe.each` with a readable title template. Keep every distinct case, delete a file only once it is empty, and remove imports, mocks and helpers the edit left unused.
3. **Compare.** Rerun the command with the spec paths that exist after the edit (a merged family's target file, not the files it absorbed), into `after.json` / `after-coverage`. Every test passes; `numTotalTests` changed by exactly the expected amount; no coverage total (`lines`, `statements`, `functions`, `branches`) in `coverage-summary.json` dropped. A drop means a removed test was not redundant — restore it and reclassify the row.
4. **Gate.** `npm exec nx lint <project>` and `npm exec nx typecheck <project>`; after the last slice, `npm run verify:changed`.
5. **Report.** Per slice: file, action, tests before → after, coverage before → after, and the covering test of each deletion. Drop the applied rows from the plan docs' **Test suite** sections.

## Incremental vs full audit

| User request                           | Scope                                            |
| -------------------------------------- | ------------------------------------------------ |
| "Update refactoring plan" / full audit | All three docs                                   |
| "Backend only"                         | `refactoring-backend.md` + index backend columns |
| "Frontend + libs only"                 | `refactoring-frontend.md` + index                |
| "Prepare OpenSpec prompt for X"        | Prompt file only + index pointer                 |
| "Review the tests" / test-suite audit  | Step 3e + both **Test suite** sections + index   |
| "Clean up / merge / delete tests"      | Test cleanup mode (Step 3e first if not run)     |

## Additional resources

- Document templates: [templates.md](templates.md)
- Repo rules → grep mapping: [repo-rules-checklist.md](repo-rules-checklist.md)
- Metrics script: [scripts/collect-metrics.sh](scripts/collect-metrics.sh)
- Dead-code collector: [scripts/collect-dead-code.sh](scripts/collect-dead-code.sh)
- Test-health collector: [scripts/collect-test-health.mjs](scripts/collect-test-health.mjs); its fixtures run with `node --test .claude/skills/refactoring-audit/scripts/collect-test-health.spec.mjs`
- Knip configuration: [knip.ts](../../../knip.ts); root-manifest preprocessor: [tools/knip/drop-root-manifest-repeats.mjs](../../../tools/knip/drop-root-manifest-repeats.mjs)
