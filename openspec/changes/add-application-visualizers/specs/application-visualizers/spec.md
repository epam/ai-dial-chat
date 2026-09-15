## ADDED Requirements

### Requirement: `ApplicationVisualizer` registry entry shape

The system SHALL define an `ApplicationVisualizer` type in
`libs/chat-shared/src/models/application-visualizer.ts` describing one application-scoped
grouped visualizer, and SHALL re-export it from `@epam/ai-dial-chat-shared`:

- `title: string` — required, non-empty. **The postMessage protocol namespace, not a
  display label.** Every message exchanged with the iframe is prefixed `${title}/…`, and
  the visualizer application must be constructed with this identical string as its
  `appName`. It is additionally used as the `visualizerName` on the grouped canvas
  content and as the inline frame's header text.
- `url: string` — required. Absolute HTTP(S) URL of the visualizer iframe.
- `contentType?: string` — **optional**, unlike `CustomVisualizer.contentType`. A
  comma-separated list of MIME types. Preserved verbatim; splitting happens at lookup
  time.
- `requestTimeout?: number` — optional integer ≥ 1 (milliseconds). Bounds each `send()`
  request for this entry. Defaults to `10000` when unset. It does NOT bound the
  `READY_TO_INTERACT` handshake.
- `width?: number`, `height?: number`, `mobileHeight?: number` — optional integers ≥ 1.
  Forwarded in `CustomVisualizerDataLayout` and used by the host to size the inline
  frame.

The following fields SHALL be accepted and preserved for operator-configuration parity
but MUST NOT be consumed by host logic: `description?: string`, `icon?: string`,
`passAuthInfo?: boolean`, `passExplicitToken?: boolean`. Their presence MUST NOT cause
an entry to be dropped, so that a configuration copied verbatim from legacy Chat 0.x
still yields a working visualizer.

The following legacy fields SHALL be omitted from the type and ignored if present in
the parsed JSON: `expanded`, `borderless`, `withoutTitle`, `providerId`, `logInHint`.
Their presence MAY produce a warning log entry but MUST NOT cause an entry to be
dropped.

The registry type SHALL be `Record<string, ApplicationVisualizer>`, keyed by
application id.

**Feature flag:** not gated. The registry is empty by default; the feature is dark
unless populated.

**RTL impact:** none (type only).

**i18n impact:** none. `title` is an operator-supplied protocol identifier, not a
translatable string — it MUST NOT be localised, or the handshake breaks.

#### Scenario: Valid entry with an explicit contentType

- **WHEN** the registry loader parses `{ "app-1": { "title": "my-viz", "url": "https://viz.example.com", "contentType": "application/x-my-viz" } }`
- **THEN** the entry is accepted under key `app-1`
- **AND** `title`, `url`, and `contentType` are preserved verbatim

#### Scenario: Valid entry without a contentType

- **WHEN** the registry loader parses `{ "app-1": { "title": "my-viz", "url": "https://viz.example.com" } }`
- **THEN** the entry is accepted with `contentType` absent

#### Scenario: Legacy parity fields are retained, deferred fields are dropped

- **WHEN** the registry loader parses an entry carrying `description`, `icon`, `passAuthInfo`, `passExplicitToken`, and `expanded`
- **THEN** `description`, `icon`, `passAuthInfo`, and `passExplicitToken` are retained on the resulting `ApplicationVisualizer`
- **AND** `expanded` is dropped with a warning naming it as an unrecognised field

---

### Requirement: `APPLICATION_VISUALIZERS` env variable

`apps/chat-api/src/config/environment.config.ts` SHALL declare an optional
`APPLICATION_VISUALIZERS` field on `EnvironmentVariables`, typed `string`, decorated
with `@IsOptional()` and `@IsString()`. Boot MUST NOT fail when the variable is missing,
empty, or malformed.

The variable's value SHALL be a JSON **object** whose keys are application ids (the
message's effective deployment id) and whose values are `ApplicationVisualizer` entries.

`apps/chat-api/README.md` and `apps/chat-api/.env.template` SHALL document the variable,
including that each entry's origin must additionally appear in `ALLOWED_IFRAME_ORIGINS`
or the browser blocks the iframe, and that `passAuthInfo` / `passExplicitToken` are
accepted but inert.

#### Scenario: Variable is unset

- **WHEN** `APPLICATION_VISUALIZERS` is not set
- **THEN** the application boots normally
- **AND** the resolved registry is an empty object

#### Scenario: Variable is malformed

- **WHEN** `APPLICATION_VISUALIZERS` is set to a value that is not valid JSON
- **THEN** the application still boots
- **AND** an error is logged
- **AND** the resolved registry is an empty object

---

### Requirement: Application id lookup and attachment partitioning

`libs/chat-shared` SHALL export a pure helper that, given an application id and the
registry, returns the matching `ApplicationVisualizer` or `undefined`, and a pure helper
that partitions a `DisplayAttachment[]` into the attachments an entry claims and those
it does not.

Lookup rules:

- The application id is matched against registry keys by **exact string equality**. No
  trimming, case-folding, or normalisation is applied — deployment ids are opaque.
- When the matched entry declares `contentType`, it SHALL be split on `,`, each part
  trimmed, empty parts discarded, and compared **case-insensitively** against each
  attachment's own `contentType`. Matching attachments are claimed.
- When the matched entry omits `contentType`, every attachment that has a resolvable
  URL SHALL be claimed. An attachment carrying only inline `data` and no URL SHALL NOT
  be claimed.
- Attachments that are not claimed SHALL be returned unchanged in declaration order, so
  the host can render them as ordinary attachment tiles.

Neither helper reads configuration, resolves URLs, or performs I/O.

#### Scenario: Entry claims only the MIME types it lists

- **WHEN** the entry declares `contentType: "application/x-my-viz"` and the message carries one `application/x-my-viz` attachment and one `image/png` attachment
- **THEN** the `application/x-my-viz` attachment is claimed
- **AND** the `image/png` attachment is not claimed

#### Scenario: Entry without contentType claims every URL attachment

- **WHEN** the entry omits `contentType` and the message carries an `image/png` attachment with a `url` and a `text/plain` attachment carrying only `data`
- **THEN** the `image/png` attachment is claimed
- **AND** the `text/plain` attachment is not claimed

#### Scenario: Comma-separated contentType matches every listed MIME

- **WHEN** the entry declares `contentType: "application/x-a, application/x-b"`
- **THEN** an attachment whose MIME is `application/x-a` is claimed
- **AND** an attachment whose MIME is `application/x-b` is claimed

#### Scenario: Unknown application id matches nothing

- **WHEN** the message's effective deployment id is absent from the registry
- **THEN** the lookup returns `undefined`
- **AND** no partitioning is performed

#### Scenario: Nothing is claimed

- **WHEN** an entry matches the deployment but claims none of the message's attachments
- **THEN** the host renders no inline visualizer surface
- **AND** every attachment renders exactly as it does today

---

### Requirement: Application visualizers take precedence over custom visualizers

An `ApplicationVisualizer` entry SHALL take precedence over the MIME-keyed
`CUSTOM_VISUALIZERS` registry for every attachment it claims. When a message's effective
deployment id matches an entry AND a claimed attachment's MIME type also matches a
`CUSTOM_VISUALIZERS` entry, the attachment is folded into the grouped payload and is not
rendered as a clickable tile, so the MIME-keyed per-attachment path never observes it.

Attachments the application visualizer does not claim SHALL fall through to existing
behaviour unchanged, including opening a custom visualizer on click.

#### Scenario: Claimed attachment bypasses the MIME registry

- **WHEN** a deployment has an application visualizer claiming `application/x-my-viz`, and `CUSTOM_VISUALIZERS` also contains an `application/x-my-viz` entry
- **THEN** the attachment is delivered in the grouped payload to the application visualizer
- **AND** no per-attachment `SEND_VISUALIZE_DATA` is sent for it

#### Scenario: Unclaimed attachment still reaches its custom visualizer

- **WHEN** the application visualizer declares `contentType: "application/x-a"` and the message also carries an `application/x-b` attachment matching a `CUSTOM_VISUALIZERS` entry
- **THEN** clicking the `application/x-b` tile opens the custom visualizer as it does today

---

### Requirement: `SEND_GROUPED_VISUALIZE_DATA` payload shape

The grouped request payload SHALL match the `GroupedAttachmentsData` type published by
`@epam/ai-dial-shared`:

```ts
interface GroupedAttachmentsData {
  attachments: AttachmentItem[];
  layout: CustomVisualizerDataLayout;
}

interface AttachmentItem {
  url: string;
  mimeType: string;
  visualizerData: CustomVisualizerData;
}
```

Each claimed attachment SHALL contribute one `AttachmentItem` whose `url` is the
**absolute** URL resolved by the app's existing attachment URL adapter and whose
`mimeType` is the attachment's own `contentType`. `AttachmentItem` order SHALL follow
the attachments' order on the message.

The top-level `layout` SHALL carry `width`, `height`, and `mobileHeight` from the
registry entry plus the active `themeId`. As with `SEND_VISUALIZE_DATA`,
`CustomVisualizerDataLayout` MUST NOT carry `accessToken`, `providerId`, or
`logInHint`.

The grouped request SHALL be sent exactly once per mounted frame, after
`READY_TO_INTERACT` resolves. It SHALL NOT be re-sent when attachments are appended
during streaming.

#### Scenario: One item per claimed attachment, in order

- **WHEN** the host sends `SEND_GROUPED_VISUALIZE_DATA` for a message with three claimed attachments
- **THEN** `payload.attachments` has three items in the message's attachment order
- **AND** each item's `mimeType` equals its attachment's own `contentType`

#### Scenario: URLs are absolute

- **WHEN** a claimed attachment's stored URL is a DIAL-relative resource path
- **THEN** the `AttachmentItem.url` sent to the iframe is the absolute URL produced by the app's attachment URL adapter

#### Scenario: Layout carries theme and sizing, never identity

- **WHEN** the host sends `SEND_GROUPED_VISUALIZE_DATA`
- **THEN** `payload.layout.themeId` equals the current theme id from the host's theme context
- **AND** `payload.layout` contains no `accessToken`, `providerId`, or `logInHint` field

#### Scenario: Streaming does not re-send

- **WHEN** further attachments are appended to the message while the response streams
- **THEN** the mounted frame is not torn down
- **AND** no second `SEND_GROUPED_VISUALIZE_DATA` is sent

---

### Requirement: `useApplicationVisualizers` client hook

`apps/chat/src/hooks/attachment/useApplicationVisualizers.ts` SHALL export a hook
returning the resolved `Record<string, ApplicationVisualizer>` from `AppConfigContext`,
or an empty registry while config is loading or on error.

The not-ready branch SHALL return a **module-level constant** so consumers receive the
same object reference on every render and their `useMemo` / `useCallback` dependencies
are not invalidated while config loads — matching `useCustomVisualizers`.

The derived per-message values — the matched entry, the attachment partition, and the
grouped canvas content — SHALL be memoised in `ConversationMessageItem` so a parent
re-render does not rebuild the payload object and churn the iframe.

#### Scenario: Stable reference while loading

- **WHEN** the hook is called twice while config status is not ready
- **THEN** both calls return the identical empty-registry reference

#### Scenario: Resolved registry is returned once ready

- **WHEN** config resolves with a populated `applicationVisualizers`
- **THEN** the hook returns that registry

---

### Requirement: Inline grouped visualizer surface in the assistant message

`libs/attachment-canvas` SHALL export an `InlineGroupedVisualizer` component that
renders a framed, full-width inline surface for a grouped visualizer, shaped after the
existing `McpAppInlinePreview`:

- It renders `VisualizerCanvasRenderer` with the grouped canvas content it is given, at
  a caller-supplied pixel height.
- A header strip above the frame carries the entry title and an expand-to-canvas icon
  button wired to an `onExpand: () => void` prop.
- Loading, error, and expand labels are props with English defaults; the component MUST
  NOT import i18n.
- It MUST NOT read app-level context (auth, theme, config, routing, feature flags).

`ConversationMessageItem` SHALL render it inside the assistant bubble's existing
`afterContent` slot when, and only when, the message's effective deployment id matches a
registry entry and the partition claims at least one attachment. No new slot is added to
`libs/conversation-messages`.

The host SHALL resolve the frame height before passing it in: `mobileHeight` when the
`useIsMobile` breakpoint hook reports a mobile viewport and the entry declares it,
otherwise `height`. The lib MUST NOT read a breakpoint.

**i18n keys:** the expand button reuses the existing
`attachmentCanvas.expandAppLabel` (`AttachmentCanvasI18nKeys.ExpandAppLabel`), and the
placeholder shown while the visualizer is open in the canvas reuses
`attachmentCanvas.openedInCanvasLabel` (`AttachmentCanvasI18nKeys.OpenedInCanvasLabel`).
New keys are added only for the visualizer's own loading and error text:
`attachmentCanvas.visualizerLoadingLabel` and
`attachmentCanvas.visualizerLoadErrorLabel`.

**Feature flag:** none. The surface is reachable only when an operator populates
`APPLICATION_VISUALIZERS`; it is not gated behind `ENABLED_FEATURES` or any role list.

**RTL impact:** the frame and header use logical properties (`ps-*`/`pe-*`,
`border-s-*`, `text-start`) so the header strip flips with direction. The expand glyph
is a symmetric diagonal-arrows icon and MUST NOT be mirrored. The iframe's internal
direction is the visualizer's own responsibility; the host does not append a `dir` query
parameter (unchanged from the custom-visualizers capability).

**Accessibility:** the expand button is a real `<button>` reachable in tab order with an
`aria-label` from `expandAriaLabel`; its icon is `aria-hidden`. The iframe carries a
`title` naming the visualizer. The renderer's existing error text keeps `role="alert"`,
and the "opened in canvas" placeholder is a `role="status"` region with
`aria-live="polite"`.

**Observability:** none. No new metric or analytics event is emitted.

#### Scenario: Inline surface renders for a matched deployment

- **WHEN** a message's effective deployment id matches a registry entry and at least one attachment is claimed
- **THEN** the assistant message renders one `InlineGroupedVisualizer` in `afterContent`
- **AND** the claimed attachments do not appear as attachment tiles

#### Scenario: Unclaimed attachments still render as tiles

- **WHEN** the entry declares `contentType` and the message also carries attachments of other types
- **THEN** those attachments render in the ordinary attachment group

#### Scenario: No inline surface without a match

- **WHEN** the registry is empty, or the deployment id is not a key in it
- **THEN** no `InlineGroupedVisualizer` is rendered
- **AND** the message renders exactly as it does today

#### Scenario: Expand button is keyboard reachable and labelled

- **WHEN** the user tabs to the inline surface's header
- **THEN** the expand button receives focus
- **AND** its accessible name is the translated `attachmentCanvas.expandAppLabel`

#### Scenario: Mobile height is used on a mobile viewport

- **WHEN** the entry declares `mobileHeight` and `useIsMobile` reports a mobile viewport
- **THEN** the inline frame is sized to `mobileHeight`

---

### Requirement: Expanding replaces the inline frame with the opened-in-canvas placeholder

Activating the inline surface's expand control SHALL open `AttachmentCanvas` with the
same grouped canvas content object the inline frame was given — the payload is not
rebuilt for the canvas.

While that visualizer is open in the canvas, `ConversationMessageItem` SHALL render the
existing "opened in canvas" placeholder in place of the inline frame, so exactly one
iframe for that visualizer is mounted at a time. Closing the canvas SHALL restore the
inline frame.

#### Scenario: Expanding opens the canvas with the same content

- **WHEN** the user activates the expand control
- **THEN** the canvas opens with the grouped visualizer content
- **AND** the canvas body mounts a `VisualizerCanvasRenderer` for it

#### Scenario: Inline frame is replaced while open in the canvas

- **WHEN** the grouped visualizer is open in the canvas
- **THEN** the message shows the `role="status"` "opened in canvas" placeholder instead of the inline frame
- **AND** no inline iframe for that visualizer is mounted

#### Scenario: Closing the canvas restores the inline frame

- **WHEN** the user closes the canvas
- **THEN** the inline frame is mounted again and re-sends its grouped payload after the handshake
