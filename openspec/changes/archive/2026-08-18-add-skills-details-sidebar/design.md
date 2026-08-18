## Context

The skill details sidebar shipped in `add-skill-catalog-listing` (archived 2026-08-13). Its scope was deliberately minimal: get skills visible, read `SKILL.md`, list the files, ship nothing that needs a new lib component. Two of its own tasks are still open — `8.3` (manual verification against a running stack) and `8.5` (whether the `public` skills bucket exists in target deployments) — and neither blocks this change.

What that change left behind is a panel that shows a skill's manifest verbatim and its files as inert rows:

- `CatalogView.tsx:435-464` — the skill branch: `downloadSkillFile(bucket, path, 'SKILL.md')` and `listSkillFiles({ recursive: true })` through `Promise.allSettled`, mapped to `{ promptContent, overview }`.
- `map-skill-to-catalog-item.ts:83-119` — `buildSkillOverview`, one flat section.
- `DetailsPanel.tsx:392-449` — the tab derivation: a tab exists iff its `item.details.*` field is non-null, except Content, which a content-first type always gets.

Three constraints shape everything below.

**Library isolation.** `libs/catalog` may not learn what a skill is, what a bucket is, or that `SKILL.md` exists. It takes resolved rows and returns opaque ids through callbacks. Every decision here that could have been "add a skill branch to the lib" is instead "add a generic field the app populates".

**Tab-row stability.** `DetailsPanel` deliberately keeps a content-first type's Content tab present before details resolve (`DetailsPanel.tsx:401-411`) so the opening tab never shifts under the user. Anything this change adds to the tab row has to respect that.

**The manifest is user-authored.** A skill's `SKILL.md` is written by whoever uploaded the skill. Its frontmatter can be absent, malformed, or use any of several key spellings. Nothing the panel does may depend on it being well-formed.

**This is a mid-flight revision.** Tasks 1 through 5 of `tasks.md` already shipped a working flat `InlineSelect` picker: `CatalogContentFile { id, name }`, `buildSkillContentFiles` (path as both `id` and `name`, so duplicate basenames stay distinguishable), and `DetailsPanel`'s picked-file overlay state. Only the verification tasks (6.x) were still open when this revision started. D3 below replaces the flat picker outright — the shipped code is not extended, it is superseded, and `tasks.md` marks the superseded tasks accordingly rather than leaving two conflicting histories.

**The preview now has a parity correction.** Section 1a shipped the hierarchical selector and D6-D9 added a generic four-type preview contract. That generic fallback remains public API, but it did not satisfy the product requirement that skill details render files the same way as Skill Builder. D9a supersedes the skill-specific app wiring: supporting files now use Skill Builder's actual `useSkillFilePreviewSync` + `SkillFilePreview`/`AttachmentCanvasBody` pipeline through a host-owned render callback, while the manifest remains parsed instructions.

## Goals / Non-Goals

**Goals:**

- Render a skill's manifest as the prose it is, with its frontmatter lifted into structured UI instead of shown as body text.
- Surface `whenToUse` / `allowedTools` / `bundledResources` — fields the codebase already models but never populates.
- Turn the file inventory into a browsable, hierarchical selector.
- Render every supporting file through the actual Skill Builder preview pipeline and `AttachmentCanvasBody`, without widening `libs/catalog`'s dependency footprint.
- Keep every addition to `libs/catalog` entity-agnostic and optional.
- Leave one skill-details mapper in the tree, not two, and one manifest parser per concern (read-only display vs. editable round-trip), not a third that blurs the two.

**Non-Goals:**

- File editing or any skill mutation. Preview formats already supported by Skill Builder — including PDF, HTML, structured JSON, audio, and visualizers — are explicitly in scope for supporting files.
- Any backend, DTO, or OpenAPI change.
- Changing how prompts render.
- Restoring an About tab for skills.
- Adopting `@epam/ai-dial-attachment-canvas`'s React components (`AttachmentCanvasBody`, `useAttachmentCanvas`) inside `libs/catalog` — see D6's alternatives.

## Decisions

### D1 — Parse the frontmatter in the app, with `yaml`

The parser lives at `apps/chat/src/utils/skill-manifest.ts` and exposes one function:

```ts
export const parseSkillManifest = (raw: string): SkillManifest => { ... };
```

`SkillManifest` is `{ about?: SkillAboutDetails; body: string }`. The split is a leading-fence scan, not a YAML parse of the whole file: if the text does not begin with `---` on its own line, the whole text is `body` and `about` is `undefined`. If it does, everything up to the next `---` line goes to `yaml.parse`, the remainder is `body`, and a `yaml` throw is caught and downgraded to the same body-only result.

Key resolution accepts alias spellings per field, since manifests are authored by hand against different conventions:

| `SkillAboutDetails` field | Accepted keys                                          |
| ------------------------- | ------------------------------------------------------ |
| `whenToUse`               | `when_to_use`, `when-to-use`, `whenToUse`              |
| `allowedTools`            | `allowed_tools`, `allowed-tools`, `allowedTools`       |
| `bundledResources`        | `bundled_resources`, `bundled-resources`, `bundledResources` |
| `skillPrompt`             | `skill_prompt`, `skill-prompt`, `skillPrompt`          |

`description` and `name` are read for the Content summary and are not part of `SkillAboutDetails`. Values are type-checked after parsing — a string field that parsed to an object is dropped, and a list field accepts an array of strings or a single string (promoted to a one-element array). Unrecognised keys are ignored silently; a manifest is not a schema this product owns.

**Why `yaml` and not a hand-rolled scanner.** The failure modes differ in kind. `yaml` on bad input throws, which we catch and degrade cleanly. A hand-rolled scanner on `description: "Reads a file: then summarises"` produces `"Reads a file` and calls it a success — a wrong value rendered as fact. The package is already in the lockfile at `2.8.3` and moves `devDependencies` → `dependencies`. It is reachable only from the catalog chunk. If task 6.1's bundle measurement makes the cost unacceptable, the escape hatch is `await import('yaml')` inside the skill branch, which is already an `async` function — not a bespoke parser.

**Order with the size guard.** `readSkillManifest` (`map-skill-to-catalog-item.ts:126-141`) rejects an oversized body before decoding and returns `null`. That check stays exactly where it is and runs first: parsing happens on the decoded string, so a 300 KB manifest is never handed to `yaml`.

### D2 — The description goes in Content's summary slot, not a restored About tab

`ContentTab` already renders `description` above a divider (`Content.tsx:33-42`) and is already passed `item.description` (`DetailsPanel.tsx:779-783`). For a skill that value is `''`, hard-coded by the list mapper (`map-skill-to-catalog-item.ts:56`), because skill metadata genuinely has no description — only the manifest does, and the manifest is fetched lazily.

The fix is to let the details fetch supply it: `CatalogItemPromptContent` gains an optional `description`, and `DetailsPanel` renders `item.details?.promptContent?.description ?? item.description`. Prompts pass nothing and are unaffected.

**Why not an About tab.** `item.description` is populated by the list mapper, before the panel opens, which is why About can be tab #1 without shifting. A skill's description exists only after `onFetchDetails` settles. An About tab derived from it would materialise mid-interaction and push Content one slot right while the user is reading it. The summary slot delivers the same text at the same moment with no tab-row movement.

**Alternative rejected:** having the app write the description back onto the `CatalogItem` after the fetch. `Catalog.tsx` merges the fetch result into `item.details` only (`Catalog.tsx:298-307`); widening that merge to arbitrary item fields makes the fetch result able to rewrite name, version, or ownership, which is a much larger contract than one summary line.

### D3 — The files become a hierarchical selector inside the Content tab

#### Alternatives compared

| | Flat `InlineSelect` (shipped, now replaced) | `DialFoldersTree` in a `Dropdown` | Small tree on `Dropdown.renderOverlay` (selected) |
| --- | --- | --- | --- |
| Dependency cost | None — `InlineSelect` already used | New: `@epam/ai-dial-react-file-manager` (peer dep `libs/catalog` does not currently have), which itself pulls `ag-grid-community`/`ag-grid-react` peer deps | None — `Dropdown` and `InlineSelectTrigger` are both already part of `@epam/ai-dial-ui-kit`, `libs/catalog`'s existing peer dependency; `Dropdown` is already imported in this lib (`ShareButton.tsx`) |
| Component generation | 2.0 | 1.0, no 2.0 replacement exists for a folder tree | 2.0 (`Dropdown`, `InlineSelectTrigger`) with a bespoke, lib-owned overlay |
| Data model fit | Flat list; forces full-path labels to disambiguate | `DialFile` — 17 fields (`bucket`, `folderId`, `permissions`, `owner`, …), most irrelevant to a read-only selector; `libs/catalog` would have to construct fake `DialFile` objects purely to satisfy the prop shape | A model sized to exactly the need: a folder/file union carrying only an id, a name, and (for folders) nested children |
| Feature surface | None beyond selection | Rename, create-folder, drag-and-drop, per-item context menus, lazy per-folder loading (`loadingPaths`/`loadedPaths`) — none of it applicable to a read-only, fully-loaded skill listing | Exactly expand/collapse and select — nothing unused to carry, test, or reason about |
| Accessibility control | Full (already accessible today) | Whatever ARIA semantics the 1.0 component happens to implement for a file-manager tree — not audited for this use, and not guaranteed to match the single-select `tree`/`treeitem` pattern this capability requires | Full — the lib implements exactly the ARIA tree contract this capability specifies |
| Readability at scale | Degrades: every duplicate-named file grows its label to a full path | Would work, at the cost above | Improves: hierarchy disambiguates, so labels stay short basenames |

**Selected: a small tree, owned by the lib, on top of `Dropdown.renderOverlay`.** It is the only option that adds no dependency, fits a data model no larger than the need, and gives the lib full control over the accessibility contract this capability specifies. `DialFoldersTree` is rejected primarily on dependency and scope grounds, not on any functional gap — it would work, but it would cost `libs/catalog` a first dependency on the file-manager package (and transitively `ag-grid`) to render a static, single-select list, and its item shape and mutation-oriented props are a mismatch this lib would have to work around rather than use.

#### The model

`CatalogContentFile` is removed. `CatalogItemPromptContent.files` is retyped from a flat array to a nested tree:

```ts
export enum CatalogContentNodeType {
  File = 'file',
  Folder = 'folder',
}

export interface CatalogContentFileNode {
  type: CatalogContentNodeType.File;
  /** Opaque id passed back to `onLoadContentFile`; never parsed by the lib. */
  id: string;
  /** File name shown in the tree row. Expected to be a basename — the lib
   *  never relies on `name` being unique across the tree, only on `id`
   *  being unique among a node's siblings' descendants. */
  name: string;
}

export interface CatalogContentFolderNode {
  type: CatalogContentNodeType.Folder;
  /** Stable key identifying this folder for expand/collapse state; opaque to the lib. */
  id: string;
  /** Folder name shown in the tree row. */
  name: string;
  /** Nested folders and files. Empty when the folder carries no children. */
  items: CatalogContentTreeNode[];
}

export type CatalogContentTreeNode = CatalogContentFileNode | CatalogContentFolderNode;

// on CatalogItemPromptContent
files?: CatalogContentTreeNode[];
selectedFileId?: string;
```

`DetailsPanelProps` and `CatalogProps` keep `onLoadContentFile?: (fileId: string) => Promise<string | undefined>` unchanged — the callback contract does not care whether the id came from a flat list or a tree leaf.

**The selector renders only when the tree contains two or more file nodes, at any depth.** One file *is* the body regardless of how deep it sits; a selector offering the single thing already on screen is pure noise. A tree with zero or one file node collapses to today's plain rendering exactly, the same rule the flat picker used, now counted recursively.

**The trigger shows the open file's basename, not a path.** Because the open overlay disambiguates duplicate names by position in the hierarchy, the closed trigger no longer needs a path-qualified label the way the flat picker did. The residual cost — two files that happen to share a name look identical in the closed trigger — is accepted: the user just picked the file from its exact location in the tree, so the selection itself is never ambiguous, only its two-word summary in the trigger.

**Row layout.** Every row, folder or file, is a single fixed-height (`h-10`, matching the kit's `ElementSize.Small` control height already used by the flat picker) block. A folder row is icon, name, a flex spacer, then a trailing disclosure chevron; a file row is name text alone, with no icon. Every row at a given depth carries the same indent: depth 0 (root-level files and folders) carries none, and each further level of nesting adds one fixed indent step (`ps-6` on the row, applied cumulatively per depth via the wrapping `role="group"` element rather than restated per row — see the Accessibility decision below). The folder icon does not change between expanded and collapsed — only the chevron's rotation communicates state (see the RTL decision below).

**Sort order.** Within a folder (including the root), entries sort case-insensitively by name, folders and files interleaved in that single order — the same mixed alphabetical order a file explorer uses — except that the manifest file is pinned first at the root regardless of where it would otherwise sort.

**Default selection is a separate rule from sort order, not a consequence of it.** The manifest heading the root list (above) only controls where its *row* sits inside the open tree. Which file is *displayed* the moment the panel opens — before the tree is even opened once — is `promptContent.selectedFileId`, which `apps/chat` sets to the manifest node's actual opaque listing id (`SKILL_MANIFEST_FILE` for a file-relative listing, or the verbatim Core-prefixed id). The two would agree even if the sort rule above did not exist: pinning the manifest first is a readability choice about the *list*, while opening on it is a product requirement about the *panel's initial state*, and this design keeps both because losing either one independently would be a regression — a differently-sorted-but-still-defaulting tree, or a correctly-sorted tree that opened on some other file, are both wrong.

**Why not a Files tab** (built first, then removed): it cost a new `CatalogDetailsTab` member, a new component, a tab-derivation branch, a download callback, and folder-grouping rules — and after all that, a file still could not be *read* in the panel, only downloaded. A selector inside the tab the user is already on adds no tab-row surface and makes the files readable, which is the thing that was missing.

**Why not an Overview section.** Overview's row model is `{ label, value }` (`item-overview.ts:2-12`) rendered as text or a yes/no glyph. It has nowhere to put a selection affordance, and widening `OverviewSpec` would push a file-browsing concern into the model every entity's Overview shares.

### D3a — State ownership

| State | Owner | Why |
| --- | --- | --- |
| The selected/displayed file (`{ id, content } \| null` overlay) | `DetailsPanel` (unchanged from the shipped flat picker) | Already lives here; the overlay pattern (`null` = showing the base body) is unaffected by the picker's rendering change. |
| The set of expanded folder ids | `DetailsPanel`, passed down as a controlled `expandedFolderIds`/`onToggleFolder` pair | Matches the existing precedent of centralizing Content-tab presentation state in `DetailsPanel` rather than `ContentTab`; nothing about it needs to reach the host, and there is no repository evidence a host needs to control it. |
| The selector's open/closed state | `DetailsPanel`, passed down as a controlled `isFileSelectorOpen`/`onFileSelectorOpenChange` pair | Same rationale — kept alongside the other Content-tab state it is cleared in lockstep with (see below), rather than split across two components' local state. |
| The currently loaded file body, and its loading/error state | `DetailsPanel` (unchanged) | Same overlay as the first row; unaffected by this revision. |

**Defaults and resets.** Every folder starts expanded the first time the selector opens for a given item — there is no "collapsed by default" state to reason about, and the whole hierarchy is visible without extra clicks. A user's subsequent collapse/expand choices persist for as long as the panel keeps showing that item, across any number of times the selector itself is opened and closed. `DetailsPanel`'s existing `item.id`/`selectedFileId`-keyed reset effect (`DetailsPanel.tsx:222-225`) grows to also reset `expandedFolderIds` back to "every folder expanded" and close the selector, so a new item never inherits another item's expand state or open selector.

### D3b — Accessibility and keyboard contract

The overlay root carries `role="tree"` with an accessible name from `contentFileSelectorAriaLabel`. Each row carries `role="treeitem"`; a folder row additionally carries `aria-expanded`; the row for the file currently displayed (the picked file when one is active, otherwise `selectedFileId`) carries `aria-selected="true"`, every other file row `aria-selected="false"` (folders are not selectable and carry no `aria-selected`). An expanded folder's children sit inside an element with `role="group"`, which is also where the per-depth indent step is applied, so indentation compounds naturally with nesting depth without being recomputed per row.

Keyboard behavior follows the standard collapsible-tree pattern, with one focusable row at a time (roving `tabIndex`):

- **ArrowDown / ArrowUp** move focus to the next/previous visible row.
- **ArrowRight** on a collapsed folder expands it; on an already-expanded folder or a file, it has no effect (WAI-ARIA's authoring guidance to move to the first child on an expanded folder is not adopted here, since Enter/Space already select — moving focus on ArrowRight as well would double up two ways to reach the same file).
- **ArrowLeft** on an expanded folder collapses it; on a collapsed folder or a file, it moves focus to the parent folder, or has no effect at the root.
- **Enter or Space** on a folder toggles its expanded state; on a file, it selects that file, closes the selector, and returns focus to the trigger.
- **Escape**, and a click outside the overlay (the `Dropdown` default), close the selector without changing the selection and return focus to the trigger.

**Focus on open.** The row for the file currently displayed receives both focus and the roving `tabIndex="0"` when the selector opens. Because every folder defaults to expanded, that row is always visible without the opener needing to auto-expand anything on the user's behalf as a special case.

**Focus on close.** Regardless of how the selector closed — a file pick, Escape, or an outside click — focus returns to the trigger button.

**Closing during an in-flight load.** Closing the selector (by any means) while `onLoadContentFile` is still pending does not cancel that call. `DetailsPanel` already tracks the load independently of whether the selector is open, so the pending promise still resolves into the body and clears the loading state exactly as it would if the selector had stayed open; reopening the selector before it settles still reflects the in-flight state through the existing `isFileLoading`/`aria-live` status region.

### D3c — Responsive and RTL contract

The overlay's sizing rules are identical below and above the 769px desktop boundary — there is no separate mobile layout for the tree. It renders at a fixed comfortable width on desktop, sized to read typical filenames without truncation, and caps its own width against the viewport (`max-w-[calc(100vw-2rem)]`-equivalent, keeping the same edge gap the panel itself already keeps) so it cannot overflow horizontally at a 360px viewport or any width in between. Its height is capped with the overlay scrolling internally beyond that cap, so a large tree never grows the page itself.

Every row is exactly `h-10` (40px) regardless of breakpoint, which already satisfies the minimum recommended touch-target size — no separate mobile row height is needed. Nothing in the selector is hover-gated: expand/collapse and selection are click/tap-driven on both desktop and mobile.

Indentation uses `padding-inline-start`, so it flips automatically under `dir="rtl"`. The folder icon is a plain closed-folder glyph with no directional meaning and is not mirrored. The disclosure chevron does carry directional meaning: its expanded state (pointing toward the block end, i.e. down) needs no RTL counterpart, but its collapsed state (rotated to point toward the inline end — the direction the user would "open into") is mirrored with an `rtl:` counterpart rotation, following the same pattern this codebase already uses for a static forward-pointing chevron (`rtl:scale-x-[-1]` for a chevron icon; here expressed as a rotation pair since this chevron also animates between two states rather than sitting statically in one).

### D3d — Building the tree from a flat, recursive listing

`listSkillFiles({ recursive: true })` already returns every folder and file under a skill's root in one flat array (`SkillMetadataItemDto[]`), each entry carrying its own `path` (relative to the skill root), `name` (the last path segment — already a basename), `nodeType` (`'folder'` or `'item'`), and an optional `parentPath`. `buildSkillContentTree(files)` turns that flat array into `CatalogContentTreeNode[]` in the app, before it ever reaches the lib:

1. Build a map from folder path to a `CatalogContentFolderNode`, seeded from every `nodeType: 'folder'` entry in the listing (this is what makes an empty grouping folder — one with no `item` entries under it — still appear in the tree: it gets a node with `items: []` from its own listing entry, even though no file ever supplies one).
2. For each `nodeType: 'item'` entry, split its `path` on `/` and walk the segments, creating any intermediate folder node the map does not already have an entry for (an "implicit" folder — one the listing never returned its own `folder` entry for, which can happen for a folder that exists only because a nested file's path implies it) before placing the file node at its final segment.
3. Attach each folder node (explicit or implicit) to its parent's `items` the same way, walking up by `parentPath` (explicit folders) or by the path's own segments (implicit folders), so the result is a small number of root-level nodes rather than a flat map.
4. Sort each node's `items` per D3's sort rule (case-insensitive, folders and files interleaved, manifest pinned first only at the root).

The id assigned to every node — file or folder — is its listing path, exactly as the flat picker used for file ids; a folder's id is never round-tripped anywhere (it only keys client-side expand/collapse state), so it needs no format guarantee beyond stability across re-renders of the same listing.

### D4 — `buildSkillOverview` splits; the dead mapper is deleted

`buildSkillOverview` returns two sections instead of one:

- **Specification** — `whenToUse`, `allowedTools` (joined with ` · `, matching the existing deployment mappers), `bundledResources`. Each row is omitted when its field is absent, and the whole section is omitted when every row is. `skillPrompt` is not rendered: it duplicates the manifest body already on the Content tab.
- **Details** — author (omitted when absent, as today), last updated, file count. This reuses `catalog.details.skill.section` as its title and the three existing `catalog.details.skill.*` row keys.

The per-file rows leave the Overview: the picker enumerates the same files and makes each readable, so keeping inert duplicates would be the list twice. A new `buildSkillContentTree(files)` (replacing the flat picker's `buildSkillContentFiles`) produces the selector's tree, described fully in D3d below.

`mapSkillDetails` (`map-entity-details-to-catalog.ts:480-508`) and the `{ type: 'SKILL' }` member of `EntitySpecificDetails` (`entity-details.ts:274`) are deleted. `SkillAboutDetails` and `SkillEntityDetails` move from `entity-details.ts` to `types/skill.ts`, where the rest of the skill vocabulary lives; `SkillEntityDetails` is kept as the parser's `about` container so the shape stays named.

**Why delete rather than wire.** `mapSkillDetails` hangs off `EntitySpecificDetails`, which exists solely as the output of `mapDeploymentDetailsDtoToEntityDetails`. Skills never touch the deployment details endpoint — the branch returns at `CatalogView.tsx:464` before it. Keeping a second skill mapper on a union skills can never enter leaves the next reader a plausible wrong wire-up, and its labels are hardcoded English (`'Allowed tools'`, `'Specification'`) where the live skill path threads `t`.

### D5 — Failure isolation is per-half, unchanged

The existing contract holds: manifest and listing settle independently, each half is optional, and both failing resolves `undefined`. This change adds one nesting level inside the manifest half — a manifest that downloads but fails to parse still yields `promptContent.content` (the raw text as body) with no `description` and no Specification section. Parse failure is strictly weaker than fetch failure and must never escalate to one.

A per-file download rejection is handled at the app edge by opening the shared attachment-canvas forbidden or load-error content. The panel stays open, the selector remains usable, and the row is not marked failed.

### D6 — Read-only file preview: what the Skill Builder already does, and how much of it to reuse

**What the Skill Builder does today.** Selecting a supporting file in `libs/skill-editor`'s file tree (`SkillEditor.tsx`) does not fetch or render anything inside that library — `SkillEditor` only tracks `selectedPath` and renders whatever `ReactNode` the host passes as `supportingFileContent` (`libs/skill-editor/src/models/skill-editor-props.ts:299-306`; the lib checks only whether the selected node's `kind` is `SkillFileNodeKind.File`, never what the file contains). The host, `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`, renders `<SkillFilePreview path={selectedPath} />`, which is a thin wrapper around the chat product's own attachment-preview pipeline: `useSkillFilePreviewSync` converts the selected node's already-in-memory bytes (the whole skill is downloaded once, up front, into a `Map<string, { bytes, mimeType? }>` by `useSkillEditorLoad` — not fetched per selection) into a synthetic `Attachment` via `skillFileToAttachment`, and opens it through `useOpenAttachmentCanvas` — the exact hook chat message attachments use. That hook classifies the attachment (MIME first, then extension, then a text/HTML previewability check) and resolves one of `AttachmentCanvasBody`'s content types: `Markdown`, `Code` (syntax-highlighted, via `react-syntax-highlighter`), `PlainText`, `Image`, `Json`, `Html` (sandboxed iframe), `Pdf`, `Audio`, `Visualizer`, `Unsupported`, or `Error`. `AttachmentCanvasBody` itself (`libs/attachment-canvas`) is host-agnostic — no `server-api`, routing, or auth import anywhere in its source — but it is not lightweight: its `package.json` peer-depends on `@epam/ai-dial-sidebar`, `@epam/pdf-highlighter-kit`, `@epam/ai-dial-react-pdf-highlighter`, `@epam/ai-dial-visualizer-connector`, and `react-json-view-lite`, none of which `libs/catalog` has today.

**Where each piece of that behavior belongs, mapped against this repo's actual boundaries:**

| Behavior | Belongs to |
| --- | --- |
| Which extensions count as "text," "HTML," or map to a syntax-highlighting language | The existing `@epam/ai-dial-attachment-canvas` and `@epam/ai-dial-chat-shared` tables reached through Skill Builder's shared `useOpenAttachmentCanvas` path; no table is re-declared. |
| Deciding *which* table entry applies to *this* file (MIME priority, image-vs-text-vs-unsupported branching) | The shared app-level Skill Builder pipeline. This remains outside `libs/catalog`. |
| Converting Core's opaque listing id to the file-relative path accepted by the single-file endpoint; fetching bytes; applying the size guard | The `apps/chat` adapter. A library must not know what a bucket, skill path, MIME header, or backend `files` root is. |
| Rendering resolved content | Shared `SkillFilePreview` and `AttachmentCanvasBody`, mounted at the app edge through the catalog's generic `renderContentFilePreview` slot. |
| Data availability | Fetch strategy is intentionally different — Skill Builder preloads the archive, details lazily downloads one file — but both produce the same `SkillFileContent`, synthetic `Attachment`, canvas state, and renderer after bytes are available. |
| Deciding when a file choice exists and what row the user is looking at | **`libs/catalog`'s existing hierarchical selector** (D3-D3d) — entirely unaffected by this decision. |

**Historical generic-fallback alternatives compared:**

| | Keep rendering every pick as Markdown | Duplicate the Skill Builder's preview logic in the details panel | Add `@epam/ai-dial-attachment-canvas` as a new `libs/catalog` dependency | Resolve type in `apps/chat`; render with what `libs/catalog` already has (generic fallback) |
| --- | --- | --- | --- | --- |
| New `libs/catalog` dependency | None | None (but a second table) | `@epam/ai-dial-attachment-canvas` and its whole peer chain (`@epam/ai-dial-sidebar`, `@epam/pdf-highlighter-kit`, `@epam/ai-dial-react-pdf-highlighter`, `@epam/ai-dial-visualizer-connector`, `react-json-view-lite`) | None — `MarkdownWithPlaceholders`/`MarkdownCodeBlock` are already exported from the existing `@epam/ai-dial-chat-shared` peer dependency |
| Classification logic | N/A (none) | A second, hand-maintained copy of `TEXT_EXTENSIONS`/`EXTENSION_TO_LANGUAGE`-shaped tables, drifting from the original the moment one changes | Reused as-is (the lib's own tables) | Reused as-is, called from `apps/chat`, which already depends on the package that exports them |
| Fits library isolation | Trivially (does nothing) | Yes, but only by accident of where the copy lives | Yes — `AttachmentCanvasBody` itself is host-agnostic — but pulls its full PDF/visualizer/audio/JSON-tree surface into every catalog consumer | Yes — the app resolves a host-flavored question (what can we render), the lib only renders a name/data pair it's handed |
| Bundle cost for `libs/catalog` consumers | None | Small (one more table) | Large — pulls `ag-grid`-adjacent and PDF/visualizer chains into every `libs/catalog` consumer, whether or not they show skills | None beyond what `@epam/ai-dial-chat-shared` already contributes |
| Solves exact Skill Builder parity (Why, point 4) | No | No — it drifts | Yes, at excessive library cost | No — classification parity is not renderer parity |

**Historical selection for the generic fallback: resolve the type in `apps/chat`, render with `libs/catalog`'s existing peer dependencies.** The four-type contract remains available to non-skill hosts, but D9a supersedes this choice for the skill-details app adapter because sharing classification tables did not produce renderer parity with Skill Builder.

### D7 — The generic preview contract: additive, not a replacement

`onLoadContentFile?: (fileId: string) => Promise<string | undefined>` cannot represent this capability's required states: it has no way to say "this is an image" (binary, needs a URL not a string), no way to say "this cannot be previewed" (today, an unsupported file's bytes are just decoded as text and rendered as garbage), and no way to distinguish Markdown from plain code (today, everything renders through the Markdown path). It is kept, unmodified, rather than replaced — every capability described in `catalog-content-file-picker`'s existing "Picking a file loads its content through the host" requirement continues to work exactly as written for any host that never adopts the new contract.

```ts
export enum CatalogContentPreviewType {
  Markdown = 'markdown',
  Text = 'text',
  Image = 'image',
  Unsupported = 'unsupported',
}

export interface CatalogContentMarkdownPreview {
  type: CatalogContentPreviewType.Markdown;
  /** Markdown source, rendered through the same safe path as the base body. */
  text: string;
}

export interface CatalogContentTextPreview {
  type: CatalogContentPreviewType.Text;
  /** Plain or source-code text, rendered read-only with whitespace preserved. */
  text: string;
  /** Syntax-highlighting language id (e.g. `'python'`, `'json'`). Omitted renders as unhighlighted monospace text. */
  language?: string;
}

export interface CatalogContentImagePreview {
  type: CatalogContentPreviewType.Image;
  /** Already-resolved, browser-loadable image URL. May be a `blob:` URL the host created for this preview — see D8's object-URL row for who revokes it. */
  url: string;
}

export interface CatalogContentUnsupportedPreview {
  type: CatalogContentPreviewType.Unsupported;
}

export type CatalogContentFilePreview =
  | CatalogContentMarkdownPreview
  | CatalogContentTextPreview
  | CatalogContentImagePreview
  | CatalogContentUnsupportedPreview;

// on DetailsPanelProps and CatalogProps, alongside the existing onLoadContentFile
onLoadContentFilePreview?: (fileId: string) => Promise<CatalogContentFilePreview | undefined>;
```

**Precedence.** When a host supplies both, `onLoadContentFilePreview` is called and `onLoadContentFile` is never invoked for that pick — there is exactly one network request per file selection either way, never two. When only `onLoadContentFile` is supplied, its resolved string is wrapped as `{ type: Markdown, text }` before rendering, which is pixel-for-pixel what happens today (every pick already renders through `MarkdownWithPlaceholders`). `undefined` from either callback, or a rejection from either, is treated identically — both already mean "show the error text," and this revision does not add a second error shape.

**The base file is unaffected.** `promptContent.content` (the manifest's parsed instructions, or a prompt's body) keeps rendering through `MarkdownWithPlaceholders` directly, exactly as before D6/D7 — it has always been Markdown text supplied synchronously by `onFetchDetails`, never resolved through either content-file callback. Only a *picked* (non-base) file's rendering path changes.

**Why not fold the new fields onto `CatalogContentTreeNode` instead of a callback result.** The tree's job (D3) is to describe *what exists and how it nests* before any file is read; a node's preview type can only be known once its bytes are inspected (extension alone is a heuristic — the app already treats a MIME-typed response as authoritative over extension, per `useOpenAttachmentCanvas`'s branch order), which is exactly when `onLoadContentFilePreview` already runs. Putting it on the tree would mean resolving every file's type up front for a tree the user may never fully expand.

### D8 — State ownership, extended

D3a's table gains three rows for this revision; the ownership rationale (`DetailsPanel`, not `ContentTab`, not the host) is unchanged from D3a.

| State | Owner | Why |
| --- | --- | --- |
| The resolved preview (`CatalogContentFilePreview \| null` on the existing picked-file overlay) | `DetailsPanel` | Replaces the overlay's `content: string \| null` with the richer union; same overlay, same `null`-means-"showing the base body" convention as D3a. |
| A per-selection request generation token | `DetailsPanel` | Guards against the stale-response race D3a's original design did not address (see below) — internal bookkeeping, never exposed to the host or the lib's public props. |
| Image preview object-URL lifecycle | `DetailsPanel` revokes; **`apps/chat` creates** | Mirrors `@epam/ai-dial-attachment-canvas`'s own split: creation is always the caller's job (the lib never calls `URL.createObjectURL`, confirmed by inspection), while `DetailsPanel` — the component holding the reference across the file's display lifetime — revokes it via `URL.revokeObjectURL`, and only when the URL string starts with `blob:`, exactly the check `AttachmentCanvasContext.tsx:24-35` already uses. A host that returns a permanent, non-blob URL is never revoked out from under it. This is a generic string check, not skill- or bucket-specific behavior, so it does not widen what the lib knows about any host. |

**The stale-response race this revision closes.** The shipped `handleSelectContentFile` (`DetailsPanel.tsx:250-271`) has no guard against out-of-order resolution: picking file A then quickly file B, with A's promise settling after B's, would overwrite B's already-displayed content with A's — silently, since both writes target the same `pickedFile` state with no ordering check. This was latent even for the plain-text contract; it becomes user-visible once previews can meaningfully differ (an image replaced by stale code text, or vice versa). The fix is a monotonically increasing request token, captured before the call and checked before the corresponding `setPickedFile` commits; a token that no longer matches the latest one is discarded silently, the same way a superseded fetch is discarded elsewhere in this codebase. The same token guards the existing item-switch reset effect (D3a): a preview in flight when the panel switches to a different item is discarded on arrival rather than momentarily flashing under the new item's tab.

**Cleanup on unmount.** `DetailsPanel` gains an unmount-only effect that revokes whatever `blob:` URL the picked-file overlay currently holds, mirroring the existing unmount cleanup pattern already used elsewhere in this component (e.g. the keydown listener at `DetailsPanel.tsx:433-447`) rather than introducing a new cleanup convention.

### D9 — Accessibility, RTL, and responsive contract for the preview area

**Accessibility.** For the generic typed-preview fallback, the preview area keeps the panel's existing `role="status"`/`aria-live` loading region and names the currently displayed file. Its unsupported state is plain non-interactive text and its image carries `alt` from the tree node's name. For the skill-specific host-renderer path, the shared `SkillFilePreview` supplies the same labelled `role="group"`, loading/error semantics, and read-only attachment body as Skill Builder; the surrounding tree remains the only file-selection control.

**RTL.** Neither the four generic fallback renderers nor the shared attachment body introduces a physical-direction layout rule here; both inherit the document direction. No new `rtl:` variant or logical-property rule is needed beyond what D3c already specifies for the selector itself.

**Responsive.** The generic fallback keeps the existing scrollable Content body. When the host renderer is present, that body switches to `min-h-0 flex-1 overflow-hidden`, allowing `AttachmentCanvasBody` to own its internal scrolling without nested horizontal overflow. No new breakpoint-specific behavior is introduced; the existing `mobile`/`desktop` breakpoint pair is unchanged.

### D9a — Skill details use the actual Skill Builder renderer, through an app-owned render slot

The generic four-type contract above is insufficient for product parity: Skill Builder renders through `AttachmentCanvasBody`, which has Markdown, code/plain text, structured JSON, HTML, PDF, image, audio, visualizer, unsupported, loading, and error branches with shared labels and theme behavior. Reusing only `isTextPreviewable`/`extensionToLanguage` made classification similar but left rendering observably different.

**Selected contract.** `CatalogProps`/`DetailsPanelProps` add optional `renderContentFilePreview(fileId, fileName): ReactNode`. It takes precedence over both async loading callbacks for a picked non-base file. The catalog owns only tree selection and resolves the basename; it never sees skill/API/MIME/context details. `ContentTab` gives the returned node a `min-h-0 flex-1 overflow-hidden` body so the host renderer owns its internal scrolling at every viewport. The existing typed preview API remains intact for other hosts and backward compatibility.

**App implementation.** The reusable `SkillFilePreview` moves from the Skill Editor page folder to `apps/chat/src/components/SkillFilePreview/`, and `useSkillFilePreviewSync` moves to `apps/chat/src/hooks/attachment/`. Skill Builder imports them from those shared app locations unchanged. `CatalogView` supplies `SkillDetailsFilePreview`, which lazily downloads one normalized file path, applies `readSkillFileBytes`, stores `{ bytes, mimeType? }` in the same in-memory shape Skill Builder uses, and calls the shared sync hook. Both surfaces therefore render the same `AttachmentCanvasBody` rather than merely consulting the same extension tables.

**MIME and errors.** A generic Core `application/octet-stream` header is discarded so `skillFileToAttachment` infers from the filename exactly as it does for Skill Builder's ZIP entries; a specific MIME is preserved. HTTP 403 maps to `createForbiddenCanvasContent`; every other HTTP/network/size failure maps to `createLoadErrorCanvasContent`. The shared component owns its blob URL cleanup through `AttachmentCanvasContext`, as it already does for Skill Builder.

**Manifest exception.** The render slot is never invoked for `selectedFileId`. For a skill this is the actual manifest tree id, so `SKILL.md` continues to render the already-parsed instructions through Content's base Markdown path and never enters attachment canvas, preserving the instructions-only requirement.

**Alternative rejected: import `AttachmentCanvasBody` into `libs/catalog`.** It would make pixels match but add attachment-canvas and its peer surface to every catalog consumer. The render slot achieves exact app parity without violating library isolation or increasing the lib's dependency graph.

### D10 — API capability gate: verified, not assumed

Before designing anything, the existing backend and generated client were inspected end to end to determine whether a whole-skill archive download already exists. It does, and it is already exercised in production code — not merely defined and unused.

**Backend route.** `apps/chat-api/src/skills/skills.controller.ts:169-244`, inside the `@Controller({ path: 'skills', version: '1' })` prefix (so the resolved path is versioned):

```ts
@Get('download')
@Throttle({ default: { limit: 30, ttl: 60000 } })
@ApiProduces('application/zip')
@ApiOperation({
  operationId: 'downloadSkill',
  summary: 'Download a whole skill as a ZIP archive',
  description:
    'Proxies DIAL Core downloadSkillFolder and streams the response. Returns 400 when the path resolves to a grouping folder instead of a skill.',
})
@ApiResponse({ status: 200, description: 'Streamed application/zip archive', schema: { type: 'string', format: 'binary' } })
// ...403/404/etc. also documented
async downloadSkill(
  @Query() query: SkillResourceQueryDto,
  @Req() req: Request,
  @Res() res: Response,
): Promise<void> { /* ... */ }
```

Resolved route: `GET /api/v1/skills/download?bucket=...&path=...`. No route-specific `@UseGuards` — authentication is the global session mechanism (`req.user as SessionUser`) plus a bearer access token forwarded to DIAL Core on every call, the same as every other skills route. There is no code anywhere in this controller or its services that special-cases personal, shared, or public/organisation buckets for a download route: `bucket`/`path` are opaque strings forwarded to DIAL Core, and DIAL Core itself is the authorization boundary — a 403 it returns is mapped through the existing `handleDialSdkError` path, documented on every route via `@ApiResponse({ status: 403 })`.

**Backend service.** `apps/chat-api/src/skills/download/skills-download.service.ts:62-115` — `downloadSkill(bucket, path, accessToken)` calls `dialClient.client.downloadSkillFolder(bucket, encodeDialResourcePath(path), { parseAs: 'stream', ... })`, translates a DIAL Core 400 (the path resolved to a grouping folder, not a skill) into `BadRequestException`, and returns `{ stream, headers, abortOnDisconnect }`. Headers are forwarded through an explicit safe allowlist (same file, lines 26-30):

```ts
export const SAFE_SKILL_DOWNLOAD_HEADERS = ['content-type', 'content-disposition', 'etag'] as const;
```

`content-length` is deliberately excluded (Node reframes the stream, so a stale length would be wrong); `etag` is included because a skill download carries a resource-version identifier. This confirms `Content-Disposition` *is* already forwarded when DIAL Core sends one — the frontend does not need to invent a filename convention from scratch, only a fallback for when it is absent (D12).

**`skills-package.service.ts` is not part of this chain and does not build a ZIP.** Its own docstring is explicit that it "never constructs, receives, or forwards a ZIP archive" — it only builds the outbound multipart `FormData` for skill *upload* (`createSkill`/`updateSkill`). The whole-archive download and this service are unrelated; a reader must not confuse "package" (upload's per-file multipart assembly) with "archive download" (this feature).

**Generated client.** `libs/chat-api-client/src/generated/src/apis/SkillsApi.ts:502-559` — `downloadSkillRaw(requestParameters): Promise<runtime.ApiResponse<Blob>>` (returns `runtime.BlobApiResponse`, whose `.raw` is the native `fetch` `Response`) and `downloadSkill(requestParameters): Promise<Blob>` (the parsed convenience wrapper). Generated 1:1 from the controller's `@ApiOperation({ operationId: 'downloadSkill' })` — there is no separate or additional generated method for "archive" beyond this pair.

**App-level wrapper — already written, already called.** `apps/chat/src/server-api/skills.api.ts:41-57`:

```ts
export const downloadSkill = async (
  bucket: string,
  path: string,
  signal?: AbortSignal,
): Promise<Response> => {
  const raw = await skillsApi.downloadSkillRaw(
    { bucket, path },
    ...(signal ? [{ signal }] : []),
  );
  return raw.raw;
};
```

It uses the `Raw` generated variant specifically to preserve the native `Response` (so headers and the readable stream survive), exactly as this codebase's `downloadSkillFile`/`downloadFileRaw` wrappers already do for the same reason. **This function is already called in production**, at `apps/chat/src/pages/SkillEditor/hooks/useSkillEditorLoad.ts:53-68`, to load an entire skill for editing: it reads the `etag` header and unpacks the response body as a ZIP via `unpackSkillArchive`. This is not a hypothetical capability — it is a live, tested code path today.

**Conclusion: no backend, DTO, OpenAPI, or generated-client change is required.** The entire gap is that nothing in the catalog details panel calls `downloadSkill`. This design proceeds as a frontend-only change; the "smallest required backend change" branch of the decision gate does not apply.

### D11 — Primary-action precedence: an additive predicate, following the file's own established idiom

**The existing shape of `Header.tsx`'s action rules.** Every visibility decision in this component already follows one pattern: a lib-computed default, overridable by an optional host predicate, e.g. `shouldShowPrimaryAction = texts?.hasPrimaryAction !== false && (isPrimaryActionVisible?.(item) ?? (item.type === Model || Agent || Prompt))` (`Header.tsx:233-238`), or `shouldShowDownloadAction = !!onDownload && (isDownloadVisible?.(item) ?? true)` (`Header.tsx:247-248`). The primary-action *slot itself* already special-cases a second entity type beyond the "Use in chat" default: `isCredentialsActionPrimary = item.type === CatalogEntityType.Toolset && shouldShowCredentialsAction` (`Header.tsx:396-397`) swaps in an entirely different `PrimaryButton` (credentials label/icon/handler) for Toolset, which has no "Use in chat" action at all. This is direct, already-shipped precedent for "a third entity type gets a different primary action, decided by a hardcoded `CatalogEntityType` check inside the lib" — not a new pattern this design invents.

**The new rule.** `DetailsPanelProps`/`CatalogProps` gain:

```ts
isDownloadPrimary?: (item: CatalogItem) => boolean;
```

`Header.tsx` computes:

```ts
const isDownloadActionPrimary =
  !!onDownload &&
  (isDownloadVisible?.(item) ?? true) &&
  (isDownloadPrimary?.(item) ?? item.type === CatalogEntityType.Skill);
```

When `true`, a third `PrimaryButton` branch renders — label `texts?.downloadActionLabel ?? 'Download'` (the same key the Manage-menu entry already reads, not a new one), `IconDownload`, `onClick` wired to a new, awaited download handler (below) — in the same JSX slot as the "Use in chat"/credentials buttons. `shouldShowDownloadAction` (the Manage-menu inclusion rule) gains one more condition: `&& !isDownloadActionPrimary`, so the same `onDownload` is never offered in both places for the same item.

**Why a hardcoded `CatalogEntityType.Skill` default, with an override, rather than a purely app-configured flag.** The task's own architecture constraint says to avoid hardcoding *Skill-specific API or resource knowledge* inside `libs/catalog` — `CatalogEntityType` is not that; it is the same generic, already-lib-owned enum every other rule in this exact file already switches on (Model/Agent/Prompt for "Use in chat", Toolset for credentials). Treating "which entity type gets which primary action" as a UI-arrangement decision the lib may default, and the host may override — precisely mirroring `isPrimaryActionVisible`'s and `isDownloadVisible`'s own existing shape — keeps this feature consistent with the file's established idiom rather than introducing a second way to express the same kind of rule. The alternative of pushing the decision entirely into `apps/chat` (never populating `onDownload` for anything the app doesn't want promoted) was considered and rejected in the proposal's alternatives (#19): `Header.tsx`, not the host, owns *where* an item's actions render, and there is no existing seam for a host to affect that placement without this predicate.

**Precedence table** (per the task's requirement to document this for every type the panel already handles):

| `item.type` | Primary action | Source |
| --- | --- | --- |
| `Skill` | Download | New this revision (`isDownloadPrimary` default) |
| `Model` | Use in chat | Existing, unchanged (`shouldShowPrimaryAction` default) |
| `Agent` | Use in chat | Existing, unchanged |
| `Prompt` | Use in chat | Existing, unchanged |
| `Toolset` | Credentials (Log in / Log out / Manage credentials) | Existing, unchanged (`isCredentialsActionPrimary`) |
| Any other type reaching this panel (e.g. a future `Guardrail`) | None, unless the host supplies `isPrimaryActionVisible`/`isDownloadPrimary` returning `true` | Existing default (no branch matches) |

A host overriding `isDownloadPrimary` to return `true` for some other type would promote that type's Download the same way; overriding it to return `false` for `Skill` restores today's Manage-menu-only placement for that item, without code-level reversion.

**The pending state — a new capability for the primary button only, not a change to the Manage-menu contract.** `onDownload`'s existing signature and its Manage-menu-path documentation ("fire-and-forget: the result is not awaited") are preserved exactly, since that is the contract the previous, un-promoted Prompt Download already relies on. Only the new primary-Download branch awaits the call:

```ts
const [isDownloading, setIsDownloading] = useState(false);

useEffect(() => {
  setIsDownloading(false);
}, [item.id]);

const handleDownloadPrimary = useCallback(() => {
  if (isDownloading) return; // ignore a click while one is already in flight
  setIsDownloading(true);
  const run = async () => {
    try {
      await onDownload?.(item);
    } finally {
      setIsDownloading(false);
    }
  };
  void run();
}, [item, onDownload, isDownloading]);
```

This mirrors the file's own `recipientsCountStatus` local-state pattern (`Header.tsx:171-186`) rather than introducing a new state-management convention.

**Why no request-generation token is needed here, unlike D8's preview overlay.** D8's picked-file overlay could receive two *different* pieces of content out of order (file A's text landing after file B's), which needed a generation counter to resolve. `isDownloading` is a single boolean whose only possible transition, once a request is in flight, is `true → false` (on that same request's `finally`) — there is no code path that sets it back to `true` except a fresh user click, and a fresh click can only happen after the previous one already resolved (the button is disabled while `isDownloading`). The `item.id` effect resetting it to `false` on every item switch means a stale `finally` arriving after the user has moved to a different item can, at worst, redundantly set an already-`false` flag to `false` again — never resurrect a stale "downloading" indicator on the new item. No race is possible, so no additional guard is introduced.

**Accessibility of the pending state.** The button carries `disabled={isDownloading}` and `aria-busy={isDownloading}`; its icon swaps from `IconDownload` to the existing `Spinner` component while pending (the same visual affordance a loading button uses elsewhere in this codebase); a new `role="status"`/`aria-live="polite"` `sr-only` region announces `texts?.downloadingStatusLabel ?? 'Downloading'` while `isDownloading` is `true` and nothing while it is `false` — the same present/absent-live-region pattern D3b/D9 already establish for the file selector and preview.

### D12 — Archive handling: no Blob, no object URL, and no backend knowledge ever exists inside `libs/catalog`

`onDownload`'s signature does not change (`(item: CatalogItem) => Promise<void> | void`). Every byte of the response, every header, and every DOM side effect (anchor creation, object-URL creation/revocation) happens inside the `apps/chat` handler the lib merely awaits.

**The app-level handler**, added to `CatalogView.tsx`'s existing `handleDownload` as a new branch alongside the untouched Prompt one:

```ts
const handleDownload = useCallback(
  async (item: CatalogItem) => {
    if (item.type === CatalogEntityType.Prompt) {
      /* ...unchanged existing Prompt branch... */
      return;
    }
    if (item.type === CatalogEntityType.Skill) {
      const openSkill = openSkillRef.current;
      if (openSkill == null) return;
      try {
        const response = await downloadSkill(openSkill.bucket, openSkill.path);
        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`);
        }
        const fallbackName = `${sanitizeFileName(item.name)}.zip`;
        const savedName = await triggerBrowserDownload(response, fallbackName);
        notifyOperationSuccess(NotifiableEntity.Skill, EntityOperation.Downloaded, {
          name: savedName,
        });
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        showErrorNotification({
          message: t(CatalogI18nKeys.DetailsSkillDownloadError),
          requestId: traceId,
        });
      }
    }
  },
  [/* ... */],
);
```

This is the exact same shape (`try` → `triggerBrowserDownload`/`notifyOperationSuccess`, `catch` → `getApiErrorDetails` + `showErrorNotification`) the existing Prompt branch already uses, and the exact composition of `triggerBrowserDownload`/`downloadArchive`-equivalent calls `apps/chat/src/hooks/files/useDialFileMutations.ts`'s existing `onDownloadFiles` (the DIAL File Manager's own "download files/folder as ZIP" flow) already uses in production — this design reuses that proven composition rather than inventing a second one.

**Filename resolution and sanitization — both reused, not built.** `apps/chat/src/utils/file-download.ts::triggerBrowserDownload(response, fallbackName)` (already shipped, already tested — see `useDialFileMutations.ts`'s existing usage) already:

1. Extracts a filename from `Content-Disposition` via a regex that handles quoted and unquoted forms and strips `/`/`\` from whatever it finds (`extractFilename`, same file, lines 3-11) — Unicode characters in a `filename*=UTF-8''...` or plain-quoted form pass through untouched, since the extraction only strips path separators, never re-encodes.
2. Falls back to the caller's `fallbackName` when the header is absent, malformed, or carries no usable filename.
3. Converts the response body to a `Blob` and calls `triggerBlobDownload` (`@epam/ai-dial-chat-shared`), which creates the object URL, clicks a temporary anchor, and revokes the URL after a fixed delay (`DOWNLOAD_CLEANUP_DELAY_MS`, already accounting for the async nature of a browser-initiated download) — this project's one, already-audited object-URL lifecycle for triggered downloads.

The **fallback name** this feature supplies is `` `${sanitizeFileName(item.name)}.zip` ``, using the already-shipped `apps/chat/src/utils/file-name.ts::sanitizeFileName` (built for upload filenames, reused here unmodified) — it replaces `NOT_ALLOWED_SYMBOLS_REGEXP` matches (the UI kit's own forbidden-character set, which already excludes path separators) with `_`, trims trailing dots/whitespace, and caps the result to 255 UTF-8 bytes. No new sanitizer is written.

**Response error mapping.** `response.ok === false` is thrown as a generic `Error` and caught by the same `catch` block every other failure (network error, thrown `Error`) already falls into — 401/403/404/5xx are not distinguished in the UI beyond the one existing error message, matching the existing Prompt-download branch's own granularity. This is deliberate: the task's required behavior asks for a single accessible failure state ("keeps the panel open, uses the existing operation-notification mechanism"), not per-status-code messaging, and DIAL Core's own authorization result (D10) already determines whether the request even reaches a 200.

**Empty response body.** `response.blob()` on a body with zero bytes yields a valid, zero-byte `Blob`; `triggerBrowserDownload` still saves it under the resolved name. This is standard browser behavior, not a new failure mode this design introduces a special case for — an empty archive is not expected from DIAL Core for a real skill (every skill has at least `SKILL.md`), so no additional guard is added beyond what already exists.

**Cleanup ordering (`finally`).** The primary button's `isDownloading` state is cleared in `Header`'s own `finally` (D11) regardless of how `onDownload` settles; the object URL's cleanup is `triggerBlobDownload`'s own `setTimeout`-deferred `revokeObjectURL`, unaffected by whether the *button's* pending state has already cleared — the two cleanups are independent and neither depends on the other's timing.

### D13 — Accessibility, RTL, and responsive contract for the Download action

**Accessibility.** The primary Download button has an accessible name from its `label` (the `Button`'s own documented precedence: string `label` first). `disabled`/`aria-busy` communicate the pending state to assistive tech; the `role="status"` region (D11) announces it audibly. Keyboard activation is free — it is a native `<button>` via the kit's `PrimaryButton`, reachable by Tab and activatable by Enter/Space like every other button in this header. Focus stays on the button through success or failure (no focus is moved or trapped by this feature); a failure's notification is the host's existing toast mechanism, which does not steal focus from the panel.

**Mobile touch target.** `PrimaryButton` at `ElementSize.Standard` (the header's existing size for every primary/neutral button in this row) already meets the 44×44 CSS pixel minimum — this feature introduces no new size variant.

**Responsive.** The button sits in the header's existing `flex flex-wrap items-center gap-2` action row (`Header.tsx:444`), which already wraps at narrow widths without introducing horizontal overflow — confirmed by the same row already hosting "Use in chat"/Share/Manage today at 360px. No new breakpoint-specific rule is needed.

**RTL.** `IconDownload` is a symmetric, concept-representing glyph (a downward arrow into a tray) with no left/right directional meaning — it is not mirrored, matching this codebase's existing rule that only genuinely directional icons (back/forward chevrons) get an `rtl:` counterpart. The button's own layout uses the row's existing logical spacing (`gap-2`); no new physical-direction utility is introduced.

**No hover dependency.** Activation is a click/tap/Enter/Space; nothing about the disabled/busy state or the status announcement depends on a `:hover` affordance.

## Risks / Trade-offs

- **`yaml` in the runtime bundle** → It loads only inside the catalog route chunk. Task 6.1 measures `npm exec nx build chat` output before and after; if the delta is material, switch to `await import('yaml')` inside the already-async skill branch.
- **Alias-key guessing is a heuristic** → A manifest using a key spelling not in D1's table silently shows no Specification section rather than erroring. Mitigation: the body still renders in full, so no information is lost — only its promotion to structured rows. The accepted-key table is the spec's contract and is the single place to extend.
- **Frontmatter can be huge** → A pathological manifest whose fence is most of the file would hand ~256 KB to `yaml`. The existing `SKILL_MANIFEST_MAX_BYTES` guard caps the input; parsing a quarter-megabyte of YAML once, on an explicit user action, is acceptable and no further cap is added.
- **A file id is opaque to the lib, while Core listing and download contracts use different roots** → The tree preserves the listing entry's full path as `id`, but the single-file endpoint accepts `filePath` relative to the skill's internal `files` directory. Passing a listing id such as `{skillPath}/files/openai.yaml` directly duplicates the skill root and yields no preview. Mitigation: `apps/chat` normalizes `{skillPath}/files/...` and `files/...` ids at the app edge before both text and typed-preview downloads, leaves already-relative ids unchanged, and unit-tests all three shapes. `libs/catalog` still passes the opaque id through unchanged and learns nothing about the backend path contract.
- **Two sections where there was one** → Users who read the current Overview see its shape change. This is a young feature behind `OverlayFeature.Skills`; no migration is warranted.
- **`CatalogItemPromptContent.description` is prompt-named but skill-used** → The interface name predates skills and already serves both (`Skill` shares `promptContent` today). Renaming it is a wider rename across the lib's public API and is deliberately not bundled here.
- **A bespoke tree means the lib carries its own recursive rendering and keyboard-handling code, rather than reusing a tested component** → Accepted deliberately: the alternative (`DialFoldersTree`) is not actually less code to reason about once its unused rename/create-folder/DnD/context-menu surface and its 17-field item model are accounted for, and this capability's ARIA contract is specified precisely enough (D3b) that the new component can be tested directly against it. The new `ContentFileTree` component is small — expand/collapse plus single selection over an already-fully-loaded tree, no async per-node behavior.
- **Trigger label ambiguity for duplicate basenames** → Two files sharing a name in different folders render identical trigger text once either is selected. Accepted: the underlying selection is tracked by `id`, never by `name`, so behavior is correct even when the label alone could not disambiguate; the user reaches that state by picking the file from its unambiguous position in the open tree.
- **A skill with a very deep or very wide file tree** → Nothing in this design caps depth or breadth; the overlay's own height cap (D3c) keeps a wide tree scrollable rather than growing the page, and there is no per-level indent cap, so a pathologically deep tree could indent rows off the right edge of the fixed-width overlay on desktop. Accepted as out of scope: no skill observed so far nests more than a few levels, and a depth cap can be added to `ContentFileTree` later without changing the model or the callback contract.
- **Two `parseSkillManifest` functions now exist in `apps/chat/src/utils/`, under different files, for different purposes** → `utils/skill-manifest.ts::parseSkillManifest` (lenient, used here) and `utils/skill.ts::parseSkillManifest` (strict, throws on missing frontmatter, used only by the Skill Builder's edit-mode round trip). Confusable by name alone. Mitigation: D6/D7's "not reused" callout is the single place this is explained; renaming either function is a wider change than this revision and is not bundled here, since the Skill Builder's parser has its own established call sites and its own throw contract that a rename must not accidentally soften.
- **The generic fallback can still classify by extension rather than sniffing bytes** → Accepted for backward compatibility. Skill details no longer own a separate classifier and now inherit Skill Builder's exact behavior.
- **The generic image fallback revokes `blob:` URLs by prefix rather than tracking their creator** → Accepted for existing hosts. Skill details now use `AttachmentCanvasContext`'s shared lifecycle instead of creating URLs in the catalog adapter.
- **Stale-request protection adds a generation counter to state `DetailsPanel` did not previously need to version** → A small increase in the overlay's internal state shape. Accepted: the race it closes is real and was already present (undetected) in the shipped flat-picker and tree-picker revisions; the counter never reaches the lib's public props, so it costs nothing in the public contract.
- **A hardcoded `CatalogEntityType.Skill` default inside `Header.tsx` for `isDownloadActionPrimary`, mirroring an existing hardcoded `CatalogEntityType.Toolset` check for credentials** → Two entity-type-shaped conditionals now live inside the lib's primary-action logic instead of one. Accepted: both follow the exact same override-and-default idiom every other visibility rule in this file already uses, and both are overridable (`isPrimaryActionVisible`/`isDownloadPrimary`) — a host that disagrees with either default is never stuck with it.
- **No distinction between 401/403/404/5xx in the Download failure UI** → A user cannot tell "you're not allowed to download this skill" from "the server is having trouble" from the single generic failure toast. Accepted: this matches the existing Prompt-download branch's own granularity exactly, and the task's required behavior asks for one accessible failure state, not per-status messaging; DIAL Core's own authorization result (D10) is the actual boundary that decides whether the request succeeds at all.
- **An indeterminate spinner with no progress percentage, for a potentially large archive** → A skill with many or large supporting files could take a noticeable, unbounded time to download, during which the only feedback is "downloading," not "40% done." Accepted per the revised Non-Goals: the existing download-endpoint contract (D10) streams but exposes no content-length the frontend could use for a percentage (`content-length` is explicitly excluded from the safe-header allowlist, since Node reframes the stream), so a true progress bar is not achievable without a backend change this revision does not propose. Revisit if real skills are observed large enough that an indeterminate spinner reads as a hang.
- **`onDownload`'s two call sites (Manage-menu fire-and-forget vs. primary-button awaited) now behave differently depending on which button triggered them, even though the prop is the same** → A future reader of `Header.tsx` must notice that the *same* `onDownload` reference is invoked two different ways depending on which branch rendered the trigger. Accepted: the alternative (D11's alternative #18 in the proposal) — giving the primary path a different callback signature — would create two props for one concept, which is a worse confusion than one prop invoked two ways for two different UI affordances with two different UX requirements (a menu item that closes immediately vs. a button that must reflect a pending request).

## Migration Plan

Ship in the order of `tasks.md`: lib first (additive fields nothing yet populates), then the parser, then the app wiring, then the deletion. Each step leaves the tree green and the panel working.

**The tree-selector revision's migration.** The flat picker's lib and app code already shipped. Landing that revision meant: (1) replace `CatalogContentFile` with the `CatalogContentTreeNode` union and rebuild `Content.tsx`'s picker as `Dropdown` + `InlineSelectTrigger` + the new `ContentFileTree` component, in the lib; (2) replace `buildSkillContentFiles` with `buildSkillContentTree` in the app; (3) update every test that asserted the flat shape. There was no intermediate state where both shapes were live.

**This (preview) revision's migration.** Purely additive on top of the already-shipped tree selector: (1) add `CatalogContentFilePreview`/`CatalogContentPreviewType` and the `onLoadContentFilePreview` prop to `libs/catalog`, wire `ContentTab`'s body to dispatch on the resolved type, add the request-generation guard and blob-URL cleanup to `DetailsPanel`; (2) add the byte classifier and `handleLoadContentFilePreview` in `apps/chat`, wiring it alongside the unmodified `handleLoadContentFile`; (3) add the new i18n key and text prop; (4) extend every existing test that exercises a picked file, and add new tests per file category. There is an intermediate state where both callbacks are live by design — that is the whole point of keeping `onLoadContentFile` — so, unlike the tree-selector revision, no existing test needs to be deleted, only extended.

**The renderer-parity correction's migration.** Add `renderContentFilePreview` to the lib first as an optional, generic render slot; no existing consumer changes. Then extract the already-shipped Skill Builder preview component/hook to shared app locations, add `SkillDetailsFilePreview`, and switch `CatalogView` from its simplified typed callback to the render slot. Finally remove the now-unused app classifier. Rolling back the app half restores the generic typed preview; rolling back the lib half requires reverting the app prop in the same change, while Skill Builder continues using the extracted shared modules unchanged.

**Rollback.** Revert per-commit. Lib-only revert: the app sets `description` and a file tree the lib ignores — the Content summary and the selector disappear, everything else works. App-only revert: the lib carries optional fields no host populates, so no selector renders. Full revert restores today's panel. Runtime kill switch: `OverlayFeature.Skills` off removes the surface entirely, as it does today. **This revision's own rollback**, specifically: reverting either the `libs/catalog` or `apps/chat` half of D6-D9 alone leaves `onLoadContentFile`/the Markdown-only render path fully intact — the tree-selector revision's behavior — never a broken or partially-typed preview.

**This (archive-download) revision's migration.** Also purely additive, and — unlike every other revision in this file — touches no backend or generated-client artifact at all, since D10 confirms none is needed: (1) add `isDownloadPrimary` and `downloadingStatusLabel` to `libs/catalog`'s prop models; (2) add the third `PrimaryButton` branch, `isDownloading` state, and the Manage-menu exclusion to `Header.tsx`; (3) add the Skill branch to `CatalogView.tsx`'s existing `handleDownload`/`isDownloadVisible`; (4) add the two new i18n entries (`entityNotifications.skill.downloaded(Title)`, `catalog.details.skillDownloadError`); (5) extend `Header`/`DetailsPanel`/`CatalogView` tests. There is no intermediate state where the Manage-menu and primary-button paths conflict: until step (2) and (3) both land, `isDownloadActionPrimary` never evaluates `true` for any item (no `isDownloadPrimary` prop exists to call, and no Skill `onDownload` exists to gate on), so Skill's Download silently stays absent (not menu-only, since `onDownload` isn't populated for Skill until step 3) until both halves ship together.

**This revision's own rollback.** Reverting the `libs/catalog` half removes the third `PrimaryButton` branch and `isDownloadPrimary`; if the `apps/chat` half is still in place, Skill's Download falls back to the Manage menu (assuming `shouldShowDownloadAction`'s existing `!isDownloadActionPrimary` clause evaluates `true` once the predicate no longer exists to call) — degraded prominence, not lost functionality. Reverting the `apps/chat` half removes the Skill branch from `handleDownload`/`isDownloadVisible`; `isDownloadPrimary`'s default still matches `CatalogEntityType.Skill`, but with no `onDownload` populated for that item type, both `shouldShowDownloadAction` and `isDownloadActionPrimary` resolve `false` — no Download affordance renders anywhere, the exact pre-revision state. No backend rollback applies, since D10 established this revision makes no backend change.

## Open Questions

1. **Which frontmatter keys do the skills in the target deployments actually use?** D1's table is inferred from `SkillAboutDetails`, which was written before any manifest was read. Confirm against real `SKILL.md` files during task 6.2 and extend or trim the table before merge.
2. **Should a `bundledResources` entry select that file in the selector?** The field names files the skill ships, which the selector also lists. Rendering it as plain text is the smaller change; making each entry a shortcut into the tree is worth doing only once real manifests show the two lists agree.
3. ~~**Should a non-markdown file render as code rather than markdown?**~~ **Resolved by D6/D7.** Yes — a `text`-typed preview renders through `MarkdownCodeBlock` with syntax highlighting keyed off the file's extension via the same `extensionToLanguage` table the Skill Builder uses.
4. **Inherited from `add-skill-catalog-listing` and still open:** whether the `public` skills bucket exists in target deployments (task 8.5 there). Unresolved either way this change is unaffected — it touches the details panel, not the listing.
5. **Does any real skill nest deeply enough to need a depth cap or a "collapse all" affordance?** Deferred to real usage, per the depth/breadth risk above.
6. **Should JSON supporting files get a structured, collapsible tree view instead of syntax-highlighted text?** The Skill Builder's attachment canvas offers one (`react-json-view-lite`), rejected here for `libs/catalog` on dependency grounds (D6). A plain, syntax-highlighted `text` preview (language `'json'`) is likely sufficient for reading a skill's config files; revisit if real skills ship JSON files large or nested enough that flat text is hard to scan.
7. **Should an oversized supporting file (beyond `SKILL_MANIFEST_MAX_BYTES`) get its own "too large to preview" state, distinct from the generic error/unsupported states?** Today it would resolve the same as any other read failure once the byte-guard is extended to every file (D7's "the size guard extracted into a byte-returning sibling"). Revisit once real skills are observed shipping supporting files near or above that cap.
8. **Should the archive download's failure state distinguish "forbidden" from "not found" from "server error," now that D10 confirms DIAL Core returns distinct statuses for each?** Deferred per D10/D12's accepted risk — the single generic failure toast matches the existing Prompt-download branch's granularity. Revisit if user feedback shows the undifferentiated message is confusing (e.g. a shared skill whose access was revoked looks identical to a transient server error).
9. **Should a real progress indicator replace the indeterminate spinner for large skills?** `content-length` is explicitly not forwarded by the backend's safe-header allowlist (D10), so a percentage is not achievable without a backend change. Revisit if real skill archives are observed large enough that an indeterminate spinner is mistaken for a hang — the smallest backend change would be adding `content-length` to `SAFE_SKILL_DOWNLOAD_HEADERS`, which is itself a candidate for a future, narrowly-scoped API-design pass, not something this revision proposes.
10. **Should `isDownloadPrimary`/the Toolset credentials-swap eventually be unified into one generic `primaryAction` descriptor?** Proposal alternative #17 defers this. Revisit if a fourth or fifth entity type needs its own distinct primary action, at which point three independent hardcoded branches in `Header.tsx` will likely be harder to read than one descriptor-based dispatch.
