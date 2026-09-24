# skill-catalog-item-mapping Specification

## Purpose

Defines the app-level types and pure mapping that turn DIAL Core skill metadata into a `CatalogItem`: the `SkillSource` enum, the `skills/{bucket}/{path}` resource-URL parser, the field-by-field mapping contract, and how a skill's catalog folder path is derived.
## Requirements
### Requirement: `SkillSource` enum and skill resource URL helpers

`SkillSource` SHALL contain `Personal`, `SharedWithMe`, and `Public`. `parseSkillResourceUrl` SHALL continue to parse `skills/{bucket}/{path}` into its owner bucket and relative path and reject malformed or differently-prefixed values.

#### Scenario: Shared source is representable

- **WHEN** a skill comes from the aggregate `sharedWithMe` array
- **THEN** it is mapped with `SkillSource.SharedWithMe` without losing its owner bucket

---

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

### Requirement: Folder path derives from source label plus grouping-folder segments

The source label SHALL be Personal for `SkillSource.Personal`, Shared for `SkillSource.SharedWithMe`, and Public for `SkillSource.Public`, followed by decoded `parentPath` segments. Root-level skills contain only their source label.

This requirement governs the `CatalogItem.folder` data, not how the List view lays it out. The catalog List view's Folder cell (`libs/catalog/src/components/ListView/Renders/FolderCellRenderer.tsx`) SHALL show the folder icon and only the deepest segment as visible text, and SHALL expose the full path — segments joined with ` / ` — in a hover tooltip and in a screen-reader-only node. A breadcrumb of every segment does not fit the column: each segment shrinks to an equal share and the row reads `Personal > ana… > f..`, so the deepest folder, which identifies the row, keeps the width.

#### Scenario: Shared skill folder label

- **WHEN** a shared skill has `parentPath: 'analysis/'`
- **THEN** its folder is `[<Shared label>, 'analysis']`

#### Scenario: Nested skill folder in the List view

- **WHEN** a personal skill has `parentPath: 'analysis/finance/'` and the Skills tab is in List view
- **THEN** its folder is `[<Personal label>, 'analysis', 'finance']`
- **AND** the Folder cell shows `finance` as visible text
- **AND** hovering the cell shows the tooltip `Personal / analysis / finance`, and the same path is announced to screen readers

#### Scenario: Root-level skill folder in the List view

- **WHEN** a personal skill has no `parentPath`
- **THEN** the Folder cell shows `Personal` with no path tooltip

