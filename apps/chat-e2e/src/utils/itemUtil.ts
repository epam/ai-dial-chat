import { Conversation } from '@/chat/types/chat';
import { Prompt } from '@/chat/types/prompt';
import { BucketUtil } from '@/src/utils/bucketUtil';

export class ItemUtil {
  static conversationIdSeparator = '__';
  static urlSeparator = '/';

  public static getConversationBucketPath(bucket?: string) {
    return bucket
      ? `conversations/${bucket}`
      : `conversations/${BucketUtil.getBucket()}`;
  }

  public static getPromptBucketPath() {
    return `prompts/${BucketUtil.getBucket()}`;
  }

  public static getApiConversationId(
    conversation: Conversation,
    bucket?: string,
  ) {
    const bucketPath = ItemUtil.getConversationBucketPath(bucket);
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

  public static getApiConversationFolderId(
    conversation: Conversation,
    bucket?: string,
  ) {
    const conversationBucket = ItemUtil.getConversationBucketPath(bucket);
    return conversation.folderId?.length === 0
      ? conversationBucket
      : `${conversationBucket}/${conversation.folderId}`;
  }

  public static getEncodedItemId(itemId: string) {
    const encodedItemId = itemId
      .split(ItemUtil.urlSeparator)
      .map((f) => encodeURIComponent(f))
      .join(ItemUtil.urlSeparator);
    return itemId.replace(itemId, encodedItemId);
  }
}
