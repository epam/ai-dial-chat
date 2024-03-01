import { defaultReplay } from '@/chat/constants/replay';
import { Message, MessageSettings, Role, Stage } from '@/chat/types/chat';
import { FolderType } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import {
  ConversationBuilder,
  ExpectedConstants,
  MenuOptions,
  ModelIds,
  TestConversation,
  TestFolder,
} from '@/src/testData';
import { FileApiHelper } from '@/src/testData/api';
import { FolderData } from '@/src/testData/folders/folderData';
import { DateUtil } from '@/src/utils/dateUtil';
import { GeneratorUtil } from '@/src/utils/generatorUtil';
import { v4 as uuidv4 } from 'uuid';

export interface FolderConversation {
  conversations: TestConversation[];
  folders: TestFolder;
}

export class ConversationData extends FolderData {
  private conversationBuilder: ConversationBuilder;

  constructor() {
    super(FolderType.Chat);
    this.conversationBuilder = new ConversationBuilder();
  }

  public resetData() {
    this.conversationBuilder = new ConversationBuilder();
    this.resetFolderData();
  }

  public prepareDefaultConversation(
    model?: DialAIEntityModel | string,
    name?: string,
  ) {
    const modelToUse = model
      ? { id: typeof model === 'string' ? model : model.id }
      : this.conversationBuilder.getConversation().model;
    const userMessage: Message = {
      role: Role.User,
      content: 'test request',
      model: { id: modelToUse.id },
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: 'test response',
      model: { id: modelToUse.id },
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
    model?: DialAIEntityModel | string,
  ) {
    const basicConversation = this.prepareDefaultConversation(model);
    const messageSettings: MessageSettings = {
      prompt: sysPrompt,
      temperature: temp,
      selectedAddons: addons,
    };
    basicConversation.messages.forEach(
      (message) => (message.settings = messageSettings),
    );
    this.conversationBuilder.setConversation(basicConversation);
    return this.conversationBuilder
      .withTemperature(temp)
      .withPrompt(sysPrompt)
      .withAddons(addons)
      .build();
  }

  public prepareModelConversationBasedOnRequests(
    model: DialAIEntityModel | string,
    requests: string[],
    name?: string,
  ) {
    const basicConversation = this.prepareEmptyConversation(model, name);
    requests.forEach((r) => {
      basicConversation.messages.push(
        { role: Role.User, content: r },
        {
          role: Role.Assistant,
          content: `response on ${r}`,
          model: {
            id: basicConversation.model.id,
          },
        },
      );
    });
    this.conversationBuilder.setConversation(basicConversation);
    return this.conversationBuilder.build();
  }

  public prepareConversationWithDifferentModels(models: DialAIEntityModel[]) {
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

  public prepareEmptyConversation(
    model?: DialAIEntityModel | string,
    name?: string,
  ) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.messages = [];
    return conversation;
  }

  public prepareErrorResponseConversation(
    model?: DialAIEntityModel,
    name?: string,
  ) {
    const defaultConversation = this.prepareDefaultConversation(model, name);
    defaultConversation.messages.find(
      (m) => m.role === 'assistant',
    )!.errorMessage = ExpectedConstants.answerError;
    return defaultConversation;
  }

  public prepareDefaultReplayConversation(conversation: TestConversation) {
    const userMessages = conversation.messages.filter((m) => m.role === 'user');
    return this.fillReplayData(conversation, userMessages!);
  }

  public preparePartiallyReplayedStagedConversation(
    conversation: TestConversation,
  ) {
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

  public preparePartiallyReplayedConversation(conversation: TestConversation) {
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
    model: DialAIEntityModel,
    addons: string[],
    request?: string,
  ) {
    const conversation = this.conversationBuilder.getConversation();
    conversation.model = { id: model.id };
    conversation.selectedAddons = addons;
    const messageSettings: MessageSettings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: addons,
    };
    const userMessage: Message = {
      role: Role.User,
      content: request ?? 'what is epam? what is epam revenue in 2020?',
      model: { id: conversation.model.id },
      settings: messageSettings,
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content:
        'EPAM is a global provider of software engineering and IT consulting services',
      model: { id: conversation.model.id },
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
      settings: messageSettings,
    };
    conversation.messages.push(userMessage, assistantMessage);
    return this.conversationBuilder.build();
  }

  public prepareAssistantConversation(
    assistant: DialAIEntityModel,
    addons: string[],
    assistantModel?: DialAIEntityModel,
  ) {
    const conversation = this.prepareAddonsConversation(assistant, addons);
    conversation.assistantModelId = assistantModel
      ? assistantModel.id
      : ModelIds.GPT_4;
    conversation.messages.forEach(
      (message) =>
        (message.settings!.assistantModelId = conversation.assistantModelId),
    );
    return conversation;
  }

  public prepareNestedFolder(nestedLevel: number) {
    return super.prepareNestedFolder(nestedLevel, FolderType.Chat);
  }

  public prepareConversationsForNestedFolders(nestedFolders: TestFolder[]) {
    const nestedConversations: TestConversation[] = [];
    for (const item of nestedFolders) {
      const nestedConversation = this.prepareDefaultConversation();
      nestedConversations.push(nestedConversation);
      nestedConversation.folderId = item.id;
      this.resetData();
    }
    return nestedConversations;
  }

  public prepareFolderWithConversations(
    conversationsCount: number,
  ): FolderConversation {
    const folder = this.prepareFolder();
    const conversations: TestConversation[] = [];
    for (let i = 1; i <= conversationsCount; i++) {
      const conversation = this.prepareDefaultConversation();
      conversation.folderId = folder.id;
      conversations.push(conversation);
      this.resetData();
    }
    return { conversations: conversations, folders: folder };
  }

  public prepareDefaultConversationInFolder(
    model?: DialAIEntityModel,
    name?: string,
  ): FolderConversation {
    const conversation = this.prepareDefaultConversation(model, name);
    const folder = this.prepareFolder();
    conversation.folderId = folder.id;
    return { conversations: [conversation], folders: folder };
  }

  public prepareYesterdayConversation(
    model?: DialAIEntityModel,
    name?: string,
  ) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.lastActivityDate = DateUtil.getYesterdayDate();
    return conversation;
  }

  public prepareLastWeekConversation(model?: DialAIEntityModel, name?: string) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.lastActivityDate = DateUtil.getLastWeekDate();
    return conversation;
  }

  public prepareLastMonthConversation(
    model?: DialAIEntityModel,
    name?: string,
  ) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.lastActivityDate = DateUtil.getLastMonthDate();
    return conversation;
  }

  public prepareOlderConversation(model?: DialAIEntityModel, name?: string) {
    const conversation = this.prepareDefaultConversation(model, name);
    conversation.lastActivityDate = DateUtil.getOlderDate();
    return conversation;
  }

  public prepareDefaultPlaybackConversation(
    conversation: TestConversation,
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

  public prepareDefaultSharedConversation() {
    const conversation = this.prepareDefaultConversation();
    conversation.isShared = true;
    return conversation;
  }

  public prepareConversationWithAttachmentInRequest(
    attachmentUrl: string,
    model: DialAIEntityModel | string,
    hasRequest?: boolean,
  ) {
    const filename = FileApiHelper.extractFilename(attachmentUrl);
    const modelToUse = { id: typeof model === 'string' ? model : model.id };
    const userMessage: Message = {
      role: Role.User,
      content: hasRequest ? 'what is on picture?' : '',
      custom_content: {
        attachments: [
          {
            type: FileApiHelper.getContentTypeForFile(filename)!,
            title: filename,
            url: attachmentUrl,
          },
        ],
      },
      model: modelToUse,
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: 'Heart',
      model: modelToUse,
    };
    return this.conversationBuilder
      .withName(GeneratorUtil.randomString(10))
      .withMessage(userMessage)
      .withMessage(assistantMessage)
      .withModel(modelToUse)
      .build();
  }

  public prepareConversationWithAttachmentInResponse(
    attachmentUrl: string,
    model: DialAIEntityModel | string,
  ) {
    const filename = FileApiHelper.extractFilename(attachmentUrl);
    const modelToUse = { id: typeof model === 'string' ? model : model.id };
    const userMessage: Message = {
      role: Role.User,
      content: 'draw smiling emoticon',
      model: modelToUse,
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: '',
      model: modelToUse,
      custom_content: {
        attachments: [
          {
            type: FileApiHelper.getContentTypeForFile(filename)!,
            title: filename,
            url: attachmentUrl,
          },
        ],
      },
    };
    return this.conversationBuilder
      .withName(GeneratorUtil.randomString(10))
      .withMessage(userMessage)
      .withMessage(assistantMessage)
      .withModel(modelToUse)
      .build();
  }

  public prepareHistoryConversation(...conversations: TestConversation[]) {
    const historyMessages: Message[] = [];
    for (const conversation of conversations) {
      historyMessages.push(...conversation.messages);
    }
    const lastConversation = conversations[conversations.length - 1];
    lastConversation.messages = historyMessages;
    return lastConversation;
  }

  private fillReplayData(
    conversation: TestConversation,
    userMessages: Message[],
  ): TestConversation {
    const replayConversation = JSON.parse(JSON.stringify(conversation));
    replayConversation.id = uuidv4();
    replayConversation.name = `${ExpectedConstants.replayConversation}${conversation.name}`;
    replayConversation.messages = [];
    if (!replayConversation.replay) {
      replayConversation.replay = defaultReplay;
    }
    replayConversation.replay.isReplay = true;
    replayConversation.replay.activeReplayIndex = 0;
    if (!replayConversation.replay.replayUserMessagesStack) {
      replayConversation.replay.replayUserMessagesStack = [];
    }
    replayConversation.replay.replayUserMessagesStack.push(...userMessages);
    replayConversation.replay.replayAsIs = true;
    return replayConversation;
  }
}
