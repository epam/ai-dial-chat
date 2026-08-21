import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { PublishActions, Role } from '@epam/ai-dial-shared';

dialOverlayTest(
  '[Overlay] enable Feature.HideEditUserMessage.\n' +
    '[Overlay] enable Feature.HideDeleteUserMessage.\n' +
    '[Overlay] enable Feature.HideRegenerateAssistantMessage.\n' +
    '[Overlay] enable Feature.HideUserMenu',
  async ({
    conversationData,
    adminDataInjector,
    adminPublicationApiHelper,
    publishRequestBuilder,
    adminOverlayHomePage,
    adminOverlayHeader,
    adminOverlayAccountSettings,
    adminOverlayConversations,
    adminOverlayApproveRequiredConversations,
    adminOverlayChat,
    adminOverlayPublishingApprovalModal,
    adminOverlayChatMessages,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2319', 'EPMDIAL-2320', 'EPMDIAL-2321', 'EPMDIAL-2322');
    let chat1: Conversation;
    let chat2: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();

    await dialOverlayTest.step(
      'By administrator prepare Chat1 with several user messages in Today and a publish request for Chat2',
      async () => {
        chat1 = conversationData.prepareModelConversationBasedOnRequests([
          GeneratorUtil.randomString(5),
          GeneratorUtil.randomString(5),
          GeneratorUtil.randomString(5),
        ]);
        conversationData.resetData();
        chat2 = conversationData.prepareDefaultConversation();
        await adminDataInjector.createConversations([chat1, chat2]);

        const publishRequest = publishRequestBuilder
          .withName(requestName)
          .withConversationInFolderResource(chat2, PublishActions.ADD)
          .build();
        await adminPublicationApiHelper.createPublishRequest(publishRequest);
      },
    );

    await dialOverlayTest.step(
      'Open overlay manager, log in by administrator and open Chat1: verify there are no Edit, Delete, Regenerate buttons in messages',
      async () => {
        await adminOverlayHomePage.navigateToUrl(
          OverlaySandboxUrls.disabledDefaultButtonsUrl,
        );
        await adminOverlayHomePage.waitForPageLoaded();
        await adminOverlayHeader.leftPanelToggle.click();
        await adminOverlayConversations.selectEntity(chat1.name);
        for (const message of chat1.messages) {
          if (message.role === Role.User) {
            await baseAssertion.assertElementState(
              adminOverlayChatMessages.messageEditIcon(message.content),
              'hidden',
            );
            await baseAssertion.assertElementState(
              adminOverlayChatMessages.messageDeleteIcon(message.content),
              'hidden',
            );
          } else if (message.role === Role.Assistant) {
            await baseAssertion.assertElementState(
              adminOverlayChatMessages.messageRegenerateIcon(message.content),
              'hidden',
            );
          }
        }
      },
    );

    await dialOverlayTest.step(
      "Verify user name and it's menu do not exits in the header",
      async () => {
        await baseAssertion.assertElementState(
          adminOverlayAccountSettings,
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Open Chat2 Publish request and verify there are no Edit, Delete, Regenerate buttons in messages on edit',
      async () => {
        await adminOverlayHeader.leftPanelToggle.click();
        await adminOverlayApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminOverlayPublishingApprovalModal.goToEntityReview();
        await adminOverlayChat.getPublicationReviewControl().editButton.click();
        for (const message of chat2.messages) {
          if (message.role === Role.User) {
            await adminOverlayChatMessages.hoverOverMessage(message.content);
            await baseAssertion.assertElementState(
              adminOverlayChatMessages.messageEditIcon(message.content),
              'hidden',
            );
          } else if (message.role === Role.Assistant) {
            await baseAssertion.assertElementState(
              adminOverlayChatMessages.messageRegenerateIcon(message.content),
              'hidden',
            );
          }
        }
      },
    );
  },
);
