import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { API, Attachment, ExpectedMessages } from '@/src/testData';
import { AttributeValues } from '@/src/ui/domData';
import { Button } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { Locator } from '@playwright/test';

dialTest(
  'Generated in response picture appears in Manage attachments.\n' +
    `Expanded button is not available when 'Image' is collapsed.\n` +
    'Expand and collapsed a picture at the full screen',
  async ({
    dialHomePage,
    fileManagerPage,
    setTestIds,
    navigationPanel,
    conversationData,
    localStorageManager,
    dataInjector,
    fileApiHelper,
    chatMessages,
    chatMessagesAssertion,
    fileManagerFoldersTree,
    fileManagerCollapsibleSidebar,
    fileManagerGridAssertion,
    chatHeader,
    chat,
    talkToAgentDialog,
    conversations,
    appContainer,
  }) => {
    setTestIds('EPMDIAL-6062', 'EPMDIAL-6063', 'EPMDIAL-6064');
    const defaultModel = ModelsUtil.getDefaultAgent()!;
    let responseImageConversation: Conversation;
    const imagePath = API.modelFilePath(defaultModel.id);
    const imagePathSegments = imagePath.split('/');
    const updatedModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels().filter((m) => m.id !== defaultModel.id),
    );
    const secondImagePath = API.modelFilePath(updatedModel.id);
    const secondImagePathSegments = secondImagePath.split('/');
    const requestContent = 'request';
    const firstAttachmentIndex = 2;
    let maximizeButton: Button;
    let minimizeButton: Button;
    let expandedAttachment: Locator;

    await dialTest.step(
      'Create conversation with attachment in the response',
      async () => {
        const responseImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          { parentPath: imagePath },
        );
        responseImageConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            responseImageUrl,
            defaultModel,
          );
        await dataInjector.createConversations([responseImageConversation]);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          updatedModel,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open "File manager" page and verify image is placed inside nested folders',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        await fileManagerCollapsibleSidebar.expandIfCollapsed();
        await fileManagerFoldersTree.expandFolders(
          { isFilesListingTriggered: true },
          ...imagePathSegments,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Go back to the chat and verify the attachment is collapsed, no Maximize btn is available',
      async () => {
        await navigationPanel.backToChat();
        await conversations.selectEntity(responseImageConversation.name);
        await appContainer.getChatLoader().waitForState({ state: 'hidden' });
        await chatMessagesAssertion.assertElementState(
          chatMessages.getCollapsedChatMessageAttachment(firstAttachmentIndex),
          'visible',
          ExpectedMessages.attachmentIsCollapsed,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getCollapsedAttachmentMaximizeButton(
            firstAttachmentIndex,
          ),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Click on attachment name and verify attachment is expanded, Maximize btn is available',
      async () => {
        await chatMessages.expandChatMessageAttachment(
          firstAttachmentIndex,
          Attachment.sunImageName,
        );
        expandedAttachment =
          chatMessages.getOpenedChatMessageImageAttachment(
            firstAttachmentIndex,
          );
        await chatMessagesAssertion.assertMessageImageAttachmentState(
          expandedAttachment,
          'visible',
        );
        maximizeButton =
          chatMessages.getExpandedAttachmentMaximizeButton(
            firstAttachmentIndex,
          );
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
          firstAttachmentIndex,
        );

        const attachmentTitle = chatMessages.getChatMessageAttachmentTitle(
          firstAttachmentIndex,
          Attachment.sunImageName,
        );
        await chatMessagesAssertion.assertElementText(
          attachmentTitle,
          'visible',
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageAttachmentIcon(firstAttachmentIndex),
          'visible',
        );
        await chatMessagesAssertion.assertElementClass(
          attachmentTitle,
          new RegExp(AttributeValues.textStart),
        );

        minimizeButton =
          chatMessages.getExpandedAttachmentMinimizeButton(
            firstAttachmentIndex,
          );
        await chatMessagesAssertion.assertElementState(
          minimizeButton,
          'visible',
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getExpandedAttachmentMinimizeButtonIcon(minimizeButton),
          'visible',
        );
        const downloadAttachmentIcon =
          chatMessages.getDownloadAttachmentIcon(firstAttachmentIndex);
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
      'Generate one more picture for the same conversation and verify it is visible on "File manager"',
      async () => {
        await dialHomePage.mockChatImageResponse(
          defaultModel.id,
          Attachment.cloudImageName,
        );
        await chat.sendRequestWithButton(requestContent);
        await fileApiHelper.putFile(Attachment.cloudImageName, {
          parentPath: imagePath,
        });

        await navigationPanel.goToFileManager();
        await fileManagerCollapsibleSidebar.expandIfCollapsed();
        await fileManagerFoldersTree.expandFolders(
          { isFilesListingTriggered: true },
          ...imagePathSegments,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.cloudImageName,
          'visible',
        );
        await navigationPanel.backToChat();
      },
    );

    await dialTest.step(
      'Change conversation model, generate one more picture and verify it is visible on "File manager" under new model folder',
      async () => {
        await chatHeader.chatAgent.click();
        await talkToAgentDialog.selectAgent(updatedModel);

        await dialHomePage.mockChatImageResponse(
          updatedModel.id,
          Attachment.flowerImageName,
        );
        await chat.sendRequestWithButton(requestContent);
        await fileApiHelper.putFile(Attachment.flowerImageName, {
          parentPath: secondImagePath,
        });

        await navigationPanel.goToFileManager();
        await fileManagerCollapsibleSidebar.expandIfCollapsed();
        await fileManagerFoldersTree.expandFolders(
          { isFilesListingTriggered: true },
          ...secondImagePathSegments,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.flowerImageName,
          'visible',
        );
      },
    );
  },
);
