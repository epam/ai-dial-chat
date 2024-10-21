import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  Attachment,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { Attributes, Colors } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { Locator, expect } from '@playwright/test';

const chatResponseIndex = 2;
let defaultModel: DialAIEntityModel;
let randomModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  randomModel = GeneratorUtil.randomArrayElement(
    ModelsUtil.getModels().filter((m) => m.id !== defaultModel.id),
  );
});

dialSharedWithMeTest(
  'Share with me. Chats with different context.\n' +
    'Shared chat history is updated in Shared with me if to generate new picture',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserChatMessages,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserRequestContext,
    additionalShareUserConversations,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1933', 'EPMRTC-2896');
    let responseImageConversation: Conversation;
    let requestImageConversation: Conversation;
    let stageConversation: Conversation;
    let codeConversation: Conversation;
    let sharedConversations: Conversation[];

    let responseImageUrl: string;
    let requestImageUrl: string;

    await dialSharedWithMeTest.step(
      'Upload images to default model path and root folder and prepare conversations with request and response containing this images, conversations with stage and code in response',
      async () => {
        responseImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(defaultModel.id),
        );

        await fileApiHelper.putFile(
          Attachment.cloudImageName,
          API.modelFilePath(defaultModel.id),
        );

        requestImageUrl = await fileApiHelper.putFile(
          Attachment.heartImageName,
        );

        responseImageConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            responseImageUrl,
            defaultModel,
          );
        conversationData.resetData();

        requestImageConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModel,
            true,
            requestImageUrl,
          );
        conversationData.resetData();

        stageConversation =
          conversationData.prepareConversationWithStagesInResponse(
            defaultModel,
            1,
          );
        conversationData.resetData();

        codeConversation =
          conversationData.prepareConversationWithCodeContent();
        conversationData.resetData();

        sharedConversations = [
          responseImageConversation,
          requestImageConversation,
          stageConversation,
          codeConversation,
        ];
        await dataInjector.createConversations(sharedConversations);
      },
    );

    await dialSharedWithMeTest.step(
      'Share all conversation and accept invites by user',
      async () => {
        for (const conversation of sharedConversations) {
          const shareByLinkResponse =
            await mainUserShareApiHelper.shareEntityByLink([conversation]);
          await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Open shared conversations one by one and verify attachments, stages and code style are displayed correctly',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserConversations.selectConversation(
          responseImageConversation.name,
        );

        await additionalShareUserChatMessages
          .getChatMessage(chatResponseIndex)
          .waitFor();
        await additionalShareUserChatMessages.expandChatMessageAttachment(
          chatResponseIndex,
          Attachment.sunImageName,
        );
        const responseImageActualAttachmentUrl =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(
            chatResponseIndex,
          );
        if (responseImageActualAttachmentUrl) {
          const imageDownloadResponse =
            await additionalShareUserRequestContext.get(
              responseImageActualAttachmentUrl,
            );
          expect
            .soft(
              imageDownloadResponse.status(),
              ExpectedMessages.attachmentIsSuccessfullyDownloaded,
            )
            .toBe(200);
        }

        await additionalShareUserSharedWithMeConversations.selectConversation(
          requestImageConversation.name,
        );
        await additionalShareUserChatMessages
          .getChatMessage(chatResponseIndex)
          .waitFor();
        const requestImageAttachmentPath =
          requestImageConversation.messages[0]!.custom_content!.attachments![0]
            .url;
        const requestImageActualDownloadUrl =
          await additionalShareUserChatMessages.getChatMessageDownloadUrl(
            chatResponseIndex - 1,
          );
        expect
          .soft(
            requestImageActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(requestImageAttachmentPath);
        if (requestImageActualDownloadUrl) {
          const imageDownloadResponse =
            await additionalShareUserRequestContext.get(
              requestImageActualDownloadUrl,
            );
          expect
            .soft(
              imageDownloadResponse.status(),
              ExpectedMessages.attachmentIsSuccessfullyDownloaded,
            )
            .toBe(200);
        }

        await additionalShareUserSharedWithMeConversations.selectConversation(
          stageConversation.name,
        );
        await additionalShareUserChatMessages
          .getChatMessage(chatResponseIndex)
          .waitFor();
        await expect
          .soft(
            additionalShareUserChatMessages.messageStage(chatResponseIndex, 1),
            ExpectedMessages.stageIsVisibleInResponse,
          )
          .toBeVisible();

        await additionalShareUserSharedWithMeConversations.selectConversation(
          codeConversation.name,
        );
        await additionalShareUserChatMessages
          .getChatMessage(chatResponseIndex)
          .waitFor();
        await expect
          .soft(
            additionalShareUserChatMessages.getChatMessageCodeBlock(
              chatResponseIndex,
            ),
            ExpectedMessages.codeIsVisibleInResponse,
          )
          .toBeVisible();
      },
    );

    //TODO: uncomment when issue https://github.com/epam/ai-dial-chat/issues/1111 is fixed
    // await dialSharedWithMeTest.step(
    //   'Add one more attachment to conversation with images in the response',
    //   async () => {
    //     const secondAttachment =
    //       conversationData.getAttachmentData(secondDalleImageUrl);
    //     const secondUserMessage = dalleConversation.messages[0];
    //     const secondAssistantMessage = JSON.parse(
    //       JSON.stringify(dalleConversation.messages[1]),
    //     );
    //     secondAssistantMessage!.custom_content!.attachments![0] =
    //       secondAttachment;
    //     dalleConversation.messages.push(
    //       secondUserMessage,
    //       secondAssistantMessage,
    //     );
    //     await dataInjector.updateConversations([dalleConversation]);
    //   },
    // );
    //
    // await dialSharedWithMeTest.step(
    //   'Verify new attachment is shared with user',
    //   async () => {
    //     await additionalShareUserDialHomePage.reloadPage();
    //     await additionalShareUserDialHomePage.waitForPageLoaded();
    //
    //     await additionalShareUserChatMessages.getChatMessage(4).waitFor();
    //     const dalleAttachmentPath =
    //       dalleConversation.messages[3]!.custom_content!.attachments![0].url;
    //     await additionalShareUserChatMessages.openChatMessageAttachment(
    //       4,
    //       Attachment.cloudImageName,
    //     );
    //     const dalleActualAttachmentUrl =
    //       await additionalShareUserChatMessages.getChatMessageAttachmentUrl(4);
    //     const dalleActualDownloadUrl =
    //       await additionalShareUserChatMessages.getChatMessageDownloadUrl(4);
    //     expect
    //       .soft(dalleActualAttachmentUrl, ExpectedMessages.attachmentUrlIsValid)
    //       .toContain(dalleAttachmentPath);
    //     expect
    //       .soft(dalleActualDownloadUrl, ExpectedMessages.attachmentUrlIsValid)
    //       .toContain(dalleAttachmentPath);
    //
    //     if (dalleActualAttachmentUrl) {
    //       const imageDownloadResponse =
    //         await additionalShareUserRequestContext.get(
    //           dalleActualAttachmentUrl,
    //         );
    //       expect
    //         .soft(
    //           imageDownloadResponse.status(),
    //           ExpectedMessages.attachmentIsSuccessfullyDownloaded,
    //         )
    //         .toBe(200);
    //     }
    //   },
    // );
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
    let responseImageConversation: Conversation;
    let requestImageConversation: Conversation;
    let stageConversation: Conversation;
    let codeConversation: Conversation;
    let sharedConversations: Conversation[];
    let conversationsInFolder: FolderConversation;
    let responseImageUrl: string;
    let requestImageUrl: string;
    let responseImageAttachmentPath: string;
    let requestImageAttachmentPath: string;

    await dialSharedWithMeTest.step(
      'Upload images to default model path and root folder and prepare conversations with request and response containing this images, conversations with stage and code in response and move them into folder',
      async () => {
        responseImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(defaultModel.id),
        );

        requestImageUrl = await fileApiHelper.putFile(
          Attachment.heartImageName,
        );

        responseImageConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            responseImageUrl,
            defaultModel.id,
          );
        conversationData.resetData();

        requestImageConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModel,
            true,
            requestImageUrl,
          );
        conversationData.resetData();

        stageConversation =
          conversationData.prepareConversationWithStagesInResponse(
            defaultModel,
            1,
          );
        conversationData.resetData();

        codeConversation =
          conversationData.prepareConversationWithCodeContent();
        conversationData.resetData();

        sharedConversations = [
          responseImageConversation,
          requestImageConversation,
          stageConversation,
          codeConversation,
        ];
        conversationsInFolder =
          conversationData.prepareConversationsInFolder(sharedConversations);
        await dataInjector.createConversations(sharedConversations);

        responseImageAttachmentPath =
          responseImageConversation.messages[1]!.custom_content!.attachments![0]
            .url!;
        requestImageAttachmentPath =
          requestImageConversation.messages[0]!.custom_content!.attachments![0]
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
            request.resources.find(
              (r) => r.url === responseImageAttachmentPath,
            ),
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toBeDefined();
        expect
          .soft(
            request.resources.find((r) => r.url === requestImageAttachmentPath),
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
          responseImageConversation.name,
        );
        await additionalShareUserChatMessages
          .getChatMessage(chatResponseIndex)
          .waitFor();
        await additionalShareUserChatMessages.expandChatMessageAttachment(
          2,
          Attachment.sunImageName,
        );
        const responseImageActualAttachmentUrl =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(
            chatResponseIndex,
          );
        const responseImageActualDownloadUrl =
          await additionalShareUserChatMessages.getChatMessageDownloadUrl(
            chatResponseIndex,
          );
        expect
          .soft(
            responseImageActualAttachmentUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(responseImageAttachmentPath);
        expect
          .soft(
            responseImageActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(responseImageAttachmentPath);

        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          requestImageConversation.name,
        );
        await additionalShareUserChatMessages
          .getChatMessage(chatResponseIndex)
          .waitFor();
        const requestImageActualDownloadUrl =
          await additionalShareUserChatMessages.getChatMessageDownloadUrl(
            chatResponseIndex - 1,
          );
        expect
          .soft(
            requestImageActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(requestImageAttachmentPath);

        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          stageConversation.name,
        );
        await additionalShareUserChatMessages
          .getChatMessage(chatResponseIndex)
          .waitFor();
        await expect
          .soft(
            additionalShareUserChatMessages.messageStage(chatResponseIndex, 1),
            ExpectedMessages.stageIsVisibleInResponse,
          )
          .toBeVisible();

        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          codeConversation.name,
        );
        await additionalShareUserChatMessages
          .getChatMessage(chatResponseIndex)
          .waitFor();
        await expect
          .soft(
            additionalShareUserChatMessages.getChatMessageCodeBlock(
              chatResponseIndex,
            ),
            ExpectedMessages.codeIsVisibleInResponse,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Arrow icon appears for file in Manage attachments if it was shared along with chat.\n' +
    'Unshare image file',
  async ({
    dialHomePage,
    conversationData,
    chatBar,
    attachFilesModal,
    attachedAllFiles,
    fileApiHelper,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3518', 'EPMRTC-3102');
    let imageConversation: Conversation;
    let imageUrl: string;
    const filePath = API.modelFilePath(defaultModel.id);
    const pathSegment = filePath.split('/');
    const lowestFileFolder = pathSegment[pathSegment.length - 1];
    let fileArrowIcon: Locator;

    await dialTest.step(
      'Prepare conversations with image in the response',
      async () => {
        imageUrl = await fileApiHelper.putFile(
          Attachment.cloudImageName,
          filePath,
        );
        imageConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageUrl,
            defaultModel,
          );
        await dataInjector.createConversations([imageConversation]);
      },
    );

    await dialTest.step(
      'Share conversation and accept invite by another user',
      async () => {
        const shareByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([imageConversation]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialTest.step(
      'Open "Manage attachments" modal and verify shared file has arrow icon',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        for (const segment of pathSegment) {
          await attachedAllFiles.expandFolder(segment, {
            isHttpMethodTriggered: true,
          });
        }
        fileArrowIcon = attachedAllFiles.getFolderEntityArrowIcon(
          lowestFileFolder,
          Attachment.cloudImageName,
        );
        await expect
          .soft(fileArrowIcon, ExpectedMessages.sharedEntityIconIsVisible)
          .toBeVisible();
        const fileArrowIconColor =
          await attachedAllFiles.getFolderEntityArrowIconColor(
            lowestFileFolder,
            Attachment.cloudImageName,
          );
        expect
          .soft(fileArrowIconColor[0], ExpectedMessages.sharedIconColorIsValid)
          .toBe(Colors.controlsBackgroundAccent);
      },
    );

    await dialTest.step(
      'Select "Unshare" option from file dropdown menu and verify arrow icon disappears for file',
      async () => {
        await attachedAllFiles.openFolderEntityDropdownMenu(
          lowestFileFolder,
          Attachment.cloudImageName,
        );
        await attachFilesModal
          .getFileDropdownMenu()
          .selectMenuOption(MenuOptions.unshare);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await expect
          .soft(fileArrowIcon, ExpectedMessages.sharedEntityIconIsVisible)
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Verify only conversation is shared with another user',
      async () => {
        const sharedConversations =
          await additionalUserShareApiHelper.listSharedWithMeConversations();
        expect
          .soft(
            sharedConversations.resources.find(
              (e) => e.url === imageConversation.id,
            ),
            ExpectedMessages.conversationIsShared,
          )
          .toBeDefined();

        const sharedFiles =
          await additionalUserShareApiHelper.listSharedWithMeFiles();
        expect
          .soft(
            sharedFiles.resources.find((e) => e.url === imageUrl),
            ExpectedMessages.fileIsNotShared,
          )
          .toBeUndefined();
      },
    );
  },
);

dialSharedWithMeTest(
  'Sharing of a chat in Playback mode',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserConversations,
    additionalShareUserChatMessages,
    additionalShareUserChat,
    additionalShareUserChatHeader,
    additionalShareUserRecentEntities,
    additionalShareUserPlaybackControl,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3517');
    let responseImageConversation: Conversation;
    let stageConversation: Conversation;
    let codeConversation: Conversation;
    let historyConversation: Conversation;
    let playbackConversation: Conversation;
    let responseImageUrl: string;

    await dialSharedWithMeTest.step(
      'Prepare playback conversation with image, stage and code in the responses for different models',
      async () => {
        responseImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(defaultModel.id),
        );

        responseImageConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            responseImageUrl,
            defaultModel,
          );
        conversationData.resetData();

        stageConversation =
          conversationData.prepareConversationWithStagesInResponse(
            defaultModel,
            1,
          );
        conversationData.resetData();

        codeConversation =
          conversationData.prepareConversationWithCodeContent();

        historyConversation = conversationData.prepareHistoryConversation(
          responseImageConversation,
          stageConversation,
          codeConversation,
        );
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(
            historyConversation,
          );

        await dataInjector.createConversations([
          historyConversation,
          playbackConversation,
        ]);
      },
    );

    await dialSharedWithMeTest.step(
      'Share playback conversation and accept invite by another user',
      async () => {
        const shareByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([
            playbackConversation,
          ]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
      'Open shared conversation and verify playback is active, Next button is enabled, conversation has Playback icon on side panel',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserConversations.selectConversation(
          playbackConversation.name,
        );
        await expect
          .soft(
            additionalShareUserSharedWithMeConversations.getEntityPlaybackIcon(
              playbackConversation.name,
            ),
            ExpectedMessages.chatBarConversationIconIsPlayback,
          )
          .toBeVisible();
        await expect
          .soft(
            additionalShareUserRecentEntities.playbackButton.getElementLocator(),
            ExpectedMessages.playbackIconIsSelected,
          )
          .toBeVisible();
        await expect
          .soft(
            additionalShareUserPlaybackControl.playbackNextButton.getElementLocator(),
            ExpectedMessages.playbackNextButtonEnabled,
          )
          .toBeEnabled();
      },
    );

    await dialSharedWithMeTest.step(
      'Play conversation requests back one by one and verify content is displayed correctly, data can be downloaded',
      async () => {
        for (let i = 1; i <= 2; i++) {
          await additionalShareUserPlaybackControl.playbackNextButton.click();
        }
        await additionalShareUserChatMessages
          .getChatMessageAttachment(chatResponseIndex, Attachment.sunImageName)
          .waitForState({ state: 'visible' });
        const expandAttachmentResponse =
          await additionalShareUserChatMessages.expandChatMessageAttachment(
            chatResponseIndex,
            Attachment.sunImageName,
          );
        expect
          .soft(
            expandAttachmentResponse?.status(),
            ExpectedMessages.attachmentIsExpanded,
          )
          .toBe(200);

        for (let i = 1; i <= 2; i++) {
          await additionalShareUserPlaybackControl.playbackNextButton.click();
        }
        await additionalShareUserChatMessages.openMessageStage(
          chatResponseIndex + 2,
          1,
        );
        await expect
          .soft(
            additionalShareUserChatMessages.getMessageStage(
              chatResponseIndex + 2,
              1,
            ),
            ExpectedMessages.stageIsVisibleInResponse,
          )
          .toBeVisible();

        for (let i = 1; i <= 2; i++) {
          await additionalShareUserPlaybackControl.playbackNextButton.click();
        }
        await expect
          .soft(
            additionalShareUserChatMessages.getChatMessageCodeBlock(
              chatResponseIndex + 4,
            ),
            ExpectedMessages.codeIsVisibleInResponse,
          )
          .toBeVisible();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify no "Stop playback" button is available in the header, "Duplicate the conversation to be able to edit it" button is not available',
      async () => {
        await expect
          .soft(
            additionalShareUserChatHeader.leavePlaybackMode.getElementLocator(),
            ExpectedMessages.stopPlaybackButtonNotVisible,
          )
          .toBeHidden();
        await expect
          .soft(
            additionalShareUserChat.duplicate.getElementLocator(),
            ExpectedMessages.duplicateButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify conversation context menu items',
      async () => {
        await additionalShareUserSharedWithMeConversations.openEntityDropdownMenu(
          playbackConversation.name,
        );
        const allMenuOptions =
          await additionalShareUserSharedWithMeConversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(allMenuOptions, ExpectedMessages.contextMenuOptionsValid)
          .toEqual([
            MenuOptions.duplicate,
            MenuOptions.export,
            MenuOptions.delete,
          ]);
      },
    );
  },
);

dialSharedWithMeTest(
  'Sharing of a chat with plotly graph',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserChatMessages,
    setTestIds,
    additionalShareUserConversations,
  }) => {
    setTestIds('EPMRTC-3112');
    let plotlyConversation: Conversation;
    let plotlyImageUrl: string;

    await dialSharedWithMeTest.step(
      'Prepare conversation with plotly graph in the response',
      async () => {
        plotlyImageUrl = await fileApiHelper.putFile(
          Attachment.plotlyName,
          API.modelFilePath(defaultModel.id),
        );
        plotlyConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            plotlyImageUrl,
            defaultModel,
          );
        await dataInjector.createConversations([plotlyConversation]);
      },
    );

    await dialSharedWithMeTest.step(
      'Share conversation and accept invite by another user',
      async () => {
        const shareByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([plotlyConversation]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
      'Open shared conversation and verify plotly graph is shown on expand attachment',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserConversations.selectConversation(
          plotlyConversation.name,
        );
        await additionalShareUserChatMessages
          .getChatMessageAttachment(chatResponseIndex, Attachment.plotlyName)
          .waitForState({ state: 'visible' });
        const expandAttachmentResponse =
          await additionalShareUserChatMessages.expandChatMessageAttachment(
            chatResponseIndex,
            Attachment.plotlyName,
          );
        expect
          .soft(
            expandAttachmentResponse?.status(),
            ExpectedMessages.attachmentIsExpanded,
          )
          .toBe(200);
        await expect
          .soft(
            additionalShareUserChatMessages.getMessagePlotlyAttachment(
              chatResponseIndex,
            ),
            ExpectedMessages.plotlyAttachmentIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialSharedWithMeTest(
  'Sharing of a chat with attached link',
  async ({
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserChatMessages,
    additionalShareUserConversations,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3353');
    let attachmentLinkConversation: Conversation;
    const attachmentLink = 'https://www.epam.com';

    await dialSharedWithMeTest.step(
      'Prepare conversation with attachment link in the request',
      async () => {
        attachmentLinkConversation =
          conversationData.prepareConversationWithAttachmentLinkInRequest(
            defaultModel,
            attachmentLink,
          );
        await dataInjector.createConversations([attachmentLinkConversation]);
      },
    );

    await dialSharedWithMeTest.step(
      'Share conversation and accept invite by another user',
      async () => {
        const shareByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([
            attachmentLinkConversation,
          ]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
      'Open shared conversation and verify links from request and responses are shared',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserConversations.selectConversation(
          attachmentLinkConversation.name,
        );

        await additionalShareUserConversations.selectConversation(
          attachmentLinkConversation.name,
        );
        for (let i = 1; i <= chatResponseIndex; i++) {
          await expect
            .soft(
              additionalShareUserChatMessages.getAttachmentLinkIcon(i),
              ExpectedMessages.attachmentLinkIsValid,
            )
            .toHaveAttribute(Attributes.href, attachmentLink);
        }
      },
    );
  },
);
