# attachment-canvas-html-viewer Specification

## Purpose

The HTML-viewing variant of the attachment canvas: the `Html` content type, previewability detection, renderer, and routing.

## Capability: attachment-canvas-html-viewer

### Overview

Adds an HTML viewer to `AttachmentCanvas` as a new `Html` content type. HTML file attachments (`.html`, `.htm`) that have a same-origin DIAL download URL are rendered inside a sandboxed `<iframe>` via `src` against that URL, so the response carries its own relaxed, preview-scoped CSP instead of inheriting the host document's; a locally-picked file with no download URL falls back to `srcdoc`. External HTML URLs are also rendered via `src`. When a URL-sourced iframe is blocked by the target page's CSP or `X-Frame-Options`, the viewer shows a friendly error panel with an "Open in new tab" fallback.

---

## Requirements

### Requirement: `HTML_EXTENSIONS` constant and `isHtmlPreviewable` utility

`libs/attachment-canvas/src/constants/file.ts` SHALL remove `'html'` and `'htm'` from `TEXT_EXTENSIONS` and add a new exported constant:

```ts
export const HTML_EXTENSIONS = new Set(['html', 'htm']);
```

`libs/attachment-canvas/src/utils/content.ts` SHALL export `isHtmlPreviewable(name: string): boolean` that returns `true` when the file name's extension (lowercased, without dot) is in `HTML_EXTENSIONS`.

**Rationale:** HTML files need a rendered preview, not a plain-text or syntax-highlighted view. Keeping them in `TEXT_EXTENSIONS` would route them to `CodeContent` instead.

#### Scenario: html extension is previewable

- **WHEN** `isHtmlPreviewable('page.html')` is called
- **THEN** it returns `true`

#### Scenario: htm extension is previewable

- **WHEN** `isHtmlPreviewable('page.htm')` is called
- **THEN** it returns `true`

#### Scenario: non-html extension is not previewable

- **WHEN** `isHtmlPreviewable('style.css')` is called
- **THEN** it returns `false`

#### Scenario: html and htm are no longer in TEXT_EXTENSIONS

- **WHEN** `isTextPreviewable('index.html')` is called
- **THEN** it returns `false`

---

### Requirement: `AttachmentContentType.Html` enum member

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL add `Html = 'html'` to the `AttachmentContentType` enum.

**Feature flag:** none.

#### Scenario: enum member exists

- **WHEN** a consumer imports `AttachmentContentType` from `@epam/ai-dial-attachment-canvas`
- **THEN** `AttachmentContentType.Html` equals the string `'html'`

---

### Requirement: `HtmlCanvasContent` model interface

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL export:

```ts
interface HtmlCanvasContent {
  type: AttachmentContentType.Html;
  srcdoc?: string;
  url?: string;
  isSameOriginUrl?: boolean;
  resolveSourceText?: () => Promise<string>;
  srcdocHostUrl?: string;
}
```

- `srcdoc` — the full HTML text to render inline via the iframe `srcdoc` attribute. Populated only when no `url` is available (a locally-picked file with no download URL); when `url` is set, "View source" instead calls `resolveSourceText`.
- `url` — a URL to render via the iframe `src` attribute. Either this app's own same-origin file-download endpoint (when `isSameOriginUrl` is `true`) or a genuinely external site.
- `isSameOriginUrl` — `true` when `url`'s origin matches the embedding document's own origin. It governs precedence and sandboxing (see the `HtmlContent` renderer requirement): when `true`, `url` takes precedence over `srcdoc` for rendering even if both are set, and the iframe sandbox omits `allow-same-origin`. When `false`/absent and only `url` is set, `url` renders with `allow-same-origin` (safe because it is a different origin). When neither `srcdoc` nor `url` is set, the renderer treats it as an unsupported state and shows the blocked/error panel.
- `resolveSourceText` — lazily fetches the full HTML source text for the "View source" toggle. Set instead of an eagerly-populated `srcdoc` when `url` is set; absent when `srcdoc` is already populated. Invoked only when the toggle is switched to source view, so a preview that is never inspected as source never triggers this fetch.
- `srcdocHostUrl` — a host-served bootstrap document used to render `srcdoc` without inheriting the embedding document's CSP. Only consulted in `srcdoc` mode (see the `HtmlContent` renderer requirement). The chat app sets it to `/api/v1/files/html-preview-frame` for HTML carried inline as attachment `data`.

`HtmlCanvasContent` SHALL be added to the `AttachmentCanvasContent` discriminated union.

`isDownloadable(content)` SHALL return `true` for `HtmlCanvasContent` when `content.url != null` (same rule as `UnsupportedCanvasContent`). When only `srcdoc` is set and `url` is absent, `isDownloadable` returns `false` (there is no remote URL to download from).

#### Scenario: HtmlCanvasContent is part of the union

- **WHEN** a function accepts `AttachmentCanvasContent`
- **THEN** it can receive an `HtmlCanvasContent` value without a TypeScript error

---

### Requirement: new `AttachmentCanvasLabels` fields for HTML viewer

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL add four optional fields to `AttachmentCanvasLabels`:

```ts
/** Message shown when a URL-sourced iframe is blocked by the page's CSP or X-Frame-Options. Defaults to `'This page cannot be displayed in preview'`. */
htmlFrameBlockedLabel?: string;

/** Label for the "Open in new tab" fallback link shown alongside `htmlFrameBlockedLabel`. Defaults to `'Open in new tab'`. */
htmlOpenInNewTabLabel?: string;

/** Tooltip / aria-label for the header toggle button when the rendered view is active (clicking switches to source). Defaults to `'View source'`. */
htmlViewSourceLabel?: string;

/** Tooltip / aria-label for the header toggle button when the source view is active (clicking switches back to rendered). Defaults to `'View rendered'`. */
htmlViewRenderedLabel?: string;
```

**i18n impact:** Four new `AttachmentCanvasI18nKeys` members SHALL be added in `apps/chat/src/constants/translation-keys.ts` and four new keys added to `apps/chat/src/i18n/locales/en.json`:

| Key enum member | en.json key | en.json value |
|---|---|---|
| `HtmlFrameBlocked` | `attachmentCanvas.htmlFrameBlocked` | `"This page cannot be displayed in preview"` |
| `HtmlOpenInNewTab` | `attachmentCanvas.htmlOpenInNewTab` | `"Open in new tab"` |
| `HtmlViewSource` | `attachmentCanvas.htmlViewSource` | `"View source"` |
| `HtmlViewRendered` | `attachmentCanvas.htmlViewRendered` | `"View rendered"` |

The chat app SHALL pass all four translated labels in the `labels` prop of `AttachmentCanvasContainer` (`apps/chat/src/app/app.tsx`), which forwards them to `AttachmentCanvas`.

#### Scenario: labels have default values

- **WHEN** `AttachmentCanvas` is rendered with a minimal `labels` object (no HTML labels provided)
- **THEN** `HtmlContent` renders the default string `'This page cannot be displayed in preview'` in the blocked state

---

### Requirement: `HtmlContent` renderer component

`libs/attachment-canvas/src/components/HtmlContent/HtmlContent.tsx` SHALL render HTML inside a sandboxed `<iframe>` by default, or as a syntax-highlighted source block when `isSourceView` is `true`.

**View modes:**

`isSourceView` is a **prop** (not internal state) — it is owned and toggled by `AttachmentCanvas` (see the toggle button requirement below).

- **Rendered mode (`isSourceView === false`):** displays the iframe (see below).
- **Source mode (`isSourceView === true`):** renders the resolved source text using `CodeContent` with `language: 'html'`. The text is `content.srcdoc` when set, or the string returned by `content.resolveSourceText()` once that lazy fetch resolves (a spinner is shown while it is pending). When `resolveSourceText()` rejects, the rendered iframe is shown instead, and the next switch to source view retries the fetch. Only reachable when `content.srcdoc != null` or `content.resolveSourceText != null`.

**Toggle button:**
- Rendered in the `AttachmentCanvas` panel header (`rightActions`), alongside the download and copy buttons — **not** inside `HtmlContent`.
- Uses `IconCode` ("View source") when rendered view is active; `IconEye` ("View rendered") when source view is active.
- `aria-pressed={isHtmlSourceView}` to expose toggle state.
- Tooltip/`aria-label`: `labels.htmlViewSourceLabel` when rendered; `labels.htmlViewRenderedLabel` when source.
- The toggle button SHALL only be rendered when `content.srcdoc != null` or `content.resolveSourceText != null`. When neither is set, there is no source text to show, so the toggle is hidden.
- `isHtmlSourceView` state is reset to `false` in `AttachmentCanvas` whenever `content` changes.

Let `isSameOriginUrl = content.isSameOriginUrl === true && content.url != null` and `isSrcdoc = !isSameOriginUrl && content.srcdoc != null`. `isSameOriginUrl` takes precedence over `srcdoc` so a same-origin download URL always renders via `src`, even when `srcdoc` is also populated (for the "View source" toggle).

**`srcdoc` mode (local file attachments or inline data, no download URL):**
- Without `content.srcdocHostUrl`: set the iframe's `srcdoc` attribute to `content.srcdoc`.
- With `content.srcdocHostUrl`: set the iframe's `src` attribute to `content.srcdocHostUrl` and leave `srcdoc` unset, so the document carries its host response's own CSP instead of inheriting the embedding document's. On the iframe's first `load`, post `{ type: HTML_PREVIEW_FRAME_RENDER_MESSAGE, html: content.srcdoc }` to its `contentWindow` with target `'*'` (the sandboxed frame has an opaque origin). Later `load` events for the same content (the host document replacing itself) SHALL NOT post again; a new `content` SHALL remount the iframe.
- The iframe SHALL carry `sandbox="allow-scripts"` — no `allow-same-origin`, no `allow-forms`, no `allow-popups`, no `allow-navigation`.
- The iframe SHALL fill the remaining panel body area (`w-full h-full border-none`).
- No CSP block detection is needed for `srcdoc`; the content is always rendered. As in every rendered mode, a spinner covers the still-mounted, `invisible` iframe until its first `load`.

**`src` mode, same-origin download (`isSameOriginUrl === true`):**
- Set the iframe's `src` attribute to `content.url` (this app's own `/api/v1/files/download` route).
- The iframe SHALL carry `sandbox="allow-scripts"` — no `allow-same-origin`. Although `url` is same-origin, granting `allow-same-origin` would let the framed document read this app's cookies/session; omitting it keeps the framed document at an opaque origin regardless of the URL's own origin. Safety therefore rests on the sandbox, not on the response's CSP — the download response itself carries its own relaxed, preview-scoped CSP (see `chat-content-security-policy` spec) so its inline `<script>`/`<style>` render, but that relaxed policy is not a substitute for the sandbox.
- No CSP block detection: `contentDocument` access is meaningless at an opaque origin regardless of load outcome, so the `onLoad` handler skips it and trusts the load event.

**`src` mode, external URL (`isSameOriginUrl` falsy):**
- Set the iframe's `src` attribute to `content.url`.
- The iframe SHALL carry `sandbox="allow-scripts allow-same-origin"`. `allow-same-origin` is safe here because the external URL is a different origin from the host app, so the embedded page cannot access the host's cookies or storage.
- **CSP block detection:** attach an `onLoad` handler. Inside `onLoad`, wrap the `contentDocument` access in a `try/catch`. If accessing `contentDocument` throws (cross-origin security error) or `contentDocument` is `null`, set `isBlocked = true`. Also attach an `onError` handler that sets `isBlocked = true` for outright network/load failures.
- When `isBlocked` is `true`, replace the iframe with the blocked-state panel (see below).
- Show a loading spinner while the iframe is loading (`isLoading` state, set to `false` in `onLoad` or `onError`). The iframe SHALL stay mounted and merely `invisible` behind the spinner, so hiding it never restarts the load.
- `isLoading` and `isBlocked` SHALL both reset whenever `content` changes, so a newly opened attachment never inherits the previous one's blocked or settled state.
- Since source text is not fetched eagerly for URL-only content, the toggle button relies on `resolveSourceText` being set (see the same-origin case above); when it is absent (a genuinely external URL with no source-text source), the toggle is not shown.

**Blocked-state panel:**
- Centered in the panel body, same layout as the existing `Unsupported` / `Error` panels.
- Shows `labels.htmlFrameBlockedLabel` (default: `'This page cannot be displayed in preview'`).
- Shows the ui-kit `LinkButton` with `href={content.url}` and `target="_blank"`, labelled `labels.htmlOpenInNewTabLabel` (default: `'Open in new tab'`). Passing `href` makes it render a real anchor, so the target stays middle-clickable, copyable, and openable in a background tab; the kit supplies `rel="noopener noreferrer"` for `target="_blank"`.
- The anchor SHALL only be rendered when `content.url != null`.

**Props interface (`HtmlContentProps`):**
```ts
interface HtmlContentProps {
  content: HtmlCanvasContent;
  labels: Pick<AttachmentCanvasLabels, 'htmlFrameBlockedLabel' | 'htmlOpenInNewTabLabel'>;
  isSourceView: boolean;
  title?: string;
  /** Forwarded to the source-view `CodeContent`; when omitted it falls back to `CodeBlockTheme.Light`. */
  codeBlockTheme?: CodeBlockTheme;
  /** Typography class for the "Open in new tab" link. Defaults to `'dial-body-semi-text'`. */
  openInNewTabButtonTypographyClassName?: string;
}
```

`htmlViewSourceLabel` and `htmlViewRenderedLabel` are consumed by `AttachmentCanvas` for the header toggle button, not by `HtmlContent`.

The component MUST NOT read from any app-level context.

**RTL impact:** none — the iframe and blocked-state panel are direction-agnostic. The blocked-state panel uses only symmetric classes (`flex-col items-center justify-center gap-3`, `text-center`), so it needs no logical-property variants.

**Accessibility:**
- The iframe SHALL carry `title` set to `title` prop value when provided.
- The toggle button (in `AttachmentCanvas` header) exposes its current state via `aria-pressed`.

#### Scenario: srcdoc content renders iframe by default

- **WHEN** `HtmlContent` is rendered with `{ type: Html, srcdoc: '<p>Hello</p>' }`
- **THEN** the iframe `srcdoc` attribute equals `'<p>Hello</p>'`
- **AND** the source-view toggle button is rendered

#### Scenario: toggle switches to source view

- **WHEN** the user clicks the "View source" toggle button
- **THEN** the iframe is replaced by a syntax-highlighted HTML source block
- **AND** the toggle button label changes to "View rendered"

#### Scenario: toggle switches back to rendered view

- **WHEN** the user is in source view and clicks the "View rendered" toggle button
- **THEN** the source block is replaced by the iframe
- **AND** the toggle button label changes to "View source"

#### Scenario: toggle not shown for url-only content

- **WHEN** `HtmlContent` is rendered with `{ type: Html, url: 'https://example.com/page.html' }` (no `srcdoc`)
- **THEN** no toggle button is rendered

#### Scenario: url content sets iframe src

- **WHEN** `HtmlContent` is rendered with `{ type: Html, url: 'https://example.com/page.html' }`
- **THEN** the iframe `src` attribute equals `'https://example.com/page.html'`

#### Scenario: blocked iframe shows error panel

- **WHEN** the iframe's `onLoad` fires and `contentDocument` access throws
- **THEN** the iframe is replaced by the blocked-state panel
- **AND** the panel shows `htmlFrameBlockedLabel`
- **AND** an "Open in new tab" link pointing to `content.url` is rendered

#### Scenario: blocked panel is not shown for srcdoc

- **WHEN** `HtmlContent` is rendered with `srcdoc` content (no `url`)
- **THEN** no block-detection logic runs and no blocked panel is shown

#### Scenario: same-origin url takes precedence over srcdoc and skips block detection

- **WHEN** `HtmlContent` is rendered with `{ type: Html, url: <download url>, isSameOriginUrl: true, srcdoc: <text>, resolveSourceText: <fn> }`
- **THEN** the iframe `src` attribute equals the download url, and `srcDoc` is not set
- **AND** the sandbox is `allow-scripts` with no `allow-same-origin`
- **AND** the `onLoad` handler does not run block-detection logic

---

### Requirement: `AttachmentCanvas` switch handles `Html` variant

The content-type switch SHALL carry a `case AttachmentContentType.Html` branch rendering `<HtmlContent content={content} labels={...} isSourceView={isHtmlSourceView} title={fileName} />`. That switch lives in `libs/attachment-canvas/src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx`, which `AttachmentCanvas` renders inside the panel chrome and to which it forwards `isHtmlSourceView` and the HTML labels; the header toggle button below stays in `AttachmentCanvas` itself.

The panel chrome SHALL be identical to other content types. The scroll container class for `Html` SHALL be `h-full overflow-hidden` (the iframe and source view manage their own scroll).

**`isHtmlSourceView` state** is owned by `AttachmentCanvas`, initialized to `false`, and reset to `false` whenever `content` changes.

**Toggle button in `rightActions`:** When `content.type === Html && (content.srcdoc != null || content.resolveSourceText != null)`, a toggle button SHALL be rendered in the panel header alongside the other action buttons:
- `IconCode` ("View source") in rendered mode; `IconEye` ("View rendered") in source mode.
- `aria-pressed={isHtmlSourceView}`.
- Tooltip and `aria-label` use `htmlViewSourceLabel` / `htmlViewRenderedLabel` from `labels`.

The download button SHALL follow `isDownloadable(content)` — shown only when `content.url != null`.

No copy-text action is shown for `Html` content (copying is available in source view via the browser's native selection).

#### Scenario: Html branch renders HtmlContent

- **WHEN** `AttachmentCanvas` receives an `HtmlCanvasContent`
- **THEN** the panel body contains an `HtmlContent` element

#### Scenario: download button shown when url is present

- **WHEN** `AttachmentCanvas` receives `HtmlCanvasContent { url: 'https://...' }` and `onDownload` is provided
- **THEN** the download button is rendered

#### Scenario: download button hidden when only srcdoc is set

- **WHEN** `AttachmentCanvas` receives `HtmlCanvasContent { srcdoc: '<p>...</p>' }` and `onDownload` is provided
- **THEN** the download button is NOT rendered

---

### Requirement: `resolveHtmlCanvasContent` app-layer resolver

`libs/chat-hooks/src/files/attachment-canvas.ts` SHALL export, from `@epam/ai-dial-chat-hooks`:

```ts
export const resolveHtmlCanvasContent = async (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<HtmlCanvasContent | ErrorCanvasContent | null>
```

Resolution branches on the injected `resolvers.resolveDialUrl(attachment)`, which decides the primary render target:

- **A non-`null` download URL** (the attachment is a DIAL-uploaded file): return `{ type: AttachmentContentType.Html, url: downloadUrl, isSameOriginUrl, resolveSourceText }` with no eager fetch and no `srcdoc`. `isSameOriginUrl` is a real comparison — the download URL's origin against the embedding document's own origin — not a hardcoded literal. `resolveSourceText` is a lazy `() => Promise<string>` that fetches and returns the HTML text (via the shared `resolveAttachmentText` helper) only when invoked, and rejects if that fetch fails; it is not called during resolution, so a preview that is never switched to source view never fetches the text at all, avoiding a double download against the same URL the iframe already loads. The size gate below does not apply to this branch — the preview always renders via the download URL regardless of the file's text size.
- **No download URL** (a locally-picked file or inline `data`, not yet uploaded): delegate to the shared `resolveAttachmentText` helper eagerly, gated at 1 MiB — return `{ type: AttachmentContentType.Html, srcdoc: text, srcdocHostUrl: resolvers.htmlSrcdocHostUrl }` when the fetched text is within the gate (`HTML_SRCDOC_SIZE_LIMIT = 1_048_576`), or `null` when it exceeds the gate (falling through to `UnsupportedCanvasContent`).

The DIAL-URL resolution is injected rather than imported, so the resolver stays host-agnostic; `apps/chat/src/hooks/attachment/useAttachmentCanvasResolvers.ts` binds it and exposes it to the canvas hook as `resolveHtmlContent(attachment)`. The optional `AttachmentCanvasUrlResolvers.htmlSrcdocHostUrl` is likewise host-supplied: the chat app sets it to `DIAL_HTML_PREVIEW_FRAME_URL` (`/api/v1/files/html-preview-frame`, from `apps/chat/src/utils/dial-file.ts`) in `apps/chat/src/utils/attachment-display-resolvers.ts`.

Because `null` also means "this attachment carries no text at all" (an external HTML URL), the caller SHALL distinguish the two with `hasAttachmentTextSource(attachment)` — see the routing requirement below — so a size-gated local file is not re-opened as a url-only iframe and reported as frame-blocked.

#### Scenario: DIAL file resolves to url with a lazy source-text resolver, no eager fetch

- **WHEN** `resolveHtmlCanvasContent` is called with an HTML file attachment that has a download URL
- **THEN** it returns `{ type: AttachmentContentType.Html, url: <download url>, isSameOriginUrl: <real origin comparison>, resolveSourceText: <fn> }` with no `srcdoc`
- **AND** no text fetch is performed until `resolveSourceText()` is invoked

#### Scenario: local file with small text resolves to srcdoc only

- **WHEN** `resolveHtmlCanvasContent` is called with a locally-picked HTML file (no download URL) whose text is within the 1 MiB gate
- **THEN** it returns `{ type: AttachmentContentType.Html, srcdoc: <fetched text>, srcdocHostUrl: resolvers.htmlSrcdocHostUrl }` with no `url`

#### Scenario: local file with oversized text falls through

- **WHEN** `resolveHtmlCanvasContent` is called with a locally-picked HTML file (no download URL) whose text exceeds 1 MiB
- **THEN** it returns `null`

#### Scenario: fetch error propagates

- **WHEN** the underlying fetch returns HTTP 403
- **THEN** `resolveHtmlCanvasContent` returns an `ErrorCanvasContent` with `errorType: Forbidden`

---

### Requirement: routing update — html/htm attachments route to `Html`

The canvas hook's internal `openFileCanvas` SHALL add a branch before the existing `isTextPreviewable` check — in `libs/attachment-canvas/src/hooks/useOpenAttachmentCanvas/useOpenAttachmentCanvas.ts`:

- If the attachment is an HTML source, call the injected `resolvers.resolveHtmlContent(attachment)` and open the canvas with the result.

An attachment counts as an HTML source when `isHtmlPreviewable(attachment.name)` is `true` **or** `isHtmlPreviewable(getUrlFileName(attachment.url))` is `true`. The URL fallback is required because a cited source's `name` is its citation title, which usually carries no file extension — matching on the name alone routes such a source to the Unsupported branch. The same combined check SHALL gate the Unsupported branch, so the two cannot disagree.

When `resolveHtmlCanvasContent` returns `null`, the fallback SHALL depend on whether the attachment had text to fetch:

- `resolvers.hasTextSource(attachment) === false` — an external HTML URL. Open `HtmlCanvasContent { url }` so the iframe loads it directly, or return `false` when there is no URL either.
- `resolvers.hasTextSource(attachment) === true` — the text was fetched and rejected by the size gate. Open `UnsupportedCanvasContent`; re-opening it as a url-only iframe would render the frame-blocked panel, telling the user the page refused to be framed when it never was.

That predicate is the `hasAttachmentTextSource` helper from `libs/chat-hooks/src/files/attachment-canvas.ts`, injected into the hook as `resolvers.hasTextSource` rather than imported by it.

`isExternalSourcePreviewable`, in `libs/chat-hooks/src/files/source-content.ts` (re-exported from `@epam/ai-dial-chat-hooks`), SHALL return `true` for `html`/`htm` URL extensions (so external HTML source links open in the canvas rather than a new tab).

For external URL sources (an `AttachmentResource` whose URL path ends in `.html` or `.htm`), the canvas SHALL be opened with `HtmlCanvasContent { url }` — no fetch, the iframe loads the URL directly.

**i18n impact:** see "new `AttachmentCanvasLabels` fields" requirement above.

#### Scenario: html attachment with a download URL opens Html content type

- **WHEN** the user clicks a `.html` file attachment that has a DIAL download URL
- **THEN** `openCanvas` is called with `HtmlCanvasContent { url: <download url>, isSameOriginUrl: <real origin comparison>, resolveSourceText: <fn> }`, with no `srcdoc` and no eager text fetch

#### Scenario: htm attachment with no download URL opens Html content type

- **WHEN** the user clicks a `.htm` file attachment with no DIAL download URL (a locally-picked file)
- **THEN** `openCanvas` is called with `HtmlCanvasContent { srcdoc: <file text> }`

#### Scenario: external html URL opens Html content type

- **WHEN** an `AttachmentResource` URL ends with `.html`
- **THEN** `openCanvas` is called with `HtmlCanvasContent { url: <resource url> }`
- **AND** no text fetch is performed

#### Scenario: cited source with an extension-less title opens Html content type

- **WHEN** a cited source's `name` is a title with no file extension and its URL path ends with `.html`
- **THEN** `openCanvas` is called with `HtmlCanvasContent { url: <resource url> }`, not `UnsupportedCanvasContent`

#### Scenario: oversized local html file opens the unsupported panel

- **WHEN** a locally-picked HTML file attachment with no DIAL download URL has text exceeding the srcdoc size gate, so `resolveHtmlCanvasContent` returns `null`
- **THEN** `openCanvas` is called with `UnsupportedCanvasContent`, and the frame-blocked panel is not shown
