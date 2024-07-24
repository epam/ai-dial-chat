import { ChatBody, Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  Import,
  MenuOptions,
  MockedChatApiResponseBodies,
  ModelIds,
} from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let allModels: DialAIEntityModel[];
let gpt35Model: DialAIEntityModel;
let gpt4Model: DialAIEntityModel;
let bison: DialAIEntityModel;

dialTest.beforeAll(async () => {
  allModels = ModelsUtil.getModels().filter((m) => m.iconUrl != undefined);
  gpt35Model = ModelsUtil.getModel(ModelIds.GPT_3_5_TURBO)!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
  bison = ModelsUtil.getModel(ModelIds.CHAT_BISON)!;
});

dialTest(
  '[Replay]chat has the same defaults at its parent.\n' +
    '"Replay as is" is selected by default in [Replay]chat',
  async ({
    dialHomePage,
    conversationData,
    chat,
    dataInjector,
    conversations,
    setTestIds,
    replayAsIs,
    talkToSelector,
    entitySettings,
    temperatureSlider,
    recentEntities,
    addons,
    conversationDropdownMenu,
  }) => {
    setTestIds('EPMRTC-501', 'EPMRTC-1264');
    let replayConversation: Conversation;
    const replayTemp = 0;
    const replayPrompt = 'replay prompt';
    let firstConversation: Conversation;
    let replayConversationName: string;

    await dialTest.step(
      'Prepare two conversation with different settings',
      async () => {
        firstConversation = conversationData.prepareModelConversation(
          0.5,
          'first prompt',
          [],
          bison,
        );
        conversationData.resetData();

        replayConversation = conversationData.prepareModelConversation(
          replayTemp,
          replayPrompt,
          [],
          gpt4Model,
        );
        await dataInjector.createConversations([
          firstConversation,
          replayConversation,
        ]);
      },
    );

    await dialTest.step(
      'Open Replay drop-down menu for one conversation',
      async () => {
        const modelUrls = allModels
          .filter(
            (m) =>
              m.id === firstConversation.model.id ||
              m.id === replayConversation.model.id,
          )
          .map((m) => m.iconUrl);
        await dialHomePage.openHomePage({ iconsToBeLoaded: modelUrls });
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await conversations.openEntityDropdownMenu(replayConversation!.name);
        await conversations.selectEntityMenuOption(MenuOptions.replay, {
          triggeredHttpMethod: 'POST',
        });
      },
    );

    await dialTest.step(
      'Verify new Replay conversation is created and Replay button appears',
      async () => {
        replayConversationName = `${ExpectedConstants.replayConversation}${replayConversation!.name}`;
        await conversations.getEntityByName(replayConversationName).waitFor();
        expect
          .soft(
            await chat.replay.getElementContent(),
            ExpectedMessages.startReplayVisible,
          )
          .toBe(ExpectedConstants.startReplayLabel);
      },
    );

    await dialTest.step(
      'Verify "Share" option is not available in Replay conversation dropdown menu',
      async () => {
        await conversations.openEntityDropdownMenu(replayConversationName);
        const replayConversationMenuOptions =
          await conversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(
            replayConversationMenuOptions,
            ExpectedMessages.contextMenuOptionIsNotAvailable,
          )
          .not.toContain(MenuOptions.share);
      },
    );

    await dialTest.step(
      'Verify "Replay as is" option is selected',
      async () => {
        const modelBorderColors =
          await recentEntities.replayAsIsButton.getAllBorderColors();
        Object.values(modelBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
              .toBe(Colors.controlsBackgroundAccent);
          });
        });

        const replayLabel = await replayAsIs.getReplayAsIsLabelText();
        expect
          .soft(replayLabel, ExpectedMessages.replayAsIsLabelIsVisible)
          .toBe(ExpectedConstants.replayAsIsLabel);
      },
    );

    await dialTest.step(
      'Select some model and verify it has the same settings as parent model',
      async () => {
        await talkToSelector.selectModel(gpt35Model);

        const newModelSystemPrompt = await entitySettings.getSystemPrompt();
        expect
          .soft(newModelSystemPrompt, ExpectedMessages.systemPromptIsValid)
          .toBe(replayPrompt);

        const newModelTemperature = await temperatureSlider.getTemperature();
        expect
          .soft(newModelTemperature, ExpectedMessages.temperatureIsValid)
          .toBe(replayTemp.toString());

        const newModelSelectedAddons = await addons.getSelectedAddons();
        expect
          .soft(newModelSelectedAddons, ExpectedMessages.selectedAddonsValid)
          .toEqual([]);
      },
    );
  },
);

dialTest(
  '[Replay]chat is created in the same folder where its parent is located',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    setTestIds,
    conversationDropdownMenu,
  }) => {
    setTestIds('EPMRTC-503');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    const nestedLevels = 4;

    await dialTest.step(
      'Prepare 3 levels folders hierarchy with chats inside',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(nestedLevels);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Select Replay from drop-down menu for conversations inside 1st and 3rd level folders',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        for (let i = 0; i < nestedLevels - 1; i = i + 2) {
          await folderConversations.openFolderEntityDropdownMenu(
            nestedFolders[i + 1].name,
            nestedConversations[i + 1].name,
          );
          await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
        }
      },
    );

    await dialTest.step(
      'Verify new Replay conversations are created inside 1st and 3rd level folders',
      async () => {
        for (let i = 0; i < nestedLevels - 1; i = i + 2) {
          await expect
            .soft(
              folderConversations.getFolderEntity(
                nestedFolders[i + 1].name,
                `${ExpectedConstants.replayConversation}${
                  nestedConversations[i + 1].name
                }`,
              ),
              ExpectedMessages.replayConversationCreated,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  'Start replay with the new Model settings',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
    chatHeader,
    entitySettings,
    temperatureSlider,
    talkToSelector,
    chatInfoTooltip,
    errorPopup,
    iconApiHelper,
  }) => {
    setTestIds('EPMRTC-508');
    const replayTemp = 0;
    const replayPrompt = 'reply the same text';
    const replayModel = bison;

    await dialTest.step('Prepare conversation to replay', async () => {
      const conversation =
        conversationData.prepareDefaultConversation(gpt35Model);
      const replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setSelectedConversation(replayConversation);
      await localStorageManager.setRecentModelsIds(bison);
    });

    let replayRequest: ChatBody;
    await dialTest.step(
      'Change model and settings for replay conversation and press Start replay',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [gpt35Model.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await talkToSelector.selectModel(bison);
        await entitySettings.setSystemPrompt(replayPrompt);
        await temperatureSlider.setTemperature(replayTemp);
        await dialHomePage.throttleAPIResponse(API.chatHost);
        replayRequest = await chat.startReplay();
      },
    );

    await dialTest.step(
      'Verify chat API request is sent with correct settings',
      async () => {
        expect
          .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(bison.id);
        expect
          .soft(replayRequest.prompt, ExpectedMessages.chatRequestPromptIsValid)
          .toBe(replayPrompt);
        expect
          .soft(
            replayRequest.temperature,
            ExpectedMessages.chatRequestTemperatureIsValid,
          )
          .toBe(replayTemp);
      },
    );

    await dialTest.step(
      'Verify chat header icons are updated with new model and addon',
      async () => {
        const headerModelIcon = await chatHeader.getHeaderModelIcon();
        const expectedModelIcon = await iconApiHelper.getEntityIcon(bison);
        expect
          .soft(headerModelIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedModelIcon);
      },
    );

    await dialTest.step(
      'Hover over chat header model and verify chat settings on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await chatHeader.hoverOverChatModel();
        const modelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(ModelsUtil.getModelInfo(bison.id));

        const expectedReplayModelIcon =
          await iconApiHelper.getEntityIcon(replayModel);
        const modelInfoIcon = await chatInfoTooltip.getModelIcon();
        expect
          .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
          .toBe(expectedReplayModelIcon);

        const promptInfo = await chatInfoTooltip.getPromptInfo();
        expect
          .soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid)
          .toBe(replayPrompt);

        const tempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(replayTemp.toString());
      },
    );
  },
);

dialTest(
  'Replay after Stop generating.\n' +
    'Share menu item is not available for the chat in Replay mode',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
    tooltip,
    chatMessages,
    conversations,
    conversationDropdownMenu,
    setIssueIds,
  }) => {
    setIssueIds('1784');
    setTestIds('EPMRTC-512', 'EPMRTC-3451');
    let conversation: Conversation;
    let replayConversation: Conversation;
    const firstUserRequest = 'write down 100 adjectives';
    const secondUserRequest = 'write down 200 adjectives';

    await dialTest.step('Prepare model conversation to replay', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        gpt35Model,
        [firstUserRequest, secondUserRequest],
      );
      replayConversation =
        conversationData.preparePartiallyReplayedConversation(conversation);
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    await dialTest.step(
      'Verify no "Share" option is available in dropdown menu for partially replayed conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(replayConversation.name);
        const replayConversationMenuOptions =
          await conversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(
            replayConversationMenuOptions,
            ExpectedMessages.contextMenuOptionIsNotAvailable,
          )
          .not.toContain(MenuOptions.share);
      },
    );

    await dialTest.step('Verify tooltip for Replay button', async () => {
      await chat.proceedGenerating.hoverOver();
      const tooltipContent = await tooltip.getContent();
      expect
        .soft(tooltipContent, ExpectedMessages.proceedReplayIsVisible)
        .toBe(ExpectedConstants.continueReplayLabel);
    });

    await dialTest.step(
      'Proceed generating the answer and verify received content is preserved',
      async () => {
        const chatContentBeforeReplay =
          await chatMessages.chatMessages.getElementsInnerContent();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.proceedReplaying(true);
        const chatContentAfterReplay =
          await chatMessages.chatMessages.getElementsInnerContent();
        expect
          .soft(
            chatContentAfterReplay.length,
            ExpectedMessages.messageCountIsCorrect,
          )
          .toBe(chatContentBeforeReplay.length);

        expect
          .soft(
            JSON.stringify(
              chatContentAfterReplay.slice(
                0,
                chatContentAfterReplay.length - 1,
              ),
            ),
            ExpectedMessages.replayContinuesFromReceivedContent,
          )
          .toBe(
            JSON.stringify(
              chatContentBeforeReplay.slice(
                0,
                chatContentBeforeReplay.length - 1,
              ),
            ),
          );
      },
    );

    await dialTest.step(
      'Verify "Share" option is available in dropdown menu for fully replayed conversation',
      async () => {
        await conversations.openEntityDropdownMenu(replayConversation.name);
        const replayConversationMenuOptions =
          await conversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(
            replayConversationMenuOptions,
            ExpectedMessages.contextMenuOptionIsAvailable,
          )
          .toContain(MenuOptions.share);
      },
    );
  },
);

dialTest(
  'Restart replay after error appeared on browser refresh.\n' +
    'Restart replay after error appeared on network interruption',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
    chatMessages,
    tooltip,
    context,
  }) => {
    setTestIds('EPMRTC-514', 'EPMRTC-1165');
    let conversation: Conversation;
    let replayConversation: Conversation;
    await dialTest.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareDefaultConversation(gpt35Model);
      replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    await dialTest.step(
      'Press Start replay and interrupt it with network error',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await context.setOffline(true);
        await chat.startReplay();
      },
    );

    await dialTest.step('Verify error message is displayed', async () => {
      const generatedContent = await chatMessages.getLastMessageContent();

      await chat.proceedGenerating.hoverOver();
      const tooltipContent = await tooltip.getContent();

      expect
        .soft(generatedContent, ExpectedMessages.errorReceivedOnReplay)
        .toBe(ExpectedConstants.answerError);
      expect
        .soft(tooltipContent, ExpectedMessages.proceedReplayIsVisible)
        .toBe(ExpectedConstants.continueReplayAfterErrorLabel);
    });

    await dialTest.step(
      'Proceed replaying and verify response received',
      async () => {
        await context.setOffline(false);
        await chat.proceedReplaying(true);
        const generatedContent = await chatMessages.getGeneratedChatContent(
          conversation.messages.length,
        );
        expect
          .soft(
            generatedContent.includes(
              conversation.messages.find((m) => m.role === 'user')!.content,
            ),
            ExpectedMessages.replayContinuesFromReceivedContent,
          )
          .toBeTruthy();
      },
    );
  },
);

dialTest(
  '"Replay as is" when chat is based on Model.\n' +
    '"Replay as is" when chat is based on Model with addon',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
    chatHeader,
    chatInfoTooltip,
    errorPopup,
    iconApiHelper,
  }) => {
    setTestIds('EPMRTC-1323', 'EPMRTC-1324');
    const replayTemp = 0.8;
    const replayPrompt = 'reply the same text';
    let conversation: Conversation;
    let replayConversation: Conversation;
    const expectedModelIcon = await iconApiHelper.getEntityIcon(gpt35Model);

    await dialTest.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareModelConversation(
        replayTemp,
        replayPrompt,
        [],
        gpt35Model,
      );
      replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    let replayRequest: ChatBody;
    await dialTest.step(
      'Replay conversation with "Replay as is" option selected and verify valid request is sent',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [gpt35Model.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.throttleAPIResponse(API.chatHost);
        replayRequest = await chat.startReplay(
          conversation.messages[0].content,
        );
        expect
          .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(conversation.model.id);
        expect
          .soft(replayRequest.prompt, ExpectedMessages.chatRequestPromptIsValid)
          .toBe(conversation.prompt);
        expect
          .soft(
            replayRequest.temperature,
            ExpectedMessages.chatRequestTemperatureIsValid,
          )
          .toBe(conversation.temperature);
      },
    );

    await dialTest.step(
      'Verify chat header icons are the same as initial model',
      async () => {
        const headerModelIcon = await chatHeader.getHeaderModelIcon();
        expect
          .soft(headerModelIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedModelIcon);
      },
    );

    await dialTest.step(
      'Hover over chat header model and verify chat settings on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await chatHeader.hoverOverChatModel();
        const modelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(ModelsUtil.getModelInfo(conversation.model.id));

        const modelInfoIcon = await chatInfoTooltip.getModelIcon();
        expect
          .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
          .toBe(expectedModelIcon);

        const promptInfo = await chatInfoTooltip.getPromptInfo();
        expect
          .soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid)
          .toBe(conversation.prompt);

        const tempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(conversation.temperature.toString());
      },
    );
  },
);

dialTest(
  '"Replay as is" icon is changed to model icon after replaying the chat.\n' +
    '"Talk to" item icon is stored in history for previous messages when new model is set',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    chatMessages,
    conversations,
    iconApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1322', 'EPMRTC-388');
    let replayConversation: Conversation;
    let conversation: Conversation;
    const firstModel = gpt35Model;
    const secondModel = gpt4Model;
    const conversationModels = [gpt35Model, gpt4Model];

    await dialTest.step(
      'Prepare reply conversation with two different models',
      async () => {
        conversation =
          conversationData.prepareConversationWithDifferentModels(
            conversationModels,
          );
        conversationData.resetData();

        replayConversation =
          conversationData.prepareDefaultReplayConversation(conversation);
        await dataInjector.createConversations([
          conversation,
          replayConversation,
        ]);
        await localStorageManager.setSelectedConversation(replayConversation);
      },
    );

    await dialTest.step(
      'Send new request with preselected "Replay as is" option and verify message icons correspond models',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.startReplayForDifferentModels();

        const expectedFirstModelIcon =
          await iconApiHelper.getEntityIcon(firstModel);
        const expectedSecondModelIcon =
          await iconApiHelper.getEntityIcon(secondModel);

        const firstConversationIcon =
          await chatMessages.getIconAttributesForMessage(2);
        expect
          .soft(firstConversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedFirstModelIcon);

        const secondConversationIcon =
          await chatMessages.getIconAttributesForMessage(4);
        expect
          .soft(secondConversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedSecondModelIcon);

        const chatBarConversationIcon = await conversations.getEntityIcon(
          ExpectedConstants.replayConversation + conversation.name,
        );
        expect
          .soft(chatBarConversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedSecondModelIcon);
      },
    );
  },
);

dialTest(
  'Send button is disabled if the chat in replay mode',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
    sendMessage,
    tooltip,
    context,
    chatMessages,
  }) => {
    setTestIds('EPMRTC-1535');
    const message = GeneratorUtil.randomString(10);
    let replayConversation: Conversation;

    await dialTest.step('Prepare conversation to replay', async () => {
      const requests: string[] = [];
      for (let i = 1; i <= 10; i++) {
        requests.push(GeneratorUtil.randomString(200));
      }
      const conversation =
        conversationData.prepareModelConversationBasedOnRequests(
          gpt35Model,
          requests,
        );
      replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    await dialTest.step(
      'Type new message while chat is replaying and verify Send button is disabled',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.startReplay();
        await sendMessage.messageInput.fillInInput(message);

        await sendMessage.stopGenerating.hoverOver();
        const tooltipContent = await tooltip.getContent();
        expect
          .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.stopGeneratingTooltip);

        await expect
          .soft(
            sendMessage.sendMessageButton.getElementLocator(),
            ExpectedMessages.sendMessageButtonDisabled,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Stop generating and verify message is preserved, footer is visible and tooltip shown on hover',
      async () => {
        await sendMessage.stopGenerating.click();
        const inputMessage = await sendMessage.messageInput.getElementContent();
        expect
          .soft(inputMessage, ExpectedMessages.messageContentIsValid)
          .toBe(message);

        await expect
          .soft(
            sendMessage.sendMessageButton.getElementLocator(),
            ExpectedMessages.sendMessageButtonIsNotVisible,
          )
          .toBeHidden();

        await chat.getFooter().waitForState({ state: 'attached' });
      },
    );

    await dialTest.step(
      'Continue replaying, refresh page and verify error appears for the least response, message is preserved, footer is visible and tooltip shown on hover',
      async () => {
        await context.setOffline(true);
        await chat.proceedReplaying();

        const generatedContent = await chatMessages.getLastMessageContent();
        expect
          .soft(generatedContent, ExpectedMessages.errorReceivedOnReplay)
          .toBe(ExpectedConstants.answerError);

        const inputMessage = await sendMessage.messageInput.getElementContent();
        expect
          .soft(inputMessage, ExpectedMessages.messageContentIsValid)
          .toBe(message);

        await expect
          .soft(
            sendMessage.sendMessageButton.getElementLocator(),
            ExpectedMessages.sendMessageButtonIsNotVisible,
          )
          .toBeHidden();

        await chat.getFooter().waitForState({ state: 'attached' });
      },
    );
  },
);

dialTest(
  'Replay function is still available if the name was edited.\n' +
    'Start replay works in  renamed [Replay]chat.\n' +
    'Regenerate response in already replayed chat.\n' +
    'Continue conversation in already replayed chat',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    chatMessages,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-505', 'EPMRTC-506', 'EPMRTC-515', 'EPMRTC-516');
    let conversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Prepare conversation to replay with updated name',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          gpt35Model,
          ['1+2'],
        );
        replayConversation =
          conversationData.prepareDefaultReplayConversation(conversation);
        replayConversation.name = GeneratorUtil.randomString(7);
        await dataInjector.createConversations([
          conversation,
          replayConversation,
        ]);
        await localStorageManager.setSelectedConversation(replayConversation);
      },
    );

    await dialTest.step(
      'Verify "Start Replay" button is available',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        const isStartReplayEnabled = await chat.replay.isElementEnabled();
        expect
          .soft(isStartReplayEnabled, ExpectedMessages.startReplayVisible)
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Start replaying and verify replaying is in progress',
      async () => {
        const replayRequest = await chat.startReplay(
          conversation.messages[0].content,
          true,
        );
        expect
          .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(conversation.model.id);
      },
    );

    await dialTest.step(
      'Regenerate response and verify it regenerated',
      async () => {
        await chatMessages.regenerateResponse();
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(conversation.messages.length);
      },
    );

    await dialTest.step(
      'Send a new message to chat and verify response received',
      async () => {
        const newMessage = '2+3';
        const newRequest = await chat.sendRequestWithButton(newMessage);
        expect
          .soft(newRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(conversation.model.id);
        expect
          .soft(
            newRequest.messages[2].content,
            ExpectedMessages.chatRequestMessageIsValid,
          )
          .toBe(newMessage);
      },
    );
  },
);

dialTest(
  'Start replay button appears in [Replay]chat if the parent chat has error in the response',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1312');
    let errorConversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Prepare errorConversation with error response and replay errorConversation',
      async () => {
        errorConversation =
          conversationData.prepareErrorResponseConversation(gpt35Model);
        replayConversation =
          conversationData.prepareDefaultReplayConversation(errorConversation);
        await dataInjector.createConversations([
          errorConversation,
          replayConversation,
        ]);
        await localStorageManager.setSelectedConversation(replayConversation);
      },
    );

    await dialTest.step(
      'Verify "Start Replay" button is available',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        const isStartReplayEnabled = await chat.replay.isElementEnabled();
        expect
          .soft(isStartReplayEnabled, ExpectedMessages.startReplayVisible)
          .toBeTruthy();
      },
    );
  },
);

dialTest(
  `"Replay as is" when restricted Model is used in parent chat`,
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    talkToSelector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1328');
    let notAllowedModelConversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Prepare conversation with not allowed model and replay for it',
      async () => {
        notAllowedModelConversation =
          conversationData.prepareDefaultConversation('not_allowed_model');
        replayConversation = conversationData.prepareDefaultReplayConversation(
          notAllowedModelConversation,
        );
        await dataInjector.createConversations([
          notAllowedModelConversation,
          replayConversation,
        ]);
        await localStorageManager.setSelectedConversation(replayConversation);
      },
    );

    await dialTest.step(
      'Verify "Start Replay" button is not displayed, error is shown at the bottom',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        await talkToSelector.waitForState({ state: 'attached' });
        await expect
          .soft(
            chat.replay.getElementLocator(),
            ExpectedMessages.startReplayNotVisible,
          )
          .toBeHidden();

        const notAllowedModelError =
          await chat.notAllowedModelLabel.getElementContent();
        expect
          .soft(
            notAllowedModelError!.trim(),
            ExpectedMessages.notAllowedModelErrorDisplayed,
          )
          .toBe(ExpectedConstants.notAllowedModelError);
      },
    );

    await dialTest.step(
      'Select any available model and start replaying',
      async () => {
        await talkToSelector.selectModel(gpt35Model);
        const replayRequest = await chat.startReplay();
        expect
          .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(gpt35Model.id);
      },
    );
  },
);

dialTest(
  `"Replay as is" in chat from 1.4 milestone.\n` +
    `"Replay as is" in chat from 1.9 milestone`,
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    folderConversations,
    conversationDropdownMenu,
    chat,
    chatHeader,
    talkToSelector,
    conversations,
    replayAsIs,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1330', 'EPMRTC-1332');
    const filename = GeneratorUtil.randomArrayElement([
      Import.v14AppImportedFilename,
      Import.v19AppImportedFilename,
    ]);
    const newModels = [ModelIds.CHAT_BISON, ModelIds.GPT_4];

    await dialTest.step(
      'Import conversation from old app version and send two new messages based on Titan and gpt-4 models',
      async () => {
        await localStorageManager.setRecentModelsIds(
          ...newModels.map((m) => ModelsUtil.getModel(m)!),
        );
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await dialHomePage.importFile({ path: filename }, () =>
          chatBar.importButton.click(),
        );
        await conversations
          .getEntityByName(
            ExpectedConstants.newConversationTitle,
            filename.includes(Import.v14AppImportedFilename) ? 2 : 1,
          )
          .waitFor();
        await folderConversations
          .getFolderEntity(
            Import.oldVersionAppFolderName,
            Import.oldVersionAppFolderChatName,
          )
          .waitFor();
        await folderConversations.selectFolderEntity(
          Import.oldVersionAppFolderName,
          Import.oldVersionAppFolderChatName,
          { isHttpMethodTriggered: true },
        );

        for (let i = 1; i <= newModels.length; i++) {
          const newModel = ModelsUtil.getModel(newModels[i - 1])!;
          await chatHeader.openConversationSettingsPopup();
          await talkToSelector.selectModel(newModel);
          await chat.applyNewEntity();
          const newMessage = `${i}*2=`;
          await chat.sendRequestWithButton(newMessage);
        }
      },
    );

    await dialTest.step(
      'Create replay conversation based on imported and verify warning message is displayed under "Replay as is" icon',
      async () => {
        await folderConversations.openFolderEntityDropdownMenu(
          Import.oldVersionAppFolderName,
          Import.oldVersionAppFolderChatName,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);

        const replayAsIsDescr =
          await replayAsIs.replayAsIsDescr.getElementContent();
        expect
          .soft(
            replayAsIsDescr,
            ExpectedMessages.replayAsIsDescriptionIsVisible,
          )
          .toBe(ExpectedConstants.replayAsIsDescr);

        const replayOldVersionWarningText =
          await replayAsIs.replayOldVersionWarning.getElementContent();
        expect
          .soft(
            replayOldVersionWarningText,
            ExpectedMessages.replayOldVersionWarningIsVisible,
          )
          .toBe(ExpectedConstants.replayOldVersionWarning);

        const warningColor =
          await replayAsIs.replayOldVersionWarning.getComputedStyleProperty(
            Styles.color,
          );
        expect
          .soft(warningColor[0], ExpectedMessages.warningLabelColorIsValid)
          .toBe(Colors.textError);
      },
    );

    await dialTest.step(
      'Start replaying and verify old requests are replayed using gpt-4 model',
      async () => {
        const requests = await chat.startReplayForDifferentModels();
        for (let i = 0; i < requests.length; i++) {
          const modelId = i === 1 ? ModelIds.CHAT_BISON : ModelIds.GPT_4;
          expect
            .soft(requests[i].modelId, ExpectedMessages.chatRequestModelIsValid)
            .toBe(modelId);
        }
      },
    );
  },
);

dialTest(
  'Replay feature does not exist in menu if all the messages were cleared in the chat',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-500');
    let conversation: Conversation;

    await dialTest.step('Prepare empty conversation', async () => {
      conversation = conversationData.prepareEmptyConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Open conversation dropdown menu and verify no "Replay" option available',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversation!.name);
        const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
          .not.toContain(MenuOptions.replay);
      },
    );
  },
);
// this test is not actual after https://github.com/epam/ai-dial-chat/pull/1809 where the "Clear conversation messages" were hidden for Replay-mode and during message streaming
dialTest.skip(
  'Chat is in replay mode if while replaying to clear all messages',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    dataInjector,
    chat,
    chatHeader,
    replayAsIs,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1542');
    let conversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step('Prepare partially replayed conversation', async () => {
      conversation = conversationData.prepareConversationWithDifferentModels([
        gpt35Model,
        bison,
        gpt4Model,
      ]);
      replayConversation =
        conversationData.preparePartiallyReplayedConversation(conversation);
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    await dialTest.step(
      'Clear conversation messages and verify "Replay As Is" option, "Start replay" button are available, ',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        await chatHeader.clearConversation.click();
        await confirmationDialog.confirm();

        const isStartReplayEnabled = await chat.replay.isElementEnabled();
        expect
          .soft(isStartReplayEnabled, ExpectedMessages.startReplayVisible)
          .toBeTruthy();

        const replayLabel = await replayAsIs.getReplayAsIsLabelText();
        expect
          .soft(replayLabel, ExpectedMessages.replayAsIsLabelIsVisible)
          .toBe(ExpectedConstants.replayAsIsLabel);
      },
    );
  },
);
