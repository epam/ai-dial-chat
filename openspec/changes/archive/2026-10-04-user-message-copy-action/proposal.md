## Why

User prompts in a conversation only offer Edit and Delete, so re-using a long or multiline prompt means selecting the text by hand from a collapsible bubble. Assistant replies already have a one-click Copy (`libs/conversation-messages/src/components/MessageActions/MessageActions.tsx:160`); user messages should too (GitHub issue #8986).

## What Changes

- Add a **Copy message** action to every user message's action toolbar, rendered before Edit and Delete, with the tooltip and accessible name "Copy message".
- Clicking it writes the message's raw text (`msg.content`, line breaks intact) to the system clipboard as plain text, shows the existing "Copied!" icon/tooltip state for 2 s, and announces the copy through the toolbar's existing `aria-live` status region.
- The action never edits, resends, truncates or deletes the message, and it is available on historical messages, in read-only (shared/published) conversations, and while a response is streaming — it is the only non-mutating user action, so the streaming-time `isDisabled` no longer applies to user-message toolbars.
- `MessageActions` (lib) renders `onCopy` for the `User` role as well as the `Assistant` role; three new optional label fields (`tooltips.copyMessage`, `ariaLabels.copyMessage`, `ariaLabels.copiedMessageStatus`) with English defaults. Non-breaking: existing callers that pass no `onCopy` for user messages see no change.
- New i18n keys `buttons.copyMessage` → "Copy message" and `buttons.messageCopiedStatus` → "Message copied to clipboard".

**Alternatives considered:** (a) add a separate `onCopyMessage` prop instead of reusing `onCopy` — rejected, it duplicates the copied-state machinery and the role already selects the label set; (b) copy as rich text like assistant replies (`copyMarkdownAsRichText`) — rejected, user prompts are rendered as plain text, so plain text is the faithful copy "as entered".

## Capabilities

### New Capabilities
- `user-message-copy`: one-click copy of a user-authored message's text from its action toolbar — availability, clipboard content, feedback, and non-mutation guarantees.

### Modified Capabilities
<!-- None: edit-message requirements (Edit availability/disabled-while-streaming) are unchanged; the new action is additive. -->

## Impact

- **Lib** `libs/conversation-messages` (`MessageActions.tsx`, `models/message-actions.ts`, README `MessageActions` section, `MessageActions.spec.tsx`). The lib stays host-agnostic: it receives an `onCopy` callback and translated strings via `labels`; the clipboard call and i18n live in the app.
- **App** `apps/chat/src/components/ConversationView/utils/build-message-actions.ts:34` (user branch adds `onCopy` → `copyToClipboard(msg.content)` from `@epam/ai-dial-chat-shared`), `ConversationMessageItem.tsx:924` (`isDisabled` scoped to non-user messages), `ConversationView.tsx:682` (new tooltip/aria labels), `constants/translation-keys.ts`, `i18n/locales/en.json`.
- Every surface that renders `ConversationMessageItem` gets the action: the main conversation view and the application-editor preview chat (`AppPreviewChat`).
- No backend, API, dependency, or `docs/architecture.md` change.
- **Rollback:** revert the commit; the new lib props are optional, so no host has to change.

## Non-goals

- Copying attachments, skill chips, or rendered/rich formatting — text only.
- Detecting clipboard write failure in the UI: like the assistant Copy today, the "Copied!" state is shown after the click; a failure toast is a separate change.
- Changing the assistant-message action set or the Edit/Delete behaviour.

## Acceptance criteria

- Every user message (new and reloaded) shows a Copy message button with tooltip "Copy message" and accessible name "Copy message".
- Clicking it puts exactly `msg.content` on the clipboard; a multiline prompt keeps its line breaks.
- The message, the conversation, and edit mode are unaffected by the click.
- The icon switches to the copied state for ~2 s and the status region announces the copy.
- The button is present and enabled in read-only conversations and while a response streams.
- Unit tests cover the lib (User-role Copy render/click/labels) and the app adapter (`buildMessageActions` user branch); `npm run validate:docs` passes.
