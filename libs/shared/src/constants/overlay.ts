export const overlayAppName = '@DIAL_OVERLAY';

export enum OverlayRequests {
  getMessages = 'GET_MESSAGES',
  sendMessage = 'SEND_MESSAGE',
  deleteMessage = 'DELETE_MESSAGE',
  updateMessage = 'UPDATE_MESSAGE',
  setInputContent = 'SET_INPUT_CONTENT',
  setSystemPrompt = 'SET_SYSTEM_PROMPT',
  setOverlayOptions = 'SET_OVERLAY_OPTIONS',
  getConversations = 'GET_CONVERSATIONS',
  getSelectedConversations = 'GET_SELECTED_CONVERSATIONS',
  selectConversation = 'SELECT_CONVERSATION',
  createConversation = 'CREATE_CONVERSATION',
  createLocalConversation = 'CREATE_LOCAL_CONVERSATION',
  deleteConversation = 'DELETE_CONVERSATION',
  renameConversation = 'RENAME_CONVERSATION',
  createPlaybackConversation = 'CREATE_PLAYBACK_CONVERSATION',
  stopSelectedPlaybackConversation = 'STOP_SELECTED_PLAYBACK_CONVERSATION',
  exportConversation = 'EXPORT_CONVERSATION',
  importConversation = 'IMPORT_CONVERSATION',
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
  /**
   * Chat dispatch this event when user stop streaming explicitly or something happened
   */
  stopGenerating = 'STOP_GENERATING',
  /**
   * Chat dispatch this event when any of conversations updated, added or removed
   */
  conversationsUpdated = 'CONVERSATIONS_UPDATED',
  /**
   * Chat dispatch this event when events occured on custom message buttons
   * Can include different events like mouseover, mousedown, etc.
   */
  messageCustomButton = 'MESSAGE_CUSTOM_BUTTON',
  /**
   * Chat dispatch this event when any of the messages updates by user
   */
  editMessage = 'EDIT_MESSAGE',
  /**
   * Chat dispatch this event when last message regenerated
   */
  regenerateMessage = 'REGENERATE_MESSAGE',
  /**
   * Chat dispatch this event when user message deleted
   */
  deleteMessage = 'DELETE_MESSAGE',
  /**
   * Chat dispatch this event when user change playback to previous message
   */
  prevPlaybackMessage = 'PREV_PLAYBACK_MESSAGE',
  /**
   * Chat dispatch this event when user change playback to next message
   */
  nextPlaybackMessage = 'NEXT_PLAYBACK_MESSAGE',
}

export const overlayLibName = 'ChatOverlay';
