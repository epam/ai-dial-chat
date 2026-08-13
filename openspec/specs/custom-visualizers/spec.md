# custom-visualizers Specification

## Purpose

The registry, postMessage protocol, and connectors behind operator-configured custom attachment visualizers.

## Requirements

### Requirement: CustomVisualizer registry entry shape

The system SHALL define a `CustomVisualizer` type in `libs/chat-shared/src/models/custom-visualizer.ts` with the following fields:

- `contentType: string` — required, non-empty. A **comma-separated list of one or more MIME types** this entry matches (e.g. `"application/vnd.plotly.v1+json"` or `"application/vnd.plotly.v1+json, application/vnd.vega.v5+json"`). Preserved verbatim as the raw string on the type; splitting happens at lookup time (see "MIME → registry lookup").
- `url: string` — absolute HTTP(S) URL of the visualizer iframe (required, must have `http:` or `https:` scheme).
- `title: string` — **required, non-empty. This is the postMessage protocol namespace, not merely a display label.** Every message exchanged with the iframe is prefixed `${title}/…`, and the third-party visualizer app passes the same string as the `appName` argument to `ChatVisualizerConnector`. Host and iframe will not communicate at all if the two disagree. It is additionally used as the `visualizerName` on `VisualizerCanvasContent`.
- `requestTimeout?: number` — optional integer ≥ 1 (milliseconds). Bounds each `send()` request for this entry. Defaults to `10000` when unset. It does NOT bound the `READY_TO_INTERACT` handshake — see `design.md` D7.
- `width?: number` — optional integer ≥ 1. Suggested initial width of the canvas panel in pixels. Forwarded in `CustomVisualizerDataLayout`.
- `height?: number` — optional integer ≥ 1. Suggested initial height of the canvas panel in pixels. Forwarded in `CustomVisualizerDataLayout`.
- `mobileHeight?: number` — optional integer ≥ 1. Suggested canvas panel height on mobile-sized screens in pixels. Forwarded in `CustomVisualizerDataLayout`.

The following fields are present on the type for **operator-configuration parity** — they are accepted by the registry loader, preserved in the type, but not consumed by host logic: `description?: string`, `icon?: string`, `passAuthInfo?: boolean`, `passExplicitToken?: boolean`. Their presence MUST NOT cause the entry to be dropped, so that an existing configuration carrying these keys still yields a working visualizer.

The type SHALL be re-exported from the `libs/chat-shared` public entry (`@epam/ai-dial-chat-shared`).

The following fields belong to deferred features, SHALL be omitted from the type, and SHALL be ignored if present in the parsed JSON: `expanded`, `borderless`, `withoutTitle`, `providerId`, `logInHint`. Their presence MAY produce a warning log entry but MUST NOT cause an entry to be dropped.

**Feature flag:** Not gated. Registry is empty by default; feature is dark unless populated.

**RTL impact:** None (type only).

**i18n impact:** None. `title` is an operator-supplied protocol identifier, not a translatable string — it MUST NOT be localised, or the handshake breaks.

#### Scenario: Valid CustomVisualizer entry

- **WHEN** the registry loader parses `{ "contentType": "application/x-my-viz", "url": "https://viz.example.com", "title": "my-viz" }`
- **THEN** the entry is accepted and exposed on the client config
- **AND** `contentType`, `url`, `title` are preserved verbatim

#### Scenario: Entry without a title is rejected

- **WHEN** the registry loader parses an entry with no `title`, or with an empty-string `title`
- **THEN** the entry is dropped with an error log naming the missing protocol identifier
- **AND** other valid entries are still accepted

#### Scenario: Whitespace-only title is accepted

- **WHEN** the registry loader parses an entry whose `title` is `" "`
- **THEN** the entry is accepted and `title` is preserved verbatim, including its whitespace
- **AND** no error is logged

`title` is an opaque postMessage namespace, not a label, so it is never trimmed or normalised: some already-deployed visualizer applications pass a whitespace string as their `appName`, and trimming here would silently break their handshake. Only the absent and empty-string cases are rejected (by `@IsNotEmpty()` on the DTO).

#### Scenario: Entry with a comma-separated contentType matches every listed MIME

- **WHEN** the registry loader parses `{ "contentType": "application/x-a, application/x-b", "url": "https://viz.example.com", "title": "multi" }`
- **THEN** the entry is accepted with `contentType` stored verbatim
- **AND** an attachment whose MIME is `application/x-a` matches the entry
- **AND** an attachment whose MIME is `application/x-b` matches the same entry

#### Scenario: Unknown fields on entry are ignored

- **WHEN** the registry loader parses `{ "contentType": "application/x-my-viz", "url": "https://viz.example.com", "title": "my-viz", "description": "…", "icon": "…", "passAuthInfo": true, "expanded": true }`
- **THEN** the entry is accepted
- **AND** `description`, `icon`, `passAuthInfo` are retained on the resulting `CustomVisualizer` (known fields kept for schema parity, not consumed by host logic)
- **AND** `expanded` is dropped, with a warning naming it as an unrecognised field
- **AND** a warning log entry SHALL be emitted listing the ignored field names

---

### Requirement: `CUSTOM_VISUALIZERS` env variable

`apps/chat-api/src/config/environment.config.ts` SHALL declare an optional `CUSTOM_VISUALIZERS` field on `EnvironmentVariables`, typed `string`, decorated with `@IsOptional()` and `@IsString()`. Boot MUST NOT fail when the variable is missing or an empty string.

Parsing behaviour:

1. When absent or empty → resolved value is `[]`.
2. When present but not valid JSON → resolved value is `[]`; an error log entry is emitted and boot continues.
3. When JSON is valid but not an array → resolved value is `[]`; an error log entry is emitted.
4. When JSON is a valid array → each element is validated against the `CustomVisualizer` shape:
   - `contentType` is a non-empty string (may be a comma-separated MIME list; at least one non-empty MIME must remain after splitting and trimming).
   - `url` matches `@IsUrl({ require_protocol: true, protocols: ['http','https'] })`.
   - `title` is a **required** non-empty string (the protocol namespace — see "CustomVisualizer registry entry shape"). It is validated by `@IsNotEmpty()` only and is NOT trimmed: a whitespace-only `title` is accepted verbatim.
   - `requestTimeout`, `width`, `height`, `mobileHeight` are optional integers ≥ 1.
   Entries that fail validation are dropped with an error log; other entries continue to be accepted.

**Feature flag:** Not gated. The env var itself is the gate.

#### Scenario: env variable missing

- **WHEN** `CUSTOM_VISUALIZERS` is unset
- **THEN** the resolved registry is the empty array `[]`
- **AND** the API boots successfully

#### Scenario: env variable contains invalid JSON

- **WHEN** `CUSTOM_VISUALIZERS='not-json'`
- **THEN** the resolved registry is `[]`
- **AND** an error is logged
- **AND** the API boots successfully

#### Scenario: mixed valid / invalid entries

- **WHEN** `CUSTOM_VISUALIZERS='[{"contentType":"application/x-my-viz","url":"https://viz.example.com","title":"my-viz"},{"contentType":"","url":"not-a-url","title":"bad"}]'`
- **THEN** the resolved registry contains only the first entry
- **AND** the invalid entry is dropped with an error log

---

### Requirement: postMessage protocol constants

The **runtime** host path (`VisualizerCanvasRenderer`) SHALL import `VisualizerConnectorRequests` from the published `@epam/ai-dial-shared` package that accompanies `@epam/ai-dial-visualizer-connector`. That package uses camelCase members (`sendVisualizeData`, …). Wire string values remain `SEND_VISUALIZE_DATA`, `READY`, `READY_TO_INTERACT`, etc. This monorepo SHALL NOT duplicate those protocol enums in `libs/chat-shared` — host config/canvas types live in `models/custom-visualizer.ts` separately from the connector wire surface.

#### Scenario: runtime send uses the published enum

- **WHEN** `VisualizerCanvasRenderer` delivers visualize data
- **THEN** it calls `connector.send(VisualizerConnectorRequests.sendVisualizeData, …)` where `VisualizerConnectorRequests` is imported from `@epam/ai-dial-shared`
- **AND** the posted message type is still `${visualizerName}/SEND_VISUALIZE_DATA`

---

### Requirement: `VisualizerConnector` host-side manager class

The host SHALL consume the published stable npm package `@epam/ai-dial-visualizer-connector` (pinned in the workspace root `package.json`, currently `0.48.0`) together with its dependency `@epam/ai-dial-shared`. This monorepo SHALL NOT vendor workspace copies of those connector packages.

`VisualizerCanvasRenderer` in `libs/attachment-canvas` is the sole in-repo consumer. A follow-up MAY later port the connectors into this monorepo and rebind them to `@epam/ai-dial-chat-shared` (see the TODO on `VisualizerCanvasRenderer`).

The published `VisualizerConnector` class (contract as shipped on npm) SHALL satisfy:

Constructor: `new VisualizerConnector(root: HTMLElement | string, options: VisualizerConnectorOptions)`

- `root` — the DOM container (or a CSS selector string) into which the iframe is mounted.
- `options.domain` — the visualizer URL.
- `options.hostDomain` — required by the published TypeScript type. The current npm runtime does not use this field for message filtering; `VisualizerCanvasRenderer` SHALL pass `window.location.origin` for type compatibility.
- `options.visualizerName` — the type prefix used on outbound messages. Supplied by the app from the registry entry's `title`; the iframe-side app must be constructed with the identical string.
- `options.requestTimeout?: number` — optional timeout in milliseconds applied to each `send()` request. Defaults to `10000`. Sourced from the registry entry's `requestTimeout` when set. It MUST NOT be applied to `ready()`.
- `options.loaderStyles?: Record<string, string>` — CSS styles applied to the built-in loader overlay while the iframe is not yet ready.
- `options.loaderClass?: string` — CSS class(es) applied to the built-in loader overlay.
- `options.loaderInnerHTML?: string` — HTML string set as `innerHTML` of the built-in loader overlay.

Instance methods:

- `ready(): Promise<boolean>` — resolves with `true` after the iframe posts `READY_TO_INTERACT`; rejects on `destroy()`. It SHALL NOT time out: if the iframe never posts `READY_TO_INTERACT` the promise stays pending indefinitely.
- `send(type: VisualizerConnectorRequests, payload?: unknown, waitForReady = true): Promise<unknown>` — when `waitForReady` is set (the default) it first awaits the handshake; posts a message of type `${visualizerName}/${type}` with a unique `requestId`; resolves with the response payload when the iframe posts `${visualizerName}/${type}/RESPONSE` with the same `requestId`; rejects (with a string) when `requestTimeout` elapses first. If `destroy()` happens while the call is still awaiting the handshake, it resolves with `undefined` rather than rejecting; if the message was already posted, the request is left to time out (see the destroy note below).
- `subscribe(eventType: string, callback: (payload: unknown) => void): () => void` — registers an unsolicited-message listener for a specific event type; returns an unsubscribe function.
- `destroy(): void` — removes the iframe, clears the loader, fails the handshake `Task` (so calls awaiting `ready()` reject with the string `'Chat Visualizer destroyed'`), and detaches the `message` listener. Matching the published package, it does **not** reach into pending `requests`: a request whose message was already posted is not cancelled and simply times out on its own deadline. A second `destroy()` call is **not** guaranteed to be a no-op in the published package (calling `removeChild` twice may throw) — callers MUST avoid double-destroy.

Message reception:

- The class MUST attach a single `window` `message` listener that is registered exactly once per instance and removed by `destroy`.
- Inbound messages MUST be discarded when `event.source !== iframeElement.contentWindow`.
- Inbound messages MUST be discarded when `event.data.type` is missing or does not start with `${visualizerName}/`.

The published package's only runtime dependency is `@epam/ai-dial-shared`. The host app / canvas lib MUST NOT expect the connector to import `@epam/ai-dial-chat-shared`.

**RTL impact:** None (the class does not render user-facing UI beyond the iframe container).

#### Scenario: destroy settles a send() that is still awaiting the handshake

- **WHEN** `send()` is called before `READY_TO_INTERACT` has arrived and `destroy()` is called while it is still awaiting `ready()`
- **THEN** the promise returned by `send()` resolves with `undefined` (the handshake rejection is recognised and swallowed)
- **AND** no message is dispatched to the iframe

#### Scenario: destroy rejects a pending ready()

- **WHEN** `ready()` is pending and `destroy()` is called
- **THEN** that promise rejects with the string `'Chat Visualizer destroyed'`
- **AND** the `message` listener is detached, so no further messages reach subscribers

#### Scenario: message from wrong source window is ignored

- **WHEN** a `message` event fires with `event.source` different from the iframe's `contentWindow`
- **THEN** the connector does not resolve any pending request
- **AND** the connector does not invoke any subscribed handler

#### Scenario: message from an unexpected origin is still accepted

- **WHEN** a `message` event fires with `event.source` equal to the iframe's `contentWindow` but an `event.origin` unrelated to the visualizer URL
- **THEN** the message is processed normally

The host connector filters on the source-window reference only, matching `development`; it applies no `event.origin` check. Trust derives from `event.source === iframe.contentWindow`, which cannot be forged by an unrelated frame, whereas `event.origin` alone would not identify *which* frame sent the message (see `design.md` — Risks, "postMessage spoofing"). Origin filtering on the iframe side is a separate mechanism: `ChatVisualizerConnector` does check inbound origins against its configured `dialHosts`.

#### Scenario: ready resolves after handshake

- **WHEN** the iframe posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the promise returned by `ready()` resolves

#### Scenario: ready never times out

- **WHEN** the iframe never posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the promise returned by `ready()` remains pending — it neither resolves nor rejects
- **AND** it rejects only once `destroy()` is called

#### Scenario: per-entry requestTimeout bounds a send

- **WHEN** the connector is constructed with `requestTimeout: 15000` and `send()` is called after the handshake completes
- **THEN** the `send()` promise rejects with a timeout error once 15000 ms elapse without a matching `/RESPONSE`

#### Scenario: default send timeout

- **WHEN** the connector is constructed without `requestTimeout` and a `send()` receives no `/RESPONSE`
- **THEN** the `send()` promise rejects after the `10000` ms default

---

### Requirement: `ChatVisualizerConnector` iframe-side receiver

Third-party visualizer authors SHALL consume the published stable npm package `@epam/ai-dial-chat-visualizer-connector` (from the legacy Chat `development` release line). This monorepo does **not** vendor or publish that package; the host application MUST NOT import it.

A `ChatVisualizerConnector` class used by third-party visualizer applications running inside the iframe SHALL (as shipped on npm):

- Accept the visualizer's protocol name as a constructor argument (`appName`). This value MUST equal the `title` of the corresponding `CUSTOM_VISUALIZERS` entry on the host — a mismatch produces a silent failure in which the iframe loads but never receives data.
- Post `${appName}/READY` when the consumer calls `sendReady()`. The constructor itself only attaches the `message` listener — it does NOT announce readiness, so a visualizer that never calls `sendReady()` never completes the handshake.
- Post `${appName}/READY_TO_INTERACT` when the consumer calls `sendReadyToInteract()`.
- Listen for `${appName}/SEND_VISUALIZE_DATA` inbound messages, invoke a consumer-supplied callback with the payload, and post `${appName}/SEND_VISUALIZE_DATA/RESPONSE` with the same `requestId`.
- Accept one or more allowed host origins (`dialHost: string | string[]`) and discard any inbound `message` whose `event.origin` is not among them. Passing the wildcard `'*'` as the **first** entry disables the check entirely. The published package compares configured hosts with a string prefix check (`allowedHost.startsWith(event.origin)`).
- Throw a descriptive error when constructed with an empty host list.

For wire-format parity with already-deployed visualizers, the published class additionally retains a `sendMessage(content)` method that posts `${appName}/SEND_MESSAGE`, and a handler for inbound `${appName}/SEND_GROUPED_VISUALIZE_DATA` that invokes an `onGroupedData` callback and posts the matching `/RESPONSE`. **Both are inert end-to-end in the host**: this app implements no counterpart for either (see the "Deferred features" requirement below), so a `SEND_MESSAGE` envelope is silently ignored and `SEND_GROUPED_VISUALIZE_DATA` is never sent.

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

### Requirement: `SEND_VISUALIZE_DATA` payload shape

The `SEND_VISUALIZE_DATA` request payload SHALL match the `AttachmentData` type:

```ts
interface AttachmentData {
  mimeType: string;
  visualizerData: CustomVisualizerData;
}

interface CustomVisualizerData {
  layout: CustomVisualizerDataLayout;
  // opaque attachment payload consumed by the third-party visualizer
  [key: string]: unknown;
}

interface CustomVisualizerDataLayout {
  width?: number;
  height?: number;
  mobileHeight?: number;
  themeId: string;
}
```

`CustomVisualizerDataLayout` MUST NOT carry any authentication or identity fields — specifically `logInHint`, `providerId`, and `accessToken` MUST NOT be present in the type. The layout describes presentation only.

#### Scenario: layout carries theme id

- **WHEN** the host sends `SEND_VISUALIZE_DATA`
- **THEN** `payload.visualizerData.layout.themeId` equals the current theme id from the host's theme context

---

### Requirement: Deferred features

The following features SHALL NOT be implemented **on the host side** in this change. Where an iframe-side counterpart is retained for wire-format parity (see the `ChatVisualizerConnector` requirement above), it is inert because the host has no handler for it:

- `SEND_MESSAGE` iframe → host (visualizer injecting messages into the chat). The iframe-side `sendMessage` exists and posts the envelope; the host connector has no subscriber for it and ignores it.
- Auth-token forwarding (`passAuthInfo`, `passExplicitToken`) or any inclusion of `accessToken`, `providerId`, or `logInHint` in outbound payloads or iframe URLs.
- Locale, language, or `dir` propagation into the iframe URL query string.
- Grouped/application-level visualizers (`SEND_GROUPED_VISUALIZE_DATA` and any per-`applicationId` registry). The iframe-side handler exists and would reply to the envelope; the host never sends one.

Any implementation that adds these features SHALL be a separate OpenSpec change.

#### Scenario: SEND_MESSAGE is not handled

- **WHEN** a visualizer iframe posts `${visualizerName}/SEND_MESSAGE`
- **THEN** the host connector does not dispatch a chat message
- **AND** no error is thrown; the message is silently ignored

#### Scenario: iframe URL is unmodified

- **WHEN** the host mounts a visualizer iframe
- **THEN** the iframe `src` equals the configured `url` for that entry
- **AND** no `?currentLocale=`, `?dir=`, or `?token=` query parameter is appended

---

### Requirement: iframe sandbox attribute

The iframe SHALL be mounted with a `sandbox` attribute granting the capability set that interactive visualizers require, and MUST withhold `allow-top-navigation`.

Visualizers are operator-configured applications that render rich, interactive content — charts that export to file, documents that open a print or fullscreen view, panels that copy a value to the clipboard. The sandbox therefore grants the capabilities those interactions require, and trust is established by the operator explicitly listing the URL in `CUSTOM_VISUALIZERS`, not by restricting the frame.

The required `sandbox` tokens are:

- `allow-same-origin`
- `allow-scripts`
- `allow-modals`
- `allow-forms`
- `allow-downloads`
- `allow-popups`
- `allow-presentation`

The iframe SHALL additionally carry an `allow` attribute granting: `clipboard-write`, `fullscreen`, `accelerometer`, `gyroscope`, `autoplay`, `web-share`, `encrypted-media`.

`allow-top-navigation` MUST NOT be granted — a visualizer must never be able to navigate the host page away.

The `sandbox` token set is hardcoded in the `VisualizerConnector` implementation and is not overridable via options.

`allow-same-origin` and `allow-scripts` together remove the sandbox's isolation guarantee for a document that shares the host's origin (the framed document could then reach the host's storage/cookies/DOM via same-origin script access). This is accepted because `url` is expected to be a third-party origin distinct from the DIAL Chat host. Operators MUST NOT host a visualizer on the same origin as the DIAL Chat host.

#### Scenario: sandbox tokens

- **WHEN** the iframe is mounted
- **THEN** the `sandbox` attribute contains `allow-same-origin`, `allow-scripts`, `allow-modals`, `allow-forms`, `allow-downloads`, `allow-popups`, and `allow-presentation`
- **AND** it does NOT contain `allow-top-navigation`

#### Scenario: allow attribute is set

- **WHEN** the iframe is mounted
- **THEN** its `allow` attribute grants `clipboard-write`, `fullscreen`, `accelerometer`, `gyroscope`, `autoplay`, `web-share`, and `encrypted-media`

---

### Requirement: `useCustomVisualizers` client hook

`apps/chat/src/hooks/attachment/useCustomVisualizers.ts` (or the existing `useAppConfig` accessor) SHALL expose the parsed `CustomVisualizer[]` registry to app-level consumers. The hook SHALL:

- Return `[]` while the app-config request is loading.
- Return `[]` on config error.
- Return the resolved registry once the config is ready.
- Memoise the value so referential equality is stable across renders until the underlying config changes.

The registry SHALL be sourced only from `AppConfigContext`. Libs SHALL NOT read this hook directly.

#### Scenario: registry is empty while loading

- **WHEN** `AppConfigContext.status === 'loading'`
- **THEN** `useCustomVisualizers()` returns `[]`

#### Scenario: registry is stable across re-renders

- **WHEN** the parent component re-renders without a config change
- **THEN** the array reference returned by `useCustomVisualizers()` is identical to the previous render

---

### Requirement: MIME → registry lookup

A helper (e.g. `findVisualizerForMime(mime, registry)`) SHALL locate the first entry in the registry that matches the attachment MIME.

Matching rules:

- The entry's `contentType` SHALL be split on `,` and each part trimmed, yielding one or more candidate MIME types. An entry matches when ANY candidate equals the attachment MIME.
- Comparison is case-insensitive on both sides.
- Empty parts produced by splitting (e.g. a trailing comma) SHALL be skipped, never treated as a wildcard match.
- When several entries match the same MIME, the FIRST entry in registry order wins. Registry order is therefore significant and MUST be preserved end to end, from the parsed env value through to the client.
- When no entry matches, the helper returns `undefined`.

Escaping commas inside a MIME type is NOT supported, and no escape syntax SHALL be introduced: RFC 2045 does not permit an unquoted comma in a media type or subtype, so a comma in the field is always a separator.

#### Scenario: case-insensitive match

- **WHEN** the registry contains `contentType: 'application/x-my-viz'` and the attachment MIME is `Application/X-MY-VIZ`
- **THEN** the helper returns the registry entry

#### Scenario: comma-separated contentType matches any listed MIME

- **WHEN** the registry contains `contentType: 'application/x-a, application/x-b'` and the attachment MIME is `application/x-b`
- **THEN** the helper returns that entry

#### Scenario: first matching entry wins

- **WHEN** two entries both list `application/x-my-viz` in their `contentType`
- **THEN** the helper returns the entry appearing first in the registry array

#### Scenario: trailing comma does not create a wildcard

- **WHEN** the registry contains `contentType: 'application/x-a,'` and the attachment MIME is `application/pdf`
- **THEN** the helper returns `undefined`

#### Scenario: no match

- **WHEN** no entry's `contentType` matches
- **THEN** the helper returns `undefined`
