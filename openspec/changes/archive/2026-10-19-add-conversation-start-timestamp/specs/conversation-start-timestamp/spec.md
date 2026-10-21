## ADDED Requirements

### Requirement: Conversation start time source
The conversation page SHALL derive the conversation start time from the `timestamp` of the first message, `conversation.messages[0].timestamp`, which is an ISO-8601 string. It SHALL NOT use `updatedAt`, `lastActivityDate`, or the list item's `createdAt`. The start time is derived per render from the loaded `Conversation` held by `ConversationPage` in `apps/chat/src/pages/Conversation/Conversation.tsx`. No new context, hook state, or cache is introduced for it.

#### Scenario: Start time from first message
- **WHEN** a conversation is loaded whose first message has `timestamp` `2026-09-20T07:15:00.000Z`
- **THEN** the start label represents that instant

#### Scenario: Reload does not change the start time
- **WHEN** the user reloads the page or reopens the conversation later
- **THEN** the label shows the same instant as before, not the current time

#### Scenario: Missing or invalid timestamp
- **WHEN** the conversation has no messages, or the first message's `timestamp` is absent or does not parse to a valid date
- **THEN** no start label is rendered and no error is surfaced

### Requirement: Start label hidden for a conversation created in the current page instance
The start label SHALL NOT be rendered while the user remains on the conversation they just created. "Just created" means the `ConversationPage` mount received router `state.conversation` for the current `conversationId`, which happens when `ConversationRoute` navigates after the first send. The flag SHALL be captured when the page mounts or when `conversationId` changes. It SHALL NOT be re-read from `useLocation().state`, because the page clears that state with `navigate(..., { state: null })`. The flag SHALL reset when `conversationId` changes to a different id.

#### Scenario: Newly created conversation
- **WHEN** the user sends the first message from the new-conversation screen and is navigated to the new conversation
- **THEN** no start label is rendered, even after the router state is cleared and further messages are exchanged

#### Scenario: Leaving and returning
- **WHEN** the user opens a different conversation and then opens the newly created conversation again from the list
- **THEN** the start label is rendered above the first message

#### Scenario: Reload of a newly created conversation
- **WHEN** the user reloads the page while on the newly created conversation
- **THEN** the start label is rendered

#### Scenario: Existing conversation
- **WHEN** the user opens any conversation without router `state.conversation`, including shared and published conversations
- **THEN** the start label is rendered when a valid start time exists

### Requirement: Start label placement and uniqueness
The label SHALL be rendered exactly once, through the `topContent` slot of `ConversationView`. It SHALL be placed after any `ScheduledTaskConversationBanner` and directly before the first message. It SHALL be rendered only on the conversation page (`Conversation.tsx`), not in `AppPreviewChat`.

#### Scenario: Single label
- **WHEN** a conversation with a valid start time is opened, refreshed, or re-rendered during streaming
- **THEN** exactly one start label exists in the message log

#### Scenario: Scheduled task conversation
- **WHEN** the conversation is a scheduled-task conversation that shows `ScheduledTaskConversationBanner`
- **THEN** the banner is rendered first and the start label follows it

### Requirement: Contextual start label format
The label SHALL be rendered by `ConversationStartTimestamp` from `@epam/ai-dial-conversation-messages`, with the active language as `locale` and the translated templates as `labels`. Its text SHALL be computed by a pure function `formatConversationStart` in `libs/conversation-messages/src/utils/date-time.ts`. The function takes the start date, the current date, and the locale. It returns a `ConversationStartKind` (`Today`, `Yesterday`, or `Absolute`) together with the localized text. `ConversationStartTimestamp` then applies the `labels.today` / `labels.yesterday` templates, which default to English. Calendar days SHALL be compared in the browser's local time zone. The time and date parts SHALL be produced with `Intl.DateTimeFormat` in the `locale` prop, which `Conversation.tsx` sets to the active UI language from `useLanguage()`, without a hard-coded `timeZone`, so the user's local zone and the locale's 12- or 24-hour convention apply. Results:
- start date on the current local calendar day: the `conversation.startedToday` template with `{{time}}` set to the localized hour and minute
- start date on the previous local calendar day: the `conversation.startedYesterday` template, filled the same way
- otherwise: a localized absolute date with abbreviated month, day, year, hour and minute (for example `Sep 20, 2026, 10:15 AM` in `en`)

#### Scenario: Today
- **WHEN** the start time is today at 11:51 local time and the locale is `en`
- **THEN** the label reads `Today 11:51 AM`

#### Scenario: Yesterday
- **WHEN** the start time is on the previous local calendar day at 15:24 and the locale is `en`
- **THEN** the label reads `Yesterday 3:24 PM`

#### Scenario: Older
- **WHEN** the start time is 2026-09-20 10:15 local time, the current date is later than 2026-09-21, and the locale is `en`
- **THEN** the label reads `Sep 20, 2026, 10:15 AM`

#### Scenario: Midnight boundary uses local time
- **WHEN** the start time is 23:59 local time yesterday and the current time is 00:01 local time today
- **THEN** the label uses the "yesterday" form, not the "today" form

### Requirement: Start label i18n keys
The label SHALL use these translation keys, exposed as members of `ConversationI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and defined in `apps/chat/src/i18n/locales/en.json`:
- the i18n key `conversation.startedToday`, with value `Today {{time}}`
- the i18n key `conversation.startedYesterday`, with value `Yesterday {{time}}`

The absolute format SHALL come entirely from `Intl` and needs no key.

#### Scenario: Translated templates
- **WHEN** the active language provides translations for these keys
- **THEN** the label uses the translated template with the localized time interpolated

### Requirement: Start label accessibility and direction
The label SHALL be a `<time>` element whose `dateTime` attribute is the first message's ISO timestamp, with the formatted text as its content. It SHALL NOT be focusable. It SHALL NOT add an extra `aria-live` region; it sits inside the existing `role="log"` container. Its text color SHALL use the `text-secondary` theme token, which `.claude/rules/a11y.md` permits for genuinely secondary, muted metadata text. Layout SHALL be horizontally centered and use only logical or symmetric spacing, so it renders identically in RTL. It has no icons, so no mirroring is needed. The component and the formatter have no memoisation requirements beyond normal rendering. The feature is not gated by `ENABLED_FEATURES` and emits no telemetry.

#### Scenario: Semantic markup
- **WHEN** the label is rendered for start time `2026-09-20T07:15:00.000Z`
- **THEN** the DOM contains `<time dateTime="2026-09-20T07:15:00.000Z">` with the formatted text

#### Scenario: RTL
- **WHEN** the document direction is `rtl`
- **THEN** the label remains centered above the first message

### Requirement: Editing the first message preserves the start time
When `buildConversationHistory` in `apps/chat-api/src/conversations/utils/conversation-history-builder.ts` runs in `CompletionMode.Edit`, the replacement user message SHALL keep the `timestamp` of the message at `messageIndex` that it replaces. Content, custom content, and id handling are unchanged. The assistant placeholder keeps getting a fresh timestamp. Append, ContinueLastUser, and Regenerate modes are unchanged.

#### Scenario: Edit first message
- **WHEN** a completion request in edit mode targets `messageIndex` 0, whose user message has `timestamp` `2026-09-20T07:15:00.000Z`
- **THEN** the persisted user message at index 0 has `timestamp` `2026-09-20T07:15:00.000Z` and the new content

#### Scenario: Edit later message
- **WHEN** an edit-mode request targets a later user message
- **THEN** that message also keeps its original `timestamp`, and the messages before it are unchanged
