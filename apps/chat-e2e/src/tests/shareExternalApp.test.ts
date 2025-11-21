import { BackendEntity } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { EntityEditorAppTypes, ExpectedConstants } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { ApplicationsUtil, GeneratorUtil } from '@/src/utils';

dialSharedWithMeTest(
  '[External app] Share and open.\n' +
    '[External app] Check the icon and the tooltip for shared app.\n' +
    `[External app] External app is not shown on 'Select an agent for conversation' pop-up.\n` +
    '[External app] Unshare the app',
  async ({
    externalApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    additionalShareUserTooltip,
    additionalShareUserTooltipAssertion,
    additionalShareUserNavigationPanel,
    setTestIds,
    additionalShareUserMarketplacePage,
    additionalShareUserMarketplaceHeader,
    additionalShareUserMarketplaceEntitiesSection,
    additionalShareUserDialHomePage,
    additionalShareUserChat,
    additionalShareUserTalkToAgentDialog,
    additionalShareUserTalkToAgentDialogAssertion,
    additionalShareUserEntityDetailsModal,
    additionalShareUserEntityDetailsModalAssertion,
    additionalShareUserConfirmationDialog,
    additionalShareUserConfirmationDialogAssertion,
    additionalUserShareApiHelper,
    shareApiAssertion,
  }) => {
    setTestIds('EPMRTC-6583', 'EPMRTC-6586', 'EPMRTC-6590', 'EPMRTC-6588');
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomEntityVersion(),
    } as DialAIEntityModel;
    const externalUrl = `http://${GeneratorUtil.randomString(6)}.com`;
    let backendEntity: BackendEntity;
    let externalIcon: BaseElement;
    let agentElement: BaseElement;
    let shareLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Create an external app via API',
      async () => {
        const applicationModel = externalApplicationBuilder
          .withDisplayName(appEntity.name)
          .withDisplayVersion(appEntity.version!)
          .withExternalUrl(externalUrl)
          .withApplicationTypeSchemaId(
            ApplicationsUtil.getAppSchemaByName(
              EntityEditorAppTypes.ExternalApp,
            ),
          )
          .build();
        backendEntity =
          await applicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialSharedWithMeTest.step(
      'Find created app on "DIAL Marketplace", open card dropdown menu and select "Share" option',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
        agentElement = await marketplaceEntitiesSection.findEntityElement(
          appEntity,
          { isWorkspaceEntity: true, isEditable: true },
        );
        await agentElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        const shareLinkRequestResponse = await marketplaceEntities
          .getEntityDropdownMenu()
          .selectShareMenuOption();
        shareLinkResponse = shareLinkRequestResponse!.response;
      },
    );

    await dialSharedWithMeTest.step(
      'Navigate to the share url by another user and verify Marketplace page with opened app card is opened',
      async () => {
        await additionalShareUserMarketplacePage.navigateToUrl(
          ExpectedConstants.sharedAppUrl(shareLinkResponse.invitationLink),
        );
        await additionalShareUserEntityDetailsModalAssertion.assertElementState(
          additionalShareUserEntityDetailsModal,
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step('Verify application details', async () => {
      await additionalShareUserEntityDetailsModalAssertion.assertEntityName(
        appEntity.name,
      );
      await additionalShareUserEntityDetailsModalAssertion.assertEntityVersion(
        appEntity.version!,
      );
      await additionalShareUserEntityDetailsModalAssertion.assertEntityIcon(
        additionalShareUserEntityDetailsModal.icon,
      );
      externalIcon = additionalShareUserEntityDetailsModal.externalAppIcon;
      await additionalShareUserEntityDetailsModalAssertion.assertElementState(
        externalIcon,
        'visible',
      );
      await additionalShareUserEntityDetailsModalAssertion.assertElementAttribute(
        additionalShareUserEntityDetailsModal.openInNewTabButton,
        Attributes.href,
        externalUrl,
      );
      await additionalShareUserEntityDetailsModalAssertion.assertElementAttribute(
        additionalShareUserEntityDetailsModal.openInNewTabButton,
        Attributes.target,
        Attributes.blank,
      );
    });

    await dialSharedWithMeTest.step(
      'Hover over external icon and verify tooltip is displayed',
      async () => {
        await externalIcon.hoverOver();
        await additionalShareUserTooltipAssertion.assertElementText(
          additionalShareUserTooltip,
          ExpectedConstants.externalAppTooltip,
        );
        await additionalShareUserEntityDetailsModal.closeButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Back to chat and verify shared app is not available for a new conversation',
      async () => {
        await additionalShareUserNavigationPanel.backToChat();
        await additionalShareUserDialHomePage.waitForPageLoaded({
          skipSidebars: true,
        });
        await additionalShareUserChat.changeAgentButton.click();
        await additionalShareUserTalkToAgentDialog.selectAgent(appEntity, {
          isAgentVisible: false,
        });
        await additionalShareUserTalkToAgentDialogAssertion.assertElementState(
          additionalShareUserTalkToAgentDialog.noResultFound,
          'visible',
        );
        await additionalShareUserTalkToAgentDialog.cancelButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Find created app on "My Workspace", open the card and verify the app can be unshared',
      async () => {
        await additionalShareUserNavigationPanel.goToMyWorkspace();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserMarketplaceHeader.searchInput.fillInInput(
          appEntity.name,
        );
        agentElement =
          await additionalShareUserMarketplaceEntitiesSection.findEntityElement(
            appEntity,
            { isWorkspaceEntity: true, isEditable: false },
          );
        await agentElement.click();
        await additionalShareUserEntityDetailsModal.unshareButton.click();
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await additionalShareUserConfirmationDialogAssertion.assertElementState(
          additionalShareUserConfirmationDialog,
          'hidden',
        );
        const sharedWithMeApps =
          await additionalUserShareApiHelper.listSharedWithMeApps();
        shareApiAssertion.assertSharedWithMeEntityState(
          sharedWithMeApps,
          backendEntity.url,
          'hidden',
        );
      },
    );
  },
);
