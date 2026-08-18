# catalog-content-file-picker Specification

## Purpose

Defines the generic, entity-agnostic hierarchical file selector rendered by `libs/catalog`'s Content tab: the `CatalogContentTreeNode` model, when the selector appears, how it renders folders and files with per-level indentation, how expand/collapse and open/closed state are host-controlled, how picking a file triggers preview resolution, and the selector's keyboard, accessibility, i18n, RTL, and responsive contract.

## Requirements


### Requirement: `CatalogContentTreeNode` is an entity-agnostic, hierarchical file option model

`libs/catalog/src/types/catalog-content-node-type.ts` SHALL add:

```ts
export enum CatalogContentNodeType {
  File = 'file',
  Folder = 'folder',
}
```

`libs/catalog/src/models/item-details-data.ts` SHALL add:

```ts
export interface CatalogContentFileNode {
  type: CatalogContentNodeType.File;
  /** Opaque id passed back to `onLoadContentFile`. Never parsed by the panel. */
  id: string;
  /** File name shown in the tree row. */
  name: string;
}

export interface CatalogContentFolderNode {
  type: CatalogContentNodeType.Folder;
  /** Stable key identifying this folder for expand/collapse state. Never parsed by the panel. */
  id: string;
  /** Folder name shown in the tree row. */
  name: string;
  /** Nested folders and files. Empty when the folder carries no children. */
  items: CatalogContentTreeNode[];
}

export type CatalogContentTreeNode = CatalogContentFileNode | CatalogContentFolderNode;
```

and retype `CatalogItemPromptContent.files` from a flat array to `files?: CatalogContentTreeNode[]`. `selectedFileId?: string` is unchanged — it still names the id of the file `content` was resolved from.

The lib SHALL treat every node's `id` as opaque: it SHALL NOT split it, decode it, or derive anything from its shape, for either a file or a folder node. It SHALL NOT learn what a skill, a bucket, or a resource URL is through this model — it receives a resolved tree of names and returns a file id.

The lib SHALL NOT rely on `name` being unique across the tree. Two file nodes MAY carry the same `name` when they sit under different parents; only a node's `id` needs to be unique among its ancestor's descendants.

`CatalogContentFileNode`, `CatalogContentFolderNode`, `CatalogContentTreeNode`, and `CatalogContentNodeType` SHALL be exported from `libs/catalog/src/index.ts`. The prior flat `CatalogContentFile` type SHALL be removed and SHALL NOT appear anywhere in `libs/catalog/src`.

#### Scenario: A file id round-trips unchanged

- **WHEN** a file node nested three folders deep carries the id `'scripts/tools/run.py'` and the user picks it
- **THEN** `onLoadContentFile` receives exactly `'scripts/tools/run.py'`

#### Scenario: Duplicate names in different folders are both representable

- **WHEN** two file nodes both carry the name `'run.py'` but sit under different folder nodes
- **THEN** the model accepts both without error, distinguished only by their position in the tree and their own `id`s

---

### Requirement: The selector appears only when there is a file choice to make

`ContentTab` SHALL render the file selector **only** when `files`, counted recursively across every folder, contains two or more `CatalogContentFileNode` entries. A tree with zero or one file node overall, or an absent `files` array, SHALL render the body alone, exactly as the tab does when no picker capability is in play — a selector offering a single option, however deep it sits, is noise, since that file is already the body.

When rendered, the selector SHALL be a `Dropdown` (from `@epam/ai-dial-ui-kit`) whose trigger is built from `InlineSelectTrigger`, showing the currently displayed file's `name` as its label, with a file-count text beside it counting file nodes only (folders excluded from the count). The overlay content is a hierarchical tree of folder and file rows, rendered by the lib itself.

Before the user picks anything, "the currently displayed file" SHALL be the node named by `selectedFileId` — the trigger's label and the body SHALL both reflect that node from the moment the Content tab first renders, not only after some later interaction. The lib does not decide which id that is; it only renders whatever `selectedFileId` the host supplied. For a skill, the host resolves the manifest node's actual opaque listing id, which may be the relative `SKILL_MANIFEST_FILE` value or a Core-prefixed path ending in `/files/SKILL.md`.

The Content tab SHALL keep its existing structure otherwise: the selector sits above the description summary, which sits above the body.

#### Scenario: The trigger and body default to `selectedFileId` before any pick

- **WHEN** the Content tab first renders a tree and no file has been picked yet
- **THEN** the trigger's label is the `name` of the node whose `id` equals `selectedFileId`, and the body shows `content` (the text that node's id was resolved from) — not any other node in the tree

#### Scenario: Several files across folders

- **WHEN** the Content tab renders a tree with two file nodes, one nested inside a folder node
- **THEN** a selector and a file-count text reading `2` are shown, and the trigger names the currently displayed file

#### Scenario: One file, however nested

- **WHEN** the Content tab renders a tree containing exactly one file node, nested inside two folder nodes
- **THEN** no selector and no file count are rendered

#### Scenario: No files

- **WHEN** `promptContent.files` is absent or empty
- **THEN** the tab renders exactly as it does with no picker capability in play

---

### Requirement: The tree renders every folder and file hierarchically, with per-level indentation

Each node in `files` SHALL render as one row. A folder row SHALL show, in order: a folder icon, the folder's `name`, and a trailing disclosure chevron; a file row SHALL show only the file's `name`, with no icon. The folder icon SHALL be the same glyph in both the expanded and collapsed states — only the chevron communicates expand state.

Rows at nesting depth 0 (direct entries of `files`) SHALL carry no indentation. Each further level of nesting SHALL add one additional, fixed indentation step relative to its parent, applied via logical inline-start spacing so it composes correctly under both `dir="ltr"` and `dir="rtl"`.

An expanded folder's `items` SHALL be visible, each rendered per this same rule recursively; a collapsed folder's `items` SHALL NOT be rendered at all (not merely hidden), so a large collapsed subtree costs nothing to keep in the DOM. An empty folder (`items: []`) SHALL still render its own row, with a disclosure chevron that toggles between states but reveals no children.

Within a single folder's `items` (including the top-level `files` array), entries SHALL be ordered case-insensitively by `name`, with folder and file nodes interleaved in that one order — **except** that at the top level only, a node whose `id` equals `selectedFileId` at the time the tree was supplied SHALL be ordered first regardless of name, preserving the existing rule that the manifest (or whichever file the panel opens on) heads the list.

#### Scenario: Folder shown collapsed by default has no visible children

- **WHEN** a folder node with two file children is collapsed
- **THEN** neither child file row is present in the rendered output

#### Scenario: Expanding reveals children at one deeper indent level

- **WHEN** a collapsed folder is expanded
- **THEN** its direct file and folder children become visible, each indented one step further than the folder itself

#### Scenario: An empty folder still renders

- **WHEN** a folder node's `items` array is empty
- **THEN** the folder's row still renders with its disclosure chevron, and expanding it reveals no rows

#### Scenario: Nested indentation compounds

- **WHEN** a file node sits two folders deep
- **THEN** its row's indentation is twice the single-level indentation step

---

### Requirement: Folder expand/collapse state and the selector's open state are controlled by the host

`ContentTab` SHALL accept `expandedFolderIds: ReadonlySet<string>`, `onToggleFolder: (folderId: string) => void`, `isFileSelectorOpen: boolean`, and `onFileSelectorOpenChange: (open: boolean) => void`. The lib SHALL NOT own default-expansion or open/closed state itself — `DetailsPanel` computes and owns both, so that resetting them on an item change is centralized alongside the panel's other Content-tab state.

A folder row's expand/collapse toggle SHALL call `onToggleFolder` with that folder's `id`; the lib SHALL NOT assume any particular default and SHALL render each folder's expanded state exactly as `expandedFolderIds` reports it.

#### Scenario: Toggling a folder calls back with its id

- **WHEN** the user activates a folder row's disclosure control
- **THEN** `onToggleFolder` is called with that folder's `id`, and no local expand/collapse state changes inside the lib

#### Scenario: The lib renders exactly what it is told

- **WHEN** `expandedFolderIds` contains a folder's id
- **THEN** that folder renders expanded, regardless of how many times it has been toggled before

---

### Requirement: Picking a file triggers preview resolution; how it is loaded and rendered is a separate capability

Picking a file node other than the one named by `selectedFileId` SHALL trigger preview resolution. With either async loading callback it SHALL show the catalog loading state while the promise is pending; with `renderContentFilePreview` the host node owns its loading state. Reselecting the file named by `selectedFileId` SHALL restore the original `promptContent.content` **without** issuing a request — that text is already in hand.

The `onLoadContentFile?: (fileId: string) => Promise<string | undefined>` callback remains supported and `Catalog` SHALL continue forwarding it to `DetailsPanel`. The callback's contract does not depend on whether a file id came from a flat list or a tree leaf. **The additive `onLoadContentFilePreview` and `renderContentFilePreview` precedence, rendering, ownership, and stale-request rules are specified by `catalog-content-file-preview`** — this requirement covers only that a pick resolves exactly one preview path and that the base file is free.

A rejection, or a resolved `undefined`, SHALL render `texts.contentFileErrorLabel` as the body. The panel SHALL NOT throw, and SHALL NOT surface an error of its own beyond that text — the host owns notifications.

A picked file, the expanded-folder set, and the selector's open state SHALL all be reset whenever the panel switches to another item or `selectedFileId` changes: the picked file overlay clears, every folder returns to expanded, and the selector closes if it was open — so a re-fetched body is never shown under a stale filename and a new item never inherits another item's expand/collapse choices.

#### Scenario: Picking another file

- **WHEN** the user picks a file node other than the selected one and the host resolves its content
- **THEN** the body renders that content and the trigger shows the newly picked file's name

#### Scenario: Reselecting the base file costs no request

- **WHEN** the user picks another file and then reselects the one named by `selectedFileId`
- **THEN** the original body is restored and no content-loading callback has been called for that reselection

#### Scenario: Load failure

- **WHEN** the loading callback rejects
- **THEN** the body renders `texts.contentFileErrorLabel` and nothing throws

#### Scenario: Load resolves undefined

- **WHEN** the loading callback resolves `undefined`
- **THEN** the body renders `texts.contentFileErrorLabel`

#### Scenario: Switching items drops the picked file and resets the tree

- **WHEN** a file is picked, some folders are collapsed, and the panel then renders a different item
- **THEN** the selector reopens (when reopened) on the new item's `selectedFileId`, every folder shows expanded, and the base body is shown

---

### Requirement: The tree is a fully operable `tree`/`treeitem` widget with a stable focus contract

The overlay root SHALL carry `role="tree"` with an accessible name from `contentFileSelectorAriaLabel`. Each row SHALL carry `role="treeitem"`. A folder row SHALL additionally carry `aria-expanded` matching its entry in `expandedFolderIds`. The row for the file currently displayed (the picked file when one is active, otherwise `selectedFileId`) SHALL carry `aria-selected="true"`; every other file row SHALL carry `aria-selected="false"`; folder rows SHALL NOT carry `aria-selected`. An expanded folder's children SHALL be contained in an element with `role="group"`.

Exactly one row SHALL be keyboard-focusable at a time (roving `tabIndex`, `0` on the focused row and `-1` on every other). Keyboard behavior SHALL be:

- **ArrowDown / ArrowUp** move focus to the next/previous visible row.
- **ArrowRight** on a collapsed folder expands it; it SHALL have no effect on an already-expanded folder or on a file row.
- **ArrowLeft** on an expanded folder collapses it; on a collapsed folder or a file row it moves focus to the parent folder's row, or has no effect at the root.
- **Enter or Space** on a folder row toggles its expanded state via `onToggleFolder`; on a file row it picks that file, closes the selector, and returns focus to the trigger.
- **Escape**, and an outside click, SHALL close the selector without changing the selection and SHALL return focus to the trigger.

When the selector opens, both keyboard focus and the roving `tabIndex="0"` SHALL land on the row for the file currently displayed.

Regardless of how the selector closes — picking a file, Escape, or an outside click — focus SHALL return to the trigger button.

Closing the selector while a picked file's `onLoadContentFile` call is still pending SHALL NOT cancel that call; its eventual resolution SHALL still update the body and clear the loading state.

Every row SHALL be at least 40px tall, satisfying the minimum recommended touch-target size identically on mobile and desktop, and no interaction (expand, collapse, or select) SHALL depend on a hover-only affordance.

#### Scenario: Loading is announced

- **WHEN** a picked file's content is loading
- **THEN** a `role="status"` region carries the loading label

#### Scenario: Nothing is announced once loaded

- **WHEN** the picked file's content has resolved
- **THEN** no status region is present

#### Scenario: Focus lands on the current file when opening

- **WHEN** the selector opens while `scripts/run.py` is the displayed file
- **THEN** `scripts/run.py`'s row receives keyboard focus and is the only row with `tabIndex="0"`

#### Scenario: Focus returns to the trigger on every close path

- **WHEN** the selector is closed via Escape, an outside click, or picking a file
- **THEN** focus is on the trigger button afterward in all three cases

#### Scenario: Arrow-key folder toggling does not move focus

- **WHEN** a collapsed folder row has focus and ArrowRight is pressed
- **THEN** the folder expands and focus remains on the folder's own row

---

### Requirement: i18n, RTL, and library-isolation contract for the selector

- **i18n**: every user-visible string SHALL be a prop with an English default — `texts.contentFileSelectorAriaLabel` (`'Select file'`), `texts.contentFileCountLabel` (`(count) => \`${count} files\``), `texts.contentFileLoadingLabel` (`'Loading file'`), `texts.contentFileErrorLabel` (`'Failed to load this file.'`). The count label is a **function** of the count, not a template string, so a host can apply its own plural rule. `libs/catalog` SHALL NOT call `useTranslation`.
- **RTL**: indentation SHALL use logical (`padding-inline-start`) spacing only. The folder icon SHALL NOT be mirrored. The disclosure chevron's expanded state (pointing toward the block end) needs no RTL counterpart; its collapsed state (rotated toward the inline end) SHALL carry an `rtl:` counterpart rotation so it points the other way under `dir="rtl"`. The `Dropdown` overlay's placement SHALL inherit direction from the document, as it already does for every other use of `Dropdown` in this lib.
- **Responsive**: the overlay's sizing rules SHALL be identical below and above the 769px desktop boundary. It SHALL render at a fixed width on desktop and SHALL cap its own width against the viewport so it never overflows horizontally at a 360px viewport. Its height SHALL be capped, scrolling internally beyond that cap, so it never grows the page itself.
- **Typography and color**: the file-count text SHALL read its class from `ItemDetailsTypography.contentFileCountClassName`, defaulting to `'dial-tiny-text'`, and its color from `--cat-details-file-count-text` with a `--text-secondary` fallback, overridable through `ItemDetailsColors.contentFileCountText`.

#### Scenario: No hardcoded English beyond defaults

- **WHEN** the Content tab and tree source are inspected
- **THEN** they contain no `useTranslation` call and every user-visible string reads from a prop with an English default

#### Scenario: No horizontal overflow at mobile width

- **WHEN** the selector opens in a viewport 360px wide
- **THEN** no part of the overlay extends beyond the viewport's edges

#### Scenario: Collapsed chevron mirrors in RTL

- **WHEN** the document direction is `rtl` and a folder row is collapsed
- **THEN** the disclosure chevron points toward the inline end of the RTL layout, the mirror image of its `ltr` orientation
