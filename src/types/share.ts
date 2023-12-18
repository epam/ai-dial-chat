export interface ShareInterface {
  isShared?: boolean;
  sharedWithMe?: boolean;
  isPublished?: boolean;
  publishedWithMe?: boolean;
  shareUniqueId?: string;
  originalId?: string;
}

export enum SharingType {
  Conversation = 'conversation',
  ConversationFolder = 'conversations_folder',
  Prompt = 'prompt',
  PromptFolder = 'prompts_folder',
}
