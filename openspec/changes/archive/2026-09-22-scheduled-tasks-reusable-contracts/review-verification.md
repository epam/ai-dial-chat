# Review verification — 2026-09-23

This report supersedes the earlier review notes. It describes the parent implementation and public package contracts; publishing and upgrading an external application remain separate delivery steps.

## Corrections

- Root and scheduled-task subpath exports now expose the same scheduler APIs.
- Explicit wildcard, nonzero and stepped seconds retain a Custom description and the full source expression.
- Scheduler responsive styles and the composed builder shell use scoped 1280px rules. Host desktop utilities cannot expose duplicate headings/actions or the Create label in its mobile button.
- The deletion dialog test adapter supports the real ReactNode title and ghost Cancel appearance.
- Library build JSX uses the production-compatible runtime even when invoked by Nx test. React runtimes remain external, and publish-panel preserves the file-manager peer dependency.
- The consumer fixture builds in production mode and tests actual installed tarballs, including the default builder layout used by other editors.

## Requirement coverage

| Findings | Implementation and evidence |
| --- | --- |
| F01 | `labels.instructionsPlaceholder` is forwarded to the editor; form unit tests and packed Chromium verify the rendered placeholder. |
| F02 | Shared validator and checked create/update preparation; validation, trigger and preparation suites cover invalid required fields and schedule values. |
| F03 | Generation-scoped list/history controllers, reset and retry guards; hook suites and `review-regressions.spec.ts` cover late responses and unmounts. |
| F04 | Trigger-only description preserves full cron constraints and applies an explicit display timezone/reference date; descriptor tests include seconds and calendar boundaries. |
| F05 | Parent create/edit/detail integrations retain separate missing, failed and unsupported states; frontend page tests cover those branches. |
| F06 | Public back/sort icon slots and actual Tabler defaults; header, form and dashboard component tests. |
| F07, F15 | Forwarded card settings, explicit presentation status, container-based grid and matching skeleton dimensions; card/grid suites and packed width assertions. |
| F08 | Public detail/history layout, row hover/focus and incremental retry contracts; detail/history/list suites and packed rendering. |
| F09 | Provider-free deployment picker with fit-container panel, selection and Browse callbacks; picker tests and packed interaction. |
| F10 | Shared parent form labels and checked validation in both create/edit adapters; label hook and page tests. |
| F11 | Public built builder stylesheet and scoped responsive rules; packed tests check the divider token, unrelated host header, both CSS orders, host breakpoints 769/1280, LTR/RTL and widths 360/900/1279/1280/1920. Default generic builder columns are checked as well. |
| F12 | Parent resolves the deployment display label with stored-ID fallback; mapper/detail integration tests. |
| F13 | Common trigger descriptor and separate initial/incremental errors; formatter and hook/history tests. |
| F14 | Reusable host-owned confirmation content, title styles and Cancel appearance; library and app dialog suites plus packed Browse/dialog close flow. |

## Executed verification

| Check | Result |
| --- | --- |
| Final workspace typecheck | PASS: all 33 projects, including the strict packed consumer target. |
| Parent production build | PASS: fresh `@epam/chat:build` with NODE_ENV=production. |
| Scheduler/browser package target | PASS: fixture and its 33 prerequisite tasks. The final script rerun also passes after replacing the dynamic validation import. |
| Development server | PASS: installed packages mount and the instructions placeholder renders; no page runtime errors. UI Kit emits an existing non-boolean-attribute console warning. |
| External consumer TypeScript | PASS: 208 source files plus a public-API adoption example, zero diagnostics against the packed declarations. |
| Full frontend and four affected library test targets | All four libraries PASS. Frontend: 2355 passed, 3 skipped, one unrelated SkillEditorPreview 5-second timeout under concurrent build load. An isolated rerun of all nine tests in that file PASS. |
| Final focused regressions | PASS: root/subpath parity, seconds descriptions, deletion dialog, picker focus, validation, preparation, API adapter and run history. |
| Lint | Every failing target from the full run was corrected and rerun with its normal project configuration: builder-form, catalog, scheduled-tasks, chat-hooks, chat and the fixture PASS; publish-panel also PASS. The other full-run lint targets passed. |
| Documentation and formatting | PASS: validate:docs, scoped Prettier check and git diff --check. |
| OpenSpec | PASS: strict change validation, all six affected main specifications and all 24 synchronized requirement blocks (22 added, two existing builder contracts completed). |

The full `npm run verify:full` command was executed once. Its typecheck passed, but the initial lint stage found the issues corrected above; the fixture lint process was stopped after ten minutes to diagnose its hang. A dynamic import in the browser verifier incorrectly marked the scheduler as lazy-loaded in the Nx graph. Replacing that unnecessary dynamic import with the same static public import restored normal lint execution without disabling rules. Final project reruns pass. Because the initial full command stopped at lint, its whole-workspace test stage did not execute; the frontend, affected-library and focused test runs above are the test evidence. No authenticated backend end-to-end run was performed.

An earlier `verify:changed` run overlapped another declaration build and failed while both wrote the same output directory. The subsequent serialized packed build and full typecheck passed. This was a verification orchestration collision.

Local logs under `tmp/` include `final-fixes-tests.log`, `final-fixes-skill-retry.log`, `final-fixes-packed4.log`, `final-fixes-packed-final.log`, `final-fixes-dev-fixture.log`, `final-fixes-parent-build.log`, `final-fixes-verify-full.log`, `final-fixes-libs-lint.log`, `final-fixes-hooks-lint.log` and `final-fixes-final-lint.log`. The report preserves the outcomes because temporary logs are not release artifacts.

## Adoption boundary

An external consumer can replace DOM placeholder mutation with `labels.instructionsPlaceholder`, use public card/form/detail/history style settings, and adopt the shared validator, preparation functions and hooks. Remove previous private-selector/icon patches during that migration, use public stylesheet entries, and retain host adapters for any legacy API response envelopes.

Consumer compatibility is checked against packed declarations using a temporary module-resolution map and an additional public-API usage example. This is not an authenticated end-to-end migration. Internal packages, including the generated API client, must be upgraded as one compatible release set to avoid duplicate class identities.

## OpenSpec

All six delta capabilities are synchronized into main specs. Builder-form also now includes the two previously missing scenarios and documents its existing 400px default side columns. Strict validation covers the change and all six affected main specs. Global spec validation has separate pre-existing failures in applications-write-api, chat-hooks-conversation-stream and conversation-share; those unrelated specifications are unchanged.
