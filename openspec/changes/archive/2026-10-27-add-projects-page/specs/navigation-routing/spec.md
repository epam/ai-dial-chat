## MODIFIED Requirements

### Requirement: Client-side routing resolves the top-level routes

`apps/chat/src/main.tsx` SHALL mount the router as a data router: a module-scope `createBrowserRouter` instance rendered through `<RouterProvider>`, replacing the former `<BrowserRouter>`. The router has a single splat root route (`path: '*'`). Its element is `AppRoot` (`apps/chat/src/AppRoot.tsx`), which renders the existing provider stack and the existing `<Routes>` (`/login`, `/overlay-close`, and the authenticated `*` branch) unchanged. Hooks such as `useBlocker` that require a data router SHALL therefore work anywhere in the tree. No loaders or actions are introduced.

The application SHALL declare its routes using React Router `<Routes>` in `apps/chat/src/app/app.tsx`, with paths taken from the `ROUTES` enum in `apps/chat/src/types/routes.ts`. Inside the `ChatLayout` layout route:

- `ROUTES.Root` (`/`) MUST render `<ConversationRoute>`, the welcome screen, which holds no message state.
- `/conversations/*` MUST render a lazy-loaded `<ConversationPage>`.

`ROUTES.Catalog` (`/catalog`) MUST render the lazy-loaded `<CatalogView>`: the full catalog, not a placeholder.

The other authenticated pages MUST likewise be lazy-loaded inside the `RouteErrorBoundary` + `Suspense`/`RouteFallback` wrapper. They are:

- `ROUTES.SharedInvitation` and `ROUTES.ConversationSharedInvitation`;
- `ROUTES.FileManager`;
- `ROUTES.Settings` and `ROUTES.SettingsTab`;
- `ROUTES.Projects` (`/projects`), registered unconditionally, with the `projectsEnabled` guard applied inside `ProjectsPage`;
- the `ROUTES.ScheduledTasks*` routes;
- the `AppsEditor`, `ToolsetEditor`, `CustomAppEditor`, `PromptEditor` and `SkillEditor` editors;
- `ToolsetEditorCallback` and `ToolsetSignIn`.

Any unregistered path MUST fall through to the explicit `*` catch-all route.

#### Scenario: Root path renders the welcome screen

- **WHEN** the browser navigates to `/`
- **THEN** `<ConversationRoute>` is mounted and the welcome screen is visible with no message history

#### Scenario: Catalog path renders the catalog

- **WHEN** the browser navigates to `/catalog`
- **THEN** the lazy-loaded `<CatalogView>` is mounted

#### Scenario: Projects path renders the projects page

- **WHEN** the browser navigates to `/projects`
- **THEN** the lazy-loaded `ProjectsPage` is mounted inside `RouteErrorBoundary`/`Suspense`, and it renders either the projects UI or `NotFound`, depending on `projectsEnabled`

#### Scenario: Conversation path renders the conversation page

- **WHEN** the browser navigates to `/conversations/<id>`
- **THEN** the lazy-loaded `<ConversationPage>` is mounted

#### Scenario: CatalogView is lazy-loaded

- **WHEN** the JS bundle is evaluated
- **THEN** `CatalogView` code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`

#### Scenario: ConversationPage is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/conversations/:id`
- **THEN** `ConversationPage` code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`

#### Scenario: The router is a data router

- **WHEN** any component under the authenticated tree calls `useBlocker`
- **THEN** it does not throw the "must be used within a data router" invariant, and every existing route still resolves to the same element as before

### Requirement: The sidebar is driven by NAVIGATION_CONFIG

`SidebarNavigation` (`apps/chat/src/components/Navigation/SidebarNavigation.tsx`) SHALL NOT hard-code route paths or icon components. It MUST render the items from `useNavigationItems`, which maps the exported `NAVIGATION_CONFIG` constant from `apps/chat/src/constants/navigation.ts` after filtering it through `useVisibleNavItems`. In order, the constant holds:

1. New chat, `ROUTES.Root`;
2. Projects, `ROUTES.Projects`;
3. Scheduled tasks, `ROUTES.ScheduledTasks`;
4. Catalog, `ROUTES.Catalog`;
5. File manager, `ROUTES.FileManager`.

Adding a new entry to `NAVIGATION_CONFIG` MUST automatically render a new item with no change to `SidebarNavigation.tsx`, subject to the entry's gates.

The Projects entry SHALL declare:

- `featureFlag: 'projectsEnabled'`;
- `icon: IconBriefcase` and `activeIcon: IconBriefcaseFilled` from `@tabler/icons-react`;
- `labelKey: NavigationI18nKeys.Projects`, which resolves to the `navigation.projects` key ("Projects") in `apps/chat/src/i18n/locales/en.json`.

The icon is symmetric and is not mirrored in RTL.

Each `NavigationItem` MAY declare an optional `featureFlag: string` field. `useVisibleNavItems` (`apps/chat/src/hooks/useVisibleNavItems.ts`) SHALL apply two gates on every render:

- the overlay UI feature owning the entry's route: `OverlayFeature.Catalog` for `ROUTES.Catalog`, `OverlayFeature.FileManager` for `ROUTES.FileManager`. Routes absent from that map are ungated;
- the entry's `featureFlag`, which passes only when `useAppConfig().status` is `UserConfigStatus.Ready` and `features[featureFlag] === true`.

Filtering MUST react to a flag value becoming available/changing after initial mount.

#### Scenario: Config drives rendered items

- **WHEN** `NAVIGATION_CONFIG` entries carry no `featureFlag` and their route features are enabled
- **THEN** one item per entry is rendered in the sidebar

#### Scenario: Flag-gated item hidden when flag is off

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and that flag is not `true` in the ready app config
- **THEN** no item for that entry is rendered

#### Scenario: Flag-gated item shown when flag is on

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and that flag is `true` in the ready app config
- **THEN** an item for that entry is rendered, with the same label/tooltip/active-state behavior as ungated entries

#### Scenario: Projects item follows projectsEnabled

- **WHEN** `features.projectsEnabled` is `true` in the ready app config
- **THEN** a Projects item labelled "Projects" is rendered directly after New chat, and it is marked `aria-current="page"` on `/projects`
- **AND WHEN** `features.projectsEnabled` is not `true`
- **THEN** no Projects item is rendered

#### Scenario: Ungated entries are unaffected

- **WHEN** `NAVIGATION_CONFIG` mixes gated and ungated entries
- **THEN** every ungated entry renders regardless of any flag's value

#### Scenario: A disabled overlay feature hides its entry

- **WHEN** `OverlayFeature.Catalog` (or `OverlayFeature.FileManager`) is disabled
- **THEN** the Catalog (or File manager) entry is not rendered
