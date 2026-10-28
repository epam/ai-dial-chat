## Why

`ConversationView` keeps its own copy of the DIAL file-manager attach state: `isDialFileManagerOpen` and `pendingDialAttachments` in two `useState` calls (`apps/chat/src/components/ConversationView/ConversationView.tsx:557-560`), and a `handleAttachDialFiles` callback (`ConversationView.tsx:1038-1050`) that repeats `useDialFileManagerState.handleAttach` (`apps/chat/src/hooks/files/useDialFileManagerState.ts:33-45`) line for line. `NewConversationComposer` already uses the shared hook (`apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx:265-272`). Every attach-flow change since 2026-06 (`AttachResult`, folder attachments) had to be made in both places. This is the last open Phase 1 item (1.6) of the refactoring plan; it was deferred by `split-use-dial-file-manager` and `extract-shared-conversation-hooks-and-themes-module`.

## What Changes

- `ConversationView` gets its attach-modal open state, pending DIAL attachments, attach handler, and clear callback from `useDialFileManagerState(bucket)`, destructured under the local names it already uses, following `NewConversationComposer`.
- Removed from `ConversationView`: the two `useState` calls, the inline `handleAttachDialFiles` and `clearPendingDialAttachments` callbacks, the inline `() => setPendingDialAttachments([])` and `() => setIsDialFileManagerOpen(false)` arrows, and the imports that become unused (`dialFilesToAttachments`, `dialFolderPathToAttachment`, and any others the compiler flags).
- Spec text that names `ConversationView.handleAttachDialFiles` or says `ConversationView` owns the modal state is updated so both call sites go through `useDialFileManagerState`.

No user-visible behavior changes. No new strings, no lib changes, no new context.

Non-goals: changing `useDialFileManagerState`'s API, moving it into a lib (it stays app-owned per `extract-attachment-citations-file-manager-hooks` D7), or touching the edit-message attach path.

Acceptance criteria:

- `ConversationView.tsx` contains no `useState` for file-manager open state or pending DIAL attachments, and calls `useDialFileManagerState(bucket)` once.
- Existing `ConversationView` and `NewConversationComposer` tests pass unchanged; typecheck and lint pass for `chat`.
- Opening, closing, attaching files and folders, and clearing pending attachments behave as before in an existing conversation.

Alternatives considered: leave the duplicate and document it (rejected: two changes already had to edit both copies); move the hook into `chat-hooks` (rejected: out of scope and already decided against in D7).

Rollback: a pure refactor inside one component; revert the commit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dial-file-system-picker`: the "Open FileManager in modal" requirement now states that both `ConversationView` and `NewConversationComposer` own the modal state through `useDialFileManagerState`.
- `dial-file-manager-attach-folders`: the "onAttach returns both files and folder paths" and "handleAttachDialFiles forwards folderPaths as folder Attachments" requirements now name `useDialFileManagerState.handleAttach` as the single handler both call sites use.

## Impact

- Code: `apps/chat/src/components/ConversationView/ConversationView.tsx` only.
- Tests: none expected to change; `ConversationView` specs that render the attach flow may need a `useDialFileManagerState` mock only if they currently assert on internals (none found).
- i18n: none. Libs: none. Docs: none beyond the two delta specs.
