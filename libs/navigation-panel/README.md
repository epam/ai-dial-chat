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

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-conversation-input`
- `@epam/ai-dial-ui-kit`
- `@tabler/icons-react`

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

### UserMenu

Avatar trigger plus dropdown: identity row, one submenu per settings group, divider, log-out entry. The host owns the log-out confirmation flow — `onLogout` only signals intent.

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
  }}
  onLogout={openLogoutConfirmation}
/>
```

### NavigationSheet

The mobile counterpart. `onSelectItem` fires after the sheet closes so the host can navigate.

```tsx
<NavigationSheet
  isOpen={isOpen}
  onClose={close}
  items={items}
  onSelectItem={(item) => navigate(item.id)}
  profile={profile}
  groups={[keyboardGroup]}
  onLogout={openLogoutConfirmation}
  footer={<FooterMessage />}
  labels={{
    title: t(NavigationI18nKeys.Menu),
    close: t(ButtonsI18nKeys.Close),
    back: t(NavigationI18nKeys.Back),
    profile: t(NavigationI18nKeys.Profile),
    logOut: t(ButtonsI18nKeys.LogOut),
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

### Shared primitives

`UserAvatar` (image with initials fallback), `AvatarInitials` (circular initials badge), and `MenuItemLabel` (dropdown row label with an active check mark).

## Hooks

### useSheetNavigation

```tsx
import { useSheetNavigation } from '@epam/ai-dial-navigation-panel';

const { push, pop, close } = useSheetNavigation();
```

Throws when called outside a `NavigableBottomSheet`.

## Theming

Colors come from CSS custom properties with DIAL token fallbacks, overridable through each component's `styles.colors`. The rail reads `--np-bg`, `--np-item-text`, `--np-item-active-text`, `--np-item-hover-bg`, and `--np-item-active-bg`; the menus and sheet read `--np-menu-text`, `--np-menu-active-icon`, `--np-avatar-bg`, `--np-avatar-text`, `--np-trigger-hover-bg`, `--np-sheet-text`, `--np-sheet-icon`, `--np-sheet-item-hover`, `--np-sheet-item-active`, and `--np-sheet-divider`.

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
