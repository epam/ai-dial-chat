## Slicing strategy

**Contract-first, then vertical.** Slice 1 fixes the public library contract: models, store interface, factories. Slice 2 builds the headless hook against that contract, fully unit-tested in the lib with the memory store. Slice 3 wires `apps/chat` end to end for text drafts. Later slices widen to clearing on send, skills and overlay, eviction, the `conversation-input` `onChange` gap, and the reuse docs.

Each slice is independently verifiable. Every task touches only the files it names, and out-of-scope findings become follow-ups in 9.3. All new TypeScript uses extensionless relative imports. There are no new i18n keys, RTL surface, feature flag, endpoint, dependency or peer.

**Architecture guard.** It applies to every `libs/*` task below. The diff under `libs/chat-hooks` and `libs/conversation-input` must contain none of the following:

- `sessionStorage` / `localStorage` identifiers;
- storage-key literals;
- `/api` paths, server-api or generated-client calls;
- `apps/*` imports, app contexts, routing, auth/session/cookies, env, feature flags, i18n, analytics or logging transports.

Storage, key, user scope and id normalisation reach the lib only as `createWebStorageConversationDraftStore` options or as a host-implemented `ConversationDraftStore`.

## 1. Slice 1 — lib contract and store factories (`libs/chat-hooks`)

- [x] 1.1 Create `libs/chat-hooks/src/conversation/conversation-draft/conversation-draft.ts` with JSDoc'd exported interfaces:
  - `ConversationDraft`: `text`, `skills: RequestSkill[]` (type import from `@epam/ai-dial-chat-shared`), `updatedAt`;
  - `ConversationDraftStore`: `read`, `write`, `remove`, `clear`;
  - `WebStorageConversationDraftStoreOptions`: `getStorage`, `storageKey`, `maxEntries?` (default `50`), `normalizeId?`;
  - `MemoryConversationDraftStoreOptions`.

  Every property gets an inline doc, and documented defaults must match the code.
- [x] 1.2 Create `libs/chat-hooks/src/conversation/conversation-draft/conversation-draft-store.ts` with arrow-function exports `createWebStorageConversationDraftStore` and `createMemoryConversationDraftStore`. They follow design D2:
  - versioned `{ version: 1, drafts }` blob;
  - malformed or unknown version treated as empty;
  - `maxEntries` cap with oldest-`updatedAt` eviction;
  - a quota error triggers half eviction and one retry;
  - an empty draft (whitespace text and no skills) means remove;
  - `clear` removes the key;
  - every storage call is guarded, and an `undefined` storage is a no-op store.
- [x] 1.3 Unit tests in `libs/chat-hooks/src/conversation/conversation-draft/tests/conversation-draft-store.spec.ts`. Run every shared case against both factories. Pass the web factory a fake `Storage` built in the test; jsdom's own `sessionStorage` must not be referenced by lib code.

  Cases for both factories:
  - round-trip;
  - `normalizeId` merges route forms;
  - cap eviction;
  - empty-draft removal;
  - `clear`.

  Web-factory-only cases:
  - malformed JSON, or an unknown version, reads as empty;
  - a throwing `getItem` / `setItem` and an `undefined` storage never throw;
  - quota retry.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/conversation/conversation-draft/tests/conversation-draft-store.spec.ts`
- [x] 1.4 Export the four interfaces and both factories from `libs/chat-hooks/src/entry-points/conversation.ts` and `libs/chat-hooks/src/index.ts`.

## 2. Slice 2 — headless hook (`libs/chat-hooks`)

- [x] 2.1 Create `libs/chat-hooks/src/conversation/useConversationComposerDraft/useConversationComposerDraft.ts` per design D3:
  - **State in refs only.** No React state.
  - **Stable handlers.** `handleTextChange`, `handleSkillsChange`, `handleExternalContent`, `sendWithDraft` and `clearDraft`, depending only on `store` and `conversationId`.
  - **Writes.** Debounced at `debounceMs` (default `300`). A pending write is flushed in effect cleanup under the previous id and on `pagehide`, and nothing is written for an untouched id.
  - **Restore.** Once per id, gated by `isRestoreReady`, skipped when `shouldSkipRestore` is true or the user typed first. When there is no stored draft, `restoreDraft` receives an empty draft.
  - **Send.** `sendWithDraft` cancels the pending write, empties the text ref, awaits `send`, removes the entry on success, and on failure restores the ref and rethrows. Skill changes do not re-create the entry after a successful send.
  - **No store.** A `store` of `undefined` turns every handler into a no-op.

  Export the params and result interfaces with JSDoc.
- [x] 2.2 Unit tests in `libs/chat-hooks/src/conversation/useConversationComposerDraft/tests/useConversationComposerDraft.spec.ts`, using `renderHook`, fake timers and `createMemoryConversationDraftStore`. Each scenario in the spec's "Headless composer-draft hook" requirement is a test:
  - remount within the debounce window;
  - id-change isolation;
  - deferred readiness;
  - typed-before-ready;
  - external content wins;
  - send success clears, send failure keeps;
  - emptied input;
  - `pagehide` flush;
  - an undefined store does nothing;
  - handler identity is stable across rerenders.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/conversation/useConversationComposerDraft/tests/useConversationComposerDraft.spec.ts`
- [x] 2.3 Export the hook and its types from `libs/chat-hooks/src/entry-points/conversation.ts` and `libs/chat-hooks/src/index.ts`. Then run `npm exec nx lint chat-hooks` and `npm exec nx build chat-hooks`. The build proves the `./conversation` entry still bundles with only its existing peers.

## 3. Slice 3 — `apps/chat` adapter: text drafts survive switching

- [x] 3.1 Add `ConversationDrafts = 'conversationDrafts'` to the `StorageKey` enum in `apps/chat/src/types/storage-key.ts`.
- [x] 3.2 Create `apps/chat/src/hooks/conversation/useConversationDraftStore.ts`. The JSDoc explains why the app owns storage, key and scope. The hook reads `useUser()` and returns a `useMemo`'d `createWebStorageConversationDraftStore` with:
  - `getStorage: () => window.sessionStorage`;
  - `` storageKey: `${StorageKey.ConversationDrafts}:${sub}` ``;
  - `normalizeId: normalizeConversationId`.

  It returns `undefined` when there is no user. Add unit tests in `apps/chat/src/hooks/conversation/tests/useConversationDraftStore.spec.ts`: the key is user-scoped, the store is undefined without a user, and the instance is stable across rerenders for the same user.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/conversation/tests/useConversationDraftStore.spec.ts`
- [x] 3.3 In `apps/chat/src/components/ConversationView/ConversationView.tsx`:
  - call `useConversationDraftStore()` and `useConversationComposerDraft({ store, conversationId: conversation.id, restoreDraft })`, with `restoreDraft` calling `seedComposerSeed(text)` (text path only in this slice);
  - pass a stable `handleDraftChange` to `ConversationInput.onChange` that calls `onDraftChange` and then `handleTextChange`.
- [x] 3.4 Integration test `apps/chat/src/components/ConversationView/tests/ConversationView.draft.spec.tsx`, using role/label queries and assertions on observable textarea content. Cases:
  - type, rerender with another conversation, rerender back: the text is restored;
  - unmount within the debounce window and remount: the text is restored;
  - two conversations keep separate drafts;
  - with a throwing `sessionStorage`, the composer still works.

  **Verification:**
  - `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.draft.spec.tsx`
  - `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.message-memo.spec.tsx`, to confirm memoisation is intact.

  After the slice: `npm run verify:changed`.

## 4. Slice 4 — clear on send and on empty input (`apps/chat`)

- [x] 4.1 In `ConversationView.tsx`, route `handleSendWithAnchor` through `sendWithDraft(message, () => onSend(message, attachments, selectedSkills))`, keeping `armAnchor` before it and `resetSkillMentions()` after it resolves.
- [x] 4.2 Extend `ConversationView.draft.spec.tsx`:
  - a successful send, then switching away and back: the input is empty;
  - a rejected `onSend`: the draft is kept across a switch;
  - clearing all text, then switching away and back: the input is empty.

  **Verification:**
  - `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.draft.spec.tsx`
  - `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx`, whose existing "keep draft" cases must stay green.

## 5. Slice 5 — skill mentions and overlay precedence (`apps/chat`)

- [x] 5.1 In `ConversationView.tsx`:
  - `restoreDraft` calls `seedSkillMentions(text, skills)` from the main `useSkillSelectorOverlay` instance when the draft has skills and `selectedDeployment?.features?.skillsSupported === true`, and otherwise `seedComposerSeed(text)`;
  - pass `isRestoreReady` as false only while the stored draft (a memoised `store.read` per id) has skills and `selectedDeployment` is unresolved;
  - an effect on `selectedSkills` calls `handleSkillsChange`.
- [x] 5.2 In `ConversationView.tsx`:
  - extend the `useComposerSeedSource(inputContentRevision, …)` callback to call `handleExternalContent(inputContent ?? '')`;
  - pass `shouldSkipRestore` as `inputContentRevision > 0` captured at mount.
- [x] 5.3 Extend `ConversationView.draft.spec.tsx`:
  - a skill-mention draft is restored with the mention active (assert on the rendered mention, or on the skills passed to `onSend`);
  - an unsupported deployment restores the text only;
  - overlay content at mount wins over a stored draft and becomes the stored draft;
  - overlay content, then switching away and back, restores the overlay text.

  **Verification:** `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.draft.spec.tsx`. After the slice: `npm run verify:changed`.

## 6. Slice 6 — eviction on delete, delete-all, logout (`apps/chat`)

- [x] 6.1 In `apps/chat/src/context/ConversationsContext.tsx`:
  - call `useConversationDraftStore()`;
  - in `deleteConversation`, call `store?.remove(id)` after the API delete succeeds;
  - in `deleteAllConversations`, call `store?.clear()` after it succeeds;
  - add `store` to those callbacks' deps, with no other `useMemo` changes.
- [x] 6.2 In `apps/chat/src/components/LogoutConfirmation/LogoutConfirmationModal.tsx`, call `useConversationDraftStore()` and run `store?.clear()` before `logout()`.
- [x] 6.3 Tests:
  - `apps/chat/src/context/tests/ConversationsContext.spec.tsx`: a delete removes the stored draft, a failed delete keeps it, and delete-all removes the user's key;
  - `apps/chat/src/components/LogoutConfirmation/tests/LogoutConfirmationModal.spec.tsx`: confirming logout removes the key.

  **Verification:**
  - `npm run test:file -- apps/chat/src/context/tests/ConversationsContext.spec.tsx`
  - `npm run test:file -- apps/chat/src/components/LogoutConfirmation/tests/LogoutConfirmationModal.spec.tsx`

## 7. Slice 7 — `onChange` on pasted-text expand (`libs/conversation-input`)

- [x] 7.1 In `libs/conversation-input/src/components/Input/Input.tsx`, change `handleExpandPastedText` to compute `next` from the current `message`, call `setMessage(next)`, and then call `onChange?.(next)`. There is no prop or export change.
- [x] 7.2 Test in `libs/conversation-input/src/components/Input/tests/Input.spec.tsx`: with text "intro" and a pasted-text card "details", expanding the card (queried by its `expandLabel` accessible name) calls `onChange` once with `"intro\ndetails"`.

  **Verification:** `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.spec.tsx`

## 8. Slice 8 — reuse documentation

- [x] 8.1 In `libs/chat-hooks/README.md`:
  - add a `### useConversationComposerDraft` section under Hooks, covering purpose, params and returns, both store factories, the `ConversationDraftStore` contract, the sync-cache note for async persistence, and a minimal compiling host example per design D6 that uses only exported names and includes every required param;
  - list the new names under the `./conversation` subpath imports;
  - leave the entry-point-to-peer matrix unchanged, since no new peers are added.
- [x] 8.2 In `docs/reusable-chat-workflows.md`:
  - add a "Conversation drafts" row (`useConversationComposerDraft`, `createWebStorageConversationDraftStore` from `@epam/ai-dial-chat-hooks/conversation`; owning package `chat-hooks`);
  - add a parent-adoption row for `apps/chat/src/components/ConversationView/ConversationView.tsx` listing what the host keeps: `sessionStorage`, the key and `user.sub` scope, `normalizeConversationId`, skill seeding, deployment readiness, overlay precedence, and the eviction call sites in `ConversationsContext` and `LogoutConfirmationModal`;
  - add a client-application adoption-map line.
- [x] 8.3 Run `npm run validate:docs`.

## 9. Close-out

- [x] 9.1 Run `npm run validate:specs`.
- [x] 9.2 Run `npm run verify:full` once.
- [ ] 9.3 Follow-ups, out of scope. Record them in the PR description:
  - migrate the client application to the new hook (it lives in another repository);
  - an `OverlayFeature` toggle to disable drafts;
  - New Chat screen drafts (reuse the hook with a sentinel id);
  - attachment drafts.

## 10. Review fixes

- [x] 10.1 Treat overlay input content as one-shot in `apps/chat/src/pages/Conversation/Conversation.tsx`: `pendingInputContent.isPending` is cleared once `ConversationView` has rendered with it, and the view then gets `inputContentRevision={0}`. In `ConversationView.tsx` the overlay seed source ignores a change back to `0`. Tests: `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx` (spent content is not handed to a remount for another conversation, and content set during a load reaches the mounted view), and `ConversationView.draft.spec.tsx` (a drop back to `0` keeps the composer and the draft).
- [x] 10.2 In `ConversationView.tsx`, gate a skill draft's restore on the deployments loading, not on the deployment resolving, so a conversation whose model is gone gets its text back. Clear `skipRestoreConversationId` during render instead of in an effect.
- [x] 10.3 In `useConversationComposerDraft`, keep a draft edited while `sendWithDraft`'s `send` is in flight, using an edit revision.
- [x] 10.4 In `ConversationsContext.deleteAllConversations`, keep the drafts of the ids in `result.failed`.
- [x] 10.5 Store `read`/`remove` use own-property lookups. `Input.handleExpandPastedText` reads through `draftRef`, so its identity is stable.

  **Verification:** `npm run test:file` on each spec above, `npm run validate:docs`, `npm run validate:specs`.
