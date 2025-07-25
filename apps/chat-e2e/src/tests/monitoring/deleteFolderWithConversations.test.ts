import dialTest from '@/src/core/dialFixtures';
import { MenuOptions } from '@/src/testData';

dialTest(
  'Delete folder with conversation inside',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    conversationDropdownMenu,
    confirmationDialog,
    chatBarFolderAssertion,
    conversationAssertion,
    localStorageManager,
  }) => {
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();
    await dataInjector.createConversations(
      conversationInFolder.conversations,
      conversationInFolder.folders,
    );
    await localStorageManager.setShowSideBarPanels();

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
    await conversationAssertion.assertEntitiesCount(0);
  },
);
