## Context

Prism runs synchronously after its lazy import resolves. Both MarkdownCodeBlock and CodeContent already provide full plain-text fallbacks. StageItem, StageGroupRow, and CollapsedGroup hide mounted children using grid rows. The user approved the bounded synchronous slice, excluding workers.

## Goals / Non-Goals

Protect both highlighter entry points from oversized input and avoid parsing closed stage content. Preserve complete source text, labels, styling, and copy/download behavior. No workers, new dependencies, source rewriting, payload truncation, or streaming policy changes.

## Decisions

- Add a pure `isSyntaxHighlightingAllowed(text)` utility in chat-shared, exported for attachment-canvas. Count UTF-16 code units using string length and an early-exit linear scan; recognize LF, CRLF, and CR line boundaries. Permit up to 50,000 total and 2,000 per line, inclusively. Use memoization keyed by text in both components; invoke the existing plain fallback when rejected. These limits are heuristics, not execution deadlines.
- Reuse existing rendering fallbacks rather than introducing a new component or worker abstraction. The shared utility receives text only; all host contracts remain outside these libraries.
- Conditional children at all three disclosure levels ensure collapsed details do not parse, render, or expose focusable controls. Keep disclosure wrappers, use stable `aria-controls` ids and `inert` while closed. Closing unmounts content immediately and resets nested disclosure state; reopening renders current props. This trades the prior closing animation for immediate removal of work and focusable descendants.
- Existing stage state remains local. Existing default-open streaming groups and completion auto-collapse remain. No locale, RTL, breakpoint, endpoint, feature flag, telemetry, or persistence changes. Existing logical classes and code direction remain.
- A regex patch or auto-detecting JSON would cover only this payload. A worker provides stronger isolation but is explicitly deferred. Do not infer a universal responsiveness guarantee from these bounds.

## Risks / Trade-offs

- Valid large code loses syntax colors, but text and actions remain intact.
- Pathological shorter inputs can still block; worker isolation is a separate follow-up.
- Full plain text can still incur browser layout costs. This slice does not virtualize or truncate content.
- Tests that assumed hidden content exists must now exercise disclosure before reading it.

## Migration Plan

Ship library source, exports, tests, and READMEs together. No data migration. Revert this change to restore prior rendering behavior.

## Open Questions

None for this slice. Threshold tuning and workers remain future work.
