## Context

The app has a `Navigation` icon bar on the left and a `ConversationSourcesPanelView` on the right. There was no panel listing past conversations. The `ConversationsApi` generated client previously exposed only `getConversation`, `saveConversation`, and `deleteConversation` — no list endpoint. The `SidebarPanel` component in `libs/sidebar` provides a generic panel shell but has no domain content.

## Goals / Non-Goals

**Goals:**
- A left-side `ConversationPanel` component in a new `libs/conversation-panel` lib.
- **New chat button** — full-width button below the header to start a new conversation.
- **Search input** — text field that filters the visible list by title client-side.
- **Filter tabs** — segmented control: All / My chats / Shared / Organization.
- **Grouped sections** — Pinned (`isPinned: true`), My chats, Shared (`ConversationSource.Shared`), and Organization (`ConversationSource.Organization`); each section is collapsible with a chevron.
- Conversation rows show an optional icon and title; clicking navigates to the conversation.
- **Row actions** — each row exposes a `getActions` callback for per-item dropdown actions (pin/unpin, rename, delete); wired in `ConversationPanelView` via `ConversationsContext`.
- On desktop: persistent panel, 288px wide, pushes `<main>` content.
- On mobile: full-width (`w-full`) drawer overlay, triggered from the `Header` mobile toggle button; closed by default on mobile (a `useEffect` in `app.tsx` resets `isHistoryPanelOpen` to `false` whenever `isMobile` becomes true, clearing any stored desktop `true` from `localStorage`); closed via an `IconX` button inside the panel header.
- New backend list endpoint `GET /api/v1/conversations/list` returns cursor-paginated metadata backed by DIAL Core.
- Responsive: uses `useIsMobile` / `useBreakpoint` from `apps/chat/src/hooks/breakpoint/`.
- Panel open/closed state persisted to `localStorage` via `useLocalStorage` hook.

**Non-Goals:**
- No infinite scroll — first page (20 items) only in this change.

> **Implementation note:** Rename and delete were added during implementation (originally listed as non-goals). They are wired in `ConversationPanelView` via `ConversationsContext`.
- No server-side search — filtering is client-side over the loaded page.

## Decisions

### 1. New lib (`libs/conversation-panel`) — uses `SidebarPanel` from `libs/sidebar` as shell

`SidebarPanel` is a generic panel shell. The conversation panel has domain-specific content (conversation rows, search, filter tabs, grouped sections). A dedicated `libs/conversation-panel` lib keeps domain knowledge co-located.

**Decision:** New `libs/conversation-panel` lib at `@epam/ai-dial-conversation-panel`. It imports `SidebarPanel`, `SearchInput`, and `SidebarSide` from `@epam/ai-dial-sidebar` to use as the panel shell, avoiding duplication of panel layout and CSS custom-property logic.

> **Implementation note:** The original decision said the lib would not depend on `libs/sidebar`. This was revised during implementation — sharing the `SidebarPanel` shell is safe (both are in `libs/*`, neither owns host-level integration details) and avoids maintaining a parallel panel wrapper.

### 2. Collapse/expand — `isOpen` in app, `onToggle` in lib for mobile close

The panel's visibility state must be shared between the `Header` (toggle button) and the panel itself. Both live in `apps/chat`. The lib receives `isOpen` as a prop; it does not own open/closed state. On mobile an `onToggle` callback and `closeAriaLabel` string can be passed to `ConversationPanel` to render a close button inside the panel header.

**Decision:** `isOpen: boolean` prop on `ConversationPanel`. Optional `onToggle?: () => void` and `closeAriaLabel?: string` props for the mobile close button. The app manages the state via `useLocalStorage('conversationPanelOpen', false)` and passes it down.

### 3. Toggle icon placement — in app `Header`, not inside the panel

**Decision:** The toggle icon button lives in `apps/chat/src/components/Header/Header.tsx` (`isHistoryPanelOpen` + `onHistoryPanelToggle` props). On **desktop** the existing `SideBarLeft/SideBarRight` icon is shown (`hidden desktop:flex`). On **mobile** a separate `IconLayoutSidebarRight` button is shown (`desktop:hidden`); it is only rendered when the panel is closed. The panel header does not contain a toggle on desktop.

When the panel is **open on mobile**, a close (`IconX`) button is rendered inside the `SidebarPanel` header (via `SidebarPanel.onClose`, delegated from `ConversationPanel.onToggle`). `ConversationPanelView` passes `onToggle={onClose}` when `isMobile` is true. There is no backdrop overlay — mobile close is handled exclusively via the close button in the panel header.

### 4. Panel width and collapse behaviour on desktop

- **Expanded:** `w-[325px]`, `border-l border-r`, pushes `<main>` via flex row.
- **Collapsed:** `w-[0px] overflow-hidden` — panel content hidden; no icon-only strip.
- CSS transition on width for smooth open/close.

### 5. Backend list endpoint — `GET /api/v1/conversations/list`

`@Get('list')` avoids a route conflict with the existing `@Get()` handler. DIAL Core metadata endpoint is called with `recursive: true` and the user's bucket, returning all conversations flat. Pagination uses DIAL Core's cursor (`token` → `nextToken` in the response). An optional `path` query parameter scopes the listing to a subfolder.

**Decision:** `GET /api/v1/conversations/list` with `ListConversationsQueryDto { limit?, nextToken?, path? }`. Response: `ConversationListResponseDto { items: ConversationListItemDto[], nextToken? }`. No `isPinned` or `source` fields on items in this slice — those require DIAL Core support that is out of scope.

### 6. Data fetching — `ConversationsContext`

`ConversationsContext` in `apps/chat/src/context/ConversationsContext.tsx` fetches once on mount. It exposes `{ conversations, isLoading, error, pinConversation, deleteConversation, renameConversation, refreshConversations }`. The context uses the `cancelled` flag pattern (per `useFavicon` reference). The provider is placed inside `RequireAuth` in `apps/chat/src/main.tsx`.

- `pinConversation(id, isPinned)` — optimistic update via `apiPinConversation` from `server-api/user-config.api`.
- `deleteConversation(id)` — optimistic remove; reverts the local list on API failure.
- `renameConversation(id, newTitle)` — optimistic title update; also updates the item `id` after the server returns a new path.
- `refreshConversations()` — re-fetches the full list from the server.

### 7. `ConversationPanelView` — app-level adapter component

Rather than wiring `ConversationsContext`, i18n, and routing callbacks directly in `app.tsx`, a dedicated `ConversationPanelView` component in `apps/chat/src/components/ConversationPanel/` owns the translation calls and context consumption. This keeps `app.tsx` lean.

### 8. `FilterTab` and `ConversationSource` — string enums

Both are domain value sets that belong in a string enum per project convention, not plain union literal types. `FilterTab` uses values `All = 'all'`, `MyChats = 'my-chats'`, `Shared = 'shared'`, `Organization = 'organization'`. `ConversationSource` uses the same values minus `All`.

### 9. Search and filter — lib-internal state

Search (`useState<string>`) and active tab (`useState<FilterTab>`) state live inside `ConversationPanel`. The app passes the full unfiltered list; filtering is applied inside the component. This minimises props and keeps filtering logic co-located with the UI.

### 10. Panel open/closed state — `useLocalStorage`

`isHistoryPanelOpen` is managed in `app.tsx` using `useLocalStorage('conversationPanelOpen', false)` so the panel position survives page reloads. See `conversation-panel-state-and-list-path` change for the hook implementation.

## Risks / Trade-offs

- **[Risk] No `isPinned`/`source` from the list endpoint** → Pinned and My chats sections are present in the UI but all items fall into "My chats" until DIAL Core adds those fields. The UI handles this gracefully (Pinned section is hidden when empty).
- **[Trade-off] `ConversationsProvider` outside `RequireAuth`** — fires the API call before authentication is confirmed; may produce a 401 on the login page. Accepted for parity with `DeploymentsProvider`; a retry-after-auth mechanism is a follow-up.
- **[Trade-off] Panel hidden via CSS (`w-[0px]`) rather than unmounted** — keeps scroll position on re-open but keeps the list mounted even when hidden. Acceptable for 20 items.
- **[Trade-off] Client-side search over 20 items** — fast but stale after the initial load. Acceptable for this slice; server-side search is a follow-up.
