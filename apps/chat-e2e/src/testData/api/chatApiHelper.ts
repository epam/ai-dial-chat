import { API, TestConversation } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';

export class ChatApiHelper extends BaseApiHelper {
  public async postRequest(conversation: TestConversation) {
    const requestData = {
      ...conversation,
      messages: [conversation.messages[0]],
      modelId: conversation.model.id,
    };
    return this.request.post(API.chatHost, {
      data: requestData,
      timeout: 60000,
    });
  }
}
