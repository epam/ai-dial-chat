import { Conversation } from '@/chat/types/chat';
import { FeatureType } from '@/chat/types/common';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { GeneratorUtil } from '@/src/utils';
import { ModelsUtil } from '@/src/utils/modelsUtil';
import { expect } from '@playwright/test';

dialTest.only(
  'Export and import chat structure with all conversations with the same names that exist : Mixed option selected',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    dataInjector,
    localStorageManager,
    chatBar,
    folderConversations,
    folderDropdownMenu,
    chat,
    chatMessages,
    conversations,
    replaceConfirmationDialog,
  }) => {
    setTestIds('EPMRTC-3024');
    let exportedData: UploadDownloadData;

    // Folder entities
    let folder1: FolderInterface;
    let folder2: FolderInterface;
    let nestedFolders: FolderInterface[];

    // Conversation entities
    let chat1: Conversation;
    let chat2: Conversation;
    let chat3: Conversation;
    let chat4: Conversation;
    let chat5: Conversation;
    let chat6: Conversation;
    let chat7: Conversation;

    let defaultModel = ModelsUtil.getDefaultAgent()!;

    await dialTest.step(
      'Prepare folder structure and conversations',
      async () => {
        // 2. Create Folder2 with Chat1 and Chat2
        folder2 = conversationData.prepareFolder('Folder2');

        chat1 = conversationData.prepareDefaultConversation(undefined, 'Chat1');
        chat1.folderId = folder2.id;
        chat1.id = `${folder2.id}/${chat1.id}`;
        conversationData.resetData();

        chat2 = conversationData.prepareDefaultConversation(undefined, 'Chat2');
        chat2.folderId = folder2.id;
        chat2.id = `${folder2.id}/${chat2.id}`;
        conversationData.resetData();

        // 3. Create Chat3 outside of all folders
        chat3 = conversationData.prepareDefaultConversation(undefined, 'Chat3');
        conversationData.resetData();

        // 5. Create Folder3 with nested folders (3 levels deep for 4 total folders)
        nestedFolders = conversationData.prepareNestedFolder(4, {
          1: 'Folder3',
          2: 'Folder3.1',
          3: 'Folder3.1.1',
          4: 'Folder3.1.1.1',
        });

        // 6-9. Create chats and assign them to nested folders
        // Chat4 in Folder3.1.1.1 (deepest)
        chat4 = conversationData.prepareDefaultConversation(undefined, 'Chat4');
        chat4.folderId = nestedFolders[3].id;
        chat4.id = `${nestedFolders[3].id}/${chat4.id}`;
        conversationData.resetData();

        // Chat5 in Folder3.1.1
        chat5 = conversationData.prepareDefaultConversation(undefined, 'Chat5');
        chat5.folderId = nestedFolders[2].id;
        chat5.id = `${nestedFolders[2].id}/${chat5.id}`;
        conversationData.resetData();

        // Chat6 in Folder3.1
        chat6 = conversationData.prepareDefaultConversation(undefined, 'Chat6');
        chat6.folderId = nestedFolders[1].id;
        chat6.id = `${nestedFolders[1].id}/${chat6.id}`;
        conversationData.resetData();

        // Chat7 in Folder3
        chat7 = conversationData.prepareDefaultConversation(undefined, 'Chat7');
        chat7.folderId = nestedFolders[0].id;
        chat7.id = `${nestedFolders[0].id}/${chat7.id}`;

        await dataInjector.createConversations(
          [chat1, chat2, chat3, chat4, chat5, chat6, chat7],
          folder2,
          ...nestedFolders,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Create Folder1 via UI and export the structure',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        // 1. Create Folder1 via UI (empty folder can't be created via API)
        await chatBar.createNewFolder();
        await folderConversations.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.renameEmptyFolderWithTick('Folder1');
        folder1 = {
          id: 'Folder1',
          name: 'Folder1',
          type: FeatureType.Chat,
          folderId: '',
        };

        exportedData = await dialHomePage.downloadData(
          () => chatBar.exportButton.click(),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
        );
      },
    );

    await dialTest.step(
      'Update Chat1 and Chat4 with new requests',
      async () => {
        // Mock chat text response once for all requests
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );

        // Update Chat1
        await folderConversations.expandFolder(folder2.name);
        await folderConversations.selectFolderEntity(folder2.name, chat1.name);
        await chat.sendRequestWithButton('New request for Chat1');

        // Update Chat4 - need to expand nested folders
        await folderConversations.expandFolder(nestedFolders[0].name);
        await folderConversations.expandFolder(nestedFolders[1].name);
        await folderConversations.expandFolder(nestedFolders[2].name);
        await folderConversations.expandFolder(nestedFolders[3].name);

        await folderConversations.selectFolderEntity(
          nestedFolders[3].name,
          chat4.name,
        );
        await chat.sendRequestWithButton('New request for Chat4');
      },
    );

    await dialTest.step(
      'Import the structure and handle duplicate resolution',
      async () => {
        // Set isHttpMethodTriggered to false because a modal dialog will appear
        // for handling duplicate conversations (Replace, Postfix, Ignore options)
        await dialHomePage.importFile(
          exportedData,
          () => chatBar.importButton.click(),
          false,
        );

        // Wait for replace confirmation modal to appear
        await replaceConfirmationDialog.waitForState();

        // Set individual conversation options
        // Chat1: Replace (will restore original content)
        await replaceConfirmationDialog.setConversationOption(
          'Chat1',
          'Replace',
        );

        // Chat2, Chat4, Chat7: Postfix (will create duplicates with " 1" suffix)
        await replaceConfirmationDialog.setConversationOption(
          'Chat2',
          'Postfix',
        );
        await replaceConfirmationDialog.setConversationOption(
          'Chat4',
          'Postfix',
        );
        await replaceConfirmationDialog.setConversationOption(
          'Chat7',
          'Postfix',
        );

        // Chat3, Chat5, Chat6: Ignore (will keep existing, skip import)
        await replaceConfirmationDialog.setConversationOption(
          'Chat3',
          'Ignore',
        );
        await replaceConfirmationDialog.setConversationOption(
          'Chat5',
          'Ignore',
        );
        await replaceConfirmationDialog.setConversationOption(
          'Chat6',
          'Ignore',
        );

        // Click Continue to proceed with import
        await replaceConfirmationDialog.clickContinue();

        // Wait for import to complete
        await dialHomePage
          .getAppContainer()
          .getImportExportLoader()
          .waitForState({ state: 'hidden' });
        await dialHomePage.getAppContainer().waitForAppLoaded();
      },
    );

    await dialTest.step(
      'Verify import results - basic verification',
      async () => {
        // Verify Folder1 (empty folder) exists
        await expect
          .soft(
            folderConversations.getFolderByName(folder1.name),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();

        // Verify Folder2 structure with chats exists
        await expect
          .soft(
            folderConversations.getFolderEntity(folder2.name, chat1.name),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();

        // Verify Chat3 exists at root
        await expect
          .soft(
            conversations.getEntityByName(chat3.name),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();

        // Verify nested folder structure with chats
        await expect
          .soft(
            folderConversations.getFolderEntity(
              nestedFolders[3].name,
              chat4.name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();

        await expect
          .soft(
            folderConversations.getFolderEntity(
              nestedFolders[2].name,
              chat5.name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();

        await expect
          .soft(
            folderConversations.getFolderEntity(
              nestedFolders[1].name,
              chat6.name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();

        await expect
          .soft(
            folderConversations.getFolderEntity(
              nestedFolders[0].name,
              chat7.name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);
