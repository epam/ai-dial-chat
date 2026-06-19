## Why

LLM responses frequently include fenced code blocks. The current renderer outputs them as a bare `<pre><code>` pair with a transparent background — no language label, no copy action, no height constraint, and no visual frame. Users must manually select and copy code, and tall blocks push surrounding content far down. The project already has polished table rendering (`MarkdownTable`); code blocks deserve the same treatment.

## What Changes

- Add `MarkdownCodeBlock` component in `libs/conversation-messages/src/components/Markdown/` as the dedicated renderer for fenced (and multiline plaintext) code blocks.
- Add `useCodeCopy` hook in `libs/conversation-messages/src/hooks/` to manage clipboard copy state with a timed `isCopied` reset.
- Change the `code` component inside `MarkdownRenderer` to delegate to `MarkdownCodeBlock` for block code; preserve inline `<code>` behavior unchanged.
- Change the `pre` component inside `MarkdownRenderer` to a fragment passthrough so `MarkdownCodeBlock` fully controls its own container.
- Extend `MarkdownRendererProps` with `codeBlockCopyLabel` and `codeBlockCopiedLabel` for localised copy labels, forwarded from the consuming app.
- Extend `MarkdownRendererClassNames` with `codeBlockContainer` and `codeBlockHeader` for optional style overrides.
- Update `MDMessageViewer` to remove the now-redundant `codeBlock`/`codeBlockFont` classNames and add the new `codeBlockCopyLabel`/`codeBlockCopiedLabel` props.
- Add translated keys under the existing `buttons` namespace in `apps/chat` (the `buttons.copy` / `buttons.copied` keys already exist; wire them up at the `MDMessageViewer` call site).

## Capabilities

### New Capabilities

- `markdown-code-block-renderer`: Fenced and multiline-plaintext code blocks rendered with a framed container, a sticky compact header (language label + copy icon button), a `max-h-[60vh]` scrollable body, always-LTR code direction, and a `isCopied` feedback state on the copy button.

### Modified Capabilities

- `markdown-renderer`: The `code` / `pre` component map inside `MarkdownRenderer` is updated to route block code through `MarkdownCodeBlock`. The `pre` override becomes a fragment passthrough. The `classNames.codeBlock` and `classNames.codeBlockFont` props are **deprecated** (they applied to the now-passthrough `pre`; existing callers that pass them will see no visual change until they migrate to `codeBlockContainer`).

## Impact

- `libs/conversation-messages/src/components/Markdown/MarkdownCodeBlock.tsx` — new file
- `libs/conversation-messages/src/components/Markdown/MarkdownCodeBlock.module.scss` — new file (scrollbar + fade styles, mirroring `MarkdownTable.module.scss` approach)
- `libs/conversation-messages/src/hooks/useCodeCopy.ts` — new file
- `libs/conversation-messages/src/hooks/tests/useCodeCopy.spec.ts` — new file
- `libs/conversation-messages/src/components/Markdown/MarkdownRenderer.tsx` — update `code`/`pre` renderers, extend classNames + label props
- `libs/conversation-messages/src/components/Markdown/MarkdownRenderer.spec.tsx` — add code block, inline code, and table regression tests
- `libs/conversation-messages/src/components/Markdown/MDMessageViewer.tsx` — drop old codeBlock classNames, pass translated labels
- `libs/conversation-messages/src/index.ts` — export `MarkdownCodeBlock` and `MarkdownCodeBlockProps`

## Non-Goals

- Download-as-file: not in this slice.
- Syntax highlighting (`react-syntax-highlighter` / Prism): not adding a new dependency; documented as a future enhancement.
- LaTeX / KaTeX rendering: out of scope.
- Inline code style changes beyond removing the old `whitespace-pre-wrap` override that was incorrectly bleeding into inline code.
- New backend endpoint or API client changes: none.
- Feature flag gating: the feature is always-on UI behaviour with no server-side toggle.

## Acceptance Criteria

1. A fenced code block (e.g. ` ```typescript … ``` `) renders with a visible container frame, a header showing `typescript`, and a copy icon button.
2. A fenced block without a language label (or multiline `<code>` without a language class) renders with the header empty (no label text) but the copy button still present.
3. Inline `` `code` `` continues to render as an inline `<code>` element with no header.
4. Clicking the copy button copies the raw code (no fences) to the clipboard and temporarily changes the icon to a checkmark.
5. While `isStreaming` is true, the copy button is hidden.
6. Tall code blocks (> 60 vh) show an internal scrollbar rather than growing the bubble.
7. Long single-line code scrolls horizontally inside the code area rather than wrapping.
8. Code direction is `ltr` on an RTL page.
9. The copy button is keyboard-focusable, has an accessible label, and is activatable via Enter/Space.
10. Existing markdown table rendering is unaffected.

## Alternatives Considered

- **Keep `pre`-level rendering, add header via CSS pseudo-elements**: No interactive copy button is possible; rejected.
- **Add syntax highlighting (react-syntax-highlighter) now**: Adds a large dependency (~200 kB for Prism + languages) and theme coupling. Deferred as a follow-on. Polished plain rendering ships now.
- **Put `MarkdownCodeBlock` in `apps/chat`**: The component has no host-specific knowledge; keeping it in `libs/conversation-messages` lets any future consumer get the polished rendering for free.

## Rollback / Backward Compatibility

All changes are inside `libs/conversation-messages` and a single consuming app (`apps/chat`). No REST API, no database, no feature flag. Reverting is a single PR revert. The deprecated `codeBlock`/`codeBlockFont` classNames remain on the interface during this slice so existing code that passes them does not break; they just become no-ops for fenced block rendering.

## Closest Existing Files

- `libs/conversation-messages/src/components/Markdown/MarkdownTable.tsx` — pattern to follow: dedicated component with its own SCSS module, scrollable body, `classNames` prop forwarding.
- `libs/conversation-messages/src/components/Markdown/MarkdownTable.module.scss` — scrollbar and fade styling pattern to reuse.
- `libs/conversation-messages/src/components/Message/MessageActions.tsx` — existing usage of `DialGhostIconButton` from `@epam/ai-dial-ui-kit` inside `libs/conversation-messages`.
- `libs/chat-shared/src/utils/copy-to-clipboard.ts` — shared clipboard utility to call from `useCodeCopy`.
- Upstream reference (do not copy directly): `apps/chat/src/components/Markdown/CodeBlock.tsx` in the `development` branch.

## i18n Impact

No new i18n keys needed. The existing `buttons.copy` ("Copy") and `buttons.copied` ("Copied!") keys in `apps/chat/src/i18n/locales/en.json` are sufficient. The app passes them as `codeBlockCopyLabel` / `codeBlockCopiedLabel` props to `MDMessageViewer` / `MarkdownRenderer`. The lib defaults to English strings (`'Copy code'` / `'Copied!'`) so it works standalone without any app wiring.

## Scope Creep Note

This change touches `libs/conversation-messages`. The lib must remain host-agnostic:
- `MarkdownCodeBlock` must not import `react-i18next`, app contexts, app hooks, server APIs, routing, storage, generated API clients, or analytics.
- All user-visible strings (`copyLabel`, `copiedLabel`) are accepted as props with English defaults.
- `copyToClipboard` from `@epam/ai-dial-chat-shared` (already a peer dependency) is the only cross-lib import added.
- No new peer dependencies are introduced beyond the existing `@tabler/icons-react` (already a peer dep).
