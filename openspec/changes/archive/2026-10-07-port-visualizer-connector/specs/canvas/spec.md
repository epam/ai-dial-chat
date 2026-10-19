## MODIFIED Requirements

### Requirement: `VisualizerCanvasRenderer` component

`libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx` SHALL render an iframe host and drive the visualizer handshake and data delivery through the workspace package `@epam/ai-dial-visualizer-connector` (`libs/visualizer-connector`). It imports `VisualizerConnector`, `VisualizerConnectorRequests` and `VisualizerConnectorEvents` from that package. Behaviour:

- On mount, it creates a `VisualizerConnector` bound to the container element and passes `domain: content.url`, `visualizerName: content.visualizerName` and `requestTimeout: content.requestTimeout`. It SHALL NOT pass `hostDomain`.
- It awaits `.ready()` and then dispatches exactly one request, chosen by the content variant it was given:
  - `AttachmentContentType.Visualizer` → `.send(VisualizerConnectorRequests.SendVisualizeData, { mimeType: content.mimeType, visualizerData: { layout: content.layout, ...content.data } })` (wire value `SEND_VISUALIZE_DATA`).
  - `AttachmentContentType.GroupedVisualizer` → `.send(VisualizerConnectorRequests.SendGroupedVisualizeData, { attachments: content.attachments, layout: content.layout })` (wire value `SEND_GROUPED_VISUALIZE_DATA`).
- It sets the `title` attribute of the iframe that the connector created:
  - to the optional `frameTitle` prop when one is given;
  - otherwise to `content.visualizerName` with surrounding whitespace removed;
  - to nothing when that name is empty.

  An unnamed iframe is announced as an anonymous frame. The title is applied in its own effect, so renaming the frame never tears down the connector or refetches.
- On unmount, it calls `connector.destroy()` exactly once for that instance.
- It shows a loading state while `.ready()` is pending. `.ready()` never times out (see the `custom-visualizers` capability), so a visualizer that never completes the handshake leaves the body in the loading state indefinitely. This is intended.
- It shows an error state when the dispatched `send()` rejects on its own timeout, or when `.ready()` rejects because of `destroy()`.
- It SHALL keep the connector instance stable across parent re-renders that do not change `url`, `visualizerName` or `requestTimeout`, so those re-renders do not tear down the iframe. This applies to both variants: appending attachments to a grouped payload during streaming changes the content object's identity but MUST NOT remount the iframe.

The component MUST NOT read from any app-level context (auth, theme, i18n, feature flags). Everything the visualizer needs arrives through the canvas content object.

#### Scenario: the iframe carries an accessible name

- **WHEN** the renderer mounts with `visualizerName: 'my-viz'` and no `frameTitle`
- **THEN** the iframe's `title` attribute is `'my-viz'`
- **AND** an explicit `frameTitle` takes precedence over it
- **AND** a `visualizerName` that is only whitespace leaves the iframe untitled

#### Scenario: connector is destroyed on unmount

- **WHEN** the `VisualizerCanvasRenderer` unmounts
- **THEN** `VisualizerConnector.destroy()` is called
- **AND** the iframe element is removed from the DOM

#### Scenario: connector is constructed without hostDomain

- **WHEN** the renderer mounts
- **THEN** the `VisualizerConnector` options contain `domain`, `visualizerName` and `requestTimeout`
- **AND** they do not contain `hostDomain`

#### Scenario: SEND_VISUALIZE_DATA is dispatched after READY_TO_INTERACT

- **WHEN** the renderer was given a `VisualizerCanvasContent` and the iframe posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the renderer calls `connector.send(VisualizerConnectorRequests.SendVisualizeData, …)` exactly once, with wire value `SEND_VISUALIZE_DATA`
- **AND** the payload's `layout` equals `content.layout`

#### Scenario: SEND_GROUPED_VISUALIZE_DATA is dispatched for grouped content

- **WHEN** the renderer was given a `GroupedVisualizerCanvasContent` and the iframe posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the renderer calls `connector.send(VisualizerConnectorRequests.SendGroupedVisualizeData, …)` exactly once, with wire value `SEND_GROUPED_VISUALIZE_DATA`
- **AND** the payload is `{ attachments, layout }` taken from the content
- **AND** no `SEND_VISUALIZE_DATA` request is sent

#### Scenario: send failure surfaces error state

- **WHEN** the dispatched `send()` promise rejects because no `/RESPONSE` arrived within `requestTimeout`
- **THEN** the renderer shows an error state
- **AND** the canvas can still be closed with the header's close button

#### Scenario: incomplete handshake stays in the loading state

- **WHEN** the iframe mounts but never posts `READY_TO_INTERACT`
- **THEN** the renderer keeps showing the loading state and does not show an error
- **AND** the canvas can still be closed with the header's close button
