## MODIFIED Requirements

### Requirement: General form (step 1)

`apps/chat/src/pages/AppsEditor/GeneralForm.tsx` SHALL render a mobile-first layout: the two sections stack vertically (full width, page-scrollable) on mobile and become a fixed two-column row (each `desktop:w-1/2`, independently scrollable) on desktop (`≥769px`). The form root is `className="flex h-full w-full flex-col overflow-y-auto desktop:flex-row desktop:overflow-hidden"`.

**Left column** — form fields (scrollable, `desktop:w-1/2`, `border-b` on mobile / `desktop:border-e`).

The fields SHALL NOT be hand-rolled here: the column renders the shared `DeploymentCreationForm` component from `@epam/ai-dial-builder-form`, driven by a single `DeploymentCreationFormValues` state object (`name`, `description`, `iconUrl`, `version`, `topics`, `otherLocales`) and a `DeploymentCreationFormFieldErrors` object, with labels supplied by this page. Those values map onto the create request as `name`, `description`, `iconUrl`, `version`, `topics`, plus the locale payload composed from `otherLocales`.

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
- A `<Card>` from `@epam/ai-dial-catalog` centered vertically and horizontally in the remaining space, `w-full max-w-[280px]` so the card never overflows a narrow mobile viewport, driven by a `useMemo`-derived `CatalogItem` built from the current form state (`name`, `version`, `description`, `topics`) plus `iconPreviewUrl` — the host-resolved, directly displayable URL (via `resolveCatalogIconUrl(values.iconUrl)`), not the raw `values.iconUrl` DIAL file id `Card` cannot render as-is. Uses `CatalogEntityType.Agent` to match how these applications appear in the catalog.

The avatar picker (clicking "Add avatar" opens `AvatarPickerModal`, restricted to a single PNG/JPG/SVG file up to 1 MB) lives in the left column alongside the rest of `DeploymentCreationForm`; selecting a file calls `handleChange({ iconUrl })` with the picked file's DIAL file id, which then flows into both `iconPreviewUrl` (for the avatar box and the preview card) and the eventual create/update payload.

The column's surface is `bg-layer-sunken`.

State owned locally via `useState`:
- `values: DeploymentCreationFormValues` — the single controlled value object for every field
- `errors: DeploymentCreationFormFieldErrors` — per-field inline errors
- `isSubmitting: boolean` — true while the create API call is in-flight
- `submitError: string` — inline error shown when the API call fails

`initialValues`, when supplied, SHALL seed `values` exactly once (guarded by a ref) so later edits are never overwritten by a re-render of the host.

Client-side validation SHALL run through `validateDeploymentCreationFields` with `validateNamePattern` enabled and `validateVersionPattern` set to the library's exported `SEMVER_VERSION_PATTERN`, with codes translated by `translateDeploymentCreationErrors` (`apps/chat/src/utils/entity-field-validation.ts`): the Name field is required, at most 256 characters and must match the allowed-character pattern, the Description field is at most 2000 characters (see `entity-field-limits`), and the Version field — when non-empty — must be one or more dot-separated numeric segments (e.g. `0.0.1`, `2.0`), stricter than the shared library's default character-set-only version pattern. No URL format validation is performed on the icon URL field; that is enforced server-side only.

Submitting the form (via the imperative `submit()` handle, or the underlying `<form onSubmit>` if the user presses Enter):
- Is a no-op while `isSubmitting` is already true.
- Validates the fields above and renders `editor.nameRequired`, `editor.fieldTooLong`, `appsEditor.generalForm.nameInvalid`, or `appsEditor.generalForm.versionInvalid` under the failing field without calling the API when any check fails.
- When `appId` is set (an existing app is being edited), SHALL NOT call the create API at all — it invokes `onCreated(appId, name, iconUrl)` so the flow simply advances to the Settings step, leaving persistence to the Settings-step save.
- Otherwise calls `createApplication({ name, type: schemaId, description, iconUrl, version, topics, applicationProperties, locales, primaryLocale })` via the server-api wrapper, where `applicationProperties` seeds an empty orchestrator/contexts/tool_sets object for a Quick App schema and is omitted for any other schema.
- On success, invokes `onCreated(appId, name, iconUrl)`.

Every change of the Name or Description field SHALL also re-check that field through `getLiveDeploymentCreationErrors`, so a too-long or control-character value is shown inline as the user types (see `entity-field-limits`). A required-field error is not raised on change.

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

#### Scenario: Over-long name is flagged while typing and blocks submission

- **WHEN** the user types a 257-character Name and clicks Next
- **THEN** "Use 256 characters or fewer." (`editor.fieldTooLong`) is shown under Name as soon as the 257th character is typed
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
