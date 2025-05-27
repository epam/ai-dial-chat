import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  ThemeId,
} from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let allModels: DialAIEntityModel[];
let defaultModel: DialAIEntityModel;
let nonDefaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  allModels = ModelsUtil.getModels().filter((m) => m.iconUrl !== undefined);
  defaultModel = ModelsUtil.getDefaultModel()!;
  nonDefaultModel = GeneratorUtil.randomArrayElement(
    allModels.filter((m) => m.id !== defaultModel.id),
  );
});

dialTest(
  'Playback: first screen.\n' +
    'Playback: move to the next using next button.\n' +
    'Playback: move to the previous using back button',
  async ({
    dialHomePage,
    localStorageManager,
    conversationData,
    conversations,
    conversationDropdownMenu,
    playbackControl,
    chat,
    talkToAgentDialogAssertion,
    talkToAgentDialog,
    chatMessages,
    chatHeader,
    setTestIds,
    iconApiHelper,
    dataInjector,
    chatHeaderAssertion,
    agentInfo,
  }) => {
    setTestIds('EPMRTC-1417', 'EPMRTC-1418', 'EPMRTC-1422');
    let theme: string;
    let conversation: Conversation;
    const conversationModels = [defaultModel, nonDefaultModel];
    let playbackConversationName: string;

    const expectedDefaultModelIcon = iconApiHelper.getEntityIcon(defaultModel);
    const expectedSecondModelIcon =
      iconApiHelper.getEntityIcon(nonDefaultModel);

    await dialTest.step(
      'Prepare conversation to playback based on different models',
      async () => {
        conversation =
          conversationData.prepareConversationWithDifferentModels(
            conversationModels,
          );

        await dataInjector.createConversations([conversation]);

        theme = GeneratorUtil.randomArrayElement(Object.keys(ThemeId));
        await localStorageManager.setSettings(theme);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Select Playback option from conversation dropdown menu and verify new Playback chat is created and button are available at the bottom of main screen',
      async () => {
        playbackConversationName = `[${MenuOptions.playback}] ${conversation.name}`;
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.playback);
        await agentInfo.waitForState();
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertAgentIsSelected(
          ExpectedConstants.playbackLabel,
        );
        await talkToAgentDialog.cancelButton.click();

        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonEnabled,
          )
          .toBeTruthy();

        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonDisabled,
          )
          .toBeFalsy();

        const playbackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(ExpectedConstants.emptyPlaybackMessage);
      },
    );

    await dialTest.step(
      'Click on Next button and verify text content updated',
      async () => {
        await chat.playNextChatMessage();

        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonEnabled,
          )
          .toBeTruthy();

        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonDisabled,
          )
          .toBeTruthy();
        const playbackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(conversation.messages[0].content);
      },
    );

    await dialTest.step(
      'Click on Next button and verify chat header, history and bottom controls are updated',
      async () => {
        await chat.playNextChatMessage();
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(conversation.messages.length / 2);

        const lastMessage = await chatMessages.getLastMessageContent();
        expect
          .soft(lastMessage, ExpectedMessages.messageContentIsValid)
          .toBe(conversation.messages[1].content);

        await chatHeader.leavePlaybackMode.waitForState();
        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonEnabled,
          )
          .toBeTruthy();

        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonEnabled,
          )
          .toBeTruthy();

        const playBackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playBackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(ExpectedConstants.emptyPlaybackMessage);

        const headerTitle = await chatHeader.chatTitle.getElementInnerContent();
        expect
          .soft(headerTitle, ExpectedMessages.headerTitleCorrespondRequest)
          .toBe(playbackConversationName);

        await chatHeaderAssertion.assertHeaderIcon(expectedDefaultModelIcon);

        await expect
          .soft(
            conversations.getEntityPlaybackIcon(playbackConversationName),
            ExpectedMessages.chatBarConversationIconIsPlayback,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Click on Next button again twice and verify chat header icon updated, history contains all messages and Next button disabled on bottom controls',
      async () => {
        for (let i = 1; i <= 2; i++) {
          await chat.playNextChatMessage();
        }
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(conversation.messages.length);

        const lastMessage = await chatMessages.getLastMessageContent();
        expect
          .soft(lastMessage, ExpectedMessages.messageContentIsValid)
          .toBe(conversation.messages[3].content);

        await chatHeader.leavePlaybackMode.waitForState();

        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonDisabled,
          )
          .toBeFalsy();

        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonEnabled,
          )
          .toBeTruthy();

        const playbackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(ExpectedConstants.emptyPlaybackMessage);

        const headerTitle = await chatHeader.chatTitle.getElementInnerContent();
        expect
          .soft(headerTitle, ExpectedMessages.headerTitleCorrespondRequest)
          .toBe(playbackConversationName);

        await chatHeaderAssertion.assertHeaderIcon(expectedSecondModelIcon);

        await expect
          .soft(
            conversations.getEntityPlaybackIcon(playbackConversationName),
            ExpectedMessages.chatBarConversationIconIsPlayback,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Click on Back button and verify chat header icon updated, history contains first request/response, Next button is enabled on bottom controls',
      async () => {
        await chat.playPreviousChatMessage();
        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonEnabled,
          )
          .toBeTruthy();

        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonEnabled,
          )
          .toBeTruthy();

        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(conversation.messages.length / 2);

        const lastMessage = await chatMessages.getLastMessageContent();
        expect
          .soft(lastMessage, ExpectedMessages.messageContentIsValid)
          .toBe(conversation.messages[1].content);

        const playbackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(conversation.messages[2].content);

        await chatHeader.leavePlaybackMode.waitForState();

        const headerTitle = await chatHeader.chatTitle.getElementInnerContent();
        expect
          .soft(headerTitle, ExpectedMessages.headerTitleCorrespondRequest)
          .toBe(playbackConversationName);

        await chatHeaderAssertion.assertHeaderIcon(expectedDefaultModelIcon);

        await expect
          .soft(
            conversations.getEntityPlaybackIcon(playbackConversationName),
            ExpectedMessages.chatBarConversationIconIsPlayback,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Click on Back button till the end and verify chat header icon updated, conversation settings displayed and Back button is disabled on bottom controls',
      async () => {
        await chat.playPreviousChatMessage();
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(conversation.messages.length / 2);
        let playbackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(ExpectedConstants.emptyPlaybackMessage);

        await chat.playPreviousChatMessage();
        await agentInfo.waitForState();
        await chatHeader.waitForState({ state: 'hidden' });
        playbackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(conversation.messages[0].content);

        await chat.playPreviousChatMessage();
        await agentInfo.waitForState();
        playbackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(ExpectedConstants.emptyPlaybackMessage);

        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonEnabled,
          )
          .toBeTruthy();

        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonDisabled,
          )
          .toBeFalsy();

        await expect
          .soft(
            conversations.getEntityPlaybackIcon(playbackConversationName),
            ExpectedMessages.chatBarConversationIconIsPlayback,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Playback: move to the next using hot keys.\n' +
    'Playback: move to the previous using hot keys',
  async ({
    dialHomePage,
    dataInjector,
    conversationData,
    conversations,
    playbackControl,
    chat,
    chatMessages,
    page,
    chatHeader,
    agentInfo,
    setTestIds,
    localStorageManager,
    playbackAssertion,
    chatMessagesAssertion,
    chatHeaderAssertion,
  }) => {
    setTestIds('EPMRTC-1420', 'EPMRTC-1421');
    let conversation: Conversation;
    let playbackConversation: Conversation;
    const playNextKeys = [
      keys.space,
      keys.enter,
      keys.arrowDown,
      keys.arrowRight,
    ];
    const playPreviousKeys = [
      keys.arrowUp,
      keys.arrowLeft,
      keys.arrowUp,
      keys.arrowLeft,
    ];

    await dialTest.step(
      'Prepare playback conversation based on 2 requests',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          ['1st request', '2nd request'],
        );
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);

        await dataInjector.createConversations([
          conversation,
          playbackConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Play Next message using hot keys and verify chat messages replayed, bottom playback controls are updated',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(playbackConversation.name);
        await playbackAssertion.assertElementState(playbackControl, 'visible');

        for (let i = 0; i < playNextKeys.length; i++) {
          await chat.playChatMessageWithKey(playNextKeys[i]);

          if (i % 2 === 0) {
            await chatMessagesAssertion.assertMessagesCount(i);
            await playbackAssertion.assertElementActionabilityState(
              playbackControl.playbackPreviousButton,
              'enabled',
            );
            await playbackAssertion.assertPlaybackMessageContent(
              conversation.messages[i].content,
            );
          } else {
            await chatMessagesAssertion.assertMessagesCount(i + 1);
            await playbackAssertion.assertElementActionabilityState(
              playbackControl.playbackPreviousButton,
              'enabled',
            );
            await playbackAssertion.assertPlaybackMessageContent(
              ExpectedConstants.emptyPlaybackMessage,
            );
            const lastMessage = await chatMessages.getLastMessageContent();
            playbackAssertion.assertValue(
              lastMessage,
              conversation.messages[i].content,
              ExpectedMessages.messageContentIsValid,
            );
            await chatHeaderAssertion.assertElementState(
              chatHeader.leavePlaybackMode,
              'visible',
            );
          }

          if (i !== playNextKeys.length - 1) {
            await playbackAssertion.assertElementActionabilityState(
              playbackControl.playbackNextButton,
              'enabled',
            );
          } else {
            await playbackAssertion.assertElementActionabilityState(
              playbackControl.playbackNextButton,
              'disabled',
            );
          }
        }
      },
    );

    await dialTest.step(
      'Press again Play Next message hot key and verify no updates happen',
      async () => {
        await page.keyboard.press(playNextKeys[0]);
        await chatMessagesAssertion.assertMessagesCount(
          conversation.messages.length,
        );
        await chatHeaderAssertion.assertElementState(
          chatHeader.leavePlaybackMode,
          'visible',
        );
        await playbackAssertion.assertElementActionabilityState(
          playbackControl.playbackPreviousButton,
          'enabled',
        );
        await playbackAssertion.assertElementActionabilityState(
          playbackControl.playbackNextButton,
          'disabled',
        );
        await playbackAssertion.assertPlaybackMessageContent(
          ExpectedConstants.emptyPlaybackMessage,
        );
      },
    );

    await dialTest.step(
      'Play Previous message using hot keys and verify chat messages replayed back, bottom playback controls are updated',
      async () => {
        for (let i = 0; i < playPreviousKeys.length; i++) {
          await chat.playChatMessageWithKey(playPreviousKeys[i]);

          if (i % 2 === 0) {
            await chatMessagesAssertion.assertMessagesCount(
              conversation.messages.length / 2 - i,
            );
            await playbackAssertion.assertPlaybackMessageContent(
              conversation.messages[conversation.messages.length / 2 - i]
                .content,
            );
          } else {
            await playbackAssertion.assertPlaybackMessageContent(
              ExpectedConstants.emptyPlaybackMessage,
            );
          }
        }

        await playbackAssertion.assertElementState(agentInfo, 'visible');
        await playbackAssertion.assertElementActionabilityState(
          playbackControl.playbackNextButton,
          'enabled',
        );
        await playbackAssertion.assertElementActionabilityState(
          playbackControl.playbackPreviousButton,
          'disabled',
        );
      },
    );

    await dialTest.step(
      'Press again Play Previous message hot key and verify no updates happen',
      async () => {
        await page.keyboard.press(playPreviousKeys[0]);
        await chatMessagesAssertion.assertMessagesCount(0);
        await chatHeaderAssertion.assertElementState(
          chatHeader.leavePlaybackMode,
          'hidden',
        );

        await playbackAssertion.assertElementActionabilityState(
          playbackControl.playbackPreviousButton,
          'disabled',
        );
        await playbackAssertion.assertElementActionabilityState(
          playbackControl.playbackNextButton,
          'enabled',
        );
        await playbackAssertion.assertPlaybackMessageContent(
          ExpectedConstants.emptyPlaybackMessage,
        );
      },
    );
  },
);

dialTest(
  'Playback: exit the mode at the end of playback',
  async ({
    dialHomePage,
    dataInjector,
    conversationData,
    chat,
    chatMessages,
    chatMessagesAssertion,
    sendMessage,
    chatHeader,
    iconApiHelper,
    playbackControl,
    setTestIds,
    conversations,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1425');
    let conversation: Conversation;
    let playbackConversation: Conversation;

    await dialTest.step(
      'Prepare playback conversation based on 2 requests and played back till the last message',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          ['1+2=', '2+3='],
        );
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(
            conversation,
            conversation.messages.length,
          );

        await dataInjector.createConversations([
          conversation,
          playbackConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Click Stop Playback and verify chat messages input is available',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel!.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(playbackConversation.name);
        await chatHeader.leavePlaybackMode.click();
        await expect
          .soft(
            playbackControl.getElementLocator(),
            ExpectedMessages.playbackControlsHidden,
          )
          .toBeHidden();

        await sendMessage.messageInput.waitForState();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('3+4=');

        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(conversation.messages.length + 2);

        const expectedModelIcon = iconApiHelper.getEntityIcon(defaultModel);
        await chatMessagesAssertion.assertMessageIcon(
          conversation.messages.length + 2,
          expectedModelIcon,
        );
      },
    );
  },
);

dialTest(
  'Playback: auto-scroll.\n' +
    'Playback: huge user-message scrolled in message box.\n' +
    'Playback: response is shown in some time.\n' +
    "Playback: it's impossible to click on next button while the answer is in progress",
  async ({
    dialHomePage,
    dataInjector,
    conversationData,
    conversations,
    chat,
    chatMessages,
    sendMessage,
    playbackControl,
    baseAssertion,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1427', 'EPMRTC-1470', 'EPMRTC-1473', 'EPMRTC-1428');
    let conversation: Conversation;
    let playbackConversation: Conversation;

    await dialTest.step(
      'Prepare playback conversation based on several long requests',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          [GeneratorUtil.randomString(3000)],
        );
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);

        await dataInjector.createConversations([
          conversation,
          playbackConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step('Verify playback next message has scroll', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.selectEntity(playbackConversation.name);
      await chat.playNextChatMessage();
      const isPlaybackNextMessageScrollable = await playbackControl
        .getPlaybackMessage()
        .isElementScrollableVertically();
      expect(
        isPlaybackNextMessageScrollable,
        ExpectedMessages.playbackNextMessageIsScrollable,
      ).toBeTruthy();
    });

    await dialTest.step(
      'Click Play Next message button and verify Play Next is not visible and cursor is blinking while response is loading, content auto-scrolled to the end of response',
      async () => {
        await dialHomePage.throttleAPIResponse('**/*');
        await chat.playNextChatMessage(false);
        await baseAssertion.assertElementState(
          chatMessages.loadingCursor,
          'visible',
        );
        await baseAssertion.assertElementActionabilityState(
          playbackControl.playbackNextButton,
          'disabled',
        );
        await baseAssertion.assertElementState(
          sendMessage.messageInputSpinner,
          'hidden',
        );
        await chatMessages.waitForResponseReceived();

        const playedBackResponse = chatMessages.getChatMessage(
          conversation.messages[1].content,
        );
        await expect(
          playedBackResponse,
          ExpectedMessages.playbackMessageIsInViewport,
        ).toBeInViewport();

        await dialHomePage.unRouteAllResponses();
      },
    );

    await dialTest.step(
      'Click Play Previous message button and verify cursor is not blinking, response is deleting immediately',
      async () => {
        await chatMessages.waitForResponseReceived();
        await chat.playPreviousChatMessage();
        const isResponseLoading = await chatMessages.isResponseLoading();
        expect
          .soft(isResponseLoading, ExpectedMessages.responseIsNotLoading)
          .toBeFalsy();
      },
    );
  },
);
