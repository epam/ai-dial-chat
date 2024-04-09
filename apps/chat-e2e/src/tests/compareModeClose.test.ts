import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  Side,
} from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

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
    compareConversationSelector,
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
        await conversations.openConversationDropdownMenu(
          modelConversation.name,
          3,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversation.checkShowAllConversations();
        await compareConversationSelector.click();

        const selectorPlaceholder =
          await compareConversationSelector.getSelectorPlaceholder();
        expect
          .soft(selectorPlaceholder, ExpectedMessages.noConversationsAvailable)
          .toBe(ExpectedConstants.noConversationsAvailable);

        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([]);
      },
    );

    await dialTest.step(
      'Open another conversation and verify compare mode is closed',
      async () => {
        await conversations.selectConversation(replayConversation.name);
        const isCompareModeOn = await compare.isVisible();
        expect
          .soft(isCompareModeOn, ExpectedMessages.compareModeClosed)
          .toBeFalsy();
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

        const isCompareModeOn = await compare.isVisible();
        expect
          .soft(isCompareModeOn, ExpectedMessages.compareModeClosed)
          .toBeFalsy();

        const activeChatHeader =
          await leftChatHeader.chatTitle.getElementContent();
        expect
          .soft(activeChatHeader, ExpectedMessages.headerTitleIsValid)
          .toBe(activeChat);
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
    compareConversationSelector,
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
        const isCompareModeOn = await compare.isVisible();
        expect
          .soft(isCompareModeOn, ExpectedMessages.compareModeClosed)
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Open compare mode for 1st conversation and verify long compare options are shown in different rows',
      async () => {
        await conversations.openConversationDropdownMenu(
          firstConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);

        const isDeleteConversationIconVisible =
          await leftChatHeader.deleteConversationFromComparison.isVisible();
        expect
          .soft(
            isDeleteConversationIconVisible,
            ExpectedMessages.closeChatIconIsNotVisible,
          )
          .toBeFalsy();

        await compareConversationSelector.click();
        const overflowProp =
          await compareConversationSelector.listbox.getComputedStyleProperty(
            Styles.overflow_x,
          );
        expect
          .soft(overflowProp[0], ExpectedMessages.entityNameIsTruncated)
          .toBe(Overflow.auto);
      },
    );
  },
);
