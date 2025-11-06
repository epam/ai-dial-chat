export const visualizerConnectorLibName = 'VisualizerConnector';

export enum VisualizerConnectorEvents {
  initReady = 'INIT_READY',
  ready = 'READY',
  readyToInteract = 'READY_TO_INTERACT',
  sendMessage = 'SEND_MESSAGE',
  createdConversationSuccess = 'CREATED_CONVERSATION_SUCCESS',
  updatedConversationSuccess = 'UPDATED_CONVERSATION_SUCCESS',
  updatedApplicationSuccess = 'UPDATED_APPLICATION_SUCCESS',
}

export enum VisualizerConnectorRequests {
  sendVisualizeData = 'SEND_VISUALIZE_DATA',
  setVisualizerOptions = 'SET_VISUALIZER_OPTIONS',
}
