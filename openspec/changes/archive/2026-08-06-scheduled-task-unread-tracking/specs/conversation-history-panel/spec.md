## ADDED Requirements

### Requirement: Unread scheduler-created conversations show an unread dot in the history panel

`ConversationHistoryItem` (exported from `@epam/ai-dial-conversation-panel`) SHALL include one optional presentational field: `isUnread?: boolean`. The lib carries no knowledge of scheduler ids, bucket storage, or API shapes — this is a plain display prop, following the same pattern as the existing `showTaskBadge`/`iconTooltip` fields.

`ConversationRow` SHALL render a small filled dot immediately before the row's leading icon (the `avatar`/`iconBefore` slot) whenever `isUnread` is `true`. The dot uses the design system's accent/notification color. When `isUnread` is `false` or omitted, no dot is rendered and the leading-icon layout is unchanged from today. The dot is decorative status, not a control — it has no click handler and is not a link.

**Accessible name.** Since AAA requires status to not be conveyed by color alone, the dot wrapper SHALL carry a visually-hidden (`sr-only`) label (i18n key `conversationPanel.unreadIndicatorLabel`, English default: `"Unread"`) so screen reader users hear the unread state; the visible dot element itself SHALL be `aria-hidden`.

**App wiring (`ConversationPanelView` in `apps/chat`).** The app maps `ConversationListItemDto.isUnread` to `ConversationHistoryItem.isUnread` — the same mapping pattern already used for `isScheduledTask` → `showTaskBadge`.

**Mark-as-viewed on open.** When the user opens (clicks, or middle-clicks to open in a new tab) a row whose item has `isScheduledTask: true` and `isUnread: true`, the app SHALL optimistically clear the row's unread dot in local state and call the mark-viewed action (`ConversationsContext.markConversationViewed(id)`, which calls `PATCH /api/v1/conversations/viewed?path=<path>`). If the call fails, the app SHALL roll back the local state to `isUnread: true` (same optimistic-update-with-rollback pattern already used for pinning). Opening a conversation directly via URL navigation (not via a history panel row click) SHALL also trigger the same mark-viewed call once the conversation is confirmed loaded.

**RTL.** The dot SHALL be positioned using logical properties (`start-0` relative to its wrapper) so it stays before the icon in both LTR and RTL — "before" the icon means the visual start edge, which flips with direction.

**i18n.** `conversationPanel.unreadIndicatorLabel` (value `"Unread"`) SHALL be added to `apps/chat/src/i18n/locales/en.json` and to the `ConversationPanelI18nKeys` type/interface consumed by `ConversationPanelView`.

#### Scenario: Unread scheduler-created conversation row shows the unread dot

- **GIVEN** a `ConversationHistoryItem` with `isUnread: true`
- **WHEN** `ConversationRow` renders that item
- **THEN** the row displays a dot before the leading icon, with an accessible "Unread" label

#### Scenario: Read or non-scheduler conversation row shows no dot

- **GIVEN** a `ConversationHistoryItem` with `isUnread` omitted or `false`
- **WHEN** `ConversationRow` renders that item
- **THEN** no unread dot is rendered and the leading-icon layout matches the current (pre-change) layout

#### Scenario: Opening an unread task conversation clears the dot optimistically

- **GIVEN** a history panel row with `isUnread: true` for a scheduler-created conversation
- **WHEN** the user clicks the row to open it
- **THEN** the row's dot disappears immediately (before the network call resolves) and `PATCH /api/v1/conversations/viewed?path=<path>` is called for that conversation

#### Scenario: Failed mark-viewed call restores the unread dot

- **GIVEN** the user opens an unread task conversation and the optimistic dot-clear has been applied
- **WHEN** the `PATCH /api/v1/conversations/:id/viewed` call fails
- **THEN** the row's unread dot is restored (rolled back to `isUnread: true`)

#### Scenario: Dot is decorative and has no click handler

- **GIVEN** a row with the unread dot rendered
- **WHEN** the user clicks directly on the dot
- **THEN** the row's normal `onSelectConversation` behavior for the row click still applies (the dot has no separate click handler that stops propagation or redirects)

#### Scenario: Dot position respects RTL

- **GIVEN** `dir="rtl"` is set on an ancestor element
- **WHEN** a row with `isUnread: true` renders
- **THEN** the dot appears at the visual start edge of the leading icon (right side in RTL)
