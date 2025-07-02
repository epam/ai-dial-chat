import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { Cursors, ThemeColorAttributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil, SortingUtil } from '@/src/utils';
import { CustomAppAttributes } from '@/src/utils/customApplicationPublishingUtil';
import { ThemesUtil } from '@/src/utils/themesUtil';

dialTest(
  '[Card view] Add an agent with several versions to My workspace using bookmark icon.\n' +
    '[Card view] New version of published app becomes automatically bookmarked if the app is in My workspace.\n' +
    "[Select an agent for conversation] 'My agents' contains only agents from My workspace.\n" +
    '[Card view] Remove an agent with several versions from My workspace using bookmark icon.\n' +
    '[Card view] Bookmark icon highlight and tooltips (add and remove)',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    marketplaceAgents,
    navigationPanel,
    agentDetailsModal,
    confirmationDialog,
    agentDetailsModalAssertion,
    confirmationDialogAssertion,
    localStorageManager,
    setTestIds,
    toast,
    tooltipAssertion,
    toastAssertion,
    marketplaceAgentsAssertion,
    adminCustomApplicationPublishingUtil,
    chat,
    talkToAgents,
    talkToAgentDialogAssertion,
    dialHomePage,
    modelApiHelper,
    talkToAgentDialog,
    fileApiHelper,
  }) => {
    setTestIds(
      'EPMRTC-4602',
      'EPMRTC-5937',
      'EPMRTC-6295',
      'EPMRTC-4605',
      'EPMRTC-5929',
    );
    let recentNames: string[];
    let recentVersions: string[];
    const appName = GeneratorUtil.randomApplicationName();
    let appFirstVersion: CustomAppAttributes;
    let appSecondVersion: CustomAppAttributes;
    let appThirdVersion: CustomAppAttributes;
    let threeSortedVersions: string[];
    let twoSortedVersions: string[];
    let agentToAddElement: BaseElement;
    let workspaceAgentElement: BaseElement;
    let marketplaceAgentElement: BaseElement;
    let removeBookmarkIcon: BaseElement;
    let configAgents: DialAIEntityModel[];

    await dialTest.step(
      'Prepare an application with two versions available in the "Marketplace"',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        recentVersions = ModelsUtil.getRecentAgentsVersions(recentModelIds);

        appFirstVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            appName,
            ...recentNames,
            ...recentVersions,
          );
        appSecondVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            appName,
            ...recentNames,
            ...recentVersions,
            ...appFirstVersion.version,
          );
      },
    );

    await dialTest.step(
      'On the "Marketplace" tab search created agent, hover over bookmark icon and verify tooltip is shown, icon is highlighted',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appName);
        agentToAddElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        const addBookmarkIcon =
          marketplaceAgents.getAgentElementAddBookmarkIcon(agentToAddElement);
        await addBookmarkIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.addToMyWorkspaceTooltip,
        );
        await marketplaceAgentsAssertion.assertElementBorderColors(
          addBookmarkIcon,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await marketplaceAgentsAssertion.assertElementCursor(
          addBookmarkIcon,
          Cursors.pointer,
        );
      },
    );

    await dialTest.step(
      'Click on bookmark icon and verify toast message is shown, bookmark icon is changed',
      async () => {
        await marketplaceAgents.addAgentToWorkspace(agentToAddElement);
        await toastAssertion.assertToastMessage(
          ExpectedConstants.agentAddedToWorkspaceMessage,
        );
        await toast.closeToast();
        await marketplaceAgentsAssertion.assertElementState(
          marketplaceAgents.getAgentElementRemoveBookmarkIcon(
            agentToAddElement,
          ),
          'visible',
        );
        await marketplaceAgentsAssertion.assertElementState(
          marketplaceAgents.getAgentElementAddBookmarkIcon(agentToAddElement),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Go to the "My Workspace" tab and verify agent card with the latest version is displayed',
      async () => {
        await navigationPanel.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        workspaceAgentElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        twoSortedVersions = SortingUtil.sortVersionsArray([
          appFirstVersion.version,
          appSecondVersion.version,
        ]);
        await marketplaceAgentsAssertion.assertElementText(
          marketplaceAgents.getAgentVersion(workspaceAgentElement),
          twoSortedVersions[0],
        );
      },
    );

    await dialTest.step(
      'Go back to the chat, open "Change agent" modal and verify bookmarked agent card is displayed with all the versions',
      async () => {
        configAgents = await modelApiHelper.getModels();
        await navigationPanel.backToChat({ isHttpMethodTriggered: true });
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await chat.changeAgentButton.click();
        const agentElement = talkToAgents.getAgent(appName);
        await talkToAgentDialogAssertion.assertAgentState(appName, 'visible');
        await talkToAgentDialog.getVersionMenuTrigger(agentElement).click();
        //TODO enable when fixed https://github.com/epam/ai-dial-chat/issues/3988
        // await agentVersionsDropdownMenuAssertion.assertMenuOptions(
        //   twoSortedVersions,
        // );
      },
    );

    await dialTest.step(
      'Verify only agents from "My Workspace" are available on "My agents" tab',
      async () => {
        const installedDeploymentsResponse = await fileApiHelper.getFile(
          API.installedDeploymentsHost(),
        );
        const installedDeployments =
          (await installedDeploymentsResponse.json()) as { id: string }[];
        const expectedInstalledDeploymentsNames: string[] = [];
        for (const deployment of installedDeployments) {
          const expectedName = configAgents.find(
            (e) => e.reference === deployment.id,
          )!.name;
          if (!expectedInstalledDeploymentsNames.includes(expectedName)) {
            expectedInstalledDeploymentsNames.push(expectedName);
          }
        }
        const actualAgentNames = await talkToAgents.getAgentNames();
        talkToAgentDialogAssertion.assertArrayIncludesAll(
          actualAgentNames,
          expectedInstalledDeploymentsNames,
          ExpectedMessages.myAgentsListIsValid,
        );
      },
    );

    await dialTest.step(
      'Publish one more version of custom application',
      async () => {
        appThirdVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            appName,
            ...recentNames,
            ...recentVersions,
            ...appFirstVersion.version,
            ...appSecondVersion.version,
          );
      },
    );

    await dialTest.step(
      'Open the agent and verify three versions are available in the dropdown menu, bookmark icon is shown on version switching',
      async () => {
        threeSortedVersions = SortingUtil.sortVersionsArray([
          appFirstVersion.version,
          appSecondVersion.version,
          appThirdVersion.version,
        ]);
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appName);
        await workspaceAgentElement.click();
        await agentDetailsModalAssertion.assertApplicationVersion(
          threeSortedVersions[0],
        );
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'visible',
        );
        for (const version of [
          threeSortedVersions[1],
          threeSortedVersions[2],
        ]) {
          await agentDetailsModal.versionMenuTrigger.click();
          await agentDetailsModal
            .getVersionDropdownMenu()
            .selectMenuOption(version);
          await agentDetailsModalAssertion.assertApplicationVersion(version);
          await agentDetailsModalAssertion.assertElementState(
            agentDetailsModal.removeBookmarkIcon,
            'visible',
          );
        }
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'On the "Marketplace" tab search created agent, click on bookmark icon and verify confirmation popup is shown',
      async () => {
        await navigationPanel.goToMarketplaceHome();
        await marketplacePage.waitForPageLoaded();
        marketplaceAgentElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        removeBookmarkIcon =
          marketplaceAgents.getAgentElementRemoveBookmarkIcon(
            marketplaceAgentElement,
          );
        await removeBookmarkIcon.click();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'visible',
        );
        await confirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.removeAgentModalTitle,
        );
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.removeAgentModalMessage(appName),
        );
      },
    );

    await dialTest.step(
      'Cancel removing and verify confirmation popup is closed, remove bookmark icon is displayed',
      async () => {
        await confirmationDialog.cancelDialog();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'hidden',
        );
        await marketplaceAgentsAssertion.assertElementState(
          marketplaceAgents.getAgentElementRemoveBookmarkIcon(
            marketplaceAgentElement,
          ),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Hover over remove bookmark icon and verify tooltip is shown, icon is highlighted',
      async () => {
        await removeBookmarkIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.removeFromMyWorkspaceTooltip,
        );
        await marketplaceAgentsAssertion.assertElementBorderColors(
          removeBookmarkIcon,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await marketplaceAgentsAssertion.assertElementCursor(
          removeBookmarkIcon,
          Cursors.pointer,
        );
      },
    );

    await dialTest.step(
      'Confirm agent removing and verify add bookmark icon is displayed',
      async () => {
        await removeBookmarkIcon.click();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'visible',
        );
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
        await marketplaceAgentsAssertion.assertElementState(
          removeBookmarkIcon,
          'hidden',
        );
        await marketplaceAgentsAssertion.assertElementState(
          marketplaceAgents.getAgentElementAddBookmarkIcon(
            marketplaceAgentElement,
          ),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Go on the "Marketplace" tab and verify agent is displayed in the suggested list',
      async () => {
        await navigationPanel.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        const allAgents = await marketplaceAgentsSection.getAllAgents();
        marketplaceAgentsAssertion.assertValue(
          allAgents.filter((agent) => agent.isWorkspaceAgent).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        marketplaceAgentsAssertion.assertValue(
          allAgents.filter(
            (agent) => agent.isSuggested && agent.name === appName,
          ).length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );
  },
);

dialTest(
  '[Detailed card view] Add an agent to My workspace using "Use ..." button',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    marketplaceAgents,
    dialHomePage,
    agentDetailsModal,
    agentDetailsModalAssertion,
    localStorageManager,
    setTestIds,
    marketplaceAgentsAssertion,
    adminCustomApplicationPublishingUtil,
  }) => {
    setTestIds('EPMRTC-4465');
    const appName = GeneratorUtil.randomApplicationName();
    let sortedVersions: string[];
    let agentToAddElement: BaseElement;
    let addedAgentElement: BaseElement;

    await dialTest.step(
      'Prepare an application with two versions available in the "Marketplace"',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        const recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        const recentVersions =
          ModelsUtil.getRecentAgentsVersions(recentModelIds);
        const appFirstVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            appName,
            ...recentNames,
            ...recentVersions,
          );
        const appSecondVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            appName,
            ...recentNames,
            ...recentVersions,
            ...appFirstVersion.version,
          );
        sortedVersions = SortingUtil.sortVersionsArray([
          appFirstVersion.version,
          appSecondVersion.version,
        ]);
      },
    );

    await dialTest.step(
      'On the "Marketplace" tab search created agent and open the card',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appName);
        agentToAddElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        await agentToAddElement.click();
      },
    );

    await dialTest.step(
      'Click on "Use application" btn, return to the "My workspace" and verify bookmarked app is displayed in the list',
      async () => {
        await agentDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: true,
        });
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await dialHomePage.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        addedAgentElement = await marketplaceAgentsSection.findAgentElement(
          appName,
          {
            isWorkspaceAgent: true,
          },
        );

        await marketplaceAgentsAssertion.assertElementState(
          marketplaceAgents.getAgentElementRemoveBookmarkIcon(
            agentToAddElement,
          ),
          'visible',
        );
        await marketplaceAgentsAssertion.assertElementState(
          marketplaceAgents.getAgentElementAddBookmarkIcon(agentToAddElement),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open the agent card and verify all versions are available in the dropdown menu, bookmark icon is shown on version switching',
      async () => {
        await addedAgentElement.click();
        await agentDetailsModalAssertion.assertApplicationVersion(
          sortedVersions[0],
        );
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'visible',
        );
        await agentDetailsModal.versionMenuTrigger.click();
        await agentDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[1]);
        await agentDetailsModalAssertion.assertApplicationVersion(
          sortedVersions[1],
        );
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[Detailed card view] Add an agent to My workspace using bookmark.\n' +
    '[Detailed card view] Bookmark icon highlight and tooltips (add and remove).\n' +
    '[Detailed card view] Remove an agent from My workspace using bookmark',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    marketplaceAgents,
    navigationPanel,
    agentDetailsModal,
    tooltipAssertion,
    toast,
    toastAssertion,
    agentDetailsModalAssertion,
    localStorageManager,
    setTestIds,
    confirmationDialog,
    marketplaceAgentsAssertion,
    confirmationDialogAssertion,
    baseAssertion,
    adminCustomApplicationPublishingUtil,
  }) => {
    setTestIds('EPMRTC-4603', 'EPMRTC-5930', 'EPMRTC-4606');
    const appName = GeneratorUtil.randomApplicationName();
    let sortedVersions: string[];
    let agentToAddElement: BaseElement;
    let workspaceAgentElement: BaseElement;

    await dialTest.step(
      'Prepare an application with two versions available in the "Marketplace"',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        const recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        const recentVersions =
          ModelsUtil.getRecentAgentsVersions(recentModelIds);
        const appFirstVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            appName,
            ...recentNames,
            ...recentVersions,
          );
        const appSecondVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            appName,
            ...recentNames,
            ...recentVersions,
            ...appFirstVersion.version,
          );
        sortedVersions = SortingUtil.sortVersionsArray([
          appFirstVersion.version,
          appSecondVersion.version,
        ]);
      },
    );

    await dialTest.step(
      'On the "Marketplace" tab search created agent and open the card',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appName);
        agentToAddElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        await agentToAddElement.click();
      },
    );

    await dialTest.step(
      'Hover over bookmark icon and verify tooltip is shown, icon is highlighted, cursor is changed',
      async () => {
        const addBookmarkIconElement = agentDetailsModal.addBookmarkIcon;
        await addBookmarkIconElement.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.addToMyWorkspaceTooltip,
        );
        await marketplaceAgentsAssertion.assertElementBorderColors(
          addBookmarkIconElement,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await marketplaceAgentsAssertion.assertElementCursor(
          addBookmarkIconElement,
          Cursors.pointer,
        );
      },
    );

    await dialTest.step(
      'Change the version, click on bookmark icon and verify toast message is shown, bookmark icon is changed',
      async () => {
        await agentDetailsModal.versionMenuTrigger.click();
        await agentDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[1]);
        await agentDetailsModal.addAgentToWorkspace();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.agentAddedToWorkspaceMessage,
        );
        await toast.closeToast();
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.addBookmarkIcon,
          'hidden',
        );
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'visible',
        );
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Go to the "My Workspace" tab and verify agent card with the latest version is displayed',
      async () => {
        await navigationPanel.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        workspaceAgentElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        await marketplaceAgentsAssertion.assertElementText(
          marketplaceAgents.getAgentVersion(workspaceAgentElement),
          sortedVersions[0],
        );
      },
    );

    await dialTest.step(
      'Open the agent and verify all versions are available in the dropdown menu, bookmark icon is shown on version switching',
      async () => {
        await workspaceAgentElement.click();
        await agentDetailsModalAssertion.assertApplicationVersion(
          sortedVersions[0],
        );
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'visible',
        );
        await agentDetailsModal.versionMenuTrigger.click();
        await agentDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[1]);
        await agentDetailsModalAssertion.assertApplicationVersion(
          sortedVersions[1],
        );
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Hover over bookmark icon and verify tooltip is shown, icon is highlighted, cursor is changed',
      async () => {
        const removeBookmarkIconElement = agentDetailsModal.removeBookmarkIcon;
        await removeBookmarkIconElement.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.removeFromMyWorkspaceTooltip,
        );
        await marketplaceAgentsAssertion.assertElementBorderColors(
          removeBookmarkIconElement,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await marketplaceAgentsAssertion.assertElementCursor(
          removeBookmarkIconElement,
          Cursors.pointer,
        );
      },
    );

    await dialTest.step(
      'Change the version, click on bookmark icon and verify confirmation modal is shown',
      async () => {
        await agentDetailsModal.versionMenuTrigger.click();
        await agentDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[1]);
        await agentDetailsModal.removeBookmarkIcon.click();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'visible',
        );
        await confirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.removeAgentModalTitle,
        );
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.removeAgentModalMessage(appName),
        );
      },
    );

    await dialTest.step(
      'Cancel removing and verify confirmation popup is closed, remove bookmark icon is displayed',
      async () => {
        await confirmationDialog.cancelDialog();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'hidden',
        );
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Confirm agent removing and verify agent is displayed in the suggested list',
      async () => {
        await agentDetailsModal.removeBookmarkIcon.click();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'visible',
        );
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        const allAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          allAgents.filter((agent) => agent.isWorkspaceAgent).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        const agentElement = await marketplaceAgentsSection.findAgentElement(
          appName,
          { isWorkspaceAgent: false },
        );
        await marketplaceAgentsAssertion.assertElementState(
          marketplaceAgents.getAgentElementAddBookmarkIcon(agentElement),
          'visible',
        );
        await marketplaceAgentsAssertion.assertElementState(
          marketplaceAgents.getAgentElementRemoveBookmarkIcon(agentElement),
          'hidden',
        );
      },
    );
  },
);
