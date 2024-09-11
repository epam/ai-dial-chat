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
import {Prompt} from "@/chat/types/prompt";

dialTest(
  'Import: dots at the end of Chat Folder and Chat name are removed while import',
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
    setTestIds('EPMRTC-3047', 'EPMRTC-3080');
    const folderToExport = 'folderToExport';
    const folderToImport = 'folderToImport';
    const conversationToExport = 'conversationToExport';
    const conversationToImport = 'conversationToImport';
    const folderToImportWithDots = 'folderToImport...';
    const conversationToImportWithDots = 'conversationToImport...';
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
        h.id = h.id.replace(conversationToExport, conversationToImportWithDots);
        h.name = h.name.replace(conversationToExport, conversationToImportWithDots);
        h.folderId = h.folderId.replace(folderToExport, folderToImportWithDots);
      });
      downloadedDataPath = FileUtil.writeDataToFile(exportedData);
    });

    await dialTest.step(
      'Import json and check chat folder and conversation names',
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
        await expect
          .soft(
            folderConversations.getFolderEntity(folderToImport, conversationToImport),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            folderConversations.getFolderEntity(folderToImport, conversationToImportWithDots),
            ExpectedMessages.conversationIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest.only(
  'Import: dots at the end of Prompt Folder and Prompt name are removed while import',
  async ({
           dialHomePage,
           promptData,
           dataInjector,
           localStorageManager,
           confirmationDialog,
           folderPrompts,
           promptBar,
           setTestIds,
         }) => {
    setTestIds('EPMRTC-3082', 'EPMRTC-3083');
    const folderToExport = 'folderToExport';
    const folderToImport = 'folderToImport';
    const promptToExport = 'promptToExport';
    const promptToImport = 'promptToImport';
    const folderToImportWithDots = 'folderToImport...';
    const promptToImportWithDots = 'promptToImport...';
    let downloadedDataPath: string;

    await dialTest.step('Prepare prompt inside folder', async () => {
      const promptInFolder =
        promptData.prepareDefaultPromptInFolder(promptToExport, folderToExport);
      await dataInjector.createPrompts(
        promptInFolder.prompts,
        promptInFolder.folders,
      );
      await localStorageManager.setPromptCollapsedSection(
        CollapsedSections.Organization,
      );
    });

    await dialTest.step('Export prompt', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await folderPrompts.expandFolder(folderToExport);
      await folderPrompts.openFolderEntityDropdownMenu(
        folderToExport,
        promptToExport,
      );
      const downloadedData = await dialHomePage.downloadData(
        () =>
          folderPrompts
            .getDropdownMenu()
            .selectMenuOption(MenuOptions.export),
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
      exportedData.prompts.map((p: Prompt) => {
        p.id = p.id.replace(folderToExport, folderToImportWithDots);
        p.id = p.id.replace(promptToExport, promptToImportWithDots);
        p.name = p.name.replace(promptToExport, promptToImportWithDots);
        p.folderId = p.folderId.replace(folderToExport, folderToImportWithDots);
      });
      downloadedDataPath = FileUtil.writeDataToFile(exportedData);
    });

    await dialTest.step(
      'Import json and check prompt folder and prompt names',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(
          { path: downloadedDataPath },
          () => promptBar.importButton.click(),
        );
        // await folderPrompts.expandFolder(folderToImport);
        await expect
          .soft(
            folderPrompts.getFolderByName(folderToImport),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            folderPrompts.getFolderByName(folderToImportWithDots),
            ExpectedMessages.folderIsNotVisible,
          )
          .toBeHidden();
        await expect
          .soft(
            folderPrompts.getFolderEntity(folderToImport, promptToImport),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            folderPrompts.getFolderEntity(folderToImport, promptToImportWithDots),
            ExpectedMessages.promptIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);
