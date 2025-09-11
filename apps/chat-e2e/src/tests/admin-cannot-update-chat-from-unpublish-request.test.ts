import { Conversation } from '@/chat/types/chat';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, MenuOptions } from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Admin can not update chat from unpublish request',
  async ({
    dialHomePage,
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    dataInjector,
    organizationConversations,
    conversationDropdownMenu,
    publishingRequestModal,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminChatMessages,
    adminPublicationReviewControl,
    adminChatHeader,
    setTestIds,
    adminLocalStorageManager,
    localStorageManager,
    baseAssertion,
    adminChatHeaderAssertion,
    tooltipAssertion,
    adminChatHeaderDropdownMenu,
    adminApproveRequiredConversationDropdownMenu,
  }) => {
    setTestIds('EPMRTC-6472');
    let publishedConversation: Conversation;
    const requestName = GeneratorUtil.randomUnpublishRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };

    await dialTest.step(
      'Create and approve single conversation publishing',
      async () => {
        publishedConversation = conversationData.prepareDefaultConversation();
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
        await adminPublicationApiHelper.approveRequest(publication);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Select "Unpublish" menu option for published conversation and send unpublish request',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversations.openEntityDropdownMenu(
          publishedConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModal.requestName.fillInInput(requestName);
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
      },
    );

    await dialAdminTest.step(
      'Login as admin, open unpublish request and click on "Go to a review" link',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
      },
    );

    await dialAdminTest.step(
      'Verify message and response do not have any icons for update',
      async () => {
        for (const message of publishedConversation.messages) {
          await adminChatMessages.hoverOverMessage(message.content);
          const conversationMessage = adminChatMessages.getChatMessage(
            message.content,
          );
          await baseAssertion.assertElementState(
            conversationMessage,
            'visible',
          );
          await baseAssertion.assertElementState(
            adminChatMessages.messageRegenerateIcon(message.content),
            'hidden',
          );
          await baseAssertion.assertElementState(
            adminChatMessages.messageEditIcon(conversationMessage),
            'hidden',
          );
          await baseAssertion.assertElementState(
            adminChatMessages.messageDeleteIcon(message.content),
            'hidden',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Verify there is no Edit icon in bottom near "Back to publication request" button',
      async () => {
        await baseAssertion.assertElementState(
          adminPublicationReviewControl.getChildElementBySelector(
            '[data-qa="edit"]',
          ),
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      `Verify agent's icon in the chat's header is not clickable, agent's name and version displayed on hover`,
      async () => {
        const defaultAgent = ModelsUtil.getDefaultAgent()!;
        await adminChatHeader.hoverOverChatModel();
        await tooltipAssertion.assertTooltipContent(
          `${defaultAgent.name}\nv. ${ExpectedConstants.defaultAppVersion}`,
        );
        await adminChatHeader.chatAgent.click();
        await adminChatHeaderAssertion.assertHeaderTitle(
          publishedConversation.name,
        );
      },
    );

    await dialAdminTest.step(
      `Verify settings icon in chat's header is not clickable, conversation settings is displayed on hover`,
      async () => {
        await adminChatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.conversationSettings,
        );
        await adminChatHeader.conversationSettings.click();
        await adminChatHeaderAssertion.assertHeaderTitle(
          publishedConversation.name,
        );
      },
    );

    await dialAdminTest.step(
      `Click on 3 dots in chat's header and check that there is no "Rename" option`,
      async () => {
        await adminChatHeader.dotsMenu.click();
        const allMenuOptions =
          await adminChatHeaderDropdownMenu.getAllMenuOptions();
        baseAssertion.assertArrayExcludesAll(
          allMenuOptions,
          [MenuOptions.rename],
          'Menu options',
        );
      },
    );

    await dialAdminTest.step(
      'Go back to the approval modal and check context menu for the chat in "Approve required" section',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminApproveRequiredConversations.openFolderEntityDropdownMenu(
          requestName,
          publishedConversation.name,
        );
        const allMenuOptions =
          await adminApproveRequiredConversationDropdownMenu.getAllMenuOptions();
        baseAssertion.assertArrayExcludesAll(
          allMenuOptions,
          [MenuOptions.rename],
          'Menu options',
        );
      },
    );
  },
);
