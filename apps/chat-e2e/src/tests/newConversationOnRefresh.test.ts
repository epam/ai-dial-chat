import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { loadingTimeout } from '@/src/ui/pages';
import { ItemUtil, ModelsUtil } from '@/src/utils';
import { GeneratorUtil } from '@/src/utils/generatorUtil';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  'New conversation stays on Back to Chat if new conversation was on the screen\n' +
    'New conversation is NOT created on browser refresh if conversation with cleared history is focused\n' +
    'New conversation is NOT created on Back to Chat if conversation with history was focused\n' +
    'New conversation is NOT created on Search on My workspace opened from the chat header\n' +
    'Autofocus on chat input when refresh page.\n' +
    'New conversation is created on browser refresh if conversation with history from Pinned or Today is focused',
  async ({
    dialHomePage,
    chat,
    talkToAgentDialog,
    navigationPanel,
    setTestIds,
    localStorageManager,
    conversationAssertion,
    chatHeader,
    confirmationDialog,
    chatMessagesAssertion,
    chatHeaderAssertion,
    marketplacePage,
    conversations,
    iconApiHelper,
    sendMessage,
    baseAssertion,
    localStorageAssertion,
  }) => {
    setTestIds(
      'EPMRTC-4587',
      'EPMRTC-4586',
      'EPMRTC-4718',
      'EPMRTC-4590',
      'EPMRTC-4588',
      'EPMRTC-5450',
      'EPMRTC-4592',
    );
    dialTest.slow();
    const initialConversationName = GeneratorUtil.randomString(7);
    let models: DialAIEntityModel[];

    await dialTest.step(
      'Set 2 random models to recent and create a conversation and playback conversation via API',
      async () => {
        models = GeneratorUtil.randomArrayElements(
          ModelsUtil.getModels().filter((m) => m.iconUrl !== undefined),
          2,
        );
        await localStorageManager.setRecentModelsIdsOnce(...models);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open the home page and verify initial state',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [models[0].iconUrl!],
        });
        await dialHomePage.waitForPageLoaded();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await conversationAssertion.assertNoEntityIsSelected();
      },
    );

    await dialTest.step('Navigate to Marketplace', async () => {
      await chat.changeAgentButton.click();
      await talkToAgentDialog.goToMyWorkspace();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step('Click "Back to Chat"', async () => {
      await navigationPanel.backToChat({ isHttpMethodTriggered: false });
    });

    await dialTest.step(
      'Verify nothing changes after going back to chat',
      async () => {
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await conversationAssertion.assertNoEntityIsSelected();
      },
    );

    await dialTest.step('Send a message to the chat', async () => {
      await dialHomePage.mockChatTextResponse(
        MockedChatApiResponseBodies.simpleTextBody,
      );
      await chat.sendRequestWithButton(initialConversationName);
    });

    await dialTest.step('Navigate to Marketplace', async () => {
      await chatHeader.chatAgent.click();
      await talkToAgentDialog.goToMyWorkspace();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step('Click "Back to Chat"', async () => {
      await navigationPanel.backToChat({ isHttpMethodTriggered: false });
    });

    await dialTest.step('Verify chat stays selected', async () => {
      await conversationAssertion.assertSelectedEntity(initialConversationName);
      await chatMessagesAssertion.assertMessageContent(
        1,
        initialConversationName,
      );
      await chatMessagesAssertion.assertMessageContent(2, 'Response');
      await conversationAssertion.assertEntitiesCount(1);
    });

    await dialTest.step(
      'Change model and verify the chat stays selected',
      async () => {
        await chatHeader.chatAgent.click();
        await talkToAgentDialog.selectAgent(models[1], marketplacePage);
        const expectedModelIcon = iconApiHelper.getEntityIcon(models[1]);
        await chatHeaderAssertion.assertHeaderIcon(expectedModelIcon);
        await chatMessagesAssertion.assertMessageContent(
          1,
          initialConversationName,
        );
        await chatMessagesAssertion.assertMessageContent(2, 'Response');
        await conversationAssertion.assertEntitiesCount(1);
        await conversationAssertion.assertSelectedEntity(
          initialConversationName,
        );
      },
    );

    await dialTest.step(
      'Reload the page after the selection of the non-empty conversation and verify the regular start page is opened. No conversation is selected. Focus stays in the send input',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await conversationAssertion.assertNoEntityIsSelected();
        await baseAssertion.assertIsElementFocused(
          sendMessage.messageInput,
          true,
        );
      },
    );

    await dialTest.step('Clear the history', async () => {
      await conversations.selectEntity(initialConversationName);
      await chatHeader.clearConversation.click();
      await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
    });

    await dialTest.step('Verify chat stays selected', async () => {
      await dialHomePage.waitForPageLoaded();
      await chat.changeAgentButton.waitForState();
      await chat.configureSettingsButton.waitForState();
      await conversationAssertion.assertSelectedEntity(initialConversationName);
      await chat.getSendMessage().waitForState({ state: 'attached' });
    });

    await dialTest.step(
      'Refresh the page and verify that empty conversation stays selected, no new conversations is created',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await conversationAssertion.assertSelectedEntity(
          initialConversationName,
        );
        await conversationAssertion.assertEntitiesCount(1);
      },
    );

    await dialTest.step(
      'Clear selectedConversationIds, refresh the page and verify new conversation is created after the compare mode',
      async () => {
        await localStorageManager.removeFromLocalStorage(
          'selectedConversationIds',
        );
        localStorageAssertion.assertValue(
          await localStorageManager.getSelectedConversationIds(),
          '',
        );
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        const updatedConversationIds =
          await localStorageManager.getSelectedConversationIds();
        baseAssertion.assertValue(
          updatedConversationIds[0],
          `conversations/local/${models[0].id}${ItemUtil.entityIdSeparator}${ExpectedConstants.newConversationWithIndexTitle(1)}`,
        );
        await conversationAssertion.assertNoEntityIsSelected();
      },
    );
  },
);

dialTest(
  'New conversation is created on browser refresh if two chats with history are in compare mode\n' +
    'New conversation is created on browser refresh if conversation in Playback mode is selected\n' +
    'New conversation is created on browser refresh if conversation in Replay mode is selected',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    localStorageManager,
    conversationAssertion,
    conversationData,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    compareConversation,
    appContainer,
  }) => {
    setTestIds('EPMRTC-4682', 'EPMRTC-4683', 'EPMRTC-4593');
    let models: DialAIEntityModel[];
    let initialConversation: Conversation;
    let conversationToCompare: Conversation;
    let playbackConversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Set 2 random models to recent and create a conversation and playback conversation via API',
      async () => {
        models = GeneratorUtil.randomArrayElements(
          ModelsUtil.getModels().filter((m) => m.iconUrl !== undefined),
          2,
        );
        await localStorageManager.setRecentModelsIdsOnce(...models);
        conversationToCompare = conversationData.prepareDefaultConversation(
          models[1],
        );
        conversationData.resetData();
        initialConversation = conversationData.prepareDefaultConversation(
          models[0],
        );
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(
            conversationToCompare,
          );
        conversationData.resetData();
        replayConversation = conversationData.prepareDefaultReplayConversation(
          conversationToCompare,
        );
        await dataInjector.createConversations([
          conversationToCompare,
          playbackConversation,
          replayConversation,
          initialConversation,
        ]);
        await localStorageManager.setChatCollapsedSection(
          CollapsedSections.Organization,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open the home page and verify initial state',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [models[0].iconUrl!],
        });
        await dialHomePage.waitForPageLoaded();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await conversationAssertion.assertNoEntityIsSelected();
      },
    );

    await dialTest.step(
      'Open a conversation in compare mode with initial conversation',
      async () => {
        await conversations.openEntityDropdownMenu(initialConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversation.checkShowAllConversations();
        await compareConversation.selectCompareConversation(
          conversationToCompare.name,
        );
      },
    );

    await dialTest.step(
      'Refresh the page and verify new conversation is created after the compare mode',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await conversationAssertion.assertNoEntityIsSelected();
      },
    );

    await dialTest.step(
      'Select playback conversation, refresh the page and verify new conversation is created after the playback mode',
      async () => {
        await conversations.selectEntity(playbackConversation.name);
        await appContainer.waitForAppLoaded(loadingTimeout);
        await chat.changeAgentButton.hoverOver();
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await conversationAssertion.assertNoEntityIsSelected();
      },
    );

    await dialTest.step(
      'Select replay conversation, refresh the page and verify new conversation is created after the playback mode',
      async () => {
        await conversations.selectEntity(replayConversation.name);
        await appContainer.waitForAppLoaded(loadingTimeout);
        await chat.changeAgentButton.hoverOver();
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await conversationAssertion.assertNoEntityIsSelected();
      },
    );
  },
);

dialAdminTest(
  'New conversation is created on user re-login if conversation with history from Organization was focused.\n' +
    'New conversation is created on user re-login if conversation with history from Shared with me was focused',
  async (
    {
      dialHomePage,
      chat,
      setTestIds,
      localStorageManager,
      conversationData,
      mainUserShareApiHelper,
      adminDataInjector,
      publishRequestBuilder,
      adminPublicationApiHelper,
      adminShareApiHelper,
      organizationConversations,
      sharedWithMeConversations,
      providerLogin,
      accountSettings,
      organizationConversationAssertion,
      sharedWithMeConversationAssertion,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-4591', 'EPMRTC-4589');
    let adminConversation: Conversation;

    await dialTest.step(
      'Create published and shared conversations',
      async () => {
        //create conversation by admin user
        adminConversation = conversationData.prepareDefaultConversation();
        await adminDataInjector.createConversations([adminConversation]);
        //publish it
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationResource(adminConversation, PublishActions.ADD)
          .build();
        const appPublication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        publicationsToUnpublish.push(appPublication);
        await adminPublicationApiHelper.approveRequest(appPublication);
        //share it with the main user
        const shareByLinkResponse = await adminShareApiHelper.shareEntityByLink(
          [adminConversation],
        );
        await mainUserShareApiHelper.acceptInvite(shareByLinkResponse);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Select published conversation, re-login and verify new conversation is created, no conversation is selected',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversations.selectEntity(adminConversation.name);
        await organizationConversationAssertion.assertSelectedEntity(
          adminConversation.name,
        );
        await accountSettings.logout();
        await providerLogin.login(
          testInfo,
          process.env.E2E_USERNAME!.split(',')[+testInfo.parallelIndex],
          process.env.E2E_PASSWORD!,
          false,
        );
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await organizationConversationAssertion.assertNoEntityIsSelected();
      },
    );

    await dialTest.step(
      'Select shared conversation, re-login and verify new conversation is created, no conversation is selected',
      async () => {
        await sharedWithMeConversations.selectEntity(adminConversation.name);
        await accountSettings.logout();
        await providerLogin.login(
          testInfo,
          process.env.E2E_USERNAME!.split(',')[+testInfo.parallelIndex],
          process.env.E2E_PASSWORD!,
          false,
        );
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await sharedWithMeConversationAssertion.assertNoEntityIsSelected();
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
