import { Conversation } from '@/chat/types/chat';
import { BackendEntity } from '@/chat/types/common';
import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  Attachment,
  ExpectedConstants,
  MenuOptions,
  PseudoModel,
} from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { BucketUtil, GeneratorUtil, ItemUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Header context menu: Export without attachments chat from Approve required section.\n' +
    'Header context menu: Export with attachments chat from Approve required section.\n' +
    'Header context menu: Compare chat from Approve required section.\n' +
    'Header context menu: Replay chat from Approve required section.\n' +
    'Header context menu: Playback chat from Approve required section.\n' +
    'Header context menu: Duplicate chat from Approve required section.\n' +
    'Header context menu: Export without attachments chat in Playback mode from Approve required section.\n' +
    'Header context menu: Export with attachments chat in Playback mode from Approve required section.\n' +
    'Header context menu: Duplicate chat in Playback mode from Approve required section',
  async ({
    conversationData,
    dataInjector,
    publishRequestBuilder,
    publicationApiHelper,
    fileApiHelper,
    adminDialHomePage,
    adminUserItemApiHelper,
    adminFileApiHelper,
    adminApproveRequiredConversations,
    adminPublishingApprovalModalAssertion,
    adminPublishingApprovalModal,
    adminChat,
    adminChatAssertion,
    adminChatMessagesAssertion,
    adminChatHeaderDropdownMenu,
    adminChatHeader,
    downloadAssertion,
    adminChatBar,
    adminToast,
    apiAssertion,
    setTestIds,
    baseAssertion,
    adminLocalStorageManager,
  }) => {
    setTestIds(
      'EPMDIAL-6034',
      'EPMDIAL-6033',
      'EPMDIAL-6030',
      'EPMDIAL-6031',
      'EPMDIAL-6032',
      'EPMDIAL-6029',
      'EPMDIAL-6037',
      'EPMDIAL-6036',
      'EPMDIAL-6035',
    );
    const randomModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels(),
    );
    let imageUrl: string;
    const imageName = GeneratorUtil.randomFilename('jpg');
    let conversation: Conversation;
    let playbackConversation: Conversation;

    const publicationName = GeneratorUtil.randomPublicationRequestName();
    const playbackPublicationName =
      GeneratorUtil.randomPublicationRequestName();
    const publications: Publication[] = [];
    let expectedTodayConversationId: string;
    let encodedExpectedTodayConversationId: string;
    let expectedPlaybackConversationId: string;
    let expectedEncodedPlaybackConversationId: string;
    let exportedData: UploadDownloadData;

    await dialAdminTest.step(
      'Prepare conversation with image in the response and playback conversation via API',
      async () => {
        imageUrl = await fileApiHelper.putFileWithCustomName(
          imageName,
          Attachment.sunImageName,
        );
        conversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageUrl,
            randomModel,
          );
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);
        await dataInjector.createConversations([
          conversation,
          playbackConversation,
        ]);
        expectedTodayConversationId = conversation.id.replace(
          BucketUtil.getBucket(),
          BucketUtil.getAdminUserBucket(),
        );
        expectedPlaybackConversationId = `${expectedTodayConversationId.substring(0, expectedTodayConversationId.lastIndexOf('/'))}/${PseudoModel.playback}${ItemUtil.entityIdSeparator}${ExpectedConstants.playbackConversation}${conversation.name}`;
        expectedEncodedPlaybackConversationId =
          expectedPlaybackConversationId.replace(
            ExpectedConstants.playbackConversation,
            ItemUtil.getEncodedItemId(ExpectedConstants.playbackConversation),
          );
      },
    );

    await dialAdminTest.step('Create publish requests via API', async () => {
      for (const [k, v] of new Map([
        [publicationName, conversation],
        [playbackPublicationName, playbackConversation],
      ])) {
        const publicationRequestModel = publishRequestBuilder
          .withName(k)
          .withConversationInFolderResource(v, PublishActions.ADD)
          .withFileResource(imageUrl, PublishActions.ADD)
          .build();
        publications.push(
          await publicationApiHelper.createPublishRequest(
            publicationRequestModel,
          ),
        );
      }
      await adminLocalStorageManager.setShowSideBarPanels();
    });

    await dialAdminTest.step(
      'Open publication request and verify conversation under review can be exported without attachments using header dots menu',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          publicationName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminChatHeader.dotsMenu.click();
        await adminChatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await adminDialHomePage.downloadData(
          () =>
            adminChatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
        );
        await downloadAssertion.assertJsonFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify review conversation is created as a user conversation',
      async () => {
        encodedExpectedTodayConversationId = ItemUtil.getEncodedItemId(
          expectedTodayConversationId,
        );
        await adminDialHomePage.waitForExpectedResponses(
          () =>
            adminDialHomePage.importFile(exportedData, () =>
              adminChatBar.importButton.click(),
            ),
          [
            {
              apiMethod: 'POST',
              urlPattern: encodedExpectedTodayConversationId,
            },
            {
              apiMethod: 'GET',
              urlPattern: encodedExpectedTodayConversationId,
            },
          ],
        );
        await adminToast.closeToast();

        const exportedConversation =
          await adminUserItemApiHelper.getItem<Conversation>(
            expectedTodayConversationId,
          );
        baseAssertion.assertValueIsNotUndefined(exportedConversation);

        const expectedReviewImage = exportedConversation.messages
          .find((m) => m.role === 'assistant')
          ?.custom_content?.attachments?.find(
            (a) =>
              a.url ===
              publications[0].resources.find((r) => r.sourceUrl === imageUrl)
                ?.reviewUrl,
          );
        baseAssertion.assertValueIsNotUndefined(expectedReviewImage);
      },
    );

    await dialAdminTest.step(
      'Verify conversation under review can be exported with attachments using header dots menu',
      async () => {
        await adminUserItemApiHelper.deleteEntity(expectedTodayConversationId);
        await adminApproveRequiredConversations.selectFolderEntity(
          publicationName,
          conversation.name,
        );
        await adminApproveRequiredConversations
          .getSelectedFolderEntity(publicationName, conversation.name)
          .waitFor();
        await adminChatHeader.dotsMenu.click();
        await adminChatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await adminDialHomePage.downloadData(
          () =>
            adminChatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withAttachments,
            ),
          GeneratorUtil.exportedWithAttachmentsFilename(),
        );
        await downloadAssertion.assertPlainFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify review conversation with attachment is created as a user conversation',
      async () => {
        await adminDialHomePage.waitForExpectedResponses(
          () =>
            adminDialHomePage.importFile(exportedData, () =>
              adminChatBar.importButton.click(),
            ),
          [
            {
              apiMethod: 'POST',
              urlPattern: encodedExpectedTodayConversationId,
            },
            {
              apiMethod: 'POST',
              urlPattern: imageName,
            },
            {
              apiMethod: 'GET',
              urlPattern: encodedExpectedTodayConversationId,
            },
          ],
        );
        await adminToast.closeToast();

        const exportedConversation = await adminUserItemApiHelper.getItem(
          expectedTodayConversationId,
        );
        baseAssertion.assertValueIsNotUndefined(exportedConversation);

        const exportedFile = await adminFileApiHelper.getFile(imageName);
        baseAssertion.assertValueIsNotUndefined(exportedFile);
      },
    );

    await dialAdminTest.step(
      'Verify conversation under review can be opened in compare mode using header dots menu',
      async () => {
        await adminApproveRequiredConversations.selectFolderEntity(
          publicationName,
          conversation.name,
        );
        await adminApproveRequiredConversations
          .getSelectedFolderEntity(publicationName, conversation.name)
          .waitFor();
        await adminChatHeader.dotsMenu.click();
        await adminChatHeaderDropdownMenu.selectMenuOption(MenuOptions.compare);
        await baseAssertion.assertElementState(
          adminChat.getCompare().getConversationToCompare(),
          'visible',
        );
      },
    );

    //TODO: enable the step whe fixed https://github.com/epam/ai-dial-chat/issues/4773
    await dialAdminTest.step.skip(
      'Verify conversation under review can be created in Replay mode using header dots menu',
      async () => {
        await adminChatHeader.dotsMenu.click();
        const response = await adminChatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.replay,
          {
            triggeredHttpMethod: 'GET',
            apiHost: API.conversationsMetadataHost,
          },
        );
        const respJson = (await response?.json()) as BackendEntity;
        const replayConversationId = ExpectedConstants.replayConversationById(
          expectedTodayConversationId,
        );
        apiAssertion.assertEntityUrl(respJson, replayConversationId);
      },
    );

    //TODO: enable the step whe fixed https://github.com/epam/ai-dial-chat/issues/4773
    await dialAdminTest.step.skip(
      'Verify conversation under review can be created in Playback mode',
      async () => {
        await adminApproveRequiredConversations.selectFolderEntity(
          publicationName,
          conversation.name,
        );
        await adminApproveRequiredConversations
          .getSelectedFolderEntity(publicationName, conversation.name)
          .waitFor();
        await adminChatHeader.dotsMenu.click();
        const response = await adminChatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.playback,
          {
            triggeredHttpMethod: 'GET',
            apiHost: API.conversationsMetadataHost,
          },
        );
        const respJson = (await response?.json()) as BackendEntity;
        apiAssertion.assertEntityUrl(respJson, expectedPlaybackConversationId);

        await adminUserItemApiHelper.deleteEntity(
          expectedPlaybackConversationId,
        );
      },
    );

    await dialAdminTest.step(
      'Verify conversation under review can be duplicated using header dots menu',
      async () => {
        await adminApproveRequiredConversations.selectFolderEntity(
          publicationName,
          conversation.name,
        );
        await adminApproveRequiredConversations
          .getSelectedFolderEntity(publicationName, conversation.name)
          .waitFor();
        await adminChatHeader.dotsMenu.click();
        const response = await adminChatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.duplicate,
          { triggeredHttpMethod: 'GET' },
        );
        const respJson = (await response?.json()) as BackendEntity;
        apiAssertion.assertEntityUrl(
          respJson,
          expectedTodayConversationId.replace(
            conversation.name,
            `${conversation.name} 1`,
          ),
        );
      },
    );

    await dialAdminTest.step(
      'Open playback publication request and verify conversation under review can be exported without attachments using header dots menu',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          playbackPublicationName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModal.goToEntityReview();
        const playbackControl = adminChat.getPlaybackControl();
        await adminChatAssertion.assertElementActionabilityState(
          playbackControl.playbackNextButton,
          'disabled',
        );
        await adminChatAssertion.assertElementActionabilityState(
          playbackControl.playbackPreviousButton,
          'enabled',
        );
        await adminChatMessagesAssertion.assertMessagesCount(
          playbackConversation.playback?.messagesStack?.length ?? 0,
        );
        await adminChatHeader.dotsMenu.click();
        await adminChatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await adminDialHomePage.downloadData(
          () =>
            adminChatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
        );
        await downloadAssertion.assertJsonFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify review playback conversation is created as a user playback',
      async () => {
        await adminDialHomePage.waitForExpectedResponses(
          () =>
            adminDialHomePage.importFile(exportedData, () =>
              adminChatBar.importButton.click(),
            ),
          [
            {
              apiMethod: 'POST',
              urlPattern: expectedEncodedPlaybackConversationId,
            },
            {
              apiMethod: 'GET',
              urlPattern: expectedEncodedPlaybackConversationId,
            },
          ],
        );
        await adminToast.closeToast();

        const exportedPlaybackConversation =
          await adminUserItemApiHelper.getItem<Conversation>(
            expectedPlaybackConversationId,
          );
        baseAssertion.assertValueIsNotUndefined(exportedPlaybackConversation);

        const expectedPlaybackReviewImage =
          exportedPlaybackConversation.messages
            .find((m) => m.role === 'assistant')
            ?.custom_content?.attachments?.find(
              (a) =>
                a.url ===
                publications[1].resources.find((r) => r.sourceUrl === imageUrl)
                  ?.reviewUrl,
            );
        baseAssertion.assertValueIsNotUndefined(expectedPlaybackReviewImage);
      },
    );

    await dialAdminTest.step(
      'Verify playback conversation under review can be exported with attachments using header dots menu',
      async () => {
        await adminUserItemApiHelper.deleteEntity(
          expectedPlaybackConversationId,
        );
        await adminFileApiHelper.deleteFromAllFiles(
          imageUrl.replace(
            BucketUtil.getBucket(),
            BucketUtil.getAdminUserBucket(),
          ),
        );
        await adminApproveRequiredConversations.selectFolderEntity(
          playbackPublicationName,
          playbackConversation.name,
        );
        await adminApproveRequiredConversations
          .getSelectedFolderEntity(
            playbackPublicationName,
            playbackConversation.name,
          )
          .waitFor();
        await adminChatHeader.dotsMenu.click();
        await adminChatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await adminDialHomePage.downloadData(
          () =>
            adminChatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withAttachments,
            ),
          GeneratorUtil.exportedWithAttachmentsFilename(),
        );
        await downloadAssertion.assertPlainFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify review playback conversation with attachment is created as a user playback',
      async () => {
        await adminDialHomePage.waitForExpectedResponses(
          () =>
            adminDialHomePage.importFile(exportedData, () =>
              adminChatBar.importButton.click(),
            ),
          [
            {
              apiMethod: 'POST',
              urlPattern: expectedEncodedPlaybackConversationId,
            },
            {
              apiMethod: 'POST',
              urlPattern: imageName,
            },
            {
              apiMethod: 'GET',
              urlPattern: expectedEncodedPlaybackConversationId,
            },
          ],
        );
        await adminToast.closeToast();

        const exportedConversation = await adminUserItemApiHelper.getItem(
          expectedPlaybackConversationId,
        );
        baseAssertion.assertValueIsNotUndefined(exportedConversation);

        const exportedFile = await adminFileApiHelper.getFile(imageName);
        baseAssertion.assertValueIsNotUndefined(exportedFile);
      },
    );

    await dialAdminTest.step(
      'Verify playback conversation under review can be duplicated using header dots menu',
      async () => {
        await adminApproveRequiredConversations.selectFolderEntity(
          playbackPublicationName,
          playbackConversation.name,
        );
        await adminApproveRequiredConversations
          .getSelectedFolderEntity(
            playbackPublicationName,
            playbackConversation.name,
          )
          .waitFor();
        await adminChatHeader.dotsMenu.click();
        const response = await adminChatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.duplicate,
          { triggeredHttpMethod: 'GET' },
        );
        const respJson = (await response?.json()) as BackendEntity;
        apiAssertion.assertEntityUrl(
          respJson,
          expectedPlaybackConversationId.replace(
            playbackConversation.name,
            `${playbackConversation.name} 1`,
          ),
        );
      },
    );
  },
);
