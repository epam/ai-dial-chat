# @epam/ai-dial-navigation-panel

Primary application navigation: the desktop nav rail, the user menu, and the mobile navigation bottom sheet.

## Overview

`@epam/ai-dial-navigation-panel` owns the chrome a host application uses to move between its top-level destinations. On wide viewports that is `NavigationPanel` — a 60 px vertical rail with a brand mark, one icon button per destination, and a pinned footer slot holding `UserMenu`. On narrow viewports the same destinations appear in `NavigationSheet`, a bottom sheet whose root page lists the destinations plus a profile entry, and whose settings drill down through an in-sheet page stack (`NavigableBottomSheet` + `useSheetNavigation`).

Everything in this library is presentational. It knows nothing about routing, feature flags, authentication, i18n, or REST endpoints — the host resolves all of that and passes the result in: translated labels, an `isActive` flag per destination, a resolved logo URL, a `renderLink` function that wraps rail items in the host's router link, and `NavigationMenuGroup` objects describing single-select settings (locale, keyboard shortcuts, theme). The same group objects render as dropdown submenus on desktop and as pushed pages on mobile, so a host declares each setting once.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-navigation-panel": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-navigation-panel/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Components

### NavigationPanel

The desktop rail. Renders the logo, one `IconButton` per item, and the footer slot.

```tsx
import { NavigationPanel, UserMenu } from '@epam/ai-dial-navigation-panel';
import { Link } from 'react-router';

<NavigationPanel
  items={items}
  labels={{ ariaLabel: t(NavigationI18nKeys.AriaLabel) }}
  logo={{ iconUrl: resolvedFaviconUrl, ariaLabel: t(ChatI18nKeys.Logo) }}
  renderLink={(item, children) => (
    <Link to={item.id} className="contents">
      {children}
    </Link>
  )}
  footer={<UserMenu {...userMenuProps} />}
/>;
```

Without `renderLink` each item is wrapped in a plain `<a href={item.href}>`, so supply `href` when relying on the default.

### NavigationSidebar

The merged sidebar: the brand mark with a collapse toggle, the destinations, a
slot for content between them and the footer (typically the conversation
list), and a footer for the user menu and one more action. It is 336px wide
expanded and 72px collapsed. `NavigationPanel` stays the icon rail; a host
picks one or the other.

```tsx
import { NavigationSidebar, UserMenu } from '@epam/ai-dial-navigation-panel';
import { Link } from 'react-router';

<NavigationSidebar
  items={items}
  labels={{
    ariaLabel: t(NavigationI18nKeys.AriaLabel),
    toggle: t(NavigationI18nKeys.Sidebar),
    collapse: t(NavigationI18nKeys.CollapseSidebar),
    expand: t(NavigationI18nKeys.ExpandSidebar),
  }}
  logo={{
    ariaLabel: t(ChatI18nKeys.Logo),
    logoUrl: resolvedLogoUrl,
    iconUrl: resolvedFaviconUrl,
  }}
  isCollapsed={isCollapsed}
  onToggleCollapse={toggleCollapsed}
  renderLink={(item, children, linkProps) => (
    <Link to={item.id} {...linkProps}>
      {children}
    </Link>
  )}
  userMenu={<UserMenu {...userMenuProps} />}
  footerActions={<UsageLink />}
>
  <ChatList />
</NavigationSidebar>;
```

Expanded, each item is a row with its icon and label; collapsed, an icon-only
button named by the label, with the label as its tooltip. The active item
carries `aria-current="page"` and is filled the way the rail's is (its
`activeIcon`, or the outline `icon` filled in place).

The toggle carries `aria-expanded` and `aria-controls` pointing at the
sidebar, and is named `labels.toggle` in both states: `aria-expanded` reports
whether the sidebar is expanded, while `labels.collapse` and `labels.expand`
are its tooltip. Without
`onToggleCollapse` no toggle renders and the logo is a plain link. Collapsed, the
header is the toggle itself: the favicon at rest, the sidebar glyph on hover and
keyboard focus. The glyph is mirrored under `dir="rtl"`.

`variant={NavigationSidebarVariant.Drawer}` lays the same content out as a
320px panel for a narrow viewport: the header carries the logo and a close
button (`onClose`, named by `labels.close`) instead of the collapse toggle,
`isCollapsed` is ignored, and the items sit closer to the edge. The component
owns the drawer behaviour: it is fixed to the start edge and slides in
(mirrored under `dir="rtl"`) when `isOpen` turns `true`, is `inert` and hidden
while `isOpen` is `false` (its default), moves focus into itself on opening and back to the
control that opened it on closing, and calls `onClose` on an Escape pressed
inside it (one that comes from a dialog its children render elsewhere in the DOM is ignored). `id` names the
`<nav>` element, so the host's toggle can point `aria-controls` at it. The host
still owns the toggle that sets `isOpen`, the backdrop if it wants one, and
closing on navigation. A drawer with no backdrop leaves the page behind it
reachable by Tab and screen readers, so the host should make that page `inert`
while the drawer is open. If the opener sits inside that page, the browser moves
focus off it as the page becomes inert, so the drawer records the page body and
closing leaves focus there instead of on the opener.

Each item is one link: `renderLink(item, children, linkProps)` receives the icon and the label as `children` and the `className` and `aria-current` the link must carry, so spread `linkProps` onto the element you render. No control is nested inside it. Collapsed, the label stays in the link as screen-reader text and a tooltip shows it on hover and keyboard focus. Without `renderLink` each item is a plain `<a href={item.href}>`.

`children` stay mounted while collapsed, so a list keeps its scroll position,
but they are `inert` and hidden. The footer's DOM order follows the visual
order: `userMenu` then `footerActions` expanded, the reverse collapsed. As with
the rail, the width animates except under `prefers-reduced-motion: reduce`.

### UserMenu

Avatar trigger plus dropdown: identity row, one submenu per settings group, divider, log-out entry. The host owns the log-out confirmation flow — `onLogout` only signals intent. Pass `onSettings` with `labels.settings` to add a Settings entry between the divider and Log out; omit both to hide it.

```tsx
<UserMenu
  profile={{
    email,
    displayName,
    shortName,
    imageUrl,
    isFallbackShown,
    onImageError,
  }}
  groups={[languageGroup, keyboardGroup]}
  labels={{
    trigger: t(AuthI18nKeys.SignedInAs, { email }),
    avatarAlt: t(AuthI18nKeys.UserAvatar),
    logOut: t(ButtonsI18nKeys.LogOut),
    settings: t(BasicI18nKeys.Settings),
  }}
  onLogout={openLogoutConfirmation}
  onSettings={() => navigate(ROUTES.Settings)}
/>
```

`UserMenu` takes `triggerVariant`. `UserMenuTriggerVariant.Avatar` (the default)
is the avatar-only trigger above. `UserMenuTriggerVariant.Profile` draws the
avatar, the display name (truncated with a tooltip) and a chevron that flips
while the menu is open, and opens the menu at the start edge; it is the trigger
for the expanded `NavigationSidebar` footer. `UserMenuTriggerVariant.Compact` draws the avatar alone in a 40px pill and
also opens the menu at the start edge; it is the collapsed sidebar's footer.
The menu's items are the same in all three. `Avatar` and `Compact` are named by `labels.trigger`; `Profile` is named by its visible display name followed by `labels.trigger`, so the name a voice-control user reads off the screen activates it.

Pass `isIdentityHidden` to drop the identity row (avatar initials and display name) from the top of the dropdown, for a host whose trigger already shows the name. The divider then renders only when a settings group sits above it, so the menu never opens on a divider. The trigger is unchanged.

```tsx
<UserMenu
  profile={profile}
  labels={labels}
  triggerVariant={UserMenuTriggerVariant.Profile}
  isIdentityHidden
  onLogout={openLogoutConfirmation}
/>
```

### NavigationSheet

The mobile counterpart. `onSelectItem` fires after the sheet closes so the host can navigate. Pass `onSettings` with `labels.settings` to add a Settings row to the profile page, above Log out — the sheet closes first, then the host navigates, the same entry `UserMenu` offers on desktop.

```tsx
<NavigationSheet
  isOpen={isOpen}
  onClose={close}
  items={items}
  onSelectItem={(item) => navigate(item.id)}
  profile={profile}
  groups={[keyboardGroup]}
  onLogout={openLogoutConfirmation}
  onSettings={() => navigate(ROUTES.Settings)}
  footer={<FooterMessage />}
  labels={{
    title: t('Menu'),
    close: t(ButtonsI18nKeys.Close),
    back: t(NavigationI18nKeys.Back),
    profile: t('Profile'),
    logOut: t(ButtonsI18nKeys.LogOut),
    settings: t(BasicI18nKeys.Settings),
  }}
/>
```

### NavigableBottomSheet

The page-stack shell `NavigationSheet` is built on, exported for hosts that need their own sheet flows. Content pushes and pops pages via `useSheetNavigation`; the header swaps its title and shows a back button while a page is on the stack.

```tsx
<NavigableBottomSheet
  isOpen={isOpen}
  onClose={close}
  title="Menu"
  closeLabel="Close"
  backLabel="Back"
>
  {rootContent}
</NavigableBottomSheet>
```

### Page and row building blocks

`NavigationMenuPage`, `ProfilePage`, `OptionListPage`, and `SheetRow` are the sheet's internals, exported so a host can assemble a different page order or add its own rows.

A `SheetRow` marks state through two props: `isCurrent` sets `aria-current="true"`, and `isHighlighted` draws the accent in-navigation tint. `NavigationMenuPage` passes each destination's `isActive` to both, so the sheet marks the open section the way the desktop rail does; `OptionListPage` passes only `isCurrent`, since a value list marks its choice with the trailing check rather than a tint.

### Shared primitives

`UserAvatar` (image with initials fallback) and `AvatarInitials` (circular initials badge), both drawn by the UI kit's `Avatar`. Only the image is named by `alt`; the initials badge is decorative. Both take the initials' type step from a prop defaulting to `'dial-tiny-text'` (`UserAvatar`'s `initialsClassName`, `AvatarInitials`' `textClassName`); `UserMenuTypography` and `NavigationSheetTypography` forward it as `avatarInitialsClassName`.

`UserMenu`'s submenu rows mark the applied option through the UI kit's own `MenuItemMark.Check`, so the trailing check and the `menuitemradio` role come from `Dropdown` rather than from this library.

## Hooks

### useSheetNavigation

```tsx
import { useSheetNavigation } from '@epam/ai-dial-navigation-panel';

const { push, pop, close } = useSheetNavigation();
```

Throws when called outside a `NavigableBottomSheet`.

## Theming

Colors come from CSS custom properties with DIAL token fallbacks, overridable through each component's `styles.colors`. The rail reads `--np-bg`, `--np-item-text`, `--np-item-active-text`, `--np-item-selected-bg`, `--np-item-hover-bg`, `--np-item-hover-icon` (the icon stroke on hover), `--np-item-active-icon` (the active icon paint), and `--np-item-active-bg`; both icon vars default to a built-in blue-to-violet gradient. The active item is always filled, in the rail and in the sheet: an item that sets `activeIcon` swaps to that filled glyph, painted by `fill` instead of `stroke`, and an item without one fills its outline `icon` in place (`fill` plus `stroke`); the sidebar reads `--np-sidebar-bg`, `--np-sidebar-item-text`, `--np-sidebar-item-hover-bg`, `--np-sidebar-item-selected-bg`, `--np-sidebar-item-active-icon` (a built-in blue-to-violet gradient by default, whose ends are `--np-sidebar-gradient-start` and `--np-sidebar-gradient-end`), `--np-sidebar-focus-outline` and `--np-sidebar-font-family`; the menus and sheet read `--np-menu-text`, `--np-menu-active-icon`, `--np-avatar-bg`, `--np-avatar-text`, `--np-trigger-hover-bg` (hover and keyboard focus), `--np-trigger-open-bg` (the `Profile` and `Compact` triggers while the menu is open), `--np-focus-outline` (the trigger focus ring, `UserMenuColors.focusOutline`), `--np-sheet-text`, `--np-sheet-icon`, `--np-sheet-item-hover`, `--np-sheet-item-active`, `--np-sheet-divider`, and `--np-sheet-muted-text` (the profile page display name, `NavigationSheetColors.mutedText`).

## Enums

```tsx
import {
  NavigationSidebarVariant,
  UserMenuTriggerVariant,
} from '@epam/ai-dial-navigation-panel';

NavigationSidebarVariant.Sidebar; // 'sidebar' — collapsible column, 336px / 72px
NavigationSidebarVariant.Drawer; // 'drawer' — 320px panel with a close button

UserMenuTriggerVariant.Avatar; // 'avatar' — avatar only, in a 60px square
UserMenuTriggerVariant.Profile; // 'profile' — avatar, name and chevron
UserMenuTriggerVariant.Compact; // 'compact' — avatar only, in a 40px pill
```

## Types

```tsx
import type {
  NavigationItemIcon,
  NavigationLinkRenderer,
  NavigationMenuGroup,
  NavigationMenuOption,
  NavigationPanelColors,
  NavigationPanelItem,
  NavigationPanelLabels,
  NavigationPanelLogo,
  NavigationPanelProps,
  NavigationPanelStyles,
  NavigationPanelTypography,
  NavigationSidebarColors,
  NavigationSidebarLabels,
  NavigationSidebarLogo,
  NavigationSidebarProps,
  NavigationSidebarStyles,
  NavigationSidebarTypography,
  NavigationSheetColors,
  NavigationSheetLabels,
  NavigationSheetProps,
  NavigationSheetStyles,
  NavigationSheetTypography,
  NavigationUserProfile,
  SheetNavigation,
  SheetPage,
  UserMenuColors,
  UserMenuLabels,
  UserMenuProps,
  UserMenuStyles,
  UserMenuTypography,
} from '@epam/ai-dial-navigation-panel';
```

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key    | Class                        | Element                               |
| ------ | ---------------------------- | ------------------------------------- |
| `rail` | `dial-navigation-panel-rail` | The `nav` rail itself                 |
| `item` | `dial-navigation-panel-item` | Every item in the rail, active or not |

```tsx
import { NAVIGATION_PANEL_CLASS } from '@epam/ai-dial-navigation-panel';

NAVIGATION_PANEL_CLASS.item; // 'dial-navigation-panel-item'
```

`role="navigation"` stays an accessibility contract: use `dial-navigation-panel-rail`
as the selector instead.

`NavigationSidebar` has its own classes; the rail's two are not reused on it.

| Key             | Class                                  | Element                                     |
| --------------- | -------------------------------------- | ------------------------------------------- |
| `sidebar`       | `dial-navigation-panel-sidebar`        | The sidebar's `nav`                         |
| `sidebarItem`   | `dial-navigation-panel-sidebar-item`   | Every item in the sidebar, active or not    |
| `sidebarFooter` | `dial-navigation-panel-sidebar-footer` | The footer holding the user menu and action |

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
