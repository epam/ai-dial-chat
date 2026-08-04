# Design: Add Navigation and Routing

## Overview

Introduce React Router v6 `<Routes>` into the app shell, wire two routes (`/` and `/catalog`), and update the `Navigation` sidebar to render icon links driven by a typed config constant.

## Component Diagram

```
main.tsx
  └─ BrowserRouter (already present)
       └─ ThemeProvider
            └─ App
                 ├─ Navigation (sidebar, 60 px)
                 └─ main
                      ├─ Header
                      └─ Routes
                           ├─ / → ConversationRoute (inline, lazy ConversationView)
                           └─ /catalog → CatalogView (lazy)
```

## Data / Config

### `apps/chat/src/constants/navigation.ts`

Replace the existing stub with a typed constant. Each entry pairs a route path with a Tabler icon component and an i18n key used for the ARIA label.

```typescript
import { IconHome, IconBooks } from '@tabler/icons-react';
import type { FC } from 'react';
import { NavigationI18nKeys } from './translation-keys';

interface NavigationItem {
  path: string;
  icon: FC<{ size?: number; stroke?: number }>;
  labelKey: NavigationI18nKeys;
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  {
    path: '/',
    icon: IconHome,
    labelKey: NavigationI18nKeys.Home,
  },
  {
    path: '/catalog',
    icon: IconBooks,
    labelKey: NavigationI18nKeys.Catalog,
  },
];
```

## Component Designs

### `apps/chat/src/components/Navigation/Navigation.tsx`

Map over `NAVIGATION_CONFIG` and render each item as a `GhostIconButton` from `@epam/ai-dial-ui-kit`. Use `useLocation` + `useNavigate` to determine active state and handle navigation — `NavLink` is avoided because nesting a `<button>` inside an `<a>` is invalid HTML. The first `<div>` holds these icon buttons; the second `<div>` is reserved for bottom actions (unchanged placeholder for now).

```tsx
import { memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GhostIconButton } from '@epam/ai-dial-ui-kit';
import { NAVIGATION_CONFIG } from '../../constants/navigation';
import { NavigationI18nKeys } from '../../constants/translation-keys';

const Navigation: FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      aria-label={t(NavigationI18nKeys.AriaLabel)}
      className="flex h-full w-[60px] flex-col justify-between bg-bg-layer-raised"
    >
      <div className="flex flex-col items-center gap-1 pt-2">
        {NAVIGATION_CONFIG.map(({ path, icon: Icon, labelKey }) => {
          const isActive =
            path === '/' ? pathname === '/' : pathname.startsWith(path);
          return (
            <GhostIconButton
              key={path}
              icon={<Icon size={20} stroke={1.5} />}
              aria-label={t(labelKey)}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => navigate(path)}
            />
          );
        })}
      </div>
      <div />
    </nav>
  );
};

export default memo(Navigation);
```

Key decisions:

- `GhostIconButton` from ui-kit — matches design system ghost icon button style.
- `useLocation` + `useNavigate` instead of `NavLink` — avoids invalid `<button>` inside `<a>` HTML.
- Active route detected with exact match on `/` and `startsWith` for all other paths.
- `aria-current="page"` on the active button preserves screen reader accessibility (equivalent to `NavLink`'s built-in behaviour).

### `apps/chat/src/app/app.tsx`

Two changes:

1. Outer `flex-col` → `flex-row` so `Navigation` is a sidebar.
2. Wrap content area in `<Routes>` with two lazy-loaded routes.

The existing conversation logic (messages state, `handleSend`, `isAssistantTyping`) moves into a new `ConversationRoute` component co-located in `app.tsx` or extracted to its own file. For minimal scope, keep it inline as a named inner component.

```tsx
import { Routes, Route } from 'react-router-dom';

const ConversationRoute: FC = () => {
  // existing messages state, handleSend, isAssistantTyping logic
  // ...
  return (/* existing conversation JSX */);
};

const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));

function App() {
  return (
    <div className="flex size-full flex-row">   {/* flex-row for sidebar layout */}
      <Navigation />
      <main
        id="main-content"
        role="main"
        className="flex min-h-0 flex-1 flex-col"
      >
        <Header />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<ConversationRoute />} />
            <Route path="/catalog" element={<CatalogView />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
```

### `apps/chat/src/components/CatalogView/CatalogView.tsx`

Stub component. Renders a centered placeholder with an i18n title. Follows the component folder convention (own folder + `index.ts` barrel).

```tsx
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CatalogI18nKeys } from '../../constants/translation-keys';

interface CatalogViewProps {}

const CatalogView: FC<CatalogViewProps> = () => {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t(CatalogI18nKeys.AriaLabel)}
      className="flex h-full items-center justify-center"
    >
      <p className="text-secondary">{t(CatalogI18nKeys.ComingSoon)}</p>
    </section>
  );
};

export default memo(CatalogView);
```

## i18n Keys

Add two new enums to `apps/chat/src/constants/translation-keys.ts`, each scoped to one domain. The existing `ChatI18nKeys` is left unchanged.

```typescript
// existing — unchanged
export enum ChatI18nKeys {
  LanguageEn = 'language.en',
  LanguageUk = 'language.uk',
}

export enum NavigationI18nKeys {
  AriaLabel = 'navigation.ariaLabel',
  Home = 'navigation.home',
  Catalog = 'navigation.catalog',
}

export enum CatalogI18nKeys {
  AriaLabel = 'catalog.ariaLabel',
  ComingSoon = 'catalog.comingSoon',
}
```

Add the corresponding strings to `apps/chat/src/i18n/locales/en.json`:

```json
{
  "navigation": {
    "ariaLabel": "Main navigation",
    "home": "Home",
    "catalog": "Catalog"
  },
  "catalog": {
    "ariaLabel": "Catalog",
    "comingSoon": "Catalog coming soon"
  }
}
```

Use the scoped enum in each file — never raw string literals:

```tsx
t(NavigationI18nKeys.Home);
t(CatalogI18nKeys.ComingSoon);
```

## Accessibility

- `<nav>` has `aria-label` from i18n.
- Each `<NavLink>` has `aria-label` for icon-only buttons.
- Active state is communicated visually (accent background) and via `aria-current="page"` (set automatically by React Router's `NavLink`).

## Memoisation

- `Navigation` wrapped in `React.memo` (already present).
- `CatalogView` wrapped in `React.memo`.
- `ConversationRoute` does not need memo — it is a route root and renders once per navigation.

## No Backend Changes

All changes are frontend-only. No new API endpoints.
