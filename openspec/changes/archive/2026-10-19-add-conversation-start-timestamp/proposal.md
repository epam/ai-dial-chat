## Why

When a user opens a conversation, nothing tells them when it was started, which makes it hard to place older chats in time (GitHub issue #8984). ChatGPT shows a contextual label such as "Today 11:51 AM" above the first message once a chat becomes historical. This change adds the same label.

## What Changes

- Show a centered, read-only start label (`<time dateTime="…">`) above the first message on the conversation page. It uses a contextual format:
  - `Today 11:51 AM`
  - `Yesterday 3:24 PM`
  - an absolute date and time for older conversations (`Sep 20, 2026, 10:15 AM`)

  The label is formatted with `Intl.DateTimeFormat`, using the active UI language and the browser's local time zone.
- The start time comes from the **first message's `timestamp`**:
  - The server sets it when the conversation is first saved, and it is already in every conversation body, so no API or DTO change is needed.
  - It is available for owned, shared, and published conversations alike.
- The label is **hidden in the page instance that created the conversation**. That page is the navigation from `ConversationRoute` that carries router `state.conversation`. The label appears once the user leaves and comes back, opens the conversation from the list, or reloads the page.
- The label is not rendered when:
  - there are no messages, or
  - the first message's timestamp is missing or unparsable (legacy data).
- **Backend fix:** `buildConversationHistory` in edit mode currently gives the edited user message a fresh timestamp. Editing message 0 would therefore move the conversation's start time. Edit mode SHALL keep the original `timestamp` of the user message being replaced.
- New i18n keys: `conversation.startedToday` (`Today {{time}}`) and `conversation.startedYesterday` (`Yesterday {{time}}`).

Not breaking.

## Problem / Solution / Non-goals

- **Problem:** a reopened conversation shows no date context.
- **Solution:** an app-level `ConversationStartTimestamp` component, fed by a pure `formatConversationStart` utility, rendered through the existing `topContent` slot of `ConversationView`.
- **Non-goals:**
  - per-message timestamps
  - date separators between messages
  - a "started" field in the sidebar or list
  - live re-render when midnight passes while the page is open
  - showing the label in the Application Editor preview chat (`AppPreviewChat`), which also renders `ConversationView`
  - adding `createdAt` to the conversation body

## Alternatives considered

- **Add `createdAt` to `Conversation` / `ConversationResponseDto`:**
  - Pros: it is unaffected by edits or deletions.
  - Cons: it needs an OpenAPI change, client regeneration, and must be set on every creation path (create, duplicate, import, scheduled tasks). Legacy conversations still need a fallback.
  - Rejected for now; it can be revisited if deleting message 0 becomes a real problem.
- **List item `createdAt` (DIAL Core metadata):** rejected. It is missing for shared items and is optional in general.
- **`lastActivityDate` / `updatedAt`:** rejected. Both change over time, which contradicts acceptance criteria 4 and 5.
- **Time-based "no longer new" heuristic (for example, older than N minutes):** rejected. It is non-deterministic and hard to test, and the issue asks only that the label appear once the conversation is no longer the newly active one.

## Acceptance criteria

1. Right after the user sends the first message of a new conversation, no start label is shown.
2. After navigating away and back, reloading, or opening any existing conversation, the label appears above the first message.
3. The label reflects the first message's timestamp, and reloading or reopening does not change it.
4. Exactly one label is rendered.
5. The format is `Today <time>` or `Yesterday <time>` for those calendar days, and an absolute date and time otherwise. It uses the user's local time zone and the active locale's conventions.
6. Editing the first user message does not change the label.

## Capabilities

### New Capabilities
- `conversation-start-timestamp`: covers the conversation start label:
  - the source of the start time
  - visibility rules (hidden for a just-created conversation, absent without a valid timestamp)
  - contextual formatting, i18n keys, and accessibility
  - backend preservation of the first message's timestamp on edit

### Modified Capabilities
<!-- none: the edit-mode timestamp preservation is captured as an ADDED requirement of the new capability rather than rewriting edit-message's "Submitting an edit" requirement -->

## Impact

- **Frontend (app only, no libs touched):**
  - new `libs/conversation-messages/src/components/ConversationStartTimestamp/`
  - new `libs/conversation-messages/src/utils/date-time.ts`
  - `apps/chat/src/pages/Conversation/Conversation.tsx` (`topContent` composition plus the "created here" flag)
  - `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`
- **Backend:** `apps/chat-api/src/conversations/utils/conversation-history-builder.ts` (edit mode). No endpoint or DTO change, and no OpenAPI regeneration.
- **Patterns followed:**
  - `ScheduledTaskConversationBanner`, which is already passed through `topContent` in `Conversation.tsx`
  - `Intl.DateTimeFormat` usage in `apps/chat/src/utils/map-scheduled-task-dto.ts`
- **i18n:** two new user-visible strings.
- **RTL:** a centered label using logical spacing only, with no icons.
- **Feature flag:** none.
- **Rollback:** revert the commit. No data migration is needed, because timestamps already exist and the backend change only stops overwriting one of them.
