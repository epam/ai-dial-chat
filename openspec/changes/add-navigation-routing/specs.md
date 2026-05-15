# Specs: Add Navigation and Routing

## State Ownership

Navigation state (current active route) is owned entirely by **React Router** via `BrowserRouter` (already mounted in `main.tsx`). No custom context, hook, or component state is introduced for routing.

Component-level state in `ConversationRoute`:

| State          | Owner             | Type            | Persistence              |
|----------------|-------------------|-----------------|--------------------------|
| `messages`     | `ConversationRoute` | `Message[]`   | `localStorage` (key: `chat-messages`) |
| `isAssistantTyping` | `ConversationRoute` | `boolean` | React state, ephemeral   |

No new context providers are required. `Navigation` reads router state via `useLocation()` — it is a consumer of React Router context, not an owner.

## Route Configuration

| Path       | Component            | Lazy-loaded | Fallback       |
|------------|----------------------|-------------|----------------|
| `/`        | `ConversationRoute`  | No (inline) | n/a            |
| `/catalog` | `CatalogView`        | Yes         | Loading spinner |

`ConversationRoute` is an inline named component defined in `apps/chat/src/app/app.tsx`. It is not lazy-loaded because it contains the primary app flow and its code is already bundled with `app.tsx`.

`CatalogView` is lazy-loaded via:
```typescript
const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));
```

No route guards, redirects, or 404 handling are specified in this change.

## Component Contracts

### `NavigationItem` (config type)

```typescript
// apps/chat/src/constants/navigation.ts
interface NavigationItem {
  path: string;                                       // absolute path, e.g. '/' or '/catalog'
  icon: FC<{ size?: number; stroke?: number }>;       // Tabler icon component
  labelKey: NavigationI18nKeys;                       // i18n key for aria-label
}
```

### `Navigation` component

```typescript
// apps/chat/src/components/Navigation/Navigation.tsx
// Props: none
// Reads: useLocation().pathname, useNavigate(), useTranslation()
// Renders: <nav> with NAVIGATION_CONFIG mapped to DialGhostIconButton
// Exported: export default memo(Navigation)
```

Active route detection rules:
- Path `'/'` — exact match: `pathname === '/'`
- All other paths — prefix match: `pathname.startsWith(path)`

### `CatalogView` component

```typescript
// apps/chat/src/components/CatalogView/CatalogView.tsx
// Props: none
// Renders: <section> placeholder with i18n coming-soon text
// Exported: export default memo(CatalogView)
```

## i18n Keys

All new user-visible strings are accessed via enum members — never raw string literals.

### `NavigationI18nKeys` (new enum)

| Member      | Key                    | English value      | Usage                          |
|-------------|------------------------|--------------------|--------------------------------|
| `AriaLabel` | `navigation.ariaLabel` | "Main navigation"  | `<nav aria-label>`             |
| `Home`      | `navigation.home`      | "Home"             | Home button `aria-label`       |
| `Catalog`   | `navigation.catalog`   | "Catalog"          | Catalog button `aria-label`    |

### `CatalogI18nKeys` (new enum)

| Member       | Key                  | English value            | Usage                       |
|--------------|----------------------|--------------------------|-----------------------------|
| `AriaLabel`  | `catalog.ariaLabel`  | "Catalog"                | `<section aria-label>`      |
| `ComingSoon` | `catalog.comingSoon` | "Catalog coming soon"    | Placeholder paragraph text  |

Both enums are defined in `apps/chat/src/constants/translation-keys.ts`. The existing `ChatI18nKeys` enum is unchanged.

## Accessibility

### ARIA

| Element                        | Attribute          | Value                              |
|--------------------------------|--------------------|------------------------------------|
| `<nav>`                        | `aria-label`       | `t(NavigationI18nKeys.AriaLabel)`  |
| `DialGhostIconButton` (active) | `aria-current`     | `"page"`                           |
| `DialGhostIconButton` (inactive)| `aria-current`    | absent (not rendered)              |
| `DialGhostIconButton`          | `aria-label`       | `t(labelKey)` — icon-only button   |
| `<main>`                       | `role`             | `"main"` (existing, unchanged)     |

### Keyboard Navigation

- `Tab` moves focus between nav buttons in DOM order (top-to-bottom).
- `Enter` / `Space` on a focused `DialGhostIconButton` triggers `onClick` → `navigate(path)`.
- No custom keyboard handling is required; the button's native behaviour covers it.

### Focus Management

No programmatic focus movement on route change. The browser retains focus on the clicked nav button after navigation; route content becomes available below.

## Memoisation

| Component / value    | Mechanism           | Reason                                             |
|----------------------|---------------------|----------------------------------------------------|
| `Navigation`         | `React.memo`        | Already memoised; re-renders only when router context changes |
| `CatalogView`        | `React.memo`        | Stub with no props; memo prevents any parent re-render cost |
| `ConversationRoute`  | None                | Route root — mounts/unmounts on navigation; memo provides no benefit |
| `handleSend`         | `useCallback([t])`  | Existing callback; stable across renders           |
| `NAVIGATION_CONFIG`  | Module-level const  | Defined outside component; no memoisation needed   |

## No Backend Changes

This change is entirely frontend. No new NestJS endpoints, no rate limiting, no cache keys.
