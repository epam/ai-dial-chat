import { Conversation } from '@/chat/types/chat';
import { Prompt } from '@/chat/types/prompt';
import { BucketUtil } from '@/src/utils/bucketUtil';

export class ItemUtil {
  static conversationIdSeparator = '__';

  public static getConversationBucketPath() {
    return `conversations/${BucketUtil.getBucket()}`;
  }

  public static getPromptBucketPath() {
    return `prompts/${BucketUtil.getBucket()}`;
  }

  public static getApiConversationId(conversation: Conversation) {
    const bucketPath = ItemUtil.getConversationBucketPath();
    return `${bucketPath}/${conversation.id}`;
  }

  public static getApiPromptId(prompt: Prompt) {
    const bucketPath = ItemUtil.getPromptBucketPath();
    return `${bucketPath}/${prompt.id}`;
  }

  public static getApiPromptFolderId(prompt: Prompt) {
    const promptBucket = ItemUtil.getPromptBucketPath();
    return prompt.folderId?.length === 0
      ? promptBucket
      : `${promptBucket}/${prompt.folderId}`;
  }

  public static getApiConversationFolderId(conversation: Conversation) {
    const conversationBucket = ItemUtil.getConversationBucketPath();
    return conversation.folderId?.length === 0
      ? conversationBucket
      : `${conversationBucket}/${conversation.folderId}`;
  }
}
