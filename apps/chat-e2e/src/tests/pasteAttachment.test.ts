import { BackendDataEntity } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  ConversationData,
  ExpectedConstants,
  ImportResolutionOption,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { DateUtil } from '@/src/utils';
import { Conversation } from '@epam/ai-dial-shared';

let appEntity: DialAIEntityModel;
let conversation: Conversation;

dialTest(
  'Ctrl-V pastes a file into input.\n' +
    'Pasted file appears in Manage attachments in "uploads/<year-month>" folder. New folder structure.\n' +
    'The uploads folder is changed for each month in the successful message and in Manage attachments.\n' +
    `Restricted symbols in the name are changed to '_'.\n` +
    'Toast successful message appears and contains the folder name. Paste one file.\n' +
    'Pasted file appears in Manage attachments in "uploads/<year-month>" folder. The file is added into already existed folder structure.\n' +
    'File extension is changed to lower case.\n' +
    'The postfix to the file name is added automatically if to paste the file with the name already exists in the uploads folder.\n' +
    'Ctrl-V or drag&drop a file without extension.\n' +
    'Toast Error appears if to attach txt file when image is available only.\n' +
    'Ctrl-V pastes 10 files into input.\n' +
    'Ctrl-V pastes a file into user-message in edit mode. Successful message',
  async ({
    dialHomePage,
    setTestIds,
    sendMessageInputAttachmentsAssertions,
    toast,
    toastAssertion,
    localStorageManager,
    sendMessage,
    attachmentDropdownMenu,
    fileManagerModal,
    fileManagerModalCollapsibleSidebar,
    fileManagerModalFoldersTree,
    fileManagerGridAssertion,
    baseAssertion,
    conversationData,
    dataInjector,
    conversations,
    chatMessages,
    editMessageInputAttachmentsAssertions,
    customApplicationPublishingUtil,
    replaceConfirmationModal,
  }) => {
    setTestIds(
      'EPMDIAL-6822',
      'EPMDIAL-6804',
      'EPMDIAL-6808',
      'EPMDIAL-6813',
      'EPMDIAL-6806',
      'EPMDIAL-6805',
      'EPMDIAL-6812',
      'EPMDIAL-6818',
      'EPMDIAL-6809',
      'EPMDIAL-6810',
      'EPMDIAL-6824',
      'EPMDIAL-6847',
    );
    const yearMonthSubfolder = DateUtil.getCurrentYearMonth();
    let responses: BackendDataEntity[] | undefined;

    await dialTest.step(
      'Create a custom app with set of allowed attachment types via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp({
          inputAttachmentTypes: [Attachment.imageTypesExtension],
        });
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;
      },
    );

    await dialTest.step(
      'Create a conversation with custom app via API',
      async () => {
        await createConversation(conversationData, dataInjector);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Copy file to the buffer, paste using keyboard and verify it appears in the send input',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.copyImageContentToClipboard(
          Attachment.fileToCopyName,
        );
        await dialHomePage.pasteFromClipboard({
          triggeredApiResponses: [
            {
              apiMethod: 'POST',
              urlPattern: API.fileHost(),
            },
          ],
        });
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.fileToCopyName,
          'visible',
        );
        await toastAssertion.assertToastMessage(
          ExpectedConstants.fileUploadedToastMessage(yearMonthSubfolder),
        );
        await toast.closeToast();
        await toast.waitForState({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Open "Manage attachments" modal and verify pasted file is placed inside "uploads" folder',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        await fileManagerModalCollapsibleSidebar.expandIfCollapsed();
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: true },
          ExpectedConstants.fileUploadFolder,
        );
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: false },
          yearMonthSubfolder,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.fileToCopyName,
          'visible',
        );
        await fileManagerModal.getCloseButton().click();
      },
    );

    await dialTest.step(
      'Paste the file with restricted chars and uppercase extension and verify they are replaced with "_"',
      async () => {
        const expectedRestrictedCharsFilename =
          ExpectedConstants.replacedRestrictedCharsName(
            Attachment.restrictedCharsFilename.toLowerCase(),
          );
        responses = await dialHomePage.triggerPasteFilesEvent(
          [Attachment.restrictedCharsFilename],
          { pasteToElement: sendMessage.messageInput },
        );
        baseAssertion.assertValue(
          responses[0].name,
          expectedRestrictedCharsFilename,
        );
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          expectedRestrictedCharsFilename,
          'visible',
        );
        await toast.closeToast();
        await toast.waitForState({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Verify file with restricted chars is placed by the same path as previous one',
      async () => {
        baseAssertion.assertValue(
          responses![0].parentPath,
          `${ExpectedConstants.fileUploadFolder}/${yearMonthSubfolder}`,
        );
      },
    );

    await dialTest.step(
      'Paste the same file again and verify it is displayed with incremented index',
      async () => {
        const expectedDuplicatedFilename = Attachment.fileToCopyName.replace(
          '.',
          ' 1.',
        );
        await dialHomePage.triggerPasteFilesEvent([Attachment.fileToCopyName], {
          pasteToElement: sendMessage.messageInput,
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementText(
          replaceConfirmationModal.title,
          ExpectedConstants.uploadDuplicateNamesModalTitle,
        );
        await baseAssertion.assertElementText(
          replaceConfirmationModal.description,
          ExpectedConstants.uploadDuplicateNamesModalDescription,
        );
        await replaceConfirmationModal.confirmUploadDuplicates();
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          expectedDuplicatedFilename,
          'visible',
        );
        await toast.closeToast();
        await toast.waitForState({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Paste the file without extension and verify it is displayed in the input field',
      async () => {
        await dialHomePage.triggerPasteFilesEvent(
          [Attachment.fileWithoutExtension],
          {
            pasteToElement: sendMessage.messageInput,
          },
        );
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.fileWithoutExtension,
          'visible',
        );
        await toast.closeToast();
        await toast.waitForState({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Paste the file with not allowed extension and verify error toast is shown',
      async () => {
        await dialHomePage.triggerPasteFilesEvent([Attachment.textName], {
          pasteToElement: sendMessage.messageInput,
          isHttpMethodTriggered: false,
        });
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.textName,
          'hidden',
        );
        await toastAssertion.assertToastMessage(
          ExpectedConstants.attachedFileError(Attachment.textName),
        );
        await toast.closeToast();
        await toast.waitForState({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Paste several files at once and verify they are displayed in the input field',
      async () => {
        const filesToPaste = [
          Attachment.cloudImageName,
          Attachment.sunImageName,
          Attachment.heartImageName,
        ];
        await dialHomePage.triggerPasteFilesEvent(filesToPaste, {
          pasteToElement: sendMessage.messageInput,
          isHttpMethodTriggered: false,
        });
        for (const fileToPaste of filesToPaste) {
          await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
            fileToPaste,
            'visible',
          );
        }
        await toast.closeToast();
        await toast.waitForState({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Select created conversation, open the first message in edit mode, paste the file and verify it is displayed in the field',
      async () => {
        await conversations.selectEntity(conversation.name);
        await chatMessages.openEditMessageMode(1);
        responses = await dialHomePage.triggerPasteFilesEvent(
          [Attachment.flowerImageName],
          { pasteToElement: chatMessages.getChatMessageTextarea(1) },
        );
        await editMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.flowerImageName,
          'visible',
        );
        await toastAssertion.assertToastMessage(
          ExpectedConstants.fileUploadedToastMessage(yearMonthSubfolder),
        );
        baseAssertion.assertValue(
          responses![0].parentPath,
          `${ExpectedConstants.fileUploadFolder}/${yearMonthSubfolder}`,
        );
      },
    );
  },
);

dialTest(
  `Ctrl-V does nothing if to paste a file into input when agent doesn't work with attachments.\n` +
    `Ctrl-V does nothing if to paste a file into user-message in edit mode when agent doesn't work with attachments`,
  async ({
    dialHomePage,
    setTestIds,
    sendMessageInputAttachmentsAssertions,
    sendMessageAssertion,
    toastAssertion,
    localStorageManager,
    conversationData,
    dataInjector,
    conversations,
    chatMessages,
    editMessageInputAttachmentsAssertions,
    customApplicationPublishingUtil,
  }) => {
    setTestIds('EPMDIAL-6820', 'EPMDIAL-6846');

    await dialTest.step(
      'Create a custom app without allowed attachments via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp();
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;
      },
    );

    await dialTest.step(
      'Create a conversation with custom app via API',
      async () => {
        await createConversation(conversationData, dataInjector);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Copy any file to the buffer, paste using keyboard and verify nothing happens',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.copyImageContentToClipboard(
          Attachment.fileToCopyName,
        );
        await dialHomePage.pasteFromClipboard();
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.fileToCopyName,
          'hidden',
        );
        await sendMessageAssertion.assertMessageValue('');
        await toastAssertion.assertToastIsHidden();
      },
    );

    await dialTest.step(
      'Select created conversation, open the first message in edit mode, paste the file and verify nothing happens',
      async () => {
        await conversations.selectEntity(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await dialHomePage.triggerPasteFilesEvent(
          [Attachment.flowerImageName],
          {
            pasteToElement: chatMessages.getChatMessageTextarea(1),
            isHttpMethodTriggered: false,
          },
        );
        await editMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.flowerImageName,
          'hidden',
        );
        await toastAssertion.assertToastIsHidden();
      },
    );
  },
);

dialTest(
  `Input field. Just Pasted file doesn't appear in Attach files if user deletes it on 'x', sent into chat stays`,
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    customApplicationPublishingUtil,
    fileApiHelper,
    sendMessage,
    sendMessageInputAttachmentsAssertions,
    attachmentDropdownMenu,
    fileManagerModal,
    fileManagerModalCollapsibleSidebar,
    fileManagerModalFoldersTree,
    fileManagerModalGrid,
    fileManagerGridAssertion,
    fileManagerModalGridAssertion,
    fileDropArea,
    chat,
    toast,
  }) => {
    setTestIds('EPMDIAL-6816');
    const yearMonthSubfolder = DateUtil.getCurrentYearMonth();
    const uploadFolderPath = `${ExpectedConstants.fileUploadFolder}/${yearMonthSubfolder}`;
    const file0 = Attachment.heartImageName;
    const file1 = Attachment.sunImageName;
    const file2 = Attachment.cloudImageName;
    const file3 = Attachment.flowerImageName;

    await dialTest.step(
      `Upload File0 into "uploads/year-month" folder via API as a precondition`,
      async () => {
        await fileApiHelper.putFile(file0, { parentPath: uploadFolderPath });
      },
    );

    await dialTest.step(
      'Create a custom app with attachments support and set it as recent model via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp({
          inputAttachmentTypes: [Attachment.imageTypesExtension],
        });
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;
        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open a new chat, upload File1 from device via clip icon and send it',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData({ path: file1, dataType: 'upload' }, () =>
          attachmentDropdownMenu.selectMenuOption(
            UploadMenuOptions.uploadFromDevice,
            { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
          ),
        );
        await fileManagerModal.getAttachButton().click();
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          file1,
          'visible',
        );
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('Describe the file');
      },
    );

    await dialTest.step('Drag&Drop File2 into the input field', async () => {
      const fileMetadata =
        await dialHomePage.getAttachmentFileMetadataAndContent(file2);
      await fileDropArea.dragAndDropFiles([fileMetadata], {
        implementation: dialHomePage.executeReactOnDrop,
      });
      await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
        file2,
        'visible',
      );
      await toast.closeToast();
      await toast.waitForState({ state: 'hidden' });
    });

    await dialTest.step('Copy-paste File3 into the input field', async () => {
      await dialHomePage.triggerPasteFilesEvent([file3], {
        pasteToElement: sendMessage.messageInput,
      });
      await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
        file3,
        'visible',
      );
      await toast.closeToast();
      await toast.waitForState({ state: 'hidden' });
    });

    await dialTest.step(
      'Via clip icon attach the already uploaded File1 and the precondition File0',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        await fileManagerModalCollapsibleSidebar.expandIfCollapsed();
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: true },
          ExpectedConstants.fileUploadFolder,
        );
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: false },
          yearMonthSubfolder,
        );

        for (const file of [file0, file1]) {
          const fileRowLocator =
            await fileManagerModalGrid.goToGridRowByNameCell(file);
          await fileRowLocator.hover();
          const fileCheckboxElement =
            await fileManagerModalGrid.gridCheckboxByNameCell(file);
          await fileManagerModalGridAssertion.assertGridCheckboxByNameState(
            file,
            CheckboxState.unchecked,
          );
          await fileCheckboxElement.click();
          await fileManagerModalGridAssertion.assertGridCheckboxByNameState(
            file,
            CheckboxState.checked,
          );
        }
        await fileManagerModal.getAttachButton().click();
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          file0,
          'visible',
        );
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          file1,
          'visible',
        );
      },
    );

    await dialTest.step(
      `Click on 'x' buttons to remove all four files from the input without sending`,
      async () => {
        for (const file of [file0, file1, file2, file3]) {
          const removeIcon = sendMessage
            .getInputAttachments()
            .removeInputAttachmentIcon(file);
          await removeIcon.hoverOver();
          await removeIcon.click();
          await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
            file,
            'hidden',
          );
        }
      },
    );

    await dialTest.step(
      'Open "Attach files" > "uploads/<year-month>" folder and verify File0 and File1 still exist, File2 and File3 do not',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        await fileManagerModalCollapsibleSidebar.expandIfCollapsed();
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: true },
          ExpectedConstants.fileUploadFolder,
        );
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: false },
          yearMonthSubfolder,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          file0,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          file1,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          file2,
          'hidden',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          file3,
          'hidden',
        );
      },
    );
  },
);

dialTest(
  `Edit mode in chat history. Just Pasted file doesn't appear in Attach files if user deletes it on 'x'`,
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    customApplicationPublishingUtil,
    fileApiHelper,
    conversationData,
    dataInjector,
    conversations,
    chatMessages,
    attachmentDropdownMenu,
    fileManagerModal,
    fileManagerModalCollapsibleSidebar,
    fileManagerModalFoldersTree,
    fileManagerModalGrid,
    fileManagerGridAssertion,
    editMessageInputAttachments,
    editMessageInputAttachmentsAssertions,
  }) => {
    setTestIds('EPMDIAL-6817');
    const yearMonthSubfolder = DateUtil.getCurrentYearMonth();
    const uploadFolderPath = `${ExpectedConstants.fileUploadFolder}/${yearMonthSubfolder}`;
    const file1 = Attachment.sunImageName;
    const file2 = Attachment.cloudImageName;

    await dialTest.step(
      `Upload File1 into "uploads/year-month" folder via API as a precondition`,
      async () => {
        await fileApiHelper.putFile(file1, { parentPath: uploadFolderPath });
      },
    );

    await dialTest.step(
      'Create a custom app with attachments support and a conversation with it via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp({
          inputAttachmentTypes: [Attachment.imageTypesExtension],
        });
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;
        await createConversation(conversationData, dataInjector);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open the chat and open user prompt in edit mode',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatMessages.openEditMessageMode(1);
      },
    );

    await dialTest.step(
      'Copy-paste File2 into the edit mode input field',
      async () => {
        await dialHomePage.triggerPasteFilesEvent([file2], {
          pasteToElement: chatMessages.getChatMessageTextarea(1),
        });
        await editMessageInputAttachmentsAssertions.assertFileIsAttached(
          file2,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Via Clip icon attach the already uploaded File1',
      async () => {
        await chatMessages.getChatMessageClipIcon(1).click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        await fileManagerModalCollapsibleSidebar.expandIfCollapsed();
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: true },
          ExpectedConstants.fileUploadFolder,
        );
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: false },
          yearMonthSubfolder,
        );
        await (
          await fileManagerModalGrid.gridCheckboxByNameCell(file1)
        ).click();
        await fileManagerModal.getAttachButton().click();
        await editMessageInputAttachmentsAssertions.assertFileIsAttached(
          file1,
          'visible',
        );
      },
    );

    await dialTest.step(
      `Click on 'x' buttons to remove both files from the input without sending`,
      async () => {
        for (const file of [file1, file2]) {
          const removeIcon =
            editMessageInputAttachments.removeInputAttachmentIcon(file);
          await removeIcon.hoverOver();
          await removeIcon.click();
          await editMessageInputAttachmentsAssertions.assertFileIsAttached(
            file,
            'hidden',
          );
        }
      },
    );

    await dialTest.step(
      `Open "Attach files" > "uploads/year-month" folder and verify File1 still exists, File2 does not`,
      async () => {
        await chatMessages.getChatMessageClipIcon(1).click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        await fileManagerModalCollapsibleSidebar.expandIfCollapsed();
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: true },
          ExpectedConstants.fileUploadFolder,
        );
        await fileManagerModalFoldersTree.expandFolder(
          { isFilesListingTriggered: false },
          yearMonthSubfolder,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          file1,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          file2,
          'hidden',
        );
      },
    );
  },
);

dialTest(
  'Edit mode in chat history. The modal for duplicates appears if to paste the file with the name already exists in the uploads folder.',
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    customApplicationPublishingUtil,
    conversationData,
    dataInjector,
    conversations,
    chatMessages,
    editMessageInputAttachmentsAssertions,
    replaceConfirmationModal,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-6819');
    const file = Attachment.textName;

    await dialTest.step(
      'Create a custom app that supports attachments and a conversation with it via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp({
          inputAttachmentTypes: [Attachment.allTypesExtension],
        });
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;
        await createConversation(conversationData, dataInjector);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open the chat, open user prompt in edit mode and paste the file',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await dialHomePage.triggerPasteFilesEvent([file], {
          pasteToElement: chatMessages.getChatMessageTextarea(1),
        });
        await editMessageInputAttachmentsAssertions.assertFileIsAttached(
          file,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Paste the same file again and verify the duplicate names pop-up appears with Postfix, Replace and Ignore options',
      async () => {
        await dialHomePage.triggerPasteFilesEvent([file], {
          pasteToElement: chatMessages.getChatMessageTextarea(1),
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementText(
          replaceConfirmationModal.title,
          ExpectedConstants.uploadDuplicateNamesModalTitle,
        );
        await baseAssertion.assertElementText(
          replaceConfirmationModal.description,
          ExpectedConstants.uploadDuplicateNamesModalDescription,
        );
        await replaceConfirmationModal.getAllItemsDropdown().click();
        const dropdownMenu = replaceConfirmationModal.getDropdownMenu();
        for (const option of Object.values(ImportResolutionOption)) {
          await baseAssertion.assertElementState(
            dropdownMenu.menuOption(option),
            'visible',
          );
        }
      },
    );
  },
);

async function createConversation(
  conversationData: ConversationData,
  dataInjector: DataInjectorInterface,
) {
  conversation = conversationData.prepareDefaultConversation(appEntity);
  await dataInjector.createConversations([conversation]);
}
