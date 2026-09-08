## Context

The prior change (`support-cit-html-tag-annotations`, archived) shipped
`<cit id="…">` citation rendering as a pure string-transform: strip/replace
the tag via regex before `react-markdown` ever saw it, because `rehypeRaw`
wasn't in the shared `MarkdownRenderer` pipeline at the time. Two external
facts changed since:

1. `libs/chat-shared`'s `MarkdownRenderer` now runs `rehypeRaw` (parses raw
   HTML text into real hast elements) followed by `rehypeSanitize`
   (strips anything not on an allowlist) — see `baseRehypePlugins`.
2. The Core-side `dial-document-annotations` deployment now emits a **paired**
   tag, `<cit id="…"></cit>`, instead of the original void-style
   `<cit id="…">`.

This makes "register a real `cit` react-markdown component" viable, which
the original design doc had already flagged as the alternative to sentinel
rewriting. This design grounds that alternative in three concrete,
empirically-verified findings (a throwaway unified/remark-rehype/rehype-raw/
rehype-sanitize script, not committed, run directly against this repo's
installed package versions) rather than assumption.

## Goals / Non-Goals

**Goals:**

- Render `<cit>` as a real element via the host's existing markdown pipeline,
  removing the tag-specific regex/index-mapping machinery from
  `citation-injection.ts`.
- Never lose or hide message text that isn't part of a citation tag, at any
  point during streaming.
- Never let a raw `user-content-`-mangled or literal `<cit …>` tag reach the
  screen.

**Non-Goals:**

- Restoring mid-stream pill visibility for `html_tag` citations. Explicitly
  traded away (see Decision 3) in favor of eliminating a real content-loss
  bug; revisit only if Core ever guarantees atomic open+close delivery
  within a single chunk (not the case today).
- Any change to the JSON annotation contract, backend persistence, or the
  `attachment_index`/`pdf_region` citation family — all untouched.
- Building a generic `rehypePlugins`/sanitize-schema extension point through
  `MessageBubble`/`MDMessageViewer` (see Decision 2 for why this was
  considered and rejected for now).

## Decisions

### 1. Attribute name: `data-id`, not `id`

Verified empirically: rendering `<cit id="e438"></cit>` through
`rehypeSanitize`'s `defaultSchema` produces `<cit id="user-content-e438">` —
`hast-util-sanitize`'s default `clobber: ['id', 'name']` +
`clobberPrefix: 'user-content-'` rewrites both attributes on **every**
element to prevent DOM-clobbering attacks (a named element shadowing a
`window`/`document` property). `data-*` attributes are exempt from this
rewrite.

**Decision**: the wire tag uses `data-id`, and `HtmlTagSelector.id` (the JSON
annotation field, unrelated to the markup attribute name) is matched against
the tag's `data-id` value, not the DOM `id`.

**Alternative rejected**: set `clobberPrefix: ''` on the schema to disable
the rewrite globally. Rejected — this is a security mitigation for *every*
piece of content `MarkdownRenderer` renders across the whole app (headings,
inline HTML from any model), not something this feature should turn off
schema-wide for a single tag's convenience.

### 2. Sanitize-schema extension lives in `libs/chat-shared`, not a new prop

Traced the full render chain
(`ConversationMessageItem` → `MessageBubble` → `AssistantMessageBubble` →
`MDMessageViewer` → `MarkdownRenderer`): `rehypePlugins` is not forwarded at
any layer — `MDMessageViewerProps`/`AssistantMessageBubbleProps` don't even
declare it. Building a real extension point means adding a prop through two
more libs (`conversation-messages`, `chat-shared`) just to let one specific
tag through a sanitizer that runs *inside* `MarkdownRenderer`, before any
prop-supplied `rehypePlugins` would even execute (`rehypePlugins` prop plugins
run **after** `baseRehypePlugins`, so they can't un-strip what sanitize
already removed — confirmed by reading the component's tail).

**Decision**: extend `baseRehypePlugins`'s sanitize schema directly in
`chat-shared`, adding `cit`/`dataId` next to the existing MathML-tag
extension — the same file already hardcodes one feature's tag allowlist
(KaTeX's MathML output) for the identical reason (nothing else can reach the
schema before sanitize runs). Also add `cit: () => null` to
`defaultMarkdownComponents` so a `MarkdownRenderer` consumer that doesn't
supply its own `cit` override (every consumer other than the assistant
message path) never shows an unstyled custom element or a React "unrecognized
tag" console warning for one.

**Alternative rejected**: thread a `sanitizeSchemaExtension`/`rehypePlugins`
prop through `MDMessageViewer`/`MessageBubble`. Rejected for now — three-plus
files across two libs for one tag, with no second consumer in sight to
justify the generality. Revisit if a second lib ever needs the same kind of
extension.

### 3. No mid-stream pill visibility — hide every `<cit>` tag while streaming

Verified empirically: feeding
`'…criteria<cit data-id="e438">and more streamed text'` (open tag complete,
no closing tag yet — exactly the state mid-stream, before `</cit>` has
arrived) through `rehype-raw` produces
`<cit data-id="e438">and more streamed text</cit>` — parse5 doesn't know
`cit` as a void element, so it keeps consuming input as the element's
children until it finds `</cit>` or hits end-of-input. Since the `cit`
component only renders its own marker (never `children`), **all of "and more
streamed text" disappears from the rendered output** until the closing tag
streams in. This can happen even though the model always closes the tag
immediately — an SSE chunk boundary is unrelated to token/tag boundaries.

**Decision**: `useAnnotations` reverts to unconditional `[]` while streaming
(no `html_tag` carve-out); `stripCitTagsWhileStreaming` removes every
complete `<cit>…</cit>` pair and truncates the string at any remaining
dangling `<cit` (open tag with no closing tag found after it) before the
content ever reaches `react-markdown`. A pill for a `<cit>` citation appears
only once the message finishes streaming — the same rule every other
citation family already followed before this feature existed.

**Alternative rejected**: keep mid-stream visibility, guarded by a
"don't reveal past a dangling open tag" buffer (hold back rendering
everything from an unclosed `<cit` onward, re-attempt each re-render as more
of the stream arrives). Rejected — it reintroduces exactly the
kind of custom streaming-buffer logic this migration set out to remove, for
a UX benefit (an offset-based-family pill already doesn't get during
streaming either) that isn't worth the risk of getting the buffering subtly
wrong.

## Risks / Trade-offs

- **[Trade-off] `html_tag` citations no longer appear mid-stream** — accepted
  per Decision 3; matches the `text_character_range` family's existing
  behavior, so this is a narrowing to consistency, not a new inconsistency.
- **[Risk] `stripCitTagsWhileStreaming`'s dangling-tag truncation is
  content-lossy for the remainder of the CURRENT render** — by design (it's
  re-computed on every render as `content` grows, so the hidden suffix
  reappears once the closing tag streams in); a reader who reads unusually
  fast might perceive a very brief pause in text growth right at a citation
  boundary. Accepted — the alternative (showing the raw tag or losing text
  permanently) is strictly worse.
- **[Risk] Hardcoding `cit`/`dataId` into `chat-shared`'s shared sanitize
  schema is scope creep for a "shared, generic" lib** — mitigated by
  following the exact precedent (MathML) the file already established, and
  by the `defaultMarkdownComponents.cit: () => null` fallback keeping the
  behavior harmless for every non-citation consumer.

## Migration Plan

Purely additive/behavioral — no data migration. `isStreaming` is a new
required-position parameter on `useCitationMarkdownComponents`; its one
caller (`ConversationMessageItem`) is updated in the same change. Rollback is
a plain revert; no persisted data is affected (the JSON annotation contract
is untouched).

## Open Questions

None — the wire-format change (paired tag) was confirmed as already
delivered by the Core side before this design was written, and all three
technical risks were verified empirically rather than left as assumptions.
