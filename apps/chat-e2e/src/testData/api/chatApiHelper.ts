import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
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
    return {
      id: `conversations/${BucketUtil.getBucket()}/` + conversation.id,
      messages: [userMessage],
      model:
        ModelsUtil.getOpenAIEntity(conversation.model.id) ??
        ({ id: conversation.model.id } as DialAIEntityModel),
      prompt: conversation.prompt,
      ...(conversation.temperature && {
        temperature: conversation.temperature,
      }),
    };
  }

  public async postRequest(conversation: Conversation) {
    const requestData = this.buildRequestData(conversation);
    return this.request.post(API.chatHost, {
      data: requestData,
      timeout: 120000,
    });
  }
}
