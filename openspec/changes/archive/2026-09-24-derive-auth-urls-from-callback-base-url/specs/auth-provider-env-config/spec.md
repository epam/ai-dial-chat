## MODIFIED Requirements

### Requirement: Single app-wide post-logout redirect URI

The system SHALL read an app-wide environment variable, `AUTH_POST_LOGOUT_REDIRECT_URI`, and SHALL use its value as the `postLogoutRedirectUri` for every assembled provider, replacing the previous per-entry JSON `postLogoutRedirectUri` field. When `AUTH_POST_LOGOUT_REDIRECT_URI` is not set, the system SHALL default its value to `AUTH_CALLBACK_BASE_URL`. The variable remains explicitly overridable to any other value, including when one or more providers are configured.

#### Scenario: Post-logout redirect applied to every provider

- **WHEN** `AUTH_POST_LOGOUT_REDIRECT_URI=https://chat.example.com` is set, and both Auth0 and Google are configured
- **THEN** both the Auth0 and Google `ProviderConfig` entries have `postLogoutRedirectUri` equal to `https://chat.example.com`

#### Scenario: Missing redirect URI defaults to AUTH_CALLBACK_BASE_URL

- **WHEN** `AUTH_CALLBACK_BASE_URL=https://chat.example.com` is set, `AUTH_POST_LOGOUT_REDIRECT_URI` is not set, and at least one provider (e.g. Auth0) is fully configured
- **THEN** application boot succeeds and the Auth0 `ProviderConfig`'s `postLogoutRedirectUri` is `https://chat.example.com`

#### Scenario: Explicit redirect URI overrides the default

- **WHEN** `AUTH_CALLBACK_BASE_URL=https://chat.example.com` and `AUTH_POST_LOGOUT_REDIRECT_URI=https://accounts.chat.example.com/signed-out` are both set, and Auth0 is configured
- **THEN** the Auth0 `ProviderConfig`'s `postLogoutRedirectUri` is `https://accounts.chat.example.com/signed-out`, not `AUTH_CALLBACK_BASE_URL`

## ADDED Requirements

### Requirement: CORS origin defaults to the auth callback base URL

The system SHALL read an app-wide environment variable, `CORS_ORIGIN`, used as the allowed CORS origin for `app.enableCors(...)` and as an allowed origin in `AuthController`'s origin checks and `CsrfGuard`'s Origin/Referer validation. When `CORS_ORIGIN` is not set, the system SHALL default its value to `AUTH_CALLBACK_BASE_URL`. The variable remains explicitly overridable to any other value.

#### Scenario: Unset CORS_ORIGIN defaults to AUTH_CALLBACK_BASE_URL

- **WHEN** `AUTH_CALLBACK_BASE_URL=https://chat.example.com` is set and `CORS_ORIGIN` is not set
- **THEN** the application allows CORS requests from `https://chat.example.com` and rejects requests from other origins

#### Scenario: Explicit CORS_ORIGIN overrides the default

- **WHEN** `AUTH_CALLBACK_BASE_URL=https://api.chat.example.com` and `CORS_ORIGIN=https://chat.example.com` are both set
- **THEN** the application allows CORS requests from `https://chat.example.com`, not from `https://api.chat.example.com`

#### Scenario: CORS setup reads the same validated value as the rest of the application

- **WHEN** the application boots with `CORS_ORIGIN` set to any valid value
- **THEN** `app.enableCors(...)`, `AuthController`'s origin checks, and `CsrfGuard` all observe that same value, with no separate raw-`process.env` read producing a different effective origin
