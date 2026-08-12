## MODIFIED Requirements

### Requirement: `ConversationSourcesPanel` renders a global empty state or the source sections

`ConversationSourcesPanel` SHALL render either a global empty state or the source/task sections described below. `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` accepts no props, imports `SidebarPanel` from `@epam/ai-dial-sidebar`, obtains messages from `useSourcesSidebar()`, derives `uploaded`, `generated`, and `sources` through `useConversationSources(messages)`, reads `useActiveScheduledTask()` for scheduled-task state, and renders `<SidebarPanel side="right">`.

The panel SHALL use `useAttachmentAction()` to obtain `handleAttachmentClick` and SHALL pass it as `onAttachmentClick` to both `FilesSection` instances (Uploaded Files and Generated Files).

The panel SHALL be considered empty when `uploaded.length === 0` AND `generated.length === 0` AND `sources.length === 0` AND the active conversation is not a scheduled-task conversation (per `useActiveScheduledTask()`). When the active conversation is a scheduled-task conversation, the panel SHALL NEVER be considered empty, even if `uploaded`, `generated`, and `sources` are all empty — the History and Details sections (see the ADDED requirements below) always render in that case.

When the panel is empty (per the updated definition above):

- The header SHALL contain only the built-in close button; `leftActions` and `rightActions` SHALL not render search or download-all buttons.
- The body SHALL render `DialNoDataContent` from `@epam/ai-dial-ui-kit`, centred horizontally and vertically, with `title` set to the i18n value of `basic.noData` (`"No data"`). No `icon` prop is supplied, so `DialNoDataContent` uses its default icon.
- No section headings SHALL be rendered.

When the panel is not empty:

- `leftActions` SHALL contain a search input (text field with `IconSearch`) whose `aria-label` is the i18n value of `sidebar.sources.search`. Typing into the input filters sources as described in the Search scenario below. The search input SHALL only render when at least one of `uploaded`, `generated`, or `sources` is non-empty; it MAY be omitted when the conversation has no searchable file/source content even if scheduled-task sections are rendering.
- `rightActions` SHALL contain a `GhostIconButton` with `IconDownload` and the i18n `aria-label` `sidebar.sources.downloadAll`. This button SHALL be enabled whenever at least one attachment in `uploaded` or `generated` is downloadable (i.e. has a DIAL-hosted file URL resolvable by the same mechanism `handleAttachmentClick` uses), and SHALL be disabled only when no attachment currently in `uploaded`/`generated` is downloadable. This action operates only on `uploaded`/`generated` attachments and is unaffected by scheduled-task section content.
- Activating the enabled download-all button SHALL trigger a download of every downloadable attachment in `uploaded` and `generated`, using the same URL-resolution and download-triggering mechanism as clicking an individual attachment card. Attachments that are not downloadable via that mechanism (e.g. reference-only attachments) SHALL be silently skipped, matching single-click behavior for those attachments.
- The body SHALL render sections in the following order:
  1. When the active conversation is a scheduled-task conversation: the History section, then the Details section (both defined in the ADDED requirements below).
  2. The Uploaded Files `FilesSection`.
  3. The Generated Files `FilesSection`.
  4. `SourcesSection` (receiving `sources={filteredSources}`, `title`, and `copyLabel`).
- Uploaded Files, Generated Files, and Sources SHALL retain their existing individual empty behavior (rendering `null` when their own list is empty) regardless of whether scheduled-task sections are present.

For both states:

- `onClose` SHALL call `useSourcesSidebar().handleClose()`.
- `ariaLabel` SHALL be the i18n value of `sidebar.sources.ariaLabel`.
- `closeLabel` SHALL be the i18n value of `sidebar.base.close`.
- `SidebarPanel`'s `title` (per the ADDED "panel header" requirement below) SHALL be independent of the empty/non-empty distinction above.

#### Scenario: Global empty state when no files exist and no scheduled task is active

- **WHEN** `ConversationSourcesPanel` derives empty `uploaded`, `generated`, and `sources` lists AND the active conversation is not a scheduled-task conversation
- **THEN** the body shows centred `DialNoDataContent` with the `basic.noData` title and default icon
- **AND** no section heading is rendered
- **AND** no search or download-all button is rendered

#### Scenario: Scheduled-task conversation is never shown the global empty state

- **WHEN** the active conversation is a scheduled-task conversation AND `uploaded`, `generated`, and `sources` are all empty
- **THEN** the panel does not render `DialNoDataContent`
- **AND** the History and Details sections render with their own loading/empty/error states

#### Scenario: Any derived file or source switches the panel to section content

- **WHEN** at least one attachment is present in `uploaded`, `generated`, or `sources`
- **THEN** the global empty state is not rendered
- **AND** the search input is rendered enabled
- **AND** the Uploaded Files, Generated Files, and Sources sections are rendered

#### Scenario: Download-all button is enabled when a downloadable attachment is present

- **WHEN** at least one attachment in `uploaded` or `generated` has a DIAL-hosted file URL
- **THEN** the download-all button in `rightActions` is rendered without the `disabled` attribute

#### Scenario: Download-all button is disabled when nothing is downloadable

- **WHEN** `uploaded` and `generated` contain only attachments without a resolvable DIAL-hosted file URL (or both lists are empty)
- **THEN** the download-all button is rendered with the `disabled` attribute

#### Scenario: Download-all ignores scheduled-task section content

- **WHEN** the active conversation is a scheduled-task conversation with a populated History section but empty `uploaded`/`generated`
- **THEN** the download-all button is disabled and activating it (if somehow enabled) triggers no download related to run history or task details

#### Scenario: Activating download-all downloads every downloadable attachment

- **WHEN** the user activates the enabled download-all button while `uploaded` has one downloadable attachment and `generated` has two downloadable attachments
- **THEN** the same download mechanism used for individual attachment clicks is invoked once per downloadable attachment, for all three attachments

#### Scenario: Non-downloadable attachments are skipped by download-all

- **WHEN** the user activates the enabled download-all button while one attachment in `uploaded` or `generated` is not downloadable (no resolvable DIAL-hosted URL)
- **THEN** no download is triggered for that attachment
- **AND** downloads are still triggered for the remaining downloadable attachments

#### Scenario: Search filters sources by title, URL, and quote

- **WHEN** the user types into the search input
- **THEN** the `filteredSources` list retains only sources where `title`, `url`, or `quote` contains the query (case-insensitive)
- **AND** `isNoResults` is true only when all three filtered lists (`uploaded`, `generated`, `sources`) are empty after filtering
- **AND** the History and Details sections are unaffected by the search query and are never included in `isNoResults`

#### Scenario: Close button closes the sidebar via context

- **WHEN** the user activates the close button
- **THEN** `useSourcesSidebar().isOpen` becomes `false` on the next read
- **AND** the stored sidebar messages are cleared

#### Scenario: Non-empty sections render in fixed order for non-task conversations

- **WHEN** the panel is not empty and the active conversation is not a scheduled-task conversation
- **THEN** Uploaded Files appears first, Generated Files second, Sources third

#### Scenario: Section order for scheduled-task conversations places task sections first

- **WHEN** the active conversation is a scheduled-task conversation
- **THEN** History appears first, Details second, Uploaded Files third, Generated Files fourth, Sources fifth

#### Scenario: Panel passes click handler to both file sections

- **WHEN** `ConversationSourcesPanel` renders with non-empty `uploaded` and `generated`
- **THEN** both `FilesSection` instances receive the same `onAttachmentClick` handler from `useAttachmentAction`

#### Scenario: Clicking an attachment card triggers download

- **WHEN** a user clicks an attachment card in the panel
- **THEN** `handleAttachmentClick` is invoked with the corresponding `DisplayAttachment`

### Requirement: All sidebar user-visible strings come from i18n

All user-visible strings in the right sidebar (toggle aria-label, panel aria-label, close label, section titles, search and download-all aria-labels, attachment click label, and the new History/Details section strings) SHALL be sourced from i18n keys. Sidebar-specific strings live under `sidebar.base.*` and `sidebar.sources.*` in `apps/chat/src/i18n/locales/en.json`; the all-empty "No data" string reuses `basic.noData`. A typed `SidebarI18nKeys` enum/object SHALL be exposed from `apps/chat/src/constants/translation-keys.ts` for consumers.

New History/Details/task-summary strings introduced for scheduled-task conversations SHALL reuse existing `scheduledTasks.detail.*` keys, shared button keys, and run-status keys wherever their meaning matches (e.g. status labels, the "no runs" empty state, retry button text) instead of duplicating equivalent English strings under `sidebar.*`. Keys with no existing equivalent (e.g. the "History"/"Details" section titles as they appear in this panel, the load-more `aria-live` status text) SHALL be added under `scheduledTasks.conversationPanel.*`.

#### Scenario: New keys added to en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains keys `sidebar.base.toggleOpen`, `sidebar.sources.ariaLabel`, `sidebar.sources.downloadAll`, `sidebar.sources.sections.uploadedFiles`, `sidebar.sources.sections.generatedFiles`, `sidebar.sources.sections.sources`, `scheduledTasks.conversationPanel.modelLabel`, `scheduledTasks.conversationPanel.currentRunLabel` — History/Details section titles and the "Show more" button reuse existing keys (`scheduledTasks.detail.historyTitle`, `scheduledTasks.create.detailsSectionTitle`, `buttons.showMore`) rather than duplicating them under `conversationPanel.*`

#### Scenario: Components consume the typed key map

- **WHEN** any sidebar or scheduled-task-section component reads an i18n string
- **THEN** it does so via `t(SidebarI18nKeys.<Member>)` or the equivalent typed scheduled-tasks key map, not via a hardcoded English literal

#### Scenario: Equivalent existing strings are reused, not duplicated

- **WHEN** a History row's status label or the "no runs" empty-state text is rendered inside the sources panel
- **THEN** it uses the same i18n key already defined for that meaning under `scheduledTasks.detail.*`, not a newly duplicated key with equivalent English text

## ADDED Requirements

### Requirement: Panel header shows the scheduled task's display name with a conversation-title fallback

For a scheduled-task conversation, `SidebarPanel`'s `title` SHALL show the fetched `ScheduledTaskDto.displayName` once `taskState === 'success'`. While `taskState === 'loading'` or on `taskState === 'error'`, `title` SHALL fall back to the conversation's own title. For non-scheduled-task conversations, `title` SHALL be omitted/unchanged from current behavior.

`libs/source-panel`'s `ConversationSourcesPanelProps` SHALL gain an optional `title?: ReactNode`, passed through unchanged to the underlying `SidebarPanel`'s existing `title` prop. This prop SHALL carry no scheduler-specific typing or defaults inside the lib — it is a plain, host-agnostic `ReactNode` slot.

#### Scenario: Header shows task display name once loaded

- **WHEN** the active conversation is a scheduled-task conversation and `taskState === 'success'`
- **THEN** the panel header shows the task's `displayName`

#### Scenario: Header falls back to conversation title while loading or on error

- **WHEN** the active conversation is a scheduled-task conversation and `taskState` is `'loading'` or `'error'`
- **THEN** the panel header shows the conversation's title instead of a task name

### Requirement: History section shows the task's run list with the active run highlighted

For a scheduled-task conversation, the panel SHALL render a History section built from a shared, host-agnostic presentational component (`ScheduledTaskRunHistoryList`, extracted from the existing `ScheduledTaskDetailView` history rendering into `libs/scheduled-tasks`) fed by the same `useScheduledTaskRuns` state already owned by `ActiveScheduledTaskContext` — no independent fetch is issued by the sources panel.

Each row SHALL show: a localized timestamp (reusing the existing `formatRunTimestamp` convention), a duration suffix when available, and a status icon for `Success`, `Error`, `InProgress`, or `Missed` (reusing the existing `ScheduledTaskRunStatus` enum and icon mapping). Each row's accessible name SHALL include both its status and its timestamp.

The row whose `id` equals the active conversation's `runId` SHALL receive a current-run visual treatment matching the reference design, AND an accessible indication that does not rely on color alone (e.g. an `aria-current="true"` attribute or equivalent text conveyed to assistive technology). If the active `runId` is not present in the currently loaded pages, no row is marked current until a subsequent page load includes it; the section SHALL NOT eagerly fetch every page solely to locate that run.

Run rows are informational only in this section: activating a row SHALL NOT navigate to another conversation, fetch run details, or expose any additional row actions.

Runs SHALL be shown in server order (newest first), matching the order already returned by `listScheduledTaskRuns` and preserved by `useScheduledTaskRuns`'s append-without-resort behavior.

#### Scenario: Row shows status, timestamp, and duration

- **WHEN** a loaded run has `status: 'Success'` and a `durationSeconds` value
- **THEN** its row shows a success status icon, its formatted timestamp, and a duration suffix
- **AND** the row's accessible name mentions both the status and the timestamp

#### Scenario: Active run is visually and accessibly marked

- **WHEN** a loaded run's `id` equals the active conversation's `runId`
- **THEN** that row receives the current-run visual treatment
- **AND** an accessible attribute or text conveys "current run" independent of color

#### Scenario: Active run not yet loaded shows no highlighted row

- **WHEN** the active `runId` is not present among the currently loaded run items
- **THEN** no row is marked as current
- **AND WHEN** a later page load includes that run
- **THEN** that row becomes marked as current without any additional fetch triggered solely to find it

#### Scenario: Row click is a no-op

- **WHEN** the user clicks or activates a run row
- **THEN** no navigation occurs, no run-detail request is issued, and no additional menu or action appears

### Requirement: History section supports skeleton, empty, and error states with a "Show more" pagination button

The History section SHALL show 6 skeleton rows during the initial load (matching `ScheduledTaskDetailView`'s existing skeleton-row convention) and appended skeleton rows while a "Show more" request is in flight. It SHALL show a localized empty state when the task has zero runs, and a section-scoped error message with a retry action when the initial or a subsequent page request fails — this error SHALL NOT hide the Details section, the file/source sections, or the conversation itself.

Unlike `ScheduledTaskDetailView`'s own History card (which keeps its existing scroll-triggered infinite loading, unchanged by this capability), the conversation sources panel's History section SHALL use an explicit **"Show more" button** rendered below the loaded rows instead of a scroll sentinel:

- The button SHALL render only when `hasMore === true`; it SHALL NOT render once `hasMore === false`.
- Activating the button SHALL call `useScheduledTaskRuns.loadMore` (page size 20, offset based on server rows consumed, append without client re-sort, dedupe by run id, `hasMore` derived from `count`/`next` — all reused unmodified) exactly once per activation.
- The button SHALL show a busy/loading state and SHALL be disabled while `isLoadingMore === true`, preventing duplicate requests from repeated activation.
- The button (and the rows it appends to) only exists while the History section is expanded — collapsing the section via the accordion removes it from view and, since its content is not interactable while collapsed (see the collapsible-sections requirement), no further pages can be requested until it is re-expanded.
- Any in-flight request SHALL be cancelled or its result ignored if `scheduleId` changes before it resolves.

#### Scenario: Initial loading shows skeleton rows

- **WHEN** the History section's first page request is in flight
- **THEN** 6 skeleton rows render in place of real rows

#### Scenario: Empty task shows a localized empty state

- **WHEN** the task has zero runs and the initial load has completed successfully
- **THEN** a localized empty-state message renders instead of any rows
- **AND** no "Show more" button renders

#### Scenario: History error is scoped and retryable

- **WHEN** the initial or a "Show more" run-history request fails
- **THEN** a History-scoped error message and retry action render
- **AND** the Details section, file/source sections, and conversation messages remain visible and unaffected

#### Scenario: "Show more" button loads the next page exactly once per click

- **WHEN** `hasMore === true`, no request is in flight, and the user activates the "Show more" button
- **THEN** exactly one load-more request is issued
- **AND** the button shows a busy/disabled state until the request settles

#### Scenario: Button is hidden once every page is loaded

- **WHEN** a page response indicates no further pages (`hasMore` becomes `false`)
- **THEN** the "Show more" button is no longer rendered

#### Scenario: Collapsing History hides the button along with the rows

- **WHEN** the History section is collapsed
- **THEN** the "Show more" button (and the loaded rows) are not interactable, per the collapsible-sections requirement

#### Scenario: Deduplication across pages

- **WHEN** two consecutive pages happen to include an overlapping run `id`
- **THEN** the rendered list contains that run exactly once

#### Scenario: Initial page loads even while the panel is closed

- **WHEN** scheduler metadata resolves for the active conversation while the sources panel is closed
- **THEN** the initial run-history page request still starts (owned by `ActiveScheduledTaskContext`, independent of panel open state)
- **AND** no "Show more" request is issued until the panel is opened, History is expanded, and the user activates the button

### Requirement: Details section shows resolved model and rendered instructions

For a scheduled-task conversation, the panel SHALL render a Details section built from a shared, host-agnostic presentational component (`ScheduledTaskDetailsSummary`, `libs/scheduled-tasks`) showing:

- **Model**: the task's model resolved to its deployment display name via the existing deployments context (the same resolution used in `ScheduledTaskDetailPage.tsx:106`), falling back to the raw model id when unresolved.
- **Instructions**: the task's prompt/instructions rendered through the same shared markdown renderer (`MDMessageViewer` from `@epam/ai-dial-chat-shared`) used by `ScheduledTaskDetailView` and chat assistant messages — raw markdown SHALL NOT be shown as plain text, and no separate markdown implementation SHALL be introduced.

The Details section SHALL NOT render edit controls. It is a concise summary; the "Task details" navigation (see `scheduled-task-conversation-context`) remains the path to the full task view.

#### Scenario: Model resolves to its deployment display name

- **WHEN** the task's `model` id matches a known deployment
- **THEN** the Details section shows that deployment's display name, not the raw id

#### Scenario: Unresolvable model falls back to the raw id

- **WHEN** the task's `model` id does not match any known deployment
- **THEN** the Details section shows the raw model id

#### Scenario: Instructions render as formatted markdown

- **WHEN** the task's instructions contain markdown syntax (e.g. lists, bold text)
- **THEN** the Details section renders that formatting via `MDMessageViewer`, not as an escaped/plain-text string

#### Scenario: No edit affordance is present

- **WHEN** the Details section is inspected
- **THEN** no edit button, input, or other mutation control is rendered

### Requirement: History and Details sections are independently collapsible with reset-on-conversation-change defaults

The History and Details sections SHALL each be wrapped in a controlled `DialAccordion` (from `@epam/ai-dial-ui-kit`), controlling `expanded` explicitly rather than relying on `defaultExpanded`. History SHALL default to expanded; Details SHALL default to collapsed. When the active scheduled-task conversation changes (a new `scheduleId`), both sections SHALL reset to these default states.

Each section's trigger SHALL be a keyboard-operable button exposing `aria-expanded` and associated with its controlled content region (e.g. via `aria-controls` and a matching `id`). Directional chevrons SHALL mirror correctly in RTL. When a section is collapsed, its content SHALL NOT retain focusable descendants in the tab order (verified against `DialAccordion`'s actual mount/unmount behavior; if content remains mounted while hidden, the call site SHALL apply `inert` to the collapsed content per `.claude/rules/a11y.md`). Loading and error messages inside each section SHALL use scoped `role="status"`/`role="alert"` semantics as appropriate, not a page-level equivalent.

#### Scenario: Default expand/collapse state

- **WHEN** a scheduled-task conversation is opened and the sources panel renders its sections for the first time
- **THEN** History is expanded and Details is collapsed

#### Scenario: State resets when the active conversation changes

- **WHEN** the user navigates from one scheduled-task conversation to a different one
- **THEN** History returns to expanded and Details returns to collapsed, regardless of their state on the previous conversation

#### Scenario: Trigger is keyboard-operable and exposes expanded state

- **WHEN** a section's header trigger receives keyboard focus and is activated via Enter/Space
- **THEN** the section's expanded state toggles
- **AND** `aria-expanded` on the trigger reflects the new state

#### Scenario: Collapsed content is unreachable by keyboard

- **WHEN** a section is collapsed
- **THEN** Tab navigation does not land on any focusable element that was inside that section's content

#### Scenario: Chevrons mirror in RTL

- **WHEN** the document direction is `rtl`
- **THEN** each section's expand/collapse chevron is mirrored relative to its `ltr` rendering

### Requirement: Scheduled-task requests and sections are gated by the scheduledTasksEnabled feature flag

When `useFeatureFlag('scheduledTasksEnabled')` is `false`, `ConversationSourcesPanel` SHALL make no `getScheduledTask` or `listScheduledTaskRuns` requests (enforced upstream by `ActiveScheduledTaskContext` treating the conversation as non-task, per the `scheduled-task-conversation-context` capability) and SHALL render no History, Details, or task-derived panel title — the panel falls back entirely to its pre-existing behavior for that conversation. This does not alter the TASK badge in the conversation panel, which remains flag-independent per its existing specification.

#### Scenario: Disabled flag suppresses task sections without affecting the badge

- **WHEN** `scheduledTasksEnabled` is `false` for a user viewing a conversation whose list item has `isScheduledTask === true`
- **THEN** the conversation panel still shows the TASK badge
- **AND** the sources panel renders no History or Details sections and makes no scheduled-task API requests
- **AND** the panel header shows the conversation title, not a task display name

### Requirement: Scheduled-task section errors are isolated from attachment/source content and from each other

Task-detail failure, run-history failure, and attachment/source-derivation issues SHALL be independent failure domains within the panel:

- A `getScheduledTask` failure SHALL NOT hide the History section, the existing file/source sections, or the conversation.
- A run-history failure SHALL NOT hide the Details section.
- An attachment/source rendering issue SHALL NOT hide the History or Details sections.
- A `404` from `getScheduledTask` (task deleted) SHALL be treated as "task unavailable": the conversation and existing sections remain visible, and the Details/History sections show a localized "unavailable" state rather than an app-level error.
- `401`/`403`/`429`/`502`/`503` responses SHALL follow the existing API error/notification conventions without redirecting away from the conversation.
- Each section's retry action SHALL retry only its own failed request (task detail vs. run history), not the other.

#### Scenario: Task-detail 404 keeps the conversation and other sections visible

- **WHEN** `getScheduledTask` responds with `404`
- **THEN** the conversation and existing Uploaded/Generated/Sources sections remain visible
- **AND** the Details section (and the panel title, per the header-fallback requirement) show a localized "unavailable" state instead of the task name/content

#### Scenario: Run-history failure does not hide Details

- **WHEN** the initial run-history request fails
- **THEN** the Details section still renders (assuming `getScheduledTask` succeeded)

#### Scenario: Retry only affects its own section

- **WHEN** the user activates the History section's retry action after a run-history failure
- **THEN** only the run-history request is retried, and the Details section's own state (if it had succeeded) is unchanged

#### Scenario: Rate-limited or upstream-unavailable responses use existing conventions

- **WHEN** `getScheduledTask` or `listScheduledTaskRuns` responds with `429`, `502`, or `503`
- **THEN** the existing app-wide API error/notification handling applies
- **AND** the user is not redirected away from the conversation
