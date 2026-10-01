## MODIFIED Requirements

### Requirement: `ChatVisualizerConnector` iframe-side receiver

Third-party visualizer authors SHALL consume the published stable npm package `@epam/ai-dial-chat-visualizer-connector` (from the legacy Chat `development` release line). This monorepo does **not** vendor or publish that package; the host application MUST NOT import it.

A `ChatVisualizerConnector` class used by third-party visualizer applications running inside the iframe SHALL (as shipped on npm):

- Accept the visualizer's protocol name as a constructor argument (`appName`). This value MUST equal the `title` of the corresponding `CUSTOM_VISUALIZERS` entry on the host — a mismatch produces a silent failure in which the iframe loads but never receives data.
- Post `${appName}/READY` when the consumer calls `sendReady()`. The constructor itself only attaches the `message` listener — it does NOT announce readiness, so a visualizer that never calls `sendReady()` never completes the handshake.
- Post `${appName}/READY_TO_INTERACT` when the consumer calls `sendReadyToInteract()`.
- Listen for `${appName}/SEND_VISUALIZE_DATA` inbound messages, invoke a consumer-supplied callback with the payload, and post `${appName}/SEND_VISUALIZE_DATA/RESPONSE` with the same `requestId`.
- Accept one or more allowed host origins (`dialHost: string | string[]`) and discard any inbound `message` whose `event.origin` is not among them. Passing the wildcard `'*'` as the **first** entry disables the check entirely. The published package compares configured hosts with a string prefix check (`allowedHost.startsWith(event.origin)`).
- Throw a descriptive error when constructed with an empty host list.

The published class additionally exposes `sendMessage(content)`, which posts `${appName}/SEND_MESSAGE` with payload `{ message: content }` and no `requestId`, and a handler for inbound `${appName}/SEND_GROUPED_VISUALIZE_DATA` that invokes an `onGroupedData` callback and posts the matching `/RESPONSE`. The host handles `SEND_MESSAGE` only when the operator enables it, as specified by the `visualizer-send-message` capability; otherwise the envelope is silently ignored. The host sends `SEND_GROUPED_VISUALIZE_DATA` for application-scoped registry entries, as specified by the `application-visualizers` capability.

#### Scenario: handshake is announced explicitly, not on construction

- **WHEN** a `ChatVisualizerConnector` is constructed with `appName` `'my-viz'` and `sendReady()` is called
- **THEN** it posts a message of type `my-viz/READY`
- **AND** `my-viz/READY_TO_INTERACT` is posted only when `sendReadyToInteract()` is called

#### Scenario: visualize data is acknowledged with the same requestId

- **WHEN** the host posts `my-viz/SEND_VISUALIZE_DATA` with `requestId` `'r-1'`
- **THEN** the consumer-supplied data callback is invoked with the message payload
- **AND** the connector posts `my-viz/SEND_VISUALIZE_DATA/RESPONSE` carrying `requestId` `'r-1'`

#### Scenario: message from a host outside dialHosts is discarded

- **WHEN** an inbound `message` event arrives whose `event.origin` is not among the configured `dialHosts`
- **THEN** the payload is ignored and no callback is invoked
- **AND** no `/RESPONSE` is posted back

---

### Requirement: Deferred features

The following features SHALL NOT be implemented **on the host side**:

- Auth-token forwarding (`passAuthInfo`, `passExplicitToken`) or any inclusion of `accessToken`, `providerId`, or `logInHint` in outbound payloads or iframe URLs.
- Locale, language, or `dir` propagation into the iframe URL query string.

Grouped/application-level visualizers are no longer deferred: the host sends
`SEND_GROUPED_VISUALIZE_DATA` for an application-scoped registry entry, specified by the
`application-visualizers` capability. Auth-token forwarding remains deferred for that
registry too — its `passAuthInfo` / `passExplicitToken` fields are accepted for
configuration parity and are inert, because 1.0 auth is server-side and the browser
holds no access token.

`SEND_MESSAGE` iframe → host is no longer deferred: it is specified by the
`visualizer-send-message` capability and is off unless the operator sets
`ALLOW_VISUALIZER_SEND_MESSAGES`.

Any implementation that adds the remaining features SHALL be a separate OpenSpec change.

#### Scenario: SEND_MESSAGE is ignored while the operator flag is off

- **WHEN** `ALLOW_VISUALIZER_SEND_MESSAGES` is unset or `false` and a visualizer iframe posts `${visualizerName}/SEND_MESSAGE`
- **THEN** the host does not dispatch a chat message
- **AND** no error is thrown; the message is silently ignored

#### Scenario: iframe URL is unmodified

- **WHEN** the host mounts a visualizer iframe
- **THEN** the iframe `src` equals the configured `url` for that entry
- **AND** no `?currentLocale=`, `?dir=`, or `?token=` query parameter is appended

#### Scenario: Grouped delivery is available to application-scoped entries only

- **WHEN** an attachment is matched through the MIME-keyed `CUSTOM_VISUALIZERS` registry
- **THEN** the host sends `SEND_VISUALIZE_DATA` for that single attachment
- **AND** it does not send `SEND_GROUPED_VISUALIZE_DATA`
