import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  UploadMenuOptions,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let modelsWithAttachments: DialAIEntityModel[];
dialTest.beforeAll(async () => {
  modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment();
});

dialTest(
  'Clip icon in message box exists if chat is based on model which does work with attachments.\n' +
    'Chat is named automatically to the 1st attached document name if to send an attachment without a text.\n' +
    'Send button is available if to send an attachment without a text',
  async ({
    dialHomePage,
    talkToSelector,
    setTestIds,
    attachFilesModal,
    sendMessage,
    conversations,
    chatHeader,
    fileApiHelper,
    sendMessageAttachmentDropdownMenu,
  }) => {
    setTestIds('EPMRTC-1891', 'EPMRTC-1639', 'EPMRTC-1536');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    const attachedFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
    ].sort();

    await dialTest.step('Upload files to app', async () => {
      for (const file of attachedFiles) {
        await fileApiHelper.putFile(file);
      }
    });

    await dialTest.step(
      'Create new conversation based on model with input attachments and verify clip icon is available in message textarea',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectModel(randomModelWithAttachment);
        await expect
          .soft(
            await sendMessage.attachmentMenuTrigger.getElementLocator(),
            ExpectedMessages.clipIconIsAvailable,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Upload 2 files and verify Send button is enabled',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await sendMessageAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        for (const file of attachedFiles) {
          await attachFilesModal.checkAttachedFile(file);
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
            await conversations.getConversationByName(attachedFiles[0]),
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
    setTestIds,
    attachFilesModal,
    sendMessage,
    conversations,
    chatHeader,
    fileApiHelper,
    sendMessageAttachmentDropdownMenu,
    chat,
  }) => {
    setTestIds('EPMRTC-1640');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    const request = 'Describe the picture';

    await dialTest.step('Upload file to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
    });

    await dialTest.step(
      'Create new conversation based on model with input attachments and set request text',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectModel(randomModelWithAttachment);
        await sendMessage.attachmentMenuTrigger.click();
        await sendMessageAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await attachFilesModal.checkAttachedFile(Attachment.sunImageName);
        await attachFilesModal.attachFiles();
      },
    );

    await dialTest.step(
      'Set request in textarea and verify conversation is named with request text ',
      async () => {
        await chat.sendRequestWithKeyboard(request, false);
        await expect
          .soft(
            await conversations.getConversationByName(request),
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
    setTestIds,
    sendMessage,
    tooltip,
    uploadFromDeviceModal,
    sendMessageAttachmentDropdownMenu,
    sendMessageInputAttachments,
  }) => {
    setTestIds('EPMRTC-1767', 'EPMRTC-1904');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );

    await dialTest.step(
      'Create new conversation based on model with input attachments and upload attachment from device',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectModel(randomModelWithAttachment);
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            sendMessageAttachmentDropdownMenu.selectMenuOption(
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
            await sendMessageInputAttachments.inputAttachmentLoadingIndicator(
              Attachment.sunImageName,
            ),
            ExpectedMessages.attachmentLoadingIndicatorNotVisible,
          )
          .toBeVisible();
      },
    );
  },
);
