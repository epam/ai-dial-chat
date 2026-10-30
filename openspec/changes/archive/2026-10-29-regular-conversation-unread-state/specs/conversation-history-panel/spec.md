## MODIFIED Requirements

### Requirement: Unread scheduler-created conversations show an unread dot in the history panel

`ConversationItem` (exported from `@epam/ai-dial-conversation-panel`) SHALL include one optional presentational field: `isUnread?: boolean`. The lib carries no knowledge of scheduler ids, bucket storage, or API shapes — this is a plain display prop, following the same pattern as the existing `leadingIcon`/`iconTooltip` fields.

When `isUnread` is `true`, `ConversationRow` SHALL:

1. render a `7.11px` round dot centered in a 24×24 container at the **trailing edge** of the row, after the title, using the design system's accent/notification color (`--cp-unread-dot`, overridable via `ConversationColors.unreadDot`, default `--text-accent`);
2. render the title with the `dial-small-semi-text` typography class (600 weight, 14/24) instead of `itemTitleClassName`. The weight change SHALL NOT change the row height.

When `isUnread` is `false` or omitted, no dot renders, the title keeps its normal weight, and the leading slot no longer reserves any space for an indicator (the former 12×12 pre-avatar slot is removed). The dot is decorative status, not a control — it has no click handler and is not a link.

**Row layout.** When both the unread dot and the overflow-actions trigger are present, `ConversationRow` SHALL adjust end padding (mirroring the existing `getButtonPaddingEnd` pattern) so the title truncates with an ellipsis and neither the dot nor the trigger overlaps it. In the hover, focus-within, and open-menu states where the actions trigger appears, the dot SHALL be visually hidden so the trigger takes its trailing spot; the `sr-only` unread label SHALL stay in the accessibility tree in every state.

**Accessible name.** Since AAA requires status to not be conveyed by color or weight alone, the dot wrapper SHALL carry a visually-hidden (`sr-only`) label (i18n key `conversationPanel.unreadIndicatorLabel`, English default: `"Unread"`) so screen reader users hear the unread state; the visible dot element itself SHALL be `aria-hidden`. The dot color's contrast against the row background (default, hover, active) SHALL be at least 3:1 (non-text UI component).

**App wiring (`ConversationPanelView` in `apps/chat`).** The app maps `ConversationListItemDto.isUnread` to `ConversationItem.isUnread` for scheduled-task items through `resolveTaskPresentation`, and for regular chats directly while mapping panel items (a regular chat stays a chat row; it never gains the task icon). The app SHALL NOT pass `isUnread: true` for the active conversation: a row is never unread while it is the open chat, so watching a chat that is generating shows no dot, and the dot appears as soon as the user navigates away from a chat whose answer they have not seen.

**Mark-as-viewed on open.** When the user opens (clicks, or middle-clicks to open in a new tab) a row whose item has `isUnread: true`, a scheduled-task run is marked viewed through the panel's active-conversation sync, and a regular chat is marked viewed by the conversation page once it has loaded and no generation is running (see `regular-conversation-read-state`). For either kind, the app SHALL optimistically clear the row's unread state in local state and call the mark-viewed action (`ConversationsContext.markConversationViewed(id)`, which calls `PATCH /api/v1/conversations/viewed?path=<path>`). If the call fails, the app SHALL roll back the local state to `isUnread: true` (same optimistic-update-with-rollback pattern already used for pinning). Opening a conversation directly via URL navigation or from a task's History (not via a history panel row click) SHALL also trigger the same mark-viewed call once the conversation is confirmed loaded — this relies on the context's full, uncollapsed list (see `scheduled-task-conversation-grouping`).

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

#### Scenario: Open conversation never shows the dot

- **GIVEN** a regular chat that is unread in the list and is the active conversation
- **WHEN** the panel renders its row
- **THEN** no dot renders and the title keeps its normal weight

#### Scenario: Leaving a generating chat shows the dot

- **GIVEN** the user sent a message and the answer is still generating
- **WHEN** the user navigates to another page
- **THEN** the chat's row shows the dot immediately, and it stays until the chat is opened again

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
