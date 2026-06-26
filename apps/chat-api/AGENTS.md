# NestJS Best Practices — `apps/chat-api`

> Source of truth for NestJS conventions in this app. Read by Claude Code (per-folder
> `AGENTS.md`) and by Cursor (proxied via `.cursor/rules/nestjs-best-practices.mdc`).
>
> Reference implementations live in this codebase — do not invent new patterns when one
> already exists. When this file says "follow X pattern", read X first and mirror it.

---

## 1. Project Layout

```
apps/chat-api/src/
├── main.ts                       # bootstrap: helmet, global pipes, CORS, versioning, Swagger
├── app/
│   ├── app.module.ts             # root module — global ConfigModule, CacheModule, ThrottlerModule
│   ├── app.controller.ts
│   └── app.service.ts
├── config/
│   ├── environment.config.ts     # EnvironmentVariables class-validator schema
│   └── validation.ts             # validate() used by ConfigModule.forRoot
├── common/
│   └── interceptors/             # cross-cutting: metrics, logging
├── health/
│   └── health.controller.ts      # GET /api/health  (infrastructure — versioning exempt)
└── <domain>/                     # one folder per domain (e.g. themes, auth)
    ├── <domain>.controller.ts    # GET /api/v1/<domain>
    ├── <domain>.service.ts
    ├── <domain>.module.ts        # only when domain needs its own providers/imports
    ├── <concern>/                # optional for larger domains: session, providers, csrf, etc.
    │   ├── <concern>.service.ts
    │   └── <concern>.guard.ts
    ├── tests/                    # domain tests mirror the source concern structure
    │   ├── <domain>.controller.spec.ts
    │   └── <concern>/
    │       └── <concern>.service.spec.ts
    └── dto/
        └── <action>.dto.ts
```

Rules:

- One folder per domain under `src/<domain>/`. Do not co-locate cross-domain code.
- Larger domains may group private implementation by concern under domain-local subfolders.
  Keep the controller/module at the domain root when they are the main public entrypoints.
- Domain tests live under `src/<domain>/tests/`, mirroring concern subfolders when needed.
  Example: `auth/session/session.service.ts` is covered by
  `auth/tests/session/session.service.spec.ts`.
- When a source folder would contain more than one spec, keep those specs in a
  local `tests/` subfolder instead of mixing multiple test files with
  implementation files.
- Shared types live in `libs/chat-shared` and are imported as `@epam/ai-dial-chat-shared`. Do not
  duplicate them in the app.

Reference files (read these before adding new code):

- Controller pattern → `apps/chat-api/src/themes/theme.controller.ts`
- Service pattern → `apps/chat-api/src/themes/theme.service.ts`
- DIAL SDK client pattern → `apps/chat-api/src/app/app.service.ts`
- DTO pattern → `apps/chat-api/src/themes/dto/get-theme-icon.dto.ts`
- Env validation → `apps/chat-api/src/config/environment.config.ts` + `validation.ts`
- Health check → `apps/chat-api/src/health/health.controller.ts`

---

## 2. API Versioning — Required for All Business Endpoints

### Bootstrap (`main.ts`)

URI-based versioning MUST be enabled in `main.ts` alongside `setGlobalPrefix`:

```ts
import { VersioningType } from '@nestjs/common';

app.setGlobalPrefix('api');

app.enableVersioning({
  type: VersioningType.URI,
});
```

This produces routes of the form `/api/v{N}/<resource>`. Both calls are required — omitting
either breaks all versioned routes.

### Versioning scope

| Controller type                             | Must be versioned? | Example route        |
| ------------------------------------------- | ------------------ | -------------------- |
| Business domain (themes, auth, chat, …)     | **Yes**            | `GET /api/v1/themes` |
| Infrastructure (health, metrics, readiness) | No — exempt        | `GET /api/health`    |

Infrastructure endpoints exist for ops tooling (load balancers, Kubernetes probes, Prometheus
scrapers) and MUST NOT carry a version prefix.

### How to version a controller

Set the `version` property on `@Controller`:

```ts
import { Controller, VERSION_NEUTRAL } from '@nestjs/common';

// ✅ business endpoint — versioned
@ApiTags('themes')
@Controller({ path: 'themes', version: '1' })
export class ThemeController { … }
// → GET /api/v1/themes, GET /api/v1/themes/icon

// ✅ infrastructure endpoint — exempt
@ApiTags('health')
@Controller('health')
export class HealthController { … }
// → GET /api/health
```

Prefer `version` on the class. Use `@Version('N')` on an individual handler only when a
single endpoint within a controller moves to a new version while others stay on the old one.

### Introducing a new version

When a breaking change is needed, add a new versioned controller rather than mutating the
existing one:

```ts
@Controller({ path: 'themes', version: '2' })
export class ThemeV2Controller { … }
// → GET /api/v2/themes
```

Keep the old controller running until all callers have migrated. Remove it in a coordinated
deprecation cycle — document the timeline in the PR description.

### Swagger

Update `DocumentBuilder` when a new version is introduced so docs stay accurate:

```ts
const config = new DocumentBuilder()
  .setTitle('Chat API')
  .setVersion('2.0.0')   // bump to reflect the highest live version
  …
```

---

## 3. Controllers — Thin and Annotated

Controllers MUST:

- Be thin — **no business logic**, only validation (via DTO) and delegation to a service.
- Carry `@ApiTags('<group>')` on the class and `@Controller('<route>')`.
- Annotate every endpoint with `@ApiOperation({ summary, description })` and **every
  possible response status** as a separate `@ApiResponse({ status, description, schema? })`
  (200/201, plus each thrown HTTP exception → 400/404/502/503/...).
- Treat generated client names as public API: `operationIdFactory` uses the controller
  handler name, so handlers MUST be named as the desired SDK method (`listModels`,
  `getCurrentUser`, `createConversation`). Use `@ApiOperation({ operationId })` only for
  exceptional overrides.
- For every JSON success response, `@ApiResponse` MUST include `type` or `schema`.
  Do not leave success responses as description-only annotations; that generates
  `void`/`any` client methods.
- For every path/query parameter, use a DTO with Swagger metadata or explicit
  `@ApiParam`/`@ApiQuery` metadata. Parameters without Swagger types generate weak
  client request types.
- Apply `@Throttle({ default: { limit, ttl } })` per endpoint when the global throttler
  default (100 req/min) needs tightening. Public unauthenticated endpoints SHOULD have
  a stricter per-route limit.
- Use NestJS HTTP decorators — `@Get`, `@Post`, `@Query`, `@Body`, `@Param` — never read
  from the raw request unless absolutely required (e.g. streaming binary).
- Return plain values; let NestJS serialize them. Use `@Res()` only when you must set
  custom headers (e.g. image content-type) — and stay aware it bypasses interceptors.

Good (follow `ThemeController`):

```ts
@ApiTags('themes')
@Controller({ path: 'themes', version: '1' }) // ✅ versioned: GET /api/v1/themes
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Get('icon')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get theme icon', description: '...' })
  @ApiResponse({ status: 200, description: 'Icon content' /* schema */ })
  @ApiResponse({ status: 400, description: 'Invalid icon name' })
  @ApiResponse({ status: 404, description: 'Icon not found' })
  @ApiResponse({ status: 502, description: 'Upstream error' })
  @ApiResponse({ status: 503, description: 'Upstream unavailable' })
  async getThemeIcon(@Query() query: GetThemeIconDto, @Res() res: Response) {
    const file = await this.themeService.getThemeIcon(query.iconName ?? '');
    res.setHeader(
      'Content-Type',
      lookup(query.iconName ?? '') || 'image/svg+xml',
    );
    return res.send(file);
  }
}
```

Bad:

```ts
@Controller('themes') // ❌ missing version → /api/themes
export class BadController {
  @Get('icon')
  async icon(@Query('name') name: string) {
    // ❌ no DTO, no validation → path traversal risk
    // ❌ no Swagger annotations
    // ❌ business logic in controller
    const res = await fetch(`${process.env.THEMES_CONFIG_URL}/${name}`);
    return res.text();
  }
}
```

---

## 4. Services — Injectable, Logged, Configured

Services MUST:

- Be `@Injectable()`.
- Declare `private readonly logger = new Logger(<ClassName>.name)` and use it
  (`logger.debug | log | warn | error`). **Never `console.log` in app code.**
- Inject `ConfigService<EnvironmentVariables>` and read with `infer: true`:

  ```ts
  this.url = this.configService.get('THEMES_CONFIG_URL', { infer: true });
  ```

  Never cast with `as string`; rely on the validated env schema.

- For DIAL Core integrations, prefer `@epam/ai-dial-typescript-sdk` through the shared
  SDK client on `AppService` (`createSDK({ baseUrl })`). Pass per-request auth headers
  from the BFF session for user-scoped data, and handle the SDK's success/error response
  shape explicitly.
- Use raw `fetch` only for non-DIAL upstreams or when the SDK does not expose the required
  DIAL operation. In those cases, use an `AbortController` and the configurable timeout
  env var (e.g. `THEMES_SERVICE_TIMEOUT_MS`). Always `clearTimeout` in both branches and
  document why the SDK is not used.
- Translate failures into proper Nest HTTP exceptions (see §6). Never return `null`,
  `undefined`, or a swallowed error from a service method.
- Cache repeatable external lookups via `@Inject(CACHE_MANAGER) cacheManager: Cache`
  (`@nestjs/cache-manager`). Cache key naming: `<domain>:<resource>[:<param>]`
  (e.g. `themes:config`, `themes:icon:<name>`).

Follow `AppService` as the reference for DIAL SDK client setup. Follow `ThemeService` only
for non-DIAL fetch + timeout + cache + error mapping.

Bad:

```ts
async getThemes() {
  try {
    const res = await fetch(process.env.THEMES_CONFIG_URL + '/config.json');
    return await res.json();
  } catch {
    return null; // ❌ swallows error, no logging, no timeout, no typed config
  }
}
```

---

## 5. DTOs — Validation Is Mandatory

Every endpoint that accepts user input MUST use a DTO class with:

- `class-validator` decorators on each field (`@IsString`, `@IsEnum`, `@IsUrl`, `@IsInt`,
  `@Min`, `@Max`, …).
- `@ApiProperty({ description, example })` or `@ApiPropertyOptional(...)` on each field so
  Swagger documents it and the generated client gets strong request types.
- For string fields that may end up in a filesystem path, URL segment, header, log line,
  cookie name, etc. — apply `@Matches(<allowlist regex>, { message })`. Reject everything
  not on the allowlist (anti path-traversal, anti-injection). See `GetThemeIconDto`.
- Optional fields use `@IsOptional()` + a default in the calling code, not optional
  chaining everywhere.

DTOs live in `<domain>/dto/<action>.dto.ts`. Response DTOs that exist only to document
proxied upstream shapes may live in `src/openapi/`. Do **not** inline anonymous types or
use TypeScript interfaces in controllers — they break Swagger runtime metadata.

Global `ValidationPipe` is already configured in `main.ts` with `whitelist`,
`forbidNonWhitelisted`, `transform`. Do not remove these flags; they are the reason
unknown fields and wrong types are rejected automatically.

---

## 6. Error Handling — Throw HTTP Exceptions

Map failure modes to NestJS built-in exceptions:

| Situation                                        | Throw                                      |
| ------------------------------------------------ | ------------------------------------------ |
| Resource not found (404 from upstream)           | `NotFoundException`                        |
| Validation failure (handled by `ValidationPipe`) | — automatic `BadRequestException`          |
| Upstream returned non-OK status                  | `BadGatewayException`                      |
| Upstream timed out / unreachable                 | `ServiceUnavailableException`              |
| Caller is unauthenticated                        | `UnauthorizedException`                    |
| Caller is authenticated but lacks permission     | `ForbiddenException`                       |
| Programming error / unexpected branch            | `InternalServerErrorException` (log first) |

Rules:

- **Never** swallow errors silently or return `null` to indicate failure from a service.
- Catch only to re-throw the right exception. Rethrow Nest exceptions untouched if they
  already match (see the `instanceof` check in `ThemeService` as the reference pattern).
- Log with context before throwing 5xx (`logger.error(msg, error.stack)`). Do not log
  request bodies, tokens, refresh tokens, cookies, or secrets.

Bad:

```ts
catch (e) { return null; }                 // ❌ silent failure
catch (e) { throw e; }                     // ❌ pointless re-throw, loses context
throw new HttpException('Oops', 500);      // ❌ generic — use a typed exception
```

---

## 7. Environment & Configuration

- All env vars MUST be declared on the `EnvironmentVariables` class in
  `apps/chat-api/src/config/environment.config.ts`.
- Each field has at least one `class-validator` decorator. URL fields use
  `@IsUrl({ require_tld: false })`. Numeric fields use `@Transform(({ value }) =>
parseInt(value, 10))` + `@IsNumber()`.
- `ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: ['.env.local', '.env'] })`
  in `AppModule`. The app MUST fail fast at boot if env validation fails (already wired
  via `validation.ts`).
- New required secret? Add the field, document it in `apps/chat-api/README.md`, and add
  a placeholder line to `.env.example` (do not commit real secrets).
- Per-request data (auth principal, request id, …) belongs on `request` via guards /
  middleware, **not** on a service or global state.

---

## 8. Modules — Compose, Don't Cram

- A new domain that owns its own providers and controllers SHOULD have its own
  `<domain>.module.ts` that exports the service if other modules need it. Light domains
  (one controller + one service) may be registered directly in `AppModule`.
- `imports`, `controllers`, `providers`, `exports` are declared explicitly. Avoid
  re-exporting globals; rely on `isGlobal: true` for truly global modules
  (`ConfigModule`, `CacheModule`, `ThrottlerModule` — already global).
- Use `APP_GUARD` / `APP_INTERCEPTOR` / `APP_FILTER` tokens in `AppModule` for app-wide
  guards/interceptors (see how `ThrottlerGuard` and `MetricsInterceptor` are wired).

---

## 9. Security Defaults

- `main.ts` already registers `helmet` (CSP, HSTS) and global `ValidationPipe` with
  strict flags. Do not weaken either without an explicit, written reason.
- CORS: `credentials: true` and a single `CORS_ORIGIN` env var. Never `origin: '*'`
  when cookies are in use.
- Cookies (for auth and similar): always `HttpOnly`, `Secure`, `SameSite=Lax` (or
  `Strict`); use the `__Host-` prefix when the cookie is host-scoped. Tokens MUST
  never be exposed to the browser via response body or non-HttpOnly cookies.
- Logs MUST NOT contain access tokens, refresh tokens, full cookie payloads, API keys,
  passwords, or full request bodies for auth/payment endpoints. Log identifiers
  (user id, session id) instead.
- For any endpoint that mutates state and is reachable from a browser session cookie,
  add CSRF protection (double-submit token or origin check).
- Input that becomes part of a filesystem path, URL segment, redirect target, log key,
  or HTML/SVG response — validate with an allowlist `@Matches` regex.

---

## 10. Logging & Observability

- Use NestJS `Logger` with class name as context: `new Logger(MyService.name)`.
- Levels: `debug` for verbose tracing, `log` for routine events, `warn` for recoverable
  problems, `error` for failures. `error` calls SHOULD include `error.stack` as the
  second argument.
- New cross-cutting concerns go through interceptors in `common/interceptors/`. Follow
  `MetricsInterceptor` as the reference pattern (request duration, error rate).

---

## 11. Testing

- Unit tests: `<file>.spec.ts` under the domain `tests/` folder. Use `@nestjs/testing` to build
  a `TestingModule`. Mock providers with `.overrideProvider(X).useValue(...)`.
- Integration / e2e tests: `supertest` against the bootstrapped app. Cover at least:
  - Happy path (200/201 with correct body)
  - Validation failure (400 with the expected message)
  - Each thrown HTTP exception path (404 / 502 / 503 / …)
  - Security checks: path-traversal attempts, oversized inputs, missing required fields,
    rate-limit (one hit beyond `@Throttle` limit).
- Mock SDK methods, `fetch`, or any other outbound client — never hit live services in unit tests.
- Test names describe observable behaviour ("returns 404 when icon is missing"), not
  implementation details ("calls fetch with url").

---

## 12. Verification After Each Slice

Per the openspec task rules (thin vertical slices, `openspec/config.yaml`), after each slice run:

```sh
npm exec nx test  chat-api
npm exec nx lint  chat-api
npm exec nx build chat-api      # when bundling/Nest startup is affected
```

When adding or changing HTTP endpoints, also run:

```sh
npm run openapi
npm run openapi:check
npm exec nx build chat-api-client -- --skip-nx-cache
npm exec nx lint chat-api-client
```

Inspect `libs/chat-api-client/src/generated/src/apis` after generation: method names should
be clean (`getModel`, not `ModelsController_getModel_v1`) and endpoint-level `any` should
not appear outside the generator's `runtime.ts`.

Do not move to the next slice while any of these is red for the project you touched.

---

## 13. Anti-Patterns (Quick Reference)

- **Business controller missing `version` in `@Controller`** — produces an unversioned route
  (`/api/themes` instead of `/api/v1/themes`). Every business domain controller needs
  `@Controller({ path: '<resource>', version: '<N>' })`.
- `app.enableVersioning()` not called in `main.ts` — all `version` properties on controllers
  are silently ignored and routes are served without a version prefix.
- Inlining anonymous types in controllers instead of DTO classes.
- Returning `null` / `undefined` from a service to signal failure.
- `console.log` instead of `Logger`.
- Raw `fetch` for DIAL Core endpoints when `@epam/ai-dial-typescript-sdk` supports the operation.
- Reading `process.env` directly inside a service.
- Casting env vars (`as string`) instead of typing through `EnvironmentVariables`.
- Missing `@ApiResponse` entries for thrown exceptions.
- Description-only success `@ApiResponse` entries that generate `void`/`any` SDK methods.
- Handler names like `handle`, `me`, or `doThing` that become unclear generated SDK method
  names.
- Path/query params without DTO Swagger metadata or `@ApiParam`/`@ApiQuery`.
- Catching errors with no logging and no re-throw.
- `origin: '*'` CORS when cookies are in use.
- Stashing tokens, secrets, or full request bodies in logs.
- Skipping `@Throttle` on public unauthenticated endpoints.
- Putting business logic in a controller.
