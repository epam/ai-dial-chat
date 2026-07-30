# Chat API

NestJS backend application for the chat platform. Provides REST API endpoints for theme configuration, serves the frontend application, and integrates with the EPAM AI DIAL SDK.

## Features

- 🚀 NestJS framework with TypeScript
- 📚 Swagger/OpenAPI documentation
- 🌐 CORS configuration
- 📦 Static file serving for React frontend
- ⚙️ Environment validation at startup
- 🔌 AI DIAL SDK integration (placeholder for future implementation)
- 🎨 Theme management endpoints
- 🏥 Health check endpoint
- ✅ Input validation with class-validator
- 🛡️ Path traversal protection
- ⏱️ Configurable request timeouts
- 📝 Comprehensive error handling
- 🗄️ In-memory caching (5-minute TTL)
- 🔒 Security headers (helmet middleware)
- 🚦 Rate limiting (100 req/min default)
- 📊 Request metrics logging

## Prerequisites

- Node.js 18+
- npm
- Access to AI DIAL core service
- Access to themes configuration service

## Getting Started

### 1. Install Dependencies

From the root of the monorepo:

```bash
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the project root:

```bash
# Required
AUTH_SESSION_SECRET=<64-character-hex-secret>
AUTH_CALLBACK_BASE_URL=http://localhost:5000
AUTH_POST_LOGOUT_REDIRECT_URI=http://localhost:4207

# At least one identity provider must be configured — example for Auth0:
AUTH_AUTH0_CLIENT_ID=your-client-id
AUTH_AUTH0_SECRET=<client-secret>
AUTH_AUTH0_HOST=your-tenant.auth0.com

# Optional
PORT=5000
API_PREFIX=api
CORS_ORIGIN=http://localhost:4207
DIAL_CORE_URL=https://your-dial-service.com
DIAL_API_VERSION=2024-10-21
DIAL_API_KEY=your-secret-api-key
THEMES_CONFIG_URL=https://your-themes-service.com
THEMES_SERVICE_TIMEOUT_MS=5000
# Local HTTP smoke only. Keep true/default for HTTPS and production-like runs.
AUTH_COOKIE_SECURE=false
# Allow iframe integrations and embedding this app by allowed origins
ALLOWED_IFRAME_ORIGINS=
# Enable chat overlay runtime mode; requires ALLOWED_IFRAME_ORIGINS
OVERLAY_ENABLED=false
# Serve overlay sandbox at /overlay-sandbox/
OVERLAY_SANDBOX_ENABLED=false
```

**Note**: `.env.local` takes precedence over `.env` and is not committed to version control.

#### Environment Variables

**Required:**

| Variable                 | Description                                            | Example                     |
| ------------------------ | ------------------------------------------------------ | --------------------------- |
| `AUTH_SESSION_SECRET`    | 32-byte session encryption key encoded as 64 hex chars | `<64-character-hex-secret>` |
| `AUTH_CALLBACK_BASE_URL` | Public API base URL used for OIDC redirect URIs        | `http://localhost:5000`     |

At least one identity provider (see [Auth provider environment variables](#auth-provider-environment-variables) below) must also be configured for login to work; the application otherwise boots with no providers registered.

**Optional:**

| Variable                                | Default                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --- |
| `PORT`                                  | `5000`                         | HTTP server port                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `API_PREFIX`                            | `api`                          | Global route prefix for all API endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `CORS_ORIGIN`                           | `http://localhost:4207`        | Allowed CORS origin for frontend                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `LOG_LEVEL`                             | Environment-dependent          | Minimum NestJS log level: `debug`, `log`, `warn`, or `error`. Defaults to `log` in production and `debug` otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `AUTH_SESSION_COOKIE_NAME`              | `__Host-chat.sess`             | Session cookie name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `AUTH_TRANSACTION_COOKIE_NAME`          | `__Host-chat.tx`               | Login transaction cookie name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `AUTH_COOKIE_SECURE`                    | `true`                         | Set to `false` only for local HTTP smoke testing; runtime drops `__Host-` from cookie names when disabled                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `AUTH_POST_LOGOUT_REDIRECT_URI`         | —                              | Where the browser lands after IdP logout, applied to every configured provider. Required if at least one identity provider is configured.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ADMIN_ROLE_NAMES`                      | `admin`                        | Comma-separated fallback admin role names, used by any provider that doesn't set its own `AUTH_{PROVIDER}_ADMIN_ROLE_NAMES`                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `DIAL_ROLES_FIELD`                      | `dial_roles`                   | Fallback dot-separated path to the roles claim in the ID/access token, used by any provider that doesn't set its own `AUTH_{PROVIDER}_DIAL_ROLES_FIELD`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `DIAL_CORE_URL`                         | —                              | AI DIAL core service URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `DIAL_API_VERSION`                      | `2024-10-21`                   | API version query parameter sent to DIAL Core chat completion requests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `DIAL_API_KEY`                          | —                              | Server-only API key sent as `Api-Key` to DIAL Core for utility-model naming. Not used for user-scoped routes; those continue to use the session access token. Must be stored as a deployment secret.                                                                                                                                                                                                                                                                                                                                                                                 |
| `THEMES_CONFIG_URL`                     | —                              | Base URL for theme configuration and icons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `THEMES_SERVICE_TIMEOUT_MS`             | `5000`                         | Timeout for theme service requests (milliseconds)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `FILE_UPLOAD_MAX_BYTES`                 | `536870912`                    | Maximum file upload size in bytes (default 512 MB); multer rejects larger payloads with 413                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `FILE_TRANSFER_TIMEOUT_MS`              | `30000`                        | Timeout for DIAL Core file upload/download fetch requests (milliseconds)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ARCHIVE_DOWNLOAD_CONCURRENCY`          | `32`                           | Concurrent DIAL Core downloads used while streaming ZIP archives; range 1–32                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ARCHIVE_UPLOAD_MAX_BYTES`              | `536870912`                    | Maximum size (bytes) of an uploaded ZIP archive request body for `POST /api/v1/files/upload-archive` (default 512 MB)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ARCHIVE_UPLOAD_MAX_FILES`              | `1000`                         | Maximum number of non-directory entries extracted from one uploaded archive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES` | `2147483648`                   | Maximum cumulative decompressed bytes across all entries of an uploaded archive, checked incrementally during extraction (default 2 GB)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ARCHIVE_UPLOAD_TIMEOUT_MS`             | `300000`                       | Wall-clock budget (milliseconds) for extracting and uploading an entire archive (default 5 min)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ASR_MODEL`                             | —                              | Deployment ID of a dedicated speech-to-text model. When set (together with the `voice-input` feature), the mic button is always shown and recorded audio is transcribed by this model via `POST /api/v1/transcription`. When absent, the mic button is shown only for deployments whose `inputAttachmentTypes` include an audio MIME type, and transcription is handled by the selected chat deployment.                                                                                                                                                                             |
| `TRANSCRIBE_SIZE_LIMIT_BYTES`           | `5242880`                      | Maximum audio file size (in bytes) accepted for transcription. The frontend rejects recordings larger than this before upload. Default is 5 MB.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `UTILITY_MODEL`                         | —                              | Deployment ID of a utility model for server-side tasks (e.g. LLM conversation naming). Not exposed to the frontend. Required together with `DIAL_API_KEY` and `LLM_CONVERSATION_NAMING_ENABLED=true` to enable automatic title generation after the first assistant reply.                                                                                                                                                                                                                                                                                                           |
| `LLM_CONVERSATION_NAMING_ENABLED`       | `false`                        | When `true` and `UTILITY_MODEL` is set, the backend asynchronously renames conversations after the first assistant reply using the utility model.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `UTILITY_NAMING_TIMEOUT_MS`             | `10000`                        | Timeout in milliseconds for utility-model conversation naming requests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `FEATURED_MODEL_IDS`                    | —                              | Comma-separated list of model (or application) IDs to mark as featured in the catalog. Matching is exact and case-sensitive against the item's `id` field. Example: `chat-hub-v2,gpt-4o,dial-rag`. Takes effect on the next service restart; changing it without a restart has no effect.                                                                                                                                                                                                                                                                                            |
| `HIDDEN_ENTITY_TAG`                     | No                             | A special topic name for models and toolsets that should remain hidden in the Catalog but be visible in the Quick App 2.0 form.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Any string |     |
| `ALLOWED_IFRAME_ORIGINS`                | —                              | Comma-separated list of origins allowed to frame this app and be loaded by it (added to CSP `frame-ancestors` and `frame-src`). Each entry must be an origin only (`scheme://host[:port]`, no path or query string) with an `https://` (or `http://` for local development only) scheme. Required for chat overlay mode and iframe integrations such as Quick Apps editors. Example: `https://quickapps.example.com`                                                                                                                                                                 |
| `OVERLAY_ENABLED`                       | `false`                        | Enables embedded chat overlay runtime mode. Has no effect unless `ALLOWED_IFRAME_ORIGINS` also includes at least one allowed host origin.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `OVERLAY_SANDBOX_ENABLED`               | `false`                        | Serves the overlay sandbox static app at `/overlay-sandbox/`. Intended for development/test environments only; the route is not served when disabled.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `FILE_MANAGER_AVAILABLE_TABS`           | `my_files,shared,organization` | Comma-separated subset of `my_files`, `shared`, `organization` controlling which File Manager tabs are shown. Unknown values (including `review`) are dropped; an unset or fully-invalid value falls back to all three tabs.                                                                                                                                                                                                                                                                                                                                                         |
| `ENABLED_UI_FEATURES`                   | —                              | When set, becomes the complete list of enabled `OverlayFeature` values (replace semantics). Supports both positive flags (e.g. `header`, `likes`) and modifier/hide flags (e.g. `hide-new-conversation`). Unrecognized entries are silently dropped; if all entries are unrecognized, falls back to the compiled-in `DEFAULT_ENABLED_UI_FEATURES` baseline. When unset or empty, the compiled-in defaults apply. An overlay host that supplies its own `enabledFeatures` always overrides this server baseline. Example: `header,likes,conversations-sharing,hide-new-conversation`. |
| `LIVE_CHAT_INTERACTION_ENABLED`         | `false`                        | Enables the interactive toolset sign-in flow: the frontend subscribes to DIAL Core's client-channel and shows a global sign-in dialog when a completion needs mid-stream toolset credentials (`features.liveChatInteraction`).                                                                                                                                                                                                                                                                                                                                                       |
| `LIVE_CHAT_INTERACTION_ENABLED_ROLES`   | —                              | Comma-separated roles allowed to use the feature above when it is enabled. Unset or empty means unrestricted (all authenticated users).                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `SCHEDULER_APP_ID`                      | —                              | DIAL Core application id of the DIAL Scheduler routed deployment, used to build the `/v1/deployments/applications/{id}/route/v1/schedules` upstream path for the `/api/v1/scheduled-tasks*` endpoints. Required only when `features.scheduledTasksEnabled` is used; if unset, those endpoints fail fast with `503`.                                                                                                                                                                                                                                                                  |
| `SCHEDULER_SERVICE_TIMEOUT_MS`          | `10000`                        | Timeout for DIAL Scheduler proxy requests (milliseconds)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `FOOTER_HTML_MESSAGE`                   | —                              | Operator-authored HTML shown in the footer of the chat input area (desktop) and mobile user panel. Supports `%%VERSION%%` token replaced with the current app version server-side. Sanitized server-side (allowlist: `a span strong u em br p`). Unset or empty hides the footer.                                                                                                                                                                                                                                                                                                    |
| `AZURE_FUNCTIONS_API_HOST`              | —                              | Base URL of the Azure Functions host that backs the footer dialog BFF routes (`POST /api/v1/footer/request-api-key` and `POST /api/v1/footer/report-issue`). All three footer dialog vars (`AZURE_FUNCTIONS_API_HOST`, `REQUEST_API_KEY_CODE`, `REPORT_ISSUE_CODE`) must be set together to enable the routes; missing any one returns 503 on submit.                                                                                                                                                                                                                                |
| `REQUEST_API_KEY_CODE`                  | —                              | Azure Function key/code for the Request API Key endpoint. Required together with `AZURE_FUNCTIONS_API_HOST` and `REPORT_ISSUE_CODE`.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `REPORT_ISSUE_CODE`                     | —                              | Azure Function key/code for the Report Issue endpoint. Required together with `AZURE_FUNCTIONS_API_HOST` and `REQUEST_API_KEY_CODE`.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

#### Auth provider environment variables

Each identity provider is configured through its own set of discrete environment variables, following the `AUTH_{PROVIDER_TYPE}_{FIELD_NAME}` convention. A provider is registered only when its `CLIENT_ID` variable is set; an unconfigured provider is silently skipped. If `CLIENT_ID` is set but another field that provider requires is missing, the application fails to boot with an error naming the missing variable. The provider's `id` (used in `/api/v1/auth/login/<id>` and in the `/api/v1/auth/providers` response) is fixed in code and cannot be overridden. Only one instance of each provider type is supported.

**Auth0** (`id: auth0`)

| Variable                      | Required | Default                               |
| ----------------------------- | :------: | ------------------------------------- |
| `AUTH_AUTH0_CLIENT_ID`        |  Yes\*   | —                                     |
| `AUTH_AUTH0_SECRET`           |  Yes\*   | —                                     |
| `AUTH_AUTH0_HOST`             |  Yes\*   | —                                     |
| `AUTH_AUTH0_AUDIENCE`         |    No    | —                                     |
| `AUTH_AUTH0_NAME`             |    No    | `Auth0`                               |
| `AUTH_AUTH0_SCOPE`            |    No    | `openid email profile offline_access` |
| `AUTH_AUTH0_ADMIN_ROLE_NAMES` |    No    | `ADMIN_ROLE_NAMES`                    |
| `AUTH_AUTH0_DIAL_ROLES_FIELD` |    No    | `DIAL_ROLES_FIELD`                    |

**Azure AD** (`id: azure-ad`)

| Variable                         | Required | Default                                         |
| -------------------------------- | :------: | ----------------------------------------------- |
| `AUTH_AZURE_AD_CLIENT_ID`        |  Yes\*   | —                                               |
| `AUTH_AZURE_AD_SECRET`           |  Yes\*   | —                                               |
| `AUTH_AZURE_AD_TENANT_ID`        |  Yes\*   | —                                               |
| `AUTH_AZURE_AD_NAME`             |    No    | `Azure AD`                                      |
| `AUTH_AZURE_AD_SCOPE`            |    No    | `openid profile user.Read email offline_access` |
| `AUTH_AZURE_AD_ADMIN_ROLE_NAMES` |    No    | `ADMIN_ROLE_NAMES`                              |
| `AUTH_AZURE_AD_DIAL_ROLES_FIELD` |    No    | `DIAL_ROLES_FIELD`                              |

**Azure B2C** (`id: azure-b2c`)

| Variable                          | Required | Default                               |
| --------------------------------- | :------: | ------------------------------------- |
| `AUTH_AZURE_B2C_CLIENT_ID`        |  Yes\*   | —                                     |
| `AUTH_AZURE_B2C_CLIENT_SECRET`    |  Yes\*   | —                                     |
| `AUTH_AZURE_B2C_TENANT_ID`        | Yes\*\*  | —                                     |
| `AUTH_AZURE_B2C_USER_FLOW`        | Yes\*\*  | —                                     |
| `AUTH_AZURE_B2C_ISSUER`           | Yes\*\*  | —                                     |
| `AUTH_AZURE_B2C_NAME`             |    No    | `Azure B2C`                           |
| `AUTH_AZURE_B2C_SCOPE`            |    No    | `openid profile email offline_access` |
| `AUTH_AZURE_B2C_ADMIN_ROLE_NAMES` |    No    | `ADMIN_ROLE_NAMES`                    |
| `AUTH_AZURE_B2C_DIAL_ROLES_FIELD` |    No    | `DIAL_ROLES_FIELD`                    |

\*\* Either `AUTH_AZURE_B2C_ISSUER` on its own, or both `AUTH_AZURE_B2C_TENANT_ID` and `AUTH_AZURE_B2C_USER_FLOW` together. When `AUTH_AZURE_B2C_ISSUER` is not set, the issuer is derived as `https://${TENANT_ID}.b2clogin.com/${TENANT_ID}.onmicrosoft.com/${USER_FLOW}/v2.0`.

**GitLab** (`id: gitlab`)

| Variable                       | Required | Default            |
| ------------------------------ | :------: | ------------------ |
| `AUTH_GITLAB_CLIENT_ID`        |  Yes\*   | —                  |
| `AUTH_GITLAB_SECRET`           |  Yes\*   | —                  |
| `AUTH_GITLAB_HOST`             |  Yes\*   | —                  |
| `AUTH_GITLAB_NAME`             |    No    | `GitLab`           |
| `AUTH_GITLAB_SCOPE`            |    No    | `read_user`        |
| `AUTH_GITLAB_ADMIN_ROLE_NAMES` |    No    | `ADMIN_ROLE_NAMES` |
| `AUTH_GITLAB_DIAL_ROLES_FIELD` |    No    | `DIAL_ROLES_FIELD` |

**Google** (`id: google`)

| Variable                | Required | Default                               |
| ----------------------- | :------: | ------------------------------------- |
| `AUTH_GOOGLE_CLIENT_ID` |  Yes\*   | —                                     |
| `AUTH_GOOGLE_SECRET`    |  Yes\*   | —                                     |
| `AUTH_GOOGLE_NAME`      |    No    | `Google`                              |
| `AUTH_GOOGLE_SCOPE`     |    No    | `openid email profile offline_access` |

Google has no host variable (issuer is the fixed `https://accounts.google.com`) and no per-provider admin-role/roles-claim override — it always uses `ADMIN_ROLE_NAMES` / `DIAL_ROLES_FIELD`.

**Keycloak** (`id: keycloak`)

| Variable                         | Required | Default                                                             |
| -------------------------------- | :------: | ------------------------------------------------------------------- |
| `AUTH_KEYCLOAK_CLIENT_ID`        |  Yes\*   | —                                                                   |
| `AUTH_KEYCLOAK_SECRET`           |  Yes\*   | —                                                                   |
| `AUTH_KEYCLOAK_HOST`             |  Yes\*   | — (include the realm path, e.g. `keycloak.example.com/realms/dial`) |
| `AUTH_KEYCLOAK_NAME`             |    No    | `Keycloak`                                                          |
| `AUTH_KEYCLOAK_SCOPE`            |    No    | `openid email profile offline_access`                               |
| `AUTH_KEYCLOAK_ADMIN_ROLE_NAMES` |    No    | `ADMIN_ROLE_NAMES`                                                  |
| `AUTH_KEYCLOAK_DIAL_ROLES_FIELD` |    No    | `DIAL_ROLES_FIELD`                                                  |

**PingID** (`id: ping-id`)

| Variable                        | Required | Default            |
| ------------------------------- | :------: | ------------------ |
| `AUTH_PING_ID_CLIENT_ID`        |  Yes\*   | —                  |
| `AUTH_PING_ID_SECRET`           |  Yes\*   | —                  |
| `AUTH_PING_ID_HOST`             |  Yes\*   | —                  |
| `AUTH_PING_ID_NAME`             |    No    | `PingID`           |
| `AUTH_PING_ID_SCOPE`            |    No    | `offline_access`   |
| `AUTH_PING_ID_ADMIN_ROLE_NAMES` |    No    | `ADMIN_ROLE_NAMES` |
| `AUTH_PING_ID_DIAL_ROLES_FIELD` |    No    | `DIAL_ROLES_FIELD` |

**Cognito** (`id: cognito`)

| Variable                        | Required | Default                                                    |
| ------------------------------- | :------: | ---------------------------------------------------------- |
| `AUTH_COGNITO_CLIENT_ID`        |  Yes\*   | —                                                          |
| `AUTH_COGNITO_SECRET`           |  Yes\*   | —                                                          |
| `AUTH_COGNITO_HOST`             |  Yes\*   | — (e.g. `cognito-idp.{region}.amazonaws.com/{userPoolId}`) |
| `AUTH_COGNITO_NAME`             |    No    | `Cognito`                                                  |
| `AUTH_COGNITO_SCOPE`            |    No    | `openid email profile`                                     |
| `AUTH_COGNITO_ADMIN_ROLE_NAMES` |    No    | `ADMIN_ROLE_NAMES`                                         |
| `AUTH_COGNITO_DIAL_ROLES_FIELD` |    No    | `DIAL_ROLES_FIELD`                                         |

**Okta** (`id: okta`)

| Variable                     | Required | Default                                                             |
| ---------------------------- | :------: | ------------------------------------------------------------------- |
| `AUTH_OKTA_CLIENT_ID`        |  Yes\*   | —                                                                   |
| `AUTH_OKTA_CLIENT_SECRET`    |  Yes\*   | —                                                                   |
| `AUTH_OKTA_ISSUER`           |  Yes\*   | — (full issuer URL, e.g. `https://dev-123.okta.com/oauth2/default`) |
| `AUTH_OKTA_NAME`             |    No    | `Okta`                                                              |
| `AUTH_OKTA_SCOPE`            |    No    | `openid email profile`                                              |
| `AUTH_OKTA_ADMIN_ROLE_NAMES` |    No    | `ADMIN_ROLE_NAMES`                                                  |
| `AUTH_OKTA_DIAL_ROLES_FIELD` |    No    | `DIAL_ROLES_FIELD`                                                  |

\* Required only if that provider is being configured at all (signaled by its `CLIENT_ID` variable being set); the provider is skipped entirely otherwise.

### 3. Run the Application

**Development mode:**

```bash
npm run start:api
```

**Development mode (watch mode):**

```bash
npx nx serve chat-api
```

**Production build:**

```bash
npm run build && npm run build:api
```

**Build and start both frontend and API:**

```bash
npm run start:all
```

The API will be available at:

- **API**: `http://localhost:5000/api`
- **Swagger Docs**: `http://localhost:5000/api/docs`
- **Health Check**: `http://localhost:5000/api/health`

## API Documentation

Interactive API documentation is available at `/api/docs` when the application is running. The documentation is auto-generated from TypeScript decorators and includes:

- All available endpoints
- Request/response schemas
- Error responses
- Query parameter validation rules

## API Endpoints

### Health

- **GET** `/api/health` - Application health status
  - Returns: `{ status: "ok", timestamp: "...", version: "1.0.0" }`

### Themes

- **GET** `/api/themes` - Get themes configuration
  - Returns: Theme configuration object
  - Errors: 404, 502, 503

- **GET** `/api/themes/icon?iconName={name}` - Get theme icon SVG
  - Query params: `iconName` (validated, alphanumeric + dash/underscore/dot only)
  - Returns: SVG content with `image/svg+xml` content type
  - Errors: 400 (invalid name), 404, 502, 503

## Project Structure

```
apps/chat-api/src/
├── app/                    # Application module and core service
│   ├── app.module.ts      # Root module with global configuration
│   ├── app.controller.ts  # Base controller
│   └── app.service.ts     # AI DIAL SDK initialization
├── common/                 # Shared utilities and interceptors
│   └── interceptors/
│       └── metrics.interceptor.ts  # Request metrics logging
├── config/                 # Configuration and validation
│   ├── environment.config.ts  # Environment variables schema
│   └── validation.ts      # Validation function
├── health/                 # Health check endpoint
│   └── health.controller.ts
├── themes/                 # Theme management
│   ├── dto/               # Data transfer objects
│   │   └── get-theme-icon.dto.ts
│   ├── theme.controller.ts
│   ├── theme.service.ts
│   ├── theme.controller.spec.ts  # Integration tests
│   └── theme.service.spec.ts     # Unit tests
└── main.ts                 # Application bootstrap
```

## Error Handling

The API returns appropriate HTTP status codes:

| Status | Description                                  |
| ------ | -------------------------------------------- |
| `200`  | Success                                      |
| `400`  | Bad Request (validation error)               |
| `404`  | Resource Not Found                           |
| `502`  | Bad Gateway (external service error)         |
| `503`  | Service Unavailable (timeout or unreachable) |

All errors include descriptive messages to help with debugging.

## Security & Performance Features

### Security

- **Environment Variable Validation**: Required variables are validated at startup using class-validator
- **Input Validation**: All endpoints use DTOs with validation decorators
- **Path Traversal Protection**: Icon names are validated with regex to prevent directory traversal
- **Security Headers**: Helmet middleware with CSP, HSTS, and other security headers
- **CORS Configuration**: Restricted to configured origin with credentials support
- **Rate Limiting**: Throttling to prevent abuse (100 req/min default, customizable per endpoint)

### Performance

- **Caching**: In-memory caching for theme configuration and icons (5-minute TTL)
- **Cache-Control Headers**: HTTP caching directives for browser/CDN caching
- **Request Timeouts**: Configurable timeouts for external service calls with AbortController
- **Metrics Logging**: Request duration and status tracking for monitoring

## Testing

```bash
# Run all tests
npm test

# Run tests for chat-api only
npx nx test chat-api

# Run tests with coverage
npx nx test chat-api --coverage
```

## CORS Configuration

The API is configured to accept requests from the React application. The allowed origin is configured via the `CORS_ORIGIN` environment variable.

Default CORS settings:

- Origin: `http://localhost:4207` (React app)
- Credentials: `true`

## Static File Serving

The API also serves the built React application. Static files are served from:

```
apps/chat/dist
```

All routes except those prefixed with `/api/*` or `/overlay-sandbox/*` serve
the React application's `index.html`. This enables SPA routing for frontend
routes such as `/catalog` and `/conversations/:id` while API endpoints continue
to be handled by NestJS.

When `OVERLAY_SANDBOX_ENABLED=true`, the API also serves the built overlay
sandbox from:

```
apps/chat-overlay-sandbox/dist
```

The sandbox is mounted at `/overlay-sandbox/`. The main React application's SPA
fallback excludes `/overlay-sandbox/*`, so disabled or missing sandbox routes do
not fall through to the chat UI.

## Logging

The application uses NestJS Logger with contextual logging:

- **Debug**: Development logging (fetch operations, flow tracking)
- **Log**: General information
- **Warn**: Non-critical issues (external service errors)
- **Error**: Critical errors with stack traces

Set `LOG_LEVEL` to control the minimum emitted level independently from
`NODE_ENV`. For example, `LOG_LEVEL=debug` enables debug logs in a production
container without enabling development-only features such as Swagger.

## Troubleshooting

### Application won't start

- **Check environment variables**: Ensure all required variables are set
- **Validation errors**: The application validates environment variables at startup and will fail with clear error messages if configuration is invalid

### Theme endpoints returning errors

- **404 Not Found**: Theme configuration or icon doesn't exist on the external service
- **503 Service Unavailable**: Theme service is down or request timed out
- **502 Bad Gateway**: Theme service returned an error response

Check the logs for detailed error messages including the external service URL and response status.

### Timeout errors

Adjust the `THEMES_SERVICE_TIMEOUT_MS` environment variable if the external theme service is slow to respond.

## Related Documentation

- [NestJS Documentation](https://docs.nestjs.com/)
- [AI DIAL SDK](https://github.com/epam/ai-dial-sdk)
- [Swagger/OpenAPI](https://swagger.io/specification/)
