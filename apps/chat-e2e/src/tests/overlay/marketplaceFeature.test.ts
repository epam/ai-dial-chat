import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  AddAppMenuOptions,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
  OverlaySandboxUrls,
  SourcesFilterOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

dialOverlayTest(
  '[Overlay] Navigation panel. There is no text-names for buttons. The hight of the panel is 36px.\n' +
    '[Overlay] DIAL Marketplace feature is enabled - Feature.Marketplace.\n' +
    '[Overlay] Add button on My workspace is available - Feature.CustomApplications',
  async ({
    overlayHomePage,
    overlayChat,
    overlayChatHeader,
    overlayTalkToAgentDialog,
    overlayMarketplace,
    overlayMarketplaceHeader,
    overlayHeader,
    overlayConversations,
    overlayMarketplacePage,
    conversationData,
    overlayBaseAssertion,
    overlayTalkToAgentDialogAssertion,
    overlayDataInjector,
    overlayNavigationPanel,
    overlayAppsDropdownMenuAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2241', 'EPMDIAL-2286', 'EPMDIAL-2293');

    let conversation: Conversation;
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textAccentPrimary,
    );
    let addApp: BaseElement;

    await dialOverlayTest.step('Create simple conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await overlayDataInjector.createConversations([conversation]);
    });

    await dialOverlayTest.step(
      'Verify "DIAL Marketplace" buttons are available at the bottom panel, buttons do not have titles',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableMarketplaceUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        for (const button of [
          overlayNavigationPanel.marketplaceHomeButton,
          overlayNavigationPanel.myWorkspaceButton,
          overlayNavigationPanel.backToChatButton,
        ]) {
          await overlayBaseAssertion.assertElementState(button, 'visible');
          await overlayBaseAssertion.assertElementState(
            overlayNavigationPanel.buttonLabel(button),
            'hidden',
          );
        }
      },
    );

    await dialOverlayTest.step(
      'Click on "Change agent" and verify there is "Search" field available',
      async () => {
        await overlayChat.changeAgentButton.click();
        await overlayTalkToAgentDialogAssertion.assertElementState(
          overlayTalkToAgentDialog.getSearch(),
          'visible',
        );
        await overlayTalkToAgentDialog.getCloseButton().click();
      },
    );

    await dialOverlayTest.step(
      'Select created conversation, click on model icon in the header and verify there is "Search" field available',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(conversation.name);
        await overlayChatHeader.chatModelIcon.click();
        await overlayTalkToAgentDialogAssertion.assertElementState(
          overlayTalkToAgentDialog.getSearch(),
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Click on "Go to my workspace" link and verify workspace page is opened, corresponding btn is highlighted, "Add app" button is visible',
      async () => {
        await overlayTalkToAgentDialog.goToMyWorkspace();
        await overlayBaseAssertion.assertElementState(
          overlayMarketplace,
          'visible',
        );
        await overlayBaseAssertion.assertElementColor(
          overlayNavigationPanel.myWorkspaceButtonIcon,
          expectedColor,
        );
        addApp = overlayMarketplaceHeader.addAppButton;
        await overlayBaseAssertion.assertElementState(addApp, 'visible');
      },
    );

    await dialOverlayTest.step(
      'Expand "Add app" button and verify only "Custom app" option is available',
      async () => {
        await addApp.click();
        await overlayAppsDropdownMenuAssertion.assertMenuIncludesOptions(
          AddAppMenuOptions.customApp,
          AddAppMenuOptions.externalApp,
        );
        await overlayAppsDropdownMenuAssertion.assertMenuExcludesOptions(
          AddAppMenuOptions.codeApp,
        );
      },
    );

    await dialOverlayTest.step(
      'Click on "Back to chat" button and verify it is highlighted',
      async () => {
        await overlayNavigationPanel.backToChat({
          isHttpMethodTriggered: true,
        });
        await overlayBaseAssertion.assertElementColor(
          overlayNavigationPanel.backToChatButtonIcon,
          expectedColor,
        );
        await overlayChat.waitForState();
        await overlayHeader.waitForState();
      },
    );

    await dialOverlayTest.step(
      'Open "Select an agent for conversation" modal, switch to "All agents" tab and verify there is "Go to DIAL Marketplace" link is available',
      async () => {
        await overlayChat.getChatHeader().chatModelIcon.click();
        await overlayTalkToAgentDialog.allAgentsTab.click();
        await overlayTalkToAgentDialogAssertion.assertElementState(
          overlayTalkToAgentDialog.goToDialMarketplaceButton,
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Click on the link and verify DIAL Marketplace is opened, corresponding btn is highlighted',
      async () => {
        await overlayTalkToAgentDialog.goToDialMarketplaceButton.click();
        await overlayMarketplacePage.waitForPageLoaded();
        await overlayBaseAssertion.assertElementColor(
          overlayNavigationPanel.marketplaceHomeButtonIcon,
          expectedColor,
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] DIAL Marketplace feature is disabled - Feature.Marketplace',
  async ({
    overlayHomePage,
    overlayChat,
    overlayTalkToAgentDialog,
    overlayTalkToAgentDialogAssertion,
    overlayNavigationPanel,
    overlayBaseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2298');

    await dialOverlayTest.step(
      'Verify bottom navigation buttons are not available',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.disableMarketplaceUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayBaseAssertion.assertElementState(
          overlayNavigationPanel.marketplaceHomeButton,
          'hidden',
        );
        await overlayBaseAssertion.assertElementState(
          overlayNavigationPanel.myWorkspaceButton,
          'hidden',
        );
        await overlayBaseAssertion.assertElementState(
          overlayNavigationPanel.backToChatButton,
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Click on "Change agent" and verify there is no "Go to My workspace" button',
      async () => {
        await overlayChat.changeAgentButton.click();
        await overlayTalkToAgentDialogAssertion.assertElementState(
          overlayTalkToAgentDialog.goToMyWorkspaceButton,
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Switch to "All agents" tab and verify there is no "Go to DIAL Marketplace" button',
      async () => {
        await overlayTalkToAgentDialog.allAgentsTab.click();
        await overlayTalkToAgentDialogAssertion.assertElementState(
          overlayTalkToAgentDialog.goToDialMarketplaceButton,
          'hidden',
        );
        await overlayTalkToAgentDialog.getCloseButton().click();
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] Add button on My workspace is unavailable even though Code apps and schemas exist, but CustomApplications is disabled',
  async ({
    overlayHomePage,
    overlayMarketplacePage,
    overlayMarketplaceHeader,
    overlayBaseAssertion,
    overlayNavigationPanel,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2297');

    await dialOverlayTest.step(
      'Go to "My Workspace" page and verify "Add App" button is not available',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.disabledCustomAppUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayNavigationPanel.myWorkspaceButton.click();
        await overlayMarketplacePage.waitForPageLoaded();
        const addAppBtn = overlayMarketplaceHeader.addAppButton;
        await overlayBaseAssertion.assertElementState(addAppBtn, 'hidden');
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] Add button: Code app - Feature.CodeApps.\n' +
    '[Overlay] enable Feature.MarketplaceTableView p1,2',
  async ({
    overlayHomePage,
    overlayMarketplacePage,
    overlayMarketplaceHeader,
    overlayBaseAssertion,
    overlayNavigationPanel,
    overlayAppsDropdownMenuAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2295', 'EPMDIAL-2307');
    let addAppBtn: BaseElement;

    await dialOverlayTest.step(
      'Go to "My Workspace" page and verify "Add App" button is available, card/table view toggles are not visible',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledCodeAppUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayNavigationPanel.myWorkspaceButton.click();
        await overlayMarketplacePage.waitForPageLoaded();
        addAppBtn = overlayMarketplaceHeader.addAppButton;
        await overlayBaseAssertion.assertElementState(addAppBtn, 'visible');
        await overlayBaseAssertion.assertElementState(
          overlayMarketplaceHeader.cardViewToggle,
          'hidden',
        );
        await overlayBaseAssertion.assertElementState(
          overlayMarketplaceHeader.tableViewToggle,
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Expand "Add app" button and verify "Custom app" and "Code app" options are available',
      async () => {
        await addAppBtn.click();
        await overlayAppsDropdownMenuAssertion.assertMenuIncludesOptions(
          AddAppMenuOptions.customApp,
          AddAppMenuOptions.codeApp,
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] enable Feature.MarketplaceTableView p. 3,4',
  async ({
    overlayHomePage,
    overlayMarketplacePage,
    overlayMarketplaceHeader,
    overlayBaseAssertion,
    overlayNavigationPanel,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2307');

    await dialOverlayTest.step(
      'Go to "My Workspace" page and verify card/table view toggles are visible',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledMarketplaceTableViewUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayNavigationPanel.myWorkspaceButton.click();
        await overlayMarketplacePage.waitForPageLoaded();
        await overlayBaseAssertion.assertElementState(
          overlayMarketplaceHeader.cardViewToggle,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayMarketplaceHeader.tableViewToggle,
          'visible',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] My application has Share option - Feature.ApplicationsSharing p. 1-3',
  async ({
    overlayHomePage,
    overlayMarketplacePage,
    overlayHeader,
    overlayBaseAssertion,
    overlayNavigationPanel,
    customApplicationBuilder,
    adminApplicationApiHelper,
    overlayApplicationApiHelper,
    overlayShareApiHelper,
    adminShareApiHelper,
    overlayMarketplaceSidebar,
    overlayMarketplaceFilter,
    overlayMarketplaceEntitiesSection,
    overlayMarketplaceEntities,
    overlayAgentDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2311');
    const sharedAppName = GeneratorUtil.randomApplicationName();
    const customAppName = GeneratorUtil.randomApplicationName();

    await dialOverlayTest.step(
      'By admin create a custom application and share it with the main user',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(sharedAppName)
          .build();
        const backendApp =
          await adminApplicationApiHelper.createApplication(applicationModel);
        const shareByLinkResponse =
          await adminShareApiHelper.shareAppByLink(backendApp);
        await overlayShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialOverlayTest.step(
      'By main user create a custom application available in "My Workspace"',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(customAppName)
          .build();
        await overlayApplicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialOverlayTest.step(
      'Go to "My Workspace" page and verify "Shared with me" filter option is available',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableMarketplaceUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayNavigationPanel.myWorkspaceButton.click();
        await overlayMarketplacePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayMarketplaceSidebar.waitForState();
        const sourceFilterOptions =
          await overlayMarketplaceFilter.filterByPropertyOptionLabels(
            MarketplaceFilterTypes.sources,
          );
        overlayBaseAssertion.assertArrayIncludesAll(
          sourceFilterOptions,
          [SourcesFilterOptions.sharedWithMe],
          MarketplaceExpectedMessages.filterOptionsAreValid,
        );
        await overlayMarketplaceSidebar.closeButton.click();
      },
    );

    await dialOverlayTest.step(
      'Open dropdown menu for created app and verify "Shared" option is not available',
      async () => {
        const agentElement =
          await overlayMarketplaceEntitiesSection.findEntityElement(
            customAppName,
          );
        await overlayMarketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        const actualMenuOptions =
          await overlayAgentDropdownMenu.getAllMenuOptions();
        overlayBaseAssertion.assertArrayExcludesAll(
          actualMenuOptions,
          [MenuOptions.share],
          MarketplaceExpectedMessages.agentMenuOptionsAreValid,
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] My application has Share option - Feature.ApplicationsSharing p. 4-6',
  async ({
    overlayHomePage,
    overlayMarketplacePage,
    overlayBaseAssertion,
    overlayNavigationPanel,
    customApplicationBuilder,
    overlayApplicationApiHelper,
    overlayMarketplaceEntitiesSection,
    overlayMarketplaceEntities,
    overlayAgentDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2311');
    const customAppName = GeneratorUtil.randomApplicationName();

    await dialOverlayTest.step(
      'By main user create a custom application available in "My Workspace"',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(customAppName)
          .build();
        await overlayApplicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialOverlayTest.step(
      'Go to "My Workspace" page, open dropdown menu for created app and verify "Shared" option is available',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledAppSharingUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayNavigationPanel.myWorkspaceButton.click();
        await overlayMarketplacePage.waitForPageLoaded();
        const agentElement =
          await overlayMarketplaceEntitiesSection.findEntityElement(
            customAppName,
          );
        await overlayMarketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        const actualMenuOptions =
          await overlayAgentDropdownMenu.getAllMenuOptions();
        overlayBaseAssertion.assertArrayIncludesAll(
          actualMenuOptions,
          [MenuOptions.share],
          MarketplaceExpectedMessages.agentMenuOptionsAreValid,
        );
      },
    );
  },
);
