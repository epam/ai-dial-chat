## ADDED Requirements

### Requirement: `Skill` joins `Prompt` as a content-first entity type in `libs/catalog`

`libs/catalog/src/components/Details/DetailsPanel.tsx` currently decides the tab row with a single `item.type === CatalogEntityType.Prompt` equality check. That check SHALL be replaced by membership in a module-level `CONTENT_FIRST_ENTITY_TYPES` set containing `CatalogEntityType.Prompt` and `CatalogEntityType.Skill`.

For a content-first type the panel SHALL:

- omit the `About` tab entirely;
- push the `Content` tab unconditionally, whether or not `item.details.promptContent` has resolved yet, so the opening tab never shifts as details settle;
- push `Overview` after it when `item.details.overview` is present.

Behaviour for every other entity type SHALL be unchanged: `About` first, then any populated tab.

A skill has no description at all in its metadata, so an `About` tab for a skill would render an empty panel on open — that is the reason for the change. The lib learns only that two of its own enum members lead with content; it gains no knowledge of buckets, endpoints, manifests, or the host.

#### Scenario: Skill details panel omits About

- **WHEN** the details panel opens for a `CatalogEntityType.Skill` item
- **THEN** the tab row's first entry is `Content` and no `About` tab is rendered

#### Scenario: Content tab is present before details resolve

- **WHEN** a skill's details panel opens and `onFetchDetails` has not settled
- **THEN** the `Content` tab is already in the tab row and remains the selected tab once the fetch resolves

#### Scenario: Prompt behaviour is unchanged

- **WHEN** the details panel opens for a `CatalogEntityType.Prompt` item
- **THEN** the tab row is `Content` then `Overview`, exactly as before this change

#### Scenario: Other entity types are unchanged

- **WHEN** the details panel opens for a `Model`, `Agent`, or `Toolset` item
- **THEN** the tab row's first entry is still `About`

---

### Requirement: A skill's details resolve from its manifest and its file listing in parallel

The Skill branch of `CatalogView`'s `onFetchDetails` SHALL parse `{ bucket, path }` from `item.id` with `parseSkillResourceUrl` and issue two requests through `Promise.allSettled`:

1. `downloadSkillFile(bucket, path, 'SKILL.md')` — the manifest filename the backend already treats as required for every skill. The returned `Response` body SHALL be read as text and rejected without decoding when it exceeds `SKILL_MANIFEST_MAX_BYTES` (initially 256 KB).
2. `listSkillFiles(bucket, path, { recursive: true })` — the skill's own file inventory.

Both wrappers are the existing ones in `apps/chat/src/server-api/skills.api.ts`, which call the generated `SkillsApi`. `downloadSkillFile` uses the generated `Raw` method (it returns the native `Response`, preserving stream semantics); `listSkillFiles` uses the normal generated method. No new `base.ts` helper and no direct `fetch` is introduced.

The branch SHALL return early, before any deployment path: a skill MUST NOT trigger `getDeploymentDetails` or `getDeploymentLimits`, since neither endpoint accepts a skill resource URL.

An unparseable `item.id` SHALL resolve `undefined` without issuing any request.

#### Scenario: Both requests succeed

- **WHEN** a user opens a skill's details panel, the manifest read resolves text, and the file listing resolves three files
- **THEN** `onFetchDetails` resolves `{ promptContent: { content: <manifest text> }, overview: <section with the three files> }`

#### Scenario: Skill fetch never reaches the deployment endpoints

- **WHEN** the opened item's `type` is `CatalogEntityType.Skill`
- **THEN** neither `getDeploymentDetails` nor `getDeploymentLimits` is called

#### Scenario: Unparseable item id

- **WHEN** a skill item's `id` is not a well-formed `skills/{bucket}/{path}` URL
- **THEN** `onFetchDetails` resolves `undefined` and issues no request

---

### Requirement: Manifest and file-listing failures degrade independently

Each of the two results SHALL be optional in the returned `CatalogItemTabData`:

- A missing, oversized, or failed `SKILL.md` read SHALL omit `promptContent` and still return the `overview` built from the file listing. The `Content` tab is still present (per the content-first requirement) and renders the panel's existing empty state.
- A failed file listing SHALL omit `overview` and still return `promptContent`.
- Both failing SHALL resolve `undefined`, leaving the panel's existing error/empty handling in place.

`onFetchDetails` SHALL NOT throw out of the callback in any of these cases.

#### Scenario: Skill with no readable manifest

- **WHEN** `downloadSkillFile` rejects with a 404 and the file listing resolves
- **THEN** the panel renders the Overview tab with the file list, the Content tab shows its empty state, and nothing throws

#### Scenario: Oversized manifest

- **WHEN** the manifest response exceeds `SKILL_MANIFEST_MAX_BYTES`
- **THEN** the text is not decoded, `promptContent` is omitted, and the Overview tab still renders

#### Scenario: File listing fails

- **WHEN** `listSkillFiles` rejects and the manifest read resolves
- **THEN** the panel renders the Content tab with the manifest text and no Overview tab

#### Scenario: Both fail

- **WHEN** both requests reject
- **THEN** `onFetchDetails` resolves `undefined` and the panel falls back to its existing behaviour without throwing

---

### Requirement: The Overview section describes the skill's provenance and files

The `overview` returned for a skill SHALL be a single `CatalogItemOverview` section whose title is `catalog.details.skillSection` and whose specs are, in order:

1. `catalog.details.skillAuthor` → `skill.author`, included only when the metadata carries one.
2. `catalog.details.skillUpdated` → `formatLastUsed(skill.updatedAt)`.
3. `catalog.details.skillFileCount` → the number of `nodeType: 'item'` entries returned by the file listing.
4. One row per file: label `catalog.details.skillFile`-derived file path, value `formatLastUsed(file.updatedAt)`.

File-listing entries with `nodeType: 'folder'` SHALL be excluded from the rows and from the count.

Sizes are not shown: `SkillMetadataItemDto` exposes no content-length field.

#### Scenario: Skill with an author and two files

- **WHEN** the metadata carries an author and the file listing returns two files and one folder
- **THEN** the Overview section shows the author row, the updated row, a file count of `2`, and exactly two file rows

#### Scenario: Skill with no author

- **WHEN** the metadata carries no `author`
- **THEN** the author row is omitted rather than rendered with an empty or placeholder value

---

### Requirement: i18n, RTL, accessibility, and caching contract for the skill details panel

- **i18n keys**: `catalog.details.skillSection` (`'Skill'`), `catalog.details.skillAuthor` (`'Author'`), `catalog.details.skillUpdated` (`'Last updated'`), `catalog.details.skillFileCount` (`'Files'`), `catalog.details.skillFile` (`'File'`). All declared in `apps/chat/src/constants/translation-keys.ts` and `en.json`. The lib receives resolved strings only — `libs/catalog` SHALL NOT call `useTranslation`.
- **App-level adapter contract**: `libs/catalog` receives the manifest as an already-resolved `string` on `CatalogItemTabData.promptContent.content` and the file inventory as already-resolved label/value rows on `CatalogItemTabData.overview`. Bucket names, the `SKILL.md` filename, the skills endpoints, the generated client, and the size cap all stay in `apps/chat`.
- **RTL / direction impact**: none — the Content and Overview tabs are existing components with no new directional layout or icon.
- **Accessibility**: the panel's existing `role="status"` loading indicator covers the fetch; the manifest renders in the existing read-only text block; no new interactive control is added.
- **Caching**: no new cache. Details are re-fetched each time the panel opens for a skill, matching the panel's existing behaviour for every other entity type.
- **Content safety**: `SKILL.md` is arbitrary user-authored text and SHALL be rendered through the existing read-only text block, which does not execute or interpret markup.

#### Scenario: No hardcoded English in the lib

- **WHEN** the skill details code in `libs/catalog` is inspected
- **THEN** it contains no `useTranslation` call and no skill-specific English label beyond the existing tab-label defaults

#### Scenario: Details re-fetch on reopen

- **WHEN** a user closes and reopens the same skill's details panel
- **THEN** the manifest and file listing are requested again
