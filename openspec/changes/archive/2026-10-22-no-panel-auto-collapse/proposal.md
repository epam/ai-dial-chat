# Proposal: no-panel-auto-collapse

## Why

Opening a file preview, or any other content in the attachment canvas, collapsed the navigation sidebar (the chat list) without the user asking, and the user had to expand it again by hand ([#9409](https://github.com/epam/ai-dial-chat/issues/9409)). Expanding the sidebar in turn closed the canvas. A panel should change state only when the user asks for it.

## What Changes

- Opening the attachment canvas or an MCP app canvas no longer collapses the navigation sidebar, from any call site: `useAttachmentCanvasResolvers`' `onBeforeOpen`, `ConversationView`'s MCP app `onBeforeOpen`, and the `isCanvasOpen` effect in `useConversationPanelRouteState` no longer call `closePanel()`.
- Expanding the sidebar no longer closes the canvas (`togglePanel` no longer calls `onCloseCanvas()`).
- The "return to the initial state when the canvas closes" rule for `conversations-panel-toggle` off is removed, together with the hook's `isToggleEnabled` parameter: nothing collapses the sidebar any more, so there is nothing to recover from.
- The canvas's maximum (and so default) width now reserves the desktop sidebar's current width (336px expanded, 72px collapsed), so the chat area keeps its 400px minimum with both panels open; the canvas re-targets its width when the user toggles the sidebar.
- Unchanged: the canvas and the sources panel still replace each other, since both occupy the end edge; the canvas still closes on navigation; the mobile drawer still closes after a chat is chosen.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `navigation-sidebar`: only the user's toggle changes the sidebar after its initial state; the canvas neither collapses it nor is closed by expanding it.
- `canvas` (main spec edited in place, Layout bullets): the sidebar/canvas mutual exclusion is replaced by side-by-side layout with a sidebar-aware width bound; `onBeforeOpen` only closes the sources panel.
- `mcp-app-trigger` (main spec edited in place, step 2): `ConversationView`'s `onBeforeOpen` only closes the sources panel.

## Impact

- `apps/chat` — `useConversationPanelRouteState`, `useAttachmentCanvasResolvers`, `ConversationView`, `app.tsx`, `utils/canvas-width.ts`, `constants/layout.ts`, and their specs.
- No lib, API, dependency, i18n, or feature-flag changes.
