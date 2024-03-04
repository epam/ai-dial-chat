// TODO: use this actively in overlay
export enum OverlayRequests {
  getMessages = 'GET_MESSAGES',
  setOverlayOptions = 'SET_OVERLAY_OPTIONS',
  setSystemPrompt = 'SET_SYSTEM_PROMPT',
  sendMessage = 'SEND_MESSAGE',
}

export enum OverlayEvents {
  ready = 'READY',
  gptStartGenerating = 'GPT_START_GENERATING',
  gptEndGenerating = 'GPT_END_GENERATING',
}
