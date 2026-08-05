## Context

`AttachmentCanvas` today routes all text-previewable files to a `PlainText` renderer that outputs an unstyled `<pre>` block — readable but not highlighted. HTML files are caught by this same path and display raw markup rather than a rendered page. The change adds two new content types (`Code` and `Html`) and connects them to dedicated renderer sub-components while keeping every existing type untouched.

The lib (`libs/attachment-canvas`) is host-agnostic: it must not import app-level context, routing, i18n, or auth. All host knowledge (URL resolution, fetch authentication, label strings) is injected through props. New renderers must follow this boundary.

## Goals / Non-Goals

**Goals:**
- Syntax-highlight all text/code file types currently rendered as plain `<pre>` blocks (via a new `Code` content type and `CodeContent` component).
- Render HTML files and external HTML URLs in a sandboxed `<iframe>` (via a new `Html` content type and `HtmlContent` component).
- Detect CSP/X-Frame-Options blocks for URL-sourced iframes and show a friendly error with an "Open in new tab" fallback.
- Keep `PlainText` exactly as-is (backward compatibility).
- Wire routing in `apps/chat/src/utils/attachment-canvas.ts` and the two new i18n keys.

**Non-Goals:**
- Full in-browser JavaScript sandboxing beyond the `<iframe sandbox>` attribute.
- Video or binary-format rendering.
- Persisting the user's preferred viewer mode or panel width.
- Backend changes.

## Decisions

### D1 — Separate `Code` enum value instead of upgrading `PlainText`

`PlainText` stays untouched because consumers may build `PlainTextCanvasContent` directly (e.g. JSON parse-failure fallback, inline `data` with no extension). Silently changing its renderer would break callers that expect a `<pre>` block. A new `Code` variant lets the routing layer opt in explicitly; `PlainText` keeps its current renderer.

*Alternative considered:* Upgrade `PlainText` to highlight conditionally when a language is detected. Rejected because it changes observable behavior for existing callers without them opting in.

### D2 — `react-syntax-highlighter` as the highlighting library

The `MarkdownRenderer` in `@epam/ai-dial-chat-shared` already depends on `react-syntax-highlighter` (via `react-markdown`'s `rehype-highlight` or `react-syntax-highlighter` directly). Using the same library avoids adding a net-new dependency and reuses its Prism/highlight.js language packs. The `codeBlockTheme` prop already flows through `AttachmentCanvasProps` to `MarkdownRenderer`; the same theme token is mapped to a `react-syntax-highlighter` style for `CodeContent`.

*Verification required during implementation:* confirm `react-syntax-highlighter` is already present in the workspace; add it to `libs/attachment-canvas/package.json` as a peer dependency if not.

### D3 — Language detection from file extension

`CodeContent` receives a `language` prop (string, optional). The lib does not know the file name — `AttachmentCanvas` receives it as `fileName` and must derive the language before passing it. A small pure mapping function (`extensionToLanguage`) will live in `libs/attachment-canvas/src/utils/` and map common extensions to their `react-syntax-highlighter` language identifiers. Unknown extensions map to `undefined` (the lib renders unhighlighted `<pre>` as a fallback — indistinguishable from the current `PlainText` renderer for unrecognised files).

### D4 — `HtmlContent` sandboxing strategy

| Attribute | Rationale |
|---|---|
| `sandbox="allow-scripts"` | Scripts inside the HTML file should execute (interactive demos). No `allow-same-origin` so the iframe cannot access the host's cookies, storage, or DOM. No `allow-forms` or `allow-popups` to prevent phishing or navigation hijacking. |
| `srcdoc` for file attachments | Avoids a second network request; CSP frame-ancestors is not evaluated for `srcdoc`. The fetched text is already in memory; writing it to `srcdoc` is instant. |
| `src` for external URLs | The only way to render a remote page. The iframe naturally inherits the target page's own CSP and `X-Frame-Options`. |

No `allow-same-origin` is intentional and a security requirement: the embedded page must never be able to read session cookies or call auth-bearing APIs.

### D5 — CSP block detection for URL-sourced iframes

Browsers do not fire an `onerror` event when an iframe is blocked by `X-Frame-Options` or CSP `frame-ancestors`. Detection relies on the `load` event: if a cross-origin iframe fires `load` but its `contentDocument` is `null` (or throws on access), the page was blocked. If `load` never fires within a reasonable timeout the load either failed or was blocked.

Practical approach in `HtmlContent`:
1. Attach `onLoad` to the iframe.
2. Inside `onLoad`, try to read `iframe.contentDocument` — a blocked iframe either throws (cross-origin security) or has `contentDocument: null`. Either case sets a `isBlocked` flag.
3. A separate `onError` handler covers outright network failures.
4. When `isBlocked` is true, render the error panel with `htmlFrameBlockedLabel` and an "Open in new tab" anchor.

This heuristic works for same-origin pages too: if `contentDocument` is accessible (same origin), the page loaded fine.

*Limitation:* Some browsers (e.g. Firefox) do not null out `contentDocument` on block — they instead fire `load` with an empty document. In this case the rendered iframe will be blank, which is still acceptable UX; the user can use "Open in new tab". This is not treated as a bug.

### D6 — `HtmlCanvasContent` model shape

```ts
interface HtmlCanvasContent {
  type: AttachmentContentType.Html;
  srcdoc?: string;   // inline HTML text — used for file attachments
  url?: string;      // external URL — used for URL sources; also drives download button
}
```

Exactly one of `srcdoc` or `url` is expected at any given time; having both is not an error (the renderer prefers `srcdoc`). Having neither is a degenerate state the renderer treats the same as an unsupported error.

### D7 — Routing split for html/htm

`isTextPreviewable` is used in multiple places; simply removing `html`/`htm` from `TEXT_EXTENSIONS` risks regressions in call sites that rely on it returning `true` for those extensions. Instead:
- Remove `html`/`htm` from `TEXT_EXTENSIONS`.
- Export a new `HTML_EXTENSIONS` set (`{ 'html', 'htm' }`) from `libs/attachment-canvas/src/constants/file.ts`.
- Export `isHtmlPreviewable(name)` alongside `isTextPreviewable(name)`.
- Update `isExternalSourcePreviewable` in `apps/chat/src/utils/attachment-canvas.ts` to return `true` for HTML extensions too.
- In `openFileCanvas`, add a new branch before the existing `isTextPreviewable` branch:
  - `html`/`htm` → `resolveHtmlCanvasContent` (fetches text, sets `srcdoc`).
- In `openSourceCanvas` (AttachmentResource / external URL path), add:
  - `html`/`htm` URL → `HtmlCanvasContent { url }` (no fetch; iframe loads directly).

### D8 — `CodeCanvasContent` model shape

```ts
interface CodeCanvasContent {
  type: AttachmentContentType.Code;
  text: string;       // raw source text
  language?: string;  // react-syntax-highlighter language identifier; undefined → no highlighting
}
```

The language is resolved at the app layer (from the file extension) so the lib remains extension-agnostic.

## Risks / Trade-offs

- **CSP block detection is heuristic** → Users may see a blank iframe instead of the block error panel on some browsers (see D5). Mitigation: the blank state is distinguishable from a successful render; further tightening is deferred.
- **`react-syntax-highlighter` bundle size** → Prism language packs are large. Mitigation: use dynamic `import()` for the Prism renderer and load only the languages needed; or accept the static import if the lib's consumer (Vite) already tree-shakes it via `MarkdownRenderer`.
- **`srcdoc` length limit** → Some browsers cap `srcdoc` at ~2 MB. Very large HTML files may be clipped silently. Mitigation: add a file-size gate in `resolveHtmlCanvasContent`; fall back to `PlainText` when the text exceeds 1 MB.
- **External URL iframes and tracking** → Opening a third-party URL in an iframe may allow that page to detect the framing origin. This is unavoidable with `src`; mitigated by the absence of `allow-same-origin`.

## Open Questions

- Should `CodeContent` support line-number display? (Not in scope for this change; can be added as a prop later without a breaking change.)
- Should very large code files (> 500 kB) be truncated with a warning rather than rendered in full? (Deferred; `react-syntax-highlighter` may become slow on extremely large inputs.)
