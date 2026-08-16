## MODIFIED Requirements

### Requirement: Skills merge into `CatalogView`'s item list

When Skills are enabled, `CatalogView` SHALL append personal `skills`, `sharedWithMe`, and `publicSkills` from `useSkills()` through `mapSkillToCatalogItem` with their matching `SkillSource`. All three arrays and the feature flag SHALL be memo dependencies. The shared array SHALL also participate in metadata lookup when details are fetched.

#### Scenario: All skill sources are listed

- **WHEN** the context exposes one personal, one shared, and one public skill
- **THEN** the catalog contains all three under their Personal, Shared, and Public source folders

#### Scenario: Selector mode still excludes skills

- **WHEN** the catalog renders in deployment-selector mode
- **THEN** no skill item is shown

### Requirement: Every mutating and runtime action is hidden for a skill

Skills SHALL continue to hide Use in chat, Publish, Share, Download, Delete, Unshare, and Revoke access. No Skill entry is added to the Create dropdown by this capability. Edit is the exception: the details panel SHALL render Edit when `item.isEditable` is true, and `CatalogView.handleEdit` SHALL navigate to `/skill-editor?id=<full skill resource URL>&returnUrl=/catalog`. Public and read-only shared skills SHALL have no Edit action.

The decision remains at the app edge through `CatalogItem.isEditable` and `CatalogView`'s callbacks; `libs/catalog` gains no bucket, permission, route, or generated-client knowledge.

#### Scenario: Personal skill exposes Edit only

- **WHEN** a user opens their personal skill
- **THEN** Edit is present while every other mutating/runtime action remains absent

#### Scenario: Writable shared skill exposes Edit

- **WHEN** a shared skill has `canEdit: true`
- **THEN** Edit navigates with its full `skills/{ownerBucket}/{path}` id

#### Scenario: Public skill remains read-only

- **WHEN** a public skill is opened, even if metadata contains `WRITE`
- **THEN** no Edit or other mutation action is rendered
