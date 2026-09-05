## Why

The `dial-document-annotations` deployment (`applications/public/dial-document-annotations__1.0.0`)
streams citations as inline `<cit id="…">` tags in `delta.content`, paired
with a late `delta.custom_fields.annotations[]` chunk whose `target.selector`
is `{ type: 'html_tag', tag: 'cit', id }` and whose `body.source` is a flat
`{ type: 'attachment', url }` (no `attachment_index`, no `pdf_region`, no
`index`). None of the existing annotation pipeline — backend chunk assembler,
frontend chunk applier, normalization, grouping, or markdown injection —
recognizes this shape, so users see raw `<cit id="…">` tags in the chat
bubble instead of citation pills, and the annotations are dropped entirely on
reload because the backend never persists `custom_fields.annotations`.

## What Changes

- Add `HtmlTagSelector` (`{ type: 'html_tag'; tag: string; id: string }`) to
  `AnnotationSelector` in `libs/chat-shared`.
- Extend `normalizeRawAnnotations` (or a sibling) in `libs/quotations` to
  accept both the existing `attachment_index` + `pdf_region` wire shape and
  the new `html_tag` + flat `body.source.url` shape, normalizing the latter
  into `body.source.attachment.url`/`.title` without requiring `index`.
- Change annotation merge-by-`index` (client `apply-chunk.ts`, server
  `apply-chunk.server.ts`) to also merge by `target.selector.id` when the
  selector is `html_tag`, since these annotations never carry an `index`.
- Persist `delta.custom_fields.annotations` on the backend by normalizing
  into `custom_content.annotations` in `apply-chunk.server.ts`, mirroring the
  frontend, so reload still renders pills and `share.service.ts` still
  auto-shares cited files.
- Add tag-based marker placement to `libs/quotations`: parse `<cit id="…">`
  tags out of accumulated message content (tolerant of tags split across SSE
  chunks and of tags with no matching annotation yet), strip them from the
  rendered text, and inject a citation marker at each tag's position once its
  annotation is available.
- **BREAKING (internal, lib-only)**: `AnnotationGroup`'s identity key changes
  from `sourceUrl` to a new `groupKey` field, because two `html_tag`
  citations of the *same* source document at *different* tag positions must
  render as two separate pills, not collapse into one — `groupAnnotationsBySource`
  keeps grouping `text_character_range` annotations by URL, but a new
  `groupAnnotationsByCitId`-style path groups `html_tag` annotations by their
  `cit` id. `CitationDropdown`, `useCitationCard`, and `CitationCardContext`
  switch from keying open/active-index state on `sourceUrl` to `groupKey`.
- Enable citation markers to render while `isStreaming: true` for messages
  that contain resolved `html_tag` annotations (today `useAnnotations` always
  returns `[]` mid-stream); unmatched tags stay stripped/hidden until their
  annotation arrives or the stream ends.
- No new UI, no feature flag, no change to the existing
  `text_character_range` / `pdf_region` + `attachment_index` path.

## Capabilities

### New Capabilities

_None — this is an additive extension of existing annotation/citation capabilities._

### Modified Capabilities

- `message-annotations`: add `HtmlTagSelector`, extend
  `normalizeRawAnnotations` for the flat `html_tag` wire shape, and change
  annotation-merge semantics to key on `target.selector.id` when `index` is
  absent.
- `server-chunk-assembler`: `apply-chunk.server.ts` normalizes and persists
  `delta.custom_fields.annotations` into `custom_content.annotations`
  instead of dropping them.
- `citation-marker`: `AnnotationGroup` gains `groupKey`; add a
  grouping/placement path keyed by `cit` id (one pill per tag) alongside the
  existing source-URL grouping; injection supports tag-based placement, not
  only character-offset sentinels.
- `quotations-citation-markdown`: the citation-aware markdown hook gains a
  tag-parsing path that strips `<cit id>` tags (including ones split across
  streaming chunks or left unmatched) and injects markers at tag positions.
- `citation-card`: `useCitationCard` / `CitationCardContext` key state on
  `groupKey` instead of `sourceUrl`.

## Impact

- `libs/chat-shared/src/models/annotation.ts` — new `HtmlTagSelector` type.
- `libs/quotations/src/utils/annotation.ts` — dual-shape normalization.
- `libs/quotations/src/utils/group-annotations-by-source.ts` — `groupKey`
  field; new cit-id grouping function.
- `libs/quotations/src/utils/citation-injection.ts` — tag-based injection
  alongside offset-based sentinels.
- `libs/quotations/src/utils/useAnnotations.ts`,
  `libs/quotations/src/utils/useCitationCard.ts`,
  `libs/quotations/src/context/CitationCardContext.tsx`,
  `libs/quotations/src/components/CitationDropdown/CitationDropdown.tsx` —
  `groupKey`-based state, streaming-aware annotation resolution.
- `libs/chat-hooks/src/conversation/useConversationStream/apply-chunk.ts` —
  merge-by-`target.selector.id` fallback.
- `apps/chat-api/src/conversations/utils/apply-chunk.server.ts`,
  `apps/chat-api/src/conversations/dto/annotation.dto.ts` — persist
  `custom_fields.annotations`, extend the DTO for the new selector/source
  shape.
- `libs/quotations/README.md`, `openspec/specs/message-annotations/spec.md`,
  `openspec/specs/citation-marker/spec.md`,
  `openspec/specs/quotations-citation-markdown/spec.md`,
  `openspec/specs/citation-card/spec.md`,
  `openspec/specs/server-chunk-assembler/spec.md` — doc/spec updates in the
  same change.
- No new dependency, no env var, no feature flag.
