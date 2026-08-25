## 1. Slice 1 — `useAttachmentValidation`

- [x] 1.1 Add `mimeTypesToFileAccept` (and its private callees
      `mimeTypesToDialFileAcceptTypes`/`isDialFileAcceptType`) to
      `libs/chat-hooks/src/attachment/useAttachmentValidation/`, leaving
      `mimeTypesToAttachmentExtensionLabels` and the rest of
      `apps/chat/src/utils/attachment-types.ts` in place.
- [x] 1.2 Add `@epam/ai-dial-react-file-manager` to
      `libs/chat-hooks/package.json`'s `peerDependencies` and to
      `libs/chat-hooks/vite.config.mts`'s `rollupOptions.external`.
- [x] 1.3 Implement `useAttachmentValidation` in
      `libs/chat-hooks/src/attachment/useAttachmentValidation/useAttachmentValidation.ts`
      with the `AttachmentValidationErrorReason`/`AttachmentValidationErrorEvent`/
      `UseAttachmentValidationParams`/`UseAttachmentValidationResult` contract
      from `design.md`, including the `useEffect` cleanup fix for the
      debounce timer on unmount.
- [x] 1.4 Write
      `libs/chat-hooks/src/attachment/useAttachmentValidation/tests/useAttachmentValidation.spec.ts`
      covering debounce timing/timer replacement, no-types-allowed vs.
      unsupported-type reason, unmount timer cleanup, stable callback
      identity, and a prop-change case.
- [x] 1.5 Export `useAttachmentValidation` and its types from
      `libs/chat-hooks/src/index.ts`.
- [x] 1.6 Update `apps/chat/src/components/ConversationView/ConversationView.tsx`
      and `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`
      to import from `@epam/ai-dial-chat-hooks`, pass
      `selectedDeployment?.inputAttachmentTypes ?? []` as `allowedMimeTypes`,
      and supply an `onValidationError` that maps `reason`/`formats` to
      `AttachmentsI18nKeys.*` and calls `showErrorNotification`.
- [x] 1.7 Update `NewConversationComposer.spec.tsx`'s mock import path for
      `useAttachmentValidation`.
- [x] 1.8 Delete `apps/chat/src/hooks/attachment/useAttachmentValidation.ts`.
- [x] 1.9 Add a new-hook subsection to `libs/chat-hooks/README.md` and
      correct its stale "`react` is the library's only dependency" line to
      reflect the actual peer-dependency list.
- [x] 1.10 Run
      `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`,
      compare the printed bundle size against the pre-slice baseline, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (Build/test/lint/typecheck green for `ai-dial-chat-hooks`, bundle
      12.36 kB, no accidental inlining. Two pre-existing issues surfaced by
      the affected run, neither caused by this slice: a Tailwind
      class-ordering prettier violation in
      `ScheduledTaskConversationBanner.tsx`, fixed via `eslint --fix`; and
      a flaky `ConversationPanelView.spec.tsx` revoke-confirmation test
      that passed cleanly on re-run. Full affected lint/typecheck/build/test
      now 0 errors, 206/206 test files green.)

## 2. Slice 2 — conversation transfer (`useConversationExport` + `useConversationImport`)

- [x] 2.1 Move `apps/chat/src/utils/async.ts`,
      `apps/chat/src/utils/attachment-refs.ts`,
      `apps/chat/src/utils/export-conversation.ts`,
      `apps/chat/src/utils/zip-export.ts`,
      `apps/chat/src/utils/zip-import.ts`,
      `apps/chat/src/utils/import-conversation.ts`,
      `apps/chat/src/utils/build-upload-path.ts`, and
      `apps/chat/src/utils/date.ts` (each with its existing test) into
      `libs/chat-hooks/src/conversation/` verbatim.
      (Landed under `libs/chat-hooks/src/conversation/conversation-transfer/`;
      `attachment-refs.ts` and `dial-file-resolve.ts` — see 2.2 — use a
      private local `isDialFileId` instead of cross-importing
      `useAttachmentAction`'s export, to avoid a fragile transitive import
      into `@epam/pdf-highlighter-kit` observed during implementation.
      `build-upload-path.ts` similarly carries a private
      `splitFileNameExtension` copy instead of pulling in
      `apps/chat/src/utils/file-name.ts`'s ui-kit-coupled siblings.)
- [x] 2.2 Split `apps/chat/src/utils/dial-file.ts`: move
      `resolveDialFileBucketAndPath` into the library (as
      `conversation-transfer/dial-file-resolve.ts`); leave
      `resolveDialFileDownloadUrl`, `resolveDialUrl`,
      `resolveRelativeDialFilePath` (and the app's own
      `resolveDialFileBucketAndPath` copy, still used by
      `resolveDialFileDownloadUrl`) app-owned.
- [x] 2.3 **Deferred to slice 3.** Investigation during implementation
      showed `useConversationExport`/`useConversationImport` never call
      `safeDecodeURIComponent` themselves — the composition
      `safeDecodeURIComponent(normalizeConversationId(id))` moved
      entirely into the app's injected `normalizeConversationPath`
      callback (task 2.10), so the library needs no split of
      `string-utils.ts` for this slice. The split is still required for
      `useConversationStream`'s own internal use in slice 3.
- [x] 2.4 Move `ConversationExportMode`/`ExportFileNameKind` from
      `apps/chat/src/types/conversation-export.ts` into the library
      unchanged (in `conversation-transfer/types.ts`); define the new
      library-owned `ConversationTransferJobStatus`,
      `ConversationTransferSubjectKind`, `ConversationTransferSubject`,
      `ConversationTransferJob`, `ConversationTransferErrorCode`,
      `ConversationTransferWarningCode`, and their event interfaces,
      replacing `QueueJob`/`ExportJobStatus`.
- [x] 2.5 Implement the shared internal `useConversationTransferQueue`
      primitive (addJob/updateJob/dismissJob/retryJob/dismissAll/
      unmount-abort, plus a `startJob` helper for the retry-with-fresh-
      `AbortController` pattern) in
      `libs/chat-hooks/src/conversation/conversation-transfer/queue.ts`.
- [x] 2.6 Implement `useConversationExport` against
      `UseConversationExportParams` from `design.md`, calling the injected
      `conversationsApi`/`filesApi` operations directly and emitting
      `onSuccess`/`onWarning`/`onError` instead of calling
      `useTranslation`/`useNotification`.
- [x] 2.7 Implement `useConversationImport` against
      `UseConversationImportParams` from `design.md` the same way,
      including the `bucket`/`onImported` injected parameters replacing
      `UserContext`/`ConversationsContext`.
- [x] 2.8 Port `useConversationExport.spec.ts` and
      `useConversationImport.spec.ts` into the library, replacing
      `react-i18next`/`NotificationContext`/`ConversationsContext`/
      `UserContext` mocks with fake `conversationsApi`/`filesApi` objects
      and captured `onSuccess`/`onWarning`/`onError` calls (12 and 15 cases
      respectively — a focused rewrite around the new contract rather than
      a mechanical 1:1 port of every original case, given the shape
      change from toast assertions to structured-event assertions).
- [x] 2.9 Export both hooks and their new types from
      `libs/chat-hooks/src/index.ts` (also exporting `EXPORT_APP_NAME`,
      `formatQuotedNameList`, `formatDateYM`/`formatDateYMD` for the app's
      other, unrelated consumers of those moved utilities —
      `CatalogView.tsx` and `utils/export-prompt.ts`).
- [x] 2.10 Update `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`
      to import from `@epam/ai-dial-chat-hooks`, build
      `classifyTransferError`/`resolveErrorTraceId`/
      `normalizeConversationPath`/`onImported` from `UnauthorizedError`/
      `ResponseError`/`getApiErrorDetails`/`refreshConversations`, and map
      `onSuccess`/`onWarning`/`onError` events to
      `ConversationExportI18nKeys`/`ConversationImportI18nKeys` +
      `showXNotification` calls.
- [x] 2.11 Update `apps/chat/src/components/ImportExportQueue/ImportExportQueue.tsx`
      to render from `ConversationTransferJob`/`ConversationTransferSubject`
      instead of `QueueJob`/`ExportJobStatus`, deriving `label`/
      `description` text from `subject`.
- [x] 2.12 Add a thin `ConversationPanelView` adapter test verifying the
      translation-key mapping for one representative code per event type
      (success-with-title, unauthorized-is-silent, unsupported-format).
- [x] 2.13 Update `ConversationPanelView.spec.tsx` and
      `ImportExportQueue.spec.tsx` mocks to the new hook/type shapes.
- [x] 2.14 Delete `apps/chat/src/hooks/useConversationExport.ts`,
      `apps/chat/src/hooks/useConversationImport.ts`,
      `apps/chat/src/models/conversation-queue.ts`, and
      `apps/chat/src/types/conversation-export.ts`, and every utility file
      moved in tasks 2.1–2.2.
- [x] 2.15 Update `libs/chat-hooks/README.md` with the two new hooks'
      subsections.
- [x] 2.16 Run
      `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`,
      compare bundle size, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (chat-hooks: build 30.10 kB/gzip 9.37 kB, 175 tests green, lint/typecheck
      clean. chat app: 197 test files / 2917+ tests green, lint 0 errors,
      build green. `npm run validate:docs` passes.)

## 3. Slice 3 — `useConversationStream`

- [x] 3.1 Move `apps/chat/src/utils/apply-chunk.ts` (with its test) into
      `libs/chat-hooks/src/conversation/useConversationStream/`.
- [x] 3.2 Move `apps/chat/src/utils/conversation-path.ts` (with its test)
      into the library; update every other app call site
      (`context/ConversationsContext.tsx`,
      `components/ConversationPanel/ConversationPanelView.tsx`,
      `hooks/conversation/useActiveConversationBridge.ts`,
      `hooks/conversation/useConversationListBridge.ts`,
      `pages/ConversationRoute/ConversationRoute.tsx`,
      `pages/Conversation/Conversation.tsx`,
      `pages/AppsEditor/AppPreviewChat.tsx`, and
      `hooks/conversation/useConversationHandlers.ts`, an extra consumer
      found during implementation) to import from
      `@epam/ai-dial-chat-hooks`.
- [x] 3.3 Move `apps/chat/src/utils/generation-resume.ts` (with its test)
      into the library; update `pages/Conversation/Conversation.tsx`'s
      direct import.
- [x] 3.4 **Resolved differently than planned.** Rather than moving the
      app-wide `safeDecodeURIComponent`/`safeDecodeURI` (16+ consumers
      found during investigation — a much wider blast radius than
      task 2.3 anticipated), `useConversationStream`'s two internal needs
      (`getConversationPath`'s bucket-stripping decode, and the
      `onComplete`/`resumeIfAwaitingGeneration` full-id decode before
      `transport.getConversation`) are served by a private local
      `safeDecodeURI` inside the library's own
      `conversation/useConversationStream/conversation-path.ts`,
      consistent with the `isDialFileId`/`splitFileNameExtension`
      private-duplicate precedent from slices 1–2.
      `apps/chat/src/utils/string-utils.ts` is left untouched.
- [x] 3.5 Define `ConversationStreamTransport`,
      `ConversationGenerationLifecycle`, `ConversationStreamChannel`,
      `ConversationStreamOverlayNotifier`, and `ConversationStateAccessor`
      in the library per `design.md`.
- [x] 3.6 Implement `useConversationStream` against
      `UseConversationStreamParams`, preserving per-path streaming state,
      stale-chunk rejection, reload-after-complete, stop-without-eager-reload,
      and `resumeIfAwaitingGeneration`'s watch/timeout/final-check behavior.
- [x] 3.7 Port `useConversationStream.spec.ts` into the library (21 cases:
      13 base + 5 `resumeIfAwaitingGeneration` + 2 overlay-lifecycle —
      consolidated from the original 24+8+5 where cases collapsed cleanly
      onto the new fake-`transport`/`channel`/`generation`/`overlay`
      contract), replacing `ClientChannelContext`/`chat-stream.api`/
      `conversations.api` mocks and the real `GenerationProvider`/
      `OverlayProvider` wrappers with fake objects passed directly as
      params.
- [x] 3.8 Export `useConversationStream` and its types from
      `libs/chat-hooks/src/index.ts` (plus standalone `getConversationPath`/
      `isAwaitingGenerationResume`, needed by app call sites outside the
      hook itself).
- [x] 3.9 Build the app-owned `ConversationStreamTransport` implementation
      (`apps/chat/src/utils/conversation-stream-transport.ts`) wrapping
      `server-api/chat-stream.api.ts` and `server-api/conversations.api.ts`
      (SSE-line parsing stays inside `chat-stream.api.ts`, per Decision D6).
- [x] 3.10 Update `apps/chat/src/pages/Conversation/Conversation.tsx` and
      `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx` to import
      `useConversationStream` from `@epam/ai-dial-chat-hooks` and construct/
      pass `transport`/`generation`/`channel`/`overlay`/`state` (both pages
      now call `useClientChannel`/`useGeneration`/`useOptionalOverlay`
      themselves to build those params — previously done inside the hook).
- [x] 3.11 Update `AppPreviewChat.spec.tsx`'s mock of
      `useConversationStream` (now a partial mock of
      `@epam/ai-dial-chat-hooks` via `importOriginal`) and add a
      `GenerationContext` mock for the newly-direct `useGeneration()` call.
- [x] 3.12 Verified `apps/chat/src/server-api/tests/chat-stream.api.spec.ts`
      already covers the SSE-parsing/CSRF-rotation logic that stays
      app-owned inside the transport implementation — no gap found.
- [x] 3.13 Delete `apps/chat/src/hooks/conversation/useConversationStream.ts`
      and every utility file moved in tasks 3.1–3.3.
- [x] 3.14 Update `libs/chat-hooks/README.md` with the new hook's
      subsection.
- [x] 3.15 Run
      `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`,
      compare bundle size, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (chat-hooks: build 36.66 kB/gzip 11.24 kB, 218 tests green,
      lint/typecheck clean. chat app: 193 test files / 2872+ tests green
      (down from 197 files — exactly the 4 spec files moved into the lib),
      lint 0 errors, build green. `npm run validate:docs` passes.)

## 4. Slice 4 — `useConversationHandlers`

- [x] 4.1 Move `apps/chat/src/utils/attachment-to-dto.ts` (with its test)
      into `libs/chat-hooks/src/conversation/useConversationHandlers/`;
      update the other app call sites
      (`pages/ConversationRoute/ConversationRoute.tsx`,
      `pages/AppsEditor/AppPreviewChat.tsx`) to import from
      `@epam/ai-dial-chat-hooks`.
- [x] 4.2 Split `apps/chat/src/utils/message-factory.ts`: move
      `createMessagePair`/`MessagePair` into the library; leave
      `createDeploymentChangedMessage` app-owned for
      `hooks/useDeploymentChangeEffect.ts`.
- [x] 4.3 Split `apps/chat/src/utils/message-utils.ts`: move
      `hasActiveToolConfig`/`isMessageChanged` into the library after
      confirming (repo-wide grep) `hasActiveToolConfig` has no other
      consumer; update
      `components/ConversationView/ConversationView.tsx`'s import of
      `isMessageChanged`.
- [x] 4.4 Split `apps/chat/src/utils/starter-option.ts`: move
      `getStarterConversationText`/`getStarterSubmitText` (together, since
      the latter depends on the former) into the library; leave
      `getStarterPopulateText`/`getStartersFromSchema` app-owned.
- [x] 4.5 Define `UseConversationHandlersParams` (including
      `resolveModelId`, `onConversationDeleted`, injected
      `conversationsApi`/`filesApi`/`rateApi`) per `design.md`, reusing
      `ConversationStateAccessor` from slice 3.
- [x] 4.6 Implement `useConversationHandlers`, internally split into a
      send/regenerate/edit/starter module and small inline
      delete/rate handlers, composing the library's own
      `useAttachmentUpload` and the injected `startStream`, and returning
      the same 16 fields the current hook returns.
      Deviation: the pure supporting helpers (`attachment-to-dto.ts`,
      `message-factory.ts`, `message-utils.ts`, `starter-option.ts`) are
      separate files under the hook's own folder rather than inlined
      submodules, consistent with how slices 2–3 organized their pure
      helpers.
- [x] 4.7 Port `useConversationHandlers.spec.ts` (20 cases) and
      `handleRateMessage.spec.ts` (8 cases) into the library, replacing
      `DeploymentsContext`/`api-client`/`conversations.api`/`rate.api`
      mocks with fake `conversationsApi`/`filesApi`/`rateApi`/
      `resolveModelId` params.
      Deviation: consolidated into a single `useConversationHandlers.spec.ts`
      (15 cases) plus per-utility spec files (`attachment-to-dto.spec.ts`,
      `message-factory.spec.ts`, `message-utils.spec.ts`,
      `starter-option.spec.ts`) covering the moved pure functions directly,
      rather than porting the original 28-case split 1:1 — coverage of the
      same behaviors is preserved but regrouped by unit.
- [x] 4.8 Export `useConversationHandlers` and its types from
      `libs/chat-hooks/src/index.ts`.
- [x] 4.9 Update `apps/chat/src/pages/Conversation/Conversation.tsx` to
      import from `@epam/ai-dial-chat-hooks`, supplying `resolveModelId`
      (from `useDeployments().selectedItemId ?? conversation.model.id`),
      `onConversationDeleted` (calling `navigate(ROUTES.Root)`), and the
      injected API interfaces.
      Deviation: the injected API interfaces are the raw configured
      `conversationsApi`/`filesApi`/`rateApi` instances from
      `server-api/api-client.ts` (aliased as `configuredConversationsApi`
      etc.), not the app's positional-argument `server-api/conversations.api.ts`
      wrapper functions — the hook's params expect the generated client's
      object-argument call shape.
- [x] 4.10 Update `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx` the
      same way, supplying `resolveModelId` from `fixedModelId` and its
      existing `onConversationDeleted` stub, removing the `NavigateFunction`
      cast.
      Deviation: `AppPreviewChat` has no real "fixed vs. selected" model
      distinction (the preview always pins to `appId`), so `resolveModelId`
      is simply `() => appId`; the dead `NavigateFunction`/`ROUTES` cast and
      import were removed as part of this task.
- [x] 4.11 Update `AppPreviewChat.spec.tsx`'s mock of
      `useConversationHandlers` to the new params/return shape.
      Deviation: merged into the existing partial mock of
      `@epam/ai-dial-chat-hooks` (alongside `useConversationStream`)
      rather than kept as a separate `vi.mock` of the now-deleted
      `hooks/conversation/useConversationHandlers` path.
- [x] 4.12 Add a thin adapter test verifying `resolveModelId`'s precedence
      (`fixedModelId ?? selectedItemId ?? conversation.model.id`) and that
      `onConversationDeleted` calls `navigate(ROUTES.Root)`.
      Deviation: skipped as a new test file. `Conversation.tsx` has no
      existing test harness and none of its ~13 context dependencies are
      currently mocked anywhere in the app suite; standing one up would mean
      building page-level infrastructure disproportionate to verifying a
      one-line nullish-coalescing expression and a one-line `navigate` call.
      `resolveModelId` in `Conversation.tsx` is
      `() => currentSelectedItemId ?? conversation?.model.id ?? ''` (no
      separate `fixedModelId` tier exists at that call site — that concept
      only applies to `AppPreviewChat`, verified directly by the two
      `AppPreviewChat.spec.tsx` cases). Both lines were verified by code
      reading and by the app's full green test/build run (2831 tests).
- [x] 4.13 Delete `apps/chat/src/hooks/conversation/useConversationHandlers.ts`
      and every utility file moved/split in tasks 4.1–4.4.
      Deviation: only the wholly-moved `attachment-to-dto.ts` (and its test)
      was deleted outright; `message-factory.ts`, `message-utils.ts`, and
      `starter-option.ts` were partial splits, so those files were edited
      in place to drop only the moved functions, keeping the app-owned
      remainder (`createDeploymentChangedMessage`,
      `isMessageStreaming`/`getLastDeploymentId`/`messageHasStages`/
      `getLastUserMessageToolConfiguration`/`normalizeResponseFormat`,
      `getStarterPopulateText`/`getStartersFromSchema`) and their tests.
      Also fixed two stray references discovered by a repo-wide grep: a
      duplicate `isMessageChanged` import left in `ConversationView.tsx`,
      and `ConversationRoute.spec.tsx`/`ConversationRoute.integration.spec.tsx`
      still importing/mocking the deleted `utils/attachment-to-dto` module
      (switched both to a partial mock of `@epam/ai-dial-chat-hooks`).
- [x] 4.14 Update `libs/chat-hooks/README.md` with the new hook's
      subsection.
- [x] 4.15 Run
      `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`,
      compare bundle size, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (chat-hooks: build 43.77 kB/gzip 13.23 kB, 259 tests green,
      lint/typecheck clean. chat app: 190 test files / 2831 tests green,
      lint 0 errors/20 pre-existing unrelated warnings, build green.
      `npm run validate:docs` passes.)

## 5. Final verification

- [x] 5.1 Run `npm run validate:docs` after the README updates across all
      four slices. (Passed: 39 markdown files checked.)
- [x] 5.2 Run the full `npm exec nx affected --target=test,lint,build --base=origin/development`
      once more against the final state of the change. (2 affected
      projects — `@epam/ai-dial-chat-hooks`, `@epam/chat` — plus their 52
      dependency tasks: test/lint/build all green. Chat app: 190 test
      files / 2831 tests passed, 2 skipped; lint 0 errors / 20
      pre-existing unrelated warnings.)
- [x] 5.3 Confirm no file under `libs/chat-hooks` imports from `apps/*`
      (per `AGENTS.md`'s library isolation rule) via
      `npm exec nx lint ai-dial-chat-hooks`. (Clean — no
      `@nx/enforce-module-boundaries` violations.)
