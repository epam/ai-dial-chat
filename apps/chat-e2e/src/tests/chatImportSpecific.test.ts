import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { FileUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Import: dots at the end of Chat Folder and Chat name are removed while import\n' +
    'Import: restricted chars are replaced with spaces in Chats and Chat Folders names while import\n' +
    'Import: spaces in the middle of the Chat and Chat Folder names stay\n' +
    'Import: allowed chars stay in Chat and Chat Folder names while import',
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
    setTestIds(
      'EPMRTC-3047',
      'EPMRTC-3080',
      'EPMRTC-3087',
      'EPMRTC-3090',
      'EPMRTC-3086',
      'EPMRTC-3089',
      'EPMRTC-3091',
    );
    const folderToExport = 'folderToExport';
    const conversationToExport = 'conversationToExport';
    const updatedFolderName = `${ExpectedConstants.allowedSpecialChars}folder${ExpectedConstants.restrictedNameChars}To     Import...`;
    const folderToImport = `${ExpectedConstants.allowedSpecialChars}folder           To     Import`;
    const updatedConversationName = `${ExpectedConstants.allowedSpecialChars}conversation${ExpectedConstants.restrictedNameChars}To     Import...`;
    const conversationToImport = `${ExpectedConstants.allowedSpecialChars}conversation           To     Import`;
    let downloadedDataPath: string;

    await dialTest.step('Prepare conversation inside folder', async () => {
      const conversationInFolder =
        conversationData.prepareDefaultConversationInFolder(
          folderToExport,
          undefined,
          conversationToExport,
        );
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
        f.id = f.id.replace(folderToExport, updatedFolderName);
        f.name = f.name.replace(folderToExport, updatedFolderName);
      });
      exportedData.history.map((h: Conversation) => {
        h.id = h.id.replace(folderToExport, updatedFolderName);
        h.id = h.id.replace(conversationToExport, updatedConversationName);
        h.name = h.name.replace(conversationToExport, updatedConversationName);
        h.folderId = h.folderId.replace(folderToExport, updatedFolderName);
      });
      downloadedDataPath = FileUtil.writeDataToFile(exportedData);
    });

    await dialTest.step(
      'Import json and check chat folder and conversation names',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile({ path: downloadedDataPath }, () =>
          chatBar.importButton.click(),
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
            folderConversations.getFolderByName(updatedFolderName),
            ExpectedMessages.folderIsNotVisible,
          )
          .toBeHidden();
        await expect
          .soft(
            folderConversations.getFolderEntity(
              folderToImport,
              conversationToImport,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            folderConversations.getFolderEntity(
              folderToImport,
              updatedConversationName,
            ),
            ExpectedMessages.conversationIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  'Import: dots at the end of Prompt Folder and Prompt name are removed while import\n' +
    'Import: spaces in the middle of the Prompt and Prompt Folder names stay\n' +
    'Import: allowed chars stay in Prompt and Prompt Folder names while import',
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
    setTestIds(
      'EPMRTC-3082',
      'EPMRTC-3083',
      'EPMRTC-3088',
      'EPMRTC-3093',
      'EPMRTC-3094',
    );
    const promptFolderToExport = 'folderToExport';
    const promptToExport = 'promptToExport';
    const updatedPromptFolderName = `${ExpectedConstants.allowedSpecialChars}folder${ExpectedConstants.restrictedNameChars}To     Import...`;
    const promptFolderToImport = `${ExpectedConstants.allowedSpecialChars}folder           To     Import`;
    const updatedPromptName = `${ExpectedConstants.allowedSpecialChars}prompt${ExpectedConstants.restrictedNameChars}To     Import...`;
    const promptToImport = `${ExpectedConstants.allowedSpecialChars}prompt           To     Import`;
    let downloadedDataPath: string;

    await dialTest.step('Prepare prompt inside folder', async () => {
      const promptInFolder = promptData.prepareDefaultPromptInFolder(
        promptToExport,
        promptFolderToExport,
      );
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
      await folderPrompts.expandFolder(promptFolderToExport);
      await folderPrompts.openFolderEntityDropdownMenu(
        promptFolderToExport,
        promptToExport,
      );
      const downloadedData = await dialHomePage.downloadData(
        () =>
          folderPrompts.getDropdownMenu().selectMenuOption(MenuOptions.export),
        `test.json`,
      );
      downloadedDataPath = downloadedData.path;
    });

    await dialTest.step('Update exported json', async () => {
      const exportedData = FileUtil.readFileData(downloadedDataPath);
      exportedData.folders.map((f: FolderInterface) => {
        f.id = f.id.replace(promptFolderToExport, updatedPromptFolderName);
        f.name = f.name.replace(promptFolderToExport, updatedPromptFolderName);
      });
      exportedData.prompts.map((p: Prompt) => {
        p.id = p.id.replace(promptFolderToExport, updatedPromptFolderName);
        p.id = p.id.replace(promptToExport, updatedPromptName);
        p.name = p.name.replace(promptToExport, updatedPromptName);
        p.folderId = p.folderId.replace(
          promptFolderToExport,
          updatedPromptFolderName,
        );
      });
      downloadedDataPath = FileUtil.writeDataToFile(exportedData);
    });

    await dialTest.step(
      'Import json and check prompt folder and prompt names',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile({ path: downloadedDataPath }, () =>
          promptBar.importButton.click(),
        );
        // await folderPrompts.expandFolder(folderToImport);
        await expect
          .soft(
            folderPrompts.getFolderByName(promptFolderToImport),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            folderPrompts.getFolderByName(updatedPromptFolderName),
            ExpectedMessages.folderIsNotVisible,
          )
          .toBeHidden();
        await expect
          .soft(
            folderPrompts.getFolderEntity(promptFolderToImport, promptToImport),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            folderPrompts.getFolderEntity(
              promptFolderToImport,
              updatedPromptName,
            ),
            ExpectedMessages.promptIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);
