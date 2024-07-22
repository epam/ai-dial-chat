export const visualizerConnectorLibName = 'VisualizerConnector';

export enum VisualizerConnectorEvents {
  initReady = 'INIT_READY',
  ready = 'READY',
  readyToInteract = 'READY_TO_INTERACT',
  sendMessage = 'SEND_MESSAGE',
}

export enum VisualizerConnectorRequests {
  sendVisualizeData = 'SEND_VISUALIZE_DATA',
  setVisualizerOptions = 'SET_VISUALIZER_OPTIONS',
}
