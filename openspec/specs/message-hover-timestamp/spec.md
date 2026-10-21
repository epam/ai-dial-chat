# message-hover-timestamp Specification

## Purpose
Specifies the per-message send time on the conversation page: a relative time ("3 hours ago") with a full-date tooltip on the outer edge of each message's action row, revealed on hover or focus and always shown on devices without hover. It covers the opt-in through `ConversationView`, the `MessageBubble` `timestamp`/`locale` props and `MessageActions` `leadingContent`/`trailingContent` slots in `@epam/ai-dial-conversation-messages`, and the `Intl`-based formatting. The conversation start label is specified by `conversation-start-timestamp`.

## Requirements

### Requirement: Opt-in per-message send times on ConversationView
`ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) SHALL accept an optional boolean prop `hasMessageTimestamps`, which defaults to `false`. It SHALL forward that prop as `hasTimestamp` to every `ConversationMessageItem`. `ConversationPage` (`apps/chat/src/pages/Conversation/Conversation.tsx`) SHALL pass `hasMessageTimestamps`. `AppPreviewChat` SHALL NOT pass it. No context or global state is introduced.

#### Scenario: Conversation page
- **WHEN** a conversation with three messages is open on the conversation page
- **THEN** each of the three message items receives `hasTimestamp`

#### Scenario: App preview chat
- **WHEN** messages are rendered in the Application Editor preview chat
- **THEN** no message send times are rendered

---

### Requirement: Send time in the message action row
When `hasTimestamp` is set, `ConversationMessageItem` SHALL pass `timestamp={msg.timestamp}` and `locale` (the active language) to `MessageBubble`, whose bubbles SHALL render a `MessageTimestamp` element (`libs/conversation-messages/src/components/MessageTimestamp/MessageTimestamp.tsx`), placed on the outer edge of the action toolbar. For a user message, `UserMessageBubble` passes it to `MessageActions` as `leadingContent`, before the buttons of the end-aligned toolbar. For an assistant response, `AssistantMessageBubble` passes it as `trailingContent`, after the buttons of the start-aligned toolbar. Host `actions.leadingContent` and `actions.trailingContent` stay beside it. A message whose `timestamp` is missing or does not parse to a valid date SHALL render no send time.

#### Scenario: User message placement
- **WHEN** a user message with a valid timestamp is rendered with `hasTimestamp`
- **THEN** its toolbar contains a `<time>` element before the action buttons

#### Scenario: Assistant response placement
- **WHEN** an assistant response with a valid timestamp is rendered with `hasTimestamp`
- **THEN** its toolbar contains a `<time>` element after the action buttons

#### Scenario: Invalid timestamp
- **WHEN** a message's `timestamp` is not a valid date
- **THEN** no `<time>` element is rendered for it

---

### Requirement: Relative text with an absolute-date tooltip
The visible text SHALL be the elapsed time since the message's `timestamp`, produced by `formatRelativeTime` in `libs/conversation-messages/src/utils/date-time.ts`. That function uses `Intl.RelativeTimeFormat` with `numeric: 'auto'` in the `locale` the host passes to `MessageBubble`. It picks the largest whole unit among years, months, weeks, days, hours and minutes, and returns `now` for anything under a minute or slightly in the future.

A UI kit `Tooltip` (with `asChild`) on the `<time>` element SHALL show the full localized date and time, from `formatAbsoluteDateTime`.

The text SHALL refresh every 60 seconds through the `useNow` hook (`libs/conversation-messages/src/hooks/useNow/useNow.ts`). The interval is scoped to the label component, so it does not re-render the memoised message item.

No new i18n keys are introduced: `Intl` localizes the wording.

#### Scenario: Hours ago
- **WHEN** a message was sent at 17:25 and the time is now 20:30, with locale `en`
- **THEN** the label reads `3 hours ago`
- **AND** its tooltip reads `Oct 19, 2026, 5:25 PM`

#### Scenario: Under a minute
- **WHEN** a message was sent 30 seconds ago
- **THEN** the label reads `now`, and after one more minute it reads `1 minute ago`

#### Scenario: Yesterday
- **WHEN** a message was sent between 24 and 48 hours ago
- **THEN** the label reads `yesterday`

---

### Requirement: Hover, focus and touch visibility
On devices with hover capability, the send time SHALL be visually hidden (opacity 0) by default. It SHALL become visible while the pointer hovers the per-message bubble root in `UserMessageBubble` or `AssistantMessageBubble`, which carries the named group class `group/message`, or while keyboard focus is inside that root. On devices matching `@media (hover: none)`, it SHALL always be visible.

The `<time>` element SHALL be keyboard-focusable (`tabIndex={0}`) so its tooltip is reachable without a pointer. It SHALL stay in the accessibility tree: visibility changes use opacity only.

The text SHALL default to `dial-small-text text-secondary`, replaceable through `MessageBubbleStyles.timestampClassName`.

#### Scenario: Hover reveals
- **WHEN** the pointer moves over a message on a desktop browser
- **THEN** that message's send time becomes visible, and other messages' send times stay hidden

#### Scenario: Keyboard
- **WHEN** keyboard focus moves onto a message's send time or one of its action buttons
- **THEN** the send time is visible, and focusing it shows the absolute-date tooltip

#### Scenario: Touch device
- **WHEN** the page is viewed on a device without hover capability
- **THEN** every message's send time is visible without interaction

---

### Requirement: MessageActions leading and trailing content slots
`MessageActionsProps` in `@epam/ai-dial-conversation-messages` (`libs/conversation-messages/src/models/message-actions.ts`) SHALL have optional `leadingContent?: ReactNode` and `trailingContent?: ReactNode`. `MessageActions` SHALL render `leadingContent` at the start of the toolbar row, before the buttons, and `trailingContent` at the end, after them. The toolbar SHALL render when either slot is set, even with no action handler. The lib SHALL NOT format, translate or style the content; the host supplies a ready element. The toolbar row SHALL vertically centre its items (`items-center`).

#### Scenario: Leading content with actions
- **WHEN** `MessageActions` receives `onCopy` and `leadingContent`
- **THEN** the toolbar text begins with the leading content, followed by the Copy button

#### Scenario: Trailing content with actions
- **WHEN** `MessageActions` receives `onCopy` and `trailingContent`
- **THEN** the toolbar text ends with the trailing content, after the Copy button

#### Scenario: Leading content alone
- **WHEN** `MessageActions` receives only `leadingContent`
- **THEN** the toolbar renders with that content
