import { Conversation } from '@/chat/types/chat';
import { BackendDataEntity } from '@/chat/types/common';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  AddonIds,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  ModelIds,
} from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const nestedLevel = 3;
let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialSharedWithMeTest(
  'Shared with me. Share root Folder.\n' +
    'Shared with me. Folder with folder/chat inside is deleted.\n' +
    'Shared with me. No delete option in context menu for chat/folder in shared folder',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedFolderConversations,
    additionalShareUserSharedWithMeFolderDropdownMenu,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConfirmationDialog,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserLocalStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1828', 'EPMRTC-2767', 'EPMRTC-1833');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[];
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Prepare conversations inside nested folder structure',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(nestedLevel);
        conversationData.resetData();
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink(
          [nestedConversations[0]],
          true,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify whole nested structure is displayed under Shared with section',
      async () => {
        await additionalShareUserLocalStorageManager.setSelectedConversation(
          nestedConversations[nestedLevel],
        );
        await additionalShareUserDialHomePage.openHomePage(
          { iconsToBeLoaded: [defaultModel!.iconUrl] },
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        for (let i = 0; i <= nestedLevel; i++) {
          await additionalShareUserSharedFolderConversations
            .getFolderEntity(nestedFolders[i].name, nestedConversations[i].name)
            .waitFor();
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Verify no context menu available for folders and chats under root',
      async () => {
        const isNestedFolderMenuAvailable =
          await additionalShareUserSharedFolderConversations.isFolderDropdownMenuAvailable(
            nestedFolders[1].name,
          );
        expect
          .soft(
            isNestedFolderMenuAvailable,
            ExpectedMessages.contextMenuIsNotAvailable,
          )
          .toBeFalsy();

        await additionalShareUserSharedFolderConversations.openFolderEntityDropdownMenu(
          nestedFolders[nestedLevel].name,
          nestedConversations[nestedLevel].name,
        );
        const nestedConversationMenuOptions =
          await additionalShareUserSharedWithMeConversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(
            nestedConversationMenuOptions,
            ExpectedMessages.contextMenuOptionsValid,
          )
          .toEqual(expect.not.arrayContaining([MenuOptions.delete]));
      },
    );

    await dialSharedWithMeTest.step(
      'Try to delete root folder and cancel the process',
      async () => {
        await additionalShareUserSharedFolderConversations.openFolderDropdownMenu(
          nestedFolders[0].name,
        );
        await additionalShareUserSharedWithMeFolderDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.cancelDialog();
        await additionalShareUserSharedFolderConversations
          .getFolderEntity(nestedFolders[0].name, nestedConversations[0].name)
          .waitFor();
      },
    );

    await dialSharedWithMeTest.step(
      'Delete root folder and verify all nested structure is deleted',
      async () => {
        await additionalShareUserSharedFolderConversations.openFolderDropdownMenu(
          nestedFolders[0].name,
        );
        await additionalShareUserSharedWithMeFolderDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        for (let i = 0; i <= nestedLevel; i++) {
          await additionalShareUserSharedFolderConversations
            .getFolderEntity(nestedFolders[i].name, nestedConversations[i].name)
            .waitFor({ state: 'hidden' });
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Reload page and verify deleted structure is not restored',
      async () => {
        await additionalShareUserDialHomePage.reloadPage();
        await await additionalShareUserDialHomePage.waitForPageLoaded();
        for (let i = 0; i <= nestedLevel; i++) {
          await additionalShareUserSharedFolderConversations
            .getFolderEntity(nestedFolders[i].name, nestedConversations[i].name)
            .waitFor({ state: 'hidden' });
        }
      },
    );
  },
);

dialSharedWithMeTest(
  'Share with me. Folder with chats with different context',
  async ({
    conversationData,
    dialHomePage,
    folderConversations,
    fileApiHelper,
    dataInjector,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserChatMessages,
    additionalShareUserSharedFolderConversations,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2860');
    let dalleConversation: Conversation;
    let gptVisionConversation: Conversation;
    let addonConversation: Conversation;
    let codeConversation: Conversation;
    let sharedConversations: Conversation[];
    let conversationsInFolder: FolderConversation;
    let dalleImageUrl: string;
    let gptProVisionImageUrl: string;
    let dalleAttachmentPath: string;
    let gptVisionAttachmentPath: string;

    await dialSharedWithMeTest.step(
      'Upload images to DALL-E-3 path and root folder and prepare conversations with request and response containing this images, conversations with stage and code in response and move them into folder',
      async () => {
        dalleImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(ModelIds.DALLE),
        );

        gptProVisionImageUrl = await fileApiHelper.putFile(
          Attachment.heartImageName,
        );

        dalleConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            dalleImageUrl,
            ModelIds.DALLE,
          );
        conversationData.resetData();

        gptVisionConversation =
          conversationData.prepareConversationWithAttachmentInRequest(
            gptProVisionImageUrl,
            ModelIds.GPT_4_VISION_PREVIEW,
            true,
          );
        conversationData.resetData();

        addonConversation = conversationData.prepareAddonsConversation(
          ModelsUtil.getModel(ModelIds.GPT_4)!,
          [AddonIds.XWEATHER],
        );
        conversationData.resetData();

        codeConversation =
          conversationData.prepareConversationWithCodeContent();
        conversationData.resetData();

        sharedConversations = [
          dalleConversation,
          gptVisionConversation,
          addonConversation,
          codeConversation,
        ];
        conversationsInFolder =
          conversationData.prepareConversationsInFolder(sharedConversations);
        await dataInjector.createConversations(sharedConversations);

        dalleAttachmentPath =
          dalleConversation.messages[1]!.custom_content!.attachments![0].url!;
        gptVisionAttachmentPath =
          gptVisionConversation.messages[0]!.custom_content!.attachments![0]
            .url!;
      },
    );

    await dialSharedWithMeTest.step(
      'Share folder with conversations by main user and accept invite by another user',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await folderConversations.openFolderDropdownMenu(
          conversationsInFolder.folders.name,
        );
        const requestResponse =
          await folderConversations.selectShareMenuOption();
        const request = requestResponse.request;
        expect
          .soft(
            request.resources.length,
            ExpectedMessages.sharedResourcesCountIsValid,
          )
          .toBe(3);
        expect
          .soft(
            request.resources.find(
              (r) =>
                r.url === `${conversationsInFolder.conversations[0].folderId}/`,
            ),
            ExpectedMessages.folderUrlIsValid,
          )
          .toBeDefined();
        expect
          .soft(
            request.resources.find((r) => r.url === dalleAttachmentPath),
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toBeDefined();
        expect
          .soft(
            request.resources.find((r) => r.url === gptVisionAttachmentPath),
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toBeDefined();

        await additionalUserShareApiHelper.acceptInvite(
          requestResponse.response,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open shared conversations one by one and verify attachments, stages and code style are displayed correctly',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedFolderConversations.expandCollapseFolder(
          conversationsInFolder.folders.name,
        );
        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          dalleConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        await additionalShareUserChatMessages.openChatMessageAttachment(
          2,
          Attachment.sunImageName,
        );
        const dalleActualAttachmentUrl =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(2);
        const dalleActualDownloadUrl =
          await additionalShareUserChatMessages.getChatMessageDownloadUrl(2);
        expect
          .soft(dalleActualAttachmentUrl, ExpectedMessages.attachmentUrlIsValid)
          .toContain(dalleAttachmentPath);
        expect
          .soft(dalleActualDownloadUrl, ExpectedMessages.attachmentUrlIsValid)
          .toContain(dalleAttachmentPath);

        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          gptVisionConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const gptVisionActualDownloadUrl =
          await additionalShareUserChatMessages.getChatMessageDownloadUrl(1);
        expect
          .soft(
            gptVisionActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(gptVisionAttachmentPath);

        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          addonConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const isStageVisible =
          await additionalShareUserChatMessages.isMessageStageReceived(2, 1);
        expect
          .soft(isStageVisible, ExpectedMessages.stageIsVisibleInResponse)
          .toBeTruthy();

        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          codeConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const isCodeContentVisible =
          await additionalShareUserChatMessages.isChatMessageCodeVisible(2);
        expect
          .soft(isCodeContentVisible, ExpectedMessages.codeIsVisibleInResponse)
          .toBeTruthy();
      },
    );
  },
);
