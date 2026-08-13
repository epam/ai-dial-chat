/** Namespace prefix for every `@DIAL_OVERLAY` postMessage type string. */
export const DIAL_OVERLAY_NAMESPACE = '@DIAL_OVERLAY';

/** Request message types the host can send to the embedded app. */
export enum OverlayRequestType {
  /** Fetch the active conversation's messages. */
  GetMessages = '@DIAL_OVERLAY/GET_MESSAGES',
  /** Send a new message in the active conversation. */
  SendMessage = '@DIAL_OVERLAY/SEND_MESSAGE',
  /** Set the current text content of the message input. */
  SetInputContent = '@DIAL_OVERLAY/SET_INPUT_CONTENT',
  /** Set the active conversation's system prompt. */
  SetSystemPrompt = '@DIAL_OVERLAY/SET_SYSTEM_PROMPT',
  /** Set the active conversation's temperature. */
  SetTemperature = '@DIAL_OVERLAY/SET_TEMPERATURE',
  /** Set host-provided options (theme, model, conversation, host domain). */
  SetOverlayOptions = '@DIAL_OVERLAY/SET_OVERLAY_OPTIONS',
  /** Fetch the current user's conversation list. */
  GetConversations = '@DIAL_OVERLAY/GET_CONVERSATIONS',
  /** Fetch the currently displayed (active) conversation(s). */
  GetSelectedConversations = '@DIAL_OVERLAY/GET_SELECTED_CONVERSATIONS',
  /** Navigate to and load a specific conversation by id. */
  SelectConversation = '@DIAL_OVERLAY/SELECT_CONVERSATION',
  /** Create a new conversation, persisting immediately if a first message is given. */
  CreateConversation = '@DIAL_OVERLAY/CREATE_CONVERSATION',
  /** Open the conversation composer without persisting anything. */
  CreateLocalConversation = '@DIAL_OVERLAY/CREATE_LOCAL_CONVERSATION',
  /** Delete a conversation by id. */
  DeleteConversation = '@DIAL_OVERLAY/DELETE_CONVERSATION',
  /** Rename a conversation by id. */
  RenameConversation = '@DIAL_OVERLAY/RENAME_CONVERSATION',
}

/** Event message types the embedded app sends to the host. */
export enum OverlayEventType {
  /** Sent once, immediately, before any host identity is known. */
  InitReady = '@DIAL_OVERLAY/INIT_READY',
  /** Sent once, after auth/model-load state resolves. */
  Ready = '@DIAL_OVERLAY/READY',
  /** Sent once, after the active conversation has been selected/loaded for the first time. */
  ReadyToInteract = '@DIAL_OVERLAY/READY_TO_INTERACT',
  /** Sent whenever the app finishes loading a conversation (initial load or navigation). */
  SelectedConversationLoaded = '@DIAL_OVERLAY/SELECTED_CONVERSATION_LOADED',
  /** Sent when a generation starts for the active conversation. */
  GptStartGenerating = '@DIAL_OVERLAY/GPT_START_GENERATING',
  /** Sent when a generation completes for the active conversation. */
  GptEndGenerating = '@DIAL_OVERLAY/GPT_END_GENERATING',
  /** Sent when a user (or host) stops an in-flight generation. */
  StopGenerating = '@DIAL_OVERLAY/STOP_GENERATING',
  /** Sent whenever the app's conversation list changes. */
  ConversationsUpdated = '@DIAL_OVERLAY/CONVERSATIONS_UPDATED',
}

/** Optional embed-time features a host can opt into via `ChatOverlayOptions.enabledFeatures`. */
export enum OverlayFeature {
  /** Enables the "Add app" menu's Code Apps entry. */
  CodeApps = 'code-apps',
  /** Enables the "Add app" menu's custom-application creation entry point. */
  CustomApplications = 'custom-applications',
  /** Hides the "Custom app" creation entry in the "Add app" menu. */
  HideCustomAppCreation = 'hide-custom-app-creation',
  /** Disables the send action on the chat input without removing the button. */
  DisabledSend = 'disabled-send',
  /** Suppresses the chat input's auto-focus effect on load. */
  SkipFocusChatInputOnload = 'skip-focus-chat-input-onload',
  /** Enables the comment field in the negative-feedback (dislike) modal. */
  DislikeComment = 'dislike-comment',
  /** Enables attaching files to a message via the conversation input. */
  InputFiles = 'input-files',
  /** Enables like/dislike actions on assistant messages. */
  Likes = 'likes',
  /** Enables the live-chat-interaction sign-in UI affordance. */
  LiveChatInteraction = 'live-chat-interaction',
  /** Restricts (disables) changing the selected agent/model on the conversation top bar. */
  DisallowChangeAgent = 'disallow-change-agent',
  /** Hides the agent/model selector on the in-chat conversation input. */
  HideChangeAgent = 'hide-change-agent',
  /** Hides the new-conversation controls in the header/layout. */
  HideNewConversation = 'hide-new-conversation',
  /** Enables the empty-chat (new conversation composer) settings UI. */
  EmptyChatSettings = 'empty-chat-settings',
  /** Hides the model selector on the empty-chat composer screen. */
  HideEmptyChatChangeAgent = 'hide-empty-chat-change-agent',
  /** Enables the attachments-manager (`AttachmentCanvasProvider`) mount. */
  AttachmentsManager = 'attachments-manager',
  /** Enables the conversations-panel toggle button. */
  ConversationsPanelToggle = 'conversations-panel-toggle',
  /** Enables the conversations sidebar section. */
  ConversationsSection = 'conversations-section',
  /** Enables the app header. */
  Header = 'header',
  /** Makes the conversations sidebar section open by default. */
  ShowConversationsSectionByDefault = 'showConversationsSectionByDefault',
  /** Hides the conversations panel's source filter tabs (All / My chats / Shared / Organization). */
  HideConversationsFilter = 'hide-conversations-filter',
  /** Enables the catalog (`/catalog`) route. */
  Catalog = 'catalog',
  /** Restricts the catalog to hide the current user's own/shared-with-me apps. */
  CatalogHideMyApps = 'catalog-hide-my-apps',
  /** Makes the catalog's table view the initial default (instead of grid). */
  CatalogTableView = 'catalog-table-view',
  /** Enables the file manager (`/files`) route and its navigation entry. */
  FileManager = 'file-manager',
  /** Hides the delete action on a user's own messages. */
  HideDeleteUserMessage = 'hide-delete-user-message',
  /** Hides the edit action on a user's own messages. */
  HideEditUserMessage = 'hide-edit-user-message',
  /** Hides the regenerate action on assistant messages. */
  HideRegenerateAssistantMessage = 'hide-regenerate-assistant-message',
  /** Enables the conversation-publishing entry point. */
  ConversationsPublishing = 'conversations-publishing',
  /** Enables the application-sharing entry point. */
  ApplicationsSharing = 'applications-sharing',
  /** Enables the conversation-sharing entry point. */
  ConversationsSharing = 'conversations-sharing',
  /** Enables the toolset-sharing entry point. */
  ToolsetsSharing = 'toolsets-sharing',
  /** Enables toolsets functionality. */
  Toolsets = 'toolsets',
  /** Enables prompts: the catalog's Prompts tab, its create option, and the prompt editor route. */
  Prompts = 'prompts',
  /** Enables skills: the catalog's Skills tab and the skill details panel. */
  Skills = 'skills',
  /** Enables the custom-app creation entry in the catalog. */
  CustomApps = 'custom-apps',
  /** Hides the user avatar/menu button in the header. */
  HideUserMenu = 'hide-user-menu',
  /** Hides the settings entry in the user menu. */
  HideUserSettings = 'hide-user-settings',
  /** Hides the keyboard-shortcuts entry in the user menu and the mobile profile sheet. */
  HideKeyboardShortcuts = 'hide-keyboard-shortcuts',
  /** Enables the `microphone` permission on the iframe's `allow` attribute for voice input. */
  VoiceInput = 'voice-input',
}

/** Controls how an overlay starts authentication for a configured provider. */
export enum OverlayAuthUiMode {
  /** Opens authentication in a separate browser window or tab. */
  External = 'external',
  /** Navigates the embedded overlay window through authentication. */
  SameWindow = 'sameWindow',
}

/** Machine-readable reasons why an overlay request could not be completed. */
export enum OverlayRequestErrorCode {
  /** The method requires an open conversation, but the composer is currently shown. */
  ActiveConversationUnavailable = 'ACTIVE_CONVERSATION_UNAVAILABLE',
  /** The method requires the conversation-list integration, but it is not available. */
  ConversationListUnavailable = 'CONVERSATION_LIST_UNAVAILABLE',
  /** The request payload does not match the method contract. */
  InvalidPayload = 'INVALID_PAYLOAD',
  /** The embedded chat failed while executing the requested operation. */
  RequestExecutionFailed = 'REQUEST_EXECUTION_FAILED',
}

/** Structured failure returned for an overlay request. */
export interface OverlayRequestError {
  /** Stable code suitable for programmatic handling. */
  code: OverlayRequestErrorCode;
  /** Human-readable explanation suitable for logs and diagnostics. */
  message: string;
}

/** Minimal message shape carried in overlay protocol payloads. */
export interface OverlayChatMessage {
  /** Message id. */
  id: string;
  /** Author role, e.g. `'user'`, `'assistant'`, or `'system'`. */
  role: string;
  /** Message text content. */
  content: string;
}

/** Host-agnostic conversation projection for the overlay protocol. */
export interface OverlayConversation {
  /** Conversation id. */
  id: string;
  /** Conversation title. */
  title: string;
  /** Epoch milliseconds of the conversation's last update. */
  updatedAt: number;
  /** Whether the conversation is pinned. */
  isPinned: boolean;
  /** Whether the current user has read-only access. */
  isReadonly: boolean;
  /** Whether the conversation was shared with the current user. */
  sharedWithMe: boolean;
  /** Whether the conversation was published with the current user. */
  publishedWithMe: boolean;
}

/** Error signal carried by conversation-list method responses. */
export interface OverlayConversationError {
  /** `NOT_FOUND` for an unknown/inaccessible id, `FORBIDDEN` for a read-only/shared-without-write-access conversation, `INVALID_ARGUMENT` for a rejected value (e.g. blank rename). */
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_ARGUMENT';
  /** Human-readable description of the failure. */
  message: string;
}

/** Options passed to `ChatOverlay`'s constructor. */
export interface ChatOverlayOptions {
  /** Full URL of the chat app instance to embed (origin + optional path). */
  domain: string;
  /** Milliseconds to wait for a request's response before rejecting. Defaults to `10000`. */
  requestTimeout?: number;
  /** Inline CSS properties applied to the loader element while it is visible. */
  loaderStyles?: Record<string, string>;
  /** CSS class applied to the loader element. */
  loaderClass?: string;
  /** Custom HTML rendered inside the loader element, replacing the default spinner. */
  loaderInnerHTML?: string;
  /** Event whose receipt hides the loader. Defaults to `OverlayEventType.Ready`. */
  loaderHideEvent?: OverlayEventType;
  /** Embed-time features to enable, e.g. microphone access for voice input. */
  enabledFeatures?: OverlayFeature[];
  /** Theme name applied to the embedded app. */
  theme?: string;
  /** Deployment/model id to select in the embedded app. */
  modelId?: string;
  /** Conversation id the embedded app should load and display. */
  overlayConversationId?: string;
  /** Per-provider authentication UI behavior configured by the embedding host. */
  auth?: {
    providerUiModes?: Record<string, OverlayAuthUiMode>;
  };
}

/** Payload of a `SET_OVERLAY_OPTIONS` request. */
export interface SetOverlayOptionsPayload {
  /** Origin of the host page, used by the app to target responses/events. */
  hostDomain: string;
  /** Theme name to apply, if provided. */
  theme?: string;
  /** Deployment/model id to select, if provided. */
  modelId?: string;
  /** Conversation id to navigate to and load, if provided. */
  overlayConversationId?: string;
  /**
   * UI-feature keys that replace (not merge with) the app's current effective
   * UI-feature set, if provided. Array only — no comma-separated-string form.
   */
  enabledFeatures?: string[];
  /** Opaque per-provider authentication UI modes supplied by the host. */
  authProviderUiModes?: Record<string, string>;
}

/** Payload of a `SEND_MESSAGE` request. */
export interface SendMessagePayload {
  /** Text content of the message to send. */
  content: string;
}

/** Payload of a `SET_INPUT_CONTENT` request. */
export interface SetInputContentPayload {
  /** Text content to set in the message input. */
  content: string;
}

/** Payload of a `SET_SYSTEM_PROMPT` request. */
export interface SetSystemPromptPayload {
  /** System prompt to persist on the active conversation. */
  systemPrompt: string;
}

/** Payload of a `SET_TEMPERATURE` request. */
export interface SetTemperaturePayload {
  /** Temperature value to persist on the active conversation. */
  temperature: number;
}

/** Payload of a `SELECT_CONVERSATION` request. */
export interface SelectConversationPayload {
  /** Id of the conversation to select. */
  id: string;
}

/** Payload of a `DELETE_CONVERSATION` request. */
export interface DeleteConversationPayload {
  /** Id of the conversation to delete. */
  id: string;
}

/** Payload of a `RENAME_CONVERSATION` request. */
export interface RenameConversationPayload {
  /** Id of the conversation to rename. */
  id: string;
  /** New title for the conversation. */
  newName: string;
}

/** Payload of a `CREATE_CONVERSATION` request. */
export interface CreateConversationPayload {
  /** Deployment/model id to create the conversation with, if given. */
  deploymentId?: string;
  /** Initial message to persist immediately. Omitted/blank opens the composer instead. */
  firstMessage?: string;
}

/** Response payload of a `GET_MESSAGES` request. */
export interface GetMessagesResponse {
  /** Messages in the active conversation. */
  messages: OverlayChatMessage[];
}

/** Response payload of a `SEND_MESSAGE` request. */
export interface SendMessageResponse {
  /** Messages in the active conversation after the send. */
  messages: OverlayChatMessage[];
}

/** Response payload of a `SET_SYSTEM_PROMPT` request. */
export interface SetSystemPromptResponse {
  /** System prompt value that was persisted. */
  systemPrompt: string;
}

/** Response payload of a `SET_TEMPERATURE` request. */
export interface SetTemperatureResponse {
  /** Temperature value that was persisted. */
  temperature: number;
}

/** Response payload of a `SET_OVERLAY_OPTIONS` request. */
export interface SetOverlayOptionsResponse {
  /** Whether the supplied options were applied (`false` only signals a fallback, never a thrown error). */
  applied: boolean;
}

/** Response payload of a `GET_CONVERSATIONS` request. */
export interface GetConversationsResponse {
  /** The current user's conversation list. */
  conversations: OverlayConversation[];
}

/** Response payload of a `GET_SELECTED_CONVERSATIONS` request. */
export interface GetSelectedConversationsResponse {
  /** Currently displayed conversation(s); empty when no conversation is mounted. */
  conversations: OverlayConversation[];
}

/** Response payload of a `SELECT_CONVERSATION` request. */
export interface SelectConversationResponse {
  /** The now-selected conversation's projection, present on success. */
  conversation?: OverlayConversation;
  /** Present when the selection failed. */
  error?: OverlayConversationError;
}

/** Response payload of a `CREATE_CONVERSATION` request. */
export interface CreateConversationResponse {
  /** The created conversation's projection, or `null` when the composer path was taken. */
  conversation: OverlayConversation | null;
  /** Present when creation failed. */
  error?: OverlayConversationError;
}

/** Response payload of a `CREATE_LOCAL_CONVERSATION` request. */
export interface CreateLocalConversationResponse {
  /** Always `null` — the composer opens without persisting anything. */
  conversation: null;
}

/** Response payload of a `DELETE_CONVERSATION` request. */
export interface DeleteConversationResponse {
  /** Present when deletion failed. */
  error?: OverlayConversationError;
}

/** Response payload of a `RENAME_CONVERSATION` request. */
export interface RenameConversationResponse {
  /** The renamed conversation's projection, present on success. */
  conversation?: OverlayConversation;
  /** Present when the rename failed. */
  error?: OverlayConversationError;
}

/**
 * A request message sent from the host (library) to the embedded app.
 * `type` is always `'${OverlayRequestType}'`.
 */
export interface OverlayMessageRequest<TPayload = unknown> {
  /** Full wire type string, one of the `OverlayRequestType` values. */
  type: `${OverlayRequestType}`;
  /** Unique id used to match this request to its response. */
  requestId: string;
  /**
   * Epoch milliseconds after which the embedded app must stop waiting for
   * prerequisites (such as an active conversation bridge) and drop the request.
   */
  expiresAt?: number;
  /** Request-specific payload. */
  payload?: TPayload;
}

/**
 * A response message sent from the embedded app to the host (library),
 * answering a specific request by `requestId`.
 */
export interface OverlayMessageResponse<TPayload = unknown> {
  /** Full wire type string, always `'${OverlayRequestType}/RESPONSE'`. */
  type: `${OverlayRequestType}/RESPONSE`;
  /** `requestId` of the request this message answers. */
  requestId: string;
  /** Response-specific payload. */
  payload?: TPayload;
  /** Present when the embedded chat could not complete the request. */
  error?: OverlayRequestError;
}

/**
 * An event message sent from the embedded app to the host (library),
 * with no associated request (no `requestId` field).
 */
export interface OverlayMessageEvent<TPayload = unknown> {
  /** Full wire type string, one of the `OverlayEventType` values. */
  type: `${OverlayEventType}`;
  /** Event-specific payload. */
  payload?: TPayload;
}

/** Narrows an arbitrary value to a well-formed `OverlayMessageRequest`. */
export const isOverlayMessageRequest = (
  data: unknown,
): data is OverlayMessageRequest => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.type === 'string' &&
    (Object.values(OverlayRequestType) as string[]).includes(candidate.type) &&
    typeof candidate.requestId === 'string' &&
    (!('expiresAt' in candidate) ||
      (typeof candidate.expiresAt === 'number' &&
        Number.isFinite(candidate.expiresAt)))
  );
};

/** Narrows an arbitrary value to a well-formed `OverlayMessageResponse`. */
export const isOverlayMessageResponse = (
  data: unknown,
): data is OverlayMessageResponse => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  if (
    typeof candidate.type !== 'string' ||
    typeof candidate.requestId !== 'string'
  ) {
    return false;
  }
  const hasKnownResponseType = (
    Object.values(OverlayRequestType) as string[]
  ).some((requestType) => candidate.type === `${requestType}/RESPONSE`);
  if (!hasKnownResponseType) {
    return false;
  }
  if (!('error' in candidate)) {
    return true;
  }
  const error = candidate.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    (Object.values(OverlayRequestErrorCode) as string[]).includes(
      (error as Record<string, unknown>).code as string,
    ) &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
};

/** Narrows an arbitrary value to a well-formed `OverlayMessageEvent`. */
export const isOverlayMessageEvent = (
  data: unknown,
): data is OverlayMessageEvent => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.type === 'string' &&
    (Object.values(OverlayEventType) as string[]).includes(candidate.type) &&
    !('requestId' in candidate)
  );
};
