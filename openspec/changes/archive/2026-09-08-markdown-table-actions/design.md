## Context

The current shared `MarkdownTable` renders one semantic table in a horizontally scrollable, overflow-aware container. Its header cells already use sticky positioning, but the container has no vertical height bound, so that behavior is dormant. `MarkdownCodeBlock` already provides the repository's host-agnostic action pattern: application-supplied labels, generic clipboard/download utilities, current UI-kit controls, and an accessible copied-status region.

The previous application table exposed the desired CSV/TXT/Markdown copy and CSV download behavior, but it split the header into a second hidden table and manually synchronized scroll position and column widths. That implementation also depended on application i18n, application utilities, and an application-owned filename modal, so it cannot be copied directly into `libs/chat-shared`.

## Goals / Non-Goals

**Goals:**

- Restore useful table copy and CSV download behavior for assistant messages.
- Preserve one semantic table and avoid manual split-table width synchronization.
- Activate vertical scrolling and the existing sticky header.
- Keep all host-owned localization outside `libs/chat-shared`.
- Meet current accessibility, RTL, UI-kit, and icon-stroke conventions.

**Non-Goals:**

- No filename-editing modal.
- No backend endpoint, generated API client change, telemetry, caching, or feature flag.
- No rich-text or inline-formatting preservation in copied table cells.
- No global enablement of table actions in every `MarkdownRenderer` consumer.
- No editable spreadsheet, table-specific canvas renderer, or preservation of source-only Markdown formatting in the expanded view.

## Decisions

### D1 — Keep one semantic table

Keep the existing single `<table>` and add a bounded vertical scroll container so the already-present sticky header operates normally. This preserves table semantics, removes the old two-table DOM and width/scroll synchronization, and avoids duplicating the header for assistive technology.

Alternative considered: port the old split header/body tables. That would require manual column-width measurement, `ResizeObserver`, scroll synchronization, and an aria-hidden duplicate table. It is more complex and less semantic.

### D2 — Enable actions by supplied labels, not globally

Add an optional `MarkdownTableActionLabels` contract to `MarkdownTable`, `MarkdownRenderer`, and `MDMessageViewer`. Presence of the labels enables the action bar. Only the assistant message path supplies them.

Alternative considered: enable actions by default in `MarkdownRenderer`. This was rejected because the same renderer is used by catalog details, source panels, scheduled tasks, and attachment canvas; those surfaces did not previously expose table actions.

### D3 — Keep host integration at the application edge

The application resolves translated strings and passes them through the existing assistant-message label chain. The shared component receives only strings and an optional filename. It does not import `useTranslation`, application locale files, application modals, or application file utilities.

Proposed public shape:

```ts
enum MarkdownTableCopyFormat {
  Csv = 'csv',
  Txt = 'txt',
  Markdown = 'markdown',
}

interface MarkdownTableActionLabels {
  copyCsvLabel: string;
  copyTxtLabel: string;
  copyMarkdownLabel: string;
  copiedLabel: string;
  downloadCsvLabel: string;
  openInCanvasLabel?: string;
}
```

`MarkdownTable` also accepts an optional `downloadFilename`, defaulting to `table.csv`. `AssistantMessageBubbleLabels` forwards `tableActionLabels`, `tableDownloadFilename`, and `tableScrollRegionAriaLabel` to `MDMessageViewer`.

### D4 — Serialize from the rendered table

Use the existing table element reference to collect header and body rows, trim each cell's text content, and serialize the rows. This matches the old behavior and keeps a single source of truth: what the user sees is what is copied.

CSV quotes non-empty values and doubles embedded quotes. TXT joins cells with tabs. Markdown emits a pipe table and a left-aligned separator. Rich inline formatting is intentionally flattened. Markdown column alignment is not preserved because the current renderer does not render source alignment into header cells.

Alternative considered: serialize the original Markdown source. That would require threading source markdown through the component map and would copy content that may no longer match the rendered table after sanitization.

### D5 — Use direct CSV download

Call the existing generic text-file download utility with `text/csv;charset=utf-8`, a UTF-8 byte-order mark, and `table.csv` by default. This matches the current code-block download interaction and avoids adding a modal to the shared library.

Alternative considered: port the old filename modal. That would add a second UI surface, more labels, and more accessibility work without being necessary for the primary export behavior. It can be a separate change if product requires it.

### D6 — Keep action state local and memo-friendly

The active copied format and reset timeout are local to `MarkdownTable`; no context or global state is introduced. Timeout cleanup runs on unmount and when another format is copied.

`MarkdownTable` remains memoized. `MarkdownRenderer` continues to memoize its component map and includes the table label/action dependencies in that memo. The application builds the `tableActionLabels` object with a stable reference so `MDMessageViewer` does not needlessly re-render.

### D7 — Follow the current action and RTL conventions

Use the 2.0 `GhostIconButton`, `Tooltip`, `DIAL_KIT_ICON_STROKE`, Tabler icons with `aria-hidden`, stable `aria-label` values, and a `role="status" aria-live="polite"` copied region. Each tooltip uses the same localized string as its button's accessible name and is applied with `asChild` so `aria-describedby` lands on the control rather than a wrapper. Use logical CSS classes and the existing RTL-aware overflow masks. CSV, TXT, Markdown, check, and download icons have no inherent left/right direction and are not mirrored.

### D8 — Localization and operational scope

The application adds `buttons.copyAsCsv`, `buttons.copyAsTxt`, and `buttons.downloadAsCsv`, and uses existing `buttons.copyAsMarkdown`, `buttons.copied`, plus `chat.scrollableTable`. There is no HTTP endpoint, generated-client impact, rate limit, cache, analytics event, or feature flag.

### D9 — Reusable header lives in `chat-shared`, used directly

`@epam/ai-dial-chat-shared` exports a generic `TableHeader` with optional leading `children` and caller-supplied `{ label, icon, onClick }` action descriptors. `TableHeader` owns the UI-kit button, tooltip, accessible name, and decorative-icon wrapper, so `MarkdownTable` does not build buttons from scratch. `MarkdownTable` renders `TableHeader` directly and automatically whenever `actionLabels` is supplied — there is no header-renderer prop and no host-supplied action-descriptor escape hatch. Every consumer (assistant messages, and any future `MarkdownRenderer` caller that opts in via `tableActionLabels`) gets the same header with the same built-in actions; a host cannot inject extra actions of its own.

This is a revision of the original plan, which put `TableHeader` in `@epam/ai-dial-conversation-messages` behind a header-renderer indirection to avoid a dependency cycle (`conversation-messages` already depends on `chat-shared`). That indirection was removed during implementation: the host (assistant messages) never needed custom actions beyond the built-in set, so the renderer prop and `AssistantMessageBubble.tableHeaderActions` were dead flexibility. Keeping `TableHeader` in `chat-shared` — the same package as `MarkdownTable` — avoids the cycle just as well, without a customization API nothing uses.

### D10 — Expand tables through a host callback

`MarkdownTable` accepts an optional `onOpenInCanvas(markdown: string)` callback. When that callback and `openInCanvasLabel` are both supplied, it adds an Open in Canvas action to the existing table header. Activation serializes the current rendered table with the existing Markdown serializer and passes that Markdown to the callback. The callback does not receive DOM nodes, application state, or canvas types.

`MarkdownRenderer`, `MDMessageViewer`, and `AssistantMessageBubble` forward the optional callback unchanged. At the application edge, `ConversationMessageItem.tsx` supplies a memoized callback which calls `useAttachmentCanvas().openCanvas` with a `MarkdownCanvasContent` payload and a translated table title. The existing attachment-canvas `MarkdownRenderer` displays the payload, so no new canvas content type or canvas renderer is needed.

This makes the canvas show only the selected table rather than the full assistant message. It deliberately uses the visible-table serialization already defined in D4: cell text is preserved, while inline formatting, source alignment, and non-rendered source syntax are not.

Alternative considered: import `@epam/ai-dial-attachment-canvas` directly in `chat-shared`. This is rejected because it reverses the existing dependency direction and embeds host canvas integration in a shared library. Alternative considered: pass the entire assistant Markdown message to canvas. This is rejected because it does not satisfy the requirement to enlarge one table and would make multiple tables ambiguous.

### D11 — Canvas action labels and interaction

The application supplies `buttons.openInCanvas` for the header button and `chat.markdownTableTitle` for the canvas header. The action uses the same UI-kit icon-button, tooltip, stable accessible name, and decorative-icon treatment as the existing table actions. It remains hidden during streaming because the table header is hidden during streaming. The selected table is opened synchronously from already-rendered content, so no loading, error, endpoint, telemetry, cache, rate-limit, or feature-flag behavior is added.

## Risks / Trade-offs

- [Rendered-cell serialization loses inline formatting] → Accept and test the plain-text contract; this matches the old behavior and avoids copying unsanitized source Markdown.
- [Clipboard permissions can fail] → Use the existing clipboard utility with its fallback; show copied feedback only after the utility reports success.
- [Sticky table headers have browser-specific edge cases] → Cover vertical scrolling in component tests and keep the implementation on the existing sticky header cells rather than introducing a new layout mechanism.
- [A nested label object can defeat memoization] → Require a stable application-side object and include it in the renderer's memo dependencies.
- [The default `table.csv` filename can collide] → Allow a host-supplied filename; filename editing remains a separate product decision.
- [Rendered-table expansion loses source-only formatting] → Reuse the explicitly documented copy-as-Markdown serialization contract and show only the user-visible table.

## Migration Plan

1. Add optional shared-library props and behavior; no existing caller is required to change.
2. Add the new i18n keys and pass labels and the canvas callback only from the assistant message path.
3. Update `libs/chat-shared/README.md` and `libs/conversation-messages/README.md` for the new public props, labels, and host callback.
4. Rollback is limited to removing the optional props, application labels, and tests; no data or API migration is involved.

## Open Questions

None.
