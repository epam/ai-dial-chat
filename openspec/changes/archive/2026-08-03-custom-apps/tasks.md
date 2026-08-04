## 1. Feature flag

- [x] 1.1 Add `CustomApps = 'custom-apps'` to `OverlayFeature` enum in `libs/chat-shared/src/types/overlay/overlay-protocol.ts`

## 2. Catalog create option

- [x] 2.1 Add `useUiFeature(OverlayFeature.CustomApps)` check in `CatalogView.tsx`
- [x] 2.2 Push "Custom App" option into `createOptions` when feature flag is enabled, navigating to `/custom-app-editor` with `returnUrl: ROUTES.Catalog`
- [x] 2.3 Add i18n key `CreateCustomApp` to `CatalogI18nKeys` and `en.json`

## 3. Custom App Settings form

- [x] 3.1 Define `CustomAppFormData` and `CustomAppFormErrors` types in `apps/chat/src/types/custom-apps.ts` with fields: `completionUrl`, `featuresData`, `inputAttachmentTypes`, `maxInputAttachments`
- [x] 3.2 Create `CustomAppSettingsForm` component under `apps/chat/src/pages/ToolsetEditor/EditorForm/` with four fields:
  - Chat completion URL (`DialInput`, required, absolute URL validation, error on invalid)
  - Features data (`DialTextarea`, JSON validated on change against `rate_endpoint`/`configuration_endpoint`, error shown inline)
  - Input attachment types (`DialTagInput`, MIME type regex validation per tag via `MIME_TYPE_REGEX` in `utils/custom-apps.ts`)
  - Max attachments (`DialInput type=number`, min 1)
- [x] 3.3 Add `CustomAppI18nKeys` enum with keys for all field labels, descriptions, placeholders, validation errors, and save-confirm modal; add all values to `en.json`

## 4. Custom App Editor page

- [x] 4.1 Create `CustomAppEditorView` component mirroring `ToolsetEditorView` but rendering `CustomAppSettingsForm` in the Settings step; `GeneralForm` receives custom-app name/description placeholders
- [x] 4.2 Create `CustomAppEditor` page under `apps/chat/src/pages/ToolsetEditor/` reusing `ToolsetEditorHeader` and `CustomAppEditorView`; accepts `ToolsetEditorQuery.Id` for edit mode (load from API is a TODO); shows `DialConfirmationPopup` before save when optional fields (MIME types, features data) are invalid
- [x] 4.3 Register `ROUTES.CustomAppEditor = '/custom-app-editor'` and its lazy-loaded route in `app.tsx`

## 5. Catalog edit button

- [x] 5.1 Add `isCustomAppSchema` and `CUSTOM_APP_SCHEMA_ID` to `utils/application-schema.ts`
- [x] 5.2 Add 6th param `isCustomAppsEditable = false` to `mapDeploymentToCatalogItem`; `isEditable` uses OR: schema-ID match OR (`isCustomAppsEditable && !applicationTypeSchemaId && type === 'application'`) so schema-less custom apps are editable without a schema ID
- [x] 5.3 Pass `isCustomAppsEnabled` as 6th arg to `mapDeploymentToCatalogItem` in `CatalogView`; add `isCustomAppsEnabled` to `catalogItems` deps
- [x] 5.4 Update `handleEdit` in `CatalogView` to navigate to `CustomAppEditor` when `isCustomAppsEnabled && deployment != null && !deployment.applicationTypeSchemaId` (schema-less apps, not by schema ID match)

## 6. GeneralForm placeholder props

- [x] 6.1 Add `namePlaceholder` and `descriptionPlaceholder` props to `GeneralForm`; `ToolsetEditorView` passes toolset strings, `CustomAppEditorView` passes `CustomAppI18nKeys.NamePlaceholder` / `DescriptionPlaceholder`

## 7. Edit mode — settings save

- [x] 7.1 Add `version`, `endpoint`, `features`, `inputAttachmentTypes`, `maxInputAttachments` optional fields to `UpdateApplicationBodyDto`; `type` and `applicationProperties` remain excluded
- [x] 7.2 Apply new settings fields in `ApplicationsService.updateApplication` when present (same conditional pattern as existing fields)
- [x] 7.3 In `CustomAppEditor.doSave`, send full settings alongside general fields when in edit mode; parse `featuresData` JSON before sending
- [x] 7.4 Make `CreateApplicationBodyDto.type` optional (`@IsOptional`) — custom apps have no application-type schema ID; service omits `application_type_schema_id` and `application_properties` when absent/empty
- [x] 7.5 Remove `type: CUSTOM_APP_SCHEMA_ID` from the create payload in `CustomAppEditor` — custom apps are plain-endpoint apps with no schema
- [x] 7.6 Add guard in `handleSave`: redirect to General step and show error if `name` is blank

## 8. Edit mode — settings load

- [x] 8.1 In `DeploymentsService.buildApplicationDetails`, call `getCustomApplication(bucket, path)` for `applications/{bucket}/{path}` IDs; prefer `customAppRaw.endpoint` over the model-listing endpoint; merge `customAppRaw.features` into `applicationProperties` so the Settings textarea is pre-populated
- [x] 8.2 Add `HideCustomAppCreation = 'hide-custom-app-creation'` to `OverlayFeature` — modifier flag allowing operators to suppress the creation entry while keeping the feature flag enabled for edit
