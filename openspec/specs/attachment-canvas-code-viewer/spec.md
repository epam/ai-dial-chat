# attachment-canvas-code-viewer Specification

## Purpose

The code-viewing variant of the attachment canvas: the `Code` content type, extension-to-language mapping, renderer, and routing.

## Capability: attachment-canvas-code-viewer

### Overview

Adds a syntax-highlighted code viewer to `AttachmentCanvas` as a new `Code` content type. All text-previewable file extensions that are not already handled by a dedicated renderer (Markdown, JSON, PDF) are routed to this viewer instead of the existing plain-text `<pre>` renderer. The `PlainText` content type is preserved unchanged.

---

## Requirements

### Requirement: `AttachmentContentType.Code` enum member

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL add `Code = 'code'` to the `AttachmentContentType` enum.

**i18n impact:** none — the `Code` type reuses the existing `copyTextLabel` / `copiedTextLabel` labels.

**RTL impact:** none — the code block is wrapped in `dir="ltr"` (source code is always LTR, same pattern as the JSON viewer).

**Feature flag:** none.

#### Scenario: enum member exists

- **WHEN** a consumer imports `AttachmentContentType` from `@epam/ai-dial-attachment-canvas`
- **THEN** `AttachmentContentType.Code` equals the string `'code'`

---

### Requirement: `CodeCanvasContent` model interface

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL export a new interface:

```ts
interface CodeCanvasContent {
  type: AttachmentContentType.Code;
  text: string;
  language?: string;
}
```

`text` is the raw source text. `language` is an optional `react-syntax-highlighter` language identifier (`'typescript'`, `'python'`, `'xml'`, etc.); when absent the viewer renders the text without syntax colouring (plain monospace).

`CodeCanvasContent` SHALL be added to the `AttachmentCanvasContent` discriminated union.

#### Scenario: CodeCanvasContent is part of the union

- **WHEN** a function accepts `AttachmentCanvasContent`
- **THEN** it can receive a `CodeCanvasContent` value without a TypeScript error

---

### Requirement: `extensionToLanguage` utility

`libs/attachment-canvas/src/utils/content.ts` SHALL export `extensionToLanguage(ext: string): string | undefined` that maps a lowercased file extension (without leading dot) to a `react-syntax-highlighter` language identifier. Unmapped extensions return `undefined`.

Minimum required mappings:

| Extension(s) | Language identifier |
|---|---|
| `xml` | `xml` |
| `csv`, `tsv` | `plaintext` |
| `yaml`, `yml` | `yaml` |
| `toml` | `toml` |
| `ini`, `conf`, `cfg` | `ini` |
| `css`, `scss`, `sass`, `less` | `css` |
| `js`, `mjs`, `cjs` | `javascript` |
| `jsx` | `jsx` |
| `ts`, `mts`, `cts` | `typescript` |
| `tsx` | `tsx` |
| `py` | `python` |
| `rb` | `ruby` |
| `go` | `go` |
| `rs` | `rust` |
| `java` | `java` |
| `kt` | `kotlin` |
| `swift` | `swift` |
| `c`, `h` | `c` |
| `cpp` | `cpp` |
| `cs` | `csharp` |
| `sh`, `bash`, `zsh`, `fish`, `ps1` | `bash` |
| `sql` | `sql` |
| `json`, `jsonl`, `ndjson` | `json` |
| `txt`, `log`, `env`, `gitignore`, `dockerfile`, `makefile` | `plaintext` |

#### Scenario: known extension returns an identifier

- **WHEN** `extensionToLanguage('ts')` is called
- **THEN** it returns `'typescript'`

#### Scenario: unknown extension returns undefined

- **WHEN** `extensionToLanguage('xyz')` is called
- **THEN** it returns `undefined`

---

### Requirement: `CodeContent` renderer component

`libs/attachment-canvas/src/components/CodeContent/CodeContent.tsx` SHALL render `content.text` using `react-syntax-highlighter`'s `Prism` renderer.

Behaviour:
- Wrap the highlighter in `<div dir="ltr">` to force LTR text direction regardless of the app's locale.
- The container SHALL be scrollable (`overflow-auto`) and fill the panel body (`h-full`). The highlighted branch SHALL pass `wrapLongLines`, so a long source line wraps instead of forcing a horizontal scroll.
- When `content.language` is `undefined` or `'plaintext'`, the component SHALL render the text as an unstyled monospace `<pre>` block (same visual as the current `PlainText` renderer) — no highlighting, no Prism runtime cost.
- The `codeBlockTheme` prop (forwarded from `AttachmentCanvasProps`, defaulting to `CodeBlockTheme.Light`) SHALL select the highlight style from the shared `restrainedSyntaxTheme` exported by `@epam/ai-dial-chat-shared` — the same palette the markdown code block uses, so the two surfaces cannot drift apart. Light/dark differences that the Prism style itself does not carry SHALL be applied through the component's own SCSS module rather than by branching to a second Prism theme.
- The component MUST NOT read from any app-level context (auth, theme, i18n, feature flags).

`CodeContent` is not exclusive to `CodeCanvasContent`: `HtmlContent` reuses it to render the HTML source view (see the `attachment-canvas-html-viewer` capability), so its props must stay free of `Code`-specific assumptions.

Props interface (`CodeContentProps`):
```ts
interface CodeContentProps {
  content: CodeCanvasContent;
  codeBlockTheme?: CodeBlockTheme;
}
```

**Memoisation:** `CodeContent` SHALL be wrapped in `React.memo` — the text may be large and re-renders from panel resize or toolbar state changes must not re-run the syntax highlighter.

**Accessibility:** the component adds no landmark of its own. The file name is not available inside the lib, and the panel that hosts the body already exposes a labelled region with the file name as its title (`SidebarPanel`), so a second `role="region"` here would nest a redundant, unlabelled landmark inside it.

#### Scenario: highlighted rendering for a known language

- **WHEN** `CodeContent` is rendered with `{ type: Code, text: 'const x = 1;', language: 'typescript' }` and a valid `codeBlockTheme`
- **THEN** the output contains `<span>` elements with highlight class names

#### Scenario: plain rendering for undefined language

- **WHEN** `CodeContent` is rendered with `{ type: Code, text: 'raw text', language: undefined }`
- **THEN** the output renders the text inside a `<pre>` element without span-level highlight tokens

---

### Requirement: `AttachmentCanvas` switch handles `Code` variant

The content-type switch that selects a renderer SHALL carry a `case AttachmentContentType.Code` branch. That switch lives in `libs/attachment-canvas/src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx`, which `AttachmentCanvas` renders inside the panel chrome, and the branch renders
`<CodeContent content={content} codeBlockTheme={codeBlockTheme} />`.

The panel chrome (header, close, resize, keyboard/ARIA) SHALL be identical to other content types.

The download button SHALL be shown when `onDownload` is provided (same rule as `PlainText`).

`isDownloadable(content)` SHALL return `true` for `CodeCanvasContent`.

The "Copy text" action (`onCopyText`) SHALL be shown when provided (same rule as `PlainText`).

The scroll container class for `Code` SHALL be `h-full overflow-hidden` (the `CodeContent` component manages its own scroll), and `Code` SHALL be one of the themed content types, so the caller-supplied `AttachmentCanvasColors` apply to it as they do to `PlainText`.

#### Scenario: Code branch renders CodeContent

- **WHEN** `AttachmentCanvas` receives a `CodeCanvasContent`
- **THEN** the panel body contains a `CodeContent` element
- **AND** the panel header shows the file name

#### Scenario: Copy text action is visible for Code content

- **WHEN** `AttachmentCanvas` receives a `CodeCanvasContent` and `onCopyText` is provided
- **THEN** the copy-text button is rendered in the header

---

### Requirement: `resolveCodeCanvasContent` app-layer resolver

`libs/chat-hooks/src/files/attachment-canvas.ts` SHALL export `resolveCodeCanvasContent` from
`@epam/ai-dial-chat-hooks`:

```ts
export const resolveCodeCanvasContent = async (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
  language?: string,
): Promise<CodeCanvasContent | ErrorCanvasContent | null>
```

The function SHALL delegate text resolution to the shared `resolveAttachmentText` helper (same as
`resolveTextCanvasContent`) and return `{ type: AttachmentContentType.Code, text, language }`.

Because the resolver is host-agnostic, the DIAL-URL resolution it needs SHALL be injected as the
`resolvers` argument rather than imported. `apps/chat/src/hooks/attachment/useAttachmentCanvasResolvers.ts`
SHALL bind it to the app's `attachmentCanvasUrlResolvers` and expose it to the canvas hook as
`resolveCodeContent(attachment, language)`.

#### Scenario: successful resolution

- **WHEN** `resolveCodeCanvasContent` is called with an attachment that has downloadable text content, the app's URL resolvers, and `language: 'python'`
- **THEN** it returns `{ type: AttachmentContentType.Code, text: <fetched text>, language: 'python' }`

#### Scenario: error is propagated

- **WHEN** the underlying fetch returns HTTP 403
- **THEN** `resolveCodeCanvasContent` returns an `ErrorCanvasContent` with `errorType: Forbidden`

---

### Requirement: routing update — text-previewable extensions route to `Code`

The canvas hook's internal `openFileCanvas` SHALL route the text-previewable branch — in `libs/attachment-canvas/src/hooks/useOpenAttachmentCanvas/useOpenAttachmentCanvas.ts` — to
`resolvers.resolveCodeContent(attachment, extensionToLanguage(ext))` rather than to the plain-text
resolver. Existing callers that construct `PlainTextCanvasContent` directly (e.g. JSON
parse-failure fallback, inline-data no-type fallback) are NOT changed.

`isExternalSourcePreviewable` is NOT changed by this requirement (HTML extensions are handled
separately in the HTML viewer spec).

**i18n impact:** none new — existing `AttachmentCanvasI18nKeys.CopyText` / `AttachmentCanvasI18nKeys.Copied` keys are reused via `AttachmentCanvasContainer`.

**RTL impact:** none — the `dir="ltr"` wrapper inside `CodeContent` is sufficient.

#### Scenario: `.ts` file opens with Code content type

- **WHEN** the user clicks an attachment with extension `ts` and MIME `text/plain`
- **THEN** `openCanvas` is called with `CodeCanvasContent { language: 'typescript' }`

#### Scenario: `.log` file opens with Code content type (plaintext language)

- **WHEN** the user clicks an attachment with extension `log`
- **THEN** `openCanvas` is called with `CodeCanvasContent { language: 'plaintext' }`

#### Scenario: JSON parse-failure still produces PlainText

- **WHEN** a `.json` file cannot be parsed as JSON
- **THEN** `openCanvas` is called with `PlainTextCanvasContent` (not `CodeCanvasContent`)
