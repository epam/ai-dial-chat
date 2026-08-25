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

`libs/attachment-canvas/src/components/CodeContent/CodeContent.tsx` SHALL render `content.text` using `react-syntax-highlighter`'s `PrismLight` renderer (for smaller bundle size via selective language registration).

Behaviour:
- Wrap the highlighter in `<div dir="ltr">` to force LTR text direction regardless of the app's locale.
- The container SHALL be scrollable vertically and horizontally (`overflow-auto`).
- When `content.language` is `undefined` or `'plaintext'`, the component SHALL render the text as an unstyled monospace `<pre>` block (same visual as the current `PlainText` renderer) — no highlighting, no Prism runtime cost.
- The `codeBlockTheme` prop (forwarded from `AttachmentCanvasProps`) SHALL control the highlight style. The same theme-to-Prism-style mapping used by `MarkdownRenderer` SHALL be reused or extracted into a shared utility in `libs/attachment-canvas/src/utils/`.
- The component MUST NOT read from any app-level context (auth, theme, i18n, feature flags).

Props interface (`CodeContentProps`):
```ts
interface CodeContentProps {
  content: CodeCanvasContent;
  codeBlockTheme?: CodeBlockTheme;
}
```

**Memoisation:** `CodeContent` SHALL be wrapped in `React.memo` — the text may be large and re-renders from panel resize or toolbar state changes must not re-run the syntax highlighter.

**Accessibility:**
- The `<pre>` / highlighter container SHALL carry `role="region"` and `aria-label` set to the file name (`fileName` is not available inside the lib; callers may wrap it — no action required at lib level).

#### Scenario: highlighted rendering for a known language

- **WHEN** `CodeContent` is rendered with `{ type: Code, text: 'const x = 1;', language: 'typescript' }` and a valid `codeBlockTheme`
- **THEN** the output contains `<span>` elements with highlight class names

#### Scenario: plain rendering for undefined language

- **WHEN** `CodeContent` is rendered with `{ type: Code, text: 'raw text', language: undefined }`
- **THEN** the output renders the text inside a `<pre>` element without span-level highlight tokens

---

### Requirement: `AttachmentCanvas` switch handles `Code` variant

`libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx` SHALL add a `case AttachmentContentType.Code` branch that renders `<CodeContent content={content} codeBlockTheme={codeBlockTheme} />`.

The panel chrome (header, close, resize, keyboard/ARIA) SHALL be identical to other content types.

The download button SHALL be shown when `onDownload` is provided (same rule as `PlainText`).

`isDownloadable(content)` SHALL return `true` for `CodeCanvasContent`.

The "Copy text" action (`onCopyText`) SHALL be shown when provided (same rule as `PlainText`).

The scroll container class for `Code` SHALL be `overflow-hidden` (the `CodeContent` component manages its own scroll).

#### Scenario: Code branch renders CodeContent

- **WHEN** `AttachmentCanvas` receives a `CodeCanvasContent`
- **THEN** the panel body contains a `CodeContent` element
- **AND** the panel header shows the file name

#### Scenario: Copy text action is visible for Code content

- **WHEN** `AttachmentCanvas` receives a `CodeCanvasContent` and `onCopyText` is provided
- **THEN** the copy-text button is rendered in the header

---

### Requirement: `resolveCodeCanvasContent` app-layer resolver

`apps/chat/src/utils/attachment-canvas.ts` SHALL export `resolveCodeCanvasContent`:

```ts
export const resolveCodeCanvasContent = async (
  attachment: DisplayAttachment,
  language?: string,
): Promise<CodeCanvasContent | ErrorCanvasContent | null>
```

The function SHALL delegate text resolution to the shared `resolveAttachmentText` helper (same as `resolveTextCanvasContent`) and return `{ type: AttachmentContentType.Code, text, language }`.

#### Scenario: successful resolution

- **WHEN** `resolveCodeCanvasContent` is called with an attachment that has downloadable text content and `language: 'python'`
- **THEN** it returns `{ type: AttachmentContentType.Code, text: <fetched text>, language: 'python' }`

#### Scenario: error is propagated

- **WHEN** the underlying fetch returns HTTP 403
- **THEN** `resolveCodeCanvasContent` returns an `ErrorCanvasContent` with `errorType: Forbidden`

---

### Requirement: routing update — text-previewable extensions route to `Code`

`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`'s internal `openFileCanvas` SHALL replace the `isTextPreviewable` branch's call to `resolveTextCanvasContent` with `resolveCodeCanvasContent(attachment, extensionToLanguage(ext))`. Existing callers that construct `PlainTextCanvasContent` directly (e.g. JSON parse-failure fallback, inline-data no-type fallback) are NOT changed.

`isExternalSourcePreviewable` in `apps/chat/src/utils/attachment-canvas.ts` is NOT changed by this requirement (HTML extensions are handled separately in the HTML viewer spec).

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
