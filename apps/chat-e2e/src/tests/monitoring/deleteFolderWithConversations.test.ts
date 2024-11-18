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
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await folderConversations.openFolderDropdownMenu(
      conversationInFolder.folders.name,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    await chatBarFolderAssertion.assertFolderState(
      { name: conversationInFolder.folders.name },
      'hidden',
    );

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(conversationInFolder.conversations[0].name),
        ExpectedMessages.conversationOfToday,
      )
      .toBeFalsy();
  },
);
