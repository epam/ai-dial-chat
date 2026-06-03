## Context

`CodeBlock` (`apps/chat/src/components/Markdown/CodeBlock.tsx`) renders every fenced code block inside chat messages. The outer wrapper uses `overflow-hidden` to clip the syntax-highlighter content. The header (`flex` row with the language label + action icons) is a sibling element above the `<SyntaxHighlighter>` — it scrolls away as the user scrolls down through a long snippet, forcing a scroll-back to reach Copy/Download.

Current layout (simplified):

```
div.codeblock  [overflow-hidden]
  div.header   [static position]
  SyntaxHighlighter (scrollable content)
```

Target layout:

```
div.codeblock  [overflow-auto, max-height via scroll container]
  div.header   [sticky, top-0, z-index]
  SyntaxHighlighter (content)
```

## Goals / Non-Goals

**Goals:**
- Keep the language label and Copy/Download buttons visible when scrolling through a long code block.
- No change to header content, icons, or interaction behavior.
- CSS-only change; no new state, no store changes.

**Non-Goals:**
- Changing the `CodeEditorPanel` (separate editor surface, unrelated UX).
- Adding new buttons or controls to the header.
- Feature-flagging this change (low risk, pure UX improvement).

## Decisions

### 1. Use `position: sticky` on the header, not a fixed/portal approach

**Chosen**: `sticky top-0` Tailwind classes on the header `div`.

**Why**: `sticky` keeps the header inside normal document flow and requires zero JavaScript. It naturally constrains the sticky region to the parent's scroll container, so multiple code blocks on the same page each have their own sticky header — exactly the desired behavior.

**Alternative considered**: Duplicating the header at the top of the scrollable area via a React portal or absolute positioning. Rejected: complex, requires scroll-position state, and would duplicate DOM nodes.

### 2. Scroll container is the outer `div.codeblock`, not a nested wrapper

**Chosen**: Change `overflow-hidden` → `overflow-auto` on the outer `div.codeblock` and rely on the containing chat message column width to constrain horizontal overflow.

**Why**: The outer div is already the natural boundary for the code block. Making it the scroll container is the minimal change. `sticky` only works when the scroll ancestor is `overflow: auto/scroll` — but crucially it must NOT be `overflow: hidden`.

**Constraint**: `SyntaxHighlighter` already sets `padding` and `borderRadius: 0` via `customStyle`, so no visual regressions from removing `overflow-hidden`.

### 3. Add `z-index` to the sticky header

**Chosen**: Add `z-10` (or equivalent) to the header so it renders above syntax-highlighted code when scrolling.

**Why**: Without a stacking context, long highlighted lines that overflow horizontally could bleed over the header during horizontal scroll.

## Risks / Trade-offs

- **Horizontal scroll bleed** → Mitigated by `z-10` on the header.
- **`overflow-auto` may add an unwanted scrollbar on short snippets** → Short content won't overflow, so no scrollbar appears. The `auto` value only renders scrollbars when content overflows.
- **Theme styling** → `bg-layer-1 / bg-layer-3` classes on the sticky header already carry the correct background color, so no transparency issue when the header overlaps code.
