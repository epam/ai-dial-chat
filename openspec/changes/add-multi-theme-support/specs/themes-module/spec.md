## MODIFIED Requirements

### Requirement: ThemesModule wraps the themes domain

`apps/chat-api/src/themes/themes.module.ts` SHALL declare a NestJS `@Module` with
`controllers: [ThemeController, RemoteThemeController]` and `providers: [ThemeService]`, following
the same pattern as `apps/chat-api/src/deployments/deployments.module.ts`. `AppModule` SHALL import
`ThemesModule` instead of registering `ThemeController`/`ThemeService` directly, and SHALL no longer
import `ThemeController`/`ThemeService` itself.

The two controllers cover two different route families and are deliberately not merged:

- `ThemeController` — `@Public()` `@Controller('themes')`, serving the **unversioned** `/api/themes`
  and `/api/themes/icon` routes for the operator's configured `THEMES_CONFIG_URL`. These are called
  by `ThemeProvider` before any session exists and predate URI versioning; they are grandfathered
  and SHALL NOT be re-pathed by this change.
- `RemoteThemeController` — `@Controller({ path: 'themes', version: '1' })`, serving the
  authenticated `/api/v1/themes/remote` and `/api/v1/themes/remote/icon` business routes defined by
  the `remote-theme-proxy` spec.

Both controllers SHALL depend on the same `ThemeService` instance, so that the origin allowlist, the
timeout, and the cache are configured once.

#### Scenario: Themes routes remain reachable through the module

- **WHEN** a client calls any existing `/api/themes/*` route after `RemoteThemeController` is added
- **THEN** the route resolves to the same `ThemeController` handler and returns the same response as
  before, still without a session and still without a version segment

#### Scenario: Remote theme routes are versioned and authenticated

- **WHEN** a client calls `/api/v1/themes/remote`
- **THEN** the route resolves to `RemoteThemeController.getRemoteTheme`, and an unauthenticated
  caller receives `401`

#### Scenario: ThemeService is still injectable where currently used

- **WHEN** any code that previously depended on `ThemeService` via `AppModule`'s direct provider
  registration is instantiated
- **THEN** Nest's DI container resolves `ThemeService` through `ThemesModule` without requiring
  `AppModule` to declare it directly

#### Scenario: One service instance serves both controllers

- **WHEN** both controllers are resolved from the module
- **THEN** they share a single `ThemeService` instance, and the allow-listed origin set parsed at
  its construction applies to both

#### Scenario: No export unless a consumer exists

- **WHEN** `ThemesModule` is created and no other module currently imports `ThemesModule` to use
  `ThemeService`
- **THEN** `ThemesModule` SHALL NOT declare `exports: [ThemeService]` until an actual cross-module
  consumer exists

#### Scenario: Existing theme specs pass unchanged

- **WHEN** `theme.controller.spec.ts` and `theme.service.spec.ts` are run after
  `RemoteThemeController` is added
- **THEN** both suites pass without modification to their assertions, only updating test module
  bootstrapping imports if they previously imported `AppModule` directly
