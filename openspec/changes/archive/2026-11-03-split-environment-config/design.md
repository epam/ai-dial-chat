## Context

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`, 1321 lines) is one class-validator class with 182 env vars. Three of them are required: `DIAL_CORE_URL`, `AUTH_SESSION_SECRET` and `AUTH_CALLBACK_BASE_URL`. The rest are `@IsOptional()`, many with property-initializer defaults (`PORT = 5000`) and `@Transform` parsers for lists, numbers and enums.

The same file also holds:

- `ApplicationLogLevel` (an exported enum);
- `IFRAME_ORIGIN_PATTERN` (an exported regex);
- the private celebration patterns and `parseCelebrationList`.

Consumers:

- `apps/chat-api/src/config/validation.ts`, `validate()`, calls `plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true })`, then `validateSync`, then two cross-var checks. `ConfigModule.forRoot({ validate })` uses it.
- 108 files import `EnvironmentVariables`, almost all as `ConfigService<EnvironmentVariables>` with `get('X', { infer: true })`.
- `config/validation.spec.ts` and `config/tests/*.spec.ts` (catalog-creation, text-refinement, user-usage, prompt-overrides, validation) exercise `validate()` per domain.

## Goals / Non-Goals

**Goals:**

- Declarations are grouped by domain, so a feature adds its var to its own file.
- The type name, the import path and the validation behavior are byte-identical.
- A test guards against a var being lost or declared twice during the move.

**Non-Goals:** renaming or re-defaulting vars, per-domain `ConfigService` typing, `registerAs` namespaces, or editing specs that cite individual vars.

## Decisions

### D1. Composition with `IntersectionType` from `@nestjs/swagger`

```ts
// environment.config.ts
import { IntersectionType } from '@nestjs/swagger';
import { AuthEnv } from './env/auth.env';
// …
export { ApplicationLogLevel } from './env/server.env';
export { IFRAME_ORIGIN_PATTERN } from './env/client-ui.env';

export class EnvironmentVariables extends IntersectionType(
  ServerEnv, DialEnv, AuthEnv, AuthProvidersEnv, FilesEnv,
  GenerationEnv, ClientUiEnv, CelebrationsEnv, FeatureFlagsEnv, IntegrationsEnv,
) {}
```

`@nestjs/swagger`'s `IntersectionType` delegates to `@nestjs/mapped-types`:

- it copies class-validator metadata (`inheritValidationMetadata`) and class-transformer metadata (`inheritTransformationMetadata`);
- it copies property initializers (`inheritPropertyInitializers`), so defaults survive;
- it copies `design:type` per property (`type-helpers.utils.js`), which `plainToInstance(..., { enableImplicitConversion: true })` needs to turn `'8080'` into `8080`.

`@nestjs/swagger` is already a direct `chat-api` dependency, while `@nestjs/mapped-types` is only transitive, so the change adds no new dependency. Swagger metadata is irrelevant here; these classes are never in an OpenAPI schema.

Declaring `EnvironmentVariables` as a `class … extends IntersectionType(...) {}`, not a `const`, keeps it usable as both a value (`plainToInstance`) and a type (`ConfigService<EnvironmentVariables>`), exactly as today.

The variadic `IntersectionType(...classRefs)` signature has existed since mapped-types 2.x, and the installed version is 2.1.1.

### D2. Domain table

Every var goes to exactly one file. The table is the contract the composition spec snapshots.

| File                   | Class              | Vars                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.env.ts`        | `ServerEnv`        | `CSP_MODE`, `CSP_REPORT_URI`, `ALLOWED_CONNECT_ORIGINS`, `LOG_LEVEL`, `PORT`, `API_PREFIX`, `CORS_ORIGIN`, `CONVERSATION_BODY_SIZE_LIMIT_BYTES`; owns `ApplicationLogLevel`                                                                                                                                                                                                                                  |
| `dial.env.ts`          | `DialEnv`          | `DIAL_CORE_URL`, `DIAL_CORE_EXTERNAL_URL`, `DIAL_API_VERSION`, `DIAL_API_KEY`, `THEMES_CONFIG_URL`, `THEMES_SERVICE_TIMEOUT_MS`, `MCP_APP_SANDBOX_URL`, `MCP_APP_THEME`, `MCP_APP_USER_AGENT`, `MCP_APP_HOST_NAME`                                                                                                                                                                                          |
| `auth.env.ts`          | `AuthEnv`          | `AUTH_SESSION_*`, `AUTH_TRANSACTION_COOKIE_NAME`, `AUTH_LEGACY_COOKIE_NAMES`, `AUTH_COOKIE_SECURE`, `AUTH_CALLBACK_BASE_URL`, `AUTH_POST_LOGOUT_REDIRECT_URI`, `ADMIN_ROLE_NAMES`, `DIAL_ROLES_FIELD`, `USER_USAGE_DEPLOYMENT_TYPES`, `AUTH_HEADER_TOKEN_*`                                                                                                                                                     |
| `auth-providers.env.ts`| `AuthProvidersEnv` | `AUTH_{AUTH0,AZURE_AD,AZURE_B2C,GITLAB,GOOGLE,KEYCLOAK,PING_ID,COGNITO,OKTA}_*`                                                                                                                                                                                                                                                                                                                              |
| `files.env.ts`         | `FilesEnv`         | `FILE_UPLOAD_MAX_BYTES`, `FILE_TRANSFER_TIMEOUT_MS`, `ARCHIVE_*` (download and upload), `PUBLISH_ATTACHMENTS_MAX_FILES`, `SKILL_UPLOAD_MAX_FILES`, `SKILL_FILE_UPLOAD_MAX_BYTES`, `SKILL_UPLOAD_MAX_TOTAL_BYTES`, `SKILL_TRANSFER_TIMEOUT_MS`, `SKILL_ARCHIVE_UPLOAD_MAX_BYTES`                                                                                                  |
| `generation.env.ts`    | `GenerationEnv`    | `ASR_MODEL`, `UTILITY_MODEL`, `TEXT_REFINEMENT_*`, `CONVERSATION_NAMING_SYSTEM_PROMPT`, `TRANSCRIPTION_PROMPT`, `UTILITY_NAMING_TIMEOUT_MS`, `TRANSCRIBE_SIZE_LIMIT_BYTES`, `MAX_GENERATION_DURATION_MS`, `GENERATION_FINALIZE_TIMEOUT_MS`, `GENERATION_PREPARATION_TIMEOUT_MS`                                                                                                                               |
| `client-ui.env.ts`     | `ClientUiEnv`      | `DEFAULT_DEPLOYMENT`, `DEFAULT_DEPLOYMENT_PINNED`, `CUSTOM_CLIENT_VARIABLES`, `ANNOUNCEMENT_HTML_MESSAGE`, `ANNOUNCEMENT_TITLE`, `ANNOUNCEMENT_DESCRIPTION`, `ANNOUNCEMENTS`, `FOOTER_HTML_MESSAGE`, `WELCOME_SCREEN_DESCRIPTION`, `CHAT_VERSION`, `FEATURED_MODEL_IDS`, `HIDDEN_ENTITY_TAGS`, `DEV_QUICKAPPS_EDITOR_URL`, `ALLOWED_IFRAME_ORIGINS`, `OVERLAY_ENABLED`, `OVERLAY_SANDBOX_ENABLED`, `FILE_MANAGER_AVAILABLE_TABS`, `ENABLED_UI_FEATURES`, `ALLOW_VISUALIZER_SEND_MESSAGES`, `CUSTOM_VISUALIZERS`, `APPLICATION_VISUALIZERS`, `PUBLICATION_FILTER_SOURCES`; owns `IFRAME_ORIGIN_PATTERN` |
| `celebrations.env.ts`  | `CelebrationsEnv`  | `UI_EVENT`, `UI_EVENT_ENABLED_BY_DEFAULT`, `UI_EVENT_DELIVERY_MODE`, `UI_EVENT_DELIVERY_REVISION`, `UI_EVENT_EXTERNAL_SCENES`, `UI_EVENT_EXTERNAL_EVENTS`; owns the private celebration patterns and `parseCelebrationList`                                                                                                                                                                                  |
| `feature-flags.env.ts` | `FeatureFlagsEnv`  | `LLM_CONVERSATION_NAMING_ENABLED`, `ASR_ENABLED_ROLES`, `CATALOG_CREATION_ROLES`, `LIVE_CHAT_INTERACTION_ENABLED`, `LIVE_CHAT_INTERACTION_ENABLED_ROLES`, `RESPONSES_API_ENABLED`, `RESPONSES_BACKGROUND_ENABLED`, `SCHEDULED_TASKS_ENABLED`, `SCHEDULED_TASKS_ENABLED_ROLES`, `PROJECTS_ENABLED`, `PROJECTS_ENABLED_ROLES`, `USAGE_LIMITS_CONTROL_ENABLED`, `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT`               |
| `integrations.env.ts`  | `IntegrationsEnv`  | `SCHEDULER_APP_ID`, `SCHEDULER_SERVICE_ID`, `SCHEDULER_SERVICE_TIMEOUT_MS`, `CUSTOM_CORE_API_CONFIG`, `PROJECT_CONTEXT_FILE_MAX_BYTES`, `PROJECT_CONTEXT_TOTAL_MAX_BYTES`, `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`                                                                                                                                                                                              |

If a var's decorators reference a constant or helper declared elsewhere in the old file, it moves with that var. If two domains use it, it goes to `config/env/env-parsers.ts`.

Any var found at apply time that is not listed above goes to the closest domain, and the apply step records it in tasks.md. The composition spec's snapshot is taken from the pre-split class, not from this table, so nothing can be silently dropped.

Imports of `CspMode` (`../csp`), `CatalogCreation*` (`../catalog-creation.types`) and similar keep their relative targets, rewritten to `../<file>` from `env/`.

### D3. Parity guard

`config/tests/environment-composition.spec.ts`:

1. `ENV_VAR_NAMES` is a frozen, sorted snapshot of the 182 names. It is generated once, before the move, from `getMetadataStorage().getTargetValidationMetadatas(EnvironmentVariables, …)` property names plus initializer-only properties, and pasted in as a literal.
2. It asserts that the composed class's validation-metadata property set equals `ENV_VAR_NAMES`.
3. For each domain class it collects the property names, and asserts that their union equals `ENV_VAR_NAMES` and that pairwise intersections are empty.
4. It runs `validate()` with the three required vars:
   - with `PORT: '8080'` it gets `8080`;
   - without `PORT` it gets the default `5000`;
   - with `ADMIN_ROLE_NAMES: 'a, b'` it gets `['a', 'b']`;
   - with `FILE_TRANSFER_TIMEOUT_MS: 'abc'` it throws `Environment validation failed:` with the same constraint text as before. The test captures that text before the move and asserts it as a literal.

The existing per-domain validation specs stay unchanged and must pass.

### D4. Docs

- `apps/chat-api/AGENTS.md`: update the layout tree line for `config/`, the "Env validation →" pointer and the "All env vars MUST be declared on…" rule, which becomes "on the domain class under `config/env/`; `EnvironmentVariables` in `environment.config.ts` composes them".
- `.claude/rules/nestjs-best-practices.md`: the TL;DR bullet "Env is validated at boot: add new vars to …" changes in the same way.
- `docs/architecture.md`: the `config/` tree comment becomes "class-validator env schema (domain classes in `env/`, composed in `environment.config.ts`)".

`.env.template`, the README var tables and the 25 specs that cite `environment.config.ts` stay as they are: every var is still declared on `EnvironmentVariables`, and the path still exists.

## Risks / Trade-offs

- **Metadata not copied for some decorator** (for example a custom `@Transform` with `toClassOnly`). Mitigation: D3's `validate()` cases and all existing config specs run against the composed class. Apply moves one domain per slice and runs them each time.
- **Initializer order.** `inheritPropertyInitializers` instantiates each parent class to read its defaults, so a domain-class constructor must stay side-effect-free. None has a constructor today, and the domain classes declare none.
- **Merge conflicts during the move itself.** This file has the highest churn in the backend. Mitigation: land the change in one PR quickly, and rebase onto `development` right before the move slice.
- **IDE "go to definition" lands in the domain file**, not in `environment.config.ts`. That is the intended outcome.

## Migration Plan

This is an internal refactor and needs no deploy step. Rollback is reverting the commit.

## Open Questions

None.
