## 1. Lib — types, models, and constants

- [x] 1.1 Add `Code = 'code'` and `Html = 'html'` to `AttachmentContentType` enum in `libs/attachment-canvas/src/types/attachment-canvas.ts`
- [x] 1.2 Remove `'html'` and `'htm'` from `TEXT_EXTENSIONS` in `libs/attachment-canvas/src/constants/file.ts`; add and export `HTML_EXTENSIONS = new Set(['html', 'htm'])`
- [x] 1.3 Add `CodeCanvasContent` and `HtmlCanvasContent` interfaces to `libs/attachment-canvas/src/models/attachment-canvas.ts`; add both to the `AttachmentCanvasContent` union
- [x] 1.4 Add four new optional label fields (`htmlFrameBlockedLabel`, `htmlOpenInNewTabLabel`, `htmlViewSourceLabel`, `htmlViewRenderedLabel`) to `AttachmentCanvasLabels` in `libs/attachment-canvas/src/models/attachment-canvas.ts`
- [x] 1.5 Update `isDownloadable` in `libs/attachment-canvas/src/utils/download.ts` to return `true` for `CodeCanvasContent` and for `HtmlCanvasContent` when `url != null`

## 2. Lib — utilities

- [x] 2.1 Export `isHtmlPreviewable(name: string): boolean` from `libs/attachment-canvas/src/utils/content.ts` (checks against `HTML_EXTENSIONS`)
- [x] 2.2 Export `extensionToLanguage(ext: string): string | undefined` from `libs/attachment-canvas/src/utils/content.ts` with the full extension-to-language mapping table from the spec

## 3. Lib — verify dependency

- [x] 3.1 Confirm `react-syntax-highlighter` and `@types/react-syntax-highlighter` are available in the workspace; if not, add them to `libs/attachment-canvas/package.json` as dependencies and install

## 4. Lib — `CodeContent` component

- [x] 4.1 Create `libs/attachment-canvas/src/components/CodeContent/CodeContent.tsx` — renders `content.text` with `react-syntax-highlighter` `PrismLight` (or unstyled `<pre>` when `language` is `undefined`/`'plaintext'`), wrapped in `<div dir="ltr" className="overflow-auto h-full">`
- [x] 4.2 Implement the `codeBlockTheme` → Prism style mapping in a utility (extract or reuse from existing theme mapping); apply it in `CodeContent`
- [x] 4.3 Wrap `CodeContent` in `React.memo`
- [x] 4.4 Export `CodeContent` from the lib's barrel (`libs/attachment-canvas/src/index.ts`) if needed by `HtmlContent`

## 5. Lib — `HtmlContent` component

- [x] 5.1 Create `libs/attachment-canvas/src/components/HtmlContent/HtmlContent.tsx` with `isSourceView` state defaulting to `false`
- [x] 5.2 Implement rendered mode: `<iframe srcdoc={content.srcdoc} sandbox="allow-scripts" ...>` for file attachments; `<iframe src={content.url} sandbox="allow-scripts allow-same-origin" ...>` for URL sources; loading spinner while `isLoading`
- [x] 5.3 Implement CSP block detection for `src` mode: `onLoad` checks `contentDocument` access in `try/catch`; `onError` sets `isBlocked`; blocked-state panel shows `htmlFrameBlockedLabel` and "Open in new tab" anchor
- [x] 5.4 Implement source mode: renders `<CodeContent content={{ type: Code, text: content.srcdoc, language: 'html' }} codeBlockTheme={codeBlockTheme} />` when `isSourceView === true`
- [x] 5.5 Implement the view-toggle button: `IconCode` / `IconEye` icon button with `aria-pressed`, shown only when `content.srcdoc != null`; uses `htmlViewSourceLabel` / `htmlViewRenderedLabel` for tooltip and `aria-label`
- [x] 5.6 Add `title` prop to the iframe for accessibility

## 6. Lib — `AttachmentCanvas` switch

- [x] 6.1 Add `case AttachmentContentType.Code` to `AttachmentCanvas.tsx` switch: renders `<CodeContent content={content} codeBlockTheme={codeBlockTheme} />`; scroll container class `overflow-hidden`; shows download and copy-text buttons
- [x] 6.2 Add `case AttachmentContentType.Html` to `AttachmentCanvas.tsx` switch: renders `<HtmlContent content={content} labels={labels} codeBlockTheme={codeBlockTheme} title={fileName} />`; scroll container class `overflow-hidden`; download follows `isDownloadable`; no copy-text button

## 7. App — i18n strings

- [x] 7.1 Add four new members to `AttachmentCanvasI18nKeys` in `apps/chat/src/constants/translation-keys.ts`: `HtmlFrameBlocked`, `HtmlOpenInNewTab`, `HtmlViewSource`, `HtmlViewRendered`
- [x] 7.2 Add the four corresponding English strings to `apps/chat/src/i18n/locales/en.json` under the `attachmentCanvas` namespace

## 8. App — resolvers

- [x] 8.1 Export `resolveCodeCanvasContent(attachment, language?)` from `apps/chat/src/utils/attachment-canvas.ts` — delegates to `resolveAttachmentText`, returns `CodeCanvasContent` or `ErrorCanvasContent | null`
- [x] 8.2 Export `resolveHtmlCanvasContent(attachment)` from `apps/chat/src/utils/attachment-canvas.ts` — delegates to `resolveAttachmentText`, applies 1 MiB size gate, returns `HtmlCanvasContent { srcdoc, url }` or `ErrorCanvasContent | null`

## 9. App — routing

- [x] 9.1 Update `isExternalSourcePreviewable` in `apps/chat/src/utils/attachment-canvas.ts` to return `true` for `html`/`htm` URL extensions
- [x] 9.2 In `openFileCanvas` (`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`): add an `isHtmlPreviewable` branch (before the `isTextPreviewable` branch) that calls `resolveHtmlCanvasContent`
- [x] 9.3 In `openFileCanvas`: replace the `isTextPreviewable` branch's `resolveTextCanvasContent` call with `resolveCodeCanvasContent(attachment, extensionToLanguage(ext))`
- [x] 9.4 In the external source / `AttachmentResource` path: route `html`/`htm` URL extensions to `HtmlCanvasContent { url }` (no fetch)

## 10. App — `AttachmentCanvasContainer`

- [x] 10.1 Wire the four new HTML label props from `AttachmentCanvasI18nKeys` into the `labels` object passed to `AttachmentCanvas` in `AttachmentCanvasContainer`

## 11. Verification

- [x] 11.1 Run `npm exec nx lint attachment-canvas` and fix any errors
- [x] 11.2 Run `npm exec nx typecheck attachment-canvas` (or `build`) and fix any TypeScript errors
- [x] 11.3 Run `npm exec nx lint chat` and `npm exec nx typecheck chat` and fix any errors
- [x] 11.4 Manual smoke test: open a `.ts` file attachment → confirm syntax highlighting
- [x] 11.5 Manual smoke test: open a `.xml` file attachment → confirm XML highlighting
- [x] 11.6 Manual smoke test: open a `.html` file attachment → confirm rendered iframe; toggle to source view → confirm highlighted HTML source; toggle back
- [x] 11.7 Manual smoke test: open an external `.html` URL source → confirm iframe loads or blocked panel shows with "Open in new tab"
