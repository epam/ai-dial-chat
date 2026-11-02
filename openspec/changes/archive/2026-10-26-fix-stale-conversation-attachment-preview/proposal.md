# Proposal

## Why

Clicking several attachments in a conversation in quick succession makes the chat hang: every click starts its own content load and each one later writes its result to the canvas, so the canvas keeps switching through every previously clicked file instead of settling on the last one (issue [#9511](https://github.com/epam/ai-dial-chat/issues/9511)). By reading the code, nothing in the preview path is specific to shared conversations, so any conversation view should reproduce it with heavy files (PDF, OOXML); this is not yet reproduced by hand.

## What Changes

- Attachment clicks in `ConversationView` (message attachments and input-tray attachments), in the `NewConversationComposer` input tray and in `ConversationSourcesPanel` pass a commit guard to `openAttachmentCanvas`, so a click that a later click supersedes, or that finishes after its owner unmounted, writes nothing to the canvas.
- A superseded click in `ConversationSourcesPanel` does not run the "could not preview" fallback (download or new tab), since it did not fail, it was replaced.
- The generation-counter guard that `useDialFilePreview` already carries privately (`generationRef` in `apps/chat/src/hooks/files/useDialFilePreview.ts`, the closest existing model) moves into one shared app hook, and `useDialFilePreview` uses it, so every caller of the single canvas shares one "latest request wins" order. This touches the file-manager preview code, which is the only scope beyond the two reported call sites.
- Not changed: the `useOpenAttachmentCanvas` contract and `libs/*`. The hook already accepts `shouldCommit` and documents that underlying I/O is not cancelled.

Alternatives considered: pass an `AbortSignal` through the resolvers and `fetch` (cancels network and parsing, but widens the lib contract that `attachment-canvas-workflow` deliberately keeps I/O-free; a possible follow-up); debounce clicks (hides the race for fast clicks but leaves slow loads reordered, so it is not sufficient alone).

## Non-Goals

- Cancelling network requests or parsing of superseded clicks.
- Debouncing or blocking rapid clicks.
- Changing `libs/attachment-canvas` or `libs/chat-hooks`.

## Acceptance Criteria

- Clicking attachment A (slow) then B before A loads leaves the canvas on B, with A's late result discarded, in the conversation view, the input tray and the sources panel.
- A superseded sources-panel click triggers no download, new tab or sidebar close.
- File-manager preview behavior and its `file-manager-preview` spec scenarios are unchanged.
- `git diff` touches nothing under `libs/*`; `npm run verify:full` and `npm run validate:specs` pass.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `canvas`: adds a requirement that the latest attachment click owns the canvas, for conversation, input-tray and sources-panel clicks.

## Impact

- **Code**: new `apps/chat/src/hooks/attachment/useLatestCanvasRequest.ts`; `apps/chat/src/components/ConversationView/ConversationView.tsx`; `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`; `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`; `apps/chat/src/hooks/files/useDialFilePreview.ts`.
- **Libs**: none, library isolation is unaffected.
- **i18n / RTL / API**: no new strings, no UI change, no endpoint change.
- **Backward compatibility / rollback**: no contract change; revert the commit.
- **Docs**: `canvas` spec only; no README or `docs/architecture.md` change (no new lib, context or route).
