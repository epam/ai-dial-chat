# @epam/ai-dial-deployment-creation-form

The shared General-step field set for creating and editing a DIAL deployment — name, description, icon URL, version, topics, and per-locale translations.

## Overview

Quick Apps, Toolsets, and other deployment kinds all open with the same first step: identify the thing being created. Before this library, each editor re-implemented that step, so the field order, validation rules, and the "Add locale" popup drifted apart between them. `@epam/ai-dial-deployment-creation-form` owns that field set once, so a fix reaches every editor that embeds it.

The component is fully controlled and holds no state: the host owns `values`, receives a partial patch on every change, and passes already-translated `errors` back down. Validation is split the same way — `validateDeploymentCreationFields` returns untranslated `DeploymentCreationFieldErrorCode` values, and the host maps those codes to messages in its own locale. The library knows nothing about routing, i18n, persistence, or which backend the deployment is eventually written to.

Use it as the General step inside a builder form shell (see `@epam/ai-dial-builder-form`). Reach for `DeploymentLocalesField` on its own only when a host needs the locale editor without the surrounding fields.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-deployment-creation-form": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@tabler/icons-react`

## Components

### DeploymentCreationForm

Renders the whole field set. `values`, `errors`, `onChange`, and `labels` are required. Supplying `labels.ariaLabel` wraps the root in a named `role="group"`, so the field set is discoverable as one region inside a larger host form.

```tsx
import { DeploymentCreationForm } from '@epam/ai-dial-deployment-creation-form';

<DeploymentCreationForm
  values={values}
  errors={errors}
  onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
  onNameBlur={handleNameBlur}
  onVersionBlur={handleVersionBlur}
  availableLocaleOptions={localeOptions}
  labels={{
    name: { label: 'Name', placeholder: 'Enter a name' },
    description: { label: 'Description' },
    iconUrl: { label: 'Icon URL' },
    version: { label: 'Version', placeholder: '1.0.0' },
    topics: { label: 'Topics' },
    otherLocales: {
      summaryLabel: 'Locales',
      editLabel: 'Edit',
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

The additional-locales summary row plus its editing popup. `value`, `onChange`, and `labels` are required; `onChange` receives the full updated list when the user saves.

```tsx
import { DeploymentLocalesField } from '@epam/ai-dial-deployment-creation-form';

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
} from '@epam/ai-dial-deployment-creation-form';

const codes = validateDeploymentCreationFields(values, {
  validateNamePattern: true,
  validateVersionPattern: true,
});

const errors = {
  name:
    codes.name === DeploymentCreationFieldErrorCode.Required
      ? t(AppsEditorI18nKeys.NameRequired)
      : undefined,
};
```

`NAME_PATTERN` allows letters, digits, spaces, underscores, dots, and dashes;
`VERSION_PATTERN` allows letters, digits, dots, underscores, and dashes. Both are
exported so a host can pre-filter input with the same rule the validator applies.

## Enums

```tsx
import { DeploymentCreationFieldErrorCode } from '@epam/ai-dial-deployment-creation-form';

DeploymentCreationFieldErrorCode.Required; // field left empty
DeploymentCreationFieldErrorCode.InvalidFormat; // value fails its pattern
DeploymentCreationFieldErrorCode.TooLong; // value exceeds its maximum length
```

## Types

```tsx
import type {
  DeploymentCreationFormProps,
  DeploymentCreationFormValues,
  DeploymentCreationFormLabels,
  DeploymentCreationFormFieldLabels,
  DeploymentCreationFormFieldErrors,
  DeploymentCreationFormLocaleEntry,
  DeploymentCreationFormLocaleOption,
  DeploymentCreationFormLocaleLabels,
  DeploymentCreationFormStyles,
  DeploymentCreationFormErrorCodes,
  DeploymentCreationFormValidationOptions,
  DeploymentLocalesFieldProps,
} from '@epam/ai-dial-deployment-creation-form';
```

`DeploymentCreationFormStyles` carries only per-slot class names (`root`,
`field`) — this lib composes into a host layout rather than owning one.
