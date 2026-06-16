## Context

The conversation panel renders rows with react-window (virtualised list). Drag-and-drop must work despite rows being created and destroyed as the user scrolls. The panel has four collapsible groups (`ConversationGroupKey`: Pinned, MyChats, Shared, Organization). Pinned is a cross-category overlay — an item from any source can be pinned. The first iteration delivers complete functional drag-and-drop: reorder within a group, pin by dragging to Pinned, and unpin by dragging from Pinned back to the item's source group.

## Goals / Non-Goals

**Goals:**
- `ConversationRow` is draggable; dragging produces visible feedback (dim + highlight for valid targets, dim + `cursor-not-allowed` for invalid targets).
- Drag state (`draggingId`, `draggingGroupKey`, `dragOverId`) is stable across virtual list recycling.
- Dropping within the same group reorders the item.
- Dropping from any non-Pinned group onto the Pinned section pins the item.
- Dropping from Pinned onto a non-Pinned group unpins the item (allowed only when item's `source` matches the target group).
- Cross-category drops (e.g. MyChats → Organization) are blocked with visual feedback and produce no state change.
- `onMoveConversation(move: ConversationMove)` is called with `draggedId`, `targetGroupKey`, and `afterId` on every valid drop.
- The app wires `onMoveConversation` to dispatch reorder/pin/unpin actions this iteration.
- Zero new npm dependencies.

**Non-Goals:**
- No folder support — folder ids as drag targets are a follow-up change.
- No touch or keyboard drag (native HTML5 DnD only; accessibility follow-up deferred).
- No animated drag ghost — the browser's default ghost is used.
- No drag-and-drop sorting animation.

## Decisions

### 1. Native HTML5 Drag and Drop API over a DnD library

Three options were evaluated:

| | Native HTML5 DnD | @dnd-kit | pragmatic-drag-and-drop |
|---|---|---|---|
| **New dependency** | None | `@dnd-kit/core` + `@dnd-kit/sortable` | `@atlaskit/pragmatic-drag-and-drop` |
| **Virtual list support** | Native — state above the list is enough | `DndContext` must wrap the list; `@dnd-kit/sortable` clashes with react-window's dynamic row creation without a custom collision strategy | Works well with virtual lists; state management is manual |
| **Visual feedback** | Manual CSS (class toggles) | Built-in `DragOverlay`; smooth drag ghost | Manual |
| **Existing codebase pattern** | Matches `libs/conversation-input` (uses `dragenter`/`dragover`/`drop` via react-dropzone) | New paradigm | New paradigm |
| **Keyboard/touch DnD** | Not supported natively | Built-in sensors | Plugin-based |
| **Bundle cost** | 0 KB | ~12 KB gzipped | ~6 KB gzipped |

**Decision:** Native HTML5 DnD. The required feedback needs only a few CSS class toggles — no library abstracts away enough complexity to justify the bundle cost or the react-window integration friction. The approach is consistent with `libs/conversation-input`. If keyboard/touch accessibility becomes a requirement before folders land, @dnd-kit can replace this layer without changing the `onMoveConversation` callback contract.

### 2. Drag state lives in `ConversationPanel`, not in `ConversationRow`

react-window creates and destroys row DOM nodes as the user scrolls. State stored inside `ConversationRow` is lost when the row scrolls off-screen. Because `draggingId` must survive the dragged row scrolling out of the viewport, and `dragOverId` must correctly highlight a row that may have just been freshly mounted, both values must live above the list.

**Decision:** `ConversationPanel` owns three `useState<string | null>` / `useState<ConversationGroupKey | null>` values:
- `draggingId` — id of the item currently being dragged
- `draggingGroupKey` — the group the dragged item belongs to (set on drag start by looking up the item in the virtual rows array)
- `dragOverId` — id of the item (or group header sentinel) currently under the cursor

All three are passed into the react-window `List` via the existing `itemData` object. `RowRenderer` destructs them and forwards them to `ConversationRow` and `ConversationGroupHeader`.

**Alternative considered:** A React context scoped to the panel. Rejected because itemData already threads per-row data; adding a context for three values would introduce a provider solely to avoid prop drilling one extra level.

### 3. Drag event handlers defined in `ConversationPanel`, passed as callbacks via `itemData`

Defining event handlers inline inside `RowRenderer` (which is recreated per render) would cause react-window to remount every visible row on each drag-state change. Instead, stable handler references are created once in `ConversationPanel` with `useCallback` and included in `itemData`.

**Decision:** Five stable callbacks in `ConversationPanel`:

```ts
const handleDragStart = useCallback((id: string) => {
  const groupKey = findGroupKeyForItem(rows, id);
  setDraggingId(id);
  setDraggingGroupKey(groupKey);
}, [rows]);

const handleDragEnd   = useCallback(() => {
  setDraggingId(null);
  setDraggingGroupKey(null);
  setDragOverId(null);
}, []);

const handleDragOver  = useCallback((id: string) => setDragOverId(id), []);
const handleDragLeave = useCallback(() => setDragOverId(null), []);

const handleDrop = useCallback((targetId: string, targetGroupKey: ConversationGroupKey, afterId: string | null) => {
  if (draggingId != null && isDropAllowed(draggingId, draggingGroupKey, targetGroupKey, conversations)) {
    onMoveConversation?.({ draggedId: draggingId, targetGroupKey, afterId });
  }
  setDraggingId(null);
  setDraggingGroupKey(null);
  setDragOverId(null);
}, [draggingId, draggingGroupKey, onMoveConversation, conversations]);
```

`findGroupKeyForItem(rows, id)` iterates the flat virtual rows array to find the last `Header` row before the given item — this is already the source of truth for grouping. `isDropAllowed` encodes the category rules (see Decision 6).

**`itemData` shape extension:**

```ts
interface RowRendererData {
  // …existing fields…
  draggingId: string | null;
  draggingGroupKey: ConversationGroupKey | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (id: string) => void;
  onDragLeave: () => void;
  onDrop: (targetId: string, targetGroupKey: ConversationGroupKey, afterId: string | null) => void;
}
```

### 4. Visual feedback via Tailwind utility classes

Three conditions drive classes:

| Condition | Classes applied | Where |
|---|---|---|
| `item.id === draggingId` | `opacity-50 cursor-grabbing` | `ConversationRow` root |
| `item.id === dragOverId` and drop is valid | `ring-1 ring-inset ring-accent-secondary` | `ConversationRow` root |
| Cursor is over a drop target and drop is **not** valid | `cursor-not-allowed` | `ConversationRow` root |
| Group header `groupKey === dragOverId` (Pinned header) | `ring-1 ring-inset ring-accent-secondary` | `ConversationGroupHeader` root |

"Drop is valid" is evaluated using `isDropAllowed` (see Decision 6). The `cursor-not-allowed` class is applied when `draggingId != null && !isDropAllowed(...)` on the hovered row.

**Alternative considered:** A CSS `outline` instead of a ring. Rejected because `outline` does not respect `border-radius` on older Chrome versions and the ring utility matches the existing UI kit's focus-ring pattern.

### 5. `onMoveConversation` callback with a `ConversationMove` parameter

The lib defines a structured parameter object so the app has enough information to execute pin, unpin, or reorder without re-implementing group-membership logic.

```ts
/** Describes a completed drag-and-drop move in the conversation panel. */
interface ConversationMove {
  /** Id of the conversation that was dragged. */
  draggedId: string;
  /** The group the item was dropped into. */
  targetGroupKey: ConversationGroupKey;
  /**
   * Id of the item the dragged conversation should be placed after.
   * `null` means the item was dropped at the top of the target group.
   */
  afterId: string | null;
}

interface ConversationPanelProps {
  // …existing…
  onMoveConversation?: (move: ConversationMove) => void;
}
```

The app can derive the action type:
- `targetGroupKey === ConversationGroupKey.Pinned` → pin the item (and position it after `afterId` in the pinned list)
- Item was previously pinned (`isPinned === true`) and `targetGroupKey !== Pinned` → unpin the item (position it after `afterId` in its source group)
- Otherwise → reorder within the same group

**Rejected: separate `onPin` / `onUnpin` / `onReorder` callbacks** — more props with overlapping concerns; the app can infer intent from `targetGroupKey` without splitting the surface.

**Rejected: passing only `(draggedId, droppedOnId)`** — insufficient; the app needs the target group and position to dispatch the correct action. `droppedOnId` alone does not distinguish "drop at top of group" or "drop onto group header".

### 6. Category validation in the lib

The lib enforces drop validity before calling `onMoveConversation`. This keeps the rule in one place and provides consistent visual feedback without requiring the app to define it.

```ts
const isDropAllowed = (
  draggingId: string,
  draggingGroupKey: ConversationGroupKey | null,
  targetGroupKey: ConversationGroupKey,
  conversations: ConversationHistoryItem[],
): boolean => {
  if (draggingGroupKey === targetGroupKey) return true; // same group — always ok
  if (targetGroupKey === ConversationGroupKey.Pinned) return true; // pinning — always ok
  if (draggingGroupKey === ConversationGroupKey.Pinned) {
    // unpinning — only ok if item's source matches target group
    const item = conversations.find(c => c.id === draggingId);
    const sourceGroupKey = sourceToGroupKey(item?.source);
    return sourceGroupKey === targetGroupKey;
  }
  return false; // cross-category (e.g. MyChats → Organization)
};
```

`sourceToGroupKey` maps `ConversationSource` → `ConversationGroupKey` (trivial one-to-one mapping).

**Alternative considered:** Leaving validation entirely to the app via a `canDrop?: (draggedId, targetGroupKey) => boolean` prop. Rejected because the visual feedback (ring vs. no-ring, cursor-not-allowed) is rendered by the lib — the lib would need to call the prop synchronously on every `dragover` event (60+ times per second), coupling the app to a hot path, and duplicating the rule in every consumer.

### 7. Pinned group header as a drop zone

Dropping onto the Pinned header is equivalent to dropping at the top of the Pinned list (`afterId: null`). Only the Pinned header is a drop target — My Chats / Shared / Organization headers are not, because moving into those groups from Pinned requires an item-level drop (so `afterId` can be set).

**Decision:** `ConversationGroupHeader` receives the same `onDragOver`, `onDragLeave`, and `onDrop` props as `ConversationRow`, but only when `groupKey === ConversationGroupKey.Pinned`. Other headers ignore drag events. The Pinned header uses its own `groupKey` string as the `dragOverId` sentinel (not an item id), so the ring renders on the header without affecting item rows.

```ts
// Inside ConversationGroupHeader (Pinned only):
onDragOver={(e) => { e.preventDefault(); props.onDragOver(ConversationGroupKey.Pinned); }}
onDrop={(e) => { e.preventDefault(); props.onDrop(ConversationGroupKey.Pinned, ConversationGroupKey.Pinned, null); }}
```

### 8. `e.preventDefault()` on `dragover` to enable drop

By default, browsers do not allow drops on arbitrary elements. `e.preventDefault()` on the `dragover` event signals acceptance and enables the `drop` event.

**Decision:** Both `ConversationRow` and the Pinned `ConversationGroupHeader` call `e.preventDefault()` inside their native `onDragOver` handler. No `dataTransfer` payload is set on `dragstart` — the dragged id is tracked in React state and serialising it to `dataTransfer` would be redundant.

### 9. No-op guard on drop

The `handleDrop` callback in `ConversationPanel` checks `draggingId !== null` and `isDropAllowed(...)` before calling `onMoveConversation`. Dropping onto the same item, dropping after a stale `dragend`, or cross-category drops are silently ignored.

## Risks / Trade-offs

- **[Trade-off] No touch or keyboard drag** — native HTML5 DnD does not work on mobile touch screens and provides no keyboard interaction. Acceptable for V1; if touch is needed, @dnd-kit can be adopted in a follow-up without changing the `onMoveConversation` contract.
- **[Trade-off] No animated drag ghost** — the browser renders a default drag image. A custom ghost would require `e.dataTransfer.setDragImage`. Deferred: the default ghost is sufficient to communicate intent.
- **[Risk] `dragLeave` fires on child element boundaries** — when the cursor moves from a row's parent div to a child span, the parent fires `dragLeave` then immediately `dragEnter`, causing a brief flicker. Mitigation: check `e.relatedTarget` and skip the clear if the related target is still a descendant of the row element (or debounce with a 0 ms timeout). This is a polish task and does not block functionality.
- **[Trade-off] `itemData` shape grows** — adding five handler references and three state values to `itemData` increases the object passed to every row. The values are stable references (`useCallback`/`useState`), so react-window will not re-render rows unnecessarily.
- **[Trade-off] Category validation is in the lib** — the lib owns a rule that is arguably business logic. The benefit is consistent visual feedback without app coupling; the cost is that if the rules change (e.g. Shared becomes a separate category with its own pin behaviour), the lib must be updated.
