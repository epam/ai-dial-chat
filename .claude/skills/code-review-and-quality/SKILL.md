---
name: code-review-and-quality
description: Five-axis code review before merge, plus responsive-parity and documentation-accuracy gates. Use for quality passes after implementation, before merge, and when asked to review a diff.
context: fork
---

# Code review and quality

## Overview

Review every non-trivial change before it lands on the main line. Use **five axes**: correctness, readability, architecture, security, performance — plus the two repo-specific gates below them, responsive parity and documentation accuracy.

**Approval bar:** Approve when the change clearly **improves or preserves** overall code health and matches project conventions. Do not block because you would have written it differently. Do block on real defects, security issues, or violations of agreed patterns.

## When to use

- Before merge / when asked to review a change
- After implementation (self-review or cross-review)
- After bugfixes (review fix **and** regression coverage)
- When evaluating code produced by another agent or author

## Review modes

Choose the review mode from the user's request and available context:

| Mode                | Use when                            | Required context                                                                               |
| ------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Local review**    | Reviewing uncommitted local changes | `git status`, `git diff`, full changed files, related OpenSpec artifacts if any                |
| **PR review**       | Reviewing a GitHub PR number or URL | PR metadata, PR diff, full changed files at PR head, related OpenSpec artifacts                |
| **Self-review**     | Finishing an implementation slice   | Touched files, completed task, tests run, remaining task status                                |
| **OpenSpec review** | Reviewing an OpenSpec-backed change | `proposal.md`, `design.md`, `tasks.md`, changed specs, implementation diff                     |
| **Pipeline review** | CI/bot review of a PR diff          | Base/head refs, PR diff, full changed files, related OpenSpec artifacts, relevant check output |

For PR review, read full changed files, not only diff hunks. Diffs show what changed; full files show whether the change fits the surrounding design.

## Pipeline review mode

Use this mode when the review is executed by CI, a scheduled bot, or any non-interactive automation. Keep the normal five-axis review, but make the result deterministic and machine-readable.

### Scope

- Review only the PR/diff scope. Do not fail the pipeline for pre-existing issues unless the PR worsens them or makes them newly reachable.
- Read full changed files and related artifacts for context, but comments/findings must point to changed lines or changed artifacts whenever possible.
- Do not run Nx `build` targets from this review pipeline. Treat build as a separate CI concern and only record its status when an existing CI check already provides it.
- Separate review from publishing:
  - Review step produces a structured result artifact.
  - Comment-publishing step may post inline comments and one top-level summary, but only from the structured result.

### Output artifact

Emit a JSON object with this shape:

```json
{
  "verdict": "pass | warn | fail",
  "summary": "Short human-readable summary.",
  "findings": [
    {
      "severity": "critical | required | warning | nit | optional | fyi",
      "category": "correctness | readability | architecture | security | performance | responsive | documentation | openspec | verification",
      "file": "path/from/repo/root",
      "line": 123,
      "side": "RIGHT | LEFT",
      "startLine": null,
      "startSide": null,
      "anchorable": true,
      "message": "Review comment body.",
      "blocking": true
    }
  ],
  "verification": [
    {
      "command": "npm exec nx test @epam/chat",
      "status": "passed | failed | skipped",
      "reason": "Only for failed/skipped or notable context."
    }
  ],
  "topLevelComment": "Markdown summary suitable for a PR conversation comment."
}
```

Use `verdict: "fail"` when any finding is blocking or a required verification command failed. Use `verdict: "warn"` only for non-blocking risks or skipped verification. Use `verdict: "pass"` when there are no blocking findings and required verification is green or explicitly covered by trusted CI.

`file`, `line`, `side`, `startLine`, and `startSide` are intended to be compatible with GitHub pull request review comments. Use `side: "RIGHT"` for new/head lines and `side: "LEFT"` only when the finding must anchor to a removed/base line. Use `startLine`/`startSide` only for multi-line comments; otherwise set them to `null`.

Set `anchorable: true` only when the finding points to a line present in the PR diff. If the issue is real but cannot be anchored to a changed line, set `anchorable: false`, keep `file`/`line` as best-effort context if known, and include the finding in `topLevelComment` instead of attempting an inline comment.

Every finding must include a non-empty `message` containing the full review comment body. Do not put the explanation only in custom fields, summary text, or the top-level comment; pipeline publishers use `message` for both inline review comments and the sticky summary table.

### Pipeline fail rules

Fail the pipeline for:

- Any `critical` or `required` finding.
- Relevant non-build Nx target failure run by this review pipeline, such as test, lint, OpenAPI, or generated-client checks.
- OpenSpec drift: implementation materially diverges from proposal/design/tasks/specs.
- API/OpenAPI/generated-client contract mismatch.
- Hand-authored `libs/*` leaking host/external integration details.
- Security, authz, secret exposure, data loss, or broken public contract risks.
- `npm run validate:docs` failure, or a lib's public API changing without its README, when the diff touches `libs/*/src/index.ts`, any README, or `docs/**`.

Do not fail the pipeline for `nit`, `optional`, or `fyi` findings. Use `warning` for non-blocking risk, missing non-critical evidence, or human-follow-up items.

Simplification and extraction findings usually use `nit` or `optional`. Use `warning` only when duplication or missing extraction creates meaningful maintenance risk, repeated bug-prone logic, expensive test setup, or an ownership-boundary concern. Use `required` only when the structure causes a concrete defect, violates library isolation, or breaks a documented architecture rule.

### Comment publishing

If a pipeline job is configured to publish comments:

- Post inline comments only for `critical`, `required`, and high-signal `warning` findings with `anchorable: true`.
- Do not post inline comments for `nit` by default unless explicitly configured.
- Do not attempt inline comments for findings with `anchorable: false`; summarize them in the top-level PR comment.
- Always post one top-level PR conversation comment.
- If everything is good, post a concise positive summary instead of staying silent, for example:

```markdown
Automated review passed.

- No blocking findings.
- Verification: `npm exec nx affected --target=test --base=origin/development-1.0` passed.
- Scope checked: correctness, architecture boundaries, security, performance, responsive parity, documentation accuracy, and OpenSpec alignment.
```

If there are findings, the top-level comment must summarize the verdict, count blocking/non-blocking findings, and list verification status. Inline comments carry the detailed code-specific feedback.

GitHub publishing step requirements:

- Add the PR head SHA as `commit_id` at publish time; do not require the review agent to hardcode it into findings.
- For individual inline comments, use GitHub's pull request review comment API with `path`, `line`, `side`, optional `start_line`/`start_side`, `body`, and `commit_id`.
- If the API rejects an inline comment because the line is not in the diff, retry once as a top-level PR comment entry and mark the finding as not anchored in the publishing log.
- For the top-level summary, use a PR conversation comment or a review body, depending on the CI integration.

## OpenSpec review gate

If the change is tied to OpenSpec, review the artifacts before judging the code:

1. Identify the change from the branch, PR description, user request, or `openspec list --json`.
2. Read the relevant artifacts under `openspec/changes/<change>/`:
   - `proposal.md` for problem, scope, non-goals
   - `design.md` for architecture and local patterns
   - `tasks.md` for promised implementation and verification
   - changed specs under `specs/**/spec.md` when present
3. Check the diff against the artifacts:
   - Implementation matches the accepted scope and does not add silent scope creep.
   - Completed task checkboxes correspond to real code and tests.
   - New requirements discovered during implementation are captured in specs/design/tasks, not only in code.
   - Non-goals are still respected.
4. If implementation reveals a design/spec gap, request an artifact update before or alongside code changes.

Block merge for OpenSpec-backed work when code behavior materially diverges from the artifacts, when tasks are marked complete without implementation, or when API/user-facing requirements were implemented without updating the relevant spec/design/task.

## Five-axis review

### 1. Correctness

- Matches spec, task, or PR description
- Edge cases: null, empty, boundaries, errors — not only happy path
- Tests exist, assert **behavior**, and would catch regressions
- Watch for off-by-one, races, inconsistent state

### 2. Readability and simplicity

- Names are specific; avoid meaningless `data`, `result`, `temp`
- Control flow is easy to follow; avoid unnecessary cleverness
- Abstractions **earn** their complexity; prefer duplication over wrong abstraction until patterns repeat
- Flag simplification opportunities: repeated logic, deeply nested code, broad functions, or verbose conditionals that would become clearer as a focused helper, hook, component, utility, or method.
- Recommend extracting reusable utilities, hooks, components, or methods when the same behavior appears in multiple places, when a local helper would clarify a complex block, or when nearby features are likely to reuse the behavior.
- Do not request extraction just because code could be abstracted; require a concrete readability, testability, reuse, or ownership-boundary benefit.
- Comments only where intent is non-obvious; remove dead code and noise

### 3. Architecture

- Fits existing Nx boundaries (`apps/*`, `libs/*`) and import direction
- Libraries stay host-agnostic: no host-owned integration details inside `libs/*`, including hardcoded `/api` paths, generated clients, server-api imports, app contexts, auth/session/cookie/env access, feature flags, routing/navigation, analytics/telemetry/logging clients, deployment/tenant/provider details, third-party SDK setup, platform bridges, app-specific URL schemes, or app storage keys/schemas
- Exception: `libs/chat-api-client` is generated by OpenAPI scripts, so generated endpoint paths, DTOs, runtime transport code, and OpenAPI artifacts are allowed there. Block hand-authored app behavior in that package and direct generated-client usage from other hand-authored libs.
- Host/external integrations are adapted at the app edge and passed into libs through props, callbacks, resolved values, or narrow interfaces
- No unjustified new patterns; justified new ones are called out
- No sneaky circular deps or leaky module APIs
- Reusable helpers live at the right ownership level: app-specific helpers stay in `apps/*`, host-agnostic helpers/components may move to `libs/*`, and shared types stay in `libs/chat-shared`
- Relative `.ts`/`.tsx` imports and re-exports omit `.js`, `.jsx`, `.ts`, and `.tsx`; Vite projects use bundler resolution rather than Node ESM source specifiers
- Named finite sets of statuses, modes, variants, or lifecycle states use string enums instead of string-literal unions when exported, reused, or compared
- Duplication: only consolidate when the rule of three (or team norm) says so

### 4. Security

- User and external input validated at boundaries; treat external data as untrusted
- No secrets in code, logs, or repo; authz where required
- Injection-safe queries and APIs; XSS-aware rendering in UI code
- New dependencies: necessity, maintenance, size, license, `npm audit` awareness

### 5. Performance

- N+1, unbounded loops/fetches, missing pagination on lists
- UI: avoidable re-renders, huge props, sync work on hot paths
- Only flag with **measurable or clear scaling** reasoning when possible

### 6. Responsive parity

- UI changes use the project's named breakpoint prefixes (`mobile:` / `desktop:`), not nonexistent `small_tablet:`/`large_tablet:`/`large_desktop:`, Tailwind defaults such as `sm:`/`md:`/`lg:`, or arbitrary `min-[…]:` queries
- Authoring style is mobile-first — base classes describe the smallest supported viewport, larger bands are added via the named prefixes
- Components that branch in JS use `useBreakpoint` / `useIsMobile` from `apps/chat/src/hooks/breakpoint/useBreakpoint.ts`, not direct `window.innerWidth` reads
- Touch targets meet ~44×44 CSS px on mobile; no `:hover`-only affordances; no horizontal scroll at 360px
- Verification story names which breakpoints were exercised — "desktop verified only" is a request-changes signal for any user-facing change
- See `.claude/skills/responsive-design/SKILL.md` for the full rubric

### 7. Documentation accuracy

Docs drift silently — no build breaks when a README documents a component that
was renamed two releases ago. Nothing in `lint`/`test`/`build` covers it, so the
review is the only gate.

- `npm run validate:docs` is green. It checks README coverage and H1/package identity, lib `package.json` metadata (`description`, `license`), that every relative markdown link resolves, and that every name a lib README imports from its own package is actually exported. Treat a failure as `required`.
- A change to a lib's `src/index.ts` — added, renamed, or removed export — carries a matching README change in the same diff.
- A renamed prop, a changed prop type, or a newly required prop is reflected in every README example that passes it.
- README code fences name only symbols that exist, with the required props present, the right value types, and imports from the package that actually exports the name (`CatalogEntityType` is `@epam/ai-dial-chat-shared`, not `@epam/ai-dial-catalog`).
- Prose describes what the code does today, not an intended capability. A claimed feature the component lacks is `required`, not a nit — readers act on it.
- Structural additions (lib, app, backend domain, context, route, `ApiEndpoints` entry) update `docs/architecture.md`; new or removed environment variables update `apps/chat-api/README.md` **and** `.env.template`.
- Deleting a doc means fixing every link to it, including the `dial-docs` skill index.
- See `.claude/rules/docs.md` for the same-change update matrix and the drift classes already found here.

## Repo-specific routing

Use the repository skills and rules as the source of truth before applying generic advice:

| Change area                            | Read / apply                                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Workspace structure, project ownership | `openspec/config.yaml`, `AGENTS.md`, `.agents/skills/nx-workspace/SKILL.md`                                                        |
| Multi-file implementation or refactor  | thin vertical slices + per-slice verify (`openspec/config.yaml` task rules)                                                        |
| HTTP API contract or generated client  | `.agents/skills/api-design/SKILL.md`                                                                                               |
| `apps/chat-api/**`                     | `apps/chat-api/AGENTS.md`                                                                                                          |
| `libs/*` React components              | `openspec/config.yaml`, library isolation rules from `AGENTS.md`, `openspec/lib-styling-guide.md` plus exported-symbol JSDoc rules |
| UI kit components                      | Use the `@epam/ai-dial-ui-kit` MCP tools before recommending raw HTML primitives                                                   |
| Responsive / mobile parity             | `.claude/skills/responsive-design/SKILL.md`                                                                                        |
| READMEs, `docs/**`, lib public API     | `.claude/rules/docs.md` plus `npm run validate:docs`; use the `dial-docs` skill to find the authoritative doc                      |
| CI status or self-healing fixes        | `.agents/skills/monitor-ci/SKILL.md`; do not replace it with ad hoc polling                                                        |

Do not import generic standards that conflict with these repo rules. For example, do not require a new REST response envelope, direct frontend REST helpers, raw HTML controls, or a generic project structure when local conventions say otherwise.

## Code quality standards

Use these as cross-cutting checks after applying repo-specific rules:

- Prefer clear, specific names over generic `data`, `result`, `temp`, `item` when the domain is known.
- Keep control flow shallow with early returns or extracted helpers when nesting hides the main path.
- When new code repeats behavior across files or components, call out whether it should become a reusable utility, hook, component, or method. Keep the suggested location consistent with ownership boundaries.
- When a single function grows to mix several responsibilities, suggest extracting the smallest named helper that makes the main path easier to read and test.
- Avoid functions that mix validation, IO, transformation, and presentation unless the surrounding pattern already does so.
- Avoid magic numbers; name domain thresholds, debounce delays, limits, and TTLs.
- Avoid mutation of shared state. Local mutation is acceptable only when contained, intentional, and clearer or measurably faster.
- Comments should explain why a choice exists, not restate what the code does.
- React components should expose event callback props as `onEvent` and name internal handlers `handleEvent`.
- No `console.log` in application code; use the app's logging pattern.
- No TODO/FIXME in merge-ready code unless linked to an accepted follow-up and non-blocking by design.
- Tests should assert observable behavior and meaningful edge/error paths, not implementation details.

## Change sizing

| Size (approx.) | Expectation                                                               |
| -------------- | ------------------------------------------------------------------------- |
| ~100 lines     | Good — one focused review                                                 |
| ~300 lines     | OK if **one** logical change + tests                                      |
| ~1000+ lines   | Too large — ask to split (stack, vertical slices, or refactor vs feature) |

**Never mix** large refactor with new behavior in one changeset unless team explicitly allows.

## Comment severity

Use a prefix so authors know what is mandatory:

| Label                         | Meaning                                             |
| ----------------------------- | --------------------------------------------------- |
| _(none)_ or **Required:**     | Must fix before merge                               |
| **Critical:**                 | Blocks merge — security, data loss, broken contract |
| **Warning:**                  | Non-blocking risk or missing non-critical evidence  |
| **Nit:**                      | Optional — style, minor preference                  |
| **Optional:** / **Consider:** | Worth discussing, not blocking                      |
| **FYI:**                      | Context only                                        |

In pipeline JSON, use lowercase severity values: `critical`, `required`, `warning`, `nit`, `optional`, `fyi`.

## Review process

1. **Context** — What does this change do? Which spec/task? Expected behavior?
2. **OpenSpec gate** — If applicable, read artifacts and compare implementation to proposal/design/tasks/specs
3. **Tests first** — Coverage, names, edge cases, behavioral (not brittle implementation) assertions
4. **Implementation** — Walk files with the five axes
5. **Findings** — Every item labeled with severity above
6. **Verification story** — What was run, what still needs a human check (UI screenshots if relevant)
7. **Verdict** — Approve, comment, request changes, or block

## This workspace (Nx)

When checking "tests / build / lint":

- Prefer `npm exec nx test <project>`, `npm exec nx lint <project>`, `npm exec nx build <project>` for touched projects (see `openspec/config.yaml` and `AGENTS.md`).
- For broad checks, use affected targets with the repository base branch: `npm exec nx affected --target=<target> --base=origin/development-1.0`.
- In CI pipeline review mode, do not run `npm exec nx build ...` or `npm exec nx affected --target=build ...`; rely on dedicated CI build jobs if build evidence is needed.
- Do not use `origin/main` as the affected base in this workspace.
- When unsure which project owns a path, use `npm exec nx show projects` or `npm exec nx show project <name> --json`.

## Validation matrix

**CI / pipeline review mode: never run `build` targets.** In CI, skip every `build` command in the table below regardless of change type. Rely on dedicated CI build jobs; record their status from existing CI check output instead.

Select the smallest validation set that proves the change:

| Change type                | Expected validation (interactive/local only — skip build rows in CI)                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend component / hook  | `npm exec nx test chat`, `npm exec nx lint chat`; build if route/bundling/shared imports changed                                                                |
| Backend `apps/chat-api/**` | `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api` when startup/module/config wiring changed                                |
| HTTP API contract          | Backend checks plus `npm run openapi`, `npm run openapi:check`, `npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`                         |
| Shared lib                 | Test/lint/build for the touched lib and any directly affected app when behavior is consumed, plus `npm run validate:docs` when its public API or README changed |
| README / `docs/**`         | `npm run validate:docs`; `npm run validate:agent-docs` as well when `.claude/**`, `.agents/**`, `AGENTS.md`, or `CLAUDE.md` changed                             |
| Broad cross-project change | `npm exec nx affected --target=lint --base=origin/development-1.0` and affected test/build targets as appropriate                                               |
| CI-only review             | Prefer `monitor-ci` skill for Nx Cloud status and self-healing context; do not start build targets from the review job                                          |

Record skipped checks with a reason. A review without a verification story is incomplete.

## Decision policy

Use a clear verdict:

| Verdict             | Use when                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Approve**         | No blocking issues; relevant verification is green or CI covers it                          |
| **Approve/comment** | Only optional or low-risk improvements remain                                               |
| **Request changes** | Required issues, failing relevant checks, missing tests for risky behavior, OpenSpec drift  |
| **Block**           | Security issue, data loss risk, broken public contract, secrets exposure, invalid auth flow |
| **Comment only**    | Draft PR, exploratory review, or user explicitly asked for non-blocking feedback            |

For pipeline JSON, map these to `pass`, `warn`, or `fail`:

- `pass`: equivalent to Approve.
- `warn`: equivalent to Approve/comment or Comment only with non-blocking findings.
- `fail`: equivalent to Request changes or Block.

## Commit / PR description

- **Subject:** imperative, informative alone in history ("Add retry to chat API client" not "Fix stuff").
- **Body:** what, why, tradeoffs, links to tasks/issues when useful.
- Weak subjects: "Fix bug", "WIP", "Phase 1", "Small changes".

## Review checklist

Use as a literal template when writing a review:

```markdown
## Review: [title]

### Context

- [ ] I understand intent and expected behavior
- [ ] I read related OpenSpec artifacts, or confirmed none apply

### Correctness

- [ ] Matches spec/task
- [ ] Edge and error paths
- [ ] Tests adequate and meaningful

### Readability

- [ ] Clear names and flow
- [ ] No unnecessary complexity

### Architecture

- [ ] Fits monorepo boundaries and patterns
- [ ] Hand-authored `libs/*` remain isolated from host/external integration details
- [ ] `libs/chat-api-client` changes, if any, are generated OpenAPI client changes
- [ ] Coupling and abstraction level appropriate
- [ ] API/generated-client/OpenSpec contract rules followed when relevant
- [ ] Relative TypeScript source imports are extensionless
- [ ] Named finite TypeScript value sets use string enums where the project convention applies

### Security

- [ ] No secrets; boundaries validated; auth as needed
- [ ] New deps justified

### Performance

- [ ] No obvious N+1 / unbounded work / UI hot-path issues

### Responsive parity

- [ ] Uses project's named breakpoint prefixes; mobile-first authoring
- [ ] JS branches go through `useBreakpoint` / `useIsMobile`, not `window.innerWidth`
- [ ] Touch targets, hover-only affordances, and 360px overflow checked
- [ ] Verification names the breakpoints exercised

### Documentation accuracy

- [ ] `npm run validate:docs` green
- [ ] Public API changes (`libs/*/src/index.ts`, prop renames, new required props) reflected in the lib README in this diff
- [ ] README examples name only existing symbols, include required props, and import from the owning package
- [ ] Prose describes current behavior, not intended behavior
- [ ] `docs/architecture.md` updated for structural changes; `apps/chat-api/README.md` + `.env.template` for env vars
- [ ] No links left pointing at a deleted or renamed doc

### Verification

- [ ] Relevant Nx targets (or CI) green
- [ ] OpenAPI/generated-client checks run when API contracts changed
- [ ] `npm run validate:docs` run when READMEs, `docs/**`, or a lib's public API changed
- [ ] Manual / visual check noted if UI

### Verdict

- [ ] Approve | [ ] Request changes (list blocking items)
```

## Rationalizations to reject

| Excuse                       | Response                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| "It works, ship it"          | Readability, security, and architecture debt still compound.                                                              |
| "I wrote it, it's fine"      | Second pass catches blind spots.                                                                                          |
| "We'll clean up later"       | Cleanup before merge unless true emergency + tracked follow-up.                                                           |
| "Tests pass, so it's good"   | Tests don't replace architecture or security review.                                                                      |
| "It's only a README"         | READMEs are the public contract; callers copy the examples. Nothing type-checks a code fence, so review is the only gate. |
| "I'll update the docs after" | Docs updated later are docs not updated. Same change or it drifts.                                                        |

## Red flags

- Merge with no real review or evidence
- Only glancing at tests, ignoring other axes
- Huge PR with "no time to split"
- Bugfix without regression test
- Comments without severity — author cannot prioritize
- Rubber-stamp "LGTM"

## After review

- [ ] All **Critical** / **Required** items closed or explicitly deferred with reason
- [ ] Tests and build (for touched scope) are green
- [ ] OpenSpec tasks/specs/design reflect the implementation state
- [ ] Verdict and severity-labeled notes are clear for the author
