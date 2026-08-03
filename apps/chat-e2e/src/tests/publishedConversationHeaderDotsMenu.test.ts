import { Conversation } from '@/chat/types/chat';
import { BackendEntity } from '@/chat/types/common';
import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
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
  'Header context menu: Export without attachments chat from Organization section.\n' +
    'Header context menu: Export with attachments chat from Organization section.\n' +
    'Header context menu: Compare chat from Organization section.\n' +
    'Header context menu: Replay chat from Organization section.\n' +
    'Header context menu: Playback chat from Organization section.\n' +
    'Header context menu: Duplicate chat from Organization section.\n' +
    'Header context menu: Export without attachments chat in Playback mode from Organization section.\n' +
    'Header context menu: Export with attachments chat in Playback mode from Organization section.\n' +
    'Header context menu: Duplicate chat in Playback mode from Organization section',
  async ({
    conversationData,
    adminDataInjector,
    publishRequestBuilder,
    adminPublicationApiHelper,
    fileApiHelper,
    dialHomePage,
    adminUserItemApiHelper,
    adminFileApiHelper,
    organizationConversations,
    playbackControl,
    itemApiHelper,
    chatHeaderDropdownMenu,
    chatHeader,
    downloadAssertion,
    chatBar,
    toast,
    conversationToCompareAssertion,
    apiAssertion,
    setTestIds,
    baseAssertion,
    localStorageManager,
  }) => {
    setTestIds(
      'EPMDIAL-6025',
      'EPMDIAL-6024',
      'EPMDIAL-6021',
      'EPMDIAL-6022',
      'EPMDIAL-6023',
      'EPMDIAL-6020',
      'EPMDIAL-6028',
      'EPMDIAL-6027',
      'EPMDIAL-6026',
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
    let expectedPlaybackConversationId: string;
    let exportedData: UploadDownloadData;

    await dialAdminTest.step(
      'As admin user prepare conversation with image in the response and playback conversation via API',
      async () => {
        imageUrl = await adminFileApiHelper.putFileWithCustomName(
          imageName,
          Attachment.flowerImageName,
        );
        conversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageUrl,
            randomModel,
          );
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);
        await adminDataInjector.createConversations([
          conversation,
          playbackConversation,
        ]);
        expectedTodayConversationId = conversation.id.replace(
          BucketUtil.getAdminUserBucket(),
          BucketUtil.getBucket(),
        );
        expectedPlaybackConversationId = `${expectedTodayConversationId.substring(0, conversation.id.lastIndexOf('/'))}/${PseudoModel.playback}${ItemUtil.entityIdSeparator}${ExpectedConstants.playbackConversation}${conversation.name}`;
      },
    );

    await dialAdminTest.step('Publish conversations via API', async () => {
      for (const [k, v] of new Map([
        [publicationName, conversation],
        [playbackPublicationName, playbackConversation],
      ])) {
        const publicationRequestModel = publishRequestBuilder
          .withName(k)
          .withConversationInFolderResource(v, PublishActions.ADD)
          .withFileResource(imageUrl, PublishActions.ADD_IF_ABSENT)
          .build();
        const publicationRequest =
          await adminPublicationApiHelper.createPublishRequest(
            publicationRequestModel,
          );
        publications.push(publicationRequest);
        await adminPublicationApiHelper.approveRequest(publicationRequest);
      }
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open published conversation and verify it can be exported without attachments using header dots menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversations.selectEntity(
          conversation.name,
          {
            isHttpMethodTriggered: true,
          },
          { exactMatch: true },
        );
        await organizationConversations
          .selectedEntity(conversation.name)
          .waitFor();
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(
          () =>
            chatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
        );
        await downloadAssertion.assertJsonFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify published conversation is created as a user conversation',
      async () => {
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await toast.waitForState();
        await toast.closeToast();

        const exportedConversation = await itemApiHelper.getItem<Conversation>(
          expectedTodayConversationId,
        );
        baseAssertion.assertValueIsNotUndefined(exportedConversation);

        const expectedPublishedImage = exportedConversation.messages
          .find((m) => m.role === 'assistant')
          ?.custom_content?.attachments?.find(
            (a) =>
              a.url ===
              publications[0].resources.find((r) => r.sourceUrl === imageUrl)
                ?.targetUrl,
          );
        baseAssertion.assertValueIsNotUndefined(expectedPublishedImage);
      },
    );

    await dialTest.step(
      'Verify published conversation can be exported with attachments using header dots menu',
      async () => {
        await itemApiHelper.deleteEntity(expectedTodayConversationId);
        await organizationConversations.selectEntity(
          conversation.name,
          undefined,
          { exactMatch: true },
        );
        await organizationConversations
          .selectedEntity(conversation.name)
          .waitFor();
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(
          () =>
            chatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withAttachments,
            ),
          GeneratorUtil.exportedWithAttachmentsFilename(),
        );
        await downloadAssertion.assertPlainFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify published conversation with attachment is created as a user conversation',
      async () => {
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await toast.waitForState();
        await toast.closeToast();

        const exportedConversation = await itemApiHelper.getItem(
          expectedTodayConversationId,
        );
        baseAssertion.assertValueIsNotUndefined(exportedConversation);

        const exportedFile = await fileApiHelper.getFile(imageName);
        baseAssertion.assertValueIsNotUndefined(exportedFile);
      },
    );

    await dialTest.step(
      'Verify published conversation can be opened in compare mode using header dots menu',
      async () => {
        await organizationConversations.selectEntity(
          conversation.name,
          undefined,
          { exactMatch: true },
        );
        await organizationConversations
          .selectedEntity(conversation.name)
          .waitFor();
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.compare);
        await conversationToCompareAssertion.assertConversationToCompareState(
          'visible',
        );
      },
    );

    //TODO: enable the step whe fixed https://github.com/epam/ai-dial-chat/issues/4773
    await dialTest.step.skip(
      'Verify published conversation can be created in Replay mode using header dots menu',
      async () => {
        await chatHeader.dotsMenu.click();
        const response = await chatHeaderDropdownMenu.selectMenuOption(
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
    await dialTest.step.skip(
      'Verify published conversation can be created in Playback mode',
      async () => {
        await organizationConversations.selectEntity(
          conversation.name,
          undefined,
          { exactMatch: true },
        );
        await organizationConversations
          .selectedEntity(conversation.name)
          .waitFor();
        await chatHeader.dotsMenu.click();
        const response = await chatHeaderDropdownMenu.selectMenuOption(
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

    await dialTest.step(
      'Verify published conversation can be duplicated using header dots menu',
      async () => {
        await organizationConversations.selectEntity(
          conversation.name,
          undefined,
          { exactMatch: true },
        );
        await organizationConversations
          .selectedEntity(conversation.name)
          .waitFor();
        await chatHeader.dotsMenu.click();
        const response = await chatHeaderDropdownMenu.selectMenuOption(
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

    await dialTest.step(
      'Open published playback conversation and verify it can be exported without attachments using header dots menu',
      async () => {
        await organizationConversations.selectEntity(
          playbackConversation.name,
          { isHttpMethodTriggered: true },
        );
        await organizationConversations
          .selectedEntity(playbackConversation.name)
          .waitFor();
        for (let i = 1; i <= 2; i++) {
          await playbackControl.playbackNextButton.click();
        }
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(
          () =>
            chatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
        );
        await downloadAssertion.assertJsonFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify published playback conversation is created as a user playback',
      async () => {
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await toast.waitForState();
        await toast.closeToast();

        const exportedPlaybackConversation =
          await itemApiHelper.getItem<Conversation>(
            expectedPlaybackConversationId,
          );
        baseAssertion.assertValueIsNotUndefined(exportedPlaybackConversation);

        const expectedPlaybackPublishedImage =
          exportedPlaybackConversation.messages
            .find((m) => m.role === 'assistant')
            ?.custom_content?.attachments?.find(
              (a) =>
                a.url ===
                publications[1].resources.find((r) => r.sourceUrl === imageUrl)
                  ?.targetUrl,
            );
        baseAssertion.assertValueIsNotUndefined(expectedPlaybackPublishedImage);
      },
    );

    await dialTest.step(
      'Verify published playback conversation can be exported with attachments using header dots menu',
      async () => {
        await itemApiHelper.deleteEntity(expectedPlaybackConversationId);
        await fileApiHelper.deleteFromAllFiles(
          imageUrl.replace(
            BucketUtil.getAdminUserBucket(),
            BucketUtil.getBucket(),
          ),
        );
        await organizationConversations.selectEntity(playbackConversation.name);
        await organizationConversations
          .selectedEntity(playbackConversation.name)
          .waitFor();
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(
          () =>
            chatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withAttachments,
            ),
          GeneratorUtil.exportedWithAttachmentsFilename(),
        );
        await downloadAssertion.assertPlainFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify published playback conversation with attachment is created as a user playback',
      async () => {
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await toast.waitForState();
        await toast.closeToast();

        const exportedConversation = await itemApiHelper.getItem(
          expectedPlaybackConversationId,
        );
        baseAssertion.assertValueIsNotUndefined(exportedConversation);

        const exportedFile = await fileApiHelper.getFile(imageName);
        baseAssertion.assertValueIsNotUndefined(exportedFile);
      },
    );

    await dialAdminTest.step(
      'Verify published playback conversation can be duplicated using header dots menu',
      async () => {
        await organizationConversations.selectEntity(playbackConversation.name);
        await organizationConversations
          .selectedEntity(playbackConversation.name)
          .waitFor();
        await chatHeader.dotsMenu.click();
        const response = await chatHeaderDropdownMenu.selectMenuOption(
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
