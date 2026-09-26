## Why

When DIAL Core answers, it sends `html_tag` citation annotations in one late,
non-incremental chunk keyed only by the tag `id` (`message-annotations` spec,
"Annotation delta accumulation"). A later assistant message can emit
`<cit data-id="e43864"></cit>` for a source that was annotated in an *earlier*
turn and send no annotation payload of its own. Citation resolution is
strictly message-scoped today — `resolveMessageAnnotations` reads only
`message.custom_content.annotations`
([`annotation.ts:286`](../../../libs/quotations/src/utils/annotation.ts#L286)),
and the `data-id` lookup map is built only from that message's groups
([`useCitationMarkdownComponents.tsx:146`](../../../libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx#L146)).
An unresolved id is serialized back to literal text, so the user sees the raw
string `<cit data-id="e43864"></cit>` in the middle of an answer.

Issue #9002 asks for the fix: accumulate a conversation's annotations in the
conversation's `customViewState` as each agent message is persisted, and fall
back to that pool when a message cannot resolve a citation itself.

## What Changes

- Add an optional `customViewState?: Record<string, unknown>` field to the
  conversation contract — `Conversation`
  ([`chat.ts:372`](../../../libs/chat-shared/src/models/chat.ts#L372)) and
  `ConversationResponseDto`
  ([`openapi-response.dto.ts:696`](../../../apps/chat-api/src/openapi/openapi-response.dto.ts#L696),
  following the `llmNamingDone` precedent at line 754) — and regenerate
  `@epam/ai-dial-chat-api-client`. The field is a shared, multi-tenant bag:
  this change owns exactly one key inside it, `annotations`.
- On the backend's terminal save, merge the finished assistant message's
  `html_tag` annotations into `customViewState.annotations`, deduplicated by
  selector `id`, preserving every other key in `customViewState`. The hook
  point is `finalize` in
  [`conversation-streaming.service.ts:590`](../../../apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts#L590),
  which already owns the single terminal write per
  `backend-owned-generation-persistence`.
- Extend `useCitationMarkdownComponents` with an optional pool of
  conversation-level annotation groups used **only** to resolve
  `<cit data-id="…">` elements the message's own groups do not cover. Message
  groups keep exclusive control of sentinel injection and marker offsets.
- Thread the pool from the already-available `conversation` prop in
  `ConversationView` down to `ConversationMessageItem`, and include it when
  resolving a citation's Preview / Open-in-browser target so a
  history-resolved citation is fully interactive, not just visible.

Not breaking: the field is optional, absent on every existing conversation,
and a conversation without it renders exactly as it does today.

### Alternatives considered

1. **Merge the conversation pool into the message's `citationGroups`
   wholesale** (the literal reading of "if the message has none, look at the
   conversation"). Rejected: `injectCitationSentinels`
   ([`citation-injection.ts:22`](../../../libs/quotations/src/utils/citation-injection.ts#L22))
   places markers at `text_character_range` offsets *into the current
   message's text*, and falls back to `content.length` for selectors without
   an offset. Pooled annotations from other turns would inject phantom
   citation markers into unrelated text. A per-`data-id` fallback is the only
   form that cannot corrupt an unrelated message's rendering.
2. **Store every annotation kind in `customViewState`, not just `html_tag`.**
   Rejected: non-`html_tag` annotations are resolved by character offsets
   inside their own message and are meaningless outside it, they have no
   stable cross-message identity to deduplicate on (`index` is per-message and
   often absent), and storing them grows the conversation JSON linearly with
   turn count for no reader. `html_tag` is exactly the family that breaks.
3. **Resolve the fallback on the frontend by scanning sibling messages'
   `custom_content.annotations` instead of persisting anything.** Rejected:
   it re-derives the pool on every render of every message (O(messages²) in
   the worst case), it is unavailable to any other future reader of
   conversation-level view state, and it does not satisfy the issue's explicit
   requirement to persist in `customViewState`.
4. **Do nothing** (baseline). Rejected: users see raw `<cit …>` markup in
   answers; #9002 is P2.

## Non-goals

- No user-created annotations (highlighting, notes). Annotations here are
  model-produced citations only; no authoring UI exists or is added.
- No migration or backfill of existing conversations. The pool starts empty
  and fills from the next agent message onward.
- No second key in `customViewState` beyond `annotations`.
- No change to how non-`html_tag` citations (offset-based, PDF/Office) are
  resolved or rendered.
- No frontend write to `customViewState`; the backend owns the terminal save.

## Acceptance criteria

1. A conversation saved after an agent message whose annotations include
   `html_tag` entries carries those entries under
   `customViewState.annotations`, deduplicated by selector `id`.
2. Pre-existing unrelated keys in `customViewState` survive the save
   unchanged.
3. A message containing `<cit data-id="X"></cit>` with no matching annotation
   of its own renders an interactive citation marker when `X` is present in
   `customViewState.annotations`, and its Preview / Open-in-browser actions
   target the pooled annotation's attachment.
4. An id present in neither place still degrades to literal text exactly as
   today.
5. Citation marker positions for a message's own offset-based annotations are
   byte-identical with and without a non-empty pool.
6. A conversation with no `customViewState` loads, renders, and saves without
   error.

## Capabilities

### New Capabilities

- `conversation-custom-view-state`: the `customViewState` conversation field —
  its shape, its merge-not-overwrite persistence contract, and the
  `annotations` key this change writes into it during the backend's terminal
  save.

### Modified Capabilities

- `quotations-citation-markdown`: `useCitationMarkdownComponents` gains an
  optional fallback group pool consulted only for unresolved `<cit data-id>`
  elements; sentinel injection stays message-scoped.

## Impact

**Frontend libs**
- `libs/chat-shared/src/models/chat.ts` — `Conversation.customViewState`; plus
  its README (public model surface) per `.claude/rules/docs.md`.
- `libs/quotations` — `useCitationMarkdownComponents` signature, plus README.
  Isolation: the new parameter is plain annotation data computed by the host;
  the lib learns nothing about `customViewState`, REST paths, or persistence.
  It never reads the conversation object.

**Frontend app**
- `apps/chat/src/components/ConversationView/ConversationView.tsx` — derives
  the pool from the `conversation` prop it already receives (line 166) and
  passes it to `ConversationMessageItem` (line 907).
- `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` —
  accepts the pool, feeds it to the citation hook and to the
  preview/open-in-browser resolvers (lines 379–471).

**Backend**
- `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`
  — `finalize` merges into `customViewState` before the single terminal
  `saveConversation`.
- `apps/chat-api/src/openapi/openapi-response.dto.ts` —
  `ConversationResponseDto.customViewState`. `SaveConversationBodyDto` uses a
  bare `@IsObject()` with no nested validation
  ([`save-conversation.dto.ts:12`](../../../apps/chat-api/src/conversations/dto/save-conversation.dto.ts#L12)),
  so the global `forbidNonWhitelisted` pipe does not strip the new field; the
  DTO entry is for the OpenAPI contract and generated types.

**Generated client**
- `npm run openapi` + `npm run openapi:check`, then build/lint
  `chat-api-client`.

**Scope creep flags**
- Touches two shared libs (`chat-shared`, `quotations`) and the backend's
  terminal-save path, which `backend-owned-generation-persistence` guards with
  an exactly-once write requirement. The merge must happen *inside* the
  existing `finalize` write, never as a second save.
- `customViewState` is deliberately introduced as a general container, not an
  annotations-only field, so later features add keys without a schema change.
  No other key is defined by this change.

**i18n**: no new user-visible strings — the fix removes literal markup that
should never have been shown.

**RTL / a11y**: no directional or semantic change; a fallback-resolved
citation renders through the same `CitationDropdown` as any other.

**Rollback**: revert the commit. Conversations already carrying
`customViewState.annotations` keep the extra key; nothing reads it, and the
old message-scoped lookup is unaffected by its presence.
