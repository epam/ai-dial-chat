## Why

DIAL Core (PR #1560) now auto-shares cited files attached to assistant annotations, making citation data accessible to the chat client. The chat UI currently ignores `custom_content.annotations[]` entirely, so users never see which parts of the assistant's response are grounded in source documents.

## What Changes

- Parse `custom_content.annotations[]` from assistant messages (streaming delta accumulation included).
- Render an inline citation marker button (e.g. "Wikipedia +1") after each cited text span, positioned using `target.selector` character-range offsets.
- Open an extended inline popup on marker click: source name + citation switcher in the header, title and quoted text in the body, and "Preview" / "Open in browser" buttons in the footer.
- Group annotations that share the same source attachment URL so one marker can represent multiple citations with a `<1/2>` navigation switcher.
- Wire the "Preview" action to open the attachment file inline and the "Open in browser" action to navigate to the source URL.

## Capabilities

### New Capabilities

- `message-annotations`: Parsing, accumulation, and typed representation of `custom_content.annotations[]` on assistant messages, including streaming delta merging and graceful handling of annotations without a source attachment.
- `citation-marker`: Inline citation marker button rendered inside the assistant message bubble, positioned after the cited text span, showing the primary source name and an overflow count for additional sources at the same location.
- `citation-popup`: Extended tooltip-style popup triggered by the citation marker, displaying source name, citation switcher, title, quoted text, and footer action buttons ("Preview" and "Open in browser").

### Modified Capabilities

- `attachment-response-display`: Citation "Preview" reuses the same open-attachment flow already implemented here; the spec needs a delta to document the new entry point (citation popup footer button).

## Impact

- **apps/chat** — new components under `src/components/Citations/`; updates to the assistant message renderer to inject citation markers into rendered markdown; new hook(s) for annotation state.
- **libs/chat-shared** — new TypeScript interfaces for `Annotation`, `AnnotationTarget`, `AnnotationBody`, and their selector variants.
- **No backend changes** — Core already handles file sharing; no new REST endpoints required.
- **Dependencies** — no new packages; UI kit `Button` and `Tooltip`/`Popover` primitives cover the popup.
