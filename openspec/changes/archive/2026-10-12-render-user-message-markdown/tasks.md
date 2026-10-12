## Slicing strategy

Vertical, in four slices. Slice 1 adds the renderer opt-out with no visible change. Slice 2 makes user bubbles render Markdown end to end for messages without skills, which closes issue #173. Slice 3 carries skill chips through the parser. Slice 4 covers docs and gates. Each slice depends on the previous one and ends with `npm run verify:changed`.

Architecture guard (applies to every task under `libs/*`): no `/api` paths, no generated-client or server-api imports, and no app contexts, i18n, env, feature flags, routing or storage. Libs receive segments, labels, `markdownUrlTransform`, `codeBlockTheme` and `tableOnOpenInCanvas` only as props. Relative imports stay extensionless.

## 1. Renderer: raw-HTML opt-out and plugin passthrough (`@epam/ai-dial-chat-shared`)

- [x] 1.1 Add `isRawHtmlEnabled?: boolean` to `MarkdownRendererProps` in `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`.
  - Its JSDoc states the default `true`.
  - When it is `false`, leave `rehypeRaw` out of `effectiveRehypePlugins`, and add `isRawHtmlEnabled` to that `useMemo`'s dependencies.
  - Keep `rehypeSanitize` and the URL transform unconditional.
- [x] 1.2 In `libs/chat-shared/src/components/MarkdownRenderer/MDMessageViewer.tsx`, add `isRawHtmlEnabled` and `rehypePlugins` to `MDMessageViewerProps` with JSDoc, and forward both to `MarkdownRenderer`. The plain-text path ignores them.
- [x] 1.3 Add tests to `libs/chat-shared/src/components/MarkdownRenderer/tests/MarkdownRenderer.spec.tsx`:
  - With `isRawHtmlEnabled={false}`, `What does <div> do?` shows the literal tag.
  - With it `false`, `<img src=x onerror=…>` creates no `img`.
  - The default still turns `a<br>b` into a line break.
  - `[x](javascript:…)` has no `javascript:` href with the option off.
- **Verification:** `npm run test:file -- libs/chat-shared/src/components/MarkdownRenderer/tests/MarkdownRenderer.spec.tsx`, then `npm run verify:changed`.

## 2. User bubble renders Markdown (no skills): issue #173 end to end

- [x] 2.1 In `libs/conversation-messages/src/models/message-bubble.ts`, prepare the shared props and labels:
  - Move the code, table and math label fields out of `AssistantMessageBubbleLabels` into a new exported `MarkdownContentLabels` interface. The fields are `codeBlockCopyLabel`, `codeBlockCopiedLabel`, `codeBlockDownloadLabel`, `tableCopyLabel`, `tableCopiedLabel`, `tableDownloadCsvLabel`, `tableOpenInCanvasLabel`, `tableDownloadFilename`, `tableScrollRegionAriaLabel` and `mathScrollRegionAriaLabel`.
  - Add a `UserMessageBubbleLabels extends MessageBubbleLabels, MarkdownContentLabels` interface.
  - Make `AssistantMessageBubbleLabels` extend `MarkdownContentLabels`.
  - Move `codeBlockTheme`, `markdownClassNames`, `markdownUrlTransform` and `tableOnOpenInCanvas` to `BaseMessageBubbleProps`, keeping their JSDoc.
  - Type `UserMessageBubbleProps.labels` as `UserMessageBubbleLabels`.
  - Export the new types from `libs/conversation-messages/src/index.ts`.
- [x] 2.2 In `libs/conversation-messages/src/components/MessageBubble/UserMessageBubble.tsx`, render the text through `MDMessageViewer`:
  - Replace the `<p>` with a `div` carrying `textClass`, `text-start`, `min-w-0 max-w-full`, and the first/last-child margin trim from design D6.
  - Render `MDMessageViewer` inside it with `isRawHtmlEnabled={false}` and the forwarded `codeBlockTheme`, `markdownClassNames` (as `classNames`), `markdownUrlTransform` (as `urlTransform`), `tableOnOpenInCanvas` and the labels.
  - Build the table-action labels object with `useMemo`, as `AssistantMessageBubble` does.
  - Switch `useCollapsedText` to `HTMLDivElement` and attach `textRef` to the new `div`.
  - Keep the bleed wrapper, the collapse classes, `contentRef`, `role="group"` and `aria-label`.
  - Update the existing block comment to describe the Markdown render.
- [x] 2.3 In `libs/conversation-messages/src/components/MessageBubble/MessageBubble.tsx`, forward `markdownUrlTransform` to the user branch as well. `markdownComponents` stays assistant-only.
- [x] 2.4 In `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`, pass `markdownUrlTransform` for both roles, and keep `markdownComponents` assistant-only. Confirm that `codeBlockTheme`, `tableOnOpenInCanvas` and the code/table/math labels already reach user bubbles through the shared props. If they are built only for assistants, supply them for both roles with the same existing `t()` keys. No new keys are allowed.
- [x] 2.5 Update the user-bubble tests in `libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.spec.tsx`.
  - Replace "preserves line breaks in the message text" (the `whitespace-pre-wrap`/raw `textContent` assertions) with tests that the single-newline lines render on separate lines and that `- Item` renders a list item.
  - Add the issue #173 case: a ```` ```ts ```` fence renders a code block with the `ts` label and a "Copy code" button.
  - Add inline `**bold**`/`` `code` `` (strong/code elements, no literal markers).
  - Add a literal `<div>`.
  - Add a table rendering a `table` role with the table action controls when labels are supplied.
  - Add `ResponseFormat.PlainText`, which still renders user Markdown.
  - Add a localized code-block label passthrough.
  - Use role, label and text queries only.
- [x] 2.6 Update the collapse tests in the same spec file:
  - A tall rendered code block shows "Show more" with `aria-expanded="false"`, and toggling flips it.
  - Re-check `libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.classes.spec.tsx` for the user bubble's public classes. They are unchanged.
- [x] 2.7 Add host tests to `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`:
  - A user message with a fenced block renders a code block.
  - "Copy message" still writes the raw source (`**bold**` stays `**bold**`).
  - Edit still pre-fills the raw fence text. Implemented in `libs/conversation-input/src/components/EditMessageInput/tests/EditMessageInput.spec.tsx`, because this host spec mocks `EditMessageInput` to always suspend.
  - A user message containing a DIAL file link goes through `markdownUrlTransform`.
- [x] 2.8 RTL check: confirm the new text container uses only logical classes (`text-start`, `ms`/`me`, `ps`/`pe`) and that no directional icon is added. Add an RTL test to `MessageBubble.spec.tsx`: under `dir="rtl"`, a user list renders and the code block keeps `dir="ltr"`, per `markdown-code-blocks`.
- **Verification:**
  - `npm run test:file -- libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.spec.tsx`
  - `npm run test:file -- libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.classes.spec.tsx`
  - `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx`
  - then `npm run verify:changed`

## 3. Skill chips survive the Markdown parse

- [x] 3.1 Create `libs/chat-shared/src/models/inline-segment.ts`. It exports `InlineTextSegment` (`{ text: string; node: ReactNode }`, with JSDoc on each field) and `TextSegment = string | InlineTextSegment`. Export both from `libs/chat-shared/src/index.ts`.
- [x] 3.2 Create `libs/chat-shared/src/utils/inline-segments.ts` (arrow-function constants, JSDoc) per design D3:
  - `buildInlineSegmentSource(segments)` returns `{ source, inlineSegments }`, using the `{i}` tokens. It falls back to plain text concatenation when a string run already contains a sentinel character.
  - `createRehypeInlineSegments(inlineSegments)` turns a token into its literal `text` inside `code`, `pre` and `a` ancestors and inside `href`/`src` values, and into a `dial-inline-segment` element with `dataIndex` elsewhere.
  - `createInlineSegmentComponents(inlineSegments)` returns the typed `components` entry rendering `inlineSegments[index].node`.
  - Export the utils from `libs/chat-shared/src/index.ts` and `libs/chat-shared/src/entry-points/markdown.ts`.
- [x] 3.3 Add unit tests in `libs/chat-shared/src/utils/tests/inline-segments.spec.tsx`, rendering through `MarkdownRenderer`:
  - A chip in a paragraph, in a list item and inside `**bold**`.
  - A mention with underscores, not parsed as emphasis.
  - A mention inside inline code and inside a fenced block, which shows the literal text.
  - A mention inside link text, which shows the literal text and no nested node.
  - Two adjacent segments.
  - The sentinel-collision fallback.
  - Absent segments, which return the source unchanged.
- [x] 3.4 Change `UserMessageBubbleProps.textSegments` in `libs/conversation-messages/src/models/message-bubble.ts` to `TextSegment[]`, and rewrite its JSDoc. In `UserMessageBubble.tsx`, `useMemo` the source, the plugin array and the components keyed on `[text, textSegments]`, and pass them to `MDMessageViewer` (`content`, `rehypePlugins`, `components`). Without segments, use `text` and module-level empty constants.
- [x] 3.5 Make `renderHistorySkillSegments` in `libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx` push `{ text: content.slice(mention.start, mention.start + mention.length), node: <ChatSkill … /> }`. Update its return type in `libs/skills/src/models/skill-selector-overlay.ts` to `TextSegment[] | null`.
- [x] 3.6 Update the skills tests in `libs/skills/src/hooks/useSkillSelectorOverlay/tests/useSkillSelectorOverlay.spec.tsx` for the new segment shape.
- [x] 3.7 Update the `UserMessageBubble — textSegments` tests in `MessageBubble.spec.tsx`:
  - The chip renders inside the rendered paragraph at its position, and inside a list item.
  - A mention inside a code fence renders as literal `/name`.
  - The RTL case.
  - Replace "byte-identical when absent" with "no inline element when absent".
- [x] 3.8 Re-run and adjust the host/integration specs that assert history chips: `apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx`, `apps/chat/src/pages/ConversationRoute/ConversationRoute.integration.spec.tsx` and `apps/chat/src/pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx`.
- **Verification:**
  - `npm run test:file -- libs/chat-shared/src/utils/tests/inline-segments.spec.tsx`
  - `npm run test:file -- libs/skills/src/hooks/useSkillSelectorOverlay/tests/useSkillSelectorOverlay.spec.tsx`
  - `npm run test:file -- libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.spec.tsx`
  - `npm run test:file -- apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx`
  - `npm run test:file -- apps/chat/src/pages/ConversationRoute/ConversationRoute.integration.spec.tsx`
  - then `npm run verify:changed`

## 4. Docs, specs and final gates

- [x] 4.1 Update `libs/chat-shared/README.md`:
  - Document `isRawHtmlEnabled` and `rehypePlugins` on `MDMessageViewer`/`MarkdownRenderer`.
  - Document `InlineTextSegment`/`TextSegment` and the inline-segment utilities, with a compiling example.
- [x] 4.2 Update `libs/conversation-messages/README.md`:
  - The user bubble now renders Markdown with literal raw HTML.
  - The new `textSegments: TextSegment[]` shape.
  - `UserMessageBubbleLabels`, `MarkdownContentLabels`, and the moved `codeBlockTheme`/`markdownClassNames`/`markdownUrlTransform`/`tableOnOpenInCanvas` props.
  - Fix every example that passes `textSegments`.
- [x] 4.3 Update `libs/skills/README.md` for the `renderHistorySkillSegments` return shape.
- [x] 4.4 Use the `dial-docs` skill to check whether a `docs/` page describes user-bubble rendering. If one does, update it in this change. Checked: no `docs/` page describes user-bubble rendering, so no doc change was needed. `docs/architecture.md` needs no change: no lib, context, route or cross-cutting mechanism is added.
- [x] 4.5 Run `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact`. The last one is advisory: review the `markdown-code-blocks` and `user-message-copy` hits.
- [x] 4.6 Run `npm run build:quiet`, because the `chat-shared` markdown entry point and its lazy chunks change. Then close the change with one `npm run verify:full`. All typecheck, lint, test and build targets succeeded; each nx run then exited 1 on a post-run Windows file lock (`os error 32`) that is environmental, not a target failure.

## 5. Follow-ups (out of scope, record only)

- 5.1 If product wants it later: an opt-out setting or overlay feature for user-message Markdown. Not part of this change, by decision.
