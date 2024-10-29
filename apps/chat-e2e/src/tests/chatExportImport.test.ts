import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import {
  noImportModelsSkipReason,
  noSimpleModelSkipReason,
} from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  Import,
  ImportedModelIds,
  MenuOptions,
  ScrollState,
} from '@/src/testData';
import { ImportConversation } from '@/src/testData/conversationHistory/importConversation';
import { UploadDownloadData } from '@/src/ui/pages';
import { GeneratorUtil } from '@/src/utils';
import { FileUtil } from '@/src/utils/fileUtil';
import { ModelsUtil } from '@/src/utils/modelsUtil';
import { expect } from '@playwright/test';

const levelsCount = 4;
let folderConversationData: UploadDownloadData;
let rootConversationData: UploadDownloadData;
let newFolderConversationData: UploadDownloadData;
let threeConversationsData: UploadDownloadData;
const exportedConversations: UploadDownloadData[] = [];
const updatedExportedConversations: UploadDownloadData[] = [];
let defaultModel: DialAIEntityModel;
let simpleRequestModel: DialAIEntityModel | undefined;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  simpleRequestModel = ModelsUtil.getModelForSimpleRequest();
});

dialTest(
  'Export and import one chat in a folder.\n' +
    `Export and import one chat in a folder when folder doesn't exist`,
  async ({
    dialHomePage,
    folderConversations,
    setTestIds,
    conversationData,
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
      },
    );

    await dialTest.step(
      'Export conversation inside folder using chat bar conversation menu',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel!.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(
          conversationInFolder.folders.name,
        );
        await folderConversations.selectFolderEntity(
          conversationInFolder.folders.name,
          conversationInFolder.conversations[0].name,
        );

        await folderConversations.openFolderEntityDropdownMenu(
          conversationInFolder.folders.name,
          conversationInFolder.conversations[0].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(
          () =>
            conversationDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
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
        await expect
          .soft(
            folderConversations.getFolderEntity(
              conversationInFolder.folders.name,
              conversationInFolder.conversations[0].name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
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
        await expect
          .soft(
            folderConversations.getFolderEntity(
              conversationInFolder.folders.name,
              conversationInFolder.conversations[0].name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
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
    conversationDropdownMenu,
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
        await conversations.openEntityDropdownMenu(
          ExpectedConstants.newConversationWithIndexTitle(1),
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await chatBar.createNewFolder();
        exportedData = await dialHomePage.downloadData(
          () => chatBar.exportButton.click(),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
        );
      },
    );

    await dialTest.step(
      'Delete all conversations and folders, re-import again and verify that all entities except empty folders are displayed',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await expect
          .soft(
            folderConversations.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(1),
            ),
            ExpectedMessages.folderIsNotVisible,
          )
          .toBeHidden();
        await expect
          .soft(
            conversations.getEntityByName(conversationOutsideFolder.name),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();

        for (let i = 0; i < levelsCount; i++) {
          await expect
            .soft(
              folderConversations.getFolderEntity(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsVisible,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  'Existed chats stay after import',
  async ({
    dialHomePage,
    folderConversations,
    setTestIds,
    conversationData,
    dataInjector,
    conversations,
    chatBar,
    chatHeader,
  }) => {
    setTestIds('EPMRTC-913');
    let conversationsInFolder: FolderConversation;
    let conversationOutsideFolder: Conversation;
    let importedFolderConversation: Conversation;
    let importedRootConversation: Conversation;
    let importedNewFolderConversation: FolderConversation;

    await dialTest.step(
      'Prepare conversations inside folder and another conversation outside folder',
      async () => {
        conversationsInFolder =
          conversationData.prepareFolderWithConversations(2);
        conversationData.resetData();

        conversationOutsideFolder =
          conversationData.prepareDefaultConversation();
        conversationData.resetData();

        await dataInjector.createConversations(
          [...conversationsInFolder.conversations, conversationOutsideFolder],
          conversationsInFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Prepare conversation inside existing folder to import, conversation inside new folder to import and conversation inside root',
      async () => {
        importedFolderConversation =
          conversationData.prepareDefaultConversation();
        folderConversationData = ImportConversation.prepareConversationFile(
          importedFolderConversation,
          conversationsInFolder,
        );
        conversationData.resetData();

        importedRootConversation =
          conversationData.prepareDefaultConversation();
        rootConversationData = ImportConversation.prepareConversationFile(
          importedRootConversation,
        );
        conversationData.resetData();

        importedNewFolderConversation =
          conversationData.prepareDefaultConversationInFolder();
        newFolderConversationData = ImportConversation.prepareConversationFile(
          importedNewFolderConversation.conversations[0],
          importedNewFolderConversation,
        );
      },
    );

    await dialTest.step(
      'Import conversation inside existing folder and verify it is imported and existing conversations remain inside folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await dialHomePage.importFile(folderConversationData, () =>
          chatBar.importButton.click(),
        );
        await folderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          importedFolderConversation.name,
        );
        expect
          .soft(
            await chatHeader.chatTitle.getElementInnerContent(),
            ExpectedMessages.headerTitleCorrespondRequest,
          )
          .toBe(importedFolderConversation.name);
        expect
          .soft(
            await folderConversations.isFolderEntityVisible(
              conversationsInFolder.folders.name,
              conversationsInFolder.conversations[0].name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeTruthy();
        expect
          .soft(
            await folderConversations.isFolderEntityVisible(
              conversationsInFolder.folders.name,
              conversationsInFolder.conversations[1].name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Import root conversation and verify it is imported and existing root conversations remain',
      async () => {
        await dialHomePage.importFile(rootConversationData, () =>
          chatBar.importButton.click(),
        );
        await conversations
          .getEntityByName(importedRootConversation.name)
          .waitFor();
        await expect
          .soft(
            conversations.getEntityByName(conversationOutsideFolder.name),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Import conversation inside new folder and verify it is imported',
      async () => {
        await dialHomePage.importFile(newFolderConversationData, () =>
          chatBar.importButton.click(),
        );
        await folderConversations.selectFolderEntity(
          importedNewFolderConversation.folders.name,
          importedNewFolderConversation.conversations[0].name,
        );
        expect
          .soft(
            await chatHeader.chatTitle.getElementInnerContent(),
            ExpectedMessages.headerTitleCorrespondRequest,
          )
          .toBe(importedNewFolderConversation.conversations[0].name);
      },
    );
  },
);

dialTest(
  'Continue working with imported file. Regenerate response.\n' +
    'Continue working with imported file. Send a message.\n' +
    'Continue working with imported file. Edit a message.\n' +
    'Position of user-message stays at the top if to click on edit',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    chatMessages,
    chat,
    conversations,
    chatBar,
  }) => {
    dialTest.skip(simpleRequestModel === undefined, noSimpleModelSkipReason);
    setTestIds('EPMRTC-923', 'EPMRTC-924', 'EPMRTC-925', 'EPMRTC-3075');
    let importedRootConversation: Conversation;
    const requests = ['1+2', '2+3', '3+4'];

    await dialTest.step(
      'Prepare conversation with several messages to import',
      async () => {
        importedRootConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            simpleRequestModel!,
            requests,
          );
        threeConversationsData = ImportConversation.prepareConversationFile(
          importedRootConversation,
        );
      },
    );

    await dialTest.step(
      'Import conversation, regenerate the response and verify last response is regenerated',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await dialHomePage.importFile(threeConversationsData, () =>
          chatBar.importButton.click(),
        );
        await conversations.selectConversation(importedRootConversation.name);
        await chatMessages.regenerateResponse();
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(requests.length * 2);
      },
    );

    await dialTest.step(
      'Send new request in chat and verify response is received',
      async () => {
        const newRequest = '4+5';
        await chat.sendRequestWithButton(newRequest);
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(requests.length * 2 + 2);
      },
    );

    await dialTest.step(
      'Open 1st request edit mode and verify text area stays at the top, control buttons are visible',
      async () => {
        await chatMessages.openEditMessageMode(1);
        const scrollPosition =
          await chat.scrollableArea.getVerticalScrollPosition();
        expect
          .soft(scrollPosition, ExpectedMessages.scrollPositionIsCorrect)
          .toBe(ScrollState.top);
        await expect
          .soft(
            chatMessages.saveAndSubmit.getElementLocator(),
            ExpectedMessages.buttonIsEnabled,
          )
          .toBeVisible();
        await expect
          .soft(
            chatMessages.cancel.getElementLocator(),
            ExpectedMessages.buttonIsEnabled,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Edit 1st request in chat and verify 1st response is regenerated',
      async () => {
        const updatedMessage = '6+7';
        await chatMessages.editMessage(requests[0], updatedMessage);
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(2);
      },
    );
  },
);

dialTest(
  'Import file from 1.4 DIAL milestone to conversations and continue working with it.\n' +
    'Chat sorting. Other chat is moved to Today section after sending a message',
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    folderConversations,
    prompts,
    chatMessages,
    conversations,
    conversationAssertion,
    chat,
    iconApiHelper,
    conversationSettings,
    chatLoader,
  }) => {
    dialTest.skip(
      [
        ImportedModelIds.GPT_3_5_TURBO,
        ImportedModelIds.GPT_4,
        ImportedModelIds.CHAT_BISON,
      ].some(
        (modelId) =>
          !ModelsUtil.getOpenAIEntities()
            .map((e) => e.id)
            .includes(modelId),
      ),
      noImportModelsSkipReason,
    );
    setTestIds('EPMRTC-906', 'EPMRTC-779');
    const gpt4Model = ModelsUtil.getModel(ImportedModelIds.GPT_4)!;
    await dialTest.step(
      'Import conversation from 1.4 app version and verify folder with Gpt-3.5 chat and its history is visible',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await dialHomePage.importFile(
          { path: Import.v14AppImportedFilename },
          () => chatBar.importButton.click(),
        );

        await folderConversations.expandFolder(Import.oldVersionAppFolderName, {
          isHttpMethodTriggered: true,
        });
        expect
          .soft(
            await folderConversations.isFolderEntityVisible(
              Import.oldVersionAppFolderName,
              Import.oldVersionAppFolderChatName,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeTruthy();

        await conversations
          .getEntityByName(ExpectedConstants.newConversationTitle, 2)
          .waitFor();

        await folderConversations.selectFolderEntity(
          Import.oldVersionAppFolderName,
          Import.oldVersionAppFolderChatName,
          { isHttpMethodTriggered: true },
        );
        await chatLoader.waitForState({ state: 'hidden' });
        await chatMessages.getChatMessage(1).waitFor();
        const folderChatMessagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(folderChatMessagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(2);
      },
    );

    await dialTest.step(
      'Verify New conversation with Gpt-4 icon is imported',
      async () => {
        await conversations
          .getEntityByName(ExpectedConstants.newConversationTitle, 2)
          .waitFor();
        const expectedModelIcon = iconApiHelper.getEntityIcon(gpt4Model);
        await conversationAssertion.assertTreeEntityIcon(
          {
            name: ExpectedConstants.newConversationTitle,
            index: isApiStorageType ? 1 : 2,
          },
          expectedModelIcon,
        );
      },
    );

    await dialTest.step(
      'Verify Bison conversation with default icon is imported',
      async () => {
        await conversations
          .getEntityByName(Import.v14AppBisonChatName)
          .waitFor();

        const defaultIcon = iconApiHelper.getEntityIcon(
          ModelsUtil.getModel(ImportedModelIds.CHAT_BISON)!,
        );
        await conversationAssertion.assertTreeEntityIcon(
          { name: Import.v14AppBisonChatName },
          defaultIcon,
        );
      },
    );

    await dialTest.step('Verify no prompts are imported', async () => {
      const promptsCount = await prompts.getEntitiesCount();
      expect.soft(promptsCount, ExpectedMessages.noPromptsImported).toBe(0);
    });

    await dialTest.step(
      'Send new request in Gpr-3.5 and verify response is received',
      async () => {
        const newRequest = '1+2=';
        await chat.sendRequestWithButton(newRequest);
        const lastResponseContent = await chatMessages.getLastMessageContent();
        expect
          .soft(
            lastResponseContent !== '',
            ExpectedMessages.messageContentIsValid,
          )
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Send new request in imported "New Conversation" and verify it was moved into Today section',
      async () => {
        await conversations.selectConversation(
          ExpectedConstants.newConversationTitle,
          isApiStorageType ? 1 : 2,
        );
        await conversationSettings.waitForState();
        await chat.sendRequestWithButton('1+1=', false);
        const todayConversations = await conversations.getTodayConversations();
        expect
          .soft(todayConversations.length, ExpectedMessages.conversationOfToday)
          .toBe(isApiStorageType ? 3 : 2);
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
        await folderConversations.selectFolderEntity(
          nestedFolders[nestedFolders.length - 1].name,
          nestedConversations[levelsCount - 1].name,
        );

        await folderConversations.openFolderEntityDropdownMenu(
          nestedFolders[levelsCount - 1].name,
          nestedConversations[levelsCount - 1].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(
          () =>
            conversationDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
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
            nestedFolders[levelsCount - 1].name,
            nestedConversations[levelsCount - 1].name,
          )
          .waitFor();

        for (let i = 0; i < levelsCount; i++) {
          await folderConversations
            .getFolderByName(nestedFolders[i].name)
            .waitFor();
        }

        for (let i = 0; i < levelsCount - 1; i++) {
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
          nestedFolders[levelsCount - 1].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );

        await folderConversations
          .getFolderEntity(
            nestedFolders[levelsCount - 1].name,
            nestedConversations[levelsCount - 1].name,
          )
          .waitFor();
      },
    );

    await dialTest.step(
      'Delete 2nd level folder with its nested content, re-import exported file and verify 2nd level folder with its nested content imported',
      async () => {
        await folderConversations.openFolderDropdownMenu(
          nestedFolders[levelsCount - 2].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );

        await folderConversations
          .getFolderEntity(
            nestedFolders[levelsCount - 1].name,
            nestedConversations[levelsCount - 1].name,
          )
          .waitFor();

        await folderConversations
          .getFolderByName(nestedFolders[levelsCount - 2].name)
          .waitFor();
      },
    );
  },
);

dialTest(
  'Import a chat in nested folder',
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
    setTestIds('EPMRTC-1374');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    const updatedConversationNames: string[] = [];

    await dialTest.step(
      'Prepare 3 level nested folders with conversations in each folder',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(levelsCount);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);

        await localStorageManager.setFolders(...nestedFolders);
        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Export single conversations from root folder and single conversation from 2nd level folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.selectFolderEntity(
          nestedFolders[nestedFolders.length - 1].name,
          nestedConversations[levelsCount - 1].name,
        );

        for (let i = 0; i <= 2; i = i + 2) {
          await folderConversations.openFolderEntityDropdownMenu(
            nestedFolders[i].name,
            nestedConversations[i].name,
          );
          await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
          const exportedData = await dialHomePage.downloadData(
            () =>
              conversationDropdownMenu.selectMenuOption(
                MenuOptions.withoutAttachments,
              ),
            `${i}.json`,
          );
          exportedConversations.push(exportedData);
        }
      },
    );

    await dialTest.step(
      'Update id and name of exported conversations and import them again',
      async () => {
        for (const exportedData of exportedConversations) {
          const exportedContent = FileUtil.readFileData(exportedData.path);
          const conversation = exportedContent.history[0];
          conversation.id = GeneratorUtil.randomString(10);
          conversation.name = GeneratorUtil.randomString(10);
          const updatedExportedConversation = {
            path: FileUtil.writeDataToFile(exportedContent),
            isDownloadedData: false,
          };
          updatedExportedConversations.push(updatedExportedConversation);
          await dialHomePage.importFile(updatedExportedConversation, () =>
            chatBar.importButton.click(),
          );
          updatedConversationNames.push(conversation.name);
        }
      },
    );

    await dialTest.step(
      'Verify new conversations are added to root and 2nd level folders, folders structure remains the same',
      async () => {
        for (let i = 0; i < levelsCount; i++) {
          await folderConversations
            .getFolderByName(nestedFolders[i].name)
            .waitFor();
        }

        for (let i = 0; i < levelsCount - 1; i++) {
          expect
            .soft(
              await folderConversations.isFolderEntityVisible(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsVisible,
            )
            .toBeTruthy();
          if (i === 0) {
            expect
              .soft(
                await folderConversations.isFolderEntityVisible(
                  nestedFolders[i].name,
                  updatedConversationNames[0],
                ),
                ExpectedMessages.conversationIsVisible,
              )
              .toBeTruthy();
          } else if (i === 2) {
            expect
              .soft(
                await folderConversations.isFolderEntityVisible(
                  nestedFolders[i].name,
                  updatedConversationNames[1],
                ),
                ExpectedMessages.conversationIsVisible,
              )
              .toBeTruthy();
          }
        }
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
    dataInjector,
    chatBar,
    conversationDropdownMenu,
    localStorageManager,
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
          nestedFolders[levelsCount - 1].id;
        thirdLevelFolderConversation.id = `${thirdLevelFolderConversation.folderId}/${thirdLevelFolderConversation.id}`;

        await dataInjector.createConversations(
          [thirdLevelFolderConversation],
          ...nestedFolders,
        );
        await localStorageManager.setChatCollapsedSection(
          CollapsedSections.Organization,
        );
      },
    );

    await dialTest.step('Export 3rd level folder conversation', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      for (const nestedFolder of nestedFolders) {
        await folderConversations.expandFolder(nestedFolder.name);
      }
      await folderConversations.selectFolderEntity(
        nestedFolders[nestedFolders.length - 1].name,
        thirdLevelFolderConversation.name,
      );
      await folderConversations.openFolderEntityDropdownMenu(
        nestedFolders[levelsCount - 1].name,
        thirdLevelFolderConversation.name,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
      exportedData = await dialHomePage.downloadData(
        () =>
          conversationDropdownMenu.selectMenuOption(
            MenuOptions.withAttachments,
          ),
        GeneratorUtil.exportedWithAttachmentsFilename(),
      );
    });

    await dialTest.step(
      'Move 3rd level folder on the root folder level and import exported conversation',
      async () => {
        await chatBar.dragAndDropFolderToRootLevel(
          nestedFolders[levelsCount - 1].name,
          { isHttpMethodTriggered: true },
        );
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
      },
    );

    await dialTest.step(
      'Verify imported conversations is in 3rd level folder, under the 2nd level folder',
      async () => {
        await folderConversations
          .getNestedFolder(
            nestedFolders[levelsCount - 2].name,
            nestedFolders[levelsCount - 1].name,
          )
          .waitFor();

        const foldersCount = await folderConversations.getFoldersCount();
        expect
          .soft(foldersCount, ExpectedMessages.foldersCountIsValid)
          .toBe(levelsCount + 1);
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
