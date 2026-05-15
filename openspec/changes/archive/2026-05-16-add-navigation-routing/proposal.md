# Proposal: Add Navigation and Routing

## What

Wire React Router v6 `<Routes>` into the app shell and render two routes:

- `/` — default conversation view (existing welcome + chat UI)
- `/catalog` — new Catalog view (stub, to be expanded)

Update `Navigation` to render icon links (from `@tabler/icons-react`) driven by a typed `NAVIGATION_CONFIG` constant, replacing the current placeholder text.

## Why

The app already mounts `BrowserRouter` in `main.tsx` but has no `<Routes>` — every path renders the same `App` component. The `Navigation` sidebar shows literal "d" and "B" placeholder text. This change introduces real client-side routing and turns the sidebar into a functional nav bar.

Without routing, deep-linking to `/catalog` (or any future section) is impossible, and the nav cannot indicate which section is active.

## Proposed Solution

1. **`apps/chat/src/constants/navigation.ts`** — replace the stub array with a typed `NavigationItem[]` that pairs each route path with an icon component and i18n key.

2. **`apps/chat/src/components/Navigation/Navigation.tsx`** — map over `NAVIGATION_CONFIG` and render a `<NavLink>` with the corresponding Tabler icon in the first `<div>`. Highlight the active link with a Tailwind active class.

3. **`apps/chat/src/app/app.tsx`** — wrap the content area in `<Routes>`. The `/` route renders the existing conversation shell inline; the `/catalog` route lazy-loads the new `CatalogView`.

4. **`apps/chat/src/components/CatalogView/CatalogView.tsx`** — new stub component for the catalog page.

5. **Layout fix** — `app.tsx` outer div currently uses `flex-col`, which stacks Navigation on top of main. Switch to `flex-row` so the 60 px sidebar sits beside the main content area.

## Non-Goals

- Implementing actual catalog functionality (stub only)
- Nested routes or guards
- Animated page transitions
- Any backend changes

## i18n Impact

Two new i18n keys are required for nav item ARIA labels:

- `navigation.home`
- `navigation.catalog`

## Existing Pattern Reference

- Routing: `main.tsx` already wraps the app in `BrowserRouter` — follow React Router v6 lazy-route pattern already used for `ConversationView` and `ConversationInput` in `app.tsx`.
- Navigation config type: mirrors the existing `NAVIGATION_CONFIG` stub in `apps/chat/src/constants/navigation.ts`.
