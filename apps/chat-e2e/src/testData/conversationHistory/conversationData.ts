import { defaultReplay } from '@/chat/constants/replay';
import {
  Conversation,
  Message,
  MessageSettings,
  Role,
  Stage,
} from '@/chat/types/chat';
import { FolderInterface, FolderType } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import {
  ConversationBuilder,
  ExpectedConstants,
  ModelIds,
} from '@/src/testData';
import { FileApiHelper } from '@/src/testData/api';
import { FolderData } from '@/src/testData/folders/folderData';
import { ItemUtil } from '@/src/utils';
import { DateUtil } from '@/src/utils/dateUtil';
import { GeneratorUtil } from '@/src/utils/generatorUtil';

export interface FolderConversation {
  conversations: Conversation[];
  folders: FolderInterface;
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
    let conversationName;
    let conversationId;
    if (name !== undefined) {
      conversationName = name;
      conversationId = `${modelToUse.id}${ItemUtil.conversationIdSeparator}${name}`;
    } else {
      conversationName = GeneratorUtil.randomString(10);
      conversationId = `${modelToUse.id}${ItemUtil.conversationIdSeparator}${conversationName}`;
    }
    return this.conversationBuilder
      .withMessage(userMessage)
      .withMessage(assistantMessage)
      .withModel(modelToUse)
      .withName(conversationName)
      .withId(conversationId)
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

  public prepareDefaultReplayConversation(conversation: Conversation) {
    const userMessages = conversation.messages.filter((m) => m.role === 'user');
    return this.fillReplayData(conversation, userMessages!);
  }

  public preparePartiallyReplayedStagedConversation(
    conversation: Conversation,
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

  public preparePartiallyReplayedConversation(conversation: Conversation) {
    const defaultReplayConversation =
      this.prepareDefaultReplayConversation(conversation);
    const assistantMessages = conversation.messages.find(
      (m) => m.role === 'assistant',
    );
    assistantMessages!.content = 'partial response';
    defaultReplayConversation.messages = conversation.messages;
    return defaultReplayConversation;
  }

  public prepareAddonsConversation(model: DialAIEntityModel, addons: string[]) {
    const conversation = this.prepareDefaultConversation(model);
    conversation.selectedAddons = addons;
    conversation.assistantModelId = model.id;
    const messageSettings: MessageSettings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: addons,
    };
    const userMessage: Message = {
      role: Role.User,
      content: 'what is the temperature in Spain Malaga',
      model: conversation.model,
      settings: messageSettings,
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: 'The temperature is 16.5 degrees Celsius.',
      model: conversation.model,
      custom_content: {
        stages: [
          {
            index: 0,
            name: `addon-xweather({"query": "/weather/summary/Spain, Malaga"})`,
            content:
              '```javascript\nget_summary_weather_summary__location__get({"location": "Spain, Malaga"})\n```\n```json\n{"alerts": [], "conditions": {"dateTimeISO": "2024-03-20T10:30:00+01:00", "tempC": 16.5, "tempF": 61.7, "feelsLikeC": 16.5, "feelsLikeF": 61.7, "windDir": "ESE", "windSpeedMPH": 2.19, "windSpeedKPH": 3.53, "windGustMPH": 11.77, "windGustKPH": 18.94, "precipRateMM": 0.0, "precipRateIN": 0.0, "weather": "Partly Cloudy", "uvi": 2, "aqi": 76, "aqiCategory": "moderate", "aqiDominantPollutant": "pm10"}}\n```\nAs of 10:30 AM on March 20, 2024, the weather in Malaga, Spain is partly cloudy. The temperature is 16.5 degrees Celsius. The wind is coming from the ESE at 3.53 km/h with gusts up to 18.94 km/h. There is no precipitation expected. The UV index is 2. The air quality index (AQI) is 76, which is considered moderate, with PM10 being the dominant pollutant.',
            status: 'completed',
          },
        ],
        state: {
          invocations: [
            {
              index: 0,
              request:
                '{"commands": [{"command": "XWeather", "arguments": {"query": "/weather/summary/Spain, Malaga"}}]}',
              response:
                '{"responses": [{"status": "SUCCESS", "response": "As of 10:30 AM on March 20, 2024, the weather in Malaga, Spain is partly cloudy. The temperature is 16.5 degrees Celsius. The wind is coming from the ESE at 3.53 km/h with gusts up to 18.94 km/h. There is no precipitation expected. The UV index is 2. The air quality index (AQI) is 76, which is considered moderate, with PM10 being the dominant pollutant."}]}',
            },
          ],
        },
      },
      settings: messageSettings,
    };
    conversation.messages = [userMessage, assistantMessage];
    return this.conversationBuilder.build();
  }

  public prepareConversationWithCodeContent(
    model?: string | DialAIEntityModel,
  ) {
    const conversation = this.prepareDefaultConversation(model);
    const messageSettings: MessageSettings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: conversation.selectedAddons,
    };
    const userMessage: Message = {
      role: Role.User,
      content: 'provide an example of interface declaration in Java',
      model: conversation.model,
      settings: messageSettings,
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content:
        'Here is an example of an interface declaration in Java:\n\n```java\npublic interface Animal {\n    void eat();\n    void sleep();\n    void makeSound();\n}\n```\n\nIn this example, `Animal` is an interface that declares three methods: `eat()`, `sleep()`, and `makeSound()`. Any class that implements the `Animal` interface will need to provide implementations for these three methods.',
      model: conversation.model,
      settings: messageSettings,
    };
    conversation.messages = [userMessage, assistantMessage];
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

  public prepareConversationsForNestedFolders(
    nestedFolders: FolderInterface[],
    name?: string,
  ) {
    const nestedConversations: Conversation[] = [];
    for (const item of nestedFolders) {
      const nestedConversation = this.prepareDefaultConversation(
        undefined,
        name,
      );
      nestedConversations.push(nestedConversation);
      nestedConversation.folderId = item.folderId;
      nestedConversation.id = `${item.folderId}/${nestedConversation.id}`;
      this.resetData();
    }
    return nestedConversations;
  }

  public prepareFolderWithConversations(
    conversationsCount: number,
  ): FolderConversation {
    const folder = this.prepareFolder();
    const conversations: Conversation[] = [];
    for (let i = 1; i <= conversationsCount; i++) {
      const conversation = this.prepareDefaultConversation();
      conversation.folderId = folder.folderId;
      conversation.id = `${folder.folderId}/${conversation.id}`;
      conversations.push(conversation);
      this.resetData();
    }
    return { conversations: conversations, folders: folder };
  }

  public prepareConversationsInFolder(
    conversations: Conversation[],
  ): FolderConversation {
    const folder = this.prepareFolder();
    for (const conversation of conversations) {
      conversation.folderId = folder.folderId;
      conversation.id = `${folder.folderId}/${conversation.id}`;
    }
    return { conversations: conversations, folders: folder };
  }

  public prepareDefaultConversationInFolder(
    folderName?: string,
    model?: DialAIEntityModel,
    conversationName?: string,
  ): FolderConversation {
    const conversation = this.prepareDefaultConversation(
      model,
      conversationName,
    );
    const folder = this.prepareFolder(folderName);
    conversation.folderId = folder.folderId;
    conversation.id = `${folder.folderId}/${conversation.id}`;
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
    conversation: Conversation,
    playbackIndex?: number,
  ) {
    const messages = conversation.messages;
    const playbackConversation = JSON.parse(JSON.stringify(conversation));
    playbackConversation.name = `${ExpectedConstants.playbackConversation}${conversation.name}`;
    playbackConversation.id = `playback${ItemUtil.conversationIdSeparator}${playbackConversation.name}`;
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
    const modelToUse = { id: typeof model === 'string' ? model : model.id };
    const userMessage: Message = {
      role: Role.User,
      content: hasRequest ? 'what is on picture?' : '',
      custom_content: {
        attachments: [this.getAttachmentData(attachmentUrl)],
      },
      model: modelToUse,
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: 'Heart',
      model: modelToUse,
    };
    const name = GeneratorUtil.randomString(10);
    return this.conversationBuilder
      .withId(`${modelToUse.id}${ItemUtil.conversationIdSeparator}${name}`)
      .withName(name)
      .withMessage(userMessage)
      .withMessage(assistantMessage)
      .withModel(modelToUse)
      .build();
  }

  public prepareConversationWithAttachmentInResponse(
    attachmentUrl: string,
    model: DialAIEntityModel | string,
  ) {
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
        attachments: [this.getAttachmentData(attachmentUrl)],
      },
    };
    const name = GeneratorUtil.randomString(10);
    return this.conversationBuilder
      .withId(`${modelToUse.id}${ItemUtil.conversationIdSeparator}${name}`)
      .withName(name)
      .withMessage(userMessage)
      .withMessage(assistantMessage)
      .withModel(modelToUse)
      .build();
  }

  public getAttachmentData(attachmentUrl: string) {
    const filename = FileApiHelper.extractFilename(attachmentUrl);
    return {
      type: FileApiHelper.getContentTypeForFile(filename)!,
      title: filename,
      url: attachmentUrl,
    };
  }

  public prepareHistoryConversation(...conversations: Conversation[]) {
    const historyMessages: Message[] = [];
    for (const conversation of conversations) {
      historyMessages.push(...conversation.messages);
    }
    const lastConversation = conversations[conversations.length - 1];
    lastConversation.messages = historyMessages;
    return lastConversation;
  }

  private fillReplayData(
    conversation: Conversation,
    userMessages: Message[],
  ): Conversation {
    const replayConversation = JSON.parse(JSON.stringify(conversation));
    replayConversation.id = `replay${ItemUtil.conversationIdSeparator}${ExpectedConstants.replayConversation}${conversation.name}`;
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
