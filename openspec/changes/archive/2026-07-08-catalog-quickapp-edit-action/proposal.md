## Why

Users who own a QuickApp had no way to jump from the Catalog details panel straight into editing it — they had to locate the app elsewhere (or recreate the Apps editor URL by hand) to reach its Settings step. Since "Use in chat" already surfaces the primary action for an item in that panel, an "Edit" action next to it is the natural place to offer this shortcut for apps the user can actually modify.

## What Changes

- Add an `isEditable` field to `CatalogItem` (`libs/catalog`), set by the consuming app to indicate whether the current user can edit the item.
- Add an `onEdit` callback and `editActionLabel` text override to the Catalog details panel (`CatalogProps`, `DetailsPanelProps`, `ItemDetailsTexts`).
- Render an "Edit" button (`IconPencil`, `NeutralButton`) in `Header.tsx` next to "Use in chat", shown only when `onEdit` is supplied and `item.isEditable` is `true`.
- In `apps/chat`, compute `isEditable` for application deployments as: the deployment belongs to the current user (`isMy`) AND its `applicationTypeSchemaId` matches the QuickApp schema id resolved via `isQuickAppSchema`. Toolsets and models are never editable through this action.
- Wire `CatalogView`'s new `onEdit` handler to navigate to the Apps editor's Settings step (`AppsEditorStep.Settings`) for the clicked app's existing `appId`, reusing the existing `ButtonsI18nKeys.Edit` translation for the label.
- Generalize `CatalogView`'s `buildEditorUrl` helper to a single parameterized function used by both the "Create QuickApp" flow (General step, `isCreating`) and the new "Edit" flow (Settings step, existing `appId`), instead of two separate URL-building code paths.

## Capabilities

### New Capabilities

- `catalog-quickapp-edit-action`: Edit action in the Catalog details panel for QuickApps owned by the current user, navigating to the Apps editor Settings step.

### Modified Capabilities

(none — `catalog-use-in-chat` and other existing catalog specs are unaffected; the Edit button is an additive, independently-gated action)

## Impact

- `libs/catalog/src/models/catalog-item.ts`, `item-details-props.ts`, `catalog-props.ts`
- `libs/catalog/src/components/Details/Header/Header.tsx`, `DetailsPanel.tsx`
- `libs/catalog/src/components/Catalog/Catalog.tsx`
- `apps/chat/src/utils/map-deployment-to-catalog-item.ts`
- `apps/chat/src/components/CatalogView/CatalogView.tsx`
- No API or schema changes; purely client-side navigation using existing `AppsEditorQuery`/`AppsEditorStep` routing.
