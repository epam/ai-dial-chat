## ADDED Requirements

### Requirement: `AttachmentContentType.GroupedVisualizer` variant

`libs/attachment-canvas` SHALL add a `GroupedVisualizer` member to
`AttachmentContentType` and a `GroupedVisualizerCanvasContent` variant to the canvas
content union:

```ts
interface GroupedVisualizerCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.GroupedVisualizer;
  /** Iframe `src`, resolved from the matching registry entry's `url`. */
  url: string;
  /** One item per claimed attachment, in the message's attachment order. */
  attachments: AttachmentItem[];
  /** Presentation layout hints (`themeId`, `width`, `height`, `mobileHeight`). */
  layout: CustomVisualizerDataLayout;
  /** postMessage protocol namespace — MUST equal the registry entry's `title`. */
  visualizerName: string;
  /** Milliseconds to wait for a `send()` request's response before rejecting. Does NOT bound the handshake. */
  requestTimeout?: number;
}
```

The variant carries no `mimeType` and no single `data` field — per-attachment MIME types
and payloads live inside `attachments`.

The content object SHALL be built once by the app and shared by both mount points: the
inline surface in the message and the canvas panel. Opening the canvas from the inline
surface SHALL pass the existing object rather than rebuilding it.

**Feature flag:** none. The variant is reachable only when the app builds it from a
populated `APPLICATION_VISUALIZERS` registry.

#### Scenario: Grouped content is distinguishable from single-attachment content

- **WHEN** the app builds content for an application visualizer
- **THEN** `content.type` is `AttachmentContentType.GroupedVisualizer`
- **AND** `content.attachments` is a non-empty array

---

### Requirement: `AttachmentCanvas` switch handles the GroupedVisualizer variant

`AttachmentCanvasBody` SHALL carry a `case AttachmentContentType.GroupedVisualizer`
branch — in
`libs/attachment-canvas/src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx`,
which owns the switch over `AttachmentContentType` — that renders
`<VisualizerCanvasRenderer content={content} />` inside the panel body.

The panel chrome (header, close button, resize handle, keyboard/ARIA behaviour) SHALL be
identical to the chrome used for other content types.

#### Scenario: Rendering switch dispatches to the grouped visualizer branch

- **WHEN** `AttachmentCanvas` is rendered with a `GroupedVisualizerCanvasContent`
- **THEN** the panel body contains a mounted `VisualizerCanvasRenderer`
- **AND** the panel chrome behaves as it does for every other content type

## MODIFIED Requirements

### Requirement: `VisualizerCanvasRenderer` component

`libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx` SHALL render an iframe host and drive the visualizer handshake and data delivery via the published npm package `@epam/ai-dial-visualizer-connector` (and `@epam/ai-dial-shared` for the request enum). Behaviour:

- On mount, create a `VisualizerConnector` bound to the container element, passing `domain: content.url`, `hostDomain: window.location.origin` (required by the published options type; unused at runtime in the current package), `visualizerName: content.visualizerName`, and `requestTimeout: content.requestTimeout`.
- Await `.ready()` and then dispatch exactly one request, selected by the content variant it was given:
  - `AttachmentContentType.Visualizer` → `.send(VisualizerConnectorRequests.sendVisualizeData, { mimeType: content.mimeType, visualizerData: { layout: content.layout, ...content.data } })` (wire value `SEND_VISUALIZE_DATA`).
  - `AttachmentContentType.GroupedVisualizer` → `.send(VisualizerConnectorRequests.sendGroupedVisualizeData, { attachments: content.attachments, layout: content.layout })` (wire value `SEND_GROUPED_VISUALIZE_DATA`).

  `VisualizerConnectorRequests` is imported from `@epam/ai-dial-shared` (camelCase members).
- On unmount, call `connector.destroy()` exactly once for that instance.
- Display a loading state while `.ready()` is pending. Because `.ready()` never times out (see the `custom-visualizers` capability), a visualizer that never completes the handshake leaves the body in this loading state indefinitely — this is intended. Display an error state if the dispatched `send()` rejects (its own timeout) or if `.ready()` rejects due to `destroy()`.
- The component SHALL keep the connector instance stable across parent re-renders that do not change `url` / `visualizerName` / `requestTimeout`, so those re-renders do not tear down the iframe. This applies to both variants: appending attachments to a grouped payload during streaming changes the content object's identity but MUST NOT remount the iframe.

The component MUST NOT read from any app-level context (auth, theme, i18n, feature flags) — all data required for the visualizer is passed in through the canvas content object.

#### Scenario: connector is destroyed on unmount

- **WHEN** the `VisualizerCanvasRenderer` unmounts
- **THEN** `VisualizerConnector.destroy()` is called
- **AND** the iframe element is removed from the DOM

#### Scenario: SEND_VISUALIZE_DATA is dispatched after READY_TO_INTERACT

- **WHEN** the renderer was given a `VisualizerCanvasContent` and the iframe posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the renderer calls `connector.send` with the published enum member whose wire value is `SEND_VISUALIZE_DATA` exactly once
- **AND** the payload's `layout` equals `content.layout`

#### Scenario: SEND_GROUPED_VISUALIZE_DATA is dispatched for grouped content

- **WHEN** the renderer was given a `GroupedVisualizerCanvasContent` and the iframe posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the renderer calls `connector.send` with the published enum member whose wire value is `SEND_GROUPED_VISUALIZE_DATA` exactly once
- **AND** the payload is `{ attachments, layout }` taken from the content
- **AND** no `SEND_VISUALIZE_DATA` request is sent

#### Scenario: send failure surfaces error state

- **WHEN** the dispatched `send()` promise rejects (no `/RESPONSE` within `requestTimeout`)
- **THEN** the renderer displays an error state
- **AND** the canvas remains closable via the header's close button

#### Scenario: incomplete handshake stays in the loading state

- **WHEN** the iframe mounts but never posts `READY_TO_INTERACT`
- **THEN** the renderer keeps showing the loading state and does not show an error
- **AND** the canvas remains closable via the header's close button
