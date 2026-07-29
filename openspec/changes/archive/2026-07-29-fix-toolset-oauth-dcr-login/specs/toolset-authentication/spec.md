## MODIFIED Requirements

### Requirement: OAuth redirect and callback handshake

For OAuth login with config, the system SHALL save the OAuth configuration (Editor) or use the
already-configured toolset (Catalog), persist the redirect state (`toolsetId`,
`credentialsLevel`) to `sessionStorage`, and open the provider authorization URL in a new
browser window/tab rather than navigating the current page away. `credentialsLevel` SHALL be an
explicit, caller-supplied value — `USER` for the Toolset Editor; `USER` or `GLOBAL` for a
Catalog-initiated login (`GLOBAL` only reachable by an admin managing a public toolset). The
authorize URL SHALL include `code_challenge`/`code_challenge_method` query parameters when the
toolset's stored OAuth configuration includes them. A shared callback route, loaded inside that
new window, SHALL read the persisted state and complete login by submitting the authorization
`code`, `redirectUri`, and the stored `credentialsLevel`, then post the outcome to the opener over
the flow's `BroadcastChannel` and write the same non-secret outcome into the callback popup's
same-origin URL. The callback SHALL remove the OAuth authorization code from its URL, repeat the
channel result until the opener acknowledges it, and close itself after acknowledgement. The
opener SHALL continue listening when cross-origin navigation makes its retained `WindowProxy`
appear closed while the opener is in the background, consume either the channel result or the
popup URL marker, and acknowledge the result before refreshing status. A popup SHALL be treated
as manually cancelled only after focus returns to the opener and the popup reference remains
closed, or after the pending flow timeout. Therefore, a completed login cannot be mistaken for
manual cancellation and the handoff requires no delay timer. The popup result URL SHALL NOT
contain the OAuth authorization code or credentials. The environment SHALL serve Chat with
`Cross-Origin-Opener-Policy: same-origin-allow-popups`, not Helmet's `same-origin` default, so
navigation to an external OAuth provider does not sever the opener's popup reference and make an
active login appear manually cancelled; the popup SHALL still clear its own `window.opener`
before external navigation. The page that initiated login (Toolset Editor or Catalog) SHALL
never be navigated away and, after receiving a successful result, SHALL show a success
notification and refetch the shared toolset list so the updated authentication status is visible
without a second login attempt or page reload.

For the Toolset Editor's "With Login" OAuth mode specifically (no manually configured client),
where the `clientId`/`authorizationEndpoint` are assigned by DIAL Core's dynamic client
registration during create/update rather than entered by the user, the system SHALL open the
same-origin placeholder popup synchronously in the click handler (before any asynchronous work),
then, after the persist-before-login step resolves the toolset id, fetch that toolset's current
`authSettings` and use the Core-issued `clientId`/`authorizationEndpoint` from that fetch — not
the pre-save form state, which does not carry them — to build the authorize URL and navigate the
already-open popup. If the manually configured client fields are already present in the editor's
form state (the "with login & config" mode, or an already-saved toolset being re-logged-in),
the system SHALL continue to build the authorize URL directly from that form state without an
extra fetch.

#### Scenario: Initiate OAuth login from the editor

- **WHEN** a user saves an OAuth toolset in login-with-config mode from the Toolset Editor, or
  clicks "Log in" on an already-configured OAuth toolset
- **THEN** the system stores redirect state with `credentialsLevel: USER`, opens the provider
  authorization URL in a new window/tab, and the editor tab remains on its current page

#### Scenario: Initiate OAuth login from the Catalog at USER level

- **WHEN** a user clicks "Log in" for an OAuth toolset in the Catalog Details Panel in a section
  scoped to `USER`
- **THEN** the system stores redirect state with `credentialsLevel: USER`, opens the provider
  authorization URL in a new window/tab, and the Catalog tab remains on its current page

#### Scenario: Initiate OAuth login from the Catalog at GLOBAL level

- **WHEN** an admin clicks "Log in" in the "Entire organization credentials" section of an OAuth
  toolset in the Catalog Details Panel
- **THEN** the system stores redirect state with `credentialsLevel: GLOBAL`, opens the provider
  authorization URL in a new window/tab, and the Catalog tab remains on its current page

#### Scenario: Authorize URL includes PKCE parameters when configured

- **WHEN** the toolset's stored OAuth configuration includes a `code_challenge` and
  `code_challenge_method`
- **THEN** the authorize URL includes both as query parameters

#### Scenario: Complete OAuth callback and report the result

- **WHEN** the provider redirects back to the callback route inside the window opened for
  login
- **THEN** the system reads the stored redirect state, calls the login endpoint with the code,
  redirect URI, and the stored `credentialsLevel`, removes the authorization code from the popup
  URL, writes the non-secret outcome into that URL, and repeats it over the flow's
  `BroadcastChannel` until the opener acknowledges consumption, after which the callback closes
  itself

#### Scenario: External provider navigation preserves popup tracking

- **WHEN** the OAuth popup navigates from Chat to a cross-origin identity provider
- **THEN** Chat's `same-origin-allow-popups` COOP policy keeps the popup reference observable by
  the opener, while the popup's cleared `window.opener` prevents the provider from navigating the
  Chat tab

#### Scenario: Opener recovers a result after the channel event is missed

- **WHEN** the callback wrote its result into the popup URL, but the opener did not receive the
  first `BroadcastChannel` event
- **THEN** the callback repeats the result, while the opener can also read it from the same-origin
  popup URL; after consuming either copy, the opener acknowledges the result, resolves the login
  outcome, and refreshes the toolset status

#### Scenario: Popup reference is severed during cross-origin navigation

- **WHEN** the OAuth provider navigation makes the opener's retained popup reference report
  `closed` while the OAuth window remains open
- **THEN** the opener keeps the flow channel active, consumes and acknowledges the callback
  result, and the callback closes its own window

#### Scenario: User manually closes the OAuth popup

- **WHEN** the popup is closed without a result and focus returns to the initiating tab
- **THEN** the system resolves the login flow as cancelled without showing an error notification

#### Scenario: Successful OAuth login refreshes the initiating page

- **WHEN** the opener receives a successful OAuth login result
- **THEN** it shows a success notification and refetches the shared toolset list so the updated
  authentication status is immediately available in the initiating tab

#### Scenario: Callback without stored state

- **WHEN** the callback route is reached with no valid stored redirect state
- **THEN** the system does not attempt a login and closes the window

#### Scenario: First login for a brand-new dynamically-registered toolset succeeds

- **WHEN** a user creates a new toolset, selects OAuth "With Login" (no manually configured
  client), and clicks "Log in" for the very first time
- **THEN** the system opens a placeholder popup synchronously, persists the new toolset, fetches
  its Core-issued `authSettings`, builds the authorize URL from the fetched `clientId`/
  `authorizationEndpoint`, and navigates the already-open popup to it instead of showing "Failed
  to log in"

#### Scenario: Manually configured OAuth client skips the extra fetch

- **WHEN** a user logs in via OAuth "With Login & Config" (client id/secret entered manually), or
  clicks "Log in" again on an already-saved OAuth toolset
- **THEN** the system builds the authorize URL directly from the editor's current form state
  without fetching the toolset again first
