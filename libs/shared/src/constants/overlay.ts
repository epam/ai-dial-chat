export const overlayAppName = '@DIAL_OVERLAY';

export enum OverlayRequests {
  getMessages = 'GET_MESSAGES',
  setOverlayOptions = 'SET_OVERLAY_OPTIONS',
  setSystemPrompt = 'SET_SYSTEM_PROMPT',
  sendMessage = 'SEND_MESSAGE',
}

export enum OverlayEvents {
  initReady = 'INIT_READY',
  ready = 'READY',
  readyToInteract = 'READY_TO_INTERACT',
  gptStartGenerating = 'GPT_START_GENERATING',
  gptEndGenerating = 'GPT_END_GENERATING',
}

export const overlayLibName = 'ChatOverlay';
