## MODIFIED Requirements

### Requirement: OAuth credential fields
When OAuth auth is selected with config, the system SHALL allow entering client id, client
secret, authorization endpoint, token endpoint, scopes, and resource, and SHALL require client id, client
secret, authorization endpoint, and token endpoint before saving or triggering the login, except
that client secret is not required when the
editor was opened to edit a toolset that was already saved with OAuth-with-config credentials
(i.e. the editor's route carries an existing toolset id) — Core never returns a stored client
secret, so re-entering it is not required to log in again with the already-stored value. The
required-field indicator on the Client Secret input and the login-button gating condition SHALL
derive from this same "editing an already-saved toolset" state (`isEditMode`, i.e. a non-empty
route `toolsetId`), not from whether the toolset has merely acquired a persisted draft id during
the current create flow (e.g. from an earlier "Log in" persist).

The Resource field carries the RFC 8707 `resource` indicator (`ToolsetAuthFormData.resource` in
`libs/toolset-editor/src/models/toolset-form.ts`). It SHALL be rendered by `AuthSection` only for
OAuth with config (`WithLogin.WithConfig`), after Scopes, and SHALL NOT be rendered for "With
Login" (dynamic registration), API Key, or None — DIAL Core rejects a supplied `resource` for those.
It is optional. A non-blank value SHALL be an absolute URI (it parses with `new URL`) with no
`#fragment` and no whitespace; otherwise the field shows "Enter an absolute URI without a fragment"
and blocks the save and the login, exactly like the endpoint errors. The check SHALL live in
`libs/toolset-editor/src/utils/toolsets.ts` and be used both by the `ToolsetEditor` error surfacing
and by `isToolsetAuthValid`. The field, its label, placeholder and error SHALL follow the same
`Input` wiring as the token endpoint (`labelProps`, `error`, `invalid`, `disabled` while saving), so
the error is announced through the control's `aria-describedby`; it adds no new keyboard handling.
Direction impact: none beyond the existing form column — the value is a URI and inherits the form's
logical layout.

Labels, all optional with English defaults in the lib and filled with `t()` by `apps/chat`
(`ToolsetApplicationEditor`):

| Lib prop                                      | Default                                   | i18n key                                     |
| --------------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| `AuthSectionLabels.resourceLabel`             | `'Resource'`                              | `toolsetEditor.auth.resourceLabel`           |
| `AuthSectionLabels.resourcePlaceholder`       | `'Enter resource URI'`                    | `toolsetEditor.auth.resourcePlaceholder`     |
| `ToolsetEditorValidationLabels.resourceInvalid` | `'Enter an absolute URI without a fragment'` | `toolsetEditor.auth.resourceInvalid`      |

The host maps the field both ways in `apps/chat/src/utils/toolsets.ts`: `authSettingsDtoToForm`
reads `authSettings.resource` (empty string when absent), and `formToToolsetBody` sends it only for
OAuth with config — the trimmed value when non-blank; when blank, `''` on update (DIAL Core clears
the stored value) and nothing on create (DIAL Core may resolve it from the server's Protected
Resource Metadata). For every other auth type and login mode the body carries no `resource`.

#### Scenario: Missing OAuth client credentials
- **WHEN** OAuth auth with config is selected and client id or client secret is empty
- **THEN** the system shows required errors for the missing field(s) and blocks the login

#### Scenario: Missing OAuth endpoints
- **WHEN** OAuth auth with config is selected and the authorization endpoint or token endpoint is
  empty
- **THEN** both endpoint inputs are marked required, the system shows "Authorization endpoint is
  required" / "Token endpoint is required" for the missing field(s), and blocks the save and the
  login; a non-empty value that is not an `http(s)` URL shows "Enter a valid http(s) URL" instead

#### Scenario: Client secret required while creating a new toolset
- **WHEN** a user is creating a new toolset (the editor was not opened with an existing toolset
  id in its route) and selects OAuth with login & config, even after the in-progress draft has
  been persisted and acquired an id
- **THEN** the Client Secret field is marked required and the Log In button stays disabled until
  a client secret is entered

#### Scenario: Client secret optional when re-logging in on an already-saved toolset
- **WHEN** a user opens the editor to edit a toolset that was already saved with OAuth
  with-login-&-config credentials (the editor's route carries that toolset's id)
- **THEN** the Client Secret field is not marked required and the Log In button can become
  enabled without a client secret value, provided the other required fields (client id,
  authorization endpoint, token endpoint) are filled in with valid values

#### Scenario: Resource field shown only for static registration
- **WHEN** OAuth is selected with "With Login & Config"
- **THEN** a Resource input is rendered after Scopes, without a required marker
- **WHEN** OAuth is selected with "With Login", or API Key or None is selected
- **THEN** no Resource input is rendered

#### Scenario: Invalid resource blocks save and login
- **WHEN** the Resource field holds `mcp.notion.com/mcp` (relative) or
  `https://mcp.notion.com/mcp#tools` (fragment)
- **THEN** the field shows "Enter an absolute URI without a fragment", the save is blocked, and the
  Log In button stays disabled

#### Scenario: Blank resource is valid
- **WHEN** the Resource field is empty or whitespace only
- **THEN** no Resource error is shown and the remaining OAuth fields alone decide whether save and
  login are allowed

#### Scenario: Stored resource round-trips
- **WHEN** the editor opens a static OAuth toolset whose stored `authSettings.resource` is
  `https://mcp.notion.com/mcp` and the user saves without touching the field
- **THEN** the field shows `https://mcp.notion.com/mcp` and the update body carries
  `authSettings.resource: "https://mcp.notion.com/mcp"`

#### Scenario: Clearing the resource removes it
- **WHEN** the user clears the Resource field of a saved static OAuth toolset and saves
- **THEN** the update body carries `authSettings.resource: ""`, not an omitted field

#### Scenario: Blank resource on create is omitted
- **WHEN** a new static OAuth toolset is created with the Resource field empty
- **THEN** the create body's `authSettings` has no `resource` key

#### Scenario: Dynamic registration never sends resource
- **WHEN** a toolset is saved with OAuth "With Login", even if its form state carries a `resource`
  read from DIAL Core
- **THEN** the body's `authSettings` has no `resource` key

## ADDED Requirements

### Requirement: Editor OAuth login uses the stored resource
The toolset editor's OAuth login SHALL build the authorize URL with the same `resource` DIAL Core
will send on the token exchange (`apps/chat/src/hooks/toolsets/useToolsetEditorOAuthLogin.ts`).
For "With Login & Config" with a non-blank Resource field, the form value is that value and the
existing flow is unchanged. When the Resource field is blank, DIAL Core may have resolved a value
from the server's Protected Resource Metadata during the save, so the hook SHALL open the popup
synchronously first (as the dynamic-registration branch does), persist the toolset through
`ensureSaved`, read the stored auth settings through `fetchToolsetAuthSettings`, and navigate the
popup with the form's settings plus the stored `resource`. It SHALL report only `{ resource }` back
to the editor in the outcome's `auth`, so the Resource field shows the resolved value — the stored
settings carry no client secret, so merging all of them would clear the one the user typed. A failed fetch closes the popup and reports
`ToolsetOAuthLoginStatus.Failed` with the trace id, as the dynamic branch does. The dynamic
registration branch already navigates with the fetched settings and so carries the stored
`resource` through the shared authorize-URL builder.

#### Scenario: Blank field, server publishes metadata
- **WHEN** a user saves a static OAuth toolset for `https://mcp.notion.com/mcp` with the Resource
  field blank and clicks Log In, and DIAL Core stored `resource: "https://mcp.notion.com/mcp"`
- **THEN** the popup opens before any network call and is navigated to an authorize URL carrying
  `resource=https%3A%2F%2Fmcp.notion.com%2Fmcp`, and the Resource field then shows that value

#### Scenario: Filled field skips the extra read
- **WHEN** the Resource field holds a value and the user clicks Log In
- **THEN** no stored-settings read happens and the authorize URL carries the form's value

#### Scenario: Stored-settings read fails
- **WHEN** the Resource field is blank and reading the saved toolset fails
- **THEN** the popup closes and the editor reports a failed login with the request's trace id
