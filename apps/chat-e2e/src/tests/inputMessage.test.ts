import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialAdminTest(
  'The text in input message is stored when user switches between chats with history.\n' +
    'The text in input message is stored when user switches between chat with history and new conversation created on logo click.\n' +
    'The text in input message is stored if to click on + button.\n' +
    'The text in input message is stored if to select another agent.\n' +
    'The text in input message is stored when user switches between chat Chat view and DIAL marketplace view.\n' +
    'The text in input message is stored when user switches between chat and chat in Replay mode with stopped generating response.\n' +
    'The text in input message is stored when user switches between chat and chat when no input is available.\n' +
    'The text in input message is stored when user switches between chat and chat from Shared with me.\n' +
    'The text in input message is stored when user switches between chat and chat from Organization.\n' +
    'The text in input message is stored when user switches between chat and chat in Playback mode',
  async ({
    dialHomePage,
    conversations,
    sharedWithMeConversations,
    organizationConversations,
    conversationData,
    dataInjector,
    adminDataInjector,
    setTestIds,
    sendMessage,
    chat,
    chatBar,
    talkToAgentDialog,
    sendMessageAssertion,
    playbackAssertion,
    localStorageManager,
    chatAssertion,
    chatMessages,
    playbackControl,
    chatHeader,
    header,
    navigationPanel,
    marketplacePage,
    mainUserShareApiHelper,
    adminShareApiHelper,
    publicationApiHelper,
    publishRequestBuilder,
    adminPublicationApiHelper,
  }) => {
    setTestIds(
      'EPMRTC-5373',
      'EPMRTC-5374',
      'EPMRTC-5380',
      'EPMRTC-5381',
      'EPMRTC-5375',
      'EPMRTC-5501',
      'EPMRTC-5419',
      'EPMRTC-5376',
      'EPMRTC-5377',
      'EPMRTC-6048',
    );
    const inputMessage = GeneratorUtil.randomString(5);
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let replayConversation: Conversation;
    let notWorkspaceAgentConversation: Conversation;
    let notAvailableAgentConversation: Conversation;
    let sharedConversation: Conversation;
    let publishedConversation: Conversation;
    let playbackConversation: Conversation;
    let notWorkspaceAgent: DialAIEntityModel;

    const recentAgents =
      (await localStorageManager.getRecentModelsIds()) as string[];
    const randomAgentId = GeneratorUtil.randomArrayElement(
      recentAgents.filter((a) => a !== ModelsUtil.getDefaultAgent()!.id),
    );
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step(
      'Prepare two simple conversations, partially replayed and replay based on the first one',
      async () => {
        firstConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        replayConversation =
          conversationData.preparePartiallyReplayedConversation(
            firstConversation,
          );
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(
            firstConversation,
          );
        conversationData.resetData();
        secondConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        await dataInjector.createConversations([
          firstConversation,
          replayConversation,
          playbackConversation,
          secondConversation,
        ]);
      },
    );

    await dialTest.step(
      'Prepare conversation with non workspace agent',
      async () => {
        notWorkspaceAgent = GeneratorUtil.randomArrayElement(
          ModelsUtil.getOpenAIEntities().filter(
            (e) => e.type === 'model' && !recentAgents.includes(e.id),
          ),
        );
        notWorkspaceAgentConversation =
          conversationData.prepareDefaultConversation(notWorkspaceAgent);
        conversationData.resetData();
        await dataInjector.createConversations([notWorkspaceAgentConversation]);
      },
    );

    await dialTest.step(
      'Prepare conversation with not available agent',
      async () => {
        notAvailableAgentConversation =
          conversationData.prepareDefaultConversation('invalidAgent');
        conversationData.resetData();
        await dataInjector.createConversations([notAvailableAgentConversation]);
      },
    );

    await dialTest.step('Prepare shared conversation by admin', async () => {
      sharedConversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      await adminDataInjector.createConversations([sharedConversation]);
      const shareByLinkResponse = await adminShareApiHelper.shareEntityByLink([
        sharedConversation,
      ]);
      await mainUserShareApiHelper.acceptInvite(shareByLinkResponse);
    });

    await dialTest.step('Prepare published conversation', async () => {
      publishedConversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      await dataInjector.createConversations([publishedConversation]);
      const publishRequest = publishRequestBuilder
        .withName(GeneratorUtil.randomPublicationRequestName())
        .withConversationInFolderResource(
          publishedConversation,
          PublishActions.ADD,
        )
        .build();
      const publication =
        await publicationApiHelper.createPublishRequest(publishRequest);
      publicationsToUnpublish.push(publication);
      await adminPublicationApiHelper.approveRequest(publication);
    });

    await dialTest.step(
      'Select second conversation and type any input message',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(secondConversation.name);
        await sendMessage.messageInput.fillInInput(inputMessage);
      },
    );

    await dialTest.step(
      'Select first conversation and verify input message is preserved',
      async () => {
        await conversations.selectEntity(
          firstConversation.name,
          { isHttpMethodTriggered: false },
          { exactMatch: true },
        );
        await chatMessages.getChatMessage(1).waitFor();
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Click on logo and verify input message is preserved',
      async () => {
        await header.logo.click();
        await chatAssertion.assertElementState(
          chat.configureSettingsButton,
          'visible',
        );
        await chatAssertion.assertElementState(
          chat.changeAgentButton,
          'visible',
        );
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Click on "+" to create a new conversation and verify input message is preserved',
      async () => {
        await chatBar.createNewEntity();
        await talkToAgentDialog.cancelButton.click();
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Click on "Change agent", select any and verify input message is preserved',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(
          ModelsUtil.getOpenAIEntity(randomAgentId)!,
          marketplacePage,
        );
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Go to the Marketplace, back to chat and verify input message is preserved',
      async () => {
        await conversations.selectEntity(
          firstConversation.name,
          { isHttpMethodTriggered: false },
          { exactMatch: true },
        );
        await chatMessages.getChatMessage(1).waitFor();
        await dialHomePage.goToMarketplace();
        await marketplacePage.waitForPageLoaded();
        await navigationPanel.backToChatButton.click();
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Select replay conversation and verify input message is preserved',
      async () => {
        await conversations.selectEntity(
          replayConversation.name,
          { isHttpMethodTriggered: false },
          { exactMatch: true },
        );
        await chatMessages.getChatMessage(1).waitFor();
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Select conversation with not workspace agent, back to previous one and verify input message is preserved',
      async () => {
        await conversations.selectEntity(secondConversation.name);
        await chatMessages.getChatMessage(1).waitFor();
        await conversations.selectEntity(notWorkspaceAgentConversation.name);
        await chatMessages.getChatMessage(1).waitFor();
        await conversations.selectEntity(secondConversation.name);
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Select conversation with not available agent, back to previous one and verify input message is preserved',
      async () => {
        await conversations.selectEntity(notAvailableAgentConversation.name);
        await chatMessages.getChatMessage(1).waitFor();
        await conversations.selectEntity(secondConversation.name);
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Select shared conversation, back to previous one and verify input message is preserved',
      async () => {
        await sharedWithMeConversations.selectEntity(sharedConversation.name);
        await chatMessages.getChatMessage(1).waitFor();
        await conversations.selectEntity(secondConversation.name);
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Select published conversation, back to previous one and verify input message is preserved',
      async () => {
        await organizationConversations.selectEntity(
          publishedConversation.name,
        );
        await chatMessages.getChatMessage(1).waitFor();
        await conversations.selectEntity(secondConversation.name);
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );

    await dialTest.step(
      'Select playback conversation and verify input message field is empty',
      async () => {
        await conversations.selectEntity(playbackConversation.name);
        await playbackControl.waitForState();
        await playbackAssertion.assertPlaybackMessageContent(
          ExpectedConstants.emptyPlaybackMessage,
        );
      },
    );

    await dialTest.step(
      'Play back the first request and verify input message field is empty',
      async () => {
        for (let i = 1; i <= 2; i++) {
          await chat.playNextChatMessage();
        }
        await playbackAssertion.assertPlaybackMessageContent(
          ExpectedConstants.emptyPlaybackMessage,
        );
      },
    );

    await dialTest.step(
      'Stop playback and verify input message is restored',
      async () => {
        await chatHeader.leavePlaybackMode.click();
        await sendMessageAssertion.assertMessageValue(inputMessage);
      },
    );
  },
);

dialTest.afterAll(
  async ({ publicationApiHelper, adminPublicationApiHelper }) => {
    for (const publication of publicationsToUnpublish) {
      const unpublishResponse =
        await publicationApiHelper.createUnpublishRequest(publication);
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);
