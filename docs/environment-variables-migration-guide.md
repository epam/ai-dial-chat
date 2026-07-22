# Environment Variables Migration Guide

Full list of environment variables read by `apps/chat-api` (source of truth:
`apps/chat-api/src/config/environment.config.ts`, validated at boot via
`EnvironmentVariables`). The frontend (`apps/chat`) does not read env vars
directly — all runtime config is served by the API (see `AppConfigContext`).

## Auth / session

| Variable                        | Required                                       | Default            | Description                                                                                                                         |
| ------------------------------- | ---------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SESSION_SECRET`           | Yes                                            | —                  | 64-char hex (32-byte) session encryption key                                                                                        |
| `AUTH_SESSION_PREV_SECRET`      | No                                             | —                  | Previous secret, accepted during key rotation                                                                                       |
| `AUTH_SESSION_COOKIE_NAME`      | No                                             | `__Host-chat.sess` | Session cookie name                                                                                                                 |
| `AUTH_TRANSACTION_COOKIE_NAME`  | No                                             | `__Host-chat.tx`   | Login transaction cookie name                                                                                                       |
| `AUTH_COOKIE_SECURE`            | No                                             | `true`             | Set `false` only for local HTTP smoke testing; drops `__Host-` prefix when disabled                                                 |
| `AUTH_CALLBACK_BASE_URL`        | Yes                                            | —                  | Public API base URL used for OIDC redirect URIs                                                                                     |
| `AUTH_POST_LOGOUT_REDIRECT_URI` | If any provider is configured (new-style only) | —                  | Where the browser lands after IdP logout; applied to every configured provider                                                      |
| `ADMIN_ROLE_NAMES`              | No                                             | `admin`            | Comma-separated fallback admin role names, used when a provider sets no override                                                    |
| `DIAL_ROLES_FIELD`              | No                                             | `dial_roles`       | Fallback dot-separated roles-claim path, used when a provider sets no override                                                      |

### Auth providers

Each identity provider is configured through discrete `AUTH_{PROVIDER_TYPE}_{FIELD_NAME}` variables instead of a single JSON blob. A provider is registered only when its `CLIENT_ID` variable is set. See `apps/chat-api/README.md` § "Auth provider environment variables" for the full per-provider variable tables (Auth0, Azure AD, Azure B2C, GitLab, Google, Keycloak, PingID, Cognito, Okta), including required fields, defaults, and issuer derivation.

### Migrated from `AUTH_PROVIDERS`

The single `AUTH_PROVIDERS` JSON-array environment variable has been removed; it is no longer read at boot. For each object that used to be an entry in that array, map its fields to the new provider-specific variables:

| Old `AUTH_PROVIDERS[i]` field | New variable(s)                                                                                                                                         | Notes                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                          | _(none — fixed in code)_                                                                                                                                | The id is now one of the 9 hardcoded provider ids (`auth0`, `azure-ad`, `azure-b2c`, `gitlab`, `google`, `keycloak`, `ping-id`, `cognito`, `okta`); pick the matching provider's variable set. |
| `issuer`                      | `AUTH_{PROVIDER}_HOST` / `AUTH_{PROVIDER}_TENANT_ID` (+`AUTH_{PROVIDER}_USER_FLOW` for Azure B2C) / `AUTH_{PROVIDER}_ISSUER` (Azure B2C override, Okta) | See the per-provider issuer derivation formulas in `apps/chat-api/README.md`.                                                                                                                  |
| `clientId`                    | `AUTH_{PROVIDER}_CLIENT_ID`                                                                                                                             | —                                                                                                                                                                                              |
| `clientSecret`                | `AUTH_{PROVIDER}_SECRET` (`AUTH_AZURE_B2C_CLIENT_SECRET`, `AUTH_OKTA_CLIENT_SECRET`)                                                                    | Field name is `SECRET` for most providers, `CLIENT_SECRET` for Azure B2C and Okta.                                                                                                             |
| `scope`                       | `AUTH_{PROVIDER}_SCOPE`                                                                                                                                 | Omit to use the provider's built-in default scope.                                                                                                                                             |
| `label`                       | `AUTH_{PROVIDER}_NAME`                                                                                                                                  | Omit to use the provider's built-in default display label.                                                                                                                                     |
| `audience`                    | `AUTH_AUTH0_AUDIENCE`                                                                                                                                   | Auth0 only.                                                                                                                                                                                    |
| `rolesClaim`                  | `AUTH_{PROVIDER}_DIAL_ROLES_FIELD`, else app-wide `DIAL_ROLES_FIELD`                                                                                    | —                                                                                                                                                                                              |
| `adminRoles`                  | `AUTH_{PROVIDER}_ADMIN_ROLE_NAMES`, else app-wide `ADMIN_ROLE_NAMES`                                                                                    | Comma-separated instead of a JSON array.                                                                                                                                                       |
| `postLogoutRedirectUri`       | `AUTH_POST_LOGOUT_REDIRECT_URI` (app-wide, applies to all providers)                                                                                    | No longer set per provider.                                                                                                                                                                    |

## DIAL Core

| Variable        | Required | Default | Description                                              |
| --------------- | -------- | ------- | -------------------------------------------------------- |
| `DIAL_CORE_URL` | Yes      | —       | Internal DIAL Core service URL, never exposed to clients |

## Themes

| Variable                    | Required | Default | Description                                |
| --------------------------- | -------- | ------- | ------------------------------------------ |
| `THEMES_CONFIG_URL`         | No       | —       | Base URL for theme configuration and icons |
| `THEMES_SERVICE_TIMEOUT_MS` | No       | `5000`  | Timeout for theme service requests (ms)    |

## File transfer / archives

| Variable                                | Required | Default      | Description                                                        |
| --------------------------------------- | -------- | ------------ | ------------------------------------------------------------------ |
| `FILE_UPLOAD_MAX_BYTES`                 | No       | `536870912`  | Max single file upload size (bytes)                                |
| `FILE_TRANSFER_TIMEOUT_MS`              | No       | `30000`      | Timeout for DIAL Core file upload/download requests (ms)           |
| `ARCHIVE_MAX_ITEMS`                     | No       | `100`        | Max items in an archive listing/operation                          |
| `ARCHIVE_MAX_FILES`                     | No       | `1000`       | Max files in an archive                                            |
| `ARCHIVE_MAX_UNCOMPRESSED_BYTES`        | No       | `5368709120` | Max decompressed size for an archive                               |
| `ARCHIVE_TIMEOUT_MS`                    | No       | `300000`     | Timeout for archive operations (ms)                                |
| `ARCHIVE_DOWNLOAD_CONCURRENCY`          | No       | `32`         | Concurrent DIAL Core downloads while streaming ZIP archives (1–32) |
| `ARCHIVE_UPLOAD_MAX_BYTES`              | No       | `536870912`  | Max size of an uploaded ZIP archive request body                   |
| `ARCHIVE_UPLOAD_MAX_FILES`              | No       | `1000`       | Max non-directory entries extracted from one uploaded archive      |
| `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES` | No       | `2147483648` | Max cumulative decompressed bytes across all entries of an upload  |
| `ARCHIVE_UPLOAD_TIMEOUT_MS`             | No       | `300000`     | Wall-clock budget for extracting and uploading an entire archive   |

## Deployments / catalog

| Variable                   | Required | Default | Description                                                        |
| -------------------------- | -------- | ------- | ------------------------------------------------------------------ |
| `DEFAULT_DEPLOYMENT`       | No       | —       | Default deployment ID shown to users without a persisted selection |
| `FEATURED_MODEL_IDS`       | No       | `[]`    | Comma-separated model IDs featured in the catalog                  |
| `HIDDEN_ENTITY_TAGS`       | No       | `[]`    | Comma-separated tags used to hide catalog entities                 |
| `DEV_QUICKAPPS_EDITOR_URL` | No       | —       | URL of the QuickApps editor (dev tooling)                          |

## Voice / ASR

| Variable                      | Required | Default   | Description                                                                          |
| ----------------------------- | -------- | --------- | ------------------------------------------------------------------------------------ |
| `TRANSCRIBE_SIZE_LIMIT_BYTES` | No       | `5242880` | Max audio file size accepted by the transcription endpoint                           |
| `ASR_ENABLED_ROLES`           | No       | `[]`      | Comma-separated roles allowed to use ASR (empty = all roles when `ASR_MODEL` is set) |

## Utility model / LLM conversation naming

| Variable                          | Required | Default | Description                                                                 |
| --------------------------------- | -------- | ------- | --------------------------------------------------------------------------- |
| `UTILITY_MODEL`                   | No       | —       | Deployment ID of the utility model used for server-side tasks (e.g. naming) |
| `LLM_CONVERSATION_NAMING_ENABLED` | No       | `false` | Enables LLM-based conversation naming after the first assistant reply       |
| `UTILITY_NAMING_TIMEOUT_MS`       | No       | `10000` | Timeout for the naming request (ms)                                         |
