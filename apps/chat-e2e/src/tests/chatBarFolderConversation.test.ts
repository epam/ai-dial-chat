import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Create new chat folder.\n' +
    'Share option is unavailable in chat folder if there is no any chat inside',
  async ({
    dialHomePage,
    chatBar,
    folderConversations,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-569', 'EPMRTC-2005');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await chatBar.createNewFolder();
    expect
      .soft(
        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .isVisible(),
        ExpectedMessages.newFolderCreated,
      )
      .toBeTruthy();

    await folderConversations.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    const actualMenuOptions = await folderDropdownMenu.getAllMenuOptions();
    expect
      .soft(actualMenuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual([MenuOptions.rename, MenuOptions.delete]);
  },
);

dialTest(
  'Folders can expand and collapse.\n',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-579');
    let conversationInFolder: FolderConversation;

    await dialTest.step('Prepare conversation inside folder', async () => {
      conversationInFolder = conversationData.prepareFolderWithConversations(1);
      await dataInjector.createConversations(
        conversationInFolder.conversations,
        conversationInFolder.folders,
      );
    });
    await dialTest.step(
      'Verify folder arrow icon is changes on expand/collapse folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        let isFolderCaretExpanded =
          await folderConversations.isFolderCaretExpanded(
            conversationInFolder.folders.name,
          );
        expect
          .soft(isFolderCaretExpanded, ExpectedMessages.folderCaretIsExpanded)
          .toBeFalsy();

        await folderConversations.expandCollapseFolder(
          conversationInFolder.folders.name,
        );
        isFolderCaretExpanded = await folderConversations.isFolderCaretExpanded(
          conversationInFolder.folders.name,
        );
        expect
          .soft(isFolderCaretExpanded, ExpectedMessages.folderCaretIsExpanded)
          .toBeTruthy();
      },
    );
  },
);
