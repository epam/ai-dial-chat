## MODIFIED Requirements

### Requirement: A skill's details resolve from its manifest and its file listing in parallel

The Skill branch of `CatalogView`'s `onFetchDetails` SHALL parse `{ bucket, path }` from `item.id` with `parseSkillResourceUrl` and issue three requests through `Promise.allSettled`:

1. `downloadSkillFile(bucket, path, 'SKILL.md')` — the manifest filename the backend already treats as required for every skill. The returned `Response` body SHALL be read as text and rejected without decoding when it exceeds `SKILL_MANIFEST_MAX_BYTES` (initially 256 KB).
2. `listSkillFiles(bucket, path, { recursive: true })` — the skill's own file inventory.
3. `getSkillMetadata(bucket, path)` — the skill resource's own authoritative metadata (`GET /api/v1/skills/metadata`; see the `skills-bff-api` delta). This request SHALL be issued on **every** details open, including reopening the same skill and opening it after a full page reload, so provenance never depends on data a prior invitation acceptance happened to leave in memory.

All three wrappers are the existing ones in `apps/chat/src/server-api/skills.api.ts`, which call the generated `SkillsApi`. `downloadSkillFile` uses the generated `Raw` method (it returns the native `Response`, preserving stream semantics); `listSkillFiles` and `getSkillMetadata` use the normal generated methods. No new `base.ts` helper and no direct `fetch` is introduced.

A manifest that reads successfully SHALL then be passed through `parseSkillManifest`, whose output feeds three parts of the result: `promptContent.content` from the body, `promptContent.description` from the frontmatter `description`, and the Overview's Specification section from `about`.

A file listing that resolves SHALL feed two parts of the result: the Overview's Details section (the file count) and the Content tab's picker options.

A metadata response that resolves SHALL be the authoritative source for the Overview's Author and Last updated rows. The catalog listing entry (`skills.find((candidate) => candidate.url === item.id)`) MAY still seed the panel's first paint and SHALL remain the fallback when the metadata request rejects, but SHALL NOT be the sole source of provenance. Ownership and editability SHALL continue to come from the listing entry and its namespace — the metadata response carries no ownership fields and SHALL NOT be consulted for them.

The branch SHALL return early, before any deployment path: a skill MUST NOT trigger `getDeploymentDetails` or `getDeploymentLimits`, since neither endpoint accepts a skill resource URL.

Both skill-details surfaces SHALL follow this one contract through the shared `useSkillItemDetails` hook — the Catalog page (via `useCatalogItemDetails`) and the chat-route panel (via `useSkillDetailsPanelData`) — with no duplicate detail-fetching logic in either.

Catalog loading SHALL NOT gain any per-skill metadata request: `GET /api/v1/skills/catalog` stays a single aggregate request, and `getSkillMetadata` is issued only when a details panel opens.

An unparseable `item.id` SHALL resolve `undefined` without issuing any request.

#### Scenario: All three requests succeed

- **WHEN** a user opens a skill's details panel, the manifest read resolves text with frontmatter, the file listing resolves three files, and the metadata request resolves with an author and an update timestamp
- **THEN** `onFetchDetails` resolves `promptContent` carrying the body, the frontmatter description, and three picker options, plus an `overview` with a Specification section and a Details section whose Author and Last updated rows come from the metadata response

#### Scenario: Shared skill opened after a full page reload

- **WHEN** a skill shared with the user is opened in a fresh session, and `GET /api/v1/skills/catalog` returned that skill without `author` or `updatedAt`
- **THEN** the metadata request supplies both and the Overview renders populated Author and Last updated rows, with no reliance on invitation-merged state

#### Scenario: Reopening requests fresh metadata

- **WHEN** the user closes a skill's details panel and opens the same skill again
- **THEN** a new `getSkillMetadata` request is issued for that skill

#### Scenario: Rerenders do not loop

- **WHEN** the open panel rerenders because a favorite was toggled or the skills listing was refreshed, without the opened skill changing
- **THEN** no additional `getSkillMetadata` request is issued

#### Scenario: Catalog loading issues no per-skill requests

- **WHEN** the catalog loads its skills
- **THEN** `getSkillMetadata` is not called for any listed skill

#### Scenario: Both detail surfaces behave identically

- **WHEN** the same shared skill's details are opened from the Catalog page and from the chat route's skill panel
- **THEN** both issue the metadata request and render the same Author and Last updated values

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

Each of the three results SHALL be independent in the returned `CatalogItemTabData`:

- A missing, oversized, or failed `SKILL.md` read SHALL omit `promptContent` entirely — and with it the picker, which lives on `promptContent` — and still return the `overview` built from the file listing. The `Content` tab is still present (per the content-first requirement) and renders the panel's existing empty state.
- A failed file listing SHALL omit `overview` and leave `promptContent.files` empty — so no picker renders — while still returning the manifest body and, when the frontmatter resolved, its description. A successful metadata response SHALL NOT resurrect an `overview` the file listing could not build, because the file-count row has no source.
- A failed metadata request SHALL NOT discard successfully loaded content: `promptContent` and `overview` still render from whatever resolved, and only the Author and Last updated rows fall back to the catalog listing entry.
- All three failing SHALL resolve `undefined`, leaving the panel's existing error/empty handling in place.

"Metadata unavailable" and "authoritative metadata that legitimately omits a field" SHALL be distinguishable and behave differently. A **rejected** metadata request falls back to the listing entry. A **fulfilled** metadata response is authoritative: an absent `author` omits the author row, and an absent `updatedAt` leaves the updated row's value empty — the listing entry SHALL NOT be consulted to fill either gap.

A manifest that downloads but fails to parse is **not** a failure of any of the three: the raw text SHALL still be returned as `promptContent.content`, with no `description` and no Specification section. Parse failure SHALL NOT be escalated to fetch failure and SHALL NOT surface a notification. A metadata rejection likewise SHALL NOT surface a notification.

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

#### Scenario: Metadata request fails while content loads

- **WHEN** `getSkillMetadata` rejects but the manifest and file listing both resolve
- **THEN** the Content tab, the Specification section, and the file count all render, the Author and Last updated rows fall back to the catalog listing entry, no notification appears, and nothing throws

#### Scenario: Metadata succeeds while the file listing fails

- **WHEN** `getSkillMetadata` resolves and `listSkillFiles` rejects
- **THEN** `overview` is still omitted and the panel renders the manifest body only

#### Scenario: Authoritative metadata with no author

- **WHEN** `getSkillMetadata` resolves successfully with no `author`, while the catalog listing entry for the same skill carries one
- **THEN** the author row is omitted rather than filled from the listing entry

#### Scenario: Malformed frontmatter

- **WHEN** the manifest downloads but its frontmatter fails to parse
- **THEN** the Content tab renders the whole file as its body, no summary line is shown, the Overview has no Specification section, and no notification appears

#### Scenario: All three fail

- **WHEN** the manifest read, the file listing, and the metadata request all reject
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

1. `catalog.details.skill.author` → the skill's `author`, included only when the resolved metadata carries one.
2. `catalog.details.skill.updated` → `formatCalendarDate(updatedAt)` (an absolute calendar date, e.g. `'22/7/2026'` — not the relative `formatLastUsed` phrasing used for catalog list rows). The row is always present; its value is an empty string when no timestamp resolved.
3. `catalog.details.skill.fileCount` → the number of `nodeType: 'item'` entries returned by the file listing.

`author` and `updatedAt` SHALL come from the `getSkillMetadata` response when that request fulfilled, and from the catalog listing entry only when it rejected. Neither value SHALL be invented or derived from any other source: not from `SKILL.md` or another supporting file's own file-level `author`/`updatedAt`, not from the current user, not from the share sender, and not from the current time. No placeholder text is rendered in place of a missing value.

Per-file rows SHALL NOT appear in the Overview. The files are enumerated by the Content tab's picker, where selecting one shows it; repeating them as inert `{ label, value }` rows would be the same list twice, once without an action.

File-listing entries with `nodeType: 'folder'` SHALL be excluded from the count. Sizes are not shown: `SkillMetadataItemDto` exposes no content-length field.

No new i18n keys are introduced: `catalog.details.skill.author` and `catalog.details.skill.updated` already exist. RTL/direction impact: none — the Overview rows already use logical properties and their layout, ordering, and icons are unchanged. Accessibility impact: none — the rows keep their existing markup and labelling; no new interactive control, ARIA role, or keyboard affordance is added.

#### Scenario: Skill with frontmatter and two files

- **WHEN** the frontmatter carries `when_to_use` and `allowed_tools`, the metadata response carries an author, and the file listing returns two files and one folder
- **THEN** the Overview shows a Specification section with a when-to-use row and an allowed-tools row, followed by a Details section with the author row, the updated row, and a file count of `2`

#### Scenario: Provenance comes from the metadata response, not the listing

- **WHEN** the catalog listing entry for a shared skill carries no `author` or `updatedAt`, and `getSkillMetadata` resolves with both
- **THEN** the Details section renders both values from the metadata response

#### Scenario: Overview carries no file rows

- **WHEN** the file listing returns three files
- **THEN** the Overview shows a file count of `3` and no per-file rows

#### Scenario: Skill with no frontmatter

- **WHEN** the manifest has no frontmatter
- **THEN** no Specification section is rendered and the Details section renders unchanged

#### Scenario: Skill with no author

- **WHEN** the resolved metadata carries no `author`
- **THEN** the author row is omitted rather than rendered with an empty or placeholder value

#### Scenario: `SKILL.md`'s own file metadata is never substituted

- **WHEN** the file listing's `SKILL.md` entry carries its own `author` and `updatedAt`
- **THEN** neither value reaches the Details section

#### Scenario: Skill prompt is not duplicated

- **WHEN** the frontmatter carries `skill_prompt`
- **THEN** no Specification row renders it
