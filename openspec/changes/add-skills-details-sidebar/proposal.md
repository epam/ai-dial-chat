# Enrich the skill details sidebar: parsed manifest, Specification, and a browsable Files tab

## Why

The skill details sidebar already exists — `libs/catalog/src/components/Details/DetailsPanel.tsx` is a right-side slide-in panel (`desktop:w-[540px]`), and `CONTENT_FIRST_ENTITY_TYPES` at `DetailsPanel.tsx:61-64` already opens a skill on **Content** with an **Overview** beside it. What it shows is thin, and in two places wrong:

1. **The manifest is dumped raw.** `CatalogView.tsx:441-450` reads `SKILL.md` and hands the whole file to `ContentTab`, which renders it through `MarkdownRenderer`. That renderer registers only `remarkGfm` (`libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx:144-145`) — no `remark-frontmatter` — so a skill's YAML frontmatter is rendered as body content. Under CommonMark the closing `---` turns the last frontmatter line into a setext `<h2>`, so a user opening any skill sees `name: …` / `description: …` as a heading before the actual instructions begin.

2. **The typed manifest model is dead code.** `SkillAboutDetails` (`apps/chat/src/types/entity-details.ts:256-261`) already declares exactly the fields a skill manifest carries — `whenToUse`, `allowedTools`, `bundledResources`, `skillPrompt` — and `mapSkillDetails` (`apps/chat/src/utils/map-entity-details-to-catalog.ts:480-508`) already maps them into a "Specification" Overview section. Nothing reaches either one: `EntitySpecificDetails` is built only by `mapDeploymentDetailsDtoToEntityDetails`, and the skill branch returns at `CatalogView.tsx:435-464` before any deployment path. A grep for `type: 'SKILL'` finds one hit — the union declaration itself.

3. **Files are not browsable.** `buildSkillOverview` (`apps/chat/src/utils/map-skill-to-catalog-item.ts:83-119`) flattens author, last-updated, file count, and one row per file into a single flat spec list titled "Skill", each file rendered as `label: <full path>` / `value: <last updated>`. There is no grouping, no size, and no way to read or retrieve a file. A dedicated Files tab was an explicit non-goal of `add-skill-catalog-listing` "until file-level actions exist" — this change is where they exist.

## What Changes

- **`apps/chat`: a skill-manifest parser.** A new `apps/chat/src/utils/skill-manifest.ts` splits a `SKILL.md` string into its YAML frontmatter and its body, and maps recognised frontmatter keys onto the existing `SkillAboutDetails` shape. Both `snake_case` / `kebab-case` and `camelCase` spellings are accepted for each key, list values are accepted in flow (`[a, b]`) and block (`- a`) form, and unrecognised keys are ignored rather than surfaced. A file with no frontmatter, or with malformed YAML, degrades to "body only" — the panel never loses the manifest text because its header failed to parse.
- **`yaml` moves from `devDependencies` to `dependencies`** in the root `package.json` (currently `2.8.3`, dev-only). Hand-rolling YAML for the frontmatter subset is the alternative and is rejected below.
- **`apps/chat`: the Content tab shows prose, not frontmatter.** The skill branch of `onFetchDetails` passes the parsed **body** as `promptContent.content` and the frontmatter `description` as a new `promptContent.description`. `ContentTab` already renders a summary above a divider (`Content.tsx:33-42`); today it is fed `item.description`, which the skill list mapper hard-codes to `''` (`map-skill-to-catalog-item.ts:56`).
- **`libs/catalog`: `CatalogItemPromptContent` gains an optional `description`**, and `DetailsPanel` prefers it over `item.description` when rendering `ContentTab`. This is the only way a host can attach a summary that is discovered by the details fetch rather than by the list request; it is additive and prompts are unaffected.
- **`apps/chat`: the Overview tab gains a Specification section.** `buildSkillOverview` splits its single "Skill" section into **Specification** (when to use, allowed tools, bundled resources — each row omitted when absent) followed by **Details** (author, last updated, file count). The per-file rows leave Overview entirely; they move to the Files tab.
- **`libs/catalog`: a Files tab.** A new `CatalogItemFiles` field on `CatalogItemTabData` drives a `FilesTab` rendering the item's file inventory grouped by folder path, each row showing the file name, its last-updated stamp, and a download `GhostIconButton` wired to an `onDownloadFile(fileId)` callback. The tab appears only when `details.files` is present, exactly like every other tab, and the lib learns nothing about buckets, skills, or endpoints — it receives resolved rows and calls back with an opaque id.
- **`apps/chat`: `onDownloadFile` resolves through `downloadSkillFile`.** `CatalogView` maps the callback onto the existing wrapper (`apps/chat/src/server-api/skills.api.ts:59`); no new endpoint and no new `base.ts` helper.
- **`apps/chat`: the dead deployment-shaped skill path is removed.** `mapSkillDetails` and the `{ type: 'SKILL' }` member of `EntitySpecificDetails` are deleted; `SkillAboutDetails` and `SkillEntityDetails` survive as the parser's output type, moved next to the other skill types in `apps/chat/src/types/skill.ts`. Deleting a mapper nothing calls is not scope creep — leaving two skill-detail mappers, one live and one unreachable, is how the next reader wires the wrong one.
- **The tab row for a skill stays stable.** No About tab is restored: the parsed description arrives only after `onFetchDetails` settles, so an About tab derived from it would appear mid-interaction and shift the tab the user is looking at. `Skill` stays in `CONTENT_FIRST_ENTITY_TYPES`, the description lands in Content's summary slot instead, and Files is pushed only once details resolve — after the selected tab, so the selection never moves.
- **i18n**: roughly eight new keys (the Specification section and its three rows, the Files tab label, the download-file action label and its error). Existing `catalog.details.skill.*` keys are reused; `catalog.details.skill.section` is repurposed as the Details section title.
- **Non-breaking.** Every lib addition is an optional field or an optional callback; every app change is inside the skill branch. `OverlayFeature.Skills` still switches the whole surface off.

### Non-goals

- **No file preview.** A file row downloads; it does not open a viewer. `SKILL.md` is the only file whose text this change reads.
- **No skill mutations.** Upload, delete, and grouping-folder writes stay uncalled, and `isEditable` stays `false` for every skill.
- **No backend change.** `apps/chat-api/src/skills/` already exposes listing, file listing, and per-file download; the frontmatter is parsed client-side from the file the panel already fetches.
- **No frontmatter for prompts.** Prompt content keeps rendering exactly as it does today.
- **No skills tab outside the catalog**, no `/skills` route, and no "use in chat" for a skill.

### Alternatives considered

1. **Hand-roll a frontmatter parser instead of shipping `yaml`.** Rejected. The frontmatter is authored by users, and the failure mode of a hand-rolled parser is silently wrong values (a quoted string containing `:`, a multi-line block scalar, an escaped list item) rather than a clean parse error. `yaml` is already vendored in the lockfile and only loads inside the catalog chunk. If the bundle cost measures badly in task 6.1, the fallback is a dynamic `import('yaml')` inside the skill branch, not a bespoke parser.
2. **Parse the manifest on the backend and return a typed DTO.** Rejected for this change: it adds a skills-details endpoint plus an OpenAPI regeneration cycle to save a parse of a file the frontend already downloads. Worth revisiting if a second consumer needs the parsed manifest.
3. **Restore the About tab for skills now that a description exists.** Rejected: see the tab-stability point above. The summary slot in `ContentTab` shows the same text without moving the tab row.
4. **Keep the file rows in Overview and skip the Files tab.** Rejected: it is what exists today, and it does not answer "browsable" — a flat `label: path` list with no grouping and no action is a manifest of filenames, not a file browser.
5. **Add a generic `remark-frontmatter` plugin to `MarkdownRenderer` instead of stripping the fence in the app.** Rejected: that hides the frontmatter from every markdown surface in the product, including assistant output where a leading `---` is legitimately a rule. The strip belongs to the skill branch that knows the file is a manifest.

### Rollback / backward-compat

Every piece is additive and independently revertible. Reverting the `libs/catalog` commit leaves the app passing a `description` and `files` the lib ignores — degraded, not broken. Reverting the app commit leaves the lib with two optional fields no host populates, so no tab is derived. Turning `OverlayFeature.Skills` off removes the whole surface as it does today. The one non-additive step is deleting `mapSkillDetails`, which no code path reaches.

## Capabilities

### New Capabilities

- `skill-manifest-parsing`: the `SKILL.md` frontmatter/body split — accepted keys and their alias spellings, list value forms, the size guard's interaction with the parse, and the degradation contract for a missing, malformed, or frontmatter-only manifest.
- `catalog-details-files-tab`: the lib's `CatalogItemFiles` model, the Files tab's position in the tab row, folder grouping, row content, the `onDownloadFile` callback contract, and the tab's i18n, RTL, and accessibility requirements.

### Modified Capabilities

- `skill-details-panel`: the skill branch now parses the manifest before mapping it, feeds Content a body plus a description, splits the Overview into Specification and Details, and populates the Files tab. `CatalogItemPromptContent.description` is added and `DetailsPanel` prefers it over `item.description`.

## Impact

**Libraries**

- `libs/catalog`: `models/item-details-data.ts` (`CatalogItemPromptContent.description`, `CatalogItemFiles`), `models/item-details-props.ts` (`onDownloadFile`, Files tab texts), `types/detail-tab.ts` (`CatalogDetailsTab.Files`), `components/Details/DetailsPanel.tsx` (tab derivation + render), new `components/Details/TabsContent/Files.tsx`.

**Application**

- `apps/chat/src/utils/skill-manifest.ts` (new), `apps/chat/src/utils/map-skill-to-catalog-item.ts` (`buildSkillOverview` split, new `buildSkillFiles`), `apps/chat/src/utils/map-entity-details-to-catalog.ts` (`mapSkillDetails` removed), `apps/chat/src/types/entity-details.ts` (`SKILL` union member removed), `apps/chat/src/types/skill.ts` (manifest types), `apps/chat/src/components/CatalogView/CatalogView.tsx` (skill branch, `onDownloadFile`, details texts), `apps/chat/src/constants/translation-keys.ts` + `i18n/locales/en.json`.

**Dependencies**

- Root `package.json`: `yaml@2.8.3` moves `devDependencies` → `dependencies`.

**Backend**

- None. No endpoint, DTO, or OpenAPI change; `npm run openapi:check` stays green.

## Acceptance criteria

1. Opening a skill whose `SKILL.md` starts with a `---` fence shows the description as the Content tab's summary line and the body below it, with no `name:` / `description:` text and no stray heading or rule from the fence.
2. Opening a skill whose `SKILL.md` has no frontmatter shows the whole file as the body and no summary line — unchanged from today apart from the absent summary.
3. A manifest with malformed YAML in its fence still renders its body; the panel logs nothing user-visible and shows no Specification rows.
4. The Overview tab shows a **Specification** section listing only the frontmatter fields that are present, followed by a **Details** section with author (omitted when absent), last updated, and file count. No file rows remain in Overview.
5. The Files tab appears for a skill with at least one file, lists files grouped under their folder path with grouping-folder entries excluded, and does not appear when the file listing failed.
6. Clicking a file's download button calls `downloadSkillFile` with that file's bucket and path; a rejection surfaces one notification and leaves the panel open.
7. The tab the panel opens on does not change as details resolve, for a skill or for a prompt.
8. `npm exec nx test catalog`, `npm exec nx test chat`, `npm exec nx lint catalog`, `npm exec nx lint chat`, and `npm exec nx build chat` all pass; `mapSkillDetails` and `type: 'SKILL'` no longer appear anywhere in `apps/chat/src`.
