# chat-hooks-viewport-layout Specification

## Purpose

Reusable browser-viewport and layout hooks exported by `@epam/ai-dial-chat-hooks`: whole-page file-drag detection and viewport-width-driven panel max-width derivation.

## Requirements

### Requirement: Whole-page file-drag detection hook

`@epam/ai-dial-chat-hooks` SHALL export `usePageFileDrag` (from the package
root and from the `@epam/ai-dial-chat-hooks/viewport-layout` subpath, which
is the one `apps/chat` imports), a headless hook
that detects files being dragged over the page (using `document`-level drag
events only, with an enter/leave counter to avoid flicker from child-element
boundary crossings) and exposes the dragged files once dropped. The hook
SHALL depend only on React and standard browser DOM events — no app context,
no i18n, no UI-kit component.

The hook SHALL accept two optional parameters, `isAttachmentsAllowed` and
`isEnabled` (both boolean, default `true`): `isEnabled` gates whether drag
state is tracked at all, and `isAttachmentsAllowed` gates whether dropped
files are collected into `pendingFiles`. It SHALL return `{ isDragging, pendingFiles, onFilesConsumed
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
- **THEN** the hook still tracks `isDragging` exactly as in the default case
  (and still calls `preventDefault` on the drop), but dropped files are NOT
  added to `pendingFiles`, which stays empty

### Requirement: Viewport-width-driven panel max-width hooks

`@epam/ai-dial-chat-hooks` SHALL export (from the root and the
`viewport-layout` subpath) `useViewportWidth`, returning the current
`window.innerWidth` (falling back to `1024` when `window` is undefined) and
updating on the browser `resize` event, and
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
- **THEN** the returned max width is `Math.max(0, viewportWidth - 400)` —
  never exceeding `viewportWidth - 400` and never negative — which is what
  `apps/chat` gets at each call site (`app.tsx`, `ConversationSourcesPanel`)
  by passing its shared `MIN_CONTENT_AREA_WIDTH = 400` constant from
  `apps/chat/src/constants/layout.ts`
