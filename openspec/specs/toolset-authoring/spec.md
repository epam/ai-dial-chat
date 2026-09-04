# toolset-authoring Specification

## Purpose
The toolset create/edit screen: a flat, single-page `EditorLayout`-based editor for MCP toolsets (no wizard/step navigation), covering the route and load behavior, the Metadata and Setup sections, the Connect toolset section, and save behavior.
## Requirements
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

### Requirement: Metadata section fields
The Metadata section SHALL allow editing the toolset avatar, name, version, description, and topics. The avatar SHALL be picked via the shared `AddAvatar` control (preview box plus "Add avatar" button), which opens the `AvatarPickerModal` file manager restricted to a single image up to a host-configured size, rather than a plain URL text field. The name and description fields SHALL also allow editing translations for additional locales through the shared `DeploymentLocalesField` popup. These fields SHALL be rendered and validated through the shared `deployment-creation-form` library component. The Metadata section SHALL NOT contain any connection or authentication fields.

#### Scenario: Edit metadata fields
- **WHEN** a user picks an avatar image and types a name, version, description, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Pick an avatar image
- **WHEN** a user clicks "Add avatar" in the Metadata section
- **THEN** the file manager opens restricted to a single allowed image type up to the configured size, and selecting one replaces the placeholder icon with that image while leaving the "Add avatar" button in place so the user can pick a different file

#### Scenario: Edit an additional-locale translation
- **WHEN** a user opens the "Add locale" popup in the Metadata section and adds a translated name and description for another language
- **THEN** that translation is held in component state until the toolset is next saved

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to save
- **THEN** the system shows a required-field error for the name and blocks the save

### Requirement: Create and update requests forward additional locales
The create and update requests issued by the Save flow SHALL compose any
translations entered through the "Add locale" popup into the request's `locales`/`primaryLocale`
fields, omitting both fields entirely when no additional locales were entered so the request
stays byte-identical to a save made before this feature existed. An update that omits `locales`
SHALL replace any existing locale map on DIAL Core with a plain string — this mirrors the
full-replacement semantics every other Metadata-section field already has on update.

#### Scenario: Save sends additional locale translations
- **WHEN** a user adds a translation via the "Add locale" popup and clicks Save
- **THEN** the create/update request body includes `locales` with that translation and a
  `primaryLocale` identifying the language the primary name/description are written in

#### Scenario: Update without locales flattens a previously configured translation
- **WHEN** a user edits an existing toolset that already has additional-locale translations,
  removes every row from the "Add locale" popup, and saves
- **THEN** the update request omits `locales`/`primaryLocale` and DIAL Core's `displayName`/
  `description` for that toolset become plain strings again

### Requirement: Name-uniqueness check compares against the primary locale
The default-name-collision check performed when opening the editor in create mode SHALL compare
the candidate name against each existing toolset's name resolved to the primary locale, not to
the viewer's active UI locale (see "Unique name generation" for the collision check itself),
since the candidate name itself is always primary-locale content.

#### Scenario: Collision check ignores the viewer's UI language
- **WHEN** the viewer's UI language differs from the primary locale and an existing toolset's
  `displayName` is a locale map
- **THEN** the collision check compares against that toolset's primary-locale name, not the
  name resolved for the viewer's UI language

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

### Requirement: Unique name generation
When creating a new toolset, the system SHALL generate a storage-safe, conflict-free default
name by appending a numeric suffix when the default name collides with an existing toolset
name.

#### Scenario: Default name collides
- **WHEN** the default toolset name already exists among the user's toolsets
- **THEN** the generated default name is suffixed so it does not collide with any existing name

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
