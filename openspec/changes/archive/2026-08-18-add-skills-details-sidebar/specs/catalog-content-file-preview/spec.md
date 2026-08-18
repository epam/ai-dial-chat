## ADDED Requirements

### Requirement: `CatalogContentFilePreview` is an entity-agnostic, typed preview model

`libs/catalog/src/models/item-details-data.ts` SHALL add:

```ts
export enum CatalogContentPreviewType {
  Markdown = 'markdown',
  Text = 'text',
  Image = 'image',
  Unsupported = 'unsupported',
}

export interface CatalogContentMarkdownPreview {
  type: CatalogContentPreviewType.Markdown;
  text: string;
}

export interface CatalogContentTextPreview {
  type: CatalogContentPreviewType.Text;
  text: string;
  /** Syntax-highlighting language id. Omitted renders as unhighlighted monospace text. */
  language?: string;
}

export interface CatalogContentImagePreview {
  type: CatalogContentPreviewType.Image;
  /** Already-resolved, browser-loadable image URL. */
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
```

`CatalogContentFilePreview`, its four member interfaces, and `CatalogContentPreviewType` SHALL be exported from `libs/catalog/src/index.ts`.

The lib SHALL treat `text`, `language`, and `url` as opaque, already-resolved values: it SHALL NOT fetch, decode, classify, or otherwise derive a preview's type from a file id, a file name, or file bytes. It SHALL NOT learn what a MIME type, a file extension, or a byte-classification heuristic is through this model — it receives an already-classified preview and renders it.

#### Scenario: The lib renders exactly the type it is given

- **WHEN** a host resolves a preview as `{ type: 'text', text: 'print(1)', language: 'python' }`
- **THEN** the panel renders that text read-only, syntax-highlighted for Python, and performs no classification of its own

#### Scenario: An unsupported preview carries no content

- **WHEN** a host resolves `{ type: 'unsupported' }`
- **THEN** the panel renders its unsupported-state text and attempts no markdown, text, or image rendering

---

### Requirement: `onLoadContentFilePreview` is an additive, opaque-id contract that takes precedence over `onLoadContentFile`

`DetailsPanelProps` and `CatalogProps` SHALL each add:

```ts
onLoadContentFilePreview?: (fileId: string) => Promise<CatalogContentFilePreview | undefined>;
```

`Catalog` SHALL forward it to `DetailsPanel` alongside the existing `onLoadContentFile`, unmodified.

`fileId` SHALL be the identical, opaque value `onLoadContentFile` already receives for the same tree node — the lib SHALL NOT split it, decode it, or derive anything from its shape.

**Precedence.** When picking a file node other than the one named by `selectedFileId`:

1. If `onLoadContentFilePreview` is supplied, it SHALL be called and its resolved `CatalogContentFilePreview` SHALL be rendered per the previous requirement. `onLoadContentFile` SHALL NOT also be called for the same pick.
2. Otherwise, if only `onLoadContentFile` is supplied, it SHALL be called and its resolved `string` SHALL be wrapped as `{ type: CatalogContentPreviewType.Markdown, text }` before rendering — identical to this capability's behavior before `onLoadContentFilePreview` existed.
3. If neither is supplied, picking a file SHALL have no effect beyond what the existing `catalog-content-file-picker` capability already specifies.

A rejection from either callback, or either callback resolving `undefined`, SHALL render `texts.contentFileErrorLabel` as the body, identically regardless of which callback was used. The panel SHALL NOT throw.

Reselecting the file named by `selectedFileId` SHALL restore the original `promptContent.content` (rendered as `{ type: Markdown, text: promptContent.content }`) without calling either callback — that text is already in hand, unchanged from the existing `catalog-content-file-picker` behavior.

#### Scenario: Preview callback takes precedence when both are supplied

- **WHEN** a host supplies both `onLoadContentFile` and `onLoadContentFilePreview`, and the user picks a file
- **THEN** only `onLoadContentFilePreview` is called for that pick

#### Scenario: Legacy callback still renders as Markdown when it is the only one supplied

- **WHEN** a host supplies only `onLoadContentFile`, resolving `'plain text'`
- **THEN** the panel renders `'plain text'` through the same Markdown path it used before this capability existed

#### Scenario: Neither callback supplied

- **WHEN** a host supplies neither callback and the user picks a file
- **THEN** the panel has no picked-file effect beyond what `catalog-content-file-picker` already specifies

#### Scenario: Rejection renders the existing error text regardless of which callback rejected

- **WHEN** `onLoadContentFilePreview` rejects
- **THEN** the body renders `texts.contentFileErrorLabel`, identically to an `onLoadContentFile` rejection

#### Scenario: File id round-trips through the new callback unchanged

- **WHEN** a file node nested three folders deep carries the id `'scripts/tools/run.py'` and the user picks it, with only `onLoadContentFilePreview` supplied
- **THEN** `onLoadContentFilePreview` receives exactly `'scripts/tools/run.py'`

---

### Requirement: The base file's rendering is unaffected by this capability

`promptContent.content` (the base body — a skill's parsed manifest instructions, or a prompt's full text) SHALL continue to render through the same Markdown path it used before this capability existed, whenever `selectedFileId` (with no file picked) is the file being displayed. Neither `onLoadContentFile` nor `onLoadContentFilePreview` SHALL be called to display the base file.

#### Scenario: Opening on the base file calls neither callback

- **WHEN** the details panel opens and no file has been picked yet
- **THEN** the body renders `promptContent.content` directly and neither content-file callback has been called

---

### Requirement: Each preview type renders through an existing, host-agnostic component with no new library dependency

A `markdown` preview SHALL render through `MarkdownWithPlaceholders` (`@epam/ai-dial-chat-shared`) — the same component the base body already uses.

A `text` preview SHALL render through `MarkdownCodeBlock` (`@epam/ai-dial-chat-shared`) as read-only, syntax-highlighted (when `language` is present) or plain monospace (when absent) text, with whitespace preserved and the download control hidden — this capability's contract is read-only display, and no other requirement in this change introduces a download action.

An `image` preview SHALL render an `<img>` element whose `src` is the preview's `url` and whose `alt` is the file tree node's `name`, sized to fit within the Content tab's existing scrollable body container without distortion or causing the container to overflow horizontally.

An `unsupported` preview SHALL render `texts.contentFileUnsupportedLabel` as plain, non-interactive text.

`libs/catalog/package.json` SHALL gain no new dependency for any of the four renderers. `@epam/ai-dial-attachment-canvas` SHALL NOT become a dependency of `libs/catalog`.

#### Scenario: Markdown preview uses the existing safe renderer

- **WHEN** a picked file resolves `{ type: 'markdown', text: '# Notes\n\nSee `run.py`.' }`
- **THEN** it renders through the same component and sanitization posture as the base body — no embedded script or raw HTML executes

#### Scenario: Text preview preserves whitespace and wraps long lines

- **WHEN** a picked file resolves `{ type: 'text', text: 'def f():\n    return 1\n', language: 'python' }`
- **THEN** the indentation is preserved and long lines wrap or scroll within the panel rather than forcing it wider

#### Scenario: Image preview gets an accessible name from the file name

- **WHEN** a picked file named `logo.png` resolves `{ type: 'image', url: 'blob:...' }`
- **THEN** the rendered `<img>` has `alt="logo.png"`

#### Scenario: Unsupported preview shows accessible text, not garbled content

- **WHEN** a picked file resolves `{ type: 'unsupported' }`
- **THEN** the body shows `texts.contentFileUnsupportedLabel` and no attempt is made to decode or display the file's bytes

#### Scenario: No new dependency

- **WHEN** `libs/catalog/package.json` is inspected after this capability lands
- **THEN** it lists the same dependencies as before, and `@epam/ai-dial-attachment-canvas` is not among them

---

### Requirement: A host-owned preview renderer can replace the built-in preview body

`DetailsPanelProps` and `CatalogProps` SHALL additionally accept `renderContentFilePreview?: (fileId: string, fileName: string) => ReactNode`, and `Catalog` SHALL forward it unchanged. The callback SHALL receive the picked tree node's opaque id and resolved basename. `libs/catalog` SHALL NOT pass a bucket, skill path, MIME type, API response, or any other host integration detail.

When `renderContentFilePreview` is supplied and a non-base file is picked, its returned node SHALL fill the Content tab's preview body and SHALL take precedence over both `onLoadContentFilePreview` and `onLoadContentFile`; neither async callback SHALL run for that pick. The preview body container SHALL use `min-h-0`, `flex-1`, and `overflow-hidden` so a host renderer that owns its internal scrolling can occupy the available mobile or desktop panel height without nested horizontal overflow.

The base file named by `selectedFileId` SHALL continue to render `promptContent.content` through the built-in Markdown path and SHALL NOT invoke `renderContentFilePreview`. This preserves the skill requirement that `SKILL.md` shows parsed instructions only.

#### Scenario: Host renderer takes precedence

- **WHEN** all three preview contracts are supplied and the user picks a supporting file whose id is `scripts/run.py` and name is `run.py`
- **THEN** `renderContentFilePreview('scripts/run.py', 'run.py')` supplies the body, and neither loading callback is called

#### Scenario: Base manifest bypasses the host renderer

- **WHEN** the details panel opens with `selectedFileId` pointing to the manifest node
- **THEN** the parsed manifest body renders directly and `renderContentFilePreview` is not called

#### Scenario: Host renderer owns internal scrolling at mobile width

- **WHEN** the host renderer is displayed in the detailed sidebar at 360px
- **THEN** it stays within the Content tab's `min-w-0`/`min-h-0` body and does not force the panel wider

---

### Requirement: Stale preview requests never replace a newer selection's content

`DetailsPanel` SHALL guard every in-flight `onLoadContentFilePreview`/`onLoadContentFile` call with a request identifier captured at the moment the call starts. When that call resolves or rejects, its result SHALL be applied only if no other file has been picked and no other catalog item has been opened since the call started; otherwise the result SHALL be discarded silently, with no visible effect and no error surfaced.

This applies identically whether the newer selection is another file in the same item, a reselection of the base file, or a different catalog item opening while the request is still pending.

#### Scenario: An older request resolving after a newer one does not override it

- **WHEN** the user picks file A, then before A's preview resolves picks file B, and A's preview call resolves after B's already-displayed content has committed
- **THEN** the body continues to show B's content and A's late result is discarded

#### Scenario: A newer request always wins regardless of arrival order

- **WHEN** the user picks file A then file B, and B's preview call resolves before A's
- **THEN** B's content is shown first, and A's later-arriving result is discarded rather than replacing it

#### Scenario: Switching items discards a pending preview request

- **WHEN** a preview request for the previously open item is still pending when the panel renders a different catalog item
- **THEN** the pending request's eventual result is discarded and does not appear under the new item

---

### Requirement: Image preview object URLs are revoked exactly once ownership ends, and never for a non-blob URL

`DetailsPanel` SHALL call `URL.revokeObjectURL` on an `image` preview's `url` when, and only when, both of the following hold: the url string starts with `blob:`, and that preview is about to stop being displayed — because a different file was picked, the panel switched to a different catalog item, or the panel unmounted.

A `url` that does not start with `blob:` SHALL NOT be revoked under any circumstance.

#### Scenario: Replacing an image preview with another file revokes its blob URL

- **WHEN** an `image` preview with a `blob:` URL is displayed and the user picks a different file
- **THEN** the previous preview's URL is revoked once the new file's content is displayed

#### Scenario: Switching catalog items revokes the outgoing item's blob URL

- **WHEN** an `image` preview with a `blob:` URL is displayed and the panel switches to a different catalog item
- **THEN** that URL is revoked as part of the same reset that clears the picked-file overlay

#### Scenario: Unmounting the panel revokes any still-displayed blob URL

- **WHEN** the details panel unmounts while an `image` preview with a `blob:` URL is displayed
- **THEN** that URL is revoked

#### Scenario: A non-blob URL is never revoked

- **WHEN** an `image` preview's `url` does not start with `blob:` and is replaced by another selection
- **THEN** `URL.revokeObjectURL` is not called on it

---

### Requirement: i18n, RTL, accessibility, and responsive contract for the preview area

- **i18n**: `texts.contentFileUnsupportedLabel` SHALL be added to `ItemDetailsTexts` with an English default (`'Preview is not supported for this file'`). `libs/catalog` SHALL NOT call `useTranslation`.
- **Accessible identification**: the preview area SHALL expose an accessible name identifying the currently displayed file, derived from that file's tree node `name` (or, for the base file, the existing behavior is unaffected).
- **Loading announcement**: the existing `role="status"`/`aria-live` region this capability's picker already specifies for a loading file SHALL be reused for a preview load — no second live region is introduced.
- **No focusable editing control**: none of the four preview renderers SHALL render a focusable control other than whatever the surrounding Content tab already provides (the file selector's own trigger). A `text` preview's download control SHALL be hidden.
- **RTL**: none of the four preview renderers SHALL introduce a physical-direction layout rule; each already inherits document direction through the components it reuses.
- **Responsive**: the preview area SHALL render within the Content tab's existing scrollable container at a 360px viewport width and at the 769px desktop boundary without causing the panel to overflow horizontally; long text/code lines SHALL wrap or scroll internally rather than widening the panel; an image SHALL be capped to the container's width.

#### Scenario: No hardcoded English beyond the new default

- **WHEN** the preview-rendering code in `libs/catalog` is inspected
- **THEN** it contains no `useTranslation` call and its only new user-visible string is `contentFileUnsupportedLabel`, with an English default

#### Scenario: Loading a preview announces once, through the existing region

- **WHEN** a picked file's preview is loading
- **THEN** exactly one `role="status"` region is present, carrying the loading label

#### Scenario: No overflow at mobile width

- **WHEN** a `text` preview containing a very long, unbroken line renders in a viewport 360px wide
- **THEN** no part of the panel extends beyond the viewport's edges
