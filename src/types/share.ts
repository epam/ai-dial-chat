export interface ShareInterface {
  isShared?: boolean;
  sharedWithMe?: boolean;
  isPublished?: boolean;
  publishedWithMe?: boolean;
  shareUniqueId?: string;
  originalId?: string;
  publishVersion?: string;
}

export enum SharingType {
  Conversation = 'conversation',
  ConversationFolder = 'conversations_folder',
  Prompt = 'prompt',
  PromptFolder = 'prompts_folder',
}

export interface PublishRequest {
  id: string;
  shareUniqueId: string;
  name: string;
  path: string;
  version: string;
  fileNameMapping: Map<string, string>;
}
