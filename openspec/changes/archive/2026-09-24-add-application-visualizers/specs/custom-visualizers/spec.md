## MODIFIED Requirements

### Requirement: Deferred features

The following features SHALL NOT be implemented **on the host side** in this change. Where an iframe-side counterpart is retained for wire-format parity (see the `ChatVisualizerConnector` requirement above), it is inert because the host has no handler for it:

- `SEND_MESSAGE` iframe → host (visualizer injecting messages into the chat). The iframe-side `sendMessage` exists and posts the envelope; the host connector has no subscriber for it and ignores it.
- Auth-token forwarding (`passAuthInfo`, `passExplicitToken`) or any inclusion of `accessToken`, `providerId`, or `logInHint` in outbound payloads or iframe URLs.
- Locale, language, or `dir` propagation into the iframe URL query string.

Grouped/application-level visualizers are no longer deferred: the host sends
`SEND_GROUPED_VISUALIZE_DATA` for an application-scoped registry entry, specified by the
`application-visualizers` capability. Auth-token forwarding remains deferred for that
registry too — its `passAuthInfo` / `passExplicitToken` fields are accepted for
configuration parity and are inert, because 1.0 auth is server-side and the browser
holds no access token.

Any implementation that adds the remaining features SHALL be a separate OpenSpec change.

#### Scenario: SEND_MESSAGE is not handled

- **WHEN** a visualizer iframe posts `${visualizerName}/SEND_MESSAGE`
- **THEN** the host connector does not dispatch a chat message
- **AND** no error is thrown; the message is silently ignored

#### Scenario: iframe URL is unmodified

- **WHEN** the host mounts a visualizer iframe
- **THEN** the iframe `src` equals the configured `url` for that entry
- **AND** no `?currentLocale=`, `?dir=`, or `?token=` query parameter is appended

#### Scenario: Grouped delivery is available to application-scoped entries only

- **WHEN** an attachment is matched through the MIME-keyed `CUSTOM_VISUALIZERS` registry
- **THEN** the host sends `SEND_VISUALIZE_DATA` for that single attachment
- **AND** it does not send `SEND_GROUPED_VISUALIZE_DATA`
