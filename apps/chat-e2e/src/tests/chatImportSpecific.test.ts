import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  Import,
  MenuOptions,
} from '@/src/testData';
import { FileUtil } from '@/src/utils';
import { expect } from '@playwright/test';
import {FolderInterface} from "@/chat/types/folder";
import {Conversation} from "@/chat/types/chat";

dialTest.only(
  'Import: dots at the end of Chat Folder name are removed while import',
  async ({
           dialHomePage,
           conversationData,
           dataInjector,
           localStorageManager,
           confirmationDialog,
           folderConversations,
           chatBar,
           setTestIds,
         }) => {
    setTestIds('EPMRTC-3047');
    const folderToExport = 'folderToExport';
    const folderToImport = 'folderToImport';
    const conversationToExport = 'conversationToExport';
    const folderToImportWithDots = 'folderToImport...';
    let downloadedDataPath: string;

    await dialTest.step('Prepare conversation inside folder', async () => {
      const conversationInFolder =
        conversationData.prepareDefaultConversationInFolder(folderToExport, undefined, conversationToExport);
      await dataInjector.createConversations(
        conversationInFolder.conversations,
        conversationInFolder.folders,
      );
      await localStorageManager.setSelectedConversation(
        conversationInFolder.conversations[0],
      );
      await localStorageManager.setChatCollapsedSection(
        CollapsedSections.Organization,
      );
    });

    await dialTest.step('Export conversation', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await folderConversations.openFolderEntityDropdownMenu(
        folderToExport,
        conversationToExport,
      );
      await folderConversations
        .getDropdownMenu()
        .selectMenuOption(MenuOptions.export);
      const downloadedData = await dialHomePage.downloadData(
        () =>
          folderConversations
            .getDropdownMenu()
            .selectMenuOption(MenuOptions.withoutAttachments),
        `test.json`,
      );
      downloadedDataPath = downloadedData.path;
    });

    await dialTest.step('Update exported json', async () => {
      const exportedData = FileUtil.readFileData(downloadedDataPath);
      exportedData.folders.map((f: FolderInterface) => {
        f.id = f.id.replace(folderToExport, folderToImportWithDots);
        f.name = f.name.replace(folderToExport, folderToImportWithDots);
      });
      exportedData.history.map((h: Conversation) => {
        h.id = h.id.replace(folderToExport, folderToImportWithDots);
        h.folderId = h.folderId.replace(folderToExport, folderToImportWithDots);
      });
      downloadedDataPath = FileUtil.writeDataToFile(exportedData);
    });

    await dialTest.step(
      'Import json and check chat folder name',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(
          { path: downloadedDataPath },
          () => chatBar.importButton.click(),
        );
        await folderConversations.expandFolder(folderToImport);
        await expect
          .soft(
            folderConversations.getFolderByName(folderToImport),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            folderConversations.getFolderByName(folderToImportWithDots),
            ExpectedMessages.folderIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);
