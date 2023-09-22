import { DateUtil } from '@/e2e/src/utils/dateUtil';
import { GeneratorUtil } from '@/e2e/src/utils/generatorUtil';

import { Conversation, Message } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { OpenAIEntityAddonID, OpenAIEntityModel } from '@/src/types/openai';

import { ConversationBuilder, ExpectedConstants } from '@/e2e/src/testData';
import { FolderBuilder } from '@/e2e/src/testData/conversationHistory/folderBuilder';
import { v4 as uuidv4 } from 'uuid';

export interface FolderConversation {
  conversations: Conversation;
  folders: FolderInterface;
}

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

  public prepareDefaultConversation(model?: OpenAIEntityModel, name?: string) {
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
      .withName(
        name ?? 'test conversation' + GeneratorUtil.randomIntegerNumber(),
      )
      .build();
  }

  public prepareModelConversation(
    temp: number,
    sysPrompt: string,
    addons: string[],
    model?: OpenAIEntityModel,
  ) {
    const basicConversation = this.prepareDefaultConversation(model);
    this.conversationBuilder.setConversation(basicConversation);
    return this.conversationBuilder
      .withTemperature(temp)
      .withPrompt(sysPrompt)
      .withAddons(addons)
      .build();
  }

  public prepareModelConversationBasedOnRequest(
    request: string,
    model?: OpenAIEntityModel,
  ) {
    const basicConversation = this.prepareDefaultConversation(model);
    basicConversation.messages.push(
      { role: 'user', content: request },
      {
        role: 'assistant',
        content: `response on ${request}`,
        model: { id: basicConversation.id, name: basicConversation.name },
      },
    );
    this.conversationBuilder.setConversation(basicConversation);
    return this.conversationBuilder.build();
  }

  public prepareDefaultReplyConversation(conversation: Conversation) {
    const userMessages = conversation.messages.filter((m) => m.role === 'user');
    const replayConversation = JSON.parse(JSON.stringify(conversation));
    replayConversation.id = uuidv4();
    replayConversation.name = `${ExpectedConstants.replayConversation}${conversation.name}`;
    replayConversation.messages = [];
    replayConversation.replay.isReplay = true;
    replayConversation.replay.activeReplayIndex = 0;
    replayConversation.replay.replayUserMessagesStack = userMessages;
    return replayConversation;
  }

  public prepareAddonsConversation(
    model: OpenAIEntityModel,
    ...addons: OpenAIEntityAddonID[]
  ) {
    const conversation = this.conversationBuilder.getConversation();
    conversation.model = model;
    conversation.selectedAddons = addons;
    const userMessage: Message = {
      role: 'user',
      content: 'what is epam? what is epam revenue in 2020?',
    };
    const assistantMessage: Message = {
      role: 'assistant',
      content:
        'EPAM is a global provider of software engineering and IT consulting services',
      model: { id: conversation.model.id, name: conversation.model.name },
      custom_content: {
        stages: [
          {
            index: 0,
            name: 'stage 1',
            content: 'stage content 1',
            status: 'completed',
          },
          {
            index: 1,
            name: 'stage 2',
            content: 'stage content 2',
            status: 'completed',
          },
        ],
        state: {
          invocations: [{ id: 0, request: 'request', response: 'response' }],
        },
      },
    };
    conversation.messages.push(userMessage, assistantMessage);
    return this.conversationBuilder.build();
  }

  public prepareDefaultFolder() {
    return this.folderBuilder.build();
  }

  public prepareFolder(name?: string) {
    return this.folderBuilder
      .withName(name ?? GeneratorUtil.randomString(7))
      .build();
  }

  public prepareDefaultConversationInFolder(
    model?: OpenAIEntityModel,
    name?: string,
  ): FolderConversation {
    const conversation = this.prepareDefaultConversation(model, name);
    const folder = this.prepareDefaultFolder();
    conversation.folderId = folder.id;
    return { conversations: conversation, folders: folder };
  }

  public prepareYesterdayConversation(
    model?: OpenAIEntityModel,
    name?: string,
  ) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.lastActivityDate = DateUtil.getYesterdayDate();
    return conversation;
  }

  public prepareLastWeekConversation(model?: OpenAIEntityModel, name?: string) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.lastActivityDate = DateUtil.getLastWeekDate();
    return conversation;
  }

  public prepareLastMonthConversation(
    model?: OpenAIEntityModel,
    name?: string,
  ) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.lastActivityDate = DateUtil.getLastMonthDate();
    return conversation;
  }
}
