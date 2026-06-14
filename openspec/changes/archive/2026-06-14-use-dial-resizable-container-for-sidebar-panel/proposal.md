## Why

Both `ConversationSourcesPanel` (right) and `ConversationPanel` (left) render at fixed pixel widths. Users cannot adjust either panel width, which limits usability — especially on wide monitors or when content needs more space. `DialResizableContainer` from the ui-kit already solves this; the challenge is integrating it cleanly while respecting library isolation rules.

## What Changes

- `SidebarPanel` (lib) gains optional resize props (`resizable`, `defaultWidth`, `minWidth`, `maxWidth`, `onResizeStop`) and owns `DialConditionalResizableContainer` internally — callers simply pass props, no wrapping required.
- `ConversationSourcesPanel` (app) uses `SidebarPanel` directly with `useLocalStorage`, `useViewportWidth`, and `useIsMobile` inlined; fixed `w-[360px]` removed.
- `ConversationPanel` (lib) gains corresponding props (`resizable`, `defaultPanelWidth`, `minPanelWidth`, `maxPanelWidth`, `onPanelResizeStop`) and forwards them to `SidebarPanel`.
- `ConversationPanelView` (app) manages `localStorage` + viewport width and passes resize values to `ConversationPanel`.
- Resize handle is hidden when the panel is collapsed (`enabled={(resizable ?? false) && isOpen}` inside `SidebarPanel`).
- Each panel's last-used width is persisted to `localStorage` under a panel-scoped key and restored on reload.

## Capabilities

### New Capabilities

- `sidebar-panel-resizable`: User can drag a handle on any `SidebarPanel`-based panel by passing `resizable` props; the chosen width persists across sessions and the handle is hidden when the panel is collapsed or on mobile.

### Modified Capabilities

<!-- No existing specs change requirements -->

## Impact

- **`libs/sidebar`**: `SidebarPanel` and `SidebarPanelProps` updated with optional resize props; `DialConditionalResizableContainer` used internally.
- **`libs/conversation-panel`**: `ConversationPanel` and `ConversationPanelProps` updated with optional resize props forwarded to `SidebarPanel`.
- **`apps/chat`**: `ConversationSourcesPanel` uses `SidebarPanel` directly with inlined storage/viewport hooks; `ConversationPanelView` passes resize props to `ConversationPanel`.
- **Dependencies**: `@epam/ai-dial-ui-kit` already a dependency of `libs/sidebar`; `DialConditionalResizableContainer` and `ResizableContainerSide` already exported.
- **`localStorage`**: `conversationSourcesWidth` (sources panel), `conversationPanelWidth` (conversation panel).
