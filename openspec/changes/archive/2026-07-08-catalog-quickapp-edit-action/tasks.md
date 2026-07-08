## 1. Catalog lib models

- [x] 1.1 Add `isEditable?: boolean` to `CatalogItem` (`libs/catalog/src/models/catalog-item.ts`)
- [x] 1.2 Add `editActionLabel?: string` to `ItemDetailsTexts` (`libs/catalog/src/models/item-details-props.ts`)
- [x] 1.3 Add `onEdit?: (item: CatalogItem) => void` to `DetailsPanelProps` and `CatalogProps`

## 2. Catalog lib components

- [x] 2.1 Add `onEdit` prop and Edit button (`NeutralButton` + `IconPencil`) to `Header.tsx`, gated on `onEdit` being supplied AND `item.isEditable`
- [x] 2.2 Thread `onEdit` through `DetailsPanel.tsx` to `Header`
- [x] 2.3 Thread `onEdit` through `Catalog.tsx` to `DetailsPanel`
- [x] 2.4 Update `Header.spec.tsx` with coverage: hidden without `onEdit`, hidden when not editable, shown when editable, label override, click calls `onEdit` with the item

## 3. apps/chat wiring

- [x] 3.1 Add `editableSchemaId` parameter to `mapDeploymentToCatalogItem`; compute `isEditable` as `deployment.isMy && deployment.applicationTypeSchemaId === editableSchemaId`
- [x] 3.2 Add unit tests for `mapDeploymentToCatalogItem`'s `isEditable` computation (own QuickApp, other user's QuickApp, own non-QuickApp, no schema resolved)
- [x] 3.3 In `CatalogView.tsx`, compute `quickAppSchemaId` once via `isQuickAppSchema` over `schemas` and pass it into every `mapDeploymentToCatalogItem` call
- [x] 3.4 Generalize `buildEditorUrl` to `{ schemaId, step, appId?, isCreating? }` and update the "Create QuickApp" option to use it
- [x] 3.5 Add `handleEditApp` navigating to `AppsEditorStep.Settings` with the item's `id` as `appId`, and wire `onEdit={handleEditApp}` on `<Catalog>`
- [x] 3.6 Pass `editActionLabel: t(ButtonsI18nKeys.Edit)` in `detailsTexts` (no new i18n key needed)

## 4. Verification

- [x] 4.1 `npm exec nx run @epam/ai-dial-catalog:lint --fix` and `npm exec nx run @epam/ai-dial-catalog:test` pass
- [x] 4.2 `npm exec nx run-many -t lint -p catalog chat --fix` (via `nx run-many --targets=lint`) passes with no new warnings/errors
- [x] 4.3 `npm exec nx run @epam/chat:test -- map-deployment-to-catalog-item` and `-- CatalogView` pass
