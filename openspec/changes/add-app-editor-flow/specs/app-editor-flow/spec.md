## ADDED Requirements

### Requirement: Apps-editor route exists and is accessible

`apps/chat/src/types/routes.ts` SHALL add `AppsEditor = '/apps-editor'` to the `ROUTES` enum.

`apps/chat/src/app/app.tsx` SHALL register a lazy-loaded route for `ROUTES.AppsEditor`:
```tsx
const AppsEditorPage = lazy(() => import('../pages/AppsEditor/AppsEditor'));
// inside <Routes>:
<Route path={ROUTES.AppsEditor} element={
  <RouteErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
      <AppsEditorPage />
    </Suspense>
  </RouteErrorBoundary>
} />
```

**i18n impact**: See key table in the editor page requirement below.

**RTL / UI impact**: Logical CSS properties SHALL be used for horizontal spacing/alignment. Icons SHALL be mirrored in RTL where directional.

#### Scenario: Navigating to /apps-editor renders the page

- **WHEN** the user navigates to `/apps-editor?step=general&schema=<id>&returnUrl=/catalog&isCreating=1`
- **THEN** the `AppsEditorPage` component renders without a full-page error

#### Scenario: Route is lazy-loaded

- **WHEN** the user visits the catalog for the first time without navigating to /apps-editor
- **THEN** the AppsEditorPage module is NOT in the initial JS bundle

---

### Requirement: Apps-editor query param contract

`apps/chat/src/constants/apps-editor.ts` SHALL export:

```ts
export enum AppsEditorQuery {
  Step      = 'step',
  Schema    = 'schema',
  ReturnUrl = 'returnUrl',
  IsCreating = 'isCreating',
  AppId     = 'appId',
}

export enum AppsEditorStep {
  General  = 'general',
  Settings = 'settings',
}

export const QUERY_VALUE_TRUE = '1';
```

The `AppsEditorPage` SHALL read all params exclusively via `useSearchParams` from `react-router-dom`.

**RTL / UI impact**: None (constants only).

#### Scenario: Step param defaults to general when absent

- **WHEN** the user navigates to `/apps-editor` without a `step` query param
- **THEN** the page renders the General step

---

### Requirement: Apps-editor page renders two steps

`apps/chat/src/pages/AppsEditor/AppsEditor.tsx` SHALL manage a two-step creation flow.

State owned locally via `useState`:
- `pendingSaveAction: 'save' | 'preview' | null` — distinguishes Save & Exit from Preview-triggered saves
- `isPreviewing: boolean` — true while the Settings step shows the in-page chat preview instead of the editor iframe
- `createdAppId: string | null` — populated after step-1 create succeeds
- `isSaving: boolean` — true while a create (step 1) or save (step 2) action is in-flight; disables the header's Cancel/Save buttons
- `saveError: string` — inline error message shown above the Settings step when a save fails

Refs:
- `generalFormRef: Ref<GeneralFormHandle>` — imperative handle exposing `submit()` on `GeneralForm`
- `settingsStepRef: Ref<SettingsStepHandle>` — imperative handle exposing `triggerSave()` on `SettingsStep`

Navigation between steps is reflected in URL search params (update via `setSearchParams`) so that:
- `?step=general` shows the General form
- `?step=settings` shows the Settings step

The stepper always shows both steps regardless of whether the app has been created yet.

The page header SHALL be the shared `EditorHeader` component (see "Shared editor header component" below), given:
- `title`: the schema `displayName` (resolved from `useDeployments().schemas`)
- `steps` / `currentStep`: the two-step stepper
- `saveButtonLabel`: `appsEditor.generalForm.nextButton` ("Next") while on the General step, `appsEditor.saveButton` ("Save & Exit") while on the Settings step
- `onSave`: on the General step, calls `generalFormRef.current.submit()`; on the Settings step, clears `saveError` and calls `settingsStepRef.current.triggerSave()`
- `onPreview`: on the Settings step, exits preview when `isPreviewing` is true; otherwise clears `saveError`, sets `pendingSaveAction = 'preview'`, and calls `settingsStepRef.current.triggerSave()`
- `onCancel`: navigates to `returnUrl`

**i18n keys** (all under `appsEditor.*`):

| Key | English |
|---|---|
| `appsEditor.stepGeneral` | `General` |
| `appsEditor.stepSettings` | `Settings` |
| `appsEditor.backAriaLabel` | `Back` |
| `appsEditor.saveButton` | `Save & Exit` |
| `appsEditor.generalForm.nameLabel` | `Name` |
| `appsEditor.generalForm.namePlaceholder` | `Enter application name` |
| `appsEditor.generalForm.descriptionLabel` | `Description` |
| `appsEditor.generalForm.descriptionPlaceholder` | `Describe your application` |
| `appsEditor.generalForm.iconUrlLabel` | `Icon URL` |
| `appsEditor.generalForm.iconUrlPlaceholder` | `https://...` |
| `appsEditor.generalForm.versionLabel` | `Version` |
| `appsEditor.generalForm.versionPlaceholder` | `e.g. 1.0.0` |
| `appsEditor.generalForm.topicsLabel` | `Topics` |
| `appsEditor.generalForm.topicsPlaceholder` | `Add a topic` |
| `appsEditor.generalForm.previewTitle` | `Preview` |
| `appsEditor.generalForm.nextButton` | `Next` |
| `appsEditor.generalForm.cancelButton` | `Cancel` |
| `appsEditor.generalForm.nameRequired` | `Name is required` |
| `appsEditor.settingsStep.loadingLabel` | `Loading editor…` |
| `appsEditor.settingsStep.noEditorPlaceholder` | `Editor not available for this application type yet.` |
| `appsEditor.error.createFailed` | `Failed to create application. Please try again.` |
| `appsEditor.error.saveFailed` | `Failed to save application settings. Please try again.` |

**Memoisation**: The resolved schema object and the `returnUrl` value SHALL be wrapped in `useMemo`. The `handleCreated`, `handleSave`, `handlePreview`, `handleSettingsUpdated`, `handleSaveSuccess`, and `handleSaveError` callbacks SHALL be wrapped in `useCallback`.

**Accessibility**: The step indicator region SHALL have `role="navigation"` and `aria-label="Editor steps"`.

**RTL / UI impact**: Horizontal layout uses logical CSS properties (`start`/`end` not `left`/`right`).

**Feature flag**: None — the route is always accessible when the catalog page shows a matching create option.

**Observability**: None required beyond console errors on create/save failure.

#### Scenario: Page shows General step by default when isCreating=1

- **WHEN** the page mounts with `?step=general&schema=<id>&returnUrl=/catalog&isCreating=1`
- **THEN** the General form is rendered
- **AND** the step indicator shows step 1 as active

#### Scenario: Advancing to Settings step after successful create

- **WHEN** the user submits the General form and `POST /api/v1/applications` returns the new app id
- **THEN** `?step=settings&appId=<id>` is reflected in the URL
- **AND** the Settings step is rendered

#### Scenario: Create API failure shows error message

- **WHEN** `POST /api/v1/applications` responds with a non-2xx status
- **THEN** an error message (`appsEditor.error.createFailed`) is displayed inline
- **AND** the Save/Next button is re-enabled

#### Scenario: Schema not found — page still renders

- **WHEN** the `schema` query param does not match any schema in `useDeployments().schemas`
- **THEN** the page still renders with an empty `displayName`
- **AND** no uncaught error is thrown

#### Scenario: Save & Exit on Settings step triggers iframe save and navigates on success

- **WHEN** the user is on the Settings step and clicks the header's "Save & Exit" button
- **THEN** `isSaving` becomes true and `settingsStepRef.current.triggerSave()` is called
- **AND** when the iframe posts back a `SAVE_SUCCESS` message, `refetchDeployments()` is awaited
- **AND** the page navigates to `returnUrl`

#### Scenario: Preview on Settings step uses freshly saved deployment settings

- **WHEN** the user is on the Settings step and clicks the header's "Preview" button
- **THEN** `isSaving` becomes true, `pendingSaveAction` is set to `preview`, and `settingsStepRef.current.triggerSave()` is called
- **AND** when the iframe posts back a `SAVE_SUCCESS` message, `refetchDeployments()` is called fire-and-forget and `isPreviewing` becomes true immediately without waiting for the refetch
- **AND** the preview chat input derives attachment availability and limits from the refreshed deployment's `inputAttachmentTypes` and `maxInputAttachments`

#### Scenario: Settings updates refresh deployment metadata before preview

- **WHEN** the iframe posts back a `<displayName>/updatedApplicationSuccess` message while the Settings step is mounted
- **THEN** `AppsEditor` calls `refetchDeployments()` through the `onUpdated` callback passed to `SettingsStep`

#### Scenario: Save failure on Settings step shows inline error and stays on the page

- **WHEN** the iframe posts back a `SAVE_ERROR` message (with or without an `error` string)
- **THEN** `isSaving` becomes false, `saveError` is set to the provided error or `appsEditor.error.saveFailed`, and a `DialNotification` with that message is rendered
- **AND** the page does NOT navigate away

---

### Requirement: Shared editor header component

`apps/chat/src/components/EditorHeader/EditorHeader.tsx` SHALL be a presentational component shared by `AppsEditor` and `ToolsetEditorHeader`, replacing the header markup each previously duplicated.

Props:
```ts
interface Props {
  title?: string;
  steps: Step[]; // from @epam/ai-dial-ui-kit
  currentStep: string;
  navAriaLabel: string;
  isSaving: boolean;
  cancelButtonLabel: string;
  saveButtonLabel: string;
  onChangeStep: (stepId: string) => void;
  onCancel: () => void;
  onSave: () => void;
}
```

It SHALL render:
- An optional `title` (only when provided) using the same `dial-caption-text` heading style previously inlined in `AppsEditor`.
- A `<nav role="navigation" aria-label={navAriaLabel}>` wrapping `DialSteps` bound to `steps`/`currentStep`/`onChangeStep`.
- A `NeutralButton` (`label={cancelButtonLabel}`, `onClick={onCancel}`, `disabled={isSaving}`) and a `PrimaryButton` (`label={saveButtonLabel}`, `onClick={onSave}`, `disabled={isSaving}`).

`ToolsetEditorHeader` SHALL delegate its rendering entirely to `EditorHeader`, passing its existing `steps`, `step`, `isSaving`, `onChangeStep`, `onCancel`, `onSave` props through unchanged and omitting `title`.

**RTL / UI impact**: Uses the same logical-property layout (`gap-3`, `justify-between`) as the components it replaces; no new physical-direction classes introduced.

#### Scenario: AppsEditor renders header with title

- **WHEN** `AppsEditor` renders with a resolved schema `displayName`
- **THEN** `EditorHeader` receives `title={schema.displayName}` and renders it

#### Scenario: ToolsetEditorHeader renders header without title

- **WHEN** `ToolsetEditorHeader` renders
- **THEN** `EditorHeader` is rendered without a `title` prop and no heading element is shown

#### Scenario: Save/Cancel buttons disabled while saving

- **WHEN** `isSaving` is `true`
- **THEN** both the Cancel and Save buttons are rendered as disabled

---

### Requirement: General form (step 1)

`apps/chat/src/pages/AppsEditor/GeneralForm.tsx` SHALL render a two-column layout:

**Left column** — form fields (scrollable, `w-1/2`, `border-e`):

- **Name** (`DialInput`, required): maps to `CreateApplicationBodyDto.name`.
- **Description** (`DialTextarea`, optional): maps to `CreateApplicationBodyDto.description`.
- **Icon URL** (`DialInput`, optional): maps to `CreateApplicationBodyDto.iconUrl`.
- **Version** (`DialInput`, optional): maps to `CreateApplicationBodyDto.version`.
- **Topics** (`DialTagInput`, optional): maps to `CreateApplicationBodyDto.topics`.

`GeneralForm` no longer renders its own Cancel/Next footer buttons — those live in the shared `EditorHeader` (see "Shared editor header component"). Instead, `GeneralForm` SHALL be wrapped in `forwardRef<GeneralFormHandle, Props>` and expose, via `useImperativeHandle`:

```ts
export interface GeneralFormHandle {
  submit: () => Promise<void>;
}
```

`submit` SHALL run the same validation/create-and-callback logic the Next button previously triggered on click, and SHALL be a no-op (return without calling the API) if a submit is already in flight (`isSubmitting`).

**Right column** — live preview (`w-1/2`, `bg-layer-1`):

- A "Preview" label (`appsEditor.generalForm.previewTitle`) pinned to the top-left.
- A `<Card>` from `@epam/ai-dial-catalog` centered vertically and horizontally in the remaining space, width `280px`, driven by a `useMemo`-derived `CatalogItem` built from the current form state (`name`, `version`, `description`, `topics`, `iconUrl`). Uses `CatalogEntityType.Model` to match how existing applications appear in the catalog.

State owned locally via `useState`:
- `name`, `description`, `iconUrl`, `version` — controlled string values
- `topics: string[]` — controlled array value
- `nameError: string` — inline error shown below the Name field
- `isSubmitting: boolean` — true while the create API call is in-flight
- `submitError: string` — inline error shown when the API call fails

Client-side validation: only the Name field is validated (must be non-empty). No URL format validation is performed on the icon URL field; that is enforced server-side only.

Submitting the form (via the imperative `submit()` handle, or the underlying `<form onSubmit>` if the user presses Enter):
- Is a no-op while `isSubmitting` is already true.
- Validates name is non-empty, then calls `createApplication({ name, type: schemaId, description, iconUrl, version, topics })` via the server-api wrapper.
- On success, invokes the `onCreated(appId)` callback prop.

Cancelling is handled by the parent `AppsEditor` page via the shared header's `onCancel`, not by `GeneralForm` itself.

Props:
```ts
interface Props {
  schemaId: string;
  onCreated: (appId: string) => void;
}
```

**Accessibility**: Each input uses `DialInput`/`DialTextarea`/`DialTagInput` label props for associated labels.

#### Scenario: Empty name prevents submission

- **WHEN** the user clicks Next with an empty Name field
- **THEN** the form shows a validation error (`appsEditor.generalForm.nameRequired`)
- **AND** the API is NOT called

#### Scenario: Valid form submits and calls onCreated

- **WHEN** the user fills in Name and clicks Next
- **AND** the create API returns `{ id: "new-id" }`
- **THEN** `onCreated("new-id")` is called

#### Scenario: Next button is disabled while submitting

- **WHEN** the API call is in-flight
- **THEN** `isSaving` on the parent `AppsEditor` is true, which disables the shared header's Save/Next button

#### Scenario: submit() is a no-op while already submitting

- **WHEN** `generalFormRef.current.submit()` is called while a previous `submit()` call is still in flight
- **THEN** the create API is NOT called a second time

---

### Requirement: Settings step (step 2)

`apps/chat/src/pages/AppsEditor/SettingsStep.tsx` SHALL dispatch to the appropriate sub-component based on the resolved schema:

- If `schema.editorUrl` is truthy → render `<AppEditorIframe schema={schema} appId={appId} onSaveSuccess={onSaveSuccess} onSaveError={onSaveError} />`.
- Otherwise → render a placeholder message (`appsEditor.settingsStep.noEditorPlaceholder`).

When rendering `AppEditorIframe`, `SettingsStep` SHALL pass `onUpdated`, `onSaveSuccess`, and `onSaveError` through unchanged.

`SettingsStep` SHALL be wrapped in `forwardRef<SettingsStepHandle, Props>` and expose, via `useImperativeHandle`, a `triggerSave()` that forwards to the inner `AppEditorIframe`'s own `triggerSave()` (a no-op when no iframe is rendered):

```ts
export interface SettingsStepHandle {
  triggerSave: () => void;
}
```

Props:
```ts
interface Props {
  schema: ApplicationSchemaSummaryDto | undefined;
  appId: string;
  onUpdated?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}
```

#### Scenario: Schema with editorUrl renders iframe

- **WHEN** `schema.editorUrl` is `"https://editor.example.com"` and `appId` is `"abc"`
- **THEN** `AppEditorIframe` is rendered

#### Scenario: Schema without editorUrl renders placeholder

- **WHEN** `schema.editorUrl` is undefined
- **THEN** the placeholder message is rendered instead of an iframe

#### Scenario: triggerSave forwards to the iframe handle

- **WHEN** `schema.editorUrl` is set and `settingsStepRef.current.triggerSave()` is called
- **THEN** the inner `AppEditorIframe` ref's `triggerSave()` is called

#### Scenario: triggerSave is a no-op without an editor

- **WHEN** `schema.editorUrl` is undefined and `settingsStepRef.current.triggerSave()` is called
- **THEN** no error is thrown and no postMessage is sent

---

### Requirement: App editor iframe component

`apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` SHALL:

- Build the iframe src as: `${schema.editorUrl}?authProvider=${providerId}&id=${encodeURIComponent(appId)}&theme=${themeId}`
  - `providerId` from `useUser().user?.providerId`
  - `themeId` from `useTheme().currentTheme`
- Render a full-height `<iframe>` (`className="size-full border-none"`).
- Show a `<DialSpinner />` overlay until the iframe dispatches `load` or fires a `readyToInteract` postMessage event; after either, hide the spinner.
- Add a `window.addEventListener('message', handleMessage)` listener on mount and remove it on unmount (`useEffect` cleanup).
- In `handleMessage`, after verifying `event.origin` matches `schema.editorUrl`'s origin:
  - `event.data.type === \`${displayName}/${AppsEditorEvent.ReadyToInteract}\`` → set loading=false
  - `event.data.type === \`${displayName}/${AppsEditorEvent.UpdatedSuccess}\`` → call the optional `onUpdated` callback prop
  - `event.data.type === AppsEditorEvent.SaveSuccess` → call the optional `onSaveSuccess` callback prop
  - `event.data.type === AppsEditorEvent.SaveError` → call the optional `onSaveError` callback prop with `event.data.error ?? ''`
- `AppsEditorEvent` (in `apps/chat/src/types/apps-editor.ts`) SHALL include `ReadyToInteract = 'readyToInteract'`, `UpdatedSuccess = 'updatedApplicationSuccess'`, `TriggerSave = 'TRIGGER_SAVE'`, `SaveSuccess = 'SAVE_SUCCESS'`, `SaveError = 'SAVE_ERROR'`.
- Be wrapped in `forwardRef<AppEditorIframeHandle, Props>` and expose, via `useImperativeHandle`, a `triggerSave()` that posts `{ type: AppsEditorEvent.TriggerSave }` to the iframe's `contentWindow` targeted at `schema.editorUrl`'s origin (a no-op when `schema.editorUrl` is falsy):

```ts
export interface AppEditorIframeHandle {
  triggerSave: () => void;
}
```

Props:
```ts
interface Props {
  schema: ApplicationSchemaSummaryDto;
  appId: string;
  onUpdated?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}
```

**Memoisation**: `handleMessage` SHALL be wrapped in `useCallback`. The `iframeUrl` string SHALL be wrapped in `useMemo`. `triggerSave` (inside `useImperativeHandle`) is memoised on `[schema.editorUrl]`.

**Accessibility**: The `<iframe>` SHALL have `title={schema.displayName}`. The spinner container SHALL have `aria-label` from `appsEditor.settingsStep.loadingLabel` and `aria-live="polite"`.

**RTL / UI impact**: None — iframe content handles its own directionality.

#### Scenario: Iframe src includes auth params

- **WHEN** `AppEditorIframe` renders with `schema.editorUrl = "https://editor.example.com"`, `appId = "abc"`, `providerId = "local"`, `themeId = "dark"`
- **THEN** the `<iframe>` `src` is `"https://editor.example.com?authProvider=local&id=abc&theme=dark"`

#### Scenario: Spinner shown until iframe loads

- **WHEN** `AppEditorIframe` mounts
- **THEN** the `DialSpinner` is visible

#### Scenario: Spinner hidden after iframe load event

- **WHEN** the iframe fires the `load` event
- **THEN** the `DialSpinner` is no longer rendered

#### Scenario: Spinner hidden after readyToInteract postMessage

- **WHEN** a `message` event arrives with `data.type = "<displayName>/readyToInteract"`
- **THEN** the `DialSpinner` is no longer rendered

#### Scenario: onUpdated called on updatedApplicationSuccess

- **WHEN** a `message` event arrives with `data.type = "<displayName>/updatedApplicationSuccess"`
- **THEN** `onUpdated` is called

#### Scenario: Message listener removed on unmount

- **WHEN** `AppEditorIframe` unmounts
- **THEN** the `message` event listener added during mount is removed

#### Scenario: triggerSave posts TRIGGER_SAVE to the iframe

- **WHEN** `iframeRef.current.triggerSave()` is called and `schema.editorUrl` is `"https://editor.example.com"`
- **THEN** `iframe.contentWindow.postMessage({ type: 'TRIGGER_SAVE' }, "https://editor.example.com")` is called

#### Scenario: SAVE_SUCCESS message calls onSaveSuccess

- **WHEN** a `message` event arrives with `data.type === 'SAVE_SUCCESS'`
- **THEN** the `onSaveSuccess` callback prop is called

#### Scenario: SAVE_ERROR message calls onSaveError with the error string

- **WHEN** a `message` event arrives with `data = { type: 'SAVE_ERROR', error: 'Invalid config' }`
- **THEN** `onSaveError('Invalid config')` is called

#### Scenario: SAVE_ERROR message without an error string still calls onSaveError

- **WHEN** a `message` event arrives with `data = { type: 'SAVE_ERROR' }`
- **THEN** `onSaveError('')` is called

---

### Requirement: Server-api wrapper for createApplication

`apps/chat/src/server-api/applications.ts` SHALL export:

```ts
export const createApplication = (body: CreateApplicationRequest): Promise<CreatedApplicationDto> =>
  applicationsApi.createApplication({ createApplicationRequest: body });
```

Where `applicationsApi` is the generated `ApplicationsApi` instance (from `api-client.ts`), `CreateApplicationRequest` is the generated request model, and `CreatedApplicationDto` is the generated response model.

**i18n impact**: None.

#### Scenario: createApplication calls generated client

- **WHEN** `createApplication({ name: 'My App', type: 'https://...' })` is called
- **THEN** `applicationsApi.createApplication` is invoked with the matching body

---

### Requirement: Unit tests for GeneralForm

`apps/chat/src/pages/AppsEditor/tests/GeneralForm.spec.tsx` SHALL cover:

1. Renders name, description, and icon URL fields.
2. Empty name — validation error shown, API not called.
3. Valid form — API called with correct body, `onCreated` invoked on success.
4. Next button disabled while submitting.
5. API failure — error message rendered, button re-enabled.

All API calls SHALL be mocked via `vi.mock`.

#### Scenario: Unit test — empty name shows error

- **WHEN** the form is submitted with an empty name field
- **THEN** the validation error message is visible in the DOM
- **AND** `createApplication` is not called
