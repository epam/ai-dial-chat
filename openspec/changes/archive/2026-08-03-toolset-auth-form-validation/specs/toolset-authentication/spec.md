## MODIFIED Requirements

### Requirement: OAuth credential fields
When OAuth auth is selected with config, the system SHALL allow entering client id, client
secret, authorization endpoint, token endpoint, and scopes, and SHALL require client id and
client secret before triggering the login, except that client secret is not required when the
editor was opened to edit a toolset that was already saved with OAuth-with-config credentials
(i.e. the editor's route carries an existing toolset id) — Core never returns a stored client
secret, so re-entering it is not required to log in again with the already-stored value. The
required-field indicator on the Client Secret input and the login-button gating condition SHALL
derive from this same "editing an already-saved toolset" state, not from whether the toolset has
merely acquired a persisted id during the current create flow (e.g. from an in-progress draft
auto-save).

#### Scenario: Missing OAuth client credentials
- **WHEN** OAuth auth with config is selected and client id or client secret is empty
- **THEN** the system shows required errors for the missing field(s) and blocks the login

#### Scenario: Client secret required while creating a new toolset
- **WHEN** a user is creating a new toolset (the editor was not opened with an existing toolset
  id in its route) and selects OAuth with login & config, even after the in-progress draft has
  been auto-saved and acquired an id
- **THEN** the Client Secret field is marked required and the Log In button stays disabled until
  a client secret is entered

#### Scenario: Client secret optional when re-logging in on an already-saved toolset
- **WHEN** a user opens the editor to edit a toolset that was already saved with OAuth
  with-login-&-config credentials (the editor's route carries that toolset's id)
- **THEN** the Client Secret field is not marked required and the Log In button can become
  enabled without a client secret value, provided the other required fields (client id, valid
  endpoints) are filled in
