## Why

When working with long code snippets, users must scroll back to the top to access the "Copy code" and "Download" buttons, which is disruptive and inconvenient. Making the code block header sticky keeps these controls always visible, matching the UX pattern already established by ChatGPT and Google Gemini.

## What Changes

- The header bar in `CodeBlock` component (`apps/chat/src/components/Markdown/CodeBlock.tsx`) gains `position: sticky; top: 0` so it remains visible while scrolling vertically through long code snippets.
- The outer `codeblock` wrapper needs `overflow: auto` (scoped vertically) instead of `overflow: hidden` to allow internal scroll while keeping the sticky header working.
- No new API routes, store domains, or feature flags are required.

## Capabilities

### New Capabilities

- `sticky-code-block-header`: Code snippet header (language label + copy/download buttons) sticks to the top of the visible area when the user scrolls through a long code block.

### Modified Capabilities

<!-- No existing spec-level requirements change. -->

## Impact

- **Component**: `apps/chat/src/components/Markdown/CodeBlock.tsx` — CSS class changes only (Tailwind).
- **No store changes** — purely a presentational/UI fix.
- **No API changes**.
- **Non-goals**: Not changing the header content, icons, or behavior. Not adding new controls. Not touching the `CodeEditor` panel (that's a separate editor surface).
