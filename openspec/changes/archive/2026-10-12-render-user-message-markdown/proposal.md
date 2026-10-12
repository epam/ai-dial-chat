## Why

User messages render as plain `whitespace-pre-wrap` text, so a prompt that contains a fenced code snippet, a list or a table shows its raw Markdown source, while the model's reply to the same prompt is fully formatted ([issue #173](https://github.com/epam/ai-dial-chat/issues/173)). Users paste code into prompts all the time, and the conversation becomes hard to read: the question shows raw backticks, the answer shows highlighted code.

## Problem

- `UserMessageBubble` (`libs/conversation-messages/src/components/MessageBubble/UserMessageBubble.tsx:140-159`) renders `{textSegments ?? text}` inside a `<p class="whitespace-pre-wrap">`. It never reaches the Markdown pipeline.
- `MessageBubble` (`libs/conversation-messages/src/components/MessageBubble/MessageBubble.tsx:30-37`) deliberately keeps `markdownComponents`/`markdownUrlTransform` from the user bubble. The assistant bubble already renders the same `text` through `MDMessageViewer` (`AssistantMessageBubble.tsx:183-200`).
- Skill-mention chips in user history are spliced into the plain string by character offset (`renderHistorySkillSegments`, `libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx:316-371`). The archived multi-skill design assumes this text is plain: "Because the text is plain (not markdown), splicing React nodes into the middle of it … is direct". Rendering Markdown therefore needs a way to carry those chips through the parser.

## Solution

Render user-message text with the same `MDMessageViewer`/`MarkdownRenderer` stack the assistant uses: code blocks with syntax highlighting, inline code, lists, headings, emphasis, links, blockquotes, GFM tables and `$$` math. It is always on, with no new setting.

- **Raw HTML is shown literally** in user bubbles. A user who asks "what does `<div>` do?" without backticks must not lose the tag to the HTML parser. `MarkdownRenderer` gains an opt-out for its `rehype-raw` pass, and the user bubble uses it.
- **Skill chips survive the parser.** The host's ordered segments become placeholder tokens in the Markdown source. A rehype step after sanitization turns each token back into its inline element. Inside code and links, a token turns back into the mention's literal `/{name}` text, because code stays text and links stay non-nested.
- **Collapse, copy, edit and RTL behave as today.** "Show more/less" measures the rendered Markdown container. Copy still writes raw `Message.content`. Edit still opens the raw-text editor. Code blocks stay LTR inside RTL pages, per `markdown-code-blocks`.
- The host (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`) already passes `codeBlockTheme`, `tableOnOpenInCanvas`, `markdownClassNames` and the code/table labels through `MessageBubble`'s prop spread. The user bubble starts reading them, so no new translation keys are needed.

### Alternatives considered

1. **Code-only formatting** (render only fenced and inline code, keep the rest pre-wrap). This is the conservative baseline. It was rejected because the issue asks for formatting "the same way as the model's responses", and the user chose full Markdown. It would also need a second, partial parser.
2. **Position-based chip injection** (map mention offsets onto hast text nodes through unist `position`). This was rejected as fragile: `remark-breaks` and `rehype-raw` create or reparse nodes without reliable source offsets.
3. **Chips as a leading `beforeContent` group, as the assistant does.** This was rejected because it regresses the shipped inline-position behaviour of `skill-message-payload`.
4. **Placeholder tokens plus a post-sanitize rehype step.** This is the pick. It reuses the existing host `rehypePlugins` hook (`MarkdownRenderer.tsx:687-695`) and follows the `MarkdownWithPlaceholders`/`rehypePromptVariables` precedent (`libs/chat-shared/src/components/MarkdownWithPlaceholders/MarkdownWithPlaceholders.tsx:27`).

## Non-goals

- No toggle, feature flag or per-conversation setting. The assistant-only `ResponseFormat` setting does not affect user bubbles.
- No change to the composer or the edit-mode textarea. Neither gets a Markdown preview or a WYSIWYG view.
- No change to the stored message, the request payload, `custom_content.skills`, or what Copy writes.
- Streaming reveal does not apply to user messages, which are never streamed.

## What Changes

- `@epam/ai-dial-chat-shared`:
  - `MarkdownRenderer`/`MDMessageViewer` gain an `isRawHtmlEnabled` prop. It defaults to `true`, so assistant rendering is unchanged.
  - `MDMessageViewer` also forwards `rehypePlugins`.
  - A host-agnostic inline-segment utility is added: build the placeholder source, plus a rehype plugin and a component override that restore the segments.
- `@epam/ai-dial-conversation-messages`:
  - `UserMessageBubble` renders `text` through `MDMessageViewer` and keeps `textSegments` chips inline.
  - It reads `codeBlockTheme`, `markdownClassNames`, `markdownUrlTransform`, `tableOnOpenInCanvas` and the code/table/math labels.
  - The `textSegments` element type gains each inline segment's literal source text. **BREAKING (lib API, in-repo consumers only):** `ReactNode[]` becomes an array of strings and `{ text, node }` segments.
  - `UserMessageBubbleProps` / `UserMessageBubbleLabels` are updated in the README.
- `@epam/ai-dial-skills`: `renderHistorySkillSegments` returns the new segment shape, carrying `/{name}` as `text`.
- `apps/chat`: `ConversationMessageItem` forwards `markdownUrlTransform` to user bubbles too. It does not forward `markdownComponents`, because citations are assistant-only.

## Capabilities

### New Capabilities

- `user-message-markdown`: user message bubbles render their content as sanitized Markdown with literal raw HTML, keeping collapse, copy, edit, selection-reply, RTL and a11y behaviour.

### Modified Capabilities

- `skill-message-payload`: history skill chips render inline within the Markdown-rendered user text, and as literal `/{name}` inside code spans, code blocks and link text. The "messages without skills" scenario is no longer "byte-identical to plain text".
- `markdown-line-breaks`: the consumer list of the single-newline requirement now includes user message bubbles.
- `markdown-table-actions`: table actions are available on tables in user messages as well as assistant messages.

## Impact

- **Libs touched:** `chat-shared`, `conversation-messages`, `skills`. This is shared-lib scope. Isolation holds: the libs receive the segments, labels, URL transform and code theme as props, and the inline-segment utility knows nothing about skills, routes or i18n. The skill meaning stays in `libs/skills` and the host.
- **App touched:** `apps/chat` `ConversationMessageItem` and `AppPreviewChat`, which share the same bubble.
- **i18n:** no new user-visible strings. The existing code-block, table and math labels are reused.
- **Performance:** user bubbles now run the Markdown parse. Prism and KaTeX stay lazily loaded. `MarkdownRenderer` is memoized, and user content is static.
- **Tests:** `MessageBubble.spec.tsx` tests that assert pre-wrap plain text change. New renderer, segment and host tests are added.
- **Docs:** the `conversation-messages`, `chat-shared` and `skills` READMEs. `npm run validate:docs` must pass.

## Rollback / backward compatibility

This is not a data or API-contract change. Stored messages are untouched. To revert, revert the change: the user bubble goes back to the `<p>` render, and `isRawHtmlEnabled` defaults keep assistant output identical either way. The `textSegments` type change is internal to this monorepo, because all libs are at `0.0.1` and consumed from source.

## Acceptance criteria

- A user message containing a ```` ```ts ```` fence renders a `MarkdownCodeBlock` with language label, highlighting and copy. This is the exact scenario from issue #173.
- Lists, headings, emphasis, inline code, links, tables and `$$` math in user messages render like the assistant's.
- `<div>` typed outside backticks shows literally. `<script>` never executes. Unsafe link protocols are stripped.
- Single newlines stay visible line breaks.
- Skill chips appear at their mention position in rendered text. Inside a code fence the mention shows as literal `/{name}`.
- Show more/less, Copy (raw content), Edit (raw text), selection Reply and RTL all keep working.
- `npm run verify:changed`, `npm run validate:docs` and `npm run validate:specs` pass.
