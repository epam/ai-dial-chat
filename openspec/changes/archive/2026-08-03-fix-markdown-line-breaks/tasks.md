## 1. Dependency

- [x] 1.1 Add `remark-breaks` to `libs/chat-shared`'s `package.json` dependencies (same range/tagging convention as the existing `remark-gfm` entry).

## 2. Renderer change

- [x] 2.1 In `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`, import `remarkBreaks` from `remark-breaks` and add it to the `remarkPlugins` array after `remarkGfm` (`[remarkGfm, remarkBreaks]`).

## 3. Tests

- [x] 3.1 Add a test in `MarkdownRenderer.spec.tsx`: content with single-`\n`-separated lines (poem-style) renders each line as a visually separate line (a line-break element between consecutive lines), matching scenarios in `specs/markdown-line-breaks/spec.md`.
- [x] 3.2 Add/extend regression tests confirming unchanged behavior: blank-line-separated paragraphs stay distinct `<p>` elements; an unordered/ordered list renders as a single list with separate items (not line-broken plain text); a GFM table renders header + rows unchanged; a fenced code block with internal newlines renders via the existing code-block handling with no extra injected `<br/>`; an inline code span with no newline is unaffected.
- [x] 3.3 Run `npm exec nx test chat-shared` and confirm all `MarkdownRenderer` and `MDMessageViewer` specs pass.

## 4. Manual verification

- [x] 4.1 Start the app (`npm start`) and send/paste an assistant response containing a poem with single-newline line breaks (no blank line between stanzas' lines); confirm each line renders on its own visual line in the chat bubble.
- [x] 4.2 Manually verify `StageMarkdownContent` and a citation-annotated assistant response (if reachable in the running app) still render correctly with lists, tables, and code blocks intact.
- [x] 4.3 Run `npm exec nx lint chat-shared` and `npm exec nx build chat-shared` to confirm no lint/build regressions from the dependency and plugin addition.
