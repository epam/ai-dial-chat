## Why

Opening Preview from a chat `<cit data-id="..."></cit>` citation must open the referenced PDF page. The first implementation added page-only navigation before PR #8560 introduced native `html_tag` citations. After merging development, the viewer plumbing remains useful, but raw frontend/backend normalization drops `body.selector`, the backend DTO omits it, and the canvas mapper assumes each source URL identifies one citation group.

The user also reports an intermittent jump from the requested page back to page 1. The wrapper's default-page effect ignored explicit page requests. Separately, the installed viewer asynchronously restores its current page during auto zoom; that potential race remains under investigation.

## What Changes

- Preserve `target.selector` (marker identity) and `body.selector` (PDF location) independently through normalization, stream assembly, validation, and serialization.
- Retain supplied annotation indexes so multiple entries behind one `cit` ID remain distinct.
- Keep `PdfCanvasContent.page` → `PdfContent.selectedPageNumber` → `DocumentPreview.selectedPageNumber`.
- Select the citation group by membership of the exact clicked annotation, then include only that annotation's document in highlights. Keep the existing mapper signature.
- Extract the first positive integer PDF page, tolerate malformed selector entries, and omit unusable highlights/selection IDs.
- Prevent the page-1 fallback when an explicit page is supplied.
- Regenerate the OpenAPI client after adding optional object-or-array `AnnotationBodyDto.selector`.

## Capabilities

### Modified Capabilities

- `canvas`: PDF page navigation, selection identity, and safe fallback.
- `message-annotations`: preservation of document selectors and indexes.
- `server-chunk-assembler`: PDF selector persistence for raw and normalized annotations.

## Impact

Code: `libs/quotations/src/utils/annotation.ts`, `libs/chat-hooks/src/files/attachment-canvas.ts`, `libs/attachment-canvas/src/{models,types,components}/`, `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`, and backend annotation DTO/assembly utilities.

Library isolation: quotations handles data shapes; chat-hooks maps annotations using host-injected URL resolvers; attachment-canvas receives a resolved page. Backend normalization remains server-local.

API: optional selector on existing conversation message bodies/responses; no endpoint, authorization, rate-limit, or cache changes. Generated artifacts come from the repository OpenAPI commands.

i18n/RTL: no new text or layout. Existing keyboard-accessible Preview actions remain intact. No diagnostic logging or analytics is added.

## Acceptance Criteria

- Page 1 and page 3 citations work with zero-area or valid non-zero bounding boxes.
- Different cit IDs for one PDF, and a single cit group containing multiple PDFs, use the clicked annotation's document/page/highlights.
- Raw and persisted annotations retain page data; later quote-only deltas do not erase it.
- Missing/invalid pages and malformed selector entries do not crash preview.
- Explicit page-only requests are not overridden by the wrapper's default-page effect.
- Legacy annotations, non-PDF previews, and normal PDF opens remain compatible.

## Non-goals

No new viewer, citation UI, endpoints, feature flags, telemetry, or document-title parsing. No edits to installed third-party packages. Do not claim the intermittent vendor auto-zoom race is resolved solely because mocked component tests pass.

## Alternatives and Rollback

Reuse explicit page navigation and exact annotation membership rather than changing marker grouping or synthesizing highlight geometry. This keeps existing callers compatible. Rollback removes the added behavior; already stored selector fields remain additive data. Previously discarded page metadata cannot be reconstructed.
