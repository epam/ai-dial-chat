## Context

The updated branch already moved reusable favorites state and deployment-limit
mapping to `libs/chat-hooks` (commit `5048e5d30`). The remaining duplicated
surfaces are the file-manager view layer in `apps/chat` and four orchestration
clusters in `CatalogView`: details/file loading, browse derivations, primary
action resolution, and skill-preview request lifecycle.

Investigation anchors on the updated branch:

- `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx:87`
  accepts `hookResult: UseDialFileManagerResult`; tabs and active tab are
  separate props.
- `libs/chat-hooks/src/files/dial-file-manager.types.ts:217` is the current
  result contract; it contains `items`, path/search state, mutation callbacks,
  flags, columns and action labels, but no tab collection.
- `apps/chat/src/components/DialFileManagerModal/types/attach-result.ts:3`
  defines `{ files: DialFile[]; folderPaths: string[] }`.
- `apps/chat/src/components/DialFileManagerModal/UploadProgressModal.tsx:15`
  accepts a ready `uploadProgressText: string`; upload state is
  `{ files: FileUploadEntry[]; isOpen: boolean }`.
- `libs/chat-hooks/src/files/useGridEditingScroll/useGridEditingScroll.ts:1`
  binds the raw grid events leaked by the peer file-manager component.
- `apps/chat/src/components/CatalogView/CatalogView.tsx:461` derives visible
  items; `:502` derives favorites; `:524` dispatches detail requests; `:907`
  implements the primary action.
- `apps/chat/src/components/CatalogView/SkillDetailsFilePreview.tsx:39` owns
  app attachment-canvas synchronization around its async loader.
- `libs/chat-hooks/src/catalog/useFavoriteEntitiesState` and the catalog limits
  mapper are now the closest reusable-state/mapping patterns and SHALL be reused.

The current Nx graph is:

```text
@epam/chat -> @epam/ai-dial-chat-hooks -> @epam/ai-dial-chat-shared
                                      -> @epam/ai-dial-catalog
@epam/ai-dial-catalog -> @epam/ai-dial-chat-shared
```

`chat-shared` cannot import `chat-hooks` or `catalog`; `chat-hooks` may use
catalog types and the generated client types/operation shapes allowed by the
repository's narrow exception, but every configured client remains injected.

## Goals / Non-goals

Goals are a reusable published file-manager UI surface, reusable headless
catalog orchestration, exact behavior preservation, compatibility exports, an
acyclic dependency graph, and verifiable npm CSS delivery.

Non-goals are backend/OpenAPI work, a new library, UI redesign, new state or
storage, downstream migration, or moving host integration concerns into libs.

## Decisions

### D1. `FileManagerController` is an exact structural view contract

`chat-shared` SHALL define the fields actually read by the shell, using their
current names and types from `UseDialFileManagerResult`. The shell changes from
`hookResult` to `controller`; tabs, active tab, selected paths, destination
picker callbacks and host callbacks stay explicit props. A type-only assertion
proves `UseDialFileManagerResult` is assignable without a cast.

This avoids the forbidden reverse dependency and prevents the UI contract from
inventing `itemsTree`, `onRenameItem`, or controller-owned tabs. Current
shell-consumed `error` and `retry` fields remain in the controller.

### D2. View types have one canonical source and compatible old imports

The enums/types needed by both hook and view, including
`FileUploadValidationResult`, `getParentFolderPath`, and the exact label/attach
contracts move canonically to `chat-shared`. `chat-hooks` imports and re-exports
them so current consumers do not break. Domain-only
ports, algorithms, options, and the full hook result remain in `chat-hooks`.

### D3. Grid-editing scroll moves with the shell under a recorded exception

The shell invokes `useGridEditingScroll`; leaving it in `chat-hooks` would
create a reverse dependency after the shell moves. The canonical hook and tests
therefore move to `chat-shared`, while `chat-hooks` re-exports it.

This is the same narrow peer-leak case already documented for `chat-hooks`:
`@epam/ai-dial-react-file-manager` exposes a raw `GridApi` but does not forward
the required events. `chat-shared` may depend on `ag-grid-community` types only
for this event binding. It may not use AG Grid for rendering, theming, columns,
row models, or any other UI. Because the callback already exposes `GridApi`, the
public signature is preserved rather than claiming it is engine-neutral.

### D4. The attach component is controlled; the host remains the adapter

`FileManagerAttachModal` owns the current reusable selection/validation/render
algorithm and returns the exact `{ files, folderPaths }` result. The app retains
configured API construction, translations, config, notifications, browser
download and hook invocation. Extracted code receives resolved data, labels and
callbacks only. Existing mobile/desktop, drag/drop, focus, RTL, and a11y behavior
is a preservation requirement, not a redesign opportunity.

### D5. CSS is a deliberate library build input

The existing Vite build emits `dist/index.css`; it does not emit
`dist/styles.css`, and the current CSS lacks the shell utilities because
`chat-shared` has no Tailwind/PostCSS source entry. Add a library Tailwind config
using the root preset and the relevant content paths, add PostCSS, import a
Tailwind stylesheet from the build entry, and map the public `./styles.css`
subpath to `./dist/index.css`. Avoid Tailwind base reset unless an existing
contract needs it. Validate the packed package, not only the workspace build.

### D6. Catalog requests use an injected operation port

`CatalogDetailsApi` mirrors the exact current server-wrapper signatures for
deployment details/limits, prompt reads, skill file download and skill listing.
The app creates the adapter. `chat-hooks` may use generated DTO types and
operation shapes under its documented exception, but never constructs/configures
a client or imports `apps/chat/src/server-api`.

`useCatalogItemDetails` returns stable `onFetchDetails`,
`onLoadContentFile`, and `onLoadSkillDetailsFile` callbacks. Its current-skill
ref is private. It preserves prompt source routing and overview reconstruction,
skill `Promise.allSettled` partial results and raw-manifest fallback, model-only
limits, deployment-specific details, MCP/connect precedence, credentials, and
all current graceful failures. Archive download parses its item independently
instead of coupling the host to the private ref.

### D7. Browse logic is pure and preserves ordering

The helpers have these semantic contracts:

```ts
filterCatalogItemsBySelector(items, visibleTypes)
filterHiddenOwnedItems(items, hideOwned)
deriveFavoriteItems(items) // item.isUserFavorite
deriveAvailableTabIds(items, tabOrder)
reconcileFilterTopics(persistedTopics, items)
```

They accept readonly inputs, return new collections, keep input/tab order, and
read no context, storage, route, feature flag, or translation state. Existing
app persistence hooks and the new multi-entity favorite context remain owners.

### D8. Primary action resolves data; the app performs effects

`resolveCatalogPrimaryAction` returns a string-enum/discriminated deployment or
prompt result. It uses seeded prompt content first, otherwise a narrow injected
fetch callback, and detects prompt parameters. The app maps the result to
`setSelectedItemId`, one-shot router state and navigation, and owns error
notifications/trace ids. Toolset/non-chat visibility remains unchanged.

### D9. Skill preview hook does not replace the canvas adapter

The headless hook owns loading, stale reset, cancellation and error
classification. `SkillDetailsFilePreview` remains an app component that feeds
the result into `useSkillFilePreviewSync`, opens the attachment canvas, maps
localized errors and renders `SkillFilePreview`. `libs/catalog`'s separate
built-in preview loader/stale-response mechanism is out of scope.

## Alternatives considered

- Put the shell in `chat-hooks`: rejected because that library is headless and
  would acquire component/styling ownership.
- Make `chat-shared` depend on `chat-hooks`: rejected by the Nx/library boundary
  and creates a cycle through existing dependencies.
- Inject grid-scroll wiring from every host: possible, but defeats reusable
  shell behavior and spreads the peer leak; co-locating one narrowly constrained
  hook is smaller and testable.
- Keep CSS responsibility in consumers: rejected because npm consumers cannot
  infer this workspace's Tailwind content paths.
- Expose `openSkillRef`: rejected as mutable cross-layer protocol.

## Risks / Trade-offs

- Controller drift is mitigated by compile-time assignability and shell tests.
- Peer version drift is mitigated by peer ranges, Vite externals, isolated build
  and packed-package tests.
- Tailwind purge errors are mitigated by explicit content configuration and
  assertions for static/responsive/logical/state selectors.
- Refactor regressions are mitigated by vertical slices, moving behavioral
  tests with canonical code, and retaining app integration tests.
- `chat-shared` grows as a UI library, which matches its current component role
  but must be reflected in README and architecture documentation.

## Migration and rollback

First establish canonical contracts/re-exports, then move the grid hook and UI,
then migrate app hosts, then add catalog orchestration and migrate one cluster at
a time. Every slice is linted/tested/built with the canonical Nx project names.

No data or backend migration exists. Rollback is a revert of the extraction;
compatibility exports mean downstream source imports remain valid. If package
CSS delivery fails, hosts can revert the shared component import without any
state/schema rollback.

## Open questions

None. Implementation must treat the updated branch contracts and authoritative
specifications as the source of truth when line numbers move.
