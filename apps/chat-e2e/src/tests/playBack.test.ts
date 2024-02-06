import { Conversation } from '@/chat/types/chat';
import { OpenAIEntityModel } from '@/chat/types/openai';
import test from '@/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
  Theme,
} from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: OpenAIEntityModel;
let gpt4Model: OpenAIEntityModel;

test.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
});

// TODO: redo after new changes in playback
test.skip(
  'Playback: first screen.\n' +
    'Playback: move to the next using next button.\n' +
    'Playback: move to the previous using back button',
  async ({
    dialHomePage,
    localStorageManager,
    conversationData,
    conversations,
    conversationDropdownMenu,
    playback,
    playbackControl,
    chat,
    chatMessages,
    chatHeader,
    setTestIds,
    iconApiHelper,
  }) => {
    setTestIds('EPMRTC-1417', 'EPMRTC-1418', 'EPMRTC-1422');
    let conversation: Conversation;
    const conversationModels = [defaultModel, gpt4Model];
    let playbackConversationName: string;

    const expectedDefaultModelIcon =
      await iconApiHelper.getEntityIcon(defaultModel);
    const expectedSecondModelIcon =
      await iconApiHelper.getEntityIcon(gpt4Model);

    await test.step('Prepare conversation to playback based on different models', async () => {
      conversation =
        conversationData.prepareConversationWithDifferentModels(
          conversationModels,
        );
      await localStorageManager.setConversationHistory(conversation);
      await localStorageManager.setSelectedConversation(conversation);

      const theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
      await localStorageManager.setSettings(theme);
    });

    await test.step('Select Playback option from conversation dropdown menu and verify new Playback chat is created and button are available at the bottom of main screen', async () => {
      playbackConversationName = `[${MenuOptions.playback}] ${conversation.name}`;
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.openConversationDropdownMenu(conversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.playback);

      await conversations
        .getConversationByName(playbackConversationName)
        .waitFor();

      const appTitle = await playback.appTitle.getElementContent();
      expect
        .soft(appTitle!.length, ExpectedMessages.appNameIsValid)
        .toBeGreaterThan(0);

      const chatTitle = await playback.chatTitle.getElementContent();
      expect
        .soft(chatTitle, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(playbackConversationName);

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

      const playbackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(ExpectedConstants.emptyPlaybackMessage);
    });

    await test.step('Click on Next button and verify text content updated', async () => {
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

      const playbackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(conversation.messages[0].content);
    });

    await test.step('Click on Next button and verify chat header, history and bottom controls are updated', async () => {
      await chat.playNextChatMessage();
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
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

      const playBackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playBackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(ExpectedConstants.emptyPlaybackMessage);

      const headerTitle = await chatHeader.chatTitle.getElementInnerContent();
      expect
        .soft(headerTitle, ExpectedMessages.headerTitleCorrespondRequest)
        .toBe(playbackConversationName);

      const headerModelIcon = await chatHeader.getHeaderModelIcon();
      expect
        .soft(headerModelIcon, ExpectedMessages.entityIconIsValid)
        .toBe(expectedDefaultModelIcon);

      const isConversationHasPlaybackIcon =
        await conversations.isConversationHasPlaybackIcon(
          playbackConversationName,
        );
      expect
        .soft(
          isConversationHasPlaybackIcon,
          ExpectedMessages.chatBarConversationIconIsPlayback,
        )
        .toBeTruthy();
    });

    await test.step('Click on Next button again twice and verify chat header icon updated, history contains all messages and Next button disabled on bottom controls', async () => {
      await chat.playNextChatMessage();
      const playBackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playBackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(conversation.messages[2].content);

      await chat.playNextChatMessage();
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
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

      const playbackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(ExpectedConstants.emptyPlaybackMessage);

      const headerTitle = await chatHeader.chatTitle.getElementInnerContent();
      expect
        .soft(headerTitle, ExpectedMessages.headerTitleCorrespondRequest)
        .toBe(playbackConversationName);

      const headerIcon = await chatHeader.getHeaderModelIcon();
      expect
        .soft(headerIcon, ExpectedMessages.entityIconIsValid)
        .toBe(expectedSecondModelIcon);

      const isConversationHasPlaybackIcon =
        await conversations.isConversationHasPlaybackIcon(
          playbackConversationName,
        );
      expect
        .soft(
          isConversationHasPlaybackIcon,
          ExpectedMessages.chatBarConversationIconIsPlayback,
        )
        .toBeTruthy();
    });

    await test.step('Click on Back button and verify chat header icon updated, history contains first request/response, Next button is enabled on bottom controls', async () => {
      await chat.playPreviousChatMessage();
      const isPlaybackNextBtnEnabled =
        await playbackControl.playbackNextButton.isElementEnabled();
      expect
        .soft(
          isPlaybackNextBtnEnabled,
          ExpectedMessages.playbackNextButtonEnabled,
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

      //bug??
      const playbackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(ExpectedConstants.emptyPlaybackMessage);
    });

    await test.step('Click on Back button and verify chat header icon updated, history contains first request/response, Next button is enabled on bottom controls', async () => {
      await chat.playPreviousChatMessage();
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
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

      const playbackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(ExpectedConstants.emptyPlaybackMessage);

      const headerTitle = await chatHeader.chatTitle.getElementInnerContent();
      expect
        .soft(headerTitle, ExpectedMessages.headerTitleCorrespondRequest)
        .toBe(playbackConversationName);

      const headerModelIcon = await chatHeader.getHeaderModelIcon();
      expect
        .soft(headerModelIcon, ExpectedMessages.entityIconIsValid)
        .toBe(expectedDefaultModelIcon);

      const isConversationHasPlaybackIcon =
        await conversations.isConversationHasPlaybackIcon(
          playbackConversationName,
        );
      expect
        .soft(
          isConversationHasPlaybackIcon,
          ExpectedMessages.chatBarConversationIconIsPlayback,
        )
        .toBeTruthy();
    });

    await test.step('Click on Back button again twice and verify chat header icon updated, history is empty and Back button is disabled on bottom controls', async () => {
      await chat.playPreviousChatMessage();
      let playBackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playBackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(conversation.messages[2].content);

      await chat.playPreviousChatMessage();
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
        .toBe(0);

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

      playBackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playBackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(ExpectedConstants.emptyPlaybackMessage);

      await chatHeader.waitForState({ state: 'hidden' });

      const isConversationHasPlaybackIcon =
        await conversations.isConversationHasPlaybackIcon(
          playbackConversationName,
        );
      expect
        .soft(
          isConversationHasPlaybackIcon,
          ExpectedMessages.chatBarConversationIconIsPlayback,
        )
        .toBeTruthy();
    });
  },
);

test(
  'Playback: move to the next using hot keys.\n' +
    'Playback: move to the previous using hot keys',
  async ({
    dialHomePage,
    localStorageManager,
    conversationData,
    conversations,
    playbackControl,
    chat,
    chatMessages,
    page,
    chatHeader,
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

    await test.step('Prepare playback conversation based on 4 requests', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        ['1st request', '2nd request', '3rd request', '4th request'],
      );
      conversationData.resetData();
      playbackConversation =
        conversationData.prepareDefaultPlaybackConversation(conversation);

      await localStorageManager.setConversationHistory(
        conversation,
        playbackConversation,
      );
      await localStorageManager.setSelectedConversation(playbackConversation);
    });

    await test.step('Play Next message using hot keys and verify chat messages replayed, bottom playback controls are updated', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations
        .getConversationByName(playbackConversation.name)
        .waitFor();

      for (let i = 0; i < playNextKeys.length; i++) {
        await chat.playChatMessageWithKey(playNextKeys[i]);
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(2 + i * 2);

        const lastMessage = await chatMessages.getLastMessageContent();
        expect
          .soft(lastMessage, ExpectedMessages.messageContentIsValid)
          .toBe(conversation.messages[1 + i * 2].content);

        await chatHeader.leavePlaybackMode.waitForState();

        const isPlaybackPreviousBtnEnabled =
          await playbackControl.playbackPreviousButton.isElementEnabled();
        expect
          .soft(
            isPlaybackPreviousBtnEnabled,
            ExpectedMessages.playbackPreviousButtonEnabled,
          )
          .toBeTruthy();

        if (i !== playNextKeys.length - 1) {
          const isPlaybackNextBtnEnabled =
            await playbackControl.playbackNextButton.isElementEnabled();
          expect
            .soft(
              isPlaybackNextBtnEnabled,
              ExpectedMessages.playbackNextButtonEnabled,
            )
            .toBeTruthy();

          const playBackMessage =
            await playbackControl.playbackMessage.getElementContent();
          expect
            .soft(playBackMessage, ExpectedMessages.playbackChatMessageIsValid)
            .toBe(conversation.messages[2 + i * 2].content);
        } else {
          const isPlaybackNextBtnEnabled =
            await playbackControl.playbackNextButton.isElementEnabled();
          expect
            .soft(
              isPlaybackNextBtnEnabled,
              ExpectedMessages.playbackNextButtonDisabled,
            )
            .toBeFalsy();

          const playbackMessage =
            await playbackControl.playbackMessage.getElementContent();
          expect
            .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
            .toBe('');
        }
      }
    });

    await test.step('Press again Play Next message hot key and verify no updates happen', async () => {
      await page.keyboard.press(playNextKeys[0]);
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
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

      const playbackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe('');
    });

    await test.step('Play Previous message using hot keys and verify chat messages replayed back, bottom playback controls are updated', async () => {
      for (let i = playPreviousKeys.length - 1; i >= 0; i--) {
        await chat.playChatMessageWithKey(playPreviousKeys[i]);
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(i * 2);

        const isPlaybackNextBtnEnabled =
          await playbackControl.playbackNextButton.isElementEnabled();
        expect
          .soft(
            isPlaybackNextBtnEnabled,
            ExpectedMessages.playbackNextButtonEnabled,
          )
          .toBeTruthy();

        const playBackMessage =
          await playbackControl.playbackMessage.getElementContent();
        expect
          .soft(playBackMessage, ExpectedMessages.playbackChatMessageIsValid)
          .toBe(conversation.messages[i * 2].content);

        if (i !== 0) {
          const lastMessage = await chatMessages.getLastMessageContent();
          expect
            .soft(lastMessage, ExpectedMessages.messageContentIsValid)
            .toBe(conversation.messages[i * 2 - 1].content);

          await chatHeader.leavePlaybackMode.waitForState();

          const isPlaybackPreviousBtnEnabled =
            await playbackControl.playbackPreviousButton.isElementEnabled();
          expect
            .soft(
              isPlaybackPreviousBtnEnabled,
              ExpectedMessages.playbackPreviousButtonEnabled,
            )
            .toBeTruthy();
        } else {
          await chatHeader.leavePlaybackMode.waitForState({ state: 'hidden' });

          const isPlaybackPreviousBtnEnabled =
            await playbackControl.playbackPreviousButton.isElementEnabled();
          expect
            .soft(
              isPlaybackPreviousBtnEnabled,
              ExpectedMessages.playbackPreviousButtonDisabled,
            )
            .toBeFalsy();
        }
      }
    });

    await test.step('Press again Play Previous message hot key and verify no updates happen', async () => {
      await page.keyboard.press(playPreviousKeys[0]);
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
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

      const playBackMessage =
        await playbackControl.playbackMessage.getElementContent();
      expect
        .soft(playBackMessage, ExpectedMessages.playbackChatMessageIsValid)
        .toBe(conversation.messages[0].content);
    });
  },
);

test('Playback: exit the mode at the end of playback', async ({
  dialHomePage,
  localStorageManager,
  conversationData,
  conversations,
  chat,
  chatMessages,
  sendMessage,
  chatHeader,
  iconApiHelper,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1425');
  let conversation: Conversation;
  let playbackConversation: Conversation;

  await test.step('Prepare playback conversation based on 2 requests and played back till the last message', async () => {
    conversation = conversationData.prepareModelConversationBasedOnRequests(
      defaultModel,
      ['1+2=', '2+3='],
    );
    conversationData.resetData();
    playbackConversation = conversationData.prepareDefaultPlaybackConversation(
      conversation,
      conversation.messages.length,
    );

    await localStorageManager.setConversationHistory(
      conversation,
      playbackConversation,
    );
    await localStorageManager.setSelectedConversation(playbackConversation);
  });

  await test.step('Click Stop Playback and verify chat messages input is available', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations
      .getConversationByName(playbackConversation.name)
      .waitFor();
    await chatHeader.leavePlaybackMode.click();
    await sendMessage.messageInput.waitForState();
    await chat.sendRequestWithButton('3+4=');

    const messagesCount = await chatMessages.chatMessages.getElementsCount();
    expect
      .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
      .toBe(conversation.messages.length + 2);

    const expectedModelIcon = await iconApiHelper.getEntityIcon(defaultModel);
    const sentMessageIcon = await chatMessages.getIconAttributesForMessage(
      conversation.messages.length + 2,
    );
    expect
      .soft(sentMessageIcon, ExpectedMessages.entityIconIsValid)
      .toBe(expectedModelIcon);
  });
});

test(
  'Playback: auto-scroll.\n' +
    'Playback: huge user-message scrolled in message box.\n' +
    'Playback: response is shown in some time.\n' +
    "Playback: it's impossible to click on next button while the answer is in progress",
  async ({
    dialHomePage,
    localStorageManager,
    conversationData,
    conversations,
    chat,
    chatMessages,
    playbackControl,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1427', 'EPMRTC-1470', 'EPMRTC-1473', 'EPMRTC-1428');
    let conversation: Conversation;
    let playbackConversation: Conversation;

    await test.step('Prepare playback conversation based on several long requests', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [GeneratorUtil.randomString(3000), GeneratorUtil.randomString(2000)],
      );
      conversationData.resetData();
      playbackConversation =
        conversationData.prepareDefaultPlaybackConversation(conversation);

      await localStorageManager.setConversationHistory(
        conversation,
        playbackConversation,
      );
      await localStorageManager.setSelectedConversation(playbackConversation);
    });

    await test.step('Verify playback next message has scroll', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations
        .getConversationByName(playbackConversation.name)
        .waitFor();

      const isPlaybackNextMessageScrollable =
        await playbackControl.playbackMessage.isElementScrollableVertically();
      expect(
        isPlaybackNextMessageScrollable,
        ExpectedMessages.playbackNextMessageIsScrollable,
      ).toBeTruthy();
    });

    await test.step('Click Play Next message button and verify Play Next is not visible and cursor is blinking while response is loading, content auto-scrolled to the end of response', async () => {
      for (let i = 0; i < 2; i++) {
        await chat.playNextChatMessage(false);
        const isPlaybackNextBtnVisible =
          await playbackControl.playbackNextButton.isVisible();
        expect(
          isPlaybackNextBtnVisible,
          ExpectedMessages.playbackNextMessageIsHidden,
        ).toBeFalsy();

        const isResponseLoading = await chatMessages.isResponseLoading();
        expect
          .soft(isResponseLoading, ExpectedMessages.responseIsLoading)
          .toBeTruthy();

        await playbackControl.playbackNextButton.waitForState();
        const playedBackResponse = await chatMessages.getChatMessage(
          conversation.messages[i * 2 + 1].content,
        );
        expect(
          playedBackResponse,
          ExpectedMessages.playbackMessageIsInViewport,
        ).toBeInViewport();
        if (i == 0) {
          const isPlaybackNextMessageScrollable =
            await playbackControl.playbackMessage.isElementScrollableVertically();
          expect(
            isPlaybackNextMessageScrollable,
            ExpectedMessages.playbackNextMessageIsScrollable,
          ).toBeTruthy();
        }
      }
    });

    await test.step('Click Play Previous message button and verify cursor is not blinking, response is removing immediately', async () => {
      await chat.playPreviousChatMessage();
      const isResponseLoading = await chatMessages.isResponseLoading();
      expect
        .soft(isResponseLoading, ExpectedMessages.responseIsNotLoading)
        .toBeFalsy();
    });
  },
);
