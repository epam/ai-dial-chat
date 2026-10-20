# navigation-sidebar Specification

## Purpose
The application's navigation: one sidebar that merges primary navigation and the conversation list, available on every route. On desktop it is a collapsible column; on a mobile viewport it is a drawer with the same content, opened from the header. The earlier rail, bottom sheet and conversation panel stay in the libraries for hosts that compose them themselves.

## Requirements

### Requirement: One sidebar is the navigation at every width

`app.tsx` SHALL mount `SidebarNavigation` (`apps/chat/src/components/Navigation/SidebarNavigation.tsx`) at every viewport width, and nowhere else mount a navigation. No feature key selects it. `SidebarNavigation` renders `NavigationSidebar` from `@epam/ai-dial-navigation-panel` with its own user menu, log-out confirmation and Settings dialog; `app.tsx` SHALL pass the conversation block (`ConversationPanelView`) into it as `chats`. In the `desktop` band (1280px and wider) the sidebar is a persistent column (see "Expanded and collapsed states"); in the `mobile` band it is the drawer in "Mobile drawer". The mobile header is `Header`, specified in "Mobile header".

The page headers of Catalog, File manager, Usage and Scheduled tasks and the File manager frame (`file-manager-standalone-page`) are shared by both bands.

The isolated model view SHALL keep the conversation list and drop the navigation: the mobile drawer carries the chats alone, because the view forces `hide-navigation-menu`, and the desktop sidebar renders no items, user menu or Usage link.

**Feature flag:** none. The sidebar is not gated by a UI-feature key; the layout keys in "Existing layout keys in the sidebar" apply inside it. This repo has no `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` role gate.

#### Scenario: Desktop renders a persistent sidebar

- **WHEN** the viewport is 1440px wide
- **THEN** one sidebar renders as a column beside the page, and no element carries the `dial-navigation-panel-rail` class

#### Scenario: A narrow viewport renders the same sidebar as a drawer

- **WHEN** the viewport is 1024px wide
- **THEN** the sidebar renders as a drawer that is closed until the header toggle opens it, and no persistent column renders

#### Scenario: Crossing the breakpoint switches between column and drawer

- **WHEN** the viewport is resized from 1440px to 1024px with the drawer never opened
- **THEN** the column is replaced by the closed drawer without a page reload, and the drawer is closed

#### Scenario: The isolated view keeps the chats and drops the navigation

- **WHEN** the isolated model view is active
- **THEN** the sidebar renders the conversation block alone, with no items, user menu or Usage link, and the header toggle on mobile opens a drawer that holds the chats

---

### Requirement: Mobile drawer

In the `mobile` band `SidebarNavigation` SHALL render the sidebar with `NavigationSidebarVariant.Drawer`, `id` `MOBILE_SIDEBAR_ID`, and the open state `isNavOpen` from `app.tsx` as `isOpen`/`onClose`. The `NavigationSidebar` lib component renders the drawer as a 320px element (never wider than the viewport), `fixed inset-y-0 start-0 z-50`, that slides in from the start edge (`ltr:-translate-x-full rtl:translate-x-full` when closed, no transition under `prefers-reduced-motion: reduce`).

The drawer carries the same items, conversation block, Usage link and user menu as the column, with the logo and a close button in its header instead of the collapse toggle. It has no collapsed state. There is no backdrop, as the conversation drawer it replaces had none.

While closed the drawer SHALL be `inert` and hidden from assistive technology, while staying mounted so the conversation list keeps its state. While it is open on a mobile viewport the page behind it (`<main>`) SHALL be `inert`, so Tab and assistive technology stay inside the drawer; there is no backdrop. When it opens, focus SHALL move into it; when it closes, focus SHALL return to the control that had it when the drawer opened. In `apps/chat` that control is the header toggle, which sits inside the `<main>` that is made `inert` while the drawer is open, so the browser has already moved focus to the page body and closing leaves it there; a drawer that is open on mount keeps the focus where it is. The lib SHALL call `onClose` on the close button and on an Escape pressed inside the drawer, ignoring one that comes from a dialog or menu its children render elsewhere in the DOM; the app SHALL also close it on any route change, when a conversation or New chat is chosen (even the one already open), and when the viewport leaves the `mobile` band.

The user menu in the drawer SHALL carry the keyboard-shortcut group in addition to the language group. `hide-navigation-menu` removes the drawer's items, user menu and Usage link, leaving the conversation block.

**Accessibility:** the header toggle carries `aria-expanded` and `aria-controls` pointing at the drawer; the drawer is `inert` while closed rather than `aria-hidden`.

**RTL impact:** the drawer anchors to the start edge and slides from it; the header's sidebar glyph is mirrored.

#### Scenario: The drawer is closed by default and unreachable

- **WHEN** the app renders in the `mobile` band
- **THEN** the drawer element is `inert` and none of its controls are in the tab order

#### Scenario: Opening moves focus in and closing restores it

- **WHEN** the user opens the drawer from the header toggle and then presses Escape
- **THEN** focus moved into the drawer on opening, the drawer closes, and focus returns to the toggle

#### Scenario: Choosing the conversation that is already open closes the drawer

- **WHEN** the drawer is open and the user picks the active conversation
- **THEN** the drawer closes although the route did not change

#### Scenario: Navigating from the drawer closes it

- **WHEN** the drawer is open and the user follows the Catalog item
- **THEN** the route changes and the drawer closes

#### Scenario: hide-navigation-menu leaves the chats

- **WHEN** `isEnabled('hide-navigation-menu')` is `true` and the conversation section is on
- **THEN** the drawer renders the conversation block with no items, no user menu and no Usage link

---

### Requirement: Mobile header

In the `mobile` band `Header` (hidden from the `desktop` band) SHALL render a 48px-high row with a 1px `border-b border-b-tertiary` divider and a transparent background, as a three-column grid: on the start side the sidebar toggle (a `GhostIconButton` with the sidebar glyph, mirrored under RTL, named `t('navigation.menu')` ("Navigation menu") — or `t('conversationPanel.chatsAndTasks')` while `hide-navigation-menu` leaves the drawer with the chats alone — under the same name in both states, with `aria-expanded` and `aria-controls`) followed by a New chat button (a plus glyph named `t('buttons.newChat')`); in the middle the logo; on the end side the sources toggle with the right-panel glyph, mirrored under RTL.

The toggle SHALL render when the header is enabled and the drawer is reachable: `hide-navigation-menu` is off, or the conversation section and its panel toggle are both on. The New chat button SHALL render on every route when the header is enabled, `hide-new-conversation` is off and a handler is given. The sources toggle keeps its existing rules. With `header` off and `show-header-logo` on, the row carries only the logo.

#### Scenario: Toggle and plus sit on the start side

- **WHEN** the header is enabled on any route
- **THEN** the sidebar toggle is followed by a New chat button, including on the start page

#### Scenario: The toggle opens the drawer

- **WHEN** the user activates the sidebar toggle
- **THEN** the drawer opens and the toggle reports `aria-expanded="true"`

#### Scenario: hide-navigation-menu with no reachable chats hides the toggle

- **WHEN** `hide-navigation-menu` is on and the conversations section or its panel toggle is off
- **THEN** the header renders no sidebar toggle

---

### Requirement: Existing layout keys in the sidebar

While the sidebar is active, the existing UI-feature keys SHALL keep these meanings:

| Key | Effect in the sidebar |
|---|---|
| `conversations-section` off | No conversation block; header, items and footer remain |
| `conversations-panel-toggle` off | No desktop expand/collapse toggle; the sidebar stays in its initial state, and returns to it when the canvas closes. On mobile it only matters under `hide-navigation-menu`, where it keeps the header toggle |
| `showConversationsSectionByDefault` | Initial state: expanded when on, collapsed when off |
| `hide-conversations-filter` | No filter trigger in the conversation block header |
| `hide-new-conversation` | No New chat item |
| `hide-user-menu` | No user menu in the footer, on desktop and in the mobile drawer (the earlier mobile sheet ignored this key) |
| `hide-settings-page` | No Usage link in the footer and no Settings entry in the user menu |
| `catalog`, `file-manager` | Their items are gated as before |
| `show-header-logo` | The top bar and mobile header logo render as before; the sidebar header logo is unaffected |
| `header` | Hides the mobile header row (and with it the toggle and New chat button) |
| `hide-navigation-menu` | In the mobile drawer: no items, user menu or Usage link. No effect on the desktop column |

#### Scenario: Filter hidden

- **WHEN** `isEnabled('hide-conversations-filter')` is `true`
- **THEN** the conversation block header renders no filter trigger, and every group stays listed

#### Scenario: No toggle keeps the initial state

- **WHEN** `conversations-panel-toggle` is off and `showConversationsSectionByDefault` is on
- **THEN** the sidebar renders expanded with no expand/collapse control

#### Scenario: No toggle recovers from the canvas

- **WHEN** `conversations-panel-toggle` is off, the sidebar is expanded and the attachment canvas opens and then closes
- **THEN** the sidebar is collapsed while the canvas is open and expanded again once it closes

---

### Requirement: Expanded and collapsed states

On desktop the sidebar SHALL have two states; the mobile drawer has only the expanded content (see "Mobile drawer").

**Expanded (336px):**
- a header with the theme logo linking to `/` and a collapse button;
- the navigation items as icon-and-label rows;
- the conversation block (see "Conversation block");
- a footer with the user menu at the inline start and the Usage link at the inline end.

**Collapsed (72px):**
- a header with a single expand button showing the theme favicon at rest and the sidebar glyph on hover and keyboard focus;
- the navigation items as icon-only buttons;
- a footer with the Usage link stacked above the avatar.

The conversation block SHALL stay mounted while collapsed but be `inert`, so none of its controls is focusable or exposed to assistive tech.

The width change SHALL animate, except under `prefers-reduced-motion: reduce`.

**Toggle button:**
- carries `aria-expanded` and `aria-controls` pointing at the sidebar;
- is named `t('navigation.sidebar')` ("Sidebar") in both states, so `aria-expanded` is the only thing that reports the state;
- shows `t('navigation.collapseSidebar')` ("Collapse sidebar") as its tooltip while expanded and `t('navigation.expandSidebar')` ("Expand sidebar") while collapsed.

**RTL:** the sidebar sits at the inline start. All spacing and positioning use logical properties. The sidebar-toggle glyph is mirrored with `rtl:scale-x-[-1]`. The other icons are not mirrored.

#### Scenario: Collapsing hides the conversation block from keyboard and assistive tech

- **WHEN** the user activates "Collapse sidebar"
- **THEN** the sidebar renders at 72px, the toggle reports `aria-expanded="false"` under the same name, and the conversation block is `inert`

#### Scenario: Expanding restores the block

- **WHEN** the user activates "Expand sidebar"
- **THEN** the sidebar renders at 336px with the conversation block interactive again and its scroll position unchanged

#### Scenario: Reduced motion

- **WHEN** the user prefers reduced motion and toggles the sidebar
- **THEN** the width changes without a transition

#### Scenario: RTL placement

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the sidebar sits at the right edge and the toggle glyph is mirrored

---

### Requirement: Sidebar state is owned by ConversationPanelContext and ignores the route

On desktop, `ConversationPanelContext`'s `isPanelOpen` SHALL mean "expanded"; on mobile it is reset and ignored, because the drawer's open state is `isNavOpen` in `app.tsx`. No other state owns the sidebar's width.

`useConversationPanelRouteState` SHALL receive `isSidebarLayout` and, when it is `true`:
- SHALL NOT change the state on any route change, inside or outside the conversation section;
- SHALL start from `showConversationsSectionByDefault` and keep the user's own choice for the rest of the page session.

The state SHALL NOT be persisted across reloads. Opening the attachment canvas, or any existing `closePanel` caller such as `ConversationView` and `useAttachmentCanvasResolvers`, SHALL collapse the sidebar. Expanding the sidebar SHALL close the attachment canvas, as opening the panel does today.

When `isEnabled('conversations-panel-toggle')` is `false`, no toggle SHALL render and the sidebar SHALL stay in its initial state.

#### Scenario: Navigating to another page keeps the sidebar expanded

- **WHEN** the sidebar is expanded and the user navigates from `/conversations/<id>` to `/catalog`
- **THEN** the sidebar stays expanded and the conversation list is visible on the catalog page

#### Scenario: The user's collapse survives navigation

- **WHEN** the user collapses the sidebar and then navigates to `/files` and back to `/`
- **THEN** the sidebar is still collapsed

#### Scenario: Initial state follows showConversationsSectionByDefault

- **WHEN** the page loads with `showConversationsSectionByDefault` disabled
- **THEN** the sidebar starts collapsed

#### Scenario: Reload starts from the default again

- **WHEN** the user collapses the sidebar and reloads the page with `showConversationsSectionByDefault` enabled
- **THEN** the sidebar starts expanded

#### Scenario: Opening the canvas collapses the sidebar

- **WHEN** the sidebar is expanded and an attachment opens in the canvas
- **THEN** the sidebar collapses to 72px

---

### Requirement: Navigation items

The sidebar SHALL render the items from `useNavigationItems`, in `NAVIGATION_CONFIG` order and under the same gates as the rail (see `navigation-routing`):
- New chat (`buttons.newChat`);
- Scheduled tasks;
- Catalog;
- File manager.

**Expanded:** each item is a link row with its icon and visible label.

**Collapsed:** each item is an icon-only link whose label stays in the link as screen-reader text, with the label as its tooltip on pointer hover and keyboard focus.

Each item is the link itself: the host's `renderLink` receives the item's content and the `className` and `aria-current` the link must carry, so no button or other control is nested inside a link.

**Active item:** carries `aria-current="page"`, the selected tint and its filled `activeIcon`.

**Activation:** performs client-side navigation through the host's `renderLink`.

#### Scenario: Items render with labels when expanded

- **WHEN** the sidebar is expanded with the default config and `scheduledTasksEnabled` on
- **THEN** links named "New chat", "Scheduled tasks", "Catalog" and "File manager" render with visible text

#### Scenario: Collapsed items keep their accessible names

- **WHEN** the sidebar is collapsed
- **THEN** each item renders as an icon-only link whose accessible name and tooltip equal its label

#### Scenario: File manager item follows its feature key

- **WHEN** `isEnabled('file-manager')` is `false`
- **THEN** no File manager item renders in either state

---

### Requirement: Conversation block

When `isEnabled('conversations-section')` is `true`, the expanded sidebar SHALL render the conversation block on every route. It is a `section` named `t('conversationPanel.chatsAndTasks')` ("Chats and tasks").

**Header row:**
- **Title.** A button with `aria-expanded` that collapses and expands the list beneath it.
- **Search toggle.** Named `t('conversationPanel.search.open')` ("Search chats"). It replaces the row with a search field (placeholder `basic.searchPlaceholder`, clear button `basic.clearSearch`) and moves focus into it.
- **Close search button.** Named `t('conversationPanel.search.close')` ("Close search"). It closes the field, as Escape does. Closing clears the query and returns focus to the search toggle.
- **Filter trigger.** Named by `conversationPanel.filter.groupAriaLabel`. It opens a single-select menu of All, My chats, Shared and Organization (`conversationPanel.filter.*`, `basic.organization`) that excludes any hidden source and marks the active option with a check.
- **Overflow menu.** The existing panel menu (see `conversation-panel-header-menu`).

**List:**
- **Groups.** Pinned, My chats, Shared and Organization, collapsible, filtered and searched exactly as the panel filters them. Matched text is highlighted with the kit `Highlight`.
- **Rows** use the indicator variant (see `conversation-history-panel`):
  - a hollow leading dot when read;
  - a filled accent dot, a semi-bold title and a visually hidden `unreadIndicatorLabel` when unread;
  - the selected tint and `aria-current="page"` for the active conversation;
  - the row actions trigger on hover and keyboard focus;
  - no deployment avatar and no scheduled-task glyph.
- **Behaviour kept from the panel:** drag-and-drop pinning, per-row actions and the active-row scroll.

**Panel states:** loading (skeleton, announced through the existing live region), empty (`conversationPanel.empty`) and no results (`basic.noResults`). The block's root SHALL carry the celebration history class.

#### Scenario: Conversations are reachable from the file manager

- **WHEN** the user is on `/files` with the sidebar expanded
- **THEN** the conversation list renders and selecting a row navigates to that conversation

#### Scenario: Escape closes the search and clears it

- **WHEN** the search field is open with the text "plot" and the user presses Escape
- **THEN** the field closes, the list shows every conversation again, and focus returns to the "Search chats" button

#### Scenario: Filtering to Shared

- **WHEN** the user picks Shared in the filter menu
- **THEN** only shared conversations remain, and the Shared option is marked as the checked choice

#### Scenario: Unread row presentation

- **WHEN** a conversation has `isUnread: true`
- **THEN** its row shows a filled dot and a semi-bold title, renders no deployment avatar, and announces the unread label

#### Scenario: Conversations section disabled

- **WHEN** `isEnabled('conversations-section')` is `false`
- **THEN** the sidebar renders its header, items and footer but no conversation block

#### Scenario: Empty history

- **WHEN** the user has no conversations
- **THEN** the block shows "No conversations yet" in place of the list

---

### Requirement: Sidebar footer

The footer SHALL render the user menu only when the user is authenticated and `isEnabled('hide-user-menu')` is `false`. While expanded it uses `UserMenu`'s profile trigger (avatar, display name, chevron); while collapsed, the avatar trigger.

The footer SHALL render a Usage link to the standalone Usage page, `ROUTES.Usage` (`/usage`):
- named and tooltipped `t('basic.usage')`;
- carrying `aria-current="page"` on that route;
- omitted when `isEnabled('hide-settings-page')` is `true`.

DOM order SHALL match visual order in both states:
- **expanded:** user menu, then Usage;
- **collapsed:** Usage, then the user menu.

#### Scenario: Usage opens the Settings usage tab

- **WHEN** the user activates the Usage link
- **THEN** the app navigates to `/usage`

#### Scenario: Settings page hidden

- **WHEN** `isEnabled('hide-settings-page')` is `true`
- **THEN** no Usage link renders and the user menu offers no Settings entry

#### Scenario: Collapsed footer focus order

- **WHEN** the sidebar is collapsed and the user tabs through the footer
- **THEN** focus reaches the Usage link before the avatar trigger, matching their top-to-bottom order

---

### Requirement: Desktop top bar

`ChatLayout`'s desktop top bar SHALL render neither the conversation-panel toggle nor the new-chat button, because both live in the sidebar. It SHALL keep the `show-header-logo` logo and the sources toggle in their current positions. `Header` (the mobile header) SHALL be unaffected.

#### Scenario: No duplicate controls above the conversation

- **WHEN** the app is on `/conversations/<id>` at a desktop width
- **THEN** the top bar shows no conversation-panel toggle and no new-chat button, and still shows the sources toggle

---

### Requirement: Library boundary and public API of the new surfaces

`NavigationSidebar` (`libs/navigation-panel`), and `ConversationList` / `ConversationListHeader` (`libs/conversation-panel`), SHALL receive everything host-specific as props:
- resolved logo and favicon URLs;
- translated labels;
- the active flag per item;
- a `renderLink` function;
- booleans for each optional control;
- callbacks;
- slots (`children`, `userMenu`, `footerActions`, `actions`).

They SHALL NOT read feature keys, routes, i18n, theme or session state.

The new elements SHALL carry the new public classes:
- `dial-navigation-panel-sidebar`, `dial-navigation-panel-sidebar-item` and `dial-navigation-panel-sidebar-footer`;
- `dial-cp-list`, `dial-cp-list-header` and `dial-cp-list-section`.

`NavigationSidebar` SHALL take `variant?: NavigationSidebarVariant` (`Sidebar` by default, `Drawer`), `isOpen` (`false` by default), an optional `onClose`, an optional `id` and an optional `labels.close`; the drawer variant is 320px wide, shows a close button instead of the collapse toggle, ignores `isCollapsed`, and owns its position, slide-in, `inert` state, focus handling and Escape dismissal, while the host owns the toggle that sets `isOpen`. `NavigationSidebarVariant` SHALL be exported from `@epam/ai-dial-navigation-panel`. The earlier `NavigationPanel`, `NavigationSheet` and `ConversationPanel` SHALL stay exported and unchanged, so a library host can use the earlier or the new surfaces.

None of the existing public classes SHALL be applied to them. Every color override SHALL map one-to-one onto a CSS custom property its stylesheet reads.

The block's props from `ConversationPanelView` SHALL be referentially stable across unrelated re-renders: labels in `useMemo`, callbacks in `useCallback`. `SidebarNavigation` re-renders with `App`, as `Navigation` does; the memoised `ConversationPanelView` it carries still skips those renders. The existing "Changing the active conversation re-renders only the affected rows" guarantee SHALL hold for `ConversationList`.

**Observability:** none; no events or metrics are added.

#### Scenario: Libs stay host-agnostic

- **WHEN** the source of `NavigationSidebar`, `ConversationList` and `ConversationListHeader` is inspected
- **THEN** it imports no feature-key, router, i18n or app-context module

#### Scenario: New public classes are present and legacy ones are not reused

- **WHEN** the sidebar renders
- **THEN** its root carries `dial-navigation-panel-sidebar` and its list carries `dial-cp-list`, and no element in it carries `dial-navigation-panel-rail`, `dial-sb-aside` or `dial-cp-new-chat-button`

#### Scenario: Selecting another conversation does not re-render the sidebar chrome

- **WHEN** the active conversation changes
- **THEN** `NavigationSidebar`'s props keep their identity, and only the previously and newly active rows re-render

---

### Requirement: Usage is a standalone page

`/usage` SHALL render the usage dashboard as its own page, with the page title and description above the period cards and the model limits table. `/usage` SHALL redirect to `/` when `isEnabled('hide-settings-page')` is `true`. The Settings page SHALL NOT offer a Usage tab in this layout, and `/settings/usage` SHALL redirect to `/usage`. The page title SHALL be the page's `h1` there and an `h2` inside the Settings tab, under the Settings page's own `h1`. The page header's vertical padding is 16px above and below, and the Settings Usage tab uses the same header.

#### Scenario: Usage opens from the footer

- **WHEN** the user activates the Usage link
- **THEN** the usage dashboard renders at `/usage`, and the Usage link carries `aria-current="page"`

#### Scenario: The old Settings URL still lands on Usage

- **WHEN** the user opens `/settings/usage`
- **THEN** the app replaces the URL with `/usage`

---

### Requirement: Settings opens as a dialog

Choosing Settings in the user menu SHALL open a dialog titled `t('basic.settings')` instead of navigating to `/settings`. On a desktop width the dialog has a section list with Preferences; a phone drops the list, as there is one section, and keeps the full width. For the Preferences section the dialog shows the same rows the Settings Preferences tab offers (theme, language, keyboard shortcut, default agent), each under its existing visibility rules.

Edits SHALL be held as a draft. **Save** SHALL write only the changed preferences to their stored values and close the dialog. **Cancel**, the close button and Escape SHALL close it and discard the draft. Each opening SHALL start from the stored values. The dialog SHALL be loaded on demand.

Date and time settings and an Extensions section are not part of this change.

#### Scenario: Save applies the draft

- **WHEN** the user changes the theme in the dialog and presses Save
- **THEN** the theme preference is written once and the dialog closes

#### Scenario: Cancel discards the draft

- **WHEN** the user changes the keyboard shortcut and presses Cancel
- **THEN** no preference is written and the dialog closes

#### Scenario: Nothing applies while editing

- **WHEN** the user changes a row in the dialog without saving
- **THEN** no stored preference changes

---
