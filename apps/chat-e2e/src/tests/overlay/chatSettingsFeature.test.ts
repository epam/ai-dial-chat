import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  Attachment,
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
    setTestIds('EPMRTC-3773', 'EPMRTC-3765', 'EPMRTC-4868');

    let attachmentConversation: Conversation;

    await dialTest.step(
      'Create conversation with attachment in the request',
      async () => {
        const imageUrl = await overlayFileApiHelper.putFile(
          Attachment.sunImageName,
        );
        attachmentConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            modelWithAttachment,
            true,
            imageUrl,
          );
        await overlayDataInjector.createConversations([attachmentConversation]);
      },
    );

    await dialTest.step(
      'Open conversation with attachment and verify clip icon is not available in the Send field',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableEmptyChatSettingsOverlayUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectConversation(
          attachmentConversation.name,
        );
        await overlayChat.addModelToWorkspace();
        await overlayToast.closeToast();
        await overlayBaseAssertion.assertElementState(
          overlaySendMessage.attachmentMenuTrigger,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify gear icon is not available in the header',
      async () => {
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.conversationSettings,
          'hidden',
        );
      },
    );

    await dialTest.step(
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

    await dialTest.step(
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
    setTestIds('EPMRTC-3773');

    let attachmentConversation: Conversation;

    await dialTest.step(
      'Create conversation with attachment in the request',
      async () => {
        attachmentConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            modelWithAttachment,
            true,
          );
        await overlayDataInjector.createConversations([attachmentConversation]);
      },
    );

    await dialTest.step(
      'Open conversation with attachment and verify clip icon is available in the Send field',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableInputFilesUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectConversation(
          attachmentConversation.name,
        );
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
  `[Overlay] Display change agent for empty chat - Feature.HideEmptyChatChangeAgent. p2`,
  async ({
    overlayHomePage,
    overlayChat,
    overlayBaseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4868');

    await dialTest.step(
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
  },
);

dialOverlayTest(
  `[Overlay] When no any feature is enabled in the code.\n` +
    '[Overlay] Display configure settings for empty chat - Feature.EmptyChatSettings. p1',
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
    setTestIds('EPMRTC-3780', 'EPMRTC-3765');

    await dialTest.step(
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

    await dialTest.step(
      'Send the request and verify Edit, Delete, Copy and Regenerate buttons are available for the response',
      async () => {
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        await overlayChat.sendRequestWithButton('test');
        await overlayChatMessagesAssertion.assertMessageDeleteIconState(
          1,
          'visible',
        );
        await overlayChatMessagesAssertion.assertMessageEditIconState(
          1,
          'visible',
        );
        await overlayChatMessagesAssertion.assertElementState(
          overlayChatMessages.messageCopyIcon(2),
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
