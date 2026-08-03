# Tasks: add-navigation-routing

## Implementation Tasks

### 1. Update navigation config

- [x] Replace stub in `apps/chat/src/constants/navigation.ts`
  - Define `NavigationItem` interface with `path`, `icon` (Tabler FC type), and `labelKey` fields
  - Export `NAVIGATION_CONFIG: NavigationItem[]` with two entries:
    - `{ path: '/', icon: IconHome, labelKey: NavigationI18nKeys.Home }`
    - `{ path: '/catalog', icon: IconBooks, labelKey: NavigationI18nKeys.Catalog }`

### 2. Update Navigation component

- [x] Rewrite `apps/chat/src/components/Navigation/Navigation.tsx`
  - Import `useLocation`, `useNavigate` from `react-router-dom`
  - Import `GhostIconButton` from `@epam/ai-dial-ui-kit`
  - Import `NAVIGATION_CONFIG` from `../../constants/navigation`
  - Import `NavigationI18nKeys` from `../../constants/translation-keys`
  - Add `aria-label={t(NavigationI18nKeys.AriaLabel)}` to `<nav>`
  - In the first `<div>`: map `NAVIGATION_CONFIG` → `GhostIconButton` with icon, active detection, `aria-current`
  - Keep second `<div>` empty (bottom reserved area)
  - Keep `export default memo(Navigation)`

### 3. Create CatalogView component

- [x] Create `apps/chat/src/components/CatalogView/CatalogView.tsx`
  - Stub `FC<CatalogViewProps>` component (empty `CatalogViewProps` interface)
  - Render `<section>` with `aria-label` and a centred "coming soon" paragraph using i18n
  - Wrap with `React.memo`, use `export default`
- [x] Create `apps/chat/src/components/CatalogView/index.ts`
  - `export { default } from './CatalogView';`

### 4. Add i18n keys

- [x] Add two new enums to `apps/chat/src/constants/translation-keys.ts` (existing `ChatI18nKeys` unchanged):
  - `NavigationI18nKeys` with `AriaLabel`, `Home`, `Catalog`
  - `CatalogI18nKeys` with `AriaLabel`, `ComingSoon`
- [x] Add corresponding strings to `apps/chat/src/i18n/locales/en.json`:
  ```json
  "navigation": {
    "ariaLabel": "Main navigation",
    "home": "Home",
    "catalog": "Catalog"
  },
  "catalog": {
    "ariaLabel": "Catalog",
    "comingSoon": "Catalog coming soon"
  }
  ```

### 5. Wire routes in app.tsx

- [x] Update `apps/chat/src/app/app.tsx`
  - Change outer div class from `flex-col` to `flex-row` (sidebar layout)
  - Import `Routes` and `Route` from `react-router-dom`
  - Lazy-load `CatalogView`: `const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'))`
  - Extract the conversation JSX + state logic into `ConversationRoute` component above `App`
  - Replace the existing conditional conversation/welcome render with `<Routes>`
  - Keep `<Suspense>` wrapper inside `ConversationRoute`

### 6. Unit tests for Navigation

- [x] Create `apps/chat/src/components/Navigation/tests/Navigation.spec.tsx`
  - Render `<Navigation />` wrapped in `MemoryRouter` and mock `react-i18next`
  - Assert the nav landmark is present with correct ARIA label
  - Assert Home button renders with correct aria-label
  - Assert Catalog button renders with correct aria-label
  - Assert active button has `aria-current="page"` when route matches

### 7. Unit tests for CatalogView

- [x] Create `apps/chat/src/components/CatalogView/CatalogView.spec.tsx`
  - Render `<CatalogView />` with mock `react-i18next`
  - Assert section landmark present with correct ARIA label
  - Assert "coming soon" text is visible

### 8. Verification

- [ ] Run `npm exec nx lint chat` — fix any lint errors
- [ ] Run `npm exec nx typecheck chat` — fix any type errors
- [ ] Run `npm exec nx test chat` — all tests green
