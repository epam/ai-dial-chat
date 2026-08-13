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
- **THEN** the system loads that toolset and pre-fills the form fields with its values,
  resolving a `name`/`description` that DIAL Core returns as a locale map to a single string
  for the toolset's primary locale, and populates `otherLocales` with any remaining locale
  keys (see the `deployment-creation-form` spec's requirements on resolving localized
  name/description to plain strings and on decomposing additional locales)

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

### Requirement: Draft toolset creation on advancing to Settings
The editor SHALL create the toolset via the backend write API when a user advances from the
General step to the Settings step for a toolset that has not yet been persisted, using the
General-step field values (name, version, icon URL, description, topics) and an empty
endpoint, before switching to the Settings step. The returned toolset id SHALL be used for
the remainder of the session — Settings-step actions, login, the Connect toolset section, and
the final Save, which SHALL update rather than re-create the toolset.

If the toolset already has a persisted id (a draft created by an earlier Next, or an existing
toolset opened in edit mode) and the form has changed since it was last persisted, advancing
to the Settings step again SHALL update (not re-create) the toolset with the current form
values before switching steps. If the form has not changed since it was last persisted, the
editor SHALL NOT send a create or update request and SHALL just switch to the Settings step.

#### Scenario: Next creates a draft toolset
- **WHEN** a user on the General step with a valid name clicks Next
- **THEN** the editor calls the create endpoint with the General-step field values and an
  empty endpoint, receives a toolset id, and switches to the Settings step

#### Scenario: Next updates a persisted toolset with unsaved changes
- **WHEN** a user returns to the General step of an already-persisted toolset (draft or
  existing), edits a field, and clicks Next again
- **THEN** the editor calls the update endpoint (not create) with the current form values
  before switching to the Settings step

#### Scenario: Next sends no request when nothing changed
- **WHEN** a user returns to the General step of an already-persisted toolset without editing
  anything and clicks Next again
- **THEN** the editor sends neither a create nor an update request and switches straight to
  the Settings step

#### Scenario: Final save updates the draft
- **WHEN** a user completes the Settings step and clicks Save & Exit for a toolset created via
  Next
- **THEN** the editor calls the update endpoint, not create, using the previously created
  toolset id

#### Scenario: Draft creation failure
- **WHEN** the create call triggered by Next fails
- **THEN** the editor stays on the General step and shows an error notification

### Requirement: General step fields
The General step SHALL allow editing the toolset name, version, icon URL, description, and
topics. The icon SHALL be entered as a plain URL text field (no file-manager). Topics SHALL be
entered as free-entry tags sourced from the application config. The General step SHALL NOT
render an Intro field. The name and description fields SHALL also allow editing translations
for additional locales through the shared `DeploymentLocalesField` popup. These fields SHALL be
rendered and validated through the shared `deployment-creation-form` library component, the
same component used by Quick App creation's General step.

#### Scenario: Edit general fields
- **WHEN** a user types a name, version, icon URL, description, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Edit an additional-locale translation
- **WHEN** a user opens the "Add locale" popup on the General step and adds a translated name
  and description for another language
- **THEN** that translation is held in component state, alongside the primary name and
  description, until the toolset is next created or updated

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to proceed or save
- **THEN** the system shows a required-field error for the name and blocks the save

### Requirement: Create and update requests forward additional locales
The create and update requests issued by the "Next"/"Save & Exit" flows SHALL compose any
translations entered through the "Add locale" popup into the request's `locales`/`primaryLocale`
fields, omitting both fields entirely when no additional locales were entered so the request
stays byte-identical to a save made before this feature existed (see "Draft toolset creation on
advancing to Settings" for when those requests are issued). An update that omits `locales` SHALL
replace any existing locale map on DIAL Core with a plain string — this mirrors the
full-replacement semantics every other General-step field already has on update.

#### Scenario: Draft creation sends additional locale translations
- **WHEN** a user on the General step adds a translation via the "Add locale" popup and clicks
  Next
- **THEN** the create request body includes `locales` with that translation and a
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

The Settings step SHALL render a "Connect toolset" section at the bottom of the form, below the
authentication section, when the toolset being edited has a persisted id — either because the
editor was opened in edit mode for an existing toolset, or because a draft toolset was already
created by advancing past the General step — and `config.dialCoreExternalUrl` is configured.
The section SHALL be visually separated from the authentication content by a subtle horizontal
rule. It SHALL contain:
- A title: "Connect toolset"
- A description: "Copy endpoint URL to easily integrate toolset into your workflows"
- A `NeutralButton` labelled "Copy URL" from the shared Connect MCP URL content that,
  when clicked, copies the toolset's MCP endpoint URL — built by
  `buildToolsetMcpUrl(dialCoreExternalUrl, toolsetId)` from
  `apps/chat/src/utils/mcp-endpoint-url.ts` — to the clipboard via `useCodeCopy` and shows
  transient "Copied!" feedback; the feedback is also announced via an `aria-live="polite"`
  SR-only region.

The section SHALL NOT render before the toolset has a persisted id (i.e. still on the
General step of a brand-new toolset, before Next has created the draft) or when
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

#### Scenario: Connect section renders for a draft toolset created via Next

- **WHEN** a user creates a new toolset, clicks Next to advance past the General step, and
  `config.dialCoreExternalUrl` is set
- **THEN** the "Connect toolset" section is visible on the Settings step, using the draft
  toolset's id

#### Scenario: Connect section is hidden before the toolset is created

- **WHEN** the user is still on the General step of a brand-new toolset (no persisted id yet)
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
saving state. On successful save it SHALL raise a success notification and navigate to the
return URL; on failure it SHALL keep the user in the editor and show an error.

The success notification SHALL be raised through `useOperationNotification` (see
`entity-operation-notifications`) with `NotifiableEntity.Toolset` and
`EntityOperation.Created` when the save created the toolset or `EntityOperation.Edited` when
it updated an existing one, passing the toolset's name. The editor SHALL notify and navigate
in the same tick — navigation SHALL NOT be delayed to keep the notification on screen, since
`NotificationContainer` is mounted above the router and the notification survives the route
change.

A save that creates the draft toolset on advancing to the Settings step SHALL NOT notify;
only Save & Exit reports an outcome to the user.

#### Scenario: Successful create
- **WHEN** a user with a valid form clicks Save & Exit while creating a new toolset
- **THEN** the system calls the create endpoint and, on success, shows a success notification
  titled `"Toolset created successfully"` and navigates to the return URL

#### Scenario: Successful update
- **WHEN** a user with a valid form clicks Save & Exit while editing an existing toolset
- **THEN** the system calls the update endpoint and, on success, shows a success notification
  titled `"Toolset edited successfully"` and navigates to the return URL

#### Scenario: Notification survives leaving the editor
- **WHEN** the editor navigates to the return URL immediately after a successful save
- **THEN** the success notification remains visible on the destination route

#### Scenario: Draft creation is silent
- **WHEN** advancing from the General step to the Settings step creates the draft toolset
- **THEN** no success notification is shown

#### Scenario: Save failure
- **WHEN** the backend returns an error during save
- **THEN** the editor remains open, shows an error, clears the saving state, and shows no
  success notification
