import { DateUtil } from '@/e2e/src/utils/dateUtil';
import { GeneratorUtil } from '@/e2e/src/utils/generatorUtil';

import { Message } from '@/types/chat';
import { OpenAIEntityModel } from '@/types/openai';

import { ConversationBuilder } from '@/e2e/src/testData';
import { FolderBuilder } from '@/e2e/src/testData/conversationHistory/folderBuilder';

export class ConversationData {
  private conversationBuilder: ConversationBuilder;
  private folderBuilder: FolderBuilder;

  constructor() {
    this.conversationBuilder = new ConversationBuilder();
    this.folderBuilder = new FolderBuilder();
  }

  public resetData() {
    return new ConversationData();
  }

  public prepareDefaultConversation(model?: OpenAIEntityModel) {
    const modelToUse =
      model ?? this.conversationBuilder.getConversation().model;
    const userMessage: Message = {
      role: 'user',
      content: 'test request',
    };
    const assistantMessage: Message = {
      role: 'assistant',
      content: 'test response',
      model: { id: modelToUse.id, name: modelToUse.name },
    };
    return this.conversationBuilder
      .withMessage(userMessage)
      .withMessage(assistantMessage)
      .withModel(modelToUse)
      .withName('test conversation' + GeneratorUtil.randomIntegerNumber())
      .build();
  }

  public prepareDefaultFolder() {
    return this.folderBuilder.build();
  }

  public prepareFolder(name?: string) {
    return this.folderBuilder
      .withName(name ?? GeneratorUtil.randomString(7))
      .build();
  }

  public prepareDefaultConversationInFolder(model?: OpenAIEntityModel) {
    const conversation = this.prepareDefaultConversation(model);
    const folder = this.prepareDefaultFolder();
    conversation.folderId = folder.id;
    return { conversations: conversation, folders: folder };
  }

  public prepareYesterdayConversation(model?: OpenAIEntityModel) {
    const conversation = this.prepareDefaultConversation(model);
    conversation.lastActivityDate = DateUtil.getYesterdayDate();
    return conversation;
  }

  public prepareLastWeekConversation(model?: OpenAIEntityModel) {
    const conversation = this.prepareDefaultConversation(model);
    conversation.lastActivityDate = DateUtil.getLastWeekDate();
    return conversation;
  }

  public prepareLastMonthConversation(model?: OpenAIEntityModel) {
    const conversation = this.prepareDefaultConversation(model);
    conversation.lastActivityDate = DateUtil.getLastMonthDate();
    return conversation;
  }
}
