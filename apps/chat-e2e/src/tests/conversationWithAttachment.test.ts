import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import {
  AttributeValues,
  Cursors,
  ThemeColorAttributes,
} from '@/src/ui/domData';
import { Button } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Locator } from '@playwright/test';

let modelsWithAttachments: DialAIEntityModel[];
let randomModelWithImageAttachment: DialAIEntityModel;
dialTest.beforeAll(async () => {
  modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment();
  randomModelWithImageAttachment = GeneratorUtil.randomArrayElement(
    modelsWithAttachments.filter(
      (m) =>
        m.inputAttachmentTypes?.length == 1 &&
        m.inputAttachmentTypes[0] === Attachment.imageTypesExtension,
    ),
  );
});

dialTest(
  'Clip icon in message box exists if chat is based on model which does work with attachments.\n' +
    '[Attach files] is opened from message box.\n' +
    '[Attach files] All available extensions are hidden under all label.\n' +
    'Chat is named automatically to the 1st attached document name if to send an attachment without a text.\n' +
    'Send button is available if to send an attachment without a text',
  async ({
    dialHomePage,
    setTestIds,
    fileManagerModal,
    sendMessage,
    sendMessageAssertion,
    baseAssertion,
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
      await localStorageManager.setRecentModelsIdsAndUseLastModel(
        randomModelWithAttachment,
      );
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Create new conversation based on model with any input attachments and verify clip icon is available in message textarea',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessageAssertion.assertElementState(
          sendMessage.attachmentMenuTrigger,
          'visible',
          ExpectedMessages.clipIconIsAvailable,
        );
      },
    );

    await dialTest.step(
      'Open "File Manager" modal and verify supported types label is "all", "Attach" button is disabled',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await baseAssertion.assertElementState(fileManagerModal, 'visible');
        baseAssertion.assertValue(
          await fileManagerModal.getHeader().getSupportedTypes(),
          Attachment.allTypesLabel,
          ExpectedMessages.supportedTypesLabelIsCorrect,
        );
        await baseAssertion.assertElementActionabilityState(
          fileManagerModal.getAttachButton(),
          'disabled',
        );
      },
    );

    //TODO: need to update when Upload popup is implemented
    // await dialTest.step(
    //   'Upload 2 files and verify Send button is enabled',
    //   async () => {
    //     for (const file of attachedFiles) {
    //       await attachFilesModal.checkAttachedFile(
    //         file,
    //         FileModalSection.AllFiles,
    //       );
    //     }
    //     await attachFilesModal.attachFiles();
    //     const isSendMessageBtnEnabled =
    //       await sendMessage.sendMessageButton.isElementEnabled();
    //     expect
    //       .soft(
    //         isSendMessageBtnEnabled,
    //         ExpectedMessages.sendMessageButtonEnabled,
    //       )
    //       .toBeTruthy();
    //   },
    // );
    //
    // await dialTest.step(
    //   'Send request and verify conversation is named by the 1st attachment in the textarea',
    //   async () => {
    //     await dialHomePage.mockChatTextResponse(
    //       MockedChatApiResponseBodies.simpleTextBody,
    //     );
    //     await sendMessage.send();
    //     await expect
    //       .soft(
    //         conversations.getEntityByName(attachedFiles[0]),
    //         ExpectedMessages.conversationIsVisible,
    //       )
    //       .toBeVisible();
    //     expect
    //       .soft(
    //         await chatHeader.chatTitle.getElementInnerContent(),
    //         ExpectedMessages.headerTitleIsValid,
    //       )
    //       .toBe(attachedFiles[0]);
    //   },
    // );
  },
);

dialTest(
  'Chat is named automatically to user text if to send it with attachment',
  async ({
    dialHomePage,
    setTestIds,
    fileManagerModal,
    fileManagerModalGrid,
    sendMessage,
    fileApiHelper,
    attachmentDropdownMenu,
    chat,
    localStorageManager,
    conversationAssertion,
    chatHeaderAssertion,
  }) => {
    setTestIds('EPMRTC-1640');
    const request = 'Describe the picture';

    await dialTest.step('Upload file to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
      await localStorageManager.setRecentModelsIdsAndUseLastModel(
        randomModelWithImageAttachment,
      );
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Create new conversation based on model with input attachments and set request text',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        const attachmentCheckbox =
          await fileManagerModalGrid.gridCheckboxByNameCell(
            Attachment.sunImageName,
          );
        await attachmentCheckbox.click();
        await fileManagerModal.getAttachButton().click();
      },
    );

    await dialTest.step(
      'Set request in textarea and verify conversation is named with request text',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithKeyboard(request);
        await conversationAssertion.assertEntityState(
          { name: request },
          'visible',
        );
        await chatHeaderAssertion.assertHeaderTitle(request);
      },
    );
  },
);

dialTest(
  'Send button is unavailable while attachment is being uploaded.\n' +
    'Blue loading bar is shown while the file is being uploaded to the message box',
  async ({
    dialHomePage,
    setTestIds,
    sendMessage,
    tooltipPortalAssertion,
    uploadFromDeviceModal,
    attachmentDropdownMenu,
    sendMessageInputAttachments,
    localStorageManager,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-1767', 'EPMRTC-1904');

    await dialTest.step(
      'Create new conversation based on model with input attachments and upload attachment from device',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithImageAttachment,
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            attachmentDropdownMenu.selectMenuOption(
              UploadMenuOptions.uploadFromDevice,
              {
                isHttpMethodTriggered: true,
                triggeredHttpMethod: 'GET',
              },
            ),
        );
        await dialHomePage.emulateSlowNetworkConditions();
        await uploadFromDeviceModal.uploadButton.click();
      },
    );

    await dialTest.step(
      'Verify loading indicator is shown under the file, send button is disabled and have tooltip on hover',
      async () => {
        await baseAssertion.assertElementState(
          sendMessageInputAttachments.inputAttachmentLoadingIndicator(
            Attachment.sunImageName,
          ),
          'visible',
        );
        await baseAssertion.assertElementActionabilityState(
          sendMessage.sendMessageButton,
          'disabled',
        );
        await sendMessage.sendMessageButton.hoverOver();
        await tooltipPortalAssertion.assertTooltipContent(
          ExpectedConstants.sendMessageAttachmentLoadingTooltip,
        );
      },
    );
  },
);

dialTest(
  'Long attachment name is cut with three dots at the end in message box.\n' +
    'Attachment name is shown fully if to click on it. Text attachment.\n' +
    '[Manage attachments] Long file name is cut with three dots at the end.\n' +
    `Expanded button is not available when 'Image' is collapsed.\n` +
    'Attached picture is shown if to click on the button.\n' +
    'Expand and collapsed a picture at the full screen.\n' +
    'Download attached file from user message',
  async ({
    dialHomePage,
    setTestIds,
    fileManagerModal,
    fileManagerModalGrid,
    fileManagerModalGridAssertion,
    sendMessage,
    fileApiHelper,
    attachmentDropdownMenu,
    chat,
    chatMessages,
    chatMessagesAssertion,
    page,
    sendMessageInputAttachments,
    sendMessageInputAttachmentsAssertions,
    downloadAssertion,
    localStorageManager,
  }) => {
    setTestIds(
      'EPMRTC-1896',
      'EPMRTC-1897',
      'EPMRTC-3297',
      'EPMRTC-8414',
      'EPMRTC-1898',
      'EPMRTC-8310',
      'EPMRTC-1899',
    );
    const request = 'Describe the picture';
    const attachmentIndex = 1;
    let maximizeButton: Button;
    let minimizeButton: Button;
    let expandedAttachment: Locator;
    let attachmentTitle: Locator;
    let downloadAttachmentIcon: Locator;

    await dialTest.step('Upload file to app', async () => {
      await fileApiHelper.putFile(Attachment.longImageName);
      await localStorageManager.setRecentModelsIdsAndUseLastModel(
        randomModelWithImageAttachment,
      );
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Create new conversation and upload attachment with long name',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
      },
    );

    await dialTest.step(
      'Check uploaded file and verify its name is truncated in "Manage attachments" modal',
      async () => {
        const attachmentCheckbox =
          await fileManagerModalGrid.gridCheckboxByNameCell(
            Attachment.longImageName,
          );
        await attachmentCheckbox.click();
        await fileManagerModalGridAssertion.assertElementTextIsTruncated(
          fileManagerModalGrid.gridNameCellValue(Attachment.longImageName),
        );
        await fileManagerModal.getAttachButton().click();
      },
    );

    await dialTest.step(
      'Verify long attachment name is truncated in Send message box',
      async () => {
        await sendMessageInputAttachmentsAssertions.assertElementTextIsTruncated(
          sendMessageInputAttachments.inputAttachmentName(
            Attachment.longImageName,
          ),
        );
      },
    );

    await dialTest.step(
      'Send request and verify long attachment name is truncated in chat history',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(request);
        await chatMessagesAssertion.assertElementTextIsTruncated(
          chatMessages.getChatMessageAttachment(
            attachmentIndex,
            Attachment.longImageName,
          ),
        );
      },
    );

    await dialTest.step(
      'Verify attachment is collapsed, no Maximize btn is available',
      async () => {
        await chatMessagesAssertion.assertElementState(
          chatMessages.getCollapsedChatMessageAttachment(attachmentIndex),
          'visible',
          ExpectedMessages.attachmentIsCollapsed,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getCollapsedAttachmentMaximizeButton(attachmentIndex),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Click on attachment name and verify full name is visible, attachment is expanded, Maximize btn is available',
      async () => {
        await page.unrouteAll();
        await chatMessages.expandChatMessageAttachment(
          attachmentIndex,
          Attachment.longImageName,
        );
        await chatMessagesAssertion.assertElementTextIsTruncated(
          chatMessages.getChatMessageAttachment(
            attachmentIndex,
            Attachment.longImageName,
          ),
        );
        expandedAttachment =
          chatMessages.getOpenedChatMessageImageAttachment(attachmentIndex);
        await chatMessagesAssertion.assertMessageImageAttachmentState(
          expandedAttachment,
          'visible',
        );
        maximizeButton =
          chatMessages.getExpandedAttachmentMaximizeButton(attachmentIndex);
        await chatMessagesAssertion.assertElementState(
          maximizeButton,
          'visible',
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getExpandedAttachmentMaximizeButtonIcon(maximizeButton),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on Maximize btn and verify attachment is opened on full screen, Minimize btn is available',
      async () => {
        await maximizeButton.click();
        await chatMessagesAssertion.assertMessageImageAttachmentState(
          expandedAttachment,
          'visible',
        );
        await chatMessagesAssertion.assertFullScreenMessageImageAttachment(
          attachmentIndex,
        );

        attachmentTitle = chatMessages.getChatMessageAttachmentTitle(
          attachmentIndex,
          Attachment.longImageName,
        );
        await chatMessagesAssertion.assertElementState(
          attachmentTitle,
          'visible',
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageAttachmentIcon(attachmentIndex),
          'visible',
        );
        await chatMessagesAssertion.assertElementClass(
          attachmentTitle,
          new RegExp(AttributeValues.textStart),
        );

        minimizeButton =
          chatMessages.getExpandedAttachmentMinimizeButton(attachmentIndex);
        await chatMessagesAssertion.assertElementState(
          minimizeButton,
          'visible',
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getExpandedAttachmentMinimizeButtonIcon(minimizeButton),
          'visible',
        );
        downloadAttachmentIcon =
          chatMessages.getDownloadAttachmentIcon(attachmentIndex);
        await chatMessagesAssertion.assertElementState(
          downloadAttachmentIcon,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on Minimize btn and verify attachment is opened within chat and stays expanded',
      async () => {
        await minimizeButton.click();
        await chatMessagesAssertion.assertMessageImageAttachmentState(
          expandedAttachment,
          'visible',
        );
        await chatMessagesAssertion.assertElementClass(
          expandedAttachment,
          new RegExp(AttributeValues.aspectAuto),
        );
        await chatMessagesAssertion.assertElementState(
          maximizeButton,
          'visible',
        );
        await chatMessagesAssertion.assertElementState(
          minimizeButton,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Click on attachment name again and verify name is truncated, attachment is collapsed',
      async () => {
        await chatMessages.collapseChatMessageAttachment(
          attachmentIndex,
          Attachment.longImageName,
        );
        await chatMessagesAssertion.assertElementTextIsTruncated(
          chatMessages.getChatMessageAttachment(
            attachmentIndex,
            Attachment.longImageName,
          ),
        );
        await chatMessagesAssertion.assertMessageImageAttachmentState(
          expandedAttachment,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Click on download attachment button and verify it is successfully downloaded',
      async () => {
        const downloadedData = await dialHomePage.downloadData(() =>
          downloadAttachmentIcon.click(),
        );
        await downloadAssertion.assertJpgFileIsDownloaded(
          downloadedData,
          Attachment.longImageName,
        );
      },
    );
  },
);

dialTest(
  'Error icon and red file name appear because of Network error while file is being uploaded',
  async ({
    dialHomePage,
    setTestIds,
    sendMessage,
    uploadFromDeviceModal,
    attachmentDropdownMenu,
    sendMessageInputAttachments,
    context,
    localStorageManager,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-1905');

    await dialTest.step(
      'Create new conversation based on model with input attachments and upload attachment from device in offline mode',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithImageAttachment,
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            attachmentDropdownMenu.selectMenuOption(
              UploadMenuOptions.uploadFromDevice,
              {
                isHttpMethodTriggered: true,
                triggeredHttpMethod: 'GET',
              },
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
            await sendMessageInputAttachments.retryLoading(
              Attachment.sunImageName,
            );
          }
          await baseAssertion.assertElementColor(
            sendMessageInputAttachments.inputAttachmentName(
              Attachment.sunImageName,
            ),
            ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
          );
          await baseAssertion.assertElementState(
            sendMessageInputAttachments.inputAttachmentErrorIcon(
              Attachment.sunImageName,
            ),
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Click on Retry icon in online mode and verify attachment is uploaded',
      async () => {
        await context.setOffline(false);
        await sendMessageInputAttachments.retryLoading(
          Attachment.sunImageName,
          { isHttpMethodTriggered: true },
        );
        await baseAssertion.assertElementColor(
          sendMessageInputAttachments.inputAttachmentName(
            Attachment.sunImageName,
          ),
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textPrimary),
        );
        await baseAssertion.assertElementState(
          sendMessageInputAttachments.inputAttachmentErrorIcon(
            Attachment.sunImageName,
          ),
          'hidden',
        );
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
    fileManagerModal,
    fileManagerModalGrid,
    fileManagerModalGridAssertion,
    sendMessage,
    conversationData,
    dataInjector,
    fileApiHelper,
    attachmentDropdownMenu,
    conversations,
    localStorageManager,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-3118', 'EPMRTC-3283');
    let conversation: Conversation;

    await dialTest.step('Upload txt file to app', async () => {
      await fileApiHelper.putFile(Attachment.textName);
    });

    await dialTest.step(
      'Create new conversation based on model with image input attachment',
      async () => {
        conversation = conversationData.prepareEmptyConversation(
          randomModelWithImageAttachment,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithImageAttachment,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open "Manage attachments" modal and verify supported types label is "images"',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        baseAssertion.assertValue(
          await fileManagerModal.getHeader().getSupportedTypes(),
          Attachment.imagesTypesLabel,
          ExpectedMessages.supportedTypesLabelIsCorrect,
        );
      },
    );

    await dialTest.step(
      'Hover over txt file and verify not allowed cursor is shown, checkbox is disabled, dots menu is hidden',
      async () => {
        const attachmentLocator =
          await fileManagerModalGrid.goToGridRowByNameCell(Attachment.textName);
        await attachmentLocator.hover();
        await fileManagerModalGridAssertion.assertElementCursor(
          fileManagerModalGrid.gridNameCellValue(Attachment.textName),
          Cursors.notAllowed,
        );
        await fileManagerModalGridAssertion.assertGridCheckboxByNameActionabilityState(
          Attachment.textName,
          'disabled',
        );
        // hover is cancelled here by the inner call of goTop()
        const dotsMenu = await fileManagerModalGrid.gridDotsMenuByNameCell(
          Attachment.textName,
        );
        await attachmentLocator.hover();
        await fileManagerModalGridAssertion.assertElementState(
          dotsMenu,
          'hidden',
        );
        await fileManagerModalGridAssertion.assertElementActionabilityState(
          fileManagerModalGrid.gridHeaderCheckbox.checkboxInput,
          'disabled',
        );
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
    fileManagerModal,
    sendMessage,
    conversationData,
    dataInjector,
    fileApiHelper,
    fileManagerModalGrid,
    attachmentDropdownMenu,
    fileManagerModalGridAssertion,
    chatMessages,
    conversations,
    localStorageManager,
    baseAssertion,
    sendMessageInputAttachments,
    sendMessageAssertion,
  }) => {
    setTestIds('EPMRTC-3243', 'EPMRTC-3127');

    const randomModelWithoutFolderLinkAttachments =
      GeneratorUtil.randomArrayElement(
        modelsWithAttachments.filter(
          (m) =>
            m.features?.folderAttachments == false &&
            m.features.urlAttachments == false &&
            m.inputAttachmentTypes?.length == 1 &&
            m.inputAttachmentTypes[0] === Attachment.imageTypesExtension,
        ),
      );
    const folderName = GeneratorUtil.randomString(7);
    let conversation: Conversation;

    await dialTest.step('Upload file to folder', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName, {
        parentPath: folderName,
      });
    });

    await dialTest.step(
      'Create new conversation based on model without folder/link attachments',
      async () => {
        conversation = conversationData.prepareDefaultConversation(
          randomModelWithoutFolderLinkAttachments,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithoutFolderLinkAttachments,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Edit conversation request, click on clip icon and verify no "Attach link", "Attach folders" options are available in the menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await chatMessages.getChatMessageClipIcon(1).click();
        await baseAssertion.assertElementDoesNotContainText(
          attachmentDropdownMenu,
          [MenuOptions.attachFolders, MenuOptions.attachLink],
          ExpectedMessages.contextMenuOptionsValid,
        );
      },
    );

    await dialTest.step(
      'Click on request input clip icon and verify no "Attach link", "Attach folders" options are available in the menu',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await baseAssertion.assertElementDoesNotContainText(
          attachmentDropdownMenu,
          [MenuOptions.attachFolders, MenuOptions.attachLink],
          ExpectedMessages.contextMenuOptionsValid,
        );
      },
    );

    //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/6109
    await dialTest.step.skip(
      'Open "Attach files" modal from request input and verify folder content can be checked',
      async () => {
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        const folderRowLocator =
          await fileManagerModalGrid.goToGridRowByNameCell(folderName);
        await folderRowLocator.hover();
        const folderCheckboxElement =
          await fileManagerModalGrid.gridCheckboxByNameCell(folderName);
        await fileManagerModalGridAssertion.assertGridCheckboxByNameState(
          folderName,
          CheckboxState.unchecked,
        );
        await folderCheckboxElement.click();
        await fileManagerModalGridAssertion.assertGridCheckboxByNameState(
          folderName,
          CheckboxState.checked,
        );
        await baseAssertion.assertElementActionabilityState(
          fileManagerModal.getAttachButton(),
          'enabled',
        );
        await fileManagerModal.getAttachButton().click();
        await sendMessageAssertion.assertElementState(
          sendMessageInputAttachments.inputAttachmentName(
            Attachment.sunImageName,
          ),
          'visible',
        );
        await sendMessageAssertion.assertElementState(
          sendMessageInputAttachments.inputAttachedFolder(folderName),
          'hidden',
        );
      },
    );
  },
);
