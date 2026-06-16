## 1. Library — Types and Models (`libs/conversation-panel`)

- [x] 1.1 Add `ConversationMove` interface to `libs/conversation-panel/src/models/ConversationPanel.ts`:
  ```ts
  interface ConversationMove {
    draggedId: string;
    targetGroupKey: ConversationGroupKey;
    afterId: string | null;
  }
  ```
- [x] 1.2 Add `onMoveConversation?: (move: ConversationMove) => void` to `ConversationPanelProps` in `libs/conversation-panel/src/models/ConversationPanel.ts`
- [x] 1.3 Extend `RowRendererData` in `libs/conversation-panel/src/models/virtual-row.ts` with:
  `draggingId`, `dragOverId`, `allowedDropGroups`, `onDragStart`, `onDragEnd`, `onDragOver`, `onDragLeave`, `onDrop`

## 2. Library — Drag Utilities (`libs/conversation-panel`)

- [x] 2.1 Create `libs/conversation-panel/src/utils/drag.ts` with pure helpers:
  - `findGroupKeyForItem(rows: VirtualRow[], id: string): ConversationGroupKey | null`
  - `computeAllowedDropGroups(draggedId, draggingGroupKey, conversations)` — encodes category rules
  - `getDropAfterId(e, itemId, rows, targetGroupKey)` — computes afterId from cursor position
- [x] 2.2 Create `libs/conversation-panel/src/utils/tests/drag.spec.ts` with unit tests covering: same-group drop, cross-group drop, pin from MyChats, pin from Organization, unpin to matching source, unpin to wrong source

## 3. Library — Drag State and Handlers in `ConversationPanel`

- [x] 3.1 Add `draggingId: string | null`, `dragOverId: string | null`, and `allowedDropGroups` state to `ConversationPanel.tsx` via `useState`
- [x] 3.2 Add five stable handlers in `ConversationPanel` with `useCallback`:
  - `handleDragStart(id, rows)` — calls `findGroupKeyForItem`, `computeAllowedDropGroups`, sets state + refs
  - `handleDragEnd()` — clears all drag state
  - `handleDragOver(id)` — sets `dragOverId`
  - `handleDragLeave()` — clears `dragOverId`
  - `handleDrop(targetId, targetGroupKey, afterId)` — validates via `allowedDropGroupsRef`, calls `onMoveConversation`, clears state
- [x] 3.3 Pass `draggingId`, `dragOverId`, `allowedDropGroups`, and all five handlers into the react-window `List` via `itemData`

## 4. Library — Draggable `ConversationRow`

- [x] 4.1 In `ConversationRow.tsx`, add optional drag props: `rowGroupKey`, `rows`, `draggingId`, `dragOverId`, `allowedDropGroups`, `onDragStart`, `onDragEnd`, `onDragOver`, `onDragLeave`, `onDrop`
- [x] 4.2 Add `draggable` attribute to the root `<li>` element (conditional on `rowGroupKey` being present)
- [x] 4.3 Bind native drag events on the root element
- [x] 4.4 Compute `afterId` on drop via `getDropAfterId(e, item.id, rows, rowGroupKey)`
- [x] 4.5 Apply visual feedback classes conditionally:
  - `item.id === draggingId` → `opacity-50 cursor-grabbing`
  - `item.id === dragOverId && isDropAllowed` → `ring-1 ring-inset ring-accent-secondary`
  - `draggingId != null && !isDragging && !isDropAllowed` → `cursor-not-allowed`

## 5. Library — Pinned Group Header as Drop Zone

- [x] 5.1 In `ConversationGroupHeader.tsx`, add optional props: `dropZoneGroupKey`, `isDragOver`, `onDragOver`, `onDragLeave`, `onDrop`
- [x] 5.2 Bind drag events on the Pinned header only when `dropZoneGroupKey` is set
- [x] 5.3 Apply `ring-1 ring-inset ring-accent-secondary` to the Pinned header root when `isDragOver === true`
- [x] 5.4 In `RowRenderer.tsx`, pass the Pinned-header drag props from `itemData` when rendering a `Header` row with `groupKey === ConversationGroupKey.Pinned`

## 6. Library — Thread Props via `RowRenderer`

- [x] 6.1 In `RowRenderer.tsx`, destructure `draggingId`, `dragOverId`, `allowedDropGroups`, `onDragStart`, `onDragEnd`, `onDragOver`, `onDragLeave`, `onDrop` from `itemData` and forward them to `ConversationRow` and (for Pinned) `ConversationGroupHeader`

## 7. Library — Build and Lint Verification

- [x] 7.1 Run `npm exec nx build @epam/ai-dial-conversation-panel` — zero TypeScript or Vite errors ✓
- [x] 7.2 Run `npm exec nx lint @epam/ai-dial-conversation-panel` — zero lint errors ✓
- [x] 7.3 Run `npm exec nx test @epam/ai-dial-conversation-panel` — 50 tests pass ✓

## 8. App — Wire `onMoveConversation` in `ConversationPanelView`

- [x] 8.1 In `ConversationPanelView.tsx`, implement `handleMoveConversation`:
  - `targetGroupKey === Pinned` → `pinConversation(contextId, true)`
  - Item is pinned and `targetGroupKey !== Pinned` → `pinConversation(contextId, false)`
  - Same-group reorder → no-op (no reorder API available in this iteration)
- [x] 8.2 Pass `onMoveConversation={handleMoveConversation}` to `ConversationPanel`
- [x] 8.3 Run `npm exec nx build @epam/chat` — zero errors ✓

## 9. Manual Verification

- [x] 9.1 Drag a conversation row within My Chats — it dims; hovering over another My Chats row shows a ring; releasing reorders it correctly
- [x] 9.2 Drag a My Chats conversation onto the Pinned section header — the header highlights; releasing pins the item and it appears at the top of Pinned
- [x] 9.3 Drag a My Chats conversation onto an existing pinned item — it is pinned and inserted after the target item
- [x] 9.4 Drag a pinned conversation onto a My Chats item whose source is MyChats — it is unpinned and inserted at that position
- [x] 9.5 Drag a pinned Organization conversation and attempt to drop it into My Chats — cursor shows `cursor-not-allowed`, no ring on target, drop is rejected
- [x] 9.6 Drag a My Chats conversation and attempt to drop it into Organization — cursor shows `cursor-not-allowed`, no ring on target, drop is rejected
- [x] 9.7 Drop a row onto itself — no state change, no callback
- [x] 9.8 Scroll the list while dragging via keyboard scrolling — drag state does not flicker when new rows mount
- [x] 9.9 Drag a conversation row and release outside the panel — `dragend` fires, dim and ring clear, no state change
