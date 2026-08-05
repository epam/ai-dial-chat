import { BackendResourceType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  EntityEditorAppTypes,
  ExpectedConstants,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { AttributeValues, Attributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { ApplicationsUtil, GeneratorUtil, UserUtil } from '@/src/utils';

dialAdminTest(
  '[External app] Publish by owner and approve by Admin.\n' +
    `[External app] External app is not shown on 'Select an agent for conversation' pop-up.\n` +
    '[External app] Open published External app.\n' +
    '[External app] Check the icon and the tooltip for published app.\n' +
    '[External app] Unpublish',
  async (
    {
      externalApplicationBuilder,
      applicationApiHelper,
      marketplacePage,
      marketplaceHeader,
      marketplaceEntitiesSection,
      marketplaceEntities,
      publishingRequestDialogAssertion,
      publishingRulesAssertion,
      appToPublishAssertion,
      publishingRequestDialog,
      adminDialHomePage,
      adminApproveRequiredPrompts,
      adminApproveRequiredPromptsAssertion,
      adminLocalStorageManager,
      adminPublishingApprovalModalAssertion,
      adminPublishingRulesAssertion,
      adminAppToApproveAssertion,
      adminPublishingApprovalModal,
      adminPublishedApplicationReviewModal,
      adminPublishedAppReviewModalAssertion,
      adminChatBar,
      adminChat,
      adminTalkToAgentDialog,
      adminTalkToAgentDialogAssertion,
      publicationApiAssertion,
      setTestIds,
      adminMarketplacePage,
      adminMarketplaceHeader,
      adminMarketplaceEntitiesSection,
      adminTooltip,
      adminTooltipAssertion,
      baseAssertion,
      adminEntityDetailsModal,
      entityDetailsModalAssertion,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMDIAL-5313',
      'EPMDIAL-5317',
      'EPMDIAL-5314',
      'EPMDIAL-5315',
      'EPMDIAL-5316',
    );
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomEntityVersion(),
    } as DialAIEntityModel;
    const externalUrl = `http://${GeneratorUtil.randomString(6)}.com`;
    const defaultAuthor = UserUtil.getE2EUsername(testInfo.parallelIndex);
    const publishRequestName = GeneratorUtil.randomPublicationRequestName();
    const unpublishRequestName = GeneratorUtil.randomUnpublishRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let agentElement: BaseElement;
    let searchInput: BaseElement;

    await dialAdminTest.step('Create an external app via API', async () => {
      const applicationModel = externalApplicationBuilder
        .withDisplayName(appEntity.name)
        .withDisplayVersion(appEntity.version!)
        .withExternalUrl(externalUrl)
        .withApplicationTypeSchemaId(
          ApplicationsUtil.getAppSchemaByName(EntityEditorAppTypes.ExternalApp),
        )
        .build();
      await applicationApiHelper.createApplication(applicationModel);
      await adminLocalStorageManager.setShowSideBarPanels();
    });

    await dialAdminTest.step(
      'Find created app on "DIAL Marketplace", open card dropdown menu and select "Publish" option',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(appEntity.name);
        agentElement = await marketplaceEntitiesSection.findEntityElement(
          appEntity,
          { isWorkspaceEntity: true, isEditable: true },
        );
        await agentElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.publish);
        await publishingRequestDialogAssertion.assertGeneralInfo({
          publishTo: PublishPath.Organization,
          author: defaultAuthor,
        });
        await publishingRulesAssertion.assertLabels({
          allowAccessLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await appToPublishAssertion.assertEntityToPublish(
          { name: appEntity.name },
          {
            expectedState: 'visible',
            expectedCheckboxState: CheckboxState.checked,
            expectedVersion: appEntity.version,
          },
        );
      },
    );

    await dialTest.step(
      'Set publication request name and send the request',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(
          publishRequestName,
        );
        publishApiModels =
          await publishingRequestDialog.sendPublicationRequest();
      },
    );

    await dialAdminTest.step(
      'Open the request by admin user, proceed to review and verify the external url is shown as a link',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(publishRequestName);
        await adminPublishingApprovalModalAssertion.assertGeneralInfo({
          requestName: publishRequestName,
          publishPath: PublishPath.Organization,
          author: defaultAuthor,
          requestCreated: publishApiModels.response,
        });
        await adminPublishingRulesAssertion.assertLabels({
          allowAccessLabel: 'visible',
          noChangesLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await adminAppToApproveAssertion.assertEntityToPublish(
          { name: appEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: appEntity.version,
            expectedCheckboxState: CheckboxState.checked,
          },
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedAppReviewModalAssertion.assertElementState(
          adminPublishedApplicationReviewModal,
          'visible',
        );
        await adminPublishedAppReviewModalAssertion.assertAppAttributes({
          expectedName: appEntity.name,
          expectedVersion: appEntity.version,
          expectedExternalUrl: externalUrl,
        });
      },
    );

    await dialAdminTest.step(
      'Click on "Back to publication request", approve it and verify app disappears from the right panel',
      async () => {
        await adminPublishedApplicationReviewModal
          .getPublicationReviewControl()
          .backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest({
          isModelsListRetrieved: true,
        });
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: publishRequestName },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Create a new chat and verify published app is not available for a new conversation',
      async () => {
        await adminChatBar.createNewEntity();
        await adminChat.changeAgentButton.click();
        await adminTalkToAgentDialog.selectAgent(appEntity, {
          isAgentVisible: false,
        });
        await adminTalkToAgentDialogAssertion.assertElementState(
          adminTalkToAgentDialog.noResultFound,
          'visible',
        );
        await adminTalkToAgentDialog.getCloseButton().click();
      },
    );

    await dialAdminTest.step(
      'Find published app on the "Marketplace" and verify external app sign is displayed on the card and has tooltip',
      async () => {
        await adminMarketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          updateInstalledToolsets: false,
        });
        await adminMarketplacePage.waitForPageLoaded();
        await adminMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(appEntity.name);
        agentElement = await adminMarketplaceEntitiesSection.findEntityElement(
          appEntity,
          { isWorkspaceEntity: false, isEditable: false },
        );
        const externalIcon =
          marketplaceEntities.getAppExternalIcon(agentElement);
        await baseAssertion.assertElementState(externalIcon, 'visible');
        await externalIcon.hoverOver();
        await adminTooltipAssertion.assertElementText(
          adminTooltip,
          ExpectedConstants.externalAppTooltip,
        );
      },
    );

    await dialAdminTest.step(
      'Open the card and verify "Open in new tab" button is displayed',
      async () => {
        await agentElement.click();
        await baseAssertion.assertElementState(
          adminEntityDetailsModal,
          'visible',
        );
        await entityDetailsModalAssertion.assertElementState(
          adminEntityDetailsModal.openInNewTabButton,
          'visible',
        );
        await entityDetailsModalAssertion.assertElementAttribute(
          adminEntityDetailsModal.openInNewTabButton,
          Attributes.href,
          externalUrl,
        );
        await entityDetailsModalAssertion.assertElementAttribute(
          adminEntityDetailsModal.openInNewTabButton,
          Attributes.target,
          AttributeValues.blank,
        );
      },
    );

    await dialAdminTest.step(
      'By main user find published app on the "Marketplace", open the card and verify the app can be unpublished',
      async () => {
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          updateInstalledToolsets: false,
        });
        await marketplacePage.waitForPageLoaded();
        await searchInput.fillInInput(appEntity.name);
        agentElement = await marketplaceEntitiesSection.findEntityElement(
          appEntity,
          { isWorkspaceEntity: false, isEditable: false },
        );
        await agentElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.unpublish);
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await appToPublishAssertion.assertEntityToPublish(
          { name: appEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: appEntity.version,
          },
        );
        await publishingRequestDialog.requestName.fillInInput(
          unpublishRequestName,
        );
        await publishingRequestDialog.sendPublicationRequest();
      },
    );

    await dialAdminTest.step(
      'Review the request by admin and approve unpublishing',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(unpublishRequestName);
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertGeneralInfo({
          requestName: unpublishRequestName,
          unpublishFromLabel: 'visible',
          publishPath: PublishPath.Organization,
          authorLabel: 'visible',
          author: defaultAuthor,
          publicAuthorLabel: 'hidden',
          requestCreatedLabel: 'visible',
          requestCreated: publishApiModels.response,
        });
        await adminAppToApproveAssertion.assertEntityToPublish(
          { name: appEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: appEntity.version,
          },
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedAppReviewModalAssertion.assertElementState(
          adminPublishedApplicationReviewModal,
          'visible',
        );
        await adminPublishedAppReviewModalAssertion.assertAppAttributes({
          expectedName: appEntity.name,
          expectedVersion: appEntity.version,
          expectedExternalUrl: externalUrl,
        });
        await adminPublishedApplicationReviewModal
          .getPublicationReviewControl()
          .backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest({
          isModelsListRetrieved: true,
        });
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: unpublishRequestName },
          'hidden',
        );
        await publicationApiAssertion.assertPublishedResourceAvailability(
          BackendResourceType.APPLICATION,
          publishApiModels.response.resources[0].targetUrl,
          false,
        );
      },
    );
  },
);
