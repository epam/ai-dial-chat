## Why

The conversation panel supports multiple categories of conversations (My Chats, Shared, Organization) and a cross-category Pinned section. Users need a way to reorder conversations within a category and to pin or unpin conversations by dragging. This change delivers the full first iteration of drag-and-drop: visual feedback, category-aware drop validation, reordering within a group, and pin/unpin via drag to or from the Pinned section.

## What Changes

- **Draggable conversation rows** — each `ConversationRow` becomes `draggable`. Drag events produce visible feedback: the dragged row dims to `opacity-50`; a valid drop target receives a highlight ring; an invalid cross-category target shows a `cursor-not-allowed` indicator with no ring.
- **Drag state in `ConversationPanel`** — `draggingId`, `draggingGroupKey`, and `dragOverId` are lifted to the panel level and threaded down to rows via `itemData` so that react-window's virtual rendering does not lose state when rows are recycled.
- **Category-aware drop validation** — the lib computes whether a drop is allowed before calling the callback. Drops within the same group are always allowed. Drops from any non-Pinned group into Pinned are allowed (pin action). Drops from Pinned into a non-Pinned group are allowed only when the dragged item's `source` matches that group (unpin action). All other cross-group drops are silently rejected with visual feedback.
- **Pinned group header as a drop zone** — dragging a conversation over the Pinned section header allows dropping it at the top of the Pinned list.
- **`onMoveConversation` callback** — `ConversationPanelProps` gains `onMoveConversation?: (move: ConversationMove) => void`. `ConversationMove` carries `draggedId`, `targetGroupKey`, and `afterId` (the id of the item the dragged item should be placed after, or `null` for the top of the group). The app uses this to execute reorder, pin, or unpin logic.
- **App wiring** — `ConversationPanelView` in `apps/chat` wires `onMoveConversation` to dispatch the appropriate Redux action (reorder, pin, or unpin) based on `targetGroupKey`.

## Capabilities

### New Capabilities

- `conversation-drag`: Grab any conversation row and drag it. The dragged item dims; a valid drop target highlights. Releasing the mouse reorders the item within its group, pins it (drop onto Pinned), or unpins it (drag out of Pinned to its source group). Cross-category drops (e.g. My Chats → Organization) are blocked with visual feedback and produce no state change.

### Modified Capabilities

- `conversation-panel`: `ConversationPanelProps` gains `onMoveConversation?: (move: ConversationMove) => void`. No breaking change — existing consumers are unaffected by the optional prop.

## Impact

- **`libs/conversation-panel`**: `ConversationPanelProps` gains the optional `onMoveConversation` callback. A new `ConversationMove` interface is added to the models. `ConversationPanel` owns `draggingId` / `draggingGroupKey` / `dragOverId` state and passes drag handlers + state through `itemData`. `ConversationRow` becomes `draggable` and renders drag-state and validity classes. `ConversationGroupHeader` (Pinned only) gains drop-zone behaviour. No new dependencies.
- **`apps/chat`**: `ConversationPanelView` wires `onMoveConversation` to dispatch reorder/pin/unpin actions.
- **No breaking changes** — the new prop is optional and all drag state is internal.
