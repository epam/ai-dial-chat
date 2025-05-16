export enum Feature {
  // Layout
  Header = 'header', // Display app header
  Footer = 'footer', // Display app footer
  ConversationsSection = 'conversations-section', // Display conversations sidebar
  PromptsSection = 'prompts-section', // Display prompts sidebar
  ShowConversationsSectionByDefault = 'showConversationsSectionByDefault', // show conversations sidebar by default on desktop
  ShowPromptsSectionByDefault = 'showPromptsSectionByDefault', // show prompts sidebar by default on desktop
  AttachmentsManager = 'attachments-manager', // Display attachments manager in conversation

  // Conversation Header
  HideNewConversation = 'hide-new-conversation', // hide "New conversation" button
  TopSettings = 'top-settings', // Display conversation top header
  TopClearConversation = 'top-clear-conversation', // Display clear conversations button in chat top settings
  TopChatInfo = 'top-chat-info', // Display conversation info in top chat settings
  TopChatModelSettings = 'top-chat-model-settings', // Display change model settings button
  HideTopContextMenu = 'hide-top-context-menu', // Hide top context menu button
  DisallowChangeAgent = 'disallow-change-agent', // Disallow "Change agent" button

  // Conversation functions
  Likes = 'likes', // Display likes
  InputFiles = 'input-files', // Allow attach files to conversation
  InputLinks = 'input-links', // Allow attach links to conversation
  MessageTemplates = 'message-templates', // message templates

  // Chat input
  SkipFocusChatInputOnLoad = 'skip-focus-chat-input-onload', // Skip default focusing chat input when on screen onload or after navigation

  // Conversation First Screen
  EmptyChatSettings = 'empty-chat-settings', // Display settings for empty chat
  HideEmptyChatChangeAgent = 'hide-empty-chat-change-agent', // Hide empty chat "Change agent" button

  // Sharing
  ConversationsSharing = 'conversations-sharing', // Display conversation sharing
  PromptsSharing = 'prompts-sharing', // Display prompts sharing
  ApplicationsSharing = 'applications-sharing', // Display applications sharing

  // Publishing
  ConversationsPublishing = 'conversations-publishing',
  PromptsPublishing = 'prompts-publishing',

  // Special dialogs
  RequestApiKey = 'request-api-key', // Display request API Key modal
  ReportAnIssue = 'report-an-issue', // Display report issue modal

  // User settings
  HideUserSettings = 'hide-user-settings', // Hide user settings
  CustomLogo = 'custom-logo', // Enable setting for custom logo feature

  // Applications
  CustomApplications = 'custom-applications', // custom applications
  CodeApps = 'code-apps', // Enable Code apps

  // Marketplace
  Marketplace = 'marketplace', // Enable Marketplace
  MarketplaceTableView = 'marketplace-table-view', // Enable table view in Marketplace
}
