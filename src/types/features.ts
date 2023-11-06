export type Feature =
  | 'conversations-section'
  | 'prompts-section'
  | 'top-settings'
  | 'top-clear-conversation'
  | 'top-chat-info'
  | 'top-chat-model-settings'
  | 'empty-chat-settings'
  | 'header'
  | 'footer'
  | 'request-api-key'
  | 'report-an-issue'
  | 'likes';

export const availableFeatures: Record<Feature, boolean> = {
  'conversations-section': true,
  'prompts-section': true,
  'top-settings': true,
  'top-clear-conversation': true,
  'top-chat-info': true,
  'top-chat-model-settings': true,
  'empty-chat-settings': true,
  header: true,
  footer: true,
  'request-api-key': true,
  'report-an-issue': true,
  likes: true,
};
