## Context

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) currently owns `sortKey` and `filters` (topic filter `Set<string>`) as internal `useState`, initialized from `CatalogSortKey.RecentlyUpdated` and an empty set on every mount. `libs/*` must not read/write `localStorage` directly (AGENTS.md §Library isolation) — persistence has to live at the app edge, same as the existing `useFavoriteApplications` hook pattern (server-backed, not localStorage, but same shape: app-owned hook feeds a controlled prop into the lib).

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) is the only production consumer that would opt into persistence. `CatalogModal` (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`) is a separate, unrelated consumer (a deployment picker) and must keep today's session-only behavior — it should not read another feature's persisted preference.

## Goals / Non-Goals

**Goals:**
- Persist the user's `sortKey` selection and topic `filterTopics` selection across page loads/reloads, scoped to the browser (`localStorage`), for the main Catalog page only.
- Keep `Catalog` in `libs/catalog` fully host-agnostic: it must not know `localStorage` exists. It only gains two independent optional controlled-prop pairs, uncontrolled by default (matching the existing `publishExpandedPaths`/`onPublishExpandedPathsChange` pattern already in `CatalogProps`).
- Drop persisted topic values that no longer exist in the current item set instead of surfacing a filter that silently has zero effect.

**Non-Goals:**
- Persisting the "My Apps" toggle (`isMyAppsActive`) — the proposal scopes to sort + the topic ("From") filter only.
- Persisting view mode (grid/list), search query, or entity-type tab selection — out of scope.
- Cross-device/user-account sync of the preference — `localStorage` is per-browser only, which is acceptable for a UI convenience setting.
- Wiring persistence into `CatalogModal` — it is a different feature (deployment picker) with its own lifecycle.

## Decisions

**Controlled props on `Catalog`, not a context or portal.** Add `sortKey?: CatalogSortKey`, `onSortChange?: (key: CatalogSortKey) => void`, `filterTopics?: Set<string>`, `onFilterTopicsChange?: (topics: Set<string>) => void` to `CatalogProps`. `Catalog` keeps its existing internal `useState` as a fallback: `const [internalSortKey, setInternalSortKey] = useState(...)`, then `const sortKey = props.sortKey ?? internalSortKey` and an `onSortChange` handler that calls both the internal setter and the prop callback when supplied. This is the same optional-controlled-prop shape `CatalogProps` already uses for `publishExpandedPaths`. Alternative considered: making the props required and always controlled — rejected because it would be a breaking change forcing every consumer (including `CatalogModal`) to wire persistence it doesn't want.

**New app-level hook `useCatalogSortFilterPreference`, built on the existing `useLocalStorage` hook.** `apps/chat/src/hooks/useLocalStorage.ts` already implements the try/catch-wrapped, JSON-serialized read/write-on-mount pattern (used today for `ConversationSourcesWidth`, theme, etc.) — reusing it avoids re-implementing storage error handling and keeps a single source of truth for that behavior. `useCatalogSortFilterPreference` calls `useLocalStorage` twice (once for the sort key, once for the topic array) and layers catalog-specific concerns on top: enum validation for the sort key and `Set`↔`Array` conversion for the topics. This keeps `CatalogView` a thin wiring component and gives the storage keys a single owner. The hook is app-owned (`apps/chat/src/hooks/`), so it may use `localStorage`-backed hooks — only `libs/*` is restricted.

**Reconciling persisted topics against live items happens in `CatalogView`, not the hook.** The hook only knows raw persisted strings; it has no concept of "valid" topics (that requires today's `CatalogItem[]`). `CatalogView` already computes `catalogItems` via `useMemo`; it filters the hook's restored `filterTopics` against the current item topic set before passing it down as the controlled prop, so a topic that no longer exists anywhere is dropped rather than kept as dead-weight state (or worse, an empty-looking active filter).

**Storage format: two separate `StorageKey` entries, not one combined object.** `StorageKey.CatalogSortKey` (JSON-encoded string, via `useLocalStorage<string>`) and `StorageKey.CatalogFilterTopics` (JSON-encoded string array, via `useLocalStorage<string[]>`), added to the existing `apps/chat/src/types/storage-key.ts` enum alongside `ConversationSourcesWidth`, `Theme`, etc. Two keys keep read/write independent (e.g. one could fail to parse without corrupting the other) and match the one-concern-per-key convention already used by other `StorageKey` entries. `Set<string>` is serialized as `Array.from(set)` before being handed to `useLocalStorage` and rehydrated with `new Set(parsed)` after reading it back.

**Fail-soft on malformed or invalid storage.** `useLocalStorage` already catches `JSON.parse`/`getItem`/`setItem` failures and falls back to the provided initial value. `useCatalogSortFilterPreference` adds one more layer on top: an unexpected shape that still parses as valid JSON (non-array for topics, a string that isn't a `CatalogSortKey` member) is treated as "nothing persisted" — sort key falls back to `CatalogSortKey.RecentlyUpdated`, topics to an empty array/`Set`.

## Risks / Trade-offs

- [Stale/removed topic strings could linger in storage forever if the user never revisits the page with those topics gone] → Mitigation: reconciliation happens on every `CatalogView` render via the memoized item list, and the hook re-writes the reconciled set back to storage whenever `onFilterTopicsChange` fires, so storage self-heals on the next filter interaction. Acceptable that between visits the raw persisted value may contain stale entries — they are inert until reconciled.
- [Two consumers of `Catalog` (`CatalogView`, `CatalogModal`) could drift if a future feature needs persistence in the modal too] → Mitigation: the hook is generic enough (`useCatalogSortFilterPreference`) to be reused as-is by a second consumer later; no design change needed if that happens.
- [`localStorage` is unavailable in some embedded/iframe or privacy-restricted contexts and can throw on `setItem`] → Mitigation: wrap read/write in `try`/`catch` inside the hook; a failure degrades to session-only behavior (current behavior) instead of crashing the page.
