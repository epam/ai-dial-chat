Slicing strategy: **vertical, one walk per slice**. Slice 1 adds the shared pool accessor. Each later slice extends one helper to the pool, with its own tests, and can be verified on its own. The QA-reported 403 (import → stale pool) is fully closed once slices 3 and 4 land. Every slice touches only `libs/chat-hooks/src/conversation/conversation-transfer/` and its tests.

## 1. Pool accessor and reference collection (`.dial` export + upload planning)

- [x] 1.1 In `libs/chat-hooks/src/conversation/conversation-transfer/attachment-refs.ts`, add a module-level helper that returns `conversation.customViewState?.['annotations']` only when `Array.isArray` holds, plus an entry guard that accepts only non-null objects (design D2). Export them only within the folder (from the module, not from the package `index.ts`).
- [x] 1.2 Extend `forEachAttachmentReference` so that, after the message loop, it visits `entry.body?.source?.attachment` of every recognised pool entry. Update its JSDoc and `collectAttachmentRefs`'s JSDoc to name the fourth site.
- [x] 1.3 Unit tests in `libs/chat-hooks/src/conversation/conversation-transfer/tests/attachment-refs.spec.ts`:
  - a file referenced only by the pool is collected;
  - a file cited by a message and by the pool (with and without `#page=N`) is collected once;
  - pool references come after all message references;
  - a string pool, a `null` entry, a non-object entry and a source-less entry contribute nothing and do not throw.
- [x] 1.4 Unit test in `libs/chat-hooks/src/conversation/conversation-transfer/tests/import-conversation.spec.ts` (`planAttachmentUploads`): a pool-only file with archive bytes is planned for upload after the message files, and the suffixes of message files are unchanged.

Verification: `npm run test:file -- libs/chat-hooks/src/conversation/conversation-transfer/tests/attachment-refs.spec.ts libs/chat-hooks/src/conversation/conversation-transfer/tests/import-conversation.spec.ts`

## 2. Strip pool sources on without-attachments export and export-all

- [x] 2.1 In `libs/chat-hooks/src/conversation/conversation-transfer/export-conversation.ts`, extend `stripConversationAttachments` to map recognised pool entries through the `stripAnnotationSources` logic. When the pool is an array, rebuild `customViewState` as `{ ...customViewState, annotations }`. Otherwise return the original object. Update the JSDoc.
- [x] 2.2 Unit tests in `libs/chat-hooks/src/conversation/conversation-transfer/tests/export-conversation.spec.ts` (`stripConversationAttachments`):
  - pool entries lose `body.source` but keep quote, title and target;
  - other `customViewState` keys are unchanged;
  - a conversation without `customViewState` keeps it absent;
  - a malformed pool and malformed entries pass through unchanged.

Verification: `npm run test:file -- libs/chat-hooks/src/conversation/conversation-transfer/tests/export-conversation.spec.ts`

## 3. Rewrite pool references on import

- [x] 3.1 In `libs/chat-hooks/src/conversation/conversation-transfer/import-conversation.ts`, extend `rewriteAttachmentUrls` to map recognised pool entries through `rewriteAnnotations`, using the same `customViewState` rebuild rule as 2.1. Update the JSDoc to list the four sites.
- [x] 3.2 Unit tests in `libs/chat-hooks/src/conversation/conversation-transfer/tests/import-conversation.spec.ts` (`rewriteAttachmentUrls`):
  - a pool reference is re-pointed and keeps a safe `#page=N` anchor;
  - a suffixed upload rewrites the pool attachment `title`;
  - a message citation and its pool copy point at the same upload;
  - an unmatched pool entry and other `customViewState` keys are unchanged;
  - a malformed pool does not throw.

Verification: `npm run test:file -- libs/chat-hooks/src/conversation/conversation-transfer/tests/import-conversation.spec.ts`

## 4. Drop foreign pool sources on import and report them

- [x] 4.1 In `libs/chat-hooks/src/conversation/conversation-transfer/import-conversation.ts`, extend `dropForeignAttachmentRefs` to map recognised pool entries through `dropForeignAnnotationSources`, pushing into the same `droppedNames`. Return the original conversation when nothing in messages or pool was dropped. Update the JSDoc.
- [x] 4.2 Unit tests in `libs/chat-hooks/src/conversation/conversation-transfer/tests/import-conversation.spec.ts` (`dropForeignAttachmentRefs`):
  - a foreign pool source is removed and its name reported;
  - pool sources in the user's own bucket and in `public` are kept;
  - a pool-only foreign file is reported;
  - other `customViewState` keys are unchanged;
  - a malformed pool does not throw.
- [x] 4.3 Hook-level test in `libs/chat-hooks/src/conversation/useConversationImport/tests/useConversationImport.spec.ts`. Import a `.json` whose message citation and pool copy both cite another bucket's `cite.txt`, and whose pool also cites `pool-only.txt`. Assert that the saved conversation has no foreign `files/…` reference anywhere (including `customViewState.annotations`) and that the warning names each file exactly once.
- [x] 4.4 Hook-level test in `libs/chat-hooks/src/conversation/useConversationExport/tests/useConversationExport.spec.ts`. Run export-all on a conversation with a pool and assert that the downloaded envelope has no `files/…` reference under `customViewState.annotations`.

Verification: `npm run test:file -- libs/chat-hooks/src/conversation/conversation-transfer/tests/import-conversation.spec.ts libs/chat-hooks/src/conversation/useConversationImport/tests/useConversationImport.spec.ts libs/chat-hooks/src/conversation/useConversationExport/tests/useConversationExport.spec.ts`, then `npm run verify:changed` once for the completed slices 1–4.

## 5. Architecture guard, docs and final verification

- [x] 5.1 Architecture guard. Confirm that the changed files in `libs/chat-hooks` add no `/api` paths, no client construction, no `apps/chat/src/server-api` imports, no app contexts, auth, env, feature flags, routing, telemetry or storage keys. Confirm that `customViewState` under `libs/` appears only in `libs/chat-shared/src/models/chat.ts` and `libs/chat-hooks/src/conversation/conversation-transfer/` (excluding `dist`/`out-tsc`/tests), and not at all in `libs/quotations`.
- [x] 5.2 Docs. `libs/chat-hooks/README.md`'s transfer section already says a `.json` export "omits every attachment reference". Re-read it and change it only if it lists reference sites. No `docs/` page describes the transfer reference sites, so no other doc changes.
- [x] 5.3 Run `npm run validate:specs` against the change's delta specs once synced, and `npm run validate:docs` if 5.2 edited the README.
- [x] 5.4 Close the change with one `npm run verify:full`.

## 6. Follow-ups (out of scope, do not implement here)

- [ ] 6.1 File a GitHub issue: the share flow (`collectConversationResourceUrls` in `apps/chat-api/src/share/utils/share-resource.util.ts`) does not grant access to files referenced only by `customViewState.annotations`, so a recipient gets a 403 on cross-turn citations. Link it from #9003.
- [ ] 6.2 Note on #9003 that `replay.replayUserMessagesStack` and agent `custom_content.state` are deliberately not transformed (opaque fields).
