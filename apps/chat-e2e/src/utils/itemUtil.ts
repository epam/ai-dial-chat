import { TestConversation, TestPrompt } from '@/src/testData';
import { BucketUtil } from '@/src/utils/bucketUtil';

export class ItemUtil {
  static conversationIdSeparator = '__';

  public static getConversationBucketPath() {
    return `conversations/${BucketUtil.getBucket()}`;
  }

  public static getPromptBucketPath() {
    return `prompts/${BucketUtil.getBucket()}`;
  }

  public static getApiConversationId(
    conversation: TestConversation,
    path = '',
  ) {
    const bucketPath = ItemUtil.getConversationBucketPath();
    const conversationId = `${ItemUtil.conversationIdSeparator}${conversation.name}`;
    if (conversation.replay.isReplay) {
      return path.length === 0
        ? `${bucketPath}/replay${conversationId}`
        : `${bucketPath}/${path}/replay${conversationId}`;
    }
    return path.length === 0
      ? `${bucketPath}/${conversation.model.id}${conversationId}`
      : `${bucketPath}/${path}/${conversation.model.id}${conversationId}`;
  }

  public static getApiPromptId(prompt: TestPrompt, path: string) {
    const bucketPath = ItemUtil.getPromptBucketPath();
    return path.length === 0
      ? `${bucketPath}/${prompt.name}`
      : `${bucketPath}/${path}/${prompt.name}`;
  }

  public static getApiPromptFolderId(path: string) {
    return path.length === 0
      ? ItemUtil.getPromptBucketPath()
      : `${ItemUtil.getPromptBucketPath()}/${path}`;
  }

  public static getApiConversationFolderId(path: string) {
    return path.length === 0
      ? ItemUtil.getConversationBucketPath()
      : `${ItemUtil.getConversationBucketPath()}/${path}`;
  }
}
