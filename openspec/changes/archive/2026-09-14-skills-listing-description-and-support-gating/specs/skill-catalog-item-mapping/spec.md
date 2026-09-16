# skill-catalog-item-mapping Delta

## MODIFIED Requirements

### Requirement: `mapSkillToCatalogItem` maps skill metadata to a catalog item

`mapSkillToCatalogItem` SHALL keep `skill.url` as the catalog id and SHALL map ownership, editability, and description as follows:

| Field | Value |
| --- | --- |
| `isMyApp` | `false` outside the Personal source; for Personal, `skill.isMy` falling back to `true` for backward compatibility |
| `sharedWithMe` | `skill.sharedWithMe`, falling back to whether the source is `SharedWithMe` |
| `isEditable` | `false` for Public; otherwise `skill.canEdit`, falling back to personal-source editability |
| `description` | `skill.description ?? ''` — the listing-sourced description (DIAL Core PR #1970, `attributes.description` on the skill item metadata), replacing the previously hardcoded empty string |

Every other field retains the canonical skill mapping. The mapper remains pure and performs no I/O — the description arrives on the already-loaded listing entry, so mapping it adds no request.

A skill whose listing entry carries no `description` (older Core, the shared-with-me path whose upstream payload may lack `attributes`, or an omitted frontmatter field) SHALL map to `description: ''`, exactly as before.

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

#### Scenario: Listing description is forwarded to the catalog item

- **WHEN** a skill's listing entry carries `description: 'Summarizes documents'`
- **THEN** the mapped `CatalogItem.description` is `'Summarizes documents'`, and the catalog grid card renders it with no per-skill fetch

#### Scenario: Absent listing description maps to an empty string

- **WHEN** a skill's listing entry omits `description` (older Core, shared-with-me without `attributes`, or no frontmatter field)
- **THEN** the mapped `CatalogItem.description` is `''`, exactly as before the listing carried descriptions
