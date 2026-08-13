# Mobile Navigation Bottom Sheet

## Purpose

The mobile navigation bottom sheet: its shell primitive, the generic stack navigator, and each page it can show.

## Overview

On mobile viewports the hamburger button opens a multi-page bottom sheet anchored to the bottom of the screen. The sheet provides navigation items (Home, Catalog) and a Profile entry point that leads to user identity, theme selection, keyboard shortcut preference, and logout. Desktop layout and the `DialDropdown`-based `UserMenu` are unchanged.

---

## Requirements

### Requirement: BottomSheetShell primitive (lib)

`BottomSheetShell` from `@epam/ai-dial-conversation-input` SHALL be the generic portal primitive used by this feature.

```ts
interface BottomSheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;           // shown in header; doubles as aria-label
  closeLabel?: string;      // aria-label for × button; required when title is provided
  onBack?: () => void;      // when provided, shows back-arrow button in header
  backLabel?: string;       // aria-label for back button; required when onBack is provided
  'aria-label'?: string;    // accessible name when no title is shown
  className?: string;
}
```

The component renders via `createPortal`, shows a semi-transparent backdrop, locks body scroll while open, closes on Escape and backdrop click, and renders an optional header (back button · centred title · close button) when `title` is provided.

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

`NavigableBottomSheet` at `apps/chat/src/components/NavigableBottomSheet/NavigableBottomSheet.tsx` SHALL wrap `BottomSheetShell` and manage a `SheetPage[]` stack, exposing navigation to all descendants via `SheetNavigationContext`.

Interfaces at `apps/chat/src/models/sheet-navigation.ts`:

```ts
interface SheetPage {
  title: string;
  content: React.ReactNode;
}

interface SheetNavigation {
  push: (page: SheetPage) => void;
  pop: () => void;
  close: () => void;
}
```

Context at `apps/chat/src/context/SheetNavigationContext.tsx`. Hook at `apps/chat/src/hooks/useSheetNavigation.ts` — throws when used outside the provider.

Props:

```ts
interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;       // root-level title (no back button)
  className?: string;
}
```

Rendering rules:
- **Stack empty**: render `children` with `title` prop (no back button).
- **Stack non-empty**: render top page's `content` with `title` from top page and `onBack={pop}`.
- `closeLabel` is `t(NavigationI18nKeys.Close)`, `backLabel` is `t(NavigationI18nKeys.Back)`.
- On `close` (X, backdrop, Escape): clear the stack and call `onClose`.
- Stack resets whenever `isOpen` transitions to `false`.

`push`/`pop`/`close` are stable `useCallback` references. Context value is in `useMemo`.

i18n keys: `navigation.back`, `navigation.close`.

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

On mobile the hamburger button SHALL open `NavigableBottomSheet` (rendered in `Navigation.tsx`) with `NavPageContent` as its root child. `isNavOpen` state remains in `app.tsx`.

i18n keys: `navigation.menu` (root title), `navigation.mobileMenu` (hamburger aria-label).

#### Scenario: Sheet opens on hamburger tap
- **WHEN** the user taps the hamburger on mobile
- **THEN** `NavigableBottomSheet` opens with `NavPageContent` and the root title, no back button

#### Scenario: Sheet closes on backdrop or Escape
- **WHEN** the user taps the backdrop or presses Escape
- **THEN** the sheet closes

---

### Requirement: NavPageContent

The navigation root page SHALL live at `apps/chat/src/components/MobileNavBottomSheet/NavPageContent.tsx`.

Props: `{ onLogoutRequest: () => void }`. It SHALL list navigation items from `NAVIGATION_CONFIG` followed by a Profile row (`IconUser`, `IconChevronRight rtl:scale-x-[-1]`). Nav item tap: `close()` + `useNavigate`. Profile tap: `push({ title: t(NavigationI18nKeys.Profile), content: <ProfilePageContent onLogoutRequest={onLogoutRequest} /> })`.

i18n: `navigation.profile`

#### Scenario: Tapping a navigation item closes the sheet and navigates
- **WHEN** the user taps a row backed by `NAVIGATION_CONFIG`
- **THEN** the sheet closes and the app navigates to that route

#### Scenario: Tapping Profile pushes the profile page
- **WHEN** the user taps the Profile row
- **THEN** `ProfilePageContent` is pushed onto the stack under the Profile title, and the sheet stays open

---

### Requirement: ProfilePageContent

The profile page SHALL live at `apps/chat/src/components/MobileNavBottomSheet/ProfilePageContent.tsx`.

Props: `{ onLogoutRequest: () => void }`. It SHALL read identity data from `useUserProfile()` and available themes from `useTheme()`.

Body:
1. Avatar (40 × 40 px image or `AvatarInitials` fallback) + `DialEllipsisTooltip` display name.
2. Theme row (hidden when `themes.length ≤ 1`): `IconColorSwatch` + label + `IconChevronRight rtl:scale-x-[-1]`. Pushes `ThemePageContent`.
3. Keyboard Shortcuts row: `IconKeyboard` + label + `IconChevronRight rtl:scale-x-[-1]`. Pushes `KeyboardPageContent`.
4. `<hr>` divider.
5. Log out row: `IconLogout` + label. Calls `close()` then `onLogoutRequest()`. `LogoutConfirmationModal` is rendered in `Navigation.tsx` via `useLogout()`, not here.

#### Scenario: Log out closes sheet then opens confirmation
- **WHEN** the user taps Log out
- **THEN** `close()` fires (sheet unmounts), then `onLogoutRequest()` fires, and `LogoutConfirmationModal` opens from `Navigation.tsx`

#### Scenario: Theme row hidden when only one theme
- **WHEN** the API returns only one theme
- **THEN** the Theme row is not rendered

---

### Requirement: ThemePageContent

The theme page SHALL live at `apps/chat/src/components/MobileNavBottomSheet/ThemePageContent.tsx`.

It SHALL read `{ hasDark, hasLight, selectedTheme, setTheme }` from `useThemeOptions()` and render one row per available theme: `IconMoon` (Dark), `IconSun` (Light), `IconDeviceDesktop` (System, only when both dark and light are available). Active selection shows `IconCheck` (`DIAL_ICON_SIZE.SM`). All other icons use `BASE_ICON_SIZE`. Tap: `setTheme(id)` then `pop()`.

#### Scenario: Selecting a theme applies it and returns
- **WHEN** the user taps a theme row
- **THEN** `setTheme` is called with that theme and the sheet pops back to the profile page

#### Scenario: System is offered only when both variants exist
- **WHEN** only a dark theme is available
- **THEN** no System row is rendered

---

### Requirement: KeyboardPageContent

The keyboard-shortcut page SHALL live at `apps/chat/src/components/MobileNavBottomSheet/KeyboardPageContent.tsx`.

It SHALL read the current preference from `useKeyboardShortcutPreference()` and render two rows mirroring the desktop options; the active one shows `IconCheck` (`DIAL_ICON_SIZE.SM`). Tap: `setPreference(value)` then `pop()`.

#### Scenario: Selecting a shortcut persists it and returns
- **WHEN** the user taps the non-active shortcut row
- **THEN** `setPreference` is called with that value and the sheet pops back to the profile page

---

## Shared hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useUserProfile` | `hooks/user-profile/useUserProfile.ts` | `email`, `displayName`, `shortName`, `image`, `isFallbackIconShown` from `useUser()` |
| `useThemeOptions` | `hooks/theme/useThemeOptions.ts` | `hasDark`, `hasLight`, `selectedTheme`, `setTheme` from `useTheme()` |
| `useLogout` | `hooks/logout/useLogout.ts` | `isLogoutOpen`, `openLogout`, `closeLogout` — shared by `UserMenu` and `Navigation` |
