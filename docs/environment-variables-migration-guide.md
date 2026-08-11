# Environment Variables Migration Guide

Full list of environment variables read by `apps/chat-api` (source of truth:
`apps/chat-api/src/config/environment.config.ts`, validated at boot via
`EnvironmentVariables`). The frontend (`apps/chat`) does not read env vars
directly — all runtime config is served by the API (see `AppConfigContext`).

## Auth / session

| Variable                        | Required                                       | Default            | Description                                                                         |
| ------------------------------- | ---------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `AUTH_SESSION_SECRET`           | Yes                                            | —                  | 64-char hex (32-byte) session encryption key                                        |
| `AUTH_SESSION_PREV_SECRET`      | No                                             | —                  | Previous secret, accepted during key rotation                                       |
| `AUTH_SESSION_COOKIE_NAME`      | No                                             | `__Host-chat.sess` | Session cookie name                                                                 |
| `AUTH_TRANSACTION_COOKIE_NAME`  | No                                             | `__Host-chat.tx`   | Login transaction cookie name                                                       |
| `AUTH_COOKIE_SECURE`            | No                                             | `true`             | Set `false` only for local HTTP smoke testing; drops `__Host-` prefix when disabled |
| `AUTH_CALLBACK_BASE_URL`        | Yes                                            | —                  | Public API base URL used for OIDC redirect URIs                                     |
| `AUTH_POST_LOGOUT_REDIRECT_URI` | If any provider is configured (new-style only) | —                  | Where the browser lands after IdP logout; applied to every configured provider      |
| `ADMIN_ROLE_NAMES`              | No                                             | `admin`            | Comma-separated fallback admin role names, used when a provider sets no override    |
| `DIAL_ROLES_FIELD`              | No                                             | `dial_roles`       | Fallback dot-separated roles-claim path, used when a provider sets no override      |

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

## Announcement banner / footer

| Variable                    | Required | Default                    | Description                                                                                                                                   |
| --------------------------- | -------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANNOUNCEMENT_TITLE`        | No       | —                          | Bold heading of the top-of-app banner. Plain text, never parsed as markup. Blank is treated as unset                                          |
| `ANNOUNCEMENT_DESCRIPTION`  | No       | —                          | Supporting copy after the title. Sanitized server-side (`a b strong em br span`); overflow is truncated with an ellipsis, so keep it short    |
| `ANNOUNCEMENTS`             | No       | `[]`                       | JSON array behind the `+N announcements` pill. Max 10 entries; invalid entries are dropped with a log line and never fail the request or boot |
| `ANNOUNCEMENT_HTML_MESSAGE` | No       | —                          | Legacy single-line banner. Still supported; ignored when either of the two variables above is set                                             |
| `FOOTER_HTML_MESSAGE`       | No       | —                          | Operator HTML below the chat input. Sanitized server-side (`a span strong u em br p`). Supports the `%%VERSION%%` token                       |
| `CHAT_VERSION`              | No       | app `package.json` version | Deployed build version, shown in the footer's version label and substituted for `%%VERSION%%`. Set from CI/CD                                 |

### Migrating from `ANNOUNCEMENT_HTML_MESSAGE`

Nothing is required — an existing deployment keeps working untouched, and dismissals users
already recorded stay valid. Migrate only when you want the structured layout.

**Before** — one string, rendered centered:

```sh
ANNOUNCEMENT_HTML_MESSAGE='<strong>Welcome to DIAL!</strong> Explore our AI offerings.'
```

**After** — heading and body separated, rendered start-aligned:

```sh
ANNOUNCEMENT_TITLE='🎉 Welcome to DIAL! 🎉'
ANNOUNCEMENT_DESCRIPTION='Explore our AI offerings with your data.'
```

Setting either new variable switches the banner to the structured layout and makes
`ANNOUNCEMENT_HTML_MESSAGE` inert — the two are not combined. Unset both to roll back; no code
change and no storage cleanup is needed.

Three things to expect when you migrate:

- **The banner is restyled either way.** Upgrading to a build that supports these variables
  changes the legacy banner's surface — the previous gradient background and leading megaphone
  icon are gone — even if you set nothing. Its structure and behaviour (centered, one line,
  dismissible) are unchanged.
- **Users who dismissed the old message will see the new one.** Dismissal is keyed on content, so
  moving text from `ANNOUNCEMENT_HTML_MESSAGE` into the new variables is a content change and the
  banner reappears for everyone. That is usually what you want; schedule accordingly if not.
- **Markup does not carry over from the title.** `ANNOUNCEMENT_HTML_MESSAGE` accepted inline HTML;
  `ANNOUNCEMENT_TITLE` does not and will display tags literally. Move any formatting into
  `ANNOUNCEMENT_DESCRIPTION`, which keeps the same allowlist.

### Adding the announcements popover

`ANNOUNCEMENTS` is independent of the banner text — set it alongside a title/description, or on
its own:

```sh
ANNOUNCEMENTS='[
  {"title":"We have upgraded to DIAL 1.43 🎉",
   "description":"Check what'"'"'s new:",
   "link":{"label":"Changelog","href":"https://example.com/changelog"}},
  {"title":"Planned maintenance on Friday"}
]'
```

- `description` and `link` are optional. An entry with no link renders as an informational row.
- An entry is dropped when its title is blank, or when its `link` is present but has a blank
  label or an `href` that is not an absolute `http`/`https` URL. Relative paths are rejected on
  purpose — announcement config must not be able to point at an in-app route.
- Dropping is deliberate: an entry whose link is malformed is removed entirely rather than
  rendered without its call to action, so a broken link cannot pass unnoticed.
- Malformed JSON resolves to `[]` and hides the pill. **Rejected entries appear only in the
  server log** — there is no UI feedback, so check the logs after changing this value.
- Dismissing the banner also hides the pill, since it lives inside the banner.
