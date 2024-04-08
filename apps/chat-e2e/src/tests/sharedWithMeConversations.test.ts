import { Conversation, Role } from '@/chat/types/chat';
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

let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialSharedWithMeTest(
  'Shared with me. Share single chat in Today section.\n' +
    'Shared chat history is updated in Shared with me.\n' +
    'Shared chat history is shown if to refresh browser when shared chat history is on the screen.\n' +
    'Shared with me. Chat is deleted when it was focused',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserChatBar,
    additionalShareUserChatHeader,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserChatMessages,
    localStorageManager,
    additionalShareUserChatInfoTooltip,
    additionalShareUserNotFound,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConfirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1826', 'EPMRTC-1875', 'EPMRTC-2766', 'EPMRTC-2881');
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step('Prepare shared conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        conversation,
      ]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify chat stays under Shared with me and is selected',
      async () => {
        await additionalShareUserDialHomePage.openHomePage(
          { iconsToBeLoaded: [defaultModel!.iconUrl] },
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedWithMeConversations
          .getConversationByName(conversation.name)
          .waitFor();
        await additionalShareUserSharedWithMeConversations.selectConversation(
          conversation.name,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Update settings, send new request in shared chat and verify chat history and settings are updated for chat in Shared with me section',
      async () => {
        const updatedTemp = 0;
        const updatedPrompt = 'use numbers';
        conversation.temperature = updatedTemp;
        conversation.prompt = updatedPrompt;
        conversation.messages.push(
          {
            role: Role.User,
            content: '1+2',
            model: { id: ModelIds.GPT_3_5_TURBO },
          },
          {
            role: Role.Assistant,
            content: '3',
            model: { id: ModelIds.GPT_3_5_TURBO },
          },
        );
        await dataInjector.updateConversations([conversation]);

        await additionalShareUserDialHomePage.reloadPage();
        await additionalShareUserChatMessages.getChatMessage(4).waitFor();

        await additionalShareUserChatHeader.hoverOverChatModel();
        const promptInfo =
          await additionalShareUserChatInfoTooltip.getPromptInfo();
        expect
          .soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid)
          .toBe(updatedPrompt);

        const tempInfo =
          await additionalShareUserChatInfoTooltip.getTemperatureInfo();
        expect
          .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(updatedTemp.toString());
      },
    );

    await dialSharedWithMeTest.step(
      'Delete shared conversation and verify "Conversation not found" message is not shown',
      async () => {
        await additionalShareUserChatBar.createNewConversation();
        await additionalShareUserSharedWithMeConversations.openConversationDropdownMenu(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await additionalShareUserSharedWithMeConversations
          .getConversationByName(conversation.name)
          .waitFor({ state: 'hidden' });
        await additionalShareUserNotFound.waitForState({ state: 'hidden' });
      },
    );
  },
);

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
    additionalShareUserLocalStorageManager,
    additionalShareUserChatMessages,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserRequestContext,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1933', 'EPMRTC-2896');
    let dalleConversation: Conversation;
    let gptVisionConversation: Conversation;
    let addonConversation: Conversation;
    let codeConversation: Conversation;
    let sharedConversations: Conversation[];

    let dalleImageUrl: string;
    let secondDalleImageUrl: string;
    let gptProVisionImageUrl: string;

    await dialSharedWithMeTest.step(
      'Upload images to DALL-E-3 path and root folder and prepare conversations with request and response containing this images, conversations with stage and code in response',
      async () => {
        dalleImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(ModelIds.DALLE),
        );

        secondDalleImageUrl = await fileApiHelper.putFile(
          Attachment.cloudImageName,
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
        await additionalShareUserLocalStorageManager.setSelectedConversation(
          dalleConversation,
        );
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();

        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        await additionalShareUserChatMessages.openChatMessageAttachment(
          2,
          Attachment.sunImageName,
        );
        const dalleActualAttachmentUrl =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(2);
        if (dalleActualAttachmentUrl) {
          const imageDownloadResponse =
            await additionalShareUserRequestContext.get(
              dalleActualAttachmentUrl,
            );
          expect
            .soft(
              imageDownloadResponse.status(),
              ExpectedMessages.attachmentIsSuccessfullyDownloaded,
            )
            .toBe(200);
        }

        await additionalShareUserSharedWithMeConversations.selectConversation(
          gptVisionConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const gptVisionAttachmentPath =
          gptVisionConversation.messages[0]!.custom_content!.attachments![0]
            .url;
        const gptVisionActualDownloadUrl =
          await additionalShareUserChatMessages.getChatMessageDownloadUrl(1);
        expect
          .soft(
            gptVisionActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(gptVisionAttachmentPath);
        if (gptVisionActualDownloadUrl) {
          const imageDownloadResponse =
            await additionalShareUserRequestContext.get(
              gptVisionActualDownloadUrl,
            );
          expect
            .soft(
              imageDownloadResponse.status(),
              ExpectedMessages.attachmentIsSuccessfullyDownloaded,
            )
            .toBe(200);
        }

        await additionalShareUserSharedWithMeConversations.selectConversation(
          addonConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const isStageVisible =
          await additionalShareUserChatMessages.isMessageStageReceived(2, 1);
        expect
          .soft(isStageVisible, ExpectedMessages.stageIsVisibleInResponse)
          .toBeTruthy();

        await additionalShareUserSharedWithMeConversations.selectConversation(
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

    //TODO: uncomment when issue https://github.com/epam/ai-dial-chat/issues/1111 is fixed
    // await dialSharedWithMeTest.step(
    //   'Add one more attachment to Dalle conversation',
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
  'Shared with me. Chat is deleted when another one is focused',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConfirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1834');
    let conversationInFolder: FolderConversation;
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Prepare shared conversation inside folder',
      async () => {
        conversationInFolder =
          conversationData.prepareDefaultConversationInFolder();
        await dataInjector.createConversations(
          conversationInFolder.conversations,
          conversationInFolder.folders,
        );
        conversation = conversationInFolder.conversations[0];
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          conversation,
        ]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
      'Open app by another user and delete shared conversation',
      async () => {
        await additionalShareUserDialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel!.iconUrl],
        });
        await additionalShareUserDialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await additionalShareUserSharedWithMeConversations.openConversationDropdownMenu(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });

        await additionalShareUserSharedWithMeConversations
          .getConversationByName(conversation.name)
          .waitFor({ state: 'hidden' });
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Structure creates again if it was deleted if to open the same link',
  async ({
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1855');
    let conversationInFolder: FolderConversation;
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Prepare shared conversation inside folder',
      async () => {
        conversationInFolder =
          conversationData.prepareDefaultConversationInFolder();
        await dataInjector.createConversations(
          conversationInFolder.conversations,
          conversationInFolder.folders,
        );
        conversation = conversationInFolder.conversations[0];
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink(
          [conversation],
          true,
        );
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
      'Delete shared folder from "Shared with me" section',
      async () => {
        let sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        await additionalUserShareApiHelper.deleteSharedWithMeEntities(
          sharedEntities.resources.filter(
            (r) => r.name === conversationInFolder.folders.name,
          ),
        );
        sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();

        expect
          .soft(
            sharedEntities.resources.find(
              (f) => f.name === conversationInFolder.folders.name,
            ),
            ExpectedMessages.folderIsNotShared,
          )
          .toBeUndefined();
      },
    );

    await dialSharedWithMeTest.step(
      'Accept the same share invite again and verify folder with chat shown in "Shared with me" section',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        expect
          .soft(
            sharedEntities.resources.find(
              (f) => f.name === conversationInFolder.folders.name,
            ),
            ExpectedMessages.folderIsNotShared,
          )
          .toBeDefined();
      },
    );
  },
);
