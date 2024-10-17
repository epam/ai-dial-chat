import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  MockedChatApiResponseBodies,
  Rate,
  Side,
} from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let allModels: DialAIEntityModel[];
let defaultModel: DialAIEntityModel;
let aModel: DialAIEntityModel;
let bModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  allModels = ModelsUtil.getModels().filter((m) => m.iconUrl !== undefined);
  defaultModel = ModelsUtil.getDefaultModel()!;
  aModel = GeneratorUtil.randomArrayElement(
    allModels.filter((m) => m.id !== defaultModel.id),
  );
  bModel = GeneratorUtil.randomArrayElement(
    allModels.filter((m) => m.id !== defaultModel.id && m.id !== aModel.id),
  );
});

dialTest(
  'Compare mode button creates two new chats and opens them in compare mode',
  async ({ dialHomePage, setTestIds, chatBar, conversations, compare }) => {
    setTestIds('EPMRTC-537');
    await dialTest.step(
      'Click on compare button on bottom of chat bar and verify compare mode is opened for new two chats',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.openCompareMode();
        await compare.waitForState();
        const chatsCount = await compare.getConversationsCount();
        expect.soft(chatsCount, ExpectedMessages.compareModeOpened).toBe(2);

        const todayConversations = await conversations.getTodayConversations();
        expect
          .soft(todayConversations.length, ExpectedMessages.conversationOfToday)
          .toBe(3);

        todayConversations.forEach((value) =>
          expect
            .soft(value, ExpectedMessages.conversationOfToday)
            .toContain(ExpectedConstants.newConversationTitle),
        );
      },
    );
  },
);

dialTest(
  'Check the list of available conversations.\n' +
    'Chat icon is shown in Select conversation drop down list in compare mode',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    conversations,
    conversationData,
    localStorageManager,
    dataInjector,
    compare,
    compareConversation,
    iconApiHelper,
    conversationToCompareAssertion,
  }) => {
    setTestIds('EPMRTC-546', 'EPMRTC-383');
    let firstModelConversation: Conversation;
    let secondModelConversation: Conversation;
    let modelConversationInFolder: FolderConversation;
    let thirdModelConversation: Conversation;
    const conversationName = GeneratorUtil.randomString(7);

    await dialTest.step('Prepare three conversations to compare', async () => {
      firstModelConversation = conversationData.prepareDefaultConversation(
        defaultModel,
        conversationName,
      );
      const request = firstModelConversation.messages.find(
        (m) => m.role === 'user',
      )?.content;
      conversationData.resetData();
      secondModelConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          aModel,
          [request!],
          conversationName,
        );
      conversationData.resetData();
      modelConversationInFolder =
        conversationData.prepareDefaultConversationInFolder(
          undefined,
          bModel,
          conversationName,
        );
      conversationData.resetData();
      thirdModelConversation = conversationData.prepareDefaultConversation(
        bModel,
        conversationName,
      );

      await dataInjector.createConversations(
        [
          firstModelConversation,
          secondModelConversation,
          thirdModelConversation,
          ...modelConversationInFolder.conversations,
        ],
        modelConversationInFolder.folders,
      );
      await localStorageManager.setSelectedConversation(thirdModelConversation);
    });

    await dialTest.step(
      'Open compare mode from 1st chat dropdown menu and verify chats with valid icons available for comparison',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [
            defaultModel.iconUrl,
            aModel.iconUrl,
            bModel.iconUrl,
          ],
        });
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(
          thirdModelConversation.name,
          3,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);

        const chatsCount = await compare.getChatMessagesCount();
        expect.soft(chatsCount, ExpectedMessages.compareModeOpened).toBe(1);

        const isConversationToCompareVisible =
          await compare.isConversationToCompareVisible();
        expect
          .soft(
            isConversationToCompareVisible,
            ExpectedMessages.conversationToCompareVisible,
          )
          .toBeTruthy();

        const conversationsList =
          await compareConversation.getCompareConversationNames();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([
            firstModelConversation.name,
            secondModelConversation.name,
            modelConversationInFolder.conversations[0].name,
          ]);

        const compareOptionsIcons =
          await compareConversation.getCompareConversationIcons();
        const expectedModels = [defaultModel, aModel, bModel];
        expect
          .soft(
            compareOptionsIcons.length,
            ExpectedMessages.entitiesIconsCountIsValid,
          )
          .toBe(expectedModels.length);

        for (const expectedModel of expectedModels) {
          const actualOptionIcon = compareOptionsIcons.find((o) =>
            o.entityName.includes(expectedModel.name),
          )!;
          const expectedModelIcon = iconApiHelper.getEntityIcon(expectedModel);
          await conversationToCompareAssertion.assertEntityIcon(
            actualOptionIcon.iconLocator,
            expectedModelIcon,
          );
        }
      },
    );
  },
);

dialTest(
  'Check chat replay, playback modes are not included in Select conversation drop down list.\n' +
    'Compare mode is closed if to switch to another chat',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    conversations,
    conversationData,
    compareConversation,
    dataInjector,
    compare,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1133', 'EPMRTC-541');
    let modelConversation: Conversation;
    let replayConversation: Conversation;
    let playbackConversation: Conversation;
    const conversationName = 'test';

    await dialTest.step(
      'Prepare new conversation and replay, playback conversations based on it',
      async () => {
        modelConversation = conversationData.prepareDefaultConversation(
          defaultModel,
          conversationName,
        );
        replayConversation =
          conversationData.prepareDefaultReplayConversation(modelConversation);
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(
            modelConversation,
          );

        await dataInjector.createConversations([
          modelConversation,
          replayConversation,
          playbackConversation,
        ]);
        await localStorageManager.setSelectedConversation(modelConversation);
      },
    );

    await dialTest.step(
      'Open compare mode for the 1st empty chat and verify only one empty chat is available for comparison',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(modelConversation.name, 3);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversation.checkShowAllConversations();
        await expect
          .soft(
            compareConversation.noConversationsAvailable.getElementLocator(),
            ExpectedMessages.noConversationsAvailable,
          )
          .toHaveText(ExpectedConstants.noConversationsAvailable);

        const conversationsList =
          await compareConversation.compareConversationRowNames.getElementsCount();
        expect
          .soft(conversationsList, ExpectedMessages.conversationsCountIsValid)
          .toEqual(0);
      },
    );

    await dialTest.step(
      'Open another conversation and verify compare mode is closed',
      async () => {
        await conversations.selectConversation(replayConversation.name);
        await expect
          .soft(compare.getElementLocator(), ExpectedMessages.compareModeClosed)
          .toBeHidden();
      },
    );
  },
);

dialTest(
  `Compare mode is closed on "x" button in chat1.\n` +
    'Compare mode is closed on "x" button in chat2',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    compare,
    chatHeader,
    rightChatHeader,
    leftChatHeader,
  }) => {
    setTestIds('EPMRTC-544', 'EPMRTC-545');
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await dialTest.step(
      'Prepare two conversations in compare mode',
      async () => {
        firstConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        secondConversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
        await localStorageManager.setSelectedConversation(
          firstConversation,
          secondConversation,
        );
      },
    );

    await dialTest.step(
      'Delete 1st conversation from compare mode using Close btn in the header',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        const randomSide = GeneratorUtil.randomArrayElement(
          Object.values(Side),
        );
        let activeChat;
        if (randomSide === Side.right) {
          await rightChatHeader.deleteConversationFromComparison.click();
          activeChat = firstConversation.name;
        } else {
          await leftChatHeader.deleteConversationFromComparison.click();
          activeChat = secondConversation.name;
        }

        await expect
          .soft(compare.getElementLocator(), ExpectedMessages.compareModeClosed)
          .toBeHidden();

        const activeChatHeader = await chatHeader.chatTitle.getElementContent();
        expect
          .soft(activeChatHeader, ExpectedMessages.headerTitleIsValid)
          .toBe(activeChat);
      },
    );
  },
);

dialTest(
  'Check the list of No conversations available',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    compareConversation,
  }) => {
    setTestIds('EPMRTC-540');
    const firstRequest = 'What is EPAM official name?';
    const secondRequest = 'What is DIAL?';
    const thirdRequest = 'Who is EPAM founder?';
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let thirdConversation: Conversation;
    let forthConversation: Conversation;
    let fifthConversation: Conversation;

    await dialTest.step(
      'Prepare five conversations with requests combination',
      async () => {
        firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [firstRequest, secondRequest],
            'firstConv',
          );
        conversationData.resetData();
        secondConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [secondRequest, firstRequest],
            'secondConv',
          );
        conversationData.resetData();
        thirdConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [firstRequest],
            'thirdConv',
          );
        conversationData.resetData();
        forthConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [firstRequest, thirdRequest],
            'forthConv',
          );
        conversationData.resetData();
        fifthConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [firstRequest.toLowerCase(), secondRequest],
            'fifthConv',
          );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
          thirdConversation,
          forthConversation,
          fifthConversation,
        ]);
        await localStorageManager.setSelectedConversation(firstConversation);
      },
    );

    await dialTest.step(
      'Open compare mode for the 1st conversation and verify no options are available for comparison',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(firstConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);

        await expect
          .soft(
            compareConversation.noConversationsAvailable.getElementLocator(),
            ExpectedMessages.noConversationsAvailable,
          )
          .toHaveText(ExpectedConstants.noConversationsAvailable);

        const conversationsList =
          await compareConversation.compareConversationRows.getElementsCount();
        expect
          .soft(conversationsList, ExpectedMessages.conversationsCountIsValid)
          .toBe(0);
      },
    );
  },
);

dialTest(
  'Generate new response for two chats in compare mode. GPT models.\n' +
    'Likes/Dislikes set in compare mode are stored in both chats',
  async ({
    dialHomePage,
    chat,
    chatMessages,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    compare,
    conversations,
  }) => {
    setTestIds('EPMRTC-552', 'EPMRTC-558');

    let firstConversation: Conversation;
    let secondConversation: Conversation;

    const firstPrompt = 'repeat the same text';
    const firstTemp = 1;
    const secondPrompt = 'repeat the same text again';
    const secondTemp = 0;

    await dialTest.step('Prepare two conversations for comparing', async () => {
      firstConversation = conversationData.prepareModelConversation(
        firstTemp,
        firstPrompt,
        [],
        defaultModel,
      );
      conversationData.resetData();
      secondConversation = conversationData.prepareModelConversation(
        secondTemp,
        secondPrompt,
        [],
        aModel,
      );
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await dialTest.step(
      'Send new message in compare chat and verify response is displayed for both and API requests are correct',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await compare.waitForComparedConversationsLoaded();
        const requestsData = await chat.sendRequestInCompareMode(
          'how are you?',
          {
            rightEntity: firstConversation.model.id,
            leftEntity: secondConversation.model.id,
          },
          true,
        );

        const messagesCount = await chatMessages.getCompareMessagesCount();
        expect
          .soft(
            messagesCount,
            ExpectedMessages.responseReceivedForComparedConversations,
          )
          .toBe(
            firstConversation.messages.length +
              secondConversation.messages.length +
              4,
          );

        expect
          .soft(
            requestsData.rightRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(defaultModel.id);
        expect
          .soft(
            requestsData.rightRequest.prompt,
            ExpectedMessages.requestPromptIsValid,
          )
          .toBe(firstPrompt);
        expect
          .soft(
            requestsData.rightRequest.temperature,
            ExpectedMessages.requestTempIsValid,
          )
          .toBe(firstTemp);

        expect
          .soft(
            requestsData.leftRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(aModel.id);
        expect
          .soft(
            requestsData.leftRequest.prompt,
            ExpectedMessages.requestPromptIsValid,
          )
          .toBe(secondPrompt);
        expect
          .soft(
            requestsData.leftRequest.temperature,
            ExpectedMessages.requestTempIsValid,
          )
          .toBe(secondTemp);
      },
    );

    await dialTest.step(
      'Put like/dislike for compared chat, open this chat and verify like/dislike saved',
      async () => {
        const rate = GeneratorUtil.randomArrayElement(Object.values(Rate));
        await chatMessages.rateCompareRowMessage(Side.left, rate);
        const isComparedMessageRated =
          await chatMessages.isComparedRowMessageRated(Side.left, rate);
        expect
          .soft(isComparedMessageRated, ExpectedMessages.chatMessageIsRated)
          .toBeTruthy();

        await conversations.selectConversation(firstConversation.name);
        await chatMessages
          .getChatMessageRate(firstConversation.messages.length + 2, rate)
          .waitFor();
      },
    );
  },
);

dialTest(
  'Regenerate response in compare mode',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    leftChatHeader,
    rightChatHeader,
  }) => {
    setTestIds('EPMRTC-555');
    const request = ['beautiful'];
    const conversationName = request[0];
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await dialTest.step('Prepare two conversations for comparing', async () => {
      firstConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          aModel,
          request,
          conversationName,
        );
      conversationData.resetData();
      secondConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          bModel,
          request,
          conversationName,
        );
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await dialTest.step(
      'Click "Regenerate" button for both sides and verify conversation names are not changed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );

        for (const side of Object.values(Side)) {
          await chat.regenerateResponseInCompareMode(
            {
              rightEntity: firstConversation.model.id,
              leftEntity: secondConversation.model.id,
            },
            side,
          );
          expect
            .soft(
              await leftChatHeader.chatTitle.getElementInnerContent(),
              ExpectedMessages.headerTitleIsValid,
            )
            .toBe(conversationName);
          expect
            .soft(
              await rightChatHeader.chatTitle.getElementInnerContent(),
              ExpectedMessages.headerTitleIsValid,
            )
            .toBe(conversationName);
        }
      },
    );
  },
);

dialTest(
  'Apply changes with new settings for both chats in compare mode and check chat headers',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    dataInjector,
    localStorageManager,
    leftChatHeader,
    rightChatHeader,
    rightConversationSettings,
    leftConversationSettings,
    marketplacePage,
    chatInfoTooltip,
    errorPopup,
    iconApiHelper,
    rightChatHeaderAssertion,
    leftChatHeaderAssertion,
    conversationAssertion,
    conversationInfoTooltipAssertion,
  }) => {
    dialTest.slow();
    setTestIds('EPMRTC-1021');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const models = ModelsUtil.getLatestModels();
    const initRandomModel = GeneratorUtil.randomArrayElement(models);
    const modelsForUpdate = models.filter((m) => m !== initRandomModel);
    const firstUpdatedRandomModel =
      GeneratorUtil.randomArrayElement(modelsForUpdate);
    const secondUpdatedRandomModel = GeneratorUtil.randomArrayElement(
      modelsForUpdate.filter((m) => m !== firstUpdatedRandomModel),
    );
    const firstUpdatedPrompt = 'first prompt';
    const secondUpdatedPrompt = 'second prompt';
    const firstUpdatedTemp = 0.5;
    const secondUpdatedTemp = 0;
    const expectedSecondUpdatedRandomModelIcon = iconApiHelper.getEntityIcon(
      secondUpdatedRandomModel,
    );
    const expectedFirstUpdatedRandomModelIcon = iconApiHelper.getEntityIcon(
      firstUpdatedRandomModel,
    );

    await dialTest.step(
      'Prepare two model conversations for comparing',
      async () => {
        firstConversation = conversationData.prepareModelConversation(
          1,
          'prompt',
          [],
          initRandomModel,
        );
        conversationData.resetData();
        secondConversation =
          conversationData.prepareDefaultConversation(initRandomModel);
        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
        await localStorageManager.setSelectedConversation(
          firstConversation,
          secondConversation,
        );
        await localStorageManager.setRecentModelsIds(
          firstUpdatedRandomModel,
          secondUpdatedRandomModel,
        );
      },
    );

    await dialTest.step(
      'Open chat settings and update them for both models',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: initRandomModel?.iconUrl
            ? [initRandomModel.iconUrl]
            : undefined,
        });
        await dialHomePage.waitForPageLoaded();
        await leftChatHeader.openConversationSettingsPopup();
        await leftConversationSettings
          .getTalkToSelector()
          .selectEntity(firstUpdatedRandomModel, marketplacePage);
        const leftEntitySettings = leftConversationSettings.getEntitySettings();
        if (firstUpdatedRandomModel.features?.systemPrompt) {
          await leftEntitySettings.clearAndSetSystemPrompt(firstUpdatedPrompt);
        }
        await leftEntitySettings
          .getTemperatureSlider()
          .setTemperature(firstUpdatedTemp);

        await rightConversationSettings
          .getTalkToSelector()
          .selectEntity(secondUpdatedRandomModel, marketplacePage);
        const rightEntitySettings =
          rightConversationSettings.getEntitySettings();
        if (secondUpdatedRandomModel.features?.systemPrompt) {
          await rightEntitySettings.clearAndSetSystemPrompt(
            secondUpdatedPrompt,
          );
        }
        await rightEntitySettings
          .getTemperatureSlider()
          .setTemperature(secondUpdatedTemp);
        await chat.applyNewEntity();
      },
    );

    await dialTest.step(
      'Verify chat icons are updated with new model and addons in the header and chat bar',
      async () => {
        await rightChatHeaderAssertion.assertHeaderIcon(
          expectedSecondUpdatedRandomModelIcon,
        );
        await leftChatHeaderAssertion.assertHeaderIcon(
          expectedFirstUpdatedRandomModelIcon,
        );

        await conversationAssertion.assertTreeEntityIcon(
          { name: firstConversation.name },
          expectedFirstUpdatedRandomModelIcon,
        );
        await conversationAssertion.assertTreeEntityIcon(
          { name: secondConversation.name },
          expectedSecondUpdatedRandomModelIcon,
        );
      },
    );

    await dialTest.step(
      'Hover over chat headers and verify chat settings updated on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await rightChatHeader.hoverOverChatModel();
        const rightModelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(rightModelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(secondUpdatedRandomModel.name);
        const rightModelVersionInfo = await chatInfoTooltip.getVersionInfo();
        expect
          .soft(rightModelVersionInfo, ExpectedMessages.chatInfoVersionIsValid)
          .toBe(secondUpdatedRandomModel.version);

        await conversationInfoTooltipAssertion.assertTooltipModelIcon(
          expectedSecondUpdatedRandomModelIcon,
        );

        if (secondUpdatedRandomModel.features?.systemPrompt) {
          const rightPromptInfo = await chatInfoTooltip.getPromptInfo();
          expect
            .soft(rightPromptInfo, ExpectedMessages.chatInfoPromptIsValid)
            .toBe(secondUpdatedPrompt);
        }

        const rightTempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(rightTempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(secondUpdatedTemp.toString());

        await errorPopup.cancelPopup();
        await leftChatHeader.hoverOverChatModel();
        const leftModelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(leftModelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(firstUpdatedRandomModel.name);

        const leftModelVersionInfo = await chatInfoTooltip.getVersionInfo();
        expect
          .soft(leftModelVersionInfo, ExpectedMessages.chatInfoVersionIsValid)
          .toBe(firstUpdatedRandomModel.version);

        await conversationInfoTooltipAssertion.assertTooltipModelIcon(
          expectedFirstUpdatedRandomModelIcon,
        );

        if (firstUpdatedRandomModel.features?.systemPrompt) {
          const leftPromptInfo = await chatInfoTooltip.getPromptInfo();
          expect
            .soft(leftPromptInfo, ExpectedMessages.chatInfoPromptIsValid)
            .toBe(firstUpdatedPrompt);
        }

        const leftTempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(leftTempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(firstUpdatedTemp.toString());
      },
    );
  },
);

dialTest(
  'Stop regenerating in compare mode.\n' +
    'Both "Talk to" item icons are jumping while generating an answer in Compare mode',
  async ({
    dialHomePage,
    chat,
    chatMessages,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    compare,
    iconApiHelper,
    sendMessage,
    chatMessagesAssertion,
  }) => {
    dialTest.slow();
    setTestIds('EPMRTC-556', 'EPMRTC-1134');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const sides = Object.values(Side);

    await dialTest.step('Prepare two conversations for comparing', async () => {
      firstConversation =
        conversationData.prepareDefaultConversation(defaultModel);
      conversationData.resetData();
      secondConversation =
        conversationData.prepareDefaultConversation(defaultModel);
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await dialTest.step(
      'Send new message in compare chat, verify both chat icons are jumping while responding and then stop generation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await compare.waitForComparedConversationsLoaded();
        await dialHomePage.throttleAPIResponse(API.chatHost);

        await chat.sendRequestInCompareMode('write down 30 adjectives', {
          rightEntity: firstConversation.model.id,
          leftEntity: secondConversation.model.id,
        });

        for (const side of sides) {
          const jumpingIcon =
            await chatMessages.getCompareMessageJumpingIcon(side);
          await jumpingIcon.waitFor();
        }

        await sendMessage.stopGenerating.click();
      },
    );

    await dialTest.step(
      'Verify response is not received by both chats, stop is done immediately, valid model icons are displayed',
      async () => {
        const isResponseLoading = await chatMessages.isResponseLoading();
        expect
          .soft(isResponseLoading, ExpectedMessages.responseLoadingStopped)
          .toBeFalsy();
        await expect
          .soft(
            sendMessage.stopGenerating.getElementLocator(),
            ExpectedMessages.responseLoadingStopped,
          )
          .toBeHidden();

        const expectedModelIcon = iconApiHelper.getEntityIcon(defaultModel);
        for (const side of sides) {
          await chatMessagesAssertion.assertEntityIcon(
            await chatMessages.getIconAttributesForCompareMessage(side),
            expectedModelIcon,
          );
        }
      },
    );
  },
);

dialTest(
  'Search chat in Select conversation drop down.\n' +
    'Select chat from search results in Select conversation drop down',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    conversations,
    conversationData,
    localStorageManager,
    dataInjector,
    rightChatHeader,
    compareConversation,
  }) => {
    setTestIds('EPMRTC-536', 'EPMRTC-1168');
    const request = 'What is epam official name';
    const firstSearchTerm = 'epam';
    const secondSearchTerm = 'systems';
    const thirdSearchTerm = 'epam official';
    const underscoreSearchTerm = '_';
    const noResultSearchTerm = 'epaQ';

    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let thirdConversation: Conversation;
    let fourthConversation: Conversation;
    const matchedConversations: string[] = [];

    await dialTest.step(
      'Prepare 4 conversations with the same request but different names',
      async () => {
        firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
            request,
          );
        conversationData.resetData();
        secondConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
            'When was epam officially founded',
          );
        conversationData.resetData();
        thirdConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
            'Renamed epam systems',
          );
        conversationData.resetData();
        fourthConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
            'epam_systems',
          );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
          thirdConversation,
          fourthConversation,
        ]);
        await localStorageManager.setSelectedConversation(firstConversation);
        matchedConversations.push(
          thirdConversation.name,
          secondConversation.name,
          fourthConversation.name,
        );
        matchedConversations.sort();
      },
    );

    await dialTest.step(
      'Open compare mode for the 1st chat and verify all chats are available for comparison in dropdown list',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(firstConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversation.checkShowAllConversations();
        const conversationsList =
          await compareConversation.getCompareConversationNames();
        expect
          .soft(
            conversationsList.sort(),
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual(matchedConversations);
      },
    );

    await dialTest.step(
      'Type first search term and verify all chats are available for comparison in dropdown list',
      async () => {
        for (const term of [firstSearchTerm, firstSearchTerm.toUpperCase()]) {
          await compareConversation.searchCompareConversationInput.fillInInput(
            term,
          );
          const conversationsList =
            await compareConversation.getCompareConversationNames();
          expect
            .soft(
              conversationsList.sort(),
              ExpectedMessages.conversationsToCompareOptionsValid,
            )
            .toEqual(matchedConversations);
        }
      },
    );

    await dialTest.step(
      'Type second search term and verify chat 3 and 4 are available for comparison in dropdown list',
      async () => {
        await compareConversation.searchCompareConversationInput.fillInInput(
          secondSearchTerm,
        );
        const conversationsList =
          await compareConversation.getCompareConversationNames();
        expect
          .soft(
            conversationsList.sort(),
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([thirdConversation.name, fourthConversation.name]);
      },
    );

    await dialTest.step(
      'Type third search term and verify chat 2 is available for comparison in dropdown list',
      async () => {
        await compareConversation.searchCompareConversationInput.fillInInput(
          thirdSearchTerm,
        );
        const conversationsList =
          await compareConversation.getCompareConversationNames();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([secondConversation.name]);
      },
    );

    await dialTest.step(
      'Type underscore and verify chat 4 is available for comparison in dropdown list',
      async () => {
        await compareConversation.searchCompareConversationInput.fillInInput(
          underscoreSearchTerm,
        );
        const conversationsList =
          await compareConversation.getCompareConversationNames();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([fourthConversation.name]);
      },
    );

    await dialTest.step(
      'Type not matching search term and verify no chats available for comparison in dropdown list',
      async () => {
        await compareConversation.searchCompareConversationInput.fillInInput(
          noResultSearchTerm,
        );
        const conversationsList =
          await compareConversation.getCompareConversationNames();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([]);
      },
    );

    await dialTest.step(
      'Delete search term and verify all chats are available for comparison in dropdown list',
      async () => {
        await compareConversation.searchCompareConversationInput.fillInInput(
          '',
        );
        const conversationsList =
          await compareConversation.getCompareConversationNames();
        expect
          .soft(
            conversationsList.sort(),
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual(matchedConversations);
      },
    );

    await dialTest.step(
      'Select any chat and verify it shown in the input, dropdown list is closed',
      async () => {
        const chatToSelect =
          GeneratorUtil.randomArrayElement(matchedConversations);
        await compareConversation.selectCompareConversation(chatToSelect);
        await compareConversation.waitForState({
          state: 'hidden',
        });
        const rightHeaderTitle =
          await rightChatHeader.chatTitle.getElementContent();
        expect
          .soft(rightHeaderTitle, ExpectedMessages.headerTitleCorrespondRequest)
          .toBe(chatToSelect);
      },
    );
  },
);

dialTest(
  'Compare mode is closed if to create new chat.\n' +
    'Compare mode is closed if to click on chat which is used in compare mode.\n' +
    'Check chat header in compare mode with long chat names.\n' +
    'Long chat names in Select conversations drop down list',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    compare,
    conversations,
    chatBar,
    chatHeader,
    compareConversation,
    conversationDropdownMenu,
    leftChatHeader,
  }) => {
    setTestIds('EPMRTC-542', 'EPMRTC-543', 'EPMRTC-548', 'EPMRTC-828');
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await dialTest.step(
      'Prepare two conversations for compare mode',
      async () => {
        firstConversation = conversationData.prepareDefaultConversation(
          defaultModel,
          GeneratorUtil.randomString(70),
        );
        conversationData.resetData();

        let secondConversationName = '';
        for (let i = 1; i <= 10; i++) {
          secondConversationName += ' ' + GeneratorUtil.randomString(7);
        }
        secondConversation = conversationData.prepareDefaultConversation(
          defaultModel,
          secondConversationName,
        );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
        await localStorageManager.setSelectedConversation(
          firstConversation,
          secondConversation,
        );
      },
    );

    await dialTest.step(
      'Open compare mode and verify long chat name is cut',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        const isTitleTruncated =
          await chatHeader.chatTitle.isElementWidthTruncated();
        expect
          .soft(isTitleTruncated, ExpectedMessages.chatHeaderTitleTruncated)
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Create new chat and verify Compare mode is closed',
      async () => {
        await chatBar.createNewConversation();
        await compare.waitForState({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Open compare mode again, switch to comparing conversation and verify Compare mode is closed',
      async () => {
        await dialHomePage.reloadPage();
        await compare.waitForState();
        await conversations.selectConversation(firstConversation.name);
        await expect
          .soft(compare.getElementLocator(), ExpectedMessages.compareModeClosed)
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Open compare mode for 1st conversation and verify long compare options are shown in different rows',
      async () => {
        await conversations.openEntityDropdownMenu(firstConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);

        await expect
          .soft(
            leftChatHeader.deleteConversationFromComparison.getElementLocator(),
            ExpectedMessages.closeChatIconIsNotVisible,
          )
          .toBeHidden();
        await compareConversation.checkShowAllConversations();
        const overflowProp = await compareConversation
          .compareConversationRowName(secondConversation.name)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(overflowProp[0], ExpectedMessages.entityNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );
  },
);

dialTest(
  'Compare two chats located in different folders',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    folderConversations,
    conversationData,
    dataInjector,
    compare,
    compareConversation,
    chat,
  }) => {
    setTestIds('EPMRTC-557');
    let firstFolderConversation: FolderConversation;
    let secondFolderConversation: FolderConversation;
    const conversationName = GeneratorUtil.randomString(7);

    await dialTest.step('Prepare two conversations in folders', async () => {
      firstFolderConversation =
        conversationData.prepareDefaultConversationInFolder(
          undefined,
          defaultModel,
          `${conversationName} 1`,
        );
      conversationData.resetData();
      secondFolderConversation =
        conversationData.prepareDefaultConversationInFolder(
          undefined,
          bModel,
          `${conversationName} 2`,
        );

      await dataInjector.createConversations(
        [
          firstFolderConversation.conversations[0],
          secondFolderConversation.conversations[0],
        ],
        firstFolderConversation.folders,
        secondFolderConversation.folders,
      );
    });

    await dialTest.step(
      'Open compare mode from 1st chat dropdown menu and verify one chat is available for comparison',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(
          firstFolderConversation.folders.name,
        );
        await folderConversations.openFolderEntityDropdownMenu(
          firstFolderConversation.folders.name,
          firstFolderConversation.conversations[0].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compare.waitForState();
        const conversationsList =
          await compareConversation.getCompareConversationNames();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([secondFolderConversation.conversations[0].name]);
      },
    );

    await dialTest.step(
      'Select folder conversation for comparison, send new request and verify response generated for both chats',
      async () => {
        await compareConversation.selectCompareConversation(
          secondFolderConversation.conversations[0].name,
        );
        const requestsData = await chat.sendRequestInCompareMode(
          'repeat the same response',
          {
            rightEntity: firstFolderConversation.conversations[0].model.id,
            leftEntity: secondFolderConversation.conversations[0].model.id,
          },
        );
        expect
          .soft(
            requestsData.rightRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(firstFolderConversation.conversations[0].model.id);
        expect
          .soft(
            requestsData.leftRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(secondFolderConversation.conversations[0].model.id);
      },
    );
  },
);

dialTest(
  'In compare mode delete any message in chat2.\n' +
    'In compare mode copy answer.\n' +
    'In compare mode save&sumbit any message in chat1.\n' +
    'In compare mode edit chat name.\n' +
    'In compare mode delete a chat',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    chatMessages,
    confirmationDialog,
    page,
    conversations,
    leftChatHeader,
    conversationDropdownMenu,
    compare,
  }) => {
    setTestIds(
      'EPMRTC-560',
      'EPMRTC-562',
      'EPMRTC-559',
      'EPMRTC-563',
      'EPMRTC-564',
    );
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const firstConversationRequests = ['1+2', '2+3', '3+4'];
    const secondConversationRequests = ['1+2', '4+5', '5+6'];
    let updatedRequestContent: string;

    await dialTest.step(
      'Prepare two conversations for compare mode',
      async () => {
        firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            firstConversationRequests,
          );
        conversationData.resetData();

        secondConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            aModel,
            secondConversationRequests,
          );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
        await localStorageManager.setSelectedConversation(
          firstConversation,
          secondConversation,
        );
      },
    );

    await dialTest.step(
      'Delete 1st message from the left conversation and verify only 1st row deleted for both chats',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatMessages.openDeleteCompareRowMessageDialog(Side.left, 1);
        await confirmationDialog.confirm();

        const comparedMessagesCount =
          await chatMessages.getCompareMessagesCount();
        expect
          .soft(comparedMessagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe((firstConversationRequests.length - 1) * 4);

        const firstComparedMessage = await chatMessages.getCompareRowMessage(
          Side.left,
          1,
        );
        await expect
          .soft(firstComparedMessage, ExpectedMessages.messageContentIsValid)
          .toHaveText(firstConversationRequests[1]);
      },
    );

    await dialTest.step(
      'Copy last response from the right conversation and edit the 1st request for the left chat with copied message',
      async () => {
        await chatMessages.copyCompareRowMessage(
          Side.right,
          (firstConversationRequests.length - 1) * 2,
        );
        await chatMessages.openEditCompareRowMessageMode(Side.left, 1);
        await chatMessages.selectEditTextareaContent(
          firstConversationRequests[1],
        );
        await page.keyboard.press(keys.ctrlPlusV);
        await chatMessages.saveAndSubmit.click();
        await chatMessages.waitForResponseReceived();
      },
    );

    await dialTest.step(
      'Verify both first requests updated, messages below are deleted',
      async () => {
        updatedRequestContent =
          secondConversation.messages[secondConversation.messages.length - 1]
            .content;
        const comparedMessagesCount =
          await chatMessages.getCompareMessagesCount();
        expect
          .soft(comparedMessagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(4);

        for (const side of Object.values(Side)) {
          const firstComparedMessage = await chatMessages.getCompareRowMessage(
            side,
            1,
          );
          await expect
            .soft(firstComparedMessage, ExpectedMessages.messageContentIsValid)
            .toHaveText(updatedRequestContent);
        }
      },
    );

    await dialTest.step(
      'Edit left chat title and verify it is updated in the header',
      async () => {
        const newLeftChatName = GeneratorUtil.randomString(7);
        await conversations.openEntityDropdownMenu(updatedRequestContent, 1);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await conversations.editConversationNameWithTick(newLeftChatName);

        const chatTitle = await leftChatHeader.chatTitle.getElementContent();
        expect
          .soft(chatTitle, ExpectedMessages.headerTitleCorrespondRequest)
          .toBe(chatTitle);
      },
    );

    await dialTest.step(
      'Delete right chat and compare mode closed, left chat is active',
      async () => {
        await conversations.openEntityDropdownMenu(updatedRequestContent);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await conversations
          .getEntityByName(updatedRequestContent)
          .waitFor({ state: 'hidden' });
        await expect
          .soft(compare.getElementLocator(), ExpectedMessages.compareModeClosed)
          .toBeHidden();
      },
    );
  },
);
