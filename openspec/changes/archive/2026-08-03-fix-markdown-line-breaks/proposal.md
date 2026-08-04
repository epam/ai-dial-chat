## Why

Assistant responses that use single newlines without a blank line between them — poems, addresses, song lyrics, step lists written with soft breaks — lose their line structure in the chat UI. `MarkdownRenderer` (`libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`) only configures `remarkGfm`, and per CommonMark a single `\n` is a soft line break, which `react-markdown` renders as a plain space rather than a visible break. The model's raw text is correct; only the rendering is lossy. This is a straightforward, low-risk rendering fix.

## What Changes

- Add `remark-breaks` to the `remarkPlugins` array in `MarkdownRenderer.tsx` so a single `\n` inside a paragraph renders as a visible line break (`<br/>`), matching how the raw model output actually looks.
- No change to `UserMessageBubble` — it already renders plain text with `whitespace-pre-wrap` and is unaffected.
- Verify no regression to existing GFM behavior (tables, lists, fenced code blocks, task lists) that already rely on `remarkGfm`'s own newline handling, since `remark-breaks` changes soft-break semantics globally for every `MarkdownRenderer`/`MDMessageViewer` consumer (assistant messages, `StageMarkdownContent`, citation-annotated markdown).

## Capabilities

### New Capabilities

- `markdown-line-breaks`: Defines how `MarkdownRenderer` handles single vs. double newlines in message content, ensuring single-newline line breaks are preserved visually without altering block-level constructs (paragraphs, lists, code fences, tables).

### Modified Capabilities

(none — no existing spec currently documents newline/soft-break handling in `markdown-code-blocks` or elsewhere)

## Impact

- **Affected code**: `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx` (remark plugin list), `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.spec.tsx` (new/updated tests).
- **Affected surfaces**: assistant message bubbles (`AssistantMessageBubble` via `MDMessageViewer`), `StageMarkdownContent`, citation-marker-augmented markdown (`useCitationMarkdownComponents`) — all consumers of `MarkdownRenderer`.
- **Dependencies**: adds `remark-breaks` as a new package dependency (small, single-purpose remark plugin, same maintainer ecosystem as existing `remark-gfm`).
- **Not affected**: `UserMessageBubble` (plain-text path), backend (`apps/chat-api`).
