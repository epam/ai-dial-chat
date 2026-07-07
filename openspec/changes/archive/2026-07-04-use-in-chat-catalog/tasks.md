## 1. Lib: hide Use in chat for Toolset

- [x] 1.1 In `libs/catalog/src/components/Details/Header/Header.tsx`, guard the existing `PrimaryButton`/"Use in chat" render with `item.type !== CatalogEntityType.Toolset` (import `CatalogEntityType` from the lib's own types module).
- [x] 1.2 Verify no other lib file needs changes: confirm `CatalogProps.onUseInChat`, `DetailsPanelProps.onUseInChat`, and `Catalog.tsx`/`DetailsPanel.tsx` prop threading are unchanged (signatures already match `(item: CatalogItem) => void` end to end).
- [x] 1.3 Add/update `Header` unit tests: "Use in chat" renders for `type: Model` and `type: Application`; does not render for `type: Toolset`; `onShare`/other actions unaffected.

## 2. App: wire onUseInChat handler

- [x] 2.1 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, add a `handleUseInChat` callback using `setSelectedItemId` (from the existing `useDeployments()` call) and `navigate` (from the existing `useNavigate()` call): call `setSelectedItemId(item.id)` then `navigate(ROUTES.Root)`.
- [x] 2.2 Pass `onUseInChat={handleUseInChat}` to `<Catalog ... />`.
- [x] 2.3 Confirm the details panel closes as a natural consequence of navigating away from the catalog route; if it does not (details-panel-open state outlives the route), add an explicit reset/close call at the `handleUseInChat` call site.

## 3. App tests

- [x] 3.1 Add/update `CatalogView` tests: clicking "Use in chat" on a Model item calls `setSelectedItemId` with that item's `id` and navigates to `ROUTES.Root`.
- [x] 3.2 Add/update `CatalogView` tests: same assertion for an Application item.
- [x] 3.3 Add/update `CatalogView` tests: selecting a different item afterward updates the selected id (mirrors existing `DeploymentsContext`/model-picker test patterns already in the app for persistence-on-reload — no new persistence test needed since `setSelectedItemId` behavior is unchanged and already covered elsewhere).

## 4. Verification

- [x] 4.1 Run `npm exec nx run @epam/chat:lint`.
- [x] 4.2 Run `npm exec nx run @epam/ai-dial-catalog:test`.
- [x] 4.3 Run `npm exec nx run @epam/chat:test` (or `nx affected --target=test` scoped to touched projects) to cover `CatalogView` changes.
- [x] 4.4 Manually verify in the running app: Models tab → Use in chat → lands on `/` with model selected and sendable; Applications tab → same; Toolsets tab → no Use in chat button; reload after selection keeps the deployment selected.
