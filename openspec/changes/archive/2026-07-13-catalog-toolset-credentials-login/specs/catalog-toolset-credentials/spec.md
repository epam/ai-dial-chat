## ADDED Requirements

### Requirement: Credentials action visibility and label resolution
The Catalog Details Panel SHALL show a credentials action for `Toolset` items whose
`authenticationType` is not `NONE`, and SHALL show no credentials action (button, section, or
badge) for toolsets whose `authenticationType` is `NONE`. The action label and behavior SHALL
be resolved from four states, matching the legacy Marketplace decision tree:
- **Manage credentials**: the current user is an admin and the toolset is public.
- **Login with my creds**: the user is not an admin, the toolset is public, and the user is not
  personally (`USER`-level) signed in.
- **Log in**: none of the above, and the toolset is not signed in at `USER` or `GLOBAL` level.
- **Log out**: the toolset is signed in at `USER` or `GLOBAL` level (and the user is not in the
  admin+public "Manage credentials" case).

Label/text overrides flow through `ItemDetailsTexts` fields (`manageCredentialsActionLabel`,
`loginWithMyCredsActionLabel`, `loginActionLabel`, `logoutActionLabel`), each defaulting to
English text.

#### Scenario: No auth toolset shows no credentials UI
- **WHEN** a user opens the Details Panel for a toolset with `authenticationType: NONE`
- **THEN** no credentials button, section, or badge is rendered anywhere in the panel or on its
  card/list row

#### Scenario: Admin on public toolset sees Manage credentials
- **WHEN** an admin user opens the Details Panel for a public toolset with `authenticationType`
  other than `NONE`
- **THEN** the panel shows a "Manage credentials" action regardless of sign-in state at either
  level

#### Scenario: Non-admin on public toolset not signed in personally sees Login with my creds
- **WHEN** a non-admin user opens the Details Panel for a public toolset where they are not
  signed in at `USER` level (regardless of `GLOBAL` status)
- **THEN** the panel shows "Login with my creds"

#### Scenario: Signed out toolset shows Log in
- **WHEN** a user opens the Details Panel for a toolset that is not public, or where the user is
  an admin on a private toolset, and the toolset is signed out at both `USER` and `GLOBAL` level
- **THEN** the panel shows "Log in"

#### Scenario: Signed-in toolset shows Log out
- **WHEN** a user opens the Details Panel for a toolset signed in at `USER` or `GLOBAL` level,
  outside the admin+public case
- **THEN** the panel shows "Log out"

### Requirement: Admin + public two-level "Manage credentials" section
When the credentials action resolves to "Manage credentials", the Details Panel SHALL show two
independently expandable sections — "My credentials" (`USER` level) and "Entire organization
credentials" (`GLOBAL` level) — each displaying its own signed-in status, login form, and logout
control. For all other cases, the panel SHALL show a single section scoped to the resolved level
with no level chooser.

#### Scenario: Admin sees both credential levels independently
- **WHEN** an admin expands "Manage credentials" on a public toolset
- **THEN** both "My credentials" and "Entire organization credentials" sections are shown, each
  independently expandable, each showing its own signed-in status

#### Scenario: Non-admin sees a single section
- **WHEN** a non-admin user expands "Log in", "Login with my creds", or "Log out"
- **THEN** only one section is shown, scoped to the resolved level, with no level selector

### Requirement: Signed-in detection uses either credentials level
A toolset SHALL be considered signed in if its `USER`-level status **or** its `GLOBAL`-level
status is `SIGNED_IN`. This applies to the header action label, the card/list badge, and the
level resolved for a direct "Log out" action.

#### Scenario: Signed in via GLOBAL only still shows Log out
- **WHEN** a toolset's `USER`-level status is `SIGNED_OUT` and its `GLOBAL`-level status is
  `SIGNED_IN`
- **THEN** the panel shows "Log out" (not "Log in"), and its card badge is not "LOGGED OUT"

### Requirement: API key login submission with level and header hint
For toolsets with `authenticationType: API_KEY`, the active section SHALL present an API key
input showing a hint naming the configured key header (default:
`Enter your API key value for "{header}" header`) and, on submit, SHALL call the toolset login
endpoint with `credentialsLevel` set to the level of the section submitted (`USER` or `GLOBAL`).

#### Scenario: Submit API key at USER level
- **WHEN** a user enters an API key in the "My credentials" / "Login with my creds" / single
  "Log in" section scoped to `USER` and submits
- **THEN** the system calls `POST /api/v1/toolsets/{toolsetName}/login` with
  `credentialsLevel: USER` and the entered `apiKey`

#### Scenario: Admin submits API key at GLOBAL level
- **WHEN** an admin expands "Entire organization credentials", enters an API key, and submits
- **THEN** the system calls `POST /api/v1/toolsets/{toolsetName}/login` with
  `credentialsLevel: GLOBAL` and the entered `apiKey`

#### Scenario: API key hint names the configured header
- **WHEN** the toolset's `API_KEY` authentication is configured with a key header (e.g.
  `X-Api-Key`)
- **THEN** the API key input shows the hint `Enter your API key value for "X-Api-Key" header`

### Requirement: OAuth login opens in a new window at the resolved level
For toolsets with `authenticationType: OAUTH`, the active section SHALL present a "Log in"
button that initiates the OAuth handshake with `credentialsLevel` set to the level of the
section (`USER` or `GLOBAL`) by opening the provider's authorization page in a new browser
window/tab, leaving the Catalog tab on its current page. The authorize URL SHALL include
`code_challenge`/`code_challenge_method` when the toolset's stored OAuth configuration includes
them. After the provider redirects back to the shared callback route (loaded inside that new
window), the system SHALL complete the login call with the stored `credentialsLevel` and close
the window. The Catalog tab does not automatically refresh; the user reopens the panel or
reloads the list to see updated status.

#### Scenario: Initiate OAuth login from Catalog at GLOBAL level
- **WHEN** an admin clicks "Log in" in the "Entire organization credentials" section of an OAuth
  toolset
- **THEN** the system persists redirect state with `credentialsLevel: GLOBAL`, opens the
  provider authorization URL (including `code_challenge`/`code_challenge_method` when
  configured) in a new browser window/tab, and the Catalog tab remains on the Catalog page

#### Scenario: Callback window closes itself after completing login
- **WHEN** the provider redirects back to the callback route inside the window opened for a
  Catalog-initiated login
- **THEN** the system completes the login call using the stored `credentialsLevel` and closes
  that window, without navigating the original Catalog tab

### Requirement: FAILED credential state is cleared before a new login attempt
When the target credentials level's current status is `FAILED`, the system SHALL sign out that
level before attempting a new API-key or OAuth login, so a broken authentication state does not
block re-authentication.

#### Scenario: Login retried after a FAILED state
- **WHEN** a user submits new credentials for a level currently in `FAILED` status
- **THEN** the system calls the logout endpoint for that level before calling the login endpoint

### Requirement: Logout confirmation
Logging out at any credentials level SHALL require confirmation via a confirmation dialog
before the logout endpoint is called. Clicking a resolved "Log out" action outside the
admin+public case opens this confirmation directly, without first expanding a section.

#### Scenario: Confirm logout
- **WHEN** a user clicks "Log out" and confirms the dialog
- **THEN** the system calls `POST /api/v1/toolsets/{toolsetName}/logout` with the resolved
  `credentialsLevel`

#### Scenario: Cancel logout
- **WHEN** a user clicks "Log out" and cancels the dialog
- **THEN** no logout request is sent and the signed-in state is unchanged

#### Scenario: Direct logout confirmation without expanding a section
- **WHEN** a non-admin user (or an admin on a private toolset) clicks the header's "Log out"
  action
- **THEN** the confirmation dialog opens immediately, without first requiring the section to be
  expanded

### Requirement: Success and error notifications after login/logout
After a login or logout call completes, the system SHALL show a notification: on success, a
message including the toolset's name and version, using an "organization" variant when the
action was performed by an admin at `GLOBAL` level on a public toolset, a personal variant at
`USER` level, and a default variant otherwise; on failure, an error notification.

#### Scenario: Success notification after USER-level login
- **WHEN** a `USER`-level login succeeds
- **THEN** a success notification is shown referencing the toolset's personal credentials

#### Scenario: Success notification after admin GLOBAL-level login on a public toolset
- **WHEN** an admin's `GLOBAL`-level login succeeds on a public toolset
- **THEN** a success notification is shown referencing organization-wide credentials

#### Scenario: Error notification on failure
- **WHEN** a login or logout call fails
- **THEN** an error notification is shown and no success notification is shown

### Requirement: Panel and list refresh after login/logout
After a successful API-key login or logout, the system SHALL refresh the open Details Panel's
credential status and the underlying toolset list used by the Catalog grid/list view, without a
full page reload, so card/list badges reflect the change immediately. OAuth logins (which
navigate through a separate browser window) are exempt from this automatic refresh.

#### Scenario: Panel updates after API-key login
- **WHEN** an API key login succeeds
- **THEN** the Details Panel's credentials status updates to reflect the signed-in state
  without the user reloading the page

#### Scenario: Card badge updates after API-key logout
- **WHEN** an API-key logout succeeds
- **THEN** the corresponding toolset card's credentials badge updates without a full page reload

### Requirement: Toolset card and list credentials badge
Toolset cards (grid view) and rows (list view) in the Catalog SHALL show a "LOGGED OUT"
credentials badge when `authenticationType` is not `NONE` and the toolset is not signed in at
`USER` or `GLOBAL` level. No badge is shown when the toolset is signed in at either level, or
when `authenticationType` is `NONE`. This is deliberately simpler than the legacy Marketplace's
`CredentialsStatusIndicator`, which also distinguished "MY CREDS"/"ORG CREDS" signed-in states.

#### Scenario: Logged out badge
- **WHEN** a toolset with auth enabled has no active credentials at any level
- **THEN** its card and list row show a "LOGGED OUT" badge

#### Scenario: No badge when signed in
- **WHEN** a toolset is signed in at `USER` level, at `GLOBAL` level, or both
- **THEN** its card and list row show no credentials badge

#### Scenario: No badge for no-auth toolsets
- **WHEN** a toolset has `authenticationType: NONE`
- **THEN** its card and list row show no credentials badge

### Requirement: Library isolation for credentials UI
`libs/catalog` SHALL expose the credentials UI only through additive props on `CatalogItem`,
`CatalogProps`, `DetailsPanelProps`, `CardProps`, `ListViewProps`/`CardGridProps`, and
`ItemDetailsTexts` (a plain `credentials` status object using string-literal/enum states scoped
to the lib's own types, `onLogin`/`onLogout` callbacks carrying an explicit `level`, and text
overrides). All admin/public/level decision logic (`getCredentialsUiState`,
`getCredentialsBadgeState`, `getSignedInLevel`) SHALL be pure functions operating only on the
lib's own `CatalogItemCredentials` shape. `libs/catalog` SHALL NOT import API clients,
auth/session context, routing, or app-specific enums; all such integration knowledge SHALL be
resolved in `apps/chat` (mappers, `CatalogView.tsx`) before being passed into the lib.

#### Scenario: Lib renders and decides from plain props only
- **WHEN** `CredentialsSection`, `Header`, and `CredentialsBadge` are implemented in
  `libs/catalog`
- **THEN** their source, and the pure decision helpers they call, import no
  `@epam/chat-api-client`, no `server-api` module, no router, and no app-owned enum/type — only
  `CatalogItem`/`CatalogItemCredentials` fields, callback props, and text props
