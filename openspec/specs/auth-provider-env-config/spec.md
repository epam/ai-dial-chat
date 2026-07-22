# Spec: auth-provider-env-config

## ADDED Requirements

### Requirement: Fixed, hardcoded provider ids

The system SHALL support exactly nine OIDC providers — Auth0, Azure AD, Azure B2C, GitLab, Google, Keycloak, PingID, Cognito, Okta — each identified by a hardcoded id constant (`auth0`, `azure-ad`, `azure-b2c`, `gitlab`, `google`, `keycloak`, `ping-id`, `cognito`, `okta`). No environment variable SHALL determine or override a provider's id.

#### Scenario: Provider id is not configurable

- **WHEN** the application boots with `AUTH_AUTH0_CLIENT_ID`, `AUTH_AUTH0_SECRET`, and `AUTH_AUTH0_HOST` set
- **THEN** the registered provider's id is exactly `auth0`, regardless of any other environment variable value

### Requirement: Per-provider environment variables configure providers

The system SHALL read each provider's configuration from discrete environment variables named `AUTH_{PROVIDER_TYPE}_{FIELD_NAME}` (matching the reference DIAL Chat frontend convention).

#### Scenario: Auth0 configured via discrete variables

- **WHEN** `AUTH_AUTH0_CLIENT_ID`, `AUTH_AUTH0_SECRET`, and `AUTH_AUTH0_HOST` are set
- **THEN** the system registers an `auth0` provider using those values, deriving the OIDC issuer as `https://${AUTH_AUTH0_HOST}/`

### Requirement: The legacy AUTH_PROVIDERS variable is no longer supported

The system SHALL NOT read or parse an `AUTH_PROVIDERS` environment variable. Provider registration SHALL always be assembled from the discrete `AUTH_{PROVIDER_TYPE}_{FIELD_NAME}` variables described in this capability.

#### Scenario: AUTH_PROVIDERS has no effect

- **WHEN** an `AUTH_PROVIDERS` environment variable is set (legacy JSON-array value, malformed value, or otherwise) alongside one or more discrete `AUTH_{PROVIDER_TYPE}_{FIELD_NAME}` variables
- **THEN** the system ignores `AUTH_PROVIDERS` entirely and registers providers using only the discrete variables

### Requirement: A provider is included only when its variables are present

For each of the nine providers, the system SHALL treat the provider's `CLIENT_ID` variable (`AUTH_{PROVIDER_TYPE}_CLIENT_ID`) as the presence signal. A provider whose `CLIENT_ID` variable is unset SHALL be entirely excluded from the assembled provider list, with no error raised for that provider.

#### Scenario: Unconfigured provider is skipped silently

- **WHEN** none of the `AUTH_OKTA_*` environment variables are set
- **THEN** no `okta` provider is registered and no error is raised for Okta specifically

#### Scenario: Only configured providers appear in the list

- **WHEN** only Auth0 and Google are configured via their respective environment variables
- **THEN** `ProviderRegistryService.listProviders()` returns exactly two entries, with ids `auth0` and `google`

### Requirement: Partial provider configuration fails application boot

When a provider's `CLIENT_ID` variable is set but another field required for that provider (its client secret field, and its host/tenant/issuer field) is missing, the system SHALL throw a descriptive error during application boot identifying the provider and the missing variable, and SHALL NOT start serving requests.

#### Scenario: Missing secret fails boot

- **WHEN** `AUTH_AUTH0_CLIENT_ID` and `AUTH_AUTH0_HOST` are set but `AUTH_AUTH0_SECRET` is not set
- **THEN** application boot fails with an error message naming `auth0` and `AUTH_AUTH0_SECRET`

#### Scenario: Missing host/tenant/issuer fails boot

- **WHEN** `AUTH_AZURE_AD_CLIENT_ID` and `AUTH_AZURE_AD_SECRET` are set but `AUTH_AZURE_AD_TENANT_ID` is not set
- **THEN** application boot fails with an error message naming `azure-ad` and `AUTH_AZURE_AD_TENANT_ID`

### Requirement: Provider-specific issuer derivation

The system SHALL derive each provider's OIDC issuer URL as follows, matching the reference app's documented formulas:

- Auth0: `https://${AUTH_AUTH0_HOST}/`
- Azure AD: `https://login.microsoftonline.com/${AUTH_AZURE_AD_TENANT_ID}/v2.0`
- Azure B2C: `AUTH_AZURE_B2C_ISSUER` if set; otherwise `https://${AUTH_AZURE_B2C_TENANT_ID}.b2clogin.com/${AUTH_AZURE_B2C_TENANT_ID}.onmicrosoft.com/${AUTH_AZURE_B2C_USER_FLOW}/v2.0`
- GitLab: `https://${AUTH_GITLAB_HOST}`
- Google: the fixed constant `https://accounts.google.com` (no host variable)
- Keycloak: `https://${AUTH_KEYCLOAK_HOST}`
- PingID: `https://${AUTH_PING_ID_HOST}`
- Cognito: `https://${AUTH_COGNITO_HOST}`
- Okta: `AUTH_OKTA_ISSUER` directly

#### Scenario: Azure B2C falls back to the tenant/user-flow formula

- **WHEN** `AUTH_AZURE_B2C_TENANT_ID=acme`, `AUTH_AZURE_B2C_USER_FLOW=B2C_1_signupsignin`, and `AUTH_AZURE_B2C_ISSUER` is not set
- **THEN** the derived issuer is `https://acme.b2clogin.com/acme.onmicrosoft.com/B2C_1_signupsignin/v2.0`

#### Scenario: Azure B2C explicit issuer overrides the formula

- **WHEN** `AUTH_AZURE_B2C_ISSUER=https://custom.example.com/b2c` is set alongside `AUTH_AZURE_B2C_TENANT_ID` and `AUTH_AZURE_B2C_USER_FLOW`
- **THEN** the derived issuer is exactly `https://custom.example.com/b2c`

#### Scenario: Okta reads its issuer directly

- **WHEN** `AUTH_OKTA_ISSUER=https://dev-123.okta.com/oauth2/default` is set
- **THEN** the derived issuer is exactly `https://dev-123.okta.com/oauth2/default`, with no additional URL construction

### Requirement: Per-provider default scope and label

When `AUTH_{PROVIDER_TYPE}_SCOPE` is not set, the system SHALL use a hardcoded default scope for that provider: Auth0/Google/Keycloak `openid email profile offline_access`; Azure AD `openid profile user.Read email offline_access`; Azure B2C `openid profile email offline_access`; GitLab `read_user`; PingID `offline_access`; Cognito/Okta `openid email profile`. When `AUTH_{PROVIDER_TYPE}_NAME` is not set, the system SHALL use a hardcoded human-readable default label for that provider (`Auth0`, `Azure AD`, `Azure B2C`, `GitLab`, `Google`, `Keycloak`, `PingID`, `Cognito`, `Okta`).

#### Scenario: Default scope applied when unset

- **WHEN** `AUTH_GITLAB_CLIENT_ID`, `AUTH_GITLAB_SECRET`, `AUTH_GITLAB_HOST` are set and `AUTH_GITLAB_SCOPE` is not set
- **THEN** the registered GitLab OIDC client requests scope `read_user`

#### Scenario: Explicit scope overrides the default

- **WHEN** `AUTH_GITLAB_SCOPE=read_user api` is set
- **THEN** the registered GitLab OIDC client requests scope `read_user api`, not the default

#### Scenario: Default label applied when unset

- **WHEN** `AUTH_AZURE_AD_NAME` is not set and Azure AD is otherwise fully configured
- **THEN** `listProviders()` returns the label `Azure AD` for the `azure-ad` entry

### Requirement: Fallback chain for admin roles and roles claim path

For each provider, `adminRoles` SHALL resolve from `AUTH_{PROVIDER_TYPE}_ADMIN_ROLE_NAMES` (comma-separated) if set, else the app-wide `ADMIN_ROLE_NAMES` (comma-separated, default `admin`) if set, else `undefined`. `rolesClaim` SHALL resolve from `AUTH_{PROVIDER_TYPE}_DIAL_ROLES_FIELD` if set, else the app-wide `DIAL_ROLES_FIELD` (default `dial_roles`).

#### Scenario: Provider-specific admin roles override the app-wide default

- **WHEN** `ADMIN_ROLE_NAMES=admin` and `AUTH_OKTA_ADMIN_ROLE_NAMES=super-admin,admin` are both set
- **THEN** the Okta provider's `adminRoles` is `['super-admin', 'admin']`

#### Scenario: App-wide default applies when no provider override is set

- **WHEN** `AUTH_GOOGLE_CLIENT_ID`/`SECRET` are set, `ADMIN_ROLE_NAMES` is not set, and Google has no admin-role override variable
- **THEN** the Google provider's `adminRoles` is `['admin']` (the app-wide default)

#### Scenario: App-wide roles claim default applies

- **WHEN** `DIAL_ROLES_FIELD` is not set and `AUTH_KEYCLOAK_DIAL_ROLES_FIELD` is not set, with Keycloak otherwise configured
- **THEN** the Keycloak provider's `rolesClaim` is `dial_roles`

### Requirement: Single app-wide post-logout redirect URI

The system SHALL read a new required-if-any-provider-is-configured environment variable, `AUTH_POST_LOGOUT_REDIRECT_URI`, and SHALL use its value as the `postLogoutRedirectUri` for every assembled provider, replacing the previous per-entry JSON `postLogoutRedirectUri` field.

#### Scenario: Post-logout redirect applied to every provider

- **WHEN** `AUTH_POST_LOGOUT_REDIRECT_URI=https://chat.example.com` is set, and both Auth0 and Google are configured
- **THEN** both the Auth0 and Google `ProviderConfig` entries have `postLogoutRedirectUri` equal to `https://chat.example.com`

#### Scenario: Missing redirect URI fails boot when a provider is configured

- **WHEN** at least one provider (e.g. Auth0) is fully configured and `AUTH_POST_LOGOUT_REDIRECT_URI` is not set
- **THEN** application boot fails with an error naming `AUTH_POST_LOGOUT_REDIRECT_URI`

### Requirement: Provider listing response shape is unchanged

`ProviderRegistryService.listProviders()` SHALL continue to return an array of `{ id: string; label: string }`, unchanged in shape from before this change, so the `/api/v1/auth/providers` endpoint and its consumers (`spa-auth-session` capability) require no changes.

#### Scenario: Response shape stable across the migration

- **WHEN** Auth0 and Keycloak are configured via the new discrete environment variables
- **THEN** `GET /api/v1/auth/providers` returns `[{ "id": "auth0", "label": "Auth0" }, { "id": "keycloak", "label": "Keycloak" }]` in the same shape the endpoint returned when configuration came from the old `AUTH_PROVIDERS` JSON variable
