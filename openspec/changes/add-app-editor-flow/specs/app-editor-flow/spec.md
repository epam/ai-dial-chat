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
- `createdAppId: string | null` — populated after step-1 create succeeds

Navigation between steps is reflected in URL search params (update via `setSearchParams`) so that:
- `?step=general` shows the General form
- `?step=settings` shows the Settings step

The stepper always shows both steps regardless of whether the app has been created yet.

The page header SHALL display:
- The schema `displayName` as the page title (resolved from `useDeployments().schemas`).
- The step indicator: "1 General / 2 Settings" (active step highlighted) in a `<nav role="navigation" aria-label="Editor steps">`.

**Note**: A back button (using `DialIconButton` + `IconArrowLeft`) is imported but not yet rendered in the header.

**i18n keys** (all under `appsEditor.*`):

| Key | English |
|---|---|
| `appsEditor.stepGeneral` | `General` |
| `appsEditor.stepSettings` | `Settings` |
| `appsEditor.backAriaLabel` | `Back` |
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

**Memoisation**: The resolved schema object and the `returnUrl` value SHALL be wrapped in `useMemo`. The `handleCreated` callback SHALL be wrapped in `useCallback`.

**Accessibility**: The step indicator region SHALL have `role="navigation"` and `aria-label="Editor steps"`.

**RTL / UI impact**: Horizontal layout uses logical CSS properties (`start`/`end` not `left`/`right`).

**Feature flag**: None — the route is always accessible when the catalog page shows a matching create option.

**Observability**: None required beyond console errors on create failure.

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
- **AND** the Next button is re-enabled

#### Scenario: Schema not found — page still renders

- **WHEN** the `schema` query param does not match any schema in `useDeployments().schemas`
- **THEN** the page still renders with an empty `displayName`
- **AND** no uncaught error is thrown

---

### Requirement: General form (step 1)

`apps/chat/src/pages/AppsEditor/GeneralForm.tsx` SHALL render a two-column layout:

**Left column** — form fields (scrollable, `w-1/2`, `border-e`):

- **Name** (`DialInput`, required): maps to `CreateApplicationBodyDto.name`.
- **Description** (`DialTextarea`, optional): maps to `CreateApplicationBodyDto.description`.
- **Icon URL** (`DialInput`, optional): maps to `CreateApplicationBodyDto.iconUrl`.
- **Version** (`DialInput`, optional): maps to `CreateApplicationBodyDto.version`.
- **Topics** (`DialTagInput`, optional): maps to `CreateApplicationBodyDto.topics`.

Footer (pinned to bottom of left column): **Cancel** (`NeutralButton`) and **Next** (`PrimaryButton`).

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

The **Next** button (`PrimaryButton`, `type="submit"`):
- Is disabled while `isSubmitting` is true.
- On submit, validates name is non-empty, then calls `createApplication({ name, type: schemaId, description, iconUrl, version, topics })` via the server-api wrapper.
- On success, invokes the `onCreated(appId)` callback prop.

The **Cancel** button (`NeutralButton`, `type="button"`) calls `onCancel`.

Props:
```ts
interface Props {
  schemaId: string;
  onCreated: (appId: string) => void;
  onCancel: () => void;
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
- **THEN** the Next button is rendered as disabled

---

### Requirement: Settings step (step 2)

`apps/chat/src/pages/AppsEditor/SettingsStep.tsx` SHALL dispatch to the appropriate sub-component based on the resolved schema:

- If `schema.editorUrl` is truthy → render `<AppEditorIframe schema={schema} appId={appId} />`.
- Otherwise → render a placeholder message (`appsEditor.settingsStep.noEditorPlaceholder`).

Props: `schema: ApplicationSchemaSummaryDto | undefined`, `appId: string`.

#### Scenario: Schema with editorUrl renders iframe

- **WHEN** `schema.editorUrl` is `"https://editor.example.com"` and `appId` is `"abc"`
- **THEN** `AppEditorIframe` is rendered

#### Scenario: Schema without editorUrl renders placeholder

- **WHEN** `schema.editorUrl` is undefined
- **THEN** the placeholder message is rendered instead of an iframe

---

### Requirement: App editor iframe component

`apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` SHALL:

- Build the iframe src as: `${schema.editorUrl}?authProvider=${providerId}&id=${encodeURIComponent(appId)}&theme=${themeId}`
  - `providerId` from `useUser().user?.providerId`
  - `themeId` from `useTheme().currentTheme`
- Render a full-height `<iframe>` (`className="w-full h-full border-none"`).
- Show a `<DialSpinner />` overlay until the iframe dispatches `load` or fires a `readyToInteract` postMessage event; after either, hide the spinner.
- Add a `window.addEventListener('message', handleMessage)` listener on mount and remove it on unmount (`useEffect` cleanup).
- In `handleMessage`: check `event.data.type === \`${schema.displayName}/${READY_TO_INTERACT_EVENT}\`` to set loading=false, and check `event.data.type === \`${schema.displayName}/${UPDATED_SUCCESS_EVENT}\`` to call the optional `onUpdated` callback prop.
- Constants `READY_TO_INTERACT_EVENT = 'readyToInteract'` and `UPDATED_SUCCESS_EVENT = 'updatedApplicationSuccess'` SHALL be defined in `apps/chat/src/constants/apps-editor.ts`.
- Accept an optional `onUpdated?: () => void` callback prop.

Props:
```ts
interface AppEditorIframeProps {
  schema: ApplicationSchemaSummaryDto;
  appId: string;
  onUpdated?: () => void;
}
```

**Memoisation**: `handleMessage` SHALL be wrapped in `useCallback`. The `iframeUrl` string SHALL be wrapped in `useMemo`.

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
