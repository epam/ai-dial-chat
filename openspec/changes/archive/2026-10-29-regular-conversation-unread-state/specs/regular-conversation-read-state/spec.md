## Purpose

Tracks which regular (non-scheduled) chats hold an answer the user has not seen, so the conversation panel can show the unread dot when a generation finishes while the user is elsewhere. It reuses the "viewed ids in DIAL Core client data" idea of scheduled-task unread tracking and adds a one-time baseline so existing history starts as read without a migration.

## ADDED Requirements

### Requirement: A read-before baseline makes pre-existing chats read

The backend SHALL persist one baseline timestamp per user in `.client_data/.conversations-read-baseline.json` inside the user's DIAL Core bucket, a dedicated file separate from `.client_data/.user-config.json` and from the scheduler viewed-ids file. File schema:

```ts
interface ConversationsReadBaseline {
  version: 1;
  readBefore: number; // Unix epoch milliseconds
}
```

Reads and writes SHALL follow the same DIAL Core download/upload conventions as `.client_data/.viewed-scheduled-task-conversations.json` (see the `scheduled-task-unread-tracking` spec): only a `404` means "no baseline yet"; any other failed read, and any malformed file, is a failed read. The baseline SHALL be created lazily by the first `GET /api/v1/conversations/list` request that finds the file missing (there is no login hook), written with the current server time. The baseline SHALL be written at most once per user and SHALL NOT be rewritten afterwards. A failed read or a failed lazy write SHALL be logged as a warning and SHALL make every regular chat read for that request. Existing chats are never migrated: a chat last updated at or before the baseline is read by condition.

#### Scenario: First list request creates the baseline

- **GIVEN** `.client_data/.conversations-read-baseline.json` does not exist
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the file is written with `readBefore` equal to the current time and no regular chat is reported unread

#### Scenario: An existing baseline is never overwritten

- **GIVEN** the baseline file exists with `readBefore: 1000`
- **WHEN** the list endpoint is called again, including concurrently
- **THEN** `readBefore` stays `1000`

#### Scenario: A failed baseline read writes nothing

- **GIVEN** downloading the baseline file fails with a 5xx
- **WHEN** the list endpoint is called
- **THEN** no baseline is written and every regular chat is reported read

### Requirement: Viewed regular-chat ids are persisted in a dedicated bucket file

The backend SHALL persist which regular chats the user has seen in `.client_data/.viewed-conversations.json` inside the user's DIAL Core bucket, with the schema `{ version: 1, conversationIds: string[] }` holding full DIAL Core conversation resource ids (the `id` format of `ConversationListItemDto`). Reading a missing file returns an empty set; a malformed file or a non-array `conversationIds` also normalizes to an empty set with a warning, and a non-404 failed read SHALL surface as a failed read (never be written back as an empty set). Adding an id already present and removing an id that is absent SHALL be no-ops that do not rewrite the file. The scheduler viewed-ids file is unchanged and is not read or written for regular chats.

#### Scenario: Adding an id twice stores it once

- **WHEN** the same regular chat is marked viewed twice
- **THEN** the file contains its id once

#### Scenario: Removing an absent id does not write

- **WHEN** an id that is not in the file is removed
- **THEN** no upload is issued

### Requirement: A regular chat is unread only after a newer answer than the baseline and its last view

For a conversation in the user's own bucket that is not a scheduler run, the backend SHALL report `isUnread: true` exactly when its `updatedAt` is greater than the baseline `readBefore` and its id is not in the viewed regular-chat ids. Otherwise `isUnread` SHALL be omitted. Published and shared conversations never carry `isUnread`. Scheduler runs keep the existing rule (unread until their id is in the scheduler viewed-ids file). The list response shape is defined by the `conversations-api` spec.

#### Scenario: A brand new answer in an old chat

- **GIVEN** a chat last updated before the baseline whose id was removed from the viewed ids, and a generation then bumps its `updatedAt` past the baseline
- **WHEN** the list is requested
- **THEN** the chat is reported with `isUnread: true`

#### Scenario: A chat the user has seen stays read until the next send

- **GIVEN** a chat updated after the baseline whose id is in the viewed ids
- **WHEN** the list is requested
- **THEN** `isUnread` is omitted

### Requirement: Sending a message makes the chat unread locally and on the server

Every generation the conversation page launches (send, regenerate, edit and the auto-continue on load) funnels through the page's stream-start function in `apps/chat/src/pages/Conversation/Conversation.tsx`. That function SHALL, in addition to bumping the conversation's activity, set the list row's `isUnread` to `true` in `ConversationsContext` (`apps/chat/src/context/ConversationsContext.tsx`) so that leaving mid-stream shows the dot without a list refresh. The server persists the same state by removing the id from the viewed ids when the completion starts (see `conversations-api`). The local flag SHALL apply only to regular chats; scheduled-task runs are unaffected.

#### Scenario: Leaving a generating chat shows the dot at once

- **GIVEN** the user sent a message in a read chat and the answer is still generating
- **WHEN** the user opens another page
- **THEN** the chat's row shows the unread dot without waiting for a list refresh

#### Scenario: Regenerate behaves like send

- **WHEN** the user regenerates an answer and leaves before it finishes
- **THEN** the chat shows the dot the same way

### Requirement: An open regular chat is marked viewed only while no generation is running

The conversation page (`apps/chat/src/pages/Conversation/Conversation.tsx`) SHALL own marking a regular chat viewed; the shared active-conversation sync used by the conversation panel SHALL NOT mark regular chats (it keeps marking scheduler runs). The page SHALL call the mark-viewed action for the open chat when all of these hold: the conversation shown belongs to the open route and has loaded (not the previous chat, which stays on screen for a moment after the route changes), its list row is a regular chat reported unread, and no generation is running for it. A generation counts as running while the page's `isStreaming` is true for that chat; returning to a generating chat (including after a reload) resumes the stream in the same update that applies the loaded conversation, so there is no loaded state in which the generation runs but is not yet flagged. While a generation runs, nothing SHALL be written to the viewed ids and the open chat shows no dot (see `conversation-history-panel`). The mark is made when the generation ends while the chat is still open, and again whenever a later list reports the open chat unread. Leaving or switching to another conversation before the generation ends SHALL NOT mark the chat viewed. A failed write SHALL leave the chat read locally and SHALL NOT loop; the next list response that still reports it unread triggers one retry.

#### Scenario: Staying on the chat

- **GIVEN** the user sends a message and stays on the chat
- **WHEN** the answer finishes
- **THEN** the chat is marked viewed once, no dot is shown at any moment, and a page reload still shows it read

#### Scenario: Opening an unread chat that is not generating

- **GIVEN** a chat the list reports unread whose answer already finished
- **WHEN** the user opens it and it has loaded
- **THEN** its dot disappears immediately and the viewed request is sent once

#### Scenario: Returning to a chat that is still generating

- **GIVEN** the user sent a message, left the chat while it was generating, and the dot appeared
- **WHEN** the user returns before it finishes, then leaves again before it finishes
- **THEN** nothing was written to the viewed ids in between, and the dot is shown again when the user leaves the second time

#### Scenario: Returning and watching to the end

- **GIVEN** the user left a generating chat and comes back before it finishes
- **WHEN** the stream resumes and then finishes while the chat is open
- **THEN** the chat is marked viewed when it finishes and no dot was shown while it was open

#### Scenario: Reloading the page during a generation

- **GIVEN** the page is reloaded while the answer is still being generated by the backend
- **WHEN** the chat is open and then left before the answer finishes
- **THEN** it is not marked viewed and shows the dot after the user leaves

#### Scenario: Leaving before the end

- **GIVEN** the user leaves a generating chat and never returns before it finishes
- **WHEN** the generation completes on the server
- **THEN** the chat stays unread, including after a page reload, until it is opened

### Requirement: Read state has no new UI, strings or feature gate

The unread dot SHALL reuse the existing `conversationPanel.unreadIndicatorLabel` accessible label and the existing dot styles, so no i18n key is added and no RTL change is needed. The feature SHALL NOT be gated by `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`. Persistence is last-writer-wins on two small JSON files; concurrent tabs or instances may lose an update, which shows as at most one false dot. Failures of either file SHALL be logged as warnings and SHALL NOT fail a list, completion or rename request; a failed write on `PATCH /api/v1/conversations/viewed` itself is reported to the caller as for scheduled runs.

#### Scenario: No feature flag required

- **WHEN** `scheduledTasksEnabled` is off
- **THEN** regular chats still show and clear the unread dot
