import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment, CollapsedSections, ExpectedConstants, ExpectedMessages,
  MenuOptions,
  ModelIds, TreeEntity, UploadMenuOptions,
} from '@/src/testData';
import {Colors} from '@/src/ui/domData';
import {ShareByLinkResponseModel} from "@/chat/types/share";
import {Conversation, Message, Role} from "@/chat/types/chat";
import dialSharedWithMeTest from "@/src/core/dialSharedWithMeFixtures";
import {expect} from '@playwright/test';
import {BucketUtil} from "@/src/utils";
import {FileModalSection} from "@/src/ui/webElements";

dialSharedWithMeTest.only(
  'Arrow icon appears for file in Manage attachments if it was shared along with chat. The file is located in folders in "All files". The file is used in the model answer.\n' +
  'Arrow icon appears for file in Manage attachments if it was shared along with chat folder.\n' +
  //'Arrow icon appears for file in Manage attachments if new chat was moved to already shared folder.\n' +
  'Arrow icon appears for the folder and file with the special chars in their names.\n' +
  'Error message appears if to Share the conversation with an attachment from Shared with me',
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
           additionalShareUserItemApiHelper,
           additionalShareUserAttachFilesModal
         }) => {
    setTestIds('EPMRTC-4133', 'EPMRTC-4134', /*'EPMRTC-4135,'*/ 'EPMRTC-4155', 'EPMRTC-4123');
    let imageUrl: string;
    let imageUrl2: string;
    let imageInFolderUrl: string;
    let specialCharsImageUrl: string;
    //TODO EPMRTC-4135 blocked by the #1076
    // let imageInFolderUrl2: string;
    let shareByLinkResponse: ShareByLinkResponseModel;
    let shareFolderByLinkResponse: ShareByLinkResponseModel;
    let defaultModel;
    let conversationInFolder: Conversation;
    //TODO EPMRTC-4135 blocked by the #1076
    // let conversationToMove: Conversation;
    const folderName = 'Folder with conversation';
    //TODO find the reason whu it is impossible to create a a folder via api with the name like this even when the characters are allowed ones.
    const specialCharsFolder = `Folder ${ExpectedConstants.allowedSpecialChars}`;
    let conversationWithSpecialChars: Conversation;

    await localStorageManager.setChatCollapsedSection(
      CollapsedSections.Organization,
    );

    await dialTest.step(
      'Upload image file to a conversation and prepare conversation with attachments in response',
      async () => {
        defaultModel = ModelIds.DALLE;
        await fileApiHelper.deleteAllFiles();
        imageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(defaultModel),
        );
        imageUrl2 = await fileApiHelper.putFile(
          Attachment.cloudImageName,
          API.modelFilePath(defaultModel),
        );
        imageInFolderUrl = await fileApiHelper.putFile(
          Attachment.flowerImageName,
          API.modelFilePath(defaultModel),
        );
        specialCharsImageUrl = await fileApiHelper.putFile(
          Attachment.specialSymbolsName,
          specialCharsFolder);

        //TODO EPMRTC-4135 blocked by the #1076
        // imageInFolderUrl2 = await fileApiHelper.putFile(
        //   Attachment.heartImageName,
        //   API.modelFilePath(defaultModel),
        // );
        const conversationWithTwoResponses = conversationData.prepareConversationWithAttachmentInResponse(
          imageUrl,
          defaultModel,
        );
        const settings = {
          prompt: conversationWithTwoResponses.prompt,
          temperature: conversationWithTwoResponses.temperature,
          selectedAddons: conversationWithTwoResponses.selectedAddons,
        };

        const userMessage: Message = {
          role: Role.User,
          content: 'draw smiling emoticon',
          model: {id: defaultModel},
          settings: settings,
        };
        const assistantMessage: Message = {
          role: Role.Assistant,
          content: '',
          model: {id: defaultModel},
          custom_content: {
            attachments: [conversationData.getAttachmentData(imageUrl2)],
          },
          settings: settings,
        };
        conversationWithTwoResponses.messages.push(userMessage, assistantMessage);
        conversationData.resetData();

        conversationInFolder = conversationData.prepareConversationWithAttachmentInResponse(
          imageInFolderUrl,
          defaultModel,
          folderName
        );

        conversationData.resetData();
        conversationWithSpecialChars = conversationData.prepareConversationWithAttachmentInResponse(
          specialCharsImageUrl,
          defaultModel
        );

        //TODO EPMRTC-4135 blocked by the #1076
        // conversationData.resetData();
        // conversationToMove = conversationData.prepareConversationWithAttachmentInResponse(
        //   imageInFolderUrl2,
        //   defaultModel
        // );

        await dataInjector.createConversations([conversationWithTwoResponses, conversationInFolder, /*conversationToMove,*/ conversationWithSpecialChars]);
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          conversationWithTwoResponses,
          conversationWithSpecialChars,
        ]);
        shareFolderByLinkResponse = await mainUserShareApiHelper.shareEntityByLink(
          [conversationInFolder],
          true
        );
      },
    );

    await dialTest.step(
      'Accept share invitation by another user',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        await additionalUserShareApiHelper.acceptInvite(shareFolderByLinkResponse);
      },
    );

    await dialTest.step(
      'Open start page',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
      }
    );

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
        await attachedAllFiles.expandFolder(ModelIds.DALLE, {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder('images', {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder(specialCharsFolder, {
          isHttpMethodTriggered: true,
        });

        await attachedAllFiles.getFolderByName('images').hover();

        const firstImageEntity: TreeEntity = {name: Attachment.sunImageName};
        await attachedFilesAssertion.assertSharedFileArrowIconState(firstImageEntity, 'visible');
        await attachedFilesAssertion.assertEntityArrowIconColor(firstImageEntity, Colors.controlsBackgroundAccent);

        const secondImageEntity: TreeEntity = {name: Attachment.cloudImageName};
        await attachedFilesAssertion.assertSharedFileArrowIconState(secondImageEntity, 'visible');
        await attachedFilesAssertion.assertEntityArrowIconColor(secondImageEntity, Colors.controlsBackgroundAccent);

        const thirdImageEntity: TreeEntity = {name: Attachment.flowerImageName};
        await attachedFilesAssertion.assertSharedFileArrowIconState(thirdImageEntity, 'visible');
        await attachedFilesAssertion.assertEntityArrowIconColor(thirdImageEntity, Colors.controlsBackgroundAccent);

        //TODO EPMRTC-4135 blocked by the #1076
        // const fourthImageEntity: TreeEntity = { name: Attachment.heartImageName };
        // await attachedFilesAssertion.assertSharedFileArrowIconState(fourthImageEntity, 'visible');
        // await attachedFilesAssertion.assertEntityArrowIconColor(fourthImageEntity, Colors.controlsBackgroundAccent);

        const specialCharsImageEntity: TreeEntity = {name: Attachment.specialSymbolsName};
        await attachedFilesAssertion.assertSharedFileArrowIconState(specialCharsImageEntity, 'visible');
        await attachedFilesAssertion.assertEntityArrowIconColor(specialCharsImageEntity, Colors.controlsBackgroundAccent);
      },
    );


    await dialSharedWithMeTest.step(
      'By user2 create a conversation with attachments from Shared with me section in Manage attachments',
      async () => {
        additionalShareUserConversationData.resetData();
        let conversationToShare: Conversation;
        conversationToShare = additionalShareUserConversationData.prepareEmptyConversation(
          ModelIds.GPT_4_O
        );

        await additionalShareUserItemApiHelper.createConversations([conversationToShare], BucketUtil.getAdditionalShareUserBucket().toString());
        await additionalShareUserLocalStorageManager.setSelectedConversation(conversationToShare);

        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded({});
        await additionalShareUserSendMessage.attachmentMenuTrigger.click();

        await additionalShareUserAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );

        await additionalShareUserAttachFilesModal.checkAttachedFile(Attachment.specialSymbolsName, FileModalSection.SharedWithMe);
        await additionalShareUserAttachFilesModal.attachFiles();
        await additionalShareUserChat.sendRequestWithButton('test request');
        await additionalShareUserChat.waitForResponse();
        await additionalShareUserConversations.openEntityDropdownMenu('test request');
        await additionalShareUserConversationDropdownMenu.selectMenuOption(MenuOptions.share);
        const errorMessage = await additionalShareUserErrorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.sharingWithAttachmentNotFromAllFilesFailed)
          .toBe(ExpectedConstants.sharingWithAttachmentNotFromAllFilesErrorMessage);
      }
    )
  },
);
