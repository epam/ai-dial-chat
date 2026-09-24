# @epam/ai-dial-builder-form

## Overview

Presentational building blocks shared by DIAL's builder/editor form pages — the surfaces where a user composes or edits an entity (a scheduled task, a deployment, a toolset, a prompt, a skill) through a titled page with a back control and save/cancel actions. The package provides:

- `BuilderFormContainer` — a full-height scrollable form page shell with a header and a three-column body;
- `EditorLayout` and `EditorSection` — a two-column editor shell with a header row and a bordered card wrapper for named field groups;
- `AddAvatar` and `AvatarPickerModal` — the avatar preview control and the host-wired file-manager modal behind it;
- `DeploymentCreationForm`, `DeploymentLocalesField`, and `validateDeploymentCreationFields` — the shared General-step field set (avatar, name, description, version, topics, per-locale translations) and its validation;
- `EntityEditor`, `MetadataForm`, and `useMetadataForm` — the standard entity editor page (header, Metadata column, Setup column), the Metadata field set with its avatar picker, and the headless state that decides when a metadata error shows.

Extracting these blocks keeps every builder page visually identical and lets a single fix reach all of them. Quick Apps, Toolsets, and other deployment kinds all open with the same first step — identify the thing being created — so the field order, validation rules, and the "Add locale" popup are owned once instead of drifting apart between editors.

Like every other lib in this workspace, it owns markup, layout, and interaction only: all user-visible strings, values, disabled states, and callbacks are supplied by the consuming app or lib through props. It holds no state of its own and has no knowledge of routing, i18n, feature flags, storage, or any backend API. Validation is split the same way — `validateDeploymentCreationFields` returns untranslated `DeploymentCreationFieldErrorCode` values, and the host maps those codes to messages in its own locale.

Use it when building a form page shell or a shared editor field set: wire up i18n, data fetching, and form state at the app level, then render these components with the resolved strings and handlers.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-builder-form": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-builder-form/styles.css';
```

## Peer Dependencies

- `react` `^19.2.8`
- `@epam/ai-dial-chat-shared` `*`
- `@epam/ai-dial-ui-kit` `^0.15.0-dev.15`

## Components

### BuilderFormContainer

The whole builder form page shell — full height, scrollable, with the page background applied.

It renders the header itself: a back control, the title, and a cancel/submit action pair, where submit is the primary action and both actions disable independently (e.g. submit disabled while required fields are empty, cancel disabled while a submission is in flight). Header styling is forwarded through `styles.header`.

The action pair is placed per breakpoint: in the header at the desktop breakpoint, and in a sticky footer pinned over the bottom of the scrolling form at mobile widths, so it stays thumb-reachable while the form scrolls. Both copies render the same actions from the same props — exactly one is visible (and in the tab order) at any width. The footer paints the page background and an elevation shadow (`--shadow-xs-1`/`--shadow-xs-2`) so scrolled content never shows through it, and its two actions split the row equally. At mobile the header row — back control and title — reads as the first row of the form rather than a page bar: its divider is drawn above the row (under the app shell's floating header) instead of below it.

`isSubmitDisabled` covers both "not ready yet" and "already submitting", so it cannot on its own tell a user which of the two is happening. `isSubmitting` supplies the difference: it puts a spinner in the submit button, sets `aria-busy` on it, and announces `labels.submittingLabel` (default `'Submitting'`) through the header's `role="status"` region. The button's accessible name stays `labels.submitButtonLabel` throughout — the spinner is `aria-hidden`. Set both flags while a submit is in flight.

Below the header it lays out a three-column body: `left`, the main column (`children`), and `metadata`. Side columns are full width on mobile and a fixed 360px on desktop, with the main column taking the rest. Supplying `left` without `metadata` reserves an empty end column of the same width, so the main column stays optically centered. Column content carries its own padding, borders, and `flex-1` — the container supplies only the column widths and the row/stack direction.

The `styles.cssVars` escape hatch sets arbitrary CSS custom properties on the root, so vars read anywhere inside the form cascade from one place.

```tsx
import { BuilderFormContainer } from '@epam/ai-dial-builder-form';

<BuilderFormContainer
  labels={{
    title: 'New task',
    backButtonLabel: 'Back',
    cancelButtonLabel: 'Cancel',
    submitButtonLabel: 'Save',
    submittingLabel: 'Saving',
  }}
  onBack={() => {}}
  onCancel={() => {}}
  onSubmit={() => {}}
  isCancelDisabled={isSubmitting}
  isSubmitDisabled={!isValid || isSubmitting}
  isSubmitting={isSubmitting}
  styles={{
    colors: { background: 'var(--bg-layer-2)' },
    header: { typography: { fontClassName: 'dial-h1-text' } },
    cssVars,
  }}
  left={<section className="flex flex-1 flex-col px-8 py-6">{fields}</section>}
  metadata={<aside className="flex flex-1 flex-col px-8 py-6">{summary}</aside>}
>
  <section className="flex flex-1 flex-col px-8 py-6">{editor}</section>
</BuilderFormContainer>;
```

`BuilderFormContainer`'s header is configured through `labels` (typed `BuilderFormHeaderLabels`) and styled through `styles.header` (typed `BuilderFormHeaderStyles`, holding `BuilderFormHeaderColors` and `BuilderFormHeaderTypography`). All four are exported for consumers building those objects. The header and body components themselves are internal to the container.

`backIcon` is optional: omit it for the generic mirrored arrow, pass `null` to
omit the decorative icon, or provide a `ReactNode`. Its accessible label and
callback remain the header's own contract.

### EditorLayout

Full-height editor shell with a header and a responsive two-column body. On desktop, `actions` render at the end of the header row. On mobile/tablet, `actions` instead render in a bordered bar pinned to the bottom of the page, outside the scrollable body, so they never overlap `leftContent`/`rightContent`; each button grows to share the bar's width equally, and the primary action (the last child, e.g. Save/Create) is placed on the inline-start side with Cancel on the inline-end side — the reverse of the header's order.

```tsx
import { EditorLayout } from '@epam/ai-dial-builder-form';
import { GhostButton, PrimaryButton } from '@epam/ai-dial-ui-kit';

<EditorLayout
  title="New Toolset"
  onBack={handleBack}
  backAriaLabel="Back to toolsets"
  actions={
    <>
      <GhostButton label="Cancel" onClick={handleCancel} />
      <PrimaryButton label="Save" onClick={handleSave} />
    </>
  }
  isSaving={isSubmitting}
  labels={{ savingStatusLabel: 'Saving' }}
  leftContent={<MetadataSection />}
  rightContent={<SetupSection />}
/>;
```

**Props**

| Prop            | Type                 | Required | Default  | Description                                                                                                      |
| --------------- | -------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `title`         | `string`             | ✓        | —        | Heading text rendered as `<h1>` in the header row.                                                               |
| `onBack`        | `() => void`         | ✓        | —        | Called when the back-arrow button is clicked.                                                                    |
| `backAriaLabel` | `string`             |          | `'Back'` | Accessible label for the back-arrow button.                                                                      |
| `actions`       | `ReactNode`          |          | —        | Cancel + Save buttons. Rendered inline-end in the header on desktop, or in a pinned bottom bar on mobile/tablet. |
| `leftContent`   | `ReactNode`          |          | —        | Left column (Metadata).                                                                                          |
| `rightContent`  | `ReactNode`          |          | —        | Right column (Setup). When absent, left content fills full width.                                                |
| `isSaving`      | `boolean`            |          | `false`  | When `true`, announces `savingStatusLabel` via `aria-live`.                                                      |
| `labels`        | `EditorLayoutLabels` |          | —        | Text overrides with English defaults.                                                                            |
| `styles`        | `EditorLayoutStyles` |          | —        | CSS custom property overrides.                                                                                   |
| `dir`           | `'ltr' \| 'rtl'`     |          | —        | Explicit direction override forwarded to the root element.                                                       |

When `rightContent` is omitted, `leftContent` expands to full width at all viewport sizes.

### EditorSection

Bordered card wrapper for a named group of form fields.

```tsx
import { EditorSection } from '@epam/ai-dial-builder-form';

<EditorSection title="Metadata">
  <NameField />
  <DescriptionField />
</EditorSection>;
```

**Props**

| Prop        | Type                  | Required | Default | Description                                       |
| ----------- | --------------------- | -------- | ------- | ------------------------------------------------- |
| `title`     | `string`              |          | —       | Optional heading rendered above the section body. |
| `children`  | `ReactNode`           |          | —       | Section body content.                             |
| `styles`    | `EditorSectionStyles` |          | —       | CSS custom property overrides.                    |
| `className` | `string`              |          | —       | Additional CSS class applied to the root element. |

### AddAvatar

Avatar preview box with an "Add avatar" button and a format/size caption. Opening a file picker and validating the chosen file (type, size) is the host's responsibility — this component only renders the current state and reports clicks.

```tsx
import { AddAvatar } from '@epam/ai-dial-builder-form';

<AddAvatar
  label="Avatar"
  avatarUrl={iconUrl}
  addAvatarLabel="Add avatar"
  captionText="PNG, JPG or SVG (max 1 MB)"
  onAddAvatarClick={handleOpenAvatarPicker}
/>;
```

**Props**

| Prop               | Type              | Required | Default                        | Description                                                                                                                                     |
| ------------------ | ----------------- | -------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`            | `string`          | ✓        | —                              | Field label rendered above the preview box and button.                                                                                          |
| `avatarUrl`        | `string`          |          | —                              | URL of the currently selected avatar image. When set, it fills the 64x64 preview box instead of the placeholder icon.                           |
| `avatarAlt`        | `string`          |          | `''`                           | Alt text for the avatar image.                                                                                                                  |
| `addAvatarLabel`   | `string`          |          | `'Add avatar'`                 | Label for the "Add avatar" button.                                                                                                              |
| `captionText`      | `string`          |          | `'PNG, JPG or SVG (max 1 MB)'` | Caption describing the accepted formats and max size.                                                                                           |
| `onAddAvatarClick` | `() => void`      | ✓        | —                              | Called when the "Add avatar" button is clicked. The host opens its own file picker/manager and passes the resulting URL back in as `avatarUrl`. |
| `styles`           | `AddAvatarStyles` |          | —                              | CSS custom property overrides.                                                                                                                  |
| `className`        | `string`          |          | —                              | Additional CSS class applied to the root element.                                                                                               |

### AvatarPickerModal

The host-side counterpart to `DeploymentCreationForm`'s `onAddAvatarClick`: a file manager modal restricted to a single image, for picking an entity's avatar. It never talks to a backend, a specific file-manager implementation, or a storage identifier itself — `FileManagerModal` is the host's own DIAL file manager modal component (rendered for the actual browsing/upload UI), `bucket` comes from the host's user/session, `onAttach` is where the host resolves the picked file to a DIAL resource URL (and closes the modal), and every string is pre-translated through `labels`.

```tsx
import { AvatarPickerModal } from '@epam/ai-dial-builder-form';

<AvatarPickerModal
  isOpen={isAvatarPickerOpen}
  onAttach={(result) => {
    const [file] = result.files;
    const attachment = file
      ? dialFileToAttachment(file, bucket, {
          resolvePreviewUrl: resolveCatalogIconUrl,
        })
      : null;
    if (attachment?.url) handleChange({ iconUrl: attachment.url });
    setIsAvatarPickerOpen(false);
  }}
  onClose={() => setIsAvatarPickerOpen(false)}
  bucket={bucket}
  FileManagerModal={DialFileManagerModal}
  allowedMimeTypes={AVATAR_ALLOWED_MIME_TYPES}
  maxFileSizeBytes={AVATAR_MAX_FILE_SIZE_BYTES}
  labels={{
    title: 'Add avatar',
    attachLabel: 'Attach',
    emptyTitle: 'No files',
    emptyDescription: '',
    errorMessage: 'Something went wrong',
    retryLabel: 'Retry',
    hiddenFilesLabel: 'Hidden files',
    showHiddenFilesLabel: 'Show hidden files',
    hideHiddenFilesLabel: 'Hide hidden files',
    getSelectionLabel: (count) => `${count} selected`,
    uploadFilesLabel: 'Upload',
    newFolderLabel: 'New folder',
    downloadLabel: 'Download',
    downloadingLabel: 'Downloading',
    deleteLabel: 'Delete',
    deletingLabel: 'Deleting',
    deleteConfirmTitleSingle: 'Delete file?',
    deleteConfirmTitleMultiple: 'Delete files?',
    deleteConfirmSingleText: 'Are you sure you want to delete',
    deleteConfirmMultipleText: 'Are you sure you want to delete',
    deleteConfirmItemsLabel: 'items?',
    deleteConfirmLabel: 'Delete',
    deleteCancelLabel: 'Cancel',
    uploadProgressTitle: 'Uploading',
    cancelLabel: 'Cancel',
  }}
/>;
```

### EntityEditor

The standard entity editor page: `EditorLayout` with a back arrow and `<h1>` title, Cancel and a primary button in the header, a "Metadata" `EditorSection` in the 360px left column and a "Setup" `EditorSection` in the right column. `title`, `onBack`, `onCancel`, `onSubmit`, `submitLabel`, and `metadata` are required.

- `isSubmitting` disables Cancel and the primary button and announces `labels.savingStatusLabel`.
- `isSubmitDisabled` disables only the primary button. Use it for a host-owned readiness reason (an embedded editor that is not ready to save), not for validation — a submit attempt with invalid fields should show the errors instead.
- `extraActions` render before Cancel; `hideStandardActions` hides Cancel and the primary button so only they remain (e.g. while a preview is open).
- `metadataFooter` renders below the Metadata section in the left column.
- `setup` fills the Setup section; without it the left column takes the full width. `setupTitle` replaces the section heading.
- `alert` renders in a `role="alert"` region above the Setup section (above Metadata when there is no Setup).

```tsx
import { EntityEditor, MetadataForm } from '@epam/ai-dial-builder-form';

<EntityEditor
  title="Create toolset"
  onBack={handleBack}
  onCancel={handleBack}
  onSubmit={handleSubmit}
  submitLabel="Create"
  isSubmitting={isSaving}
  alert={submitError}
  metadata={
    <MetadataForm values={values} errors={errors} onChange={handleChange} />
  }
  setup={<ToolsetSettings />}
  labels={{ backAriaLabel: 'Back to catalog' }}
/>;
```

### MetadataForm

`DeploymentCreationForm` plus the avatar picker, with English default labels. `values`, `errors`, and `onChange` are required.

`fields` (a list of `MetadataField`) narrows the rendered fields; the order never changes. The Avatar field renders only when `avatarPicker` is supplied. Every value in it is host-resolved: the storage `bucket`, the host's `FileManagerModal`, `resolveIconUrl` for the preview, and `resolveAttachedIconUrl`, which turns the picked file into the icon value to store (return `undefined` to leave the icon unchanged). The lib never builds storage paths itself.

```tsx
import { MetadataField, MetadataForm } from '@epam/ai-dial-builder-form';

// Full field set with the avatar picker
<MetadataForm
  values={values}
  errors={errors}
  onChange={handleChange}
  onNameBlur={handleNameBlur}
  availableLocaleOptions={localeOptions}
  avatarPicker={{
    bucket,
    FileManagerModal,
    resolveIconUrl,
    resolveAttachedIconUrl: (result) => toIconUrl(result.files[0]),
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
    maxFileSizeBytes: 1024 * 1024,
  }}
/>;

// Name and Description only
<MetadataForm
  values={values}
  errors={errors}
  onChange={handleChange}
  fields={[MetadataField.Name, MetadataField.Description]}
  isDescriptionRequired
/>;
```

### DeploymentCreationForm

Renders the whole shared General-step field set. `values`, `errors`, `onChange`, `onAddAvatarClick`, and `labels` are required. The avatar field never opens a file picker itself — `onAddAvatarClick` is the host's hook to open its own file manager/upload flow, and the host reports the result back through `onChange({ iconUrl })`. `iconPreviewUrl` is the URL to actually render in the preview box; the host resolves it from `values.iconUrl` (which may be a DIAL file id rather than a directly displayable URL). Supplying `labels.ariaLabel` wraps the root in a named `role="group"`, so the field set is discoverable as one region inside a larger host form.

`fields` renders a subset (Avatar, Name + Version, Description, Locales, Tags, in that fixed order); Name takes the full row when Version is hidden. `isNameReadOnly`, `nameCaption`, `isDescriptionRequired`, and `errors.description` cover editors whose name is fixed after creation or whose description is required. When errors first appear, focus moves to the first invalid field — Name, then Version, then Description. `labels.topics.placeholder` falls back to `'Add tags, comma separated'`.

```tsx
import { DeploymentCreationForm } from '@epam/ai-dial-builder-form';

<DeploymentCreationForm
  values={values}
  errors={errors}
  onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
  onNameBlur={handleNameBlur}
  onVersionBlur={handleVersionBlur}
  iconPreviewUrl={resolveIconPreviewUrl(values.iconUrl)}
  onAddAvatarClick={openAvatarPicker}
  availableLocaleOptions={localeOptions}
  labels={{
    name: { label: 'Name', placeholder: 'Enter a name' },
    description: { label: 'Description' },
    iconUrl: {
      label: 'Avatar',
      addAvatarLabel: 'Add avatar',
      captionText: 'PNG, JPG or SVG (max 1 MB)',
    },
    version: { label: 'Version', placeholder: '1.0.0' },
    topics: { label: 'Topics' },
    otherLocales: {
      summaryLabel: 'Locales',
      addLabel: 'Add locales',
      editLabel: 'Edit locales',
      popupTitle: 'Add locale',
      addLocaleLabel: 'Add locale',
      languageLabel: 'Language',
      nameLabel: 'Name',
      descriptionLabel: 'Description',
      deleteAriaLabel: 'Remove locale',
    },
    ariaLabel: 'General',
  }}
/>;
```

### DeploymentLocalesField

The additional-locales summary row plus its editing popup, usable on its own when a host needs the locale editor without the surrounding fields. `value`, `onChange`, and `labels` are required; `onChange` receives the full updated list when the user saves.

`availableLocaleOptions` drives whether the control exists at all: with an empty list (its default) the component renders `null` — no summary, no "Add locales" link. Every row needs a language and a name before Save enables, so a popup with nothing to pick from could never be satisfied. `value` is left untouched when the control hides, so locales already stored on the deployment survive.

```tsx
import { DeploymentLocalesField } from '@epam/ai-dial-builder-form';

<DeploymentLocalesField
  value={values.otherLocales}
  onChange={handleLocalesChange}
  availableLocaleOptions={localeOptions}
  labels={localeLabels}
/>;
```

## Utilities

### validateDeploymentCreationFields

Pure validation returning untranslated error codes. Pattern checks are opt-in, because the allowed character set differs by deployment kind.

```tsx
import {
  validateDeploymentCreationFields,
  DeploymentCreationFieldErrorCode,
  NAME_PATTERN,
  VERSION_PATTERN,
  SEMVER_VERSION_PATTERN,
} from '@epam/ai-dial-builder-form';

const codes = validateDeploymentCreationFields(values, {
  validateNamePattern: true,
  validateVersionPattern: true, // or: SEMVER_VERSION_PATTERN for a stricter check
});

const errors = {
  name:
    codes.name === DeploymentCreationFieldErrorCode.Required
      ? t(AppsEditorI18nKeys.NameRequired)
      : undefined,
};
```

`NAME_PATTERN` allows letters, digits, spaces, underscores, dots, and dashes;
`VERSION_PATTERN` (the default when `validateVersionPattern: true`) allows
letters, digits, dots, underscores, and dashes. Pass a `RegExp` instead of
`true` — e.g. `SEMVER_VERSION_PATTERN`, which requires one or more
dot-separated numeric segments (`0.0.1`, `2.0`) — for a host that needs a
stricter version format. All three are exported so a host can pre-filter
input with the same rule the validator applies.

## Hooks

### useMetadataForm

Headless metadata state: values, touched fields, and validation through `validateDeploymentCreationFields`. An error is visible once its field has been touched (`markTouched`, typically on blur), and every error is visible after `attemptSubmit()`, which returns whether the values are valid. `initialValues` seed the form once per `reseedKey`, so a host re-render never overwrites the user's edits. It returns error codes, not messages.

```tsx
import {
  MetadataField,
  MetadataForm,
  SEMVER_VERSION_PATTERN,
  useMetadataForm,
} from '@epam/ai-dial-builder-form';

const metadata = useMetadataForm({
  initialValues,
  validationOptions: { validateVersionPattern: SEMVER_VERSION_PATTERN },
  reseedKey: appId,
});

const handleSubmit = () => {
  if (!metadata.attemptSubmit()) return;
  void save(metadata.values);
};

<MetadataForm
  values={metadata.values}
  errors={toMessages(metadata.visibleErrorCodes)}
  onChange={metadata.setValues}
  onNameBlur={() => metadata.markTouched(MetadataField.Name)}
  onVersionBlur={() => metadata.markTouched(MetadataField.Version)}
/>;
```

## Enums

```tsx
import { DeploymentCreationFieldErrorCode } from '@epam/ai-dial-builder-form';

DeploymentCreationFieldErrorCode.Required; // field left empty
DeploymentCreationFieldErrorCode.InvalidFormat; // value fails its pattern
DeploymentCreationFieldErrorCode.TooLong; // value exceeds its maximum length
```

```tsx
import { MetadataField } from '@epam/ai-dial-builder-form';

MetadataField.Avatar;
MetadataField.Name;
MetadataField.Version;
MetadataField.Description;
MetadataField.Locales;
MetadataField.Tags;
```

## Types

```tsx
import type {
  AvatarPickerModalProps,
  AvatarPickerModalLabels,
  AvatarPickerFileManagerModalProps,
  DeploymentCreationFormProps,
  DeploymentCreationFormValues,
  DeploymentCreationFormLabels,
  DeploymentCreationFormFieldLabels,
  DeploymentCreationFormIconLabels,
  DeploymentCreationFormFieldErrors,
  DeploymentCreationFormLocaleEntry,
  DeploymentCreationFormLocaleOption,
  DeploymentCreationFormLocaleLabels,
  DeploymentCreationFormStyles,
  DeploymentCreationFormErrorCodes,
  DeploymentCreationFormValidationOptions,
  DeploymentLocalesFieldProps,
  BuilderFormContainerProps,
  BuilderFormContainerStyles,
  BuilderFormContainerColors,
  BuilderFormActionsLabels,
  BuilderFormHeaderLabels,
  BuilderFormHeaderStyles,
  BuilderFormHeaderColors,
  BuilderFormHeaderTypography,
  EditorLayoutProps,
  EditorLayoutLabels,
  EditorLayoutStyles,
  EditorLayoutColors,
  EditorSectionProps,
  EditorSectionStyles,
  EditorSectionColors,
  AddAvatarProps,
  AddAvatarColors,
  AddAvatarStyles,
  EntityEditorProps,
  EntityEditorLabels,
  EntityEditorStyles,
  MetadataFormProps,
  MetadataFormLabels,
  MetadataFormAvatarPicker,
  UseMetadataFormOptions,
  UseMetadataFormResult,
} from '@epam/ai-dial-builder-form';
```

`DeploymentCreationFormStyles` carries only per-slot class names (`root`,
`field`) — the field set composes into a host layout rather than owning one.

`BuilderFormContainer`'s header is configured through `labels` (typed
`BuilderFormHeaderLabels`, which extends `BuilderFormActionsLabels` — the
cancel/submit labels shared by the header and the mobile footer) and styled
through `styles.header` (typed `BuilderFormHeaderStyles`, holding
`BuilderFormHeaderColors` and `BuilderFormHeaderTypography`). All of these are
exported for consumers building those objects. The header, body, and actions
components themselves are internal to the container.

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key               | Class                                | Element                                                        |
| ----------------- | ------------------------------------ | -------------------------------------------------------------- |
| `layout`          | `dial-builder-form-layout`           | The editor layout root, holding the header and the columns     |
| `section`         | `dial-builder-form-section`          | Every `EditorSection` box, titled or not                       |
| `metadataSection` | `dial-builder-form-metadata-section` | The Metadata section `EntityEditor` renders in the left column |
| `setupSection`    | `dial-builder-form-setup-section`    | The Setup section `EntityEditor` renders in the right column   |

```tsx
import { BUILDER_FORM_CLASS } from '@epam/ai-dial-builder-form';

BUILDER_FORM_CLASS.section; // 'dial-builder-form-section'
```

Both classes reach every editor built on this package, so a host styling
`.dial-builder-form-section` restyles the prompt, skill and toolset editors at
once. To reach one of them only, pair this class with that editor's own —
`.dial-toolset-editor-setup-section`, for instance.

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.

## Optional body layout

`BuilderFormBody` and `BuilderFormContainer` accept `layout` with
`sideColumnWidth` (400px), `columnGap` (0px) and `reserveEndColumn` (true).
Supplying layout enables wrapping columns based on the available container
width. Set `reserveEndColumn: false` for a two-column form. Omitting layout
preserves the existing responsive three-column behavior.
The public `styles.css` entry is the built stylesheet with matching CSS
Modules names; composed packages must include that entry, not source SCSS.

The composed form header, body and action footer use scoped 1280px responsive
rules. Host Tailwind screen definitions do not change which action set is visible.
Explicit body layout options still size and wrap columns by their container.
