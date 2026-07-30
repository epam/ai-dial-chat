/**
 * Identifies `VisualizerConnector` in error/log messages (e.g.
 * `[VisualizerConnector] Request … timed out`). This is NOT part of the
 * postMessage wire format — the wire prefix on every envelope is the
 * per-instance `visualizerName` (see `VisualizerConnectorOptions`), sourced
 * from the registry entry's `title`.
 */
export const visualizerConnectorLibName = 'VisualizerConnector';

/** Event message types a visualizer iframe sends to the host, wire-prefixed `${visualizerName}/`. */
export enum VisualizerConnectorEvents {
  /** Sent once the iframe app has mounted and can receive messages. */
  Ready = 'READY',
  /** Sent once the iframe app has finished its own initialization and can receive data. */
  ReadyToInteract = 'READY_TO_INTERACT',
  /** Sent by the visualizer to inject a message into the active conversation. */
  SendMessage = 'SEND_MESSAGE',
}

/**
 * Request message types the host sends to a visualizer iframe, wire-prefixed
 * `${visualizerName}/`. Each has a matching `${visualizerName}/${type}/RESPONSE` reply.
 */
export enum VisualizerConnectorRequests {
  /** Delivers a single attachment's payload and layout to the visualizer. */
  SendVisualizeData = 'SEND_VISUALIZE_DATA',
  /** Delivers a grouped set of attachments to an application-level visualizer. */
  SendGroupedVisualizeData = 'SEND_GROUPED_VISUALIZE_DATA',
}
