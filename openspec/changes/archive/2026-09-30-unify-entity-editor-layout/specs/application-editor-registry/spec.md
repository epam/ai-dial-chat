## ADDED Requirements

### Requirement: One generic page renders every application kind

`apps/chat/src/pages/ApplicationEditor/ApplicationEditorPage.tsx` SHALL be the route element for every application editor. It takes a `kind: ApplicationEditorKind` prop, where `ApplicationEditorKind` is a string enum declared in `apps/chat/src/types/application-editor.ts` with members `Toolset = 'toolset'`, `CustomApp = 'custom-app'` and `QuickApp = 'quick-app'`.

It resolves the kind to an `ApplicationEditorDefinition` from the module-level `APPLICATION_EDITOR_DEFINITIONS` record (`apps/chat/src/pages/ApplicationEditor/definitions/index.ts`) and renders `EntityEditor` from `@epam/ai-dial-builder-form`.

The existing routes SHALL keep their paths and query-param contracts and render this page, lazy-loaded with a `Suspense` fallback:

| Route | Kind |
|---|---|
| `ROUTES.ToolsetEditor` (`/toolset-editor`) | `ApplicationEditorKind.Toolset` |
| `ROUTES.CustomAppEditor` (`/custom-app-editor`) | `ApplicationEditorKind.CustomApp` |
| `ROUTES.AppsEditor` (`/apps-editor`) | `ApplicationEditorKind.QuickApp` |

The page root SHALL use `className="flex min-h-0 flex-1 flex-col"` (grow into the space below the mobile-only global header).

#### Scenario: Each existing route renders the generic page with its kind
- **WHEN** the user navigates to `/custom-app-editor?returnUrl=%2Fcatalog`
- **THEN** `ApplicationEditorPage` renders with `kind = ApplicationEditorKind.CustomApp`
- **AND** the header title is "Create custom app"

#### Scenario: Existing deep links keep working
- **WHEN** the user opens a previously generated link `/apps-editor?step=settings&schema=<id>&appId=<appId>&returnUrl=%2Fcatalog`
- **THEN** the quick-app editor opens in edit mode for `<appId>`
- **AND** the `step` param is ignored without error

### Requirement: ApplicationEditorDefinition contract

An `ApplicationEditorDefinition<TSetup>` SHALL declare everything that differs between application kinds:

- `kind`, `notifiableEntity` and `createStrategy`. `createStrategy` is the string enum `ApplicationCreateStrategy` with members `AllAtOnce = 'all-at-once'` and `MetadataFirst = 'metadata-first'`.
- `title(mode, { schema, t })`: the resolved `<h1>` text.
- `metadataValidation`: the `DeploymentCreationFormValidationOptions` passed to `useMetadataForm`.
- `metadataLabelOverrides?(t)`: optional per-field label overrides, such as the Name placeholder.
- `defaultMetadata` and `defaultSetup`, an optional `loadSetup(appId, deployment?)` for kinds whose setup is fetched separately in edit mode, and `validateSetup(setup, t)`.
- `Setup`: a `forwardRef` component receiving `ApplicationSetupProps<TSetup>` and optionally exposing `ApplicationSetupHandle.save(metadata)`.
- `create(metadata, setup, ctx)`, and optionally `update(id, metadata, setup, ctx)`. Both call existing `apps/chat/src/server-api` wrappers only.
- `confirmBeforeSubmit?`: i18n keys for a `ConfirmationPopup` shown before the request.
- `renderExtraActions?(ctx)`: header actions rendered before Cancel.
- `renderPage?(ctx)`: an escape hatch that replaces the page body. It SHALL be used only by `ApplicationEditorKind.Toolset` (see `toolset-editor-library`).

A definition SHALL NOT call `fetch`, read environment variables or navigate. Navigation, notifications, the saving overlay and deployment refetching are owned by the page.

#### Scenario: A new kind needs only a definition
- **WHEN** a unit test registers a fake kind whose definition supplies a one-field `Setup` component and a mocked `create`
- **THEN** `ApplicationEditorPage` renders the shared header, the shared Metadata section and that `Setup` inside the "Setup" section
- **AND** clicking Create calls the fake `create` with the metadata and setup values, raises a success notification and navigates to `returnUrl`
- **AND** no other file changes are needed for the kind to work

### Requirement: Shared page lifecycle

For every kind that does not use `renderPage`, `ApplicationEditorPage` SHALL own the following:

- **Mode.** Create mode is the default. Edit mode applies when the kind's id query param is present (`ToolsetEditorQuery.Id` for custom apps, `AppsEditorQuery.AppId` for quick apps).
- **Edited deployment.** Resolved through `useEditedApplication`, which re-resolves the match in `useDeployments().items` on every list update until one is found, applies it to the metadata once per deployment id, and stops waiting once the list finishes loading without a match (the form then keeps its defaults), as `CustomAppEditor` does today. A kind that loads its setup separately (`loadSetup`) SHALL raise an error notification and navigate to `returnUrl` with `replace: true` when that load fails.
- **Loading state.** While the edited deployment is unresolved, a centered `Spinner` renders inside `EntityEditor`'s body with the header still visible.
- **Metadata state.** Held via `useMetadataForm` from `@epam/ai-dial-builder-form`, seeded from the deployment in edit mode.
- **Avatar picking.** Wired via `useApplicationAvatarPicker`: `bucket`, `FileManagerModal`, `resolveIconUrl`, `AVATAR_ALLOWED_MIME_TYPES` and `AVATAR_MAX_FILE_SIZE_BYTES`, with the picker label object built once in that hook.
- **Metadata labels.** Built via `useMetadataLabels` from `EditorI18nKeys`.
- **Submit.**
  1. `attemptSubmit()` runs. If it fails, errors are shown and the first invalid field is focused (by `MetadataForm`); no request is sent.
  2. `validateSetup` runs. Setup errors are shown; no request is sent.
  3. The optional confirmation popup is shown.
  4. The request runs.
  5. `isSubmitting` is set and the body is marked `inert` behind an `aria-live="polite"` saving overlay.
- **Failure.** A failed request SHALL raise an error notification with the API error message (falling back to the kind's generic create- or save-failed message) and the trace id as `requestId`, keep the user on the page and re-enable the actions. `EntityEditor`'s `alert` region is reserved for inline, kind-specific messages.
- **Success.** `useOperationNotification` reports `EntityOperation.Created` or `EntityOperation.Edited` with the metadata name, then `refetchDeployments()` runs, then the page navigates to `returnUrl`. The `MetadataFirst` create step is the exception; see the next requirement.
- **Cancel and back.** Both navigate to `returnUrl`.

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

`ApplicationEditorPage` SHALL persist each kind according to its definition's `createStrategy`:

- **`ApplicationCreateStrategy.AllAtOnce`.** A single `create` or `update` call persists metadata and setup together. Success then follows the shared success path.
- **`ApplicationCreateStrategy.MetadataFirst`.**
  - In create mode the `Setup` component SHALL receive no `appId`, and SHALL render the `applicationEditor.setupPendingCreate` placeholder ("Create the application to configure its setup.").
  - Clicking Create SHALL call `create` with the metadata only and raise the Created notification. It SHALL then replace the URL's search params to add the new id, which switches the page into edit mode in place.
  - After that switch, the page SHALL NOT navigate away. The title becomes the edit title and the primary button becomes Save.
  - In edit mode, Save SHALL call the `Setup` handle's `save(metadata)`. After it resolves, the page follows the shared success path with `EntityOperation.Edited`.

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
  - `AllAtOnce` strategy.
  - Setup: `CustomAppSetup`, which holds the four fields of `custom-app-editor` "CustomAppSettingsForm fields".
  - Validation: `validateVersionPattern: SEMVER_VERSION_PATTERN`.
  - Confirmation: `customApp.saveConfirm*`.
  - Title: `customApp.createTitle` / `customApp.editTitle`.
- **`QuickApp`**:
  - `MetadataFirst` strategy.
  - Setup: `QuickAppSetup`, which holds the schema `editorUrl` iframe and `AppPreviewChat`.
  - Validation: `validateNamePattern: true` and `validateVersionPattern: SEMVER_VERSION_PATTERN`.
  - Extra actions: Preview / Exit preview.
  - Title: `appsEditor.createTitle` / `appsEditor.editTitle`, interpolating the schema `displayName`.
- **`Toolset`**:
  - Uses `renderPage`, delegating to the `@epam/ai-dial-toolset-editor` `ToolsetEditor` container.
  - That container is wired with the same `useApplicationAvatarPicker` and `useMetadataLabels` results.

#### Scenario: Registry covers all three kinds
- **WHEN** `APPLICATION_EDITOR_DEFINITIONS` is inspected in a unit test
- **THEN** it has entries for `toolset`, `custom-app` and `quick-app`, and only the toolset entry defines `renderPage`

### Requirement: i18n, accessibility and RTL for the generic page

The following user-visible strings SHALL be added to `apps/chat/src/i18n/locales/en.json` and every other locale file, with keys in `apps/chat/src/constants/translation-keys.ts`:

| Key | English |
|---|---|
| `applicationEditor.setupPendingCreate` | `Create the application to configure its setup.` |
| `customApp.createTitle` | `Create custom app` |
| `customApp.editTitle` | `Edit custom app` |
| `appsEditor.createTitle` | `Create {{type}}` |
| `appsEditor.editTitle` | `Edit {{type}}` |

When the schema has no `displayName`, `type` SHALL fall back to `appsEditor.defaultTypeName` ("quick app").

Accessibility and RTL:

- The saving overlay SHALL use `aria-live="polite"`, and the content behind it SHALL be `inert`.
- The setup-pending placeholder is plain text inside the Setup section.
- No physical-direction Tailwind classes SHALL be introduced.

The feature is not gated by `ENABLED_FEATURES`. Catalog entry gating (`OverlayFeature.CustomApps`, `HideCustomAppCreation`) is unchanged.

#### Scenario: Saving overlay hides content from assistive tech
- **WHEN** a submit is in flight
- **THEN** the editor body carries the `inert` attribute and a polite live region announces the saving label
