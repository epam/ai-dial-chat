## Context

User bubbles render plain text today:

- `UserMessageBubble` (`libs/conversation-messages/src/components/MessageBubble/UserMessageBubble.tsx`) prints `{textSegments ?? text}` into a `<p class="whitespace-pre-wrap">`.
- `useCollapsedText` (`libs/chat-shared/src/hooks/useCollapsedText.ts`) measures that `<p>`.
- `textSegments` is a `ReactNode[]` produced by `renderHistorySkillSegments` (`libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx`). It slices `content` at each matched `/{name}` and drops a `ChatSkill` chip into the gap.

Assistant bubbles already use `MDMessageViewer`, which wraps `MarkdownRenderer` (`libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`). That renderer runs `remark-gfm`, `remark-breaks` and `remark-math`, then the rehype passes `rehype-raw`, lazy `rehype-katex`, `rehype-sanitize`, and finally any caller `rehypePlugins`. It renders code through the lazily loaded `MarkdownCodeBlock`.

`MessageBubble` already spreads every assistant-only prop (`codeBlockTheme`, `markdownClassNames`, `tableOnOpenInCanvas`, labels) into the user bubble. It explicitly withholds `markdownComponents` and `markdownUrlTransform`.

Users chose two things, recorded in the proposal: full Markdown, the same as the assistant, and always on, with no setting.

Stakeholders: chat users, the skills feature (inline history chips), and embedding hosts of `@epam/ai-dial-conversation-messages`.

## Goals / Non-Goals

**Goals:**

- Render user text with the assistant's Markdown pipeline, with a single renderer and no fork.
- Keep skill chips at their inline positions through the Markdown parse.
- Show raw HTML in user prompts literally.
- Keep collapse, copy, edit, selection-reply, RTL and a11y behaviour.

**Non-Goals:**

- A Markdown preview in the composer or edit textarea.
- Any toggle or feature flag.
- Changing the stored or sent message.
- Citation overrides in user bubbles.
- Streaming reveal for user text.

## Decisions

### D1 — Reuse `MDMessageViewer` in the user bubble

The user bubble replaces the `<p>` with a `div` that carries the text class and `text-start`. Inside it renders `MDMessageViewer content={text}` with `isPlainText={false}`, `isStreaming={false}`, and the forwarded presentation props.

- `MessageBubble` stops withholding `markdownUrlTransform` from the user branch.
- `markdownComponents` stays assistant-only, because citation `p`/`li` overrides make sense only for model output.
- `UserMessageBubbleProps` gains `codeBlockTheme`, `markdownClassNames`, `markdownUrlTransform` and `tableOnOpenInCanvas`. They are declared on `BaseMessageBubbleProps`, or on the user props, so they stop being assistant-only.
- `labels` widens to a new `UserMessageBubbleLabels` that carries the code, table and math labels. It is shared with `AssistantMessageBubbleLabels` by moving those fields into a common `MarkdownContentLabels` interface that both extend.

*Alternatives:* a separate lightweight "user markdown" renderer, or code-only rendering. Both were rejected: they fork the pipeline and drift from `markdown-code-blocks`, `bounded-syntax-highlighting` and the table/math specs that the assistant bubble already satisfies.

### D2 — `isRawHtmlEnabled` opt-out on `MarkdownRenderer`

Add `isRawHtmlEnabled?: boolean` (default `true`) to `MarkdownRendererProps` and `MDMessageViewerProps`. `MDMessageViewer` also starts forwarding `rehypePlugins` to `MarkdownRenderer`, because it does not do so today and D3 needs it. When it is `false`, `rehypeRaw` is replaced by `rehypeRawAsText` (`libs/chat-shared/src/utils/markdown-html.ts`), which turns every `raw` hast node into a `text` node, so `<div>` shows literally. react-markdown's own raw-to-text fallback cannot be relied on here: `rehypeSanitize` runs earlier in the pipeline and drops `raw` nodes outright, which was found during implementation. `rehypeSanitize` and `defaultUrlTransform` stay in the pipeline regardless. The memo key for `effectiveRehypePlugins` adds `isRawHtmlEnabled`.

*Why:* users type angle brackets in questions far more often than models emit unfenced HTML. Keeping `rehype-raw` would silently delete text like `<T>` or `<div>`.

*Alternative:* escaping `<` in user content before parsing. This was rejected: it would also escape `<` inside code spans and fences, where Markdown already keeps it literal, and it would need a remark-aware escaper.

### D3 — Inline segments through placeholder tokens and a post-sanitize rehype step

A new host-agnostic utility, `libs/chat-shared/src/utils/inline-segments.ts`, is exported from the root and `./markdown` entry points:

- `InlineTextSegment` (in `libs/chat-shared/src/models/`): `{ text: string; node: ReactNode }`. `text` is the segment's literal source, used where a node cannot render.
- `TextSegment = string | InlineTextSegment`.
- `buildInlineSegmentSource(segments)` returns `{ source, inlineSegments }`. It concatenates the string runs verbatim, as Markdown source, and replaces the i-th inline segment with the token `{i}`. These are private-use code points with no Markdown meaning, so a token never opens emphasis, lists or links. This is also why `/my_skill_name` is never parsed as emphasis.
- `createRehypeInlineSegments(inlineSegments)` returns a rehype plugin. It runs as a caller `rehypePlugins` entry, and therefore **after** `rehypeSanitize`, so the custom element below is not stripped. It visits text nodes:
  - With an ancestor `code`, `pre` or `a`, it replaces each token with that segment's `text`. Code stays a string for `MarkdownCodeBlock` highlighting and copy, and no interactive chip nests inside a link.
  - Otherwise it splits the text node around each token and inserts a `dial-inline-segment` element whose `dataIndex` property is `i`.
  - It also replaces tokens inside `href`/`src` property values with the literal `text`. This covers autolinked URLs that contain a mention-like substring.
- `inlineSegmentComponents(inlineSegments)` returns the react-markdown `components` entry `{ 'dial-inline-segment': ({ node }) => inlineSegments[index].node }`. The custom key needs a typed cast, because `Components` is keyed by intrinsic elements; it is localized in the util.

The user bubble calls these in a `useMemo` keyed on `[text, textSegments]`. It passes the resulting `source` as `content`, the plugin as `rehypePlugins`, and the components map as `components`. When `textSegments` is absent, `content` is `text` and no plugin is added.

**Guard:** if any string run already contains `` or ``, `buildInlineSegmentSource` falls back to plain concatenation of every segment's `text`. The bubble then renders correct Markdown without chips rather than mis-mapping them. The fallback is unit-tested.

`MarkdownWithPlaceholders`/`rehypePromptVariables` (`libs/chat-shared/src/utils/prompt-variables.ts`) are the precedent for a caller rehype step that wraps matched text in a dedicated element.

*Alternatives:*

- (a) Mapping offsets onto hast `position`. Rejected because `remark-breaks` splits text nodes and `rehype-raw` reparses, so positions are unreliable.
- (b) Inferring each node's literal from `text` by cumulative offsets. Rejected because two adjacent nodes with no string between them are ambiguous. That is why D4 makes the literal explicit.
- (c) Moving chips to `beforeContent`. Rejected because it regresses the shipped `skill-message-payload` positions.

### D4 — `textSegments` becomes `TextSegment[]`

`UserMessageBubbleProps.textSegments` changes from `ReactNode[]` to `TextSegment[]`, imported from `@epam/ai-dial-chat-shared`, which is already a peer of both libs.

- `renderHistorySkillSegments` pushes `{ text: content.slice(mention.start, mention.start + mention.length), node: <ChatSkill … /> }` instead of a bare element. Its model in `libs/skills/src/models/skill-selector-overlay.ts` changes accordingly.
- The host (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`) passes the result through unchanged.

This is a breaking type change for an exported lib prop. Every consumer is inside this monorepo, and libs stay at `0.0.1` (consumed from source), so it is updated in the same change together with the two READMEs.

### D5 — Collapse measures the Markdown container

`useCollapsedText<HTMLDivElement>` attaches `textRef` to the new text `div` that wraps `MDMessageViewer`. That `div` also carries `textClass`, so `getComputedStyle(node).lineHeight` still reads the bubble's body line-height. `scrollHeight` now includes code blocks, tables and headings. The `ResizeObserver` already re-measures when the lazy `MarkdownCodeBlock`/KaTeX chunks finish loading and change the height.

The `text` identity passed to the hook stays the raw `text`. The hook needs no API change, so this is not a breaking change to `useCollapsedText`.

### D6 — Bubble layout with block content

- The bubble keeps `w-fit max-w-full`. The text `div` is `min-w-0 max-w-full`.
- Code blocks and tables already scroll internally (`markdown-code-blocks` "internal scrolling", `MarkdownTable` scroll region). A wide block therefore grows the bubble to the column width and then scrolls, instead of overflowing.
- The Markdown output's outer margins are trimmed with `[&>div>*:first-child]:mt-0 [&>div>*:last-child]:mb-0` on the text `div`, so a single-paragraph message keeps today's padding.
- The chip bleed wrapper (`-ms-1 -me-1 ps-1 pe-1`) stays.
- Everything uses logical properties. No new icons are added.

### D7 — State ownership, memoisation, gating

- **State:** no new context or hook state. The bubble derives everything from props, and collapse state stays in `useCollapsedText`.
- **Memoisation:**
  - `buildInlineSegmentSource`, the plugin array and the components map are each `useMemo`'d.
  - The no-segments path uses module-level empty constants.
  - The table-action labels object is `useMemo`'d, mirroring `AssistantMessageBubble`.
  - `MarkdownRenderer` stays `memo`.
- **Gating:** none. Not `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, not an overlay feature, not `ResponseFormat`.
- **Observability:** none. No new endpoints, caches or i18n keys.

### D8 — Library isolation

- `chat-shared` gains only a generic token/rehype utility and a boolean prop. It knows nothing about skills, routes or i18n.
- `conversation-messages` receives segments, labels, the URL transform (DIAL file-id mapping stays in the app), the code theme and the canvas callback as props.
- `skills` keeps owning the chip meaning.
- No `/api` path, context, env or storage reaches any lib.

## Risks / Trade-offs

- **[Text that reads differently once rendered]** A user line starting `1.` or `- ` becomes a list, a 4-space indent becomes a code block, `*word*` becomes italic, and runs of blank lines collapse. → This is accepted, because it matches the assistant's behaviour and the issue's expected result. Copy and Edit still expose the exact source. `remark-breaks` keeps single newlines, so ordinary multi-line prompts look as before.
- **[A previously hidden HTML-looking prompt now shows the tag]** → This is intended (D2). Assistant output is unaffected because the default is `true`.
- **[Parse cost on long histories]** Every user message now runs remark/rehype. → The renderer is memoized, user content is static, and the Prism/KaTeX chunks stay lazy. The overall cost is comparable to the assistant messages already on the page.
- **[A PUA sentinel already in the content]** → The D3 guard falls back to chip-less Markdown. The fallback is covered by a unit test.
- **[A chip split by the Markdown structure]** For example, a mention immediately followed by `**`. → Tokens are opaque to the parser, so a chip can only land inside whichever inline element encloses the token. A test covers a mention inside emphasis and inside a list item.
- **[Collapse height jumps when a lazy code block loads]** → The `ResizeObserver` re-measures. The collapsed max height is line-count based, so the fade position is stable.
- **[Tests asserting `whitespace-pre-wrap` and the exact `textContent`]** → These are updated in the same change, with assertions on rendered structure and visible text.
- **[Breaking `textSegments` type]** → All in-repo consumers are updated together. The READMEs document the new shape.

## Migration Plan

There is no data migration, and nothing to deploy beyond a normal release.

Rollback: revert the change. User bubbles go back to the `<p>` render. `isRawHtmlEnabled` can stay, since its default keeps the assistant pipeline identical.

## Open Questions

None blocking. The scope (full Markdown) and gating (always on) were confirmed by the user before planning.
