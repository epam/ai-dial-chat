## Why

### Problem

Users cannot attach a selected passage from a chat message to their next prompt without copying it and creating a file themselves. The supplied Claude Desktop screenshots demonstrate the desired selection-to-Reply interaction.

## What Changes

### Solution

- Show a floating, localized Reply action for a non-empty selection inside one completed user or assistant message body.
- Keep Reply compact on desktop with an opaque normal/hover background. Inline citations, annotations and links must not prevent Reply for a selection that also contains message text; preserve native selected text, including selected marker labels.
- Clicking Reply creates a UTF-8 `text/plain` file containing exactly the selected visible text and adds it to the active composer's existing attachment flow. This follows the user's clarification to reuse the mechanism used for recorded audio.
- Show the existing file attachment card, with upload progress, preview, retry and removal behavior; preserve the typed draft and existing attachments. Do not send the message automatically.
- Support mouse, keyboard and touch selection, mobile layouts and RTL.
- Respect the current composer's availability, attachment MIME permissions, size and count limits.

### Non-goals

- A new quotation payload, source-message links, threaded replies or a bespoke Claude-style quotation card.
- Reply from edit mode, shared/read-only views, embedded apps, attachment viewers, tool output or a message still streaming.
- Changes to backend endpoints, generated clients, voice recording, citation parsing or the referenced `apps/chat-api/src/net/proxy-agent.setup.spec.ts`.

### Acceptance criteria

1. Selecting visible text within one eligible message reveals Reply; blank, cross-message and non-body selections do not.
2. One activation adds one `.txt` file whose decoded contents equal the selection, preserving Unicode, line breaks and whitespace; the draft remains unchanged and the composer receives focus.
3. The file uses the existing upload/validation path. Sending uses its uploaded URL; loading/error states block sending as existing attachments do.
4. Selection invalidation, navigation, Escape and outside interaction dismiss the action without uploading. Reply works with keyboard and touch, fits a 360px viewport and mirrors correctly in RTL.
5. Existing file/drop/paste/audio workflows continue to work, including simultaneous queued files and rejected uploads.

## Capabilities

### New Capabilities

- `message-selection-reply`: Selection eligibility, floating Reply action, conversion to an ordinary file attachment and composer integration.

### Modified Capabilities

None. `attachment-send-flow`, `conversation-input-attachments` and `chat-input-disabled-state` remain authoritative; this change adds a producer of ordinary files without changing their contracts.

## Impact

- App: `ConversationView` and `ConversationMessageItem` compose the reusable selection hook, action and composer. No new global provider or persisted draft store.
- Shared-library scope is intentional: `chat-hooks/conversation` owns host-agnostic selection and file-queue mechanics; `conversation-messages` exports the Reply action and optional message-body ref; `conversation-input` accepts an optional focus request. Eligibility, localization and upload/validation callbacks stay at the app edge. Hosts can configure the action colors, typography, classes and same-document portal destination.
- Follow `libs/conversation-input/src/hooks/useVoiceRecorder.ts:205` (recording to `File`), `libs/conversation-input/src/hooks/useAttachments.ts:271` (pending files to validation/upload), and `apps/chat/src/components/ConversationView/ConversationView.tsx:534` (text MIME eligibility). URL mapping stays in `libs/chat-hooks/src/conversation/useConversationHandlers/attachment-to-dto.ts:5`.
- i18n: add Reply and attachment-added announcement keys in English only; reuse existing attachment labels/errors.
- Update the affected library READMEs, app README and `docs/technical-requirements.md` in implementation. No structural architecture change is planned.
- Alternatives considered: inserting quoted text into the draft changes the requested interaction; a new inline quote type adds persistence/API complexity. Reusing an ordinary text file matches the clarified request and existing validation/upload behavior.
- Backward compatibility/rollback: all library props are optional. Reverting the UI integration leaves previously sent `.txt` attachments usable by existing clients. No data migration or feature key is needed. The Reply portal declares `react-dom` as a peer dependency.
