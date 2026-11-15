## ADDED Requirements

### Requirement: Redirect-state storage is owned by the module

The `sessionStorage` key `TOOLSET_REDIRECT_STATE_KEY` and the stored format of `ToolsetRedirectState` SHALL be defined only by the `oauth/` module of `@epam/ai-dial-chat-hooks`:

- `popup.ts` writes it;
- `useOAuthCallbackCompletion` reads and removes it.

No function or hook of the flow SHALL accept a storage key, a storage object or a redirect-state store from the host.

The stored state SHALL carry only flow-correlation values: the resource id, credentials level, redirect URI, `state`, resource kind and offline-usage consent. It SHALL never carry an access token, refresh token, client secret or authorization code.

This is a narrow exception to the library-isolation rule against libs owning storage keys, recorded in `.claude/rules/libs.md` "Narrow isolation exceptions". It covers this key only.

#### Scenario: Writer and reader agree without host input

- **WHEN** a flow is initiated with `initiateOAuthLogin` or `navigateToolsetOAuthPopup`, and the provider redirects back to the host's callback route in the same popup
- **THEN** `useOAuthCallbackCompletion` finds the redirect state under the same key the initiator wrote, without the host passing a key or store to either side

#### Scenario: No secret is stored

- **WHEN** the redirect state is written into the popup's `sessionStorage`
- **THEN** it contains no access token, refresh token, client secret or authorization code; the OAuth `state` it carries is the correlation value already sent in the authorize URL
