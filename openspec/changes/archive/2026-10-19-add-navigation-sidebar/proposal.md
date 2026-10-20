## Why

The new DIAL Chat 2.0 design ([Figma — Navigation](https://www.figma.com/design/cAfpAU0syJ8BQ5sQr3uR30/-DIAL--Components-2.0?node-id=53-1043), [File manager page](https://www.figma.com/design/U1rFBVyMM4o6nLzQocEBY2/DIAL-Chat-2.0--File-manager?node-id=3445-12595)) merges the 60px navigation rail and the conversation panel into one desktop sidebar, and makes the chat list reachable from every page instead of only from `/` and `/conversations/*`. Today the two are separate columns (`apps/chat/src/app/app.tsx:257-271`), and the panel is force-closed on every other route (`apps/chat/src/hooks/conversation-panel/useConversationPanelRouteState.ts:76-81`).

The current layout is also a contract for library hosts, which compose `@epam/ai-dial-navigation-panel`, `@epam/ai-dial-conversation-panel` and `@epam/ai-dial-sidebar` themselves and style them through public `dial-*` classes. The new design therefore arrives as new components next to the old ones, and the old ones stay exported. The application itself switches to the new layout on desktop without a feature key: overlay hosts that need the earlier layout stay on the earlier release of the app.

## What Changes

- **One sidebar replaces the rail, the conversation panel, the mobile bottom sheet and the conversation drawer in `apps/chat`.** At 1280px and wider it is a persistent column; below that it is the same content as a 320px drawer opened from a redesigned mobile header (sidebar toggle, New chat, logo, sources toggle). There is no feature key: the viewport only decides how the sidebar is shown.
- **On desktop the sidebar has two states:** expanded at 336px and collapsed at 72px, toggled from its own header. On mobile the drawer shows the expanded content with a close button in place of the toggle. Expanded, it shows:
  - **Header:** theme logo and the collapse toggle.
  - **Navigation items:** New chat, Scheduled tasks, Catalog, File manager.
  - **"Chats and tasks" block:**
    - a header with a search toggle, a filter dropdown and the existing panel overflow menu;
    - the Pinned, My chats, Shared and Organization groups;
    - rows with a dot indicator in place of the deployment avatar.
  - **Footer:** the user menu and a Usage icon that links to the standalone `/usage` page. Settings opens as a dialog from the user menu.

  Collapsed, it shows the logo, the item icons, the Usage icon and the avatar.
- **Route-independent state.** The route never changes the sidebar state. Opening the attachment canvas collapses it. Expanding it closes the canvas, as the panel toggle does today. The state is not persisted: each load starts from `showConversationsSectionByDefault`.
- **The "Chat" navigation item becomes "New chat"** on desktop. It gets a plus icon and is active only on an exact `/`. Today it is also active inside conversations (`apps/chat/src/hooks/navigation/useNavigationItems.ts:23-28`).
- **Existing layout keys keep a defined meaning in the sidebar:**
  - `conversations-section` off removes the chats block.
  - `conversations-panel-toggle` off removes the collapse toggle.
  - `hide-conversations-filter` removes the filter icon.
  - `hide-new-conversation` removes the New chat item.
  - `hide-user-menu` removes the footer user menu.
  - `hide-settings-page` removes the Usage icon and the Settings entry.
  - `catalog` and `file-manager` gate their items exactly as today.
  - The isolated model view hides the sidebar.
  - The `ChatLayout` desktop top bar drops its panel toggle and "+" button, which move into the sidebar. It keeps `show-header-logo` and the sources toggle.
- **Additive lib changes only:**
  - **`libs/navigation-panel`:** a new `NavigationSidebar` (header, items, a `children` slot for the chats block, a `footer` slot), modelled on how `NavigationSheet` is assembled from exported primitives.
  - **`UserMenu`:** a new optional expanded trigger (avatar, name and chevron), with the default unchanged. Today the trigger is avatar-only (`libs/navigation-panel/src/components/UserMenu/UserMenu.tsx:148-159`).
  - **`libs/conversation-panel`:** the list body is extracted from the monolithic `ConversationPanel` (`libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx:406-515`) into an exported `ConversationList`. `ConversationPanel` re-composes it with identical output. Rows gain an opt-in dot-indicator variant.
- **No backend change and no protocol change.** The `OverlayFeature` enum and the known-feature list are untouched.

No library API change is **BREAKING**. The app's desktop layout does change on upgrade for every deployment and overlay host, together with the shared page headers and the File manager frame (design D13); a host that must keep the earlier layout stays on the earlier release.

## Non-goals

- **A backdrop or focus trap for the mobile drawer.** Figma shows neither; it closes on its close button, Escape and navigation.
- **Date & time and Extensions in the Settings dialog.** The dialog carries Preferences only; the legacy layout keeps the Settings page.
- **The designer's search note** (an always-visible ×, which would close the search entirely). The kit `Search` shows its clear button only for a non-empty value. We use it as-is, close the search with a separate control, and raise the gap with `@epam/ai-dial-ui-kit` as a follow-up.
- **Persisting the collapsed state or a resizable sidebar.**
- **Restyling** the existing `NavigationPanel`, `ConversationPanel` or `SidebarPanel`.

## Alternatives considered

| Decision | Option | Verdict |
|---|---|---|
| Switch | A. New modifier key, default off | Rejected. A deployment that configures nothing would see no change, but every surface would carry a second mode. |
| | B. New key, default on | Tried and rejected. Hosts sending an explicit list could keep the rail, at the cost of six layout readers, a dual-mode panel state, a first-paint flash while the config loads, and a 52nd protocol key. |
| | **C. Replace the desktop layout in the app, no key** | **Picked.** The earlier components stay in the libs for library hosts; `apps/chat` mounts only the new sidebar on desktop. Overlay hosts that need the earlier layout stay on the earlier release. |
| Lib shape | **1. Additive composition: `NavigationSidebar` + extracted `ConversationList`** | **Picked.** The virtualized list, grouping and drag-and-drop stay in one place. Library hosts can adopt the new shell or ignore it. |
| | 2. App-only composition in `apps/chat` | Rejected. It would duplicate the virtualized list and drag-and-drop outside the lib. |
| | 3. `variant` props on `NavigationPanel` / `ConversationPanel` | Rejected. It couples two different shells and puts the public `dial-*` class contract at risk. |

## Backward compatibility and rollback

- **Overlay hosts.** They get the sidebar on desktop and cannot opt out. A host that must keep the rail stays on the earlier release of the app. The existing layout keys keep their meaning in the sidebar.
- **Library hosts.** Exports, props and defaults are only added. The `dial-navigation-panel-rail`/`-item`, `dial-sb-*` and `dial-cp-*` classes and the `--np-*`/`--cp-*` variables keep their elements. The new sidebar uses new `dial-navigation-panel-*` classes.
- **Rollback.** Revert the app change. Nothing existing changed meaning in the libs, so a revert is safe.

## Capabilities

### New Capabilities

- `navigation-sidebar`: The desktop sidebar. Covers its expanded and collapsed states, header, navigation items, "Chats and tasks" block, footer, route-independent collapse rules, the per-key behaviour above, the accessibility and RTL requirements, and the app–lib boundary.

### Modified Capabilities

- `conversation-history-panel`: The lib exports `ConversationList`, and `ConversationPanel` composes it with unchanged behaviour. Adds the opt-in dot-indicator row variant. The desktop-panel and app-header-toggle requirements are scoped to the mobile layout.
- `navigation-routing`: On desktop the app mounts `SidebarNavigation`, the root item is "New chat" and is active only on `/`, and the footer carries the Usage link.
- `user-menu`: Adds the optional expanded trigger for the sidebar footer. The avatar-only trigger stays the default.
- `conversation-panel-header-menu`: The same overflow menu is rendered in the sidebar's "Chats and tasks" header.

`mobile-navigation-bottom-sheet` and `responsive-breakpoints` are unchanged.

## Impact

- **Libs (shared, published — scope flagged):**
  - `libs/navigation-panel`: new component, models, exports, public classes, README.
  - `libs/conversation-panel`: `ConversationPanel` refactor, `ConversationList`, row variant, README. **This refactor is the main regression risk.** Its existing specs (`ConversationPanel.spec.tsx`, `ConversationRow.spec.tsx`, `FilterTabs.spec.tsx`, `NewChatButton.spec.tsx`) must pass without edits, and so must `SidebarPanel.classes.spec.tsx` in `libs/sidebar`.
- **App (global layout and provider):**
  - `apps/chat/src/app/app.tsx`, `components/Navigation`, `components/ConversationPanel` (controller split from rendering), `components/ChatLayout`.
  - `hooks/conversation-panel/useConversationPanelRouteState.ts`, `hooks/navigation/*`, `constants/navigation.ts`.
  - The celebration history anchor (`constants/celebration.ts`).
  - Their tests.
  - State stays in the existing `ConversationPanelContext` (`apps/chat/src/context/ConversationPanelContext.tsx`), where open means expanded, so no new context is introduced. Conversation data is already app-wide (`ConversationsProvider`, `apps/chat/src/main.tsx:86`).
- **Lib boundary.** Everything host-specific stays in `apps/chat`: flag evaluation, routes, i18n, the theme logo and favicon URLs, the user profile and the `/usage` target. The libs receive resolved `items` with `isActive`, `renderLink`, resolved logo URLs, `labels`, booleans, callbacks and slots.
- **Docs:** `docs/architecture.md`, `docs/chat-overlay-migration-guide.md`, the README of each touched lib, `npm run validate:docs` and `npm run validate:specs`.
- **i18n:**
  - **New keys:** the "Chats and tasks" title, the open-search and close-search labels, and the expand-sidebar and collapse-sidebar labels.
  - **Reused keys:** `ButtonsI18nKeys.NewChat`, `BasicI18nKeys.Usage`, the existing filter and group labels, and `ConversationPanelI18nKeys.FilterGroupAriaLabel`.
- **Unverified assumption:** the 944px left for page content beside the expanded sidebar at 1280px is enough for Catalog, File manager and Settings. `design.md` should check this.

## Acceptance criteria

1. Library suites pass unchanged. The earlier components (`NavigationPanel`, `NavigationSheet`, `ConversationPanel`, the `Avatar` and default `UserMenu` trigger) keep their output, public classes and behaviour.
2. At ≥1280px:
   - One sidebar replaces the rail and the conversation panel, matching the Figma expanded (336px) and collapsed (72px) states.
   - The chats block is available on every route.
   - Collapse is route-independent.
   - Opening the canvas collapses the sidebar.
   - "New chat" is active only on `/`.
   - The Usage icon opens `/usage`, and Settings opens as a dialog.
3. Below 1280px the same sidebar is a 320px drawer opened from the redesigned header, which carries a sidebar toggle, New chat, the logo and the sources toggle.
4. Each layout key behaves as listed under What Changes, covered by tests.
5. Lib changes are additive. No lib reads flags, routes or i18n. `ConversationPanel`'s existing specs pass unchanged. READMEs match the exports. `validate:docs` and `validate:specs` pass.
6. Accessibility and RTL:
   - The toggle exposes `aria-expanded`.
   - Collapsed-away content is `inert`.
   - The active item carries `aria-current="page"`.
   - Icon-only items have accessible names and tooltips.
   - Layout uses logical properties, and the sidebar-toggle icon is mirrored under `dir="rtl"`.
