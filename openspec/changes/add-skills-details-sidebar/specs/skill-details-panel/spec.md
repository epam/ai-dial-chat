## ADDED Requirements

### Requirement: The Content tab shows the manifest's description as its summary

`libs/catalog/src/models/item-details-data.ts` SHALL add an optional `description` to `CatalogItemPromptContent`, and `DetailsPanel` SHALL render `ContentTab`'s `description` prop as `item.details?.promptContent?.description ?? item.description`.

The addition exists because a skill's summary is discovered by the details fetch, not by the list request: `mapSkillToCatalogItem` sets `description: ''` because skill metadata carries none. Prompts pass no `description` on `promptContent` and SHALL be unaffected — they keep rendering `item.description`.

The Skill branch of `onFetchDetails` SHALL set `promptContent.description` from the parsed manifest's `description` frontmatter field, omitting it when the field is absent, and SHALL set `promptContent.content` to the manifest **body** — the text after the frontmatter fence — rather than the raw file.

No `About` tab SHALL be restored for skills. `CatalogEntityType.Skill` stays in `CONTENT_FIRST_ENTITY_TYPES`. An About tab derived from a description that only exists after the fetch settles would appear mid-interaction and push `Content` one slot along while the user is reading it; the summary slot delivers the same text at the same moment without moving the tab row.

#### Scenario: Manifest with a description

- **WHEN** a skill's `SKILL.md` frontmatter carries `description: Finds and cites sources`
- **THEN** the Content tab renders that text as its summary line above the divider, and the body below it

#### Scenario: Frontmatter is not rendered as body

- **WHEN** a skill's `SKILL.md` opens with a `---` fence
- **THEN** the Content tab body contains no `name:` or `description:` line and no heading or rule produced by the fence

#### Scenario: Manifest with no description

- **WHEN** the frontmatter carries no `description`
- **THEN** the Content tab renders no summary line and no divider, and the body renders unchanged

#### Scenario: Prompt content is unaffected

- **WHEN** a prompt's details panel opens
- **THEN** its Content tab summary is `item.description`, exactly as before

#### Scenario: Skill still opens on Content

- **WHEN** a skill's details panel opens
- **THEN** the tab row's first entry is `Content` and no `About` tab is rendered, before and after details resolve

---

### Requirement: The skill's files populate the Content tab's picker

The Skill branch SHALL build the picker's options from the file listing through a new `buildSkillContentFiles(files)` in `apps/chat/src/utils/map-skill-to-catalog-item.ts`, and return them as `promptContent.files` with `promptContent.selectedFileId` set to `SKILL_MANIFEST_FILE`.

Each option SHALL carry the listing entry's file path as **both** `id` and `name`: the path round-trips to `downloadSkillFile` without re-derivation, and it disambiguates same-named files in different folders, which a bare filename would not.

Options SHALL be ordered with the manifest first — it is the file the panel opens on — and the remainder alphabetically. Entries with `nodeType: 'folder'` SHALL be excluded, applying the same filter the file count uses.

A failed file listing SHALL yield an empty option array, so no picker renders and the manifest body still shows.

`CatalogView` SHALL supply `onLoadContentFile`, resolving it through the existing `downloadSkillFile` wrapper with the opened skill's `{ bucket, path }` and the picked option's `id` as the file path, then reading the response through `readSkillManifest` so the same size cap applies to every file. `SKILL_MANIFEST_FILE` SHALL be returned frontmatter-stripped via `parseSkillManifest`; every other file SHALL be returned as written. No new endpoint, generated-client method, or `base.ts` helper is introduced.

#### Scenario: Options built from the listing

- **WHEN** the file listing resolves two files and one grouping folder
- **THEN** `promptContent.files` has two entries, the grouping folder is absent, and `selectedFileId` is `'SKILL.md'`

#### Scenario: Manifest heads the list

- **WHEN** the listing returns `scripts/run.py`, `analyzer.md`, and `SKILL.md` in that order
- **THEN** the options are ordered `SKILL.md`, `analyzer.md`, `scripts/run.py`

#### Scenario: Listing failure yields no picker

- **WHEN** `listSkillFiles` rejects and the manifest read resolves
- **THEN** `promptContent.files` is empty and the manifest body still renders

#### Scenario: Loading a picked file

- **WHEN** the user picks `scripts/run.py`
- **THEN** `downloadSkillFile` is called with the opened skill's bucket and path and `'scripts/run.py'` as the file path, and the file's text is rendered as written

---

## MODIFIED Requirements

### Requirement: A skill's details resolve from its manifest and its file listing in parallel

The Skill branch of `CatalogView`'s `onFetchDetails` SHALL parse `{ bucket, path }` from `item.id` with `parseSkillResourceUrl` and issue two requests through `Promise.allSettled`:

1. `downloadSkillFile(bucket, path, 'SKILL.md')` — the manifest filename the backend already treats as required for every skill. The returned `Response` body SHALL be read as text and rejected without decoding when it exceeds `SKILL_MANIFEST_MAX_BYTES` (initially 256 KB).
2. `listSkillFiles(bucket, path, { recursive: true })` — the skill's own file inventory.

Both wrappers are the existing ones in `apps/chat/src/server-api/skills.api.ts`, which call the generated `SkillsApi`. `downloadSkillFile` uses the generated `Raw` method (it returns the native `Response`, preserving stream semantics); `listSkillFiles` uses the normal generated method. No new `base.ts` helper and no direct `fetch` is introduced.

A manifest that reads successfully SHALL then be passed through `parseSkillManifest`, whose output feeds three parts of the result: `promptContent.content` from the body, `promptContent.description` from the frontmatter `description`, and the Overview's Specification section from `about`.

A file listing that resolves SHALL feed two parts of the result: the Overview's Details section (the file count) and the Content tab's picker options.

The branch SHALL return early, before any deployment path: a skill MUST NOT trigger `getDeploymentDetails` or `getDeploymentLimits`, since neither endpoint accepts a skill resource URL.

`mapSkillDetails` and the `{ type: 'SKILL' }` member of `EntitySpecificDetails` SHALL be removed. `EntitySpecificDetails` is produced only by `mapDeploymentDetailsDtoToEntityDetails`, which a skill never reaches, so both were unreachable; `SkillAboutDetails` and `SkillEntityDetails` SHALL move to `apps/chat/src/types/skill.ts` and become the manifest parser's output types.

An unparseable `item.id` SHALL resolve `undefined` without issuing any request.

#### Scenario: Both requests succeed

- **WHEN** a user opens a skill's details panel, the manifest read resolves text with frontmatter, and the file listing resolves three files
- **THEN** `onFetchDetails` resolves `promptContent` carrying the body, the frontmatter description, and three picker options, plus an `overview` with a Specification section and a Details section

#### Scenario: Skill fetch never reaches the deployment endpoints

- **WHEN** the opened item's `type` is `CatalogEntityType.Skill`
- **THEN** neither `getDeploymentDetails` nor `getDeploymentLimits` is called

#### Scenario: Unparseable item id

- **WHEN** a skill item's `id` is not a well-formed `skills/{bucket}/{path}` URL
- **THEN** `onFetchDetails` resolves `undefined` and issues no request

#### Scenario: No unreachable skill mapper remains

- **WHEN** `apps/chat/src` is searched for `mapSkillDetails` or `type: 'SKILL'`
- **THEN** neither appears

---

### Requirement: Manifest and file-listing failures degrade independently

Each of the two results SHALL be optional in the returned `CatalogItemTabData`:

- A missing, oversized, or failed `SKILL.md` read SHALL omit `promptContent` entirely — and with it the picker, which lives on `promptContent` — and still return the `overview` built from the file listing. The `Content` tab is still present (per the content-first requirement) and renders the panel's existing empty state.
- A failed file listing SHALL omit `overview` and leave `promptContent.files` empty — so no picker renders — while still returning the manifest body and, when the frontmatter resolved, its description.
- Both failing SHALL resolve `undefined`, leaving the panel's existing error/empty handling in place.

A manifest that downloads but fails to parse is **not** a failure of either half: the raw text SHALL still be returned as `promptContent.content`, with no `description` and no Specification section. Parse failure SHALL NOT be escalated to fetch failure and SHALL NOT surface a notification.

`onFetchDetails` SHALL NOT throw out of the callback in any of these cases.

#### Scenario: Skill with no readable manifest

- **WHEN** `downloadSkillFile` rejects with a 404 and the file listing resolves
- **THEN** the panel renders the Overview tab, the Content tab's empty state, and nothing throws

#### Scenario: Oversized manifest

- **WHEN** the manifest response exceeds `SKILL_MANIFEST_MAX_BYTES`
- **THEN** the text is not decoded, `parseSkillManifest` is not called, `promptContent` is omitted, and the Overview still renders

#### Scenario: File listing fails

- **WHEN** `listSkillFiles` rejects and the manifest read resolves
- **THEN** the panel renders the Content tab with the manifest body and no file picker

#### Scenario: Malformed frontmatter

- **WHEN** the manifest downloads but its frontmatter fails to parse
- **THEN** the Content tab renders the whole file as its body, no summary line is shown, the Overview has no Specification section, and no notification appears

#### Scenario: Both fail

- **WHEN** both requests reject
- **THEN** `onFetchDetails` resolves `undefined` and the panel falls back to its existing behaviour without throwing

---

### Requirement: The Overview section describes the skill's provenance and files

The `overview` returned for a skill SHALL be up to two `CatalogItemOverview` sections, in order.

**Specification** — title `catalog.details.skill.specificationSection`. Built from the parsed manifest's `about`, with each row omitted when its field is absent:

1. `catalog.details.skill.whenToUse` → `about.whenToUse`.
2. `catalog.details.skill.allowedTools` → `about.allowedTools` joined with ` · `, matching the existing deployment mappers.
3. `catalog.details.skill.bundledResources` → `about.bundledResources` joined with ` · `.

`about.skillPrompt` SHALL NOT be rendered: it duplicates the manifest body already shown on the Content tab. The whole section SHALL be omitted when no row resolved.

**Details** — title `catalog.details.skill.section`, with specs in order:

1. `catalog.details.skill.author` → `skill.author`, included only when the metadata carries one.
2. `catalog.details.skill.updated` → `formatLastUsed(skill.updatedAt)`.
3. `catalog.details.skill.fileCount` → the number of `nodeType: 'item'` entries returned by the file listing.

Per-file rows SHALL NOT appear in the Overview. The files are enumerated by the Content tab's picker, where selecting one shows it; repeating them as inert `{ label, value }` rows would be the same list twice, once without an action.

File-listing entries with `nodeType: 'folder'` SHALL be excluded from the count. Sizes are not shown: `SkillMetadataItemDto` exposes no content-length field.

#### Scenario: Skill with frontmatter and two files

- **WHEN** the frontmatter carries `when_to_use` and `allowed_tools`, the metadata carries an author, and the file listing returns two files and one folder
- **THEN** the Overview shows a Specification section with a when-to-use row and an allowed-tools row, followed by a Details section with the author row, the updated row, and a file count of `2`

#### Scenario: Overview carries no file rows

- **WHEN** the file listing returns three files
- **THEN** the Overview shows a file count of `3` and no per-file rows

#### Scenario: Skill with no frontmatter

- **WHEN** the manifest has no frontmatter
- **THEN** no Specification section is rendered and the Details section renders unchanged

#### Scenario: Skill with no author

- **WHEN** the metadata carries no `author`
- **THEN** the author row is omitted rather than rendered with an empty or placeholder value

#### Scenario: Skill prompt is not duplicated

- **WHEN** the frontmatter carries `skill_prompt`
- **THEN** no Specification row renders it

---

### Requirement: i18n, RTL, accessibility, and caching contract for the skill details panel

- **i18n keys**: the existing `catalog.details.skill.section` (`'Skill'`, now the Details section title), `catalog.details.skill.author` (`'Author'`), `catalog.details.skill.updated` (`'Last updated'`), `catalog.details.skill.fileCount` (`'Files'`); plus `catalog.details.skill.specificationSection` (`'Specification'`), `catalog.details.skill.whenToUse` (`'When to use'`), `catalog.details.skill.allowedTools` (`'Allowed tools'`), `catalog.details.skill.bundledResources` (`'Bundled resources'`), `catalog.details.contentFileSelectorAriaLabel` (`'Select file'`), `catalog.details.contentFileCount` (`'{{count}} files'`), `catalog.details.contentFileLoading` (`'Loading file'`), and `catalog.details.contentFileError` (`'Failed to load this file.'`). All declared in `apps/chat/src/constants/translation-keys.ts` and `en.json`. Before adding any key, its English value SHALL be checked against `en.json` for an existing equivalent, per the duplicate-value rule. The lib receives resolved strings only — `libs/catalog` SHALL NOT call `useTranslation`.
- **App-level adapter contract**: `libs/catalog` receives the manifest body as an already-resolved `string` on `CatalogItemTabData.promptContent.content`, its summary on `promptContent.description`, the picker's options as resolved `{ id, name }` pairs on `promptContent.files`, and the Specification and Details rows as resolved label/value pairs on `overview`. Bucket names, the `SKILL.md` filename, the frontmatter key table, the YAML parser, the skills endpoints, the generated client, and the size cap all stay in `apps/chat`. The lib SHALL NOT gain a skill branch: the content-first set and the generic `files`/`onLoadContentFile` pair are its entire knowledge of the type.
- **RTL / direction impact**: the picker row SHALL use logical Tailwind utilities only. The Overview tab gains no new directional layout.
- **Accessibility**: the panel's existing `role="status"` loading indicator covers the fetch. Each file row's download control SHALL be a real `button` with an `aria-label` and an `aria-hidden` icon, and folder headings SHALL be exposed as headings for their row groups rather than as styled text alone.
- **Caching**: no new cache. Details are re-fetched each time the panel opens for a skill, and the manifest is re-parsed on each fetch; the parse is synchronous and bounded by `SKILL_MANIFEST_MAX_BYTES`.
- **Content safety**: `SKILL.md` and its frontmatter are arbitrary user-authored text. The body SHALL be rendered through the existing read-only markdown block, which does not execute or interpret markup; frontmatter values SHALL be rendered as plain text spec values, never as markdown or HTML.

#### Scenario: No hardcoded English in the lib

- **WHEN** the skill details and Content tab code in `libs/catalog` is inspected
- **THEN** it contains no `useTranslation` call and no skill-specific English label beyond the tab-label and aria-label defaults

#### Scenario: Frontmatter values are not interpreted

- **WHEN** a frontmatter `description` contains markdown or HTML
- **THEN** it renders as literal text in the Content summary and is not parsed as markup

#### Scenario: Details re-fetch on reopen

- **WHEN** a user closes and reopens the same skill's details panel
- **THEN** the manifest and file listing are requested again and the manifest is re-parsed
