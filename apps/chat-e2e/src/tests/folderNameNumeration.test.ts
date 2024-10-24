import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Chat folder: folder created from Move to is counted into default numeration.\n' +
    'Chat folder: numeration continues after 999.\n' +
    'Chat folder: renamed and deleted folders are not counted into default numeration',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    folderConversations,
    folderDropdownMenu,
    chatBar,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1628', 'EPMRTC-2948', 'EPMRTC-1629');
    let folderConversation: FolderConversation;
    let conversation: Conversation;
    const initFolderIndex = 999;
    const initialFolderName =
      ExpectedConstants.newFolderWithIndexTitle(initFolderIndex);
    const expectedFolderName = ExpectedConstants.newFolderWithIndexTitle(1000);
    const incrementedFolderName =
      ExpectedConstants.newFolderWithIndexTitle(1002);

    await dialTest.step(
      'Create conversation inside folder with default name and 3 digits',
      async () => {
        folderConversation =
          conversationData.prepareDefaultConversationInFolder(
            initialFolderName,
          );
        await dataInjector.createConversations(
          folderConversation.conversations,
          folderConversation.folders,
        );
        conversation = folderConversation.conversations[0];
      },
    );

    await dialTest.step(
      'Open conversation context menu, select Move -> New Folder option and verify conversation is moved to the folder with index 1000',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(initialFolderName);
        await folderConversations.selectFolderEntity(
          initialFolderName,
          conversation.name,
        );
        await folderConversations.openFolderEntityDropdownMenu(
          initialFolderName,
          conversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);
        await conversations.selectMoveToMenuOption(MenuOptions.newFolder);

        await expect
          .soft(
            folderConversations.getFolderByName(expectedFolderName),
            ExpectedMessages.newFolderCreated,
          )
          .toBeVisible();

        await folderConversations.expandFolder(expectedFolderName);
        await expect
          .soft(
            folderConversations.getFolderEntity(
              expectedFolderName,
              conversation.name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Create one more new folder, delete initial folder, create again new folder and verify new folder is created with index 1002',
      async () => {
        await chatBar.createNewFolder();
        await folderConversations.openFolderDropdownMenu(initialFolderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();
        await folderConversations
          .getFolderByName(initialFolderName)
          .waitFor({ state: 'hidden' });

        await chatBar.createNewFolder();
        await expect
          .soft(
            folderConversations.getFolderByName(incrementedFolderName),
            ExpectedMessages.newFolderCreated,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Rename folder with index 1002, create one more new folder and verify it has 1002 index',
      async () => {
        await folderConversations.openFolderDropdownMenu(incrementedFolderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.editFolderNameWithTick(
          GeneratorUtil.randomString(5),
        );

        await chatBar.createNewFolder();
        await expect
          .soft(
            folderConversations.getFolderByName(incrementedFolderName),
            ExpectedMessages.newFolderCreated,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Chat folder: names can be equal on different levels.\n' +
    'Chat folder: error message appears if to rename chat folder to already existed name in the root',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    folderConversations,
    folderDropdownMenu,
    chatBar,
    errorToast,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2949', 'EPMRTC-2952');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[];
    const nestedFolderLevel = 2;
    let expectedDuplicatedFolderName: string;

    await dialTest.step('Create nested folder hierarchy', async () => {
      nestedFolders = conversationData.prepareNestedFolder(nestedFolderLevel);
      nestedConversations =
        conversationData.prepareConversationsForNestedFolders(nestedFolders);
      await dataInjector.createConversations(
        nestedConversations,
        ...nestedFolders,
      );
      expectedDuplicatedFolderName = nestedFolders[nestedFolderLevel - 2].name;
    });

    await dialTest.step(
      'Verify low level folder renaming to top level folder name is successful',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.openFolderDropdownMenu(
          nestedFolders[nestedFolderLevel - 1].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.editFolderNameWithTick(
          expectedDuplicatedFolderName,
        );

        for (const nestedConversation of nestedConversations) {
          await expect
            .soft(
              folderConversations.getFolderEntity(
                expectedDuplicatedFolderName,
                nestedConversation.name,
              ),
              ExpectedMessages.newFolderCreated,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Create new folder, try to rename it to top level folder name and verify error message is shown',
      async () => {
        await chatBar.createNewFolder();
        await folderConversations.openFolderDropdownMenu(
          ExpectedConstants.newFolderTitle,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.editFolderName(expectedDuplicatedFolderName);
        await folderConversations.getEditFolderInputActions().clickTickButton();

        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedFolderNameErrorMessage(
              expectedDuplicatedFolderName,
            ),
          );
      },
    );
  },
);

dialTest(
  'Chat folder: error message appears if to drag chat folder IN to another folder where folder with the same name exists.\n' +
    'Chat folder: error message appears if to drag chat folder out to root where the same name exists',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    folderConversations,
    chatBar,
    errorToast,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2950', 'EPMRTC-2951');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[];
    let folderConversationToMove: FolderConversation;
    const nestedFolderLevel = 2;
    let duplicatedFolderName: string;

    await dialTest.step(
      'Create nested folder hierarchy and one more folder with the same name as low level hierarchy folder',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(nestedFolderLevel);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        duplicatedFolderName = nestedFolders[nestedFolderLevel - 1].name;

        conversationData.resetData();
        folderConversationToMove =
          conversationData.prepareDefaultConversationInFolder(
            duplicatedFolderName,
          );

        await dataInjector.createConversations(
          [...nestedConversations, ...folderConversationToMove.conversations],
          ...nestedFolders,
          folderConversationToMove.folders,
        );
      },
    );

    await dialTest.step(
      'Drag & drop single folder to folder with the same name and verify error message is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.dragAndDropEntityToFolder(
          folderConversations.getFolderByName(duplicatedFolderName),
          folderConversations.getFolderByName(
            nestedFolders[nestedFolderLevel - 2].name,
          ),
        );
        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedFolderNameErrorMessage(
              duplicatedFolderName,
            ),
          );
        await errorToast.closeToast();
      },
    );

    await dialTest.step(
      'Drag & drop low level folder to the root and verify error message is displayed',
      async () => {
        await folderConversations.expandFolder(
          nestedFolders[nestedFolderLevel - 2].name,
        );
        const elementLocator = folderConversations.getNestedFolder(
          nestedFolders[nestedFolderLevel - 2].name,
          duplicatedFolderName,
        );
        await chatBar.dragAndDropFolderToRoot(elementLocator);

        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedFolderRootNameErrorMessage(
              duplicatedFolderName,
            ),
          );
      },
    );
  },
);
