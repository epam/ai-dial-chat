**Slicing strategy:** each slice ends in a working state and uses the current
Nx project names. Preserve the user's unrelated `package-lock.json` change.

## 1. Baseline and contract locks

- [x] 1.1 Record the current `UseDialFileManagerResult`, shell props,
  `FileUploadBatchState`, `AttachResult`, `UploadProgressModal`, catalog
  handlers, favorite-state hook, limits mapper, and package CSS output in test
  fixtures or compile-time assertions before moving code.
- [x] 1.2 Add a failing structural test that the shell-consumed projection of
  `UseDialFileManagerResult` satisfies `FileManagerController`; tabs,
  `activeTab`, selection, and host adapters SHALL remain outside the controller.
- [x] 1.3 Verify baseline targets with `npm exec nx show project` for
  `@epam/ai-dial-chat-shared`, `@epam/ai-dial-chat-hooks`, `@epam/ai-dial-catalog`,
  and `@epam/chat`; do not use shorthand project names.

## 2. File-manager contracts in `chat-shared`

- [x] 2.1 Add the exact shell-consumed `FileManagerController` interface and
  move the canonical view types (`DialFileManagerActionProfile`,
  `DialFileManagerVariant`, `FileUploadStatus`, `FileUploadEntry`,
  `FileUploadBatchState`, `FileUploadValidationResult`) plus
  `getParentFolderPath` to
  `libs/chat-shared/src/file-manager`; preserve their current shapes exactly.
- [x] 2.2 Move the complete existing label types and the exact
  `AttachResult { files: DialFile[]; folderPaths: string[] }` contract; export
  every public type from `libs/chat-shared/src/index.ts` with JSDoc.
- [x] 2.3 Re-export moved symbols from `@epam/ai-dial-chat-hooks` and make its
  own file-manager types import the canonical `chat-shared` definitions.
- [x] 2.4 Move `useGridEditingScroll` and its tests beside the shared shell;
  preserve event subscription, reset, double-animation-frame, DOM fallback,
  destroyed-grid guards, and stable callback semantics. Re-export it from
  `chat-hooks` for compatibility.
- [x] 2.5 Update root `AGENTS.md` with the narrow `chat-shared` AG Grid
  event-binding exception; the public hook callback may retain the peer
  component's leaked `GridApi` type, but no grid rendering/configuration API is
  permitted beyond this hook.
- [x] 2.6 Verify slice with `npm exec nx run @epam/ai-dial-chat-shared:lint`,
  `npm exec nx run @epam/ai-dial-chat-shared:test`, and
  `npm exec nx run @epam/ai-dial-chat-hooks:test`.

## 3. Shared shell, modals, and attach surface

- [x] 3.1 Move `OperationLoaderModal` and `UploadProgressModal` unchanged in
  behavior. Keep `uploadProgressText` as the current ready-to-render string and
  derive counts from `batchState.files`; do not invent aggregate fields.
- [x] 3.2 Move `DialFileManagerShell`, replacing only its hook-result type with
  `FileManagerController`; keep tabs, active tab, selected paths, callbacks,
  destination picker, browser-download callback, and all current props explicit.
- [x] 3.3 Extract the controlled `FileManagerAttachModal` behavior, preserving
  file/folder separation, deduplication, MIME/size/count validation,
  auto-selection after upload, drag/drop, disabled states, and the exact
  `{ files, folderPaths }` result.
- [x] 3.4 Keep `useDialFileManagerHostOptions`, configured API creation,
  translations, app config, notification mapping, and browser download in
  `apps/chat`; migrate page/modal hosts to the shared components.
- [x] 3.5 Move component/behavior tests to `chat-shared`, retain app wiring
  tests, and remove only files whose implementation moved. Do not delete an app
  directory while host adapter files remain in it.
- [x] 3.6 Audit extracted TSX for WCAG 2.1 AAA, focus restoration, `inert` for
  hidden focusable content, live status, logical RTL utilities, mirrored
  directional icons, and current `mobile`/`desktop` behavior.
- [x] 3.7 Verify slice with `npm exec nx run @epam/ai-dial-chat-shared:typecheck`,
  `:lint`, `:test`, and `:build`, then the same four targets for `@epam/chat`.

## 4. Published styles and package boundary

- [x] 4.1 Add `chat-shared` Tailwind config using the root preset and scanning
  its TSX plus required ui-kit/file-manager package content; add PostCSS and a
  library stylesheet entry imported by the library build. Do not add Tailwind
  base reset unless required by an existing shared component contract.
- [x] 4.2 Declare `@epam/ai-dial-react-file-manager` and
  `ag-grid-community` as peer dependencies and Vite externals, preserving
  existing React/ui-kit peers.
- [x] 4.3 Export `"./styles.css": "./dist/index.css"`, build and pack the
  library, then verify package resolution and representative static,
  responsive, logical-direction, and state variant selectors in emitted CSS.
- [x] 4.4 Add package export/boundary tests and verify the Nx graph has no
  `chat-shared -> chat-hooks`, `chat-shared -> catalog`, app, or generated-client
  edge.

## 5. Catalog details controller

- [x] 5.1 Define `CatalogDetailsApi` from the exact current wrapper signatures.
  Generated DTO types/signatures may be used under the existing `chat-hooks`
  exception; the hook SHALL receive an already configured adapter and know no
  base URL, auth, CSRF, route, context, or server-api module.
- [x] 5.2 Implement `useCatalogItemDetails` with stable callbacks and a private
  current-skill ref. Preserve prompt source dispatch/overview rebuild, skill
  manifest/inventory `Promise.allSettled`, raw manifest fallback, model-only
  limits, deployment mapping, MCP/connect precedence, credentials, admin data,
  and every current graceful failure.
- [x] 5.3 Return only `onFetchDetails`, `onLoadContentFile`, and
  `onLoadSkillDetailsFile`; do not expose the private ref as a host protocol.
  Parse a skill id independently for archive download where that action needs it.
- [x] 5.4 Build the app adapter from existing wrappers and replace only the
  inline dispatch/load algorithms in `CatalogView`.
- [x] 5.5 Add exhaustive unit tests for all entity/source branches, malformed
  ids, partial failures, callback stability, and changing the open skill.
- [x] 5.6 Run typecheck, lint, test, and build for
  `@epam/ai-dial-chat-hooks` and `@epam/chat` through `npm exec nx run`.

## 6. Catalog derivations and primary action

- [x] 6.1 Add pure immutable helpers matching current order and predicates:
  selector visible types, hide-owned, favorites via `isUserFavorite`, available
  tab ids from visible items/tab order, and persisted-topic intersection.
- [x] 6.2 Add a string-enum/discriminated primary-action result and resolver.
  Preserve deployment selection and prompt seeded/fetched content plus parameter
  detection; accept a narrow prompt fetch callback.
- [x] 6.3 Keep navigation, `setSelectedItemId`, one-shot router state, error
  notification/trace id, and route constants in the app adapter.
- [x] 6.4 Replace `CatalogView` memo bodies with helper calls without changing
  selector-mode gating, persistence ownership, loading, item order, or the
  recently extracted multi-entity favorite context.
- [x] 6.5 Add helper/resolver unit tests and retain app tests for final props,
  routing, notifications, and contexts; run hooks/app typecheck, lint, test, and
  build through `npm exec nx run`.

## 7. Skill preview lifecycle

- [x] 7.1 Add a headless hook for load/start/success/error/cancellation and
  forbidden-vs-generic error classification; reset stale content on file id
  changes and ignore resolutions after change/unmount.
- [x] 7.2 Refactor app `SkillDetailsFilePreview` to bridge the hook result into
  the existing `useSkillFilePreviewSync`/attachment-canvas protocol and render
  the existing `SkillFilePreview`. Keep theme, translations, canvas errors and
  canvas opening app-owned.
- [x] 7.3 Add hook lifecycle tests plus app adapter/canvas wiring tests. Do not
  modify `libs/catalog`'s built-in content-preview loader or stale-request rule.

## 8. Public documentation and final verification

- [x] 8.1 Update both library READMEs with exact imports, required props,
  adapter examples, stylesheet import, compatibility re-exports, and ownership
  boundaries; update `docs/architecture.md` for the expanded library surfaces.
- [x] 8.2 Run `npm run validate:docs` after README/public API/package metadata
  changes.
- [x] 8.3 Run `openspec validate extract-file-manager-catalog-reuse --strict`.
- [x] 8.4 Run affected lint/test/build through Nx using the merge base with
  `origin/development`; separately run all directly changed projects if the
  merge base excludes uncommitted work.
- [x] 8.5 Inspect `npm exec nx graph -- --print`, packed package contents, and
  forbidden imports; confirm compatibility exports and no dependency cycle.
- [x] 8.6 Perform the five-axis quality review and resolve all Blocker/High
  findings before marking the change ready to apply.
