export const overlayAppName = '@DIAL_OVERLAY';

export enum OverlayRequests {
  getMessages = 'GET_MESSAGES',
  getConversations = 'GET_CONVERSATIONS',
  selectConversation = 'SELECT_CONVERSATION',
  createConversation = 'CREATE_CONVERSATION',
  setOverlayOptions = 'SET_OVERLAY_OPTIONS',
  setSystemPrompt = 'SET_SYSTEM_PROMPT',
  sendMessage = 'SEND_MESSAGE',
}

export enum OverlayEvents {
  /**
   * Chat dispatch this event when starting initializing (loading models, requesting conversations, etc.)
   *
   * *Dispatched only once*
   */
  initReady = 'INIT_READY',
  /**
   * Chat dispatch this event when models loaded or login needed - needed to receive and set initial chat options
   *
   * *Dispatched only once*
   */
  ready = 'READY',
  /**
   * Chat dispatch this event when previous ready events sent and selected conversation loaded
   *
   * *Dispatched only once*
   */
  readyToInteract = 'READY_TO_INTERACT',
  /**
   * Chat dispatch this event when selected conversation loaded
   *
   * *Dispatched once before ready to interact event and on all conversation full reloads (renaming, changing model, etc.)*
   */
  selectedConversationLoaded = 'SELECTED_CONVERSATION_LOADED',
  /**
   * Chat dispatch this event when user send message to assistant
   */
  gptStartGenerating = 'GPT_START_GENERATING',
  /**
   * Chat dispatch this event when user end receiving message from assistant
   */
  gptEndGenerating = 'GPT_END_GENERATING',
}

export const overlayLibName = 'ChatOverlay';
