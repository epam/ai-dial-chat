## Context

This is the third extraction change against `apps/chat`'s hooks, following
`extract-reusable-chat-hooks` (Decision D6: widened `libs/chat-hooks`'s
allowed peer-dependency set to `@epam/ai-dial-chat-api-client` types/
operations plus `@epam/ai-dial-chat-shared`, `@epam/ai-dial-share`,
`@epam/ai-dial-quotations`, `@epam/ai-dial-source-panel`,
`@epam/ai-dial-attachment-canvas`) and `extract-conversation-lifecycle-hooks`
(the configured-operation-`Pick<>` port, the transport-interface pattern, and
the structured-event-instead-of-translated-text pattern). Both predecessor
changes explicitly deferred the three capabilities this change targets:
`useOpenAttachmentCanvas` and `useCitationMarkdownComponents` were flagged as
"generalize, but not in this change" (they route through app contexts and
i18n respectively); the file-manager subsystem was flagged in the first
predecessor's audit matrix as "split into headless core + app adapter, next
change" specifically because of its `AppConfigContext`/i18n/notification/
AG-Grid coupling.

Unlike the predecessor changes, two of the three target capabilities land in
different, already-published libraries (`@epam/ai-dial-attachment-canvas`,
`@epam/ai-dial-quotations`) rather than `libs/chat-hooks`, and one target
(`useGridEditingScroll`) requires this change to widen `libs/chat-hooks`'s
allowed-dependency surface for the first time to a raw third-party UI library
(`ag-grid-community`) rather than another published DIAL package — a new kind
of exception not covered by the existing AGENTS.md wording.

This design was produced from a full read of: `openspec/config.yaml`; both
predecessor changes' archived proposal/design/tasks/specs; the current public
API, README, `package.json`, `vite.config.mts`, and tests of
`@epam/ai-dial-attachment-canvas`, `@epam/ai-dial-quotations`, and
`@epam/ai-dial-chat-hooks`; every source, test, mock, and call site of
`useOpenAttachmentCanvas` and `useCitationMarkdownComponents`; and all 21
files under `apps/chat/src/hooks/files/**` plus their tests, models, and
mapping/path/copy-move utilities.

## Goals / Non-Goals

**Goals:**

- Publish `useOpenAttachmentCanvas`'s attachment-opening/content-routing
  workflow from `@epam/ai-dial-attachment-canvas`, replacing its three
  context reads (`ConversationPanelContext`, `SourcesSidebarContext`,
  `ThemeContext`) and ten app-owned resolver imports with injected
  parameters, while the library owns the actual branching logic (type/MIME/
  extension dispatch, MIME-vs-extension asymmetric fallback, reference-PDF
  pre-emption, visualizer short-circuit, HTML srcdoc-vs-url-iframe decision)
  so callers never reimplement it.
- Publish `useCitationMarkdownComponents` from `@epam/ai-dial-quotations`,
  replacing its `react-i18next` and app-owned annotation/attachment-DTO
  imports with an injected label-builder and two action callbacks, and move
  the PDF-citation-preview/attachment-preview-conversion branching that
  today bypasses `useOpenAttachmentCanvas`'s panel-coordination to the
  application edge — explicitly not adding a `quotations` → `attachment-
  canvas` dependency.
- Move the complete file-manager hook subsystem into `@epam/ai-dial-chat-
  hooks` behind: one injected `DialFilesApi` operation port (replacing
  `server-api/files.api` across all 5 data-flow hooks), one injected
  `DialFileManagerConfig`-shaped value (replacing `AppConfigContext` in
  `useDialFileManagerTabConfig`), library-owned validation/notification
  result enums (replacing `react-i18next`/`DialFileManagerI18nKeys` and
  `useOperationNotification` across all 6 hooks that call either today), and
  a documented, narrowly-scoped exception for `useGridEditingScroll`'s raw
  `ag-grid-community` types.
- Preserve every invariant found in the existing test suites (280+ `it`s
  across the three capabilities) byte-for-byte — this is extraction, not a
  behavior or UX change.
- Resolve the file-manager third-party dependency boundary explicitly
  (Decision D9) rather than silently expanding `libs/chat-hooks`'s isolation
  exception list.
- Keep `dial-file-manager-hook-decomposition`'s sub-hook ownership map and
  equivalence contract accurate after the move (Modified Capability).

**Non-Goals:**

- Any product/UX/translation/RTL change — every scenario in §Audit Matrix
  keeps its exact current behavior.
- Extracting `useDialFileManagerState`, `apps/chat/src/utils/dial-file-to-
  attachment.ts`, `apps/chat/src/utils/file-download.ts`'s "Save As" browser
  semantics, or `apps/chat/src/types/entity-notification.ts` — all four stay
  app-owned (§Host-Owned Dependency Matrix rows 4, 6, 9, 10).
- Any backend/OpenAPI change — `DialFilesApi` wraps exactly the operations
  `server-api/files.api.ts` already wraps; no new generated-client surface.
- Rewriting the four other file-manager `it`-level product specs that
  reference `apps/chat/src/hooks/files/**` paths in prose
  (`file-manager-tab-config`, `file-manager-grid-editing-scroll`,
  `file-manager-sharing`, `file-manager-copy-move`, and eight others) — their
  SHALL-level behavior is unchanged by this move; only
  `dial-file-manager-hook-decomposition` describes the hooks' internal
  ownership/location as its normative subject and is updated here (see
  Decision D10 for why the other twelve are left as a documented follow-up
  rather than twelve redundant delta specs).

## Source-to-Destination Matrix

Legend for the "Dependency disposition" column: **moves** = travels with the
hook into the lib; **app port** = stays app-owned, reached through an
injected parameter/callback; **replaced** = the app mechanism is superseded
by a library-owned contract (enum, structured event, pure function).

### Capability 1 — attachment canvas (`@epam/ai-dial-attachment-canvas`)

| Current path | Destination | Direct/transitive imports | Dependency disposition | Callers / tests / barrels | Package/TS/bundler changes | Risk |
|---|---|---|---|---|---|---|
| `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts` | `libs/attachment-canvas/src/hooks/useOpenAttachmentCanvas/useOpenAttachmentCanvas.ts` | `@epam/ai-dial-attachment-canvas` (already-lib, self-referential once moved), `@epam/ai-dial-chat-shared` (types+`AttachmentType`/`FileExtension`/`MIMEType`, already a peer dep), `useConversationPanel`, `useSourcesSidebar`, `useTheme` (app contexts), 10 resolvers from `apps/chat/src/utils/attachment-canvas.ts`, `findVisualizerForMime` from `apps/chat/src/utils/attachment-visualizer.ts`, `resolveDialUrl` from `apps/chat/src/utils/dial-file.ts`, `useCustomVisualizers` | Contexts → **app port** (`onBeforeOpen` callback replaces both `closePanel`+`closeSourcesPanel`; `themeId` becomes a plain string param replacing `useTheme`); 10 resolvers + `resolveDialUrl` → **app port** (injected resolver functions, since they depend on DIAL URL/fetch/LRU-cache semantics); `findVisualizerForMime` → **moves** (pure `CustomVisualizer[]` lookup, already domain-generic); `useCustomVisualizers` → stays app-owned entirely (reads `AppConfigContext`), its *result* (`CustomVisualizer[]`) becomes a plain param | Callers: `ConversationSourcesPanel.tsx` (×2), `ConversationView.tsx` (×2), `NewConversationComposer.tsx`, `useSkillFilePreviewSync.ts`. Tests: `useOpenAttachmentCanvas.spec.ts` (all scenarios ported, mocks replaced by direct resolver stubs). No existing barrel (new export added to `libs/attachment-canvas/src/index.ts`). | Add hook + types to `libs/attachment-canvas/src/index.ts`; no new peer dependency (all real deps — `@epam/ai-dial-chat-shared` — already declared) | Low — hook has zero own network/state side effects once resolvers are injected; existing spec already exercises every branch through mocked resolvers, so the test file ports near-verbatim. |
| `apps/chat/src/utils/attachment-visualizer.ts` (`findVisualizerForMime`) | `libs/attachment-canvas/src/utils/visualizer.ts` | none (pure) | **moves** | Caller: the hook above only. No test file currently exists — new test required in the lib. | none | Low |
| `apps/chat/src/utils/attachment-canvas.ts` (10 resolver fns + `getUrlFileName`/`hasAttachmentTextSource`, LRU caches, `clearAttachmentCache`) | stays at `apps/chat/src/utils/attachment-canvas.ts` | `@epam/ai-dial-attachment-canvas` types/enums (already imports lib types), `@epam/ai-dial-chat-shared`, `@epam/ai-dial-quotations` (PDF-highlight utils), `lru-cache`, `./dial-file` | **app port** (unchanged file — this is the resolver implementation the hook above now receives as injected callbacks instead of importing directly) | Caller: the extracted hook (via injected params), `app.tsx` (`clearAttachmentCache` on route change), `useCitationMarkdownComponents`'s app-edge composition (Capability 2) | none — file is unchanged, only its *consumer* changes from a direct import to an app-level wiring point | Low |
| `apps/chat/src/utils/dial-file.ts` (`resolveDialUrl`, `isDialFileId`, `resolveDialFileDownloadUrl`, …) | stays app-owned | none beyond `./string-utils` | **app port** | Consumed by the new hook via an injected `resolveContentUrl` callback, and by `apps/chat/src/utils/annotation.ts` (Capability 2) | none | Low |
| `apps/chat/src/hooks/attachment/useCustomVisualizers.ts` | stays app-owned | `AppConfigContext`, `UserConfigStatus` | **app port** (whole hook, not just a dependency — reads `AppConfigContext` directly) | Its result (`CustomVisualizer[]`) becomes a plain param to the extracted hook | none | Low |
| `apps/chat/src/hooks/attachment/useSkillFilePreviewSync.ts` + `apps/chat/src/utils/skill-file-preview.ts` | stay app-owned | wraps the extracted hook + Skill-Builder types | **app port** (thin composition adapter, exactly the "thin wrapper" case the proposal allows to remain) | Caller: `SkillEditor` page | Import path for `useOpenAttachmentCanvas` changes to `@epam/ai-dial-attachment-canvas` | Low |
| `apps/chat/src/app/app.tsx`'s canvas-open panel-closing safety net + `clearAttachmentCache`/`closeCanvas` on route change | stays app-owned | `AttachmentCanvasContext`, panel contexts | **app port** (unrelated to the hook's own contract — this is the app's own cross-cutting safety net, documented as covering call sites, like citation preview, that bypass the hook) | `app.tsx` | none | Low |

### Capability 2 — citation markdown (`@epam/ai-dial-quotations`)

| Current path | Destination | Direct/transitive imports | Dependency disposition | Callers / tests / barrels | Package/TS/bundler changes | Risk |
|---|---|---|---|---|---|---|
| `apps/chat/src/hooks/citations/useCitationMarkdownComponents.tsx` | `libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx` | `@epam/ai-dial-attachment-canvas` (`useAttachmentCanvas`, for the direct `openCanvas` PDF-preview shortcut), `@epam/ai-dial-chat-shared` (`mergeClasses`, types), `@epam/ai-dial-quotations` (self-referential, `CitationDropdown`/`injectCitationSentinels`/`replaceSentinelsInChildren`), `react-i18next`, `../../constants/translation-keys`, `../../utils/annotation` (`openAnnotationAttachment`), `../../utils/attachment-canvas` (`annotationToPdfCanvasContent`), `../../utils/attachment-dto-to-display` (`annotationToDisplayAttachment`) | `useAttachmentCanvas`/`annotationToPdfCanvasContent`/`annotationToDisplayAttachment`/`openAnnotationAttachment` → **app port**, moved wholesale into the app's composed `onPreview`/`onOpenInBrowser` callbacks passed into the hook (per the proposal's explicit instruction not to add a `quotations`→`attachment-canvas` dependency); `react-i18next` + `translation-keys` → **replaced** by an injected `buildLabels(group)` callback the app implements with its own `t()` | Caller: `ConversationMessageItem.tsx` (sole call site). No dedicated test today — new `libs/quotations` tests required (see Decision D2). No barrel currently (new export added to `libs/quotations/src/index.ts`). | Add hook + `CitationLabelBuilder`/`CitationMarkdownCallbacks` types to `libs/quotations/src/index.ts`; assess `react-markdown` peer dependency (Decision D3) | Medium — this hook has **zero existing unit tests** (confirmed by repo-wide search), so the extraction must author the first tests from the implementation and `ConversationMessageItem`'s indirect coverage rather than porting an existing spec. |
| `apps/chat/src/utils/annotation.ts` (`openAnnotationAttachment`) | stays app-owned | `@epam/ai-dial-chat-shared` (`triggerAnchorDownload`), `@epam/ai-dial-quotations` (`AttachmentResource` type), `./dial-file` | **app port** | Composed into the app's `onOpenInBrowser` callback | none | Low |
| `apps/chat/src/utils/attachment-canvas.ts` (`annotationToPdfCanvasContent`) | stays app-owned (same file as Capability 1's row) | see Capability 1 row | **app port** | Composed into the app's `onPreview` callback | none | Low |
| `apps/chat/src/utils/attachment-dto-to-display.ts` (`annotationToDisplayAttachment`) | stays app-owned | `@epam/ai-dial-chat-shared` types | **app port** | Composed into the app's `onPreview` callback (non-PDF fallback branch) | none | Low |
| `apps/chat/src/constants/translation-keys.ts` (`BasicI18nKeys`/`ButtonsI18nKeys`/`CitationsI18nKeys`) | stays app-owned | none | **replaced** (the app's `buildLabels` implementation still uses these internally, but the *lib* no longer imports the enum) | — | none | Low |

### Capability 3 — file-manager hooks (`@epam/ai-dial-chat-hooks`)

| Current path | Destination | Direct/transitive imports | Dependency disposition | Callers / tests / barrels | Package/TS/bundler changes | Risk |
|---|---|---|---|---|---|---|
| `useDialFileManager.ts` | `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts` | `@epam/ai-dial-react-file-manager` (`DialFileManagerActions`, `DialFileManagerTabs`, `FileManagerColumnKey` — already a peer dep), `react-i18next` (`actionLabels`/`dateLocale`), `../../constants/translation-keys`, `../../types/file-manager-variant`, sub-hooks | `react-i18next`/translation-keys → **replaced** by an injected `labels: DialFileManagerActionLabels` + `locale: string` param (Decision D5); `file-manager-variant` (`DialFileManagerVariant`/`DialFileManagerActionProfile`/`deriveActionProfile`) → **moves** (pure enum + pure function, no app coupling) | Callers: `DialFileManagerModal.tsx`, `DialFileManagerPage.tsx`. Tests: `useDialFileManager.spec.tsx` (2001 lines, ~65 `it`s — ports verbatim with the new injected `labels`/`locale`/`filesApi`/`config` params supplied by test fixtures). | Export from `libs/chat-hooks/src/index.ts` | Medium — largest single test file; every scenario must be re-verified against the injected-port version, not just moved. |
| `useDialFileManagerTabConfig.ts` | `libs/chat-hooks/src/files/useDialFileManagerTabConfig/…` | `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-ui-kit` (`TabModel`, type-only), `AppConfigContext` | `AppConfigContext` → **replaced** by a plain `fileManagerTabs: string[] \| undefined` param the host resolves from its own config context before calling the hook | Callers: `DialFileManagerModal.tsx`, `DialFileManagerPage.tsx`. Tests: `useDialFileManagerTabConfig.spec.ts` (5 scenarios, ports with a plain param replacing the context mock). | Export from index | Low |
| `useDialFileListing.ts` | `libs/chat-hooks/src/files/useDialFileListing/…` | `@epam/ai-dial-chat-api-client` (DTO types, already a peer dep), `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-ui-kit` (`NotificationVariant`), `react-i18next`, `translation-keys`, `server-api/files.api` (`listSharedByMe` + via mapping util `listFiles`/`listPublicFiles`/`listSharedFiles`), `resolve-dial-file-api-path`, `string-utils` (`safeDecodeURI`), 3 sibling `dial-file-manager-*` util files | `server-api/files.api` → **replaced** by the injected `DialFilesApi` port (Decision D4); `react-i18next`/`translation-keys` (only used for the `FolderLoadError` toast) → **replaced** by a structured `onNotification` event the host translates; `resolve-dial-file-api-path`/`string-utils::safeDecodeURI` → **moves** (pure path algebra, no app coupling per the file-manager audit) | Not called directly by any component — only via `useDialFileManager`. Tests: `useDialFileListing.spec.tsx` (11 scenarios). | none beyond the port | Medium — sole owner of the shared cache (design invariant carried from `dial-file-manager-hook-decomposition`); the port substitution must not change cache-key shape. |
| `useDialFileMetadata.ts` | `libs/chat-hooks/src/files/useDialFileMetadata/…` | `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-ui-kit`, `react-i18next`, `translation-keys`, `server-api/files.api` (`getFileMetadata`), `resolve-dial-file-api-path` | `server-api/files.api` → **replaced** by `DialFilesApi`; `react-i18next` → **replaced** by structured `onNotification` | Only via `useDialFileManager`. Tests: 6 scenarios. | none beyond the port | Low |
| `useDialFileMutations.ts` | `libs/chat-hooks/src/files/useDialFileMutations/…` | `@epam/ai-dial-chat-api-client` (DTO/enum types), `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-ui-kit` (`NOT_ALLOWED_SYMBOLS`, `NotificationVariant`), `react-i18next`, `translation-keys`, `server-api/files.api` (7 methods), `entity-notification` types, `file-download` (`prepareDownloadDestination`/`triggerBrowserDownload`), `useOperationNotification`, 3 sibling util files | `server-api/files.api` → **replaced** by `DialFilesApi`; `react-i18next`/`translation-keys` (validation messages + error toasts) → **replaced** by structured validation-error enums + `onNotification` events; `useOperationNotification`/`entity-notification` → **replaced** by a library-owned `onOperationSuccess` structured event (Decision D6); `file-download` → **app port** (injected `downloadDestination` resolver — browser "Save As" semantics are host-shell-specific, confirmed not yet fully read by the inventory pass but classified as app-specific by the reasoning in the prompt itself: "inject application-specific download/path/URL behavior") | Only via `useDialFileManager`. Tests: `useDialFileMutations.spec.tsx` (1175 lines, largest per-hook suite). | none beyond the ports | High — the biggest single hook (7 mutations, 6 loading flags, `AbortController`-based cancellation for copy/move); the rename-vs-move split and the parallel `Promise.all` rename+move execution must be preserved exactly. |
| `useDialFileSharing.ts` | `libs/chat-hooks/src/files/useDialFileSharing/…` | `@epam/ai-dial-chat-api-client`, `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-ui-kit`, `react-i18next`, `translation-keys`, `server-api/files.api` (`discardShared`/`revokeAccess`), `resolve-dial-file-api-path` | `server-api/files.api` → **replaced** by `DialFilesApi`; `react-i18next` → **replaced** by structured `onNotification` | Only via `useDialFileManager`. Tests: 3 scenarios. | none beyond the port | Low |
| `useDialFileUploadBatch.ts` | `libs/chat-hooks/src/files/useDialFileUploadBatch/…` | `@epam/ai-dial-chat-api-client`, `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-ui-kit`, `react-i18next`, `translation-keys`, a component-folder type import (`../../components/DialFileManagerModal/types/upload`), `server-api/files.api` (`uploadFile`/`uploadArchive`), `file-name` (`sanitizeFileName`), `resolve-dial-file-api-path`, 2 sibling util files | `server-api/files.api` → **replaced** by `DialFilesApi`; `react-i18next` → **replaced** by structured `onNotification`; the `../../components/…/types/upload` import → **moves** (relocates alongside the hook — it is pure upload-progress UI state with no component/rendering coupling, just misplaced under a component folder today); `file-name::sanitizeFileName` → **moves** (pure) | Only via `useDialFileManager`. Tests: 7 scenarios. | none beyond the port | Medium — concurrency-limited (3 parallel workers), cancellation via shared `AbortController`, and the archive-conflict-fallback heuristic must be preserved exactly. |
| `useGridEditingScroll.ts` | `libs/chat-hooks/src/files/useGridEditingScroll/…` | `@epam/ai-dial-react-file-manager` (`FileManagerGridRow`), `ag-grid-community` (`CellEditingStartedEvent`, `GridApi`, `IRowNode`, `RowDataUpdatedEvent`) | `ag-grid-community` → **new peer-dependency exception** (Decision D9) — the hook's public contract (`{ handleGridApiChange, reset }`) stays free of AG Grid types; only its internals import them | Caller: `DialFileManagerShell.tsx`. Tests: 9 scenarios. | Add `ag-grid-community` to `libs/chat-hooks/package.json` peerDependencies + `vite.config.mts` externals; **task to amend `AGENTS.md` §Library isolation** (Decision D9) | Medium — the only hook in this change requiring a documentation-policy change, not just a code move. |
| `dial-file-manager.types.ts` | `libs/chat-hooks/src/files/dial-file-manager.types.ts` | ui-kit file-manager types | **moves** | consumed by all hooks above | none | Low |
| `dial-file-manager.model.ts` | `libs/chat-hooks/src/files/dial-file-manager.model.ts` | `@epam/ai-dial-chat-shared` (`HIDDEN_FILE`), ui-kit types | **moves** | consumed by listing/mutations/upload/sharing | none | Low |
| `dial-file-manager-copy-move.util.ts` | `libs/chat-hooks/src/files/dial-file-manager-copy-move.util.ts` | `@epam/ai-dial-chat-api-client` DTOs, ui-kit `DialCopiedItem`/`DialFileNodeType` | **moves** | consumed by mutations | none | Low |
| `dial-file-manager-mapping.util.ts` | `libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts` | ui-kit types, `server-api/files.api` (`fetchByTab`/`fetchForSearch`) | most of file **moves**; the two functions that directly call `server-api/files.api` are rewritten to call the injected `DialFilesApi` port instead | consumed by listing/upload | none beyond the port | Medium — this is where the `DialFilesApi` substitution is threaded through the tab-dispatch logic |
| `dial-file-manager-path.util.ts` | `libs/chat-hooks/src/files/dial-file-manager-path.util.ts` | ui-kit `DialFile`/`DialFileNodeType`/`DialFilePermission`, `apps/chat/src/types/file-manager-variant` (for two functions) | **moves**, including `file-manager-variant.ts` (also moves — see `useDialFileManager` row) | consumed by listing/mutations/upload | none | Low |
| `apps/chat/src/utils/resolve-dial-file-api-path.ts` | `libs/chat-hooks/src/files/resolve-dial-file-api-path.ts` | `@epam/ai-dial-ui-kit` types, `apps/chat/src/utils/dial-file.ts` (`resolveRelativeDialFilePath`) | **moves**, including the one function it borrows from `dial-file.ts` (duplicated locally rather than creating a cross-cutting shared export, per the lifecycle-hooks predecessor's D-pattern of not widening a 10+-consumer utility's blast radius) | consumed by listing/metadata/mutations/upload | none | Low |
| `apps/chat/src/utils/file-name.ts` (`sanitizeFileName`) | `libs/chat-hooks/src/files/file-name.ts` | none (pure) | **moves** | consumed by upload | none | Low |
| `apps/chat/src/utils/string-utils.ts` (`safeDecodeURI` only) | duplicated locally in `libs/chat-hooks/src/files/` | none (pure) | **moves as a local copy** (the source file has other, unrelated app-wide consumers per the same predecessor-established pattern) | consumed by listing/mapping | none | Low |
| `apps/chat/src/hooks/files/useDialFileManagerState.ts` | stays app-owned | `@epam/ai-dial-chat-shared` (`Attachment`), `dial-file-to-attachment.ts` | **app port** (produces the app's `Attachment[]` shape — an app-domain output, not a file-manager concern) | Caller: `NewConversationComposer.tsx` | Import path for the composed `useDialFileManager` result it wraps changes to `@epam/ai-dial-chat-hooks` | Low |
| `apps/chat/src/utils/dial-file-to-attachment.ts` | stays app-owned | `@epam/ai-dial-chat-shared`, `icon-path` (`resolveCatalogIconUrl`) | **app port** | Consumed by `useDialFileManagerState` | none | Low |
| `apps/chat/src/server-api/files.api.ts` | stays app-owned, wrapped by a thin `DialFilesApi` adapter | generated `filesApi` client, `upload-file-with-progress.ts` | **replaced by port** (Decision D4) — the file itself is untouched; a new thin adapter object implementing `DialFilesApi` is added alongside it | Every data-flow hook above, via the port | New file: `apps/chat/src/server-api/dial-files-api.adapter.ts` (or similar) | Medium — must map 1:1 to every method signature the port declares |
| `apps/chat/src/hooks/useOperationNotification.ts` + `entity-notification.ts` + `ENTITY_OPERATION_NOTIFICATIONS` map | stays app-owned | `NotificationContext`, i18n | **replaced by port** — the app keeps this file, but it is now driven by the new `onOperationSuccess` structured event from the lib instead of being called directly inside the (now-deleted) app hook | Consumed at the new app-level adapter that wires `useDialFileManager`'s callbacks | none | Low |
| `apps/chat/src/context/AppConfigContext` (`config.fileManagerTabs`) | stays app-owned | — | **app port** | Read once at the `DialFileManagerModal.tsx`/`DialFileManagerPage.tsx` call sites, passed as a plain param | none | Low |

## Host-Owned Dependency Matrix

| Host-owned dependency | Discovered in | Application-edge replacement |
|---|---|---|
| `ConversationPanelContext` / `SourcesSidebarContext` (React contexts) | `useOpenAttachmentCanvas` | `onBeforeOpen?: () => void` callback param; the app composes `() => { closePanel(); closeSourcesPanel(); }` at the call site |
| `ThemeContext` | `useOpenAttachmentCanvas` | plain `themeId?: string` param |
| `react-i18next` (`useTranslation`) | `useCitationMarkdownComponents`, all 6 file-manager hooks that toast/validate | `useCitationMarkdownComponents`: injected `buildLabels(group)` callback. File-manager hooks: structured result/event enums (validation error reasons, `onNotification` event payloads) the app translates; `useDialFileManager`'s `actionLabels`/`dateLocale` become injected `labels`/`locale` params |
| `apps/chat/src/server-api/files.api.ts` (generated-client wrapper) | `useDialFileListing`, `useDialFileMetadata`, `useDialFileMutations`, `useDialFileSharing`, `useDialFileUploadBatch`, `dial-file-manager-mapping.util.ts` | injected `DialFilesApi` operation port (Decision D4); a new thin app-side adapter wraps the existing `files.api.ts` unchanged |
| `AppConfigContext` (`useAppConfig`) | `useDialFileManagerTabConfig` | plain `fileManagerTabs: string[] \| undefined` param resolved by the host before calling the hook |
| `useOperationNotification` / `NotificationContext` / `entity-notification.ts` | `useDialFileMutations` | library-owned `onOperationSuccess` structured event (entity kind + operation + name/count data, no translated text); the app's existing `useOperationNotification` becomes the app-edge consumer of that event instead of being called from inside the hook |
| `apps/chat/src/utils/file-download.ts` (browser "Save As" / auto-download) | `useDialFileMutations.onDownloadFiles` | injected `resolveDownloadDestination`/`triggerDownload` callbacks — this is desktop/web-shell-specific browser API usage, not portable file-manager domain logic |
| `apps/chat/src/utils/attachment-canvas.ts`, `dial-file.ts`, `annotation.ts`, `attachment-dto-to-display.ts` (DIAL URL/fetch/LRU-cache resolvers) | `useOpenAttachmentCanvas`, `useCitationMarkdownComponents` | injected resolver callbacks (Capability 1) / composed into the app's `onPreview`/`onOpenInBrowser` callbacks (Capability 2) |
| `apps/chat/src/utils/dial-file-to-attachment.ts` | `useDialFileManagerState` | stays entirely app-owned; not a lib dependency at all — the whole hook is app-owned |
| `apps/chat/src/types/entity-notification.ts` (`NotifiableEntity`/`EntityOperation`, ~10 unrelated consumers) | `useDialFileMutations` (via `useOperationNotification`) | not passed into the lib at all — the lib emits its own structured event; the app's existing enum stays exactly where it is, mapped at the edge |
| `ag-grid-community` (third-party UI grid library) | `useGridEditingScroll` | not host-owned in the traditional sense (no app context/service), but a **new lib-level dependency-boundary exception** — see Decision D9 rather than an app-port replacement, since the coupling is to a UI library the ui-kit component itself leaks, not to app logic |

## Dependency Graph

```
apps/chat
   │  imports (unchanged: apps may depend on libs)
   ▼
┌───────────────────────┐     ┌────────────────────┐     ┌──────────────────────┐
│ @epam/ai-dial-         │     │ @epam/ai-dial-      │     │ @epam/ai-dial-        │
│ attachment-canvas      │◄────┤ quotations          │     │ chat-hooks            │
│  + useOpenAttachment-  │     │  + useCitation-     │     │  + 8 file-manager     │
│    Canvas (new)        │     │    MarkdownComp-     │     │    hooks (new)        │
└───────────┬─────────────┘     │    onents (new)     │     └──────────┬─────────────┘
            │ existing peer dep │  (no new dep on      │                │ existing peer deps
            ▼                   │   attachment-canvas) │                ▼
┌───────────────────────┐       └──────────┬───────────┘     @epam/ai-dial-attachment-canvas
│ @epam/ai-dial-chat-    │                  │ existing peer dep      @epam/ai-dial-quotations
│ shared                 │◄─────────────────┘                        @epam/ai-dial-chat-api-client
└───────────────────────┘                                            @epam/ai-dial-react-file-manager
                                                                       + NEW: ag-grid-community (D9)
```

- `attachment-canvas` gains no new peer dependency (its one new export only
  needs types it or `chat-shared` already declares).
- `quotations` gains no new dependency on `attachment-canvas` — the PDF-
  preview shortcut moves to the application edge instead (Decision D2), so
  the existing one-directional edge (`chat-hooks` → `quotations`,
  established by the first predecessor change) is unaffected and no
  `quotations` → `attachment-canvas` edge is introduced.
- `chat-hooks` already declares `attachment-canvas`, `quotations`, and
  `react-file-manager` as peer dependencies (from the two predecessor
  changes); this change adds no new edge to either sibling lib, only the new
  third-party `ag-grid-community` dependency (Decision D9).
- No cycle is introduced: `chat-hooks` continues to depend on
  `attachment-canvas` and `quotations`; neither of those two gains a
  dependency back on `chat-hooks` or on each other.

## Decisions

### D1 — Attachment-canvas hook owns dispatch, not resolution

`useOpenAttachmentCanvas`'s value is its branching logic (12 distinct
decision points documented in the source inventory: type dispatch,
reference-PDF pre-emption, visualizer short-circuit, MIME-vs-extension
asymmetric fallback, HTML srcdoc-vs-url-iframe choice, panel-coordination
ordering). None of that logic depends on DIAL URLs or `fetch`. The library
hook therefore keeps 100% of the dispatch logic and receives the ten content
resolvers, `resolveContentUrl`, `customVisualizers`, and `themeId` as
parameters:

```ts
interface UseOpenAttachmentCanvasResolvers {
  resolveImageContent(attachment: DisplayAttachment): ImageCanvasContent | null;
  resolveTextContent(attachment: DisplayAttachment): PlainTextCanvasContent | null;
  resolveMarkdownContent(attachment: DisplayAttachment): Promise<MarkdownCanvasContent | null>;
  resolveCodeContent(attachment: DisplayAttachment, language?: string): Promise<CodeCanvasContent | null>;
  resolveHtmlContent(attachment: DisplayAttachment): Promise<HtmlCanvasContent | null>;
  resolvePdfContent(attachment: DisplayAttachment): Promise<PdfCanvasContent | null>;
  resolveJsonContent(attachment: DisplayAttachment): Promise<JsonCanvasContent | null>;
  resolveVisualizerContent(attachment: DisplayAttachment, visualizer: CustomVisualizer, themeId?: string): Promise<VisualizerCanvasContent | null>;
  resolveReferencePdfContent(attachment: DisplayAttachment): Promise<PdfCanvasContent | null>;
  resolveContentUrl(attachment: DisplayAttachment): string | undefined;
}
interface UseOpenAttachmentCanvasOptions {
  customVisualizers: CustomVisualizer[];
  themeId?: string;
  onBeforeOpen?: () => void;
}
```

`findVisualizerForMime` and `getUrlFileName`/`hasAttachmentTextSource` move
into the library (pure, no app coupling per the audit), since they are part
of the dispatch logic itself, not app-specific resolution.

### D2 — Citation-markdown hook does not gain an attachment-canvas dependency

The current app hook bypasses `useOpenAttachmentCanvas`'s panel-coordination
entirely for its PDF-preview shortcut (calling `openCanvas` directly), which
is exactly why `app.tsx` needs a separate global safety net today. Rather
than reproducing that shortcut inside `quotations` (which would force a new
`quotations` → `attachment-canvas` edge the proposal explicitly forbids), the
whole `onPreview` branch — PDF-source detection, `annotationToPdfCanvasContent`,
`openCanvas` call, non-PDF fallback via `annotationToDisplayAttachment` — moves
to the application edge as the single `onPreview` callback
`ConversationMessageItem.tsx` composes and passes in. The library hook's
contract narrows to:

```ts
interface UseCitationMarkdownComponentsCallbacks {
  onPreview(annotation: Annotation, group: AnnotationGroup): void;
  onOpenInBrowser(annotation: Annotation): void;
  buildLabels(group: AnnotationGroup): {
    cardLabels: CitationCardLabels;
    markerLabels: CitationMarkerLabels;
  };
}
useCitationMarkdownComponents(
  content: string,
  groups: AnnotationGroup[],
  callbacks: UseCitationMarkdownComponentsCallbacks,
  isCompactTypography?: boolean,
): { processedContent: string; markdownComponents: Components };
```

`app.tsx`'s existing global panel-closing safety net is unaffected (it covers
call sites that bypass `useOpenAttachmentCanvas`, which the moved `onPreview`
composition still does, unchanged).

### D3 — `react-markdown` stays a peer dependency, added to externals

`react-markdown`'s `Components` type is already referenced by the app hook
today (type-only) and `quotations` already ships `CitationDropdown`, which
is meant to be composed inside `react-markdown` overrides; `quotations`
itself performs no `react-markdown` rendering, only produces the override
map. `react-markdown` is added to `libs/quotations/package.json`
`peerDependencies` (type-only usage does not require a runtime dependency,
but the peer entry documents the version contract for consumers) and to
`vite.config.mts`'s `rollupOptions.external` defensively, consistent with the
first predecessor change's bundle-size lesson (an un-externalized peer
inlines its whole tree) — even though the current usage is types-only, a
future non-type import must not silently balloon the bundle.

### D4 — `DialFilesApi`: a narrow operation port, not a `Pick<GeneratedApi>`

Unlike the predecessor changes' `Pick<GeneratedApi, 'method'>` pattern (which
works when the hook calls the generated client's own methods almost
directly), `apps/chat/src/server-api/files.api.ts` is not a thin pass-through
for every method — `uploadFile`/`uploadArchive` wrap a custom
`upload-file-with-progress.ts` for XHR-based progress/cancellation that has
no equivalent shape in the generated client. The port therefore mirrors
`files.api.ts`'s own function signatures (bucket/path/options), not the
generated client's:

```ts
interface DialFilesApi {
  listFiles(bucket: string, path: string, options?: { permissions?: boolean }): Promise<ListFilesItemDto[]>;
  listPublicFiles(...): Promise<ListFilesItemDto[]>;
  listSharedFiles(...): Promise<ListFilesItemDto[]>;
  listSharedByMe(bucket: string): Promise<ListFilesItemDto[]>;
  getFileMetadata(bucket: string, path: string): Promise<FileMetadataDto>;
  uploadFile(bucket: string, path: string, file: File, options: { signal: AbortSignal; uploadMode: 'overwrite' | 'create-only'; onProgress: (percent: number) => void }): Promise<void>;
  uploadArchive(file: File, bucket: string, destinationPath: string): Promise<UploadArchiveEntryResultDto[]>;
  createFolder(bucket: string, path: string): Promise<CreateFolderResponseDto>;
  deleteFiles(items: DeleteItemDto[]): Promise<...>;
  renameFiles(items: RenameItemDto[]): Promise<...>;
  copyFiles(items: CopyItemDto[], signal: AbortSignal): Promise<...>;
  moveFiles(items: MoveItemDto[]): Promise<...>;
  downloadFile(bucket: string, path: string): Promise<Blob>;
  downloadArchive(items: ArchiveItemDto[]): Promise<Blob>;
  revokeAccess(items: RevokeAccessItemDto[]): Promise<...>;
  discardShared(items: DiscardSharedItemDto[]): Promise<...>;
}
```

`apps/chat` implements `DialFilesApi` with a new thin adapter object that
delegates to the existing, untouched `server-api/files.api.ts` — the port
substitution is purely at the call boundary, so `files.api.ts`'s own
generated-client usage, CSRF handling, and upload-progress plumbing are
unaffected. Every DTO type in the port signature is the same
`@epam/ai-dial-chat-api-client` DTO the hooks already reference directly
(already a `chat-hooks` peer dependency) — no lossy duplicate models are
introduced.

### D5 — Validation and label injection replaces `react-i18next`

Two distinct replacement shapes, matched to what each hook currently does
with translation:

- **Validation functions** (`onCreateFolderValidate`, `onRenameValidate`,
  `onValidateUpload`) return a library-owned discriminated result instead of
  a translated string:
  ```ts
  type FileNameValidationError =
    | { reason: 'empty' }
    | { reason: 'forbiddenSymbols'; symbols: string }
    | { reason: 'reservedName' }
    | { reason: 'tooLong'; maxLength: number }
    | { reason: 'duplicateName'; existingName: string }
    | { reason: 'leadingDot' };
  ```
  The app's existing validation-message-building logic moves to the call
  site, mapping each `reason` to the exact same translated string
  (`DialFileManagerI18nKeys.*`) it produces today.
- **Action labels and locale** (`useDialFileManager`'s `actionLabels`,
  `dateLocale`) become injected values: `labels:
  Partial<Record<DialFileManagerActions, string>>` is now the *host's*
  responsibility to build per-tab/per-profile (the hook still computes
  *which* actions are gated, returning that gating as a
  `visibleActions: DialFileManagerActions[]` set the host intersects with its
  own label map) — this keeps the profile/tab gating matrix (12+ test
  scenarios) inside the library while removing the only `t()` calls that were
  purely static strings. `locale: string` replaces `i18n.language`.
- **Toast messages** (`FolderLoadError`, `DownloadFileError`, `UnshareError`,
  etc.) become structured `onNotification` events (already a callback param
  in every hook today, just narrowly typed as `{ variant, title?, message }`)
  carrying a library-owned reason enum instead of a pre-rendered `message`;
  the app's existing `onNotification` implementation maps each reason to its
  current translated string.

### D6 — Mutation success feedback becomes a structured event, not a call to `useOperationNotification`

`useDialFileMutations` is the only hook that calls `useOperationNotification`
(app-owned, wraps `NotificationContext` + a large translation map) directly,
for create-folder/rename/download/copy/move successes. This becomes a new
`onOperationSuccess` callback carrying a library-owned shape:

```ts
type FileOperationKind = 'folderCreated' | 'fileRenamed' | 'fileDownloaded' | 'filesDownloaded' | 'fileCopied' | 'filesCopied' | 'fileMoved' | 'filesMoved';
interface FileOperationSuccessEvent {
  kind: FileOperationKind;
  name?: string;
  count?: number;
  destinationFolderName?: string;
}
```

The app's existing `useOperationNotification`/`entity-notification.ts` stays
exactly where it is, now invoked from the new app-level adapter that wires
`useDialFileManager`'s callbacks, mapping each `FileOperationKind` to the
same `NotifiableEntity`/`EntityOperation` pair and translation key it uses
today. No new library dependency on `entity-notification.ts`'s 10-consumer
enum is introduced.

### D7 — `useDialFileManagerState` and its Attachment-mapping utilities stay app-owned

`useDialFileManagerState` and `dial-file-to-attachment.ts` produce
`apps/chat`'s own `Attachment` shape for the message composer — an app-domain
output, not a file-manager-grid concern, and neither reads any of the
subsystem's shared cache or mutation state. They are excluded from the move
entirely (not even as an app-port seam into the lib — the lib never sees
them).

### D8 — Upload-progress type relocates alongside its hook

`FileUploadStatus`/`FileUploadEntry`/`FileUploadBatchState`
(`apps/chat/src/components/DialFileManagerModal/types/upload.ts`) are pure
upload-progress state shapes consumed only by `useDialFileUploadBatch` and
rendered by `UploadProgressModal` (an app-owned component). They relocate
into the lib alongside the hook that owns them; the app-owned
`UploadProgressModal` imports the type from `@epam/ai-dial-chat-hooks`
instead of a sibling component folder.

### D9 — `useGridEditingScroll`: narrow, documented `ag-grid-community` exception (Option 2)

The file-manager audit found that `useGridEditingScroll` is the *only* one of
the 21 files with any AG Grid coupling, and that the coupling exists purely
because `@epam/ai-dial-react-file-manager`'s `GridOptions` prop surface does
not forward the raw `cellEditingStarted`/`rowDataUpdated` AG Grid callbacks —
the hook exists specifically to subscribe to those two events directly on the
`GridApi` the ui-kit component exposes via `onGridApiChange`. This is Option
2 from the proposal's file-manager dependency boundary:

- **Exact narrow surface**: four named types from `ag-grid-community` —
  `GridApi`, `IRowNode`, `CellEditingStartedEvent`, `RowDataUpdatedEvent` —
  always generically parameterized by `@epam/ai-dial-react-file-manager`'s
  own `FileManagerGridRow` type, never AG Grid's `ColDef`/row-model/theming
  APIs.
- **Why an adapter is inadequate**: an app-side adapter would require moving
  the ~80 lines of scroll-into-view logic (double-`requestAnimationFrame`
  scheduling, `ensureIndexVisible`/`ensureNodeVisible` calls, DOM
  `querySelector` fallback, known-row-id diffing to distinguish a genuinely
  new row from a reordered one) back into `apps/chat`, defeating the point of
  extracting it — the hook's entire value is that it already contains that
  logic; an adapter would just be a renamed copy of the same AG-Grid-typed
  code, not a boundary.
- **No rendering or app-state coupling**: the hook renders nothing (no JSX),
  holds no state beyond two internal refs (`knownRowIdsRef`,
  `subscribedApiRef`), and its public contract — `{ handleGridApiChange,
  reset }` — never exposes an AG Grid type to its caller.
- **Task added** (tasks.md §8): amend `AGENTS.md` §Library isolation to add a
  third, narrowly-scoped exception for `libs/chat-hooks` — a raw
  third-party UI/grid library type, used only for binding to callbacks a
  declared peer dependency's own component leaks and does not forward,
  never for rendering or theming — alongside the existing generated-client
  and host-agnostic-package exceptions. `ag-grid-community` is added to
  `libs/chat-hooks/package.json` `peerDependencies` and `vite.config.mts`
  externals.

### D10 — Only `dial-file-manager-hook-decomposition` gets a delta spec

Twelve other specs (`file-manager-tab-config`, `file-manager-grid-editing-
scroll`, `file-manager-sharing`, `file-manager-copy-move`,
`file-manager-delete-ui`, `file-manager-download`,
`file-manager-folder-creation`, `file-manager-metadata`,
`file-manager-operation-ux`, `file-manager-rename-ui`,
`file-manager-shell`, `file-manager-upload`) mention
`apps/chat/src/hooks/files/**` paths in descriptive prose, but their
SHALL-level requirements describe product/UI behavior (which actions appear,
what a toast says, how search debounces) that this change does not alter —
only *where the implementing code lives* changes. `dial-file-manager-hook-
decomposition` is different: its entire normative subject *is* the internal
hook-ownership map and equivalence contract of the exact subsystem this
change relocates, so it is the one spec whose requirement text becomes
materially inaccurate (it names `apps/chat/src/hooks/files/useDialFileManager.ts`
as the composer's location and lists `server-api/files.api` calls as part of
each sub-hook's ownership) without an update. Rather than writing twelve
redundant path-only deltas, tasks.md §8 adds a documentation-audit task to
grep and correct the stale `apps/chat/src/hooks/files` path references in
the other twelve specs' prose as a fast-follow within this same change's
final slice, without altering any of their requirement/scenario text.

## Risks / Trade-offs

- **Largest single test file in the repo's hook-extraction history**
  (`useDialFileManager.spec.tsx`, 2001 lines) must be re-verified against
  four new injected parameters (`filesApi`, `config`, `labels`,
  `onOperationSuccess`) without losing any of its ~65 scenarios — mitigated
  by porting the spec slice-by-slice (tasks.md §5–7) rather than in one pass,
  matching the predecessor changes' per-slice verification discipline.
  **Note added while first attempting this move**: `useDialFileManagerState`
  in fact requires no test changes since it stays entirely app-owned — this
  reduces, not increases, the surface the largest test file must cover.
- **`useCitationMarkdownComponents` has zero existing unit tests** — the
  extraction is also the first time this behavior gets direct test coverage,
  so there is no existing spec to diff against; risk of silently changing
  behavior while porting is mitigated by deriving the scenario list
  from the source's own branches (documented exhaustively in the source
  inventory) plus `ConversationMessageItem`'s existing integration coverage.
- **`ag-grid-community` peer dependency is new to `libs/chat-hooks`** and,
  unlike every prior peer addition, is a third-party UI library rather than
  another DIAL package — if a future `@epam/ai-dial-react-file-manager`
  release stops leaking `GridApi` through `onGridApiChange`, this hook's
  *implementation* changes but its public contract does not; tracked as an
  open question below.
- **`DialFilesApi`'s upload methods encode progress/cancellation semantics**
  (`onProgress`, `AbortSignal`) that are shaped around browser `XMLHttpRequest`
  — a future non-browser host would need an equivalent progress-reporting
  transport; not a regression (today's coupling is identical, just less
  visible), but worth flagging as the port's one host-shell assumption.
- **Bundle-size regression risk** — repeating the exact failure mode both
  predecessor changes hit (`vite.config.mts`'s `rollupOptions.external` is a
  hardcoded array, not derived from `peerDependencies`): every new peer
  dependency (`ag-grid-community`, `react-markdown`) must be added to both
  lists in the same commit, verified by comparing bundle size before/after
  each slice (tasks.md carries this checkpoint forward).

## Migration Plan

See `tasks.md` for the full checklist. Slice order, and why:

1. **Audit + lock contracts** (this design) — including the `DialFilesApi`
   port shape and the `ag-grid-community` boundary decision, since slices
   2–7 all depend on these being fixed before implementation starts.
2. **Attachment canvas** — independent of citations and file-manager;
   moved first because it has full existing test coverage to port against.
3. **Citation markdown** — independent of file-manager; moved second
   because, unlike attachment-canvas, it requires *authoring* tests, not
   porting them, and benefits from the attachment-canvas hook's contract
   already being settled (the app's composed `onPreview` callback reuses the
   same resolvers Capability 1 already wired at the app edge).
4. **File-manager domain contracts, models, path/mapping/copy-move utils** —
   no hooks yet, but every hook slice below depends on these existing first.
5. **Listing, metadata, tab-configuration** — the shared-cache owner
   (`useDialFileListing`) must land before mutation/upload/sharing hooks,
   since they all call its `invalidateFolders`/`bumpRetry`/`mergeCreatedFolder`
   primitives.
6. **Mutations, sharing, upload** — depend on slice 5's cache-mutation
   primitives.
7. **Composition (`useDialFileManager`) + `useGridEditingScroll`** — depends
   on every sub-hook from slices 5–6 being in the lib; migrates the three
   component/page call sites and deletes the superseded app files.
8. **Package metadata, docs, `dial-file-manager-hook-decomposition` spec
   update, AGENTS.md amendment, final duplicate/import audit.**

Each slice ends with `npm exec nx build <lib> && npm exec nx test <lib>`,
a bundle-size comparison against the pre-slice baseline, then
`npm exec nx affected --target=test,lint,build --base=origin/development`,
matching both predecessor changes' verification discipline.

## Open Questions

- Should `DialFilesApi`'s upload methods be redesigned around a
  host-supplied `UploadTransport` interface (mirroring
  `ConversationStreamTransport`'s pattern from the lifecycle-hooks change)
  instead of assuming XHR-shaped `onProgress`/`AbortSignal` semantics? Left
  as today's shape since no second host exists yet to validate a more
  abstract contract against — revisit if/when a second `DialFilesApi`
  implementation is needed.
- If a future `@epam/ai-dial-react-file-manager` release wraps or removes
  the `onGridApiChange` escape hatch that motivates Decision D9, does
  `useGridEditingScroll`'s `ag-grid-community` peer dependency get removed
  in the same release bump, or does it become dead weight kept for
  backward compatibility? Not blocking this change; flagged for whoever
  next touches `useGridEditingScroll`.
