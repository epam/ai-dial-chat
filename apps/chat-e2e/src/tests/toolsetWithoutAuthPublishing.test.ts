import dialAdminTest from '@/src/core/dialAdminFixtures';
import { ExpectedConstants, MenuOptions } from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

dialAdminTest(
  'Create publish request toolset without auth.\n' +
    '[Toolset]: Login option is not displayed for public toolsets without authentication.\n' +
    'Review publication request for toolset without auth',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    toolsetBuilder,
    setTestIds,
    publishingRequestDialog,
    publishingRequestDialogAssertion,
    toolsetToPublishAssertion,
    adminPublishingApprovalModal,
    adminPublishedToolsetReviewModal,
    adminPublishedToolsetReviewModalAssertion,
    adminApproveRequiredPromptsAssertion,
    adminMarketplaceHeader,
    adminMarketplaceEntitiesSection,
    adminMarketplaceEntities,
    toast,
    toastAssertion,
    adminLocalStorageManager,
    adminDialHomePage,
    adminApproveRequiredPrompts,
    adminToolsetToApproveAssertion,
    toolsetApiHelper,
    adminMarketplacePage,
    baseAssertion,
    adminEntityDetailsModal,
  }) => {
    setTestIds('EPMDIAL-5478', 'EPMDIAL-5527', 'EPMDIAL-5511');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let toolsetElement: BaseElement;

    await dialAdminTest.step(
      'Precondition: Create toolset via API',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(toolsetEntity.version)
          .withEndpoint(toolsetEntity.endpoint)
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
      },
    );

    await dialAdminTest.step(
      `Find the toolset and select "Publish" option from card's dots menu`,
      async () => {
        await marketplacePage.openMyWorkspacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        toolsetElement = await marketplaceEntitiesSection.findEntityElement(
          toolsetEntity.name,
        );
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.publish);
      },
    );

    await dialAdminTest.step(
      'Verify Publish request modal is opened for the toolset, Credentials are not visible',
      async () => {
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await toolsetToPublishAssertion.assertToolsetCredentials({
          expectedState: 'hidden',
        });
      },
    );

    await dialAdminTest.step(
      'Send the request and verify successful toast is shown',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(requestName);
        await publishingRequestDialog.sendPublicationRequest();
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
        await toastAssertion.assertToastMessage(
          ExpectedConstants.successfulPublishingMessage,
        );
        await toast.closeToast();
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify toolset publishing request without credentials is available is under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(requestName);
        await adminToolsetToApproveAssertion.assertToolsetCredentials({
          expectedState: 'hidden',
        });
      },
    );

    await dialAdminTest.step(
      'Go to toolset review and verify authentication type',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedToolsetReviewModalAssertion.assertToolsetAttributes(
          { expectedAuthenticationType: ToolsetAuthTypes.NONE },
        );
      },
    );
    await dialAdminTest.step('Go back and approve the request', async () => {
      await adminPublishedToolsetReviewModal
        .getPublicationReviewControl()
        .backToPublicationRequest();
      await adminPublishingApprovalModal.approveRequest();
      await adminApproveRequiredPromptsAssertion.assertFolderState(
        { name: requestName },
        'hidden',
      );
    });

    await dialAdminTest.step(
      `Find publicated toolset and verify no login option is available neither on card nor in the dots menu`,
      async () => {
        await adminMarketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: true,
          getStyles: false,
        });
        await adminMarketplacePage.waitForPageLoaded();
        await adminMarketplaceHeader.toolsetsTab.click();
        await adminMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await adminMarketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
          );
        await toolsetElement.hoverOver();
        await adminMarketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        const menuOption = adminMarketplaceEntities
          .getEntityDropdownMenu()
          .menuOption(MenuOptions.login);
        await baseAssertion.assertElementState(menuOption, 'hidden');

        await toolsetElement.click();
        await baseAssertion.assertElementState(
          adminEntityDetailsModal.loginButton,
          'hidden',
        );
      },
    );
  },
);
