# builder-form Specification

## Purpose
Specifies `libs/builder-form`'s host-agnostic builder/editor form building blocks: the `BuilderFormContainer` page shell, the `EditorLayout`/`EditorSection` two-column editor layout, the `AddAvatar`/`AvatarPickerModal` avatar controls, and the `DeploymentCreationForm`/`DeploymentLocalesField` shared General-step field set with its validation — public package surface, host-isolation boundary (no i18n/routing/API knowledge), responsive layout behaviour, RTL/accessibility support, and the host/library division of responsibility shared by the scheduled-task, prompt, skill, toolset, Quick App, and Custom App editors.
## Requirements
### Requirement: Public package surface
`libs/builder-form/src/index.ts` SHALL export `BuilderFormContainer`, `EditorLayout`, `EditorSection`, `AddAvatar`, `AvatarPickerModal`, `DeploymentCreationForm`, `DeploymentLocalesField`, `EntityEditor`, `MetadataForm`, `useMetadataForm`, `MetadataField`, `validateDeploymentCreationFields` with its patterns (`NAME_PATTERN`, `VERSION_PATTERN`, `SEMVER_VERSION_PATTERN`), `DeploymentCreationFieldErrorCode`, the `BUILDER_FORM_CLASS` public class-name map, `DEFAULT_METADATA_FORM_LABELS`, and every TypeScript type reachable through their props: `BuilderFormContainerProps`, `BuilderFormContainerStyles`, `BuilderFormContainerColors`, `BuilderFormActionsLabels`, `BuilderFormHeaderLabels`, `BuilderFormHeaderStyles`, `BuilderFormHeaderColors`, `BuilderFormHeaderTypography`, `EditorLayoutProps`, `EditorLayoutLabels`, `EditorLayoutStyles`, `EditorLayoutColors`, `EditorSectionProps`, `EditorSectionStyles`, `EditorSectionColors`, `AddAvatarProps`, `AddAvatarColors`, `AddAvatarStyles`, `AvatarPickerModalProps`, `AvatarPickerModalLabels`, `AvatarPickerFileManagerModalProps`, `DeploymentCreationFormProps`, `DeploymentCreationFormValues`, `DeploymentCreationFormLabels`, `DeploymentCreationFormFieldLabels`, `DeploymentCreationFormIconLabels`, `DeploymentCreationFormFieldErrors`, `DeploymentCreationFormLocaleEntry`, `DeploymentCreationFormLocaleOption`, `DeploymentCreationFormLocaleLabels`, `DeploymentCreationFormStyles`, `DeploymentCreationFormErrorCodes`, `DeploymentCreationFormValidationOptions`, `DeploymentLocalesFieldProps`, `EntityEditorProps`, `EntityEditorLabels`, `EntityEditorStyles`, `MetadataFormProps`, `MetadataFormLabels`, `MetadataFormAvatarPicker`, `UseMetadataFormOptions`, `UseMetadataFormResult`. Internal-only helpers (the header and body components inside `BuilderFormContainer`) SHALL NOT be exported from the barrel. The package `libs/builder-form/package.json` SHALL declare `name: "@epam/ai-dial-builder-form"` with `description`, `license: "Apache-2.0"`, an `exports` map with `./package.json`, `./styles.css` (`./dist/index.css`), and `.` (source/types/import/default), peer dependencies on `react`, `@epam/ai-dial-ui-kit`, and `@epam/ai-dial-chat-shared`, and `@tabler/icons-react` as a regular dependency.

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
`BuilderFormContainer` SHALL render a full-height, non-scrolling page shell: a header (back control, title, cancel/submit action pair shown at desktop only, while a sticky bottom footer holds the same pair below desktop, with a `role="status"` region announcing `labels.submittingLabel` while `isSubmitting` is `true`) above a three-column body — `left`, the main column (`children`), and `metadata`. The header SHALL use the same responsive padding as the scheduled-task detail header: `px-4 py-2` below desktop and `px-8 py-0` with a 64 px height at desktop. On mobile the stacked body SHALL own the single vertical scrollbar. On desktop the body SHALL be a non-wrapping clipped row and each populated column SHALL scroll independently, keeping the page root and header fixed. Side columns are full width on mobile and a fixed 400 px on desktop; supplying `left` without `metadata` reserves an empty end column of the same width so the main column stays optically centered. An optional `layout` prop (`sideColumnWidth`, default `'400px'`; `columnGap`, default `'0px'`; `reserveEndColumn`, default `true`) overrides that sizing. The container SHALL hold no state of its own; all strings, disabled flags, and callbacks are host-supplied.

#### Scenario: Default responsive shell

- **WHEN** a host provides left content and main children without layout overrides
- **THEN** side columns span the available width below 1280px and occupy 400px from 1280px, with a matching reserved end column when metadata is absent
- **AND** the mobile body owns one scrollbar while desktop left/main columns scroll independently without moving the header
- **AND** the header and mobile footer expose one visible action pair at their respective breakpoints, independent of host utility CSS.

### Requirement: EditorLayout — header row
`EditorLayout` SHALL render a header row containing:
- A `GhostIconButton` with an `IconArrowNarrowLeft` icon on the inline-start side, labelled by `backAriaLabel` (English default `'Back'`), that calls `onBack` when clicked
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

- **Desktop** (≥ `desktop` breakpoint): `leftContent` occupies a fixed 400 px column on the inline-start side; `rightContent` (when provided) occupies the remaining `flex-1` space, separated by a `border-e` divider. The body container is `overflow-hidden` and each column scrolls independently through its own `overflow-y-auto`.
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

#### Scenario: Host handles a selected image

- **WHEN** the supplied file manager reports a selected image within the host-provided restrictions
- **THEN** the modal forwards the attachment to the host callback, and the host owns URL resolution and closing the modal.

### Requirement: Shared general creation form fields
`libs/builder-form` SHALL export a controlled presentation component (`DeploymentCreationForm`) providing the
field set common to Quick App and Toolset creation: avatar, name, description, version, and
topics. The component SHALL accept the current field values, field-level errors, and an
`onChange` callback as props, and SHALL NOT hold its own copy of field state, call any
network API, or trigger submission. The component SHALL NOT render an Intro field.

`DeploymentCreationFormFieldErrors` SHALL carry optional `name`, `version` and `description`
messages, already translated by the host. Each one SHALL render inline under its field
through the kit field's `error`/`invalid` props.

#### Scenario: Component renders all shared fields
- **WHEN** a host app renders the shared component with a set of values
- **THEN** it displays the avatar picker plus inputs for name, description, version, and
  topics reflecting those values

#### Scenario: Description error renders under the description field
- **WHEN** the host passes `errors.description`
- **THEN** the Description textarea is marked invalid and shows that message beneath it

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
exported default `VERSION_PATTERN` (letters, digits, dots, underscores, dashes) — or a `RegExp`,
checked instead of the default. The library SHALL also export `SEMVER_VERSION_PATTERN` (a
SemVer 2.0.0 version: `MAJOR.MINOR.PATCH` without leading zeros, with an optional pre-release
and build metadata, e.g. `1.0.0`, `1.0.0-beta.1`, `1.0.0+build.5`) as a stricter alternative a
host can pass when it requires the version rule DIAL Admin applies (`semver.valid()`) rather
than the default permissive character-set check.

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
- **THEN** it returns a version-format error; a version made only of letters, digits, dots,
  underscores, and dashes (e.g. `abc`) produces no error

#### Scenario: Stricter version pattern override
- **WHEN** the function is called with `validateVersionPattern: SEMVER_VERSION_PATTERN` and a
  non-empty version that is not SemVer 2.0.0 (e.g. `abc`, `1.2`, `1.0.0.0`, `01.0.0`)
- **THEN** it returns a version-format error; a version such as `0.0.1`, `1.0.0-beta` or
  `1.0.0+build` produces no error

#### Scenario: Empty version is never flagged
- **WHEN** the function is called with `validateVersionPattern` set (either `true` or a `RegExp`)
  and an empty version
- **THEN** it returns no error for version

### Requirement: Library isolation boundary
`libs/builder-form` SHALL NOT import `react-i18next`, `@epam/ai-dial-chat-api-client`,
`apps/chat/src/server-api`, routing utilities, browser storage, feature-flag clients, file
manager/upload components, or any DIAL Core/application-specific integration detail. All
display strings SHALL be supplied by the host app through a `labels` prop; all request-body
mapping, network calls, and file-picker wiring SHALL happen in host app-level containers, not
inside the library. `AvatarPickerModal`'s file-manager component is passed in by the host as a
prop, which does not violate this boundary.

#### Scenario: No generated client or i18n imports
- **WHEN** the library's source is inspected
- **THEN** no file under `libs/builder-form/src` imports `@epam/ai-dial-chat-api-client`,
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

`availableLocaleOptions` SHALL govern whether the control exists at all. Its default is an empty
list, and with an empty list `DeploymentLocalesField` SHALL render nothing — no summary row, no
popup-opening link. A popup with no selectable language could never be satisfied: every row
requires both a language and a name before Save enables, so the field would offer a control whose
Save is permanently disabled, with the Language dropdown showing only its own "No options
available" empty state and no way for the user to make the form valid. Hiding the control SHALL NOT
call `onChange`, so any `otherLocales` entries the host loaded from an existing entity survive
unmodified and are written back untouched on the next save.

Within the popup, both the per-locale language and the per-locale name SHALL be marked required
through the ui-kit `Label`'s own `required` prop (which renders the asterisk plus a visually hidden
"(required)"), the same mechanism the primary Name field in `DeploymentCreationForm` uses — not a
hand-rolled `aria-hidden` asterisk, which marks the field visually but leaves the requirement
unannounced. A new row SHALL pre-select the first language not already used by another row, so a
row is never seeded into the invalid state the required marker describes.

The language control SHALL be wide enough to show a full BCP-47 tag (`EN-US`, `PT-BR`) without
truncation. Below the `desktop` breakpoint the language and name controls SHALL stack to one column
rather than share a row, so widening the language control does not squeeze the name field on a
phone.

#### Scenario: Summary reflects the configured additional locales
- **WHEN** `otherLocales` contains entries for one or more locales
- **THEN** the summary row displays each entry's locale code next to the "Locales" label, e.g.
  `Locales: [FR], [UA]`, and the link to open the popup reads `labels.editLabel`

#### Scenario: Popup-opening link reads "Add locales" before any locale exists
- **GIVEN** `availableLocaleOptions` is non-empty
- **WHEN** `otherLocales` is empty
- **THEN** the link that opens the popup shows `labels.addLabel` instead of `labels.editLabel`

#### Scenario: The whole control is absent when no language can be picked
- **WHEN** `DeploymentLocalesField` renders with an empty (or omitted) `availableLocaleOptions`
- **THEN** it renders nothing at all — no summary row and no popup-opening link — rather than a
  link onto a popup whose Save can never enable

#### Scenario: Hiding the control preserves already-stored locales
- **GIVEN** `otherLocales` holds entries loaded from an existing entity and `availableLocaleOptions`
  is empty
- **WHEN** the field renders and the host then saves
- **THEN** the control is absent, `onChange` is never called, and those entries are written back
  unchanged

#### Scenario: Language and name are both marked required
- **WHEN** a user opens the popup
- **THEN** each row's language and name controls are labelled as required, with the requirement
  exposed to assistive technology and not only as a visual asterisk

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
- **THEN** the popup pre-seeds one row, with the first available language pre-selected and an
  empty name and description, instead of showing an empty list that requires clicking
  "Add locale" first

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
accept an optional `styles` prop (`DeploymentCreationFormStyles`: `root` and `field` class names) for per-slot style overrides, without requiring host apps
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
- **THEN** the `IconArrowNarrowLeft` inside the back button carries `aria-hidden`, and the button's accessible name comes from `aria-label={backAriaLabel}`

### Requirement: Builder form back icon is a supported composition option

BuilderFormHeader and its containing public shell SHALL accept and forward optional backIcon. Undefined SHALL preserve the generic default, null SHALL omit the decorative icon, and a supplied ReactNode SHALL render without DOM interception. Existing labels/actions/styles SHALL remain compatible.

#### Scenario: A feature supplies its own back icon

- **WHEN** ScheduledTaskCreateForm supplies IconArrowNarrowLeft through the shell
- **THEN** the header renders it and preserves the existing back callback and accessible name.

#### Scenario: Legacy editors retain the default

- **WHEN** another editor does not provide backIcon
- **THEN** its header icon and navigation behavior remain unchanged.

#### Scenario: Directional defaults mirror in RTL

- **WHEN** a built-in back arrow renders under dir=rtl
- **THEN** it mirrors while preserving keyboard focus and its accessible label.

### Requirement: EntityEditor — the standard entity editor layout

`@epam/ai-dial-builder-form` SHALL export `EntityEditor`, with its props types `EntityEditorProps`, `EntityEditorLabels` and `EntityEditorStyles`. It composes `EditorLayout` into the standard entity editor.

**Header**

- A back arrow calling `onBack`.
- An `<h1>` showing `title`.
- In the `actions` slot, in this order:
  1. `extraActions`, when provided.
  2. A `NeutralButton` Cancel (`labels.cancelLabel`, default `'Cancel'`) calling `onCancel`.
  3. A `PrimaryButton` (`submitLabel`) calling `onSubmit`.
- When `hideStandardActions` is `true`, Cancel and the primary button SHALL NOT render, and only `extraActions` remain.
- The primary button and Cancel SHALL be disabled while `isSubmitting`. The primary button SHALL additionally be disabled while `isSubmitDisabled`.
- `isSubmitting` SHALL be forwarded to `EditorLayout.isSaving`.

**Left column (`leftContent`)**

- An `EditorSection` titled `metadataTitle ?? labels.metadataTitle` (default `'Metadata'`) that contains `metadata`; `metadataTitle={null}` renders the section without a heading.
- When `setup` is absent, `alert` (wrapped in `role="alert"`) renders above that section instead.
- `metadataFooter`, when provided, below that section.

**Right column (`rightContent`)**

- When `setup` is provided: `alert` (wrapped in `role="alert"`, when provided), then an `EditorSection` titled `setupTitle ?? labels.setupTitle` (default `'Setup'`) that contains `setup`.
- When `setup` is absent, `rightContent` SHALL be omitted so the left column fills the width.

Mobile behaviour (sections stacked, Metadata first, actions in the bottom bar) is inherited from `EditorLayout`.

`metadataSectionClassName` and `setupSectionClassName` SHALL be added to the respective section roots, so an embedding editor keeps its own public classes.

`EntityEditor` SHALL hold no state and SHALL NOT import i18n, routing or any host API. Every string has an English default and is overridable through props.

#### Scenario: Screenshot layout at desktop width
- **WHEN** `EntityEditor` renders with `title="Create toolset"`, `submitLabel="Create"`, a `metadata` node and a `setup` node at desktop width
- **THEN** the header shows a back button, the "Create toolset" heading, and Cancel and Create buttons at the inline end
- **AND** a "Metadata" `<h2>` section renders in the 400 px left column
- **AND** a "Setup" `<h2>` section renders in the right column

#### Scenario: Extra actions and preview mode
- **WHEN** `extraActions` holds a Preview button and `hideStandardActions` is `true`
- **THEN** only the Preview button renders in the header actions

#### Scenario: Metadata-only editor
- **WHEN** `setup` is not provided
- **THEN** no right column renders and the Metadata section spans the available width

#### Scenario: Submit disabled only by external state
- **WHEN** `isSubmitDisabled` is `false` and `isSubmitting` is `false`
- **THEN** the primary button is enabled, whatever validation state the host holds

### Requirement: MetadataForm — shared Metadata field set with field visibility

`@epam/ai-dial-builder-form` SHALL export `MetadataForm`, with `MetadataFormProps`, `MetadataFormLabels` and the string enum `MetadataField` (members `Avatar`, `Name`, `Version`, `Description`, `Locales`, `Tags`).

`MetadataForm` renders `DeploymentCreationForm` plus `AvatarPickerModal`. It takes `values`, `errors`, `onChange`, `onNameBlur`, `onVersionBlur`, `availableLocaleOptions`, and `labels` with optional `form` and `avatarPicker` groups.

The avatar picker is configured by one optional `avatarPicker` prop (`MetadataFormAvatarPicker`), whose fields are all host-injected: `bucket`, `FileManagerModal`, `resolveIconUrl` (preview URL for the current icon), `resolveAttachedIconUrl(result: AttachResult) => string | undefined` (the icon URL for a picked file), `allowedMimeTypes` and `maxFileSizeBytes`. The lib SHALL NOT build DIAL storage paths or import `@epam/ai-dial-chat-hooks`; turning a picked file into a URL is the host's job.

It adds the following props:

- `fields?: MetadataField[]`. The default is all six fields. The fields render in the fixed order Avatar, Name + Version (side by side), Description, Locales, Tags. A field absent from `fields` SHALL NOT render. When Version is absent, Name takes the full row.
- `isNameReadOnly?: boolean`, which renders Name read-only.
- `nameCaption?: string`, helper text under Name.
- `isDescriptionRequired?: boolean`, which marks Description required.
- `errors.description?: string`.
- `renderDescription?: (textarea: ReactNode, fieldId: string) => ReactNode`, which wraps the Description textarea (for example in a label row with an AI refine action). When it is set, the textarea SHALL render without its own label, and the wrapper labels the control whose id is `fieldId`.

The Avatar field SHALL render only when `fields` includes `MetadataField.Avatar` and `avatarPicker` is provided. When `resolveAttachedIconUrl` returns `undefined`, the icon SHALL stay unchanged.

`DeploymentCreationForm` SHALL accept the same `fields`, `isNameReadOnly`, `nameCaption`, `isDescriptionRequired` and `renderDescription` options, and SHALL extend `DeploymentCreationFormFieldErrors` with `description?`. On an error transition, focus-first-invalid SHALL consider Name, then Version, then Description.

The default Tags placeholder SHALL be `'Add tags, comma separated'`.

#### Scenario: Prompt-style metadata
- **WHEN** `MetadataForm` renders with `fields={[MetadataField.Name, MetadataField.Description]}` and no `avatarPicker`
- **THEN** only Name and Description render, Name spans the full row, and no avatar, version, locales or tags controls exist in the DOM

#### Scenario: Default renders the full screenshot field set
- **WHEN** `MetadataForm` renders without `fields`
- **THEN** Avatar ("Add avatar", "PNG, JPG or SVG (max 1 MB)"), Name* with Version on the same row, Description, Locales and Tags ("Add tags, comma separated") render in that order

#### Scenario: Picked avatar is resolved by the host
- **WHEN** the user picks a file in the avatar picker and `avatarPicker.resolveAttachedIconUrl` returns `'files/b/icon.png'`
- **THEN** `onChange({ iconUrl: 'files/b/icon.png' })` is called and the picker closes

#### Scenario: Host wraps the Description field
- **WHEN** `MetadataForm` renders with `renderDescription` returning a label for `fieldId`, a Refine button and the textarea
- **THEN** the textarea is named by the host label, the Refine button renders beside it, and the default Description label does not render

#### Scenario: Description error receives focus when it is the only invalid field
- **WHEN** `errors` changes from empty to `{ description: 'Description is required' }`
- **THEN** focus moves to the Description textarea

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
- **WHEN** the hook is configured with `validateVersionPattern: SEMVER_VERSION_PATTERN` and the version is `1.0-beta`
- **THEN** `errorCodes.version` is the invalid-version code
