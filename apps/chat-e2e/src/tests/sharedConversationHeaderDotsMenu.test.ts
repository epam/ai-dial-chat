import { BackendEntity } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  PseudoModel,
} from '@/src/testData';
import { TestImportFormat } from '@/src/testData/conversationHistory/importConversation';
import {
  BucketUtil,
  FileUtil,
  GeneratorUtil,
  ItemUtil,
  ModelsUtil,
} from '@/src/utils';
import { Conversation } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

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
      'EPMRTC-4745',
      'EPMRTC-4758',
      'EPMRTC-4759',
      'EPMRTC-4793',
      'EPMRTC-4792',
      'EPMRTC-4754',
    );
    const randomModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels(),
    );
    const imageName = `${GeneratorUtil.randomString(7)}.jpg`;
    let imageUrl: string;
    let sharedConversation: Conversation;
    let expectedShareUserConversationId: string;

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
        const exportedData = await additionalShareUserDialHomePage.downloadData(
          () =>
            additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withAttachments,
            ),
          GeneratorUtil.exportedWithAttachmentsFilename(),
        );
        await downloadAssertion.assertPlainFileIsDownloaded(exportedData);

        const archive = FileUtil.readArchive(exportedData.path);
        const imageEntry = FileUtil.getArchiveEntry(
          archive,
          `${ExpectedConstants.exportedArchiveImageRootFolder}/${imageName}`,
        );
        expect.soft(imageEntry, ExpectedMessages.dataIsExported).toBeDefined();

        const conversationEntry = FileUtil.getArchiveEntry(
          archive,
          ExpectedConstants.exportedArchiveHistoryConversationPath,
        );
        const conversationJson =
          FileUtil.parseArchiveEntryJson<TestImportFormat>(conversationEntry);

        baseAssertion.assertValue(
          conversationJson.history[0].id,
          sharedConversation.id,
        );
        const imageAttachment = conversationJson.history[0].messages.find((m) =>
          m.custom_content?.attachments?.find((a) => a.url === imageUrl),
        );
        expect
          .soft(imageAttachment, ExpectedMessages.dataIsExported)
          .toBeDefined();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify shared conversation can be exported without attachments using header dots menu',
      async () => {
        await additionalShareUserChatHeader.dotsMenu.click();
        await additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.export,
        );
        const exportedData = await additionalShareUserDialHomePage.downloadData(
          () =>
            additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithAttachmentsFilename(),
        );
        await downloadAssertion.assertJsonFileIsDownloaded(exportedData);
        const conversationJson = FileUtil.readJsonFileData(exportedData.path);
        baseAssertion.assertValue(
          conversationJson.history[0].id,
          sharedConversation.id,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Verify shared conversation can be created in Replay mode using header dots menu',
      async () => {
        await additionalShareUserChatHeader.dotsMenu.click();
        const response =
          await additionalShareUserChatHeaderDropdownMenu.selectMenuOption(
            MenuOptions.replay,
            { triggeredHttpMethod: 'GET' },
          );
        const respJson = (await response?.json()) as BackendEntity;
        const replayConversationId = `${expectedShareUserConversationId.substring(0, expectedShareUserConversationId.lastIndexOf('/'))}/${PseudoModel.replay}${ItemUtil.entityIdSeparator}${ExpectedConstants.replayConversation}${sharedConversation.name}`;
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
