import { Conversation } from '@/chat/types/chat';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { PublicationProps } from '@/src/testData/api';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { DateUtil, GeneratorUtil, ModelsUtil, UserUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Unpublish single chat without attachments.\n' +
    'Unpublish request name can not be blank.\n' +
    'Metadata for chat inside unpublish request in Approve required section.\n' +
    'Header context menu options for chats from unpublish request from Approve required section.\n' +
    'Unpublish request for conversation which was already unpublished',
  async (
    {
      dialHomePage,
      conversationData,
      publishRequestBuilder,
      publicationApiHelper,
      adminPublicationApiHelper,
      dataInjector,
      organizationConversations,
      conversationDropdownMenu,
      publishingRequestDialog,
      iconApiHelper,
      publishConversationAssertion,
      baseAssertion,
      publishingRulesAssertion,
      organizationConversationAssertion,
      publishingRequestDialogAssertion,
      tooltipPortalAssertion,
      adminDialHomePage,
      adminApproveRequiredConversations,
      adminApproveRequiredConversationDropdownMenu,
      adminInformationModal,
      adminInformationModalAssertion,
      adminPublishingApprovalModal,
      adminChatMessagesAssertion,
      adminPublicationReviewControl,
      adminChatHeader,
      adminApproveRequiredConversationsAssertion,
      adminOrganizationConversationAssertion,
      adminPublishingApprovalModalAssertion,
      adminPublishConversationsTreeAssertion,
      adminChatHeaderAssertion,
      setTestIds,
      adminLocalStorageManager,
      localStorageManager,
      adminApproveRequiredConversationDropdownMenuAssertion,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMDIAL-3175',
      'EPMDIAL-3191',
      'EPMDIAL-3559',
      'EPMDIAL-5999',
      'EPMDIAL-3185',
    );
    let publishedConversation: Conversation;
    const requestName = GeneratorUtil.randomUnpublishRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    const secondRequestName = GeneratorUtil.randomUnpublishRequestName();
    let secondUnpublishResponse: PublicationProps;
    const expectedConversationIcon = iconApiHelper.getEntityIcon(
      ModelsUtil.getDefaultAgent()!,
    );
    const expectedErrorColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textError,
    );
    const currentDate = DateUtil.getCurrentLocalDate();
    const author = UserUtil.getE2EUsername(testInfo.parallelIndex);

    await dialTest.step(
      'Create and approve single conversation publishing',
      async () => {
        publishedConversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([publishedConversation]);

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withDisplayAuthor(author)
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
      'Select "Unpublish" menu option for published conversation and verify "Publish request" modal is opened',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversations.openEntityDropdownMenu(
          publishedConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await baseAssertion.assertElementText(
          publishingRequestDialog.publishPathLabel,
          ExpectedConstants.unpublishFromLabel,
        );
        await baseAssertion.assertElementText(
          publishingRequestDialog.publishPath,
          PublishPath.Organization,
        );
        await publishingRulesAssertion.assertLabels({
          allowAccessLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await publishConversationAssertion.assertEntityState(
          { name: publishedConversation.name },
          'visible',
        );
        await publishConversationAssertion.assertEntityColor(
          { name: publishedConversation.name },
          expectedErrorColor,
        );
        await publishConversationAssertion.assertEntityCheckboxState(
          { name: publishedConversation.name },
          CheckboxState.checked,
        );

        await publishConversationAssertion.assertEntityVersion(
          { name: publishedConversation.name },
          ExpectedConstants.defaultEntityVersion,
        );
        await publishConversationAssertion.assertEntityVersionColor(
          { name: publishedConversation.name },
          expectedErrorColor,
        );
        await publishConversationAssertion.assertTreeEntityIcon(
          { name: publishedConversation.name },
          expectedConversationIcon,
        );
      },
    );

    await dialTest.step(
      'Set empty or spaces as request name and verify "Send request" button is disabled',
      async () => {
        for (const name of ['', ' '.repeat(3)]) {
          await publishingRequestDialog.requestName.fillInInput(name);
          await publishingRequestDialogAssertion.assertSendRequestButtonIsDisabled();
          await publishingRequestDialog.sendRequestButton.hoverOver();
          await tooltipPortalAssertion.assertTooltipContent(
            ExpectedConstants.noPublishNameTooltip,
          );
        }
      },
    );

    await dialTest.step('Set a valid request name and submit', async () => {
      await publishingRequestDialog.requestName.fillInInput(requestName);
      publishApiModels = await publishingRequestDialog.sendPublicationRequest();
      await publishingRequestDialogAssertion.assertElementState(
        publishingRequestDialog,
        'hidden',
      );
    });

    await dialTest.step(
      'Create duplicated unpublish request for the same conversation',
      async () => {
        publishApiModels.response.name = secondRequestName;
        secondUnpublishResponse =
          await publicationApiHelper.createUnpublishRequest(
            publishApiModels.response,
          );
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify conversation unpublishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: publishedConversation.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Select "Info" option from dropdown menu and verify modal data',
      async () => {
        await adminApproveRequiredConversations.openFolderEntityDropdownMenu(
          requestName,
          publishedConversation.name,
        );
        await adminApproveRequiredConversationDropdownMenu.selectMenuOption(
          MenuOptions.info,
          { triggeredHttpMethod: 'GET' },
        );
        await adminInformationModalAssertion.assertFields({
          createdDate: currentDate,
          author: author,
        });
        await adminInformationModal.getCloseButton().click();
      },
    );

    await dialAdminTest.step(
      'Verify labels and controls on "Publication approval" modal',
      async () => {
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishPath,
          PublishPath.Organization,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          publishApiModels.response,
        );
        await adminPublishConversationsTreeAssertion.assertEntityState(
          { name: publishedConversation.name },
          'visible',
        );
        await adminPublishConversationsTreeAssertion.assertEntityColor(
          { name: publishedConversation.name },
          expectedErrorColor,
        );
        await adminPublishConversationsTreeAssertion.assertEntityVersion(
          { name: publishedConversation.name },
          ExpectedConstants.defaultEntityVersion,
        );
        await adminPublishConversationsTreeAssertion.assertEntityVersionColor(
          { name: publishedConversation.name },
          expectedErrorColor,
        );
        await adminPublishConversationsTreeAssertion.assertTreeEntityIcon(
          { name: publishedConversation.name },
          expectedConversationIcon,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.goToReviewButton,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.approveButton,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.rejectButton,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.rejectButton,
          'enabled',
        );
      },
    );

    await dialAdminTest.step(
      'Click on "Go to a review" button and verify conversation details are displayed',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminChatHeaderAssertion.assertHeaderTitle(
          publishedConversation.name,
        );
        await adminChatHeaderAssertion.assertElementColor(
          adminChatHeader.chatTitle,
          expectedErrorColor,
        );
        await adminChatHeaderAssertion.assertElementText(
          adminChatHeader.version,
          `v. ${ExpectedConstants.defaultEntityVersion}`,
        );
        await adminChatHeaderAssertion.assertElementColor(
          adminChatHeader.version,
          expectedErrorColor,
        );
        await adminChatMessagesAssertion.assertMessagesCount(
          publishedConversation.messages.length,
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.nextButton,
          'disabled',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.previousButton,
          'disabled',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.backToPublicationRequestButton,
          'enabled',
        );
      },
    );

    await dialAdminTest.step(
      'Verify chat header dots menu options',
      async () => {
        await adminChatHeader.dotsMenu.click();
        await adminApproveRequiredConversationDropdownMenuAssertion.assertMenuIncludesOptions(
          MenuOptions.compare,
          MenuOptions.duplicate,
          MenuOptions.replay,
          MenuOptions.playback,
          MenuOptions.export,
        );
      },
    );

    await dialAdminTest.step(
      'Click "Back to publication request", approve request by admin and verify publication disappears from "Approve required" and "Organization" sections',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'enabled',
        );
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );
        await adminOrganizationConversationAssertion.assertEntityState(
          { name: publishedConversation.name },
          'hidden',
        );

        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversationAssertion.assertEntityState(
          { name: publishedConversation.name },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Expand duplicated unpublish request and verify error message is displayed on modal',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          secondUnpublishResponse.name!,
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.duplicatedUnpublishingError,
          ExpectedConstants.duplicatedUnpublishingError({
            name: publishedConversation.name,
            version: ExpectedConstants.defaultEntityVersion,
          }),
        );
      },
    );
  },
);
