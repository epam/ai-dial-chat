import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Colors, Overflow, Styles } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Chat is moved to folder created from Move to',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    localStorageManager,
    folderConversations,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-864');
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createConversations([conversation]);
    await localStorageManager.setSelectedConversation(conversation);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(conversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);
    await conversations.selectMoveToMenuOption(
      ExpectedConstants.newFolderTitle,
    );

    await folderConversations.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    const isFolderConversationVisible =
      await folderConversations.isFolderEntityVisible(
        ExpectedConstants.newFolderWithIndexTitle(1),
        conversation.name,
      );
    expect
      .soft(
        isFolderConversationVisible,
        ExpectedMessages.conversationMovedToFolder,
      )
      .toBeTruthy();

    const folderNameColor = await folderConversations.getFolderNameColor(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    expect
      .soft(folderNameColor[0], ExpectedMessages.folderNameColorIsValid)
      .toBe(Colors.textAccentSecondary);
  },
);

dialTest(
  'Chat is moved to folder from Move to list.\n' +
    'Long folder name is cut in Move to menu',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    localStorageManager,
    dataInjector,
    folderConversations,
    folderDropdownMenu,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-863', 'EPMRTC-942');
    const folderName = GeneratorUtil.randomString(70);
    let conversation: Conversation;

    await dialTest.step(
      'Prepare conversation and folder with long name to move conversation in',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);
      },
    );

    await dialTest.step(
      'Open "Move to" menu option for conversation and verify folder name is truncated',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.createNewFolder();
        await folderConversations.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
          1,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.editFolderNameWithEnter(
          ExpectedConstants.newFolderWithIndexTitle(1),
          folderName,
        );

        await conversations.openConversationDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);

        const moveToFolder =
          await conversationDropdownMenu.getMenuOption(folderName);
        await moveToFolder.waitForState();
        const moveToFolderOverflow =
          await moveToFolder.getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(moveToFolderOverflow[0], ExpectedMessages.folderNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Select folder name from menu and conversation is moved into folder',
      async () => {
        await conversations.selectMoveToMenuOption(folderName);
        await folderConversations.expandFolder(folderName);
        const isFolderConversationVisible =
          await folderConversations.isFolderEntityVisible(
            folderName,
            conversation.name,
          );
        expect
          .soft(
            isFolderConversationVisible,
            ExpectedMessages.conversationMovedToFolder,
          )
          .toBeTruthy();
      },
    );
  },
);
