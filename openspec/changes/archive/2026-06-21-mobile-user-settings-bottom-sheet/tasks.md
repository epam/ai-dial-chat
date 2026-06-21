## 1. BottomSheet primitive

> **Implementation note**: no custom `BottomSheet` was built. All items below were satisfied by adopting `BottomSheetShell` from `@epam/ai-dial-conversation-input`, which provides portal rendering, backdrop, bottom-anchored panel, body-scroll lock, Escape-close, and a header with back/close buttons.

- [x] 1.1 Use `BottomSheetShell` from `@epam/ai-dial-conversation-input` instead of a custom primitive — it renders via `createPortal`, shows a semi-transparent backdrop, anchors a scrollable panel to the bottom, and accepts `title`, `closeLabel`, `onBack`, `backLabel`, `aria-label`, `className` props
- [x] 1.2 Body-scroll lock — handled internally by `BottomSheetShell` via `useBottomSheet`
- [x] 1.3 Focus handling and Escape-close — handled internally by `BottomSheetShell`
- [x] 1.4 Backdrop click closes the sheet — handled internally by `BottomSheetShell`
- [~] 1.5 Unit tests for `BottomSheet` — not applicable; `BottomSheetShell` is a lib component with its own test coverage

## 2. NavigableBottomSheet — generic stack navigator

- [x] 2.1 Define `SheetPage` (`{ title: string; content: React.ReactNode }`) and `SheetNavigation` (`{ push, pop, close }`) interfaces — located at `apps/chat/src/models/sheet-navigation.ts` (not `NavigableBottomSheet/types.ts`)
- [x] 2.2 Create `SheetNavigationContext` — located at `apps/chat/src/context/SheetNavigationContext.tsx` (not inside the `NavigableBottomSheet` folder)
- [x] 2.3 Create `apps/chat/src/hooks/useSheetNavigation.ts` — guard hook; `push`/`pop`/`close` are stable via `useCallback` inside `NavigableBottomSheet`
- [~] 2.4 `SheetHeader.tsx` — **not built as a separate component**; `BottomSheetShell` renders the header internally when a `title` prop is provided (back button shown when `onBack` is passed)
- [x] 2.5 Create `apps/chat/src/components/NavigableBottomSheet/NavigableBottomSheet.tsx` — wraps `BottomSheetShell`; owns `stack: SheetPage[]`; provides `SheetNavigationContext`; passes `title`, `onBack`, `backLabel`, `closeLabel` from stack state to `BottomSheetShell`; clears stack when `isOpen` goes `false`; context value in `useMemo`
- [x] 2.6 Add i18n keys — added `navigation.back`, `navigation.close`, `navigation.menu`, `navigation.profile`, `navigation.mobileMenu` (keys are under `navigation.*`, not `common.*`)
- [x] 2.7 Unit tests for `NavigableBottomSheet` — `apps/chat/src/components/NavigableBottomSheet/tests/NavigableBottomSheet.spec.tsx`

## 3. NavPageContent

- [x] 3.1 Create `apps/chat/src/components/MobileNavBottomSheet/NavPageContent.tsx` — renders navigation items from `NAVIGATION_CONFIG` + Profile row (`IconUser`, `IconChevronRight rtl:scale-x-[-1]`); accepts `onLogoutRequest: () => void` prop (forwarded to `ProfilePageContent`); uses `useSheetNavigation()` for `close`/`push`; uses `useNavigate` for routing
- [x] 3.2 Add i18n key `navigation.profile` to `en.json`

## 4. ProfilePageContent

- [x] 4.1 Create `apps/chat/src/components/MobileNavBottomSheet/ProfilePageContent.tsx` — user avatar + `DialEllipsisTooltip` display name, Theme row (hidden when ≤ 1 theme), Keyboard Shortcuts row, `<hr>`, Log out row; uses `useSheetNavigation()` for `push`/`close`; uses `useUserProfile()` for identity data
- [x] 4.2 Wire Log out — **changed from spec**: `ProfilePageContent` accepts `onLogoutRequest: () => void` prop; on Log out tap calls `close()` then `onLogoutRequest()`. `LogoutConfirmationModal` is rendered in `Navigation.tsx` (not in `ProfilePageContent`), managed by `useLogout()` hook. Prop chain: `Navigation` → `NavPageContent.onLogoutRequest` → `ProfilePageContent.onLogoutRequest`.

## 5. ThemePageContent

- [x] 5.1 Create `apps/chat/src/components/MobileNavBottomSheet/ThemePageContent.tsx` — one row per available theme with icon and `IconCheck` on active selection; uses `useThemeOptions()` for `hasDark`/`hasLight`/`selectedTheme`/`setTheme`; uses `useSheetNavigation().pop()` after selection

## 6. KeyboardPageContent

- [x] 6.1 Create `apps/chat/src/components/MobileNavBottomSheet/KeyboardPageContent.tsx` — two option rows with `IconCheck` on active preference; uses `useKeyboardShortcutPreference()`; uses `useSheetNavigation().pop()` after selection

## 7. Wire into Navigation and app

- [x] 7.1 `Navigation.tsx` — renders `NavigableBottomSheet` with `NavPageContent` as child; passes `isOpen`, `onClose`, `title={t(NavigationI18nKeys.Menu)}`; renders `LogoutConfirmationModal` managed by `useLogout()`; passes `openLogout` to `NavPageContent` as `onLogoutRequest`
- [x] 7.2 Removed the portal-based left-edge mobile drawer and its backdrop from `Navigation.tsx`
- [x] 7.3 Added i18n key `navigation.mobileMenu`
- [x] 7.4 `app.tsx` `isNavOpen` / `toggleNav` / `closeNav` wiring unchanged

## 8. Suppress UserMenu on mobile

- [x] 8.1 `UserMenu.tsx` — `useIsMobile()` added; returns `null` on mobile
- [x] 8.2 Desktop dropdown and existing behaviour unchanged

## 9. Refactoring — shared hooks

> Extracted duplicate logic from `UserMenu` and the mobile page content components into shared hooks.

- [x] 9.1 Create `apps/chat/src/hooks/user-profile/useUserProfile.ts` — returns `{ email, displayName, shortName, image, isFallbackIconShown, setIsFallbackIconShown }` from `useUser()`; used by `UserMenu` and `ProfilePageContent`
- [x] 9.2 Create `apps/chat/src/hooks/theme/useThemeOptions.ts` — wraps `useTheme()` and adds `{ hasDark, hasLight }`; used by `UserMenu` and `ThemePageContent`
- [x] 9.3 Create `apps/chat/src/hooks/logout/useLogout.ts` — returns `{ isLogoutOpen, openLogout, closeLogout }`; used by `UserMenu` and `Navigation`

## 10. File relocations

- [x] 10.1 Move `NavigableBottomSheet/types.ts` → `apps/chat/src/models/sheet-navigation.ts`
- [x] 10.2 Move `NavigableBottomSheet/SheetNavigationContext.tsx` → `apps/chat/src/context/SheetNavigationContext.tsx`

## 11. Verification

- [x] 11.1 Run `npm exec nx lint chat` and fix any errors
- [x] 11.2 Run `npm exec nx typecheck chat` and resolve all type errors
- [x] 11.3 Run `npm exec nx test chat` — confirm no regressions
- [ ] 11.4 Manual smoke test on mobile viewport: open sheet, navigate to Profile, change theme, change keyboard shortcut, log out flow, back navigation at each level, X close, Escape close, RTL layout check
