import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  ModelIds,
} from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { FileUtil } from '@/src/utils/fileUtil';
import { ModelsUtil } from '@/src/utils/modelsUtil';
import { expect } from '@playwright/test';

const levelsCount = 3;
let folderConversationData: UploadDownloadData;
let rootConversationData: UploadDownloadData;
let newFolderConversationData: UploadDownloadData;
let threeConversationsData: UploadDownloadData;
const updatedExportedConversations: UploadDownloadData[] = [];
let gpt35Model: DialAIEntityModel;
let gpt4Model: DialAIEntityModel;

dialTest.beforeAll(async () => {
  gpt35Model = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
});

dialTest(
  'Export and import one chat in a folder.\n' +
    `Export and import one chat in a folder when folder doesn't exist`,
  async ({
    dialHomePage,
    folderConversations,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    chatBar,
    folderDropdownMenu,
    conversationDropdownMenu,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-908', 'EPMRTC-909');
    let conversationInFolder: FolderConversation;
    let exportedData: UploadDownloadData;
    await dialTest.step(
      'Prepare exported conversation inside folder and another conversation outside folders',
      async () => {
        conversationInFolder =
          conversationData.prepareDefaultConversationInFolder();
        conversationData.resetData();
        const conversationOutsideFolder =
          conversationData.prepareDefaultConversation();

        await dataInjector.createConversations(
          [...conversationInFolder.conversations, conversationOutsideFolder],
          conversationInFolder.folders,
        );
        await localStorageManager.setSelectedConversation(
          conversationInFolder.conversations[0],
        );
      },
    );

    await dialTest.step(
      'Export conversation inside folder using chat bar conversation menu',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [gpt35Model!.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(
          conversationInFolder.folders.name,
        );

        await folderConversations.openFolderEntityDropdownMenu(
          conversationInFolder.folders.name,
          conversationInFolder.conversations[0].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(() =>
          conversationDropdownMenu.selectMenuOption(
            MenuOptions.withoutAttachments,
          ),
        );
      },
    );

    await dialTest.step(
      'Delete conversation inside folder, re-import it again and verify it displayed inside folder',
      async () => {
        await folderConversations.openFolderEntityDropdownMenu(
          conversationInFolder.folders.name,
          conversationInFolder.conversations[0].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );

        await folderConversations
          .getFolderEntity(
            conversationInFolder.folders.name,
            conversationInFolder.conversations[0].name,
          )
          .waitFor();
      },
    );

    await dialTest.step(
      'Delete folder with the conversation inside, re-import it again and verify it displayed inside folder',
      async () => {
        await folderConversations.openFolderDropdownMenu(
          conversationInFolder.folders.name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );

        await folderConversations
          .getFolderEntity(
            conversationInFolder.folders.name,
            conversationInFolder.conversations[0].name,
          )
          .waitFor();
      },
    );
  },
);

dialTest(
  'Export and import chat structure with all conversations',
  async ({
    dialHomePage,
    folderConversations,
    setTestIds,
    conversationData,
    dataInjector,
    conversations,
    chatBar,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-907');
    let nestedFolders: FolderInterface[];
    let conversationOutsideFolder: Conversation;
    let nestedConversations: Conversation[] = [];
    let exportedData: UploadDownloadData;

    await dialTest.step(
      'Prepare empty folder, 3 level nested folders with conversations and conversation outside folder',
      async () => {
        conversationOutsideFolder =
          conversationData.prepareDefaultConversation();
        conversationData.resetData();

        nestedFolders = conversationData.prepareNestedFolder(levelsCount);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);

        await dataInjector.createConversations(
          [...nestedConversations, conversationOutsideFolder],
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Export all conversations using chat bar Export button',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.createNewFolder();
        await chatBar.createNewConversation();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        exportedData = await dialHomePage.downloadData(() =>
          chatBar.exportButton.click(),
        );
      },
    );

    await dialTest.step(
      'Delete all conversations and folders, re-import again and verify they are displayed',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );

        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .waitFor();
        await conversations
          .getConversationByName(conversationOutsideFolder.name)
          .waitFor();

        for (let i = 0; i <= levelsCount; i++) {
          await folderConversations
            .getFolderEntity(nestedFolders[i].name, nestedConversations[i].name)
            .waitFor();
        }
      },
    );
  },
);

dialTest(
  `Export and import single chat in nested folders when folders structure doesn't exist.\n` +
    `Export and import single chat in nested folders when it's folder doesn't exist.\n` +
    `Export and import single chat in nested folders when parent folder doesn't exist`,
  async ({
    dialHomePage,
    folderConversations,
    setTestIds,
    conversationData,
    dataInjector,
    localStorageManager,
    chatBar,
    confirmationDialog,
    conversationDropdownMenu,
    folderDropdownMenu,
  }) => {
    setTestIds('EPMRTC-1359', 'EPMRTC-1368', 'EPMRTC-1369');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let exportedData: UploadDownloadData;
    await dialTest.step(
      'Prepare 3 level nested folders with conversations in each folder',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(levelsCount);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);

        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );
        await localStorageManager.setSelectedConversation(
          nestedConversations[levelsCount],
        );
      },
    );

    await dialTest.step(
      'Export single conversations inside last nested folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }

        await folderConversations.openFolderEntityDropdownMenu(
          nestedFolders[levelsCount].name,
          nestedConversations[levelsCount].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(() =>
          conversationDropdownMenu.selectMenuOption(
            MenuOptions.withoutAttachments,
          ),
        );
      },
    );

    await dialTest.step(
      'Delete all conversations and folders, re-import exported file and verify only last nested conversation with folders structure imported',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );

        await folderConversations
          .getFolderEntity(
            nestedFolders[levelsCount].name,
            nestedConversations[levelsCount].name,
          )
          .waitFor();

        for (let i = 0; i <= levelsCount; i++) {
          await folderConversations
            .getFolderByName(nestedFolders[i].name)
            .waitFor();
        }

        for (let i = 0; i < levelsCount; i++) {
          expect
            .soft(
              await folderConversations.isFolderEntityVisible(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsNotVisible,
            )
            .toBeFalsy();
        }
      },
    );

    await dialTest.step(
      'Delete last folder with its conversation, re-import exported file and verify last nested folder with its conversation imported',
      async () => {
        await folderConversations.openFolderDropdownMenu(
          nestedFolders[levelsCount].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );

        await folderConversations
          .getFolderEntity(
            nestedFolders[levelsCount].name,
            nestedConversations[levelsCount].name,
          )
          .waitFor();
      },
    );

    await dialTest.step(
      'Delete 2nd level folder with its nested content, re-import exported file and verify 2nd level folder with its nested content imported',
      async () => {
        await folderConversations.openFolderDropdownMenu(
          nestedFolders[levelsCount - 1].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();

        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );

        await folderConversations
          .getFolderEntity(
            nestedFolders[levelsCount].name,
            nestedConversations[levelsCount].name,
          )
          .waitFor();

        await folderConversations
          .getFolderByName(nestedFolders[levelsCount - 1].name)
          .waitFor();
      },
    );
  },
);

dialTest(
  'Import a chat from nested folder which was moved to another place.\n' +
    'Export and import chat without attachments using menu Export with attachments',
  async ({
    dialHomePage,
    folderConversations,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    chatBar,
    conversationDropdownMenu,
  }) => {
    setTestIds('EPMRTC-1387', 'EPMRTC-1979');
    let nestedFolders: FolderInterface[];
    let thirdLevelFolderConversation: Conversation;
    let exportedData: UploadDownloadData;

    await dialTest.step(
      'Prepare 3 level nested folders and conversation inside the 3rd level folder',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(levelsCount);
        thirdLevelFolderConversation =
          conversationData.prepareDefaultConversation();
        thirdLevelFolderConversation.folderId =
          nestedFolders[levelsCount].folderId;
        thirdLevelFolderConversation.id = `${thirdLevelFolderConversation.folderId}/${thirdLevelFolderConversation.id}`;

        await dataInjector.createConversations(
          [thirdLevelFolderConversation],
          ...nestedFolders,
        );
        await localStorageManager.setSelectedConversation(
          thirdLevelFolderConversation,
        );
      },
    );

    await dialTest.step('Export 3rd level folder conversation', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await folderConversations.openFolderEntityDropdownMenu(
        nestedFolders[levelsCount].name,
        thirdLevelFolderConversation.name,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
      exportedData = await dialHomePage.downloadData(() =>
        conversationDropdownMenu.selectMenuOption(MenuOptions.withAttachments),
      );
    });

    await dialTest.step(
      'Move 3rd level folder on the root folder level and import exported conversation',
      async () => {
        await chatBar.dragAndDropFolderToRootLevel(
          nestedFolders[levelsCount].name,
        );
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
      },
    );

    await dialTest.step(
      'Verify imported conversations is in 3rd level folder, under ther 2nd level folder',
      async () => {
        await folderConversations.expandFolder(
          nestedFolders[levelsCount].name,
          { isHttpMethodTriggered: true },
          1,
        );
        await folderConversations
          .getFolderEntity(
            nestedFolders[levelsCount].name,
            thirdLevelFolderConversation.name,
          )
          .waitFor();

        const foldersCount = await folderConversations.getFoldersCount();
        expect
          .soft(foldersCount, ExpectedMessages.foldersCountIsValid)
          .toBe(levelsCount + 2);
      },
    );
  },
);

dialTest.afterAll(async () => {
  const importFilesToDelete: UploadDownloadData[] = [
    folderConversationData,
    rootConversationData,
    newFolderConversationData,
    threeConversationsData,
    ...updatedExportedConversations,
  ];
  importFilesToDelete.forEach((d) => {
    if (d) {
      FileUtil.deleteImportFile(d.path);
    }
  });
});
