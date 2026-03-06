import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { API, Attachment } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

dialTest(
  'Generated in response picture appears in Manage attachments',
  async ({
    dialHomePage,
    fileManagerPage,
    setTestIds,
    navigationPanel,
    conversationData,
    localStorageManager,
    dataInjector,
    fileApiHelper,
    fileManagerFoldersTree,
    fileManagerCollapsibleSidebar,
    fileManagerGridAssertion,
    chatHeader,
    chat,
    talkToAgentDialog,
    conversations,
    appContainer,
  }) => {
    setTestIds('EPMRTC-3481');
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
        await fileManagerFoldersTree.expandFolders(...imagePathSegments);
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Generate one more picture for the same conversation and verify it is visible on "File manager"',
      async () => {
        await navigationPanel.backToChat();
        await dialHomePage.mockChatImageResponse(
          defaultModel.id,
          Attachment.cloudImageName,
        );
        await conversations.selectEntity(responseImageConversation.name);
        await appContainer.getChatLoader().waitForState({ state: 'hidden' });
        await chat.sendRequestWithButton(requestContent);
        await fileApiHelper.putFile(Attachment.cloudImageName, {
          parentPath: imagePath,
        });

        await navigationPanel.goToFileManager();
        await fileManagerCollapsibleSidebar.expandIfCollapsed();
        await fileManagerFoldersTree.expandFolders(...imagePathSegments);
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
        await fileManagerFoldersTree.expandFolders(...secondImagePathSegments);
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.flowerImageName,
          'visible',
        );
      },
    );
  },
);
