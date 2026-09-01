## Context

The destination Move/Copy popup renders the same folder tree data as the standalone File Manager, but it owns an independent expansion interaction. `useDialFileListing` already uses one per-folder listing cache and one in-flight API-path set for both surfaces. Before this change, `loadedPaths` considered only `expandedPaths` from the outer tree, while popup loads were represented only by a normalized `folderPopupLoadingPaths` entry. A successful empty response therefore populated the cache without marking the popup node loaded.

`@epam/ai-dial-react-file-manager@0.2.0-dev.7` forwards `treeOptions.loadedPaths` and `treeOptions.loadingPaths` into the destination popup. The host must supply those sets using exact `DialFile.path` values; non-root folder nodes include a trailing slash.

The change touches the host-agnostic listing hook and the app-level File Manager adapter. `libs/chat-hooks` continues to receive an injected `DialFilesApi`; `DialFileManagerShell` remains the only layer that maps hook state to package props.

## Goals / Non-Goals

**Goals:**

- Use cache presence as the authoritative signal that a destination folder listing completed, including an empty listing.
- Expose exact popup node paths through `folderPopupLoadingPaths` and `loadedPaths` so strict `Set.has(node.path)` checks work.
- Preserve fetch deduplication when the outer tree and destination popup request the same folder concurrently.
- Consume the published File Manager release containing the destination-popup tree-state forwarding.

**Non-Goals:**

- Change DIAL Core/BFF listing APIs, cache keys, cache invalidation, or error notifications.
- Infer loaded state from the number of rendered children.
- Add UI, strings, feature flags, telemetry, or File Manager-specific rendering logic to `libs/chat-hooks`.

## Decisions

### Derive loaded state from cache presence for every observed tree path

`useDialFileListing` keeps a private set of paths observed through `onFolderPopupPathChange`. `loadedPaths` is memoized from the union of outer `expandedPaths` and these popup paths, retaining only candidates whose API path is present in the shared listing cache.

This makes `Map.has(apiPath)` distinguish all three relevant states: pending/never requested (absent), successful empty (`[]` present), and successful non-empty (items present). Deriving from rendered child count was rejected because empty success is indistinguishable from not-yet-loaded data.

### Preserve exact File Manager virtual paths

Popup loading and loaded sets store the callback's exact `DialFile.path`; non-root folder paths retain their trailing slash. The app shell compares and forwards the same representation without normalizing it.

Normalizing paths before storing them was rejected because `DialFoldersTree` uses strict set membership against `node.path`. Storing both normalized and exact aliases was rejected because it makes the public sets ambiguous and complicates cleanup.

### Keep API-path deduplication separate from UI-path identity

The existing in-flight and cache maps remain keyed by API path, so semantically identical requests still deduplicate. UI loading cleanup uses the exact virtual path that was inserted. When a popup observes a request already started by the outer tree, the outer request removes that same exact path when it settles.

### Adapt package state at the application edge

`DialFileManagerShell` maps `folderPopupLoadingPaths` to `treeOptions.loadingPaths` and passes `loadedPaths` unchanged. `libs/chat-hooks` does not import File Manager components, app contexts, routes, environment values, or transport configuration; it continues to expose plain state through its public result interface.

### Consume the published package instead of a linked local build

The workspace pins `@epam/ai-dial-react-file-manager` to `0.2.0-dev.7`. A symlinked local repository was rejected for normal development/CI because dependency resolution can load the sibling repository's React copy and trigger invalid-hook-call failures. The installed package resolves React and its `@epam/ai-dial-ui-kit@^0.14.0-dev.13` peer from this workspace.

## Risks / Trade-offs

- [Risk] `folderPopupPaths` grows as users visit folders during one tab session → The set is bounded by visited folders and is reset with the listing cache on tab change.
- [Risk] A trailing-slash mismatch can return if callers synthesize paths rather than forwarding `DialFile.path` → Regression tests use the actual non-root folder form with a trailing slash.
- [Risk] A failed request could incorrectly hide the caret → `loadedPaths` requires cache presence; failure removes loading state but does not insert a cache entry.
- [Risk] The package upgrade could introduce peer incompatibility → npm resolves File Manager `0.2.0-dev.7` with UI Kit `0.14.0-dev.13`, and affected tests/typechecks verify integration.

## Migration Plan

1. Upgrade the File Manager dependency and lock-file resolution.
2. Deploy the cache-derived popup tree state and app adapter together.
3. No data migration or staged rollout is required.
4. Roll back by restoring the previous package version and reverting popup path tracking plus `treeOptions.loadingPaths`; no persisted state is affected.

## Open Questions

None.
