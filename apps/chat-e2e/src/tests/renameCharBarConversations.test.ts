import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let gpt35Model: DialAIEntityModel;
dialTest.beforeAll(async () => {
  gpt35Model = ModelsUtil.getDefaultModel()!;
});

dialTest(
  'Rename chat. Cancel.\n' +
    'Long Chat name is cut. Named automatically by the system.\n' +
    'Long chat name while delete and edit',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    localStorageManager,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-588', 'EPMRTC-816', 'EPMRTC-1494');
    const newName = 'new name to cancel';
    let conversation: Conversation;
    const conversationName = GeneratorUtil.randomString(70);

    await dialTest.step('Prepare conversation with long name', async () => {
      conversation = conversationData.prepareDefaultConversation(
        gpt35Model,
        conversationName,
      );
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Open app and verify conversation name is truncated in the side panel',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Hover over conversation name and verify it is truncated when menu dots appear',
      async () => {
        await conversations.getConversationByName(conversationName).hover();
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Select "Rename" from chat menu and verify it is truncated, cursor set at the end',
      async () => {
        await conversations.openConversationDropdownMenu(conversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(undefined);
      },
    );

    await dialTest.step(
      'Set new conversation name, cancel edit and verify conversation with initial name shown',
      async () => {
        const nameInput = await conversations.openEditConversationNameMode(
          conversation.name,
          newName,
        );
        await nameInput.clickCancelButton();
        expect
          .soft(
            await conversations.getConversationByName(newName).isVisible(),
            ExpectedMessages.conversationNameNotUpdated,
          )
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Select "Delete" from conversation menu and verify its name is truncated when menu dots appear',
      async () => {
        await conversations.openConversationDropdownMenu(conversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );
  },
);

dialTest(
  'Rename chat before starting the conversation.\n' +
    'Long Chat name is cut. Named manually',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    chat,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-584', 'EPMRTC-819');
    const newName = GeneratorUtil.randomString(70);
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await conversations.openConversationDropdownMenu(
      ExpectedConstants.newConversationTitle,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
    await conversations.editConversationNameWithTick(
      ExpectedConstants.newConversationTitle,
      newName,
    );
    expect
      .soft(
        await conversations.getConversationByName(newName).isVisible(),
        ExpectedMessages.conversationNameUpdated,
      )
      .toBeTruthy();

    const chatNameOverflow = await conversations
      .getConversationName(newName)
      .getComputedStyleProperty(Styles.text_overflow);
    expect
      .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
      .toBe(Overflow.ellipsis);

    await chat.sendRequestWithButton('one more test message');
    expect
      .soft(
        await conversations.getConversationByName(newName).isVisible(),
        ExpectedMessages.conversationNameUpdated,
      )
      .toBeTruthy();
  },
);

dialTest(
  'Rename chat after starting the conversation.\n' +
    'Long Chat name is cut in chat header. Named manually.\n' +
    'Tooltip shows full long chat name in chat header. Named manually.\n' +
    'Long chat name is cut in chat header. Named automatically by the system.\n' +
    'Tooltip shows full long chat name in chat header. Named automatically by the system',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    localStorageManager,
    chatHeader,
    tooltip,
    setTestIds,
    errorPopup,
  }) => {
    setTestIds(
      'EPMRTC-585',
      'EPMRTC-821',
      'EPMRTC-822',
      'EPMRTC-818',
      'EPMRTC-820',
    );
    const newName = GeneratorUtil.randomString(60);
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createConversations([conversation]);
    await localStorageManager.setSelectedConversation(conversation);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(conversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
    await conversations.editConversationNameWithEnter(
      conversation.name,
      newName,
    );
    expect
      .soft(
        await conversations.getConversationByName(newName).isVisible(),
        ExpectedMessages.conversationNameUpdated,
      )
      .toBeTruthy();

    const isChatHeaderTitleTruncated =
      await chatHeader.chatTitle.isElementWidthTruncated();
    expect
      .soft(
        isChatHeaderTitleTruncated,
        ExpectedMessages.chatHeaderTitleTruncated,
      )
      .toBeTruthy();
    await errorPopup.cancelPopup();
    await chatHeader.chatTitle.hoverOver();
    const tooltipChatHeaderTitle = await tooltip.getContent();
    expect
      .soft(
        tooltipChatHeaderTitle,
        ExpectedMessages.headerTitleCorrespondRequest,
      )
      .toBe(newName);

    const isTooltipChatHeaderTitleTruncated =
      await tooltip.isElementWidthTruncated();
    expect
      .soft(
        isTooltipChatHeaderTitleTruncated,
        ExpectedMessages.headerTitleIsFullyVisible,
      )
      .toBeFalsy();
  },
);
