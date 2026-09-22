## Implementation strategy

Use risk-first vertical slices: validation and request correctness first, then public presentation and parent adoption, then packed-consumer acceptance. Each numbered section has explicit dependencies. Proposed new test files are named below and must be created with the corresponding implementation; these are not claims that the files already exist.

For each task, run its exact Vitest command under Verification. Complete `npm run verify:changed` once per completed slice, not per micro-edit. Run `npm run verify:full` exactly once at final acceptance. No manual-testing tasks are required. UI geometry uses an automated browser harness.

All implementation stays in this repository. No new backend endpoint, OpenAPI regeneration, global provider, feature flag or telemetry is introduced. Preserve existing scheduledTasksEnabled/roles at app edges. Every new hook and utility has a dedicated unit-test task. Library boundaries follow AGENTS.md, including the configured-client exception for chat-hooks.

## 1. Shared validation and safe form submission

Risk-first vertical slice. No dependency on UI extraction; F02/F10.

- [ ] 1.1 Extract pure validation and exported error-code enums into libs/scheduled-tasks/src/validation/ and the /validation public entry, following apps/chat/src/utils/scheduled-task-form-validation.ts. Preserve active-field, description, clock/lead and date-boundary behavior.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/validation/tests/scheduled-task-validation.spec.ts`.

- [ ] 1.2 Add checked create/update preparation to libs/chat-hooks/src/scheduled-task/ and export through its existing /scheduled-tasks entry. Preserve existing unchecked mapper signatures and UTC conversion semantics.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-task-trigger.spec.ts libs/chat-hooks/src/scheduled-task/tests/scheduled-task-preparation.spec.ts`.

- [ ] 1.3 Add dedicated validator/preparation unit coverage for empty weekly/monthly days, all numeric boundaries, invalid times/dates, injected clock, activity windows, inactive fields, description create/update semantics and non-whole-hour timezones.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/validation/tests/scheduled-task-validation.spec.ts libs/chat-hooks/src/scheduled-task/tests/scheduled-task-preparation.spec.ts`.

- [ ] 1.4 Migrate parent CreatePage/EditPage to checked preparation and a common translated error mapping; preserve input on write failure and clear field errors consistently. Keep route/notification ownership in apps/chat.

  **Verification:** `npm run test:file -- apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx`.

## 2. Shared request lifecycle and incremental retry

Depends on section1 export conventions; F03/F13. Existing protected parent hooks are the behavioral reference.

- [ ] 2.1 Add createScheduledTasksApiClient in libs/chat-hooks/src/scheduled-task/ over an injected configured generated-client subset. Retain app server-api exports as thin composition adapters and distinguish malformed responses from valid empty pages.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-tasks-api-client.spec.ts`.

- [ ] 2.2 Export shared useScheduledTasks/useScheduledTaskRuns in libs/chat-hooks/src/scheduled-task/ with generation-scoped cancellation, synchronous pagination guard, configurable page sizes/debounce and separate initial/incremental errors.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/useScheduledTasks.spec.ts libs/chat-hooks/src/scheduled-task/tests/useScheduledTaskRuns.spec.ts`.

- [ ] 2.3 Add dedicated deferred-promise tests for search/sort/refetch/task/client/enable changes, unmount, ignored abort, late failure/finally, duplicate activations, deduplication and failed-offset retry.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/useScheduledTasks.spec.ts libs/chat-hooks/src/scheduled-task/tests/useScheduledTaskRuns.spec.ts`.

- [ ] 2.4 Migrate apps/chat/src/hooks/scheduled-tasks wrappers and list/history consumers; preserve loaded results on pagination errors, feature gating and existing wrapper exports.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTasks.spec.ts apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskRuns.spec.ts libs/scheduled-tasks/src/components/ScheduledTasks/tests/ScheduledTasks.spec.tsx libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/tests/ScheduledTaskRunHistoryList.spec.tsx`.

## 3. Trigger descriptions and recoverable page states

Depends on sections1-2; F04/F05/F12/F13.

- [ ] 3.1 Extract trigger-only description into libs/chat-hooks/src/scheduled-task/ using existing trigger conversion and apps/chat/src/utils/map-scheduled-task-dto.ts. Keep custom expressions/source timezone and Invalid distinct; do not broaden editability.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-task-description.spec.ts libs/chat-hooks/src/scheduled-task/tests/scheduled-task-trigger.spec.ts`.

- [ ] 3.2 Add dedicated descriptor tests for absent model/prompt, common frequencies, parent-supported interval/custom schedules, invalid dates and explicit locale/reference-date conversion inputs.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-task-description.spec.ts`.

- [ ] 3.3 Use one host formatter for recurring labels in list/details and resolve model display names with raw-id fallback. Keep next-run placement, unread state and run navigation intact.

  **Verification:** `npm run test:file -- apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`.

- [ ] 3.4 Represent edit load/error/not-found/unsupported separately and reset on task changes. Verify existing detail NotFound/retry behavior and guard stale task responses without conflating runs failures.

  **Verification:** `npm run test:file -- apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`.

## 4. Public form and icon composition

Depends on section1; F01/F06/F10. Retain generic builder defaults.

- [ ] 4.1 Add backIcon to BuilderFormHeader and every intermediate shell prop/forwarding layer in libs/builder-form; support undefined/default, null and custom nodes.

  **Verification:** `npm run test:file -- libs/builder-form/src/components/BuilderFormHeader/tests/BuilderFormHeader.spec.tsx`.

- [ ] 4.2 Add labels.instructionsPlaceholder, backIcon, className and documented form layout options in libs/scheduled-tasks. Forward placeholder directly to the lazy editor and narrow arrow through builder-form.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx`.

- [ ] 4.3 Add unit tests for lazy editor mounting, preview/edit remount, prop/locale changes, independent instances, optional defaults, custom/null icons and unique model label linkage.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx libs/builder-form/src/components/BuilderFormHeader/tests/BuilderFormHeader.spec.tsx`.

- [ ] 4.4 Create local apps/chat/src/hooks/scheduled-tasks/useScheduledTaskFormLabels.ts for shared create/edit labels/options; use public customization in both pages and avoid adding a skill selector.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskFormLabels.spec.ts apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx`.

## 5. Dashboard details and confirmation presentation

Depends on sections2-4; F06/F07/F08/F14/F15.

- [ ] 5.1 Expose ScheduledTasks sortIcon, className, gridLayout and forwarded cardStyles; add optional typed presentation status and host labels/styles while preserving isActive compatibility and unread badges.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTasks/tests/ScheduledTasks.spec.tsx libs/scheduled-tasks/src/components/ScheduledTaskCard/tests/ScheduledTaskCard.spec.tsx`.

- [ ] 5.2 Expose DetailView column layout/backIcon/className and forwarded historyStyles; implement full-height divider, bounded history scroll and configurable row hover/focus/minimum height. Preserve existing mobile tabs.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskDetailView/tests/ScheduledTaskDetailView.spec.tsx libs/scheduled-tasks/src/components/ScheduledTaskHistorySection/tests/ScheduledTaskHistorySection.spec.tsx libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/tests/ScheduledTaskRunHistoryList.spec.tsx`.

- [ ] 5.3 Export ScheduledTaskDeleteConfirmation with safe host content, title/action styles and pending-state guards; adapt the parent's delete dialog while retaining mutation/navigation/notifications in its page.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskDeleteConfirmation/tests/ScheduledTaskDeleteConfirmation.spec.tsx apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`.

- [ ] 5.4 Add dedicated presentation tests for status precedence, style forwarding and independent instances; delete cancel/confirm/pending behavior, hostile-looking task text and custom content; list/history incremental retry.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCard/tests/ScheduledTaskCard.spec.tsx libs/scheduled-tasks/src/components/ScheduledTaskDeleteConfirmation/tests/ScheduledTaskDeleteConfirmation.spec.tsx libs/scheduled-tasks/src/components/ScheduledTasks/tests/ScheduledTasks.spec.tsx`.

## 6. Reusable catalog picker with parent adapter

Depends on section4; F09. Preserve app overlay protocols and current-conversation behavior.

- [ ] 6.1 Extract controlled DeploymentSelectorField and reusable panel presentation into libs/catalog/src/components/ with resolved display records, host callbacks, extraOptions and popup/sheet composition slots. Export documented types without app/provider imports.

  **Verification:** `npm run test:file -- libs/catalog/src/components/DeploymentSelectorField/tests/DeploymentSelectorField.spec.tsx`.

- [ ] 6.2 Implement fit-container/reference width and viewport constraints as a public sizing contract; remove hard minimum width from reusable content and support long labels and padded mobile sheets.

  **Verification:** `npm run test:file -- libs/catalog/src/components/DeploymentSelectorField/tests/DeploymentSelectorField.spec.tsx`.

- [ ] 6.3 Adapt apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger and its field overlay hook to shared presentation. Keep model resolution, favorites persistence, Browse/CatalogModal and conversation mutation policy in app adapters.

  **Verification:** `npm run test:file -- apps/chat/src/components/DeploymentSelector/tests/DeploymentSelectorFieldTrigger.spec.tsx`.

- [ ] 6.4 Add dedicated tests covering controlled selection, Browse isolation, extraOptions, loading/error/empty/disabled states, unavailable selection, search highlighting and keyboard focus restoration.

  **Verification:** `npm run test:file -- libs/catalog/src/components/DeploymentSelectorField/tests/DeploymentSelectorField.spec.tsx apps/chat/src/components/DeploymentSelector/tests/DeploymentSelectorFieldTrigger.spec.tsx`.

## 7. Styles distribution external fixture and accessibility

Depends on sections4-6; F01/F06-F09/F11/F14/F15. Geometry acceptance uses browser automation.

- [ ] 7.1 Update libs/scheduled-tasks stylesheet build/exports to include required builder-form structural styles and isolate responsive selectors; preserve supported old CSS paths. Document required singleton UI-kit styles. Keep changes scoped to affected components/packages.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/tests/public-contract.spec.ts tools/scheduled-tasks-consumer-fixture/tests/package-contract.spec.ts`.

- [ ] 7.2 Create tools/scheduled-tasks-consumer-fixture/ using packed dist dependency closure modeled on tools/attachment-canvas-consumer-fixture. Include all surfaces and a configurable external-consumer composition using only public imports and fake configured adapters.

  **Verification:** `npm run test:file -- tools/scheduled-tasks-consumer-fixture/tests/package-contract.spec.ts`.

- [ ] 7.3 Add automated browser geometry/CSS-order tests at 320/360/768/1280px and nested widths covering compact grid,184px cards, full-height divider, history sizing, tertiary border and overflow-free selector. Include host desktop utility thresholds 769/1280 and both stylesheet orders.

  **Verification:** `npm run test:file -- tools/scheduled-tasks-consumer-fixture/tests/package-contract.spec.ts`.

  **Browser verification:** Add and document a fixture-local `test:browser` script and run `npm --prefix tools/scheduled-tasks-consumer-fixture run test:browser`; tests must install packed artifacts before measuring layout, not source aliases.

- [ ] 7.4 Add a dedicated RTL/a11y pass for affected surfaces: logical properties, default-arrow mirroring, accessible names independent of icons, keyboard picker and confirmation focus, search Highlight and localized live error feedback. Preserve existing feature-flag and unread/navigation behavior.

  **Verification:** `npm run test:file -- libs/catalog/src/components/DeploymentSelectorField/tests/DeploymentSelectorField.spec.tsx libs/scheduled-tasks/src/components/ScheduledTaskDeleteConfirmation/tests/ScheduledTaskDeleteConfirmation.spec.tsx libs/scheduled-tasks/src/components/ScheduledTaskDetailView/tests/ScheduledTaskDetailView.spec.tsx`.

  **Browser verification:** Run the fixture's automated RTL/keyboard cases through the same `test:browser` script; jsdom assertions alone do not establish geometry or browser focus behavior.

## 8. Translations documentation and boundaries

Depends on sections1-7.

- [ ] 8.1 Add missing semantic keys to apps/chat/src/i18n/locales/en.json and ScheduledTasksI18nKeys for edit-load, invalid-schedule, incremental-error and Completed labels; reuse existing validation/Retry/placeholder keys. Keep the shared packages free of i18n keys and hardcoded host copy.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskFormLabels.spec.ts apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx`.

- [ ] 8.2 Update libs/scheduled-tasks, libs/chat-hooks, libs/catalog and libs/builder-form READMEs/JSDoc with real public exports, default values, precedence, styles and examples. Add docs/scheduled-tasks-reuse.md with F01-F15 migration mapping and coherent package rollback; update architecture/theme docs for actual changed boundaries.

  **Verification:** `npm run test:file -- tools/scheduled-tasks-consumer-fixture/tests/package-contract.spec.ts`.

  **Documentation verification:** `npm run validate:docs`; typecheck the documented examples in the consumer fixture.

- [ ] 8.3 Add architecture/package guards verifying no app/router/auth/env/storage/analytics/i18n integration inside UI libs and only injected configured-client usage in chat-hooks. Check extensionless relative TS imports, bundler resolution, declared dependencies and no accidental eager CatalogModal/editor loading.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/tests/public-contract.spec.ts tools/scheduled-tasks-consumer-fixture/tests/package-contract.spec.ts`.

## 9. Final acceptance and delivery

Depends on every preceding section. No external application edits or registry publishing in these implementation tasks.

- [ ] 9.1 Run final contract regressions and the built-package browser fixture; record evidence against every requirement and F01-F15. Search affected parent integration for private-class selectors, DOM placeholder patches, SVG-path hiding and relative node_modules CSS imports, retaining only explicitly justified unrelated code.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/tests/public-contract.spec.ts tools/scheduled-tasks-consumer-fixture/tests/package-contract.spec.ts`.

  **Distribution verification:** `npm run build:quiet`, fixture package/type contract and `npm --prefix tools/scheduled-tasks-consumer-fixture run test:browser` against fresh tarballs.

- [ ] 9.2 Complete documentation, format and full workspace verification once; prepare release notes identifying additive APIs, correctness fixes and CSS behavior changes. Do not archive unrelated active changes.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/tests/public-contract.spec.ts`.

  **Completion verification:** `npm run validate:docs`, scoped Prettier check, and exactly one `npm run verify:full`. Record pre-existing failures separately; all change-specific regressions must pass. Keep every task unchecked until its implementation and evidence exist.


