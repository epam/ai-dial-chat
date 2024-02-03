import { Conversation } from '@/chat/types/chat';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';

export class ChatApiHelper extends BaseApiHelper {
  public async postRequest(conversation: Conversation) {
    const requestData = {
      modelId: conversation.model.id,
      messages: [conversation.messages[0]],
      id: conversation.id,
      temperature: conversation.temperature,
      prompt: conversation.prompt,
      assistantModelId: conversation.assistantModelId,
      selectedAddons: conversation.selectedAddons,
    };
    return this.request.post(API.chatHost, {
      data: requestData,
      timeout: 60000,
    });
  }
}
