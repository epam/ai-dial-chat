## ADDED Requirements

### Requirement: A conversation row can carry a host-supplied leading icon

`ConversationItem` (exported from `@epam/ai-dial-conversation-panel`) SHALL include an optional presentational field `leadingIcon?: ReactNode`. When it is set, `ConversationRow` SHALL render it in the leading slot **instead of** the deployment avatar (`iconUrl`/`isIconLoading`/`iconTooltip` are then ignored for that row). When it is omitted, the row renders the deployment avatar exactly as today. The lib carries no knowledge of what the icon means — it has no schedule, task, or feature-flag concept; the host decides which items get an icon and which icon.

The leading slot SHALL keep the avatar's footprint (same box size and alignment) so titles of icon rows and avatar rows stay aligned.

**App wiring (`ConversationPanelView` in `apps/chat`).** For every item with `isScheduledTask === true`, the app SHALL supply its existing `ScheduledTasksIcon` (the same glyph as the Scheduled tasks navigation entry) at 16px with `stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`, colored `var(--text-visual-blue, #1189C8)`, inside a 24×24 box with 4px padding, 8px corner radius, and `var(--bg-visual-blue, #D6EDF9)` background. The icon is supplied through `useConversationPanelItems`'s `resolveTaskPresentation` resolver (see `chat-hooks-conversation-panel-controller`). Like the former TASK badge, it is shown regardless of the `scheduledTasksEnabled` flag.

**a11y.** The icon is decorative: the row's accessible name remains the conversation title. The lib SHALL NOT add a tooltip or accessible name for a `leadingIcon`.

**RTL.** The leading slot uses the existing logical layout of the row; the icon itself SHALL NOT be mirrored (a clock/task glyph has no inherent direction).

**i18n.** None — the icon has no text.

#### Scenario: Row with a leading icon replaces the avatar

- **GIVEN** a `ConversationItem` with `leadingIcon` set and `iconUrl` set
- **WHEN** `ConversationRow` renders it
- **THEN** the leading icon is rendered and the deployment avatar is not

#### Scenario: Row without a leading icon is unchanged

- **GIVEN** a `ConversationItem` with `leadingIcon` omitted
- **WHEN** `ConversationRow` renders it
- **THEN** the deployment avatar (or its loading skeleton) renders exactly as before

#### Scenario: Task conversation shows the task icon

- **GIVEN** a list item with `isScheduledTask: true`
- **WHEN** the history panel renders it
- **THEN** its row shows the task icon with `aria-hidden="true"` and no TASK pill

#### Scenario: Title alignment holds between icon and avatar rows

- **WHEN** a task row and an ordinary row render one above the other
- **THEN** both titles start at the same inline offset

## MODIFIED Requirements

### Requirement: Unread scheduler-created conversations show an unread dot in the history panel

`ConversationItem` (exported from `@epam/ai-dial-conversation-panel`) SHALL include one optional presentational field: `isUnread?: boolean`. The lib carries no knowledge of scheduler ids, bucket storage, or API shapes — this is a plain display prop, following the same pattern as the existing `leadingIcon`/`iconTooltip` fields.

When `isUnread` is `true`, `ConversationRow` SHALL:

1. render a `7.11px` round dot centered in a 24×24 container at the **trailing edge** of the row, after the title, using the design system's accent/notification color (`--cp-unread-dot`, overridable via `ConversationColors.unreadDot`, default `--text-accent`);
2. render the title with the `dial-small-semi-text` typography class (600 weight, 14/24) instead of `itemTitleClassName`. The weight change SHALL NOT change the row height.

When `isUnread` is `false` or omitted, no dot renders, the title keeps its normal weight, and the leading slot no longer reserves any space for an indicator (the former 12×12 pre-avatar slot is removed). The dot is decorative status, not a control — it has no click handler and is not a link.

**Row layout.** When both the unread dot and the overflow-actions trigger are present, `ConversationRow` SHALL adjust end padding (mirroring the existing `getButtonPaddingEnd` pattern) so the title truncates with an ellipsis and neither the dot nor the trigger overlaps it. In the hover, focus-within, and open-menu states where the actions trigger appears, the dot SHALL be visually hidden so the trigger takes its trailing spot; the `sr-only` unread label SHALL stay in the accessibility tree in every state.

**Accessible name.** Since AAA requires status to not be conveyed by color or weight alone, the dot wrapper SHALL carry a visually-hidden (`sr-only`) label (i18n key `conversationPanel.unreadIndicatorLabel`, English default: `"Unread"`) so screen reader users hear the unread state; the visible dot element itself SHALL be `aria-hidden`. The dot color's contrast against the row background (default, hover, active) SHALL be at least 3:1 (non-text UI component).

**App wiring (`ConversationPanelView` in `apps/chat`).** The app maps `ConversationListItemDto.isUnread` to `ConversationItem.isUnread` for scheduled-task items through `resolveTaskPresentation`.

**Mark-as-viewed on open.** When the user opens (clicks, or middle-clicks to open in a new tab) a row whose item has `isScheduledTask: true` and `isUnread: true`, the app SHALL optimistically clear the row's unread state in local state and call the mark-viewed action (`ConversationsContext.markConversationViewed(id)`, which calls `PATCH /api/v1/conversations/viewed?path=<path>`). If the call fails, the app SHALL roll back the local state to `isUnread: true` (same optimistic-update-with-rollback pattern already used for pinning). Opening a conversation directly via URL navigation or from a task's History (not via a history panel row click) SHALL also trigger the same mark-viewed call once the conversation is confirmed loaded — this relies on the context's full, uncollapsed list (see `scheduled-task-conversation-grouping`).

**RTL.** The dot SHALL be positioned with logical properties (`ms-*`/`me-*`, `end-*`) so it stays at the trailing edge in both LTR and RTL — the visual left side in RTL.

**i18n.** `conversationPanel.unreadIndicatorLabel` (value `"Unread"`) remains in `apps/chat/src/i18n/locales/en.json` and the `ConversationPanelI18nKeys` type.

#### Scenario: Unread row shows a trailing dot and a heavier title

- **GIVEN** a `ConversationItem` with `isUnread: true`
- **WHEN** `ConversationRow` renders that item
- **THEN** a dot renders after the title at the row's trailing edge, the title uses the heavier weight, and an accessible "Unread" label is present

#### Scenario: Read or non-scheduler row shows no dot and normal weight

- **GIVEN** a `ConversationItem` with `isUnread` omitted or `false`
- **WHEN** `ConversationRow` renders that item
- **THEN** no dot renders, the title uses the normal weight, and no space is reserved before the leading icon

#### Scenario: Opening an unread task conversation clears the unread state optimistically

- **GIVEN** a history panel row with `isUnread: true` for a scheduler-created conversation
- **WHEN** the user clicks the row to open it
- **THEN** the dot and heavier weight disappear immediately (before the network call resolves) and `PATCH /api/v1/conversations/viewed?path=<path>` is called for that conversation

#### Scenario: Failed mark-viewed call restores the unread state

- **GIVEN** the user opens an unread task conversation and the optimistic clear has been applied
- **WHEN** the `PATCH /api/v1/conversations/viewed` call fails
- **THEN** the row's dot and heavier title weight are restored (rolled back to `isUnread: true`)

#### Scenario: Dot is decorative and has no click handler

- **GIVEN** a row with the unread dot rendered
- **WHEN** the user clicks directly on the dot
- **THEN** the row's normal `onSelectConversation` behavior for the row click still applies

#### Scenario: Dot and actions trigger do not overlap the title

- **GIVEN** a row with `isUnread: true` and a non-empty `getActions` result, and a long title
- **WHEN** the row renders and is hovered
- **THEN** the title truncates with an ellipsis and neither the dot nor the trigger overlaps it

#### Scenario: Dot stays at the trailing edge in RTL

- **GIVEN** `dir="rtl"` is set on an ancestor element
- **WHEN** a row with `isUnread: true` renders
- **THEN** the dot appears at the visual end of the row (left side in RTL)

## REMOVED Requirements

### Requirement: Scheduled-task conversations show a TASK badge in the history panel

**Reason**: The design replaces the trailing `TASK` pill with a task leading icon, a heavier unread title, and a trailing unread indicator (GitHub issue #8934).

**Migration**: `ConversationItem.showTaskBadge` and `ConversationItem.taskBadgeLabel`, `ConversationColors.taskBadgeBorder`/`taskBadgeBackground`/`taskBadgeText`, and `ConversationPanelStyles.taskBadgeClassName` are removed from `@epam/ai-dial-conversation-panel`. Hosts pass `leadingIcon` (a decorative `ReactNode`) to mark a row as a task and keep passing `isUnread`. The `conversationPanel.taskBadgeLabel` i18n key is removed from `apps/chat`.
