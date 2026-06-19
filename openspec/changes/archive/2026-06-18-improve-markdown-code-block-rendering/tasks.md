## 1. `useCodeCopy` hook

- [x] 1.1 Create `libs/conversation-messages/src/hooks/useCodeCopy.ts`
  - Signature: `useCodeCopy(value: string, resetDelay?: number): { isCopied: boolean; copy: () => void }`
  - Call `copyToClipboard` from `@epam/ai-dial-chat-shared` inside `copy`
  - Set `isCopied = true` on copy; reset via `setTimeout` of `resetDelay` (default 2000 ms)
  - Clear the timeout in `useEffect` cleanup to prevent setState-on-unmount
  - JSDoc: explain the 2 s timer and the synchronous user-gesture requirement for the Clipboard API
- [x] 1.2 Add unit tests at `libs/conversation-messages/src/hooks/tests/useCodeCopy.spec.ts`
  - `copy()` → `isCopied` becomes `true`
  - `isCopied` resets to `false` after `resetDelay`
  - `copyToClipboard` is called with the correct value
  - Timeout is cleared on unmount
- [x] 1.3 Verify: `npm exec nx test conversation-messages`

## 2. `MarkdownCodeBlock` component

- [x] 2.1 Create `libs/conversation-messages/src/components/Markdown/MarkdownCodeBlock.module.scss`
  - Thin scrollbar recipe (width/height 4px, `var(--bg-layer-4, #242c42)` thumb) identical to `MarkdownTable.module.scss`
- [x] 2.2 Create `libs/conversation-messages/src/components/Markdown/MarkdownCodeBlock.tsx`
  - Props: `language`, `value`, `isStreaming?`, `theme?` (`'dark'|'light'`, default `'dark'`), `copyLabel?`, `copiedLabel?`, `containerClassName?`, `codeClassName?`
  - Syntax highlighting via `react-syntax-highlighter` Prism (installed as new dep)
  - Container, header with language label + copy button, scrollable body with `dir="ltr"`
  - Architecture guard: no `react-i18next`, apps/chat, server-api, app contexts ✓
- [x] 2.3 Add unit tests at `libs/conversation-messages/src/components/Markdown/tests/MarkdownCodeBlock.spec.tsx`
- [x] 2.4 Export `MarkdownCodeBlock`, `MarkdownCodeBlockProps`, `CodeBlockTheme` from `libs/conversation-messages/src/index.ts`
- [x] 2.5 Verify: `npm exec nx test conversation-messages`

## 3. `MarkdownRenderer` wiring

- [x] 3.1 Extend `MarkdownRendererClassNames`: add `codeBlockContainer?`, `codeBlockHeader?`; JSDoc `@deprecated` on `codeBlock` and `codeBlockFont`
- [x] 3.2 Extend `MarkdownRendererProps`: add `codeBlockCopyLabel?`, `codeBlockCopiedLabel?`, `codeBlockTheme?`
- [x] 3.3 Update `buildMarkdownComponents` to accept `isStreaming`, `codeBlockCopyLabel`, `codeBlockCopiedLabel`, `codeBlockTheme`
- [x] 3.4 Replace `pre` override with fragment passthrough
- [x] 3.5 Replace `code` override with block-detection logic delegating to `MarkdownCodeBlock`
- [x] 3.6 Audit callers — only `MDMessageViewer` used `codeBlock`/`codeBlockFont`; updated in task 5
- [x] 3.7 Verify: `npm exec nx typecheck conversation-messages && npm exec nx lint conversation-messages`

## 4. `MarkdownRenderer` tests

- [x] 4.1 Extend `MarkdownRenderer.spec.tsx` with code block, inline code, streaming, label, classNames tests
- [x] 4.2 Verify: `npm exec nx test conversation-messages`

## 5. `MDMessageViewer` update

- [x] 5.1 Remove `codeBlock` and `codeBlockFont` from `classNames`
- [x] 5.2 Remove `codeFont` override with `whitespace-pre-wrap break-words`
- [x] 5.3 Add `codeBlockCopyLabel?`, `codeBlockCopiedLabel?`, `codeBlockTheme?` to `Props`; forward to `MarkdownRenderer`
- [x] 5.4 Verify: `npm exec nx typecheck conversation-messages`

## 6. App wiring — pass translated labels + theme

- [x] 6.1 Add `codeBlockCopyLabel`, `codeBlockCopiedLabel`, `codeBlockTheme` to `AssistantMessageBubbleProps` and `MessageBubbleProps`
- [x] 6.2 Thread props through `AssistantMessageBubble` → `MDMessageViewer`
- [x] 6.3 In `ConversationMessageItem.tsx`: pass `t(ButtonsI18nKeys.Copy)`, `t(ButtonsI18nKeys.Copied)`, and `currentTheme === ThemeId.Light ? 'light' : 'dark'`
- [x] 6.4 Verify: `npm exec nx typecheck chat && npm exec nx lint chat` (pre-existing lint error in CitationDropdown, unrelated)

## 7. RTL verification

- [x] 7.1 All Tailwind classes in `MarkdownCodeBlock.tsx` use logical properties (axis-symmetric padding/margin OK, `text-start` on language label)
- [x] 7.2 `dir="ltr"` on scroll body (intentional physical exception)
- [x] 7.3 `IconCopy` and `IconCheck` are symmetric — no flip needed
- [x] 7.4 No new physical-direction CSS in `.module.scss`

## 8. Final affected-set verification

- [x] 8.1 `npm exec nx test @epam/ai-dial-conversation-messages` → 99/99 pass
- [x] 8.2 `npm exec nx lint @epam/ai-dial-conversation-messages` → clean
- [x] 8.3 `npm exec nx typecheck @epam/ai-dial-conversation-messages` → clean
- [x] 8.4 `npm exec nx typecheck @epam/chat` → clean
