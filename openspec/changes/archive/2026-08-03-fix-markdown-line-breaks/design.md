## Context

`MarkdownRenderer` (`libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`) is the single `react-markdown` wrapper used across the app — directly by `MDMessageViewer` (assistant message bubbles), and indirectly by `StageMarkdownContent`/`StageCodeBlock` and `useCitationMarkdownComponents` (citation overrides layered on the same renderer). It currently configures only `remarkGfm`. Per CommonMark, a single `\n` inside a paragraph is a "soft line break" and is rendered as whitespace (effectively a space), not a visible break — only a trailing double-space, a trailing backslash, or a blank line produce a visible break/new paragraph. LLM output frequently uses single `\n` between lines of a poem, address, or lyrics without a blank line, so that structure currently collapses into one run-on line in the chat UI. `UserMessageBubble` does not use markdown at all (plain `whitespace-pre-wrap` text) and is unaffected.

## Goals / Non-Goals

**Goals:**
- Single `\n` inside a paragraph in markdown-rendered message content produces a visible line break, matching the raw text structure the model produced.
- No change to existing block-level Markdown/GFM behavior: paragraphs separated by a blank line, lists, tables, task lists, blockquotes, and fenced/indented code blocks continue to render exactly as before.

**Non-Goals:**
- Not changing `UserMessageBubble`'s plain-text rendering path (already correct).
- Not introducing a custom remark/rehype plugin — reuse the existing, widely-used `remark-breaks` package rather than hand-rolling AST transforms.
- Not changing how code fences preserve internal newlines (already handled correctly today, since a literal `\n` inside a fenced/inline code span is not a soft break candidate).

## Decisions

**Add `remark-breaks` to `MarkdownRenderer`'s `remarkPlugins` array**, placed after `remarkGfm` (`remarkPlugins = [remarkGfm, remarkBreaks]`).

Alternatives considered:
- **Pre-process message text to insert a trailing double-space or `\\` before each `\n`, or convert single `\n` to `\n\n`, before passing it to `ReactMarkdown`.** Rejected: mutating the model's raw text string is fragile (has to special-case code fences/inline code so it doesn't corrupt code content), duplicates logic `remark-breaks` already implements correctly at the AST level, and risks double-blank-lines changing list/paragraph semantics.
- **Add a custom rehype plugin that walks text nodes and replaces `\n` with `<br/>` post-parse.** Rejected: reinvents `remark-breaks`, which is maintained by the `remarkjs` org (same ecosystem as `remark-gfm`, already a dependency) and does exactly this at the correct place in the pipeline (converts soft breaks to hard breaks before HTML generation), with a much smaller footprint than a hand-written rehype visitor.
- **CSS-only fix (e.g. `white-space: pre-line` on the message container).** Rejected: this would affect all whitespace globally (including intentional GFM formatting/indentation) and doesn't compose with the existing per-element markdown component overrides (`MarkdownCodeBlock`, table wrappers, etc.) the way a remark-level fix does.

## Risks / Trade-offs

- **[Risk]** `remark-breaks` changes soft-break handling for every `MarkdownRenderer` consumer at once (assistant bubbles, `StageMarkdownContent`, citation-augmented markdown), not just the poem case. → **Mitigation**: add/extend `MarkdownRenderer.spec.tsx` coverage for existing GFM constructs (multi-paragraph text with blank-line separation, unordered/ordered lists, tables, fenced code blocks with internal newlines, blockquotes) to confirm they render unchanged; manually smoke-test `StageMarkdownContent` and a citation-annotated response.
- **[Risk]** Text inside inline code spans or fenced code blocks that contains `\n` must keep rendering as real newlines (already correct via `<pre>`/`MarkdownCodeBlock`), not get an extra `<br/>` injected. → **Mitigation**: `remark-breaks` only transforms soft breaks in the AST outside of code nodes, so this is inherent to the library; verified in the code-block regression test above.
- **[Risk]** New runtime dependency (`remark-breaks`). → **Mitigation**: it's a tiny, single-purpose plugin from the same maintainer org as the already-installed `remark-gfm`/`react-markdown`, low maintenance and supply-chain risk.

## Migration Plan

- Add the `remark-breaks` dependency, wire it into `remarkPlugins`, ship as a normal frontend release (no data migration, no feature flag needed — pure rendering fix).
- Rollback: revert the one-line `remarkPlugins` change and the dependency addition if an unexpected regression surfaces.
