import { Conversation, Message, Role } from '@/chat/types/chat';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  Attachment,
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
  TreeEntity,
  UploadMenuOptions,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { DialHomePage } from '@/src/ui/pages';
import { FileModalSection } from '@/src/ui/webElements';
import { BucketUtil, GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialSharedWithMeTest.only(
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
    attachedFilesAssertion,
    chatBar,
    attachedAllFiles,
    localStorageManager,
    additionalShareUserSendMessage,
    additionalShareUserConversations,
    additionalShareUserLocalStorageManager,
    additionalShareUserErrorToast,
    additionalShareUserChat,
    additionalShareUserConversationDropdownMenu,
    additionalShareUserConversationData,
    additionalShareUserAttachmentDropdownMenu,
    additionalShareUserDialHomePage,
    additionalShareUserAttachFilesModal,
    additionalShareUserShareErrorToastAssertion,
    additionalShareUserDataInjector,
    conversations,
    attachmentDropdownMenu,
    attachFilesModal,
    confirmationDialog,
    conversationDropdownMenu,
    chatHeader,
    talkToSelector,
    marketplacePage,
    chat,
    additionalSecondUserShareApiHelper,
    sendMessage,
    additionalSecondShareUserFileApiHelper,
    additionalShareUserFileApiHelper,
  }) => {
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
    let defaultModel: ModelIds;
    let conversationInFolder: Conversation;
    //TODO EPMRTC-4135 blocked by the #1076
    // let conversationToMove: Conversation;
    const folderName = 'Folder with conversation';
    //TODO find the reason whu it is impossible to create a a folder via api with the name like this even when the characters are allowed ones.
    const specialCharsFolder = `Folder ${ExpectedConstants.allowedSpecialChars}`;
    let conversationWithSpecialChars: Conversation;

    let conversationWithTwoResponses: Conversation;

    await localStorageManager.setChatCollapsedSection(
      CollapsedSections.Organization,
    );

    await dialTest.step(
      'Upload image file to a conversation and prepare conversation with attachments in response',
      async () => {
        defaultModel = ModelIds.GPT_4_O;
        await fileApiHelper.deleteAllFiles();
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
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            ['draw smiling emoticon', 'draw a cloud'],
          );
        conversationWithTwoResponses.messages[0].custom_content = {
          attachments: [conversationData.getAttachmentData(imageUrl)],
        };
        conversationWithTwoResponses.messages[2].custom_content = {
          attachments: [conversationData.getAttachmentData(imageUrl2)],
        };

        conversationData.resetData();

        conversationInFolder =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageInConversationInFolderUrl,
            defaultModel,
            folderName,
          );

        conversationData.resetData();
        conversationWithSpecialChars =
          conversationData.prepareDefaultConversation();
        const encodedSpecialCharsImageUrl = specialCharsImageUrl
          .split('/')
          .map(encodeURIComponent)
          .join('/');
        conversationWithSpecialChars.messages[0].custom_content = {
          attachments: [
            conversationData.getAttachmentData(
              encodedSpecialCharsImageUrl,
              Attachment.specialSymbolsName,
            ),
          ],
        };

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

        await attachedAllFiles.expandFolder('appdata', {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder(defaultModel, {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder('images', {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder(specialCharsFolder, {
          isHttpMethodTriggered: true,
        });

        await attachedAllFiles.getFolderByName('images').hover();

        const firstImageEntity: TreeEntity = { name: Attachment.sunImageName };
        await attachedFilesAssertion.assertSharedFileArrowIconState(
          firstImageEntity,
          'visible',
        );
        await attachedFilesAssertion.assertEntityArrowIconColor(
          firstImageEntity,
          Colors.controlsBackgroundAccent,
        );

        const secondImageEntity: TreeEntity = {
          name: Attachment.cloudImageName,
        };
        await attachedFilesAssertion.assertSharedFileArrowIconState(
          secondImageEntity,
          'visible',
        );
        await attachedFilesAssertion.assertEntityArrowIconColor(
          secondImageEntity,
          Colors.controlsBackgroundAccent,
        );

        const thirdImageEntity: TreeEntity = {
          name: Attachment.flowerImageName,
        };
        await attachedFilesAssertion.assertSharedFileArrowIconState(
          thirdImageEntity,
          'visible',
        );
        await attachedFilesAssertion.assertEntityArrowIconColor(
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
        await attachedFilesAssertion.assertSharedFileArrowIconState(
          specialCharsImageEntity,
          'visible',
        );
        await attachedFilesAssertion.assertEntityArrowIconColor(
          specialCharsImageEntity,
          Colors.controlsBackgroundAccent,
        );
        await attachFilesModal.closeButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Prepare conversation to share of the user 2',
      async () => {
        additionalShareUserConversationData.resetData();
        let conversationToShare: Conversation;
        conversationToShare =
          additionalShareUserConversationData.prepareEmptyConversation(
            ModelIds.GPT_4_O,
          );
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
        await additionalShareUserDialHomePage.waitForPageLoaded({});
        await additionalShareUserSendMessage.attachmentMenuTrigger.click();

        await additionalShareUserAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );

        await additionalShareUserAttachFilesModal.checkAttachedFile(
          Attachment.specialSymbolsName,
          FileModalSection.SharedWithMe,
        );
        await additionalShareUserAttachFilesModal.attachFiles();
        await additionalShareUserChat.sendRequestWithButton(newRequest);
        await additionalShareUserChat.waitForResponse();
        await additionalShareUserConversations.openEntityDropdownMenu(
          newRequest,
        );
        await additionalShareUserConversationDropdownMenu.selectMenuOption(
          MenuOptions.share,
        );
        const errorMessage =
          await additionalShareUserErrorToast.getElementContent();
        await additionalShareUserShareErrorToastAssertion.assertSharingWithAttachmentNotFromAllFilesFailed(
          errorMessage,
        );
      },
    );

    await conversations.selectConversation(conversationWithTwoResponses.name);
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
              ModelsUtil.getModel(ModelIds.GPT_4)!,
              marketplacePage,
            );
            await chat.applyNewEntity();
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

          await attachedAllFiles.expandFolder('appdata');
          await attachedAllFiles.expandFolder(defaultModel);
          await attachedAllFiles.expandFolder('images');

          await attachedAllFiles.getFolderByName('images').hover();
          await attachedFilesAssertion.assertSharedFileArrowIconState(
            { name: Attachment.sunImageName },
            'visible',
          );
          await attachedFilesAssertion.assertSharedFileArrowIconState(
            { name: Attachment.cloudImageName },
            'visible',
          );
          await attachFilesModal.closeButton.click();
        },
      );
    }

    const pathToDeleteSharedByUser1SunImage = `files/${BucketUtil.getBucket()}/${Attachment.sunImageName}`;

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
        await attachedFilesAssertion.assertSharedFileArrowIconState(
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
        await attachedFilesAssertion.assertSharedFileArrowIconState(
          { name: Attachment.specialSymbolsName },
          'hidden',
        );
        await attachFilesModal.closeButton.click();
      },
    );
  },
);
