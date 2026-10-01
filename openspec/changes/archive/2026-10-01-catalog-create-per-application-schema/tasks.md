Slicing strategy: **vertical**. Each slice ran end to end (lib → app → tests) before the next widened it. Slices 1–5 are already implemented on `feat/application-per-schemes`; slice 6 holds what remains before merge.

## 1. One Create option per runner

- [x] 1.1 Add `getRunnerSchemas` / `RunnerSchema` / `RunnerSchemaLike` to `libs/chat-hooks/src/shared/application-schema.ts`: dedupe by `id`, drop id-less entries and `custom_app`, no other filter.
- [x] 1.2 Change `libs/chat-hooks/src/catalog/useCatalogEditNavigation/useCatalogEditNavigation.ts` to take `schemas` instead of `quickAppSchemaId` and build one `runner:<id>` option per runner, labelled with `displayName || id`, navigating through `urls.buildQuickAppCreateUrl(id)`.
- [x] 1.3 Remove `CatalogEditNavigationLabels.createQuickApp`, `CatalogI18nKeys.CreateQuickApp` and `catalog.create.quickApp` from `apps/chat/src/constants/translation-keys.ts` / `apps/chat/src/i18n/locales/en.json`; wire `schemas` from `apps/chat/src/components/CatalogView/CatalogView.tsx`.
- [x] 1.4 Architecture guard: the hook still receives every route through `CatalogEditNavigationUrls` and every string through `labels`; no route, query key, i18n or client import in `libs/chat-hooks`.
- [x] 1.5 Unit tests in `libs/chat-hooks/src/catalog/useCatalogEditNavigation/tests/useCatalogEditNavigation.spec.ts`: dedupe, `custom_app` exclusion, Quick app and Quick app 2.0 as two named options, a schema with no editor/endpoint/properties still offered.
  - Verification: `npm run test:file -- libs/chat-hooks/src/catalog/useCatalogEditNavigation/tests/useCatalogEditNavigation.spec.ts`

## 2. Sorting, search and highlighting

- [x] 2.1 Sort runners and static options together with `localeCompare(…, { sensitivity: 'base' })` in `useCatalogEditNavigation.ts`.
- [x] 2.2 Own the search query in `useCatalogEditNavigation.ts`; filter runner/toolset/custom-app/prompt labels and the Skill group per the spec; return `createSearch` only while runner options exist.
- [x] 2.3 Add `CatalogCreateSearch`, `Catalog.createSearch` and the `createSearchPlaceholder` / `createSearchClearLabel` / `createNoResultsLabel` titles in `libs/catalog/src/models/catalog-props.ts`, export the type from `libs/catalog/src/index.ts`, forward them in `libs/catalog/src/components/Catalog/Catalog.tsx`.
- [x] 2.4 Render the searchable branch in `libs/catalog/src/components/Catalog/CreateButton.tsx` (kit `Dropdown` + `Button`, `Search` in `menuHeader`, no-results `role="status"`, reset on close) and highlight labels via `libs/catalog/src/utils/create-menu.tsx` (`Highlight`, `maxLines={1}`).
- [x] 2.5 Pass the translated titles from `CatalogView.tsx` (`basic.searchPlaceholder`, `basic.clearSearch`, `basic.noResults` — existing keys, no new strings).
- [x] 2.6 Architecture guard: `libs/catalog` receives the query state and all strings as props; no i18n, route or API knowledge added.
- [x] 2.7 Tests: sort order and search filtering in `useCatalogEditNavigation.spec.ts`; search field, highlight `mark`, no-results status and reset-on-close in `libs/catalog/src/components/Catalog/tests/CreateButton.spec.tsx`.
  - Verification: `npm run test:file -- libs/catalog/src/components/Catalog/tests/CreateButton.spec.tsx libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx`

## 3. Fixed-size scrolling panel

- [x] 3.1 Add `CREATE_MENU_VISIBLE_ROWS`, `CREATE_MENU_MAX_HEIGHT_PX` and `CREATE_MENU_LIST_CLASS_NAME` to `libs/catalog/src/constants/create-menu.ts`.
- [x] 3.2 Apply `maxDropdownHeight`, `listClassName`, `matchReferenceWidth={false}`, `placement="bottom-end"` and a sticky search row in `CreateButton.tsx`.
- [x] 3.3 RTL check: the panel anchors with logical `bottom-end`; no physical direction classes added; no directional icon added (the chevron is vertical).
  - Verification: `npm run test:file -- libs/catalog/src/components/Catalog/tests/CreateButton.spec.tsx`

## 4. Editing apps of any runner

- [x] 4.1 Pass every runner schema id as `editableSchemaIds` in `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`.
- [x] 4.2 Route Edit to the deployment's own schema, falling back to the QuickApp schema, in `useCatalogEditNavigation.ts`'s `handleEdit`.
- [x] 4.3 Tests: own-schema routing and fallback in `useCatalogEditNavigation.spec.ts`.
  - Verification: `npm run test:file -- libs/chat-hooks/src/catalog/useCatalogEditNavigation/tests/useCatalogEditNavigation.spec.ts apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx`

## 5. Schema-app editor

- [x] 5.1 Add `ApplicationEditorKind.SchemaApp` in `apps/chat/src/types/application-editor.ts` and `SchemaApplicationSetup` in `apps/chat/src/models/application-editor.ts`.
- [x] 5.2 Add `resolveSchemaEditorKind` (editor-less → `SchemaApp`) and `getMissingRequiredProperties` to `apps/chat/src/utils/application-editor.ts`.
- [x] 5.3 Resolve the kind and wait for the schema list in `apps/chat/src/pages/ApplicationEditor/ApplicationEditorPage.tsx`; register `schemaAppDefinition` in `definitions/index.ts`.
- [x] 5.4 Implement `apps/chat/src/pages/ApplicationEditor/setup/SchemaAppSetup.tsx` (schema fetch with cancelled flag, `DialSchemaRenderer`, spinner / load-error / required-error states, `requiredProperties` sync).
- [x] 5.5 Implement `apps/chat/src/pages/ApplicationEditor/definitions/schemaAppDefinition.tsx` (`AllAtOnce` create with `applicationProperties`, `loadSetup`, `update`, `validateSetup`, schema-named title).
- [x] 5.6 Add `appsEditor.schemaForm.loadFailed` and `appsEditor.schemaForm.requiredMissing` to `apps/chat/src/i18n/locales/en.json` and `AppsEditorI18nKeys`.
- [x] 5.7 Unit tests for the helpers in `apps/chat/src/utils/tests/application-editor.spec.ts`.
- [x] 5.8 Page tests in `apps/chat/src/pages/ApplicationEditor/tests/schemaAppDefinition.spec.tsx`: form from schema, blocked create on missing required, one-request create with `applicationProperties`, edit pre-fill and save, schema load error.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/application-editor.spec.ts apps/chat/src/pages/ApplicationEditor/tests/schemaAppDefinition.spec.tsx apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`
- [x] 5.9 Update `libs/chat-hooks/README.md` (`getRunnerSchemas`, `useCatalogEditNavigation` params/returns) and `apps/chat-api/README.md`.
  - Verification: `npm run validate:docs`

## 6. Before merge

- [x] 6.1 Resolve the raw-item spread and `console.log(rawItem)` in `apps/chat-api/src/application-schemas/application-schemas.service.ts` (`listApplicationSchemas`) so the response matches `ApplicationSchemaSummaryDto`; then run `npm run openapi` and `npm run openapi:check`.
  - Verification: `npm run test:file -- apps/chat-api/src/application-schemas/tests/application-schemas.service.spec.ts`
- [x] 6.2 Remove `editorUrl` and `schemaEndpoint` from `RunnerSchemaLike` in `libs/chat-hooks/src/shared/application-schema.ts` if no reader is restored (declared-but-unread fields).
  - Verification: `npm run test:file -- libs/chat-hooks/src/catalog/useCatalogEditNavigation/tests/useCatalogEditNavigation.spec.ts`
- [ ] 6.3 Run `npm run verify:changed`, then close the change with one `npm run verify:full`.

## 8. Review fixes

- [x] 8.1 Make the Create menu's sticky search row cover the panel's 4px inset (`-top-1`) in `libs/catalog/src/components/Catalog/CreateButton.tsx`, so scrolled options no longer show above it.
- [x] 8.2 Add `NotifiableEntity.SchemaApp`, its `ENTITY_OPERATION_NOTIFICATIONS` entry, `EntityNotificationsI18nKeys.SchemaApp*` and the `entityNotifications.schemaApp.*` strings (`{{type}}` = schema display name), and the `type` field of `OperationNotificationParams` (`apps/chat/src/hooks/useOperationNotification.ts`).
- [x] 8.3 Add `getNotificationTarget` / `ApplicationNotificationTarget` to `apps/chat/src/models/application-editor.ts`, use it in `ApplicationFormEditor.tsx`, and set it to `resolveSchemaNotificationTarget` (`apps/chat/src/utils/application-editor.ts`) in `quickAppDefinition.tsx` and `schemaAppDefinition.tsx`.
- [x] 8.4 Resolve `SchemaApp` in `resolveCatalogItemEntity` and add `findSchemaDisplayName` (`apps/chat/src/utils/entity-notification.ts`); pass `schemas` and `type` from `CatalogView.tsx` and `useCatalogPublishing.ts`.
- [x] 8.5 Tests in `apps/chat/src/utils/tests/entity-notification.spec.ts`, `apps/chat/src/utils/tests/application-editor.spec.ts`, and `apps/chat/src/hooks/useCatalogPublishing/tests/useCatalogPublishing.spec.ts`.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/entity-notification.spec.ts apps/chat/src/utils/tests/application-editor.spec.ts apps/chat/src/hooks/tests/useOperationNotification.spec.ts apps/chat/src/hooks/useCatalogPublishing/tests/useCatalogPublishing.spec.ts apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`

## 9. PR #9216 review fixes

- [x] 9.1 Mark every missing required field after a blocked Create/Save: `skipUntouched={!errors.properties}` in `SchemaAppSetup.tsx`, and `getMissingRequiredProperties` uses the renderer's own rule (absent, `null`, `''`).
- [x] 9.2 Close the schema-loading race: `SchemaAppSetup` reports `onReadyChange(false)` until the schema's `required` list is in the setup, `ApplicationFormEditor` disables Create as well as Save while the Setup is not ready, and the `required` lists are compared as sets.
- [x] 9.3 Edit mode merges the schema's top-level defaults under the saved properties (`getSchemaTopLevelDefaults`); the loading `Spinner` gets the translated `appsEditor.settingsStep.loadingLabel`; an empty schema id fails without a request.
- [x] 9.4 `resolveCatalogItemEntity` classifies the full schema, so a QuickApp schema matched only by display name gets the quick-app copy.
- [x] 9.5 Move the Metadata defaults, label overrides, schema id, title and locale helpers shared by `quickAppDefinition` and `schemaAppDefinition` to `definitions/schemaDefinitionHelpers.ts`.
- [x] 9.6 Sync `app-editor-flow` and `app-preview-chat` specs with the removed `step`/`isCreating`/`returnUrl` params and `AppsEditorStep`.
- [x] 9.7 Tests: blocked create marks the untouched field, Create waits for the schema, the page renders nothing while the schema list loads, Created/Edited notifications carry `SchemaApp` + `type`, publish/unpublish confirmations name the schema, defaults of a newly added property are saved.
  - Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor apps/chat/src/utils/tests/application-editor.spec.ts apps/chat/src/utils/tests/entity-notification.spec.ts apps/chat/src/hooks/useCatalogPublishing/tests/useCatalogPublishing.spec.ts`

## 7. Follow-ups (out of scope)

- [ ] 7.1 Pass translated `texts` to `DialSchemaRenderer` in `SchemaAppSetup.tsx` (placeholders, add/remove labels, aria labels).
- [ ] 7.2 Report to `ai-dial-ui-kit`: `DialSchemaRenderer` labels a field's group (`aria-labelledby="undefined-label"`) instead of its input.
- [ ] 7.3 Decide whether External app needs its own form (0.x `ExternalAppForm`) instead of the generic schema form.
