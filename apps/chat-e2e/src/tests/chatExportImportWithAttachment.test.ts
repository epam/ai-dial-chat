import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  ExpectedMessages,
  Import,
  MenuOptions,
  MockedChatApiResponseBodies,
  ModelIds,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { UploadDownloadData } from '@/src/ui/pages';
import { BucketUtil, FileUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let dalleImageUrl: string;
let gptProVisionImageUrl: string;
let geminiProVisionImageUrl: string;
let stableDiffusionImageUrl: string;
let gptProVisionAttachmentPath: string;
let geminiProVisionAttachmentPath: string;
let dalleAttachmentPath: string;

dialTest(
  'Cancel the Export with attachments',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    localStorageManager,
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    importExportLoader,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1980');
    let cancelExportConversation: Conversation;

    await dialTest.step(
      'Upload image to root folder and prepare conversation containing this image',
      async () => {
        const imageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
        cancelExportConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageUrl,
            ModelIds.DALLE,
          );
        await dataInjector.createConversations([cancelExportConversation]);
        await localStorageManager.setSelectedConversation(
          cancelExportConversation,
        );
      },
    );

    await dialTest.step(
      'Start exporting conversation with attachment and cancel in the middle',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.throttleAPIResponse('**/*');
        await conversations.openEntityDropdownMenu(
          cancelExportConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        await conversationDropdownMenu.selectMenuOption(
          MenuOptions.withAttachments,
        );
        // eslint-disable-next-line playwright/no-force-option
        await importExportLoader.stopLoading.click({ force: true });
        await importExportLoader.waitForState({ state: 'hidden' });
        await dialHomePage.unRouteAllResponses();
        const exportedFiles = FileUtil.getExportedFiles();
        expect
          .soft(
            exportedFiles?.find((f) =>
              f.includes(Import.importAttachmentExtension),
            ),
            ExpectedMessages.dataIsNotExported,
          )
          .toBeUndefined();
      },
    );
  },
);

dialTest(
  'Stop the import',
  async ({
    chatBar,
    dialHomePage,
    conversations,
    importExportLoader,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1982');

    await dialTest.step(
      'Import file, stop import in the middle and verify chat is not imported',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        const beforeImportConversations =
          await conversations.getTodayConversations();
        await dialHomePage.throttleAPIResponse('**/*');
        await dialHomePage.uploadData(
          { path: Import.importedAttachmentsFilename },
          () => chatBar.importButton.click(),
        );
        // eslint-disable-next-line playwright/no-force-option
        await importExportLoader.stopLoading.click({ force: true });
        await importExportLoader.waitForState({ state: 'hidden' });
        await dialHomePage.unRouteAllResponses();
        const afterImportConversations =
          await conversations.getTodayConversations();
        expect
          .soft(
            afterImportConversations.length,
            ExpectedMessages.dataIsNotImported,
          )
          .toBe(beforeImportConversations.length);
      },
    );
  },
);

//need to update the test
dialTest.skip(
  'Export and import file with pictures generated by DALL-E-3.\n' +
    'Export and import file with pictures loaded to Gemini Pro Vision.\n' +
    'Export and Import chat with attachments by different users.\n' +
    'Import updated exported zip.\n' +
    'Continue working with imported chat with attachments',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    localStorageManager,
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    chatBar,
    confirmationDialog,
    chatMessages,
    chat,
    chatHeader,
    talkToSelector,
    marketplacePage,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-1975',
      'EPMRTC-1976',
      'EPMRTC-1985',
      'EPMRTC-1983',
      'EPMRTC-1988',
    );
    let dalleConversation: Conversation;
    let gptProVisionConversation: Conversation;
    let historyConversation: Conversation;
    let exportedData: UploadDownloadData;
    const anotherUserFolderPath = `${API.importFilePath(BucketUtil.getBucket(), ModelIds.STABLE_DIFFUSION)}`;

    await dialTest.step(
      'Upload images to DALL-E-3 path and root folder and prepare conversations with request and response containing this images',
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
        gptProVisionConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            ModelIds.GPT_4_VISION_PREVIEW,
            true,
            gptProVisionImageUrl,
          );
        conversationData.resetData();
        historyConversation = conversationData.prepareHistoryConversation(
          dalleConversation,
          gptProVisionConversation,
        );
        await dataInjector.createConversations([historyConversation]);
        await localStorageManager.setSelectedConversation(historyConversation);
      },
    );

    await dialTest.step(
      'Export conversation with attachments with two models',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(historyConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(() =>
          conversationDropdownMenu.selectMenuOption(
            MenuOptions.withAttachments,
          ),
        );

        const exportedFiles = FileUtil.getExportedFiles();
        expect
          .soft(
            exportedFiles?.find((f) =>
              f.includes(Import.importAttachmentExtension),
            ),
            ExpectedMessages.dataIsExported,
          )
          .toBeDefined();
      },
    );

    await dialTest.step(
      'Import exported file and verify conversation is shown on chat bar panel',
      async () => {
        await chatBar.deleteAllEntities();
        await fileApiHelper.deleteAllFiles();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await conversations.getEntityByName(historyConversation.name).waitFor();
        await conversations.selectConversation(historyConversation.name);
        await chatMessages.waitForState({ state: 'attached' });
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(historyConversation.messages.length);
      },
    );

    await dialTest.step(
      'Open attachment from response and verify image is loaded, attachment url is pointing to import path',
      async () => {
        dalleAttachmentPath = `${API.importFilePath(BucketUtil.getBucket(), ModelIds.DALLE)}/${Attachment.sunImageName}`;
        await chatMessages.expandChatMessageAttachment(
          2,
          Attachment.sunImageName,
        );
        const dalleActualAttachmentUrl =
          await chatMessages.getChatMessageAttachmentUrl(2);
        const dalleActualDownloadUrl =
          await chatMessages.getChatMessageDownloadUrl(2);
        expect
          .soft(dalleActualAttachmentUrl, ExpectedMessages.attachmentUrlIsValid)
          .toContain(dalleAttachmentPath);
        expect
          .soft(dalleActualDownloadUrl, ExpectedMessages.attachmentUrlIsValid)
          .toContain(dalleAttachmentPath);
      },
    );

    await dialTest.step(
      'Download attachment from request and verify attachment url is pointing to import path',
      async () => {
        gptProVisionAttachmentPath = `${API.importFileRootPath(BucketUtil.getBucket())}/${Attachment.heartImageName}`;
        const gptProVisionActualDownloadUrl =
          await chatMessages.getChatMessageDownloadUrl(3);
        expect
          .soft(
            gptProVisionActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(gptProVisionAttachmentPath);
      },
    );

    await dialTest.step(
      'Import file exported by another user and verify conversation is imported',
      async () => {
        await dialHomePage.importFile(
          { path: Import.importedAttachmentsFilename },
          () => chatBar.importButton.click(),
        );
        await conversations
          .getEntityByName(Import.importedConversationWithAttachmentsName)
          .waitFor();
        await conversations.selectConversation(
          Import.importedConversationWithAttachmentsName,
        );
        await chatMessages.waitForState({ state: 'attached' });
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(historyConversation.messages.length);
      },
    );

    await dialTest.step(
      'Download attachment from request and verify attachment url is pointing to import path',
      async () => {
        const gptProVisionAttachmentPath = `${anotherUserFolderPath}/${Import.importedGpt4VisionAttachmentName}`;
        const gptProVisionActualDownloadUrl =
          await chatMessages.getChatMessageDownloadUrl(1);
        expect
          .soft(
            gptProVisionActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(gptProVisionAttachmentPath);
      },
    );

    await dialTest.step(
      'Open attachment from response and verify image is loaded, attachment url is pointing to import path',
      async () => {
        const stableDiffusionAttachmentPath = `${anotherUserFolderPath}/${Import.importedStableDiffusionAttachmentName}`;
        await chatMessages.expandChatMessageAttachment(
          4,
          Import.importedStableDiffusionAttachmentName,
        );
        const stableDiffusionActualAttachmentUrl =
          await chatMessages.getChatMessageAttachmentUrl(4);
        const stableDiffusionActualDownloadUrl =
          await chatMessages.getChatMessageDownloadUrl(4);
        expect
          .soft(
            stableDiffusionActualAttachmentUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(stableDiffusionAttachmentPath);
        expect
          .soft(
            stableDiffusionActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(stableDiffusionAttachmentPath);
      },
    );

    await dialTest.step(
      'Send new request in chat and verify response received',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        await talkToSelector.selectEntity(
          ModelsUtil.getDefaultModel()!,
          marketplacePage,
        );
        await chat.applyNewEntity();
        await chat.sendRequestWithButton('1+2=');
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(6);
      },
    );
  },
);

dialTest(
  'Export and import file with attachments in playback mode',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    localStorageManager,
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    chatBar,
    confirmationDialog,
    recentEntitiesAssertion,
    chatMessages,
    chat,
    playbackAssertion,
    chatMessagesAssertion,
    conversationAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3521');
    let dalleConversation: Conversation;
    let gptProVisionConversation: Conversation;
    let historyConversation: Conversation;
    let playbackConversation: Conversation;
    let exportedData: UploadDownloadData;

    await dialTest.step(
      'Prepare conversation with attachments in the request and response and playback conversation based on it',
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
        gptProVisionConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            ModelIds.GPT_4_VISION_PREVIEW,
            true,
            gptProVisionImageUrl,
          );
        conversationData.resetData();
        historyConversation = conversationData.prepareHistoryConversation(
          dalleConversation,
          gptProVisionConversation,
        );
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(
            historyConversation,
          );
        await dataInjector.createConversations([
          historyConversation,
          playbackConversation,
        ]);
        await localStorageManager.setSelectedConversation(playbackConversation);
      },
    );

    await dialTest.step(
      'Export playback conversation with attachments',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(playbackConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(() =>
          conversationDropdownMenu.selectMenuOption(
            MenuOptions.withAttachments,
          ),
        );
      },
    );

    await dialTest.step(
      'Remove all entities, import exported file and verify playback conversation is shown on chat bar panel',
      async () => {
        await fileApiHelper.deleteAllFiles();
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await conversationAssertion.assertEntityState(
          { name: playbackConversation.name },
          'visible',
        );
        await recentEntitiesAssertion.assertPlaybackIconState('visible');
      },
    );

    await dialTest.step(
      'Playback first conversation message and verify attachment is visible in the response and can be downloaded',
      async () => {
        await chat.playNextChatMessage(false);
        await playbackAssertion.assertPlaybackMessageContent(
          historyConversation.messages[0].content,
        );

        await chat.playNextChatMessage();
        dalleAttachmentPath = `${API.importFilePath(BucketUtil.getBucket(), ModelIds.DALLE)}/${Attachment.sunImageName}`;
        await chatMessages.expandChatMessageAttachment(
          2,
          Attachment.sunImageName,
        );
        await chatMessagesAssertion.assertMessageAttachmentUrl(
          2,
          dalleAttachmentPath,
        );
        await chatMessagesAssertion.assertMessageDownloadUrl(
          2,
          dalleAttachmentPath,
        );
      },
    );

    await dialTest.step(
      'Playback second conversation message and verify attachment is visible in the input field and request',
      async () => {
        await chat.playNextChatMessage(false);
        await playbackAssertion.assertPlaybackMessageContent(
          historyConversation.messages[2].content,
        );
        await playbackAssertion.assertPlaybackMessageAttachmentState(
          Attachment.heartImageName,
          'visible',
        );

        await chat.playNextChatMessage();
        gptProVisionAttachmentPath = `${API.importFileRootPath(BucketUtil.getBucket())}/${Attachment.heartImageName}`;
        await chatMessages.expandChatMessageAttachment(
          3,
          Attachment.heartImageName,
        );
        await chatMessagesAssertion.assertMessageAttachmentUrl(
          3,
          gptProVisionAttachmentPath,
        );
        await chatMessagesAssertion.assertMessageDownloadUrl(
          3,
          gptProVisionAttachmentPath,
        );
      },
    );
  },
);

dialTest(
  'Replay mode: export and import file with attachments in user message',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    localStorageManager,
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    chatBar,
    confirmationDialog,
    recentEntitiesAssertion,
    chat,
    chatMessages,
    chatAssertion,
    chatMessagesAssertion,
    conversationAssertion,
    apiAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-914');
    let historyConversation: Conversation;
    let replayConversation: Conversation;
    let exportedData: UploadDownloadData;

    await dialTest.step(
      'Prepare conversation with image, pdf attachments in the requests and replay conversation based on it',
      async () => {
        geminiProVisionImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
        );
        gptProVisionImageUrl = await fileApiHelper.putFile(Attachment.pdfName);
        historyConversation =
          conversationData.prepareHistoryConversationWithAttachmentsInRequest({
            1: {
              model: ModelIds.GEMINI_PRO_VISION,
              hasRequest: true,
              attachmentUrl: [geminiProVisionImageUrl],
            },
            2: {
              model: ModelIds.GPT_4_VISION_PREVIEW,
              hasRequest: true,
              attachmentUrl: [gptProVisionImageUrl],
            },
          });
        replayConversation =
          conversationData.prepareDefaultReplayConversation(
            historyConversation,
          );
        await dataInjector.createConversations([
          historyConversation,
          replayConversation,
        ]);
        await localStorageManager.setSelectedConversation(replayConversation);
      },
    );

    await dialTest.step(
      'Export replay conversation with attachments',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(replayConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(() =>
          conversationDropdownMenu.selectMenuOption(
            MenuOptions.withAttachments,
          ),
        );
      },
    );

    await dialTest.step(
      'Remove all entities, import exported file and verify replay conversation is opened',
      async () => {
        await fileApiHelper.deleteAllFiles();
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await conversationAssertion.assertEntityState(
          { name: replayConversation.name },
          'visible',
        );
        await recentEntitiesAssertion.assertReplayAsIsBordersColor(
          Colors.controlsBackgroundAccent,
        );
        await chatAssertion.assertReplayButtonState('visible');
      },
    );

    await dialTest.step(
      'Replay conversation and verify attachments are sent in the requests',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        const replayRequests = await chat.startReplayForDifferentModels();
        await apiAssertion.verifyRequestAttachments(
          replayRequests[0],
          geminiProVisionImageUrl,
        );
        await apiAssertion.verifyRequestAttachments(
          replayRequests[1],
          gptProVisionImageUrl,
        );
      },
    );

    await dialTest.step(
      'Verify request attachments can be opened and downloaded',
      async () => {
        const geminiProVisionMessageIndex = 1;
        const gptProVisionMessageIndex = 3;

        geminiProVisionAttachmentPath = `${API.importFileRootPath(BucketUtil.getBucket())}/${Attachment.sunImageName}`;
        await chatMessages.expandChatMessageAttachment(
          geminiProVisionMessageIndex,
          Attachment.sunImageName,
        );
        await chatMessagesAssertion.assertMessageAttachmentUrl(
          geminiProVisionMessageIndex,
          geminiProVisionAttachmentPath,
        );
        await chatMessagesAssertion.assertMessageDownloadUrl(
          geminiProVisionMessageIndex,
          geminiProVisionAttachmentPath,
        );

        gptProVisionAttachmentPath = `${API.importFileRootPath(BucketUtil.getBucket())}/${Attachment.pdfName}`;
        await chatMessagesAssertion.assertMessageDownloadUrl(
          gptProVisionMessageIndex,
          gptProVisionAttachmentPath,
        );
      },
    );
  },
);

dialTest(
  'Replay mode: export and import file with attachments in model response',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    localStorageManager,
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    chatBar,
    confirmationDialog,
    chatMessages,
    chat,
    chatMessagesAssertion,
    conversationAssertion,
    sendMessageAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3942');
    let historyConversation: Conversation;
    let replayConversation: Conversation;
    let exportedData: UploadDownloadData;

    await dialTest.step(
      'Prepare conversation with attachments in the responses and replay conversation based on it',
      async () => {
        dalleImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(ModelIds.DALLE),
        );
        stableDiffusionImageUrl = await fileApiHelper.putFile(
          Attachment.cloudImageName,
          API.modelFilePath(ModelIds.STABLE_DIFFUSION),
        );
        historyConversation =
          conversationData.prepareHistoryConversationWithAttachmentsInResponse({
            1: { attachmentUrl: dalleImageUrl, model: ModelIds.DALLE },
            2: {
              attachmentUrl: stableDiffusionImageUrl,
              model: ModelIds.STABLE_DIFFUSION,
            },
          });
        replayConversation =
          conversationData.preparePartiallyReplayedConversation(
            historyConversation,
            1,
          );
        await dataInjector.createConversations([
          historyConversation,
          replayConversation,
        ]);
        await localStorageManager.setSelectedConversation(replayConversation);
      },
    );

    await dialTest.step(
      'Export replay conversation with attachments',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(replayConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(() =>
          conversationDropdownMenu.selectMenuOption(
            MenuOptions.withAttachments,
          ),
        );
      },
    );

    await dialTest.step(
      'Remove all entities, import exported file and verify replay mode is active',
      async () => {
        await fileApiHelper.deleteAllFiles();
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await conversationAssertion.assertEntityState(
          { name: replayConversation.name },
          'visible',
        );
        await sendMessageAssertion.assertContinueReplayButtonState('visible');
      },
    );

    await dialTest.step(
      'Verify first response attachment is visible and can be downloaded',
      async () => {
        const responseMessageIndex = 2;
        dalleAttachmentPath = `${API.importFilePath(BucketUtil.getBucket(), ModelIds.DALLE)}/${Attachment.sunImageName}`;
        await chatMessages.expandChatMessageAttachment(
          responseMessageIndex,
          Attachment.sunImageName,
        );
        await chatMessagesAssertion.assertMessageAttachmentUrl(
          responseMessageIndex,
          dalleAttachmentPath,
        );
        await chatMessagesAssertion.assertMessageDownloadUrl(
          responseMessageIndex,
          dalleAttachmentPath,
        );
      },
    );

    await dialTest.step(
      'Proceed replaying and verify only last response is regenerated ',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.proceedReplaying(true);
        await chatMessagesAssertion.assertMessagesCount(
          historyConversation.messages.length,
        );
      },
    );
  },
);
