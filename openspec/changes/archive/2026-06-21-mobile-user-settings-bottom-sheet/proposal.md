## Why

The mobile navigation drawer opens from the left and places the user menu avatar at the bottom — a pattern borrowed from desktop that is ergonomically awkward on phones, buries settings behind a small avatar target, and provides no discoverable path to profile or settings. A bottom sheet anchored to the bottom of the screen matches thumb-reachable mobile UX patterns and surfaces profile and settings at the same level as navigation.

## What Changes

- The hamburger button now opens a **bottom sheet** (slides up from the bottom of the screen) instead of a left-edge drawer.
- The bottom sheet's first "page" lists all navigation items (Home, Catalog) plus a dedicated **Profile** row.
- Tapping **Profile** navigates to a second page inside the same sheet: a structured settings view with user identity, Theme, Keyboard Shortcuts, a divider, and Logout.
- Tapping **Theme** or **Keyboard Shortcuts** navigates to a third-level page showing the available options with a back button.
- Each inner page has a header row: a back-arrow button (start), a centred title, and an X close button (end).
- When the user's display name overflows its container, tapping the name shows a tooltip with the full name.
- Desktop layout and the `DialDropdown`-based `UserMenu` are **unchanged**.
- The existing left-edge mobile drawer is **removed**; its navigation items are absorbed by the bottom sheet.

## Capabilities

### New Capabilities

- `mobile-navigation-bottom-sheet`: Multi-page bottom sheet that opens from the hamburger button on mobile, containing navigation items, a Profile entry point, and nested settings panels for Profile, Theme, and Keyboard Shortcuts.

### Modified Capabilities

- `user-menu`: Desktop dropdown behaviour is unchanged. On mobile the dropdown is no longer rendered; the bottom sheet owns the mobile settings surface instead.

## Impact

- **Modified components**: `Navigation.tsx` (remove drawer, wire hamburger to sheet), `UserMenu.tsx` (suppress dropdown render on mobile), `Header.tsx` (hamburger callback unchanged but now triggers sheet).
- **New components**: `MobileNavBottomSheet` and its page sub-components (`NavPage`, `ProfilePage`, `ThemePage`, `KeyboardPage`), a generic `BottomSheet` primitive.
- **No backend changes** — purely a frontend rendering change.
- **i18n**: new keys for sheet headers and the Profile navigation label.
- **Existing specs touched**: `user-menu` (mobile suppression), `keyboard-shortcut-preference` (page renders same options), `language-selector` (not exposed in bottom sheet — language stays desktop-only for now).
