## Why

GitHub issue [#7733](https://github.com/epam/ai-dial-chat/issues/7733): opening a
previously created toolset in the Catalog offers no Edit action — the toolset can only be
viewed, even though the `/toolset-editor` page (`apps/chat/src/pages/ToolsetEditor/`) already
supports an edit mode via a `?id=` query param. The Catalog's generic `isEditable` +
`onEdit` mechanism (added for QuickApps in `catalog-quickapp-edit-action`) is never wired up
for toolsets: `mapToolsetToCatalogItem` never sets `isEditable`, and `CatalogView`'s
`isPrimaryActionVisible`/`onEdit` handling only branches on `Model`/`Application`.

## What Changes

- `mapToolsetToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) sets
  `isEditable: toolset.isMy ?? false` — any toolset owned by the current user is editable,
  matching the existing `isMyApp` computation. No schema-type restriction (unlike QuickApps).
- `CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) gains a toolset
  branch in its edit-navigation handler: clicking Edit on an editable `CatalogEntityType.Toolset`
  item navigates to `ROUTES.ToolsetEditor` with `ToolsetEditorQuery.Id` set to the item's id
  and `ToolsetEditorQuery.ReturnUrl` set to `ROUTES.Catalog`, reusing the existing
  `?id=`-driven edit-mode detection in `ToolsetEditor.tsx`.
- The generic `onEdit`/`isEditable` details-panel mechanism itself (`libs/catalog`) is
  unchanged — this only wires the existing mechanism for one more entity type.

## Capabilities

### New Capabilities

_(none — this reuses the existing generic edit-action mechanism)_

### Modified Capabilities

- `catalog-quickapp-edit-action`: the requirement stating toolsets are never editable
  through this action is superseded — toolsets owned by the current user are now editable,
  and `CatalogView`'s edit handler now covers both QuickApps and toolsets.

## Impact

- `apps/chat/src/utils/map-deployment-to-catalog-item.ts` — `mapToolsetToCatalogItem` sets
  `isEditable`.
- `apps/chat/src/components/CatalogView/CatalogView.tsx` — edit handler and
  `isPrimaryActionVisible`/edit-visibility logic gain a toolset branch; reuses
  `ToolsetEditorQuery` (`apps/chat/src/constants/toolsets.ts`) and `ROUTES.ToolsetEditor`.
- No backend, OpenAPI, or `libs/catalog` changes — purely app-level wiring of an existing
  mechanism.
