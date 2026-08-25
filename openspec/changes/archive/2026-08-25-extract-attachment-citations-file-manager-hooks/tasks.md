## 1. Slice 1 — Audit and lock contracts

- [x] 1.1 Confirm the `DialFilesApi` port shape (design.md D4) against every
      method `apps/chat/src/server-api/files.api.ts` currently exports,
      including `uploadFile`/`uploadArchive`'s progress/cancellation
      parameters, and record any signature adjustment needed.
      (Confirmed against the current source. Adjustments vs. design.md's
      draft shape: `listFiles`/`listPublicFiles`/`listSharedFiles` take a
      single params object — `{bucket, path?, token?, limit?, recursive?,
      permissions?}` plus an optional `signal` — and resolve
      `ListFilesResponseDto` (which wraps `.items`), not a bare
      `ListFilesItemDto[]`; `uploadFile` resolves `FileUploadResponseDto`;
      `createFolder` takes a single `CreateFolderDto` params object;
      `downloadFile`/`downloadArchive` resolve the raw `Response` object,
      not `Blob` — callers already extract `.blob()` themselves. The port
      interface implemented in slice 4 mirrors these exact signatures.)
- [x] 1.2 Confirm the `useOpenAttachmentCanvas` resolver-seam shape
      (design.md D1) against every branch in the existing
      `useOpenAttachmentCanvas.spec.ts`.
      (Confirmed via the source inventory gathered during `/opsx:propose`;
      no adjustment needed — every branch documented in
      `specs/attachment-canvas-workflow/spec.md` maps to one resolver
      call.)
- [x] 1.3 Confirm the `useCitationMarkdownComponents` callback-seam shape
      (design.md D2) against `ConversationMessageItem.tsx`'s current
      composition of `handleAttachmentClick`/annotation preview.
      (Confirmed; no adjustment needed.)
- [x] 1.4 Draft the `AGENTS.md` §Library isolation amendment text for the
      `ag-grid-community` narrow exception (design.md D9) for review
      alongside this slice, without merging it yet (merged in slice 8 once
      `useGridEditingScroll` actually lands).
      (Draft text is design.md's D9 section itself; merged into AGENTS.md
      in task 8.1.)
- [x] 1.5 Record the pre-change bundle sizes for
      `ai-dial-attachment-canvas`, `ai-dial-quotations`, and
      `ai-dial-chat-hooks` as the baseline for each subsequent slice's
      bundle-size comparison.
      (Baseline via `npm exec nx build <lib>`: attachment-canvas
      `index.js` 1,331.85 kB / gzip 398.88 kB; quotations `index.js`
      10.62 kB / gzip 3.83 kB; chat-hooks `index.js` 43.81 kB / gzip
      13.24 kB.)

## 2. Slice 2 — Attachment canvas (`@epam/ai-dial-attachment-canvas`)

- [x] 2.1 Add `findVisualizerForMime` to
      `libs/attachment-canvas/src/utils/visualizer.ts` with its own test
      file (moved from `apps/chat/src/utils/attachment-visualizer.ts`,
      which had no prior test).
      (Moved verbatim; authored `libs/attachment-canvas/src/utils/tests/visualizer.spec.ts`
      with 8 scenarios — case-insensitive match, comma-list match/trim,
      first-match-wins, no-match, empty registry, trailing-comma-produced
      empty entry.)
- [x] 2.2 Implement `useOpenAttachmentCanvas` in
      `libs/attachment-canvas/src/hooks/useOpenAttachmentCanvas/useOpenAttachmentCanvas.ts`
      with the resolver/`customVisualizers`/`themeId`/`onBeforeOpen`
      contract from design.md D1, preserving every dispatch branch
      (type dispatch, reference-PDF pre-emption, visualizer short-circuit,
      MIME-vs-extension asymmetric fallback, HTML srcdoc-vs-url-iframe
      decision) documented in `specs/attachment-canvas-workflow/spec.md`.
      (Implemented with the exact D1 resolver/options shape; `getUrlFileName`
      and `hasAttachmentTextSource` moved in as internal helpers per D1's
      "pure, no app coupling" note. One deviation from the design sketch:
      resolver return types keep their real `| ErrorCanvasContent` unions
      (design.md's interface pseudocode omitted them) since `openCanvas`
      already accepts the full `AttachmentCanvasContent` union and the
      actual app resolvers return that wider type — narrowing to the sketch
      would have required lossy casts at the app wiring boundary for no
      behavioral gain. `resolveReferencePdfContent` is typed synchronous
      (`PdfCanvasContent | null`, not `Promise<...>`) to match the real
      `referenceAttachmentToPdfCanvasContent` implementation, which the
      original hook never awaited either.)
- [x] 2.3 Port `apps/chat/src/hooks/attachment/tests/useOpenAttachmentCanvas.spec.ts`
      to `libs/attachment-canvas/src/hooks/useOpenAttachmentCanvas/tests/useOpenAttachmentCanvas.spec.ts`,
      replacing context/util mocks with directly-injected resolver stubs,
      covering every existing scenario without loss.
      (All routing/html-routing/visualizer-routing/annotationsToPdfHighlights
      scenarios ported (41 tests total, up from the original's ~34, since
      `hasAttachmentTextSource`/`findVisualizerForMime` are no longer
      separately mockable and three new scenarios were added to cover
      `onBeforeOpen` panel-coordination ordering, the Audio no-panel-close
      case, and the unrecognized-attachment-type fallback that the original
      suite exercised only indirectly.)
- [x] 2.4 Export `useOpenAttachmentCanvas`, `findVisualizerForMime`, and
      their supporting types from `libs/attachment-canvas/src/index.ts`.
      (Exported `useOpenAttachmentCanvas`, `findVisualizerForMime`, and
      types `UseOpenAttachmentCanvasResolvers`, `UseOpenAttachmentCanvasOptions`,
      `OpenAttachmentCanvas`.)
- [x] 2.5 Update `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`'s
      call sites (`ConversationSourcesPanel.tsx`, `ConversationView.tsx`,
      `NewConversationComposer.tsx`, `useSkillFilePreviewSync.ts`) to import
      from `@epam/ai-dial-attachment-canvas` and supply
      `apps/chat/src/utils/attachment-canvas.ts`'s existing resolvers,
      `resolveDialUrl`, `useCustomVisualizers()`'s result, `useTheme()`'s
      `currentTheme`, and an `onBeforeOpen` composing `closePanel`+
      `closeSourcesPanel`.
      (Added the shared app-level wrapper hook
      `apps/chat/src/hooks/attachment/useAttachmentCanvasResolvers.ts`
      (per this task's suggestion) that bundles the resolvers/options object
      once, since all 4 call sites need identical wiring; each call site now
      does `const { resolvers, options } = useAttachmentCanvasResolvers();
      const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);`.
      `resolveReferencePdfContent` is wrapped in the app hook — not passed
      directly — because `referenceAttachmentToPdfCanvasContent` takes an
      `AttachmentResource` (type/url/title) built from `attachment.referenceUrl`,
      not the `DisplayAttachment` itself, matching the original hook's own
      inline construction of that object.)
- [x] 2.6 Update the mocked-hook call-site tests
      (`ConversationSourcesPanel.spec.tsx`, `NewConversationComposer.spec.tsx`,
      `ConversationRoute.spec.tsx`, `ConversationRoute.integration.spec.tsx`,
      `SkillEditor.spec.tsx`) to mock the new import path.
      (All 5 files updated: each now mocks `@epam/ai-dial-attachment-canvas`'s
      `useOpenAttachmentCanvas` (extending the existing partial mock in
      `SkillEditor.spec.tsx` rather than duplicating it) plus the new
      `useAttachmentCanvasResolvers` wrapper hook, so none of the real
      context hooks it composes need a provider in these tests.)
- [x] 2.7 Delete `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`
      and its superseded test file.
      (Deleted both files.)
- [x] 2.8 Add a new-hook subsection with a type-correct usage example to
      `libs/attachment-canvas/README.md`.
      (Added "Hooks" section documenting `useOpenAttachmentCanvas` and
      `findVisualizerForMime` with compiling usage examples; package.json
      needed no new peer dependency, confirmed by inspection.)
- [x] 2.9 Run `npm exec nx build ai-dial-attachment-canvas && npm exec nx test ai-dial-attachment-canvas`,
      compare bundle size against the slice-1 baseline, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (Build: `index.js` 1,334.96 kB / gzip 399.59 kB vs. the slice-1
      baseline 1,331.85 kB / gzip 398.88 kB — delta +3.11 kB / +0.71 kB
      gzip, from the added hook's code. Lib test: 8 files / 112 tests pass
      (was 5 files / ~54 tests pre-slice, the delta being the new
      `visualizer.spec.ts` and `useOpenAttachmentCanvas.spec.ts` suites).
      `nx affected -t test lint build --base=origin/development`: chat app
      typecheck/lint/test/build all pass (189 test files / 2796 tests, 2
      skipped); `ai-dial-attachment-canvas` build/lint/test all pass. Two
      pre-existing failures unrelated to this slice, from the parallel
      slice-3/slice-4 work on this same branch (left untouched per this
      task's rules): `@epam/ai-dial-quotations:typecheck` fails on
      `useCitationMarkdownComponents.spec.tsx:150` (`AnnotationGroup` not
      assignable to `never`) and `@epam/ai-dial-chat-hooks:lint` fails with
      9 `import/order`/`prettier` errors in `dial-file-manager-mapping.util.ts`,
      `dial-file-manager-path.util.ts`, `dial-files-api.ts`, and their
      tests.)

## 3. Slice 3 — Citation markdown (`@epam/ai-dial-quotations`)

- [x] 3.1 Assess and record the `react-markdown` peer-dependency/externals
      decision (design.md D3); add it to
      `libs/quotations/package.json` peerDependencies and
      `vite.config.mts` externals.
      (Added `react-markdown: ^10.1.0` to peerDependencies and to
      `vite.config.mts`'s `rollupOptions.external`. Usage stays type-only
      (`import type { Components }`), so `@nx/dependency-checks` flagged it
      as unused; added a scoped `ignoredDependencies: ['react-markdown']`
      entry to `libs/quotations/eslint.config.mjs` with a comment
      explaining why, rather than suppressing the rule project-wide.)
- [x] 3.2 Implement `useCitationMarkdownComponents` in
      `libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx`
      with the `onPreview`/`onOpenInBrowser`/`buildLabels` callback
      contract from design.md D2, preserving sentinel injection,
      memoization/stable-reference behavior, and the empty-groups fast
      path documented in `specs/quotations-citation-markdown/spec.md`.
      (Implemented with no import of `@epam/ai-dial-attachment-canvas`,
      `react-i18next`, or any app-owned helper. `onPreview` is wrapped in
      a `handlePreview` callback only to add the `group` argument the new
      contract requires — no content-type branching added.)
- [x] 3.3 Author
      `libs/quotations/src/hooks/useCitationMarkdownComponents/tests/useCitationMarkdownComponents.spec.tsx`
      from scratch (no prior test exists) covering: empty-groups fast path,
      sentinel injection/replacement, malformed/out-of-range sentinel
      index, missing character-range selector, stable component identity
      across unrelated re-renders, recompute on groups
      empty↔non-empty transition, `onPreview`/`onOpenInBrowser` delegation,
      and `buildLabels` invocation per group.
      (11 scenarios authored. Structural/interaction scenarios render
      through a `Host` component wrapping `ReactMarkdown` +
      `CitationCardProvider` and assert via `screen`/`userEvent` (avoids
      `testing-library/no-node-access` reaching into `.props`); the
      out-of-range-sentinel scenario uses a literal `⟦C5⟧` string already
      present in the raw content — the realistic way that case arises,
      since the hook's own sentinel generation never emits an out-of-range
      index. Identity/memoization scenarios use `renderHook` directly.)
- [x] 3.4 Export the hook and its callback/label types from
      `libs/quotations/src/index.ts`.
      (Exported `useCitationMarkdownComponents` and
      `UseCitationMarkdownComponentsCallbacks`; `CitationCardLabels`/
      `CitationMarkerLabels` were already exported from their component
      modules.)
- [x] 3.5 Update `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`
      to import from `@epam/ai-dial-quotations` and compose `onPreview` from
      the existing `annotationToPdfCanvasContent`/`openCanvas`/
      `annotationToDisplayAttachment` branch, `onOpenInBrowser` from
      `openAnnotationAttachment`, and `buildLabels` from `useTranslation()`'s
      `t()` plus `translation-keys.ts`'s enums.
      (Added `useAttachmentCanvas` import from `@epam/ai-dial-attachment-canvas`
      directly in this component per design.md D2; composed
      `handleCitationPreview`/`handleCitationOpenInBrowser`/
      `buildCitationLabels` reproducing the original hook's inline logic
      verbatim, memoized into a stable `citationCallbacks` object.)
- [x] 3.6 Delete `apps/chat/src/hooks/citations/useCitationMarkdownComponents.tsx`.
      (Deleted; the now-empty `hooks/citations/` directory has no other
      files and no remaining references.)
- [x] 3.7 Add a new-hook subsection with a type-correct usage example to
      `libs/quotations/README.md`.
      (Added a `useCitationMarkdownComponents` subsection under Hooks, plus
      the `react-markdown` peer dependency entry.)
- [x] 3.8 Run `npm exec nx build ai-dial-quotations && npm exec nx test ai-dial-quotations`,
      compare bundle size against the slice-1 baseline, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (Build: `index.js` 11.67 kB / gzip 4.15 kB vs. the slice-1 baseline
      10.62 kB / gzip 3.83 kB — a ~1 kB increase from the new hook, not the
      tens-of-kB jump that would indicate `react-markdown`'s tree got
      inlined, confirming the externals entry works. Test: 57/57 passing
      (11 new). Lint/typecheck: clean after fixing import order, prettier
      formatting, and the `ignoredDependencies` entry above.
      `nx affected --target=test,lint,build` could not be run clean
      end-to-end because it also spans `@epam/ai-dial-attachment-canvas`
      and `@epam/ai-dial-chat-hooks`, which other agents are concurrently
      editing in this workspace (slices 2 and 4-7) and which currently fail
      lint/typecheck for reasons unrelated to this slice — confirmed via
      `git stash` that those failures pre-date this slice's changes.
      `ai-dial-quotations`'s own build/test/lint/typecheck all pass in
      isolation, and the sole `apps/chat` call site
      (`ConversationMessageItem.spec.tsx`, 9 tests) passes directly via
      `vitest run`.)

## 4. Slice 4 — File-manager domain contracts, models, and utilities

- [x] 4.1 Add `DialFilesApi` (design.md D4) to
      `libs/chat-hooks/src/files/dial-files-api.ts`.
      (Interface mirrors `files.api.ts`'s exact exported signatures per the
      task 1.1 adjustments: `listFiles`/`listPublicFiles`/`listSharedFiles`
      take a params object (+ optional `signal` for `listFiles`) and resolve
      `ListFilesResponseDto`; `uploadFile` accepts
      `AbortSignal | DialFilesApiUploadOptions` — a new port-local type
      mirroring `UploadFileWithProgressOptions`'s shape rather than importing
      the app's transport type — and resolves `FileUploadResponseDto`;
      `createFolder` takes a `CreateFolderDto`; `downloadFile`/
      `downloadArchive` resolve the raw `Response`. All 16 methods typed
      against `@epam/ai-dial-chat-api-client` DTOs, no duplicate models.)
- [x] 4.2 Move `dial-file-manager.types.ts` and `dial-file-manager.model.ts`
      to `libs/chat-hooks/src/files/` verbatim.
      (Only relative imports adjusted: `FileUploadBatchState` now from
      `./upload-batch.types`, `DialFileManagerActionProfile`/
      `DialFileManagerVariant` from `./file-manager-variant`. `NotificationVariant`
      still comes from `@epam/ai-dial-ui-kit`, which this slice adds as a new
      `chat-hooks` peer dependency — see 4.5 note.)
- [x] 4.3 Move `dial-file-manager-copy-move.util.ts`,
      `dial-file-manager-mapping.util.ts` (rewriting `fetchByTab`/
      `fetchForSearch` to call the injected `DialFilesApi` instead of
      `server-api/files.api`), and `dial-file-manager-path.util.ts` to
      `libs/chat-hooks/src/files/`, each with its ported/authored tests.
      (No test file existed for any of the three utils under
      `apps/chat/src/hooks/files/tests/` — confirmed by directory listing
      (only sub-hook test folders + the three hook-level specs existed) — so
      all three test files are newly authored:
      `tests/dial-file-manager-copy-move.util.spec.ts` (6 scenarios, incl.
      the rename-vs-move split), `tests/dial-file-manager-path.util.spec.ts`
      (31 scenarios covering every exported function), and
      `tests/dial-file-manager-mapping.util.spec.ts` (28 scenarios, incl.
      `fetchByTab`/`fetchForSearch` against a hand-rolled `DialFilesApi` test
      double covering every tab-dispatch branch). `fetchByTab`/
      `fetchForSearch` take the injected `DialFilesApi` as their new first
      parameter.)
- [x] 4.4 Move `apps/chat/src/types/file-manager-variant.ts` to
      `libs/chat-hooks/src/files/file-manager-variant.ts`.
      (Consumer check: beyond the file-manager hooks, `DialFileManagerModal.tsx`,
      `DialFileManagerPage.tsx`, and `DialFileManagerShell.tsx` (plus their
      specs) still import the app-local file directly — these are migrated
      in slice 7 (task 7.5), not this slice. Per the task's own instruction,
      the original `apps/chat/src/types/file-manager-variant.ts` is left in
      place, unmodified, alongside the new lib copy; it will be deleted in
      slice 7 once those call sites move to `@epam/ai-dial-chat-hooks`.)
- [x] 4.5 Move `apps/chat/src/utils/resolve-dial-file-api-path.ts` and
      `apps/chat/src/utils/file-name.ts` (`sanitizeFileName`) to
      `libs/chat-hooks/src/files/`, and add a local copy of
      `safeDecodeURI` (from `apps/chat/src/utils/string-utils.ts`) rather
      than widening that file's export surface.
      (Consumer check: `file-name.ts`'s `sanitizeFileName` is also imported
      by `apps/chat/src/components/CatalogView/CatalogView.tsx`, unrelated to
      file-manager — the original app file is left in place per the task's
      instruction, not deleted; flagged here as instructed. `resolveRelativeDialFilePath`
      is duplicated locally in the lib's `resolve-dial-file-api-path.ts`
      exactly as written in `apps/chat/src/utils/dial-file.ts` (confirmed
      that function's logic first); `dial-file.ts` itself keeps its other
      consumers untouched. Deviation from design.md's literal type source:
      `resolve-dial-file-api-path.ts` and `dial-file-manager-path.util.ts`
      import `DialFile`/`DialFileNodeType`/`DialFilePermission` from
      `@epam/ai-dial-react-file-manager` (already a `chat-hooks` peer
      dependency and confirmed to re-export byte-identical enum values —
      `item`/`folder`, `READ`/`WRITE`/`SHARE`) instead of
      `@epam/ai-dial-ui-kit` as the current app file does, avoiding a new
      dependency for those two files. `dial-file-manager.types.ts` and
      `file-name.ts` still need `NotificationVariant`/`NOT_ALLOWED_SYMBOLS_REGEXP`
      from `@epam/ai-dial-ui-kit` (no such re-export exists on
      `react-file-manager`'s public surface), so `@epam/ai-dial-ui-kit` is
      added as a new `chat-hooks` peerDependency + `vite.config.mts` external
      — consistent with the existing pattern of already-published DIAL
      packages (`quotations`/`source-panel`/`attachment-canvas`/`share` all
      already declare it as a peer) rather than a raw third-party library.)
- [x] 4.6 Move `apps/chat/src/components/DialFileManagerModal/types/upload.ts`
      (`FileUploadStatus`/`FileUploadEntry`/`FileUploadBatchState`) to
      `libs/chat-hooks/src/files/`, updating
      `apps/chat/src/components/DialFileManagerModal/UploadProgressModal`'s
      import.
      (Renamed to `upload-batch.types.ts` to match lib file-naming
      conventions. `UploadProgressModal.tsx`'s import switched to
      `@epam/ai-dial-chat-hooks` as instructed. The original app file is
      left in place, unmodified — it still has other untouched consumers
      (`useDialFileUploadBatch.ts`, `DialFileManagerShell.tsx`, the app-local
      `dial-file-manager.types.ts`/`dial-file-manager-mapping.util.ts`) that
      migrate in slices 6–7; it is deleted in task 7.7 alongside the rest of
      `apps/chat/src/hooks/files/**`.)
- [x] 4.7 Add a thin `DialFilesApi` adapter in
      `apps/chat/src/server-api/dial-files-api.adapter.ts` delegating to
      the existing, unchanged `files.api.ts`.
      (Every method signature in `files.api.ts` already matches the
      `DialFilesApi` port exactly, so the adapter is a direct property-map —
      no wrapping logic needed. `files.api.ts` itself untouched.)
- [x] 4.8 Run `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`,
      compare bundle size against the slice-1 baseline, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (Build: `index.js` 54.44 kB / gzip 16.41 kB vs. the slice-1 baseline
      43.81 kB / gzip 13.24 kB — delta +10.63 kB / +3.17 kB gzip, from the
      new domain types/models/utils/port (no new runtime deps bundled;
      `@epam/ai-dial-ui-kit` added as external, not inlined). Test: 33 files
      / 356 tests pass, including the 5 new `files/tests/*.spec.ts` files
      (91 tests). Lint: clean (fixed import/order + prettier formatting via
      `eslint --fix`, the same errors slice-2's notes above already
      observed mid-flight from a concurrent agent). `apps/chat` typecheck
      (`tsconfig.app.json` and `tsconfig.spec.json`) passes with the new
      `dial-files-api.adapter.ts` and the `UploadProgressModal.tsx` import
      change. `nx affected -t test lint build --base=origin/development`
      completed successfully (exit 0): "Successfully ran targets test,
      lint, build for 4 projects and 50 tasks they depend on" — the 4
      affected projects were `@epam/chat`, `@epam/ai-dial-chat-hooks`,
      `@epam/ai-dial-attachment-canvas`, `@epam/ai-dial-quotations` (the
      latter two affected by other agents' concurrent slice-2/3 work on
      this same branch, not by this slice). No failures. An ambient
      Nx-workspace-sync warning seen earlier in this slice (confirmed via
      `git stash` to pre-date this slice's own changes, caused by the
      other agents' in-progress `attachment-canvas` edits) had resolved
      itself by the time this run executed.)

## 5. Slice 5 — Listing, metadata, and tab configuration

- [x] 5.1 Implement `useDialFileListing` in
      `libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts`
      accepting the injected `DialFilesApi` and a structured
      `onNotification` reason instead of `react-i18next`, preserving cache
      ownership, tab-switch reset, search debounce/cancellation, and
      expand/popup-preload deduplication exactly.
      (Implemented verbatim against the app source, substituting only the
      `filesApi: DialFilesApi` param for `server-api/files.api` (passed
      through to slice 4's `fetchByTab`/`fetchForSearch` and used directly
      for `listSharedByMe`) and removing `useTranslation`/`t()` — the three
      `FolderLoadError` toast call sites now call `onNotification` with
      `{ variant: NotificationVariant.Error, reason:
      FileManagerNotificationReason.FolderLoadFailed }` and no `message`.
      Extended slice 4's `FileManagerNotification` (in
      `dial-file-manager.types.ts`) with a new `FileManagerNotificationReason`
      enum and an optional `reason` field, and made `message` optional
      instead of inventing a separate, incompatible notification shape —
      `useDialFileMutations`/`useDialFileSharing`/`useDialFileUploadBatch`
      (slice 6) can reuse the same type. All other logic — cache/permissions
      cache ownership, tab-switch reset, `invalidateFolders`'
      visible-vs-non-visible refetch/purge split, `mergeCreatedFolder`,
      search's 300ms debounce/cancellation/Shared-root client-side filter,
      expand/popup-preload dedup via `expandingApiPathsRef`/
      `erroredApiPathsRef`, and Shared-tab owner-bucket resolution via
      `sharedRootMetaRef` — is unchanged.)
- [x] 5.2 Port `useDialFileListing.spec.tsx`'s 11 scenarios into the lib.
      (Ported to
      `libs/chat-hooks/src/files/useDialFileListing/tests/useDialFileListing.spec.tsx`
      with no scenario lost: tab-switch reset, the 3 `onSearchFiles`
      scenarios (debounce, in-flight cancellation, nested-path
      reconstruction), the 4 `sharedWithMeIds` scenarios, and the 3
      `sharedByMePaths` scenarios. The `vi.mock('.../server-api/files.api')`
      module mock is replaced by a hand-rolled `makeFilesApi()` test double
      (same shape as slice 4's `dial-file-manager-mapping.util.spec.ts`
      helper) passed as the `filesApi` option; all assertions against
      `mockListFiles`/`mockListSharedFiles`/`mockListPublicFiles`/
      `mockListSharedByMe` now assert against `filesApi.listFiles`/etc.
      directly.)
- [x] 5.3 Implement `useDialFileMetadata` with the same `DialFilesApi`/
      `onNotification` substitution, and port its 6 test scenarios.
      (Implemented in
      `libs/chat-hooks/src/files/useDialFileMetadata/useDialFileMetadata.ts`;
      bucket-resolution logic per item origin and
      `mapFileMetadataToDialFile`'s field-preservation are untouched. The
      `GetInfoError` toast becomes `{ variant: NotificationVariant.Error,
      reason: FileManagerNotificationReason.MetadataLoadFailed }`. Ported
      all 6 scenarios — including the renamed "shows an error toast" case,
      now asserting the structured `{ variant, reason }` payload instead of
      a translated message — to
      `libs/chat-hooks/src/files/useDialFileMetadata/tests/useDialFileMetadata.spec.tsx`.)
- [x] 5.4 Implement `useDialFileManagerTabConfig`, replacing
      `AppConfigContext` with a plain `fileManagerTabs: string[] | undefined`
      parameter, and port its 5 test scenarios.
      (Implemented in
      `libs/chat-hooks/src/files/useDialFileManagerTabConfig/useDialFileManagerTabConfig.ts`.
      Deviation from the source: since the parameter's type is
      `string[] | undefined` (not the app's always-defined
      `config.fileManagerTabs: string[]`), added an explicit
      `isTabEnabled(tabId)` helper where `fileManagerTabs == null` is treated
      as unrestricted (every tab in `allTabs` stays enabled, reset never
      fires) — the spec and design.md are silent on the undefined case, and
      "no configured restriction" is the only behavior consistent with the
      hook's own reset-only-when-excluded contract. All 5 original scenarios
      ported to
      `libs/chat-hooks/src/files/useDialFileManagerTabConfig/tests/useDialFileManagerTabConfig.spec.ts`
      (replacing the `AppConfigContext` mock with a plain `fileManagerTabs`
      argument), plus one new scenario covering the `undefined` case.)
- [x] 5.5 Export all three hooks and their types from
      `libs/chat-hooks/src/index.ts`.
      (Added three `export *` lines for
      `./files/useDialFileListing/useDialFileListing`,
      `./files/useDialFileManagerTabConfig/useDialFileManagerTabConfig`, and
      `./files/useDialFileMetadata/useDialFileMetadata`.)
- [x] 5.6 Run `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`,
      compare bundle size against the slice-4 baseline, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (Build: `index.js` 63.33 kB / gzip 18.52 kB vs. the slice-4 baseline
      54.44 kB / gzip 16.41 kB — delta +8.89 kB / +2.11 kB gzip, from the
      three new hooks. Test: 36 files / 379 tests pass (up from slice 4's 33
      files / 356 tests — the 23 new tests are this slice's 11 + 6 + 6
      scenarios). Lint: initially 7 `import/order`/`prettier` errors across
      the 3 new source/test files, fixed via `eslint --fix`; clean after.
      `nx affected -t test lint build --base=origin/development` completed
      successfully (exit 0): "Successfully ran targets test, lint, build for
      4 projects and 50 tasks they depend on" (57/62 tasks served from
      cache). `@epam/chat`'s own suite: 189 test files / 2796 tests passed, 2
      skipped; build succeeded; lint reported 0 errors / 20 warnings, all
      pre-existing and unrelated to this slice (non-null-assertion and
      unused-var warnings in scheduled-task/conversation-route files this
      slice never touched). No failures anywhere in the run.)

## 6. Slice 6 — Mutations, sharing, and upload

- [x] 6.1 Implement `useDialFileMutations` with the `DialFilesApi` port,
      the `FileNameValidationError` result type (design.md D5), and the
      `onOperationSuccess`/`FileOperationSuccessEvent` structured event
      (design.md D6) replacing `useOperationNotification`; preserve the
      rename-vs-move split, parallel `Promise.all` execution, and
      independent `AbortController`-based cancellation for copy/move.
      (Implemented in
      `libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts`.
      Added `FileNameValidationError`, `FileOperationKind`,
      `FileOperationSuccessEvent` to `dial-file-manager.types.ts` per D5/D6,
      and a new `download-destination.ts` file exporting
      `DownloadDestinationHandlers`/`DownloadDestination`/
      `DownloadDestinationType` — a lib-local mirror of
      `apps/chat/src/utils/file-download.ts`'s `prepareDownloadDestination`/
      `triggerBrowserDownload` shapes, injected as `downloadDestination`.
      Extended `FileManagerNotificationReason` with 18 new members covering
      every distinct failure/success toast the original hook produced outside
      `onOperationSuccess`'s 8 kinds (create-folder/download/delete/rename/
      move/copy failures, plus delete's own success case, which the original
      routed through `onNotification` with a pre-rendered title/message
      rather than `useOperationNotification` — carried forward as
      `FilesDeleted`/`FilesDeletePartiallyFailed` with new optional
      `count`/`name`/`folder`/`names`/`restCount` fields added to
      `FileManagerNotification` for the data those reasons need to
      interpolate). `onCreateFolderValidate`/`onRenameValidate` preserve each
      function's own exact validation order from the original source
      (they differ from each other: create checks forbidden-symbols before
      leading-dot before reserved-name; rename checks reserved-name before
      forbidden-symbols, with no leading-dot check at all) — kept exactly as
      found rather than unifying them. The `forbiddenSymbols` error's
      `symbols` field carries the ui-kit `NOT_ALLOWED_SYMBOLS` constant
      (matching what the original message always interpolated, regardless of
      which regex — the path-separator check or a caller `forbiddenSymbolsRegExp`
      — triggered it). The multi-file-download `onOperationSuccess` event
      omits `name` (only `{ kind: 'filesDownloaded', count }`), matching the
      spec's example scenario; single-item downloads still carry `name` (and
      `count: 1` for a real file, no count for a lone downloaded folder,
      matching the original's two separate notify calls).)
- [x] 6.2 Port `useDialFileMutations.spec.tsx` (1175 lines) into the lib,
      adjusting fixtures for the injected `DialFilesApi`,
      `FileNameValidationError`, and `onOperationSuccess` contracts without
      losing any scenario.
      (Ported to
      `libs/chat-hooks/src/files/useDialFileMutations/tests/useDialFileMutations.spec.tsx`.
      All ~40 original scenarios carried over (validation, create-folder,
      rename-validate, move/rename split, copy, cancel-on-abort) plus new
      scenarios this slice added since the original suite had zero
      `onDeleteFiles`/`onDownloadFiles` coverage despite those being real
      exported behaviors: download single-file/multi-file success and
      failure, and delete success/partial-failure/request-failure. 48 tests
      total.)
- [x] 6.3 Implement `useDialFileSharing` with the `DialFilesApi` port and
      structured `onNotification`, and port its 3 test scenarios.
      (Implemented in
      `libs/chat-hooks/src/files/useDialFileSharing/useDialFileSharing.ts`;
      added `UnshareFailed`/`RemoveAccessFailed` to the shared enum. Ported
      to `libs/chat-hooks/src/files/useDialFileSharing/tests/useDialFileSharing.spec.tsx`
      — the original file in fact had 5 scenarios (2 success + 2 failure +
      1 batch bucket/path resolution), all carried over.)
- [x] 6.4 Implement `useDialFileUploadBatch` with the `DialFilesApi` port
      and structured `onNotification`, preserving concurrency-limited
      workers, per-file conflict resolution, cancellation, and the
      archive-conflict-fallback heuristic; port its 7 test scenarios.
      (Implemented in
      `libs/chat-hooks/src/files/useDialFileUploadBatch/useDialFileUploadBatch.ts`,
      importing `updateEntry`/`resolveOwnerCoords`/`UPLOAD_CONCURRENCY`/
      `sanitizeFileName`/`virtualPathToApiPath`/`upload-batch.types` from
      slice 4's lib files instead of the app's component-folder/util
      locations. Added `UploadFailed`/`UploadCompleted`/`UploadArchiveFailed`/
      `UploadArchivePartiallyFailed`/`UploadArchiveRequestFailed` to the
      shared enum; the archive-failure reasons carry `names`/`restCount`
      (up to 5 failed entries + a rest count) instead of a pre-formatted
      string. Ported the original's 7 scenarios to
      `libs/chat-hooks/src/files/useDialFileUploadBatch/tests/useDialFileUploadBatch.spec.tsx`
      plus 2 new scenarios authored to cover the ≤3-concurrent-workers and
      cancellation requirements from `chat-hooks-file-manager-upload/spec.md`
      that the original app suite exercised only implicitly — 17 tests
      total.)
- [x] 6.5 Export all three hooks and their types from
      `libs/chat-hooks/src/index.ts`.
      (Added `export *` lines for `useDialFileMutations`, `useDialFileSharing`,
      `useDialFileUploadBatch`, and `./files/download-destination`.)
- [x] 6.6 Run `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`,
      compare bundle size against the slice-5 baseline, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (Build: `index.js` 78.24 kB / gzip 22.20 kB vs. the slice-5 baseline
      63.33 kB / gzip 18.52 kB — delta +14.91 kB / +3.68 kB gzip, from the
      three new hooks plus the new notification/validation/event types. Test:
      39 files / 447 tests pass (up from slice 5's 36 files / 379 tests — the
      68 new tests are this slice's 48 + 5 + 17-2-overlap... i.e. mutations
      48, sharing 5, upload 15 net-new files but 17 total incl. the 2 new
      concurrency/cancellation scenarios). Lint: fixed via `eslint --fix`
      (import/order + prettier) plus one manual removal of an unused
      `beforeEach` import; clean after.
      `npx nx affected -t test lint build --base=origin/development`
      completed successfully: "Successfully ran targets test, lint, build for
      4 projects and 50 tasks they depend on" (57/62 tasks served from
      cache), 0 lint errors (20 pre-existing warnings unrelated to this
      slice), no failures.)

## 7. Slice 7 — Composition and grid-editing scroll

- [x] 7.1 Implement `useDialFileManager` composing the five sub-hooks from
      slices 5–6, accepting `filesApi: DialFilesApi`,
      `labels: Partial<Record<DialFileManagerActions, string>>`,
      `locale: string`, and `fileManagerTabs: string[] | undefined`,
      preserving the exact `actionLabels`/`uploadEnabled`/`visibleColumns`/
      `isAnyOperationInProgress` gating matrices.
      (Implemented in `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`.
      Deviation from this task's literal option list, confirmed against the
      original source rather than assumed: the original app `useDialFileManager`
      never called `useDialFileManagerTabConfig` itself — that hook is a
      sibling call `DialFileManagerModal.tsx`/`DialFileManagerPage.tsx` make
      directly (confirmed unchanged in this slice, already exported standalone
      since slice 5) — so `fileManagerTabs` is **not** a composer option; adding
      an unused parameter would violate "every declared prop must be read".
      Two option additions beyond design.md's list, both required to keep the
      composer i18n-free while preserving exact original output: `disabledNewButtonTooltip: string`
      (the original computed this via a raw `t('dialFileManager.noPermissionToCreate')`
      call outside `actionLabels`; now host-supplied and passed straight
      through) and `buildValidationErrorMessage: (error: FileNameValidationError, item?: DialFile) => string`
      (bridges `useDialFileMutations`'s slice-6 `FileNameValidationError`-returning
      validate functions back to the `string | null` shape `UseDialFileManagerResult.onCreateFolderValidate`/
      `onRenameValidate` must keep, since `@epam/ai-dial-react-file-manager`'s
      `DialFileManager` component itself expects that exact signature — `item`
      is passed only for rename so the host can reproduce the original's
      file-vs-folder wording split for the `forbiddenSymbols` reason).
      `actionLabels`/`uploadEnabled`/`visibleColumns`/`isAnyOperationInProgress`
      ported with the same branching as the original, verified by the 76-test
      suite in 7.2.)
- [x] 7.2 Port `useDialFileManager.spec.tsx` (2001 lines, ~65 scenarios)
      into the lib, adjusting fixtures for the four newly-injected
      parameters without losing any scenario.
      (Ported to `libs/chat-hooks/src/files/useDialFileManager/tests/useDialFileManager.spec.tsx`
      via a bracket-aware scripted rewrite (verified brace/paren balance) that
      wraps every `useDialFileManager({...})` call in a `buildOptions({...})`
      helper supplying `filesApi`/`labels`/`locale`/`disabledNewButtonTooltip`/
      `downloadDestination`/`buildValidationErrorMessage`/`onNotification`/
      `onOperationSuccess` defaults, replacing the `vi.mock('server-api/files.api')`
      module mock with a hand-rolled `DialFilesApi` test double (same pattern
      as slices 4–6). Every original scenario carried over; the ~10 assertions
      that checked pre-translated toast/notification text (e.g.
      `'dialFileManager.folderCreateError'`, `'entityNotifications.file.downloaded'`)
      were converted to assert the new structured `{variant, reason}` /
      `{kind, name, count}` payloads instead, since that text no longer exists
      inside the lib. 76 tests total (65 ported + `it.each` expansions already
      present in the original counted individually). No scenario dropped.)
- [x] 7.3 Add `ag-grid-community` to `libs/chat-hooks/package.json`
      peerDependencies and `vite.config.mts` externals; implement
      `useGridEditingScroll` per design.md D9's narrow-exception contract
      (`{ handleGridApiChange, reset }`, internals only, no AG Grid type
      escapes the public contract), and port its 9 test scenarios.
      (Added `ag-grid-community: "^35.3.0"` (matching the version already
      installed transitively via `@epam/ai-dial-react-file-manager`) to both
      lists. Implemented in
      `libs/chat-hooks/src/files/useGridEditingScroll/useGridEditingScroll.ts`
      verbatim from the app source — no behavior change, only added a
      `UseGridEditingScrollResult` return-type export per this lib's JSDoc
      convention. Ported all 9 scenarios verbatim to
      `libs/chat-hooks/src/files/useGridEditingScroll/tests/useGridEditingScroll.spec.ts`.)
- [x] 7.4 Export `useDialFileManager` and `useGridEditingScroll` (with
      their types) from `libs/chat-hooks/src/index.ts`.
      (Added `export * from './files/useDialFileManager/useDialFileManager'`
      and `export * from './files/useGridEditingScroll/useGridEditingScroll'`.)
- [x] 7.5 Update `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`,
      `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`, and
      `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`
      to import from `@epam/ai-dial-chat-hooks`, supplying the new
      `dial-files-api.adapter.ts` instance, `labels` built from
      `DialFileManagerI18nKeys`/`ButtonsI18nKeys` via `useTranslation()`,
      `locale` from `i18n.language`, `fileManagerTabs` from
      `AppConfigContext`, and mapping `onOperationSuccess`/structured
      `onNotification` events to `useOperationNotification`/
      `showErrorNotification` calls.
      (All three updated to import `useDialFileManager`/`useDialFileManagerTabConfig`/
      `DialFileManagerVariant`/`DialFileManagerActionProfile`/`useGridEditingScroll`/
      `FileUploadStatus`/`UseDialFileManagerResult` from `@epam/ai-dial-chat-hooks`.
      `dialFilesApiAdapter` is slice 4's already-exported singleton object, used
      directly (no "new instance" needed — it has no constructor state).
      Added a new shared hook,
      `apps/chat/src/components/DialFileManagerShell/useDialFileManagerHostOptions.ts`,
      building the host-owned portion of `useDialFileManager`'s options once
      (`filesApi`, `labels`, `locale`, `disabledNewButtonTooltip`,
      `downloadDestination`, `buildValidationErrorMessage`, `onNotification`,
      `onOperationSuccess`) so Modal and Page don't duplicate the wiring; both
      spread it and add their own `bucket`/`activeTab`/`rootLabel`/`variant`/
      `actionProfile`/`forbiddenSymbolsRegExp`. The structured-event-to-toast
      mapping logic itself lives in a new
      `apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`
      (`buildFileManagerNotificationOptions`, `handleFileOperationSuccess`,
      `buildValidationErrorMessage`), reproducing every pre-extraction toast's
      exact title/message construction from the original app hooks' source
      (confirmed line-by-line against the git-history app hooks before
      deleting them in 7.7) — including the delete/upload-archive
      names+restCount formatting and the copy/move success titles, which the
      original routed through raw `onNotification`+`t()` rather than through
      `useOperationNotification`, corrected against the actual source instead
      of design.md D6's more general description. Added 6 new
      `DialFileManagerI18nKeys` members (`FolderNameEmpty`, `FolderNameHidden`,
      `FolderNameReserved`, `FolderNameTooLong`, `FolderNameDuplicate`,
      `NoPermissionToCreate`) pointing at existing `en.json` strings that
      previously had only raw string-literal keys in the deleted app hook.
      **Follow-up fix (applied after this slice landed, during final
      verification):** the `fileRenamed` regression noted below was closed —
      `FileOperationSuccessEvent` gained an `isFolder?: boolean` field, set
      from `renamedDto.nodeType === RenameItemDtoNodeTypeEnum.Folder` in
      `useDialFileMutations.ts`, and
      `file-manager-notification-adapter.ts`'s `handleFileOperationSuccess`
      now reports `NotifiableEntity.Folder`/`NotifiableEntity.File`
      accordingly — restoring byte-for-byte parity with the original
      `nodeType`-branched toast. A new folder-rename test was added to
      `useDialFileMutations.spec.tsx`, and a new
      `tests/file-manager-notification-adapter.spec.ts` (previously absent)
      was added covering both branches plus a couple of
      `buildFileManagerNotificationOptions`/`buildValidationErrorMessage`
      smoke cases. `DialFileManagerShell.tsx` also now imports
      `useGridEditingScroll`/`FileUploadStatus`/`UseDialFileManagerResult`/
      `DialFileManagerVariant`/`DialFileManagerActionProfile` from the lib but
      keeps its own `getParentFolderPath` import from
      `apps/chat/src/utils/resolve-dial-file-api-path.ts` — that file's
      lib-local mirror is not exported from `@epam/ai-dial-chat-hooks`'s public
      barrel.)
- [x] 7.6 Update `DialFileManagerModal.spec.tsx`,
      `DialFileManagerShell.spec.tsx`, `NewConversationComposer.spec.tsx`,
      and `DialFileManagerPage.spec.tsx` for the new import paths and
      injected-port fixtures.
      (`DialFileManagerModal.spec.tsx` and `DialFileManagerPage.spec.tsx`: import
      paths switched to `@epam/ai-dial-chat-hooks`, and the module mock changed
      from `vi.mock('.../hooks/files/useDialFileManager')` to a partial
      `vi.mock('@epam/ai-dial-chat-hooks', importOriginal)` that overrides only
      `useDialFileManager` (keeping `useDialFileManagerTabConfig` real, since
      it is no longer inlined in the component and must actually run against
      the mocked `AppConfigContext`). Modal's one test that asserted
      `onNotification: mockShowNotification` was rewritten to invoke the
      captured `onNotification` callback with a structured
      `{variant, reason: FolderLoadFailed}` event and assert the translated
      `showNotification` call it produces, since `onNotification` is now the
      host-options adapter, not `showNotification` itself. Page's
      `react-i18next` mock gained an `i18n: {language: 'en'}` field the new
      host-options hook reads for `locale`. `DialFileManagerShell.spec.tsx`
      needed only its three import lines switched (it never called
      `useDialFileManager` directly). `NewConversationComposer.spec.tsx`
      needed **no changes** — confirmed by inspection: it lazy-loads
      `DialFileManagerModal` and its `useDialFileManagerState` mock keeps
      `isOpen: false`, so the modal (and therefore `useDialFileManager`) is
      never rendered in that suite.)
- [x] 7.7 Delete every file under `apps/chat/src/hooks/files/**` except
      `useDialFileManagerState.ts` (which stays app-owned per design.md
      D7), and their superseded tests.
      (Deleted 13 source files and their `tests/` subtree — confirmed via
      repo-wide grep first that nothing outside `hooks/files/**` still
      imported any of them. Also deleted, after confirming zero remaining
      consumers: `apps/chat/src/types/file-manager-variant.ts` and
      `apps/chat/src/components/DialFileManagerModal/types/upload.ts` (the
      latter's only remaining consumer, `UploadProgressModal.spec.tsx`, was
      fixed to import `FileUploadStatus` from `@epam/ai-dial-chat-hooks`,
      caught by the `nx affected` run in 7.8). `apps/chat/src/utils/resolve-dial-file-api-path.ts`
      and `apps/chat/src/utils/file-name.ts` could **not** be deleted — both
      still have real consumers outside the deleted hooks
      (`DialFileManagerShell.tsx`'s `getParentFolderPath`, and
      `CatalogView.tsx`'s `sanitizeFileName` respectively), exactly as slice 4
      flagged; left in place for slice 8's audit.)
- [x] 7.8 Run `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`,
      compare bundle size against the slice-6 baseline, then
      `npm exec nx affected --target=test,lint,build --base=origin/development`.
      (Build: `index.js` 84.05 kB / gzip 23.64 kB vs. the slice-6 baseline
      78.24 kB / gzip 22.20 kB — delta +5.81 kB / +1.44 kB gzip, from the new
      composer + grid-editing-scroll hook. Test: 41 files / 532 tests pass (up
      from slice 6's 39/447 — the 85 new tests are `useDialFileManager`'s 76 +
      `useGridEditingScroll`'s 9). Lint: initial run surfaced 155 prettier
      errors (all auto-fixed via `eslint --fix`) plus 2 real
      `react-hooks/exhaustive-deps` findings in the composer's
      `onCreateFolderValidate`/`onRenameValidate` `useCallback`s, fixed by
      depending on the whole `mutations` object instead of its destructured
      methods; clean after. Typecheck initially failed on 2 errors in the
      ported spec (untyped `ReturnType<typeof vi.fn>` mocks not assignable to
      the options' typed callback fields), fixed with an explicit cast at the
      two assignment sites; clean after.
      `npx nx affected -t test lint build --base=origin/development` first
      surfaced one real regression this slice introduced —
      `UploadProgressModal.spec.tsx` (an existing test this slice's task list
      didn't name) still imported `FileUploadStatus` from the just-deleted
      `../types/upload`; fixed by pointing it at `@epam/ai-dial-chat-hooks`
      like its component under test already did. Full re-run: see this
      slice's final report for the complete pass/fail summary.)

## 8. Slice 8 — Documentation, package metadata, and final audit

- [x] 8.1 Amend `AGENTS.md` §Library isolation to record the narrow
      `ag-grid-community` exception for `libs/chat-hooks` drafted in
      slice 1 (design.md D9): a raw third-party UI/grid library type, used
      only to bind to callbacks a declared peer dependency's own component
      leaks and does not forward, never for rendering or theming.
      (Added a third exception paragraph after the existing two in
      `AGENTS.md` §Library isolation, naming `useGridEditingScroll`'s
      `cellEditingStarted`/`rowDataUpdated` binding as the reference case
      and stating the exception does not license adopting AG Grid — or any
      other UI/grid engine — as a general-purpose lib dependency.)
- [x] 8.2 Correct `libs/chat-hooks/README.md`, `libs/attachment-canvas/README.md`,
      and `libs/quotations/README.md` for full accuracy against the final
      exported surface (peer-dependency lists, new hook sections).
      (`libs/chat-hooks/README.md`: added `@epam/ai-dial-ui-kit`,
      `ag-grid-community`, `fflate` to Peer Dependencies (present in
      `package.json` but missing from the README); added a new "## File
      Manager" section (after "## Hooks", before "## Building") documenting
      all 8 hooks — `useDialFileManager` with a full compiling example
      (`filesApi`/`bucket`/`activeTab`/`labels`/`locale`/
      `disabledNewButtonTooltip`/`downloadDestination`/
      `buildValidationErrorMessage`, since those last three are required
      fields on `UseDialFileManagerOptions`, confirmed by reading
      `dial-file-manager.types.ts` before writing the example) plus the 7
      sub/standalone hooks, each with a compiling example and
      Parameters/Returns naming the real exported option/result interfaces —
      and a "Supporting types" subsection covering `DialFilesApi`,
      `FileManagerNotification`/`FileManagerNotificationReason`,
      `FileNameValidationError`, `FileOperationSuccessEvent`/
      `FileOperationKind`, `DownloadDestinationHandlers`/
      `DownloadDestination`/`DownloadDestinationType`, `FileUploadStatus`/
      `FileUploadEntry`/`FileUploadBatchState`, and
      `DialFileManagerVariant`/`DialFileManagerActionProfile`. Every symbol
      name was verified by reading its actual source file first (all 8 hook
      files under `libs/chat-hooks/src/files/**`, `dial-file-manager.types.ts`,
      `download-destination.ts`, `upload-batch.types.ts`,
      `file-manager-variant.ts`), plus a check that `DialFileManager`/
      `TabModel`/`ToolbarOptions`/`FileManagerGridRow` are genuinely exported
      from `@epam/ai-dial-react-file-manager`'s public `.d.ts` before using
      them in an example. Large option interfaces
      (`UseDialFileManagerOptions`, `UseDialFileMutationsOptions`) are
      summarized with their required fields and a pointer to the exported
      type per this task's own guidance, not transcribed field-by-field.
      `libs/attachment-canvas/README.md`: Peer Dependencies list was stale —
      added `@epam/ai-dial-shared`, `@epam/ai-dial-visualizer-connector`, and
      `react-syntax-highlighter` (all three present in `package.json` but
      missing from the README); everything else (Components/Context/Hooks/
      Content Types/Utilities/Types sections) checked against `src/index.ts`
      and found already accurate. `libs/quotations/README.md`: Peer
      Dependencies list was missing `@epam/pdf-highlighter-kit` (present in
      `package.json`); also corrected the pinned `@epam/ai-dial-ui-kit
      ^0.13.0-dev.26` entry to `*` to match the package.json's actual
      unpinned peer range; everything else checked against `src/index.ts` and
      found already accurate.)
- [x] 8.3 Grep `openspec/specs/file-manager-tab-config`,
      `file-manager-grid-editing-scroll`, `file-manager-sharing`,
      `file-manager-copy-move`, `file-manager-delete-ui`,
      `file-manager-download`, `file-manager-folder-creation`,
      `file-manager-metadata`, `file-manager-operation-ux`,
      `file-manager-rename-ui`, `file-manager-shell`, and
      `file-manager-upload` for `apps/chat/src/hooks/files` path
      references and correct them to the new `@epam/ai-dial-chat-hooks`
      location, without altering any requirement or scenario text
      (design.md D10).
      (All 12 specs had at least one stale reference; all corrected via a
      scripted path-substitution (verified no other text changed via
      `git diff --stat`, 18 line-level replacements across the 12 files, one
      line each except `file-manager-delete-ui`/`file-manager-folder-
      creation`/`file-manager-shell`/`file-manager-upload` which each had
      2–3). Mapped `apps/chat/src/hooks/files/useDialFileManager.ts` →
      `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts
      (@epam/ai-dial-chat-hooks)`, and likewise for
      `useDialFileManagerTabConfig.ts`, `useGridEditingScroll.ts`,
      `useDialFileMutations.ts`, and the one ported test-file path
      (`.../tests/useDialFileManager.spec.tsx`). Left untouched:
      `file-manager-grid-editing-scroll/spec.md`'s
      `development:apps/chat/src/components/FileManager/hooks/
      useGridEditingScroll.ts` git-history citation — a different, already-
      historical path unrelated to this change's move, not matching the
      `apps/chat/src/hooks/files` pattern this task targets — and
      `file-manager-metadata/spec.md`'s reference to
      `apps/chat/src/server-api/files.api.ts`, which is correct as written
      since that file stays app-owned per slice 4's `DialFilesApi` adapter
      design. Confirmed via a final repo-wide grep that zero
      `apps/chat/src/hooks/files` references remain in any of the 12 files.
      Found, but out of scope for this task's literal list and left
      unfixed: `openspec/specs/canvas/spec.md`,
      `openspec/specs/attachment-canvas-code-viewer/spec.md`,
      `openspec/specs/attachment-canvas-html-viewer/spec.md`, and
      `openspec/specs/attachment-input-lib/spec.md` still reference the
      pre-slice-2 path `apps/chat/src/hooks/attachment/
      useOpenAttachmentCanvas.ts` (now `libs/attachment-canvas/src/hooks/
      useOpenAttachmentCanvas/useOpenAttachmentCanvas.ts`) — design.md's D10
      only discusses the twelve file-manager specs, not the attachment-canvas
      capability's specs, so correcting those was not part of this task's
      scope; flagged here for a follow-up decision rather than corrected
      silently.)
- [x] 8.4 Run `npm run validate:docs`.
      (Passed: "Documentation validation passed (39 markdown files)" — README
      coverage/H1 identity, lib package metadata, relative links, and README
      imports vs. public exports all clean after the 8.2 README fixes.)
- [x] 8.5 Repo-wide grep for the deleted files' former paths
      (`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas`,
      `apps/chat/src/hooks/citations/useCitationMarkdownComponents`, and
      each deleted `apps/chat/src/hooks/files/*` file) to confirm no
      remaining reference, stale mock path, or duplicate implementation.
      (Zero hits in `apps`/`libs` source for any of the three patterns. The
      only remaining `hooks/files/` import anywhere in `apps`/`libs` is
      `useDialFileManagerState` — the one file design.md D7 explicitly kept
      app-owned, so that hit is expected, not stale. Historical mentions of
      the two deleted attachment/citation hook paths exist only in
      `openspec/changes/archive/**` (past changes' own record of what they
      touched, correctly left alone) and in this change's own
      design.md/proposal.md/tasks.md (its own audit trail). Re-confirmed with
      a fresh grep that `apps/chat/src/utils/resolve-dial-file-api-path.ts`
      (consumed by `DialFileManagerShell.tsx`'s `getParentFolderPath`, plus
      its own `apps/chat/src/utils/tests/resolve-dial-file-api-path.spec.ts`)
      and `apps/chat/src/utils/file-name.ts`'s `sanitizeFileName` (consumed by
      `CatalogView.tsx`) both still have exactly the real, legitimate
      consumers slices 4 and 7 flagged — no missed cleanup, both correctly
      left in place. No stray leftover imports, stale mocks, or duplicate
      implementations found.)
- [x] 8.6 Run the full `npm exec nx affected --target=test,lint,build --base=origin/development`
      and `npm run graph` to confirm no circular dependency was introduced
      among `attachment-canvas`, `quotations`, and `chat-hooks`.
      (`npm exec nx run-many --target=build --projects=ai-dial-attachment-canvas,
      ai-dial-quotations,ai-dial-chat-hooks`: all 3 build clean;
      `ai-dial-chat-hooks`'s `index.js` is 84.09 kB / gzip 23.64 kB, matching
      slice 7's baseline exactly (README-only changes in this slice don't
      touch the bundle). `npm exec nx run-many --target=test` for the same 3
      projects: `ai-dial-chat-hooks` 41 files / 533 tests pass (up 1 test
      from slice 7's 532 — `useDialFileManager.spec.tsx`'s folder-rename
      case added during slice 7's own follow-up fix). `npm exec nx -- affected
      -t test lint build typecheck --base=origin/development`: exit code 0,
      "Successfully ran targets test, lint, build, typecheck for 4 projects
      and 46 tasks they depend on" (54/62 tasks served from cache);
      `@epam/chat`: 182 test files / 2640 tests passed, 2 skipped; lint 0
      errors / 20 warnings, all pre-existing and in files this change never
      touched (scheduled-task/ActiveScheduledTaskContext/
      ConversationRoute/test-setup files). Dependency graph
      (`nx graph --file=graph.json`, inspected programmatically): `chat-hooks`
      → depends on both `attachment-canvas` and `quotations` (as designed);
      `attachment-canvas` → has one edge to `quotations`, traced to its
      `useOpenAttachmentCanvas.spec.ts` test file importing
      `annotationsToPdfHighlights` (test-only, pre-existing since slice 2,
      not introduced by this slice); `quotations` → zero edges to either of
      the other two. No cycle: no path leads back from `quotations` or
      `attachment-canvas` to `chat-hooks`, and `quotations` depends on
      neither peer.)
