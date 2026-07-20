import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication } from '@/chat/types/publication';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  AttachFilesFolders,
  Attachment,
  CheckboxState,
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  FileManagerToolbarTabs,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { loadingTimeout } from '@/src/ui/pages';
import { BaseElement } from '@/src/ui/webElements';
import { BucketUtil, GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';
import { Locator } from '@playwright/test';

dialSharedWithMeTest(
  'Arrow icon appears for file in Manage attachments if it was shared along with chat. The file is located in folders in "All files". The file is used in the model answer.\n' +
    'Arrow icon appears for file in Manage attachments if it was shared along with chat folder.\n' +
    //'Arrow icon appears for file in Manage attachments if new chat was moved to already shared folder.\n' +
    'Arrow icon appears for the folder and file with the special chars in their names.\n' +
    'On "Shared with me" tab folder tree is expanded by default on each tab opening.\n' +
    'Error message appears if to Share the conversation with an attachment from Shared with me\n' +
    'Arrow icon stays for the file if the chat was unshared by the owner\n' +
    'Arrow icon stays for the file if the chat was renamed or deleted, or model was changed\n' +
    'Arrow icon disappears if all the users delete the file from "Shared with me"\n' +
    'Shared with me: the file with special chars in the name appears in "Shared with me" root',
  async ({
    setTestIds,
    conversationData,
    dataInjector,
    fileApiHelper,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    fileManagerPage,
    fileManagerFoldersTree,
    fileManagerGridAssertion,
    localStorageManager,
    additionalShareUserSendMessage,
    additionalShareUserConversations,
    additionalShareUserChat,
    additionalShareUserConversationDropdownMenu,
    additionalShareUserAttachmentDropdownMenu,
    additionalShareUserFileManagerModal,
    additionalShareUserFileManagerModalToolbar,
    additionalShareUserFileManagerModalGrid,
    additionalShareUserFileManagerModalGridAssertion,
    additionalShareUserFileManagerModalFoldersTree,
    additionalShareUserFileManagerModalFoldersTreeAssertion,
    additionalShareUserDialHomePage,
    additionalShareUserLocalStorageManager,
    additionalShareUserToastAssertion,
    conversations,
    appContainer,
    confirmationDialog,
    conversationDropdownMenu,
    agentInfo,
    chatMessages,
    chatHeader,
    talkToAgentDialog,
    additionalSecondUserShareApiHelper,
    additionalSecondShareUserFileApiHelper,
    additionalShareUserFileApiHelper,
    toast,
    navigationPanel,
    renameConversationModal,
  }) => {
    dialSharedWithMeTest.slow();
    setTestIds(
      'EPMRTC-4133',
      'EPMRTC-4134',
      /*'EPMRTC-4135,'*/
      'EPMRTC-4155',
      'EPMRTC-4166',
      'EPMRTC-4156',
      'EPMRTC-4123',
      'EPMRTC-3116',
      'EPMRTC-3122',
      'EPMRTC-4164',
    );
    let imageUrl: string;
    let imageUrl2: string;
    let imageInConversationInFolderUrl: string;
    let specialCharsImageUrl: string;
    //TODO EPMRTC-4135 blocked by the #1076
    // let imageInFolderUrl2: string;
    let shareByLinkResponse: ShareByLinkResponseModel;
    let shareFolderByLinkResponse: ShareByLinkResponseModel;
    let randomModelWithImageAttachment: DialAIEntityModel;
    let randomModelWithImageAttachmentId: string;
    let conversationInFolder: Conversation;
    //TODO EPMRTC-4135 blocked by the #1076
    // let conversationToMove: Conversation;
    const folderName = 'Folder with conversation';
    const specialCharsFolder = `Folder ${ExpectedConstants.allowedSpecialChars}`;
    let conversationWithSpecialChars: Conversation;
    let conversationWithTwoResponses: Conversation;
    const appdataFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
      Attachment.flowerImageName,
    ];
    let nestedFolders: string[];
    const expectedArrowColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textAccentPrimary,
    );

    await localStorageManager.setChatCollapsedSection(
      CollapsedSections.Organization,
    );

    await dialTest.step(
      'Upload image file to a conversation and prepare conversation with attachments in response',
      async () => {
        randomModelWithImageAttachment = GeneratorUtil.randomArrayElement(
          ModelsUtil.getLatestModelsWithAttachment().filter(
            (m) =>
              m.inputAttachmentTypes?.length == 1 &&
              m.inputAttachmentTypes[0] === Attachment.imageTypesExtension,
          ),
        );
        randomModelWithImageAttachmentId = randomModelWithImageAttachment.id;
        nestedFolders = [
          AttachFilesFolders.appdata,
          randomModelWithImageAttachmentId,
          AttachFilesFolders.images,
        ];
        imageUrl = await fileApiHelper.putFile(Attachment.sunImageName, {
          parentPath: API.modelFilePath(randomModelWithImageAttachmentId),
        });
        imageUrl2 = await fileApiHelper.putFile(Attachment.cloudImageName, {
          parentPath: API.modelFilePath(randomModelWithImageAttachmentId),
        });
        imageInConversationInFolderUrl = await fileApiHelper.putFile(
          Attachment.flowerImageName,
          { parentPath: API.modelFilePath(randomModelWithImageAttachmentId) },
        );
        specialCharsImageUrl = await fileApiHelper.putFile(
          Attachment.specialSymbolsName,
          { parentPath: specialCharsFolder },
        );

        //TODO EPMRTC-4135 blocked by the #1076
        // imageInFolderUrl2 = await fileApiHelper.putFile(
        //   Attachment.heartImageName,
        //   API.modelFilePath(defaultModel),
        // );

        conversationWithTwoResponses =
          conversationData.prepareHistoryConversationWithAttachmentsInRequest({
            1: {
              model: randomModelWithImageAttachmentId,
              attachmentUrl: [imageUrl],
            },
            2: {
              model: randomModelWithImageAttachmentId,
              attachmentUrl: [imageUrl2],
            },
          });

        conversationData.resetData();

        conversationInFolder =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageInConversationInFolderUrl,
            randomModelWithImageAttachmentId,
            folderName,
          );

        conversationData.resetData();
        conversationWithSpecialChars =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModelWithImageAttachmentId,
            true,
            undefined,
            specialCharsImageUrl,
          );
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithImageAttachment,
        );

        //TODO EPMRTC-4135 blocked by the #1076
        // conversationData.resetData();
        // conversationToMove = conversationData.prepareConversationWithAttachmentInResponse(
        //   imageInFolderUrl2,
        //   defaultModel
        // );

        await dataInjector.createConversations([
          conversationWithTwoResponses,
          conversationInFolder,
          /*conversationToMove,*/ conversationWithSpecialChars,
        ]);
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          conversationWithTwoResponses,
          conversationWithSpecialChars,
        ]);
        shareFolderByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            [conversationInFolder],
            true,
          );
      },
    );

    await dialTest.step('Accept share invitation by another user', async () => {
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      await additionalSecondUserShareApiHelper.acceptInvite(
        shareByLinkResponse,
      );
      await additionalUserShareApiHelper.acceptInvite(
        shareFolderByLinkResponse,
      );
      await localStorageManager.setShowSideBarPanels();
    });

    //TODO EPMRTC-4135 blocked by the #1076
    // await dialTest.step(
    //   'Move the second conversation to the shared folder',
    //   async () => {
    //     await folderConversations.expandFolder(folderName);
    //     await chatBar.dragAndDropConversationToFolderConversation(
    //       folderName,
    //       conversationInFolder.name,
    //       conversationToMove.name,
    //       {isHttpMethodTriggered: true}
    //     );
    //   }
    // );

    await dialTest.step(
      'Open "File manager" page and verify shared files have arrow icons',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        await fileManagerFoldersTree.expandFolders(
          { isFilesListingTriggered: true },
          ...nestedFolders,
        );
        for (const file of appdataFiles) {
          await fileManagerGridAssertion.assertGridRowByNameState(
            file,
            'visible',
          );
          await fileManagerGridAssertion.assertGridFileSharedState(
            file,
            'visible',
          );
          await fileManagerGridAssertion.assertGridFileSharedIconColor(
            file,
            expectedArrowColor,
          );
        }
        await fileManagerFoldersTree.expandFolders(
          { isFilesListingTriggered: false },
          specialCharsFolder,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.specialSymbolsName,
          'visible',
        );
        await fileManagerGridAssertion.assertGridFileSharedState(
          Attachment.specialSymbolsName,
          'visible',
        );
        await fileManagerGridAssertion.assertGridFileSharedIconColor(
          Attachment.specialSymbolsName,
          expectedArrowColor,
        );

        //TODO EPMRTC-4135 blocked by the #1076
        // const fourthImageEntity: TreeEntity = { name: Attachment.heartImageName };
        // await manageAttachmentsAssertion.assertSharedFileArrowIconState(fourthImageEntity, 'visible');
        // await manageAttachmentsAssertion.assertEntityArrowIconColor(fourthImageEntity, expectedArrowColor);
      },
    );

    await dialSharedWithMeTest.step(
      'By user2 open "File manager" and verify "Shared with Me" tree is expanded',
      async () => {
        await additionalShareUserLocalStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithImageAttachment,
        );
        await additionalShareUserLocalStorageManager.setShowSideBarPanels();
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSendMessage.attachmentMenuTrigger.click();
        await additionalShareUserAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        await additionalShareUserFileManagerModalToolbar.sharedWithMeTab.click();
        await additionalShareUserFileManagerModalFoldersTreeAssertion.assertFolderExpandedState(
          'expanded',
          FileManagerToolbarTabs.SharedWithMe,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Verify folder state is not saved after switching to another tab',
      async () => {
        await additionalShareUserFileManagerModalFoldersTree
          .folderByPathCaret(FileManagerToolbarTabs.SharedWithMe)
          .click();
        await additionalShareUserFileManagerModalFoldersTreeAssertion.assertFolderExpandedState(
          'collapsed',
          FileManagerToolbarTabs.SharedWithMe,
        );
        await additionalShareUserFileManagerModalToolbar.organizationTab.click();
        await additionalShareUserFileManagerModalToolbar.sharedWithMeTab.click();
        await additionalShareUserFileManagerModalFoldersTreeAssertion.assertFolderExpandedState(
          'expanded',
          FileManagerToolbarTabs.SharedWithMe,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'By user2 create a conversation with attachments from File manager "Shared with me" tab',
      async () => {
        const newRequest = GeneratorUtil.randomString(10);
        await additionalShareUserFileManagerModalFoldersTreeAssertion.assertFolderState(
          'hidden',
          specialCharsFolder,
        );
        await additionalShareUserFileManagerModalGridAssertion.assertGridRowByNameState(
          Attachment.specialSymbolsName,
          'visible',
        );
        const attachmentCheckbox =
          await additionalShareUserFileManagerModalGrid.gridCheckboxByNameCell(
            Attachment.specialSymbolsName,
          );
        await attachmentCheckbox.click();
        await additionalShareUserFileManagerModal.getAttachButton().click();
        await additionalShareUserDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await additionalShareUserChat.sendRequestWithButton(newRequest);
        await additionalShareUserConversations.openEntityDropdownMenu(
          newRequest,
        );
        await additionalShareUserConversationDropdownMenu.selectMenuOption(
          MenuOptions.share,
        );
        await additionalShareUserToastAssertion.assertToastMessage(
          ExpectedConstants.sharingWithAttachmentNotFromAllFilesErrorMessage,
          ExpectedMessages.sharingWithAttachmentNotFromAllFilesFailed,
        );
        await toast.closeToast();
        await navigationPanel.backToChat();
        await conversations.selectEntity(conversationWithTwoResponses.name);
        await conversations
          .selectedEntity(conversationWithTwoResponses.name)
          .waitFor();
        await appContainer.waitForAppLoaded(loadingTimeout);
      },
    );

    for (const action of ['rename', 'model change', 'delete']) {
      await dialTest.step(`User1 ${action}s the shared chat`, async () => {
        switch (action) {
          case 'rename':
            await conversations.openEntityDropdownMenu(
              conversationWithTwoResponses.name,
            );
            conversationWithTwoResponses.name = GeneratorUtil.randomString(10);
            await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
            await renameConversationModal.editConversationNameWithSaveButton(
              conversationWithTwoResponses.name,
            );
            await chatMessages.waitForState();
            break;
          case 'model change':
            await chatHeader.chatAgent.click();
            await talkToAgentDialog.selectAgent(
              GeneratorUtil.randomArrayElement(
                ModelsUtil.getLatestModels().filter(
                  (model) => model.id !== randomModelWithImageAttachmentId,
                ),
              ),
            );
            await chatMessages.waitForState();
            break;
          case 'delete':
            await conversations.openEntityDropdownMenu(
              conversationWithTwoResponses.name,
            );
            await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
            await confirmationDialog.confirm({
              triggeredHttpMethod: 'DELETE',
            });
            await agentInfo.waitForState();
            break;
        }
      });

      await dialTest.step(
        'User1 opens "File manager" and finds file attached to the chat',
        async () => {
          await navigationPanel.goToFileManager();
          await fileManagerFoldersTree.expandFolders(
            { isFilesListingTriggered: false },
            ...nestedFolders,
          );
          for (const file of [
            Attachment.sunImageName,
            Attachment.cloudImageName,
          ]) {
            await fileManagerGridAssertion.assertGridFileSharedState(
              file,
              'visible',
            );
          }
          await navigationPanel.backToChat();
        },
      );
    }

    const pathToDeleteSharedByUser1SunImage = `files/${BucketUtil.getBucket()}/${specialCharsFolder}/${Attachment.specialSymbolsName}`;

    await dialTest.step(
      'By User2 delete the file from "Shared with me"',
      async () => {
        await additionalShareUserFileApiHelper.deleteFromSharedWithMe(
          pathToDeleteSharedByUser1SunImage,
        );
      },
    );

    await dialTest.step(
      'By User1 check that arrow still exist for the file',
      async () => {
        await fileManagerPage.openFileManagerPage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: true,
          getStyles: false,
        });
        await fileManagerFoldersTree.expandFolders(
          { isFilesListingTriggered: false },
          specialCharsFolder,
        );
        await fileManagerGridAssertion.assertGridFileSharedState(
          Attachment.specialSymbolsName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'By User3 delete the file from "Shared with me"',
      async () => {
        await additionalSecondShareUserFileApiHelper.deleteFromSharedWithMe(
          pathToDeleteSharedByUser1SunImage,
        );
      },
    );

    await dialTest.step(
      'By User1 check that the arrow disappears from the file',
      async () => {
        await fileManagerPage.openFileManagerPage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: true,
          getStyles: false,
        });
        await fileManagerFoldersTree.expandFolders(
          { isFilesListingTriggered: false },
          specialCharsFolder,
        );
        await fileManagerGridAssertion.assertGridFileSharedState(
          Attachment.specialSymbolsName,
          'hidden',
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me: shared files located in "All folders" root appear in "Shared with me" root. The chat was shared.\n' +
    'Shared with me: shared files located in folders appear in "Shared with me" root. The chat was shared.\n' +
    'Shared with me: shared files appear in "Shared with me" root. The folder was shared.\n' +
    'Shared with me: download a file via context menu\n' +
    'Shared with me: delete a file via context menu\n' +
    'Shared with me: download multiple files\n' +
    'Shared with me: delete multiples files\n' +
    "The 'Shared with me' section appears and disappears from Manage Attachments depending on the existence of shared files\n" +
    'Search: File from "Shared with me" is found\n' +
    'Search: No results found\n' +
    'Deleted by the owner file disappears from "Shared with me". Other files exist and stay in "Shared with me".\n' +
    'Shared with me: the file stays if the chat was unshared, renamed, model was changed, the chat was deleted by the owner\n' +
    '[File Manager][Shared with me]: Toast message when Unshare item',
  async ({
    setTestIds,
    conversationData,
    dataInjector,
    fileApiHelper,
    additionalShareUserFileApiHelper,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserFileManagerToolbar,
    additionalShareUserFileManagerPage,
    additionalShareUserFileManagerGridRowDropdownMenu,
    additionalShareUserFileManagerGridAssertion,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserLocalStorageManager,
    additionalShareUserChatMessages,
    baseAssertion,
    additionalShareUserDialHomePage,
    additionalShareUserDataInjector,
    additionalShareUserSharedFolderConversations,
    additionalShareUserFileManagerGrid,
    additionalShareUserFileManager,
    additionalShareUserFileManagerNavigationPanel,
    additionalShareUserDownloadAssertion,
    localStorageManager,
    additionalShareUserToastAssertion,
    additionalShareUserToast,
    additionalShareUserFileManagerUnshareItemConfirmationPopup,
  }) => {
    dialSharedWithMeTest.slow();
    setTestIds(
      'EPMRTC-3520',
      'EPMRTC-4129',
      'EPMRTC-4130',
      'EPMRTC-4149',
      'EPMRTC-4150',
      'EPMRTC-4151',
      'EPMRTC-4152',
      'EPMRTC-4153',
      'EPMRTC-4158',
      'EPMRTC-4159',
      'EPMRTC-4162',
      'EPMRTC-4165',
      'EPMRTC-8177',
    );
    const user1ImageInRequest1 = Attachment.sunImageName;
    const user1ImageInRequest2 = Attachment.cloudImageName;
    const user1ImageInResponse1 = Attachment.heartImageName;
    const user1ImageInResponse2 = Attachment.flowerImageName;
    const user1ConversationInFolderImageInResponse1 = Attachment.longImageName;

    let user1ImageUrlInRequest1: string;
    let user1ImageUrlInRequest2: string;
    let user1ImageUrlInResponse1: string;
    let user1ImageUrlInResponse2: string;
    let user1ConversationInFolderImageUrlInResponse1: string;

    let shareByLinkResponse: ShareByLinkResponseModel;
    let shareFolderByLinkResponse: ShareByLinkResponseModel;

    let conversationWithTwoRequestsWithAttachments: Conversation;
    let conversationWithTwoResponsesWithAttachments: Conversation;
    let secondUserEmptyConversation: Conversation;
    const attachmentModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(),
    );
    const user1FolderName = 'SharedFolder';
    let user1ConversationInFolder: Conversation;

    let dotsMenu: Locator;
    let fileRow: Locator;
    let searchInput: BaseElement;

    await dialTest.step(
      'User1 uploads an image to the "All files" root',
      async () => {
        user1ImageUrlInRequest1 =
          await fileApiHelper.putFile(user1ImageInRequest1);
        user1ImageUrlInRequest2 =
          await fileApiHelper.putFile(user1ImageInRequest2);

        user1ImageUrlInResponse1 = await fileApiHelper.putFile(
          user1ImageInResponse1,
        );
        user1ImageUrlInResponse2 = await fileApiHelper.putFile(
          user1ImageInResponse2,
        );

        user1ConversationInFolderImageUrlInResponse1 =
          await fileApiHelper.putFile(
            user1ConversationInFolderImageInResponse1,
          );

        //upload file into 'My files' section to have it visible
        await additionalShareUserFileApiHelper.putFile(
          Attachment.heartImageName,
        );
      },
    );

    await dialTest.step('User1 creates chats', async () => {
      conversationWithTwoRequestsWithAttachments =
        conversationData.prepareHistoryConversationWithAttachmentsInRequest({
          1: {
            model: attachmentModel,
            attachmentUrl: [user1ImageUrlInRequest1],
          },
          2: {
            model: attachmentModel,
            attachmentUrl: [user1ImageUrlInRequest2],
          },
        });
      conversationData.resetData();

      conversationWithTwoResponsesWithAttachments =
        conversationData.prepareHistoryConversationWithAttachmentsInResponse({
          1: {
            model: attachmentModel,
            attachmentUrl: user1ImageUrlInResponse1,
          },
          2: {
            model: attachmentModel,
            attachmentUrl: user1ImageUrlInResponse2,
          },
        });
      conversationData.resetData();

      user1ConversationInFolder =
        conversationData.prepareConversationWithAttachmentInResponse(
          user1ConversationInFolderImageUrlInResponse1,
          attachmentModel,
          user1FolderName,
        );
      conversationData.resetData();

      await dataInjector.createConversations([
        conversationWithTwoRequestsWithAttachments,
        conversationWithTwoResponsesWithAttachments,
        user1ConversationInFolder,
      ]);
    });

    await dialTest.step('User1 shares the chat with User2', async () => {
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        conversationWithTwoRequestsWithAttachments,
        conversationWithTwoResponsesWithAttachments,
      ]);
    });

    await dialTest.step(
      'User2 accepts share invitation by another user',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        await additionalShareUserLocalStorageManager.setRecentModelsIdsAndUseLastModel(
          attachmentModel,
        );
        await additionalShareUserLocalStorageManager.setShowSideBarPanels();
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          attachmentModel,
        );
      },
    );

    await dialTest.step('User1 shares the folder with User2', async () => {
      shareFolderByLinkResponse =
        await mainUserShareApiHelper.shareEntityByLink(
          [user1ConversationInFolder],
          true,
        );
    });

    await dialTest.step(
      'User2 accepts share invitation by another user',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(
          shareFolderByLinkResponse,
        );
      },
    );

    await dialTest.step(
      'User2 creates a chat with attachment modal accessible',
      async () => {
        secondUserEmptyConversation =
          conversationData.prepareEmptyConversation(attachmentModel);

        conversationData.resetData();
        await additionalShareUserDataInjector.createConversations([
          secondUserEmptyConversation,
        ]);
      },
    );

    await dialSharedWithMeTest.step(
      'User2 opens the file in the shared chat and verifies the picture is shown in requests',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedWithMeConversations.selectEntity(
          conversationWithTwoRequestsWithAttachments.name,
          { isHttpMethodTriggered: true },
        );

        await additionalShareUserChatMessages.expandChatMessageAttachment(
          1,
          user1ImageInRequest1,
        );
        await additionalShareUserChatMessages.expandChatMessageAttachment(
          3,
          user1ImageInRequest2,
        );
        const attachmentUrl1 =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(1);
        const attachmentUrl2 =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(3);

        baseAssertion.assertStringIncludes(
          attachmentUrl1!,
          `${API.importFileRootPath(BucketUtil.getBucket())}/${user1ImageInRequest1}`,
          ExpectedMessages.attachmentUrlIsValid,
        );
        baseAssertion.assertStringIncludes(
          attachmentUrl2!,
          `${API.importFileRootPath(BucketUtil.getBucket())}/${user1ImageInRequest2}`,
          ExpectedMessages.attachmentUrlIsValid,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 opens the file in the shared chat and verifies the picture is shown in responses',
      async () => {
        await additionalShareUserSharedWithMeConversations.selectEntity(
          conversationWithTwoResponsesWithAttachments.name,
          { isHttpMethodTriggered: true },
        );

        await additionalShareUserChatMessages.expandChatMessageAttachment(
          2,
          user1ImageInResponse1,
        );
        await additionalShareUserChatMessages.expandChatMessageAttachment(
          4,
          user1ImageInResponse2,
        );
        const attachmentInResponseUrl1 =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(2);
        const attachmentInResponseUrl2 =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(4);
        baseAssertion.assertStringIncludes(
          attachmentInResponseUrl1!,
          `${API.importFileRootPath(BucketUtil.getBucket())}/${user1ImageInResponse1}`,
          ExpectedMessages.attachmentUrlIsValid,
        );
        baseAssertion.assertStringIncludes(
          attachmentInResponseUrl2!,
          `${API.importFileRootPath(BucketUtil.getBucket())}/${user1ImageInResponse2}`,
          ExpectedMessages.attachmentUrlIsValid,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 opens the file in the shared chat and verifies the picture is shown',
      async () => {
        await additionalShareUserSharedFolderConversations.expandFolder(
          user1FolderName,
        );

        await additionalShareUserSharedWithMeConversations.selectEntity(
          user1ConversationInFolder.name,
          { isHttpMethodTriggered: true },
        );

        await additionalShareUserChatMessages.expandChatMessageAttachment(
          2,
          user1ConversationInFolderImageInResponse1,
        );
        const attachmentUrl =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(2);
        baseAssertion.assertStringIncludes(
          attachmentUrl!,
          `${API.importFileRootPath(BucketUtil.getBucket())}/${user1ConversationInFolderImageInResponse1}`,
          ExpectedMessages.attachmentUrlIsValid,
        );
      },
    );

    await dialSharedWithMeTest.step('User 1 unshares chat', async () => {
      const sharedEntities =
        await additionalUserShareApiHelper.listSharedWithMeConversations();
      const entityToUnshare = sharedEntities.resources.find(
        (entity) =>
          entity.url === conversationWithTwoRequestsWithAttachments.id,
      );

      if (entityToUnshare) {
        await additionalUserShareApiHelper.deleteSharedWithMeEntities([
          entityToUnshare,
        ]);
      } else {
        throw new Error('Conversation not found in Shared with me section');
      }
    });

    await dialSharedWithMeTest.step(
      "User2 opens 'File manager' and verifies the existence of shared files on 'Shared with me' tab",
      async () => {
        await additionalShareUserFileManagerPage.openFileManagerPage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: true,
          getStyles: false,
        });
        await additionalShareUserFileManagerPage.waitForPageLoaded({
          isGridVisible: undefined,
        });
        await additionalShareUserFileManagerToolbar.sharedWithMeTab.click();
      },
    );

    await dialSharedWithMeTest.step('User2 searches in files', async () => {
      searchInput =
        additionalShareUserFileManagerNavigationPanel.getSearch().inputField;
      await searchInput.fillInInput(user1ImageInRequest1.replace('.jpg', ''));
      await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
        user1ImageInRequest1,
        'visible',
      );
      await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
        user1ConversationInFolderImageInResponse1,
        'hidden',
      );

      await searchInput.fillInInput('');
    });

    await dialSharedWithMeTest.step('User2 searches in files', async () => {
      await searchInput.fillInInput(GeneratorUtil.randomString(10));
      await additionalShareUserFileManagerGridAssertion.assertElementState(
        additionalShareUserFileManager.getNoDataContent(),
        'visible',
      );

      await searchInput.fillInInput('');
    });

    await dialSharedWithMeTest.step('User2 observe shared files', async () => {
      const allFiles = [
        user1ImageInRequest1,
        user1ImageInRequest2,
        user1ImageInResponse1,
        user1ImageInResponse2,
        user1ConversationInFolderImageInResponse1,
      ];
      for (const file of allFiles) {
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          file,
          'visible',
        );
      }
    });

    await dialSharedWithMeTest.step(
      'User2 downloads a file via context menu',
      async () => {
        fileRow =
          additionalShareUserFileManagerGrid.gridRowByNameCell(
            user1ImageInRequest1,
          );
        dotsMenu =
          await additionalShareUserFileManagerGrid.gridDotsMenuByNameCell(
            user1ImageInRequest1,
          );
        await fileRow.hover();
        await dotsMenu.click();
        const downloadedData =
          await additionalShareUserFileManagerPage.downloadData(() =>
            additionalShareUserFileManagerGridRowDropdownMenu.selectItem(
              MenuOptions.download,
              {
                isHttpMethodTriggered: false,
              },
            ),
          );
        await additionalShareUserDownloadAssertion.assertPlainFileIsDownloaded(
          downloadedData,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 downloads multiple files',
      async () => {
        const imagesToDownload = [
          user1ImageInRequest1,
          user1ImageInRequest2,
          user1ImageInResponse1,
          user1ImageInResponse2,
          user1ConversationInFolderImageInResponse1,
        ];
        for (const file of imagesToDownload) {
          const attachmentCheckbox =
            await additionalShareUserFileManagerGrid.gridCheckboxByNameCell(
              file,
            );
          await attachmentCheckbox.click();
        }
        const downloadedData =
          await additionalShareUserFileManagerPage.downloadMultipleData(
            () => additionalShareUserFileManagerToolbar.clickDownloadButton(),
            1,
            'files.zip',
          );
        await additionalShareUserDownloadAssertion.assertZipFileIsDownloaded(
          downloadedData[0],
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 unshares a file via context menu',
      async () => {
        await fileRow.hover();
        await dotsMenu.click();
        await additionalShareUserFileManagerGridRowDropdownMenu.selectItem(
          MenuOptions.unshare,
          {
            isHttpMethodTriggered: false,
          },
        );
        await additionalShareUserFileManagerUnshareItemConfirmationPopup.cancelButton.click();
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          user1ImageInRequest1,
          'visible',
        );
        await fileRow.hover();
        await dotsMenu.click();
        await additionalShareUserFileManagerGridRowDropdownMenu.selectItem(
          MenuOptions.unshare,
          {
            isHttpMethodTriggered: false,
          },
        );
        await additionalShareUserFileManagerUnshareItemConfirmationPopup.confirm(
          {
            triggeredHttpMethod: 'POST',
            triggeredHttpHost: API.discardShareWithMeItem,
          },
        );
        await additionalShareUserToastAssertion.assertToastMessage(
          ExpectedConstants.unsharedSuccessfullyToast(user1ImageInRequest1),
        );
        await additionalShareUserToast.closeToast();
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/5971
        // await additionalShareUserFileManagerDeleteItemConfirmationPopup
        //   .getCloseButton()
        //   .click();
        // await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
        //   user1ImageInRequest1,
        //   'visible',
        // );
        // await fileRow.hover();
        // await dotsMenu.click();
        // await additionalShareUserFileManagerGridRowDropdownMenu.selectItem(
        //   MenuOptions.delete,
        //   {
        //     isHttpMethodTriggered: false,
        //   },
        // );
        // await additionalShareUserFileManagerDeleteItemConfirmationPopup.confirm(
        //   {
        //     triggeredHttpMethod: 'POST',
        //   },
        // );
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          user1ImageInRequest1,
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step('User 1 deletes a file', async () => {
      await fileApiHelper.deleteFromAllFiles(user1ImageUrlInRequest2);
    });

    await dialSharedWithMeTest.step(
      'User 2 check that the file has disappeared',
      async () => {
        await additionalShareUserFileManagerPage.reloadPage();
        await additionalShareUserFileManagerPage.waitForPageLoaded();
        await additionalShareUserFileManagerToolbar.sharedWithMeTab.click();
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          user1ImageInRequest2,
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 unshares multiple files',
      async () => {
        const imagesToDelete = [
          user1ImageInResponse1,
          user1ImageInResponse2,
          user1ConversationInFolderImageInResponse1,
        ];
        for (const file of imagesToDelete) {
          const attachmentCheckbox =
            await additionalShareUserFileManagerGrid.gridCheckboxByNameCell(
              file,
            );
          await attachmentCheckbox.click();
          await additionalShareUserFileManagerGridAssertion.assertGridCheckboxByNameState(
            file,
            CheckboxState.checked,
          );
        }
        await additionalShareUserFileManagerToolbar.getUnshareButton().click();
        await additionalShareUserFileManagerUnshareItemConfirmationPopup.confirm(
          {
            triggeredHttpMethod: 'POST',
            triggeredHttpHost: API.discardShareWithMeItem,
          },
        );
        for (const file of imagesToDelete) {
          await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
            file,
            'hidden',
          );
        }
      },
    );

    await dialSharedWithMeTest.step(
      "'No shared files' label is displayed on 'Shared with me' tab",
      async () => {
        const noData = additionalShareUserFileManager.getNoDataContent();
        await additionalShareUserFileManagerGridAssertion.assertElementState(
          additionalShareUserFileManager.getNoDataContent(),
          'visible',
        );
        await additionalShareUserFileManagerGridAssertion.assertElementText(
          noData.noResultsTitle,
          'No shared files',
        );
        await additionalShareUserFileManagerGridAssertion.assertElementText(
          noData.noResultsReason,
          'Files shared with you will appear here.',
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Deleted by the owner file disappears from "Shared with me". There was only one shared and existed file. "Shared with me" disappears.',
  async ({
    setTestIds,
    conversationData,
    dataInjector,
    fileApiHelper,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridRowDropdownMenu,
    fileManagerGridAssertion,
    fileManagerDeleteItemConfirmationPopup,
    localStorageManager,
    additionalShareUserFileManagerPage,
    additionalShareUserFileManagerToolbar,
    additionalShareUserFileManager,
    additionalShareUserFileManagerGridAssertion,
    additionalSecondUserShareApiHelper,
  }) => {
    setTestIds('EPMRTC-5821');
    let imageUrl: string;
    let shareByLinkResponse: ShareByLinkResponseModel;
    let conversation: Conversation;
    const defaultModel = ModelsUtil.getDefaultAgent()!;

    await localStorageManager.setChatCollapsedSection(
      CollapsedSections.Organization,
    );

    await dialTest.step(
      'Upload image file to a conversation and prepare conversation with attachments in response',
      async () => {
        imageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
        conversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageUrl,
            defaultModel.id,
          );
        await dataInjector.createConversations([conversation]);
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          conversation,
        ]);
      },
    );

    await dialTest.step('Accept share invitation by another user', async () => {
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      await additionalSecondUserShareApiHelper.acceptInvite(
        shareByLinkResponse,
      );
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Delete the file from shared conversation by main user',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        const attachmentRow = await fileManagerGrid.goToGridRowByNameCell(
          Attachment.sunImageName,
        );
        await attachmentRow.hover();
        const dotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(
          Attachment.sunImageName,
        );
        await dotsMenu.click();
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.delete, {
          isHttpMethodTriggered: false,
        });
        await fileManagerDeleteItemConfirmationPopup.confirm({
          expectedRequests: new Map([
            [API.deleteFileHost(), 'POST'],
            [API.filesListingHost(), 'GET'],
          ]),
        });
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open "File manager" by additional user and verify "Shared with me" tab is empty',
      async () => {
        await additionalShareUserFileManagerPage.openFileManagerPage();
        await additionalShareUserFileManagerPage.waitForPageLoaded({
          isGridVisible: false,
        });
        await additionalShareUserFileManagerToolbar.sharedWithMeTab.click();
        await additionalShareUserFileManagerGridAssertion.assertElementState(
          additionalShareUserFileManager.getNoDataContent(),
          'visible',
        );
      },
    );
  },
);

dialAdminTest(
  '[Attach files] Check the checkbox near several folders (from My files and Organization), files (from the root and Shared with me), verify attached files',
  async ({
    setTestIds,
    dialHomePage,
    fileApiHelper,
    adminFileApiHelper,
    localStorageManager,
    adminShareApiHelper,
    mainUserShareApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    sendMessage,
    attachmentDropdownMenu,
    fileManagerModal,
    fileManagerModalGrid,
    fileManagerModalToolbar,
    sendMessageInputAttachmentsAssertions,
    adminDataInjector,
    conversationData,
  }) => {
    setTestIds('EPMRTC-6743');
    const modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment(
      true,
      ['*/*'],
      null,
    );
    const attachmentModel = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );

    const folder1 = GeneratorUtil.randomString(7);
    const folder2 = GeneratorUtil.randomString(7);
    const file1 = GeneratorUtil.randomFilename('jpg');
    const file2 = GeneratorUtil.randomFilename('jpg');
    const file3 = GeneratorUtil.randomFilename('txt');
    const sharedFile = Attachment.heartImageName;
    const publishedFile = Attachment.cloudImageName;
    const publishedFolder = GeneratorUtil.randomString(7);
    const publicationName = GeneratorUtil.randomPublicationRequestName();

    let sharedFileUrl: string;
    let publishedFileUrl: string;
    let publication: Publication;

    await dialAdminTest.step(
      'Upload files for main user: file1 in folder1, file2 in folder2, file3 at root',
      async () => {
        await fileApiHelper.putFileWithCustomName(
          file1,
          Attachment.sunImageName,
          {
            parentPath: folder1,
          },
        );
        await fileApiHelper.putFileWithCustomName(
          file2,
          Attachment.sunImageName,
          {
            parentPath: folder2,
          },
        );
        await fileApiHelper.putFileWithCustomName(
          file3,
          Attachment.sunImageName,
        );
      },
    );

    await dialAdminTest.step(
      'Admin uploads file, creates publication request with target folder and approves it',
      async () => {
        publishedFileUrl = await adminFileApiHelper.putFile(publishedFile);
        const publishRequest = publishRequestBuilder
          .withName(publicationName)
          .withFileResource(
            publishedFileUrl,
            PublishActions.ADD,
            publishedFolder,
          )
          .build();
        publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialAdminTest.step(
      'Admin uploads shared file, creates conversation with it, shares with main user; main user accepts invite',
      async () => {
        sharedFileUrl = await adminFileApiHelper.putFile(sharedFile);
        const sharedConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            attachmentModel,
            true,
            undefined,
            sharedFileUrl,
          );
        await adminDataInjector.createConversations([sharedConversation]);
        const shareByLinkResponse = await adminShareApiHelper.shareEntityByLink(
          [sharedConversation],
        );
        await mainUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialAdminTest.step(
      'Open home page and set model with attachments',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          attachmentModel,
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
      },
    );

    await dialAdminTest.step(
      'Open FileManager Modal, select folder1, folder2 and file3 from My Files, click Attach',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        for (const item of [folder1, folder2, file3]) {
          const checkbox =
            await fileManagerModalGrid.gridCheckboxByNameCell(item);
          await checkbox.click();
        }
        await fileManagerModalToolbar
          .getSelectedIconsButton(3)
          .waitForState({ state: 'visible' });
        await fileManagerModal.getAttachButton().click();
      },
    );

    await dialAdminTest.step(
      'Verify file1, file2, file3 are attached in input',
      async () => {
        for (const file of [file1, file2, file3]) {
          await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
            file,
            'visible',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Open FileManager Modal, switch to Shared with me tab, select sharedFile, click Attach',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        await fileManagerModalToolbar.sharedWithMeTab.click();
        const sharedFileCheckbox =
          await fileManagerModalGrid.gridCheckboxByNameCell(sharedFile);
        await sharedFileCheckbox.click();
        await fileManagerModalToolbar
          .getSelectedIconsButton(1)
          .waitForState({ state: 'visible' });
        await fileManagerModal.getAttachButton().click();
      },
    );

    await dialAdminTest.step(
      'Verify file1, file2, file3, sharedFile are attached in input',
      async () => {
        for (const file of [file1, file2, file3, sharedFile]) {
          await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
            file,
            'visible',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Open FileManager Modal, switch to Organization tab, select publishedFolder checkbox, click Attach',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        await fileManagerModalToolbar.organizationTab.click();
        const publishedFolderCheckbox =
          await fileManagerModalGrid.gridCheckboxByNameCell(publishedFolder);
        await publishedFolderCheckbox.click();
        await fileManagerModalToolbar
          .getSelectedIconsButton(1)
          .waitForState({ state: 'visible' });
        await fileManagerModal.getAttachButton().click();
      },
    );

    //blocked by the issue 6483
    await dialAdminTest.step.skip(
      'Verify all files are attached: file1, file2, file3, sharedFile, publishedFile',
      async () => {
        for (const file of [file1, file2, file3, sharedFile, publishedFile]) {
          await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
            file,
            'visible',
          );
        }
      },
    );
  },
);
