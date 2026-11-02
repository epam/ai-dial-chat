## ADDED Requirements

### Requirement: Display-only client secret hint in AuthSection

`ToolsetAuthFormData` (`libs/toolset-editor/src/models/toolset-form.ts`) SHALL gain an optional, display-only `clientSecretHint?: string` — the already-resolved hint supplied by the host. `AuthSectionLabels` (`libs/toolset-editor/src/models/auth-section-props.ts`) SHALL gain `clientSecretHintPlaceholder?: (hint: string) => string` (default `` (hint) => `******${hint}` ``) and `clientSecretKeepCaption?: string` (default `'Leave empty to keep the saved secret.'`).

`AuthSection` SHALL render the masked placeholder and the caption only when OAuth "Custom login" is selected, `isEditMode` is true, `auth.clientSecretHint` is non-empty, and `auth.clientSecret` is empty; otherwise it SHALL render the Client secret `PasswordInput` exactly as before. The caption SHALL be exposed as the input's accessible description (`aria-describedby`). `isToolsetAuthValid`, `isToolsetFormValid`, and `ToolsetEditor`'s setup validation SHALL NOT read `clientSecretHint`, and the lib SHALL NOT copy it into `clientSecret` or any request shape it hands the host (`ToolsetLoginRequest`, the `onPersist` form).

The lib keeps its isolation: it never sees the DTO, the endpoint, or DIAL Core; it receives the hint as a resolved value in form state and its copy through `labels`, with English defaults and no i18n import. No memoisation is required beyond the existing component structure. The new label fields are documented in `libs/toolset-editor/README.md`.

#### Scenario: Hint shown only for an untouched secret in edit mode

- **GIVEN** `AuthSection` renders with `isEditMode`, OAuth `with-config`, `auth.clientSecretHint: "d4c6"` and an empty `auth.clientSecret`
- **THEN** the Client secret input has placeholder `******d4c6` and is described by `Leave empty to keep the saved secret.`

#### Scenario: Host overrides the copy

- **GIVEN** `labels.clientSecretHintPlaceholder` is `(hint) => '•••• ' + hint` and `labels.clientSecretKeepCaption` is a translated string
- **WHEN** `AuthSection` shows the hint
- **THEN** it uses the host-supplied placeholder and caption

#### Scenario: Hint ignored outside edit mode

- **GIVEN** `isEditMode` is false and `auth.clientSecretHint` is set
- **THEN** the Client secret input shows the regular placeholder, no "keep" caption, and stays required

#### Scenario: Hint never becomes the secret

- **GIVEN** `auth.clientSecretHint: "d4c6"` and an empty `auth.clientSecret`
- **WHEN** the user clicks "Log in" or saves
- **THEN** the request handed to the host carries no client secret derived from the hint
