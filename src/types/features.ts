export enum Feature {
  ConversationsSection = 'conversations-section',
  PromptsSection = 'prompts-section',
  TopSettings = 'top-settings',
  TopClearСonversation = 'top-clear-conversation',
  TopChatInfo = 'top-chat-info',
  TopChatModelSettings = 'top-chat-model-settings',
  EmptyChatSettings = 'empty-chat-settings',
  Header = 'header',
  Footer = 'footer',
  RequestApiKey = 'request-api-key',
  ReportAnIssue = 'report-an-issue',
  Likes = 'likes',
  ConversationsSharing = 'conversations-sharing',
  PromptsSharing = 'prompts-sharing',
  InputFiles = 'input-files',
  AttachmentsManager = 'attachments-manager',
}

export const availableFeatures: Record<Feature, boolean> = {
  [Feature.ConversationsSection]: true,
  [Feature.PromptsSection]: true,
  [Feature.TopSettings]: true,
  [Feature.TopClearСonversation]: true,
  [Feature.TopChatInfo]: true,
  [Feature.TopChatModelSettings]: true,
  [Feature.EmptyChatSettings]: true,
  [Feature.Header]: true,
  [Feature.Footer]: true,
  [Feature.RequestApiKey]: true,
  [Feature.ReportAnIssue]: true,
  [Feature.Likes]: true,
  [Feature.ConversationsSharing]: true,
  [Feature.PromptsSharing]: true,
  [Feature.InputFiles]: true,
  [Feature.AttachmentsManager]: true,
};
