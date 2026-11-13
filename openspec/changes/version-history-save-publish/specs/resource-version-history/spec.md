# Spec Delta

## Purpose

Lets a user see, inside the Save and Publish panels, the saved versions of an application or toolset, which of them is being edited and whether each is published.

## ADDED Requirements

### Requirement: A Versions history section closes the Save and Publish panels

The Save panel and the Publish panel of a versioned resource (Quick App, custom app, schema app, toolset) SHALL render a **Versions history** section as the last section of the panel body, as in the product mockups. Prompts and skills are not versioned and SHALL render no such section. The section SHALL offer no action: no open, restore, delete, compare or alias action. There SHALL be no separate history view and no link that opens one.

#### Scenario: Save panel shows the section
- **WHEN** the Save panel opens for a toolset
- **THEN** a Versions history section is the last section of the panel body

#### Scenario: Publish panel shows the section
- **WHEN** the Publish panel opens for an application
- **THEN** a Versions history section is the last section of the panel body

#### Scenario: Unversioned resource
- **WHEN** either panel opens for a prompt or a skill
- **THEN** no Versions history section is rendered

### Requirement: The history lists the other saved versions of the resource in its folder

The section SHALL list the items of the already-loaded deployments or toolsets listing that share the edited resource's `versionGroupId` and have `isMy === true`, without the version being edited or published: that version is not listed and no row carries a marker for it. When no other version remains, the host SHALL render no Versions history section at all (no heading, no empty message) and SHALL request no status. It SHALL make no extra DIAL Core call for the list, and no client SHALL parse `__` out of an id. Versions saved to other folders SHALL NOT be listed. The displayed version SHALL come from `displayVersion`, not from the id suffix. Rows SHALL be sorted by last modified date (`updatedAt`), newest first, never by version.

Each row SHALL show:

- the version;
- the publication status: **Not published**, **In review** or **Published** (with the target folders);
- the folder, with the kit folder icon: `Personal` at the root of the Personal root, otherwise the folder path, formatted like the Save panel's destination (root label and segments joined with " / ");
- the last modified date, as `12 Jul 2026` (day, short month, year) for English;
- the author: for a Published version, the publisher ("Published by {name}"); otherwise the version's `owner` from the listing ("by {name}"), omitted when the listing has none.

The first line holds the version and the status badge, with the date at the far end; the second line holds the folder and the author at the far end; a Published version adds a third line "Published in {folders}", aligned to the end under the author, with its target folders, so the badge stays short. The host formats that line (translation and list separator), like the folder, date and author, and the section only renders the string it is given. Version and date use 14px text, the other lines 12px secondary text, from the kit type scale. A version that does not fit stays on one line, cut with an ellipsis, and the kit ellipsis tooltip shows the whole version on hover and focus.

#### Scenario: Rows and order without the open version
- **WHEN** the section renders for application `Design Review Agent` that has versions `1.0.0` (updated 12 Jul), `beta-2` (updated 20 Jul) and `1.1.0` (updated 01 Jul), and `1.0.0` is being edited
- **THEN** the rows are `beta-2` and `1.1.0`, and `1.0.0` is not listed

#### Scenario: Only one version
- **WHEN** a panel opens for a resource whose version group holds no other version
- **THEN** no Versions history section is rendered and no status request is made

#### Scenario: Folder is shown as a path
- **WHEN** the resource lives in Personal folder `Design / Audit`
- **THEN** each row's folder reads `Personal / Design / Audit`; a resource at the Personal root reads `Personal`

#### Scenario: Author of a published and an unpublished version
- **WHEN** version `1.0.0` is Published by `Jane Doe` and `beta-2` is not published and has owner `Ivan Petrov`
- **THEN** the `1.0.0` row reads "Published by Jane Doe" and the `beta-2` row reads "by Ivan Petrov"

#### Scenario: Other folders are excluded
- **WHEN** a version of the same resource was saved to a different folder
- **THEN** it is not listed

#### Scenario: A version saved from the panel appears at once
- **WHEN** the user saves as new version `2.0.0` and opens a panel again
- **THEN** `2.0.0` is listed without waiting for the listing cache to expire

#### Scenario: Resource that is not the user's own
- **WHEN** the panel is opened for a resource that belongs to another owner (the Save panel never opens for one; the Publish panel might), for an id that is not in the loaded listing, or while the listing is still loading
- **THEN** the host renders no Versions history section and requests no status; the section component's own empty state stays a lib feature for a host that passes empty rows; the same holds when the version being edited is the only one

#### Scenario: Reopening a panel reloads the statuses
- **WHEN** a panel that loaded the statuses is closed and opened again
- **THEN** the previous statuses and any previous error are cleared and the loading state shows until the new response arrives

### Requirement: Statuses load when the panel opens

Opening a panel that shows the section SHALL load the statuses from the version statuses endpoint in the background; the rows SHALL render at once with the version, folder, date and owner, and each status SHALL appear when the response arrives. A version with status unknown (a resource the user does not own) SHALL NOT be shown as Not published. A private resource that was never published SHALL list every version as Not published, with no error.

#### Scenario: Statuses arrive after the rows
- **WHEN** a panel opens
- **THEN** the version rows render immediately and each status appears when the statuses response arrives

#### Scenario: Never-published private resource
- **WHEN** the statuses response says Not published for every version
- **THEN** every row reads **Not published** and no error is shown

#### Scenario: Unknown status
- **WHEN** the statuses response has unknown for a version
- **THEN** that row does not read **Not published**

### Requirement: Loading, empty, error and retry states

The section SHALL have a loading state for the statuses, an empty state (the group has no saved version in the listing), an error state when the statuses request fails, and a **Retry** action in the error state. A statuses failure SHALL NOT hide the version rows. While statuses load, each row whose status is missing SHALL show a placeholder of the badge's size in the status slot, so the layout does not move when the badge arrives, and the loading message SHALL be announced through a visually hidden kit `LiveRegion` without being drawn. Error messages SHALL be announced through the kit `LiveRegion`, mounted before its text. A failure of the statuses request SHALL NOT disable Save or Publish.

#### Scenario: Statuses request fails
- **WHEN** the statuses request fails
- **THEN** the version rows stay visible, an error message is announced, **Retry** reloads the statuses, and Save or Publish stays usable

### Requirement: Ownership, boundary and quality bars

Grouping the listing, building the rows and loading the statuses SHALL live in a hook in `libs/chat-hooks` that takes the listing items and an already-configured API client and returns resolved rows. The section component SHALL live in `libs/publish-panel` and take rows, labels, colors and callbacks only; it SHALL NOT know REST paths, the generated client, routing or app storage. `apps/chat` SHALL wire the hook and the component into both panels and fill the labels with `t()`.

The hook SHALL return the folder as segments, and the host SHALL supply the translated root label ("Personal"), so the lib never reads the language. The section SHALL be mobile-first and render correctly at phone width inside the full-width drawer, use logical properties and mirror directional icons for RTL, meet WCAG 2.1 AAA (visible focus, a heading, a list with items, status not conveyed by color alone), and use memoised row data. It SHALL NOT be gated by `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`.

i18n keys (`VersionHistoryI18nKeys`, `versionHistory.*`, one namespace shared by the Save panel host and the catalog Details publish host, with the existing `ButtonsI18nKeys.Retry` and `CatalogI18nKeys.FolderPersonal` reused): the section heading, **Not published**, **In review**, **Published** (with `{folders}`), "Published by {name}", "by {name}", loading, empty, error and **Retry** copy.

#### Scenario: Assistive technology
- **WHEN** a screen reader reads the section
- **THEN** it finds a heading and a list of versions, each row's status is text, and the loading and error messages are announced
