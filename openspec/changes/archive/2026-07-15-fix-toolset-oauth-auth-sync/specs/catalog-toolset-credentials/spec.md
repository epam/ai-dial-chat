## MODIFIED Requirements

### Requirement: OAuth login opens in a new window at the resolved level
For toolsets with `authenticationType: OAUTH`, the active section SHALL present a "Log in"
button that initiates the OAuth handshake with `credentialsLevel` set to the level of the
section (`USER` or `GLOBAL`) by opening a same-origin popup window synchronously (so a blocked
popup can be reliably detected), then navigating that popup to the provider's authorization page,
leaving the Catalog tab or Toolset Editor tab on its current page. The authorize URL SHALL
use the HTTP or HTTPS scheme; the system SHALL reject other schemes before opening a popup. The
system SHALL sever the popup's `window.opener` relationship before navigating away from the
same-origin placeholder. The authorize URL SHALL
include `code_challenge`/`code_challenge_method` when the toolset's stored OAuth configuration
includes them. The system SHALL NOT rely on the popup's `window.opener` reference remaining
usable after the popup navigates to the cross-origin authorization endpoint. After the provider
redirects back to the shared callback route (loaded inside that popup), the system SHALL
complete the login call with the stored `credentialsLevel`, report a typed success or failure
result to the tab that initiated the flow, and close the popup.

#### Scenario: Initiate OAuth login from Catalog at GLOBAL level
- **WHEN** an admin clicks "Log in" in the "Entire organization credentials" section of an OAuth
  toolset
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
- **WHEN** a toolset OAuth configuration contains a non-HTTP(S) authorization endpoint such as a
  `javascript:` or `data:` URL
- **THEN** the system rejects the configuration and does not open or navigate a popup

### Requirement: Panel and list refresh after login/logout
After a successful API-key or OAuth login or logout, the system SHALL refresh the open Details
Panel's credential status, the Toolset Editor's login/logout action, and the underlying toolset
list used by the Catalog grid/list/favorites views, without a full page reload, so cards, rows,
and favorite cards reflect the change immediately.

#### Scenario: Panel updates after API-key login
- **WHEN** an API key login succeeds
- **THEN** the Details Panel's credentials status updates to reflect the signed-in state
  without the user reloading the page

#### Scenario: Card badge updates after API-key logout
- **WHEN** an API-key logout succeeds
- **THEN** the corresponding toolset card's credentials badge updates without a full page reload

#### Scenario: Catalog refreshes after a successful OAuth login
- **WHEN** the tab that initiated an OAuth login for a Catalog toolset receives a success result
  from the callback popup
- **THEN** the system refetches the toolset list without a full page reload, the open Details
  Panel (if any) updates its credentials status to signed in, its "Log in" action becomes
  "Log out", and the toolset's card/row/favorite-card badge is removed

#### Scenario: Catalog shows an error after a failed OAuth login
- **WHEN** the tab that initiated an OAuth login receives a failure result from the callback
  popup
- **THEN** the system shows an error notification, shows no success notification, keeps "Log in"
  available, and the toolset's card/row/favorite-card badge remains "LOGGED OUT"

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

### Requirement: Toolset card and list credentials badge
Toolset cards (grid view), rows (list view), and favorite cards in the Catalog SHALL show a
"LOGGED OUT" credentials badge when `authenticationType` is not `NONE` and the toolset is not
signed in at `USER` or `GLOBAL` level. No badge is shown when the toolset is signed in at either
level, or when `authenticationType` is `NONE`. This applies identically to `API_KEY` and `OAUTH`
toolsets and is deliberately simpler than the legacy Marketplace's `CredentialsStatusIndicator`,
which also distinguished "MY CREDS"/"ORG CREDS" signed-in states; no positive/signed-in badge is
introduced.

#### Scenario: Logged out badge
- **WHEN** a toolset with auth enabled has no active credentials at any level
- **THEN** its card and list row show a "LOGGED OUT" badge

#### Scenario: No badge when signed in
- **WHEN** a toolset is signed in at `USER` level, at `GLOBAL` level, or both
- **THEN** its card and list row show no credentials badge

#### Scenario: No badge for no-auth toolsets
- **WHEN** a toolset has `authenticationType: NONE`
- **THEN** its card and list row show no credentials badge

#### Scenario: Favorite card shows the same logged out badge
- **WHEN** a toolset with auth enabled has no active credentials at any level and is displayed as
  a favorite card
- **THEN** the favorite card shows the same "LOGGED OUT" badge as the toolset's grid card and
  list row

#### Scenario: Badge rule is identical for API key and OAuth toolsets
- **WHEN** two toolsets, one with `authenticationType: API_KEY` and one with
  `authenticationType: OAUTH`, are both signed out at every credentials level
- **THEN** both show the "LOGGED OUT" badge on their card, list row, and favorite card, with no
  difference in badge treatment based on authentication type
