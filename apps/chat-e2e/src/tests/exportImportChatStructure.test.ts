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
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

dialTest(
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
    replaceConfirmationModal,
    replaceConfirmationModalAssertion,
    replaceConfirmationModalFolders,
    replaceConfirmationModalConversations,
    replaceConfirmationModalFoldersAssertion,
    replaceConfirmationModalConversationsAssertion,
    toastAssertion,
    iconApiHelper,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-7085');
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
        await chat.sendRequestWithButton(`New request for ${chat1.name}`);

        // Update Chat4 - need to expand nested folders
        for (const folder of nestedFolders) {
          await folderConversations.expandFolder(folder.name);
        }

        await folderConversations.selectFolderEntity(
          nestedFolders[3].name,
          chat4.name,
          { isHttpMethodTriggered: true },
        );
        await chat.sendRequestWithButton(`New request for ${chat4.name}`);
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
        await replaceConfirmationModal.waitForState();
      },
    );

    await dialTest.step('Verify the modal elements', async () => {
      // Verify "All items" has Postfix option selected
      await replaceConfirmationModalAssertion.assertAllItemsOption(
        ImportResolutionOption.Postfix,
      );

      // Verify Empty folder (Folder1) does not exist on the duplicates window
      await replaceConfirmationModalFoldersAssertion.assertFolderState(
        { name: folder1.name },
        'hidden',
      );

      // Verify other folders exist (Folder2 and all nested folders) and folders are initially expanded
      const visibleFolders = [folder2, ...nestedFolders];
      for (const folder of visibleFolders) {
        await replaceConfirmationModalFoldersAssertion.assertFolderState(
          { name: folder.name },
          'visible',
        );
        await replaceConfirmationModalFoldersAssertion.assertFolderCaretState(
          { name: folder.name },
          'expanded',
        );
      }

      // Verify all conversations exist
      // Folder conversations with their parent folders
      const folderConversationPairs = [
        { folder: folder2, conversation: chat1 },
        { folder: folder2, conversation: chat2 },
        { folder: nestedFolders[3], conversation: chat4 },
        { folder: nestedFolders[2], conversation: chat5 },
        { folder: nestedFolders[1], conversation: chat6 },
        { folder: nestedFolders[0], conversation: chat7 },
      ];
      for (const pair of folderConversationPairs) {
        await replaceConfirmationModalFoldersAssertion.assertFolderEntityState(
          { name: pair.folder.name },
          { name: pair.conversation.name },
          'visible',
        );
      }
      // Root conversation: Chat3
      await replaceConfirmationModalConversationsAssertion.assertEntityState(
        { name: chat3.name },
        'visible',
      );
    });

    await dialTest.step('Verify folder and conversation icons', async () => {
      // Verify folder icons - folders use standard SVG folder icons
      const visibleFolders = [folder2, ...nestedFolders];
      for (const folder of visibleFolders) {
        const folderIcon = replaceConfirmationModalFolders.getFolderIcon(
          folder.name,
        );
        // For folders, we just verify the icon is visible
        await folderIcon.waitFor({ state: 'visible' });
      }

      // Verify conversation icons - conversations should have model icons
      // Folder conversations with their parent folders
      const folderConversationPairs = [
        { folder: folder2, conversation: chat1 },
        { folder: folder2, conversation: chat2 },
        { folder: nestedFolders[3], conversation: chat4 },
        { folder: nestedFolders[2], conversation: chat5 },
        { folder: nestedFolders[1], conversation: chat6 },
        { folder: nestedFolders[0], conversation: chat7 },
      ];
      for (const pair of folderConversationPairs) {
        const conversationIcon =
          replaceConfirmationModalFolders.getFolderEntityIcon(
            pair.folder.name,
            pair.conversation.name,
          );
        const modelEntity = ModelsUtil.getOpenAIEntity(
          pair.conversation.model.id,
        );
        const expectedIcon = iconApiHelper.getEntityIcon(modelEntity!);
        await baseAssertion.assertEntityIcon(conversationIcon, expectedIcon);
      }

      // Root conversation: Chat3
      const chat3Icon = replaceConfirmationModalConversations.getEntityIcon(
        chat3.name,
      );
      const chat3ModelEntity = ModelsUtil.getOpenAIEntity(chat3.model.id);
      const chat3ExpectedIcon = iconApiHelper.getEntityIcon(chat3ModelEntity!);
      await baseAssertion.assertEntityIcon(chat3Icon, chat3ExpectedIcon);
    });

    await dialTest.step('Verify folders can be collapsed', async () => {
      // Collapse folders from deepest to shallowest
      // nestedFolders: [0]=Folder3, [1]=Folder3.1, [2]=Folder3.1.1, [3]=Folder3.1.1.1
      // Conversations: [0]=chat7, [1]=chat6, [2]=chat5, [3]=chat4
      const nestedConversations = [chat7, chat6, chat5, chat4];

      for (let i = nestedFolders.length - 1; i >= 0; i--) {
        const folder = nestedFolders[i];
        // Collapse the current folder
        await replaceConfirmationModalFolders.expandCollapseFolder(folder.name);
        await replaceConfirmationModalFoldersAssertion.assertFolderCaretState(
          { name: folder.name },
          'collapsed',
        );

        // Verify the conversation in this folder is now hidden
        await replaceConfirmationModalFoldersAssertion.assertFolderEntityState(
          { name: folder.name },
          { name: nestedConversations[i].name },
          'hidden',
        );

        // Verify all nested folders inside this folder are hidden
        for (let j = i + 1; j < nestedFolders.length; j++) {
          await replaceConfirmationModalFoldersAssertion.assertFolderState(
            { name: nestedFolders[j].name },
            'hidden',
          );
        }

        // Verify all conversations in nested folders remain hidden
        for (let j = i + 1; j < nestedConversations.length; j++) {
          await replaceConfirmationModalFoldersAssertion.assertFolderEntityState(
            { name: nestedFolders[j].name },
            { name: nestedConversations[j].name },
            'hidden',
          );
        }
      }

      // Collapse Folder2 (root level)
      await replaceConfirmationModalFolders.expandCollapseFolder(folder2.name);
      await replaceConfirmationModalFoldersAssertion.assertFolderCaretState(
        { name: folder2.name },
        'collapsed',
      );
      // Verify Chat1 and Chat2 are hidden
      await replaceConfirmationModalFoldersAssertion.assertFolderEntityState(
        { name: folder2.name },
        { name: chat1.name },
        'hidden',
      );
      await replaceConfirmationModalFoldersAssertion.assertFolderEntityState(
        { name: folder2.name },
        { name: chat2.name },
        'hidden',
      );
    });

    await dialTest.step('Verify folders can be expanded', async () => {
      // Expand folders in reverse order (shallowest to deepest)
      // nestedFolders: [0]=Folder3, [1]=Folder3.1, [2]=Folder3.1.1, [3]=Folder3.1.1.1
      // Conversations: [0]=chat7, [1]=chat6, [2]=chat5, [3]=chat4
      const nestedConversations = [chat7, chat6, chat5, chat4];

      // Expand Folder2
      await replaceConfirmationModalFolders.expandCollapseFolder(folder2.name);
      await replaceConfirmationModalFoldersAssertion.assertFolderCaretState(
        { name: folder2.name },
        'expanded',
      );
      // Verify Chat1 and Chat2 are visible
      await replaceConfirmationModalFoldersAssertion.assertFolderEntityState(
        { name: folder2.name },
        { name: chat1.name },
        'visible',
      );
      await replaceConfirmationModalFoldersAssertion.assertFolderEntityState(
        { name: folder2.name },
        { name: chat2.name },
        'visible',
      );

      // Expand nested folders from shallowest to deepest
      for (let i = 0; i < nestedFolders.length; i++) {
        const folder = nestedFolders[i];
        // Expand the current folder
        await replaceConfirmationModalFolders.expandCollapseFolder(folder.name);
        await replaceConfirmationModalFoldersAssertion.assertFolderCaretState(
          { name: folder.name },
          'expanded',
        );

        // Verify conversation in this folder is visible
        await replaceConfirmationModalFoldersAssertion.assertFolderEntityState(
          { name: folder.name },
          { name: nestedConversations[i].name },
          'visible',
        );

        // Verify all parent folders remain visible and expanded
        for (let j = 0; j < i; j++) {
          await replaceConfirmationModalFoldersAssertion.assertFolderState(
            { name: nestedFolders[j].name },
            'visible',
          );
          await replaceConfirmationModalFoldersAssertion.assertFolderCaretState(
            { name: nestedFolders[j].name },
            'expanded',
          );
        }

        // Verify immediate nested folder is visible (if exists)
        if (i < nestedFolders.length - 1) {
          await replaceConfirmationModalFoldersAssertion.assertFolderState(
            { name: nestedFolders[i + 1].name },
            'visible',
          );
        }

        // Verify all deeper nested folders are still collapsed (hidden)
        for (let j = i + 2; j < nestedFolders.length; j++) {
          await replaceConfirmationModalFoldersAssertion.assertFolderState(
            { name: nestedFolders[j].name },
            'hidden',
          );
        }

        // Verify conversations in deeper nested folders remain hidden
        for (let j = i + 1; j < nestedConversations.length; j++) {
          await replaceConfirmationModalFoldersAssertion.assertFolderEntityState(
            { name: nestedFolders[j].name },
            { name: nestedConversations[j].name },
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
        // NOTE: Due to a current bug, all conversations are rendered at root level
        // in the modal (not inside folders), so we use replaceConfirmationModalConversations
        // for all conversations. When the bug is fixed, we should use
        // replaceConfirmationModalFolders.setConversationOption() for folder conversations.

        // Chat1: Replace (will restore original content)
        await replaceConfirmationModalConversations.setConversationOption(
          chat1.name,
          ImportResolutionOption.Replace,
        );

        // Chat2, Chat4, Chat7: Postfix (will create duplicates with " 1" suffix)
        const postfixConversations = [chat2, chat4, chat7];
        for (const chat of postfixConversations) {
          await replaceConfirmationModalConversations.setConversationOption(
            chat.name,
            ImportResolutionOption.Postfix,
          );
        }

        // Chat3, Chat5, Chat6: Ignore (will keep existing, skip import)
        const ignoreConversations = [chat3, chat5, chat6];
        for (const chat of ignoreConversations) {
          await replaceConfirmationModalConversations.setConversationOption(
            chat.name,
            ImportResolutionOption.Ignore,
          );
        }
      },
    );

    await dialTest.step(
      'Verify "All items" has Mixed option selected',
      async () => {
        // After selecting different options for individual conversations,
        // "All items" should show "Mixed" option
        await replaceConfirmationModalAssertion.assertAllItemsOption(
          ExpectedConstants.mixedImportOption,
        );
      },
    );

    await dialTest.step('Continue import', async () => {
      // Wait for requests for: Chat1 (Replace) + Chat2, Chat4, Chat7 (Postfix)
      // Replace operations use PUT, Postfix operations use POST
      // Postfix operations append " 1" to the conversation name (URL-encoded)
      const expectedRequests = new Map<string, string>([
        [`${chat1.folderId}/${chat1.model.id}__${chat1.name}`, 'PUT'], // Replace triggers PUT
        [
          `${chat2.folderId}/${chat2.model.id}__${chat2.name}${encodeURIComponent(' 1')}`,
          'POST',
        ], // Postfix triggers POST (creates "Chat2 1")
        [
          `${chat4.folderId}/${chat4.model.id}__${chat4.name}${encodeURIComponent(' 1')}`,
          'POST',
        ], // Postfix triggers POST (creates "Chat4 1")
        [
          `${chat7.folderId}/${chat7.model.id}__${chat7.name}${encodeURIComponent(' 1')}`,
          'POST',
        ], // Postfix triggers POST (creates "Chat7 1")
      ]);

      await replaceConfirmationModal.clickContinue(expectedRequests);
    });

    await dialTest.step(
      'Verify import results and conversation states',
      async () => {
        // Verify success toast message appears
        await toastAssertion.assertToastMessage(
          ExpectedMessages.conversationsImportedSuccessfully,
        );
        //TODO should be uncommented after the fix of the double toast
        // await toast.closeToast();
        await dialHomePage.waitForPageLoaded({ waitForAgentInfo: false });

        // Verify Folder1 (empty folder) exists
        await folderConversations.getFolderByName(folder1.name).waitFor();

        // Verify Folder2 structure with original Chat1 (replaced), Chat2 1 (postfix), and original Chat2
        const folder2ExpectedVisible = [
          chat1,
          { name: `${chat2.name} 1` },
          chat2,
        ];
        for (const entity of folder2ExpectedVisible) {
          await chatBarFolderAssertion.assertFolderEntityState(
            folder2,
            entity,
            'visible',
          );
        }

        // Verify Chat3 exists at root and unchanged (no postfix)
        await conversationAssertion.assertEntityState(chat3, 'visible');
        await conversationAssertion.assertEntityState(
          { name: `${chat3.name} 1` },
          'hidden',
        );

        // Verify nested folder structure
        const nestedFolderExpectations = [
          {
            folder: nestedFolders[3],
            visible: [chat4, { name: `${chat4.name} 1` }],
            hidden: [],
          },
          {
            folder: nestedFolders[2],
            visible: [chat5],
            hidden: [{ name: `${chat5.name} 1` }],
          },
          {
            folder: nestedFolders[1],
            visible: [chat6],
            hidden: [{ name: `${chat6.name} 1` }],
          },
          {
            folder: nestedFolders[0],
            visible: [chat7, { name: `${chat7.name} 1` }],
            hidden: [],
          },
        ];

        for (const expectation of nestedFolderExpectations) {
          for (const entity of expectation.visible) {
            await chatBarFolderAssertion.assertFolderEntityState(
              expectation.folder,
              entity,
              'visible',
            );
          }
          for (const entity of expectation.hidden) {
            await chatBarFolderAssertion.assertFolderEntityState(
              expectation.folder,
              entity,
              'hidden',
            );
          }
        }
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
          `${chat4.name} 1`,
        );
        await chatMessagesAssertion.assertMessagesCount(
          chat4.messages.length,
          ExpectedMessages.postfixedConversationHasImportedMessages,
        );
      },
    );
  },
);
