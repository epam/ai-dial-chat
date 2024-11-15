import { Conversation } from '@/chat/types/chat';
import { FolderInterface, FolderType } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import { Prompt } from '@/chat/types/prompt';
import { ConversationBuilder, ExpectedConstants } from '@/src/testData';
import { FileApiHelper } from '@/src/testData/api';
import { FolderData } from '@/src/testData/folders/folderData';
import { ItemUtil } from '@/src/utils';
import { DateUtil } from '@/src/utils/dateUtil';
import { GeneratorUtil } from '@/src/utils/generatorUtil';
import { Message, MessageSettings, Role, Stage } from '@epam/ai-dial-shared';

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
    const conversation = this.conversationBuilder.getConversation();
    const modelToUse = model
      ? { id: typeof model === 'string' ? model : model.id }
      : conversation.model;
    const settings: MessageSettings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: conversation.selectedAddons,
    };
    const userMessage: Message = {
      role: Role.User,
      content: 'test request',
      model: { id: modelToUse.id },
      settings: settings,
      templateMapping: {},
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: 'test response',
      model: { id: modelToUse.id },
      settings: settings,
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
    const messageModel = {
      id: basicConversation.model.id,
    };
    const conversation = this.conversationBuilder.getConversation();
    const settings: MessageSettings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: conversation.selectedAddons,
    };
    requests.forEach((r) => {
      basicConversation.messages.push(
        {
          role: Role.User,
          content: r,
          model: messageModel,
          settings: settings,
        },
        {
          role: Role.Assistant,
          content: `response on ${r}`,
          model: messageModel,
          settings: settings,
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

  public prepareConversationBasedOnPrompt(
    prompt: Prompt,
    params?: Map<string, string>,
    model?: DialAIEntityModel | string,
    name?: string,
  ) {
    let promptContent = prompt.content!;
    const paramRegex = (param: string) =>
      new RegExp('\\{\\{' + `(${param}.*?)` + '\\}\\}');
    const defaultParamValueRegex = '(?<=\\|)(.*?)(?=\\}})';
    //set prompt parameters with values from params map
    if (params !== undefined) {
      for (const [key, value] of params) {
        const regex = paramRegex(key);
        const matchedParam = promptContent.match(regex);
        if (matchedParam) {
          promptContent = promptContent.replace(matchedParam[0], value);
        }
      }
    }
    //set default prompt parameters if absent in params map
    const matchedDefaultValue = promptContent.match(defaultParamValueRegex);
    if (matchedDefaultValue) {
      promptContent = promptContent.replace(
        paramRegex(''),
        matchedDefaultValue[0],
      );
    }
    const conversation = this.prepareDefaultConversation(model, name);
    const userMessages = conversation.messages.filter((m) => m.role === 'user');

    userMessages.forEach((m) => {
      (m.templateMapping! as Record<string, string>)[promptContent] =
        prompt.content!;
      m.content = promptContent;
    });
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

  public preparePartiallyReplayedConversation(
    conversation: Conversation,
    activeReplayIndex?: number,
    updatedModel?: DialAIEntityModel,
  ) {
    const defaultReplayConversation = this.prepareDefaultReplayConversation(
      conversation,
      activeReplayIndex,
    );
    const conversationMessagesCopy = JSON.parse(
      JSON.stringify(conversation.messages),
    ) as Message[];
    //activeReplayIndex=0 corresponds to the 1st request/response pair, activeReplayIndex=1 corresponds to the 2nd one, and so on. Therefore, in case of partial response the index of assistant message is calculated as [activeReplayIndex + 2]
    //if activeReplayIndex is not defined, the latest assistant response is considered as partial
    const partialAssistantMessage = activeReplayIndex
      ? conversationMessagesCopy[activeReplayIndex + 2]
      : conversationMessagesCopy.findLast((m) => m.role === 'assistant');
    //set partial assistant response
    partialAssistantMessage!.content = 'partial response';
    partialAssistantMessage!.custom_content = {};
    //set partially replayed messages
    defaultReplayConversation.messages = conversationMessagesCopy.slice(
      0,
      conversationMessagesCopy.indexOf(partialAssistantMessage!) + 1,
    );
    //update conversation model if replay with a new one
    if (updatedModel) {
      defaultReplayConversation.model.id = updatedModel.id;
      defaultReplayConversation.messages.forEach(
        (m) => (m.model!.id = updatedModel.id),
      );
      defaultReplayConversation.replay!.replayAsIs = false;
      defaultReplayConversation.selectedAddons = [];
    }
    defaultReplayConversation.messages
      .filter((m) => m.role === 'user')
      .forEach((m) => (m.templateMapping = {}));
    defaultReplayConversation.replay?.replayUserMessagesStack?.forEach(
      (m) => (m.templateMapping = {}),
    );
    return defaultReplayConversation;
  }

  public prepareAddonsConversation(
    model: DialAIEntityModel | string,
    addons: string[],
    request?: string,
  ) {
    const conversation = this.prepareDefaultConversation(model);
    conversation.selectedAddons = addons;
    conversation.assistantModelId = conversation.model.id;
    const messageSettings: MessageSettings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: addons,
    };
    const userMessage: Message = {
      role: Role.User,
      content: request ?? 'what is the temperature in Spain Malaga',
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
              '```javascript\nget_summary_weather_summary__location__get({"location": "Spain, Malaga"})\n```\n```json\n{"alerts": [], "conditions": {"dateTimeISO": "2024-03-20T10:30:00+01:00", "tempC": 16.5, "tempF": 61.7, "feelsLikeC": 16.5, "feelsLikeF": 61.7, "windDir": "ESE", "windSpeedMPH": 2.19, "windSpeedKPH": 3.53, "windGustMPH": 11.77, "windGustKPH": 18.94, "precipRateMM": 0.0, "precipRateIN": 0.0, "weather": "Partly Cloudy", "uvi": 2, "aqi": 76, "aqiCategory": "moderate", "aqiDominantPollutant": "pm10"}}\n```\nAs of 10:30 AM on March 20, 2024, the weather in Malaga, Spain is partly cloudy. The temperature is 16.5 degrees Celsius. The wind is coming from the ESE at 3.53 km/h with gusts up to 18.94 km/h. There is no precipitation expected. The UV index is 2. The air quality index (AQI) is 76, which is considered moderate, with PM10 being the dominant pollutant. he average weather in Spain varies depending on the region and the time of year. Overall, Spain has a Mediterranean climate with hot, dry summers and mild, rainy winters. Here is a breakdown of the average weather in different parts of the country',
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

  public prepareConversationWithTextContent(
    responseContent: string,
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
      content: 'request',
      model: conversation.model,
      settings: messageSettings,
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: responseContent,
      model: conversation.model,
      settings: messageSettings,
    };
    conversation.messages = [userMessage, assistantMessage];
    return this.conversationBuilder.build();
  }

  public prepareConversationWithCodeContent(
    model?: string | DialAIEntityModel,
  ) {
    const responseContent =
      'Here is an example of an interface declaration in Java:\n\n```java\npublic interface Animal {\n    void eat();\n    void sleep();\n    void makeSound();\n}\n```\n\nIn this example, `Animal` is an interface that declares three methods: `eat()`, `sleep()`, and `makeSound()`. Any class that implements the `Animal` interface will need to provide implementations for these three methods.';
    return this.prepareConversationWithTextContent(responseContent, model);
  }

  public prepareConversationWithMdTableContent(
    model?: string | DialAIEntityModel,
  ) {
    const responseContent =
      '| Country        | Capital    |\n| ------------- |-------------|\n| Canada      | Ottawa |\n| United States      | Washington, D.C. |\n';
    return this.prepareConversationWithTextContent(responseContent, model);
  }

  public prepareAssistantConversation(
    assistant: DialAIEntityModel | string,
    addons: string[],
    assistantModel: DialAIEntityModel | string,
    request?: string,
  ) {
    const conversation = this.prepareAddonsConversation(
      assistant,
      addons,
      request,
    );
    conversation.assistantModelId =
      typeof assistantModel === 'string' ? assistantModel : assistantModel.id;
    conversation.messages.forEach(
      (message) =>
        (message.settings!.assistantModelId = conversation.assistantModelId),
    );
    return conversation;
  }

  public prepareNestedFolder(
    nestedLevel: number,
    folderNames?: Record<number, string>,
  ) {
    return super.prepareNestedFolder(nestedLevel, FolderType.Chat, folderNames);
  }

  public prepareConversationsForNestedFolders(
    nestedFolders: FolderInterface[],
    conversationNames?: Record<number, string>,
  ) {
    const nestedConversations: Conversation[] = [];
    for (let i = 0; i < nestedFolders.length; i++) {
      const nestedConversation = this.prepareDefaultConversation(
        undefined,
        conversationNames ? conversationNames[i + 1] : undefined,
      );
      nestedConversations.push(nestedConversation);
      nestedConversation.folderId = nestedFolders[i].id;
      nestedConversation.id = `${nestedFolders[i].id}/${nestedConversation.id}`;
      this.resetData();
    }
    return nestedConversations;
  }

  public prepareFolderWithConversations(
    conversationsCount: number,
    name?: string,
  ): FolderConversation {
    const folder = this.prepareFolder(name);
    const conversations: Conversation[] = [];
    for (let i = 1; i <= conversationsCount; i++) {
      const conversation = this.prepareDefaultConversation();
      conversation.folderId = folder.id;
      conversation.id = `${folder.id}/${conversation.id}`;
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
      conversation.folderId = folder.id;
      conversation.id = `${folder.id}/${conversation.id}`;
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
    conversation.folderId = folder.id;
    conversation.id = `${folder.id}/${conversation.id}`;
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

  public prepareHistoryConversationWithAttachmentsInRequest(
    conversations: Record<
      number,
      {
        model: DialAIEntityModel | string;
        hasRequest?: boolean;
        attachmentUrl: string[];
      }
    >,
  ) {
    const historyConversations: Conversation[] = [];
    for (const index in conversations) {
      const conversationData = conversations[index];
      const conversation = this.prepareConversationWithAttachmentsInRequest(
        conversationData.model,
        conversationData.hasRequest,
        ...conversationData.attachmentUrl,
      );
      historyConversations.push(conversation);
      this.resetData();
    }
    return this.prepareHistoryConversation(...historyConversations);
  }

  public prepareConversationWithAttachmentsInRequest(
    model: DialAIEntityModel | string,
    hasRequest?: boolean | string,
    ...attachmentUrl: string[]
  ) {
    const modelToUse = { id: typeof model === 'string' ? model : model.id };
    const attachments = attachmentUrl.map((url) => this.getAttachmentData(url));
    const conversation = this.conversationBuilder.getConversation();
    const settings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: conversation.selectedAddons,
    };
    const userMessage: Message = {
      role: Role.User,
      content: hasRequest
        ? typeof hasRequest === 'string'
          ? hasRequest
          : 'what is on picture?'
        : '',
      custom_content: {
        attachments: attachments,
      },
      model: modelToUse,
      settings: settings,
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: 'Images',
      model: modelToUse,
      settings: settings,
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

  public prepareHistoryConversationWithAttachmentsInResponse(
    conversations: Record<
      number,
      {
        model: DialAIEntityModel | string;
        attachmentUrl: string;
      }
    >,
  ) {
    const historyConversations: Conversation[] = [];
    for (const index in conversations) {
      const conversationData = conversations[index];
      const conversation = this.prepareConversationWithAttachmentInResponse(
        conversationData.attachmentUrl,
        conversationData.model,
      );
      historyConversations.push(conversation);
      this.resetData();
    }
    return this.prepareHistoryConversation(...historyConversations);
  }

  public prepareConversationWithAttachmentInResponse(
    attachmentUrl: string,
    model: DialAIEntityModel | string,
    folderName?: string,
  ) {
    const modelToUse = { id: typeof model === 'string' ? model : model.id };
    const conversation = this.conversationBuilder.getConversation();
    const settings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: conversation.selectedAddons,
    };
    const userMessage: Message = {
      role: Role.User,
      content: 'draw smiling emoticon',
      model: modelToUse,
      settings: settings,
    };
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: '',
      model: modelToUse,
      custom_content: {
        attachments: [this.getAttachmentData(attachmentUrl)],
      },
      settings: settings,
    };
    const name = GeneratorUtil.randomString(10);

    let conversationBuilder = this.conversationBuilder
      .withName(name)
      .withMessage(userMessage)
      .withMessage(assistantMessage)
      .withModel(modelToUse);

    let conversationId = `${modelToUse.id}${ItemUtil.conversationIdSeparator}${name}`;

    if (folderName !== undefined) {
      const folder = this.prepareFolder(folderName);
      conversationId = `${folder.id}/${conversationId}`;
      conversationBuilder = conversationBuilder.withFolderId(folder.id);
    }
    return conversationBuilder.withId(conversationId).build();
  }

  public prepareConversationWithAttachmentLinkInRequest(
    model: DialAIEntityModel | string,
    ...attachmentLink: string[]
  ) {
    const modelToUse = { id: typeof model === 'string' ? model : model.id };
    const userAttachments = attachmentLink.map((link) =>
      this.getAttachmentLinkRequestData(link),
    );
    const conversation = this.conversationBuilder.getConversation();
    const settings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: conversation.selectedAddons,
    };
    const userMessage: Message = {
      role: Role.User,
      content: 'what is company legal name?',
      custom_content: {
        attachments: userAttachments,
      },
      model: modelToUse,
      settings: settings,
    };

    const assistantAttachments = [];
    for (let i = 0; i < attachmentLink.length; i++) {
      assistantAttachments.push(
        this.getAttachmentLinkResponseData(attachmentLink[i], i),
      );
    }
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: `The company's legal name is EPAM[1].`,
      custom_content: {
        attachments: assistantAttachments,
      },
      model: modelToUse,
      settings: settings,
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

  public prepareConversationWithStagesInResponse(
    model: DialAIEntityModel | string,
    stagesCount: number,
  ) {
    const modelToUse = { id: typeof model === 'string' ? model : model.id };
    const conversation = this.conversationBuilder.getConversation();
    const settings = {
      prompt: conversation.prompt,
      temperature: conversation.temperature,
      selectedAddons: conversation.selectedAddons,
    };
    const userMessage: Message = {
      role: Role.User,
      content: 'stages request',
      model: modelToUse,
      settings: settings,
    };

    const stages: Stage[] = [];
    for (let i = 0; i < stagesCount; i++) {
      const stage: Stage = {
        index: i,
        name: `stage ${i}`,
        status: 'completed',
        content:
          '```javascript\nget_summary_weather_summary__location__get({"location": "Spain, Malaga"})\n```\n```json\n{"alerts": [], "conditions": {"dateTimeISO": "2024-03-20T10:30:00+01:00", "tempC": 16.5, "tempF": 61.7, "feelsLikeC": 16.5, "feelsLikeF": 61.7, "windDir": "ESE", "windSpeedMPH": 2.19, "windSpeedKPH": 3.53, "windGustMPH": 11.77, "windGustKPH": 18.94, "precipRateMM": 0.0, "precipRateIN": 0.0, "weather": "Partly Cloudy", "uvi": 2, "aqi": 76, "aqiCategory": "moderate", "aqiDominantPollutant": "pm10"}}\n```\nAs of 10:30 AM on March 20, 2024, the weather in Malaga, Spain is partly cloudy. The temperature is 16.5 degrees Celsius. The wind is coming from the ESE at 3.53 km/h with gusts up to 18.94 km/h. There is no precipitation expected. The UV index is 2. The air quality index (AQI) is 76, which is considered moderate, with PM10 being the dominant pollutant. he average weather in Spain varies depending on the region and the time of year. Overall, Spain has a Mediterranean climate with hot, dry summers and mild, rainy winters. Here is a breakdown of the average weather in different parts of the country',
      };
      stages.push(stage);
    }
    const assistantMessage: Message = {
      role: Role.Assistant,
      content: 'response with stages',
      model: modelToUse,
      custom_content: {
        stages: stages,
      },
      settings: settings,
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
    const title = FileApiHelper.extractFilename(attachmentUrl);
    const encodedSpecialCharsImageUrl =
      ItemUtil.getEncodedItemId(attachmentUrl);
    return {
      type: FileApiHelper.getContentTypeForFile(title)!,
      title: title,
      url: encodedSpecialCharsImageUrl,
    };
  }

  public getAttachmentLinkRequestData(link: string) {
    return {
      type: '*/*',
      title: link.substring(link.indexOf('.'), link.lastIndexOf('.')),
      url: link,
      reference_url: link,
    };
  }

  public getAttachmentLinkResponseData(link: string, index: number) {
    return {
      index: index,
      type: 'text/markdown',
      title: `[${index}] '${link}'`,
      data: 'line1\n\nline2\n\nline3\n\n\n\n    \n    \n    \n\n\n\n\n\n\n    \n    \n    \nline4',
      reference_url: link,
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

  public prepareDefaultReplayConversation(
    conversation: Conversation,
    activeReplayIndex?: number,
  ): Conversation {
    if (
      activeReplayIndex &&
      (activeReplayIndex < 0 ||
        activeReplayIndex > conversation.messages.length / 2 - 1)
    ) {
      throw new Error(
        'Invalid activeReplayIndex error: the value should range from 0 to one less than the total number of request/response pairs',
      );
    }
    const replayConversation = JSON.parse(
      JSON.stringify(conversation),
    ) as Conversation;
    const replayUserMessages = JSON.parse(
      JSON.stringify(conversation.messages.filter((m) => m.role === 'user')),
    ) as Message[];
    replayConversation.id = `replay${ItemUtil.conversationIdSeparator}${ExpectedConstants.replayConversation}${conversation.name}`;
    replayConversation.name = `${ExpectedConstants.replayConversation}${conversation.name}`;
    replayConversation.messages = [];
    replayConversation.replay = {
      isReplay: true,
    };
    replayConversation.replay.activeReplayIndex =
      activeReplayIndex ?? replayUserMessages.length - 1;
    if (!replayConversation.replay.replayUserMessagesStack) {
      replayConversation.replay.replayUserMessagesStack = [];
    }
    replayConversation.replay.replayUserMessagesStack.push(
      ...replayUserMessages,
    );
    replayConversation.replay.replayAsIs = true;
    return replayConversation;
  }
}
