## Why

Opening a conversation can freeze the browser when Prism processes a Markdown-labelled tool response containing a 175,052-character base64 line. Collapsed stages also mount their Markdown content before the user opens them.

## What Changes

- Apply one shared highlighting eligibility check to Markdown code blocks and code attachments: at most 50,000 UTF-16 code units overall and 2,000 per line.
- Render complete plain text above either limit, preserving copy/download and language labels.
- Mount stage details and grouped stages only while expanded.

## Capabilities

### New Capabilities

- `bounded-syntax-highlighting`: resource limits for synchronous highlighting and deferred stage content rendering.

### Modified Capabilities

- `stage-visualization`: details mount only while open and unmount immediately on close.
- `attachment-canvas-code-viewer`: oversized input uses the existing plain-text fallback.

## Impact

Touches `chat-shared`, `attachment-canvas`, and `conversation-stages`. Follow existing plain-text fallbacks in `libs/chat-shared/src/components/MarkdownRenderer/CodeBlock/CodeBlock.tsx:117` and `libs/attachment-canvas/src/components/CodeContent/CodeContent.tsx:75`. Only caller-provided text is inspected; no host integration enters libraries. No dependencies, application providers, endpoints, feature flags, or translated strings change.

## Non-goals

Workers, grammar replacement, payload rewriting, truncation, streaming behavior changes, and a guarantee against every pathological input below the limits are excluded. Limits are a pragmatic first slice; workers remain a separate follow-up.

## Acceptance criteria

Both highlighting entry points bypass Prism above either threshold, retain the exact text, and still highlight ordinary input. Closed stages/groups have no mounted details; opening, closing, reopening, and streaming completion behave correctly. Regression fixtures contain synthetic text only.

## Alternatives and compatibility

Changing Markdown labels fixes only one payload; grammar patches fix only one pattern. Shared limits and conditional mounting address the agreed scope with no dependency changes. Existing props and saved conversations remain compatible; collapse resets nested disclosure state. Reverting this change restores eager rendering and unlimited highlighting.
