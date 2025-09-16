import { Conversation } from '@/chat/types/chat';
import { Prompt } from '@/chat/types/prompt';
import { BucketUtil } from '@/src/utils/bucketUtil';

export class ItemUtil {
  static entityIdSeparator = '__';
  static urlSeparator = '/';

  public static getConversationBucketPath(bucket?: string) {
    return bucket
      ? `conversations/${bucket}`
      : `conversations/${BucketUtil.getBucket()}`;
  }

  public static getPromptBucketPath(bucket?: string) {
    return bucket ? `prompts/${bucket}` : `prompts/${BucketUtil.getBucket()}`;
  }

  public static getApiConversationId(
    conversation: Conversation,
    bucket?: string,
  ) {
    const bucketPath = ItemUtil.getConversationBucketPath(bucket);
    return `${bucketPath}/${conversation.id}`;
  }

  public static getApiPromptId(prompt: Prompt, bucket?: string) {
    const bucketPath = ItemUtil.getPromptBucketPath(bucket);
    return prompt.id.includes(bucketPath)
      ? prompt.id
      : `${bucketPath}/${prompt.id}`;
  }

  public static getApiPromptFolderId(prompt: Prompt, bucket?: string) {
    const promptBucket = ItemUtil.getPromptBucketPath(bucket);
    return prompt.folderId?.length === 0
      ? promptBucket
      : prompt.folderId.includes(promptBucket)
        ? prompt.folderId
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

  // Helper function to extract relative path from URL
  public static extractRelativePath(url: string): string {
    const pathParts = url.split('/');
    let relativePath = '';
    const publicSegmentIndex = pathParts.indexOf('public');

    if (
      publicSegmentIndex !== -1 &&
      publicSegmentIndex < pathParts.length - 2
    ) {
      relativePath =
        pathParts.slice(publicSegmentIndex + 1, -1).join('/') + '/';
    } else if (
      publicSegmentIndex !== -1 &&
      publicSegmentIndex === pathParts.length - 2
    ) {
      relativePath = '';
    }
    return relativePath;
  }
}
