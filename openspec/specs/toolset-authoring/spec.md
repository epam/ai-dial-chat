# toolset-authoring Specification

## Purpose
TBD - created by archiving change add-toolset-editor-flow. Update Purpose after archive.
## Requirements
### Requirement: Toolset editor route and entry modes
The system SHALL provide a `/toolset-editor` route that opens the toolset editor in either
create mode (no `id` search param) or edit mode (`id` search param present). In edit mode
the system SHALL load the toolset by id before rendering the form; if the toolset cannot be
found the system SHALL redirect away from the editor rather than render an empty form.

#### Scenario: Open editor in create mode
- **WHEN** a user navigates to `/toolset-editor` with no `id` search param
- **THEN** the editor opens on the General step with a default form, including an
  auto-generated conflict-free toolset name

#### Scenario: Open editor in edit mode
- **WHEN** a user navigates to `/toolset-editor?id=<toolsetName>` for an existing toolset
- **THEN** the system loads that toolset and pre-fills the form fields with its values

#### Scenario: Edit mode for a missing toolset
- **WHEN** a user navigates to `/toolset-editor?id=<unknown>` and the toolset is not found
- **THEN** the system redirects the user out of the editor instead of rendering the form

### Requirement: Two-step wizard navigation
The editor SHALL present two steps — General and Settings — and SHALL track the active step
in the URL via a `step` search param so navigation and reloads preserve the current step.

#### Scenario: Switch between steps
- **WHEN** a user selects the Settings step in the editor header
- **THEN** the Settings form renders and the `step` search param updates to the Settings value

#### Scenario: Reload preserves the active step
- **WHEN** a user is on the Settings step and reloads the page
- **THEN** the editor reopens on the Settings step

### Requirement: General step fields
The General step SHALL allow editing the toolset name, version, icon URL, description,
topics, and intro. The icon SHALL be entered as a plain URL text field (no file-manager).
Topics SHALL be entered as free-entry tags sourced from the application config. Intro SHALL
be a single-line text field limited to 90 characters. These fields SHALL be rendered and
validated through the shared `deployment-creation-form` library component, the same component
used by Quick App creation's General step.

#### Scenario: Edit general fields
- **WHEN** a user types a name, version, icon URL, description, intro, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to proceed or save
- **THEN** the system shows a required-field error for the name and blocks the save

#### Scenario: Intro exceeds the character limit
- **WHEN** a user enters an intro longer than 90 characters and attempts to save
- **THEN** the system shows a length-limit error on the intro field and blocks the save

#### Scenario: Intro is optional
- **WHEN** a user leaves the intro field empty and saves the toolset
- **THEN** the save proceeds without an intro-related error

### Requirement: Form-only editor layout
The editor SHALL render the active step form as the only content pane beneath the editor
header. The editor SHALL NOT render a separate live preview or catalog-card preview pane.

#### Scenario: Create toolset layout
- **WHEN** a user opens the toolset editor in create mode
- **THEN** the form occupies the available editor content width with no preview pane beside it

### Requirement: Settings step connection fields
The Settings step SHALL allow editing the endpoint URL, the transport protocol (HTTP or
SSE), and the allowed tools (tag input), and SHALL provide a control to copy the endpoint
URL to the clipboard.

#### Scenario: Valid endpoint URL
- **WHEN** a user enters a well-formed `http(s)://` or `sse://` endpoint URL
- **THEN** the field is accepted with no validation error

#### Scenario: Invalid endpoint URL
- **WHEN** a user enters a malformed endpoint URL (bad protocol, trailing `.`/`//`, or
  unparseable)
- **THEN** the system shows a URL validation error and blocks the save

#### Scenario: Copy endpoint URL
- **WHEN** a user clicks the copy-endpoint control
- **THEN** the endpoint URL is written to the clipboard

### Requirement: Settings step — Connect toolset section

When the user is editing an existing toolset (edit mode, `toolsetId` is non-empty) and
`config.dialCoreExternalUrl` is configured, the Settings step SHALL render a "Connect
toolset" section at the bottom of the form, below the authentication section. The section
SHALL be visually separated from the authentication content by a subtle horizontal rule.
It SHALL contain:
- A title: "Connect toolset"
- A description: "Copy endpoint URL to easily integrate toolset into your workflows"
- A `NeutralButton` labelled "Copy URL" from the shared Connect MCP URL content that,
  when clicked, copies the toolset's MCP endpoint URL — built by
  `buildToolsetMcpUrl(dialCoreExternalUrl, toolsetId)` from
  `apps/chat/src/utils/mcp-endpoint-url.ts` — to the clipboard via `useCodeCopy` and shows
  transient "Copied!" feedback; the feedback is also announced via an `aria-live="polite"`
  SR-only region.

The section SHALL NOT render in create mode (when `toolsetId` is empty) or when
`config.dialCoreExternalUrl` is absent.

The title and description strings SHALL reuse the existing
`CatalogI18nKeys.ConnectToolsetTitle` and `CatalogI18nKeys.ConnectToolsetDescription`
keys (already present from the catalog Connect action). The button label "Copy URL" uses
`ButtonsI18nKeys.CopyUrl`; the copied-state label reuses `ButtonsI18nKeys.Copied`.

**Feature flag:** Not gated. **RTL impact:** None (text uses default `text-start`; no
directional icons). **i18n impact:** `ButtonsI18nKeys.CopyUrl = 'buttons.copyUrl'` and
its English value `"Copy URL"` are added to `translation-keys.ts` and `en.json`.

#### Scenario: Connect section renders in edit mode with external URL configured

- **WHEN** the user opens the Settings step in edit mode and `config.dialCoreExternalUrl`
  is set
- **THEN** the "Connect toolset" section is visible at the bottom of the form, below the
  authentication section

#### Scenario: Connect section is hidden in create mode

- **WHEN** the user opens the Settings step in create mode (no `toolsetId` yet)
- **THEN** no "Connect toolset" section renders, regardless of `dialCoreExternalUrl`

#### Scenario: Connect section is hidden when the external URL is absent

- **WHEN** `config.dialCoreExternalUrl` is `null` or empty
- **THEN** no "Connect toolset" section renders, even in edit mode

#### Scenario: Copy URL copies the MCP endpoint and shows feedback

- **WHEN** the user clicks "Copy URL" in the Connect toolset section
- **THEN** the clipboard receives the toolset's MCP URL built by `buildToolsetMcpUrl`
- **AND** the button shows transient copied feedback announced via an `aria-live="polite"`
  region

### Requirement: Unique name generation
When creating a new toolset, the system SHALL generate a storage-safe, conflict-free default
name by appending a numeric suffix when the default name collides with an existing toolset
name.

#### Scenario: Default name collides
- **WHEN** the default toolset name already exists among the user's toolsets
- **THEN** the generated default name is suffixed so it does not collide with any existing name

### Requirement: Save and exit
The editor SHALL persist the toolset via the backend write API on save and SHALL surface a
saving state. On successful save it SHALL navigate to the return URL; on failure it SHALL
keep the user in the editor and show an error.

#### Scenario: Successful save
- **WHEN** a user with a valid form clicks Save & Exit
- **THEN** the system calls the create or update endpoint, and on success navigates to the
  return URL

#### Scenario: Save failure
- **WHEN** the backend returns an error during save
- **THEN** the editor remains open, shows an error, and clears the saving state
