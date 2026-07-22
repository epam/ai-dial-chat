## MODIFIED Requirements

### Requirement: Persist unsaved changes before login
Clicking "Log in" (API Key or OAuth) SHALL first persist any unsaved editor changes — creating
the toolset if it has no id yet, or updating it if the form has changed since it was last
persisted — using the same persist logic as advancing past the General step. If the form has
not changed since it was last persisted, no create/update request SHALL be sent. If persisting
fails, the system SHALL show an error notification and SHALL NOT proceed to submit credentials
or open the OAuth authorization popup, so login never runs against a stale endpoint or
authentication configuration. The persist step SHALL return the toolset id it just resolved
(the newly created id, the updated id, or the already-persisted id when nothing changed), and
every subsequent call in the same login attempt — initiating the OAuth popup, re-checking
sign-in status after a Cancelled OAuth result, and the API-key login request — SHALL use that
returned id rather than any toolset id value captured before the persist step ran, so the very
first login for a brand-new toolset targets the id that was just created instead of an empty or
stale id.

#### Scenario: Log in persists unsaved endpoint/auth changes first
- **WHEN** a user edits the endpoint or authentication fields on the Settings step without
  saving, then clicks "Log in"
- **THEN** the system updates the toolset with the current form values before submitting
  credentials or opening the OAuth authorization popup

#### Scenario: Log in sends no request when nothing changed
- **WHEN** a user clicks "Log in" without having changed anything since the toolset was last
  persisted
- **THEN** the system sends no create/update request and proceeds directly to login

#### Scenario: Login is blocked when persisting fails
- **WHEN** persisting unsaved changes before login fails
- **THEN** the system shows an error notification and does not submit credentials or open the
  OAuth authorization popup

#### Scenario: First login for a brand-new toolset uses the freshly created id
- **WHEN** a user fills in a new toolset's settings and clicks "Log in" for the very first time,
  before the toolset has ever been persisted
- **THEN** the persist step creates the toolset and the login call (OAuth popup initiation or
  API-key login request) uses the id the create call just returned, not an empty or otherwise
  stale id, so the very first click succeeds
