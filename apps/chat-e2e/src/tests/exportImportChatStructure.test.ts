import { Conversation } from '@/chat/types/chat';
import { FeatureType } from '@/chat/types/common';
import { FolderInterface } from '@/chat/types/folder';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  ImportResolutionOption,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { GeneratorUtil } from '@/src/utils';
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
    chatBarFolderAssertion,
    chat,
    conversationAssertion,
    chatMessagesAssertion,
    replaceConfirmationDialog,
    replaceConfirmationDialogAssertion,
    toastAssertion,
    toast,
  }) => {
    setTestIds('EPMRTC-3024');
    let exportedData: UploadDownloadData;

    // Folder entities
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

    const folder1 = {
      id: 'Folder1',
      name: 'Folder1',
      type: FeatureType.Chat,
      folderId: '',
    };

    await dialTest.step(
      'Prepare folder structure and conversations',
      async () => {
        // Create Folder2 with Chat1 and Chat2 using E2E-prefixed names
        const folder2Data = conversationData.prepareFolderWithConversations(
          2,
          'Folder2',
        );
        folder2 = folder2Data.folders;
        folder2.name = 'Folder2';
        folder2.id = 'Folder2';
        [chat1, chat2] = folder2Data.conversations;
        conversationData.resetData();

        // Create Chat3 outside of all folders with E2E-prefixed name
        chat3 = conversationData.prepareDefaultConversation();
        conversationData.resetData();

        // Create Folder3 with nested folder structure (4 folders, 3 levels deep)
        nestedFolders = conversationData.prepareNestedFolder(4, {
          1: 'Folder3',
          2: 'Folder3.1',
          3: 'Folder3.1.1',
          4: 'Folder3.1.1.1',
        });

        // Create conversations for nested folders with E2E-prefixed names
        [chat7, chat6, chat5, chat4] =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);

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
        await folderConversations.renameEmptyFolderWithTick(folder1.name);

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
        await folderConversations.selectFolderEntity(folder2.name, chat1.name, {
          isHttpMethodTriggered: true,
        });
        await chat.sendRequestWithButton('New request for Chat1');

        // Update Chat4 - need to expand nested folders
        for (const folder of nestedFolders) {
          await folderConversations.expandFolder(folder.name);
        }

        await folderConversations.selectFolderEntity(
          nestedFolders[3].name,
          chat4.name,
          { isHttpMethodTriggered: true },
        );
        await chat.sendRequestWithButton('New request for Chat4');
      },
    );

    await dialTest.step(
      'Import the structure using Import button at the bottom of the chat panel',
      async () => {
        // Set isHttpMethodTriggered to false because a modal dialog will appear
        await dialHomePage.importFile(
          exportedData,
          () => chatBar.importButton.click(),
          false,
        );
        await replaceConfirmationDialog.waitForState();
      },
    );

    await dialTest.step('Verify the modal elements', async () => {
      // Verify "All items" has Postfix option selected
      await replaceConfirmationDialogAssertion.assertAllItemsOption(
        ImportResolutionOption.Postfix,
      );

      // Verify Empty folder (Folder1) does not exist on the duplicates window
      await replaceConfirmationDialogAssertion.assertFolderState(
        folder1.name,
        'hidden',
      );

      // Verify other folders exist (Folder2 and all nested folders) and folders are initially expanded
      const visibleFolders = [folder2, ...nestedFolders];
      for (const folder of visibleFolders) {
        await replaceConfirmationDialogAssertion.assertFolderState(
          folder.name,
          'visible',
        );
        await replaceConfirmationDialogAssertion.assertFolderExpanded(
          folder.name,
        );
      }

      // Verify all conversations exist
      const allConversations = [
        chat1,
        chat2,
        chat3,
        chat4,
        chat5,
        chat6,
        chat7,
      ];
      for (const conversation of allConversations) {
        await replaceConfirmationDialogAssertion.assertConversationState(
          conversation.name,
          'visible',
        );
      }
    });

    // TODO: Verify icons near folders is like on chat panel
    // TODO: Verify icons for the chats are the same as model icons on chat panel

    await dialTest.step('Verify folders can be collapsed', async () => {
      // Collapse folders from deepest to shallowest
      // nestedFolders: [0]=Folder3, [1]=Folder3.1, [2]=Folder3.1.1, [3]=Folder3.1.1.1
      // Conversations: [0]=chat7, [1]=chat6, [2]=chat5, [3]=chat4
      const nestedConversations = [chat7, chat6, chat5, chat4];

      for (let i = nestedFolders.length - 1; i >= 0; i--) {
        const folder = nestedFolders[i];
        // Collapse the current folder
        await replaceConfirmationDialog.expandCollapseFolder(folder.name);
        await replaceConfirmationDialogAssertion.assertFolderCollapsed(
          folder.name,
        );

        // Verify the conversation in this folder is now hidden
        await replaceConfirmationDialogAssertion.assertConversationState(
          nestedConversations[i].name,
          'hidden',
        );

        // Verify all nested folders inside this folder are hidden
        for (let j = i + 1; j < nestedFolders.length; j++) {
          await replaceConfirmationDialogAssertion.assertFolderState(
            nestedFolders[j].name,
            'hidden',
          );
        }

        // Verify all conversations in nested folders remain hidden
        for (let j = i + 1; j < nestedConversations.length; j++) {
          await replaceConfirmationDialogAssertion.assertConversationState(
            nestedConversations[j].name,
            'hidden',
          );
        }
      }

      // Collapse Folder2 (root level)
      await replaceConfirmationDialog.expandCollapseFolder(folder2.name);
      await replaceConfirmationDialogAssertion.assertFolderCollapsed(
        folder2.name,
      );
      // Verify Chat1 and Chat2 are hidden
      await replaceConfirmationDialogAssertion.assertConversationState(
        chat1.name,
        'hidden',
      );
      await replaceConfirmationDialogAssertion.assertConversationState(
        chat2.name,
        'hidden',
      );
    });

    await dialTest.step('Verify folders can be expanded', async () => {
      // Expand folders in reverse order (shallowest to deepest)
      // nestedFolders: [0]=Folder3, [1]=Folder3.1, [2]=Folder3.1.1, [3]=Folder3.1.1.1
      // Conversations: [0]=chat7, [1]=chat6, [2]=chat5, [3]=chat4
      const nestedConversations = [chat7, chat6, chat5, chat4];

      // Expand Folder2
      await replaceConfirmationDialog.expandCollapseFolder(folder2.name);
      await replaceConfirmationDialogAssertion.assertFolderExpanded(
        folder2.name,
      );
      // Verify Chat1 and Chat2 are visible
      await replaceConfirmationDialogAssertion.assertConversationState(
        chat1.name,
        'visible',
      );
      await replaceConfirmationDialogAssertion.assertConversationState(
        chat2.name,
        'visible',
      );

      // Expand nested folders from shallowest to deepest
      for (let i = 0; i < nestedFolders.length; i++) {
        const folder = nestedFolders[i];
        // Expand the current folder
        await replaceConfirmationDialog.expandCollapseFolder(folder.name);
        await replaceConfirmationDialogAssertion.assertFolderExpanded(
          folder.name,
        );

        // Verify conversation in this folder is visible
        await replaceConfirmationDialogAssertion.assertConversationState(
          nestedConversations[i].name,
          'visible',
        );

        // Verify all parent folders remain visible and expanded
        for (let j = 0; j < i; j++) {
          await replaceConfirmationDialogAssertion.assertFolderState(
            nestedFolders[j].name,
            'visible',
          );
          await replaceConfirmationDialogAssertion.assertFolderExpanded(
            nestedFolders[j].name,
          );
        }

        // Verify immediate nested folder is visible (if exists)
        if (i < nestedFolders.length - 1) {
          await replaceConfirmationDialogAssertion.assertFolderState(
            nestedFolders[i + 1].name,
            'visible',
          );
        }

        // Verify all deeper nested folders are still collapsed (hidden)
        for (let j = i + 2; j < nestedFolders.length; j++) {
          await replaceConfirmationDialogAssertion.assertFolderState(
            nestedFolders[j].name,
            'hidden',
          );
        }

        // Verify conversations in deeper nested folders remain hidden
        for (let j = i + 1; j < nestedConversations.length; j++) {
          await replaceConfirmationDialogAssertion.assertConversationState(
            nestedConversations[j].name,
            'hidden',
          );
        }
      }
    });

    // TODO: Verify folders are located with indents (nice hierarchy) and expanded (blocked by issue #4996 - do not automate)

    await dialTest.step(
      'Select options for individual conversations',
      async () => {
        // Set individual conversation options
        // Chat1: Replace (will restore original content)
        await replaceConfirmationDialog.setConversationOption(
          'Chat1',
          ImportResolutionOption.Replace,
        );

        // Chat2, Chat4, Chat7: Postfix (will create duplicates with " 1" suffix)
        await replaceConfirmationDialog.setConversationOption(
          'Chat2',
          ImportResolutionOption.Postfix,
        );
        await replaceConfirmationDialog.setConversationOption(
          'Chat4',
          ImportResolutionOption.Postfix,
        );
        await replaceConfirmationDialog.setConversationOption(
          'Chat7',
          ImportResolutionOption.Postfix,
        );

        // Chat3, Chat5, Chat6: Ignore (will keep existing, skip import)
        await replaceConfirmationDialog.setConversationOption(
          'Chat3',
          ImportResolutionOption.Ignore,
        );
        await replaceConfirmationDialog.setConversationOption(
          'Chat5',
          ImportResolutionOption.Ignore,
        );
        await replaceConfirmationDialog.setConversationOption(
          'Chat6',
          ImportResolutionOption.Ignore,
        );
      },
    );

    await dialTest.step(
      'Verify "All items" has Mixed option selected',
      async () => {
        // After selecting different options for individual conversations,
        // "All items" should show "Mixed" option
        await replaceConfirmationDialogAssertion.assertAllItemsOption(
          ExpectedConstants.mixedImportOption,
        );
      },
    );

    await dialTest.step('Continue import', async () => {
      // Click Continue to proceed with import
      // Wait for 4 POST requests: Chat1 (Replace) + Chat2, Chat4, Chat7 (Postfix)
      // Chat3, Chat5, Chat6 are Ignored and don't trigger POST requests
      await replaceConfirmationDialog.clickContinue({
        expectedPostRequests: 4,
      });
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Verify import results and conversation states',
      async () => {
        // Verify success toast message appears
        await toastAssertion.assertToastMessage(
          ExpectedMessages.conversationsImportedSuccessfully,
        );
        await toast.closeToast();

        // Verify Folder1 (empty folder) exists
        await folderConversations.getFolderByName(folder1.name).waitFor();

        // Verify Folder2 structure with original Chat1 (replaced, no new messages)
        await chatBarFolderAssertion.assertFolderEntityState(
          folder2,
          chat1,
          'visible',
        );

        // Verify Chat2 1 was created with postfix in Folder2
        await chatBarFolderAssertion.assertFolderEntityState(
          folder2,
          { name: 'Chat2 1' },
          'visible',
        );

        // Verify original Chat2 still exists
        await chatBarFolderAssertion.assertFolderEntityState(
          folder2,
          chat2,
          'visible',
        );

        // Verify Chat3 exists at root and unchanged (no postfix)
        await conversationAssertion.assertEntityState(chat3, 'visible');
        await conversationAssertion.assertEntityState(
          { name: 'Chat3 1' },
          'hidden',
        );

        // Verify nested folder structure with Chat4 1 (postfix)
        await chatBarFolderAssertion.assertFolderEntityState(
          nestedFolders[3],
          { name: 'Chat4 1' },
          'visible',
        );

        // Verify original Chat4 still exists
        await chatBarFolderAssertion.assertFolderEntityState(
          nestedFolders[3],
          chat4,
          'visible',
        );

        // Verify Chat5 unchanged (ignored, no postfix)
        await chatBarFolderAssertion.assertFolderEntityState(
          nestedFolders[2],
          chat5,
          'visible',
        );
        await chatBarFolderAssertion.assertFolderEntityState(
          nestedFolders[2],
          { name: 'Chat5 1' },
          'hidden',
        );

        // Verify Chat6 unchanged (ignored, no postfix)
        await chatBarFolderAssertion.assertFolderEntityState(
          nestedFolders[1],
          chat6,
          'visible',
        );
        await chatBarFolderAssertion.assertFolderEntityState(
          nestedFolders[1],
          { name: 'Chat6 1' },
          'hidden',
        );

        // Verify Chat7 1 was created with postfix
        await chatBarFolderAssertion.assertFolderEntityState(
          nestedFolders[0],
          { name: 'Chat7 1' },
          'visible',
        );

        // Verify original Chat7 still exists
        await chatBarFolderAssertion.assertFolderEntityState(
          nestedFolders[0],
          chat7,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify Chat1 was replaced and verify Chat4 and "Chat4 1" histories',
      async () => {
        // Select Chat1 and verify it has original content (no new message from update step)
        await folderConversations.selectFolderEntity(folder2.name, chat1.name);
        await chatMessagesAssertion.assertMessagesCount(
          chat1.messages.length,
          ExpectedMessages.replacedConversationHasOriginalMessages,
        );

        // Select original Chat4 and verify it has updated content (with new message)
        await folderConversations.selectFolderEntity(
          nestedFolders[3].name,
          chat4.name,
        );
        await chatMessagesAssertion.assertMessagesCount(
          chat4.messages.length + 2,
          ExpectedMessages.updatedConversationHasOriginalAndNewMessages,
        );

        // Select Chat4 1 and verify it has imported (original) content only
        await folderConversations.selectFolderEntity(
          nestedFolders[3].name,
          'Chat4 1',
        );
        await chatMessagesAssertion.assertMessagesCount(
          chat4.messages.length,
          ExpectedMessages.postfixedConversationHasImportedMessages,
        );
      },
    );
  },
);
