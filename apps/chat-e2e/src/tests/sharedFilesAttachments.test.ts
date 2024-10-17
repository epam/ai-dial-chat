import { Conversation } from '@/chat/types/chat';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  AttachFilesFolders,
  Attachment,
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  TreeEntity,
  UploadMenuOptions,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { FileModalSection } from '@/src/ui/webElements';
import { BucketUtil, GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialSharedWithMeTest(
  'Arrow icon appears for file in Manage attachments if it was shared along with chat. The file is located in folders in "All files". The file is used in the model answer.\n' +
    'Arrow icon appears for file in Manage attachments if it was shared along with chat folder.\n' +
    //'Arrow icon appears for file in Manage attachments if new chat was moved to already shared folder.\n' +
    'Arrow icon appears for the folder and file with the special chars in their names.\n' +
    'Error message appears if to Share the conversation with an attachment from Shared with me\n' +
    'Arrow icon stays for the file if the chat was unshared by the owner\n' +
    'Arrow icon stays for the file if the chat was renamed or deleted, or model was changed\n' +
    'Arrow icon disappears if all the users delete the file from "Shared with me"',
  async ({
    setTestIds,
    conversationData,
    dataInjector,
    fileApiHelper,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    dialHomePage,
    manageAttachmentsAssertion,
    chatBar,
    attachedAllFiles,
    localStorageManager,
    additionalShareUserSendMessage,
    additionalShareUserConversations,
    additionalShareUserLocalStorageManager,
    additionalShareUserChat,
    additionalShareUserConversationDropdownMenu,
    additionalShareUserAttachmentDropdownMenu,
    additionalShareUserDialHomePage,
    additionalShareUserAttachFilesModal,
    additionalShareUserErrorToastAssertion,
    additionalShareUserDataInjector,
    conversations,
    attachmentDropdownMenu,
    attachFilesModal,
    confirmationDialog,
    conversationDropdownMenu,
    chatHeader,
    talkToSelector,
    marketplacePage,
    additionalSecondUserShareApiHelper,
    sendMessage,
    additionalSecondShareUserFileApiHelper,
    additionalShareUserFileApiHelper,
    errorToast,
  }) => {
    dialSharedWithMeTest.slow();
    setTestIds(
      'EPMRTC-4133',
      'EPMRTC-4134',
      /*'EPMRTC-4135,'*/
      'EPMRTC-4155',
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
    let defaultModel: string;
    let conversationInFolder: Conversation;
    //TODO EPMRTC-4135 blocked by the #1076
    // let conversationToMove: Conversation;
    const folderName = 'Folder with conversation';
    const specialCharsFolder = `Folder ${ExpectedConstants.allowedSpecialChars}`;
    let conversationWithSpecialChars: Conversation;
    let conversationWithTwoResponses: Conversation;

    await localStorageManager.setChatCollapsedSection(
      CollapsedSections.Organization,
    );

    await dialTest.step(
      'Upload image file to a conversation and prepare conversation with attachments in response',
      async () => {
        defaultModel = GeneratorUtil.randomArrayElement(
          ModelsUtil.getLatestModelsWithAttachment(),
        ).id;
        imageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(defaultModel),
        );
        imageUrl2 = await fileApiHelper.putFile(
          Attachment.cloudImageName,
          API.modelFilePath(defaultModel),
        );
        imageInConversationInFolderUrl = await fileApiHelper.putFile(
          Attachment.flowerImageName,
          API.modelFilePath(defaultModel),
        );
        specialCharsImageUrl = await fileApiHelper.putFile(
          Attachment.specialSymbolsName,
          specialCharsFolder,
        );

        //TODO EPMRTC-4135 blocked by the #1076
        // imageInFolderUrl2 = await fileApiHelper.putFile(
        //   Attachment.heartImageName,
        //   API.modelFilePath(defaultModel),
        // );

        conversationWithTwoResponses =
          conversationData.prepareHistoryConversationWithAttachmentsInRequest({
            1: {
              model: defaultModel,
              attachmentUrl: [imageUrl],
            },
            2: {
              model: defaultModel,
              attachmentUrl: [imageUrl2],
            },
          });

        conversationData.resetData();

        conversationInFolder =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageInConversationInFolderUrl,
            defaultModel,
            folderName,
          );

        conversationData.resetData();
        conversationWithSpecialChars =
          conversationData.prepareConversationWithAttachmentsInRequest(
            defaultModel,
            true,
            specialCharsImageUrl,
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
    });

    await dialTest.step('Open start page', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({
        isNewConversationVisible: true,
      });
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
      'Open "Manage attachments" modal and verify shared files have arrow icons',
      async () => {
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachedAllFiles.waitForState();

        await attachedAllFiles.expandFolder(AttachFilesFolders.appdata, {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder(defaultModel, {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder(AttachFilesFolders.images, {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder(specialCharsFolder, {
          isHttpMethodTriggered: true,
        });

        await attachedAllFiles
          .getFolderByName(AttachFilesFolders.images)
          .hover();

        const firstImageEntity: TreeEntity = { name: Attachment.sunImageName };
        await manageAttachmentsAssertion.assertSharedFileArrowIconState(
          firstImageEntity,
          'visible',
        );
        await manageAttachmentsAssertion.assertEntityArrowIconColor(
          firstImageEntity,
          Colors.controlsBackgroundAccent,
        );

        const secondImageEntity: TreeEntity = {
          name: Attachment.cloudImageName,
        };
        await manageAttachmentsAssertion.assertSharedFileArrowIconState(
          secondImageEntity,
          'visible',
        );
        await manageAttachmentsAssertion.assertEntityArrowIconColor(
          secondImageEntity,
          Colors.controlsBackgroundAccent,
        );

        const thirdImageEntity: TreeEntity = {
          name: Attachment.flowerImageName,
        };
        await manageAttachmentsAssertion.assertSharedFileArrowIconState(
          thirdImageEntity,
          'visible',
        );
        await manageAttachmentsAssertion.assertEntityArrowIconColor(
          thirdImageEntity,
          Colors.controlsBackgroundAccent,
        );

        //TODO EPMRTC-4135 blocked by the #1076
        // const fourthImageEntity: TreeEntity = { name: Attachment.heartImageName };
        // await attachedFilesAssertion.assertSharedFileArrowIconState(fourthImageEntity, 'visible');
        // await attachedFilesAssertion.assertEntityArrowIconColor(fourthImageEntity, Colors.controlsBackgroundAccent);

        const specialCharsImageEntity: TreeEntity = {
          name: Attachment.specialSymbolsName,
        };
        await manageAttachmentsAssertion.assertSharedFileArrowIconState(
          specialCharsImageEntity,
          'visible',
        );
        await manageAttachmentsAssertion.assertEntityArrowIconColor(
          specialCharsImageEntity,
          Colors.controlsBackgroundAccent,
        );
        await attachFilesModal.closeButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Prepare conversation to share of the user 2',
      async () => {
        conversationData.resetData();
        const conversationToShare =
          conversationData.prepareEmptyConversation(defaultModel);
        await additionalShareUserDataInjector.createConversations([
          conversationToShare,
        ]);
        await additionalShareUserLocalStorageManager.setSelectedConversation(
          conversationToShare,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'By user2 create a conversation with attachments from Shared with me section in Manage attachments',
      async () => {
        const newRequest = GeneratorUtil.randomString(10);
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSendMessage.attachmentMenuTrigger.click();

        await additionalShareUserAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );

        await additionalShareUserAttachFilesModal.checkAttachedFile(
          Attachment.specialSymbolsName,
          FileModalSection.SharedWithMe,
        );
        await additionalShareUserAttachFilesModal.attachFiles();
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
        await additionalShareUserErrorToastAssertion.assertToastMessage(
          ExpectedConstants.sharingWithAttachmentNotFromAllFilesErrorMessage,
          ExpectedMessages.sharingWithAttachmentNotFromAllFilesFailed,
        );
        await errorToast.closeToast();
        await conversations.selectConversation(
          conversationWithTwoResponses.name,
        );
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
            await conversations
              .getEditEntityInput()
              .editValue(conversationWithTwoResponses.name);
            await conversations.getEditInputActions().clickTickButton();
            await confirmationDialog.confirm({
              triggeredHttpMethod: 'DELETE',
            });
            break;
          case 'model change':
            await chatHeader.openConversationSettingsPopup();
            await talkToSelector.selectEntity(
              GeneratorUtil.randomArrayElement(
                ModelsUtil.getLatestModels().filter(
                  (model) => model.id !== defaultModel,
                ),
              ),
              marketplacePage,
            );
            break;
          case 'delete':
            await conversations.openEntityDropdownMenu(
              conversationWithTwoResponses.name,
            );
            await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
            await confirmationDialog.confirm({
              triggeredHttpMethod: 'DELETE',
            });
            break;
        }
      });

      await dialTest.step(
        'User1 opens "Manage attachment" and finds file attached to the chat',
        async () => {
          await chatBar.bottomDotsMenuIcon.click();
          await chatBar
            .getBottomDropdownMenu()
            .selectMenuOption(MenuOptions.attachments);
          await attachedAllFiles.waitForState();

          await attachedAllFiles.expandFolder(AttachFilesFolders.appdata);
          await attachedAllFiles.expandFolder(defaultModel);
          await attachedAllFiles.expandFolder(AttachFilesFolders.images);

          await attachedAllFiles
            .getFolderByName(AttachFilesFolders.images)
            .hover();
          await manageAttachmentsAssertion.assertSharedFileArrowIconState(
            { name: Attachment.sunImageName },
            'visible',
          );
          await manageAttachmentsAssertion.assertSharedFileArrowIconState(
            { name: Attachment.cloudImageName },
            'visible',
          );
          await attachFilesModal.closeButton.click();
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
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(
          conversationWithSpecialChars.name,
        );
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );

        await attachedAllFiles.expandFolder(specialCharsFolder);
        await attachedAllFiles.getFolderByName(specialCharsFolder).hover();
        await manageAttachmentsAssertion.assertSharedFileArrowIconState(
          { name: Attachment.specialSymbolsName },
          'visible',
        );
        await attachFilesModal.closeButton.click();
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
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(
          conversationWithSpecialChars.name,
        );
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );

        await attachedAllFiles.expandFolder(specialCharsFolder);
        await attachedAllFiles.getFolderByName(specialCharsFolder).hover();
        await manageAttachmentsAssertion.assertSharedFileArrowIconState(
          { name: Attachment.specialSymbolsName },
          'hidden',
        );
        await attachFilesModal.closeButton.click();
      },
    );
  },
);

dialSharedWithMeTest.only(
  'Shared with me: shared files located in "All folders" root appear in "Shared with me" root. The chat was shared.',
  async ({
    setTestIds,
    conversationData,
    dataInjector,
    fileApiHelper,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    dialHomePage,
    manageAttachmentsAssertion,
    chatBar,
    attachedAllFiles,
    localStorageManager,
    additionalShareUserSendMessage,
    additionalShareUserConversations,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserLocalStorageManager,
    additionalShareUserChat,
    additionalShareUserChatMessages,
    additionalShareUserConversationDropdownMenu,
    additionalShareUserAttachmentDropdownMenu,
    additionalShareUserDialHomePage,
    additionalShareUserAttachFilesModal,
    additionalShareUserDataInjector,
    additionalShareUserManageAttachmentsAssertion,
  }) => {
    setTestIds('EPMRTC-3520', 'EPMRTC-4129');
    const user1ImageInRequest1 = Attachment.sunImageName;
    const user1ImageInRequest2 = Attachment.cloudImageName;
    const user1ImageInResponse1 = Attachment.heartImageName;
    const user1ImageInResponse2 = Attachment.flowerImageName;

    let user1ImageUrlInRequest1: string;
    let user1ImageUrlInRequest2: string;
    let user1ImageUrlInResponse1: string;
    let user1ImageUrlInResponse2: string;

    let shareByLinkResponse: ShareByLinkResponseModel;
    let conversationWithTwoRequestsWithAttachments: Conversation;
    let conversationWithTwoResponsesWithAttachments: Conversation;
    let secondUserEmptyConversation: Conversation;
    const attachmentModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(),
    ).id;

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
      await dataInjector.createConversations([
        conversationWithTwoRequestsWithAttachments,
      ]);

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
      await dataInjector.createConversations([
        conversationWithTwoResponsesWithAttachments,
      ]);

      await localStorageManager.setSelectedConversation(
        conversationWithTwoRequestsWithAttachments,
      );
    });

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
        await additionalShareUserLocalStorageManager.setSelectedConversation(
          conversationWithTwoRequestsWithAttachments,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 opens the file in the shared chat and verifies the picture is shown in requests',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();

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

        expect(attachmentUrl1, ExpectedMessages.attachmentUrlIsValid).toContain(
          `${API.importFileRootPath(BucketUtil.getBucket())}/${user1ImageInRequest1}`,
        );
        expect(attachmentUrl2, ExpectedMessages.attachmentUrlIsValid).toContain(
          `${API.importFileRootPath(BucketUtil.getBucket())}/${user1ImageInRequest2}`,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 opens the file in the shared chat and verifies the picture is shown in responses',
      async () => {
        await additionalShareUserSharedWithMeConversations.selectConversation(
          conversationWithTwoResponsesWithAttachments.name,
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

        expect(
          attachmentInResponseUrl1,
          ExpectedMessages.attachmentUrlIsValid,
        ).toContain(
          `${API.importFileRootPath(BucketUtil.getBucket())}/${user1ImageInResponse1}`,
        );
        expect(
          attachmentInResponseUrl2,
          ExpectedMessages.attachmentUrlIsValid,
        ).toContain(
          `${API.importFileRootPath(BucketUtil.getBucket())}/${user1ImageInResponse2}`,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 opens Manage attachments and finds the shared file',
      async () => {
        await additionalShareUserConversations.selectConversation(
          secondUserEmptyConversation.name,
        );
        await additionalShareUserSendMessage.attachmentMenuTrigger.click();

        await additionalShareUserAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );

        // await additionalShareUserAttachFilesModal
        //   .getSharedWithMeTree()
        //   .getEntityByName(Attachment.sunImageName)
        //   .waitFor();
        // await additionalShareUserAttachFilesModal
        //   .getSharedWithMeTree()
        //   .getEntityByName(Attachment.cloudImageName)
        //   .waitFor();
        await additionalShareUserManageAttachmentsAssertion.assertEntityState(
          { name: user1ImageInRequest1 },
          FileModalSection.SharedWithMe,
          'visible',
        );
        await additionalShareUserManageAttachmentsAssertion.assertEntityState(
          { name: user1ImageInRequest2 },
          FileModalSection.SharedWithMe,
          'visible',
        );

        await additionalShareUserManageAttachmentsAssertion.assertEntityState(
          { name: user1ImageInResponse1 },
          FileModalSection.SharedWithMe,
          'visible',
        );
        await additionalShareUserManageAttachmentsAssertion.assertEntityState(
          { name: user1ImageInResponse2 },
          FileModalSection.SharedWithMe,
          'visible',
        );
      },
    );
  },
);
