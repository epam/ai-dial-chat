# catalog-toolset-credentials Specification

## Purpose
TBD - created by archiving change catalog-toolset-credentials-login. Update Purpose after archive.

## Requirements

### Requirement: Credentials action visibility and label resolution
The Catalog Details Panel SHALL show a credentials action for `Toolset` items whose
`authenticationType` is not `NONE`, and SHALL show no credentials action (button, section, or
logged-out warning icon) for toolsets whose `authenticationType` is `NONE`. The action label and behavior SHALL be
resolved from four states, matching the legacy Marketplace decision tree:
- **Manage credentials** / **Manage API keys**: the current user is an admin and the toolset is public. The label depends on the toolset's own `authenticationType`: an `ApiKey` toolset reads **"Manage API keys"**, every other authenticating type reads **"Manage credentials"**. Both resolve through the same `manageCredentialsActionLabel` override, which receives the `authenticationType` and defaults to that pair — so an assertion on this state MUST branch on the authentication type rather than expecting the generic wording.
- **Login with my creds** (`CredentialsUiState.LoginWithMyCreds`): the user is not an admin, the
  toolset is public, and the user is not personally (`USER`-level) signed in. This state has no
  label of its own: it renders the same label as the **Log in** state.
- **Log in**: none of the above, and the toolset is not signed in at `USER` or `GLOBAL` level.
- **Log out**: the toolset is signed in at `USER` or `GLOBAL` level (and the user is not in the
  admin+public "Manage credentials" case).

Outside the "Manage credentials" state, the label depends on the authentication type. An `OAUTH`
toolset shows **"Log in"** (Log in / Login with my creds) or **"Log out"** (Log out). An `API_KEY`
toolset shows **"API key"** (Log in / Login with my creds) or **"Change API key"** (Log out), and
the action opens a personal API-key popover (`CredentialsApiKeyOverlay`, `USER` level) instead of
logging in or out directly.

Label/text overrides flow through `ItemDetailsTexts` fields (`manageCredentialsActionLabel`,
`loginActionLabel`, `logoutActionLabel`, `apiKeyActionLabel`, `changeApiKeyActionLabel`), each
defaulting to English text. There is no `loginWithMyCredsActionLabel` override.

#### Scenario: No auth toolset shows no credentials UI
- **WHEN** a user opens the Details Panel for a toolset with `authenticationType: NONE`
- **THEN** no credentials button, section, or logged-out warning icon is rendered anywhere in
  the panel or on its card/list row

#### Scenario: Admin on a public API-key toolset sees Manage API keys
- **GIVEN** the current user is an admin and the toolset is public with `authenticationType: ApiKey`
- **WHEN** the Details Panel is opened
- **THEN** the credentials action reads "Manage API keys", not "Manage credentials"

#### Scenario: Admin on public toolset sees Manage credentials
- **WHEN** an admin user opens the Details Panel for a public toolset with `authenticationType`
  other than `NONE`
- **THEN** the panel shows a "Manage credentials" action regardless of sign-in state at either
  level

#### Scenario: Non-admin on public OAuth toolset not signed in personally sees Log in
- **WHEN** a non-admin user opens the Details Panel for a public `OAUTH` toolset where they are not
  signed in at `USER` level (regardless of `GLOBAL` status)
- **THEN** the panel shows "Log in", and clicking it starts a `USER`-level login

#### Scenario: API-key toolset shows API key or Change API key
- **WHEN** a user outside the admin+public case opens the Details Panel for an `API_KEY` toolset
- **THEN** the action reads "API key" when the toolset is not signed in, or "Change API key" when
  it is, and clicking it opens the personal API-key popover

#### Scenario: Signed out toolset shows Log in
- **WHEN** a user opens the Details Panel for a toolset that is not public, or where the user is
  an admin on a private toolset, and the toolset is signed out at both `USER` and `GLOBAL` level
- **THEN** the panel shows "Log in" for an `OAUTH` toolset ("API key" for an `API_KEY` toolset)

#### Scenario: Signed-in toolset shows Log out
- **WHEN** a user opens the Details Panel for a toolset signed in at `USER` or `GLOBAL` level,
  outside the admin+public case
- **THEN** the panel shows "Log out" for an `OAUTH` toolset ("Change API key" for an `API_KEY`
  toolset)

### Requirement: Admin + public two-level "Manage credentials" section
Clicking the action SHALL open the `CredentialsManagementPanel` sub-screen of the Details Panel
when it resolves to "Manage credentials" / "Manage API keys". The sub-screen shows
an identity card for the item, a description, and two `CredentialsRow` entries: "Personal
credentials" (`USER` level) and "Organization credentials" (`GLOBAL` level). Each row shows its
own status ("Signed in" / "Signed out"), a checkmark when that level is the one in effect, a login
action ("Log in" for OAuth, an API-key input with "Add" for `API_KEY`), and, once signed in, "Log
out" (OAuth) or "Delete" for the configured key (`API_KEY`). Personal credentials take
precedence: the organization row's checkmark is hidden while the personal row is signed in. The
rows are not collapsible sections. In every other case there is no level chooser: the header
action acts on the `USER` level, or on the signed-in level for "Log out".

#### Scenario: Admin sees both credential levels independently
- **WHEN** an admin clicks "Manage credentials" on a public toolset
- **THEN** the `CredentialsManagementPanel` sub-screen opens with a "Personal credentials" row and
  an "Organization credentials" row, each showing its own signed-in status and its own actions

#### Scenario: Personal credentials take precedence in the checkmark
- **WHEN** both the `USER` and `GLOBAL` levels are signed in
- **THEN** only the "Personal credentials" row shows the active checkmark

#### Scenario: Non-admin sees no level chooser
- **WHEN** a non-admin user clicks "Log in", "API key", "Change API key", or "Log out"
- **THEN** no management sub-screen opens, and the action applies to a single resolved level

### Requirement: Signed-in detection uses either credentials level
A toolset SHALL be considered signed in if its `USER`-level status **or** its `GLOBAL`-level
status is `SIGNED_IN`. This applies to the header action label, the card/list logged-out
warning icon, and the level resolved for a direct "Log out" action.

#### Scenario: Signed in via GLOBAL only still shows Log out
- **WHEN** a toolset's `USER`-level status is `SIGNED_OUT` and its `GLOBAL`-level status is
  `SIGNED_IN`
- **THEN** the panel shows "Log out" (not "Log in"), and its card shows no logged-out warning
  icon

### Requirement: API key login submission with level and header hint
For `authenticationType: API_KEY` toolsets, the system SHALL present, in the personal API-key
popover and in each `CredentialsManagementPanel` row, an API key input that, when the toolset
configures a key header (`credentials.apiKeyHeader`), shows a hint naming that header below the
input as the input's accessible description (`aria-describedby`; default text
`Enter your API key value for "{header}" header`, overridable through `apiKeyHeaderHint`), and, on submit
("Add"), SHALL call the toolset login endpoint with `credentialsLevel` set to the level of the
popover or row submitted (`USER` or `GLOBAL`).

#### Scenario: Submit API key at USER level
- **WHEN** a user enters an API key in the personal API-key popover or the "Personal
  credentials" row and submits
- **THEN** the system calls `POST /api/v1/toolsets/{toolsetName}/login` with
  `credentialsLevel: USER` and the entered `apiKey`

#### Scenario: Admin submits API key at GLOBAL level
- **WHEN** an admin enters an API key in the "Organization credentials" row and submits
- **THEN** the system calls `POST /api/v1/toolsets/{toolsetName}/login` with
  `credentialsLevel: GLOBAL` and the entered `apiKey`

#### Scenario: API key hint names the configured header
- **WHEN** the toolset's `API_KEY` authentication is configured with a key header (e.g.
  `X-Api-Key`)
- **THEN** the API key input shows the hint `Enter your API key value for "X-Api-Key" header`
  and exposes it as the input's accessible description

#### Scenario: No hint without a configured header
- **WHEN** the toolset's `API_KEY` authentication has no key header
- **THEN** the API key input shows no header hint and has no accessible description

### Requirement: OAuth login opens in a new window at the resolved level
For `authenticationType: OAUTH` toolsets, the system SHALL present, in the header action or a
`CredentialsManagementPanel` row, a "Log in" button that initiates the OAuth handshake with `credentialsLevel` set
to the level of the header action (`USER`) or of the row (`USER` or `GLOBAL`) by opening a same-origin popup window synchronously (so a blocked
popup can be reliably detected), then navigating that popup to the provider's authorization page,
leaving the Catalog tab or Toolset Editor tab on its current page. The authorize URL SHALL
use HTTPS, or plain HTTP only for a loopback host; the system SHALL reject any other scheme, and
plain HTTP to a non-loopback host, before opening a popup (`buildToolsetAuthorizeUrl` in
`libs/chat-hooks/src/oauth/authorize-url.ts` returns `null`). The
system SHALL sever the popup's `window.opener` relationship before navigating away from the
same-origin placeholder. The authorize URL SHALL
include `code_challenge`/`code_challenge_method` when the toolset's stored OAuth configuration
includes them. The system SHALL NOT rely on the popup's `window.opener` reference remaining
usable after the popup navigates to the cross-origin authorization endpoint. After the provider
redirects back to the shared callback route (loaded inside that popup), the system SHALL
complete the login call with the stored `credentialsLevel`, report a typed success or failure
result to the tab that initiated the flow, and close the popup.

#### Scenario: Initiate OAuth login from Catalog at GLOBAL level
- **WHEN** an admin clicks "Log in" in the "Organization credentials" row of an OAuth toolset
- **THEN** the system opens a same-origin popup synchronously, persists redirect state scoped to
  the flow with `credentialsLevel: GLOBAL`, navigates the popup to the provider authorization URL
  (including `code_challenge`/`code_challenge_method` when configured), and the Catalog tab
  remains on the Catalog page

#### Scenario: Callback window reports its result and closes itself
- **WHEN** the provider redirects back to the callback route inside the popup opened for a
  Catalog- or Editor-initiated login
- **THEN** the system completes the login call using the stored `credentialsLevel`, reports a
  typed success or failure result to the tab that initiated the flow, and closes that popup,
  without navigating the original tab

#### Scenario: Popup blocked
- **WHEN** the browser blocks the synchronous popup open for an OAuth login attempt
- **THEN** the system shows a translated "popup blocked" error notification and does not persist
  redirect state for that attempt

#### Scenario: Unsafe authorization endpoint
- **WHEN** a toolset OAuth configuration contains an authorization endpoint such as a
  `javascript:` or `data:` URL, or a plain `http:` URL on a non-loopback host
- **THEN** the system rejects the configuration and does not open or navigate a popup

### Requirement: FAILED credential state is cleared before a new login attempt
When the target credentials level's current status is `FAILED`, the system SHALL sign out that
level before attempting a new API-key or OAuth login, so a broken authentication state does not
block re-authentication.

#### Scenario: Login retried after a FAILED state
- **WHEN** a user submits new credentials for a level currently in `FAILED` status
- **THEN** the system calls the logout endpoint for that level before calling the login endpoint

### Requirement: Logout confirmation
Logging out at any credentials level SHALL require confirmation before the logout endpoint is
called, except for the "Delete" action in the personal API-key popover. The confirmation is an
in-panel `ConfirmationView` sub-view of the Details Panel (`DetailsConfirmationKind.Logout`,
holding the pending level), not a modal dialog. The level is the one passed by a
`CredentialsManagementPanel` row, or the signed-in level from `getSignedInLevel` for the header's
"Log out" action. Deleting a configured API key from a `CredentialsManagementPanel` row uses a
separate `DetailsConfirmationKind.DeleteApiKey` confirmation. The "Delete" action in the personal
API-key popover calls logout directly, without a confirmation step.

#### Scenario: Confirm logout
- **WHEN** a user clicks "Log out" and confirms in the confirmation sub-view
- **THEN** the system calls `POST /api/v1/toolsets/{toolsetName}/logout` with the resolved
  `credentialsLevel`

#### Scenario: Cancel logout
- **WHEN** a user clicks "Log out" and cancels the confirmation sub-view
- **THEN** no logout request is sent and the signed-in state is unchanged

#### Scenario: Header Log out opens the confirmation directly
- **WHEN** a non-admin user (or an admin on a private toolset) clicks the header's "Log out"
  action on an OAuth toolset
- **THEN** the confirmation sub-view opens immediately for the signed-in level

#### Scenario: Delete an organization API key
- **WHEN** an admin clicks "Delete" on the configured key in the "Organization credentials" row
- **THEN** a `DeleteApiKey` confirmation sub-view opens for the `GLOBAL` level before any logout
  request is sent

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
After a successful API-key or OAuth login or logout, the system SHALL refresh the open Details
Panel's credential status, the Toolset Editor's login/logout action, and the underlying toolset
list used by the Catalog grid/list/favorites views, without a full page reload, so cards, rows,
and favorite cards reflect the change immediately. The Details Panel's post-action refresh SHALL
retry a bounded number of times (3 attempts, 300ms apart) when the refreshed credentials do not
yet show the expected sign-in state for the level just acted on, before falling back to whatever
the last attempt returned — covering a transient blip or upstream credential-propagation lag
without retrying indefinitely.

#### Scenario: Panel updates after API-key login
- **WHEN** an API key login succeeds
- **THEN** the Details Panel's credentials status updates to reflect the signed-in state
  without the user reloading the page

#### Scenario: Card warning icon updates after API-key logout
- **WHEN** an API-key logout succeeds
- **THEN** the logged-out warning icon on the corresponding toolset card's avatar appears without
  a full page reload

#### Scenario: Catalog refreshes after a successful OAuth login
- **WHEN** the tab that initiated an OAuth login for a Catalog toolset receives a success result
  from the callback popup
- **THEN** the system refetches the toolset list without a full page reload, the open Details
  Panel (if any) updates its credentials status to signed in, its "Log in" action becomes
  "Log out", and the logged-out warning icon is removed from the toolset's card, row, and
  favorite card

#### Scenario: Catalog shows an error after a failed OAuth login
- **WHEN** the tab that initiated an OAuth login receives a failure result from the callback
  popup
- **THEN** the system shows an error notification, shows no success notification, keeps "Log in"
  available, and the logged-out warning icon remains on the toolset's card, row, and favorite
  card

#### Scenario: Toolset Editor reflects a successful OAuth login
- **WHEN** the Toolset Editor tab that initiated an OAuth login receives a success result from
  the callback popup
- **THEN** the Editor's authentication section updates its login state so the available action
  changes from "Log in" to "Log out", and the existing success notification is shown

#### Scenario: Toolset Editor keeps Log in available after a failed OAuth login
- **WHEN** the Toolset Editor tab that initiated an OAuth login receives a failure result from
  the callback popup
- **THEN** "Log in" remains the available action and the existing error notification is shown

#### Scenario: OAuth login abandoned by closing the popup
- **WHEN** a user manually closes the OAuth popup before it completes, or the flow exceeds its
  pending timeout without a result
- **THEN** the initiating tab clears its busy state, keeps "Log in" available, and shows no
  success notification; when the pending timeout elapses, the system also closes the popup so a
  late callback cannot complete the abandoned login

#### Scenario: Post-login details refresh retries past a stale first read
- **WHEN** a login succeeds but the details refresh issued immediately afterward still reports
  the pre-login (signed-out) status for the level just logged in
- **THEN** the system retries the details refresh up to 2 more times, 300ms apart, and applies
  the first result that reports the expected signed-in status; if all attempts still report
  signed-out, the panel shows the last attempt's result rather than retrying indefinitely

#### Scenario: Post-logout details refresh stops once signed-out is confirmed
- **WHEN** a logout succeeds and the first details refresh issued afterward already reports the
  expected signed-out status for the level just logged out
- **THEN** the system does not issue any further retry for that logout

### Requirement: Toolset card and list logged-out warning icon
Toolset cards (grid view), rows (list view), and favorite cards in the Catalog SHALL mark a
signed-out toolset with a filled warning-triangle icon anchored to the bottom-end corner of the
entity avatar and overlapping its edge, rather than with a text tag placed in the card body. The
icon SHALL be shown when `authenticationType` is not `NONE` and the toolset is not signed in at
`USER` or `GLOBAL` level. No icon is shown when the toolset is signed in at either level, or
when `authenticationType` is `NONE`. This applies identically to `API_KEY` and `OAUTH`
toolsets and is deliberately simpler than the legacy Marketplace's `CredentialsStatusIndicator`,
which also distinguished "MY CREDS"/"ORG CREDS" signed-in states; no positive/signed-in indicator
is introduced.

The icon SHALL carry `role="img"` with an accessible label and SHALL show that same text in a
hover tooltip, so its meaning is available without relying on color or shape alone. The text
defaults to `'Authorize to use this toolset.'` and is overridable by the host through the
existing `credentialsBadgeLoggedOutLabel` text prop (`CardGridTitles`, `ListViewProps`,
`FavoritesProps`, `ItemDetailsTexts`, `GridContext`). The triangle icon itself is decorative
(`aria-hidden`) inside that labeled wrapper.

The icon SHALL be visually separated from the avatar artwork behind it by a halo stroke drawn in
the surrounding surface color. Its fill and halo colors SHALL be themable CSS custom properties
with `--text-warning-icon` and `--bg-layer-raised` fallbacks, overridable through
`CredentialsBadgeColors` (`icon`, `halo`), which `libs/catalog` exports alongside
`CredentialsBadgeProps`.

Hosting the icon over the avatar is the responsibility of the avatar block: `AppIdentity` SHALL
accept an `iconOverlay` node rendered inside a positioned icon wrapper, so the same icon appears
in the same corner across grid cards, favorite cards, and list rows.

#### Scenario: Logged out warning icon
- **WHEN** a toolset with auth enabled has no active credentials at any level
- **THEN** its card and list row show the warning icon on the bottom-end corner of the entity
  avatar

#### Scenario: Warning icon exposes its meaning as text
- **WHEN** a user hovers or focuses the logged-out warning icon
- **THEN** a tooltip shows the logged-out label, and assistive technology reads the same text as
  the icon's accessible name

#### Scenario: No icon when signed in
- **WHEN** a toolset is signed in at `USER` level, at `GLOBAL` level, or both
- **THEN** its card and list row show no credentials warning icon

#### Scenario: No icon for no-auth toolsets
- **WHEN** a toolset has `authenticationType: NONE`
- **THEN** its card and list row show no credentials warning icon

#### Scenario: Favorite card shows the same warning icon
- **WHEN** a toolset with auth enabled has no active credentials at any level and is displayed as
  a favorite card
- **THEN** the favorite card shows the same avatar-anchored warning icon as the toolset's grid
  card and list row

#### Scenario: Icon rule is identical for API key and OAuth toolsets
- **WHEN** two toolsets, one with `authenticationType: API_KEY` and one with
  `authenticationType: OAUTH`, are both signed out at every credentials level
- **THEN** both show the warning icon on their card, list row, and favorite card, with no
  difference in treatment based on authentication type

### Requirement: Library isolation for credentials UI
`libs/catalog` SHALL expose the credentials UI only through additive props on `CatalogItem`,
`CatalogProps`, `DetailsPanelProps`, `CardProps`, `ListViewProps`/`CardGridProps`, and
`ItemDetailsTexts` (a plain `credentials` status object using string-literal/enum states scoped
to the lib's own types, `onLogin`/`onLogout` callbacks carrying an explicit `level`, and text
overrides). All admin/public/level decision logic (`getCredentialsUiState`,
`getCredentialsBadgeState`, `getSignedInLevel`) SHALL be pure functions operating only on the
lib's own `CatalogItemCredentials` shape. `libs/catalog` SHALL NOT import API clients,
auth/session context, routing, or app-specific enums. The DIAL-Core-to-lib mapping (including
`isManageableByAdmin` and the credentials status mapping in
`libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`) and the login/logout
orchestration (`useCatalogToolsetCredentials`, the OAuth popup and handshake) live in
`libs/chat-hooks`; `apps/chat`'s `CatalogView.tsx` wires them up and passes the results into
`libs/catalog`.

#### Scenario: Lib renders and decides from plain props only
- **WHEN** `CredentialsManagementPanel`, `CredentialsRow`, `Header`, and `CredentialsBadge` are
  implemented in `libs/catalog`
- **THEN** their source, and the pure decision helpers they call, import no
  `@epam/chat-api-client`, no `server-api` module, no router, and no app-owned enum/type — only
  `CatalogItem`/`CatalogItemCredentials` fields, callback props, and text props
