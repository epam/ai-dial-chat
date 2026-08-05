## ADDED Requirements

### Requirement: Scheduled-task conversations show a TASK badge in the history panel

`ConversationHistoryItem` (exported from `@epam/ai-dial-conversation-panel`) SHALL include two optional presentational fields: `showTaskBadge?: boolean` and `taskBadgeLabel?: string`. The lib carries no knowledge of scheduler ids, feature flags, or API shapes — these are plain display props, following the same pattern as the existing `iconTooltip` field.

`ConversationRow` SHALL render a compact pill badge (clock icon + uppercase label text) at the end of the row, after the title and before/alongside the row's overflow-actions trigger, whenever `showTaskBadge` is `true`. The badge uses a neutral/grey background consistent with the design system's informational-pill styling. When `showTaskBadge` is `false` or omitted, no badge is rendered and row layout is unchanged from today.

The badge is **informational only**: it has no click handler, is not a link, and does not navigate anywhere. It renders regardless of whether the `scheduledTasksEnabled` navigation feature flag is enabled for the current user — the underlying conversation exists independent of that flag.

**App wiring (`ConversationPanelView` in `apps/chat`).** The app maps `ConversationListItemDto.isScheduledTask` to `showTaskBadge`, and resolves `taskBadgeLabel` from the i18n key `conversationPanel.taskBadgeLabel` (English default: `"TASK"`). `scheduleId`/`runId` are not passed to the lib in this iteration since no interactive behavior consumes them yet. This mapping follows the existing pattern used for `sharedWithMe`/`publishedWithMe` → `ConversationSource`.

**Row layout.** When both a task badge and the row's overflow-actions trigger (see "Panel rows expose per-item actions") are present, `ConversationRow` SHALL adjust end-padding (mirroring the existing `getButtonPaddingEnd` pattern) so the title, badge, and action trigger do not overlap and the title still truncates with ellipsis.

**a11y.** The clock icon inside the badge SHALL be `aria-hidden` — the row's own accessible name already comes from the conversation title, and the badge does not need its own separate accessible name beyond the visible "TASK" text, which remains in the accessibility tree as plain text content.

**RTL.** The badge SHALL use logical spacing utilities (`ms-*`/`me-*`, `end-*`) so it stays pinned to the trailing edge of the row in both LTR and RTL. The "TASK" label text itself is not mirrored or flipped.

**i18n.** `conversationPanel.taskBadgeLabel` (value `"TASK"`) SHALL be added to `apps/chat/src/i18n/locales/en.json` and to the `ConversationPanelI18nKeys` type/interface consumed by `ConversationPanelView`.

#### Scenario: Scheduler-created conversation row shows the TASK badge

- **GIVEN** a `ConversationHistoryItem` with `showTaskBadge: true` and `taskBadgeLabel: "TASK"`
- **WHEN** `ConversationRow` renders that item
- **THEN** the row displays a pill badge with a clock icon and the text "TASK" at the end of the row

#### Scenario: Normal conversation row shows no badge

- **GIVEN** a `ConversationHistoryItem` with `showTaskBadge` omitted or `false`
- **WHEN** `ConversationRow` renders that item
- **THEN** no task badge is rendered and the row layout matches the current (pre-change) layout

#### Scenario: Badge is shown independent of the scheduledTasksEnabled feature flag

- **GIVEN** the `scheduledTasksEnabled` navigation feature flag is disabled for the current user
- **AND** a conversation list item has `isScheduledTask: true`
- **WHEN** the history panel renders that item
- **THEN** the TASK badge is still shown on that row

#### Scenario: Badge click does nothing

- **GIVEN** a row with the TASK badge rendered
- **WHEN** the user clicks directly on the badge
- **THEN** no navigation occurs and the row's normal `onSelectConversation` behavior for the row click still applies (the badge has no separate click handler that stops propagation or redirects)

#### Scenario: Badge icon is aria-hidden

- **WHEN** `ConversationRow` renders a row with `showTaskBadge: true`
- **THEN** the clock icon inside the badge has `aria-hidden="true"` while the "TASK" text remains in the accessible tree

#### Scenario: Badge stays at the trailing edge in RTL

- **GIVEN** `dir="rtl"` is set on an ancestor element
- **WHEN** a row with `showTaskBadge: true` renders
- **THEN** the badge appears at the visual end (left side in RTL) using logical spacing classes, and the "TASK" text is not mirrored

#### Scenario: Row spacing accommodates badge and actions trigger together

- **GIVEN** a row has both `showTaskBadge: true` and a non-empty `getActions` result
- **WHEN** the row renders
- **THEN** the title truncates with ellipsis and the badge and actions trigger are both fully visible without overlapping
