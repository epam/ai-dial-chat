## ADDED Requirements

### Requirement: Quick-app editor renders a single Metadata | Setup page

The Quick App editor SHALL be rendered by `ApplicationEditorPage` with `kind = ApplicationEditorKind.QuickApp` (see `application-editor-registry`) on the unchanged route `ROUTES.AppsEditor`.

It uses the `schema`, `appId` and `returnUrl` query params. `step` and `isCreating` are accepted and ignored.

The page renders the shared `EntityEditor` layout:

- **Header.**
  - Back arrow.
  - Title: `appsEditor.createTitle` or `appsEditor.editTitle`, interpolating the schema `displayName`, with `appsEditor.defaultTypeName` as the fallback.
  - A Preview / Exit preview `GhostButton` in `extraActions`, with `aria-pressed` reflecting `isPreviewing`.
  - Cancel.
  - A Create button in create mode, or a Save button in edit mode.
- **Metadata section (left).** The shared `MetadataForm` with every field (see `quick-app-authoring` "Metadata section fields").
- **Setup section (right).** `QuickAppSetup` (see "Quick-app Setup section").

The page SHALL NOT render a step indicator, a Next button or the General-step Card preview.

**Create mode** (no `appId`) uses `ApplicationCreateStrategy.MetadataFirst`:

1. Clicking Create validates the metadata.
2. It calls `createApplication({ name, type: schemaId, description, iconUrl, version, topics, applicationProperties, locales, primaryLocale })` through `apps/chat/src/server-api/applications.ts`. `applicationProperties` seeds the same empty orchestrator/contexts/tool_sets defaults as before.
3. It raises the `NotifiableEntity.QuickApp` + `EntityOperation.Created` notification.
4. It replaces the search params to add `appId`, which switches the page into edit mode in place.

A create failure raises an error notification with the API detail, falling back to `appsEditor.error.createFailed`, and re-enables the actions.

**Edit mode** (`appId` present):

- Save arms the save timeout and calls `QuickAppSetup`'s `save(metadata)` handle, which posts `TriggerSave` with the `general` payload.
- On `SaveSuccess`, the page does the following, in order:
  1. Awaits the `features.skills_supported` `updateApplication` reassertion (see "A Settings-step save reasserts features.skills_supported via a follow-up updateApplication call").
  2. Awaits `refetchDeployments()`.
  3. Raises `EntityOperation.Edited`.
  4. Navigates to `returnUrl`.
- On `SaveError`, the page clears `isSaving`, the Setup section shows the error or `appsEditor.error.saveFailed` inline above the embedded editor, and the page stays open.

**Preview** (edit mode only):

- Preview triggers a save with no `general` payload. On `SaveSuccess`, `isPreviewing` becomes true.
- When `hasChanges` is true, the page first awaits `refetchDeployments()`, with the saving overlay kept visible. A rejected refetch is logged and does not block preview.
- While previewing, `hideStandardActions` hides Cancel and Save, and Exit preview returns to the editor.

**Other**

- Memoisation: the resolved schema, `returnUrl` and header callbacks SHALL be memoised (`useMemo`/`useCallback`).
- Schema not found: the page still renders, using the fallback title, without throwing.
- The saving overlay marks the content `inert`.

#### Scenario: Create mode shows Metadata and a pending Setup
- **WHEN** the page mounts with `?schema=<id>&returnUrl=/catalog` and no `appId`
- **THEN** the Metadata section renders the shared fields
- **AND** the Setup section shows "Create the application to configure its setup."
- **AND** the header shows Create, with no Preview enabled

#### Scenario: Create switches to edit mode and loads the editor iframe
- **WHEN** the user fills Name and clicks Create, and `POST /api/v1/applications` returns `{ id: "new-id" }`
- **THEN** `appId=new-id` is added to the URL with `replace`
- **AND** the header shows the edit title and Save
- **AND** the Setup section renders the schema editor iframe for `new-id`

#### Scenario: Create API failure shows error message
- **WHEN** `POST /api/v1/applications` responds with a non-2xx status
- **THEN** an error notification is shown and the Create button is re-enabled

#### Scenario: Save triggers iframe save and navigates on success
- **WHEN** in edit mode the user clicks Save and the iframe posts `SAVE_SUCCESS`
- **THEN** the page awaits the `updateApplication` reassertion and `refetchDeployments()`, shows the edited notification, and navigates to `returnUrl`

#### Scenario: Save failure shows inline error and stays on the page
- **WHEN** the iframe posts `SAVE_ERROR`
- **THEN** `isSaving` becomes false, the error renders inline in the Setup section, and the page does NOT navigate away

#### Scenario: Preview awaits a fresh deployment list when settings changed
- **WHEN** the user clicks Preview and the save reports `hasChanges: true`
- **THEN** the saving overlay stays visible until `refetchDeployments()` settles, then `isPreviewing` becomes true, and only Exit preview is shown in the header

#### Scenario: Legacy step param is ignored
- **WHEN** the page mounts with `?step=settings&schema=<id>&appId=<appId>`
- **THEN** the single page renders in edit mode, with no error and no step UI

#### Scenario: Page content is not clipped below the mobile global header
- **WHEN** the page renders at a mobile viewport, where the app-wide mobile-only global header is rendered above the routed content
- **THEN** the content area reaches the true bottom of the viewport and remains scrollable to its end

### Requirement: Quick-app Setup section

`QuickAppSetup` (`apps/chat/src/pages/ApplicationEditor/setup/QuickAppSetup.tsx`, which replaces `SettingsStep.tsx`) SHALL be a `forwardRef` component implementing `ApplicationSetupHandle`. Its `save(metadata)` forwards to the inner `AppEditorIframe`'s `triggerSave(general)`, and its `triggerPreviewSave()` forwards to `triggerSave()` with no payload.

It SHALL render the following:

- Without `appId` (create mode): the `applicationEditor.setupPendingCreate` placeholder.
- With `appId` and `schema.editorUrl`: `AppEditorIframe`, kept mounted and hidden while `AppPreviewChat` is shown as an absolutely positioned sibling during preview.
- With `appId` but no `schema.editorUrl`: the `appsEditor.settingsStep.noEditorPlaceholder` placeholder.

It SHALL report iframe readiness through `onReadyChange`, which gates the Save button and Preview (see `quick-app-authoring`).

On mobile, the Setup section SHALL give the iframe a minimum height of 640 px so it stays usable below the stacked Metadata section.

#### Scenario: Schema with editorUrl renders iframe once the app exists
- **WHEN** `schema.editorUrl` is set and `appId` is `"abc"`
- **THEN** `AppEditorIframe` is rendered

#### Scenario: Schema without editorUrl renders placeholder
- **WHEN** `appId` is set and `schema.editorUrl` is undefined
- **THEN** the no-editor placeholder renders and `save()` resolves without posting a message

#### Scenario: No appId renders the pending-create placeholder
- **WHEN** `appId` is undefined
- **THEN** the pending-create placeholder renders and no iframe is mounted

### Requirement: Unit tests for the quick-app definition

`apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx` SHALL cover the following. All API calls SHALL be mocked via `vi.mock`.

1. Create mode renders the Metadata fields and the pending Setup placeholder.
2. Empty name shows the required error and does not call the API.
3. A name with forbidden characters, or a non-semver version, shows the invalid error and does not call the API.
4. A valid create calls `createApplication` with the correct body and seeded `applicationProperties`, then switches to edit mode with `appId`.
5. Save in edit mode posts `TriggerSave` with a `general` payload that carries `display_version`, omits `version`, and includes `locales`/`primaryLocale` when configured.
6. A create API failure renders the error.

#### Scenario: Unit test — empty name shows error
- **WHEN** Create is clicked with an empty name field
- **THEN** the validation error message is visible in the DOM and `createApplication` is not called

## REMOVED Requirements

### Requirement: Apps-editor page renders two steps
**Reason**: The quick-app editor is now a single Metadata | Setup page, rendered by the generic `ApplicationEditorPage`. The General/Settings steps, `?step=` navigation and the stepper are gone.
**Migration**: See "Quick-app editor renders a single Metadata | Setup page". The create → Settings transition becomes an in-place create → edit-mode switch. Save, Preview, reassertion and refetch behaviour carry over unchanged.

### Requirement: Shared editor header component
**Reason**: Every editor now uses the `EntityEditor` header from `@epam/ai-dial-builder-form` (back arrow, `<h1>`, Cancel and primary action at the inline end). The app-only stepper `EditorHeader` has no remaining consumer and is deleted along with its tests.
**Migration**: Use `EntityEditor` (`title`, `onBack`, `onCancel`, `onSubmit`, `submitLabel`, `extraActions`, `hideStandardActions`). Mobile actions come from `EditorLayout`'s bottom bar.

### Requirement: General form (step 1)
**Reason**: The duplicate `apps/chat/src/pages/AppsEditor/GeneralForm.tsx`, with its Card preview column and imperative `submit`/`getValues` handle, is replaced by the shared `MetadataForm` + `useMetadataForm`, owned by `ApplicationEditorPage`.
**Migration**: Metadata fields and validation are in `quick-app-authoring` "Metadata section fields". Create is in "Quick-app editor renders a single Metadata | Setup page". The General values for `TriggerSave` come from `useMetadataForm().values`.

### Requirement: Settings step (step 2)
**Reason**: Replaced by `QuickAppSetup` rendered in the Setup section.
**Migration**: See "Quick-app Setup section".

### Requirement: Unit tests for GeneralForm
**Reason**: The component is deleted.
**Migration**: See "Unit tests for the quick-app definition".
