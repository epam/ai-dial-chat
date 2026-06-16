## Context

DIAL Core auto-shares cited files from `custom_content.annotations[].body.source.attachment` (PR #1560). The chat app does not yet parse or render annotations. This design covers the frontend-only work needed to display inline citation markers and a citation popup in the assistant message bubble.

## Goals / Non-Goals

**Goals:**
- Parse `custom_content.annotations[]` from completed and streaming assistant messages.
- Render an inline citation marker button after each cited text span (driven by `target.selector.text_character_range`).
- Group annotations by source attachment URL; show a single marker per group with an overflow count.
- Open a popup on marker click: source name + `<N/M>` switcher, title, quoted text, "Preview" and "Open in browser" footer buttons.
- Wire "Preview" to the existing attachment-open flow and "Open in browser" to `window.open`.
- Handle gracefully: missing `body`, missing `source`, missing `target.selector`, or out-of-range character indices.

**Non-Goals:**
- PDF region / bounding-box highlighting (pdf-highlighter-kit) — deferred.
- Image BBox or mask overlay — deferred.
- Request-side (user message) annotation rendering — deferred.
- Annotation persistence round-trip validation — Core already passes annotations through unchanged.
- Feature flag / `ENABLED_FEATURES` gating — citations are rendered whenever annotations are present; no explicit flag needed in this slice.

## Decisions

### D1 — Annotation types live in `libs/chat-shared`

**Decision**: Define `Annotation`, `AnnotationTarget`, `AnnotationBody`, and selector variant interfaces in `libs/chat-shared/src/models/annotation.ts`; extend the existing `Message` interface with `custom_content.annotations?: Annotation[]`.

**Rationale**: `libs/chat-shared` already holds the `Message` interface and all other DIAL wire-format types. Annotation types carry no host-specific knowledge (no API paths, no app context), so they belong here. Components and hooks in `apps/chat` import the types through the `@epam/ai-dial-chat-shared/*` alias.

**Alternative considered**: Collocating types in `apps/chat/src/types/` — rejected because `libs/conversation-messages` needs the same types to render citation markers inside message bubbles, and cross-app imports are prohibited.

### D2 — Streaming delta accumulation via `useAnnotations` hook in `apps/chat`

**Decision**: Accumulate annotation deltas (streaming) in `apps/chat/src/hooks/annotations/useAnnotations.ts`. The hook merges partial `delta.custom_content.annotations[]` items by `index` field on each streaming chunk and exposes the final `Annotation[]` once streaming completes (or the full array for completed messages).

**Rationale**: Streaming handling is app-level concern (tied to the SSE/fetch stream already managed in `apps/chat`). Keeping accumulation logic in a hook makes it testable without UI.

**Alternative considered**: Accumulating inside the message store — rejected because message storage is read-only from the rendering perspective; mutation would couple rendering to storage logic.

### D3 — Citation marker injected into markdown rendered output via post-processing

**Decision**: After the markdown-to-HTML render step, walk the rendered `<p>` / `<span>` text nodes and inject `<CitationMarker>` React portals at the character offsets specified by `target.selector`. Use a `dangerouslySetInnerHTML`-free approach: render markdown to a React tree, then use a custom `rehype` plugin (or a React post-processor) that splits text nodes at the citation character boundaries and inserts a React component island.

**Rationale**: The existing markdown renderer (likely `react-markdown` or similar) already accepts rehype plugins. A rehype plugin runs after HTML is generated but before React hydration, giving deterministic character-level split points without touching the raw markdown string.

**Alternative considered**: String-splicing the raw markdown before rendering — rejected because markdown syntax interacts with character offsets in unpredictable ways (e.g. a citation range that spans a `**bold**` marker would corrupt the AST).

### D4 — Popup implemented as a controlled `Popover` anchored to the marker button

**Decision**: Use the UI kit `Popover` (or equivalent positioning primitive) positioned relative to the `<CitationMarker>` button. The popup is a standalone `CitationPopup` component that receives the annotation group as props.

**Rationale**: The UI kit already provides accessible, focus-managed popovers. Building on it avoids reimplementing z-index stacking, keyboard dismissal, and focus trapping.

### D5 — Grouping by source attachment URL, marker label from URL hostname

**Decision**: Group annotations by `body.source.attachment.url`. The marker label is derived from the hostname of the attachment URL (e.g. `files.dial.example.com` → strip to a human-readable source name if resolvable, otherwise use a truncated URL). The overflow count is `(groupSize - 1)` shown as `+N`.

**Rationale**: Multiple annotations can cite the same document at different locations; one marker per document is less noisy. URL hostname is the only stable identifier present in all cases (no guaranteed `title` on the source).

**Alternative considered**: One marker per annotation — rejected as too noisy for responses with many citations to the same document.

## Risks / Trade-offs

- **Streaming character-offset drift**: If the model streams partial UTF-16 code units, accumulated text length may temporarily not match the final `end` index. Mitigation: only render citation markers after streaming completes (show no markers during streaming).
- **Rehype plugin complexity**: Splitting text nodes at arbitrary character offsets inside a rehype AST is non-trivial when the cited span crosses element boundaries (e.g., `<strong>` tags). Mitigation: clamp markers to the nearest word boundary if the exact offset falls inside a non-text node; log a console warning.
- **`body.source` is optional**: Some annotations carry no attachment (pure annotations). Mitigation: skip rendering a marker for annotations without `body.source.attachment.url`; still accumulate and store them for potential future use.
- **RTL**: Citation marker buttons use logical Tailwind spacing (`ms-*`, `me-*`). The popup layout uses CSS logical properties (`padding-inline-start`, `border-inline-end`). The switcher `<1/2>` arrows must be mirrored in RTL (use `rtl:scale-x-[-1]` on chevron icons).

## Migration Plan

No data migration. Annotations in existing conversation history are passed through by Core unchanged — if absent, markers simply never render. The change is purely additive.

## Open Questions

- **Source name resolution**: Should we try to resolve a human-readable source name from the attachment URL (e.g. by parsing the DIAL file path to extract an original filename), or always use the hostname? — Defer to implementation; use filename from URL path as a first attempt, fallback to hostname.
- **"Preview" action for non-image/non-PDF files**: Should we open a download or inline preview? — Reuse the existing `AttachmentCard` click handler which already handles this per content type.
