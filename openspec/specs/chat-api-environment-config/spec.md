# Spec: chat-api-environment-config

## Purpose

How `chat-api` declares and composes its environment-variable schema: one class-validator class per domain, composed into a single `EnvironmentVariables`, with a parity guard.

## Requirements

### Requirement: Env schema is declared in domain classes composed into EnvironmentVariables

`apps/chat-api` SHALL declare every environment variable it reads on exactly one domain class under `apps/chat-api/src/config/env/`, one file per domain named `<domain>.env.ts`. The domains are `server`, `dial`, `auth`, `auth-providers`, `files`, `generation`, `client-ui`, `celebrations`, `feature-flags` and `integrations`, and design.md holds the var-to-domain table. Each var keeps its existing class-validator and class-transformer decorators, property initializer (default) and JSDoc. A parse helper or pattern used by only one domain lives in that domain's file.

`apps/chat-api/src/config/environment.config.ts` SHALL remain the single composition root. It exports `EnvironmentVariables` as `IntersectionType(...)` (from `@nestjs/swagger`) of all domain classes, and re-exports the root's other public names (`ApplicationLogLevel`, `IFRAME_ORIGIN_PATTERN`). Every consumer SHALL keep importing `EnvironmentVariables` from this file and injecting `ConfigService<EnvironmentVariables>`. `apps/chat-api/src/config/validation.ts` SHALL validate against the composed class with `enableImplicitConversion: true`, as before.

A new env var SHALL be added to the domain class it belongs to, or to a new `<domain>.env.ts` that is added to the root's `IntersectionType` list, never as a decorated property in `environment.config.ts`. Adding, removing or renaming a var SHALL still update `apps/chat-api/README.md` and `apps/chat-api/.env.template` in the same change.

This structure introduces no endpoint, no client-visible value, no cache, no i18n string, no UI (so no RTL or accessibility impact), no feature gate and no telemetry. Validation behavior, defaults and error messages are unchanged.

#### Scenario: The composed class declares every var exactly once

- **WHEN** `apps/chat-api/src/config/tests/environment-composition.spec.ts` collects the class-validator property names of the composed `EnvironmentVariables` and of each domain class
- **THEN** the composed set equals the spec's snapshot list of var names, and no name appears in more than one domain class

#### Scenario: Implicit conversion and defaults survive composition

- **WHEN** `validate()` from `apps/chat-api/src/config/validation.ts` receives `{ PORT: '8080', AUTH_SESSION_SECRET: <valid secret>, ... }` with the minimum required vars, and once without `PORT`
- **THEN** the result's `PORT` is the number `8080` in the first case and the default `5000` in the second, and a comma-separated list var such as `ADMIN_ROLE_NAMES` arrives as a `string[]`

#### Scenario: Invalid values are rejected with the same messages

- **WHEN** `validate()` receives a value that the pre-split schema rejected, such as a non-numeric `FILE_TRANSFER_TIMEOUT_MS`
- **THEN** it throws `Environment validation failed:` with the same constraint message as before the split

#### Scenario: The root file holds no declarations

- **WHEN** `environment.config.ts` is inspected
- **THEN** it contains no class-validator decorator and no env var property, only imports, the `IntersectionType` composition and re-exports
