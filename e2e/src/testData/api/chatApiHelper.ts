import { Conversation } from '@/src/types/chat';

import { API } from '@/e2e/src/testData';
import { BaseApiHelper } from '@/e2e/src/testData/api/baseApiHelper';

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
    console.log('Request body: ' + JSON.stringify(requestData));
    return this.request.post(API.chatHost, {
      data: requestData,
      timeout: 60000,
    });
  }
}
