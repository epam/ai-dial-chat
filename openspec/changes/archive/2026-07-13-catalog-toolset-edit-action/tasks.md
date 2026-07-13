## 1. Toolset editability mapping

- [x] 1.1 In `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, set `isEditable: toolset.isMy ?? false` on the object returned by `mapToolsetToCatalogItem`.

## 2. Catalog edit navigation

- [x] 2.1 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, generalize the edit handler (currently `handleEditApp`) to branch on `item.type`: for `CatalogEntityType.Toolset`, build `${ROUTES.ToolsetEditor}?${ToolsetEditorQuery.Id}=<item.id>&${ToolsetEditorQuery.ReturnUrl}=${ROUTES.Catalog}` and `navigate` to it; otherwise keep the existing QuickApp `buildEditorUrl` path.
- [x] 2.2 Confirm `isPrimaryActionVisible` is left unchanged (still excludes `Toolset`) since Edit visibility is governed by `isEditable`/`onEdit`, not this callback.

## 3. Verification

- [x] 3.1 Run `npm exec nx lint chat` and `npm exec nx test chat` (or the affected equivalents) and fix any failures.
- [x] 3.2 Manually verify in the running app: open the Catalog, open a toolset you own, confirm an "Edit" button appears next to "Use in chat"/"Share", click it, and confirm it navigates to `/toolset-editor?id=<id>&returnUrl=/catalog` with the toolset's existing values pre-loaded; confirm a toolset you don't own shows no Edit button; confirm the existing QuickApp edit flow still works unchanged.
  - Live browser verification requires an authenticated session against the dev Keycloak realm (`keycloak.aks.dev.dial.parts`), which is unavailable in this environment. Verified instead via `CatalogView.spec.tsx` (new test asserting the Edit click navigates to `ROUTES.ToolsetEditor?id=...&returnUrl=/catalog`) and `map-deployment-to-catalog-item.spec.ts` (new tests asserting `isEditable` is `true`/`false` based on `toolset.isMy`) — both exercise the exact code path the details-panel Edit button invokes. Flagged to the user; a human should confirm in a real browser session before merge.
