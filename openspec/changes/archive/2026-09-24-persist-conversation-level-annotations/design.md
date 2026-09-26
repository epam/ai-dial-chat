## Context

DIAL Core delivers `html_tag` citation annotations in one late,
non-incremental chunk keyed only by the tag `id` — this is already recorded
in the `message-annotations` capability ("an `html_tag`-selector annotation
never carries an `index`"). Resolution of `<cit data-id="…">` is entirely
message-scoped: `resolveMessageAnnotations`
([`annotation.ts:286`](../../../libs/quotations/src/utils/annotation.ts#L286))
reads only `message.custom_content.annotations`, and
`useCitationMarkdownComponents` builds `citGroupsByTagId` only from the
groups it was handed
([`useCitationMarkdownComponents.tsx:146`](../../../libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx#L146)).
An unmatched id is deliberately serialized back to literal text rather than
dropped, so the user sees raw `<cit data-id="e43864"></cit>` inside an answer
whenever the model cites a source annotated in an earlier turn.

Two existing constraints shape the solution:

- **The backend owns the terminal write.** `backend-owned-generation-persistence`
  requires exactly one terminal `saveConversation` per generation, dispatched
  from `finalize`
  ([`conversation-streaming.service.ts:590`](../../../apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts#L590)),
  and forbids the frontend from saving during streaming. Any accumulation
  must ride that write.
- **Libs must not know host storage.** `AGENTS.md` §Library isolation keeps
  persistence schemas, storage keys, and app contexts out of `libs/*`. So
  `libs/quotations` receives annotation data, never a conversation.

## Goals / Non-Goals

**Goals:**

- A citation whose annotation arrived in an earlier turn renders as a real,
  interactive citation marker.
- The conversation gains a general-purpose `customViewState` container that
  later features can extend without another schema change.
- Zero behavioural change for conversations that have no pool.

**Non-Goals:**

- User-authored annotations (highlights, notes). None exist today.
- Backfilling existing conversations.
- Changing how offset-based (PDF / Office / `text_character_range`)
  citations resolve.
- Any second key inside `customViewState`.

## Decisions

### D1 — `customViewState` is an open record, not an annotations field

**Chosen:** `customViewState?: Record<string, unknown>` on `Conversation`
([`chat.ts:372`](../../../libs/chat-shared/src/models/chat.ts#L372)) and
`ConversationResponseDto`
([`openapi-response.dto.ts:696`](../../../apps/chat-api/src/openapi/openapi-response.dto.ts#L696)),
with this change owning only the `annotations` key.

**Why:** acceptance criterion 4 of issue #9002 ("saving annotations preserves
other `customViewState` data") only makes sense if the field is shared. A
typed `{ annotations: Annotation[] }` field would make every future addition
a breaking schema change and an OpenAPI regeneration.

**Rejected:** a dedicated `conversationAnnotations?: Annotation[]` column.
Simpler to type, but contradicts the issue's explicit field name and the
preserve-other-data criterion.

**Follows:** `llmNamingDone` in the same DTO class (line 754) — an optional
conversation-level flag added without touching the shared `Conversation`
interface. We *do* add it to the shared interface here, because the frontend
reads it; `llmNamingDone` is backend-only.

**Validation note:** `SaveConversationBodyDto.conversation` is annotated with
a bare `@IsObject()`
([`save-conversation.dto.ts:12`](../../../apps/chat-api/src/conversations/dto/save-conversation.dto.ts#L12)),
so the global `forbidNonWhitelisted` pipe never walks into the conversation
object and cannot strip the new key. The DTO property is there for the
OpenAPI contract and generated types only. This also means the field's
contents are **untrusted persisted JSON** on read — see D5.

### D2 — Only `html_tag` annotations enter the pool

**Chosen:** filter to `target.selector.type === 'html_tag'` with both a
selector `id` and a `body.source.attachment.url`.

**Why:** three reasons converge.
1. `html_tag` is the only family addressed by a stable, cross-message
   identifier. Every other selector locates itself by character offsets or
   page geometry *inside its own message*.
2. Only `html_tag` can fail the way #9002 describes — an unresolved
   `data-id`. Offset-based groups are placed by `injectCitationSentinels`
   and cannot "go missing".
3. Unbounded growth. A long conversation would otherwise accumulate every
   annotation of every turn in a single JSON blob that is read and rewritten
   on every save.

**Rejected:** storing all annotations. No dedup key exists (`index` is
per-message and often absent), and nothing would read them.

### D3 — The merge happens inside the existing `finalize` write

**Chosen:** compute the merged `customViewState` while building
`finalConversation` in `finalize`, so the already-dispatched single
`saveConversation` carries it.

**Why:** `backend-owned-generation-persistence` states "exactly one terminal
write attempt". A separate save after the fact would violate that, race the
generation registry's `beginFinalizing` fence, and double the storage round
trips.

**Rejected:**
- A second save after `finalize` — violates the exactly-once requirement.
- Accumulating incrementally in `publishChunk` — `html_tag` annotations
  arrive in one late chunk anyway, so per-chunk work buys nothing and would
  need its own persistence trigger.
- Doing it in `ConversationPersistenceService.saveConversation` — that method
  is called by non-generation paths too (rename, edit, import); silently
  mutating view state there would surprise every caller.

**Applies to all three terminal statuses** (`Done`, `Stopped`, `Error`): the
annotation chunk can land before an interruption, and a stopped message's
citations are still rendered.

**Failure isolation:** the merge is a pure function wrapped so that a throw
degrades to "save without the view-state update" plus a `logger.warn`,
matching how `finalize` already tolerates a failed save. Losing a pool entry
must never cost the answer itself.

### D4 — A new pure server helper, reusing the existing dedup shape

**Chosen:** `apps/chat-api/src/conversations/utils/conversation-view-state.server.ts`
exporting a pure
`mergeHtmlTagAnnotationsIntoViewState(current, annotations)` that returns a
new `Record<string, unknown> | undefined`.

**Why:** `finalize` is already a dense closure; a pure helper is unit-testable
without a NestJS module. It sits next to
[`apply-chunk-annotations.server.ts:221`](../../../apps/chat-api/src/conversations/utils/apply-chunk-annotations.server.ts#L221),
whose `mergeAnnotations` already implements "match by `index`, or by
`target.selector.id` for `html_tag` entries" — the same identity rule, at the
message level. We keep the two separate rather than generalising one: message
merge must union *fields* of a partially-streamed annotation, pool merge must
keep the first complete entry and discard later duplicates.

**First-wins, not last-wins:** a pool entry stays stable for the life of the
conversation, so a cached preview or an open canvas never has the annotation
swapped underneath it.

**Empty stays empty:** when nothing qualifies and no `customViewState`
existed, the helper returns `undefined` and the field is not written. This
keeps existing conversations byte-identical after an uncited answer.

### D5 — The pool is derived at the app edge and crosses the lib boundary as data

**Chosen:** a new hook
`apps/chat/src/hooks/conversation/useConversationAnnotationPool.ts` reads
`conversation.customViewState?.annotations`, defensively filters it, and
returns `AnnotationGroup[]` built with the already-exported
`groupAnnotationsByCitId` ([`index.ts:36`](../../../libs/quotations/src/index.ts#L36)).
`ConversationView` calls it — it already receives the whole `conversation`
as a prop (line 166) — and passes the result to `ConversationMessageItem`
(line 907).

**Why:** `customViewState` is a host-owned storage schema. Under
§Library isolation the lib may not know the field exists; it receives the
same `AnnotationGroup[]` shape it already consumes. The carrier is a prop,
and the knowledge stops at the app edge.

**Defensive parsing is mandatory, not optional:** per D1 nothing validates
this field on write, and a conversation is user-editable via import. The
hook treats a non-array, `null` entries, and entries without an `html_tag`
selector as absent. `groupAnnotationsByCitId` already drops entries missing
`selector.id` or `body.source.attachment.url`, so the hook's own filter is a
thin type guard in front of it.

**Memoisation:** `useMemo` keyed on `conversation.customViewState`, with a
module-level `EMPTY_POOL` constant for the absent case. Without this, a new
array identity each render invalidates `ConversationMessageItem`'s `memo`
and forces `MarkdownRenderer` to re-parse every assistant message — the same
reason `NO_CITATION_COMPONENTS` is a module-level constant inside the hook
today.

**No new context.** The conversation object already flows down as a prop;
adding a provider for one derived array would be strictly more machinery for
the same data.

### D6 — The pool resolves ids only; it never touches sentinel injection

**Chosen:** `useCitationMarkdownComponents` gains an optional fifth-position
parameter (a `fallbackGroups: AnnotationGroup[]`, defaulting to `[]`) that is
consulted *only* when `citGroupsByTagId` misses. `processedContent` is
computed from `groups` alone.

**Why this is not negotiable:** `injectCitationSentinels`
([`citation-injection.ts:22`](../../../libs/quotations/src/utils/citation-injection.ts#L22))
places a marker at each group's `text_character_range` `end` offset **into
the current message's string**, and falls back to `content.length` for a
group carrying no such offset. Foreign groups would therefore inject phantom
markers — in practice, a pile of them stacked at the end of an unrelated
paragraph. The spec states this as a testable invariant: `processedContent`
is byte-identical with and without a pool.

**Message groups win a collision.** If both carry id `e1`, the message's own
entry is authoritative — it is the fresher object and the one the rest of
the message's rendering already references.

**Fast-path adjustment:** the empty-overrides fast path now also requires an
empty pool, otherwise a message whose only citation is pool-resolved would
get no `cit` override at all.

**Parameter, not a merged argument:** passing `[...groups, ...pool]` as
`groups` is the one-line change that looks equivalent and is exactly the bug
above. Keeping them as separate parameters makes the asymmetry explicit in
the type signature.

**API shape:** an optional trailing parameter keeps all existing call sites
compiling unchanged. The hook already has four positional parameters, two
optional; adding a fifth is at the edge of what positional arguments carry
well, but converting to an options object would be a breaking change to a
published lib for no functional gain — noted as a follow-up, not done here.

### D7 — Preview and download resolve against the union

**Chosen:** `handleCitationPreview` and `handleCitationOpenInBrowser` in
`ConversationMessageItem` (lines 392–430) resolve against
`[...citationGroups, ...poolGroups]`, memoised.

**Why:** `annotationToPdfCanvasContent` and `annotationToOoxmlCanvasContent`
take the group list to find an annotation's siblings (all highlights for the
same document). A pool-resolved citation whose siblings are not in the list
would open a canvas with a single highlight, or none. Rendering a marker the
user cannot act on is a half-fix.

**This union is for lookups only** — it is never passed as the hook's
`groups`, per D6.

## Risks / Trade-offs

**Conversation JSON growth** → Only `html_tag` annotations, deduplicated by
id, are stored (D2). A conversation citing N distinct sources stores N
entries regardless of turn count. Re-citing the same source is free.

**A stale pool entry outlives its attachment** (file deleted or moved) →
Already the existing failure mode for an in-message citation pointing at a
deleted file; the preview surfaces the same attachment error. No new
handling.

**Untrusted data in `customViewState`** → Nothing validates the field on
write (D1), and conversation import can supply arbitrary JSON. Mitigated by
defensive parsing in the hook (D5). The pool is read as data and rendered
through the existing `CitationDropdown`; no value from it reaches
`dangerouslySetInnerHTML` — `rehype-sanitize` still governs the message
markup, and the pool only supplies the *target* of a `data-id` already
present in that sanitized markup.

**A cross-conversation id collision** → ids are conversation-scoped by
construction (the pool lives on one conversation), so there is nothing to
collide with.

**Touching the exactly-once terminal write** → D3 keeps the merge inside the
existing `finalConversation` construction; the number of
`saveConversation` calls is unchanged and covered by an explicit scenario.

**Breaking the published `useCitationMarkdownComponents` signature** → the
new parameter is optional and trailing; existing callers compile unchanged.
The lib README must document it in the same change
(`.claude/rules/docs.md`).

**Regressing marker positions** → guarded by the byte-identical
`processedContent` scenario, which is a direct unit test on the hook.

## Migration Plan

No data migration. The field is optional and absent on every existing
conversation; the pool fills from the next agent message onward.

Deploy order does not matter: an older frontend ignores an unknown field, and
a newer frontend with an older backend simply finds no pool and behaves as
today.

**Rollback:** revert the commit and regenerate the client. Conversations that
already carry `customViewState.annotations` keep the key; nothing reads it,
and its presence cannot affect the message-scoped lookup.

## Open Questions

1. **Cap on pool size.** Should the pool be bounded (e.g. keep the most
   recent 500 entries) to protect against a pathological conversation with
   thousands of distinct cited sources? Proposed: no cap for now — dedup by
   id already bounds it by *distinct sources*, and DIAL Core's own
   conversation size limit is the backstop. Revisit if a real conversation
   approaches it.
2. **Non-generation save paths.** Conversation edit, regenerate, and import
   go through `saveConversation` without passing through `finalize`. They
   currently neither add to nor prune the pool, which is correct for edit and
   regenerate. Import carries whatever the imported file had — acceptable,
   since it is the same trust level as the imported messages themselves.
   Flagged rather than decided; no code depends on the answer.
