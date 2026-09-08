# builder-form Specification

## Purpose
Specifies `libs/builder-form`'s host-agnostic builder/editor form building blocks: the `BuilderFormContainer` page shell, the `EditorLayout`/`EditorSection` two-column editor layout, the `AddAvatar`/`AvatarPickerModal` avatar controls, and the `DeploymentCreationForm`/`DeploymentLocalesField` shared General-step field set with its validation — public package surface, host-isolation boundary (no i18n/routing/API knowledge), responsive layout behaviour, RTL/accessibility support, and the host/library division of responsibility shared by the scheduled-task, prompt, skill, toolset, Quick App, and Custom App editors.

## Requirements

### Requirement: Public package surface
`libs/builder-form/src/index.ts` SHALL export `BuilderFormContainer`, `EditorLayout`, `EditorSection`, `AddAvatar`, `AvatarPickerModal`, `DeploymentCreationForm`, `DeploymentLocalesField`, `validateDeploymentCreationFields` with its patterns, `DeploymentCreationFieldErrorCode`, and every TypeScript type reachable through their props: `BuilderFormContainerProps`, `BuilderFormContainerStyles`, `BuilderFormContainerColors`, `BuilderFormHeaderLabels`, `BuilderFormHeaderStyles`, `BuilderFormHeaderColors`, `BuilderFormHeaderTypography`, `EditorLayoutProps`, `EditorLayoutLabels`, `EditorLayoutStyles`, `EditorSectionProps`, `EditorSectionStyles`, `AddAvatarProps`, `AddAvatarColors`, `AddAvatarStyles`, `AvatarPickerModalProps`, `AvatarPickerModalLabels`, `AvatarPickerFileManagerModalProps`, `DeploymentCreationFormProps`, `DeploymentCreationFormValues`, `DeploymentCreationFormLabels`, `DeploymentCreationFormFieldLabels`, `DeploymentCreationFormIconLabels`, `DeploymentCreationFormFieldErrors`, `DeploymentCreationFormLocaleEntry`, `DeploymentCreationFormLocaleOption`, `DeploymentCreationFormLocaleLabels`, `DeploymentCreationFormStyles`, `DeploymentCreationFormErrorCodes`, `DeploymentCreationFormValidationOptions`, `DeploymentLocalesFieldProps`. Internal-only helpers (the header and body components inside `BuilderFormContainer`) SHALL NOT be exported from the barrel. The package `libs/builder-form/package.json` SHALL declare `name: "@epam/ai-dial-builder-form"` with `description`, `license: "Apache-2.0"`, an `exports` map with source/types/import/default for `.`, `./package.json`, and `./styles.css`, and peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and `@tabler/icons-react`.

#### Scenario: Consumer imports the library's public surface
- **WHEN** a consumer writes `import { EditorLayout, EditorSection, EditorLayoutProps, EditorLayoutLabels } from '@epam/ai-dial-builder-form'`
- **THEN** the import resolves successfully and every named type is defined

#### Scenario: Internal helper is not part of the public surface
- **WHEN** code outside `libs/builder-form` attempts to import an unexported internal helper from `@epam/ai-dial-builder-form`
- **THEN** the import fails to resolve, since the barrel does not re-export it

### Requirement: No host, routing, i18n, or API dependency
`libs/builder-form/src/**` SHALL NOT import `react-i18next`, `i18next`, `react-router`, `react-router-dom`, any module under `apps/chat/src`, `@epam/ai-dial-chat-api-client`, or any environment/feature-flag/analytics module. All user-visible strings SHALL be supplied via `labels` props with English-language defaults.

#### Scenario: No i18n import
- **WHEN** `libs/builder-form/src/**` is searched for `react-i18next`/`i18next` imports
- **THEN** none are found; all copy is passed via `labels` props

#### Scenario: No routing import
- **WHEN** `libs/builder-form/src/**` is searched for `react-router` imports
- **THEN** none are found; back-navigation is exposed only via `onBack` callback prop

### Requirement: BuilderFormContainer — page shell
`BuilderFormContainer` SHALL render a full-height scrollable page shell: a header (back control, title, cancel/submit action pair, with a `role="status"` region announcing `labels.submittingLabel` while `isSubmitting` is `true`) above a three-column body — `left`, the main column (`children`), and `metadata`. Side columns are full width on mobile and a fixed 360 px on desktop; supplying `left` without `metadata` reserves an empty end column of the same width so the main column stays optically centered. The container SHALL hold no state of its own; all strings, disabled flags, and callbacks are host-supplied.

### Requirement: EditorLayout — header row
`EditorLayout` SHALL render a header row containing:
- A `GhostIconButton` with a left-arrow icon on the inline-start side, labelled by `backAriaLabel` (English default `'Back'`), that calls `onBack` when clicked
- A `title` text rendered as an `h1` heading element
- An `actions` ReactNode slot on the inline-end side, rendered as-is (the host supplies the actual `GhostButton` / `PrimaryButton` instances), visible only at the `desktop` breakpoint and above
- A `role="status"` aria-live polite SR-only region that announces `labels.savingStatusLabel` (default `'Saving'`) when `isSaving` is `true` and an empty string otherwise

The back-button and title portion of the header row SHALL be visible at all viewport widths. The back arrow icon SHALL carry `rtl:scale-x-[-1]` so it mirrors in RTL layouts.

#### Scenario: Back button calls onBack
- **WHEN** a user clicks the back-arrow button in the header
- **THEN** `onBack` is called exactly once

#### Scenario: Actions slot renders host content on desktop
- **WHEN** the host passes `actions={<><GhostButton label="Cancel" /><PrimaryButton label="Save" /></>}` at ≥ desktop width
- **THEN** those two buttons appear in the header's inline-end area

#### Scenario: Saving status is announced
- **WHEN** `isSaving` transitions to `true`
- **THEN** the `role="status"` region's text becomes the `savingStatusLabel` value and screen readers announce it

#### Scenario: Back arrow mirrors in RTL
- **WHEN** `EditorLayout` renders inside a `dir="rtl"` ancestor
- **THEN** the back arrow icon visually points in the reading-direction-correct "back" direction

### Requirement: EditorLayout — mobile/tablet action bar
Below the `desktop` breakpoint, `EditorLayout` SHALL render the same `actions` content in a dedicated bar pinned to the bottom of the page, outside the scrollable body container, instead of in the header. The bar SHALL only render when `actions` is provided, and SHALL NOT overlap `leftContent`/`rightContent` — the scrollable body occupies the remaining vertical space above it via normal flex layout, not absolute/fixed positioning. Each direct child of `actions` SHALL grow to share the bar's width equally (accounting for the bar's padding and inter-button gap). The bar SHALL reverse the DOM order of `actions`' direct children, so the last child (the primary action, e.g. Save/Create) renders at the inline-start side and the first child (e.g. Cancel) renders at the inline-end side — the mirror of the header's inline-end-anchored order — using a writing-mode-aware reversal (`flex-row-reverse`) so the placement stays correct in RTL.

#### Scenario: Actions render in a bottom bar on mobile/tablet
- **WHEN** the host passes `actions` and `EditorLayout` renders below desktop width
- **THEN** the header shows only the back button and title, and the action buttons appear in a bordered bar at the bottom of the page

#### Scenario: Bottom bar does not cover content
- **WHEN** the mobile/tablet action bar is rendered
- **THEN** it occupies its own space in the layout and the scrollable body's content is never hidden underneath it

#### Scenario: No bottom bar when actions are absent
- **WHEN** `actions` is not provided
- **THEN** no bottom bar is rendered on any viewport width

#### Scenario: Primary action renders at the inline-start side
- **WHEN** the host passes `actions={<><NeutralButton label="Cancel" /><PrimaryButton label="Save" /></>}` and `EditorLayout` renders below desktop width
- **THEN** the Save button appears at the inline-start side of the bottom bar and the Cancel button appears at the inline-end side

### Requirement: EditorLayout — two-column responsive body
`EditorLayout` SHALL render its body as a two-column layout on desktop and a single stacked column on mobile:

- **Desktop** (≥ `desktop` breakpoint): `leftContent` occupies a fixed 360 px column on the inline-start side; `rightContent` (when provided) occupies the remaining `flex-1` space, separated by a `border-e` divider. Both columns are independently scrollable via `overflow-y-auto` on the outer body container.
- **Mobile** (below `desktop` breakpoint): `leftContent` renders first (top), `rightContent` renders below it; both span full width. The body container is a single scrollable column.
- When `rightContent` is absent or `undefined`, `leftContent` expands to full width at all viewport sizes.

#### Scenario: Two columns on desktop
- **WHEN** `EditorLayout` renders with both `leftContent` and `rightContent` at ≥ desktop width
- **THEN** the two panels appear side by side, separated by a vertical divider

#### Scenario: Single column on mobile
- **WHEN** `EditorLayout` renders with both `leftContent` and `rightContent` at < desktop width
- **THEN** the two panels stack vertically, `leftContent` on top

#### Scenario: Single-panel mode
- **WHEN** `rightContent` is absent
- **THEN** `leftContent` fills the full available width at all viewport sizes

### Requirement: EditorSection — visual section wrapper
`EditorSection` SHALL render a bordered/card visual region with:
- An optional `title` string rendered as a section heading
- `children` rendered verbatim inside the card body
- Optional `styles?: EditorSectionStyles` for color/typography overrides (following the same `buildCssVars` pattern as other libs)

`EditorSection` SHALL own no state and contain no interactive controls of its own.

#### Scenario: Title renders when provided
- **WHEN** `<EditorSection title="Metadata">…</EditorSection>` renders
- **THEN** the heading "Metadata" appears above the children content

#### Scenario: No title renders when absent
- **WHEN** `<EditorSection>…</EditorSection>` renders without a `title`
- **THEN** no heading element appears and only the children are visible

### Requirement: AddAvatar delegates file selection to the host
`AddAvatar` SHALL render an avatar preview box, an "Add avatar" button, and a format/size caption. It SHALL NOT open a file picker or file manager itself: clicking the button SHALL call the host-supplied `onAddAvatarClick` prop, and the host SHALL report the picked file back through its own state (e.g. `onChange({ iconUrl })` on the surrounding form). When `avatarUrl` is set it fills the preview box instead of the placeholder photo icon; the "Add avatar" button remains visible so the user can replace it.

#### Scenario: Add avatar button delegates to the host
- **WHEN** a user clicks the "Add avatar" button
- **THEN** `AddAvatar` calls `onAddAvatarClick` and does not open any file picker of its own

#### Scenario: Preview box shows the host-resolved URL
- **WHEN** the host passes a non-empty `avatarUrl`
- **THEN** the avatar preview box renders that URL instead of the placeholder photo icon

### Requirement: AvatarPickerModal is host-wired
`AvatarPickerModal` SHALL render the host-supplied `FileManagerModal` component restricted to a single image attachment up to `maxFileSizeBytes`, with `allowedMimeTypes` and `bucket` supplied by the host. It SHALL NOT import a file-manager implementation, talk to a backend, or resolve a storage identifier itself; `onAttach` hands the picked file to the host, which resolves it to a DIAL resource URL and closes the modal. All strings SHALL be pre-translated through `labels`.

### Requirement: Shared general creation form fields
`libs/builder-form` SHALL export a controlled presentation component (`DeploymentCreationForm`) providing the
field set common to Quick App and Toolset creation: avatar, name, description, version, and
topics. The component SHALL accept the current field values, field-level errors, and an
`onChange` callback as props, and SHALL NOT hold its own copy of field state, call any
network API, or trigger submission. The component SHALL NOT render an Intro field.

#### Scenario: Component renders all shared fields
- **WHEN** a host app renders the shared component with a set of values
- **THEN** it displays the avatar picker plus inputs for name, description, version, and
  topics reflecting those values

### Requirement: Avatar field delegates file selection to the host
The icon/avatar field of `DeploymentCreationForm` SHALL render `AddAvatar` — a preview
box plus an "Add avatar" button, exported from the same package — instead of a plain URL text input. The library SHALL NOT open
a file picker or file manager itself: clicking the button SHALL call the host-supplied
`onAddAvatarClick` prop, and the host SHALL report the picked file back through
`onChange({ iconUrl })`. The avatar preview box SHALL render `iconPreviewUrl`, a separate
host-supplied prop — the host resolves this from `values.iconUrl` (which MAY be a DIAL file id
rather than a directly displayable URL); the library itself SHALL NOT resolve storage
identifiers.

#### Scenario: Field edits are reported through onChange
- **WHEN** a user edits any shared field
- **THEN** the component calls `onChange` with a patch containing only the changed field, and
  does not mutate its own internal state

#### Scenario: Passed-in errors are surfaced per field
- **WHEN** a host app passes a field-level error for name or version
- **THEN** the component displays that error next to the corresponding field without
  performing its own validation pass

### Requirement: Shared field validation function
`libs/builder-form` SHALL export a pure `validateDeploymentCreationFields` function that
takes the shared field values and an options object, and returns field-level errors: a
required-name error when name is empty, a name-format error (opt-in via `validateNamePattern`)
when name contains characters outside letters, digits, spaces, underscores, dots, and dashes
(`NAME_PATTERN`), and a version-format error (opt-in via `validateVersionPattern`) for a
non-empty version that fails the applicable version pattern. A non-empty version never produces
a required error. The function SHALL NOT validate an `intro` field. The function SHALL have no
side effects and SHALL NOT depend on i18n, routing, or network state.

`validateVersionPattern` SHALL accept either `true` — checking the non-empty version against the
exported default `VERSION_PATTERN` (letters, digits, dots, underscores, dashes) — or a `RegExp`,
checked instead of the default. The library SHALL also export `SEMVER_VERSION_PATTERN` (one or
more dot-separated numeric segments, e.g. `0.0.1`, `2.0`) as a stricter alternative a host can
pass when it requires a dot-separated numeric version rather than the default permissive
character-set check.

#### Scenario: Valid values produce no errors
- **WHEN** the function is called with a non-empty, correctly formatted name
- **THEN** it returns no error for name

#### Scenario: Name is required
- **WHEN** the function is called with an empty name
- **THEN** it returns a required-field error for name

#### Scenario: Default version pattern check
- **WHEN** the function is called with `validateVersionPattern: true` and a non-empty version
  containing a character outside `VERSION_PATTERN`
- **THEN** it returns a version-format error; a version made only of letters, digits, dots,
  underscores, and dashes (e.g. `abc`) produces no error

#### Scenario: Stricter version pattern override
- **WHEN** the function is called with `validateVersionPattern: SEMVER_VERSION_PATTERN` and a
  non-empty version that is not entirely dot-separated numeric segments (e.g. `abc`)
- **THEN** it returns a version-format error; a version such as `0.0.1` or `2.0` produces no error

#### Scenario: Empty version is never flagged
- **WHEN** the function is called with `validateVersionPattern` set (either `true` or a `RegExp`)
  and an empty version
- **THEN** it returns no error for version

### Requirement: Library isolation boundary
`libs/builder-form` SHALL NOT import `react-i18next`, `@epam/chat-api-client`,
`apps/chat/src/server-api`, routing utilities, browser storage, feature-flag clients, file
manager/upload components, or any DIAL Core/application-specific integration detail. All
display strings SHALL be supplied by the host app through a `labels` prop; all request-body
mapping, network calls, and file-picker wiring SHALL happen in host app-level containers, not
inside the library. `AvatarPickerModal`'s file-manager component is passed in by the host as a
prop, which does not violate this boundary.

#### Scenario: No generated client or i18n imports
- **WHEN** the library's source is inspected
- **THEN** no file under `libs/builder-form/src` imports `@epam/chat-api-client`,
  `react-i18next`, or an application route/path constant

### Requirement: Name and description resolve to plain strings before reaching the library
`libs/builder-form` SHALL only ever receive and operate on plain string values for
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
  passing it to `libs/builder-form`, and the library receives and displays only
  that resolved plain string, regardless of the viewer's own active UI language

### Requirement: Editable additional-locale entries for name and description
`libs/builder-form` SHALL export a `DeploymentLocalesField` component and an
`otherLocales` array field on `DeploymentCreationFormValues`, allowing a host app to present a
summary of which additional locales have translated name/description values and to open a popup
for adding, editing, and deleting per-locale name/description entries (language, name,
description) alongside the single active-locale name/description fields. The component SHALL
follow the same controlled, host-supplied-labels pattern as the rest of the shared form: it
SHALL NOT hold authoritative state beyond the open/closed popup, SHALL report changes to
`otherLocales` through `onChange`, and SHALL NOT itself call any network API or persist
anything — composing the entered locale entries back into a DIAL Core locale map for saving is
the host app's responsibility. The link that opens the popup SHALL show the host-supplied
`labels.addLabel` (e.g. "Add locales") while `otherLocales` is empty, and switch to
`labels.editLabel` (e.g. "Edit locales") once at least one entry exists.

#### Scenario: Summary reflects the configured additional locales
- **WHEN** `otherLocales` contains entries for one or more locales
- **THEN** the summary row displays each entry's locale code next to the "Locales" label, e.g.
  `Locales: [FR], [UA]`, and the link to open the popup reads `labels.editLabel`

#### Scenario: Popup-opening link reads "Add locales" before any locale exists
- **WHEN** `otherLocales` is empty
- **THEN** the link that opens the popup shows `labels.addLabel` instead of `labels.editLabel`

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

### Requirement: RTL and accessibility
`EditorLayout`, `EditorSection`, `AddAvatar`, and `BuilderFormContainer` SHALL use CSS logical properties (`padding-inline-start/end`, `margin-inline-start/end`, `border-inline-start/end`) and Tailwind logical utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `border-s-*`, `border-e-*`) for all directional spacing. The back-arrow icons SHALL carry `aria-hidden`; their accessible names come from `GhostIconButton`'s `aria-label`. The `title` heading SHALL be an `h1`. The `actions` slot content is owned entirely by the host and is not wrapped in any additional landmark by `EditorLayout`.

#### Scenario: No physical direction Tailwind classes
- **WHEN** `libs/builder-form/src/**` is searched for `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `border-l-`, `border-r-`, `text-left`, `text-right`
- **THEN** none are found (except where an explicit `rtl:` counterpart is placed alongside)

#### Scenario: Back icon is aria-hidden
- **WHEN** `EditorLayout` renders
- **THEN** the `IconArrowLeft` inside the back button carries `aria-hidden`, and the button's accessible name comes from `aria-label={backAriaLabel}`
