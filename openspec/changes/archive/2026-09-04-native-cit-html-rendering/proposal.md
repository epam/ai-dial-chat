## Why

`support-cit-html-tag-annotations` (archived 2026-09-02) rendered DIAL Core's
`<cit id="…">` citations by regex-stripping the tag out of the raw markdown
string and substituting a Unicode sentinel, because at the time
`react-markdown` had no way to parse arbitrary raw HTML into real elements —
`rehypeRaw` wasn't wired into the shared `MarkdownRenderer`. That has since
landed (`fix: add rehypeRaw/rehypeSanitize plugins to render HTML inside
markdown`, #8612, merged into `development`), and the Core-side deployment
has been changed to emit a paired tag (`<cit data-id="…"></cit>`) instead of
the original void-style one. Both changes make it possible — and simpler —
to render `<cit>` as a real HTML element with a registered `react-markdown`
component instead of maintaining a parallel regex/sentinel pipeline.

Empirically verifying the naive version of this approach (a throwaway
unified/remark-rehype script, not committed) surfaced two real correctness
risks that this proposal's design must account for, not just replace one
mechanism with another:

1. `rehype-sanitize`'s default schema rewrites `id`/`name` attributes to
   `user-content-…` (DOM-clobbering protection) — a citation's id would be
   mangled unless carried on a `data-*` attribute instead.
2. `cit` is not a recognized HTML void element, so if an SSE chunk boundary
   lands between a tag's `<cit data-id="…">` open and its `</cit>` close, an
   HTML parser (`parse5`, via `rehype-raw`) treats every character streamed
   in after the open tag — up to that point — as the element's content. Since
   the citation component doesn't render `children`, that text silently
   disappears from the message until the closing tag arrives.

## What Changes

- **BREAKING (internal, lib-only)**: `useCitationMarkdownComponents`'s
  signature gains an `isStreaming` parameter (before `isCompactTypography`).
- Register a `cit` `react-markdown` component (in
  `useCitationMarkdownComponents`) that looks up its `AnnotationGroup` by the
  tag's `data-id` and renders the existing `CitationDropdown` — or `null` for
  an id with no matching group. This replaces the previous regex-based
  tag-to-sentinel substitution (`CIT_TAG_RE`, the id→index map, and the
  matched/unmatched replacement pass) for the `html_tag` selector family.
  `injectCitationSentinels` goes back to handling only offset-based
  (`text_character_range`) groups, unchanged from before that feature.
- Extend the shared `rehype-sanitize` allowlist in
  `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`
  (`baseRehypePlugins`, alongside the existing MathML-tag extension) with the
  `cit` tag name and its `dataId` attribute, and add a `cit: () => null`
  default to `defaultMarkdownComponents` so any `MarkdownRenderer` consumer
  that doesn't provide its own `cit` override still hides the tag silently
  instead of showing an unstyled custom element.
- **Reverts the "show `html_tag` citations mid-stream" behavior** from the
  prior change: `useAnnotations` goes back to returning `[]` unconditionally
  while streaming, for every selector family. `stripCitTagsWhileStreaming`
  (new, in `libs/quotations/src/utils/citation-injection.ts`) hides every
  `<cit>` tag — complete or with a still-arriving closing tag — from
  `processedContent` while `isStreaming` is `true`, so a tag split across an
  SSE chunk boundary can never cause the parser-swallowing regression above.
  A `<cit>` pill therefore only appears once the message finishes streaming,
  matching every other citation family — this is a deliberate UX narrowing
  versus the prior change's mid-stream visibility, traded for eliminating a
  real content-loss bug.
- No change to the JSON annotation contract: `HtmlTagSelector.id` (in
  `libs/chat-shared/src/models/annotation.ts`), the backend
  `normalizeRawAnnotationsServer`/`mergeAnnotations`
  (`apps/chat-api/src/conversations/utils/apply-chunk-annotations.server.ts`),
  the client `apply-chunk.ts` merge, and `groupAnnotationsByCitId`/
  `groupAnnotations` are all untouched — the migration is scoped entirely to
  how the markup tag gets parsed and rendered, not to the annotation JSON
  DIAL Core sends alongside it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `message-annotations`: `useAnnotations`'s streaming behavior reverts to
  unconditional `[]` for every selector family (removes the `html_tag`
  carve-out added by the prior change).
- `citation-marker`: `<cit>` tags are parsed as real HTML elements and
  rendered via a registered `cit` component (looked up by `data-id`) instead
  of a regex/sentinel substitution pass; `useAnnotations`'s streaming
  behavior reverts (see above); offset-based sentinel injection
  (`injectCitationSentinels`) no longer handles `html_tag` tag-matching.
- `quotations-citation-markdown`: the citation-aware markdown hook gains an
  `isStreaming` parameter and a `cit` component override; the
  "unmatched/incomplete tag" defensive requirement moves from string-level
  regex handling to the `cit` component's own null-render plus the new
  streaming-only `stripCitTagsWhileStreaming` guard.

## Impact

- `libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx`
  — new `isStreaming` param, `cit` component override.
- `libs/quotations/src/utils/citation-injection.ts` — removes tag-matching
  regex machinery; adds `stripCitTagsWhileStreaming`; `injectCitationSentinels`
  reverts to offset-only (still skips `html_tag` groups so their index stays
  correct in the shared `groups` array).
- `libs/quotations/src/utils/useAnnotations.ts` — reverts the streaming
  carve-out.
- `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx` —
  extends `baseRehypePlugins`'s sanitize schema (`cit`/`dataId`) and
  `defaultMarkdownComponents` (`cit: () => null` default).
- `libs/chat-shared/src/models/annotation.ts` — doc comment only (`<cit
  data-id="…"></cit>` example, matching the new wire format).
- `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` —
  passes `isStreaming` into `useCitationMarkdownComponents`.
- `libs/quotations/README.md` — usage/behavior updates for the above.
- No backend change, no DTO change, no OpenAPI regeneration needed.
