# Spec: themes-module

## Purpose

Specifies `ThemesModule`, the NestJS module wrapper around the existing `ThemeController`/`ThemeService` in `apps/chat-api`, bringing the themes domain in line with the module-per-domain pattern used by the rest of `apps/chat-api` (e.g. `DeploymentsModule`, `ModelsModule`).

---

## Requirements

### Requirement: ThemesModule wraps the themes domain

`apps/chat-api/src/themes/themes.module.ts` SHALL declare a NestJS `@Module` with `controllers: [ThemeController]` and `providers: [ThemeService]`, following the same pattern as `apps/chat-api/src/deployments/deployments.module.ts`. `AppModule` SHALL import `ThemesModule` instead of registering `ThemeController`/`ThemeService` directly, and SHALL no longer import `ThemeController`/`ThemeService` itself.

#### Scenario: Themes routes remain reachable through the module

- **WHEN** a client calls any existing `/api/v1/themes/*` route after `ThemesModule` is introduced
- **THEN** the route resolves to the same `ThemeController` handler and returns the same response as before the module extraction

#### Scenario: ThemeService is still injectable where currently used

- **WHEN** any code that previously depended on `ThemeService` via `AppModule`'s direct provider registration is instantiated after this change
- **THEN** Nest's DI container resolves `ThemeService` through `ThemesModule` without requiring `AppModule` to declare it directly

#### Scenario: No export unless a consumer exists

- **WHEN** `ThemesModule` is created and no other module currently imports `ThemesModule` to use `ThemeService`
- **THEN** `ThemesModule` SHALL NOT declare `exports: [ThemeService]` until an actual cross-module consumer exists

#### Scenario: Existing theme specs pass unchanged

- **WHEN** `theme.controller.spec.ts` and `theme.service.spec.ts` are run after the module extraction
- **THEN** both suites pass without modification to their assertions, only updating test module bootstrapping imports if they previously imported `AppModule` directly
