import { Conversation } from '@/chat/types/chat';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ModelsUtil } from '@/src/utils';

export class ChatApiHelper extends BaseApiHelper {
  public buildRequestData(conversation: Conversation) {
    let message;
    //check if replay conversation
    if (conversation?.replay?.replayUserMessagesStack) {
      message = conversation.replay.replayUserMessagesStack[0];
    } else {
      message = conversation.messages[0];
    }
    //build user message
    const userMessage =
      message.custom_content !== undefined
        ? {
            role: 'user',
            content: message.content,
            custom_content: message.custom_content,
          }
        : { role: 'user', content: message.content };
    //build common for all entities data
    const commonData = {
      id: `conversations/${BucketUtil.getBucket()}/` + conversation.id,
      messages: [userMessage],
      model: ModelsUtil.getOpenAIEntity(conversation.model.id),
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: conversation.selectedAddons,
    };

    return conversation.assistantModelId
      ? {
          ...commonData,
          assistantModel: ModelsUtil.getOpenAIEntity(
            conversation.assistantModelId,
          ),
        }
      : commonData;
  }

  public async postRequest(conversation: Conversation) {
    const requestData = this.buildRequestData(conversation);
    return this.request.post(API.chatHost, {
      data: requestData,
      timeout: 60000,
    });
  }
}
