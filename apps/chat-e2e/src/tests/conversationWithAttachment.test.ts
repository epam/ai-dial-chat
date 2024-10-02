import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { Colors, Overflow, Styles } from '@/src/ui/domData';
import { FileModalSection } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let modelsWithAttachments: DialAIEntityModel[];
dialTest.beforeAll(async () => {
  modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment();
});

dialTest(
  'Clip icon in message box exists if chat is based on model which does work with attachments.\n' +
    '[Attach files] is opened from message box.\n' +
    '[Attach files] All available extensions are hidden under all label.\n' +
    'Chat is named automatically to the 1st attached document name if to send an attachment without a text.\n' +
    'Send button is available if to send an attachment without a text',
  async ({
    dialHomePage,
    talkToSelector,
    marketplacePage,
    setTestIds,
    attachFilesModal,
    sendMessage,
    conversations,
    chatHeader,
    fileApiHelper,
    attachmentDropdownMenu,
    localStorageManager,
  }) => {
    setTestIds(
      'EPMRTC-1891',
      'EPMRTC-1892',
      'EPMRTC-3282',
      'EPMRTC-1639',
      'EPMRTC-1536',
    );
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments.filter(
        (m) =>
          m.inputAttachmentTypes?.length == 1 &&
          m.inputAttachmentTypes[0] === Attachment.allTypesExtension,
      ),
    );
    const attachedFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
    ].sort();

    await dialTest.step('Upload files to app', async () => {
      for (const file of attachedFiles) {
        await fileApiHelper.putFile(file);
      }
      await localStorageManager.setRecentModelsIds(randomModelWithAttachment);
    });

    await dialTest.step(
      'Create new conversation based on model with any input attachments and verify clip icon is available in message textarea',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectEntity(
          randomModelWithAttachment,
          marketplacePage,
        );
        await expect
          .soft(
            sendMessage.attachmentMenuTrigger.getElementLocator(),
            ExpectedMessages.clipIconIsAvailable,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Open "Attach files" modal and verify supported types label is "all", "Attach" button is disabled,"Upload from device" button has theme background color',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await expect
          .soft(
            attachFilesModal.getElementLocator(),
            ExpectedMessages.attachFilesModalIsOpened,
          )
          .toBeVisible();
        expect
          .soft(
            await attachFilesModal.getModalHeader().getSupportedTypes(),
            ExpectedMessages.supportedTypesLabelIsCorrect,
          )
          .toBe(Attachment.allTypesLabel);
        await expect
          .soft(
            attachFilesModal.attachFilesButton.getElementLocator(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeDisabled();

        const uploadFromDeviseBtnBackgroundColor =
          await attachFilesModal.uploadFromDeviceButton.getComputedStyleProperty(
            Styles.backgroundColor,
          );
        expect
          .soft(
            uploadFromDeviseBtnBackgroundColor[0],
            ExpectedMessages.buttonBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);
      },
    );

    await dialTest.step(
      'Upload 2 files and verify Send button is enabled',
      async () => {
        for (const file of attachedFiles) {
          await attachFilesModal.checkAttachedFile(
            file,
            FileModalSection.AllFiles,
          );
        }
        await attachFilesModal.attachFiles();
        const isSendMessageBtnEnabled =
          await sendMessage.sendMessageButton.isElementEnabled();
        expect
          .soft(
            isSendMessageBtnEnabled,
            ExpectedMessages.sendMessageButtonEnabled,
          )
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Send request and verify conversation is named by the 1st attachment in the textarea',
      async () => {
        await sendMessage.send();
        await expect
          .soft(
            conversations.getEntityByName(attachedFiles[0]),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
        expect
          .soft(
            await chatHeader.chatTitle.getElementInnerContent(),
            ExpectedMessages.headerTitleIsValid,
          )
          .toBe(attachedFiles[0]);
      },
    );
  },
);

dialTest(
  'Chat is named automatically to user text if to send it with attachment',
  async ({
    dialHomePage,
    talkToSelector,
    marketplacePage,
    setTestIds,
    attachFilesModal,
    sendMessage,
    conversations,
    chatHeader,
    fileApiHelper,
    attachmentDropdownMenu,
    chat,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1640');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    const request = 'Describe the picture';

    await dialTest.step('Upload file to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
      await localStorageManager.setRecentModelsIds(randomModelWithAttachment);
    });

    await dialTest.step(
      'Create new conversation based on model with input attachments and set request text',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectEntity(
          randomModelWithAttachment,
          marketplacePage,
        );
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await attachFilesModal.checkAttachedFile(
          Attachment.sunImageName,
          FileModalSection.AllFiles,
        );
        await attachFilesModal.attachFiles();
      },
    );

    await dialTest.step(
      'Set request in textarea and verify conversation is named with request text ',
      async () => {
        await chat.sendRequestWithKeyboard(request, false);
        await expect
          .soft(
            conversations.getEntityByName(request),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
        expect
          .soft(
            await chatHeader.chatTitle.getElementInnerContent(),
            ExpectedMessages.headerTitleIsValid,
          )
          .toBe(request);
      },
    );
  },
);

dialTest(
  'Send button is unavailable while attachment is being uploaded.\n' +
    'Blue loading bar is shown while the file is being uploaded to the message box',
  async ({
    dialHomePage,
    talkToSelector,
    marketplacePage,
    setTestIds,
    sendMessage,
    tooltip,
    uploadFromDeviceModal,
    attachmentDropdownMenu,
    sendMessageInputAttachments,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1767', 'EPMRTC-1904');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );

    await dialTest.step(
      'Create new conversation based on model with input attachments and upload attachment from device',
      async () => {
        await localStorageManager.setRecentModelsIds(randomModelWithAttachment);
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectEntity(
          randomModelWithAttachment,
          marketplacePage,
        );
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            attachmentDropdownMenu.selectMenuOption(
              UploadMenuOptions.uploadFromDevice,
            ),
        );
        await dialHomePage.throttleAPIResponse('**/*');
        await uploadFromDeviceModal.uploadButton.click();
      },
    );

    await dialTest.step(
      'Verify loading indicator is shown under the file, send button is disabled and have tooltip on hover',
      async () => {
        const isSendMessageBtnEnabled =
          await sendMessage.sendMessageButton.isElementEnabled();
        expect
          .soft(
            isSendMessageBtnEnabled,
            ExpectedMessages.sendMessageButtonDisabled,
          )
          .toBeFalsy();

        await sendMessage.sendMessageButton.hoverOver();
        const tooltipContent = await tooltip.getContent();
        expect
          .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.sendMessageAttachmentLoadingTooltip);

        await expect
          .soft(
            sendMessageInputAttachments.inputAttachmentLoadingIndicator(
              Attachment.sunImageName,
            ),
            ExpectedMessages.attachmentLoadingIndicatorIsVisible,
          )
          .toBeAttached();
      },
    );
  },
);

dialTest(
  'Long attachment name is cut with three dots at the end in message box.\n' +
    'Attachment name is shown fully if to click on it. Text attachment.\n' +
    '[Manage attachments] Long file name is cut with three dots at the end.\n' +
    'Attached picture is shown if to click on the button.\n' +
    'Download attached file from user message',
  async ({
    dialHomePage,
    talkToSelector,
    marketplacePage,
    setTestIds,
    attachFilesModal,
    sendMessage,
    fileApiHelper,
    attachmentDropdownMenu,
    chat,
    chatMessages,
    page,
    sendMessageInputAttachments,
    localStorageManager,
  }) => {
    setTestIds(
      'EPMRTC-1896',
      'EPMRTC-1897',
      'EPMRTC-3297',
      'EPMRTC-1898',
      'EPMRTC-1899',
    );
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    const request = 'Describe the picture';

    await dialTest.step('Upload file to app', async () => {
      await fileApiHelper.putFile(Attachment.longImageName);
      await localStorageManager.setRecentModelsIds(randomModelWithAttachment);
    });

    await dialTest.step(
      'Create new conversation and upload attachment with long name',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectEntity(
          randomModelWithAttachment,
          marketplacePage,
        );
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
      },
    );

    await dialTest.step(
      'Check uploaded file and verify its name is truncated in Attach file modal',
      async () => {
        await attachFilesModal.checkAttachedFile(
          Attachment.longImageName,
          FileModalSection.AllFiles,
        );
        const attachmentNameOverflow = await attachFilesModal
          .getAllFilesTree()
          .getEntityName(Attachment.longImageName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(
            attachmentNameOverflow[0],
            ExpectedMessages.attachmentNameIsTruncated,
          )
          .toBe(Overflow.ellipsis);
        await attachFilesModal.attachFiles();
      },
    );

    await dialTest.step(
      'Verify long attachment name is truncated in Send message box',
      async () => {
        const attachmentNameOverflow = await sendMessageInputAttachments
          .inputAttachmentName(Attachment.longImageName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(
            attachmentNameOverflow[0],
            ExpectedMessages.attachmentNameIsTruncated,
          )
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Send request and verify long attachment name is truncated in chat history',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(request);
        const attachmentNameOverflow = await chatMessages
          .getChatMessageAttachment(1, Attachment.longImageName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(
            attachmentNameOverflow[0],
            ExpectedMessages.attachmentNameIsTruncated,
          )
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Click on attachment name and verify full name is visible, attachment is expanded',
      async () => {
        await page.unrouteAll();
        await chatMessages.expandChatMessageAttachment(
          1,
          Attachment.longImageName,
        );
        const isAttachmentNameTruncated = await chatMessages
          .getChatMessageAttachment(1, Attachment.longImageName)
          .isElementWidthTruncated();
        expect
          .soft(
            isAttachmentNameTruncated,
            ExpectedMessages.attachmentNameIsFullyVisible,
          )
          .toBeFalsy();
        await expect
          .soft(
            chatMessages.getOpenedChatMessageAttachment(1),
            ExpectedMessages.attachmentIsExpanded,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Click on attachment name again and verify name is truncated, attachment is collapsed',
      async () => {
        await chatMessages.collapseChatMessageAttachment(
          1,
          Attachment.longImageName,
        );
        const isAttachmentNameTruncated = await chatMessages
          .getChatMessageAttachment(1, Attachment.longImageName)
          .isElementWidthTruncated();
        expect
          .soft(
            isAttachmentNameTruncated,
            ExpectedMessages.attachmentNameIsTruncated,
          )
          .toBeTruthy();

        await expect
          .soft(
            chatMessages.getOpenedChatMessageAttachment(1),
            ExpectedMessages.attachmentIsCollapsed,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Click on download attachment button and verify it is successfully downloaded',
      async () => {
        const downloadedData = await dialHomePage.downloadData(() =>
          chatMessages.getDownloadAttachmentIcon(1).click(),
        );
        expect
          .soft(
            downloadedData.path,
            ExpectedMessages.attachmentIsSuccessfullyDownloaded,
          )
          .toContain(Attachment.longImageName);
      },
    );
  },
);

dialTest(
  'Error icon and red file name appear because of Network error while file is being uploaded',
  async ({
    dialHomePage,
    talkToSelector,
    marketplacePage,
    setTestIds,
    sendMessage,
    uploadFromDeviceModal,
    attachmentDropdownMenu,
    sendMessageInputAttachments,
    context,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1905');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );

    await dialTest.step(
      'Create new conversation based on model with input attachments and upload attachment from device in offline mode',
      async () => {
        await localStorageManager.setRecentModelsIds(randomModelWithAttachment);
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectEntity(
          randomModelWithAttachment,
          marketplacePage,
        );
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            attachmentDropdownMenu.selectMenuOption(
              UploadMenuOptions.uploadFromDevice,
            ),
        );
        await context.setOffline(true);
        await uploadFromDeviceModal.uploadButton.click();
      },
    );

    await dialTest.step(
      'Verify attachment name is red, error icon is displayed near attachment',
      async () => {
        for (let retryAttempt = 1; retryAttempt <= 2; retryAttempt++) {
          if (retryAttempt === 2) {
            await sendMessageInputAttachments
              .inputAttachmentLoadingRetry(Attachment.sunImageName)
              .click();
          }
          const attachmentNameColor = await sendMessageInputAttachments
            .inputAttachmentName(Attachment.sunImageName)
            .getComputedStyleProperty(Styles.color);
          expect
            .soft(
              attachmentNameColor[0],
              ExpectedMessages.attachmentNameColorIsValid,
            )
            .toBe(Colors.textError);
          await expect
            .soft(
              sendMessageInputAttachments.inputAttachmentErrorIcon(
                Attachment.sunImageName,
              ),
              ExpectedMessages.attachmentHasErrorIcon,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Click on Retry icon in online mode and verify attachment is uploaded',
      async () => {
        await context.setOffline(false);
        await sendMessageInputAttachments
          .inputAttachmentLoadingRetry(Attachment.sunImageName)
          .click();
        const attachmentNameColor = await sendMessageInputAttachments
          .inputAttachmentName(Attachment.sunImageName)
          .getComputedStyleProperty(Styles.color);
        expect
          .soft(
            attachmentNameColor[0],
            ExpectedMessages.attachmentNameColorIsValid,
          )
          .toBe(Colors.textPrimary);
        await expect
          .soft(
            sendMessageInputAttachments.inputAttachmentErrorIcon(
              Attachment.sunImageName,
            ),
            ExpectedMessages.attachmentHasErrorIcon,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  '[Attach files] Image available extensions are hidden under image label, only images are available.\n' +
    '[Attach files] Error appears if to attach txt file when image is available only',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    sendMessage,
    conversationData,
    localStorageManager,
    dataInjector,
    fileApiHelper,
    attachmentDropdownMenu,
  }) => {
    setTestIds('EPMRTC-3118', 'EPMRTC-3283');
    const randomModelWithImageAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments.filter(
        (m) =>
          m.inputAttachmentTypes?.length == 1 &&
          m.inputAttachmentTypes[0] === Attachment.imageTypesExtension,
      ),
    );

    await dialTest.step('Upload txt file to app', async () => {
      await fileApiHelper.putFile(Attachment.textName);
    });

    await dialTest.step(
      'Create new conversation based on model with image input attachment',
      async () => {
        const conversation = conversationData.prepareEmptyConversation(
          randomModelWithImageAttachment,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);
      },
    );

    await dialTest.step(
      'Open "Attach files" modal and verify supported types label is "images"',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        expect
          .soft(
            await attachFilesModal.getModalHeader().getSupportedTypes(),
            ExpectedMessages.supportedTypesLabelIsCorrect,
          )
          .toBe(Attachment.imagesTypesLabel);
      },
    );

    await dialTest.step(
      'Check txt file, click "Attach" button and verify error message is shown',
      async () => {
        await attachFilesModal.checkAttachedFile(
          Attachment.textName,
          FileModalSection.AllFiles,
        );
        await attachFilesModal.attachFilesButton.click();
        expect
          .soft(
            await attachFilesModal.getAttachedFileErrorMessage(),
            ExpectedMessages.sendMessageButtonEnabled,
          )
          .toBe(ExpectedConstants.attachedFileError(Attachment.textName));
      },
    );
  },
);

dialTest(
  `[Attach folder] Folder can not be attached for models that doesn't support it.\n` +
    `[Attach link] is not available for models that doesn't support it`,
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    sendMessage,
    conversationData,
    localStorageManager,
    dataInjector,
    fileApiHelper,
    attachmentDropdownMenu,
    attachedAllFiles,
    chatMessages,
  }) => {
    setTestIds('EPMRTC-3243', 'EPMRTC-3127');

    const randomModelWithoutFolderLinkAttachments =
      GeneratorUtil.randomArrayElement(
        modelsWithAttachments.filter(
          (m) =>
            m.features?.folderAttachments == false &&
            m.features.urlAttachments == false,
        ),
      );
    const folderName = GeneratorUtil.randomString(7);

    await dialTest.step('Upload file to folder', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName, folderName);
    });

    await dialTest.step(
      'Create new conversation based on model without folder/link attachments',
      async () => {
        const conversation = conversationData.prepareDefaultConversation(
          randomModelWithoutFolderLinkAttachments,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);
      },
    );

    await dialTest.step(
      'Edit conversation request, click on clip icon and verify no "Attach link", "Attach folders" options are available in the menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatMessages.openEditMessageMode(1);
        await chatMessages.getChatMessageClipIcon(1).click();
        const editMessageAttachMenuOptions =
          await attachmentDropdownMenu.getAllMenuOptions();
        expect
          .soft(
            editMessageAttachMenuOptions,
            ExpectedMessages.contextMenuOptionsValid,
          )
          .toEqual(
            expect.not.arrayContaining([
              MenuOptions.attachFolders,
              MenuOptions.attachLink,
            ]),
          );
      },
    );

    await dialTest.step(
      'Click on request input clip icon and verify no "Attach link", "Attach folders" options are available in the menu',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        const attachMenuOptions =
          await attachmentDropdownMenu.getAllMenuOptions();
        expect
          .soft(attachMenuOptions, ExpectedMessages.contextMenuOptionsValid)
          .toEqual(
            expect.not.arrayContaining([
              MenuOptions.attachFolders,
              MenuOptions.attachLink,
            ]),
          );
      },
    );

    await dialTest.step(
      'Open "Attach files" modal from request input and verify folder cannot be checked, "Attach" button is disabled',
      async () => {
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await attachedAllFiles.getFolderName(folderName).hoverOver();
        await expect
          .soft(
            attachedAllFiles.getFolderCheckbox(folderName),
            ExpectedMessages.folderCheckboxIsNotVisible,
          )
          .toBeHidden();
        await expect
          .soft(
            attachFilesModal.attachFilesButton.getElementLocator(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeDisabled();
      },
    );
  },
);
