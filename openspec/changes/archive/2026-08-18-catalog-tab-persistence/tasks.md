## 1. Types and constants

- [x] 1.1 Add `CatalogActiveTab` to `StorageKey` in `apps/chat/src/types/storage-key.ts`

## 2. libs/catalog: controlled activeTab prop

- [x] 2.1 Add `activeTab?: string` and `onActiveTabChange?: (tabId: string) => void` to `CatalogProps` in `libs/catalog/src/models/catalog-props.ts`
- [x] 2.2 In `Catalog.tsx`, derive the effective active tab as `props.activeTab ?? internalActiveTab`, keep the existing internal `useState` as the uncontrolled fallback, and call `onActiveTabChange` (in addition to updating internal state) from the `Tabs` `onTabChange` handler
- [x] 2.3 Add/extend `libs/catalog` unit tests covering: uncontrolled default-to-first-tab behavior unchanged, controlled `activeTab` overrides internal state, `onActiveTabChange` is called with the clicked tab's id

## 3. apps/chat: useCatalogActiveTabPreference hook

- [x] 3.1 Create `apps/chat/src/hooks/useCatalogActiveTabPreference/useCatalogActiveTabPreference.ts`, built on `useLocalStorage.ts`, implementing the resolution order (persisted value → first available tab) and `setActiveTab`, mirroring `useCatalogSortFilterPreference`'s shape
- [x] 3.2 Add unit tests at `apps/chat/src/hooks/useCatalogActiveTabPreference/tests/useCatalogActiveTabPreference.spec.ts` covering: no persisted value, persisted value restored, stale persisted tab falls back to first available, `setActiveTab` persists, empty available-tabs list resolves to `undefined`, `localStorage` write failure doesn't throw

## 4. apps/chat: wire tab state into CatalogView

- [x] 4.1 In `CatalogView.tsx`, derive `availableTabIds` from the existing memoized `buildCatalogTabs` output (wrapped in its own `useMemo`)
- [x] 4.2 Call `useCatalogActiveTabPreference` with `availableTabIds` to obtain `activeTab`/`setActiveTab`
- [x] 4.3 Forward `activeTab` and an `onActiveTabChange` handler (calling `setActiveTab(tabId)`) to `Catalog` only when `isSelectorMode` is falsy
- [x] 4.4 Verify `CatalogModal`/selector-mode rendering of `CatalogView` is unaffected (no `activeTab`/`onActiveTabChange` passed through, no `localStorage` reads/writes triggered by its interactions)
- [x] 4.5 Confirm no changes are needed to `handleEdit`/`createOptions`'s `ReturnUrl` construction — verify via a `CatalogView` test that editing an item from a given tab and simulating the editor's return navigation (remount with the same persisted `localStorage` value) restores that same tab

## 5. Verification

- [x] 5.1 Run `npm exec nx test catalog` and `npm exec nx test chat` (or the affected equivalents) and fix any failures
- [x] 5.2 Run `npm exec nx lint catalog` and `npm exec nx lint chat`
- [x] 5.3 Manually verify in the running app (`npm run start:all`): switch to a non-Models tab, refresh — tab is preserved; edit a Prompt/Skill/Toolset from a non-Models tab and save/cancel — returns to origin tab; open `CatalogModal` (deployment selector) — tab selection is session-only as before
