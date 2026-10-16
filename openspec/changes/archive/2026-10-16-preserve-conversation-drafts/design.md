## Context

The composer for an existing conversation is `ConversationInput`, rendered by `ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) with `key={conversation.id}`. Its text lives in lib-local state:

- `useMessageState` (`libs/conversation-input/src/hooks/useMessageState.ts`) holds the text, seeded from the `message`/`messageRevision` props and reported out through `onChange`.
- The host merges one-shot seed sources (overlay `inputContent` and skill-mention pushes) through `useComposerSeed` / `useComposerSeedSource` (`libs/conversation-input/src/hooks/useComposerSeed.ts`).
- Skill-mention state lives in `libs/skills` (`useSkillMentions`) and is wrapped for the app by `useSkillSelectorOverlay` (`apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx`). That hook exposes `seedSkillMentions(text, skills)`.

The draft is lost through three paths:

1. The `key` remount.
2. The `<Spinner/>` branch in `apps/chat/src/pages/Conversation/Conversation.tsx`, which unmounts the whole view.
3. The route swap to `/`.

Facts that shape the design:

- **`onSend` settles early.** `handleSend` in `libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts` starts the stream without awaiting it, so `onSend` settles right after the optimistic append.
- **`onChange` coverage.** `onChange` already fires for typing, transcript append, command-menu removal and `textInsertion`. It does not fire for pasted-text expand, which this change fixes. It also does not fire for history recall, by design, for the clear on send, or for a prop re-sync.
- **Ids are stable.** Conversation ids are immutable, and rename changes only the title.

**Reuse constraint.** Client chat applications compose the same libraries in their own repositories. The precedent is `docs/reusable-chat-workflows.md`: a workflow's state machine ships in a library, and the host keeps only host-owned facts. The AGENTS.md library-isolation rule lists storage keys, persistence choices, routing, auth/session and app contexts as host-owned.

## Goals / Non-Goals

**Goals**

- All draft logic lives in `libs/chat-hooks`, so a client host gets it by passing a store and a restore callback. That logic covers the debounce, flush, restore-once with readiness, typed-first precedence, external-content replacement, clear on send success, keep on failure, and empty removal.
- Ready-made store factories, so most hosts write no persistence code.
- `apps/chat` keeps only host facts: `sessionStorage`, the key and user scope, the id normalisation, skill seeding and the eviction triggers.
- Behaviour and acceptance criteria are unchanged from the earlier revision.

**Non-Goals.** These are restated from the proposal:

- New Chat drafts.
- Attachments, settings and tool toggles.
- The edit-message composer.
- Cross-tab and backend persistence. The store interface leaves these open.
- Drafts inside the `ConversationInput` component.
- Migrating the client application.

## Decisions

### D1 — Package placement: `@epam/ai-dial-chat-hooks`, `./conversation` subpath

New code goes in two places:

- `libs/chat-hooks/src/conversation/conversation-draft/`:
  - `conversation-draft.ts` holds the models: the `ConversationDraft` and `ConversationDraftStore` interfaces, and the store-option interfaces.
  - `conversation-draft-store.ts` holds the factories.
- `libs/chat-hooks/src/conversation/useConversationComposerDraft/useConversationComposerDraft.ts` holds the hook.

Both are exported from `libs/chat-hooks/src/entry-points/conversation.ts` and the root `src/index.ts`.

Why `chat-hooks`:

- It is the headless-hooks package that client hosts already install as a scenario root.
- `./conversation` already peers only `@epam/ai-dial-chat-shared`, which provides `RequestSkill`. The entry-point-to-peer matrix is therefore unchanged, and so is `npm run docs:install-matrix`.
- No new `dependencies` are added.

Alternatives considered:

- **`libs/conversation-input`.** It does not own skill-mention state, and it is a presentational lib, so persistence would be scope creep.
- **`libs/chat-shared`.** That is a shared models/utilities layer, not the stateful-workflow home.
- **A new `libs/conversation-drafts`.** That means a new package to publish, version and add to `docs/architecture.md` for roughly 200 lines. It is not justified.

### D2 — Injected store contract; the lib picks no storage, key or scope

The store contract is `ConversationDraftStore { read, write, remove, clear }`: synchronous, never throws. Hosts inject one.

Synchronous because:

- the restore must happen in the mount-time effect, before the user types;
- the unmount and `pagehide` flush must finish synchronously.

A host with async persistence wraps it behind a sync in-memory cache. That is documented in the README as a pattern, not shipped.

**Isolation boundary.** The lib never names `sessionStorage` or `localStorage`, never builds a key, and never reads the user. `createWebStorageConversationDraftStore` receives all of these as host values:

- `getStorage: () => Storage | undefined` — a getter, so SSR, tests and a blocked-storage access that throws are handled inside the factory's guard;
- `storageKey`;
- `normalizeId`.

What the factory does own is the versioned JSON format of its own `ConversationDraft` data:

- `{ version: 1, drafts }`;
- the `maxEntries` cap (default 50) with oldest-`updatedAt` eviction;
- a half-eviction retry on quota errors;
- empty-draft removal.

This is a serialisation format of a lib-defined type behind a host-chosen key. It is not a host persistence schema: the host still decides where the data lives, under which key, and for whom. The design doc records this explicitly. If review reads the AGENTS.md "persistence/storage keys and schemas" clause more strictly, the fallback is to move only `createWebStorageConversationDraftStore` into `apps/chat` and keep the contract and the hook in the lib. That fallback changes no other decision.

`createMemoryConversationDraftStore` has the same semantics over a `Map`. It covers hosts that want drafts for the page lifetime only, and it is the store the lib's own tests use.

Alternatives considered:

- **The hook takes `storage` and `key` directly**, with no store abstraction. That couples the hook to Web Storage and blocks backend or `localStorage` stores.
- **Async store.** That breaks the synchronous flush on unmount.

### D3 — The hook owns the state machine; the host owns only seeding

Call shape:

```ts
useConversationComposerDraft({
  store,
  conversationId,
  restoreDraft,
  isRestoreReady,
  shouldSkipRestore,
  debounceMs,
});
// → { handleTextChange, handleSkillsChange, handleExternalContent, sendWithDraft, clearDraft }
```

Internals:

- **Refs, not state.** `textRef`, `skillsRef`, `hasUserInputRef`, `restoredIdRef`, a pending-timer ref and `isSendingClearedRef`. The hook never causes a host re-render. This matters because `ConversationView` re-renders on every streamed chunk, and its `memo(ConversationMessageItem)` items must stay stable.
- **Handler identity.** Handlers depend only on `store` and `conversationId`.
- **Debounced write.** `scheduleWrite()` debounces `store.write(id, { text, skills, updatedAt: Date.now() })`. The store maps an empty draft to a remove.
- **Flush.**
  - The effect cleanup keyed on `[store, conversationId]` flushes under the *previous* id, then resets the per-id refs.
  - A `pagehide` listener flushes too.
  - Nothing is written for an id the user never touched, so merely visiting a conversation creates no entry.
- **Restore.** An effect on `[conversationId, isRestoreReady, shouldSkipRestore]` runs once per id, guarded by `restoredIdRef`:
  - If `shouldSkipRestore` is true, it marks the id restored and skips.
  - Otherwise, once ready, it reads the store.
  - If the user typed first (`hasUserInputRef`), it skips.
  - If a draft is stored, it calls `restoreDraft(draft)` and primes `textRef` and `skillsRef` from it.
  - If no draft is stored, it calls `restoreDraft` with an empty draft. This lets a host whose view stayed mounted across the id change reset a stale seed, which closes the existing hole where a remounted input inherits the previous conversation's `composerSeedText`.
- **`handleExternalContent(text)`** sets `textRef` to `text` and `skillsRef` to `[]`, and schedules a write. It is the overlay `SET_INPUT_CONTENT` path.
- **`sendWithDraft(text, send)`**:
  1. Cancel the pending timer, empty `textRef`, set `isSendingClearedRef` and note the current edit revision. Every recorded edit (`handleTextChange`, `handleExternalContent`, a recorded `handleSkillsChange`) bumps that revision.
  2. `await send()`.
  3. On success, `store.remove(id)`, but only when the edit revision is unchanged. Text the user typed while `send` was in flight is the next draft, and its debounced write is left to run.
  4. On rejection, restore `textRef` to `text`, clear the flag, write `text` back to the store explicitly, and rethrow, so `Input`'s own restore-on-failure still runs. The explicit write is needed because step 1 cancelled the pending save, which may have been the only copy of the latest text. `Input` puts the failed message back in place of anything typed meanwhile, so the stored draft follows the composer.

  While `textRef` is empty after a successful send, `handleSkillsChange` updates the ref but does not schedule a write. That stops `resetSkillMentions()` from re-creating the entry.
- **`store === undefined`** (no user yet) makes every handler a no-op, and `sendWithDraft` simply awaits `send()`.

Alternatives considered:

- **Return controlled `value` / `setValue` state.** That forces a host re-render per keystroke and replaces `Input`'s semi-controlled model. Rejected.
- **The hook imports `libs/skills` to restore mentions itself.** That adds a peer and hard-codes one mention model. Rejected in favour of the `restoreDraft` callback.

### D4 — `apps/chat` adapter

- **`useConversationDraftStore`** (`apps/chat/src/hooks/conversation/useConversationDraftStore.ts`) reads `useUser()` and returns a store memoised on `user?.sub`:

  ```ts
  createWebStorageConversationDraftStore({
    getStorage: () => window.sessionStorage,
    storageKey: `${StorageKey.ConversationDrafts}:${sub}`,
    normalizeId: normalizeConversationId,
  });
  ```

  It returns `undefined` without a user. Several instances over the same key are safe, because the store is stateless over storage. `ConversationView`, `ConversationsContext` and `LogoutConfirmationModal` each call the hook, and no context is needed.
- **`ConversationView`** wires the hook:
  - `restoreDraft` picks `seedSkillMentions` or `seedComposerSeed`, as in the spec.
  - `isRestoreReady` is `!(storedDraftHasSkills && selectedDeployment == null && isLoading)`, where `isLoading` is the deployments context's flag. `storedDraftHasSkills` comes from a cheap `store.read` memoised per id. Waiting on the deployments list rather than on the deployment itself means a conversation whose model is gone still gets its draft back, as text only.
  - Overlay precedence is per id, not a plain mount flag:
    - `hasInputContentAtMount` is `(inputContentRevision ?? 0) > 0` captured at mount.
    - `skipRestoreConversationId` holds the id open at mount while `hasInputContentAtMount` is true. It is dropped during render the first time `conversation.id` differs, so the skip never reaches another conversation, or the mount conversation reopened in the same view.
    - `shouldSkipRestore` is `skipRestoreConversationId === conversation.id`.
    - A mount-only effect calls `handleExternalContent(inputContent)` when `hasInputContentAtMount` is true, so the content that seeded the composer becomes the stored draft.
  - `onChange` calls `onDraftChange` and then `handleTextChange`.
  - An effect on `selectedSkills` calls `handleSkillsChange`.
  - The existing `useComposerSeedSource(inputContentRevision, …)` callback also calls `handleExternalContent`, and ignores a change back to `0`.
  - `handleSendWithAnchor` becomes `sendWithDraft(message, () => onSend(…))`, followed by `resetSkillMentions()`.
- **`ConversationPage` spends overlay content.**
  - The page is not remounted between conversations, and opening an uncached conversation remounts `ConversationView` behind the spinner.
  - So `pendingInputContent` carries `isPending`. `SET_INPUT_CONTENT` sets it, and an effect clears it once the view has rendered with the content.
  - While it is clear, the view gets `inputContentRevision={0}`. Without this, every later remount would treat the stale text as fresh content at mount, and save it over that conversation's draft.
- **Eviction.**
  - `ConversationsContext.deleteConversation` calls `store?.remove(id)` after the API resolves, and also on a not-found error.
  - `deleteAllConversations` reads the drafts of the ids in `result.failed`, calls `store?.clear()`, then writes those drafts back, because those conversations still exist.
  - `LogoutConfirmationModal` calls `store?.clear()` before `logout()`.

### D5 — Lib fix in `Input.handleExpandPastedText`

Compute `next` from the current text, read through the existing `draftRef` so the handler keeps its identity across keystrokes. Call `setMessage(next)`, then `onChange?.(next)`. There is no API change. The whole draft feature depends on `onChange` completeness, so the fix also benefits client hosts.

### D6 — Documentation for reuse

- **`libs/chat-hooks/README.md`** gets a new `### useConversationComposerDraft` section with a minimal compiling host example:

  ```ts
  const store = useMemo(
    () =>
      createWebStorageConversationDraftStore({
        getStorage: () => window.sessionStorage,
        storageKey: `my-app:drafts:${userId}`,
      }),
    [userId],
  );
  const draft = useConversationComposerDraft({
    store,
    conversationId,
    restoreDraft: ({ text }) => seed(text),
  });
  // <ConversationInput onChange={draft.handleTextChange} onSend={(m) => draft.sendWithDraft(m, () => send(m))} />
  ```

  The section also covers both factories, the contract, and the sync-cache note for async persistence.
- **`docs/reusable-chat-workflows.md`** gets:
  - a "Conversation drafts" row in the workflow table;
  - a parent-adoption entry: what `apps/chat` keeps, namely the storage medium, the key and `user.sub` scope, `normalizeConversationId`, skill seeding, deployment readiness, overlay precedence and the eviction call sites;
  - a client-application adoption-map line.

## Risks / Trade-offs

- **[Risk] Isolation-rule interpretation of the Web Storage factory** → Storage, key and normalisation are all injected, and the factory owns only its own data format. A fallback is recorded in D2 that moves just the factory to the app.
- **[Risk] Restore races with deployment load for skill drafts** → `isRestoreReady` defers only skill drafts, and the typed-first guard prevents a late overwrite.
- **[Risk] A sent message reappears** → `sendWithDraft` cancels the pending write and empties the ref before `send`, removes the entry on success, and suppresses skill-reset writes.
- **[Risk] Public API commitment in `chat-hooks`** → The surface is additive and small: two interfaces, two factories, one hook. The JSDoc and README examples are checked by `npm run validate:docs`.
- **[Trade-off] Synchronous store contract** → Async persistence needs a host-side cache. The README documents the pattern.
- **[Trade-off] Orphaned entries** → Deletes from another tab and preview conversations can leave entries behind. They are bounded by `maxEntries` and the tab lifetime.
- **[Trade-off] Debounce window** → A crash within 300 ms loses those keystrokes. `pagehide` covers reloads.

## Migration Plan

- The change is additive in both libs and needs no data migration. The behaviour is effective on deploy in `apps/chat`.
- Client applications adopt it later by following the adoption-map line, which is out of scope here.
- **Rollback:** revert the commit. The exports disappear, and nothing outside this repo consumes them until a client migrates. Leftover `sessionStorage` blobs are never read again and disappear when the tab closes. `version: 1` lets a future format change discard old blobs.

## Open Questions

- Does review accept the Web Storage factory in the lib (D2), or should the fallback apply?
- Should embedding hosts get an `OverlayFeature` toggle to disable drafts? This is deferred.
