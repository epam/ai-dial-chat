# Tasks: no-panel-auto-collapse

## 1. Implementation

- [x] 1.1 Drop `closePanel()` from `useAttachmentCanvasResolvers`' `onBeforeOpen`, `ConversationView`'s MCP app `onBeforeOpen`, and the `isCanvasOpen` effect in `useConversationPanelRouteState`.
- [x] 1.2 Stop `togglePanel` from closing the canvas; remove the no-toggle recovery effect and the `isToggleEnabled` parameter.
- [x] 1.3 Reserve the desktop sidebar's width in the canvas's `usePanelMaxWidth` bound (`getNavigationSidebarWidth`).

## 2. Specs and docs

- [x] 2.1 Update `navigation-sidebar`, `canvas`, and `mcp-app-trigger` main specs and `docs/architecture.md`.

## 3. Gates

- [x] 3.1 Unit tests: `useConversationPanelRouteState`, new `useAttachmentCanvasResolvers`, `canvas-width`, and the full `@epam/chat` suite.
- [x] 3.2 `typecheck`, `lint`, `npm run validate:specs`, `npm run validate:docs`.
