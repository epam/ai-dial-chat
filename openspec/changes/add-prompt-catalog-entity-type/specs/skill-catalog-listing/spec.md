## MODIFIED Requirements

### Requirement: Skills merge into `CatalogView`'s item list

When Skills are enabled, `CatalogView` SHALL append personal `skills`, `sharedWithMe`, and `publicSkills` from `useSkills()` through `mapSkillToCatalogItem` with their matching `SkillSource`. All three arrays and the feature flag SHALL be memo dependencies. The shared array SHALL also participate in metadata lookup when details are fetched.

#### Scenario: All skill sources are listed

- **WHEN** the context exposes one personal, one shared, and one public skill
- **THEN** the catalog contains all three under their Personal, Shared, and Public source folders

#### Scenario: Selector mode still excludes skills

- **WHEN** the catalog renders in deployment-selector mode
- **THEN** no skill item is shown

### Requirement: Unsupported actions are hidden for a skill

Skills SHALL continue to hide Use in chat, Share, Download, Delete, Unshare, and Revoke access. No Skill entry is added to the Create dropdown by this capability. Edit is available when `item.isEditable` is true. Publish is available only when `item.isMyApp` is true; shared-with-me and public skills SHALL remain unpublishable even when `canEdit` is true. `CatalogView.handleEdit` SHALL navigate to `/skill-editor?id=<full skill resource URL>&returnUrl=/catalog`.

The decision remains at the app edge through `CatalogItem.isEditable` and `CatalogView`'s callbacks; `libs/catalog` gains no bucket, permission, route, or generated-client knowledge.

#### Scenario: Personal skill exposes Edit and Publish

- **WHEN** a user opens their personal skill
- **THEN** Edit and Publish are present while every unsupported mutating/runtime action remains absent

#### Scenario: Writable shared skill exposes Edit

- **WHEN** a shared skill has `canEdit: true`
- **THEN** Edit navigates with its full `skills/{ownerBucket}/{path}` id and Publish remains absent

#### Scenario: Public skill remains read-only

- **WHEN** a public skill is opened, even if metadata contains `WRITE`
- **THEN** no Edit, Publish, or other mutation action is rendered

## RENAMED Requirements

FROM: ### Requirement: Every mutating and runtime action is hidden for a skill
TO: ### Requirement: Unsupported actions are hidden for a skill
