## MODIFIED Requirements

### Requirement: `CodeContent` renderer component

`libs/attachment-canvas/src/components/CodeContent/CodeContent.tsx` SHALL render eligible `content.text` using `react-syntax-highlighter`'s `Prism` renderer.

Behaviour:
- Wrap the highlighter in `<div dir="ltr">` to force LTR text direction regardless of the app's locale.
- The container SHALL be scrollable (`overflow-auto`) and fill the panel body (`h-full`). The highlighted branch SHALL pass `wrapLongLines`, so a long source line wraps instead of forcing a horizontal scroll.
- When `content.language` is `undefined` or `'plaintext'`, or `isSyntaxHighlightingAllowed(content.text)` returns false, the component SHALL render the text as an unstyled monospace `<pre>` block (same visual as the current `PlainText` renderer) — no highlighting, no Prism runtime cost.
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

#### Scenario: Oversized code retains complete plain text

- **WHEN** source exceeds 50,000 UTF-16 code units overall or 2,000 on a line
- **THEN** the component renders complete plain text without invoking Prism
