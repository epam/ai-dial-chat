## Context

On mobile the navigation sidebar collapses into a left-edge drawer (portal overlay). At the bottom of that drawer sits `UserMenu`, which renders a `DialDropdown` pointing upward. The dropdown is awkward on touch devices: small tap target, off-screen arrow placement, and no affordance for deeper settings levels. The burger button in `Header.tsx` owns the `isNavOpen` toggle that today controls this drawer; `app.tsx` owns the `isNavOpen` state.

The redesign keeps the desktop path entirely untouched and adds a parallel mobile code path: the hamburger now opens a bottom sheet that provides a multi-page settings hierarchy without deep re-architecture.

## Goals / Non-Goals

**Goals:**
- Replace the left-edge mobile drawer + UserMenu dropdown with a bottom-anchored sheet on mobile only.
- Support three levels of navigation within the sheet (Nav page → Profile page → Theme/Keyboard page).
- Long user display name shows a tooltip on tap.
- RTL-safe layout throughout.
- No regressions on desktop.

**Non-Goals:**
- Changing the desktop sidebar or `DialDropdown`-based `UserMenu`.
- Adding new settings (language, etc.) to the mobile sheet beyond what the desktop menu offers today.
- Persistence of which sheet page was open across sessions.
- Animated page transitions (slide/fade) — static swap is acceptable for the initial cut.

## Decisions

### Decision 1 — Use `BottomSheetShell` from `@epam/ai-dial-conversation-input`, not a custom primitive

**Chosen**: Adopt `BottomSheetShell` from the `conversation-input` lib instead of building a custom component. `BottomSheetShell` provides portal rendering, semi-transparent backdrop, bottom-anchored scrollable panel, body-scroll lock, Escape-close, and an optional header (back button + centred title + close button) — all the requirements from the original plan.

**Alternatives considered**:
- Custom `BottomSheet` component — was the original plan, but `BottomSheetShell` already implements everything needed and is already a project dependency.
- `react-spring-bottom-sheet` / `vaul` — adds a dependency for a surface we control entirely.

**Rationale**: `BottomSheetShell` was already present in the lib and covers the full spec. Using it avoids duplicating ~80 lines of portal/overlay/focus-trap logic and keeps the generic primitive in the lib where it belongs.

### Decision 2 — Generic `NavigableBottomSheet` with page stack + React Context

**Chosen**: Introduce a generic `NavigableBottomSheet` component (built on `BottomSheet`) that manages a `SheetPage[]` stack internally and exposes navigation to any descendant via `SheetNavigationContext`. No component is hard-wired to any other; each page content component calls `push`, `pop`, or `close` from `useSheetNavigation()` independently.

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

Rendering logic inside `NavigableBottomSheet`:
- **Stack empty** (root): render `children` with no header bar. The sheet closes via backdrop/Escape.
- **Stack non-empty**: render a generic `SheetHeader` (back → `pop`, title from top of stack, X → `close`) followed by `stack[stack.length - 1].content`.
- On `onClose` (from parent or X button): clear the stack, then call the parent `onClose` prop.

`useSheetNavigation()` is a guard hook (throws if used outside the provider) — same pattern as `useTheme`.

**Alternatives considered**:
- Hardwired enum orchestrator — any new page requires editing the orchestrator; pages are coupled through it.
- React Router sub-routes — addressable URLs are unnecessary overhead for transient sheet UI.
- Prop-drilled callbacks — `onNavigateToProfile`, `onNavigateToTheme`, etc. are as tightly coupled as the enum but also verbose.

**Rationale**: The stack + context approach lets each page content component declare what it pushes without knowing anything about siblings or the orchestrator. Adding or reordering pages in the future requires no changes to `NavigableBottomSheet` itself.

### Decision 3 — `UserMenu` renders `null` on mobile

**Chosen**: In `UserMenu.tsx` call `useIsMobile()` and return `null` when true. The mobile sheet takes over the settings surface entirely.

**Alternatives considered**:
- Prop-gate the dropdown from `Navigation.tsx` — would require passing a prop through the component tree; the hook approach is cleaner and co-located with the guard.

**Rationale**: Matches the existing `hideTooltip={isMobile}` pattern already in `UserMenu`.

### Decision 4 — `DialEllipsisTooltip` for long display names (triggered on tap)

**Chosen**: Wrap the user display name on the Profile page in `DialEllipsisTooltip`, which already handles hover and (on touch devices via pointer events) tap to reveal the full name.

**Alternatives considered**:
- Custom `onClick` + manual tooltip state — more code for the same result.

**Rationale**: `DialEllipsisTooltip` is already used in the desktop `user-menu` spec for the same truncation case.

### Decision 5 — Component and file locations

| Path | What |
|------|------|
| `@epam/ai-dial-conversation-input` (lib) | `BottomSheetShell` — generic portal primitive (no custom `BottomSheet` built) |
| `apps/chat/src/components/NavigableBottomSheet/` | Generic stack navigator: `NavigableBottomSheet.tsx` only (no `SheetHeader.tsx` — header rendered by `BottomSheetShell`) |
| `apps/chat/src/context/SheetNavigationContext.tsx` | Navigation context (co-located with other app contexts, not inside `NavigableBottomSheet/`) |
| `apps/chat/src/models/sheet-navigation.ts` | `SheetPage` and `SheetNavigation` interfaces (co-located with other app models) |
| `apps/chat/src/hooks/useSheetNavigation.ts` | Guard hook for `SheetNavigationContext` |
| `apps/chat/src/components/MobileNavBottomSheet/` | App-specific page content: `NavPageContent.tsx`, `ProfilePageContent.tsx`, `ThemePageContent.tsx`, `KeyboardPageContent.tsx` |

### Decision 6 — Shared hooks for duplicated user/theme/logout logic

**Chosen**: Extract three hooks to eliminate logic duplicated between `UserMenu` (desktop) and the mobile page components:

| Hook | Location | Consumers |
|------|----------|-----------|
| `useUserProfile` | `hooks/user-profile/useUserProfile.ts` | `UserMenu`, `ProfilePageContent` |
| `useThemeOptions` | `hooks/theme/useThemeOptions.ts` | `UserMenu`, `ThemePageContent` |
| `useLogout` | `hooks/logout/useLogout.ts` | `UserMenu`, `Navigation` |

### Decision 7 — Logout state lifted to `Navigation`, not local to `ProfilePageContent`

**Chosen**: `LogoutConfirmationModal` is rendered in `Navigation.tsx` (always mounted), not inside `ProfilePageContent` (a sheet page that is unmounted when the sheet closes). `useLogout()` manages `isLogoutOpen` state. An `onLogoutRequest` callback prop flows `Navigation` → `NavPageContent` → `ProfilePageContent`.

**Rationale**: When `close()` is called inside the sheet, `ProfilePageContent` is unmounted before any `setState` can take effect, so a modal rendered there would never open. Lifting to `Navigation` ensures the modal stays mounted after the sheet closes.

## Risks / Trade-offs

[Scroll-lock conflict] → On iOS Safari, `overflow: hidden` on `body` can cause layout shifts. Mitigation: use the existing `useBodyScrollLock` pattern from the Navigation drawer, which already handles this case.

[Focus trap] → Without a focus trap, keyboard and screen-reader users can tab outside the sheet. Mitigation: implemented in `BottomSheet` (already locked down in the spec — not deferred).

[Back navigation ambiguity] → Browser hardware back button does not pop the sheet page stack. Mitigation: out of scope for initial cut; document as a known gap. The X button always fully closes the sheet.

[`useIsMobile` SSR] → Not a concern; the app is a CSR-only SPA.

## Migration Plan

1. Add `BottomSheet` primitive.
2. Add `MobileNavBottomSheet` with all pages.
3. Wire hamburger → sheet in `Navigation.tsx` / `app.tsx` (keep `isNavOpen` state, pass it to sheet).
4. Guard `UserMenu` with `useIsMobile()` → return null.
5. Remove the portal drawer block from `Navigation.tsx` (the 60px-wide mobile drawer and its backdrop).
6. Add i18n keys.
7. Lint + typecheck + unit tests.

Rollback: revert the `Navigation.tsx` change (re-enable drawer) and remove the `useIsMobile` guard in `UserMenu`.

## Open Questions

- Should the sheet support swipe-down to dismiss? (Deferred — not in scope for initial cut.)
- Should Language appear in the mobile sheet? (Proposal excludes it for now — desktop-only.)
- Exact max-height of the sheet — `85vh` is a starting point; design review may adjust.
