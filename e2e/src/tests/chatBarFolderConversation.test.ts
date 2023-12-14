import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/e2e/src/testData';
import { Overflow, Styles } from '@/e2e/src/ui/domData';
import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

test('Create new chat folder', async ({
  dialHomePage,
  chatBar,
  folderConversations,
  setTestIds,
}) => {
  setTestIds('EPMRTC-569');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await chatBar.createNewFolder();
  expect
    .soft(
      await folderConversations
        .getFolderByName(ExpectedConstants.newFolderTitle)
        .isVisible(),
      ExpectedMessages.newFolderCreated,
    )
    .toBeTruthy();
});

test(
  `Rename chat folder when it's empty using Enter.\n` +
    'Rename folders on nested levels',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    localStorageManager,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-571', 'EPMRTC-1371');
    const nestedFolders = conversationData.prepareNestedFolder(3);
    await localStorageManager.setFolders(...nestedFolders);
    await localStorageManager.setOpenedFolders(...nestedFolders);

    const newName = 'updated folder name';
    const randomFolder = GeneratorUtil.randomArrayElement(nestedFolders);
    const randomFolderIndex = nestedFolders.indexOf(randomFolder);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderConversations.openFolderDropdownMenu(randomFolder.name);
    await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
    await folderConversations.editFolderNameWithEnter(
      randomFolder.name,
      newName,
    );
    expect
      .soft(
        await folderConversations.getFolderByName(newName).isVisible(),
        ExpectedMessages.folderNameUpdated,
      )
      .toBeTruthy();

    for (let i = 0; i < nestedFolders.length; i++) {
      if (i !== randomFolderIndex) {
        expect
          .soft(
            await folderConversations
              .getFolderByName(nestedFolders[i].name)
              .isVisible(),
            ExpectedMessages.folderNameNotUpdated,
          )
          .toBeTruthy();
      }
    }
  },
);

test(`Cancel folder renaming on "x"`, async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  conversationDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-572');
  const newName = 'updated folder name';
  const folder = conversationData.prepareDefaultFolder();
  await localStorageManager.setFolders(folder);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.openFolderDropdownMenu(folder.name);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
  const folderInput = await folderConversations.editFolderName(
    folder.name,
    newName,
  );
  await folderInput.clickCancelButton();
  expect
    .soft(
      await folderConversations.getFolderByName(folder.name).isVisible(),
      ExpectedMessages.folderNameNotUpdated,
    )
    .toBeTruthy();
});

test(
  'Rename chat folder when chats are inside using check button\n' +
    'Long Folder name is cut',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    localStorageManager,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-573', 'EPMRTC-574');
    const folderName = GeneratorUtil.randomString(70);
    const newConversationName = 'updated folder name';

    await test.step('Prepare folder with long name and conversation inside folder', async () => {
      const conversationInFolder =
        conversationData.prepareDefaultConversationInFolder();
      conversationInFolder.folders.name = folderName;
      await localStorageManager.setFolders(conversationInFolder.folders);
      await localStorageManager.setConversationHistory(
        conversationInFolder.conversations[0],
      );
    });

    await test.step('Open app and verify folder name is truncated in the side panel', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      const folderNameOverflow = await folderConversations
        .getFolderName(folderName)
        .getComputedStyleProperty(Styles.text_overflow);
      expect
        .soft(folderNameOverflow[0], ExpectedMessages.folderNameIsTruncated)
        .toBe(Overflow.ellipsis);
    });

    await test.step('Hover over folder name and verify it is truncated when menu dots appear', async () => {
      await folderConversations.getFolderByName(folderName).hover();
      const folderNameOverflow = await folderConversations
        .getFolderName(folderName)
        .getComputedStyleProperty(Styles.text_overflow);
      expect
        .soft(folderNameOverflow[0], ExpectedMessages.folderNameIsTruncated)
        .toBe(Overflow.ellipsis);
    });

    await test.step('Open edit folder name mode and verify it is truncated', async () => {
      await folderConversations.openFolderDropdownMenu(folderName);
      await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
      const folderInputOverflow = await folderConversations
        .getFolderInput(folderName)
        .getComputedStyleProperty(Styles.text_overflow);
      expect
        .soft(folderInputOverflow[0], ExpectedMessages.folderNameIsTruncated)
        .toBe(Overflow.ellipsis);
    });

    await test.step('Edit folder name using tick button and verify it is renamed', async () => {
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
    });
  },
);

test('Folders can expand and collapse', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  setTestIds,
}) => {
  setTestIds('EPMRTC-579');
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations[0],
  );
  const folderName = conversationInFolder.folders.name;

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.expandCollapseFolder(folderName);
  let isConversationVisible =
    await folderConversations.isFolderConversationVisible(
      folderName,
      conversationInFolder.conversations[0].name,
    );
  expect
    .soft(isConversationVisible, ExpectedMessages.folderExpanded)
    .toBeTruthy();

  await folderConversations.expandCollapseFolder(folderName);
  isConversationVisible = await folderConversations.isFolderConversationVisible(
    folderName,
    conversationInFolder.conversations[0].name,
  );
  expect
    .soft(isConversationVisible, ExpectedMessages.folderCollapsed)
    .toBeFalsy();
});

test(
  'Delete folder. Cancel.\n' + 'Delete root folder with nested folders',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    localStorageManager,
    conversationDropdownMenu,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-606', 'EPMRTC-1373');
    const nestedFolders = conversationData.prepareNestedFolder(3);
    await localStorageManager.setFolders(...nestedFolders);
    await localStorageManager.setOpenedFolders(...nestedFolders);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderConversations.openFolderDropdownMenu(nestedFolders[0].name);
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
          .getFolderByName(nestedFolders[0].name)
          .isVisible(),
        ExpectedMessages.folderNotDeleted,
      )
      .toBeTruthy();

    await folderConversations.openFolderDropdownMenu(nestedFolders[0].name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm();
    for (const nestedFolder of nestedFolders) {
      expect
        .soft(
          await folderConversations
            .getFolderByName(nestedFolder.name)
            .isVisible(),
          ExpectedMessages.folderDeleted,
        )
        .toBeFalsy();
    }
  },
);

test('Delete folder when there are some chats inside', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  conversationDropdownMenu,
  conversations,
  confirmationDialog,
  setTestIds,
}) => {
  setTestIds('EPMRTC-605');
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations[0],
  );

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.openFolderDropdownMenu(
    conversationInFolder.folders.name,
  );
  await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
  await confirmationDialog.confirm();
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
});

test('Delete nested folder with chat', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
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

  await test.step('Prepare nested folders with conversations inside each one', async () => {
    nestedFolders = conversationData.prepareNestedFolder(levelsCount);
    nestedConversations =
      conversationData.prepareConversationsForNestedFolders(nestedFolders);
    await localStorageManager.setFolders(...nestedFolders);
    await localStorageManager.setOpenedFolders(...nestedFolders);
    await localStorageManager.setConversationHistory(...nestedConversations);
  });

  await test.step('Delete 2nd level folder and verify all nested content is deleted as well', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderConversations.openFolderDropdownMenu(
      nestedFolders[levelToDelete].name,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm();

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
            .getFolderConversation(
              nestedFolders[i].name,
              nestedConversations[i].name,
            )
            .isVisible(),
          ExpectedMessages.conversationNotDeleted,
        )
        .toBeTruthy();
    }
  });
});
