import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, MenuOptions } from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Delete folder with conversation inside',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    conversationDropdownMenu,
    conversations,
    confirmationDialog,
    chatBarFolderAssertion,
  }) => {
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();
    await dataInjector.createConversations(
      conversationInFolder.conversations,
      conversationInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderConversations.openFolderDropdownMenu(
      conversationInFolder.folders.name,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    await chatBarFolderAssertion.assertFolderState(
      { name: conversationInFolder.folders.name },
      'hidden',
    );

    const todayConversationsCount = await conversations.getEntitiesCount();
    expect
      .soft(todayConversationsCount, ExpectedMessages.entitiesCountIsValid)
      .toBe(0);
  },
);
