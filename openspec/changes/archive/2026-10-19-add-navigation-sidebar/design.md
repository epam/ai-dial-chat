## Context

See `proposal.md` (Why) for the motivation and the host contracts this change has to preserve. This section records only the constraints that shape the approach.

- **Before this change the app had three siblings on desktop and a separate mobile set.** `apps/chat/src/app/app.tsx` mounts them in a flex row: `Navigation` (the `NavigationPanel` rail on desktop, `NavigationSheet` on mobile, and `LogoutConfirmationModal`), `ConversationPanelView`, and `<main>`. `ConversationPanelView` is a 1.5k-line container. It owns every row action, dialog, transfer queue and the import input, and renders the lib `ConversationPanel` once at the end.
- **The lib `ConversationPanel` is a single block.** It is `SidebarPanel` + `NewChatButton` + kit `Search` + `FilterTabs` + the virtualized list. Search text and the active tab are internal state. Nothing in it can be rendered without its chrome.
- **Panel open/closed state** lives in `ConversationPanelContext` (`isPanelOpen`, initial `true`, not persisted). `useConversationPanelRouteState` drives it from the route: it force-closes off the conversation section, re-applies the user's choice or `showConversationsSectionByDefault` inside it, closes the panel when the canvas opens, and closes the canvas when the panel opens. `ConversationView` and `useAttachmentCanvasResolvers` also call `closePanel` when they open the canvas or the sources panel.
- **Conversation data is already app-wide.** `ConversationsProvider` sits above `<Routes>` in `apps/chat/src/main.tsx`.
- **The breakpoint is one boundary at 1280px** (`responsive-breakpoints`). `useIsMobile` is the JS branch.
- **Width at a 1280px viewport.** With the expanded sidebar, every route gets 944px of content width. Today chat routes get 896px (60 + 324 + main) and other routes get 1220px.
  - A grep of the pages that will sit beside the sidebar found no fixed width above 944px. Catalog caps at `max-w-[1180px]`, the Scheduled Tasks form at `max-w-[996px]`, Settings uses a 240px side column, and the file-manager tree is 360px only in the Attach variant.
  - Their desktop layouts switch on viewport media queries, not container width.
  - This is checked under Risks.

## Goals / Non-Goals

**Goals:**

- A single switch point, so "is the sidebar layout active" cannot drift between components.
- The earlier components stay exported and unchanged in the libs, so their suites remain the regression net for library hosts.
- Lib work that a library host can adopt piecemeal: the list without the panel chrome, and the sidebar shell without the list.
- One implementation of conversation row actions and dialogs, shared by both layouts.

**Non-Goals (design-level, beyond `proposal.md` Non-goals):**

- Splitting `ConversationPanelView` into a controller hook. It is desirable (the file is already past the 800-line limit) but orthogonal, and is recorded as a follow-up.
- Changing `SidebarPanel`. The new sidebar is not built on it. It has no 48px header, no resize handle and no close button.
- Container queries for pages beside the sidebar.

## Decisions

### D1. One sidebar at every width; the viewport decides only how it is shown

There is no layout switch. `app.tsx` mounts `SidebarNavigation` at every width and the viewport (`useIsMobile`, one boundary at 1280px) decides how it is presented: a persistent column on desktop, a drawer on mobile (D14). Surfaces that differ by band read `useIsMobile` directly or use the `desktop:` Tailwind variant; the isolated model view needs no extra branch because `app.tsx` mounts no navigation there.

*Alternative:* a feature key (`navigation-sidebar`) that lets a host keep the rail. Built first and removed: it needed a second mode on every surface, a dual-mode panel state, a protocol key and a first-paint flash while the configuration loads, to serve hosts that can stay on the earlier release instead.

*Alternative:* keep the mobile bottom sheet and conversation drawer, and add the sidebar for desktop only. Superseded by the design: mobile now shows the same sidebar as a drawer, so the sheet, the second drawer and the layout branch all go.

### D2. `SidebarNavigation` owns the navigation; the chats block is passed in

```
desktop (>= 1280px)                          mobile (< 1280px)
+-------------------------+-------+          +-------------------------------+
| NavigationSidebar       | main  |          | Header: [sidebar][+]  logo [r]|
|  header / items         |       |          +-------------------------------+
|  children = Conversation|       |          | main                          |
|    PanelView (Sidebar)  |       |          |    +------------------+       |
|  footer: UserMenu+Usage |       |          |    | drawer 320px     |<--- opens from the header toggle
+-------------------------+-------+          +----+------------------+-------+
 SidebarNavigation (column)                    SidebarNavigation (drawer)
```

`app.tsx` builds the `ConversationPanelView` element once and mounts `SidebarNavigation` (a self-contained component that owns its items, user menu, log-out confirmation, Settings dialog and, on mobile, the drawer behaviour) with that element as `chats`. The earlier `Navigation` component, which carried the rail and the sheet, is deleted from the app.

*Alternative:* render the sidebar inside `Navigation`, which then needs `chats`, `isSidebarCollapsed` and `onToggleSidebar` props and a branch per surface. Tried first and rejected: it grew the component for the new layout. It became moot once the rail and sheet left the app.

### D3. `ConversationPanelView` renders only the sidebar block

`ConversationPanelView` keeps every row action, dialog, transfer queue and the import input, and renders the lib `ConversationListSection` (the header and the list, with the search text, the search-open flag, the active filter and the list-expanded flag as its own state) in place of the lib `ConversationPanel`, passing the actions, labels and the celebration anchor class. The section is new, so it lives in the lib; only the row actions, dialogs and queues stay in the app. Its dialogs, queues and import input are portalled out of the sidebar, whose content is `inert` while collapsed or closed.

*Alternative:* extract a `useConversationPanelController` hook first, then write a thin view. That is the cleaner end state, but it touches 1.5k lines of tested behaviour unrelated to the navigation. It is deferred as a follow-up.

### D4. `libs/conversation-panel`: extract `ConversationList`, add `ConversationListHeader` and a row variant

- **`ConversationList`** is the virtualized grouped list. It takes `conversations`, `isLoading`, `activeConversationId`, `onSelectConversation`, `getActions`, `onActionMenuOpen`, `onMoveConversation`, `hiddenSources`, a list subset of labels, `styles` and `rowVariant`. It also takes **controlled** `searchQuery` and `activeFilter` props.
  - **What moves into it:** expanded-groups state, scroll-to-active, drag-and-drop state, the skeleton/empty/no-results states and the `role="status"` live region.
  - **`ConversationPanel`** keeps its prop interface and its own search/tab state, and renders `SidebarPanel` + `NewChatButton` + `Search` + `FilterTabs` + `ConversationList`. Its output, its public `dial-cp-*` classes and its tests do not change.
- **`ConversationListHeader`** is the "Chats and tasks" row. It contains:
  - a title button that expands/collapses the list (`aria-expanded`);
  - a search toggle that swaps the row for a kit `Search` with a Close search button, and closes on Escape;
  - a filter `Dropdown` with single-select `MenuItemMark.Check` items, the same pattern `UserMenu` uses for its preference groups;
  - an `actions` slot for the existing panel overflow menu.

  Every piece is optional through props, which is how the app expresses `hide-conversations-filter`.
- **`ConversationRowVariant`** is a string enum with `Avatar` (default, today) and `Indicator`.
  - **`Indicator`** draws a leading dot (hollow when read; filled accent plus `dial-small-semi-text` title when unread). It renders neither the deployment avatar nor `leadingIcon`, and drops the trailing unread dot. The visually hidden unread label stays.
  - **Row metrics:** pitch and header heights come from the variant: `getRowHeight` reads it from `rowProps`. Exact values come from the Figma `.navigation-chat` / `.navigation-section` frames at implementation time.

*Alternative:* add `isEmbedded` / `variant` props to `ConversationPanel` itself. Rejected: one component would carry two shells, and every branch would sit next to the public class contract hosts style against.

### D5. `libs/navigation-panel`: `NavigationSidebar`

**Props:**

| Prop | Meaning |
|---|---|
| `items` | The existing `NavigationPanelItem` model |
| `renderLink` | The existing `NavigationLinkRenderer` |
| `labels` | `ariaLabel`, `expand`, `collapse` |
| `logo` | `href`, `ariaLabel`, `logoUrl` for the expanded header, `iconUrl` for the collapsed one |
| `isCollapsed` | Controlled state |
| `onToggleCollapse?` | Optional; when absent there is no toggle and the header is just the logo link |
| `children` | The chats slot |
| `userMenu?` | Footer slot |
| `footerActions?` | Footer slot |
| `styles` | Colors and classes |

**Header:**
- **Expanded:** the logo link at the start and a collapse button at the end.
- **Collapsed:** one button that shows the favicon at rest and the sidebar glyph on hover and focus, matching the Figma `.navigation-header` collapsed states.

**Items:**
- **Expanded:** 40px rows with icon and label.
- **Collapsed:** 40px icon buttons with tooltips.

**Footer:**
- **Expanded:** `userMenu` at the start, `footerActions` at the end.
- **Collapsed:** `footerActions` stacked above `userMenu`.

The DOM order is rendered per state, so focus order follows the visual order.

**`children` while collapsed:** they stay mounted, but `inert` and clipped by the width transition, as `SidebarPanel` does today. This keeps the virtual list's scroll position and avoids a remount on every toggle.

The width transition is disabled under `prefers-reduced-motion`.

*Alternative:* unmount `children` while collapsed. Rejected: it loses scroll position, and remounts the list and its memoised rows each time.

### D6. `UserMenu` gets `triggerVariant`

`UserMenuTriggerVariant` is a string enum: `Avatar` (default, unchanged, including its 60px wrapper and `top-end` placement), `Profile` and `Compact`. `Compact` is the collapsed sidebar's avatar-only pill: the `Avatar` trigger sits in a fixed 60px square that does not fit the 72px sidebar's 40px footer column. `Profile` renders avatar, `displayName` (truncated with `EllipsisTooltip`) and a chevron that flips while the dropdown is open, with `top-start` placement. The menu's items, order and labels are identical in both variants.

### D7. State: reuse `ConversationPanelContext` for the desktop column

On desktop `isPanelOpen` means "expanded". No new context is introduced. `useConversationPanelRouteState` no longer drives the state from the route:
- the user's in-memory choice, or else `isOpenByDefault` (`showConversationsSectionByDefault`), is applied once the desktop band is in use and again if the default changes, never on navigation;
- the canvas effects stay, so opening the canvas collapses the sidebar and expanding it closes the canvas;
- without a toggle (`isToggleEnabled` false, from `conversations-panel-toggle`) the sidebar returns to `isOpenByDefault` when the canvas closes, because nothing else could re-expand it;
- on mobile the state is reset and ignored: the drawer's open state is `isNavOpen` in `app.tsx`, so the desktop choice does not bleed through when the viewport returns to desktop.

The existing `ConversationView` and `useAttachmentCanvasResolvers` `closePanel` calls therefore mean "collapse", with no edits. Nothing is persisted, as the proposal decided.

*Alternative:* a new `NavigationSidebarContext`. Rejected: two booleans would describe one column, and the canvas and sources call sites would need to know which one to close.

### D8. Navigation items and the top bars

- **Items.** `NAVIGATION_CONFIG` carries the presentation directly: the Root entry is `IconPlusCircle` / `IconCirclePlusFilled`, `ButtonsI18nKeys.NewChat` and `isExactMatch`. `useNavigationItems` drops it when `hide-new-conversation` is on. `NavigationItem.labelKey` widens to accept `ButtonsI18nKeys`.
- **Desktop top bar.** `ChatLayout`'s desktop top bar renders neither the panel toggle nor the "+" button, which live in the sidebar; the optional logo and the sources toggle stay.
- **Mobile header.** See D14.

### D9. Footer content, logo, celebrations: app-owned

- **Footer content.** `Navigation` passes:
  - `userMenu`: `UserMenu` with `triggerVariant` set by `isCollapsed`, under today's authentication and `hide-user-menu` conditions;
  - `footerActions`: a router `Link` to `getSettingsTabRoute(SettingsTabs.Usage)`, rendered as a `GhostIconButton` with `IconChartBar`, labelled and tooltipped with `basic.usage`, carrying `aria-current="page"` on that route, and omitted under `hide-settings-page`.
- **Logo.** `logoUrl` is `currentThemeLogo`, falling back to the favicon. `iconUrl` is the favicon, or the celebration's `event.iconUrl`, exactly as the rail resolves it today.
- **Celebrations.** `CELEBRATION_HISTORY_CLASS` moves onto the `ConversationList` root in the sidebar layout, so `CelebrationHost` keeps finding its history anchor.

This is the lib-isolation boundary. No lib sees a route, feature key, theme, i18n call or user-session detail. They get resolved URLs, labels, booleans, callbacks and slots.

### D10. Public classes and theming

- **New public classes:**
  - `NAVIGATION_PANEL_CLASS.sidebar` (`dial-navigation-panel-sidebar`), `.sidebarItem` and `.sidebarFooter`;
  - `CONVERSATION_PANEL_CLASS.list` (`dial-cp-list`) and `.listHeader` (`dial-cp-list-header`).
  `conversation-panel` keeps its hand-named `dial-cp` prefix, which is on the closed list in `docs/architecture.md`.
- **Unchanged classes:** `dial-navigation-panel-rail`/`-item`, `dial-sb-*` and the existing `dial-cp-*` classes stay on their elements, and nothing new reuses them.
- **Colors.** `ConversationList` reads the existing `--cp-*` variables (`ConversationListColors` maps one-to-one onto them, plus the new `--cp-indicator-dot` for the read dot of `Indicator` rows), so a host themes rows once, whichever shell renders them; `ConversationPanel` sets the same list variables on its root. `ConversationListHeader` adds `ConversationListHeaderColors` on `--cp-list-header-title` and `--cp-list-header-title-focus`. `NavigationSidebar` adds `NavigationSidebarColors` mapped one-to-one onto new `--np-sidebar-*` variables, including `--np-sidebar-focus-outline`, and `UserMenu` adds `triggerOpenBackground` on `--np-trigger-open-bg`, all through `buildCssVars`.
- **Typography and labels follow the neighbours.** `NavigationSidebarTypography.fontClassName` (item labels only), `ConversationListHeaderTypography` under `styles.typography`, `labels.filterLabels: FilterLabels` (its `groupAriaLabel` names the filter trigger), and `ConversationPanelLabels` / `ConversationPanelTypography` extend the list's own types instead of repeating their fields. No variable is set without a stylesheet reading it, or read without a typed entry (`openspec/lib-styling-guide.md`).

### D11. Search uses the kit `Search` as-is

This follows the proposal's decision. The kit renders its clear × only for a non-empty value, so `ConversationListHeader` adds its own Close search button after the field.
- **Escape** closes the search too.
- **Closing** clears the query and returns focus to the search toggle.

Match highlighting keeps the existing `searchQuery` → `Highlight` path in the row.

### D12. Test strategy

- **Regression net.** Lib suites are not edited. In `apps/chat`, `Navigation.spec.tsx` is deleted with `Navigation`, and its item and user-menu cases move to `SidebarNavigation.spec.tsx`; `SettingsPage.spec.tsx` pins the mobile layout; `DialFileManagerPage.spec.tsx`, `ScheduledTasksPage.spec.tsx` and `UsageTab.spec.tsx` follow the shared page headers (D13).
- **New suites:**
  - `ConversationList`, `ConversationListHeader` and the `Indicator` row;
  - `NavigationSidebar` (states, toggle, footer order, `inert`);
  - the `UserMenu` `Profile` trigger;
  - `useIsNavigationSidebarLayout` (removed again in 16.4).
- **Extended suites:** `useConversationPanelRouteState` (with `isSidebarLayout`), `Navigation`, `ChatLayout` and `ConversationPanelView`. Each gets `describe` blocks for the desktop layout, leaving the existing blocks as they are.

### D13. Scope added during implementation

Product decisions taken while implementing, each with its own task under 13:
- **No feature key.** The sidebar replaces the rail, the sheet and the conversation drawer in the app for every deployment and host (proposal, option C).
- **Usage page and Settings dialog.** Usage is the standalone `/usage` page and Settings opens as `SettingsModal` (Preferences only, applied on Save), at every width; a phone drops the dialog's side list. The Settings page stays routable and has no Usage tab.
- **Shared page headers.** Catalog, File manager, Usage and Scheduled tasks use one header row (`PAGE_HEADER_ROW_CLASS`, 72px) at every width.
- **File manager frame.** From the `desktop` band the File manager page has a title, margins and a raised card; a phone keeps the full-bleed manager (`file-manager-standalone-page`).

### D14. Mobile: the same sidebar as a drawer, and a new header

Figma moves mobile to the same navigation: a 320px drawer (the drawer variant of `NavigationSidebar`) that holds the items, the "Chats and tasks" block, the Usage link and the user menu, opened from the left toggle of a redesigned header (sidebar toggle, then "+", logo in the middle, sources toggle on the end, 1px bottom divider). The bottom sheet, its profile page and the conversation drawer leave the app.

- **Library.** `NavigationSidebar` gains `variant` (`Sidebar` by default, `Drawer`), `onClose` and `labels.close`. The drawer variant owns its shell: position, slide-in, `inert` while closed, focus in and out, and Escape; the host passes `isOpen`, `onClose` and `id` and keeps the toggle, so the lib stays host-agnostic. `NavigationPanel`, `NavigationSheet` and `ConversationPanel` stay exported and unchanged, so a library host can pick the earlier or the new surfaces at every width.
- **App.** `SidebarNavigation` passes `isOpen`, `onClose` and `MOBILE_SIDEBAR_ID` to the sidebar and closes it on a route change; `app.tsx` also closes it on a chosen chat (even the open one) and a viewport change. There is no backdrop, as the drawer it replaces had none; adding one is an open question.
- **Header.** `Header` loses its hamburger and the panel toggle; the left toggle opens the drawer (`aria-expanded`, `aria-controls`). The "+" shows on every route (it was gated to conversations because the start page has its own composer). The sources toggle takes the right-panel glyph on mobile only, through an optional prop.
- **Flags.** `hide-navigation-menu` removes the drawer's items, user menu and Usage link; the toggle stays only while the conversation list remains reachable (`conversations-section` and `conversations-panel-toggle` on). The drawer's user menu also carries the keyboard-shortcut group the sheet used to hold, so `hide-keyboard-shortcuts` keeps its meaning. The sheet's `FooterMessage` footer is gone; the footer message still renders under the chat input.

## Risks / Trade-offs

- **[Extracting `ConversationList` changes `ConversationPanel` internals]** → Do it as the first slice, with no new UI. `ConversationPanel.spec.tsx`, `ConversationRow.spec.tsx`, `FilterTabs.spec.tsx`, `NewChatButton.spec.tsx` and `SidebarPanel.classes.spec.tsx` must pass with no edits before anything else lands.
- **[Non-chat routes lose 276px at a 1280px viewport]** (1220 → 944) → No page has a fixed width above 944px (see Context). Run the `responsive-design` review at 1280×800 on Catalog, File manager, Settings and Scheduled Tasks, and record any issue as a follow-up. Users can collapse to 72px.
- **[Switching layout at runtime remounts `ConversationPanelView`]** This happens when the viewport crosses 1280px, and it loses transient state (an open dialog, search text, an import or export in progress). It is a rare, deliberate event → accepted.
- **[Crossing to mobile and back resets the desktop state]** The mobile effect collapses the column and drops the user's choice, so returning to desktop applies `showConversationsSectionByDefault` again → accepted. This matches today's behaviour for the panel.
- **[A drawer without a backdrop leaves the page interactive]** It matches the conversation drawer it replaces and the Figma frame, and Escape, the close button and navigation dismiss it → accepted; a scrim is an open question.
- **[The Settings dialog must fit a phone]** It is capped to the overlay width and drops its side list on mobile → check at 360px.
- **[Two × controls while searching]** The kit clear button appears alongside the Close search button once text is typed → temporary, per the proposal. Raise a ui-kit issue for a close-on-empty `Search` option.
- **[Host CSS written against `dial-navigation-panel-rail` does not affect the sidebar]** → Document in `docs/chat-overlay-migration-guide.md`: overlay hosts review their overrides against the new `dial-navigation-panel-sidebar*` classes before upgrading, or stay on the earlier release.
- **[`ConversationPanelView` grows]** It is already past the 800-line limit → the follow-up controller-hook extraction is recorded in `tasks.md`.

## Migration Plan

1. Ship the sidebar as the navigation of `apps/chat` at every width: the column on desktop and the drawer with the new header on mobile.
2. An overlay host that must keep the rail, the sheet or the conversation drawer stays on the earlier release of the app. A library host keeps composing `NavigationPanel`, `NavigationSheet` and `ConversationPanel`, which are unchanged.
3. Announce the change in the release notes and in `docs/chat-overlay-migration-guide.md`.

**Rollback:** revert the app change. Reverting is safe, because the libs only gained exports.

## Open Questions

- Exact Figma tokens (row pitch, section spacing, colors, filter-trigger glyph). Read with `get_design_context` at implementation. They do not affect specs or task boundaries.
- Whether the mobile drawer needs a backdrop scrim and a focus trap; the Figma frame shows neither.
