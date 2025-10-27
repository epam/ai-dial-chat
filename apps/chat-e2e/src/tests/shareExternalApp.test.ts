import { BackendEntity } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { AppEditorAppTypes, ExpectedConstants } from '@/src/testData';
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
    marketplaceAgentsSection,
    marketplaceAgents,
    additionalShareUserTooltip,
    additionalShareUserTooltipAssertion,
    additionalShareUserNavigationPanel,
    setTestIds,
    additionalShareUserMarketplacePage,
    additionalShareUserMarketplaceHeader,
    additionalShareUserMarketplaceAgentsSection,
    additionalShareUserDialHomePage,
    additionalShareUserChat,
    additionalShareUserTalkToAgentDialog,
    additionalShareUserTalkToAgentDialogAssertion,
    additionalShareUserAgentDetailsModal,
    additionalShareUserAgentDetailsModalAssertion,
    additionalShareUserConfirmationDialog,
    additionalShareUserConfirmationDialogAssertion,
    additionalUserShareApiHelper,
    shareApiAssertion,
  }) => {
    setTestIds('EPMRTC-6583', 'EPMRTC-6586', 'EPMRTC-6590', 'EPMRTC-6588');
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomApplicationVersion(),
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
            ApplicationsUtil.getAppSchemaByName(AppEditorAppTypes.ExternalApp),
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
        agentElement = await marketplaceAgentsSection.findAgentElement(
          appEntity,
          { isWorkspaceAgent: true, isEditable: true },
        );
        await agentElement.hoverOver();
        await marketplaceAgents.getAgentElementDotsMenu(agentElement).click();
        const shareLinkRequestResponse = await marketplaceAgents
          .getAgentDropdownMenu()
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
        await additionalShareUserAgentDetailsModalAssertion.assertElementState(
          additionalShareUserAgentDetailsModal,
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step('Verify application details', async () => {
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationName(
        appEntity.name,
      );
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationVersion(
        appEntity.version!,
      );
      await additionalShareUserAgentDetailsModalAssertion.assertEntityIcon(
        additionalShareUserAgentDetailsModal.icon,
      );
      externalIcon = additionalShareUserAgentDetailsModal.externalAppIcon;
      await additionalShareUserAgentDetailsModalAssertion.assertElementState(
        externalIcon,
        'visible',
      );
      await additionalShareUserAgentDetailsModalAssertion.assertElementAttribute(
        additionalShareUserAgentDetailsModal.openInNewTabButton,
        Attributes.href,
        externalUrl,
      );
      await additionalShareUserAgentDetailsModalAssertion.assertElementAttribute(
        additionalShareUserAgentDetailsModal.openInNewTabButton,
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
        await additionalShareUserAgentDetailsModal.closeButton.click();
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
          await additionalShareUserMarketplaceAgentsSection.findAgentElement(
            appEntity,
            { isWorkspaceAgent: true, isEditable: false },
          );
        await agentElement.click();
        await additionalShareUserAgentDetailsModal.unshareButton.click();
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
