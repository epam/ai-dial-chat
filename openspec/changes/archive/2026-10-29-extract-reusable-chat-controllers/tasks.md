# Implementation tasks

## 1. Browser downloads (P1)

- [x] 1.1 Add/port behavioral tests in `libs/chat-hooks/src/files/tests/browser-download.spec.ts` and preserve/add host tests in `apps/chat/src/utils/tests/file-download.spec.ts`: UTF-8 filename priority, malformed escapes, path separators, fallback, cancelled destination, writable abort and stream failure.

- [x] 1.2 Implement `libs/chat-hooks/src/files/browser-download.ts` and adopt it through `apps/chat/src/utils/file-download.ts`. Extract triggerBrowserDownload; preserve the app export as a delegate; add root and utils entry exports. Preserve library isolation and add JSDoc for public contracts.

## 2. Scheduled-run grouping (P1)

- [x] 2.1 Add/port behavioral tests in `libs/chat-hooks/src/conversation/tests/scheduled-task-grouping.spec.ts` and preserve/add host tests in `apps/chat/src/utils/tests/collapse-scheduled-task-conversations.spec.ts`: resource-prefixed and bucket-first IDs, distinct owners, pinned/shared/published policy injection, timestamp ties, active old run, stable array references and input immutability.

- [x] 2.2 Implement `libs/chat-hooks/src/conversation/scheduled-task-grouping.ts` and adopt it through `apps/chat/src/utils/collapse-scheduled-task-conversations.ts`. Extract the one-shot/two-phase algorithms with injected group key, eligibility and equality; retain the existing app signatures and provider full list. Export from root and conversation. Preserve library isolation and add JSDoc for public contracts.

## 3. Conversation discovery (P1)

- [x] 3.1 Add/port behavioral tests in `libs/chat-hooks/src/conversation/useConversationDiscovery/tests/useConversationDiscovery.spec.ts` and preserve/add host tests in `apps/chat/src/hooks/conversation/tests/useConversationDiscovery.spec.ts`: bounded five-retry policy, two-second settled delay, duplicate IDs, shared timer, no overlapping retries, refresh rejection, identity change and unmount.

- [x] 3.2 Implement `libs/chat-hooks/src/conversation/useConversationDiscovery/useConversationDiscovery.ts` and adopt it through `apps/chat/src/hooks/conversation/useConversationDiscovery.ts`. Move timer/session state behind injected refresh, normalizeId, sessionKey and error handling; keep the provider adapter. Export from root and conversation. Preserve library isolation and add JSDoc for public contracts.

## 4. Scheduled skill display names (P1)

- [x] 4.1 Add/port behavioral tests in `libs/chat-hooks/src/scheduled-task/useScheduledTaskSkillDisplayNames/tests/useScheduledTaskSkillDisplayNames.spec.ts` and preserve/add host tests in `apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskSkillDisplayNames.spec.tsx`: mixed metadata availability, listed-name precedence, URL fallback, order, selection changes, abort, stale completion and unmount.

- [x] 4.2 Implement `libs/chat-hooks/src/scheduled-task/useScheduledTaskSkillDisplayNames/useScheduledTaskSkillDisplayNames.ts` and adopt it through `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames.ts`. Inject listed metadata and getMetadata with AbortSignal; keep contexts/API setup in the app. Export from root and scheduled-tasks. Preserve library isolation and add JSDoc for public contracts.

## 5. Skill file-system picker (P2)

- [x] 5.1 Add/port behavioral tests in `libs/chat-hooks/src/skill-editor/useSkillFileSystemPicker/tests/useSkillFileSystemPicker.spec.ts` and preserve/add host tests in `apps/chat/src/hooks/skills/tests/useSkillFileSystemPicker.spec.ts`: file/folder selection, ordered results, download failure, cancel, close, unmount and old downloads completing after a new pick.

- [x] 5.2 Implement `libs/chat-hooks/src/skill-editor/useSkillFileSystemPicker/useSkillFileSystemPicker.ts` and adopt it through `apps/chat/src/hooks/skills/useSkillFileSystemPicker.ts`. Extract promise/open-state lifecycle using materializeFile and onError callbacks; retain path resolution, root-label translation, File construction and network setup in the host callback. Export from root and skill-editor. Preserve library isolation and add JSDoc for public contracts.

## 6. Attachment-result state (P2)

- [x] 6.1 Add/port behavioral tests in `libs/chat-hooks/src/files/useFileAttachmentModalState/tests/useFileAttachmentModalState.spec.ts` and preserve/add host tests in `apps/chat/src/hooks/files/tests/useDialFileManagerState.spec.ts`: mapped files and folders, preview URL resolver, close-after-attach, explicit clear, consume and reopen.

- [x] 6.2 Implement `libs/chat-hooks/src/files/useFileAttachmentModalState/useFileAttachmentModalState.ts` and adopt it through `apps/chat/src/hooks/files/useDialFileManagerState.ts`. Add a small result-state controller separate from useFileAttachmentPicker; keep bucket/icon resolver integration in the existing wrapper. Export from root and file-manager. Preserve library isolation and add JSDoc for public contracts.

## 7. Canvas coordination and preview (P2)

- [x] 7.1 Add/port behavioral tests in `libs/chat-hooks/src/files/useDialFilePreview/tests/useDialFilePreview.spec.ts` and preserve/add host tests in `apps/chat/src/hooks/files/tests/useDialFilePreview.spec.ts`: tree and search results, folders, missing paths, unsupported fallback, stable callbacks after listing refresh, cross-source request ordering, unmount and independent canvas providers.

- [x] 7.2 Implement `libs/chat-hooks/src/files/useDialFilePreview/useDialFilePreview.ts` and adopt it through `apps/chat/src/hooks/files/useDialFilePreview.ts`. Add provider-scoped useLatestCanvasRequest to libs/attachment-canvas/src/context/AttachmentCanvasContext.tsx and export it from that package; adapt apps/chat/src/hooks/attachment/useLatestCanvasRequest.ts. Extract preview using injected canvas callbacks/extension policy; never call feature hooks inside chat-hooks. Export preview from root and file-manager-canvas. Preserve library isolation and add JSDoc for public contracts.

## 8. Entity preselection (P2)

- [x] 8.1 Add/port behavioral tests in `libs/chat-hooks/src/conversation/useEntityPreselection/tests/useEntityPreselection.spec.ts` and preserve/add host tests in `apps/chat/src/hooks/useUrlEntityPreselection/tests/useUrlEntityPreselection.combination.spec.tsx`: router-state precedence, delayed listings, unknown IDs, failed loading, apply-once guards including StrictMode effect replay, prompt parameters, disabled mode, deployment override and stale resolution.

- [x] 8.2 Implement `libs/chat-hooks/src/conversation/useEntityPreselection/useEntityPreselection.ts` and adopt it through `apps/chat/src/hooks/useUrlEntityPreselection/useUrlEntityPreselection.ts`. Extract state transitions with parsed snapshot, typed outcomes and injected sinks; keep URL reading/cleanup, routing, contexts, flags and notification text in the adapter. Export from root and conversation. Preserve library isolation and add JSDoc for public contracts.

## 9. Canvas width policy (P3)

- [x] 9.1 Add/port behavioral tests in `libs/chat-hooks/src/viewport-layout/tests/canvas-width.spec.ts` and preserve/add host tests in `apps/chat/src/utils/tests/canvas-width.spec.ts`: mobile width, bounded share rounding, min/max clamp, conversation formula and narrow available area.

- [x] 9.2 Implement `libs/chat-hooks/src/viewport-layout/canvas-width.ts` and adopt it through `apps/chat/src/utils/canvas-width.ts`. Extract the pure formula with exported mode enum and injected numeric policy. Keep getNavigationSidebarWidth, route selection and layout constants in the app. Export from root and viewport-layout. Preserve library isolation and add JSDoc for public contracts.

## 10. Persisted state (P3)

- [x] 10.1 Add/port behavioral tests in `libs/chat-hooks/src/shared/usePersistedState/tests/usePersistedState.spec.ts` and preserve/add host tests in `apps/chat/src/hooks/tests/useLocalStorage.spec.ts`: read/parse failures, in-memory updates on write failure, unchanged mount initialization across key/codec changes and explicit remount reading the new key.

- [x] 10.2 Implement `libs/chat-hooks/src/shared/usePersistedState/usePersistedState.ts` and adopt it through `apps/chat/src/hooks/useLocalStorage.ts`. Extract a generic storage-port hook with key/codec inputs; keep localStorage access, namespace and JSON choice in the app wrapper, preserving its default export. Export from root and utils. Preserve library isolation and add JSDoc for public contracts.

## 11. Artifact consumption and boundary verification

- [x] 11.1 Extend `libs/chat-hooks/e2e-fixtures/fixtures.mjs` and `tools/reusable-workflows-consumer-fixture` to import the new documented subpaths and public types from packed artifacts, including the canvas guard. Preserve real typecheck and production bundle execution outside workspace aliases and feature-engine loading boundaries; update package entry/build declarations in `libs/chat-hooks/package.json` and `libs/attachment-canvas/package.json` only as required.

- [x] 11.2 Verify imports against `tools/module-boundaries.spec.mjs`, dependency metadata and public export resolution; remove duplicate app implementations while retaining required compatibility wrappers.

## 12. Documentation and final verification

- [x] 12.1 Document public exports, host adapters, lifecycle contracts, package requirements and existing related APIs in the library READMEs, architecture overview and reusable-workflow guide.

- [x] 12.2 Complete behavioral tests, packed-consumer checks, module-boundary tests, build, documentation/spec validation and full workspace verification.
