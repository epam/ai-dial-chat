# mobile-navigation-bottom-sheet Specification

## Purpose

The mobile navigation bottom sheet: its shell primitive, the generic stack navigator, and each page it can show.

## Overview

On mobile viewports the header hamburger opens a multi-page bottom sheet anchored to the bottom of the screen. The sheet lists the navigation destinations and a Profile entry point that leads to user identity, host-supplied settings groups (today only the keyboard-shortcut preference), an optional Settings link, and logout. Theme selection is not offered in the sheet; it lives only in the Settings page's Preferences tab.

The sheet is a generic, prop-driven component in `libs/navigation-panel` (`@epam/ai-dial-navigation-panel`): `NavigationSheet`, `NavigableBottomSheet`, `NavigationMenuPage`, `ProfilePage`, `OptionListPage`, `SheetRow`, and `useSheetNavigation`. The lib does no i18n, routing, or feature gating. `apps/chat/src/components/Navigation/Navigation.tsx` resolves labels with `t()`, builds the items, profile, and settings groups, performs navigation, and owns the logout confirmation. On desktop the same app shell renders the lib's `NavigationPanel` rail, whose footer holds the lib's `UserMenu` (a 2.0 `Dropdown`).

---

## Requirements

### Requirement: BottomSheetShell primitive (lib)

`BottomSheetShell` from `@epam/ai-dial-conversation-input` SHALL be the generic portal primitive used by this feature.

```ts
interface BottomSheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;           // shown in header; doubles as the dialog accessible name
  closeLabel?: string;      // aria-label for × button; required when title is provided
  onBack?: () => void;      // when provided, shows back-arrow button in header
  backLabel?: string;       // aria-label for back button; required when onBack is provided
  'aria-label'?: string;    // accessible name when no title is shown
  style?: CSSProperties;    // CSS custom properties forwarded to the sheet root
  titleClassName?: string;  // defaults to 'dial-body-semi-text'
  className?: string;
  colors?: BottomSheetShellColors;
}
```

The component is a thin themed wrapper over the UI kit's `BottomSheet` (`@epam/ai-dial-ui-kit`): it maps `isOpen`/`onClose`/`title`/`aria-label`/`onBack` to the kit's `open`/`onClose`/`title`/`ariaLabel`/`onBack`, `backLabel`/`closeLabel` to `backAriaLabel`/`closeAriaLabel`, and applies `colors` as `--ci-backdrop`/`--ci-sheet-bg`/`--ci-sheet-text`/`--ci-sheet-divider` CSS variables (via `buildCssVars`) on both the panel and the backdrop, with the caller's `style` merged onto the panel after them. The kit's `BottomSheet` owns the portal, the semi-transparent backdrop, body-scroll locking, Escape and backdrop-click dismissal, dialog focus management, and the optional header (back button · centred title · close button) shown when `title` is provided.

#### Scenario: An open sheet locks the page behind it
- **WHEN** `BottomSheetShell` is rendered with `isOpen`
- **THEN** it is portalled above the page with a semi-transparent backdrop and body scroll is locked until it closes

#### Scenario: Escape and backdrop both dismiss
- **WHEN** the user presses Escape or taps the backdrop
- **THEN** `onClose` fires

#### Scenario: The header appears only with a title
- **WHEN** `title` is provided together with `onBack`
- **THEN** the header renders the back button, the centred title, and the close button, each labelled by `backLabel` / `closeLabel`
- **AND** omitting `title` renders no header, with the sheet named by its `aria-label`

---

### Requirement: NavigableBottomSheet — generic stack navigator

`NavigableBottomSheet` at `libs/navigation-panel/src/components/NavigationSheet/NavigableBottomSheet.tsx` SHALL wrap `BottomSheetShell` and manage a `SheetPage[]` stack, exposing navigation to all descendants via `SheetNavigationContext`.

Interfaces at `libs/navigation-panel/src/models/sheet-navigation.ts` (both exported from the lib):

```ts
interface SheetPage {
  title: string;
  content: ReactNode;
}

interface SheetNavigation {
  push: (page: SheetPage) => void;
  pop: () => void;
  close: () => void;
}
```

Context at `libs/navigation-panel/src/context/SheetNavigationContext.ts`. Hook `useSheetNavigation` at `libs/navigation-panel/src/hooks/useSheetNavigation.ts` (exported from the lib) — throws `useSheetNavigation must be used within a NavigableBottomSheet` when used outside the provider.

Props (`NavigableBottomSheetProps`):

```ts
interface NavigableBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;       // root-level title (no back button)
  closeLabel: string;  // caller-localised
  backLabel: string;   // caller-localised
  className?: string;
  style?: CSSProperties;
}
```

Rendering rules:
- **Stack empty**: render `children` with `title` (no back button).
- **Stack non-empty**: render the top page's `content` with the top page's `title`, `onBack={pop}`, and `backLabel`.
- `closeLabel` and `backLabel` come from props; the navigator does no i18n.
- On `close` (X, backdrop, Escape): clear the stack and call `onClose`.
- Stack resets whenever `isOpen` transitions to `false`.

`push`/`pop`/`close` are stable `useCallback` references. Context value is in `useMemo`.

#### Scenario: Root content renders without back button
- **WHEN** the sheet opens with an empty stack
- **THEN** the root `children` are rendered with the root title but no back button

#### Scenario: Pushing a page shows back button and new content
- **WHEN** a descendant calls `push({ title, content })`
- **THEN** the sheet header shows the new title and a back button; the new content renders below

#### Scenario: Back button pops the top page
- **WHEN** the user taps the back arrow
- **THEN** the top page is removed and the previous level is restored

#### Scenario: X button closes the sheet and clears the stack
- **WHEN** the user taps X
- **THEN** the stack is cleared and `onClose` fires

#### Scenario: Stack resets on sheet close
- **WHEN** `isOpen` transitions to `false`
- **THEN** the stack clears so the sheet opens at root next time

---

### Requirement: Hamburger button opens the sheet on mobile

On mobile the hamburger button in `apps/chat/src/components/Header/Header.tsx` (the `desktop:hidden` header) SHALL toggle `isNavOpen`, which stays in `app.tsx` and is passed to `Navigation` as `isOpen`/`onClose`. The hamburger's `aria-label` is `t(NavigationI18nKeys.OpenMenu)` (`navigation.openMenu`); it renders only when the header is enabled and `OverlayFeature.HideNavigationMenu` is not set.

`Navigation.tsx` SHALL render the lib's `NavigationSheet` (unless `OverlayFeature.HideNavigationMenu` is set, in which case it is unmounted) with `items` (from `useNavigationItems`), `onSelectItem` (calls `navigate(item.id)`), `profile` (from `useNavigationUserProfile`), `groups` (the keyboard group only, see `OptionListPage`), `onLogout={openLogout}`, `onSettings` (navigates to `ROUTES.Settings`; omitted when `OverlayFeature.HideSettingsPage` is set), `footer={<FooterMessage />}`, and labels `{ title: navigation.menu, close: buttons.close, back: navigation.back, profile: navigation.profile, logOut: buttons.logOut, settings: basic.settings }`. `NavigationSheet` renders `NavigableBottomSheet` with `NavigationMenuPage` as its root child.

#### Scenario: Sheet opens on hamburger tap
- **WHEN** the user taps the hamburger on mobile
- **THEN** `NavigationSheet` opens with `NavigationMenuPage` and the `navigation.menu` title, no back button

#### Scenario: Sheet closes on backdrop or Escape
- **WHEN** the user taps the backdrop or presses Escape
- **THEN** the sheet closes

#### Scenario: Hidden navigation menu removes the sheet and hamburger
- **WHEN** `OverlayFeature.HideNavigationMenu` is set
- **THEN** neither the hamburger button nor `NavigationSheet` is rendered

---

### Requirement: NavigationMenuPage

The navigation root page SHALL be `NavigationMenuPage` at `libs/navigation-panel/src/components/NavigationSheet/NavigationMenuPage.tsx`.

It SHALL render one `SheetRow` per entry in `items` (the active item shows its `activeIcon` when provided and is marked current/highlighted), followed by a Profile row (`IconUser`, label `profileLabel`, no trailing chevron) only when `profile` is provided, then `footer`. Item tap: `close()` then `onSelectItem(item)`; the host performs the navigation. Profile tap: `push({ title: profileLabel, content: <ProfilePage … /> })`, forwarding `profile`, `groups`, `logOutLabel`, `onLogout`, `settingsLabel`, `onSettings`, and `textClassName`.

#### Scenario: Tapping a navigation item closes the sheet and navigates
- **WHEN** the user taps a destination row
- **THEN** the sheet closes and `onSelectItem` is called with that item, which `Navigation.tsx` turns into `navigate(item.id)`

#### Scenario: Tapping Profile pushes the profile page
- **WHEN** the user taps the Profile row
- **THEN** `ProfilePage` is pushed onto the stack under the Profile title, and the sheet stays open

#### Scenario: No profile hides the Profile row
- **WHEN** `profile` is not provided
- **THEN** no Profile row is rendered

---

### Requirement: ProfilePage

The profile page SHALL be `ProfilePage` at `libs/navigation-panel/src/components/NavigationSheet/ProfilePage.tsx`. It receives the signed-in user as a `NavigationUserProfile` prop; the app builds it in `useNavigationUserProfile` from `useUserProfile()`.

Body:
1. Identity row: `UserAvatar` (image or `AvatarInitials` fallback) + 2.0 `EllipsisTooltip` display name.
2. One row per settings group in `groups` that has at least one option: the group's `icon` + `label` + trailing `IconChevronRight` (`rtl:scale-x-[-1]`). Tap pushes `{ title: group.label, content: <OptionListPage options={group.options} /> }`.
3. `<hr>` divider, rendered only when at least one group row is rendered.
4. Settings row (`IconSettings` + `settingsLabel`), rendered only when both `onSettings` and `settingsLabel` are provided. Tap calls `close()` then `onSettings()`.
5. Log out row: `IconLogout` + `logOutLabel`. Calls `close()` then `onLogout()`. `LogoutConfirmationModal` is rendered in `Navigation.tsx` via `useLogout()`, not here.

There is no Theme row.

#### Scenario: Log out closes sheet then opens confirmation
- **WHEN** the user taps Log out
- **THEN** `close()` fires, then `onLogout()` fires, and `LogoutConfirmationModal` opens from `Navigation.tsx`

#### Scenario: Settings row navigates to the Settings page
- **WHEN** `onSettings` is provided and the user taps the Settings row
- **THEN** the sheet closes and the app navigates to `ROUTES.Settings`

#### Scenario: Empty groups render no group rows and no divider
- **WHEN** `groups` is omitted or every group has no options
- **THEN** no group row and no `<hr>` divider are rendered

---

### Requirement: OptionListPage

Single-select settings pages SHALL be rendered by `OptionListPage` at `libs/navigation-panel/src/components/NavigationSheet/OptionListPage.tsx`, one row per `NavigationMenuOption` (`{ id, label, isActive, icon?, onSelect }`). The active option is marked current and shows a trailing `IconCheck` (`DIAL_ICON_SIZE.SM`). Tap: `option.onSelect()` then `pop()`.

The app's `useNavigationMenuGroups()` (`apps/chat/src/hooks/navigation/useNavigationMenuGroups.tsx`) builds the only group the sheet receives today, `keyboardGroup` (`IconKeyboard`, `settings.keyboardShortcuts`), with two options, `SendOnEnter.Enter` and `SendOnEnter.MetaEnter`, read from and written through `useKeyboardShortcutPreference()`. `keyboardGroup` is `undefined` (so no row is shown) when `OverlayFeature.HideUserSettings` or `OverlayFeature.HideKeyboardShortcuts` is set. The hook's `languageGroup` is passed only to the desktop `UserMenu`.

#### Scenario: Selecting a shortcut persists it and returns
- **WHEN** the user taps the non-active shortcut row
- **THEN** `setPreference` is called with that value and the sheet pops back to the profile page

#### Scenario: Hidden keyboard shortcuts remove the group
- **WHEN** `OverlayFeature.HideKeyboardShortcuts` or `OverlayFeature.HideUserSettings` is set
- **THEN** the profile page shows no Keyboard Shortcuts row

---

## Shared hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useUserProfile` | `apps/chat/src/hooks/user-profile/useUserProfile.ts` | `email`, `displayName`, `shortName`, `image`, `isFallbackIconShown` from `useUser()` |
| `useNavigationUserProfile` | `apps/chat/src/hooks/navigation/useNavigationUserProfile.ts` | adapts `useUserProfile()` to the lib's `NavigationUserProfile` |
| `useNavigationMenuGroups` | `apps/chat/src/hooks/navigation/useNavigationMenuGroups.tsx` | `languageGroup` (desktop `UserMenu`) and `keyboardGroup` (mobile sheet) |
| `useLogout` | `apps/chat/src/hooks/logout/useLogout.ts` | `isLogoutOpen`, `openLogout`, `closeLogout` — used by `Navigation` for both `UserMenu` and `NavigationSheet` |
