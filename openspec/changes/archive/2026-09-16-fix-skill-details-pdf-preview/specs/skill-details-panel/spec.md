## MODIFIED Requirements

### Requirement: The skill's files populate the Content tab's hierarchical selector

The Skill branch SHALL build the selector's tree from the file listing through a new `buildSkillContentTree(files, skillPath)` in `apps/chat/src/utils/map-skill-to-catalog-item.ts` (replacing the flat picker's `buildSkillContentFiles`), and return it as `promptContent.files`. It SHALL set `promptContent.selectedFileId` to the manifest node's actual opaque listing id: `SKILL_MANIFEST_FILE` when Core returns file-relative paths, or the verbatim Core-prefixed listing path when Core returns paths such as `{skillPath}/files/SKILL.md`.

The manifest node SHALL be the file displayed by default every time a skill's details panel opens, regardless of how many supporting files the skill ships or how they are named — this is not merely a side effect of the sort rule below; it is a standalone requirement `promptContent.selectedFileId` exists specifically to satisfy. A skill with no supporting files (or exactly one file elsewhere in its tree) SHALL still open on the manifest's content, unaffected by whether a selector renders at all. Resolving the listing id SHALL recognise both file-relative metadata and the `{skillPath}/files/SKILL.md` shape used by other Core versions, while preserving the matched listing id verbatim so the selector can find and mark that exact tree node.

`buildSkillContentTree` SHALL reconstruct the folder hierarchy from the listing's flat, recursive result:

1. Every entry's listing path SHALL first be stripped of the skill's own path prefix and its internal `files` storage directory via a shared `stripSkillPathPrefix(rawPath, skillPath)` helper (the same normalization `resolveSkillFileDownloadPath` uses) before it contributes to the tree's structure. An entry whose path strips to nothing — the skill's own root, or the bare `files` directory itself — SHALL NOT become a node: neither the skill's own name nor a `files` folder SHALL ever appear as a wrapping node in the displayed tree, regardless of how many of the skill-path/`files` prefix layers Core's listing includes.
2. Every `nodeType: 'folder'` entry (whose stripped path is non-empty) SHALL become a `CatalogContentFolderNode`, including one with no files under it (an empty folder), so an empty grouping folder still appears in the tree. Its `id` is the stripped path.
3. Every `nodeType: 'item'` entry SHALL become a `CatalogContentFileNode`, using its **unstripped** listing path as `id` (so it round-trips back to `downloadSkillFile` without being re-derived) and its listing `name` (already a basename) as the node's `name`. Its position in the tree is determined by its stripped path.
4. A folder implied by an item's stripped path but not present as its own `nodeType: 'folder'` entry (an implicit intermediate folder) SHALL still be created and populated, so the tree is always fully connected from its roots down to every file, regardless of which intermediate folders the listing happened to enumerate explicitly.
5. Within each folder's `items` (and at the root), entries SHALL sort case-insensitively by name with folders and files interleaved, except that the manifest (whose `name` equals `SKILL_MANIFEST_FILE`) SHALL always be ordered first at the root, regardless of where it would otherwise sort or how its `id` is prefixed.

A failed file listing SHALL yield an empty tree (`files: []` or the field omitted), so no selector renders and the manifest body still shows.

#### Scenario: The skill's own path and internal files directory are never shown as folders

- **WHEN** the file listing returns `{skillPath}/files` as a `nodeType: 'folder'` entry, `{skillPath}/files/SKILL.md` as an item, and `{skillPath}/files/agents/analyzer.md` as an item, for a skill opened at `skillPath`
- **THEN** `promptContent.files` has two root entries — the `SKILL.md` file node and an `agents` folder node (not `{skillPath}` or `files`) — with `agents` containing one file node for `analyzer.md`, and the `SKILL.md`/`analyzer.md` file nodes' `id`s remain the unstripped listing paths

`CatalogView` SHALL supply `onLoadContentFile`. The catalog library SHALL pass the picked file node's opaque `id` to that callback unchanged. At the application edge, `CatalogView` SHALL convert a Core-prefixed listing id in either `{skillPath}/files/{relativeFilePath}` or `files/{relativeFilePath}` form into the `{relativeFilePath}` accepted by `downloadSkillFile`; an already-relative id SHALL remain unchanged. It SHALL then call the existing wrapper with the opened skill's `{ bucket, path }` and that normalized download path, and read the response through `readSkillManifest` so the same size cap applies to every file, regardless of nesting depth. A normalized path equal to `SKILL_MANIFEST_FILE` SHALL be returned frontmatter-stripped via `parseSkillManifest`; every other file SHALL be returned as written. No new endpoint, generated-client method, or `base.ts` helper is introduced.

`CatalogView` SHALL additionally supply `renderContentFilePreview`, per the host-renderer contract in `catalog-content-file-preview`. For a picked supporting file it SHALL render an app-owned `SkillDetailsFilePreview` that applies the same opaque-id-to-relative-download-path conversion, downloads the file's raw bytes through `downloadSkillFile`, reads the response body in full through a size-unbounded preview reader (the `SKILL_MANIFEST_MAX_BYTES` guard SHALL NOT be applied on this path), and converts `{ bytes, mimeType? }` with the shared `skillFileToAttachment` helper before resolving the preview through `useOpenAttachmentCanvas`. It SHALL render the result through the same `SkillFilePreview` used by Skill Builder. `SkillFilePreview` SHALL render the shared `AttachmentCanvasBody`, so Markdown, JSON, code/plain text, HTML, PDF, image, audio, visualizer, unsupported, loading, and error states use the identical renderer, labels, theme, and accessibility behavior in both surfaces.

The reusable `SkillFilePreview` component SHALL live under `apps/chat/src/components/SkillFilePreview/`; both Skill Builder and skill details SHALL import it. `useSkillFilePreviewSync`, under `apps/chat/src/hooks/attachment/`, SHALL remain the Skill Builder selection adapter. Skill details SHALL instead own isolated preview state through an `AttachmentCanvasProvider` keyed by the selected opaque file id. `libs/catalog` SHALL NOT import `@epam/ai-dial-attachment-canvas`, app contexts, the skills API, or the generated client. It receives only the opaque-id/basename render callback result.

When Core returns `Content-Type: application/octet-stream`, the details loader SHALL omit that generic MIME value so `skillFileToAttachment` performs the same extension inference as Skill Builder's ZIP-loaded files. A specific MIME type such as `image/png` SHALL be preserved. A `403` response SHALL resolve to the attachment canvas's forbidden state; other non-OK responses and network failures SHALL resolve to its load-error state. File size SHALL NOT be a failure class on this path — the preview reader has no byte ceiling, so no file resolves to the load-error state on account of its size.

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
- **THEN** the shared attachment resolvers open the file in the details preview's isolated canvas state and `AttachmentCanvasBody` renders its Markdown content

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

#### Scenario: A supporting file larger than the manifest cap still previews

- **WHEN** the user picks a supporting file whose declared `content-length` and actual byte length both exceed `SKILL_MANIFEST_MAX_BYTES` — for example a 2 MB `guide.pdf`
- **THEN** its bytes are read in full, `skillFileToAttachment` builds the `File`, the shared resolvers produce PDF canvas content backed by a `blob:` URL, and the load-error state is NOT rendered

#### Scenario: A realistic PDF renders on a freshly loaded page

- **WHEN** the user opens a skill's details and picks a PDF supporting file over `SKILL_MANIFEST_MAX_BYTES`, having opened no other PDF anywhere in the application since the page loaded
- **THEN** the preview resolves to PDF canvas content and the viewer mounts with the host's own bundled worker, without any dependency on a previously opened PDF or on an external CDN

#### Scenario: The manifest's own read path keeps its cap

- **WHEN** a skill's `SKILL.md`, or a file read through the textual `onLoadContentFile` path, exceeds `SKILL_MANIFEST_MAX_BYTES`
- **THEN** `readSkillManifest` still rejects it without decoding, exactly as before this change

---

## ADDED Requirements

### Requirement: The skill supporting-file preview supplies the host's PDF worker initializer

`SkillFilePreview` SHALL pass the application-owned `configurePdfWorker` from
`apps/chat/src/utils/pdf.ts` to `AttachmentCanvasBody`
(`apps/chat/src/components/SkillFilePreview/SkillFilePreview.tsx`), so every skill PDF
preview — Catalog skill details and Skill Builder alike — configures
`pdfjs-dist`'s `GlobalWorkerOptions.workerSrc` from the app's own bundled
worker asset before the viewer mounts, exactly as the page-level canvas in
`apps/chat/src/app/app.tsx` already does.

Without that prop, `PdfContent` initialises its preparation state to `Ready`
and mounts `DocumentPreview` immediately, leaving
`@epam/pdf-highlighter-kit`'s module-evaluation-time default in place:
`https://unpkg.com/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs`. Skill PDF
rendering then depends on outbound CDN access, or on the page-level chat
canvas having already run the initializer in the same page session. That
dependency is the defect this requirement removes.

The initializer SHALL remain application-owned:
`@epam/ai-dial-attachment-canvas` receives it only as an injected callback and
SHALL NOT import, construct, or default it. `apps/chat/src/utils/pdf.ts` SHALL
NOT change — both of its `pdfjs-dist` imports stay dynamic so the package
stays out of the eager bundle, and its module-level promise memoisation plus
`PdfContent`'s own module-level preparation promise together mean the
initializer runs at most once per successful resolution across every canvas in
the application.

Because `configurePdfWorker` is a module-level binding, its identity is
stable across renders and SHALL NOT cause `PdfContent`'s preparation effect to
re-run. `PdfContent`'s existing gate — `DocumentPreview` mounts only once the
preparation promise resolves — SHALL be relied upon unchanged; this
requirement adds no awaiting logic of its own.

#### Scenario: The inline skill preview forwards the app's initializer

- **WHEN** `SkillFilePreview` renders
- **THEN** the `configurePdfWorker` it passes to `AttachmentCanvasBody` is the app's `configurePdfWorker` from `apps/chat/src/utils/pdf.ts`

#### Scenario: The viewer does not mount before the worker is configured

- **WHEN** a PDF supporting file is previewed and the host's `configurePdfWorker` has not yet resolved
- **THEN** `DocumentPreview` is not mounted, and it mounts only after that promise resolves

#### Scenario: Rendering does not depend on a previously opened PDF

- **WHEN** a PDF supporting file is previewed on a freshly loaded page, with no chat attachment canvas having been opened
- **THEN** the worker is configured from the app's bundled asset and the vendor's CDN URL is not relied upon

#### Scenario: Worker preparation failure stays distinguishable from a load failure

- **WHEN** `configurePdfWorker` rejects
- **THEN** `PdfContent` renders its own retryable preparation-error state, not the canvas load-error ("Failed to load file") state, and the next preview attempt invokes the initializer again

#### Scenario: Non-PDF previews are unaffected

- **WHEN** a Markdown, JSON, code, HTML, image, audio, visualizer, or unsupported supporting file is previewed
- **THEN** the preview renders exactly as before, and `configurePdfWorker` is never invoked

### Requirement: The skill details PDF preview path carries integration-level regression coverage

The skill details PDF preview path SHALL carry regression coverage that reaches
the real application-to-viewer boundary.

The existing `SkillDetailsFilePreview` suite mocks
`apps/chat/src/components/SkillFilePreview/SkillFilePreview` away, so no test
reaches the real `AttachmentCanvasBody` from a skill surface and no test feeds
the preview loader a body over `SKILL_MANIFEST_MAX_BYTES`. Neither defect this
change fixes is observable through that suite.

Coverage SHALL therefore include at least one test that renders
`SkillDetailsFilePreview` with the **real** `SkillFilePreview`, using a valid,
parseable minimal PDF fixture padded past `SKILL_MANIFEST_MAX_BYTES`, and
asserts that the canvas resolves to PDF content backed by a `blob:` URL rather
than the load-error state, and that the `configurePdfWorker` reaching
`PdfContent` is the application's initializer and is awaited before the viewer
mounts.

Only `@epam/ai-dial-react-pdf-highlighter`'s `DocumentPreview` MAY be stubbed —
it requires a real worker and a canvas, which jsdom does not provide. The suite
SHALL NOT be described as proving that pdf.js rasterises the document; that
remains a browser-verification step.

#### Scenario: An over-cap PDF resolves to PDF content, not the load error

- **WHEN** the preview loader resolves bytes for a valid PDF larger than `SKILL_MANIFEST_MAX_BYTES`
- **THEN** the rendered canvas content is the PDF type with a `blob:` URL, and the text "Failed to load file" is absent

#### Scenario: The integration test would fail if the worker wiring were dropped

- **WHEN** `configurePdfWorker` is removed from `SkillFilePreview`
- **THEN** at least one test in the suite fails

#### Scenario: The fixture is a real PDF, not an opaque byte blob

- **WHEN** the test fixture is constructed
- **THEN** it is a structurally valid PDF (header, page object, `xref`, `%%EOF`) padded to exceed `SKILL_MANIFEST_MAX_BYTES`, so both the size path and a real parser's input contract are exercised

### Requirement: Existing preview isolation, race, and accessibility behaviour is preserved

This change SHALL NOT alter any of the following, and the implementation SHALL
be held to them:

- the `AttachmentCanvasProvider key={fileId}` isolation that keeps the inline
  preview independent of the page's attachment panel;
- `useSkillFilePreview`'s `cancelled`-flag guard, so a superseded or unmounted
  load never replaces the current preview;
- `SkillFilePreview`'s `isCurrent = attachmentId === path` staleness gate;
- blob URL creation and cleanup ownership;
- the `403` → forbidden classification, distinct from loading and from a
  genuine load failure;
- the inline preview's `role="group"` with an accessible name from the file
  name, and the existing loading announcement;
- the inline preview's behaviour at mobile and desktop widths, including that
  it owns its internal scrolling.

No new user-visible string is introduced, so there are no new i18n keys. RTL
impact: none — no new layout, positioning, or directional icon. The surface is
not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. No endpoint,
DTO, generated-client method, cache entry, rate limit, or telemetry event
changes.

#### Scenario: Switching files shows only the latest selection

- **WHEN** the user picks one supporting file and then another before the first download settles
- **THEN** only the second file's preview is displayed, and the first file's late resolution is discarded

#### Scenario: Reopening details shows the correct document

- **WHEN** the user closes the details panel and reopens it for the same or a different skill, then picks a PDF
- **THEN** the picked file's document is displayed, and no pending work from the closed preview reopens the panel or the global attachment canvas

#### Scenario: A forbidden file stays distinguishable from a failure

- **WHEN** `downloadSkillFile` responds `403` for a picked supporting file
- **THEN** the forbidden state renders, not the load-error state

#### Scenario: The inline preview fits mobile and desktop layouts

- **WHEN** skill details are opened at a mobile width and at a desktop width and a PDF is picked
- **THEN** the preview fits its container with no horizontal page overflow and scrolls internally
