export enum Feature {
  // Layout
  Header = 'header', // Display app header
  Footer = 'footer', // Display app footer
  ConversationsSection = 'conversations-section', // Display conversations sidebar
  PromptsSection = 'prompts-section', // Display prompts sidebar
  ConversationsPanelToggle = 'conversations-panel-toggle', // Show conversations panel toggle in the corner without app header
  PromptsPanelToggle = 'prompts-panel-toggle', // Show prompts panel toggle in the corner without app header
  ShowConversationsSectionByDefault = 'showConversationsSectionByDefault', // show conversations sidebar by default on desktop
  ShowPromptsSectionByDefault = 'showPromptsSectionByDefault', // show prompts sidebar by default on desktop
  MdSidebarOverlayBreakpoint = 'md-sidebar-overlay-breakpoint', // use md (768px) instead of xl (1280px) sidebar overlay breakpoint in iframe embed
  ShowLayoutDividers = 'show-layout-dividers', // show dividers between chat and sidebars
  AttachmentsManager = 'attachments-manager', // Display attachments manager in conversation
  ChatFullWidthByDefault = 'chat-full-width-by-default', // Enforce chat full-width

  // Chat Header
  ChatHeaderBorder = 'chat-header-border', // Display a separator line below the chat header

  // Conversation Header
  HideNewConversation = 'hide-new-conversation', // hide "New conversation" button
  TopSettings = 'top-settings', // Display conversation top header
  TopClearConversation = 'top-clear-conversation', // Display clear conversations button in chat top settings
  TopChatInfo = 'top-chat-info', // Display conversation info in top chat settings
  TopChatModelSettings = 'top-chat-model-settings', // Display change model settings button
  HideTopContextMenu = 'hide-top-context-menu', // Hide top context menu button
  DisallowChangeAgent = 'disallow-change-agent', // Disallow "Change agent" button

  // Conversation functions
  CompareModeDisabled = 'compare-mode-disabled', // Disable compare mode (sidebar button, conversation context menu). Enabled by default
  Likes = 'likes', // Display likes
  DislikeComment = 'dislike-comment', // Enable adding comment when disliking a message
  InputFiles = 'input-files', // Allow attach files to conversation
  InputLinks = 'input-links', // Allow attach links to conversation
  MessageTemplates = 'message-templates', // message templates
  LiveChatInteraction = 'live-chat-interaction', // Enable interactive tool login flow during chat completion when agent tools are logged out

  // Edit assistant message
  EditLastAssistantContent = 'edit-last-assistant-message', // allow edit last assistant message only
  EditAllAssistantContent = 'edit-all-assistant-message', // allow edit all assistant messages

  // Edit user message
  UserMessageAlignEnd = 'user-message-align-end', // Align user messages to the inline end (right in LTR)
  HideEditUserMessage = 'hide-edit-user-message', // Hide editing button of user message

  // Regenerate assistant message
  HideRegenerateAssistantMessage = 'hide-regenerate-assistant-message', // Hide regenerate button of assistant message

  // Delete user message
  HideDeleteUserMessage = 'hide-delete-user-message', // Hide delete button of user message

  // Chat input
  SkipFocusChatInputOnLoad = 'skip-focus-chat-input-onload', // Skip default focusing chat input when on screen onload or after navigation
  ChatInputBorder = 'chat-input-border', // Display border around chat input area

  // Send button
  DisabledSend = 'disabled-send', // Disable input

  // Playback change
  DisabledPlaybackControls = 'disabled-playback-controls', // Disable changing playback current message

  // Conversation First Screen
  EmptyChatSettings = 'empty-chat-settings', // Display settings for empty chat
  HideEmptyChatChangeAgent = 'hide-empty-chat-change-agent', // Hide empty chat "Change agent" button

  // Sharing
  ConversationsSharing = 'conversations-sharing', // Display conversation sharing
  PromptsSharing = 'prompts-sharing', // Display prompts sharing
  ApplicationsSharing = 'applications-sharing', // Display applications sharing
  ToolsetsSharing = 'toolsets-sharing', // Display toolsets sharing

  // Publishing
  ConversationsPublishing = 'conversations-publishing',
  PromptsPublishing = 'prompts-publishing',

  // Special dialogs
  RequestApiKey = 'request-api-key', // Display request API Key modal
  ReportAnIssue = 'report-an-issue', // Display report issue modal

  // User settings
  HideUserSettings = 'hide-user-settings', // Hide user settings
  CustomLogo = 'custom-logo', // Enable setting for custom logo feature
  HideUserMenu = 'hide-user-menu', // Hide user menu button from top header

  // Applications
  CustomApplications = 'custom-applications', // Enable creating of applications ('Add app' button/menu)
  HideCustomAppCreation = 'hide-custom-app-creation', // Hide "Custom app" option in 'Add app' button/menu
  CodeApps = 'code-apps', // Enable creating of Code apps (into the 'Add app' menu)
  CodeInterpreter = 'code-interpreter', // Enable Code Interpreter feature

  // Marketplace
  Marketplace = 'marketplace', // Enable Marketplace
  MarketplaceTableView = 'marketplace-table-view', // Enable table view in Marketplace

  //Toolsets
  Toolsets = 'toolsets', //Enable toolsets

  // Voice input
  VoiceInput = 'voice-input', // Enable voice recording input button
}

export interface FeatureData {
  // Field for adding some description for feature
  // Can be used in tooltips or other places
  description?: string;
}
