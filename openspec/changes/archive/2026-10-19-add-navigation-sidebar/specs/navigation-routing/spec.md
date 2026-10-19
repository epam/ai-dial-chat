## REMOVED Requirements

### Requirement: Navigation rail reflects the active route via aria-current

**Reason**: The application no longer mounts the desktop rail or the mobile sheet; one sidebar (column on desktop, drawer on mobile) is the navigation.

**Migration**: Replaced by "Sidebar items reflect the active route via aria-current".

### Requirement: Navigation buttons perform client-side navigation

**Reason**: The application no longer mounts the desktop rail or the mobile sheet; one sidebar (column on desktop, drawer on mobile) is the navigation.

**Migration**: Replaced by "Sidebar items navigate client-side".

### Requirement: Navigation is driven by NAVIGATION_CONFIG

**Reason**: The application no longer mounts the desktop rail or the mobile sheet; one sidebar (column on desktop, drawer on mobile) is the navigation.

**Migration**: Replaced by "The sidebar is driven by NAVIGATION_CONFIG".

### Requirement: Navigation sidebar exposes accessible labels and tooltip

**Reason**: The application no longer mounts the desktop rail or the mobile sheet; one sidebar (column on desktop, drawer on mobile) is the navigation.

**Migration**: Replaced by "Sidebar items expose accessible labels and tooltips".

### Requirement: UserMenu renders for authenticated users only

**Reason**: The application no longer mounts the desktop rail or the mobile sheet; one sidebar (column on desktop, drawer on mobile) is the navigation.

**Migration**: Replaced by "The sidebar's user menu renders for authenticated users only".

### Requirement: Tests cover the navigation surface

**Reason**: The application no longer mounts the desktop rail or the mobile sheet; one sidebar (column on desktop, drawer on mobile) is the navigation.

**Migration**: Replaced by "SidebarNavigation has a co-located spec".

## MODIFIED Requirements

### Requirement: All new user-visible strings flow through react-i18next

Every user-visible navigation string MUST be looked up via `useTranslation().t()`. Keys MUST live in `apps/chat/src/i18n/locales/en.json` and be referenced through typed enums in `apps/chat/src/constants/translation-keys.ts` (`NavigationI18nKeys`, `AuthI18nKeys`, `ButtonsI18nKeys`, `BasicI18nKeys`, `ChatI18nKeys`). No hard-coded English strings are permitted in `SidebarNavigation.tsx`.

#### Scenario: Navigation keys are present in en.json

- **WHEN** the locale file is inspected
- **THEN** `en.json` contains `navigation.ariaLabel`, `navigation.catalog`, `navigation.openMenu`, `navigation.back`, `navigation.collapseSidebar`, and `navigation.expandSidebar`

#### Scenario: Components use the t function

- **WHEN** any string is rendered by `SidebarNavigation`
- **THEN** that string is the result of `t(SomeI18nKeys.Member)`, never a string literal

## ADDED Requirements

### Requirement: Sidebar items reflect the active route via aria-current

`useNavigationItems` (`apps/chat/src/hooks/navigation/useNavigationItems.ts`) SHALL read `useLocation().pathname` and set each item's `isActive`:
- an item with `isExactMatch` (the `ROUTES.Root` item) is active only on an exact match of its `path`; inside a conversation the active state belongs to the conversation's row, not to New chat;
- every other item is active when the pathname starts with its `path` or one of its `matchPaths`.

`NavigationSidebar` from `@epam/ai-dial-navigation-panel` SHALL render each item with `aria-current="page"` only while it is active, swapping to the item's filled `activeIcon` glyph when one is configured. The same items feed the desktop column and the mobile drawer.

#### Scenario: New chat is active on /

- **WHEN** the current pathname is `/`
- **THEN** the New chat item has `aria-current="page"` and the catalog item does NOT have `aria-current`

#### Scenario: New chat is not active inside a conversation

- **WHEN** the current pathname is `/conversations/<id>`
- **THEN** the New chat item does NOT have `aria-current="page"`

#### Scenario: Catalog is active on /catalog

- **WHEN** the current pathname is `/catalog`
- **THEN** the Catalog item has `aria-current="page"` and the New chat item does NOT have `aria-current`

### Requirement: Sidebar items navigate client-side

Each item MUST be wrapped by the `renderLink` callback `SidebarNavigation` passes to `NavigationSidebar`, which renders a React Router `<Link to={item.id}>` (the item's `path`), in the desktop column and in the mobile drawer alike. Navigation MUST be client-side (no full page reload).

#### Scenario: Clicking New chat navigates to /

- **WHEN** the user clicks New chat while on `/catalog`
- **THEN** the client-side router navigates to `'/'` and the `/` route is rendered

#### Scenario: Clicking Catalog navigates to /catalog

- **WHEN** the user clicks the Catalog item while on `/`
- **THEN** the client-side router navigates to `'/catalog'` and the `/catalog` route is rendered

### Requirement: The sidebar is driven by NAVIGATION_CONFIG

`SidebarNavigation` (`apps/chat/src/components/Navigation/SidebarNavigation.tsx`) SHALL NOT hard-code route paths or icon components. It MUST render the items from `useNavigationItems`, which maps the exported `NAVIGATION_CONFIG` constant from `apps/chat/src/constants/navigation.ts` (today: New chat `ROUTES.Root`, Scheduled tasks `ROUTES.ScheduledTasks`, Catalog `ROUTES.Catalog`, File manager `ROUTES.FileManager`) after filtering it through `useVisibleNavItems`. Adding a new entry to `NAVIGATION_CONFIG` MUST automatically render a new item with no change to `SidebarNavigation.tsx`, subject to the entry's gates.

Each `NavigationItem` MAY declare an optional `featureFlag: string` field. `useVisibleNavItems` (`apps/chat/src/hooks/useVisibleNavItems.ts`) SHALL apply two gates on every render: the overlay UI feature owning the entry's route (`OverlayFeature.Catalog` for `ROUTES.Catalog`, `OverlayFeature.FileManager` for `ROUTES.FileManager`; routes absent from that map are ungated), and the entry's `featureFlag`, which passes only when `useAppConfig().status` is `UserConfigStatus.Ready` and `features[featureFlag] === true`. Filtering MUST react to a flag value becoming available/changing after initial mount.

#### Scenario: Config drives rendered items

- **WHEN** `NAVIGATION_CONFIG` entries carry no `featureFlag` and their route features are enabled
- **THEN** one item per entry is rendered in the sidebar

#### Scenario: Flag-gated item hidden when flag is off

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and that flag is not `true` in the ready app config
- **THEN** no item for that entry is rendered

#### Scenario: Flag-gated item shown when flag is on

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and that flag is `true` in the ready app config
- **THEN** an item for that entry is rendered, with the same label/tooltip/active-state behavior as ungated entries

#### Scenario: Ungated entries are unaffected

- **WHEN** `NAVIGATION_CONFIG` mixes gated and ungated entries
- **THEN** every ungated entry renders regardless of any flag's value

#### Scenario: A disabled overlay feature hides its entry

- **WHEN** `OverlayFeature.Catalog` (or `OverlayFeature.FileManager`) is disabled
- **THEN** the Catalog (or File manager) entry is not rendered

### Requirement: Sidebar items expose accessible labels and tooltips

Every item MUST carry an accessible name equal to the item's `label`, which `useNavigationItems` resolves from the `labelKey` of its `NavigationItem` via `useTranslation().t()`. While the sidebar is collapsed the same string MUST be the item's tooltip.

#### Scenario: Name and tooltip match the i18n value

- **WHEN** `SidebarNavigation` renders collapsed with the default config
- **THEN** the New chat item is named and has a tooltip equal to the `en.json` value of `buttons.newChat`, and the Catalog item to that of `navigation.catalog`

### Requirement: The sidebar's user menu renders for authenticated users only

`SidebarNavigation` SHALL render the `UserMenu` from `@epam/ai-dial-navigation-panel` in the sidebar footer only when `useUser().status` is `AuthStatus.Authenticated` with a user and `OverlayFeature.HideUserMenu` is off (and, in the mobile drawer, `OverlayFeature.HideNavigationMenu` is off). Its trigger MUST be named from the profile's display name followed by the i18n key `auth.signedInAs` interpolated with the profile email from `useNavigationUserProfile`. The dropdown MUST offer Settings (unless `OverlayFeature.HideSettingsPage` is on) and Log out. Log out MUST open `LogoutConfirmationModal`, whose confirm action calls `logout()` from `apps/chat/src/server-api/auth.api.ts` — a `fetch` `POST` to `ApiEndpoints.AUTH_LOGOUT` with the `X-CSRF-Token` header — and then, outside the overlay, replaces the document location with `ROUTES.Login` (inside the overlay it calls `useUser().reset()` instead).

#### Scenario: Unauthenticated state renders nothing

- **WHEN** `useUser()` returns an unauthenticated status
- **THEN** no user menu is rendered in the sidebar footer

#### Scenario: Loading state renders nothing

- **WHEN** authentication is still loading
- **THEN** no user menu is rendered

#### Scenario: Authenticated state shows the user button

- **WHEN** the user is authenticated with email `user@example.com`
- **THEN** the footer renders a user-menu trigger whose accessible name contains `'user@example.com'` via the `auth.signedInAs` i18n interpolation

#### Scenario: Log out asks for confirmation

- **WHEN** the user chooses Log out in the user menu
- **THEN** the log-out confirmation dialog opens, and only confirming it sends the logout `POST` request

### Requirement: SidebarNavigation has a co-located spec

The navigation surface SHALL have a co-located Vitest spec, `apps/chat/src/components/Navigation/tests/SidebarNavigation.spec.tsx`. Tests MUST use `@testing-library/react` role/label/text queries instead of implementation-specific selectors and describe observable behaviour.

#### Scenario: Navigation tests

- **WHEN** the test suite for `SidebarNavigation` runs
- **THEN** it covers at least: the landmark, New chat as the root item and its active rule, feature-flag / UI-feature gating of items, the user menu's visibility and groups, and the mobile drawer's open, close and focus behaviour

### Requirement: The root item is presented as New chat

`NAVIGATION_CONFIG`'s `ROUTES.Root` entry SHALL render:
- with the label `t('buttons.newChat')` ("New chat");
- with an outline circle-plus icon, and a filled circle-plus while active;
- as active only on an exact `/`;
- not at all while `isEnabled('hide-new-conversation')` is `true`.

`SidebarNavigation` SHALL still hard-code no route paths or icons. The navigation entries and their routes are the same at every width.

#### Scenario: Root item label

- **WHEN** the sidebar renders
- **THEN** the first navigation item is named "New chat" and links to `/`

#### Scenario: Root item hidden

- **WHEN** `isEnabled('hide-new-conversation')` is `true`
- **THEN** no New chat item renders
