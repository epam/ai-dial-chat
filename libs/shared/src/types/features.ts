export enum Feature {
  ConversationsSection = 'conversations-section', // Display conversations sidebar
  PromptsSection = 'prompts-section', // Display prompts sidebar
  TopSettings = 'top-settings', // Display conversation top header
  TopClearConversation = 'top-clear-conversation', // Display clear conversations button in chat top settings
  TopChatInfo = 'top-chat-info', // Display conversation info in top chat settings
  TopChatModelSettings = 'top-chat-model-settings', // Display change model settings button
  HideTopContextMenu = 'hide-top-context-menu', // Hide top context menu button
  EmptyChatSettings = 'empty-chat-settings', // Display settings for empty chat
  HideEmptyChatChangeAgent = 'hide-empty-chat-change-agent', // Hide empty chat "Change agent" button
  Header = 'header', // Display app header
  Footer = 'footer', // Display app footer
  RequestApiKey = 'request-api-key', // Display request API Key modal
  ReportAnIssue = 'report-an-issue', // Display report issue modal
  Likes = 'likes', // Display likes
  ConversationsSharing = 'conversations-sharing', // Display conversation sharing
  PromptsSharing = 'prompts-sharing', // Display prompts sharing
  ApplicationsSharing = 'applications-sharing', // Display applications sharing
  InputFiles = 'input-files', // Allow attach files to conversation
  InputLinks = 'input-links', // Allow attach links to conversation
  AttachmentsManager = 'attachments-manager', // Display attachments manager in conversation sidebar
  ConversationsPublishing = 'conversations-publishing',
  PromptsPublishing = 'prompts-publishing',
  CustomLogo = 'custom-logo', // Enable setting for custom logo feature
  HideNewConversation = 'hide-new-conversation', // hide "New conversation" button
  CustomApplications = 'custom-applications', // custom applications
  MessageTemplates = 'message-templates', // message templates
  Marketplace = 'marketplace', // Enable Marketplace
  QuickApps = 'quick-apps', // Enable Quick apps
  CodeApps = 'code-apps', // Enable Code apps
  DisallowChangeAgent = 'disallow-change-agent', //Disallow "Change agent" button
}

export const availableFeatures: Record<Feature, boolean> = {
  [Feature.ConversationsSection]: true,
  [Feature.PromptsSection]: true,
  [Feature.TopSettings]: true,
  [Feature.TopClearConversation]: true,
  [Feature.TopChatInfo]: true,
  [Feature.TopChatModelSettings]: true,
  [Feature.HideTopContextMenu]: false,
  [Feature.EmptyChatSettings]: true,
  [Feature.HideEmptyChatChangeAgent]: false,
  [Feature.Header]: true,
  [Feature.Footer]: true,
  [Feature.RequestApiKey]: true,
  [Feature.ReportAnIssue]: true,
  [Feature.Likes]: true,
  [Feature.ConversationsSharing]: true,
  [Feature.PromptsSharing]: true,
  [Feature.ApplicationsSharing]: true,
  [Feature.InputFiles]: true,
  [Feature.InputLinks]: true,
  [Feature.AttachmentsManager]: true,
  [Feature.ConversationsPublishing]: true,
  [Feature.PromptsPublishing]: true,
  [Feature.CustomLogo]: true,
  [Feature.HideNewConversation]: true,
  [Feature.CustomApplications]: true,
  [Feature.MessageTemplates]: true,
  [Feature.Marketplace]: true,
  [Feature.QuickApps]: true,
  [Feature.CodeApps]: true,
  [Feature.DisallowChangeAgent]: true,
};
