## ADDED Requirements

### Requirement: The desktop topic filter is an icon button that applies on toggle

`Filter` (`libs/catalog/src/components/Filter/Filter.tsx`) SHALL render a kit `GhostIconButton` (`ElementSize.Large`, `IconFilter2` with `stroke={DIAL_KIT_ICON_STROKE}`) as its trigger:

- It is named by `triggerLabel` (default 'Filter by topic') and carries `aria-haspopup="dialog"` and `aria-expanded`.
- It shows no text label.
- While at least one topic is applied, a decorative dot (`aria-hidden`) sits on its top-end corner. The dot's colour is `FilterColors.activeDot` through `--cat-filter-active-dot`, with the fallback `--bg-control-accent`.

The overlay SHALL be a kit `Dropdown` with `DropdownOverlayRole.Dialog`, named by `topicsLabel`:

- Its header row holds the `topicsLabel` heading (default 'Topics', class from `typography.filterSectionLabelClassName`, default `'dial-tiny-lead-semi-text'`) and, at the inline end, a kit `LinkButton` labelled `clearAllLabel` (default 'Clear all'). The button is disabled while no topic is applied.
- Below the header, a `role="menu"` list holds one `menuitemcheckbox` row per topic, in sorted order. The list scrolls on its own while the header stays fixed.

Toggling a row SHALL call `onChange` at once with the new set, and the dropdown stays open. "Clear all" SHALL call `onChange(new Set())`, and the dropdown stays open.

The overlay SHALL have no footer and no Apply or Clear buttons. A press outside the overlay, or Escape, closes it and returns focus to the trigger.

Keyboard behaviour:

- ArrowDown on the closed trigger opens the dropdown.
- Focus moves to the first row once the dropdown is open.
- ArrowUp and ArrowDown move between rows with a roving tab index.
- Tab reaches "Clear all" in the header.

`FilterProps` SHALL drop `isMyAppsActive`, `onMyAppsChange`, `myAppsLabel`, `defaultLabel`, `clearLabel` and `applyLabel`, and add `triggerLabel` and `clearAllLabel`. `getFromLabel` SHALL be removed from `libs/catalog/src/utils/catalog-filter.ts`.

Colours keep the existing `--cat-filter-*` custom properties for the overlay, rows and section label. The `buttonLabel`, `buttonChevron`, `buttonBorder*`, `buttonBackground`, `divider` and `footerBorder` fields are removed with the pill and the footer, and `activeDot` is added.

RTL impact: the "Clear all" button sits at the inline end, through flex and `ms-auto`, and the dot uses `inset-e-*`. The filter icon is not directional.

#### Scenario: Checking a topic applies it immediately

- **WHEN** the user opens the filter and checks "Business"
- **THEN** `onChange` is called with `Set {'Business'}`, the listing narrows at once, and the dropdown stays open

#### Scenario: Clicking outside closes the list

- **WHEN** the dropdown is open and the user presses on the page outside it
- **THEN** the dropdown closes and the applied topics are unchanged

#### Scenario: Clear all in the header empties the selection

- **WHEN** two topics are applied and the user activates "Clear all" in the dropdown header
- **THEN** `onChange` is called with an empty set

#### Scenario: The trigger flags an applied filter

- **WHEN** a topic is applied
- **THEN** the trigger, named "Filter by topic", shows the active dot and renders no text

### Requirement: Applied topics render as removable tags

`AppliedTopicTags` (`libs/catalog/src/components/AppliedTopicTags/AppliedTopicTags.tsx`) SHALL render nothing while no topic is applied.

Otherwise it SHALL render a `role="group"`, named by `appliedTopicsLabel` (default 'Applied topics'), that holds:

- one closable kit `Tag` per applied topic, in sorted order, whose remove button is named `formatRemoveTopicLabel(topic)` (default `` `Remove ${topic}` ``);
- while three or more topics are applied (`CLEAR_ALL_TAG_THRESHOLD = 3`), a trailing kit `LinkButton` labelled `clearAllLabel` that clears every topic.

Removing a tag SHALL call `onChange` without that topic and move focus as follows:

- to the next tag;
- if there is none, to the previous tag;
- if there is none, to the element given by `fallbackFocusRef`, which is the filter trigger in the toolbar.

`TitleRow` (`libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`) SHALL render `AppliedTopicTags` directly below the search row at every breakpoint, phone included. `CatalogPickerModal` SHALL render it below its own search row.

The tag row wraps onto further lines with logical gaps (`gap-2`).

RTL impact: the row is a wrapping flex row and mirrors under `dir="rtl"`. The kit `Tag` places its remove button at the inline end.

#### Scenario: Two topics show two tags and no Clear all

- **WHEN** "Business" and "Compliance, Legal & Tax" are applied
- **THEN** two tags render below the search, and no "Clear all" button follows them

#### Scenario: Three topics add Clear all

- **WHEN** a third topic, "Deep Research", is applied
- **THEN** a "Clear all" button follows the three tags, and activating it removes every topic

#### Scenario: Removing a tag clears that topic

- **WHEN** the user activates "Remove Business"
- **THEN** "Business" is no longer applied, the listing widens, and focus moves to the next tag

#### Scenario: Removing the last tag returns focus to the filter trigger

- **WHEN** one topic is applied and the user removes its tag
- **THEN** the tag row disappears and focus moves to the "Filter by topic" button

### Requirement: CatalogPickerModal uses the same topic filter and tags

`CatalogPickerModal` (`libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`) SHALL render the new `Filter`, which applies on toggle and has no "My" row, next to its search, and `AppliedTopicTags` below its search.

`CatalogPickerModalLabels` SHALL gain `filter?` (default 'Filter by topic'), `clearAll?` (default 'Clear all'), `appliedTopics?` (default 'Applied topics') and `formatRemoveTopic?: (topic: string) => string`.

#### Scenario: A picker filter applies without Apply

- **WHEN** the user checks a topic in the `AddOnCatalogModal` filter
- **THEN** the list narrows immediately and a tag for that topic appears below the search

### Requirement: The host translates the topic filter texts

`CatalogTitles` (`libs/catalog/src/models/catalog-props.ts`) SHALL carry `filterLabel`, `filterClearAllLabel`, `appliedTopicsLabel` and `formatRemoveTopicLabel`, and drop `filterFromLabel` and `filterMyAppsLabel`.

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL fill them with these translation keys:

- `catalog.filter.label` ("Filter by topic");
- `catalog.filter.clearAll` ("Clear all");
- `catalog.filter.appliedTags` ("Applied topics");
- `catalog.filter.removeTag` ("Remove {{topic}}").

The translation keys `catalog.browseSettings.from` and `catalog.browseSettings.my` SHALL be removed from `apps/chat/src/i18n/locales/en.json` and from `CatalogI18nKeys` (`apps/chat/src/constants/i18n-keys/catalog.ts`).

Feature flag: none.

#### Scenario: Translated remove label

- **WHEN** `CatalogView` renders with "Business" applied
- **THEN** the tag's remove button is named by `catalog.filter.removeTag` interpolated with "Business"
