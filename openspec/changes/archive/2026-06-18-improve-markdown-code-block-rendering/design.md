## Context

### Current markdown rendering pipeline

`MarkdownRenderer` (the core renderer) uses `react-markdown` with `remark-gfm` and a `Components` map built from a `classNames` prop. The `MDMessageViewer` is the opinionated consumer: it picks typography, spacing, and colour classes and wires them into `MarkdownRenderer`.

The pipeline for a fenced code block today is:

```
Markdown text
  → ReactMarkdown (remark-gfm)
  → <pre className="overflow-x-auto rounded p-3 text-sm bg-black/20 my-2 …">
      <code className="language-typescript font-mono …">…</code>
    </pre>
```

The `pre` renderer applies `overflow-x-auto rounded p-3 text-sm` plus whatever `cn.codeBlock` / `cn.codeBlockFont` the caller passes. The `code` renderer applies font classes. There is no language header, no copy button, and no height cap.

### Existing table pattern to follow

`MarkdownTable` is the precedent:
1. A dedicated component owns the full container (wrapper div + scroll div + table).
2. Its own SCSS module handles scrollbar styling and scroll-edge fade masks (direction-aware via `:global([dir='rtl'])`).
3. `MarkdownRenderer` delegates to it from the `table` component override; the `classNames` prop threads `tableWrapper` / `tableFont` overrides into it.
4. `MarkdownTable` accepts `classNames: MarkdownTableClassNames` — only the subset relevant to it.

`MarkdownCodeBlock` follows the same pattern: it owns its container, receives a `classNames`-subset via dedicated props, and is wired in from the `code` override in `MarkdownRenderer`.

### Upstream ChatMDComponent / CodeBlock behaviour to adapt

From `apps/chat/src/components/Markdown/ChatMDComponent.tsx` (development branch):
- Block detection: `const match = /language-(\w+)/.exec(className || '')` — language from `language-*` class.
- Multiline plaintext: `node?.position?.end.line !== node?.position?.start.line` when no language match.
- Delegates to `<CodeBlock language value isLastMessageStreaming />`.
- Strips trailing newline: `value.replace(/\n$/, '')`.

From `apps/chat/src/components/Markdown/CodeBlock.tsx`:
- Renders a `div.codeblock` with `relative rounded border` styling.
- Header bar: `flex items-center justify-between border-b p-3`; language label (start), copy + download buttons (end).
- Copy with `useCopy` hook: `copied` state + `onCopy` callback.
- Download button (not in this slice).
- `GhostIconButton` with `tooltipProps` from `@epam/ai-dial-ui-kit`.
- Copy button hidden while `isLastMessageStreaming`.
- `SyntaxHighlighter` from `react-syntax-highlighter` (not introduced in this slice).
- Code body: `max-h-[60vh] overflow-auto`.

**What we adapt vs. what we drop:**
- Keep: language detection regex, multiline-plaintext detection, trailing-newline strip, block container + header + copy + height cap.
- Drop: download button, `react-syntax-highlighter` (new dep), `useTranslation` (lib can't use it), `useAppSelector` for theme (use CSS variables), `useCopy` (re-implement as `useCodeCopy` in the lib with the shared `copyToClipboard` utility).

---

## Goals / Non-Goals

**Goals:**
- Polished code block with header (language label + copy button), height-constrained scrollable body, always-LTR code direction.
- `isCopied` feedback on the copy button (icon switch + accessible label change).
- Hide copy button during streaming.
- Library-isolated: no host-specific imports.

**Non-Goals:**
- Syntax highlighting (deferred; see Future Enhancements).
- Download-as-file (separate slice).
- Changing inline code rendering beyond removing the redundant `whitespace-pre-wrap` that was applied via `codeFont` in `MDMessageViewer`.

---

## Decisions

### Decision 1: `MarkdownCodeBlock` lives in `libs/conversation-messages`

**Chosen.** The component has no host-specific knowledge. It matches the existing pattern of `MarkdownTable` (also in the same lib).

**Rejected:** Placing it in `apps/chat`. Would duplicate the component if other apps consume `MarkdownRenderer`.

### Decision 2: `pre` override becomes a fragment passthrough

**Chosen.** When `MarkdownCodeBlock` owns the full container, the `pre` wrapper is structural noise. Making it `<>{children}</>` lets `MarkdownCodeBlock` control borders, padding, and the sticky header without fighting the parent `<pre>`.

**Consequences:** The existing `cn.codeBlock` / `cn.codeBlockFont` classNames no longer apply to fenced code blocks (the `pre` is gone). They are **deprecated** on the interface with a JSDoc note. Callers that previously styled the `pre` should migrate to `cn.codeBlockContainer`. The `MDMessageViewer` is the only internal caller and will be updated in the same PR.

**Rejected:** Keeping the `pre` and inserting the header inside it. The sticky header and the scroll container would fight the `pre`'s own `overflow-x-auto` and the styling would become complex.

### Decision 3: New `useCodeCopy` hook in the lib

**Chosen.** Manages `isCopied: boolean` with a `setTimeout` reset (2 s default). Calls `copyToClipboard` from `@epam/ai-dial-chat-shared` (already a peer dep of the lib). No new dep needed.

**Rejected:** Inline `useState` + `useEffect` inside `MarkdownCodeBlock`. Extracting the hook keeps the component clean and makes the copy lifecycle independently testable.

### Decision 4: Copy labels are props with English defaults

**Chosen.** `copyLabel` (default `'Copy code'`) and `copiedLabel` (default `'Copied!'`) are props on `MarkdownCodeBlock` and threaded through `MarkdownRenderer` as `codeBlockCopyLabel` / `codeBlockCopiedLabel`. `MDMessageViewer` receives them and the app passes translated strings at the call site.

The app uses the existing `buttons.copy` / `buttons.copied` i18n keys — no new keys needed.

**Rejected:** Using `useTranslation` inside the lib. Violates the lib isolation rule (`libs.md`).

### Decision 5: No syntax highlighting in this slice

`react-syntax-highlighter` is not in the workspace. Adding it would pull in Prism (~200 kB for default language set) and require theme coupling (light/dark style object). Plain code rendering with `whitespace-pre` ships now; syntax highlighting is a future enhancement. See Future Enhancements.

### Decision 6: Plain language label (lowercase, no mapping)

The upstream `CodeBlock.tsx` uses a `languageNameMapping` lookup to show display names ("TypeScript" for "typescript"). This mapping is app-specific logic. In the lib, we display the raw lowercase language string as detected from the `language-*` class. When `language` is empty, the header shows no label (just the copy button). App consumers can override via `components` prop on `MarkdownRenderer` if richer display names are needed.

---

## Component / Style Plan

### `MarkdownCodeBlock`

**File:** `libs/conversation-messages/src/components/Markdown/MarkdownCodeBlock.tsx`

```
MarkdownCodeBlockProps:
  language: string          // '' for plaintext blocks
  value: string             // raw code, trailing \n already stripped
  isStreaming?: boolean     // hides copy button when true
  copyLabel?: string        // default 'Copy code'
  copiedLabel?: string      // default 'Copied!'
  containerClassName?: string
  codeClassName?: string    // default 'font-mono text-sm'
```

**DOM structure:**

```
<div class="rounded border border-white/10 my-2 overflow-hidden [container]">
  <div class="flex items-center justify-between px-3 py-2 border-b border-white/10 [header]">
    <span class="text-xs opacity-60">{language || ''}</span>
    {!isStreaming && (
      <GhostIconButton
        icon={isCopied ? <IconCheck> : <IconCopy>}
        aria-label={isCopied ? copiedLabel : copyLabel}
        onClick={copy}
      />
    )}
  </div>
  <div class="max-h-[60vh] overflow-auto [scrollable body]" dir="ltr">
    <pre class="p-3 [code typography + codeClassName]">
      <code class="whitespace-pre">{value}</code>
    </pre>
  </div>
</div>
```

**Notes:**
- `overflow-hidden` on the container clips the `<pre>` content at the rounded corners.
- The header uses `sticky top-0` so it remains visible when scrolling tall blocks.
- `dir="ltr"` on the scrollable body — code always reads left-to-right even on RTL pages.
- `whitespace-pre` (not `pre-wrap`) — long lines scroll horizontally.
- The outer container uses `my-2` spacing (matches existing table wrapper spacing).

### `MarkdownCodeBlock.module.scss`

```scss
.scrollContainer {
  scrollbar-width: thin;
  scrollbar-color: var(--bg-layer-4, #242c42) transparent;

  &::-webkit-scrollbar { width: 4px; height: 4px; }
  &::-webkit-scrollbar-track { background-color: transparent; }
  &::-webkit-scrollbar-thumb {
    background-color: var(--bg-layer-4, #242c42);
    border-radius: 4px;
  }
}
```

Identical scrollbar recipe to `MarkdownTable.module.scss`. Vertical scrollbar width `4px` to match.

### Updates to `MarkdownRenderer`

**`MarkdownRendererClassNames` additions:**
```tsx
/** @deprecated Use `codeBlockContainer`. Applies to the now-passthrough `<pre>`; has no effect on fenced blocks. */
codeBlock?: string;
/** @deprecated Was the font-size class on `<pre>`; has no effect on fenced blocks. */
codeBlockFont?: string;
/** Extra classes on the `MarkdownCodeBlock` outer container. */
codeBlockContainer?: string;
/** Extra classes on the `MarkdownCodeBlock` header bar. */
codeBlockHeader?: string;
```

**`MarkdownRendererProps` additions:**
```tsx
/** Accessible label for the copy button in code blocks. Defaults to 'Copy code'. */
codeBlockCopyLabel?: string;
/** Accessible label after copy. Defaults to 'Copied!'. */
codeBlockCopiedLabel?: string;
```

**`pre` override:**
```tsx
pre: ({ children }) => <>{children}</>,
```

**`code` override:**
```tsx
code: ({ children, className }) => {
  const language = /language-(\w+)/.exec(className ?? '')?.[1] ?? '';
  const raw = String(children);
  const isBlock = !!language || raw.includes('\n');

  if (isBlock) {
    return (
      <MarkdownCodeBlock
        language={language}
        value={raw.replace(/\n$/, '')}
        isStreaming={isStreaming}
        copyLabel={codeBlockCopyLabel}
        copiedLabel={codeBlockCopiedLabel}
        containerClassName={cn.codeBlockContainer}
        codeClassName={cn.codeFont}
      />
    );
  }

  return (
    <code className={mergeClasses('rounded px-1 py-0.5', cn.codeInlineFont ?? 'font-mono text-sm', cn.codeInline)}>
      {children}
    </code>
  );
},
```

`isStreaming`, `codeBlockCopyLabel`, `codeBlockCopiedLabel` are passed into `buildMarkdownComponents` as additional arguments (or via closure in a refactored signature).

### Updates to `MDMessageViewer`

Remove:
- `codeBlock: 'bg-black/20 my-2 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]'`
- `codeFont: 'font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere]'`

The new container/code styling lives inside `MarkdownCodeBlock` itself.

Add props:
```tsx
codeBlockCopyLabel?: string;
codeBlockCopiedLabel?: string;
```

Forward to `MarkdownRenderer`.

The `codeInline` classNames (`bg-black/20 break-words [overflow-wrap:anywhere]`) stay — inline code is unchanged.

---

## Language Metadata Detection

```
/language-(\w+)/.exec(className ?? '')?.[1] ?? ''
```

- `className="language-typescript"` → `language = 'typescript'`
- `className="language-json"` → `language = 'json'`
- No className → `language = ''`

When `language` is empty string and children include `\n`, the block renders with no language label in the header.

---

## Plaintext Multiline Code Block Detection

The condition `raw.includes('\n')` catches:
- 4-space-indented code blocks (react-markdown generates `pre > code` with no language class).
- Fenced blocks without a language tag (` ``` ``` `).

These render exactly like fenced blocks but with an empty language label.

**Edge case — single-line inline code:** Single-line code without a language class is inline (`raw` contains no `\n`). Confirmed correct: `` `value` `` → no newline → inline path.

---

## Copy-to-Clipboard Behaviour

`useCodeCopy(value: string, resetDelay?: number)` returns `{ isCopied, copy }`:

1. `copy()` is called (user clicks copy button).
2. `copyToClipboard(value)` from `@epam/ai-dial-chat-shared` is called synchronously within the click handler (required for Clipboard API user-gesture requirement).
3. `isCopied` is set to `true`.
4. A `setTimeout` of `resetDelay` ms (default 2000) sets `isCopied` back to `false`.
5. The timeout is cleared in `useEffect` cleanup to prevent setState-on-unmount.

The component renders `<IconCheck>` and `copiedLabel` while `isCopied` is true; `<IconCopy>` and `copyLabel` otherwise.

No failure toast in this slice — `copyToClipboard` already has an `execCommand` fallback for insecure contexts. Silent failure is acceptable.

---

## Copied Feedback Lifecycle

| State | Icon | aria-label | Duration |
|-------|------|------------|----------|
| idle | `<IconCopy>` | `copyLabel` | — |
| copied | `<IconCheck>` | `copiedLabel` | 2 s then resets |

The button is NOT disabled while `isCopied` — repeated clicks restart the timer.

---

## Streaming Behaviour

When `isStreaming={true}` (passed from `MDMessageViewer` → `MarkdownRenderer` → `MarkdownCodeBlock`):
- The copy button is not rendered (`{!isStreaming && <GhostIconButton …/>}`).
- The code content is still visible and updating.
- Once `isStreaming` becomes `false` the copy button appears.

This matches the upstream `isLastMessageStreaming` pattern from `CodeBlock.tsx`.

---

## Long-Line and Tall-Block Handling

- **Long lines:** `whitespace-pre` on `<code>` prevents wrapping. `overflow-x-auto` on the scroll container allows horizontal scroll. The scroll container has `dir="ltr"` so the horizontal scrollbar is always on the right-hand side of the container.
- **Tall blocks:** `max-h-[60vh]` caps the visible height. `overflow-y-auto` enables internal vertical scroll (combined in `overflow-auto`).
- Horizontal and vertical scroll use the same thin scrollbar recipe from `MarkdownCodeBlock.module.scss`.

---

## Theme, RTL, and Responsive Behaviour

### Theme

`bg-black/20` is an alpha-transparent overlay that works in both light and dark mode (inherited from existing `codeBlock` style). Apply it to the container:

```
<div className={mergeClasses('rounded border border-white/10 my-2 overflow-hidden bg-black/20', …)}>
```

The header uses `border-b border-white/10` for the separator. These transparent values compose correctly over any background without needing a theme-specific CSS variable.

If a future design requires distinct `bg-layer-*` values per theme, the CSS variable `var(--bg-layer-1)` can replace `bg-black/20` in SCSS — but that is out of scope for this slice.

### RTL

The container itself must use logical Tailwind classes:
- No physical `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` on directional elements.
- Header `text-start` for the language label (aligns to the writing-start edge).
- Header `flex items-center justify-between` — inherits from parent dir.
- The scrollable code body has `dir="ltr"` — code is always read left-to-right. This is an intentional RTL exception: code is not a natural-language text and must NOT flip.
- Horizontal scroll of the code body is always physically to the right, matching reading direction of code syntax.

No icon mirroring needed: `IconCopy` and `IconCheck` are symmetric.

The SCSS scroll-fade mask (if added) would need direction-aware overrides (`[dir='rtl']` selectors), mirroring the approach in `MarkdownTable.module.scss`. For this slice, no fade mask is added to the code body (the table fade is for invisible overflow, not needed here since height cap + border make the scroll affordance clear).

### Responsive

No Tailwind responsive breakpoints needed. The container is `max-w-full` (inherits from message bubble). The `max-h-[60vh]` is a viewport-relative unit that already scales across screen sizes. No `sm:`/`md:` etc.

---

## Accessibility Requirements

- The copy button is a `<button>` rendered via `GhostIconButton`.
- `aria-label` switches between `copyLabel` and `copiedLabel` to communicate state to screen readers.
- After copy, `aria-live="polite"` announcement is handled by the label change on the focused button; no additional live region needed in this slice.
- The `<pre><code>` content is selectable (`user-select: text` is the browser default; do not override).
- `max-h-[60vh]` scroll container: no `tabindex` override needed — the browser's overflow scroll is keyboard accessible.
- Do not use `pointer-events-none` or `tabIndex={-1}` on code content.

---

## Test Strategy

**`useCodeCopy.spec.ts`** (unit, `libs/conversation-messages/src/hooks/tests/`):
- `copy()` sets `isCopied` to true.
- `isCopied` resets to false after `resetDelay`.
- Cleanup clears the timeout on unmount.
- `copyToClipboard` is called with the correct value.

**`MarkdownRenderer.spec.tsx`** (integration, `libs/conversation-messages/src/components/Markdown/`):
- Fenced block with language: renders `MarkdownCodeBlock` with correct language label.
- Fenced block without language: renders code block with empty label and copy button.
- Inline code: renders `<code>` without header.
- Copy button hidden during `isStreaming={true}`.
- Existing table test unchanged (regression guard).
- `classNames.codeBlockContainer` and `classNames.codeBlockHeader` are applied.
- `codeBlockCopyLabel` / `codeBlockCopiedLabel` props reach the copy button.

**`MarkdownCodeBlock.spec.tsx`** (unit, `libs/conversation-messages/src/components/Markdown/tests/` — create `tests/` subfolder following lib convention):
- Renders language label when `language` is non-empty.
- Renders no label text when `language` is empty.
- Copy button present when `isStreaming={false}`.
- Copy button absent when `isStreaming={true}`.
- Click copy button calls `copyToClipboard` and shows `copiedLabel`.
- Code text is rendered and selectable.
- `dir="ltr"` is set on the scroll container.

---

## Non-Goals and Future Enhancements

- **Syntax highlighting:** Add `react-syntax-highlighter` (Prism) as a new peer dep in a follow-on slice. The `MarkdownCodeBlockProps` can add a `syntaxHighlight?: boolean` flag. The `codeClassName` prop will need to cooperate with the highlighter's inline styles.
- **Download-as-file:** Separate slice. Requires file extension mapping and `URL.createObjectURL`.
- **Language display-name mapping:** App-level concern. Pass a `languageLabel?: string` prop override from the app side if display names (e.g. "TypeScript" for "typescript") are needed.
- **Copy failure toast:** Not in scope. The shared `copyToClipboard` silently falls back via `execCommand`.
- **Nested code block nesting (inner/outer styles):** Upstream `CodeBlock` has an `isInner` prop for `details` nesting. Out of scope — the current lib has no `<details>` rendering.
