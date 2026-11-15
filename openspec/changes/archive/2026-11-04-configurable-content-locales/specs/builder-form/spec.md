## MODIFIED Requirements

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

A **retained** entry is an entry in `value` whose `language` is not the `code` of any
`availableLocaleOptions` item — typically a translation stored under a code the host no longer
configures. Retained entries SHALL be derived by the component from `value`; the host SHALL NOT
have to pass them separately. A retained entry SHALL be rendered like any other row, with its
language select listing that entry's own code (labelled through `formatLocaleLabel`) as the
selected option in addition to `availableLocaleOptions`; the author MAY edit its name and
description, switch it to a configured language, or delete it. A retained code SHALL NOT be
listed in any other row's language select and SHALL NOT be pre-selected for a new row, so it can
be kept or removed but never newly added.

`DeploymentLocalesField` SHALL accept an optional `formatLocaleLabel?: (code: string) => string`
prop, defaulting to `code.toUpperCase()`, used to label retained codes; `DeploymentCreationForm`
and `MetadataForm` SHALL accept and forward the same prop. Labels for configured codes still come
from each option's `label`. The summary row SHALL show each entry's code uppercased
(`[DE]`, `[PT-BR]`), independent of option labels, so it stays compact when a host supplies
full language names.

`availableLocaleOptions` together with `value` SHALL govern whether the control exists at all.
`availableLocaleOptions` defaults to an empty list. When `availableLocaleOptions` is empty **and**
`value` holds no retained entry, `DeploymentLocalesField` SHALL render nothing — no summary row, no
popup-opening link. A popup with no selectable language and no existing row could never be
satisfied: every row requires both a language and a name before Save enables, so the field would
offer a control whose Save is permanently disabled. When `value` holds a retained entry the
control SHALL render even if `availableLocaleOptions` is empty, so the author can still see, edit,
or delete that translation. In every case, rendering or hiding the control SHALL NOT call
`onChange`, so `otherLocales` entries the host loaded from an existing entity — retained ones
included — survive unmodified and are written back untouched on the next save unless the author
changes them in the popup.

The popup's "Add locale" action SHALL be disabled when every `availableLocaleOptions` code is
already used by a row in the popup (retained rows do not count toward that limit), including when
`availableLocaleOptions` is empty.

Within the popup, both the per-locale language and the per-locale name SHALL be marked required
through the ui-kit `Label`'s own `required` prop (which renders the asterisk plus a visually hidden
"(required)"), the same mechanism the primary Name field in `DeploymentCreationForm` uses — not a
hand-rolled `aria-hidden` asterisk, which marks the field visually but leaves the requirement
unannounced. A new row SHALL pre-select the first configured language not already used by another
row, so a row is never seeded into the invalid state the required marker describes.

The language control SHALL be wide enough to show a full BCP-47 tag (`EN-US`, `PT-BR`) without
truncation. Below the `desktop` breakpoint the language and name controls SHALL stack to one column
rather than share a row, so widening the language control does not squeeze the name field on a
phone.

#### Scenario: Summary reflects the configured additional locales
- **WHEN** `otherLocales` contains entries for one or more locales
- **THEN** the summary row displays each entry's locale code uppercased next to the "Locales" label,
  e.g. `Locales: [FR], [UA]`, and the link to open the popup reads `labels.editLabel`

#### Scenario: Summary shows codes even when options carry language names
- **WHEN** `availableLocaleOptions` is `[{ code: 'de', label: 'Deutsch' }]` and `otherLocales`
  holds a `de` entry
- **THEN** the summary reads `Locales: [DE]`

#### Scenario: Popup-opening link reads "Add locales" before any locale exists
- **GIVEN** `availableLocaleOptions` is non-empty
- **WHEN** `otherLocales` is empty
- **THEN** the link that opens the popup shows `labels.addLabel` instead of `labels.editLabel`

#### Scenario: The whole control is absent when no language can be picked
- **WHEN** `DeploymentLocalesField` renders with an empty (or omitted) `availableLocaleOptions`
  and no retained entry in `value`
- **THEN** it renders nothing at all — no summary row and no popup-opening link — rather than a
  link onto a popup whose Save can never enable

#### Scenario: Untouched entries are written back unchanged
- **GIVEN** `otherLocales` holds entries loaded from an existing entity
- **WHEN** the field renders and the host saves without the author opening the popup
- **THEN** `onChange` is never called and those entries are written back unchanged

#### Scenario: A retained entry keeps the control visible
- **GIVEN** `availableLocaleOptions` is empty and `otherLocales` holds an `it` entry
- **WHEN** the field renders
- **THEN** the summary row `Locales: [IT]` and the `labels.editLabel` link are shown, and the
  popup's "Add locale" action is disabled

#### Scenario: A retained entry is labelled through formatLocaleLabel and cannot be re-added
- **GIVEN** `availableLocaleOptions` is `[{ code: 'de', label: 'Deutsch' }]`, `otherLocales` holds
  an `it` entry, and `formatLocaleLabel` maps `it` to `italiano`
- **WHEN** the author opens the popup and adds a row
- **THEN** the `it` row's language select shows `italiano` as selected, and the new row's select
  lists only `Deutsch`

#### Scenario: Deleting a retained entry
- **GIVEN** `otherLocales` holds a retained `it` entry
- **WHEN** the author deletes that row and saves the popup
- **THEN** `onChange` is called with an `otherLocales` array without the `it` entry, and if no
  configured option and no other entry remains the control is no longer rendered

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
