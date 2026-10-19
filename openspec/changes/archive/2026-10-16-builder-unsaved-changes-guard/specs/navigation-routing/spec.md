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
