## Context

`dial-document-annotations` streams citations as inline `<cit id="e43864">`
void tags inside `delta.content`, with a single late `delta.custom_fields.annotations[]`
chunk (no `index`) whose `target.selector` is `{ type: 'html_tag', tag: 'cit', id }`
and whose `body.source` is flat: `{ type: 'attachment', url }`. The existing
pipeline was built for a different Core contract — `text_character_range` /
`pdf_region` selectors, `attachment_index`-addressed sources, annotations
merged by `index`, markers suppressed entirely while `isStreaming`. Six
concrete points in the pipeline (backend chunk assembler, wire normalizer,
tag/offset injection, streaming gate, source-URL grouping, index-based merge)
each silently drop or mis-merge the new shape (see proposal "Why"). This
design makes those six points understand the new shape *in addition to* the
old one, without a parallel stack.

`libs/quotations` already generalizes the citation UI (`CitationMarker`,
`CitationDropdown`, `CitationCard`, `useCitationCard`) behind an
`AnnotationGroup` abstraction; `apps/chat` and `apps/chat-api` are the two
places that see the wire format. The design below is scoped by that
boundary: wire-shape and grouping/injection logic lives in `libs/chat-shared`
+ `libs/quotations`; persistence lives in `apps/chat-api`; `apps/chat` only
swaps which lib function it calls.

## Goals / Non-Goals

**Goals:**

- Recognize, normalize, persist, group, and render `html_tag`/`cit`
  annotations end-to-end (stream → bubble → reload → share).
- One pill per `cit` id, even when several ids share the same source URL.
- Show a pill as soon as its annotation resolves, even while the message is
  still streaming; strip every `<cit id>` tag from rendered text at all
  times, matched or not.
- Zero regression to the `text_character_range` / `pdf_region` +
  `attachment_index` path: same grouping (by URL), same streaming
  suppression, same DTOs.
- No new dependency, no feature flag, no new citation visual language.

**Non-Goals:**

- Rendering PDF region highlights for `html_tag` citations — the sample
  payload carries no `pdf_bbox`/`pdf_region`; `Preview` still just opens the
  attachment the way it does today.
- Supporting a single message that mixes `text_character_range` **and**
  `html_tag` annotations. The two placement mechanisms are per-deployment in
  practice (different generation apps emit one or the other, never both);
  tag-stripping runs before offset-sentinel injection (see Decision 5), so a
  hypothetical mixed message could see offset positions shift. Documented
  and accepted, not handled.
- Any change to `CitationCard` / `CitationMarker` visuals, i18n keys, or the
  Preview/Download button logic.

## Decisions

### 1. New selector type, not a new `Annotation` shape

Add `HtmlTagSelector` (`{ type: 'html_tag'; tag: string; id: string }`) to
the `AnnotationSelector` union in `libs/chat-shared/src/models/annotation.ts`,
alongside `TextCharacterRangeSelector`/`PdfBBoxSelector`. The normalized
`Annotation`/`AnnotationBody`/`AnnotationSource` interfaces are unchanged —
`body.source.attachment.url`/`.title` already fit the new payload once
normalized (Decision 2). `Annotation.index` stays optional and is simply
absent for `html_tag` annotations.

**Alternative rejected**: a parallel `HtmlTagAnnotation` type. Rejected
because every downstream consumer (`groupAnnotationsBySource`,
`resolveMessageAnnotations`, `share.service.ts`, the DTOs) already operates
on `Annotation`/`AnnotationBody`; a second type would need a second code
path through all of them.

### 2. Dual-shape normalization in one function

Extend `normalizeRawAnnotations` in `libs/quotations/src/utils/annotation.ts`
(same exported name, same signature) to branch on shape instead of assuming
`target.source.attachment_index` + `pdf_region`:

- **Old shape** (unchanged): `target.source.attachment_index` (number) +
  `target.selector.type === 'pdf_region'` → resolved against the `attachments`
  array, selector converted to `pdf_bbox`.
- **New shape**: `target.selector.type === 'html_tag'` → `body.source` is read
  directly as `{ type: 'attachment', url }` (no attachment-list lookup
  needed), producing `body.source.attachment = { type: MIMEType-guessed-or-default,
  url, title: body.title }`. `target.selector` is kept as-is (`html_tag`).
  `index` stays `undefined`.

A raw entry that matches neither shape is dropped, same as today.

**Alternative rejected**: a sibling `normalizeHtmlTagAnnotations` function
with call sites choosing between the two. Rejected because every existing
call site (`resolveMessageAnnotations`, `apply-chunk.ts`) calls
`normalizeRawAnnotations` once over one raw array that — per the real Core
stream — can only be one shape at a time in practice, but a single function
keeps that call-site contract simple and future-proof if Core ever mixes
selector types in one array.

### 3. Merge key: `index`, falling back to `target.selector.id`

`mergeAnnotations` (duplicated today in `libs/chat-hooks/.../apply-chunk.ts`
and `apps/chat-api/.../apply-chunk.server.ts`, and kept duplicated per
Decision 6) changes its match rule from `a.index === annotation.index` to:

```ts
const sameAnnotation = (a: Annotation, b: Annotation): boolean => {
  if (a.index != null && b.index != null) return a.index === b.index;
  const aId = a.target?.selector?.type === 'html_tag' ? a.target.selector.id : undefined;
  const bId = b.target?.selector?.type === 'html_tag' ? b.target.selector.id : undefined;
  return aId != null && aId === bId;
};
```

Without this, two `html_tag` annotations (both `index: undefined`) collapse
into one on the first `findIndex` match — the concrete bug #6 in the
proposal. Two annotations that are both `index: undefined` and not
`html_tag` (a case that doesn't occur in today's other selector types) are
never considered the same and are both appended — safe, matches current
behavior for such entries (they'd have collided before; now they append,
which is strictly more correct).

### 4. `AnnotationGroup.groupKey` replaces `sourceUrl` as the identity key

`groupAnnotationsBySource` groups `text_character_range`/`pdf_bbox` (and any
other non-`html_tag`) annotations by source URL — unchanged. A new
`groupAnnotationsByCitId(annotations: Annotation[]): AnnotationGroup[]`
groups `html_tag` annotations by `target.selector.id`, so the same source
document cited at two different tag positions produces two groups, not one
(the concrete requirement: same document, several pills).

Both functions populate a new `groupKey: string` field on `AnnotationGroup`:
`groupKey = sourceUrl` for URL-grouped entries (unchanged value, so existing
behavior/tests are untouched), `groupKey = `cit:${id}`` for cit-id-grouped
entries (prefixed to keep the two key spaces from ever colliding).
`sourceUrl` is kept on every group (still the attachment URL used for
Preview/Download — a cit-id group's `sourceUrl` is its first annotation's
resolved attachment URL).

`CitationDropdown`, `useCitationCard`, and `CitationCardContext` switch every
`group.sourceUrl` use that means "this group's identity" (open/close state,
active index, the `key=` prop in `useCitationMarkdownComponents`) to
`group.groupKey`. Uses of `group.sourceUrl` that mean "the attachment to
open/download" are untouched.

A new `groupAnnotations(annotations: Annotation[]): AnnotationGroup[]`
dispatcher (exported from `libs/quotations`) partitions its input by selector
type and concatenates `groupAnnotationsByCitId` + `groupAnnotationsBySource`
results; `apps/chat` switches its one call site to this dispatcher instead of
calling `groupAnnotationsBySource` directly, so the host stays a thin
pass-through and never branches on selector type itself.

**Alternative rejected**: keep `sourceUrl` as the identity key and make
`groupAnnotationsByCitId` synthesize a fake per-group `sourceUrl` (e.g.
`${realUrl}#${citId}`). Rejected — it overloads a field callers already use
as "the real attachment URL" (Preview/Download) with a second, incompatible
meaning, which is exactly the kind of implicit dual-purpose field the lib
conventions warn against.

### 5. One content transform: strip tags, then inject offset sentinels

`injectCitationSentinels(content, groups)` keeps its name and signature but
its body now does three passes, each cheap to skip when not applicable:

1. **Trailing partial-tag guard**: if `content` ends with an incomplete
   prefix of `<cit id="…">` (e.g. `<cit`, `<cit id="e4`), strip that
   trailing fragment before further processing — a tag split across two SSE
   chunks must never render as literal broken markup mid-stream.
2. **Tag pass**: replace every complete `<cit id="…">` occurrence. If the id
   matches an `html_tag` group's `target.selector.id` (looked up by scanning
   `groups`, not a separate array, so sentinel indices stay valid array
   indices into the same `groups` the caller passed in), replace with the
   existing `⟦C{idx}⟧` sentinel; otherwise replace with `''` (hidden — no
   matching annotation yet, or none ever arrives).
3. **Offset pass** (existing logic, unchanged): for every non-`html_tag`
   group, inject `⟦C{idx}⟧` at `target.selector.end`, descending order.

Step 1–2 run unconditionally (a cheap `content.includes('<cit')` check lets
the function bail out early when there's nothing to strip), independent of
whether `groups` is empty — an unmatched tag must disappear even when no
annotation for it has arrived yet, which is exactly the case where
`groups` is `[]`. This replaces today's `groups.length > 0 ? inject(...) : content`
fast path in `useCitationMarkdownComponents`, which would otherwise let a
raw `<cit id="…">` tag flash to the user before its annotation resolves.

**Alternative rejected**: a second hook/utility parallel to
`injectCitationSentinels`, composed by the caller. Rejected — `groups`
already carries enough information (each group's `primaryAnnotation.target?.selector?.type`)
to self-dispatch; a second function would force every caller to run both and
concatenate results correctly, which is exactly the offset-bookkeeping this
function already owns.

### 6. Backend keeps its own duplicate of the merge/normalize helpers

`apps/chat-api/src/conversations/utils/apply-chunk.server.ts` gets its own
`normalizeRawAnnotationsServer(raw, attachments)` and updated
`mergeAnnotations` (Decision 3's rule), colocated with the file's existing
`mergeStages`/`mergeStageAttachments` duplicates — it already mirrors the
frontend's pure functions with zero cross-import, per the file's own
documented contract ("mirroring the frontend chunk applier... MUST be a pure
function with no imports from `apps/chat`"). `libs/quotations` is a
React/Tailwind/`pdf-highlighter-kit` UI lib; importing it into the NestJS
backend to reuse `normalizeRawAnnotations` would pull an unrelated dependency
graph into `apps/chat-api` and cross the app/lib boundary the wrong way.

The server-side normalizer covers **both** wire shapes (old and new), not
just the new one. The proposal's bug list is scoped to the new shape, and
today the backend already drops `custom_fields.annotations` for the old
shape too (a pre-existing, out-of-scope gap — the citation-marker spec
notes annotations "are available only in the current streaming session and
disappear after a page reload" today). Implementing one normalizer that
mirrors the frontend's dual-shape logic costs nothing extra over a
new-shape-only version and avoids the two mirrors (client/server) diverging
on which shapes they understand; whether old-format annotations start
surviving reload as a side effect is an acceptable, not a targeted, outcome
of this change.

`apply-chunk.server.ts` builds `allAttachments` (existing + this chunk's
incoming) before calling the normalizer, mirroring the client's
`apply-chunk.ts` `allAttachments` construction — old-shape `attachment_index`
resolution needs the full accumulated attachment list, not just this
chunk's.

### 7. `AnnotationDto` gains `target`/`source`, validated against the normalized (not wire) shape

`AnnotationDto`/`AnnotationBodyDto` today validate only `index`/`body.title`/`body.quote`
— they document what the server *already* accumulates, not the full
`Annotation` shape, because until now the server never computed a
`target`/`source` for a persisted annotation. Add:

- `AnnotationSelectorDto` — validated as `{ type: string }` plus known
  optional fields (`start`, `end`, `page`, `x1`/`y1`/`x2`/`y2`, `tag`, `id`),
  matching the open-selector-shape philosophy of `AnnotationSelector` in
  `chat-shared`.
- `AnnotationTargetDto` — `{ selector?: AnnotationSelectorDto }`.
- `AttachmentResourceDto` / `AnnotationSourceDto` — `{ type: string; url: string; title?: string }`
  / `{ type: 'attachment'; attachment: AttachmentResourceDto }`.
- `AnnotationBodyDto` gains `source?: AnnotationSourceDto`.
- `AnnotationDto` gains `target?: AnnotationTargetDto`.

These validate the **normalized** internal shape (`body.source.attachment.url`),
since that's what `apply-chunk.server.ts` persists into
`custom_content.annotations` — never the raw wire shape, which never reaches
storage.

### 8. Streaming visibility: `html_tag` annotations bypass the blanket streaming suppression

`useAnnotations(message, isStreaming)` currently returns `[]` unconditionally
while `isStreaming`. Change it to: while streaming, return
`resolveMessageAnnotations(message).filter(a => a.target?.selector?.type === 'html_tag')`
instead of `[]`; while not streaming, behavior is unchanged (return
everything). This is the one behavior difference between the two selector
families — the proposal locks it in explicitly ("show pills once the
matching annotation exists") — and it is scoped to the one hook that already
owns the streaming gate, rather than threading a new flag through
`groupAnnotations`/injection.

**Alternative rejected**: add an `isStreaming` parameter to
`groupAnnotations`/`injectCitationSentinels` and filter there instead.
Rejected — `useAnnotations` is already the single documented seam for
"what's visible right now given streaming state"; duplicating that gate
into the grouping/injection layer would give two places a caller could get
out of sync.

## Risks / Trade-offs

- **[Risk] Regex-based tag stripping mis-handles a legitimately literal
  `<cit …>` substring in model output (not a real citation tag).** →
  Accepted: the tag is a fixed, namespaced void-element contract from a
  specific first-party deployment; a model emitting literal `<cit id="…">`
  text unrelated to citations is not a realistic case for this deployment,
  and the existing sentinel-injection code already makes the same
  trust-the-wire-format assumption for `⟦C{idx}⟧`.
- **[Risk] `groupKey` field addition is a shape change to a lib's public
  `AnnotationGroup` type — any external consumer relying on `sourceUrl`
  alone as the group identity breaks.** → Mitigation: `sourceUrl` keeps its
  exact current value and meaning for URL-grouped entries; only *new*
  cit-id-grouped entries introduce a `groupKey` that differs from `sourceUrl`.
  `apps/chat` is the only consumer in this repo; grep for `.sourceUrl` usage
  as an identity key is part of the task list.
- **[Risk] Duplicating the wire-shape normalizer on the backend (Decision 6)
  can drift from the frontend copy over time**, the same risk the existing
  `mergeStages`/`mergeAnnotations` duplication already carries. → Mitigation:
  none beyond what already applies to that duplication — both copies are
  small, covered by mirrored unit tests (task list), and the
  `server-chunk-assembler` spec already documents the mirroring contract.
- **[Trade-off] Mixed `text_character_range` + `html_tag` annotations on one
  message are unhandled** (Non-Goals) — accepted as a non-issue given the
  two selector families come from different generation apps in practice.

## Migration Plan

Purely additive: no schema migration, no data backfill, no flag rollout.
Existing persisted conversations with only `custom_content.annotations`
(old, already-normalized shape) are unaffected — the new selector/merge
logic is a superset of the old, and every changed function's old-shape
branch is exercised by the existing test suite before any new-shape test is
added. Rollback is a plain revert; no persisted data becomes invalid because
the new fields (`target`, `source` on the DTO) are all optional.

## Open Questions

None outstanding — the five decisions the proposal asked to lock in
(normalize into `custom_content.annotations`, one pill per `cit` id, strip
tags immediately, reuse existing UI, no feature flag) are captured in
Decisions 2, 4, 5, and the Goals section above.
