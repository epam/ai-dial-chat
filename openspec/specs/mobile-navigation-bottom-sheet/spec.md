# Mobile Navigation Bottom Sheet

## Overview

On mobile viewports the hamburger button opens a multi-page bottom sheet anchored to the bottom of the screen. The sheet provides navigation items (Home, Catalog) and a Profile entry point that leads to user identity, theme selection, keyboard shortcut preference, and logout. Desktop layout and the `DialDropdown`-based `UserMenu` are unchanged.

---

## Requirement: BottomSheetShell primitive (lib)

`BottomSheetShell` from `@epam/ai-dial-conversation-input` is the generic portal primitive used by this feature.

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

---

## Requirement: NavigableBottomSheet — generic stack navigator

`NavigableBottomSheet` at `apps/chat/src/components/NavigableBottomSheet/NavigableBottomSheet.tsx` wraps `BottomSheetShell` and manages a `SheetPage[]` stack, exposing navigation to all descendants via `SheetNavigationContext`.

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

## Requirement: Hamburger button opens the sheet on mobile

On mobile the hamburger button SHALL open `NavigableBottomSheet` (rendered in `Navigation.tsx`) with `NavPageContent` as its root child. `isNavOpen` state remains in `app.tsx`.

i18n keys: `navigation.menu` (root title), `navigation.mobileMenu` (hamburger aria-label).

#### Scenario: Sheet opens on hamburger tap
- **WHEN** the user taps the hamburger on mobile
- **THEN** `NavigableBottomSheet` opens with `NavPageContent` and the root title, no back button

#### Scenario: Sheet closes on backdrop or Escape
- **WHEN** the user taps the backdrop or presses Escape
- **THEN** the sheet closes

---

## Requirement: NavPageContent

`apps/chat/src/components/MobileNavBottomSheet/NavPageContent.tsx`

Props: `{ onLogoutRequest: () => void }`. Lists navigation items from `NAVIGATION_CONFIG` then a Profile row (`IconUser`, `IconChevronRight rtl:scale-x-[-1]`). Nav item tap: `close()` + `useNavigate`. Profile tap: `push({ title: t(NavigationI18nKeys.Profile), content: <ProfilePageContent onLogoutRequest={onLogoutRequest} /> })`.

i18n: `navigation.profile`

---

## Requirement: ProfilePageContent

`apps/chat/src/components/MobileNavBottomSheet/ProfilePageContent.tsx`

Props: `{ onLogoutRequest: () => void }`. Uses `useUserProfile()` for identity data; `useTheme()` for `themes`.

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

## Requirement: ThemePageContent

`apps/chat/src/components/MobileNavBottomSheet/ThemePageContent.tsx`

Uses `useThemeOptions()` → `{ hasDark, hasLight, selectedTheme, setTheme }`. One row per available theme: `IconMoon` (Dark), `IconSun` (Light), `IconDeviceDesktop` (System, only when both dark and light available). Active selection shows `IconCheck` (`DIAL_ICON_SIZE.SM`). All other icons use `BASE_ICON_SIZE`. Tap: `setTheme(id)` then `pop()`.

---

## Requirement: KeyboardPageContent

`apps/chat/src/components/MobileNavBottomSheet/KeyboardPageContent.tsx`

Uses `useKeyboardShortcutPreference()`. Two rows mirroring the desktop options; active shows `IconCheck` (`DIAL_ICON_SIZE.SM`). Tap: `setPreference(value)` then `pop()`.

---

## Shared hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useUserProfile` | `hooks/user-profile/useUserProfile.ts` | `email`, `displayName`, `shortName`, `image`, `isFallbackIconShown` from `useUser()` |
| `useThemeOptions` | `hooks/theme/useThemeOptions.ts` | `hasDark`, `hasLight`, `selectedTheme`, `setTheme` from `useTheme()` |
| `useLogout` | `hooks/logout/useLogout.ts` | `isLogoutOpen`, `openLogout`, `closeLogout` — shared by `UserMenu` and `Navigation` |
