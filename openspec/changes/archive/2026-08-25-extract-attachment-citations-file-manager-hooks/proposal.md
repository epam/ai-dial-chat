## Why

`apps/chat` still owns three reusable capabilities that the last two extraction
changes (`extract-reusable-chat-hooks`, `extract-conversation-lifecycle-hooks`)
deliberately deferred: attachment-canvas opening (`useOpenAttachmentCanvas`),
citation markdown rendering (`useCitationMarkdownComponents`), and the entire
file-manager hook subsystem (`apps/chat/src/hooks/files/**`, 21 files). Each
capability is domain-generic enough to belong in an existing library
(`@epam/ai-dial-attachment-canvas`, `@epam/ai-dial-quotations`,
`@epam/ai-dial-chat-hooks` respectively) but today is locked inside the app,
so no other DIAL-Core-backed host can reuse the attachment-opening workflow,
the citation-aware markdown renderer, or the file-manager hook set without
copy-pasting ~30 files and their app-context/server-api/i18n coupling. Moving
them now, using the dependency-injection and slicing patterns the two
predecessor changes already established and got right, closes the last major
gap in `apps/chat`'s "hooks belong in a lib unless they are genuinely
app-specific" posture.

## What Changes

- Move `useOpenAttachmentCanvas`'s attachment-opening workflow (image/audio/
  file/pasted/prompt dispatch, MIME/extension-based content routing, custom
  visualizer resolution, unsupported/error fallback) into
  `@epam/ai-dial-attachment-canvas`, published from the package root, driven
  by injected resolvers/callbacks instead of app contexts.
- Move `useCitationMarkdownComponents` (sentinel injection, `react-markdown`
  `p`/`li` overrides, `CitationDropdown` wiring, PDF-citation-preview
  shortcut) into `@epam/ai-dial-quotations`, published from the package
  root, with i18n/annotation-normalization/attachment-preview-conversion
  replaced by injected label bundles and callbacks.
- Move the complete file-manager hook subsystem — `useDialFileManager`,
  `useDialFileManagerTabConfig`, `useDialFileListing`, `useDialFileMetadata`,
  `useDialFileMutations`, `useDialFileSharing`, `useDialFileUploadBatch`,
  `useGridEditingScroll`, plus their models/types/path/mapping/copy-move
  utilities — into `@epam/ai-dial-chat-hooks`, behind an injected
  `FilesApi`-shaped operation port, injected file-manager configuration,
  and library-owned semantic operation events, replacing direct
  `server-api/files.api`, `AppConfigContext`, `react-i18next`, and
  `useOperationNotification` usage.
- **BREAKING** (library-internal only, no `apps/chat` behavior change):
  `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`,
  `apps/chat/src/hooks/citations/useCitationMarkdownComponents.tsx`, and all
  21 files under `apps/chat/src/hooks/files/**` are deleted once every call
  site migrates to the corresponding library import; `useDialFileManagerState`
  and `apps/chat/src/utils/dial-file-to-attachment.ts` stay app-owned as thin
  adapters that convert library output into the app's `Attachment` shape.
- Widen `libs/chat-hooks`'s existing peer-dependency/project-reference set
  only as needed for the file-manager port types (no new peer dependency on
  `ag-grid-community` — `useGridEditingScroll`'s public contract stays
  `{ handleGridApiChange, reset }`; its one raw-AG-Grid-typed internal stays
  behind that contract, consistent with `@epam/ai-dial-react-file-manager`
  already being a `chat-hooks` peer dependency).
- Correct the `dial-file-manager-hook-decomposition` spec's sub-hook
  ownership map to describe the hooks' new home in `@epam/ai-dial-chat-hooks`
  and the injected ports that replace their former direct app-service access.

## Capabilities

### New Capabilities

- `attachment-canvas-workflow`: the attachment-opening/content-routing
  workflow (`useOpenAttachmentCanvas`'s behavior) owned by
  `@epam/ai-dial-attachment-canvas`.
- `quotations-citation-markdown`: citation-aware markdown rendering
  (`useCitationMarkdownComponents`'s behavior) owned by
  `@epam/ai-dial-quotations`.
- `chat-hooks-file-manager-domain`: the file-manager subsystem's
  host-agnostic domain contracts, models, and path/mapping/copy-move
  utilities, plus the injected `FilesApi`-shaped operation port that
  replaces `server-api/files.api`.
- `chat-hooks-file-manager-listing`: folder/file listing, caching, search,
  metadata retrieval, and tab configuration (`useDialFileListing`,
  `useDialFileMetadata`, `useDialFileManagerTabConfig`).
- `chat-hooks-file-manager-mutations`: create/rename/copy/move/delete/
  download and sharing/unshare mutations (`useDialFileMutations`,
  `useDialFileSharing`).
- `chat-hooks-file-manager-upload`: batched file upload and archive-extraction
  upload (`useDialFileUploadBatch`).
- `chat-hooks-file-manager-composition`: the composed `useDialFileManager`
  entry point and the AG-Grid-editing-scroll adapter (`useGridEditingScroll`).

### Modified Capabilities

- `dial-file-manager-hook-decomposition`: the sub-hook ownership map now
  describes hooks living in `@epam/ai-dial-chat-hooks` rather than
  `apps/chat/src/hooks/files/**`, and the equivalence contract is extended to
  cover the new injected `FilesApi` port, file-manager configuration, and
  semantic operation-event surface that replace the hooks' former direct
  `server-api`/`AppConfigContext`/`react-i18next`/`useOperationNotification`
  access.

## Impact

- **Affected libraries**: `libs/attachment-canvas` (new hook + resolver
  contracts), `libs/quotations` (new hook + label/callback contracts),
  `libs/chat-hooks` (new file-manager hook set, new peer-dependency-surface
  usage of `@epam/ai-dial-chat-api-client`'s `FilesApi` operations and
  `@epam/ai-dial-react-file-manager` types it already declares).
- **Affected app code**: every current call site of the three capabilities
  in `apps/chat` (`ConversationSourcesPanel`, `ConversationView`,
  `NewConversationComposer`, `useSkillFilePreviewSync`,
  `ConversationMessageItem`, `DialFileManagerModal`, `DialFileManagerPage`,
  `DialFileManagerShell`) migrates its imports and supplies the
  newly-injected ports/callbacks; app-owned adapters
  (`apps/chat/src/utils/attachment-canvas.ts`, `dial-file.ts`,
  `annotation.ts`, `attachment-dto-to-display.ts`,
  `dial-file-to-attachment.ts`, a thin `FilesApi` wrapper around
  `server-api/files.api`, and a notification/translation adapter over
  `useOperationNotification`) remain and are wired as the injected seams.
- **Deleted app code**: `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`,
  `apps/chat/src/hooks/citations/useCitationMarkdownComponents.tsx`, and 19 of
  the 21 files under `apps/chat/src/hooks/files/**` (all except
  `useDialFileManagerState.ts`, which stays app-owned) plus their superseded
  tests, once migrated call sites and library tests are verified equivalent.
- **No backend/OpenAPI change**: no new endpoint; the file-manager port wraps
  the same generated-client operations `server-api/files.api.ts` already
  wraps.
- **No product/UX change**: this is extraction only — behavior, translated
  strings, and RTL/accessibility characteristics are preserved byte-for-byte.
