# @epam/ai-dial-builder-form

## Overview

Presentational building blocks shared by DIAL's builder/editor form pages — the surfaces where a user composes or edits an entity (a scheduled task, a deployment, a toolset, a prompt, a skill) through a titled page with a back control and save/cancel actions. The package provides:

- `BuilderFormContainer` — a full-height scrollable form page shell with a header and a three-column body;
- `EditorLayout` and `EditorSection` — a two-column editor shell with a header row and a bordered card wrapper for named field groups;
- `AddAvatar` and `AvatarPickerModal` — the avatar preview control and the host-wired file-manager modal behind it;
- `DeploymentCreationForm`, `DeploymentLocalesField`, and `validateDeploymentCreationFields` — the shared General-step field set (avatar, name, description, version, topics, per-locale translations) and its validation.

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

- `react` ^19.0.0
- `@epam/ai-dial-chat-shared` `*`
- `@epam/ai-dial-ui-kit` ^0.14.0-dev.15
- `@tabler/icons-react` ^3.44.0

## Components

### BuilderFormContainer

The whole builder form page shell — full height, scrollable, with the page background applied.

It renders the header itself: a back control, the title, and a cancel/submit action pair, where submit is the primary action and both actions disable independently (e.g. submit disabled while required fields are empty, cancel disabled while a submission is in flight). Header styling is forwarded through `styles.header`.

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
      ? dialFileToAttachment(file, bucket, { resolvePreviewUrl: resolveCatalogIconUrl })
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

### DeploymentCreationForm

Renders the whole shared General-step field set. `values`, `errors`, `onChange`, `onAddAvatarClick`, and `labels` are required. The avatar field never opens a file picker itself — `onAddAvatarClick` is the host's hook to open its own file manager/upload flow, and the host reports the result back through `onChange({ iconUrl })`. `iconPreviewUrl` is the URL to actually render in the preview box; the host resolves it from `values.iconUrl` (which may be a DIAL file id rather than a directly displayable URL). Supplying `labels.ariaLabel` wraps the root in a named `role="group"`, so the field set is discoverable as one region inside a larger host form.

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

## Enums

```tsx
import { DeploymentCreationFieldErrorCode } from '@epam/ai-dial-builder-form';

DeploymentCreationFieldErrorCode.Required; // field left empty
DeploymentCreationFieldErrorCode.InvalidFormat; // value fails its pattern
DeploymentCreationFieldErrorCode.TooLong; // value exceeds its maximum length
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
  BuilderFormHeaderLabels,
  BuilderFormHeaderStyles,
  BuilderFormHeaderColors,
  BuilderFormHeaderTypography,
  EditorLayoutProps,
  EditorLayoutLabels,
  EditorLayoutStyles,
  EditorSectionProps,
  EditorSectionStyles,
  AddAvatarProps,
  AddAvatarColors,
  AddAvatarStyles,
} from '@epam/ai-dial-builder-form';
```

`DeploymentCreationFormStyles` carries only per-slot class names (`root`,
`field`) — the field set composes into a host layout rather than owning one.
