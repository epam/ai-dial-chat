# Mobile Navigation Bottom Sheet

## ADDED Requirements

### Requirement: BottomSheetShell primitive (lib)

`BottomSheetShell` from `@epam/ai-dial-conversation-input` is the generic portal primitive used by this feature. No custom `BottomSheet` component was built.

`BottomSheetShell` API (relevant props):

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

The component:
- Renders via `createPortal` to `document.body`.
- Shows a semi-transparent backdrop; clicking it calls `onClose`.
- Anchors a scrollable panel to the bottom of the screen.
- Locks body scroll while open; restores on close/unmount.
- Closes on Escape key press.
- Renders a header row (back button · centred title · close button) when `title` is provided.

---

### Requirement: NavigableBottomSheet — generic stack navigator

`NavigableBottomSheet` SHALL be at `apps/chat/src/components/NavigableBottomSheet/NavigableBottomSheet.tsx`, built on top of `BottomSheetShell`. It manages a `SheetPage[]` stack and exposes navigation to all descendants via `SheetNavigationContext`.

Interfaces (at `apps/chat/src/models/sheet-navigation.ts`):

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

Context (at `apps/chat/src/context/SheetNavigationContext.tsx`):

```ts
export const SheetNavigationContext = createContext<SheetNavigation | undefined>(undefined);
```

Hook (at `apps/chat/src/hooks/useSheetNavigation.ts`): guard hook that throws when used outside the provider.

`NavigableBottomSheet` props:

```ts
interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Title shown at root level (no back button). Required for accessibility. */
  title: string;
  className?: string;
}
```

Rendering rules:
- **Stack empty**: render `children` via `BottomSheetShell` with `title` prop (root title, no back button).
- **Stack non-empty**: render the top page's `content` via `BottomSheetShell` with `title` from the top page and `onBack={pop}`.
- `closeLabel` is `t(NavigationI18nKeys.Close)`, `backLabel` is `t(NavigationI18nKeys.Back)`.
- On `close` (X button, backdrop, or Escape): clear the stack and call `onClose`.
- On `pop` (back button): remove only the top page.
- Stack resets to empty whenever `isOpen` transitions to `false`.

`push`, `pop`, `close` SHALL be stable references (`useCallback`). Context value SHALL be in `useMemo`.

i18n keys used: `navigation.back` (`NavigationI18nKeys.Back`), `navigation.close` (`NavigationI18nKeys.Close`).

RTL: back arrow uses `rtl:scale-x-[-1]` (applied inside `BottomSheetShell`).

#### Scenario: Root content renders with no back button
- **WHEN** the sheet opens with an empty stack
- **THEN** the root `children` are rendered with the root title but no back button

#### Scenario: Pushing a page shows back button and new content
- **WHEN** a descendant calls `push({ title: 'Profile', content: <ProfilePageContent /> })`
- **THEN** the sheet header shows "Profile" and a back button; `ProfilePageContent` is rendered below

#### Scenario: Back button pops the top page
- **WHEN** the user taps the back arrow
- **THEN** the top page is removed and the previous level is restored

#### Scenario: X button closes the sheet and clears the stack
- **WHEN** the user taps the X button
- **THEN** `close` is called, the stack is cleared, and `onClose` fires

#### Scenario: Stack resets on sheet close
- **WHEN** `isOpen` transitions to `false`
- **THEN** the stack is cleared so the sheet opens at root the next time

#### Scenario: useSheetNavigation throws outside provider
- **WHEN** `useSheetNavigation()` is called outside a `NavigableBottomSheet`
- **THEN** an error is thrown with a descriptive message

---

### Requirement: Hamburger button opens a navigable bottom sheet on mobile

On mobile viewports the hamburger button SHALL open `NavigableBottomSheet` (rendered inside `Navigation.tsx`) with `NavPageContent` as its root child.

i18n: `navigation.menu` (`NavigationI18nKeys.Menu`) is passed as the root `title`. `navigation.mobileMenu` (`NavigationI18nKeys.MobileMenu`) is used as `aria-label` on the hamburger trigger button.

State: `isNavOpen` remains in `app.tsx`, passed as `isOpen` through `Navigation.tsx` to `NavigableBottomSheet`.

#### Scenario: Sheet opens on hamburger tap
- **WHEN** the user taps the hamburger button on a mobile viewport
- **THEN** `NavigableBottomSheet` opens showing `NavPageContent` with the root title and no back button

#### Scenario: Sheet closes on backdrop tap or Escape
- **WHEN** the user taps the backdrop or presses Escape
- **THEN** the sheet closes

---

### Requirement: NavPageContent — navigation items and Profile entry

`apps/chat/src/components/MobileNavBottomSheet/NavPageContent.tsx`

Props:
```ts
interface Props {
  onLogoutRequest: () => void;
}
```

Lists navigation items from `NAVIGATION_CONFIG`, followed by a Profile row (`IconUser`, `IconChevronRight rtl:scale-x-[-1]`). Tapping a navigation item calls `close()` and `useNavigate`. Tapping Profile calls `push({ title: t(NavigationI18nKeys.Profile), content: <ProfilePageContent onLogoutRequest={onLogoutRequest} /> })`.

i18n keys: `navigation.profile`

---

### Requirement: ProfilePageContent — user identity and settings entry points

`apps/chat/src/components/MobileNavBottomSheet/ProfilePageContent.tsx`

Props:
```ts
interface Props {
  onLogoutRequest: () => void;
}
```

Uses `useUserProfile()` for identity data (`displayName`, `shortName`, `image`, `isFallbackIconShown`). Uses `useTheme()` for `themes`.

Body content:
1. User identity: avatar (40 × 40 px image or `AvatarInitials` fallback) + `DialEllipsisTooltip` for display name.
2. Theme row (hidden when `themes.length ≤ 1`): `IconColorSwatch` + label + `IconChevronRight rtl:scale-x-[-1]`. Tapping calls `push({ title: t(SettingsI18nKeys.Theme), content: <ThemePageContent /> })`.
3. Keyboard Shortcuts row: `IconKeyboard` + label + `IconChevronRight rtl:scale-x-[-1]`. Tapping calls `push({ title: t(SettingsI18nKeys.KeyboardShortcuts), content: <KeyboardPageContent /> })`.
4. `<hr>` divider.
5. Log out row: `IconLogout` + label. Tapping calls `close()` then `onLogoutRequest()`. **The `LogoutConfirmationModal` is rendered in `Navigation.tsx`** (not here), managed by `useLogout()`.

#### Scenario: Log out closes sheet and opens confirmation
- **WHEN** the user taps Log out
- **THEN** `close()` is called (sheet closes), then `onLogoutRequest()` fires, and `LogoutConfirmationModal` opens from `Navigation.tsx`

#### Scenario: Theme row hidden when only one theme
- **WHEN** the API returns only one theme option
- **THEN** the Theme row is not rendered

---

### Requirement: ThemePageContent — theme selection

`apps/chat/src/components/MobileNavBottomSheet/ThemePageContent.tsx`

Uses `useThemeOptions()` which returns `{ hasDark, hasLight, selectedTheme, setTheme }`. One row per available theme: `IconMoon` (Dark), `IconSun` (Light), `IconDeviceDesktop` (System — shown only when both dark and light available). Active theme shows `IconCheck` (`DIAL_ICON_SIZE.SM`). Tapping a row calls `setTheme(id)` then `pop()`. All icons use `BASE_ICON_SIZE` except `IconCheck` which uses `DIAL_ICON_SIZE.SM`.

---

### Requirement: KeyboardPageContent — keyboard shortcut preference

`apps/chat/src/components/MobileNavBottomSheet/KeyboardPageContent.tsx`

Uses `useKeyboardShortcutPreference()`. Two rows mirroring the desktop options; active preference shows `IconCheck` (`DIAL_ICON_SIZE.SM`). Tapping a row calls `setPreference(value)` then `pop()`.
