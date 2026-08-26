# chat-hooks-viewport-layout Specification

## Purpose

Reusable browser-viewport and layout hooks exported by `@epam/ai-dial-chat-hooks`: whole-page file-drag detection and viewport-width-driven panel max-width derivation.

## Requirements

### Requirement: Whole-page file-drag detection hook

`@epam/ai-dial-chat-hooks` SHALL export `usePageFileDrag`, a headless hook
that detects files being dragged over the page (using `document`-level drag
events only, with an enter/leave counter to avoid flicker from child-element
boundary crossings) and exposes the dragged files once dropped. The hook
SHALL depend only on React and standard browser DOM events — no app context,
no i18n, no UI-kit component.

The hook SHALL accept two optional parameters, `isAttachmentsAllowed` and
`isEnabled` (both boolean, default `true`), gating whether drag state is
tracked at all, and SHALL return `{ isDragging, pendingFiles, onFilesConsumed
}`, where `onFilesConsumed` clears `pendingFiles` after the caller has
processed them.

#### Scenario: Files dragged and dropped while enabled

- **WHEN** a consumer renders `usePageFileDrag()` with default parameters and
  the user drags one or more files over the document and drops them
- **THEN** `isDragging` becomes `true` while the drag is over the page and
  `false` again after drop, and `pendingFiles` contains the dropped `File`
  objects until `onFilesConsumed` is called

#### Scenario: Drag detection disabled

- **WHEN** a consumer renders `usePageFileDrag(true, false)`
- **THEN** `isDragging` stays `false` and `pendingFiles` stays empty
  regardless of drag/drop activity on the page

#### Scenario: Attachments not allowed

- **WHEN** a consumer renders `usePageFileDrag(false)`
- **THEN** the hook still reports the same `isDragging`/`pendingFiles`
  behavior as the default case; gating on `isAttachmentsAllowed` for whether
  to act on dropped files is the caller's responsibility, not the hook's

### Requirement: Viewport-width-driven panel max-width hooks

`@epam/ai-dial-chat-hooks` SHALL export `useViewportWidth`, returning the
current `window.innerWidth` and updating on the browser `resize` event, and
`usePanelMaxWidth`, which derives a side-panel's maximum width from the
current viewport width and a caller-supplied minimum content-area width. Both
hooks SHALL depend only on React and standard browser APIs.

`usePanelMaxWidth` SHALL accept `minContentAreaWidth: number` as a required
parameter — the library SHALL NOT hardcode this value internally; the
consuming application supplies its own layout budget.

#### Scenario: Viewport width tracked across resize

- **WHEN** a consumer renders `useViewportWidth()` and the browser window is
  resized
- **THEN** the returned number updates to the new `window.innerWidth` value

#### Scenario: Panel max width leaves room for the minimum content area

- **WHEN** a consumer renders `usePanelMaxWidth(400)` at a given viewport
  width
- **THEN** the returned max width never exceeds `viewportWidth - 400`,
  reproducing the same math `apps/chat`'s inlined `MIN_CONTENT_AREA_WIDTH =
  400` constant currently produces at each of its call sites
