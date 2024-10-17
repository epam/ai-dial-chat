import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  Theme,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
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
    recentEntities,
    playbackControl,
    chat,
    chatMessages,
    chatHeader,
    setTestIds,
    iconApiHelper,
    dataInjector,
    chatHeaderAssertion,
  }) => {
    setTestIds('EPMRTC-1417', 'EPMRTC-1418', 'EPMRTC-1422');
    let theme: string;
    let conversation: Conversation;
    const conversationModels = [defaultModel, nonDefaultModel];
    let playbackConversationName: string;

    const expectedDefaultModelIcon = iconApiHelper.getEntityIcon(defaultModel);
    const expectedSecondModelIcon = iconApiHelper.getEntityIcon(nonDefaultModel);

    await dialTest.step(
      'Prepare conversation to playback based on different models',
      async () => {
        conversation =
          conversationData.prepareConversationWithDifferentModels(
            conversationModels,
          );

        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);

        theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
        await localStorageManager.setSettings(theme);
      },
    );

    await dialTest.step(
      'Select Playback option from conversation dropdown menu and verify new Playback chat is created and button are available at the bottom of main screen',
      async () => {
        playbackConversationName = `[${MenuOptions.playback}] ${conversation.name}`;
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.playback);

        await conversations.getEntityByName(playbackConversationName).waitFor();

        const expectedButtonBorderColor =
          theme === Theme.light
            ? Colors.controlsBackgroundAccentPrimary
            : Colors.controlsBackgroundAccent;
        const modelBorderColors =
          await recentEntities.playbackButton.getAllBorderColors();
        Object.values(modelBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.playbackIconIsSelected)
              .toBe(expectedButtonBorderColor);
          });
        });

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
        await recentEntities.waitForState();
        await chatHeader.waitForState({ state: 'hidden' });
        playbackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(conversation.messages[0].content);

        await chat.playPreviousChatMessage();
        await recentEntities.waitForState();
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
    localStorageManager,
    dataInjector,
    conversationData,
    conversations,
    playbackControl,
    chat,
    chatMessages,
    page,
    chatHeader,
    talkToSelector,
    setTestIds,
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
          defaultModel,
          ['1st request', '2nd request'],
        );
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);

        await dataInjector.createConversations([
          conversation,
          playbackConversation,
        ]);
        await localStorageManager.setSelectedConversation(playbackConversation);
      },
    );

    await dialTest.step(
      'Play Next message using hot keys and verify chat messages replayed, bottom playback controls are updated',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations
          .getEntityByName(playbackConversation.name)
          .waitFor();

        for (let i = 0; i < playNextKeys.length; i++) {
          await chat.playChatMessageWithKey(playNextKeys[i]);
          const messagesCount =
            await chatMessages.chatMessages.getElementsCount();
          const isPlaybackPreviousBtnEnabled =
            await playbackControl.playbackPreviousButton.isElementEnabled();
          const playBackMessage = await playbackControl
            .getPlaybackMessage()
            .getPlaybackMessageContent();

          if (i % 2 === 0) {
            expect
              .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
              .toBe(i);
            expect
              .soft(
                isPlaybackPreviousBtnEnabled,
                ExpectedMessages.playbackPreviousButtonEnabled,
              )
              .toBeTruthy();
            expect
              .soft(
                playBackMessage,
                ExpectedMessages.playbackChatMessageIsValid,
              )
              .toBe(conversation.messages[i].content);
          } else {
            expect
              .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
              .toBe(i + 1);
            expect
              .soft(
                isPlaybackPreviousBtnEnabled,
                ExpectedMessages.playbackPreviousButtonEnabled,
              )
              .toBeTruthy();
            expect
              .soft(
                playBackMessage,
                ExpectedMessages.playbackChatMessageIsValid,
              )
              .toBe(ExpectedConstants.emptyPlaybackMessage);
            const lastMessage = await chatMessages.getLastMessageContent();
            expect
              .soft(lastMessage, ExpectedMessages.messageContentIsValid)
              .toBe(conversation.messages[i].content);
            await chatHeader.leavePlaybackMode.waitForState();
          }

          const isPlaybackNextBtnEnabled =
            await playbackControl.playbackNextButton.isElementEnabled();
          if (i !== playNextKeys.length - 1) {
            expect
              .soft(
                isPlaybackNextBtnEnabled,
                ExpectedMessages.playbackNextButtonEnabled,
              )
              .toBeTruthy();
          } else {
            expect
              .soft(
                isPlaybackNextBtnEnabled,
                ExpectedMessages.playbackNextButtonDisabled,
              )
              .toBeFalsy();
          }
        }
      },
    );

    await dialTest.step(
      'Press again Play Next message hot key and verify no updates happen',
      async () => {
        await page.keyboard.press(playNextKeys[0]);
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(conversation.messages.length);
        await chatHeader.leavePlaybackMode.waitForState();

        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonEnabled,
          )
          .toBeTruthy();

        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonDisabled,
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
      'Play Previous message using hot keys and verify chat messages replayed back, bottom playback controls are updated',
      async () => {
        for (let i = 0; i < playPreviousKeys.length; i++) {
          await chat.playChatMessageWithKey(playPreviousKeys[i]);
          const playBackMessage = await playbackControl
            .getPlaybackMessage()
            .getPlaybackMessageContent();

          if (i % 2 === 0) {
            const messagesCount =
              await chatMessages.chatMessages.getElementsCount();
            expect
              .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
              .toBe(conversation.messages.length / 2 - i);

            expect
              .soft(
                playBackMessage,
                ExpectedMessages.playbackChatMessageIsValid,
              )
              .toBe(
                conversation.messages[conversation.messages.length / 2 - i]
                  .content,
              );
          } else {
            expect
              .soft(
                playBackMessage,
                ExpectedMessages.playbackChatMessageIsValid,
              )
              .toBe(ExpectedConstants.emptyPlaybackMessage);
          }
        }

        await talkToSelector.waitForState();
        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonEnabled,
          )
          .toBeTruthy();

        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonEnabled,
          )
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Press again Play Previous message hot key and verify no updates happen',
      async () => {
        await page.keyboard.press(playPreviousKeys[0]);
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(0);
        await chatHeader.leavePlaybackMode.waitForState({ state: 'hidden' });

        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonDisabled,
          )
          .toBeFalsy();

        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonEnabled,
          )
          .toBeTruthy();

        const playBackMessage = await playbackControl
          .getPlaybackMessage()
          .getPlaybackMessageContent();
        expect
          .soft(playBackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(ExpectedConstants.emptyPlaybackMessage);
      },
    );
  },
);

dialTest(
  'Playback: exit the mode at the end of playback',
  async ({
    dialHomePage,
    localStorageManager,
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
  }) => {
    setTestIds('EPMRTC-1425');
    let conversation: Conversation;
    let playbackConversation: Conversation;

    await dialTest.step(
      'Prepare playback conversation based on 2 requests and played back till the last message',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          defaultModel,
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
        await localStorageManager.setSelectedConversation(playbackConversation);
      },
    );

    await dialTest.step(
      'Click Stop Playback and verify chat messages input is available',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel!.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
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
    localStorageManager,
    dataInjector,
    conversationData,
    conversations,
    chat,
    chatMessages,
    sendMessage,
    playbackControl,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1427', 'EPMRTC-1470', 'EPMRTC-1473', 'EPMRTC-1428');
    let conversation: Conversation;
    let playbackConversation: Conversation;

    await dialTest.step(
      'Prepare playback conversation based on several long requests',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          defaultModel,
          [GeneratorUtil.randomString(3000)],
        );
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);

        await dataInjector.createConversations([
          conversation,
          playbackConversation,
        ]);
        await localStorageManager.setSelectedConversation(playbackConversation);
      },
    );

    await dialTest.step('Verify playback next message has scroll', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.getEntityByName(playbackConversation.name).waitFor();
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
        await expect(
          chatMessages.loadingCursor.getElementLocator(),
          ExpectedMessages.playbackNextMessageIsScrollable,
        ).toBeVisible();
        await expect(
          playbackControl.playbackNextButton.getElementLocator(),
          ExpectedMessages.playbackNextMessageIsScrollable,
        ).toBeDisabled();

        await sendMessage.waitForMessageInputLoaded();
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
