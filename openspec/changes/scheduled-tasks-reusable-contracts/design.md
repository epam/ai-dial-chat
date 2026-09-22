## Context

This change makes scheduled tasks reusable by the reference chat application and independent consuming applications. Repository-relative source paths below refer to ai-dial-chat. Consumer findings describe integration patterns without depending on a particular external repository; source line numbers are review snapshots, not stable identifiers.

### Findings and traceability

| ID | Observed evidence | Resolution / acceptance owner |
| --- | --- | --- |
| F01 | A consuming application observes editor DOM to insert a placeholder; libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx:458 does not forward it | Form label contract; editor lazy/remount/locale tests |
| F02 | Consumer create/edit validation only checks name/model/prompt; an empty weekly/monthly day serializes hour/minute only | Shared validator and checked preparation; create/edit adapter tests |
| F03 | Consumer task-list and run-history hooks accept stale load-more responses after query or task identity changes | Shared hooks; deferred-response tests for sort/search/refetch/task changes |
| F04 | Consumer repeat formatting uses an edit mapper that requires unrelated model/prompt metadata | Trigger-only descriptor, separate editability check |
| F05 | Consumer edit loading maps transport failure to unsupported; detail loading renders no content on 404 | Distinct load states and reset-on-identity-change tests |
| F06 | Consumer styles hide SVG paths to replace the back icon and insert a sort icon through a private class | Real Tabler icons, backIcon/sortIcon public slots |
| F07 | Consumer dashboard styles target private status classes; the grid accepts cardStyles but ScheduledTasks does not forward it | Top-level style forwarding, explicit status, scoped grid settings |
| F08 | Consumer detail styles target nth-child and private history classes with !important | Semantic layout/history contracts, full-height divider and row interactions |
| F09 | Consumer selector styles override a nested div to remove the panel minimum width | Catalog picker presentation with fit-container sizing |
| F10 | Consumer create/edit pages duplicate labels/options and differ in field-error clearing | Local shared labels hook and common validation consumption |
| F11 | Missing builder-form CSS produced a black header border; library and host desktop utilities resolve at different widths | Complete documented stylesheet entry and CSS collision fixture |
| F12 | Consumer detail model-label resolution looks up deployment.id and returns the same id instead of the display name | Host-resolved display label, raw stored id fallback |
| F13 | Consumer dashboard formats Next run/Recurring schedule independently of details; load-more errors share initial error state | Common trigger descriptors; keep next-run distinct; incremental retry state |
| F14 | Delete title/body/consequences/button appearance currently live in an app component and required a title-size adjustment | Reusable confirmation presentation with host content, typography and action styles |
| F15 | Installed card API expresses isActive but not an explicit Completed label | Optional presentation status and labels; host supplies lifecycle interpretation |

The findings were observed while integrating published packages into an external application. F02, both F03 races, and F04 were reproduced with four temporary diagnostics during review; 11 existing tests also passed. Those diagnostics were removed and are not committed regression tests.

### Parent precedents and spec reconciliation

- `apps/chat/src/utils/scheduled-task-form-validation.ts:38` already validates the full form. Extract behavior; do not imply it is missing in the parent.
- `apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts:133` already cancels pending pagination. Preserve this in the exported hook.
- `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts:122` documents validated-input assumptions; existing mapper exports remain compatible.
- `apps/chat/src/utils/map-scheduled-task-dto.ts:138` already builds trigger labels independently. Factor its supported cases into the common descriptor, rather than replacing it with the more restrictive edit mapper.
- `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts:175` already has an opaque modelSelector. Keep this boundary.
- `libs/builder-form/src/components/BuilderFormHeader/BuilderFormHeader.tsx:51` supplies the current back icon.
- Existing scheduled-task-detail-page requirements already demand NotFound/retry handling. F05 is a consumer parity gap, not a new parent product policy.
- Some older specs use `texts`, legacy Dial component names or older package names while current source uses `labels` and current UI-kit components. New APIs extend actual current types; do not introduce aliases merely to perpetuate stale wording.
- Preserve the implemented `redesign-scheduled-task-create-editor` and `scheduled-task-detail-view-mobile-tabs` changes. They are listed as complete but remain in active changes. Do not archive or rewrite them here.
- `add-scheduled-task-offline-credentials-login` is in progress. Its banner, credential flow and provider contracts are regression constraints, not migration targets.

## Goals / Non-Goals

Goals: public configuration instead of DOM/CSS interception; shared correctness across hosts; additive package API; an independently built consumer proving the contract.

Non-goals: new packages/global providers/backend endpoints; schedule timezone-policy changes; a skill selector; auth/route/catalog modal ownership inside libraries; modifying or publishing external consuming applications in this parent-scoped change.

## Decisions

### 1. Ownership and dependencies

| Owner | Responsibility | Receives from host |
| --- | --- | --- |
| scheduled-tasks | Presentational form/list/detail/history/confirmation, form value types and pure validation | Values, localized labels/errors, modelSelector, callbacks, style/layout options |
| builder-form | Reusable header/shell, back icon slot | Actions, labels, style values, icon node |
| catalog | Controlled deployment-picker presentation | Resolved display records, selection, favorites, loading/error state, search and action callbacks |
| chat-hooks /scheduled-tasks | Trigger conversion/descriptors, checked body preparation, configured-client facade and async list/history state | Configured client/facade, enabled, query/sort/task identity, paging configuration |
| apps/chat | Route/page state, i18n, deployment resolution, notifications, catalog/modal and auth wiring | Existing app providers and server-api singleton |

No UI library imports app modules, generated clients, routing or i18n. chat-hooks follows the narrow generated-client exception: it accepts an already configured client and never constructs Configuration, auth/CSRF headers, URL roots or storage. No new persistent cache; hook state lasts for the mounted query. No TTL is introduced. Reload and successful mutations invalidate the appropriate query through host callbacks.

### 2. Form customization is explicit and narrow

Add optional `labels.instructionsPlaceholder: string` to the current form labels interface and forward it directly to the lazy MarkdownEditor. Undefined preserves the editor's current default; empty string explicitly means no placeholder. Updates apply after locale changes and preview/edit remounts. Do not expose an unrestricted third-party editorProps bag.

Add optional `backIcon: ReactNode` to BuilderFormHeader and the intermediate BuilderForm shell props, and to ScheduledTaskCreateForm/DetailView. Generic builder defaults remain compatible; scheduled-task surfaces use IconArrowNarrowLeft by default. Add optional `sortIcon: ReactNode` to ScheduledTasks, default IconArrowsSort. Undefined selects the default; null suppresses only the decorative icon. Controls retain labels and accessible names. Token stroke and RTL mirroring apply to directional default icons; document custom-icon responsibility.

Add root `className?: string` to the scheduled-task composition surfaces. Extend existing typed `styles.colors` and `styles.typography` objects instead of creating a second theming system. Add typed layout values only for documented configuration points. Style props override documented component variables, which fall back to theme tokens. Overrides live on the component root and cannot bleed between instances.

### 3. Concrete visual configuration surface

The following names and values are the intended contract; existing equivalent fields are reused rather than duplicated.

| Surface | Public configuration | Default / external-consumer acceptance |
| --- | --- | --- |
| ScheduledTasks | cardStyles forwarded to grid/cards; sortIcon; className; gridLayout { maxColumns, minCardWidth, maxWidth, gap, cardHeight } | Scoped responsive grid; external-consumer fixture uses 3, 320px, 1120px, 20px, 184px; 1/2/3 columns as available inline space permits |
| Card | optional status enum Active/Paused/Completed; labels for statuses; per-status title/badge foreground/background in styles.colors | Explicit status wins; absent status preserves isActive mapping; external-consumer fixture sets Paused/Completed backgrounds transparent and title to --text-secondary |
| Create/edit | backIcon; labels.instructionsPlaceholder; existing headerBorder; styles.layout for column sizing/gap | Tertiary header border without an app importing private dependency CSS |
| DetailView | backIcon; className; styles.layout { detailsWidth, configurationMinWidth, historyWidth, columnGap }; historyStyles forwarded | external-consumer fixture uses details 220-280px, configuration >=280px, history outer width up to 408px / inner panel360px; narrow layout falls back before content overflows |
| History | styles.layout { maxHeight, rowMinHeight }; styles.colors { rowHoverBackground, rowFocusBackground }; labels | 40px minimum rows in external-consumer fixture, bounded vertical scroll, neutral hover/focus token; full label and status accessibility |
| Confirmation | title/body/consequences/action labels, styles.typography.titleClassName, cancelAppearance | Host can reproduce 16px title and ghost Cancel |
| Catalog picker | className; styles/layout with fit-container width; explicit desktop popup and mobile-sheet composition inputs | Popup follows reference width, viewport collision handling; nested content min-inline-size:0, no hard360px minimum |

Implement layout sizes as documented CSS-length strings where min()/clamp() is useful, numeric count fields as numbers, with defaults matching current parent behavior unless this change explicitly changes an icon or interaction affordance. A host does not need a private child selector to configure any row in this table. Container queries or scoped media rules are acceptable; global generated utility selectors with host-dependent meaning are not.

Completed is a presentation enum, not a new backend lifecycle. The host derives status using its existing domain rules. The UI must not infer Completed solely from a missing nextRunTime or from isActive=false. Preserve unread badges and existing enable/disable action rules.

### 4. Validation and checked serialization

Export `validateScheduledTaskFormValues(values, { now, minimumLeadMs })` from a pure `@epam/ai-dial-scheduled-tasks/validation` entry. It returns a typed field-to-error-code map; exported codes use string enums. now is an explicit Date and minimumLeadMs defaults to the existing 60000 ms. Reuse current value types, with no i18n, DOM, clock reads or network calls.

Rules: trimmed name/prompt and nonempty model; description <= 500 characters with existing normalization; known repeat value; parseable one-time runAt >=now+lead; strict HH:mm for daily/weekly/monthly; integer minute 0..59 for hourly; integer weekday 0..6 for weekly; integer month-day 1..31 for monthly; valid optional activity dates and end after start according to existing app normalization. Validate only fields active for the selected repeat; stale inactive draft fields cannot block submit or leak into payload.

Use the existing UTC conversion policy, Monday-zero weekday convention, start/end day-boundary conversion, description create/update semantics and fail-closed reverse mapper. Include non-whole-hour timezone regression cases; do not redefine DST behavior in this change.

Add `prepareScheduledTaskCreateBody` and `prepareScheduledTaskUpdateBody` in chat-hooks /scheduled-tasks. Each validates, then returns a discriminated result (success with body, failure with field codes). These are the recommended path before a write operation. Existing mapFormValuesToCreateBody/UpdateBody exports retain signatures and their validated-input precondition for compatibility.

Both parent pages translate the same codes and consume checked preparation. The form's basic disabled guard is not an authorization or validation substitute. Keep errors associated with inputs; clear/recompute a field's error on correction and repeat changes. Invalid submission neither calls API nor changes frequency silently.

### 5. Trigger-only description

Extract `describeScheduledTaskTrigger(trigger, options)` to chat-hooks /scheduled-tasks. Return a typed descriptor enum for one-time/hourly/daily/weekly/monthly/custom/invalid, with parsed display fields, original expression for custom, and explicit source-timezone information. A supplied reference date makes conversion tests deterministic. Use the same local/UTC semantics as existing conversion and parent labels.

No requirement for model, prompt, displayName or editability. Valid schedules that the editor cannot represent remain displayable as custom expressions; malformed dates produce Invalid, not an Intl exception. Do not broaden edit support as a side effect. Preserve existing every-N-minute formatting where supported by the parent formatter.

A host formatter maps descriptors to translations with an explicit locale. Dashboard and details share it; next-run timestamp is a separate piece of information and retains its current product placement. Detail model text resolves the human-readable deployment name through existing host resolution, with the stored id as fallback.

### 6. Configured-client facade and request lifetime

Export `createScheduledTasksApiClient(configuredClient)`, preserving list/get/create/update/pause/resume/delete/runs behavior and operation signatures. Accept a narrow structurally typed subset of the generated client for tests. Normal responses use canonical items/next/count contracts. A legacy results envelope, if needed by a consuming application, is handled by an explicit host adapter; malformed responses are not silently normalized to an empty successful list.

Export `useScheduledTasks(client, options)` and `useScheduledTaskRuns(client, options)`. Keep parent wrapper exports as adapters. Options cover enabled, initial/current search and sort as appropriate, debounce/page size, and scheduleId. Use one clear owner per query value: the shared list hook owns its query/setters unless the host deliberately opts into a documented controlled form; do not implement both modes just for this change. Defaults: list 20, history 10, debounce 300ms.

Each query generation owns its initial request, pagination request, offset, hasMore and error flags. Search/sort/refetch/task/client/enable changes cancel both requests and advance a generation token. Guard success, error and finally paths even if cancellation is ignored. Use a synchronous in-flight guard to avoid repeated loadMore calls before React commits. Deduplicate ids and advance offset by consumed server records. A next link is a hasMore signal, not a URL for the hook to fetch.

Return distinct initialError and loadMoreError, loading flags, hasMore, loadMore, retryLoadMore and refetch. Failed pagination retains loaded items, cursor and retry eligibility; retry requests the failed offset. InitialError owns the whole content state only when initial fetch failed. No automatic retry loops. No optimistic mutation or caching framework is added.

### 7. App states and reusable picker/confirmation

App edit state distinguishes Loading, Ready, NotFound, LoadError and Unsupported. Reset state on task change and accept only current-generation results. Unsupported comes only from a successful DTO rejected by the edit mapper. Retry reloads the same task. Detail keeps its existing NotFound/error contract; a runs error remains local to history.

The catalog package exports a controlled DeploymentSelectorField and reusable panel presentation. Display-record types contain ids, labels and optional resolved icons/metadata, not generated DTOs or app-specific URLs. Accept selectedId, resolved selected label (including unavailable-id fallback), items/favorites, extraOptions, isLoading/error/isDisabled/isInvalid, labelledById, localized labels and onSelect/onBrowse/search callbacks. Host adapters retain deployment resolution, favorites persistence, overlay protocol and CatalogModal opening. A popup/sheet renderer can be supplied as a slot; no provider from apps/chat is required to mount the exported field. Preserve loading, empty, disabled, error, keyboard, unavailable selection and extraOptions behavior of the existing app component.

Export ScheduledTaskDeleteConfirmation from scheduled-tasks. Props contain open, taskName, localized title/body ReactNode, localized consequences list, cancel/confirm/pending labels, isDeleting, onConfirm/onClose and typed styles. Render host content as React nodes, never raw HTML. Pending deletion disables actions and prevents dismissal callbacks; successful close/navigation and notifications remain host-owned.

The reference consumer acceptance content is: title "Delete task"; body "Are you sure you want to delete %name%? This action is permanent and cannot be undone."; consequences "All run conversations will still be accessible.", "All shared configurations will be lost", "Users who rely on it will lose access", "Cannot be undone"; ghost Cancel, 16px title. These are host-supplied strings, not English defaults in the package. Existing parent copy can remain different unless product requirements explicitly align it.

### 8. Stylesheet distribution and package verification

Use documented `@epam/ai-dial-scheduled-tasks/styles.css` and corresponding catalog entry. scheduled-tasks' built CSS includes structural styles required by its private builder-form composition; the host imports UI-kit theme/base CSS as documented. No consumer must discover or deep-import builder-form/index.css to get a tertiary border. Keep existing exported stylesheet paths working if published consumers use them.

Avoid global resets and unscoped responsive utility emission in affected surfaces. Test host utility definitions with desktop thresholds 769px and1280px, including both stylesheet orders. A scheduler's dimensions follow its own scope/container, while unrelated host elements are unaffected.

Create `tools/scheduled-tasks-consumer-fixture/` using packed dist artifacts and their workspace dependency closure, following `tools/attachment-canvas-consumer-fixture/`. It has no parent tsconfig aliases or app imports. It demonstrates all surfaces, alternate labels/styles, custom/absent icons and fake configured adapters. Unit/type checks cannot replace browser geometry, keyboard and CSS-order checks.

### 9. i18n, access, documentation and observability

Keep scheduledTasksEnabled and current ENABLED_FEATURES/role policy in app adapters; pass enabled to hooks, never feature-key strings to libs. No endpoint or authorization change.

Reuse existing ScheduledTasksI18nKeys for validation, placeholder, repeat descriptions and deletion. Consolidate create/edit labels in a local useScheduledTaskFormLabels(mode). New semantic strings, when absent, use keys `scheduledTasks.edit.loadError`, `scheduledTasks.schedule.invalid`, `scheduledTasks.history.loadMoreError`, `scheduledTasks.list.loadMoreError`, `scheduledTasks.card.completed`; reuse the existing Retry key. Libraries receive translated strings and never know keys. The fixture includes "Choose a skill, write custom instructions, or combine both", "Describe what this task should do step by step and what output it should produce", and "No tasks runs yet" exactly as requested; skill selection is still absent.

Follow AGENTS.md RTL/a11y: logical spacing, mirrored back arrows, labels independent of icons, keyboard picker and modal focus restoration, visible focus and scoped live error feedback. Retain existing search Highlight usage. Theme tokens remain the source of colors; do not hardcode #6F7073 in a shared fallback to bypass theme/contrast policy.

No new telemetry; hook errors are returned, notifications/logging remain host callbacks. Do not log prompts or task names. Public API docs and migration guide contain typechecked usage snippets, defaults, precedence and CSS imports. Update architecture/theme docs only where the implemented boundary changes them.

## Risks / Trade-offs

- [Shared builder header affects other editors] -> preserve generic default; scheduled-tasks opts into its narrow icon, with regression tests.
- [Validation extraction changes edge cases] -> pin current parent behavior and clock/timezone inputs in tests before extraction.
- [Catalog extraction pulls in app contexts or heavy catalog UI] -> narrow display types and composition slots; verify dist imports and avoid eagerly importing CatalogModal.
- [CSS aggregation changes cascade or duplicates styles] -> scope styles, test both orders and multiple instances; document singleton theme CSS.
- [Status inference diverges across hosts] -> UI accepts a resolved status; domain policy stays explicit at app edge.
- [One umbrella change becomes a large rewrite] -> vertical slices, existing exports retained, no new framework/package, each slice independently verified.
- [Published packages differ from workspace aliases] -> acceptance is against tarballs, not source-only tests.

## Migration Plan

1. Extract validator/checked preparation and request lifetime behavior with parent adoption and regression tests.
2. Add presentation contracts, picker and confirmation with backward-compatible defaults; wire the parent through public APIs.
3. Publishable builds and the external fixture prove CSS/types/runtime behavior. Update README/API defaults, migration guide and relevant architecture/theme docs.
4. After normal release, external application adoption replaces local pagination/formatting copies with shared exports, passes placeholder/back/sort/style props, switches public CSS imports, and deletes its local form-placeholder observer and private-selector overrides. Retain only application adapters and legitimate page composition.
5. Rollback pins the entire compatible package set and restores adapters together. No data rollback or auth changes.

External application migration is documented and represented in the parent-owned fixture; it is not an unbounded cross-repository implementation task. Registry publication and an external application upgrade are separate delivery actions.

## Open Questions

No blocking product decision remains. The exact release version follows the normal publishing process. During implementation, verify any current UI-kit limitation through its MCP documentation; if a required prop is missing, record a specific upstream dependency rather than reintroducing a DOM workaround. Older specs' legacy naming is acknowledged above and must not cause a breaking rename.

