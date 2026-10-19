/**
 * Requests the host sends to the visualizer iframe. Posted as
 * `${visualizerName}/${value}`; the iframe answers `${visualizerName}/${value}/RESPONSE`.
 */
export enum VisualizerConnectorRequests {
  SendVisualizeData = 'SEND_VISUALIZE_DATA',
  SendGroupedVisualizeData = 'SEND_GROUPED_VISUALIZE_DATA',
  SetVisualizerOptions = 'SET_VISUALIZER_OPTIONS',
}

/** Unsolicited messages the visualizer iframe posts to the host, as `${visualizerName}/${value}`. */
export enum VisualizerConnectorEvents {
  InitReady = 'INIT_READY',
  Ready = 'READY',
  ReadyToInteract = 'READY_TO_INTERACT',
  SendMessage = 'SEND_MESSAGE',
  CreatedConversationSuccess = 'CREATED_CONVERSATION_SUCCESS',
  UpdatedConversationSuccess = 'UPDATED_CONVERSATION_SUCCESS',
  UpdatedApplicationSuccess = 'UPDATED_APPLICATION_SUCCESS',
}
