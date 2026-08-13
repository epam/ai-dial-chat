import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  ExpectedMessages,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Attachment as AttachmentInterface } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

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
  'Save & Submit button is available if there is only attachment without text',
  async ({
    dialHomePage,
    conversationData,
    setTestIds,
    dataInjector,
    conversations,
    chatMessages,
    chat,
    attachmentDropdownMenu,
    fileManagerModal,
    page,
    localStorageManager,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-6472');
    let conversation: Conversation;

    await dialTest.step(
      'Create conversation with model that accept attachments only with text in request',
      async () => {
        conversation = conversationData.prepareDefaultConversation(
          randomModelWithImageAttachment,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
        await localStorageManager.setRecentModelsIds(
          randomModelWithImageAttachment,
        );
      },
    );

    await dialTest.step(
      'Open conversation request in edit mode, delete text and verify Save&Submit button is disabled',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await chatMessages.selectEditTextareaContent(
          conversation.messages[0].content,
        );
        await page.keyboard.press(keys.delete);
        await baseAssertion.assertElementActionabilityState(
          chatMessages.saveAndSubmit,
          'disabled',
        );
      },
    );

    await dialTest.step('Upload file from device to the request', async () => {
      await chatMessages.getChatMessageClipIcon(1).click();
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
      await fileManagerModal.getAttachButton().click();
    });

    await dialTest.step(
      'Verify Save&Submit is enabled when file is uploaded',
      async () => {
        await baseAssertion.assertElementActionabilityState(
          chatMessages.saveAndSubmit,
          'enabled',
          ExpectedMessages.buttonIsEnabled,
        );
      },
    );

    await dialTest.step(
      'Click Save&Submit button and verify attachment data is sent in the request',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        const requests = await chat.saveAndSubmitRequest();
        expect
          .soft(
            requests.completionRequest.messages[0].custom_content.attachments[0]
              .title,
            ExpectedMessages.requestCustomContentIsValid,
          )
          .toBe(Attachment.sunImageName);
      },
    );
  },
);

dialTest(
  'Attachment name looks ok if to edit message and name contains special chars.\n' +
    'Delete attachment on x while editing user message in chat history',
  async ({
    dialHomePage,
    setTestIds,
    fileApiHelper,
    chat,
    conversationData,
    dataInjector,
    conversations,
    chatMessages,
    editMessageInputAttachments,
    editMessageInputAttachmentsAssertions,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-6474', 'EPMDIAL-6482');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let imageUrl: string;
    let conversation: Conversation;

    await dialTest.step(
      'Upload file with special symbols in the name to app',
      async () => {
        imageUrl = await fileApiHelper.putFile(Attachment.specialSymbolsName);
      },
    );

    await dialTest.step(
      'Create conversation with attachment and text in the request',
      async () => {
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModelWithAttachment,
            false,
            undefined,
            imageUrl,
          );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
        await localStorageManager.setRecentModelsIds(randomModelWithAttachment);
      },
    );

    await dialTest.step(
      'Open conversation request in edit mode and verify attachment name is fully visible',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await expect
          .soft(
            editMessageInputAttachments
              .inputAttachmentName(Attachment.specialSymbolsName)
              .getElementLocator(),
            ExpectedMessages.attachmentNameIsFullyVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Verify attachment file removing from Edit message box',
      async () => {
        const removeAttachmentIcon =
          editMessageInputAttachments.removeInputAttachmentIcon(
            Attachment.specialSymbolsName,
          );
        await removeAttachmentIcon.hoverOver();
        await editMessageInputAttachmentsAssertions.assertElementColor(
          removeAttachmentIcon,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );

        await removeAttachmentIcon.click();
        await expect
          .soft(
            editMessageInputAttachments.inputAttachment(
              Attachment.specialSymbolsName,
            ),
            ExpectedMessages.fileIsNotAttached,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Set text request in Edit message box, click Save&Submit and verify only updated text is sent in the request',
      async () => {
        const updatedRequestText = 'test';
        await chatMessages.fillEditData(1, updatedRequestText);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        const requests = await chat.saveAndSubmitRequest();
        expect
          .soft(
            requests.completionRequest.messages[0].custom_content.attachments,
            ExpectedMessages.requestCustomContentIsValid,
          )
          .toHaveLength(0);
      },
    );
  },
);

dialTest(
  'Change attached files while editing user message in chat history',
  async ({
    dialHomePage,
    setTestIds,
    fileManagerModal,
    fileManagerModalGrid,
    fileApiHelper,
    attachmentDropdownMenu,
    conversationData,
    dataInjector,
    chatMessages,
    conversations,
    chat,
    localStorageManager,
    fileManagerModalGridAssertion,
    editMessageInputAttachmentsAssertions,
    editMessageInputAttachments,
  }) => {
    setTestIds('EPMDIAL-6484');
    let conversation: Conversation;
    const allAttachedFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
      Attachment.flowerImageName,
    ];
    const initAttachedFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
    ];
    const updatedAttachedFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
      Attachment.flowerImageName,
    ];
    const filesToCheck = [Attachment.flowerImageName];
    const attachmentUrls: string[] = [];

    await dialTest.step('Upload 3 files to app', async () => {
      for (const file of allAttachedFiles) {
        attachmentUrls.push(await fileApiHelper.putFile(file));
      }
    });

    await dialTest.step(
      'Create conversation with 2 attachments in request',
      async () => {
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModelWithImageAttachment,
            false,
            undefined,
            ...attachmentUrls.slice(0, 2),
          );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
        await localStorageManager.setRecentModelsIds(
          randomModelWithImageAttachment,
        );
      },
    );

    await dialTest.step('Open conversation request in edit mode', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.selectEntity(conversation.name);
      await chatMessages.openEditMessageMode(1);
      for (const file of initAttachedFiles) {
        await editMessageInputAttachmentsAssertions.assertAttachedFileState(
          file,
          'visible',
        );
      }

      await chatMessages.getChatMessageClipIcon(1).click();
      await attachmentDropdownMenu.selectMenuOption(
        UploadMenuOptions.attachUploadedFiles,
        { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
      );
    });

    await dialTest.step(
      'In "Attach files" modal change attached files and verify updated files are displayed in Edit message box',
      async () => {
        for (const file of filesToCheck) {
          const attachmentCheckbox =
            await fileManagerModalGrid.gridCheckboxByNameCell(file);
          await attachmentCheckbox.click();
          await fileManagerModalGridAssertion.assertGridCheckboxByNameState(
            file,
            CheckboxState.checked,
          );
        }
        await fileManagerModal.getAttachButton().click();
        for (const file of updatedAttachedFiles) {
          await editMessageInputAttachmentsAssertions.assertAttachedFileState(
            file,
            'visible',
          );
        }
        await editMessageInputAttachmentsAssertions.assertElementsCount(
          editMessageInputAttachments.inputAttachments,
          updatedAttachedFiles.length,
        );
      },
    );

    await dialTest.step(
      'Save&Submit request and verify updated files are sent in the request',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        const requests = await chat.saveAndSubmitRequest();
        expect
          .soft(
            requests.completionRequest.messages[0].custom_content.attachments,
            ExpectedMessages.attachedFilesCountIsValid,
          )
          .toHaveLength(updatedAttachedFiles.length);
        for (const file of updatedAttachedFiles) {
          expect
            .soft(
              requests.completionRequest.messages[0].custom_content.attachments.find(
                (a: AttachmentInterface) => a.title === file,
              ),
              ExpectedMessages.requestCustomContentIsValid,
            )
            .toBeDefined();
        }
      },
    );
  },
);

dialTest(
  'Attachments are not grouped in user-message if there are 3 of them.\n' +
    'Attachments are grouped in user-message if there are 4 of them',
  async ({
    dialHomePage,
    setTestIds,
    fileApiHelper,
    conversationData,
    dataInjector,
    chatMessages,
    conversations,
    chatMessagesAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-6489', 'EPMDIAL-6490');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let conversation: Conversation;
    const allAttachedFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
      Attachment.flowerImageName,
      Attachment.longImageName,
    ];
    const attachmentUrls: string[] = [];

    await dialTest.step('Upload 4 files to app', async () => {
      for (const file of allAttachedFiles) {
        attachmentUrls.push(await fileApiHelper.putFile(file));
      }
    });

    await dialTest.step(
      'Create conversation with 3 attachments in request',
      async () => {
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModelWithAttachment,
            false,
            undefined,
            ...attachmentUrls.slice(0, 3),
          );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open conversation and verify attachments are separated from each other',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        for (const file of allAttachedFiles.slice(0, 3)) {
          await chatMessagesAssertion.assertElementState(
            chatMessages.getChatMessageAttachmentTitle(1, file),
            'visible',
            ExpectedMessages.attachmentIsVisible,
          );
        }
      },
    );

    await dialTest.step(
      'Add one more attachment to conversation request and verify attachments are grouped',
      async () => {
        const additionalAttachment = conversationData.getAttachmentData(
          attachmentUrls[attachmentUrls.length - 1],
        );
        conversation.messages[0].custom_content!.attachments!.push(
          additionalAttachment,
        );
        await dataInjector.updateConversations([conversation]);
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await expect
          .soft(
            chatMessages.getChatMessageAttachmentsGroup(1),
            ExpectedMessages.attachmentsAreGrouped,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Expand attachments group and verify attachments are displayed',
      async () => {
        await chatMessages.getChatMessageAttachmentsGroup(1).click();
        for (const file of allAttachedFiles) {
          await chatMessagesAssertion.assertElementState(
            chatMessages.getChatMessageAttachmentTitle(1, file),
            'visible',
            ExpectedMessages.attachmentIsVisible,
          );
        }
      },
    );

    await dialTest.step(
      'Collapse attachments group and verify attachments are hidden',
      async () => {
        await chatMessages.getChatMessageAttachmentsGroup(1).click();
        for (const file of allAttachedFiles) {
          await chatMessagesAssertion.assertElementState(
            chatMessages.getChatMessageAttachmentTitle(1, file),
            'hidden',
            ExpectedMessages.attachmentIsVisible,
          );
        }
      },
    );
  },
);
