import { BackendDataEntity } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  ExpectedConstants,
  UploadMenuOptions,
} from '@/src/testData';
import { FileModalSection } from '@/src/ui/webElements';
import { DateUtil, GeneratorUtil } from '@/src/utils';

dialTest.only(
  'Ctrl-V pastes a file into input.\n' +
  'Pasted file appears in Manage attachments in "uploads/<year-month>" folder. New folder structure.\n' +
    'The uploads folder is changed for each month in the successful message and in Manage attachments.\n' +
    `Restricted symbols in the name are changed to '_'.\n` +
    'Toast successful message appears and contains the folder name. Paste one file.\n' +
    'Pasted file appears in Manage attachments in "uploads/<year-month>" folder. The file is added into already existed folder structure.\n' +
    'File extension is changed to lower case.\n' +
    'The postfix to the file name is added automatically if to paste the file with the name already exists in the uploads folder.\n' +
    'Ctrl-V or drag&drop a file without extension',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    dialHomePage,
    setTestIds,
    sendMessageInputAttachmentsAssertions,
    toast,
    toastAssertion,
    localStorageManager,
    sendMessage,
    attachmentDropdownMenu,
    attachedAllFiles,
    attachFilesModal,
    manageAttachmentsAssertion,
    baseAssertion,
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
    );
    const appName = GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomApplicationVersion();
    const attachmentType = 'image/*';
    let appEntity: DialAIEntityModel;
    let yearMonthSubfolder: string;
    let response: BackendDataEntity | undefined;

    await dialTest.step(
      'Create a custom app with set of allowed attachment types via API',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(appVersion)
          .withInputAttachmentTypes(attachmentType)
          .build();
        await applicationApiHelper.createApplication(applicationModel);
        appEntity = {
          name: appName,
          version: appVersion,
          reference: applicationModel.reference,
        } as DialAIEntityModel;
        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
      },
    );

    await dialTest.step(
      'Copy file to the buffer, paste using keyboard and verify it appears in the send input',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });

        yearMonthSubfolder = DateUtil.getCurrentYearMonth();
        await dialHomePage.copyFileToClipboard(Attachment.fileToCopyName);
        await dialHomePage.pasteFromClipboard({
          triggeredApiResponse: {
            apiMethod: 'POST',
            urlPattern: API.fileHost(),
          },
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

        //await dialHomePage.triggerPasteFileEvent(Attachment.sunImageName);

        // const fileMetadata = await dialHomePage.getAttachmentFileMetadata(
        //   Attachment.sunImageName,
        // );
        // await fileDropArea.dragAndDropFile(fileMetadata, {
        //   implementation: dialHomePage.executeReactOnDrop,
        // });
        // await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
        //   Attachment.sunImageName,
        //   'visible',
        // );
        // await sendMessageInputAttachmentsAssertions.assertElementState(
        //   sendMessageInputAttachments.inputAttachmentLoadingIndicator(
        //     Attachment.sunImageName,
        //   ),
        //   'hidden',
        // );
        // await toastAssertion.assertToastMessage(
        //   ExpectedConstants.fileUploadedToastMessage(
        //     DateUtil.getCurrentYearMonth(),
        //   ),
        // );
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
        await attachedAllFiles.expandFolder(
          ExpectedConstants.fileUploadFolder,
          { isHttpMethodTriggered: true, httpHost: API.filesListingHost() },
        );
        await attachedAllFiles.expandFolder(yearMonthSubfolder, {
          isHttpMethodTriggered: true,
          httpHost: API.filesListingHost(),
        });
        await manageAttachmentsAssertion.assertEntityState(
          { name: Attachment.fileToCopyName },
          FileModalSection.AllFiles,
          'visible',
        );
        await attachFilesModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Paste the file with restricted chars and uppercase extension and verify they are replaced with "_"',
      async () => {
        const expectedRestrictedCharsFilename =
          ExpectedConstants.replacedRestrictedCharsName(
            Attachment.restrictedCharsFilename.toLowerCase(),
          );
        response = await dialHomePage.triggerPasteFileEvent(
          Attachment.restrictedCharsFilename,
          { pasteToElement: sendMessage.messageInput },
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
          response?.parentPath,
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
        await dialHomePage.triggerPasteFileEvent(Attachment.fileToCopyName, {
          pasteToElement: sendMessage.messageInput,
        });
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
        await dialHomePage.triggerPasteFileEvent(
          Attachment.fileWithoutExtension,
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
        await dialHomePage.triggerPasteFileEvent(Attachment.pdfName, {
          pasteToElement: sendMessage.messageInput,
          isHttpMethodTriggered: false,
        });
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.pdfName,
          'hidden',
        );
        await toastAssertion.assertToastMessage(
          ExpectedConstants.attachedFileError(Attachment.pdfName),
        );
      },
    );
  },
);
