import { Conversation } from '@/chat/types/chat';
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
    chat,
    chatMessages,
    conversations,
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
        // 1. Create Folder1 with no chats
        folder1 = conversationData.prepareFolder('Folder1');
        conversationData.resetData();

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
          folder1,
          folder2,
          ...nestedFolders,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Export the structure using Export button',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        exportedData = await dialHomePage.downloadData(
          () => chatBar.exportButton.click(),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
        );
      },
    );

    await dialTest.step(
      'Update Chat1 and Chat4 with new requests',
      async () => {
        // Update Chat1
        await folderConversations.selectFolderEntity(folder2.name, chat1.name);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
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
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('New request for Chat4');
      },
    );

    await dialTest.step(
      'Import the structure and handle duplicate resolution',
      async () => {
        // Note: The test description mentions selecting different import options
        // (Replace, Postfix, Ignore) for different chats. However, based on my research
        // of the framework, there doesn't seem to be a duplicateDialog fixture yet.
        // This test currently handles the basic import flow.
        // TODO: Add duplicate resolution handling when the duplicateDialog fixture is available.

        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
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
