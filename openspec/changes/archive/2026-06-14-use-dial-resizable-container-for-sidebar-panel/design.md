## Context

Both panels rendered at fixed widths: `ConversationSourcesPanel` at `w-[360px]` and `ConversationPanel` at `w-[325px]`. `DialConditionalResizableContainer` from `@epam/ai-dial-ui-kit` provides a drag handle, uncontrolled width management, and `onResizeStop`. The key architectural question was where to own the container — inside `SidebarPanel`, outside it in each caller, or in a dedicated wrapper.

## Goals / Non-Goals

**Goals:**
- Both panels support drag-to-resize with persisted width.
- Resize handle is hidden when a panel is collapsed or on mobile.
- `SidebarPanel` itself becomes the natural unit of resize — callers pass props, no wrapping required.
- `ResizableSidebarPanel` app wrapper provides a one-stop component for panels that need `localStorage` persistence.

**Non-Goals:**
- Adding `localStorage` management to any lib component.
- Modifying resize behavior for panels that do not opt in via `resizable=true`.

## Decisions

### 1. `DialConditionalResizableContainer` lives inside `SidebarPanel`

`SidebarPanel` (in `libs/sidebar`) accepts optional resize props and uses `DialConditionalResizableContainer` as its outermost wrapper. When `resizable` is false (default), the container renders children directly — no behavior change for existing callers.

**Why:** `SidebarPanel` is the unit that owns panel width (its root div has `transition-[width]` and accepts a `className` for width). Putting the resize container here avoids every caller having to wrap it, keeps the API symmetrical with `isOpen`/`side`, and requires zero changes to call sites that don't need resize.

**Alternative considered:** Each caller wraps with `DialConditionalResizableContainer`. Rejected — duplicates resize logic at every call site and leaks the container's `side` ↔ `SidebarSide` mapping responsibility to callers.

**Alternative considered:** App-level `ResizableSidebarPanel` wraps and controls the container externally. Rejected — `SidebarPanel`'s root div has its own `transition-[width]`; the external container and the inner fixed-width `className` interact poorly without lib changes anyway.

### 2. Resize handle side derived from `side` prop

Inside `SidebarPanel`: `resizableSide = side === SidebarSide.Right ? ResizableContainerSide.Left : ResizableContainerSide.Right`.

**Why:** The handle must always be on the inner edge (toward the chat area), which is the opposite of where the panel is anchored. Deriving it from `side` removes the need for callers to know about `ResizableContainerSide`.

### 3. Each app panel owns its own `localStorage` + viewport width logic

`ConversationSourcesPanel` calls `useLocalStorage`, `useViewportWidth`, and `useIsMobile` directly and passes the computed resize props to `SidebarPanel`. `ConversationPanelView` does the same for `ConversationPanel`.

**Why:** `localStorage` and viewport width are host-owned concerns that libs must not manage. Inline logic was preferred over a shared `ResizableSidebarPanel` wrapper because the two panels have different component hierarchies (`ConversationSourcesPanel` is a flat app component; `ConversationPanel` is a lib wrapped by `ConversationPanelView`). A shared wrapper offered no structural benefit and introduced an extra indirection layer that obscured the data flow. Keeping the logic inline in each panel's entry point makes the ownership explicit and avoids forwarding prop chains.

### 4. `ConversationPanel` lib passes resize props through to `SidebarPanel`

`ConversationPanel` accepts `resizable`, `defaultPanelWidth`, `minPanelWidth`, `maxPanelWidth`, `onPanelResizeStop` and forwards them to `SidebarPanel`. Width storage and viewport computation are in `ConversationPanelView` (app).

**Why:** `ConversationPanel` owns `SidebarPanel` internally — callers cannot reach inside it. Adding pass-through props is the minimal change that unlocks resize without violating isolation.

### 5. Resize disabled when collapsed

`enabled={(resizable ?? false) && isOpen}` inside `SidebarPanel`. The handle is never visible on a zero-width panel.

### 6. Dynamic max width: 50% of viewport

`maxWidth = Math.floor(window.innerWidth * 0.5)` via `useViewportWidth`. Stored values are clamped to current bounds on load.

### 7. `localStorage` keys scoped per panel

| Panel | Key |
|---|---|
| `ConversationSourcesPanel` | `conversationSourcesWidth` |
| `ConversationPanel` | `conversationPanelWidth` |

Both are members of the `StorageKey` enum in `apps/chat/src/constants/storage.ts`.

## Risks / Trade-offs

- **`SidebarPanel` now conditionally renders a ui-kit component** → `@epam/ai-dial-ui-kit` was already a peer dependency of `libs/sidebar` (`DialGhostIconButton`); no new dep.
- **`DialConditionalResizableContainer` inner div adds bg/divide styles** → `SidebarPanel`'s `<aside>` has its own CSS-variable background; verify the two layers don't produce a double background in the verify step.
- **Stored width stale after viewport resize** → `maxWidth` recomputes on every render; stored value clamped on load.
- **Mobile breakpoint mismatch** → `useIsMobile` and Tailwind's `mobile:` prefix both resolve from the same media query in `useBreakpoint.ts`.
