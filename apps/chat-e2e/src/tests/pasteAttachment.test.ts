import { BackendDataEntity } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  ConversationData,
  ExpectedConstants,
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
    'Ctrl-V pastes 10 files into input' +
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
      'EPMRTC-6227',
      'EPMRTC-6226',
      'EPMRTC-6229',
      'EPMRTC-6365',
      'EPMRTC-6352',
      'EPMRTC-6228',
      'EPMRTC-6363',
      'EPMRTC-6232',
      'EPMRTC-6239',
      'EPMRTC-6230',
      'EPMRTC-6231',
      'EPMRTC-6225',
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
        await replaceConfirmationModal.waitForState({ state: 'visible' });
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
    setTestIds('EPMRTC-6222', 'EPMRTC-6224');

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

async function createConversation(
  conversationData: ConversationData,
  dataInjector: DataInjectorInterface,
) {
  conversation = conversationData.prepareDefaultConversation(appEntity);
  await dataInjector.createConversations([conversation]);
}
