# skill-details-panel Specification

## Purpose

Defines the skill details panel: how `Skill` joins `Prompt` as a content-first entity type in `libs/catalog`, how a skill's manifest and file listing resolve in parallel, how each half degrades independently, what the Overview section reports, and the panel's i18n, RTL, accessibility, caching, and content-safety contract.

## Requirements

### Requirement: `Skill` joins `Prompt` as a content-first entity type in `libs/catalog`

`libs/catalog/src/components/Details/DetailsPanel.tsx` decided the tab row with a single `item.type === CatalogEntityType.Prompt` equality check. That check SHALL be replaced by membership in a module-level `CONTENT_FIRST_ENTITY_TYPES` set containing `CatalogEntityType.Prompt` and `CatalogEntityType.Skill`.

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
- **THEN** the tab row is `Content` then `Overview`, exactly as before skills were added

#### Scenario: Other entity types are unchanged

- **WHEN** the details panel opens for a `Model`, `Agent`, or `Toolset` item
- **THEN** the tab row's first entry is still `About`

---

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

- **i18n keys**: the existing `catalog.details.skill.section` (`'Skill'`, now the Details section title), `catalog.details.skill.author` (`'Author'`), `catalog.details.skill.updated` (`'Last updated'`), `catalog.details.skill.fileCount` (`'Files'`); `catalog.details.skill.specificationSection` (`'Specification'`), `catalog.details.skill.whenToUse` (`'When to use'`), `catalog.details.skill.allowedTools` (`'Allowed tools'`), `catalog.details.skill.bundledResources` (`'Bundled resources'`), `catalog.details.contentFileSelectorAriaLabel` (`'Select file'`), `catalog.details.contentFileCount` (`'{{count}} files'`), `catalog.details.contentFileLoading` (`'Loading file'`), and `catalog.details.contentFileError` (`'Failed to load this file.'`); plus, from this revision, `catalog.details.contentFileUnsupported`, whose English value SHALL be the existing `attachmentCanvas.unsupportedLabel` string (`'Preview is not supported for this file'`) rather than a newly-authored duplicate. All declared in `apps/chat/src/constants/translation-keys.ts` and `en.json`. Before adding any key, its English value SHALL be checked against `en.json` for an existing equivalent, per the duplicate-value rule. The lib receives resolved strings only — `libs/catalog` SHALL NOT call `useTranslation`.
- **App-level adapter contract**: `libs/catalog` receives the manifest body as an already-resolved `string` on `CatalogItemTabData.promptContent.content`, its summary on `promptContent.description`, the selector's options as a resolved hierarchy of `{ type, id, name }` (folders additionally carrying nested `items`) on `promptContent.files`, and the Specification and Details rows as resolved label/value pairs on `overview`. For supporting files it receives a host-rendered `ReactNode` through `renderContentFilePreview(fileId, fileName)`. Bucket names, the `SKILL.md` filename, the distinction between an opaque Core listing id and the endpoint's file-relative `filePath`, the skills endpoint, raw bytes, MIME handling, attachment creation, app contexts, `useSkillFilePreviewSync`, and `AttachmentCanvasBody` all stay in `apps/chat`. The lib SHALL NOT gain a skill branch or an attachment-canvas dependency: it knows only that `files` is a tree and that the host can render a picked opaque id/basename pair.
- **RTL / direction impact**: the picker row SHALL use logical Tailwind utilities only. The Overview tab gains no new directional layout. The preview area introduces no new directional layout beyond what `catalog-content-file-preview` already specifies.
- **Accessibility**: the panel's existing `role="status"` loading indicator covers the fetch and, from this revision, a picked file's preview load. Folder headings SHALL be exposed as headings for their row groups rather than as styled text alone. The preview area's own accessibility contract (accessible file name, no focusable editing control, image `alt` text) is specified by `catalog-content-file-preview`.
- **Caching**: no new cache. Details are re-fetched each time the panel opens for a skill, and the manifest is re-parsed on each fetch; the parse is synchronous and bounded by `SKILL_MANIFEST_MAX_BYTES`. A picked file's preview is likewise re-requested each time it is picked — reselecting the base file is the one path that costs no request, unchanged from before this revision.
- **Content safety**: `SKILL.md` and its frontmatter are arbitrary user-authored text. The body SHALL be rendered through the existing read-only markdown block, which does not execute or interpret markup; frontmatter values SHALL be rendered as plain text spec values, never as markdown or HTML. A picked file's preview follows the same posture per its type, per `catalog-content-file-preview`.
- **Whole-skill download**: a skill's primary action, its Manage-menu placement (or absence, once promoted), its pending/disabled/`aria-busy` state, and the generic entity-type precedence that decides Download is Skill's primary action are specified by `catalog-primary-action`. The archive endpoint's verified existing contract, the `CatalogView` wiring (`handleDownload`'s Skill branch, `isDownloadVisible`'s Skill branch), filename resolution, and failure notification are specified by `skill-archive-download`. Neither capability adds a skill branch to `libs/catalog`; the skill branch lives entirely in `apps/chat/src/components/CatalogView/CatalogView.tsx`, the same file that already owns every other skill-specific decision this change makes.

#### Scenario: No hardcoded English in the lib

- **WHEN** the skill details and Content tab code in `libs/catalog` is inspected
- **THEN** it contains no `useTranslation` call and no skill-specific English label beyond the tab-label and aria-label defaults

#### Scenario: Frontmatter values are not interpreted

- **WHEN** a frontmatter `description` contains markdown or HTML
- **THEN** it renders as literal text in the Content summary and is not parsed as markup

#### Scenario: Details re-fetch on reopen

- **WHEN** a user closes and reopens the same skill's details panel
- **THEN** the manifest and file listing are requested again and the manifest is re-parsed

### Requirement: The Content tab shows the manifest's description as its summary

`libs/catalog/src/models/item-details-data.ts` SHALL add an optional `description` to `CatalogItemPromptContent`, and `DetailsPanel` SHALL render `ContentTab`'s `description` prop as `item.details?.promptContent?.description ?? item.description`.

The addition exists because a skill's summary is discovered by the details fetch, not by the list request: `mapSkillToCatalogItem` sets `description: ''` because skill metadata carries none. Prompts pass no `description` on `promptContent` and SHALL be unaffected — they keep rendering `item.description`.

The Skill branch of `onFetchDetails` SHALL set `promptContent.description` from the parsed manifest's `description` frontmatter field, omitting it when the field is absent, and SHALL set `promptContent.content` to the manifest **body** — the text after the frontmatter fence — rather than the raw file.

No `About` tab SHALL be restored for skills. `CatalogEntityType.Skill` stays in `CONTENT_FIRST_ENTITY_TYPES`. An About tab derived from a description that only exists after the fetch settles would appear mid-interaction and push `Content` one slot along while the user is reading it; the summary slot delivers the same text at the same moment without moving the tab row.

The manifest's parsed `name` field SHALL NOT be rendered anywhere in the Content tab — not in the summary, not in the body. The item's display name comes from `item.name` (set by `mapSkillToCatalogItem` from the skill's own metadata, independent of the manifest), and the parsed `name` field exists only because `parseSkillManifest` reads it; the Skill branch of `onFetchDetails` SHALL NOT thread it into `promptContent` at all.

A manifest that is nothing but frontmatter (no text after the closing fence) SHALL yield `promptContent.content` as an empty string — an empty-instructions state, distinct from an error: the manifest was read and parsed successfully, it simply describes no instructions.

#### Scenario: Manifest with a description

- **WHEN** a skill's `SKILL.md` frontmatter carries `description: Finds and cites sources`
- **THEN** the Content tab renders that text as its summary line above the divider, and the body below it

#### Scenario: Frontmatter is not rendered as body

- **WHEN** a skill's `SKILL.md` opens with a `---` fence
- **THEN** the Content tab body contains no `name:` or `description:` line and no heading or rule produced by the fence

#### Scenario: The parsed name field is never rendered as content

- **WHEN** a skill's `SKILL.md` frontmatter carries `name: revenue-finder`
- **THEN** neither the Content tab's summary nor its body contains the text `revenue-finder` as a consequence of the frontmatter parse (the item's own display name, shown in the panel header, is unaffected — it never came from the manifest)

#### Scenario: Manifest with no description

- **WHEN** the frontmatter carries no `description`
- **THEN** the Content tab renders no summary line and no divider, and the body renders unchanged

#### Scenario: Frontmatter-only manifest yields an empty-instructions body, not an error

- **WHEN** a skill's `SKILL.md` is entirely a `---`-delimited frontmatter block with no text after the closing fence
- **THEN** `promptContent.content` is `''`, the Content tab renders its existing empty-body state, and no error or notification appears

#### Scenario: Malformed frontmatter falls back to the whole file as body, not a second parser

- **WHEN** a skill's `SKILL.md` opens with a `---` fence whose YAML fails to parse
- **THEN** `promptContent.content` is the whole raw file text, exactly as `parseSkillManifest`'s existing degradation contract (see `skill-manifest-parsing`) already specifies, and no separate manifest parser is invoked to attempt a second parse

#### Scenario: Prompt content is unaffected

- **WHEN** a prompt's details panel opens
- **THEN** its Content tab summary is `item.description`, exactly as before

#### Scenario: Skill still opens on Content

- **WHEN** a skill's details panel opens
- **THEN** the tab row's first entry is `Content` and no `About` tab is rendered, before and after details resolve

#### Scenario: No Skill Builder control appears in the details panel

- **WHEN** a skill's details panel is open, on `SKILL.md` or on any picked supporting file
- **THEN** no editable form field, no frontmatter editor, and no Skill Builder action (save, validate, publish, upload) is rendered anywhere in the panel

---

### Requirement: The skill's files populate the Content tab's hierarchical selector

The Skill branch SHALL build the selector's tree from the file listing through a new `buildSkillContentTree(files)` in `apps/chat/src/utils/map-skill-to-catalog-item.ts` (replacing the flat picker's `buildSkillContentFiles`), and return it as `promptContent.files`. It SHALL set `promptContent.selectedFileId` to the manifest node's actual opaque listing id: `SKILL_MANIFEST_FILE` when Core returns file-relative paths, or the verbatim Core-prefixed listing path when Core returns paths such as `{skillPath}/files/SKILL.md`.

The manifest node SHALL be the file displayed by default every time a skill's details panel opens, regardless of how many supporting files the skill ships or how they are named — this is not merely a side effect of the sort rule below; it is a standalone requirement `promptContent.selectedFileId` exists specifically to satisfy. A skill with no supporting files (or exactly one file elsewhere in its tree) SHALL still open on the manifest's content, unaffected by whether a selector renders at all. Resolving the listing id SHALL recognise both file-relative metadata and the `{skillPath}/files/SKILL.md` shape used by other Core versions, while preserving the matched listing id verbatim so the selector can find and mark that exact tree node.

`buildSkillContentTree` SHALL reconstruct the folder hierarchy from the listing's flat, recursive result:

1. Every `nodeType: 'folder'` entry SHALL become a `CatalogContentFolderNode`, including one with no files under it (an empty folder), so an empty grouping folder still appears in the tree.
2. Every `nodeType: 'item'` entry SHALL become a `CatalogContentFileNode`, using its listing path as `id` and its listing `name` (already a basename) as the node's `name`.
3. A folder implied by an item's path but not present as its own `nodeType: 'folder'` entry (an implicit intermediate folder) SHALL still be created and populated, so the tree is always fully connected from its roots down to every file, regardless of which intermediate folders the listing happened to enumerate explicitly.
4. Within each folder's `items` (and at the root), entries SHALL sort case-insensitively by name with folders and files interleaved, except that the manifest (`SKILL_MANIFEST_FILE`) SHALL always be ordered first at the root, regardless of where it would otherwise sort.

A failed file listing SHALL yield an empty tree (`files: []` or the field omitted), so no selector renders and the manifest body still shows.

`CatalogView` SHALL supply `onLoadContentFile`. The catalog library SHALL pass the picked file node's opaque `id` to that callback unchanged. At the application edge, `CatalogView` SHALL convert a Core-prefixed listing id in either `{skillPath}/files/{relativeFilePath}` or `files/{relativeFilePath}` form into the `{relativeFilePath}` accepted by `downloadSkillFile`; an already-relative id SHALL remain unchanged. It SHALL then call the existing wrapper with the opened skill's `{ bucket, path }` and that normalized download path, and read the response through `readSkillManifest` so the same size cap applies to every file, regardless of nesting depth. A normalized path equal to `SKILL_MANIFEST_FILE` SHALL be returned frontmatter-stripped via `parseSkillManifest`; every other file SHALL be returned as written. No new endpoint, generated-client method, or `base.ts` helper is introduced.

`CatalogView` SHALL additionally supply `renderContentFilePreview`, per the host-renderer contract in `catalog-content-file-preview`. For a picked supporting file it SHALL render an app-owned `SkillDetailsFilePreview` that applies the same opaque-id-to-relative-download-path conversion, downloads the file's raw bytes through `downloadSkillFile`, applies the shared `SKILL_MANIFEST_MAX_BYTES` guard, and feeds `{ bytes, mimeType? }` into the same `useSkillFilePreviewSync` and `SkillFilePreview` used by Skill Builder. `SkillFilePreview` SHALL render the shared `AttachmentCanvasBody`, so Markdown, JSON, code/plain text, HTML, PDF, image, audio, visualizer, unsupported, loading, and error states use the identical renderer, labels, theme, and accessibility behavior in both surfaces.

The reusable `SkillFilePreview` component SHALL live under `apps/chat/src/components/SkillFilePreview/`, and `useSkillFilePreviewSync` under `apps/chat/src/hooks/attachment/`; both Skill Builder and skill details SHALL import those shared app-level modules. `libs/catalog` SHALL NOT import `@epam/ai-dial-attachment-canvas`, app contexts, the skills API, or the generated client. It receives only the opaque-id/basename render callback result.

When Core returns `Content-Type: application/octet-stream`, the details loader SHALL omit that generic MIME value so `skillFileToAttachment` performs the same extension inference as Skill Builder's ZIP-loaded files. A specific MIME type such as `image/png` SHALL be preserved. A `403` response SHALL resolve to the attachment canvas's forbidden state; other non-OK responses, network failures, and oversized files SHALL resolve to its load-error state.

`SKILL_MANIFEST_FILE` SHALL never enter the supporting-file renderer. It SHALL continue to render `parseSkillManifest(...).body` through the base Content Markdown path — frontmatter-stripped instructions only — and reselecting it SHALL restore that body without a download.

#### Scenario: SKILL.md is the default displayed file, regardless of the skill's other files

- **WHEN** a skill's details panel opens, whether the skill has zero, one, or many supporting files
- **THEN** `promptContent.selectedFileId` equals the manifest tree node's opaque listing id and the Content tab's trigger names `SKILL.md`, its matching tree row is selected, and the body shows the manifest's parsed instructions before the user picks anything

#### Scenario: Core prefixes the manifest listing path

- **WHEN** the file listing identifies the manifest as `{skillPath}/files/SKILL.md` rather than the relative `SKILL.md`
- **THEN** `promptContent.selectedFileId` preserves that prefixed path verbatim, the selector trigger still names `SKILL.md`, and the corresponding tree row carries the selected state when the panel first opens

#### Scenario: A flat listing becomes a tree

- **WHEN** the file listing resolves `SKILL.md`, a `nodeType: 'folder'` entry for `agents`, and an `nodeType: 'item'` entry for `agents/analyzer.md`
- **THEN** `promptContent.files` has two root entries — the `SKILL.md` file node and the `agents` folder node — with `agents` containing one file node for `analyzer.md`

#### Scenario: An implicit intermediate folder is still created

- **WHEN** the listing includes a `nodeType: 'item'` entry at `scripts/tools/run.py` but no `nodeType: 'folder'` entry for `scripts/tools`
- **THEN** the tree still contains a `scripts` folder node containing a `tools` folder node containing the `run.py` file node

#### Scenario: An empty folder still appears

- **WHEN** the listing includes a `nodeType: 'folder'` entry for `assets` and no `nodeType: 'item'` entry whose path starts with `assets/`
- **THEN** the tree contains an `assets` folder node with an empty `items` array

#### Scenario: Manifest heads the root regardless of sort order

- **WHEN** the listing returns a `scripts` folder, an `analyzer.md` file, and `SKILL.md`, all at the root
- **THEN** the root entries are ordered `SKILL.md`, `analyzer.md`, `scripts`

#### Scenario: Duplicate basenames in different folders both resolve correctly

- **WHEN** the listing includes `agents/run.py` and `scripts/run.py`
- **THEN** the tree contains two distinct file nodes named `run.py`, one under each folder, each carrying its own full path as `id`

#### Scenario: Listing failure yields no selector

- **WHEN** `listSkillFiles` rejects and the manifest read resolves
- **THEN** `promptContent.files` is empty and the manifest body still renders

#### Scenario: Loading a picked nested file

- **WHEN** the user picks the file node at `scripts/run.py`
- **THEN** `downloadSkillFile` is called with the opened skill's bucket and path and `'scripts/run.py'` as the file path, and the file's text is rendered as written

#### Scenario: Loading a file whose listing id includes the Core files root

- **WHEN** the opened skill path is `address-current-branch-review` and the picked node's opaque listing id is `address-current-branch-review/files/openai.yaml`
- **THEN** the selector passes that id to the host renderer unchanged, but `CatalogView` calls `downloadSkillFile` with `openai.yaml` as `filePath`, and the shared Skill Builder pipeline receives `openai.yaml` as the file name for type inference

#### Scenario: A picked Markdown supporting file previews as markdown

- **WHEN** the user picks a supporting file named `notes.md`
- **THEN** the file is opened through the shared Skill Builder synchronization and `AttachmentCanvasBody` renders its Markdown content

#### Scenario: A picked source file previews as syntax-highlighted text

- **WHEN** the user picks a supporting file named `run.py`
- **THEN** the shared Skill Builder pipeline resolves it as code with language `python`, and `AttachmentCanvasBody` renders it with the same theme and controls as Skill Builder

#### Scenario: A picked image supporting file previews inline

- **WHEN** the user picks a supporting file named `diagram.png`
- **THEN** `AttachmentCanvasBody` renders the same contained image preview and image-error state as Skill Builder

#### Scenario: A picked unsupported supporting file previews as unsupported, not garbled text

- **WHEN** the user picks a supporting file with an extension neither an image type nor text-previewable
- **THEN** the shared Skill Builder pipeline produces its unsupported content state and `AttachmentCanvasBody` renders the shared unsupported label

#### Scenario: SKILL.md always previews as its instructions, never through the supporting-file renderer

- **WHEN** the user reselects the manifest tree node, whether its opaque id is `SKILL_MANIFEST_FILE` or a Core-prefixed path, after viewing another file
- **THEN** the base body (the manifest's parsed instructions) is restored without mounting `SkillDetailsFilePreview` or downloading the manifest again

#### Scenario: The manifest's own size guard still applies to every other file

- **WHEN** a supporting file's declared or actual size exceeds `SKILL_MANIFEST_MAX_BYTES`
- **THEN** its bytes are never decoded or turned into a `Blob`, and the shared attachment body renders the same load-error state as Skill Builder

---