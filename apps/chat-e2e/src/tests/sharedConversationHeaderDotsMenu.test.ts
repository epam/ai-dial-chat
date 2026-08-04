import { BackendEntity } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  Attachment,
  ExpectedConstants,
  MenuOptions,
  PseudoModel,
} from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { BucketUtil, GeneratorUtil, ItemUtil, ModelsUtil } from '@/src/utils';
import { Conversation } from '@epam/ai-dial-shared';

dialSharedWithMeTest(
  'Header context menu: Duplicate chat from Shared with me section.\n' +
    'Header context menu: Export with attachments chat from Shared with me section.\n' +
    'Header context menu: Export without attachments chat from Shared with me section.\n' +
    'Header context menu: Replay chat from Shared with me section.\n' +
    'Header context menu: Playback chat from Shared with me section.\n' +
    'Header context menu: Unshare shared chat from Shared with me section',
  async ({
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserChatBar,
    additionalShareUserToast,
    additionalUserItemApiHelper,
    additionalUserFileApiHelper,
    additionalShareUserSharedWithMeConversations,
    fileApiHelper,
    additionalShareUserChatHeader,
    conversationData,
    dataInjector,
    setTestIds,
    additionalShareUserLocalStorageManager,
    additionalShareUserChatHeaderDropdownMenu,
    additionalShareUserSharedWithMeConversationAssertion,
    additionalShareUserConfirmationDialog,
    apiAssertion,
    downloadAssertion,
    baseAssertion,
  }) => {
    setTestIds(
      'EPMDIAL-6013',
      'EPMDIAL-6016',
      'EPMDIAL-6017',
      'EPMDIAL-6019',
      'EPMDIAL-6018',
      'EPMDIAL-6014',
    );
    const randomModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels(),
    );
    const imageName = GeneratorUtil.randomFilename('jpg');
    let imageUrl: string;
    let sharedConversation: Conversation;
    let expectedShareUserConversationId: string;
    let exportedData: UploadDownloadData;

    await dialSharedWithMeTest.step(
      'Prepare conversation with image in the response via API',
      async () => {
        imageUrl = await fileApiHelper.putFileWithCustomName(
          imageName,
          Attachment.cloudImageName,
        );
        sharedConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageUrl,
            randomModel,
          );
        await dataInjector.createConversations([sharedConversation]);
      },
    );

    await dialSharedWithMeTest.step(
      'Share conversation and accept invite by another user via API',
      async () => {
        const shareByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([sharedConversation]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        await additionalShareUserLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialSharedWithMeTest.step(
      'Open shared conversation and verify it can be duplicated using header dots menu',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedWithMeConversations.selectEntity(
          sharedConversation.name,
          { isHttpMethodTriggered: true },
        );
        await additionalShareUserSharedWithMeConversations
          .selectedEntity(sharedConversation.name)
          .waitFor();
        await additionalShareUserChatHeader.dotsMenu.click();
        const response =
          await additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
            MenuOptions.duplicate,
            {
              triggeredHttpMethod: 'GET',
            },
          );
        const respJson = (await response?.json()) as BackendEntity;
        expectedShareUserConversationId = sharedConversation.id.replace(
          BucketUtil.getBucket(),
          BucketUtil.getAdditionalShareUserBucket(),
        );
        apiAssertion.assertEntityUrl(respJson, expectedShareUserConversationId);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify shared conversation can be exported with attachments using header dots menu',
      async () => {
        await additionalUserItemApiHelper.deleteEntity(
          expectedShareUserConversationId,
        );
        await additionalShareUserSharedWithMeConversations.selectEntity(
          sharedConversation.name,
        );
        await additionalShareUserSharedWithMeConversations
          .selectedEntity(sharedConversation.name)
          .waitFor();
        await additionalShareUserChatHeader.dotsMenu.click();
        await additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.export,
        );
        exportedData = await additionalShareUserDialHomePage.downloadData(
          () =>
            additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withAttachments,
            ),
          GeneratorUtil.exportedWithAttachmentsFilename(),
        );
        await downloadAssertion.assertPlainFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify shared conversation with attachments is created as a user conversation',
      async () => {
        await additionalShareUserDialHomePage.importFile(exportedData, () =>
          additionalShareUserChatBar.importButton.click(),
        );
        await additionalShareUserToast.waitForState();
        await additionalShareUserToast.closeToast();

        const exportedConversation =
          await additionalUserItemApiHelper.getItem<Conversation>(
            expectedShareUserConversationId,
          );
        baseAssertion.assertValueIsNotUndefined(exportedConversation);

        const exportedFile =
          await additionalUserFileApiHelper.getFile(imageName);
        baseAssertion.assertValueIsNotUndefined(exportedFile);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify shared conversation can be exported without attachments using header dots menu',
      async () => {
        await additionalUserItemApiHelper.deleteEntity(
          expectedShareUserConversationId,
        );
        await additionalShareUserSharedWithMeConversations.selectEntity(
          sharedConversation.name,
        );
        await additionalShareUserSharedWithMeConversations
          .selectedEntity(sharedConversation.name)
          .waitFor();
        await additionalShareUserChatHeader.dotsMenu.click();
        await additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.export,
        );
        exportedData = await additionalShareUserDialHomePage.downloadData(
          () =>
            additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
        );
        await downloadAssertion.assertJsonFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Import the file and verify shared conversation is created as a user conversation',
      async () => {
        await additionalShareUserDialHomePage.importFile(exportedData, () =>
          additionalShareUserChatBar.importButton.click(),
        );
        await additionalShareUserToast.waitForState();
        await additionalShareUserToast.closeToast();

        const exportedConversation =
          await additionalUserItemApiHelper.getItem<Conversation>(
            expectedShareUserConversationId,
          );
        baseAssertion.assertValueIsNotUndefined(exportedConversation);

        const expectedSharedImage = exportedConversation.messages
          .find((m) => m.role === 'assistant')
          ?.custom_content?.attachments?.find((a) => a.url === imageUrl);
        baseAssertion.assertValueIsNotUndefined(expectedSharedImage);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify shared conversation can be created in Replay mode using header dots menu',
      async () => {
        await additionalShareUserSharedWithMeConversations.selectEntity(
          sharedConversation.name,
        );
        await additionalShareUserSharedWithMeConversations
          .selectedEntity(sharedConversation.name)
          .waitFor();
        await additionalShareUserChatHeader.dotsMenu.click();
        const response =
          await additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
            MenuOptions.replay,
            { triggeredHttpMethod: 'GET' },
          );
        const respJson = (await response?.json()) as BackendEntity;
        const replayConversationId = ExpectedConstants.replayConversationById(
          expectedShareUserConversationId,
        );
        apiAssertion.assertEntityUrl(respJson, replayConversationId);
      },
    );

    await dialTest.step(
      'Verify the conversation can be created in Playback mode using header dots menu',
      async () => {
        await additionalShareUserSharedWithMeConversations.selectEntity(
          sharedConversation.name,
        );
        await additionalShareUserSharedWithMeConversations
          .selectedEntity(sharedConversation.name)
          .waitFor();
        await additionalShareUserChatHeader.dotsMenu.click();
        const response =
          await additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
            MenuOptions.playback,
            { triggeredHttpMethod: 'GET' },
          );
        const respJson = (await response?.json()) as BackendEntity;
        const playbackConversationId = `${expectedShareUserConversationId.substring(0, sharedConversation.id.lastIndexOf('/'))}/${PseudoModel.playback}${ItemUtil.entityIdSeparator}${ExpectedConstants.playbackConversation}${sharedConversation.name}`;
        apiAssertion.assertEntityUrl(respJson, playbackConversationId);
      },
    );

    await dialTest.step(
      'Verify shared conversation can be unshared using header dots menu',
      async () => {
        await additionalShareUserSharedWithMeConversations.selectEntity(
          sharedConversation.name,
        );
        await additionalShareUserSharedWithMeConversations
          .selectedEntity(sharedConversation.name)
          .waitFor();
        await additionalShareUserChatHeader.dotsMenu.click();
        await additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.unshare,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await additionalShareUserSharedWithMeConversationAssertion.assertEntityState(
          { name: sharedConversation.name },
          'hidden',
        );
      },
    );
  },
);
