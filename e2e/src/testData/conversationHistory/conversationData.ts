import { DateUtil } from '@/e2e/src/utils/dateUtil';
import { GeneratorUtil } from '@/e2e/src/utils/generatorUtil';

import { Conversation, Message, Stage } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { OpenAIEntityModel } from '@/src/types/openai';

import {
  ConversationBuilder,
  ExpectedConstants,
  MenuOptions,
  ModelIds,
} from '@/e2e/src/testData';
import { FolderData } from '@/e2e/src/testData/folders/folderData';
import { v4 as uuidv4 } from 'uuid';

export interface FolderConversation {
  conversations: Conversation[];
  folders: FolderInterface;
}

export class ConversationData extends FolderData {
  private conversationBuilder: ConversationBuilder;

  constructor() {
    super('chat');
    this.conversationBuilder = new ConversationBuilder();
  }

  public resetData() {
    this.conversationBuilder = new ConversationBuilder();
    this.resetFolderData();
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
      .withName(name ?? GeneratorUtil.randomString(10))
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

  public prepareModelConversationBasedOnRequests(
    model: OpenAIEntityModel,
    requests: string[],
    name?: string,
  ) {
    const basicConversation = this.prepareEmptyConversation(model, name);
    requests.forEach((r) => {
      basicConversation.messages.push(
        { role: 'user', content: r },
        {
          role: 'assistant',
          content: `response on ${r}`,
          model: {
            id: basicConversation.model.id,
            name: basicConversation.model.name,
          },
        },
      );
    });
    this.conversationBuilder.setConversation(basicConversation);
    return this.conversationBuilder.build();
  }

  public prepareConversationWithDifferentModels(models: OpenAIEntityModel[]) {
    const requests: string[] = new Array(models.length);
    for (let i = 0; i < requests.length; i++) {
      requests[i] = `${i} + ${i + 1} =`;
    }
    const basicConversation = this.prepareModelConversationBasedOnRequests(
      models[models.length - 1],
      requests,
    );
    const messages = basicConversation.messages;
    for (let i = 0; i < models.length; i++) {
      messages[i * 2].model = models[i];
      messages[i * 2 + 1].model = models[i];
    }
    this.conversationBuilder.setConversation(basicConversation);
    return this.conversationBuilder.build();
  }

  public prepareEmptyConversation(model?: OpenAIEntityModel, name?: string) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.messages = [];
    return conversation;
  }

  public prepareDefaultReplayConversation(conversation: Conversation) {
    const userMessages = conversation.messages.filter((m) => m.role === 'user');
    return this.fillReplayData(conversation, userMessages!);
  }

  public preparePartiallyReplayedConversation(conversation: Conversation) {
    const userMessages = conversation.messages.filter((m) => m.role === 'user');
    const assistantMessage = conversation.messages.filter(
      (m) => m.role === 'assistant',
    )[0];
    const partialStage: Stage[] = [assistantMessage.custom_content!.stages![0]];
    const partialAssistantResponse: Message = {
      content: '',
      role: assistantMessage.role,
      model: assistantMessage.model,
      custom_content: { stages: partialStage },
    };
    const replayConversation = this.fillReplayData(conversation, userMessages!);
    replayConversation.messages.push(
      ...userMessages!,
      partialAssistantResponse,
    );
    return replayConversation;
  }

  public preparePartiallyRepliedConversation(conversation: Conversation) {
    const defaultReplayConversation =
      this.prepareDefaultReplayConversation(conversation);
    const assistantMessages = conversation.messages.find(
      (m) => m.role === 'assistant',
    );
    assistantMessages!.content = 'partial response';
    defaultReplayConversation.messages = conversation.messages;
    return defaultReplayConversation;
  }

  public prepareAddonsConversation(
    model: OpenAIEntityModel,
    addons: string[],
    request?: string,
  ) {
    const conversation = this.conversationBuilder.getConversation();
    conversation.model = model;
    conversation.selectedAddons = addons;
    const userMessage: Message = {
      role: 'user',
      content: request ?? 'what is epam? what is epam revenue in 2020?',
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
            name: `stage 1("what is epam?")`,
            content: 'stage content 1',
            status: 'completed',
          },
          {
            index: 1,
            name: `stage 2("what is epam revenue in 2020?")`,
            content: 'stage content 2',
            status: 'completed',
          },
        ],
        state: {
          invocations: [{ index: 0, request: 'request', response: 'response' }],
        },
      },
    };
    conversation.messages.push(userMessage, assistantMessage);
    return this.conversationBuilder.build();
  }

  public prepareAssistantConversation(
    assistant: OpenAIEntityModel,
    addons: string[],
    assistantModel?: OpenAIEntityModel,
  ) {
    const conversation = this.prepareAddonsConversation(assistant, addons);
    conversation.assistantModelId = assistantModel
      ? assistantModel.id
      : ModelIds.GPT_4;
    return conversation;
  }

  public prepareNestedFolder(nestedLevel: number) {
    return super.prepareNestedFolder(nestedLevel, 'chat');
  }

  public prepareFolderWithConversations(conversationsCount: number) {
    const folder = this.prepareFolder();
    const conversations: Conversation[] = [];
    for (let i = 1; i <= conversationsCount; i++) {
      const conversation = this.prepareDefaultConversation();
      conversation.folderId = folder.id;
      conversations.push(conversation);
      this.resetData();
    }
    return { conversations: conversations, folders: folder };
  }

  public prepareDefaultConversationInFolder(
    model?: OpenAIEntityModel,
    name?: string,
  ): FolderConversation {
    const conversation = this.prepareDefaultConversation(model, name);
    const folder = this.prepareDefaultFolder();
    conversation.folderId = folder.id;
    return { conversations: [conversation], folders: folder };
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

  public prepareOlderConversation(model?: OpenAIEntityModel, name?: string) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.lastActivityDate = DateUtil.getOlderDate();
    return conversation;
  }

  public prepareDefaultPlaybackConversation(
    conversation: Conversation,
    playbackIndex?: number,
  ) {
    const messages = conversation.messages;
    const playbackConversation = JSON.parse(JSON.stringify(conversation));
    playbackConversation.id = uuidv4();
    playbackConversation.name = `[${MenuOptions.playback}] ${conversation.name}`;
    playbackConversation.messages = [];
    if (playbackIndex) {
      for (let i = 0; i < playbackIndex; i++) {
        playbackConversation.messages.push(messages[i]);
      }
    }
    playbackConversation.playback = {
      isPlayback: true,
      activePlaybackIndex: playbackIndex ?? 0,
      messagesStack: messages,
    };
    return playbackConversation;
  }

  private fillReplayData(
    conversation: Conversation,
    userMessages: Message[],
  ): Conversation {
    const replayConversation = JSON.parse(JSON.stringify(conversation));
    replayConversation.id = uuidv4();
    replayConversation.name = `${ExpectedConstants.replayConversation}${conversation.name}`;
    replayConversation.messages = [];
    replayConversation.replay.isReplay = true;
    replayConversation.replay.activeReplayIndex = 0;
    replayConversation.replay.replayUserMessagesStack.push(...userMessages);
    replayConversation.replay.replayAsIs = true;
    return replayConversation;
  }
}
