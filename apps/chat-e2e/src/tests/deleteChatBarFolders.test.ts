import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Delete folder. Cancel.\n' + 'Delete root folder with nested folders',
  async ({
    dialHomePage,
    folderConversations,
    conversationDropdownMenu,
    confirmationDialog,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-606', 'EPMRTC-1373');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();

    for (let i = 1; i <= 3; i++) {
      await chatBar.createNewFolder();
    }
    for (let i = 3; i >= 2; i--) {
      await chatBar.dragAndDropEntityToFolder(
        folderConversations.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i),
        ),
        folderConversations.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i - 1),
        ),
      );
    }
    await folderConversations.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(2),
    );

    await folderConversations.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    expect
      .soft(
        await confirmationDialog.getConfirmationMessage(),
        ExpectedMessages.confirmationMessageIsValid,
      )
      .toBe(ExpectedConstants.deleteFolderMessage);

    await confirmationDialog.cancelDialog();
    expect
      .soft(
        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .isVisible(),
        ExpectedMessages.folderNotDeleted,
      )
      .toBeTruthy();

    await folderConversations.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm();
    for (let i = 2; i <= 3; i++) {
      await folderConversations
        .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
        .waitFor({ state: 'hidden' });
    }
  },
);

dialTest(
  'Delete folder when there are some chats inside',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    conversationDropdownMenu,
    conversations,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-605');
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
    expect
      .soft(
        await folderConversations
          .getFolderByName(conversationInFolder.folders.name)
          .isVisible(),
        ExpectedMessages.folderDeleted,
      )
      .toBeFalsy();

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(conversationInFolder.conversations[0].name),
        ExpectedMessages.conversationOfToday,
      )
      .toBeFalsy();
  },
);

dialTest(
  'Delete nested folder with chat',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    conversationDropdownMenu,
    conversations,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1372');
    const levelsCount = 3;
    const levelToDelete = 2;
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];

    await dialTest.step(
      'Prepare nested folders with conversations inside each one',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(levelsCount);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Delete 2nd level folder and verify all nested content is deleted as well',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.openFolderDropdownMenu(
          nestedFolders[levelToDelete].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        for (let i = levelToDelete; i <= levelsCount; i++) {
          expect
            .soft(
              await folderConversations
                .getFolderByName(nestedFolders[i].name)
                .isVisible(),
              ExpectedMessages.folderDeleted,
            )
            .toBeFalsy();
          expect
            .soft(
              await conversations
                .getConversationByName(nestedConversations[i].name)
                .isVisible(),
              ExpectedMessages.conversationDeleted,
            )
            .toBeFalsy();
        }

        for (let i = 0; i <= levelsCount - levelToDelete; i++) {
          expect
            .soft(
              await folderConversations
                .getFolderByName(nestedFolders[i].name)
                .isVisible(),
              ExpectedMessages.folderNotDeleted,
            )
            .toBeTruthy();
          expect
            .soft(
              await folderConversations
                .getFolderEntity(
                  nestedFolders[i].name,
                  nestedConversations[i].name,
                )
                .isVisible(),
              ExpectedMessages.conversationNotDeleted,
            )
            .toBeTruthy();
        }
      },
    );
  },
);
