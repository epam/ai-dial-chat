import { BackendEntity } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  PseudoModel,
} from '@/src/testData';
import { TestImportFormat } from '@/src/testData/conversationHistory/importConversation';
import { FileUtil, GeneratorUtil, ItemUtil, ModelsUtil } from '@/src/utils';
import { Conversation } from '@epam/ai-dial-shared';

dialTest(
  'Header context menu: Duplicate chat created by user.\n' +
    'Header context menu: Export with attachments chat created by user.\n' +
    'Header context menu: Export without attachments chat created by user.\n' +
    'Header context menu: Compare chat created by user.\n' +
    'Header context menu: Replay chat created by user.\n' +
    'Header context menu: Playback chat created by user.\n' +
    'Header context menu: Share chat created by user.\n' +
    'Header context menu: Publish chat created by user.\n' +
    'Header context menu: Rename the chat.\n' +
    'Header context menu: Move to folder chat created by user.\n' +
    'Header context menu: Delete chat created by user',
  async ({
    dialHomePage,
    conversations,
    fileApiHelper,
    chatHeader,
    conversationData,
    dataInjector,
    setTestIds,
    localStorageManager,
    chatHeaderDropdownMenu,
    selectFolderModal,
    selectFolders,
    confirmationDialog,
    conversationToCompareAssertion,
    apiAssertion,
    downloadAssertion,
    baseAssertion,
    shareModal,
    shareModalAssertion,
    publishingRequestDialog,
    publishingRequestDialogAssertion,
    renameConversationModal,
    conversationAssertion,
    renameConversationModalAssertion,
    chatBarFolderAssertion,
  }) => {
    setTestIds(
      'EPMDIAL-6002',
      'EPMDIAL-6003',
      'EPMDIAL-6004',
      'EPMDIAL-6005',
      'EPMDIAL-6006',
      'EPMDIAL-6007',
      'EPMDIAL-6009',
      'EPMDIAL-6010',
      'EPMDIAL-6012',
      'EPMDIAL-6008',
      'EPMDIAL-6011',
    );
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(),
    );
    const imageName = GeneratorUtil.randomFilename('jpg');
    let imageUrl: string;
    let conversation: Conversation;
    const updatedConversationName = GeneratorUtil.randomConversationName();

    await dialTest.step(
      'Prepare conversation with attachment via API',
      async () => {
        imageUrl = await fileApiHelper.putFileWithCustomName(
          imageName,
          Attachment.sunImageName,
        );
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModelWithAttachment,
            true,
            undefined,
            imageUrl,
          );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open created conversation and verify it can be duplicated using header dots menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await conversations.selectedEntity(conversation.name).waitFor();
        await chatHeader.dotsMenu.click();
        const response = await chatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.duplicate,
          {
            triggeredHttpMethod: 'POST',
          },
        );
        const respJson = (await response?.json()) as BackendEntity;
        apiAssertion.assertEntityUrl(respJson, `${conversation.id} 1`);
      },
    );

    await dialTest.step(
      'Verify the conversation can be exported with attachments using header dots menu',
      async () => {
        await conversations.selectEntity(conversation.name, undefined, {
          exactMatch: true,
        });
        await conversations.selectedEntity(conversation.name).waitFor();
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        const exportedData = await dialHomePage.downloadData(
          () =>
            chatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withAttachments,
            ),
          GeneratorUtil.exportedWithAttachmentsFilename(),
        );
        await downloadAssertion.assertPlainFileIsDownloaded(exportedData);

        const archive = FileUtil.readArchive(exportedData.path as string);
        const imageEntry = FileUtil.getArchiveEntry(
          archive,
          `${ExpectedConstants.exportedArchiveImageRootFolder}/${imageName}`,
        );
        baseAssertion.assertValueIsNotUndefined(
          imageEntry,
          ExpectedMessages.dataIsExported,
        );

        const conversationEntry = FileUtil.getArchiveEntry(
          archive,
          ExpectedConstants.exportedArchiveHistoryConversationPath,
        );
        const conversationJson =
          FileUtil.parseArchiveEntryJson<TestImportFormat>(conversationEntry);

        baseAssertion.assertValue(
          conversationJson.history[0].id,
          conversation.id,
        );
        const imageAttachment = conversationJson.history[0].messages.find((m) =>
          m.custom_content?.attachments?.find((a) => a.url === imageUrl),
        );
        baseAssertion.assertValueIsNotUndefined(
          imageAttachment,
          ExpectedMessages.dataIsExported,
        );
      },
    );

    await dialTest.step(
      'Verify the conversation can be exported without attachments using header dots menu',
      async () => {
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.export);
        const exportedData = await dialHomePage.downloadData(
          () =>
            chatHeaderDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithAttachmentsFilename(),
        );
        await downloadAssertion.assertJsonFileIsDownloaded(exportedData);
        const conversationJson = FileUtil.readJsonFileData(
          exportedData.path as string,
        );
        baseAssertion.assertValue(
          conversationJson.history[0].id,
          conversation.id,
        );
      },
    );

    await dialTest.step(
      'Verify the conversation can be compared using header dots menu',
      async () => {
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.compare);
        await conversationToCompareAssertion.assertConversationToCompareState(
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify the conversation can be created in Replay mode using header dots menu',
      async () => {
        await chatHeader.dotsMenu.click();
        const response = await chatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.replay,
          { triggeredHttpMethod: 'GET' },
        );
        const respJson = (await response?.json()) as BackendEntity;
        const replayConversationId = `${conversation.id.substring(0, conversation.id.lastIndexOf('/'))}/${PseudoModel.replay}${ItemUtil.entityIdSeparator}${ExpectedConstants.replayConversation}${conversation.name}`;
        apiAssertion.assertEntityUrl(respJson, replayConversationId);
      },
    );

    await dialTest.step(
      'Verify the conversation can be created in Playback mode using header dots menu',
      async () => {
        await conversations.selectEntity(conversation.name, undefined, {
          exactMatch: true,
        });
        await conversations.selectedEntity(conversation.name).waitFor();
        await chatHeader.dotsMenu.click();
        const response = await chatHeaderDropdownMenu.selectMenuOption(
          MenuOptions.playback,
          { triggeredHttpMethod: 'GET' },
        );
        const respJson = (await response?.json()) as BackendEntity;
        const playbackConversationId = `${conversation.id.substring(0, conversation.id.lastIndexOf('/'))}/${PseudoModel.playback}${ItemUtil.entityIdSeparator}${ExpectedConstants.playbackConversation}${conversation.name}`;
        apiAssertion.assertEntityUrl(respJson, playbackConversationId);
      },
    );

    await dialTest.step(
      'Verify the conversation can be shared using header dots menu',
      async () => {
        await conversations.selectEntity(conversation.name, undefined, {
          exactMatch: true,
        });
        await conversations.selectedEntity(conversation.name).waitFor();
        await chatHeader.dotsMenu.click();
        const requestResponse =
          await chatHeaderDropdownMenu.selectShareMenuOption();
        baseAssertion.assertBooleanCondition(
          requestResponse!.response.invitationLink.length > 0,
          true,
          ExpectedMessages.shareConversationLinkIsValid,
        );
        await shareModalAssertion.assertModalState('visible');
        await shareModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Verify the conversation can be published using header dots menu',
      async () => {
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishingRequestDialog.cancelButton.click();
      },
    );

    await dialTest.step(
      'Verify the conversation can be renamed using header dots menu',
      async () => {
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await renameConversationModalAssertion.assertModalIsVisible();
        await renameConversationModal.editConversationNameWithSaveButton(
          updatedConversationName,
        );
        await conversationAssertion.assertEntityState(
          { name: updatedConversationName },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify the conversation can be moved to the folder using header dots menu',
      async () => {
        await conversations.selectEntity(updatedConversationName);
        await conversations.selectedEntity(updatedConversationName).waitFor();
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.moveTo);
        await selectFolderModal.newFolderButton.click();
        await selectFolders.getEditFolderInputActions().clickTickButton();
        await selectFolderModal.clickSelectFolderButton({
          triggeredApiHost: API.conversationHost,
        });
        await chatBarFolderAssertion.assertFolderEntityState(
          { name: ExpectedConstants.newFolderWithIndexTitle(1) },
          { name: updatedConversationName },
          'visible',
        );
        await conversationAssertion.assertEntityState(
          { name: updatedConversationName },
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify the conversation can be deleted using header dots menu',
      async () => {
        await chatHeader.dotsMenu.click();
        await chatHeaderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await chatBarFolderAssertion.assertFolderEntityState(
          { name: ExpectedConstants.newFolderWithIndexTitle(1) },
          { name: updatedConversationName },
          'hidden',
        );
      },
    );
  },
);
