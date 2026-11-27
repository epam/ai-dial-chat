# Spec Delta

## MODIFIED Requirements

### Requirement: Public package surface
`libs/builder-form/src/index.ts` SHALL export `BuilderFormContainer`, `EditorLayout`, `EditorSection`, `AddAvatar`, `AvatarPickerModal`, `DeploymentCreationForm`, `DeploymentLocalesField`, `EntityEditor`, `MetadataForm`, `useMetadataForm`, `MetadataField`, `validateDeploymentCreationFields` with its patterns (`NAME_PATTERN`, `VERSION_PATTERN`, `STORED_VERSION_PATTERN`), `DeploymentCreationFieldErrorCode`, the `BUILDER_FORM_CLASS` public class-name map, `DEFAULT_METADATA_FORM_LABELS`, and every TypeScript type reachable through their props: `BuilderFormContainerProps`, `BuilderFormContainerStyles`, `BuilderFormContainerColors`, `BuilderFormActionsLabels`, `BuilderFormHeaderLabels`, `BuilderFormHeaderStyles`, `BuilderFormHeaderColors`, `BuilderFormHeaderTypography`, `EditorLayoutProps`, `EditorLayoutLabels`, `EditorLayoutStyles`, `EditorLayoutColors`, `EditorSectionProps`, `EditorSectionStyles`, `EditorSectionColors`, `AddAvatarProps`, `AddAvatarColors`, `AddAvatarStyles`, `AvatarPickerModalProps`, `AvatarPickerModalLabels`, `AvatarPickerFileManagerModalProps`, `DeploymentCreationFormProps`, `DeploymentCreationFormValues`, `DeploymentCreationFormLabels`, `DeploymentCreationFormFieldLabels`, `DeploymentCreationFormIconLabels`, `DeploymentCreationFormFieldErrors`, `DeploymentCreationFormLocaleEntry`, `DeploymentCreationFormLocaleOption`, `DeploymentCreationFormLocaleLabels`, `DeploymentCreationFormStyles`, `DeploymentCreationFormErrorCodes`, `DeploymentCreationFormValidationOptions`, `DeploymentLocalesFieldProps`, `EntityEditorProps`, `EntityEditorLabels`, `EntityEditorStyles`, `MetadataFormProps`, `MetadataFormLabels`, `MetadataFormAvatarPicker`, `UseMetadataFormOptions`, `UseMetadataFormResult`. Internal-only helpers (the header and body components inside `BuilderFormContainer`) SHALL NOT be exported from the barrel. The package `libs/builder-form/package.json` SHALL declare `name: "@epam/ai-dial-builder-form"` with `description`, `license: "Apache-2.0"`, an `exports` map with `./package.json`, `./styles.css` (`./dist/index.css`), and `.` (source/types/import/default), peer dependencies on `react`, `@epam/ai-dial-ui-kit`, and `@epam/ai-dial-chat-shared`, and `@tabler/icons-react` as a regular dependency.

#### Scenario: Consumer imports the library's public surface
- **WHEN** a consumer writes `import { EditorLayout, EditorSection, EditorLayoutProps, EditorLayoutLabels } from '@epam/ai-dial-builder-form'`
- **THEN** the import resolves successfully and every named type is defined

#### Scenario: Internal helper is not part of the public surface
- **WHEN** code outside `libs/builder-form` attempts to import an unexported internal helper from `@epam/ai-dial-builder-form`
- **THEN** the import fails to resolve, since the barrel does not re-export it

### Requirement: Shared field validation function
`libs/builder-form` SHALL export a pure `validateDeploymentCreationFields` function that
takes the shared field values and an options object, and returns field-level errors. It SHALL
return:

- a required-name error when the name is empty;
- a too-long name error (`DeploymentCreationFieldErrorCode.TooLong`) when the trimmed name is
  longer than `ENTITY_NAME_MAX_LENGTH` (256, from `@epam/ai-dial-chat-shared`);
- a name-format error (opt-in via `validateNamePattern`) when the name contains characters
  outside letters, digits, spaces, underscores, dots, and dashes (`NAME_PATTERN`);
- a control-character name error (`DeploymentCreationFieldErrorCode.ControlCharacters`) when the
  name contains a line break, tab or other control character;
- a too-long description error (`description: TooLong`) when the description is longer than
  `ENTITY_DESCRIPTION_MAX_LENGTH` (2000);
- a version-format error (opt-in via `validateVersionPattern`) for a non-empty version that
  fails the applicable version pattern.

The length and control-character checks SHALL always run. For a name, the first failing check
wins, in the order required, too long, pattern, control characters. A non-empty version never
produces a required error. The function SHALL NOT validate an `intro` field. The function SHALL
have no side effects and SHALL NOT depend on i18n, routing, or network state.

`validateVersionPattern` SHALL accept either `true` — checking the non-empty version against the
exported default `VERSION_PATTERN` — or a `RegExp`, checked instead of the default. `VERSION_PATTERN`
SHALL be the shared resource version rule (`resource-version-pattern`: one to 64 letters, digits,
underscores, dots, plus signs and hyphens, not ending with a dot, not containing `__` and not starting with `_`), taken from
`@epam/ai-dial-chat-shared` (`RESOURCE_VERSION_PATTERN`) and re-exported under this name.
`STORED_VERSION_PATTERN` SHALL be `STORED_RESOURCE_VERSION_PATTERN` from the same package, re-exported under this name, and hosts pass it as `validateVersionPattern` in edit mode so a version stored under the earlier rules is not rejected. The library
SHALL NOT export `SEMVER_VERSION_PATTERN`.

#### Scenario: Valid values produce no errors
- **WHEN** the function is called with a non-empty, correctly formatted name
- **THEN** it returns no error for name

#### Scenario: Name is required
- **WHEN** the function is called with an empty name
- **THEN** it returns a required-field error for name

#### Scenario: Name over the shared limit
- **WHEN** the function is called with a 257-character name
- **THEN** it returns a too-long error for name; a 256-character name produces no error

#### Scenario: Name with a control character
- **WHEN** the function is called with a name containing a line break
- **THEN** it returns a control-characters error for name

#### Scenario: Description over the shared limit
- **WHEN** the function is called with a 2001-character description
- **THEN** it returns a too-long error for description

#### Scenario: Default version pattern check
- **WHEN** the function is called with `validateVersionPattern: true` and a non-empty version
  containing a character outside `VERSION_PATTERN`
- **THEN** it returns a version-format error; a version following the shared rule (e.g. `abc` or
  `beta-2`) produces no error, and a version ending with a dot, containing `__`, starting with `_` or longer than 64 characters returns a
  version-format error

#### Scenario: Stricter version pattern override
- **WHEN** the function is called with `validateVersionPattern` set to a `RegExp` that only accepts
  dot-separated numeric segments and a non-empty version such as `abc`
- **THEN** it returns a version-format error; a version such as `0.0.1` or `2.0` produces no error

#### Scenario: Empty version is never flagged
- **WHEN** the function is called with `validateVersionPattern` set (either `true` or a `RegExp`)
  and an empty version
- **THEN** it returns no error for version

### Requirement: useMetadataForm — headless metadata state

`@epam/ai-dial-builder-form` SHALL export `useMetadataForm({ initialValues, validationOptions, reseedKey? })`. It returns:

- `values` and `setValues(patch)`.
- `touched` and `markTouched(field)`.
- `errorCodes`: the full result of `validateDeploymentCreationFields(values, validationOptions)`.
- `visibleErrorCodes`: only the touched fields, or every field once `attemptSubmit()` has been called. A `TooLong` or `ControlCharacters` code is visible immediately, without a touch; only a `Required` or `InvalidFormat` code waits for touch or submit.
- `attemptSubmit(): boolean`: marks every field touched and returns whether `errorCodes` is empty.
- `isDirty` and `reset(values?)`, which re-seeds from the given values or, when omitted, from the latest `initialValues`.

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
- **WHEN** the hook is configured with `validateVersionPattern: true` and the version is `1.0.`
- **THEN** `errorCodes.version` is the invalid-version code

### Requirement: Shared default deployment version
`@epam/ai-dial-builder-form` SHALL export `DEFAULT_DEPLOYMENT_VERSION`, the string `'1.0.0'`, from `libs/builder-form/src/index.ts`, defined next to `VERSION_PATTERN` in `libs/builder-form/src/utils/validate-deployment-creation-fields.ts`. It is the single frontend source for the Version value a deployment create form opens with, and it SHALL satisfy `VERSION_PATTERN`. The library SHALL NOT apply it on its own: `useMetadataForm`, `MetadataForm` and `validateDeploymentCreationFields` keep using the values the host passes, and a host opts in by seeding its create-mode values with the constant.

#### Scenario: Constant is exported and SemVer-valid
- **WHEN** a consumer writes `import { DEFAULT_DEPLOYMENT_VERSION, VERSION_PATTERN } from '@epam/ai-dial-builder-form'`
- **THEN** `DEFAULT_DEPLOYMENT_VERSION` equals `'1.0.0'` and `validateDeploymentCreationFields` with `validateVersionPattern: true` returns no version error for it

#### Scenario: The library does not inject the default
- **WHEN** `useMetadataForm` is seeded with `version: ''`
- **THEN** the Version field renders empty; the library does not substitute `DEFAULT_DEPLOYMENT_VERSION`
