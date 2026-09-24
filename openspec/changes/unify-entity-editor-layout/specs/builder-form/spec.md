## ADDED Requirements

### Requirement: EntityEditor — the standard entity editor layout

`@epam/ai-dial-builder-form` SHALL export `EntityEditor`, with its props types `EntityEditorProps`, `EntityEditorLabels` and `EntityEditorStyles`. It composes `EditorLayout` into the standard entity editor.

**Header**

- A back arrow calling `onBack`.
- An `<h1>` showing `title`.
- In the `actions` slot, in this order:
  1. `extraActions`, when provided.
  2. A `NeutralButton` Cancel (`labels.cancelLabel`, default `'Cancel'`) calling `onCancel`.
  3. A `PrimaryButton` (`submitLabel`) calling `onSubmit`.
- When `hideStandardActions` is `true`, Cancel and the primary button SHALL NOT render, and only `extraActions` remain.
- The primary button and Cancel SHALL be disabled while `isSubmitting`. The primary button SHALL additionally be disabled while `isSubmitDisabled`.
- `isSubmitting` SHALL be forwarded to `EditorLayout.isSaving`.

**Left column (`leftContent`)**

- An `EditorSection` titled `labels.metadataTitle` (default `'Metadata'`) that contains `metadata`.
- `metadataFooter`, when provided, below that section.

**Right column (`rightContent`)**

- When `setup` is provided: `alert` (wrapped in `role="alert"`, when provided), then an `EditorSection` titled `setupTitle ?? labels.setupTitle` (default `'Setup'`) that contains `setup`.
- When `setup` is absent, `rightContent` SHALL be omitted so the left column fills the width.

Mobile behaviour (sections stacked, Metadata first, actions in the bottom bar) is inherited from `EditorLayout`.

`metadataSectionClassName` and `setupSectionClassName` SHALL be added to the respective section roots, so an embedding editor keeps its own public classes.

`EntityEditor` SHALL hold no state and SHALL NOT import i18n, routing or any host API. Every string has an English default and is overridable through props.

#### Scenario: Screenshot layout at desktop width
- **WHEN** `EntityEditor` renders with `title="Create toolset"`, `submitLabel="Create"`, a `metadata` node and a `setup` node at desktop width
- **THEN** the header shows a back button, the "Create toolset" heading, and Cancel and Create buttons at the inline end
- **AND** a "Metadata" `<h2>` section renders in the 360 px left column
- **AND** a "Setup" `<h2>` section renders in the right column

#### Scenario: Extra actions and preview mode
- **WHEN** `extraActions` holds a Preview button and `hideStandardActions` is `true`
- **THEN** only the Preview button renders in the header actions

#### Scenario: Metadata-only editor
- **WHEN** `setup` is not provided
- **THEN** no right column renders and the Metadata section spans the available width

#### Scenario: Submit disabled only by external state
- **WHEN** `isSubmitDisabled` is `false` and `isSubmitting` is `false`
- **THEN** the primary button is enabled, whatever validation state the host holds

### Requirement: MetadataForm — shared Metadata field set with field visibility

`@epam/ai-dial-builder-form` SHALL export `MetadataForm`, with `MetadataFormProps`, `MetadataFormLabels` and the string enum `MetadataField` (members `Avatar`, `Name`, `Version`, `Description`, `Locales`, `Tags`).

`MetadataForm` renders `DeploymentCreationForm` plus `AvatarPickerModal`. It takes `values`, `errors`, `onChange`, `onNameBlur`, `onVersionBlur`, `availableLocaleOptions`, and `labels` with optional `form` and `avatarPicker` groups.

The avatar picker is configured by one optional `avatarPicker` prop (`MetadataFormAvatarPicker`), whose fields are all host-injected: `bucket`, `FileManagerModal`, `resolveIconUrl` (preview URL for the current icon), `resolveAttachedIconUrl(result: AttachResult) => string | undefined` (the icon URL for a picked file), `allowedMimeTypes` and `maxFileSizeBytes`. The lib SHALL NOT build DIAL storage paths or import `@epam/ai-dial-chat-hooks`; turning a picked file into a URL is the host's job.

It adds the following props:

- `fields?: MetadataField[]`. The default is all six fields. The fields render in the fixed order Avatar, Name + Version (side by side), Description, Locales, Tags. A field absent from `fields` SHALL NOT render. When Version is absent, Name takes the full row.
- `isNameReadOnly?: boolean`, which renders Name read-only.
- `nameCaption?: string`, helper text under Name.
- `isDescriptionRequired?: boolean`, which marks Description required.
- `errors.description?: string`.

The Avatar field SHALL render only when `fields` includes `MetadataField.Avatar` and `avatarPicker` is provided. When `resolveAttachedIconUrl` returns `undefined`, the icon SHALL stay unchanged.

`DeploymentCreationForm` SHALL accept the same `fields`, `isNameReadOnly`, `nameCaption` and `isDescriptionRequired` options, and SHALL extend `DeploymentCreationFormFieldErrors` with `description?`. On an error transition, focus-first-invalid SHALL consider Name, then Version, then Description.

The default Tags placeholder SHALL be `'Add tags, comma separated'`.

#### Scenario: Prompt-style metadata
- **WHEN** `MetadataForm` renders with `fields={[MetadataField.Name, MetadataField.Description]}` and no `avatarPicker`
- **THEN** only Name and Description render, Name spans the full row, and no avatar, version, locales or tags controls exist in the DOM

#### Scenario: Default renders the full screenshot field set
- **WHEN** `MetadataForm` renders without `fields`
- **THEN** Avatar ("Add avatar", "PNG, JPG or SVG (max 1 MB)"), Name* with Version on the same row, Description, Locales and Tags ("Add tags, comma separated") render in that order

#### Scenario: Picked avatar is resolved by the host
- **WHEN** the user picks a file in the avatar picker and `avatarPicker.resolveAttachedIconUrl` returns `'files/b/icon.png'`
- **THEN** `onChange({ iconUrl: 'files/b/icon.png' })` is called and the picker closes

#### Scenario: Description error receives focus when it is the only invalid field
- **WHEN** `errors` changes from empty to `{ description: 'Description is required' }`
- **THEN** focus moves to the Description textarea

### Requirement: useMetadataForm — headless metadata state

`@epam/ai-dial-builder-form` SHALL export `useMetadataForm({ initialValues, validationOptions, reseedKey? })`. It returns:

- `values` and `setValues(patch)`.
- `touched` and `markTouched(field)`.
- `errorCodes`: the full result of `validateDeploymentCreationFields(values, validationOptions)`.
- `visibleErrorCodes`: only the touched fields, or every field once `attemptSubmit()` has been called.
- `attemptSubmit(): boolean`: marks every field touched and returns whether `errorCodes` is empty.
- `isDirty` and `reset(values)`.

`initialValues` SHALL seed `values` once per `reseedKey`, so a host re-render never overwrites edits. The hook SHALL also return `submitAttemptCount`, incremented on every `attemptSubmit()`.

`DeploymentCreationForm` and `MetadataForm` SHALL accept `focusRequestKey?: number`. When it is set, focus SHALL move to the first invalid field each time the key changes, and SHALL NOT move when errors appear for any other reason (for example on blur). When it is unset, focus moves when errors first appear, as before. The hook SHALL return error codes, not messages. All returned callbacks SHALL be referentially stable (`useCallback`), and the returned object SHALL be memoised.

#### Scenario: Errors surface only for touched fields until submit
- **WHEN** Name is empty, untouched, and `attemptSubmit` has not been called
- **THEN** `visibleErrorCodes.name` is undefined while `errorCodes.name` is `DeploymentCreationFieldErrorCode.Required`
- **AND** after `attemptSubmit()` returns `false`, `visibleErrorCodes.name` equals `Required`

#### Scenario: Re-render does not overwrite edits
- **WHEN** the host re-renders with a new `initialValues` object but the same `reseedKey` after the user typed a name
- **THEN** `values.name` keeps the typed value

#### Scenario: A blur-time error does not pull focus back
- **WHEN** `MetadataForm` renders with `focusRequestKey={metadata.submitAttemptCount}` and the user leaves an invalid Name for Version
- **THEN** the Name error appears and focus stays in Version

#### Scenario: Validation options are respected
- **WHEN** the hook is configured with `validateVersionPattern: SEMVER_VERSION_PATTERN` and the version is `1.0-beta`
- **THEN** `errorCodes.version` is the invalid-version code
