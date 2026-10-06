# application-editor-registry Specification

## Purpose

Defines the generic app-level `ApplicationEditorPage` and the `ApplicationEditorDefinition` contract (Setup slot, setup validation, payload mappers, create strategy) that renders toolsets, custom apps, quick apps and schema-form apps, and how a new application type is registered.

## Requirements

### Requirement: One generic page renders every application kind

`apps/chat/src/pages/ApplicationEditor/ApplicationEditorPage.tsx` SHALL be the route element for every application editor. It takes a `kind: ApplicationEditorKind` prop, where `ApplicationEditorKind` is a string enum declared in `apps/chat/src/types/application-editor.ts` with members `Toolset = 'toolset'`, `CustomApp = 'custom-app'`, `QuickApp = 'quick-app'` and `SchemaApp = 'schema-app'`.

It resolves the kind to an `ApplicationEditorDefinition` from the module-level `APPLICATION_EDITOR_DEFINITIONS` record (`apps/chat/src/pages/ApplicationEditor/definitions/index.ts`). A definition with `renderPage` (detected by `isApplicationEditorPageDefinition`) renders `definition.renderPage()`; every other definition renders `ApplicationFormEditor` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`, keyed by the resolved kind), which renders `EntityEditor` from `@epam/ai-dial-builder-form`. An unknown kind renders nothing.

The `ApplicationEditorKind.QuickApp` route serves every application schema: the page resolves the kind with `resolveSchemaEditorKind(schemas, <schema query param>)` — a known schema without an `editorUrl` resolves to `ApplicationEditorKind.SchemaApp`, anything else to `ApplicationEditorKind.QuickApp` — and renders nothing while the schema list is still loading and empty.

The existing routes SHALL keep their paths and query-param contracts and render this page, lazy-loaded with a `Suspense` fallback:

| Route | Kind |
|---|---|
| `ROUTES.ToolsetEditor` (`/toolset-editor`) | `ApplicationEditorKind.Toolset` |
| `ROUTES.CustomAppEditor` (`/custom-app-editor`) | `ApplicationEditorKind.CustomApp` |
| `ROUTES.AppsEditor` (`/apps-editor`) | `ApplicationEditorKind.QuickApp` (resolved to `SchemaApp` per schema) |

The form editor root SHALL use `className="relative flex min-h-0 flex-1 flex-col"` (grow into the space below the mobile-only global header).

#### Scenario: Each existing route renders the generic page with its kind
- **WHEN** the user navigates to `/custom-app-editor?returnUrl=%2Fcatalog`
- **THEN** `ApplicationEditorPage` renders with `kind = ApplicationEditorKind.CustomApp`
- **AND** the header title is "Create custom app"

#### Scenario: Existing deep links keep working
- **WHEN** the user opens a previously generated link `/apps-editor?step=settings&schema=<id>&appId=<appId>&returnUrl=%2Fcatalog`
- **THEN** the quick-app editor opens in edit mode for `<appId>`
- **AND** the `step` param is ignored without error

#### Scenario: A schema without an embedded editor opens the schema form
- **WHEN** the user opens `/apps-editor?schema=<id>` for a schema whose summary has no `editorUrl`
- **THEN** the page renders the `ApplicationEditorKind.SchemaApp` definition

### Requirement: ApplicationEditorDefinition contract

`ApplicationEditorDefinition` (`apps/chat/src/models/application-editor.ts`) SHALL be the union of `ApplicationEditorFormDefinition<ApplicationSetupValues>` and `ApplicationEditorPageDefinition`. A form definition is registered through `defineApplicationEditor<TSetup>(...)` (`apps/chat/src/utils/application-editor.ts`) and SHALL declare everything that differs between form-based kinds:

- `kind`, `notifiableEntity`, an optional `getNotificationTarget(ctx)` that overrides it (e.g. from the schema), and `createStrategy`. `createStrategy` is the string enum `ApplicationCreateStrategy` with members `AllAtOnce = 'all-at-once'` and `MetadataFirst = 'metadata-first'`.
- `idQueryParam`: the query param holding the edited application's id.
- `messageKeys`: i18n keys `createTitle`, `editTitle`, `createFailed`, `saveFailed`, `loadFailed`, `savingOverlay`, `loadingOverlay`, and an optional `preview` (header Preview label).
- `getTitle?(ctx, isEditMode)`: resolves the title when it needs interpolation; defaults to the plain title keys.
- `metadataValidation`: the `DeploymentCreationFormValidationOptions` passed to `useMetadataForm`.
- `getMetadataLabelOverrides?(t)`: optional per-field label overrides, such as the Name placeholder.
- `defaultMetadata` and `defaultSetup`, an optional `loadSetup(appId, deployment)` for kinds whose setup is fetched separately in edit mode, and `validateSetup(setup, t)`.
- `needsConfirmation?(setup)` and `confirmation?` (`titleKey`/`descriptionKey`/`confirmKey`): a `ConfirmationPopup` shown before the request when `needsConfirmation` returns `true`.
- `Setup`: a component receiving `ApplicationSetupProps<TSetup>` (including a `ref` prop) and optionally exposing `ApplicationSetupHandle.save(metadata)` and `startPreview(metadata)`.
- `Preview?` (receiving `ApplicationPreviewProps`) and `isPreviewAvailable?(ctx)`: a full-page preview of an edited application.
- `create(metadata, setup, ctx)`, and optionally `update(appId, metadata, setup)`. Both call existing `apps/chat/src/server-api` wrappers only.

`ApplicationEditorContext` is `{ searchParams, schemas, t }`. A page definition (`ApplicationEditorPageDefinition`) is `{ kind, renderPage: () => ReactNode }`, an escape hatch that replaces the page body. It SHALL be used only by `ApplicationEditorKind.Toolset` (see `toolset-editor-library`).

A definition SHALL NOT call `fetch`, read environment variables or navigate. Navigation, notifications, the saving overlay and deployment refetching are owned by the page.

#### Scenario: A new kind needs only a definition
- **WHEN** a unit test registers a fake kind whose definition supplies a one-field `Setup` component and a mocked `create`
- **THEN** `ApplicationEditorPage` renders the shared header, the shared Metadata section and that `Setup` inside the "Setup" section
- **AND** clicking Create calls the fake `create` with the metadata and setup values, raises a success notification and navigates to `returnUrl`
- **AND** no other file changes are needed for the kind to work

### Requirement: Shared page lifecycle

For every kind that does not use `renderPage`, `ApplicationFormEditor` SHALL own the following:

- **Mode.** Create mode is the default. Edit mode applies when the definition's `idQueryParam` is present (`ToolsetEditorQuery.Id` for custom apps, `AppsEditorQuery.AppId` for quick and schema apps).
- **Return URL.** `returnUrl` is always `ROUTES.Catalog`; a `returnUrl` query param is not read.
- **Edited deployment.** Resolved through `useEditedApplication`, which re-resolves the match in `useDeployments().items` on every list update until one is found and keeps the first match per id; it reports `isResolving` only while the list is still loading, so once the list finishes loading without a match the form keeps its defaults. The metadata is reseeded once per deployment id. A kind that loads its setup separately (`loadSetup`) SHALL raise an error notification (`messageKeys.loadFailed`) and navigate to `returnUrl` with `replace: true` when that load fails.
- **Loading and saving overlay.** While the edited deployment or the setup is loading, or while saving, the editor body is marked `inert` behind an absolutely positioned backdrop overlay with a `Spinner` and the `messageKeys.loadingOverlay` / `messageKeys.savingOverlay` label; an always-mounted `role="status"` `aria-live="polite"` region announces the same label.
- **Metadata state.** Held via `useMetadataForm` from `@epam/ai-dial-builder-form`, seeded from the deployment in edit mode.
- **Avatar picking.** Wired via `useApplicationAvatarPicker`: `bucket`, `FileManagerModal`, `resolveIconUrl`, `AVATAR_ALLOWED_MIME_TYPES` and `AVATAR_MAX_FILE_SIZE_BYTES`, with the picker label object built once in that hook.
- **Metadata labels.** Built via `useMetadataLabels` from `EditorI18nKeys`.
- **Submit.**
  1. `attemptSubmit()` runs. If it fails, errors are shown and the first invalid field is focused (by `MetadataForm`); no request is sent.
  2. `validateSetup` runs. Setup errors are shown; no request is sent.
  3. The confirmation popup is shown when `needsConfirmation(setup)` returns `true`.
  4. The request runs with the saving overlay shown.
- **Failure.** A failed request SHALL raise an error notification with the API error message (falling back to the kind's `createFailed` or `saveFailed` message) and the trace id as `requestId`, keep the user on the page and re-enable the actions. A failed Setup-handle `save` is shown inline by the Setup component instead. `EntityEditor`'s `alert` region is reserved for inline, kind-specific messages.
- **Success.** `refetchDeployments()` runs, then `useOperationNotification` reports `EntityOperation.Created` or `EntityOperation.Edited` with the metadata name (and the schema `type` when the notification target supplies one), then the page navigates to `returnUrl`. The `MetadataFirst` create step is the exception; see the next requirement.
- **Cancel and back.** Both navigate to `returnUrl`.
- **Preview.** In edit mode, when the definition has a `Preview`, a `messageKeys.preview` key and `isPreviewAvailable(ctx)` is not `false`, a header `GhostButton` calls the Setup handle's `startPreview(metadata)` and then shows the `Preview` full-page; the editor stays mounted but hidden and `inert` while previewing, and focus returns to the visible Preview button when it closes.

The primary button SHALL be labelled `buttons.create` in create mode and `buttons.save` in edit mode. It SHALL be disabled only while submitting or while the definition's `Setup` reports it is not ready through `onReadyChange(false)`. It SHALL NOT be disabled because of validation errors.

#### Scenario: Invalid metadata blocks the request and focuses the field
- **WHEN** the user clicks Create with an empty Name
- **THEN** a name-required error renders under Name, focus moves to the Name input, and no create request is sent

#### Scenario: API failure keeps the user on the page
- **WHEN** the create request rejects with an API error carrying a message and a trace id
- **THEN** an error notification shows that message with the trace id as `requestId`, the saving overlay disappears, and the URL is unchanged

#### Scenario: Edit id missing from the settled deployments list
- **WHEN** the page opens in edit mode with an id that is absent from the deployments list once it finishes loading
- **THEN** the page stops showing the resolving overlay and renders the form with its default metadata

#### Scenario: Failed setup load returns to the catalog
- **WHEN** the kind's `loadSetup` rejects in edit mode
- **THEN** an error notification is shown and the page navigates to `returnUrl` with `replace: true`

### Requirement: Create strategies

`ApplicationFormEditor` SHALL persist each kind according to its definition's `createStrategy`:

- **`ApplicationCreateStrategy.AllAtOnce`.** A single `create` or `update` call persists metadata and setup together. Success then follows the shared success path.
- **`ApplicationCreateStrategy.MetadataFirst`.**
  - In create mode the `Setup` component SHALL receive no `appId`, and SHALL render the `applicationEditor.setupPendingCreate` placeholder ("Create the application to configure its setup.").
  - Clicking Create SHALL call `create` with the metadata only and raise the Created notification. It SHALL then replace the URL's search params (`replace: true`) to add the new id, which switches the page into edit mode in place, and start a best-effort `refetchDeployments()` that does not block the form.
  - After that switch, the page SHALL NOT navigate away. The title becomes the edit title and the primary button becomes Save.
  - In edit mode, when the definition has no `update`, Save SHALL call the `Setup` handle's `save(metadata)`. After it resolves, the page follows the shared success path with `EntityOperation.Edited`.

#### Scenario: Metadata-first create switches to edit mode in place
- **WHEN** a user fills Name for a quick app and clicks Create, and `createApplication` returns `{ id: "app-1" }`
- **THEN** a "Quick app created successfully" notification shows
- **AND** the URL gains `appId=app-1` without a history entry
- **AND** the header shows the edit title with a Save button
- **AND** the Setup section loads the schema editor for `app-1`

#### Scenario: All-at-once create exits after one request
- **WHEN** a user completes a custom app's Metadata and Setup, clicks Create and confirms the popup
- **THEN** exactly one `createApplication` request is sent with metadata and setup fields, a Created notification shows, and the page navigates to `returnUrl`

### Requirement: Registered kinds

`APPLICATION_EDITOR_DEFINITIONS` SHALL contain exactly these entries:

- **`CustomApp`**:
  - `AllAtOnce` strategy, `idQueryParam: ToolsetEditorQuery.Id`, with `loadSetup` and `update`.
  - Setup: `CustomAppSetup`, which holds the four fields of `custom-app-editor` "CustomAppSettingsForm fields".
  - Validation: `validateVersionPattern: SEMVER_VERSION_PATTERN`.
  - Confirmation: `customApp.saveConfirm.*`, shown only when `needsConfirmation` finds the features data invalid.
  - Title: `customApp.createTitle` / `customApp.editTitle`.
- **`QuickApp`** (every schema with an embedded editor):
  - `MetadataFirst` strategy, `idQueryParam: AppsEditorQuery.AppId`, notification target from `resolveSchemaNotificationTarget`.
  - Setup: `QuickAppSetup`, which holds the schema `editorUrl` iframe.
  - Preview: `QuickAppPreview` (hosting `AppPreviewChat`), available only for the Quick Apps schema, behind the `basic.preview` header button.
  - Validation: `validateNamePattern: true` and `validateVersionPattern: SEMVER_VERSION_PATTERN`.
  - Title: `getSchemaAppTitle`, interpolating the schema `displayName` into `appsEditor.createTitle` / `appsEditor.editTitle`.
- **`SchemaApp`** (schemas without an embedded editor):
  - `AllAtOnce` strategy, `idQueryParam: AppsEditorQuery.AppId`, notification target from `resolveSchemaNotificationTarget`.
  - Setup: `SchemaAppSetup`, a form rendered from the schema; `loadSetup` reads `applicationProperties` through `getDeploymentDetails`, and `validateSetup` rejects missing required properties with `AppsEditorI18nKeys.SchemaFormRequiredMissing`.
  - Validation and title: as for `QuickApp`.
- **`Toolset`**:
  - Uses `renderPage`, delegating to `ToolsetApplicationEditor`, which renders the `@epam/ai-dial-toolset-editor` `ToolsetEditor` container.
  - That container is wired with the same `useApplicationAvatarPicker` and `useMetadataLabels` results.

#### Scenario: Registry covers all four kinds
- **WHEN** `APPLICATION_EDITOR_DEFINITIONS` is inspected in a unit test
- **THEN** it has entries for `toolset`, `custom-app`, `quick-app` and `schema-app`, and only the toolset entry defines `renderPage`

### Requirement: i18n, accessibility and RTL for the generic page

The following user-visible strings SHALL be added to `apps/chat/src/i18n/locales/en.json` (the only locale file), with keys in `apps/chat/src/constants/translation-keys.ts`:

| Key | English |
|---|---|
| `applicationEditor.setupPendingCreate` | `Create the application to configure its setup.` |
| `customApp.createTitle` | `Create custom app` |
| `customApp.editTitle` | `Edit custom app` |
| `appsEditor.createTitle` | `Create {{type}}` |
| `appsEditor.editTitle` | `Edit {{type}}` |

When the schema has no `displayName`, `type` SHALL fall back to `appsEditor.defaultTypeName` ("quick app").

Accessibility and RTL:

- The saving and loading overlay SHALL be announced through a `role="status"` `aria-live="polite"` region, the visual overlay itself is `aria-hidden`, and the content behind it SHALL be `inert`.
- The setup-pending placeholder is plain text inside the Setup section.
- No physical-direction Tailwind classes SHALL be introduced.

The feature is not gated by `ENABLED_FEATURES`. Catalog entry gating (`OverlayFeature.CustomApps`, `HideCustomAppCreation`) is unchanged.

#### Scenario: Saving overlay hides content from assistive tech
- **WHEN** a submit is in flight
- **THEN** the editor body carries the `inert` attribute and a polite live region announces the saving label
