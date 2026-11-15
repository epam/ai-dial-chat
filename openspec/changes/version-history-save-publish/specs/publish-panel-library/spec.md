# Spec Delta

## ADDED Requirements

### Requirement: The Save and Publish panels render an optional Versions history section

The package SHALL export a versions history section component that renders rows handed to it. Each row carries the version, a flag for the current version, the status (Not published, which draws no badge, In review, Published or unknown), the folder text, the last modified date and the author line. The section SHALL take every string through a `*Labels` prop with an English default, every color through a `*Colors` prop as `var(--<prefix>-x, fallback)` set with `buildCssVars`, and typography through a `*ClassName` prop. It SHALL render loading, empty, error and retry states from props, announce loading and error through the kit `LiveRegion`, use logical properties, and import no host module. It SHALL NOT build REST paths, call an API client, read app storage or navigate.

`SaveToFolderPanel` (and so `StandaloneSaveToFolderPanel`) and `PublishPanel` (and so `StandalonePublishPanel`) SHALL render the section as the last section of their main body when the host passes its props, and SHALL render nothing when the host omits them. The existing `PublishHistoryList` component and the per-folder `PublishHistoryEntry` model SHALL be left as they are. `libs/publish-panel/README.md` SHALL document the new export, props, labels and colors, and `npm run validate:docs` SHALL pass.

#### Scenario: Section only when the host supplies the props
- **WHEN** a host renders `SaveToFolderPanel` or `PublishPanel` without the history props
- **THEN** no Versions history section is rendered

#### Scenario: Section renders handed rows
- **WHEN** the section receives three rows
- **THEN** it renders three rows in the given order, with no action on any row

#### Scenario: Error keeps the rows
- **WHEN** the section receives rows and an error flag for the statuses
- **THEN** the rows stay visible, the error message is announced, and **Retry** calls the host callback

#### Scenario: Both panels share one component
- **WHEN** the Save panel and the Publish panel are rendered with the same rows
- **THEN** the sections look and read the same
