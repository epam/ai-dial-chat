## 1. Shared infrastructure

- [x] 1.1 Reuse existing `useLocalStorage` hook at `apps/chat/src/hooks/useLocalStorage.ts`
- [x] 1.2 Add `ConversationSourcesWidth = 'conversationSourcesWidth'` and `ConversationPanelWidth = 'conversationPanelWidth'` to `StorageKey` enum in `apps/chat/src/constants/storage.ts`
- [x] 1.3 Create `apps/chat/src/hooks/use-viewport-width.ts` — subscribes to `window` resize events and returns `window.innerWidth`

## 2. `SidebarPanel` lib — resize props + internal container

- [x] 2.1 Add `resizable?`, `defaultWidth?`, `minWidth?`, `maxWidth?`, `onResizeStop?` to `SidebarPanelProps` in `libs/sidebar/src/models/SidebarPanel.ts`
- [x] 2.2 Import `DialConditionalResizableContainer` and `ResizableContainerSide` in `SidebarPanel.tsx`; derive `resizableSide` from `side`; wrap root div with `DialConditionalResizableContainer`; `enabled={(resizable ?? false) && isOpen}`

## 3. `ConversationSourcesPanel` app wiring

- [x] 3.1 ~~`ResizableSidebarPanel` wrapper~~ — removed; `ConversationSourcesPanel` uses `SidebarPanel` directly
- [x] 3.2 Add `useIsMobile` + `useViewportWidth` + `useLocalStorage(StorageKey.ConversationSourcesWidth, 360)` inline in `ConversationSourcesPanel`; pass `resizable`, `defaultWidth`, `minWidth`, `maxWidth`, `onResizeStop` to `SidebarPanel`; remove `w-[360px]` fixed-width className

## 4. `ConversationPanel` lib — resize prop forwarding

- [x] 4.1 Add `resizable?`, `defaultPanelWidth?`, `minPanelWidth?`, `maxPanelWidth?`, `onPanelResizeStop?` to `ConversationPanelProps`
- [x] 4.2 Forward resize props from `ConversationPanel` to `SidebarPanel`; keep `w-[325px]` in className only when `!resizable`

## 5. `ConversationPanelView` app wiring

- [x] 5.1 Add `useViewportWidth` + `useLocalStorage(StorageKey.ConversationPanelWidth, 325)` in `ConversationPanelView.tsx`
- [x] 5.2 Pass `resizable={!isMobile}`, `defaultPanelWidth`, `minPanelWidth={312}`, `maxPanelWidth`, `onPanelResizeStop` to `ConversationPanel`

## 6. Verification

- [x] 6.1 Run `npm exec nx lint chat` — zero new errors
- [x] 6.2 Run `npm exec nx typecheck chat` — zero new type errors
- [ ] 6.3 Manually verify: open both panels, drag handles, reload — each panel restores to saved width
- [ ] 6.4 Manually verify: collapse a panel — resize handle disappears
- [ ] 6.5 Manually verify: on mobile viewport — no resize handles, panels are full-width
- [ ] 6.6 Manually verify: dragging beyond min/max bounds clamps correctly
- [ ] 6.7 Visually verify: no double background between `DialConditionalResizableContainer` inner div and `SidebarPanel` `<aside>`
