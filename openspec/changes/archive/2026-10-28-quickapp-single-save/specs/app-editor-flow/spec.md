## MODIFIED Requirements

### Requirement: Quick-app editor renders a single Metadata | Setup page

The Quick App editor SHALL be rendered by `ApplicationEditorPage` with `kind = ApplicationEditorKind.QuickApp` (see `application-editor-registry`) on the unchanged route `ROUTES.AppsEditor`, which renders `ApplicationFormEditor` with `quickAppDefinition` (`apps/chat/src/pages/ApplicationEditor/definitions/quickAppDefinition.tsx`). Any schema with an embedded editor opens here; Preview is offered only for the Quick Apps schema (`isPreviewAvailable` → `isQuickAppSchema`).

It uses the `schema` and `appId` query params (see "Apps-editor query param contract"); any legacy `step`, `isCreating` or `returnUrl` param is ignored.

The page renders the shared `EntityEditor` layout:

- **Header.**
  - Back arrow.
  - Title: `appsEditor.createTitle` or `appsEditor.editTitle`, interpolating the schema `displayName`, with `appsEditor.defaultTypeName` as the fallback.
  - In edit mode, an enter-only Preview `GhostButton` in `extraActions` (no `aria-pressed`; see `app-preview-chat` "EditorHeader preview button").
  - Cancel.
  - A Create button in create mode, or a Save button in edit mode.
- **Metadata section (left).** The shared `MetadataForm` with every field (see `quick-app-authoring` "Metadata section fields").
- **Setup section (right).** `QuickAppSetup` (see "Quick-app Setup section").

The page SHALL NOT render a step indicator, a Next button or the General-step Card preview.

**Create mode** (no `appId`) uses `ApplicationCreateStrategy.MetadataFirst`:

1. Clicking Create validates the metadata.
2. It calls `createApplication({ name, type: schemaId, description, iconUrl, version, topics, applicationProperties, locales, primaryLocale })` through `apps/chat/src/server-api/applications.ts`. For the Quick Apps schema, `applicationProperties` seeds the empty orchestrator/contexts/tool_sets defaults; for any other schema it is omitted.
3. It raises the `NotifiableEntity.QuickApp` + `EntityOperation.Created` notification.
4. It replaces the search params to add `appId`, which switches the page into edit mode in place.

A create failure raises an error notification with the API detail, falling back to `appsEditor.error.createFailed`, and re-enables the actions.

**Edit mode** (`appId` present):

- Save arms the save timeout and calls `QuickAppSetup`'s `save(metadata)` handle, which posts `TriggerSave` with the `general` payload.
- On `SaveSuccess`, the page does the following, in order:
  1. Awaits `refetchDeployments()`.
  2. Raises `EntityOperation.Edited`.
  3. Navigates to `returnUrl`, which is always `ROUTES.Catalog`.
- On `SaveError`, the page clears `isSaving`, the Setup section shows the error or `appsEditor.error.saveFailed` inline above the embedded editor, and the page stays open.

**Preview** (edit mode only):

- Preview triggers a save carrying the same `general` payload as Save, and the host makes no follow-up `updateApplication` call. On `SaveSuccess`, `isPreviewing` becomes true.
- When `hasChanges` is true, the page first awaits `refetchDeployments()`, with the saving overlay kept visible. A rejected refetch is logged and does not block preview.
- While previewing, the whole `EntityEditor` is hidden (still mounted, `inert`) and the definition's `Preview` component (`QuickAppPreview`) fills the page. Its "Back to setup" button returns to the editor (see `app-preview-chat` "Preview is a full-page mode").

**Other**

- Memoisation: the resolved schema and header callbacks SHALL be memoised (`useMemo`/`useCallback`); `returnUrl` is the constant `ROUTES.Catalog`.
- Schema not found: the page still renders, using the fallback title, without throwing.
- The saving overlay marks the content `inert`.

#### Scenario: Create mode shows Metadata and a pending Setup
- **WHEN** the page mounts with `?schema=<id>` and no `appId`
- **THEN** the Metadata section renders the shared fields
- **AND** the Setup section shows "Create the application to configure its setup." with a Create button
- **AND** the header shows Create, with no Preview button

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
- **THEN** the page awaits `refetchDeployments()` (and makes no further `updateApplication` call), shows the edited notification, and navigates to `ROUTES.Catalog`

#### Scenario: Save failure shows inline error and stays on the page
- **WHEN** the iframe posts `SAVE_ERROR`
- **THEN** `isSaving` becomes false, the error renders inline in the Setup section, and the page does NOT navigate away

#### Scenario: Preview awaits a fresh deployment list when settings changed
- **WHEN** the user clicks Preview and the save reports `hasChanges: true`
- **THEN** the saving overlay stays visible until `refetchDeployments()` settles, then `isPreviewing` becomes true, the editor is hidden, and the full-page preview with "Back to setup" is shown

#### Scenario: Legacy step param is ignored
- **WHEN** the page mounts with `?step=settings&schema=<id>&appId=<appId>`
- **THEN** the single page renders in edit mode, with no error and no step UI

#### Scenario: Page content is not clipped below the mobile global header
- **WHEN** the page renders at a mobile viewport, where the app-wide mobile-only global header is rendered above the routed content
- **THEN** the content area reaches the true bottom of the viewport and remains scrollable to its end

### Requirement: Quick-app Setup section

`QuickAppSetup` (`apps/chat/src/pages/ApplicationEditor/setup/QuickAppSetup.tsx`, which replaces `SettingsStep.tsx`) SHALL be a function component that receives `ref` as a prop (React 19, no `forwardRef`) and exposes `ApplicationSetupHandle` through `useImperativeHandle`. Its `save(metadata)` forwards to the inner `AppEditorIframe`'s `triggerSave(general)`, and its `startPreview(metadata)` forwards to `triggerSave(general)`, carrying the same metadata `general` payload as `save`.

It SHALL render the following:

- Without `appId` (create mode): the `applicationEditor.setupPendingCreate` placeholder, with a `NeutralButton` Create that calls `onSubmit` (neutral, so the header's `PrimaryButton` stays the one primary action) (disabled while `isSubmitting`).
- With `appId` and `schema.editorUrl`: `AppEditorIframe` only. `QuickAppSetup` SHALL NOT render `AppPreviewChat`. The preview chat is rendered at page level by `QuickAppPreview` (see `app-preview-chat` "Preview is a full-page mode"), and the iframe stays mounted while preview is shown because the whole `EntityEditor` is only hidden.
- With `appId` but no `schema.editorUrl`: the `appsEditor.settingsStep.noEditorPlaceholder` placeholder.

It SHALL report iframe readiness through `onReadyChange`, which gates the Save button and Preview (see `quick-app-authoring`). It SHALL call `onPreviewReset` when a save reports `hasChanges: true` (see `app-preview-chat` "Preview session resets when the saved configuration actually changed"). `ApplicationSetupProps` no longer carries `isPreviewing`.

The Setup section SHALL give the iframe container a minimum height of 640 px (`min-h-[640px]`, applied at every width) so it stays usable below the stacked Metadata section on mobile.

#### Scenario: Schema with editorUrl renders iframe once the app exists
- **WHEN** `schema.editorUrl` is set and `appId` is `"abc"`
- **THEN** `AppEditorIframe` is rendered and no preview chat region is rendered inside the Setup section

#### Scenario: Schema without editorUrl renders placeholder
- **WHEN** `appId` is set and `schema.editorUrl` is undefined
- **THEN** the no-editor placeholder renders and `save()` resolves without posting a message

#### Scenario: No appId renders the pending-create placeholder
- **WHEN** `appId` is undefined
- **THEN** the pending-create placeholder renders and no iframe is mounted

#### Scenario: A real change requests a preview reset
- **WHEN** `startPreview` or `save` receives `SaveSuccess` with `hasChanges: true`
- **THEN** `onPreviewReset` is called exactly once
- **AND** with `hasChanges: false` it is not called

## REMOVED Requirements

### Requirement: A Settings-step save reasserts features.skills_supported via a follow-up updateApplication call

**Reason**: The embedded Quick App editor is the single writer; chat-api forces `features.skills_supported` on every Quick App update, so the follow-up call is redundant.

**Migration**: None. `QuickAppSetup` no longer calls `updateApplication` after `SaveSuccess`.
