# conversation-draft-persistence Specification

## Purpose

Per-conversation composer drafts: the reusable draft store contract, store factories and headless `useConversationComposerDraft` hook in `@epam/ai-dial-chat-hooks`, and the `apps/chat` adapter that saves, restores and evicts unsent text and skill mentions for existing conversations.

## Requirements

### Requirement: Reusable draft model and injected store contract in chat-hooks

`@epam/ai-dial-chat-hooks` SHALL export the following from `libs/chat-hooks/src/conversation/conversation-draft/`, re-exported through `libs/chat-hooks/src/entry-points/conversation.ts` and `libs/chat-hooks/src/index.ts`:

- `ConversationDraft`: `{ text: string; skills: RequestSkill[]; updatedAt: number }`. `RequestSkill` comes from `@epam/ai-dial-chat-shared`.
- `ConversationDraftStore`: `{ read(conversationId): ConversationDraft | undefined; write(conversationId, draft): void; remove(conversationId): void; clear(): void }`.

The contract's guarantees:

- **The interface is synchronous.** A host that needs async persistence can wrap it behind a sync cache.
- **No implementation may throw** to the caller.
- **The lib picks no storage.** The lib SHALL NOT choose a storage medium, a storage key, a user scope or an id-canonicalisation rule. Those arrive through factory options or a host-implemented store.

Gating and cross-cutting concerns:

- **State owner.** The store instance is created and owned by the host. In `apps/chat` that is `useConversationDraftStore` in `apps/chat/src/hooks/conversation/useConversationDraftStore.ts`.
- **Feature gate:** none.
- **i18n:** no strings, so no keys.
- **RTL:** none, since this is behaviour only.
- **Accessibility:** none new.
- **Observability:** none.
- **New dependencies or peers:** none.

#### Scenario: Host supplies its own store

- **WHEN** a client host implements `ConversationDraftStore` over its own persistence and passes it to `useConversationComposerDraft`
- **THEN** drafts are read and written only through that store, and the lib touches no browser storage

#### Scenario: Lib sources carry no host knowledge

- **WHEN** the sources under `libs/chat-hooks/src/conversation/conversation-draft/` and `libs/chat-hooks/src/conversation/useConversationComposerDraft/` are inspected
- **THEN** they contain:
  - no `sessionStorage` or `localStorage` identifier;
  - no storage-key literal;
  - no import from `apps/*`, app contexts, routing, i18n, env or the generated API client.

### Requirement: Store factories shipped by chat-hooks

`@epam/ai-dial-chat-hooks` SHALL export two store factories.

**`createWebStorageConversationDraftStore(options)`**, with these options:

| Option | Required | Meaning |
| --- | --- | --- |
| `getStorage: () => Storage \| undefined` | yes | Returns the `Storage` to use. |
| `storageKey: string` | yes | The single key the store writes under. Host-chosen, including any user scope. |
| `maxEntries?: number` | no | Defaults to `50`. |
| `normalizeId?: (id: string) => string` | no | Defaults to identity. |

The store SHALL behave as follows:

- **Format.** It persists one JSON blob `{ "version": 1, "drafts": { [normalizedId]: ConversationDraft } }` under `storageKey`.
- **Cap.** When a write would exceed `maxEntries`, it evicts the entry with the oldest `updatedAt`.
- **Malformed data.** A malformed or unknown-version blob is treated as empty.
- **Quota.** On `QuotaExceededError` it evicts the oldest half and retries once.
- **Removal.** Writing a draft whose `text` is empty or whitespace-only and whose `skills` is empty removes the entry.
- **`clear()`** removes `storageKey`.
- **Failures.** Every storage call is guarded, so an absent `Storage` or a throwing one behaves as an empty, write-ignoring store.

**`createMemoryConversationDraftStore(options?)`** SHALL provide the same semantics (`maxEntries`, `normalizeId`, empty-draft removal) over an in-memory map.

#### Scenario: Two route forms share one entry

- **WHEN** a store created with `normalizeId` writes a draft under `/conversations/abc` and reads `abc`
- **THEN** the draft is returned

#### Scenario: Entry cap evicts the oldest draft

- **WHEN** 50 drafts are stored and a 51st conversation's draft is written
- **THEN** the oldest-`updatedAt` draft is removed and the new draft is stored

#### Scenario: Throwing storage degrades silently

- **WHEN** `getStorage()` returns a `Storage` whose `getItem` or `setItem` throws, or it returns `undefined`
- **THEN** `read` returns `undefined`, `write`, `remove` and `clear` return normally, and nothing is thrown

### Requirement: Headless composer-draft hook

`@epam/ai-dial-chat-hooks` SHALL export `useConversationComposerDraft(params)` from `libs/chat-hooks/src/conversation/useConversationComposerDraft/useConversationComposerDraft.ts`.

Parameters:

| Parameter | Required | Meaning |
| --- | --- | --- |
| `store: ConversationDraftStore \| undefined` | yes | `undefined` makes every handler a no-op. |
| `conversationId: string` | yes | The conversation whose draft is managed. |
| `restoreDraft: (draft: ConversationDraft) => void` | yes | The host seeds its own composer and mention state. |
| `isRestoreReady?: boolean` | no | Defaults to `true`. The host defers the restore while it is `false`. |
| `shouldSkipRestore?: boolean` | no | Defaults to `false`. Set by the host when external content is pending. |
| `debounceMs?: number` | no | Defaults to `300`. |

It SHALL return stable (`useCallback`) handlers:

- `handleTextChange(text)`
- `handleSkillsChange(skills)`
- `handleExternalContent(text)`
- `sendWithDraft(text, send)`
- `clearDraft()`

The hook SHALL behave as follows:

- **Save.** `handleTextChange`, `handleSkillsChange` and `handleExternalContent` record the latest text and skills in refs, never in state, and schedule a debounced `store.write`. `handleExternalContent` replaces the draft with `{ text, skills: [] }`.
- **Flush.** A pending write is flushed synchronously on unmount, on a `conversationId` change (written under the previous id), and on `window` `pagehide`.
- **Restore.** The hook calls `restoreDraft` at most once per `conversationId`, and only once `isRestoreReady` is true. It skips the call when:
  - `shouldSkipRestore` is true;
  - no draft is stored;
  - the user already produced text for this id before the restore became ready.

  When the id changes and no draft is stored, it calls `restoreDraft({ text: '', skills: [], updatedAt: 0 })`, so a host whose view stays mounted can reset a stale seed.
- **Send.** `sendWithDraft`:
  1. cancels any pending write and empties the latest-text ref;
  2. awaits `send()`;
  3. on success, calls `store.remove(conversationId)`, unless the user edited the draft while `send` was in flight, in which case that newer draft is kept;
  4. on rejection, restores the ref to `text`, writes `text` back to the store (the cancelled write may have been its only copy) and rethrows, so the stored draft holds the message the composer puts back.

  Skill changes that arrive after a successful send while the text is empty SHALL NOT re-create the entry.
- **Memoisation.** The handlers' identities SHALL NOT change across renders unless `store` or `conversationId` changes, so hosts can pass them into memoised inputs without re-rendering message lists while a reply streams.

#### Scenario: Draft survives a remount within the debounce window

- **WHEN** the host calls `handleTextChange('compare these two plans')` and unmounts 100 ms later
- **THEN** the store holds that text for the conversation, and a remount for the same id calls `restoreDraft` with it

#### Scenario: Per-conversation isolation on id change

- **WHEN** the host types "draft A" under id A, rerenders with id B, types "draft B", and rerenders with id A
- **THEN** `restoreDraft` receives "draft A" for A, and the store holds "draft B" for B

#### Scenario: Deferred restore waits for readiness

- **WHEN** a stored draft exists and `isRestoreReady` is `false`, then becomes `true`
- **THEN** `restoreDraft` is called once, at the moment it becomes `true`

#### Scenario: Typing before readiness wins over a late restore

- **WHEN** `isRestoreReady` is `false`, the user calls `handleTextChange('new')`, and then readiness flips to `true`
- **THEN** `restoreDraft` is not called, and the stored draft becomes "new"

#### Scenario: External content wins

- **WHEN** `shouldSkipRestore` is `true` at mount and the host calls `handleExternalContent('from host')`
- **THEN** `restoreDraft` is not called, and the stored draft becomes "from host" with no skills

#### Scenario: Successful send clears, failed send keeps

- **WHEN** `sendWithDraft('hello', send)` resolves
- **THEN** the store holds no entry for the conversation
- **WHEN** `send` rejects instead
- **THEN** the rejection propagates, and the stored draft still holds "hello"

#### Scenario: Text typed during a send survives it

- **WHEN** `sendWithDraft('hello', send)` is in flight, the host calls `handleTextChange('next question')`, and `send` then resolves
- **THEN** the store holds "next question" for the conversation

#### Scenario: Emptied input removes the draft

- **WHEN** the host calls `handleTextChange('')` with no skills and the debounce elapses
- **THEN** the store holds no entry for the conversation

### Requirement: ConversationInput reports pasted-text expansion through onChange

`Input` in `libs/conversation-input/src/components/Input/Input.tsx` SHALL call `onChange` with the resulting textarea value when a pasted-text card is expanded into the textarea (`handleExpandPastedText`). This is the same contract the lib already follows for typing, transcript append and command-menu removal. The lib SHALL NOT gain storage, conversation-id, routing or user knowledge, and no public API changes.

#### Scenario: Expanding pasted text fires onChange

- **WHEN** the textarea holds "intro" and the user expands a pasted-text card containing "details"
- **THEN** `onChange` is called once with "intro\ndetails"

### Requirement: apps/chat adapter for existing conversations

`apps/chat` SHALL keep only host-owned knowledge and SHALL delegate all draft logic to `useConversationComposerDraft`.

- **Store.** `useConversationDraftStore` (`apps/chat/src/hooks/conversation/useConversationDraftStore.ts`) returns a `useMemo`-cached `createWebStorageConversationDraftStore` with these options:
  - `getStorage: () => window.sessionStorage`;
  - `storageKey` set to `` `${StorageKey.ConversationDrafts}:${user.sub}` ``, using the new member `ConversationDrafts = 'conversationDrafts'` in `apps/chat/src/types/storage-key.ts`;
  - `normalizeId: normalizeConversationId` from `apps/chat/src/constants/routes.ts`.
  It returns `undefined` while there is no signed-in user, or while the `conversation-drafts` UI feature is off (see "Drafts are gated by the conversation-drafts UI feature" below).
  It returns `undefined` while there is no signed-in user.
- **Composer.** `ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) wires the hook as follows:
  - `restoreDraft` calls `seedSkillMentions(text, skills)` from the main `useSkillSelectorOverlay` instance when the draft has skills and `selectedDeployment.features?.skillsSupported === true`. Otherwise it calls `seedComposerSeed(text)`.
  - `isRestoreReady` is false only while the stored draft has skills, `selectedDeployment` is unresolved, and the deployments are still loading. A deployment that is still missing once they have loaded gets the text restored only.
  - `shouldSkipRestore` is true for the conversation open at mount when `inputContentRevision` is non-zero at mount, and for no other id afterwards. That includes the same id reopened in the same view.
  - Overlay content present at mount is passed to `handleExternalContent`, and an `inputContentRevision` change back to `0` is ignored.
  - `ConversationInput.onChange` calls the skill hook's `onDraftChange` and then `handleTextChange`.
  - `selectedSkills` changes call `handleSkillsChange`.
  - The overlay `inputContent` seed source calls `handleExternalContent`.
  - `handleSendWithAnchor` routes through `sendWithDraft`, with `resetSkillMentions()` running after it resolves.
- **Overlay hand-off.** `ConversationPage` (`apps/chat/src/pages/Conversation/Conversation.tsx`) treats overlay input content as one-shot. Once `ConversationView` has rendered with it, the page passes `inputContentRevision={0}`, so a later view remount (another conversation opened behind the spinner) does not take the stale content for fresh content at mount.
- **New Chat.** The New Chat composer (`apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`) SHALL NOT use drafts.
- **Eviction.**
  - `deleteConversation` in `apps/chat/src/context/ConversationsContext.tsx` calls `store.remove(id)` after the API delete succeeds or reports the conversation not found.
  - `deleteAllConversations` calls `store.clear()` after it succeeds, keeping the drafts of the ids reported in `failed`.
  - `apps/chat/src/components/LogoutConfirmation/LogoutConfirmationModal.tsx` calls `store.clear()` before `logout()`.
  - The overlay `DELETE_CONVERSATION` path reaches the same `deleteConversation`.

#### Scenario: Draft survives "New Chat"

- **WHEN** the user types "compare these two plans" into existing conversation A and clicks "New Chat"
- **THEN** returning to A shows "compare these two plans" in the input

#### Scenario: Skill mentions are restored

- **WHEN** A's draft contains a `/summarize` mention, the deployment supports skills, and the user leaves and returns
- **THEN** the input shows the text with the `/summarize` mention active, and sending includes that skill

#### Scenario: Skill mentions degrade to text when skills are unsupported

- **WHEN** a stored draft has skill mentions but A's deployment does not support skills
- **THEN** the text is restored and no mention chips are active

#### Scenario: Overlay content wins over a stored draft

- **WHEN** A has the stored draft "old" and the overlay sets input content "new" as A opens
- **THEN** the input shows "new", and A's stored draft becomes "new"

#### Scenario: Spent overlay content does not overwrite another conversation's draft

- **WHEN** the overlay set input content while A was open, and the user then opens B, which has the stored draft "mine" and is not cached
- **THEN** B's input shows "mine", and B's stored draft is unchanged

#### Scenario: Skill draft of a conversation whose model is gone

- **WHEN** A's stored draft has skill mentions and A's deployment is missing once the deployments have loaded
- **THEN** the text is restored and no mention chips are active

#### Scenario: Drafts are scoped per user

- **WHEN** user `alice` leaves a draft in A and user `bob` signs in on the same tab and opens A
- **THEN** bob's input is empty

#### Scenario: Delete and logout evict drafts

- **WHEN** A has a draft and the user deletes A
- **THEN** no entry for A remains
- **WHEN** the user deletes all conversations and B fails to delete
- **THEN** only B's draft remains
- **WHEN** the user confirms logout
- **THEN** the `conversationDrafts:<userSub>` key is removed

#### Scenario: New Chat screen is unaffected

- **WHEN** the user types on the New Chat screen, opens A, and clicks "New Chat" again
- **THEN** the New Chat input behaves as it does today, and no draft entry exists for it

### Requirement: Drafts are gated by the conversation-drafts UI feature

Per-conversation drafts SHALL be controlled by the `conversation-drafts` UI feature (`OverlayFeature.ConversationDrafts` in `libs/chat-overlay/src/protocol/overlay-protocol.ts`). It is in `DEFAULT_ENABLED_UI_FEATURES` (`apps/chat/src/constants/ui-features.ts`), so drafts are on unless an operator's `ENABLED_UI_FEATURES` or an overlay host's `enabledFeatures` leaves the key out. Both of those replace the default set rather than adding to it, so a host that passes its own list SHALL name `conversation-drafts` to keep drafts.

- `useConversationDraftStore` resolves the flag through `useUiFeature` and SHALL return `undefined` while it is off. `useConversationComposerDraft` then makes every handler a no-op, so one switch stops saving, restoring and eviction in `ConversationView`, `ConversationsContext` and `LogoutConfirmationModal`.
- While the flag is off, `useConversationDraftStore` SHALL clear the signed-in user's stored drafts, so turning the flag back on in the same tab never restores stale text.
- The flag SHALL stay in `apps/chat`. `libs/chat-hooks` SHALL NOT read UI features, consistent with the library isolation rule.
- `apps/chat-api`'s `KNOWN_UI_FEATURES` SHALL list `conversation-drafts`, so the operator env var accepts the key.

**Feature flag:** `conversation-drafts`, default on. This repo has no `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` gating for it.

**RTL impact:** None. No UI is added.

**Accessibility / i18n impact:** None. The flag only changes whether the input starts with restored text.

#### Scenario: Drafts work with the default feature set

- **WHEN** neither `ENABLED_UI_FEATURES` nor an overlay `enabledFeatures` is set, and the user leaves a draft in A and returns
- **THEN** A's input shows the draft

#### Scenario: A host that leaves the key out gets no drafts

- **WHEN** an overlay host passes `enabledFeatures` without `'conversation-drafts'`, and the user types into A, switches away and returns
- **THEN** A's input is empty, and no `conversationDrafts:<userSub>` key is written

#### Scenario: Turning the flag off discards stored drafts

- **WHEN** `conversationDrafts:<userSub>` holds drafts and the effective UI-feature set no longer includes `conversation-drafts`
- **THEN** the key is removed from `sessionStorage`
