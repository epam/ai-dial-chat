## MODIFIED Requirements

### Requirement: `SkillSource` enum and skill resource URL helpers

`SkillSource` SHALL contain `Personal`, `SharedWithMe`, and `Public`. `parseSkillResourceUrl` SHALL continue to parse `skills/{bucket}/{path}` into its owner bucket and relative path and reject malformed or differently-prefixed values.

#### Scenario: Shared source is representable

- **WHEN** a skill comes from the aggregate `sharedWithMe` array
- **THEN** it is mapped with `SkillSource.SharedWithMe` without losing its owner bucket

### Requirement: `mapSkillToCatalogItem` maps skill metadata to a catalog item

`mapSkillToCatalogItem` SHALL keep `skill.url` as the catalog id and SHALL map ownership and editability as follows:

| Field | Value |
| --- | --- |
| `isMyApp` | `false` outside the Personal source; for Personal, `skill.isMy` falling back to `true` for backward compatibility |
| `sharedWithMe` | `skill.sharedWithMe`, falling back to whether the source is `SharedWithMe` |
| `isEditable` | `false` for Public; otherwise `skill.canEdit`, falling back to personal-source editability |

Every other field retains the canonical skill mapping. The mapper remains pure and performs no I/O.

#### Scenario: Personal skill is editable

- **WHEN** a personal skill is mapped
- **THEN** it is owned, not shared-with-me, and editable

#### Scenario: Writable shared skill is editable

- **WHEN** a shared skill carries `canEdit: true`, even if malformed metadata also claims `isMy: true`
- **THEN** it is not owned, is marked shared-with-me, and has `isEditable: true`

#### Scenario: Read-only shared skill is not editable

- **WHEN** a shared skill carries `canEdit: false`
- **THEN** its details panel receives `isEditable: false`

#### Scenario: Public skill ignores ownership and WRITE metadata

- **WHEN** a public skill carries `isMy: true` and `canEdit: true` from an untrusted or older response
- **THEN** the mapper still produces `isMyApp: false` and `isEditable: false`

### Requirement: Folder path derives from source label plus grouping-folder segments

The source label SHALL be Personal for `SkillSource.Personal`, Shared for `SkillSource.SharedWithMe`, and Public for `SkillSource.Public`, followed by decoded `parentPath` segments. Root-level skills contain only their source label.

#### Scenario: Shared skill folder label

- **WHEN** a shared skill has `parentPath: 'analysis/'`
- **THEN** its folder is `[<Shared label>, 'analysis']`
