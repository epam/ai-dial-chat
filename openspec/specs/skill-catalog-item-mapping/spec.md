# skill-catalog-item-mapping Specification

## Purpose

Defines the app-level types and pure mapping that turn DIAL Core skill metadata into a `CatalogItem`: the `SkillSource` enum, the `skills/{bucket}/{path}` resource-URL parser, the field-by-field mapping contract, and how a skill's catalog folder path is derived.

## Requirements

### Requirement: `SkillSource` enum and skill resource URL helpers

`apps/chat/src/types/skill.ts` SHALL define a string enum `SkillSource` with members `Personal = 'personal'` and `Public = 'public'`, naming the namespace a listed skill came from.

The same module SHALL export `parseSkillResourceUrl(url: string): { bucket: string; path: string } | null`, the frontend mirror of the backend's parser: it accepts a `skills/{bucket}/{path}` string and returns `null` for anything with a different prefix, an empty bucket, or an empty path.

#### Scenario: Well-formed skill resource URL

- **WHEN** `parseSkillResourceUrl('skills/user-bucket/analysis/revenue-skill')` is called
- **THEN** it returns `{ bucket: 'user-bucket', path: 'analysis/revenue-skill' }`

#### Scenario: Not a skill resource URL

- **WHEN** `parseSkillResourceUrl('files/user-bucket/report.pdf')` is called
- **THEN** it returns `null`

#### Scenario: Missing path

- **WHEN** `parseSkillResourceUrl('skills/user-bucket')` is called
- **THEN** it returns `null`

---

### Requirement: `mapSkillToCatalogItem` maps skill metadata to a catalog item

`apps/chat/src/utils/map-skill-to-catalog-item.ts` SHALL export

```ts
mapSkillToCatalogItem(
  skill: SkillMetadataItemDto,
  options: { t: TFunction; source: SkillSource; favoriteIds: ReadonlySet<string> },
): CatalogItem
```

producing a `CatalogItem` with:

| Field | Value |
| --- | --- |
| `id` | `skill.url` — the full `skills/{bucket}/{path}` resource URL |
| `type` | `CatalogEntityType.Skill` |
| `name` | `skill.name` |
| `description` | `''` — skill metadata carries no description |
| `version` | `''` — skill metadata carries no version |
| `lastUsed` | `formatLastUsed(skill.updatedAt)` |
| `createdAt` / `updatedAt` | the corresponding metadata timestamps |
| `isFeatured` / `isHidden` | `false` |
| `topics` | `[]` — the skills API exposes no topics |
| `isUserFavorite` / `isStarred` | `favoriteIds.has(skill.url)` |
| `isMyApp` | `source === SkillSource.Personal` |
| `sharedWithMe` | `false` — no shared-skill listing exists |
| `isEditable` | `false` — every skill is read-only |
| `folder` | see the folder requirement below |
| `details` | `undefined` — resolved lazily by the details fetch |

The mapper SHALL be a pure function: it performs no I/O, reads no context, and calls no hook.

The `id` SHALL be the resource URL rather than a bucket-relative path, because two buckets are listed and the same relative path can exist in both.

#### Scenario: Personal skill maps to an owned catalog item

- **WHEN** a `SkillMetadataItemDto` with `url: 'skills/me/revenue-skill'` is mapped with `source: SkillSource.Personal`
- **THEN** the item has `id: 'skills/me/revenue-skill'`, `type: CatalogEntityType.Skill`, `isMyApp: true`, `isEditable: false`, and `sharedWithMe: false`

#### Scenario: Organisation skill is not owned

- **WHEN** a skill is mapped with `source: SkillSource.Public`
- **THEN** the item has `isMyApp: false` and `isEditable: false`

#### Scenario: Favourite state comes from the passed set

- **WHEN** `favoriteIds` contains the skill's resource URL
- **THEN** the item has `isUserFavorite: true` and `isStarred: true`

#### Scenario: Absent description and version

- **WHEN** any skill is mapped
- **THEN** `description` is `''` and `version` is `''`, and neither is fabricated from the name or path

---

### Requirement: Folder path derives from source label plus grouping-folder segments

`folder` SHALL be `[<source label>, ...grouping folder segments]`, where the source label is `t(CatalogI18nKeys.FolderPersonal)` for `SkillSource.Personal` and `t(CatalogI18nKeys.FolderPublic)` for `SkillSource.Public` — the same keys `mapPromptToCatalogItem` uses.

Grouping folder segments SHALL come from `skill.parentPath`, split on `/`, with empty segments dropped and each segment passed through `safeDecodeURIComponent`.

A skill at the bucket root SHALL have `folder` equal to `[<source label>]` alone.

Resolving the label through `t` keeps i18n at the app edge; `libs/catalog` receives already-resolved strings.

#### Scenario: Nested skill

- **WHEN** a personal skill has `parentPath: 'analysis/finance/'`
- **THEN** `folder` is `[<Personal label>, 'analysis', 'finance']`

#### Scenario: Root-level skill

- **WHEN** an organisation skill has no `parentPath`
- **THEN** `folder` is `[<Public label>]`

#### Scenario: Percent-encoded segment

- **WHEN** a skill has `parentPath: 'my%20folder/'`
- **THEN** `folder`'s second entry is `'my folder'`
