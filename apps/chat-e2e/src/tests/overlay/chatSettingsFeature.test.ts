import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  Attachment,
  ExpectedMessages,
  MockedChatApiResponseBodies,
  OverlaySandboxUrls,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

let modelWithAttachment: DialAIEntityModel;

dialOverlayTest.beforeAll(async () => {
  modelWithAttachment = GeneratorUtil.randomArrayElement(
    ModelsUtil.getLatestModelsWithAttachment(),
  );
});

dialOverlayTest(
  '[Overlay] Allow attach files to conversation - Feature.InputFiles. p1\n' +
    '[Overlay] Display configure settings for empty chat - Feature.EmptyChatSettings. p2\n' +
    '[Overlay] Display change agent for empty chat - Feature.HideEmptyChatChangeAgent. p1',
  async ({
    overlayHomePage,
    overlayChat,
    overlayDataInjector,
    overlayBaseAssertion,
    conversationData,
    overlaySendMessage,
    overlayHeader,
    overlayChatHeader,
    overlayConfirmationDialog,
    overlayConversations,
    overlayConversationSettingsModal,
    overlayToast,
    overlayFileApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2279', 'EPMDIAL-2269', 'EPMDIAL-2270');

    let attachmentConversation: Conversation;

    await dialOverlayTest.step(
      'Create conversation with attachment in the request',
      async () => {
        const imageUrl = await overlayFileApiHelper.putFile(
          Attachment.sunImageName,
        );
        attachmentConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            modelWithAttachment,
            true,
            undefined,
            imageUrl,
          );
        await overlayDataInjector.createConversations([attachmentConversation]);
      },
    );

    await dialOverlayTest.step(
      'Open conversation with attachment and verify clip icon is not available in the Send field',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableEmptyChatSettingsOverlayUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(attachmentConversation.name);
        await overlayChat.addModelToWorkspace();
        await overlayToast.closeToast();
        await overlayBaseAssertion.assertElementState(
          overlaySendMessage.attachmentMenuTrigger,
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Verify gear icon is not available in the header',
      async () => {
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.conversationSettings,
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Clear all conversation messages and verify "Configure settings" link is available',
      async () => {
        await overlayChatHeader.clearConversation.click();
        await overlayConfirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
        await overlayBaseAssertion.assertElementState(
          overlayChat.configureSettingsButton,
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Create a new conversation and verify "Configure settings", "Change agent" links are available',
      async () => {
        await overlayHeader.createNewConversation();
        await overlayBaseAssertion.assertElementState(
          overlayChat.configureSettingsButton,
          'visible',
        );

        await overlayBaseAssertion.assertElementState(
          overlayChat.changeAgentButton,
          'visible',
        );
        await overlayChat.configureSettingsButton.click();
        await overlayBaseAssertion.assertElementState(
          overlayConversationSettingsModal,
          'visible',
        );
        await overlayConversationSettingsModal.cancelButton.click();
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] Allow attach files to conversation - Feature.InputFiles. p2',
  async ({
    overlayHomePage,
    overlayChat,
    overlayDataInjector,
    overlayBaseAssertion,
    conversationData,
    overlaySendMessage,
    overlayHeader,
    overlayConversations,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2279');

    let attachmentConversation: Conversation;

    await dialOverlayTest.step(
      'Create conversation with attachment in the request',
      async () => {
        attachmentConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            modelWithAttachment,
            true,
            undefined,
          );
        await overlayDataInjector.createConversations([attachmentConversation]);
      },
    );

    await dialOverlayTest.step(
      'Open conversation with attachment and verify clip icon is available in the Send field',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableInputFilesUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(attachmentConversation.name);
        await overlayChat.addModelToWorkspace();
        await overlayBaseAssertion.assertElementState(
          overlaySendMessage.attachmentMenuTrigger,
          'visible',
        );
      },
    );
  },
);

dialOverlayTest(
  `[Overlay] Display change agent for empty chat - Feature.HideEmptyChatChangeAgent. p2.\n` +
    '[Overlay] Nothing happens on + "New conversation" button when Feature.HideEmptyChatChangeAgent is enabled',
  async ({
    overlayHomePage,
    overlayChat,
    overlayBaseAssertion,
    overlayHeader,
    overlayTalkToAgentDialog,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2270', 'EPMDIAL-2271');

    await dialOverlayTest.step(
      'Open sandbox and verify "Change agent" link is not displayed for a new conversation',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableHideEmptyChangeAgentUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayBaseAssertion.assertElementState(
          overlayChat.changeAgentButton,
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Click on + button in the header and verify "Select agent" modal is not displayed',
      async () => {
        await overlayHeader.createNewConversation();
        await overlayBaseAssertion.assertElementState(
          overlayTalkToAgentDialog,
          'hidden',
        );
      },
    );
  },
);

dialOverlayTest(
  `[Overlay] When no any feature is enabled in the code.\n` +
    '[Overlay] Display configure settings for empty chat - Feature.EmptyChatSettings. p1.\n' +
    `[Overlay] Send 'Hello' to Chat manually`,
  async ({
    overlayHomePage,
    overlayChat,
    overlayChatMessages,
    overlayChatMessagesAssertion,
    overlayBaseAssertion,
    overlayAgentInfo,
    overlaySendMessage,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2288', 'EPMDIAL-2269', 'EPMDIAL-2333');

    await dialOverlayTest.step(
      'Open sandbox and verify model information, send request field and "Change agent" link are available',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.disableAllFeaturesUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayBaseAssertion.assertElementState(
          overlayAgentInfo,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlaySendMessage,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayAgentInfo.agentName,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayAgentInfo.agentDescription,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChat.changeAgentButton,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChat.configureSettingsButton,
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Send the request and verify Edit, Delete, Copy and Regenerate buttons are available for the response',
      async () => {
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        const requestContent = 'test';
        const requests = await overlayChat.sendRequestWithButton(
          requestContent,
          false,
        );
        overlayBaseAssertion.assertValue(
          requests.completionRequest.messages[0].content,
          requestContent,
        );
        await overlayChatMessages.getChatMessage(2).waitFor();
        await overlayChatMessagesAssertion.assertMessageDeleteIconState(
          1,
          'visible',
        );
        await overlayChatMessagesAssertion.assertMessageEditIconState(
          1,
          'visible',
        );
        await overlayChatMessagesAssertion.assertElementState(
          overlayChatMessages.messageCopyTextButton(2),
          'visible',
        );
        await overlayChatMessagesAssertion.assertElementState(
          overlayChatMessages.messageRegenerateIcon(2),
          'visible',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] any amount of default RECENT_MODELS_IDS is allowed',
  async ({
    overlayHomePage,
    localStorageManager,
    overlayBaseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2243');
    let agents: DialAIEntityModel[];

    await dialOverlayTest.step(
      'Set more than 5 agents to the "recentModelsIds" local storage key',
      async () => {
        agents = GeneratorUtil.randomArrayElements(ModelsUtil.getModels(), 7);
        await localStorageManager.setRecentModelsIds(...agents);
      },
    );

    await dialOverlayTest.step(
      'Open overlay app and verify all agents are set in the local storage',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableHideUserSettingsUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        const actualAgents = await localStorageManager.getRecentModelsIds(
          process.env.NEXT_PUBLIC_OVERLAY_HOST,
        );
        overlayBaseAssertion.assertArrayIncludesAll(
          actualAgents,
          agents.map((a) => a.id),
          ExpectedMessages.recentEntitiesIsValid,
        );
        overlayBaseAssertion.assertValue(
          actualAgents.length,
          agents.length,
          ExpectedMessages.recentEntitiesIsValid,
        );
      },
    );
  },
);
