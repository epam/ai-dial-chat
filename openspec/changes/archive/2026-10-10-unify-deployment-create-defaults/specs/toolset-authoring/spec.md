## MODIFIED Requirements

### Requirement: Toolset editor route and entry modes
The system SHALL provide a `/toolset-editor` route that opens the toolset editor in either create mode (no `id` search param) or edit mode (`id` search param present). In create mode the system SHALL render the form immediately from `getDefaultToolsetForm()` — an empty Name and the Version `DEFAULT_TOOLSET_VERSION` (`1.0.0`, an alias of builder-form's `DEFAULT_DEPLOYMENT_VERSION`), the same create-mode Name/Version defaults every application kind uses — without first listing the user's toolsets. In edit mode the system SHALL load the toolset by id before rendering the form; if the toolset cannot be found the system SHALL redirect away from the editor rather than render an empty form.

#### Scenario: Open editor in create mode
- **WHEN** a user navigates to `/toolset-editor` with no `id` search param
- **THEN** the editor opens as a flat single-page form with all fields visible, the Name field empty, the Version field showing `1.0.0`, and no list-toolsets request issued

#### Scenario: Create is blocked until a name is entered
- **WHEN** the create-mode form is otherwise valid but the Name field is empty
- **THEN** the Create action stays disabled and no create request is sent; typing a name enables it

#### Scenario: Open editor in edit mode
- **WHEN** a user navigates to `/toolset-editor?id=<toolsetName>` for an existing toolset
- **THEN** the system loads that toolset and pre-fills the form fields with its values, resolving a `name`/`description` that DIAL Core returns as a locale map to a single string for the toolset's primary locale, and populates `otherLocales` with any remaining locale keys

#### Scenario: Edit mode for a missing toolset
- **WHEN** a user navigates to `/toolset-editor?id=<unknown>` and the toolset is not found
- **THEN** the system redirects the user out of the editor instead of rendering the form

## REMOVED Requirements

### Requirement: Unique name generation
**Reason**: Create mode no longer seeds a default name ("New toolset"), so there is no default to make conflict-free. Every deployment create form now opens with an empty Name (Issue #9313).
**Migration**: None for users. A name the user types that is already taken is rejected on save by the BFF (409 "Toolset name already taken"), surfaced through the existing create-failed error notification.

### Requirement: Name-uniqueness check compares against the primary locale
**Reason**: The create-mode default-name collision check it qualified is removed together with "Unique name generation".
**Migration**: None; the save-time 409 from the BFF is the only name-conflict check.
