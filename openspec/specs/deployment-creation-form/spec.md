# deployment-creation-form Specification

## Purpose
TBD - created by archiving change add-intro-field-quick-app-toolset. Update Purpose after archive.
## Requirements
### Requirement: Shared general creation form fields
`libs/deployment-creation-form` SHALL export a controlled presentation component providing the
field set common to Quick App and Toolset creation: name, description, icon URL, version, and
topics. The component SHALL accept the current field values, field-level errors, and an
`onChange` callback as props, and SHALL NOT hold its own copy of field state, call any
network API, or trigger submission. The component SHALL NOT render an Intro field.

#### Scenario: Component renders all shared fields
- **WHEN** a host app renders the shared component with a set of values
- **THEN** it displays inputs for name, description, icon URL, version, and topics
  reflecting those values

#### Scenario: Field edits are reported through onChange
- **WHEN** a user edits any shared field
- **THEN** the component calls `onChange` with a patch containing only the changed field, and
  does not mutate its own internal state

#### Scenario: Passed-in errors are surfaced per field
- **WHEN** a host app passes a field-level error for name or version
- **THEN** the component displays that error next to the corresponding field without
  performing its own validation pass

### Requirement: Shared field validation function
`libs/deployment-creation-form` SHALL export a pure `validateDeploymentCreationFields` function that
takes the shared field values and returns field-level errors: a required-name error when name
is empty, and a name-format error when name contains characters outside letters, digits, spaces,
underscores, dots, and dashes. The function SHALL NOT validate an `intro` field. The
function SHALL have no side effects and SHALL NOT depend on i18n, routing, or network state.

#### Scenario: Valid values produce no errors
- **WHEN** the function is called with a non-empty, correctly formatted name
- **THEN** it returns no error for name

#### Scenario: Name is required
- **WHEN** the function is called with an empty name
- **THEN** it returns a required-field error for name

### Requirement: Library isolation boundary
`libs/deployment-creation-form` SHALL NOT import `react-i18next`, `@epam/chat-api-client`,
`apps/chat/src/server-api`, routing utilities, browser storage, feature-flag clients, or any
DIAL Core/application-specific integration detail. All display strings SHALL be supplied by
the host app through a `labels` prop; all request-body mapping and network calls SHALL happen
in host app-level containers, not inside the library.

#### Scenario: No generated client or i18n imports
- **WHEN** the library's source is inspected
- **THEN** no file under `libs/deployment-creation-form/src` imports `@epam/chat-api-client`,
  `react-i18next`, or an application route/path constant

### Requirement: Name and description resolve to plain strings before reaching the library
`libs/deployment-creation-form` SHALL only ever receive and operate on plain string values for
the name and description fields, even though DIAL Core MAY store an entity's
`displayName`/`name` and `description` as either a plain string or a map of locale code to
translated value when the entity has localized text configured. Resolving a locale map to a
single string SHALL happen in the host app before the value is passed into the shared
component's `values` prop, consistent with the library isolation boundary (the library SHALL
NOT import i18n to perform this resolution itself). The primary Name/Description fields
represent a fixed primary content locale, not the viewer's active UI locale: the host SHALL
resolve `values.name`/`values.description` to the entity's primary locale (exact match, then
base language, then the first available value), so that editing an existing localized entity
while the UI is displayed in a different language does not silently load a translation into the
primary field and overwrite the original on save.

#### Scenario: Host resolves a localized name before prefill
- **WHEN** a host app opens the General step to edit an existing application or toolset whose
  `displayName`/`description` from DIAL Core is a locale map rather than a plain string
- **THEN** the host resolves that map to a single string for the entity's primary locale before
  passing it to `libs/deployment-creation-form`, and the library receives and displays only
  that resolved plain string, regardless of the viewer's own active UI language

### Requirement: Editable additional-locale entries for name and description
`libs/deployment-creation-form` SHALL export a `DeploymentLocalesField` component and an
`otherLocales` array field on `DeploymentCreationFormValues`, allowing a host app to present a
summary of which additional locales have translated name/description values and to open a popup
for adding, editing, and deleting per-locale name/description entries (language, name,
description) alongside the single active-locale name/description fields. The component SHALL
follow the same controlled, host-supplied-labels pattern as the rest of the shared form: it
SHALL NOT hold authoritative state beyond the open/closed popup, SHALL report changes to
`otherLocales` through `onChange`, and SHALL NOT itself call any network API or persist
anything — composing the entered locale entries back into a DIAL Core locale map for saving is
the host app's responsibility.

#### Scenario: Summary reflects the configured additional locales
- **WHEN** `otherLocales` contains entries for one or more locales
- **THEN** the summary row displays each entry's locale code next to the "Locales" label, e.g.
  `Locales: [FR], [UA]`

#### Scenario: Adding a locale entry
- **WHEN** a user opens the popup, selects a language not already used by another row, and
  fills in a name (description is optional), then saves
- **THEN** `onChange` is called with an `otherLocales` array including the new entry

#### Scenario: A language already used by another row cannot be selected again
- **WHEN** a user opens the language selector for one row
- **THEN** languages already assigned to other rows in the popup are unavailable for
  selection

#### Scenario: Deleting a locale entry
- **WHEN** a user removes a row from the popup and saves
- **THEN** `onChange` is called with an `otherLocales` array that no longer includes that entry

#### Scenario: Popup opens with one unconfigured row when no locales exist yet
- **WHEN** a user opens the "Add locale" popup while `otherLocales` is empty
- **THEN** the popup pre-seeds one empty, unconfigured row instead of showing an empty list
  that requires clicking "Add locale" first

### Requirement: Host composes additional locales into the write payload
A host app that saves an entity SHALL compose `values.otherLocales` into the request fields DIAL
Core's write API expects for additional locale text (a `locales` array of `{language, name,
description}` entries plus a `primaryLocale` marker identifying which locale `name`/`description`
are written in) — persisting `otherLocales` is the host app's responsibility, not the library's,
omitting both fields entirely when `otherLocales` is empty so an unrelated save is byte-identical
to a save made before this feature existed. A host app that loads an existing entity SHALL
decompose a returned locale map back into `otherLocales`, excluding the primary locale's own key
since that value is already the primary Name/Description field.

#### Scenario: Saving without additional locales sends no locale fields
- **WHEN** a host app saves an entity whose `otherLocales` is empty
- **THEN** the request sent to DIAL Core's write API omits the `locales` and `primaryLocale`
  fields entirely, matching the request shape used before additional-locale support existed

#### Scenario: Loading an entity with additional locales populates the popup
- **WHEN** a host app loads an entity whose `displayName`/`description` are locale maps
- **THEN** `otherLocales` is populated with one entry per locale key present in either map,
  excluding the primary locale's own key

### Requirement: Visual composition without duplicated logic
The library SHALL render its field stack using neutral default layout classes and SHALL
accept an optional `classNames` prop for per-slot style overrides, without requiring host apps
to fork or duplicate the shared field/validation logic to achieve a different visual layout
around the shared fields.

#### Scenario: Host apps compose different surrounding layouts
- **WHEN** two different host containers render the shared component with different
  surrounding layout (e.g. a two-column layout with a preview panel vs. a single-column
  stacked layout)
- **THEN** both containers use the same shared component and validator without either
  reimplementing the field set

