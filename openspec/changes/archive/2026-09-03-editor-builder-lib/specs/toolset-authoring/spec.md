## REMOVED Requirements

### Requirement: Two-step wizard navigation
**Reason**: The redesign replaces the two-step wizard with a single flat page. Step tracking in URL params, the "Next" button, and the `step` search param are all removed.
**Migration**: Users who previously navigated to `/toolset-editor?step=settings` will land on the flat editor; the `step` param is ignored and the full form is always visible.

### Requirement: Draft toolset creation on advancing to Settings
**Reason**: The "advance to Settings creates a draft" pattern only existed to give the Settings step a real toolset id for the Connect section and OAuth login. In the flat single-page layout there is no step advance; the toolset is created only on Save.
**Migration**: No user-facing migration needed. The editor no longer creates a draft; it only calls create or update on Save.

## MODIFIED Requirements

### Requirement: Toolset editor route and entry modes
The system SHALL provide a `/toolset-editor` route that opens the toolset editor in either create mode (no `id` search param) or edit mode (`id` search param present). In edit mode the system SHALL load the toolset by id before rendering the form; if the toolset cannot be found the system SHALL redirect away from the editor rather than render an empty form.

#### Scenario: Open editor in create mode
- **WHEN** a user navigates to `/toolset-editor` with no `id` search param
- **THEN** the editor opens as a flat single-page form with all fields visible and default values populated, including an auto-generated conflict-free toolset name

#### Scenario: Open editor in edit mode
- **WHEN** a user navigates to `/toolset-editor?id=<toolsetName>` for an existing toolset
- **THEN** the system loads that toolset and pre-fills the form fields with its values, resolving a `name`/`description` that DIAL Core returns as a locale map to a single string for the toolset's primary locale, and populates `otherLocales` with any remaining locale keys

#### Scenario: Edit mode for a missing toolset
- **WHEN** a user navigates to `/toolset-editor?id=<unknown>` and the toolset is not found
- **THEN** the system redirects the user out of the editor instead of rendering the form

### Requirement: Form-only editor layout
The editor SHALL use `EditorLayout` from `@epam/ai-dial-editor-builder` to render a header row and a two-column body. The left column SHALL contain a Metadata `EditorSection` (Avatar, Name, Version, Description, Locales, Tags fields). The right column SHALL contain a Setup `EditorSection` (Endpoint, Protocol, Allowed tools, Authentication fields). On mobile, the two sections SHALL stack vertically (Metadata on top, Setup below). The editor SHALL NOT render a footer button bar, a wizard step indicator, or a separate live preview pane.

`ToolsetEditor`'s page root SHALL use `className="flex min-h-0 flex-1 flex-col"` (`flex-1` growth, not `size-full`), matching `AppsEditor` and `CustomAppEditor`.

#### Scenario: Both sections visible simultaneously
- **WHEN** a user opens the toolset editor (create or edit mode) at desktop width
- **THEN** the Metadata section (left) and Setup section (right) are both visible at the same time with no navigation required between them

#### Scenario: Sections stack on mobile
- **WHEN** a user opens the toolset editor at mobile width
- **THEN** Metadata renders first (top), Setup renders below it, and both are reachable by scrolling without any tab or step navigation

#### Scenario: No footer button bar
- **WHEN** the toolset editor is open
- **THEN** no footer row with Save/Cancel buttons appears at the bottom of the viewport; the only Save and Cancel controls are in the header actions slot

### Requirement: Metadata section fields
The Metadata section SHALL allow editing the toolset avatar (icon URL as a plain text field), name, version, description, and topics. The name and description fields SHALL also allow editing translations for additional locales through the shared `DeploymentLocalesField` popup. These fields SHALL be rendered and validated through the shared `deployment-creation-form` library component. The Metadata section SHALL NOT contain any connection or authentication fields.

#### Scenario: Edit metadata fields
- **WHEN** a user types a name, version, icon URL, description, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Edit an additional-locale translation
- **WHEN** a user opens the "Add locale" popup in the Metadata section and adds a translated name and description for another language
- **THEN** that translation is held in component state until the toolset is next saved

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to save
- **THEN** the system shows a required-field error for the name and blocks the save

### Requirement: Setup section fields
The Setup section SHALL allow editing the endpoint URL, the transport protocol (HTTP or SSE), the allowed tools (tag input), and the authentication settings (key-header, API key, OAuth client-id/secret/endpoints). The authentication block SHALL use the same visual style as the existing Settings step authentication section. The Setup section SHALL NOT contain any name, version, description, locales, or icon fields.

#### Scenario: Valid endpoint URL
- **WHEN** a user enters a well-formed `http(s)://` or `sse://` endpoint URL
- **THEN** the field is accepted with no validation error

#### Scenario: Invalid endpoint URL
- **WHEN** a user enters a malformed endpoint URL
- **THEN** the system shows a URL validation error and blocks the save

### Requirement: Settings step connection fields
The Connect toolset section SHALL render inside the Setup `EditorSection` at the bottom of the Setup content, below the authentication block, when the toolset being edited has a persisted id (edit mode) and `config.dialCoreExternalUrl` is configured. In create mode the section SHALL NOT render (no persisted id exists until Save). The section SHALL contain a title "Connect toolset", a description, and a "Copy URL" button that copies the toolset's MCP endpoint URL to the clipboard and shows transient "Copied!" feedback announced via `aria-live="polite"`.

#### Scenario: Connect section renders in edit mode with external URL configured
- **WHEN** the user opens the editor in edit mode and `config.dialCoreExternalUrl` is set
- **THEN** the "Connect toolset" section is visible at the bottom of the Setup section

#### Scenario: Connect section is hidden in create mode
- **WHEN** the user opens the editor in create mode
- **THEN** no "Connect toolset" section renders, since no toolset id exists yet

#### Scenario: Connect section is hidden when external URL is absent
- **WHEN** `config.dialCoreExternalUrl` is `null` or empty
- **THEN** no "Connect toolset" section renders, even in edit mode

#### Scenario: Copy URL copies the MCP endpoint and shows feedback
- **WHEN** the user clicks "Copy URL" in the Connect toolset section
- **THEN** the clipboard receives the toolset's MCP URL and the button shows transient copied feedback announced via `aria-live="polite"`

### Requirement: Save and exit
The editor SHALL persist the toolset via the backend write API on save and SHALL surface a saving state. On successful save it SHALL raise a success notification and navigate to the return URL; on failure it SHALL keep the user in the editor and show an error.

The success notification SHALL be raised through `useOperationNotification` with `NotifiableEntity.Toolset` and `EntityOperation.Created` (create mode) or `EntityOperation.Edited` (edit mode), passing the toolset's name. Navigation SHALL NOT be delayed to keep the notification on screen.

#### Scenario: Successful create
- **WHEN** a user with a valid form clicks Save while creating a new toolset
- **THEN** the system calls the create endpoint and, on success, shows a success notification titled `"Toolset created successfully"` and navigates to the return URL

#### Scenario: Successful update
- **WHEN** a user with a valid form clicks Save while editing an existing toolset
- **THEN** the system calls the update endpoint and, on success, shows a success notification titled `"Toolset edited successfully"` and navigates to the return URL

#### Scenario: Notification survives leaving the editor
- **WHEN** the editor navigates to the return URL immediately after a successful save
- **THEN** the success notification remains visible on the destination route

#### Scenario: Save failure
- **WHEN** the backend returns an error during save
- **THEN** the editor remains open, shows an error notification, clears the saving state, and shows no success notification
