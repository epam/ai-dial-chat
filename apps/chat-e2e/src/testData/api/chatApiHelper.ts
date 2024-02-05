import { Conversation } from '@/chat/types/chat';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';

export class ChatApiHelper extends BaseApiHelper {
  public async postRequest(conversation: Conversation) {
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
