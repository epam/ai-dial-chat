# Spec: app-editor-flow

## Purpose

Defines the `/apps-editor` route: a two-step (General → Settings) application authoring flow that creates an application via the backend and then hands off configuration to the schema's own editor, embedded as an iframe and driven by a postMessage save protocol.

## Requirements

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

`apps/chat/src/types/apps-editor.ts` SHALL export the query and step enums:

```ts
export enum AppsEditorQuery {
  Step = 'step',
  Schema = 'schema',
  ReturnUrl = 'returnUrl',
  IsCreating = 'isCreating',
  AppId = 'appId',
}

export enum AppsEditorStep {
  General = 'general',
  Settings = 'settings',
}
```

`apps/chat/src/constants/apps-editor.ts` SHALL export the shared truthy query value:

```ts
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
- `submittedAppInfo: { displayName?, iconUrl? } | null` — the name/icon the General step submitted, used for the preview pane and the success notification before a refetch lands
- `isSaving: boolean` — true while a create (step 1) or save (step 2) action is in-flight; disables the header's Cancel/Save buttons and renders the saving overlay
- `saveError: string` — inline error message shown above the Settings step when a save fails
- `isSettingsReady: boolean` / `isLoggedOut: boolean` — readiness signals from the embedded editor that gate Save and Preview (owned by the `quick-app-authoring` capability)
- `previewResetKey: number` — bumped when a save reports a real configuration change, remounting the preview pane (owned by the `app-preview-chat` capability)
- `hasVisitedGeneralStep: boolean` — once the General step has been shown, `GeneralForm` stays mounted and is merely hidden while the Settings step renders, so its in-memory values survive the step switch and can be forwarded on save

Refs:
- `generalFormRef: Ref<GeneralFormHandle>` — imperative handle exposing `submit()` and `getValues()` on `GeneralForm`
- `settingsStepRef: Ref<SettingsStepHandle>` — imperative handle exposing `triggerSave(general?)` on `SettingsStep`
- `saveTimeoutRef` — the in-flight save's safety-net timeout (see `quick-app-authoring`)
- `hasExistingAppOnMountRef` — captures once whether this editor session started against an already-existing app, since `createdAppId` later makes that indistinguishable from a fresh create

Navigation between steps is reflected in URL search params (update via `setSearchParams`) so that:
- `?step=general` shows the General form
- `?step=settings` shows the Settings step

The stepper always shows both steps regardless of whether the app has been created yet, but clicking the Settings step in the header is a no-op until the app has been created: `handleChangeStep` SHALL return early (without updating `?step=`) when `stepId === AppsEditorStep.Settings` and `appIdForSettings` is falsy. This mirrors the equivalent guard in `ToolsetEditor`/`CustomAppEditor`, which block advancing past an invalid General step.

The page root SHALL use `className="flex min-h-0 flex-1 flex-col"` (not `size-full`) so the page correctly shrinks to the space left by the mobile-only global `Header` component instead of overflowing the viewport by that header's height — `height: 100%`/`size-full` on a flex item resolves against the flex container's total height, not the space remaining after sibling elements, so it must use `flex-1` (grow into remaining space) like `ChatLayout`'s `<Outlet />` wrapper.

The page header SHALL be the shared `EditorHeader` component (see "Shared editor header component" below), given:
- `title`: the schema `displayName` (resolved from `useDeployments().schemas`)
- `steps` / `currentStep`: the two-step stepper. Each step carries `status: StepStatus.VALID` once the app exists, and no status before that
- `navAriaLabel`: `editor.stepsNavAriaLabel` ("Editor steps")
- `saveButtonLabel`: `editor.nextButton` ("Next") while on the General step, `editor.saveButton` ("Save & Exit") while on the Settings step
- `isSaveDisabled`: true on the Settings step until the embedded editor reports it is ready to save
- `onSave`: on the General step, sets `isSaving` and calls `generalFormRef.current.submit()`; on the Settings step, clears `saveError`, sets `pendingSaveAction = 'save'`, arms the save timeout, and calls `settingsStepRef.current.triggerSave(general)` — forwarding the current General values only when the session started against an existing app (see `quick-app-authoring`)
- `onPreview`: on the Settings step, exits preview when `isPreviewing` is true; otherwise clears `saveError`, sets `pendingSaveAction = 'preview'`, arms the save timeout, and calls `settingsStepRef.current.triggerSave()` with no General payload
- `onCancel`: navigates to `returnUrl`

**i18n keys.** Copy shared with the toolset/custom-app editors lives in the `editor.*` namespace (`EditorI18nKeys`); copy unique to this flow lives under `appsEditor.*` (`AppsEditorI18nKeys`); generic words come from the shared `basic.*` / `buttons.*` namespaces.

| Key | English |
|---|---|
| `editor.stepGeneral` | `General` |
| `basic.settings` | `Settings` |
| `editor.stepsNavAriaLabel` | `Editor steps` |
| `editor.stepOfTotal` | `Step {{current}} of {{total}}` |
| `editor.moreActionsLabel` | `More actions` |
| `editor.saveButton` | `Save & Exit` |
| `editor.nextButton` | `Next` |
| `buttons.cancel` | `Cancel` |
| `basic.preview` | `Preview` |
| `appsEditor.exitPreviewButton` | `Exit preview` |
| `appsEditor.savingOverlay` | `Saving in progress…` |
| `editor.nameLabel` | `Name` |
| `editor.nameRequired` | `Name is required` |
| `editor.descriptionLabel` | `Description` |
| `editor.iconUrlLabel` | `Icon URL` |
| `editor.versionLabel` | `Version` |
| `editor.topicsLabel` | `Topics` |
| `appsEditor.generalForm.namePlaceholder` | `Enter application name` |
| `appsEditor.generalForm.descriptionPlaceholder` | `Describe your application` |
| `appsEditor.generalForm.nameInvalid` | `Name may only contain letters, digits, spaces, underscores, dots, and dashes` |
| `appsEditor.generalForm.versionInvalid` | `Version may only contain letters, digits, dots, underscores, and dashes` |
| `appsEditor.settingsStep.loadingLabel` | `Loading editor…` |
| `appsEditor.settingsStep.noEditorPlaceholder` | `Editor not available for this application type yet.` |
| `appsEditor.error.createFailed` | `Failed to create application. Please try again.` |
| `appsEditor.error.saveFailed` | `Failed to save application settings. Please try again.` |
| `appsEditor.error.saveTimeout` | `Saving timed out. Please try again.` |
| `appsEditor.error.settingsNotReady` | `The Settings editor did not report readiness. Please reload and try again.` |

The additional-locale field labels the General step renders come from the `editor.locales.*` keys owned by the deployment-creation-form capability.

**Memoisation**: The resolved schema object and the `returnUrl` value SHALL be wrapped in `useMemo`. The `handleCreated`, `handleSave`, `handlePreview`, `handleSettingsUpdated`, `handleSaveSuccess`, and `handleSaveError` callbacks SHALL be wrapped in `useCallback`.

**Accessibility**: The step indicator region SHALL be a `<nav>` labelled with `editor.stepsNavAriaLabel` ("Editor steps"). While a save is in flight the step content SHALL be marked `inert` behind the saving overlay rather than merely visually dimmed.

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

#### Scenario: Page content is not clipped below the mobile global header

- **WHEN** the page renders at a mobile viewport (`≤768px`), where the app-wide mobile-only `Header` component (`apps/chat/src/components/Header/Header.tsx`) is also rendered as a sibling above the routed page content
- **THEN** the page's content area still reaches the true bottom of the viewport and remains scrollable to its end — it does not get clipped by an amount equal to the global header's height

#### Scenario: Clicking the Settings step before the app exists is a no-op

- **WHEN** the user is on the General step, the app has not yet been created (`appIdForSettings` is falsy), and the user clicks the "Settings" step in the header (desktop step button or mobile step dropdown item)
- **THEN** `?step=` in the URL does NOT change and the General step remains rendered

#### Scenario: Schema not found — page still renders

- **WHEN** the `schema` query param does not match any schema in `useDeployments().schemas`
- **THEN** the page still renders with an empty `displayName`
- **AND** no uncaught error is thrown

#### Scenario: Save & Exit on Settings step triggers iframe save and navigates on success

- **WHEN** the user is on the Settings step and clicks the header's "Save & Exit" button
- **THEN** `isSaving` becomes true and `settingsStepRef.current.triggerSave()` is called
- **AND** when the iframe posts back a `SAVE_SUCCESS` message, `refetchDeployments()` is awaited
- **AND** the page navigates to `returnUrl`

#### Scenario: The General form stays mounted after advancing to Settings

- **WHEN** the user completes the General step and the Settings step renders
- **THEN** `GeneralForm` remains mounted but hidden, so its current values are still readable through `generalFormRef.current.getValues()`

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
- **THEN** `isSaving` becomes false, `saveError` is set to the provided error or `appsEditor.error.saveFailed`, and a `Notification` with that message is rendered
- **AND** the page does NOT navigate away

---

### Requirement: Shared editor header component

`apps/chat/src/components/EditorHeader/EditorHeader.tsx` SHALL be a presentational component shared by `AppsEditor` and `ToolsetEditorHeader` (in turn used by `ToolsetEditor` and `CustomAppEditor`), replacing the header markup each previously duplicated. It SHALL render a fully different markup tree for mobile vs. desktop, branching on `useIsMobile()` from `apps/chat/src/hooks/breakpoint/useBreakpoint.ts` (a JS branch is required here because mobile collapses the step list into a dropdown and the trailing actions into a kebab menu — not just a CSS layout change).

Props:
```ts
interface Props {
  title?: string;
  steps: Step[]; // from @epam/ai-dial-ui-kit — status?: StepStatus per step
  currentStep: string;
  navAriaLabel: string;
  isSaving: boolean;
  isSaveDisabled?: boolean;
  cancelButtonLabel: string;
  saveButtonLabel: string;
  onChangeStep: (stepId: string) => void;
  onCancel: () => void;
  onSave: () => void;
  previewButtonLabel?: string;
  exitPreviewButtonLabel?: string;
  isPreviewing?: boolean;
  onPreview?: () => void;
  isPreviewDisabled?: boolean;
}
```

**Desktop** (`≥769px`) renders:
- An optional `title` (only when provided), as an `<h1 className="dial-caption-text truncate text-primary">`.
- A `<nav aria-label={navAriaLabel}>` wrapping an `<ol>` of step `<button>`s (no longer the `DialSteps` component). Each step button renders a numbered `StepCircle` badge (filled/accent when current, error-bordered when `step.status === StepStatus.ERROR`, otherwise a plain outline) followed by the step name, with a horizontal connector line between steps. The current step gets `aria-current="step"`. **The `StepCircle`'s numeral SHALL be `aria-hidden="true"`** — the step order is already conveyed by list position and `aria-current`, so the numeral is decorative and must not be folded into the button's accessible name (its accessible name is the step name alone, e.g. `"General"`, not `"1 General"`).
- Trailing actions: an optional `GhostButton` for Preview/Exit-preview (rendered only when `onPreview` is provided, hidden while `isPreviewing`... rendered based on `isPreviewing` toggling icon/label), then `NeutralButton` (Cancel) and `PrimaryButton` (Save/Next) — both hidden while `isPreviewing`.

**Mobile** (`≤768px`) renders:
- A single-row header: a `Dropdown` (from `@epam/ai-dial-ui-kit`) whose trigger `<button aria-label={navAriaLabel}>` shows the optional `title`, then `editor.stepOfTotal` ("Step {{current}} of {{total}}") followed by `· {currentStep.name}`, with a chevron-down icon. The dropdown's menu items are the same steps, each calling `onChangeStep(step.id)`, with a check icon next to the current step.
- Trailing actions, collapsed: while not previewing, a kebab (`IconDotsVertical`) `Dropdown` holding Cancel and (if `onPreview` provided) Preview as menu items (`editor.moreActionsLabel` = "More actions" aria-label), plus the primary Save/Next button rendered directly. While previewing, only an exit-preview `GhostButton` is shown.
- A `ProgressBar` (`ElementSize.Small`) below the row, `value={currentIndex + 1}` / `max={steps.length}`, with `aria-label={navAriaLabel}` and `aria-valuetext` set to the same "Step X of Y" string.

**New i18n keys** (`EditorI18nKeys`, shared `editor.*` namespace):

| Key | English |
|---|---|
| `editor.stepOfTotal` | `Step {{current}} of {{total}}` |
| `editor.moreActionsLabel` | `More actions` |

`ToolsetEditorHeader` SHALL delegate its rendering entirely to `EditorHeader`, passing its existing `steps`, `step`, `isSaving`, `isSaveDisabled`, `onChangeStep`, `onCancel`, `onSave` props through unchanged and omitting `title`.

**RTL / UI impact**: Uses logical-property layout (`gap-*`, `justify-between`, `text-start`); the mobile dropdown trigger uses `text-start`. No new physical-direction classes introduced. Chevron/kebab icons are direction-agnostic (no mirroring needed).

**Accessibility**: The mobile step-dropdown trigger and the kebab-menu trigger each carry their own `aria-label`; the decorative `StepCircle` numeral is `aria-hidden`; the `ProgressBar` exposes `aria-valuetext` so assistive tech announces "Step X of Y" instead of a raw fraction.

#### Scenario: AppsEditor renders header with title

- **WHEN** `AppsEditor` renders with a resolved schema `displayName`
- **THEN** `EditorHeader` receives `title={schema.displayName}` and renders it

#### Scenario: ToolsetEditorHeader renders header without title

- **WHEN** `ToolsetEditorHeader` renders
- **THEN** `EditorHeader` is rendered without a `title` prop and no heading element is shown

#### Scenario: Save/Cancel buttons disabled while saving

- **WHEN** `isSaving` is `true`
- **THEN** both the Cancel and Save buttons are rendered as disabled

#### Scenario: Desktop step button's accessible name excludes the numeral badge

- **WHEN** the header renders on desktop with a step named "General" at index 0
- **THEN** a `button` with accessible name exactly `"General"` exists (not `"1 General"`)

#### Scenario: Mobile viewport collapses steps into a dropdown

- **WHEN** the header renders with `useIsMobile()` returning `true`
- **THEN** the step list is not rendered as inline buttons; instead a single dropdown trigger button shows the current step and a `ProgressBar` reflects step progress

---

### Requirement: General form (step 1)

`apps/chat/src/pages/AppsEditor/GeneralForm.tsx` SHALL render a mobile-first layout: the two sections stack vertically (full width, page-scrollable) on mobile and become a fixed two-column row (each `desktop:w-1/2`, independently scrollable) on desktop (`≥769px`). The form root is `className="flex h-full w-full flex-col overflow-y-auto desktop:flex-row desktop:overflow-hidden"`.

**Left column** — form fields (scrollable, `desktop:w-1/2`, `border-b` on mobile / `desktop:border-e`).

The fields SHALL NOT be hand-rolled here: the column renders the shared `DeploymentCreationForm` component from `@epam/ai-dial-deployment-creation-form`, driven by a single `DeploymentCreationFormValues` state object (`name`, `description`, `iconUrl`, `version`, `topics`, `otherLocales`) and a `DeploymentCreationFormFieldErrors` object, with labels supplied by this page. Those values map onto the create request as `name`, `description`, `iconUrl`, `version`, `topics`, plus the locale payload composed from `otherLocales`.

`GeneralForm` no longer renders its own Cancel/Next footer buttons — those live in the shared `EditorHeader` (see "Shared editor header component"). Instead, `GeneralForm` SHALL be wrapped in `forwardRef<GeneralFormHandle, Props>` and expose, via `useImperativeHandle`:

```ts
export interface GeneralFormHandle {
  submit: () => Promise<void>;
  /** Current in-memory values, trimmed. Carries `display_version`; excludes the backend `version` field. */
  getValues: () => TriggerSaveGeneralPayload;
}
```

`submit` SHALL run the same validation/create-and-callback logic the Next button previously triggered on click, and SHALL be a no-op (return without calling the API) if a submit is already in flight (`isSubmitting`).

`getValues` SHALL let the host read the current General values without submitting them, so a Settings-step save can forward them to the embedded editor (see `quick-app-authoring`).

**Right column** — live preview (`desktop:w-1/2`, `bg-layer-1`):

- A "Preview" label (`basic.preview`) pinned to the top-left.
- A `<Card>` from `@epam/ai-dial-catalog` centered vertically and horizontally in the remaining space, `w-full max-w-[280px]` so the card never overflows a narrow mobile viewport, driven by a `useMemo`-derived `CatalogItem` built from the current form state (`name`, `version`, `description`, `topics`, `iconUrl`). Uses `CatalogEntityType.Agent` to match how these applications appear in the catalog.

The column's surface is `bg-layer-sunken`.

State owned locally via `useState`:
- `values: DeploymentCreationFormValues` — the single controlled value object for every field
- `errors: DeploymentCreationFormFieldErrors` — per-field inline errors
- `isSubmitting: boolean` — true while the create API call is in-flight
- `submitError: string` — inline error shown when the API call fails

`initialValues`, when supplied, SHALL seed `values` exactly once (guarded by a ref) so later edits are never overwritten by a re-render of the host.

Client-side validation SHALL run through `validateDeploymentCreationFields` with both `validateNamePattern` and `validateVersionPattern` enabled: the Name field is required and must match the allowed-character pattern, and the Version field — when non-empty — must match its own pattern. No URL format validation is performed on the icon URL field; that is enforced server-side only.

Submitting the form (via the imperative `submit()` handle, or the underlying `<form onSubmit>` if the user presses Enter):
- Is a no-op while `isSubmitting` is already true.
- Validates the fields above and renders `editor.nameRequired`, `appsEditor.generalForm.nameInvalid`, or `appsEditor.generalForm.versionInvalid` without calling the API when any check fails.
- When `appId` is set (an existing app is being edited), SHALL NOT call the create API at all — it invokes `onCreated(appId, name, iconUrl)` so the flow simply advances to the Settings step, leaving persistence to the Settings-step save.
- Otherwise calls `createApplication({ name, type: schemaId, description, iconUrl, version, topics, applicationProperties, locales, primaryLocale })` via the server-api wrapper, where `applicationProperties` seeds an empty orchestrator/contexts/tool_sets object for a Quick App schema and is omitted for any other schema.
- On success, invokes `onCreated(appId, name, iconUrl)`.

Cancelling is handled by the parent `AppsEditor` page via the shared header's `onCancel`, not by `GeneralForm` itself.

Props:
```ts
interface Props {
  schemaId: string;
  /** Id of the app being edited. When set, submitting advances to the next step instead of creating a new app. */
  appId?: string;
  /** Existing app values used to prefill the form when editing an app. */
  initialValues?: GeneralFormInitialValues;
  onCreated: (appId: string, displayName?: string, iconUrl?: string) => void;
}
```

**Accessibility**: Field labelling is the shared `DeploymentCreationForm`'s responsibility; this page supplies the label strings.

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

#### Scenario: Preview column stacks below the form on mobile

- **WHEN** the page renders at a mobile viewport (`≤768px`)
- **THEN** the form fields and the Preview card render as two full-width sections stacked vertically, both reachable by scrolling the page, instead of a fixed-height two-column row

---

### Requirement: Settings step (step 2)

`apps/chat/src/pages/AppsEditor/SettingsStep.tsx` SHALL dispatch to the appropriate sub-component based on the resolved schema:

- If `schema.editorUrl` is truthy → render `<AppEditorIframe schema={schema} appId={appId} onSaveSuccess={onSaveSuccess} onSaveError={onSaveError} />`.
- Otherwise → render a placeholder message (`appsEditor.settingsStep.noEditorPlaceholder`).

When rendering `AppEditorIframe`, `SettingsStep` SHALL pass `onUpdated`, `onSaveSuccess`, and `onSaveError` through unchanged.

`SettingsStep` SHALL be wrapped in `forwardRef<SettingsStepHandle, Props>` and expose, via `useImperativeHandle`, a `triggerSave(general?)` that forwards to the inner `AppEditorIframe`'s own `triggerSave(general?)` (a no-op when no iframe is rendered):

```ts
export interface SettingsStepHandle {
  triggerSave: (general?: TriggerSaveGeneralPayload) => void;
}
```

When an editor is rendered, `SettingsStep` SHALL keep the iframe mounted and merely hide it while the preview pane is shown, rendering `AppPreviewChat` as an absolutely-positioned sibling (see the `app-preview-chat` capability) rather than swapping the iframe out — so entering and leaving preview never reloads the editor.

Props:
```ts
interface Props {
  schema: ApplicationSchemaSummaryDto | undefined;
  appId: string;
  appDisplayName?: string;
  appIconUrl?: string;
  isPreviewing?: boolean;
  onUpdated?: () => void;
  onSaveSuccess?: (hasChanges: boolean) => void;
  onSaveError?: (error: string) => void;
  onReadyChange?: (isReady: boolean) => void;
  onLoggedOutChange?: (isLoggedOut: boolean) => void;
  previewResetKey?: number;
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
- Render a full-height `<iframe>` (`className="size-full border-none"`) with `allow="local-network-access=*"` so the embedded app — and any window it opens via `window.open` (e.g. an identity-provider login popup) — can request and receive the Local Network Access permission when the embedded app's or its identity provider's origin resolves to a private/internal IP address.
- Show a `<Spinner />` overlay until the iframe dispatches `load` or fires a `readyToInteract` postMessage event; after either, hide the spinner.
- Add a `window.addEventListener('message', handleMessage)` listener on mount and remove it on unmount (`useEffect` cleanup).
- In `handleMessage`, after verifying `event.origin` matches `schema.editorUrl`'s origin:
  - `event.data.type === \`${displayName}/${AppsEditorEvent.ReadyToInteract}\`` → set loading=false
  - `event.data.type === \`${displayName}/${AppsEditorEvent.UpdatedSuccess}\`` → call the optional `onUpdated` callback prop
  - `event.data.type === AppsEditorEvent.SaveSuccess` → call the optional `onSaveSuccess` callback prop with the message's `hasChanges` normalized to a strict boolean
  - `event.data.type === AppsEditorEvent.SaveError` → call the optional `onSaveError` callback prop with `event.data.error ?? ''`
- `AppsEditorEvent` (in `apps/chat/src/types/apps-editor.ts`) SHALL include at least `ReadyToInteract = 'readyToInteract'`, `UpdatedSuccess = 'updatedApplicationSuccess'`, `TriggerSave = 'TRIGGER_SAVE'`, `SaveSuccess = 'SAVE_SUCCESS'`, `SaveError = 'SAVE_ERROR'`. Further members carry the readiness and toolset-login parts of the protocol and are owned by the `quick-app-authoring` capability.
- Be wrapped in `forwardRef<AppEditorIframeHandle, Props>` and expose, via `useImperativeHandle`, a `triggerSave(general?)` that posts a `TriggerSaveMessage` (`{ type: AppsEditorEvent.TriggerSave, general }`) to the iframe's `contentWindow` targeted at `schema.editorUrl`'s origin (a no-op when that origin cannot be resolved):

```ts
export interface AppEditorIframeHandle {
  triggerSave: (general?: TriggerSaveGeneralPayload) => void;
}
```

Props:
```ts
interface Props {
  schema: ApplicationSchemaSummaryDto;
  appId: string;
  onUpdated?: () => void;
  onSaveSuccess?: (hasChanges: boolean) => void;
  onSaveError?: (error: string) => void;
  onReadyChange?: (isReady: boolean) => void;
  onLoggedOutChange?: (isLoggedOut: boolean) => void;
}
```

**Memoisation**: `handleMessage` SHALL be wrapped in `useCallback`. The `iframeUrl` string SHALL be wrapped in `useMemo`. `triggerSave` (inside `useImperativeHandle`) is memoised on `[schema.editorUrl]`.

**Accessibility**: The `<iframe>` SHALL have `title={schema.displayName}`. The spinner container SHALL have `aria-label` from `appsEditor.settingsStep.loadingLabel` and `aria-live="polite"`.

**RTL / UI impact**: None — iframe content handles its own directionality.

#### Scenario: Iframe src includes auth params

- **WHEN** `AppEditorIframe` renders with `schema.editorUrl = "https://editor.example.com"`, `appId = "abc"`, `providerId = "local"`, `themeId = "dark"`
- **THEN** the `<iframe>` `src` is `"https://editor.example.com?authProvider=local&id=abc&theme=dark"`

#### Scenario: Iframe delegates Local Network Access to the embedded app

- **WHEN** `AppEditorIframe` renders
- **THEN** the `<iframe>` has `allow="local-network-access=*"`

#### Scenario: Spinner shown until iframe loads

- **WHEN** `AppEditorIframe` mounts
- **THEN** the `Spinner` is visible

#### Scenario: Spinner hidden after iframe load event

- **WHEN** the iframe fires the `load` event
- **THEN** the `Spinner` is no longer rendered

#### Scenario: Spinner hidden after readyToInteract postMessage

- **WHEN** a `message` event arrives with `data.type = "<displayName>/readyToInteract"`
- **THEN** the `Spinner` is no longer rendered

#### Scenario: onUpdated called on updatedApplicationSuccess

- **WHEN** a `message` event arrives with `data.type = "<displayName>/updatedApplicationSuccess"`
- **THEN** `onUpdated` is called

#### Scenario: Message listener removed on unmount

- **WHEN** `AppEditorIframe` unmounts
- **THEN** the `message` event listener added during mount is removed

#### Scenario: triggerSave posts TRIGGER_SAVE to the iframe

- **WHEN** `iframeRef.current.triggerSave()` is called and `schema.editorUrl` is `"https://editor.example.com"`
- **THEN** `iframe.contentWindow.postMessage({ type: 'TRIGGER_SAVE', general: undefined }, "https://editor.example.com")` is called

#### Scenario: SAVE_SUCCESS message calls onSaveSuccess

- **WHEN** a `message` event arrives with `data.type === 'SAVE_SUCCESS'`
- **THEN** the `onSaveSuccess` callback prop is called with the message's `hasChanges`, or `false` when the message omits it

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
export const createApplication = (
  body: CreateApplicationBodyDto,
): Promise<CreatedApplicationDto> =>
  applicationsApi.createApplication({ createApplicationBodyDto: body });
```

Where `applicationsApi` is the generated `ApplicationsApi` instance (from `api-client.ts`), and `CreateApplicationBodyDto` / `CreatedApplicationDto` are the generated request and response models from `@epam/ai-dial-chat-api-client`.

**i18n impact**: None.

#### Scenario: createApplication calls generated client

- **WHEN** `createApplication({ name: 'My App', type: 'https://...' })` is called
- **THEN** `applicationsApi.createApplication` is invoked with the matching body

---

### Requirement: Application ID encoding contract

Application IDs returned by `POST /api/v1/applications` (`createApplication` in `apps/chat-api/src/applications/applications.service.ts`) SHALL have their name component percent-encoded (`encodeURIComponent`) before being included in the response `id` field. This makes the create response consistent with IDs returned by `GET /api/v1/applications`, which are passed through from DIAL Core where they are always stored percent-encoded.

**Invariant**: `CreatedApplicationDto.id` satisfies `/^(?:[\w.\-:@/()]|%[\dA-Fa-f]{2})+$/` — the same pattern `DEPLOYMENT_ID_PATTERN` enforces on `CreateConversationDto.deploymentId` in `apps/chat-api/src/conversations/`.

`AppPreviewChat` SHALL normalize the `appId` prop before forwarding it as `deploymentId` to `createConversation`. The normalization (`normalizeDeploymentId` in `AppPreviewChat.tsx`) is idempotent: it splits on `/`, decodes each segment with `decodeURIComponent` (falling back to `encodeURIComponent` on malformed sequences), then re-encodes with `encodeURIComponent`. This handles both:
- Already-encoded IDs — from apps created after the encoding fix (no double-encoding).
- Legacy IDs with raw spaces — from apps created before the fix, where `searchParams.get(AppsEditorQuery.AppId)` returns the raw percent-decoded string after a page reload.

**`startStream` is exempt**: `appId` forwarded as the model identifier to `startStream` is the raw prop value; it is not sent as `deploymentId` to the conversations creation endpoint and is not subject to `DEPLOYMENT_ID_PATTERN`.

#### Scenario: createApplication response ID is percent-encoded

- **WHEN** `POST /api/v1/applications` is called with `name = "No Temp 3"` and `version = "0.0.1"`
- **THEN** the response `id` is `"applications/<bucket>/No%20Temp%203__0.0.1"` (space → `%20`)
- **AND** `GET /api/v1/applications` returns the same percent-encoded ID for this application

#### Scenario: AppPreviewChat normalizes a legacy raw-space appId before creating a conversation

- **WHEN** `AppPreviewChat` receives `appId = "applications/<bucket>/No Temp 3__0.0.1"` (raw space, from a pre-fix app)
- **AND** the user sends a first message
- **THEN** `POST /api/v1/conversations` is called with `deploymentId = "applications/<bucket>/No%20Temp%203__0.0.1"`
- **AND** the request succeeds (no 400 from `DEPLOYMENT_ID_PATTERN`)

#### Scenario: normalizeDeploymentId is idempotent on already-encoded IDs

- **WHEN** `appId = "applications/<bucket>/No%20Temp%203__0.0.1"` (already encoded, from a post-fix app)
- **THEN** `POST /api/v1/conversations` is called with `deploymentId = "applications/<bucket>/No%20Temp%203__0.0.1"` (unchanged — no double-encoding to `%2520`)

---

### Requirement: Unit tests for GeneralForm

`apps/chat/src/pages/AppsEditor/tests/GeneralForm.spec.tsx` SHALL cover:

1. Renders name, description, and icon URL fields.
2. Empty name — required error shown, API not called.
3. Name with forbidden characters — invalid-format error shown, API not called.
4. Version with forbidden characters — invalid-format error shown, API not called.
5. Valid form — API called with the correct body, `onCreated` invoked on success.
6. Quick App schema — the create body carries the seeded `applicationProperties` defaults.
7. Existing app (`appId` set) — `onCreated` is invoked without calling the create API.
8. `getValues()` — returns trimmed current values, carries `display_version`, omits the backend `version`, and includes `locales`/`primaryLocale` when additional locales are configured.
9. API failure — error message rendered.

All API calls SHALL be mocked via `vi.mock`.

#### Scenario: Unit test — empty name shows error

- **WHEN** the form is submitted with an empty name field
- **THEN** the validation error message is visible in the DOM
- **AND** `createApplication` is not called
