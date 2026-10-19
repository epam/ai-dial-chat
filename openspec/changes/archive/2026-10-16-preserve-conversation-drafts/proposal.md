## Why

Suppose a user types into the composer of an existing conversation, then clicks "New Chat" or picks another conversation. The text is lost, and when they come back the input is empty. People switch context mid-thought all the time, and losing a half-written prompt is frustrating. Claude.ai and similar products keep a draft for each conversation.

The loss is not an explicit reset. The text lives only in lib-local state, `useMessageState` (`libs/conversation-input/src/hooks/useMessageState.ts:26`), and two things throw that state away:

- **Remount on switch.** `ConversationInput` is keyed on the conversation id (`apps/chat/src/components/ConversationView/ConversationView.tsx:1225`, `key={conversation.id}`), so it remounts whenever the conversation changes.
- **Unmount while loading.** `ConversationPage` renders a spinner in place of the view while the next conversation loads (`apps/chat/src/pages/Conversation/Conversation.tsx:872`), which unmounts `ConversationView` entirely.

**Reuse requirement.** Client chat applications are built from this repository's libraries, so the draft behaviour must ship as a reusable library API, not as `apps/chat`-only code. That follows the precedent in `docs/reusable-chat-workflows.md`: skill import, file attachment and prompt selection already ship as public package APIs that every DIAL-Core-backed host runs unchanged.

## What Changes

### Library: `@epam/ai-dial-chat-hooks`

This is where the reusable core goes. It is exported from the `./conversation` subpath and from the package root.

- **Draft model and store contract.**
  - `ConversationDraft` holds `text`, `skills: RequestSkill[]` and `updatedAt`. `RequestSkill` comes from `@epam/ai-dial-chat-shared`, an existing peer of `./conversation`.
  - `ConversationDraftStore` is a narrow interface: `read`, `write`, `remove`, `clear`. The host injects it. The lib never picks a storage medium, a storage key or a user scope.
- **Ready-made store factories** that hosts can use instead of writing their own:
  - `createWebStorageConversationDraftStore({ getStorage, storageKey, maxEntries?, normalizeId? })` takes everything host-specific as arguments: which `Storage` to use, the key (including any user scope) and id canonicalisation. It owns only the versioned JSON format of its own `ConversationDraft` data, the 50-entry cap, and silent failure handling.
  - `createMemoryConversationDraftStore()` is for hosts that want drafts kept only for the page lifetime, and for tests.
- **Headless composer hook** `useConversationComposerDraft({ store, conversationId, restoreDraft, isRestoreReady?, shouldSkipRestore?, debounceMs? })`. It owns the whole draft state machine:
  - a debounced save, flushed on unmount, on a change of conversation id, and on `pagehide`;
  - a single restore per conversation id, which the host can defer until it is ready;
  - "the user typed first, so skip a late restore";
  - external-content replacement (an overlay seed);
  - send handling that clears the draft on success and keeps it on failure;
  - clearing the draft when the input is emptied.

  The host supplies only `restoreDraft(draft)`, which seeds its own composer and skill-mention state, and wires the returned stable handlers into its input.

### Library: `@epam/ai-dial-conversation-input`

- **Small fix.** `Input` does not call `onChange` when a pasted-text card is expanded into the textarea (`handleExpandPastedText`, `Input.tsx:476`). It should, so that any host sees every user-driven text change. There is no public API change and no storage knowledge.

### App adapter: `apps/chat`

This is thin glue. It contains only host-owned knowledge:

- **Storage and key.** `sessionStorage` with the key `` `${StorageKey.ConversationDrafts}:${user.sub}` ``. This adds a new `StorageKey` member, and `normalizeConversationId` is passed as `normalizeId`.
- **Store construction.** It lives in a small app hook, `useConversationDraftStore`.
- **Composer wiring.** It lives in `ConversationView`:
  - `restoreDraft` calls `seedSkillMentions` or `seedComposerSeed`;
  - `isRestoreReady` waits for the deployment when the draft has skills;
  - `shouldSkipRestore` handles overlay content.
- **Eviction.** `ConversationsContext` (`deleteConversation`, `deleteAllConversations`) and `LogoutConfirmationModal` (logout) call `store.remove` and `store.clear`.

### Behaviour, unchanged from the earlier plan

- A draft is kept per existing conversation and per user, in `sessionStorage`. It survives a conversation switch, "New Chat" and a reload, and is gone when the tab closes.
- A draft is cleared on a successful send, on an emptied input, on delete or delete-all, and on logout. A failed send keeps it.
- Overlay `SET_INPUT_CONTENT` content takes precedence over a stored draft.

### Docs

- `libs/chat-hooks/README.md`: a new section for the hook and the stores, plus the `./conversation` export listing. The entry-point-to-peer matrix is unchanged, since no new peers are added.
- `docs/reusable-chat-workflows.md`: a "Conversation drafts" row with what the lib owns and what the host keeps, plus a client-application adoption note.

### Non-goals

- **The New Chat composer.** `NewConversationComposer` keeps today's behaviour. A host can still use the hook there later under its own sentinel id.
- **Attachments, chat settings and tool toggles.**
- **The edit-previous-message composer.**
- **Cross-tab, cross-device or backend persistence.** The store interface keeps this open: a host can inject a `localStorage` store or a backend-backed store without any lib change.
- **Putting drafts inside the `ConversationInput` component itself.** See Alternatives.
- **Migrating the client application.** It lives in another repository. This change provides the API and the adoption notes only.
- **An overlay feature flag to disable drafts.** This can be a follow-up.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. App-only util and hook** (previous revision) | Simplest. Rejected because every client chat would have to re-implement the debounce, flush, restore-once and send-clear logic, which is the error-prone part. |
| **B. Headless hook and store contract in `chat-hooks`, thin app adapter** (chosen) | All reusable logic sits in one package that client hosts already install as a scenario root. Host-owned facts are injected: the storage medium, the key and user scope, id normalisation, skill seeding, eviction triggers. Follows the `useSkillArchiveImport` / `useFileAttachmentPicker` precedent. |
| **C. `draftKey` and `draftStore` props on `ConversationInput`** | The easiest call site, but the input does not own skill-mention state. That lives in `useSkillMentions` / `useSkillSelectorOverlay`, outside the input, so chips could not be restored. It would also put persistence into a presentational component lib. Rejected. |
| **D. Web Storage access hard-coded in the lib** (lib picks `sessionStorage` and the key) | Violates the AGENTS.md library-isolation rule: storage keys and persistence choices are host-owned. Rejected in favour of B's injected `getStorage` and `storageKey`. |

Storage lifetime alternatives (in-memory, `sessionStorage`, `localStorage`) were settled in the previous round: `sessionStorage`, chosen by the host. Option B keeps that a host decision.

## Acceptance criteria

1. Type in existing conversation A, click "New Chat", return to A: the text is in the input.
2. Type in A, switch to B, type in B, then go back and forth: each conversation shows its own draft.
3. A draft with a `/skill` mention, switched away and back: the mention chip is restored when the deployment supports skills.
4. Reload the tab: the draft is restored. Close the tab and open a new one: it is gone.
5. Send successfully: the input is empty when you return. Send fails: the draft is kept.
6. Clear the input fully: it is empty when you return.
7. Delete A, delete all conversations, or log out: the drafts are removed.
8. Another user signing in on the same tab never sees the previous user's drafts.
9. Storage that is unavailable or throws never breaks the composer.
10. Expanding a pasted-text card fires `onChange`.
11. `useConversationComposerDraft` and both store factories are importable from `@epam/ai-dial-chat-hooks/conversation` and from the package root. They are documented in the lib README with compiling examples, and `npm run validate:docs` passes.
12. The new `chat-hooks` sources contain no host knowledge: no direct `sessionStorage` or `localStorage` reference, no storage-key literal, no `apps/*` import, no app contexts, routing, i18n or env.

## Capabilities

### New Capabilities

- `conversation-draft-persistence`: the reusable draft model, store contract and store factories, and the headless composer-draft hook in `libs/chat-hooks`; the `onChange` completeness fix in `libs/conversation-input`; and the `apps/chat` adapter behaviour (save, restore, clear, evict) for existing conversations.

### Modified Capabilities

<!-- none — no existing spec's requirements change -->

## Impact

- **libs/chat-hooks** (public API addition, non-breaking):
  - new `src/conversation/conversation-draft/` (models, store factories);
  - new `src/conversation/useConversationComposerDraft/`;
  - exports in `src/entry-points/conversation.ts` and `src/index.ts`;
  - README section.
  - No new dependencies or peers. `RequestSkill` comes from the existing `@epam/ai-dial-chat-shared` peer.
- **libs/conversation-input**: a one-line `onChange` call in `Input.handleExpandPastedText`, plus a test.
- **apps/chat**:
  - `StorageKey.ConversationDrafts`;
  - new `apps/chat/src/hooks/conversation/useConversationDraftStore.ts`;
  - wiring in `ConversationView.tsx`;
  - eviction in `ConversationsContext.tsx` and `LogoutConfirmationModal.tsx`.
- **Shared surfaces.** `ConversationView` is also rendered by `AppPreviewChat` and in overlay mode, so drafts apply there too, and the overlay seed path is covered explicitly.
- **docs**: `docs/reusable-chat-workflows.md`.
- **i18n**: no new strings.
- **Backend / API**: none.
- **Rollback**: not breaking. Reverting removes additive exports. Leftover `sessionStorage` entries are never read again and disappear when the tab closes.
