import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
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
  `Rename chat folder when it's empty using Enter.\n` +
    'Rename folders on nested levels',
  async ({
    dialHomePage,
    folderConversations,
    folderDropdownMenu,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-571', 'EPMRTC-1371');
    const newName = 'updated folder name';
    const randomFolderIndex = GeneratorUtil.randomNumberInRange(2) + 1;

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
      ExpectedConstants.newFolderWithIndexTitle(randomFolderIndex),
    );
    await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
    await folderConversations.editFolderNameWithEnter(
      ExpectedConstants.newFolderWithIndexTitle(randomFolderIndex),
      newName,
    );
    expect
      .soft(
        await folderConversations.getFolderByName(newName).isVisible(),
        ExpectedMessages.folderNameUpdated,
      )
      .toBeTruthy();

    for (let i = 1; i <= 3; i++) {
      if (i !== randomFolderIndex) {
        expect
          .soft(
            await folderConversations
              .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
              .isVisible(),
            ExpectedMessages.folderNameNotUpdated,
          )
          .toBeTruthy();
      }
    }
  },
);

dialTest(
  `Cancel folder renaming on "x"`,
  async ({
    dialHomePage,
    folderConversations,
    conversationDropdownMenu,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-572');
    const newName = 'updated folder name';
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatBar.createNewFolder();
    await folderConversations.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
    const folderInput = await folderConversations.editFolderName(
      ExpectedConstants.newFolderWithIndexTitle(1),
      newName,
    );
    await folderInput.clickCancelButton();
    expect
      .soft(
        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .isVisible(),
        ExpectedMessages.folderNameNotUpdated,
      )
      .toBeTruthy();
  },
);

dialTest(
  'Rename chat folder when chats are inside using check button\n' +
    'Long Folder name is cut',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-573', 'EPMRTC-574');
    const folderName = GeneratorUtil.randomString(70);
    const newConversationName = 'updated folder name';

    await dialTest.step(
      'Prepare folder with long name and conversation inside folder',
      async () => {
        const conversationInFolder =
          conversationData.prepareDefaultConversationInFolder(folderName);
        await dataInjector.createConversations(
          conversationInFolder.conversations,
          conversationInFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Open app and verify folder name is truncated in the side panel',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        const folderNameOverflow = await folderConversations
          .getFolderName(folderName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(folderNameOverflow[0], ExpectedMessages.folderNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Hover over folder name and verify it is truncated when menu dots appear',
      async () => {
        await folderConversations.getFolderByName(folderName).hover();
        const folderNameOverflow = await folderConversations
          .getFolderName(folderName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(folderNameOverflow[0], ExpectedMessages.folderNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Open edit folder name mode and verify it is truncated',
      async () => {
        await folderConversations.openFolderDropdownMenu(folderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        const folderInputOverflow = await folderConversations
          .getFolderInput(folderName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(folderInputOverflow[0], ExpectedMessages.folderNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Edit folder name using tick button and verify it is renamed',
      async () => {
        await folderConversations.editFolderNameWithTick(
          folderName,
          newConversationName,
        );
        expect
          .soft(
            await folderConversations
              .getFolderByName(newConversationName)
              .isVisible(),
            ExpectedMessages.folderNameUpdated,
          )
          .toBeTruthy();
      },
    );
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

    await dialTest.step('Create max nested folders structure', async () => {
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
    });

    await dialTest.step(
      'For root folder open dropdown menu, select "Delete" option, cancel delete and verify folder remains',
      async () => {
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
      },
    );

    await dialTest.step(
      'For root folder open dropdown menu, select "Delete" option, confirm delete and verify folder with all nested elements are deleted',
      async () => {
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

    await dialTest.step(
      'Create again root folder, expand and verify no nested elements available inside',
      async () => {
        await chatBar.createNewFolder();
        const foldersCount = await folderConversations.getFoldersCount();
        expect.soft(foldersCount, ExpectedMessages.foldersCountIsValid).toBe(1);
      },
    );
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
