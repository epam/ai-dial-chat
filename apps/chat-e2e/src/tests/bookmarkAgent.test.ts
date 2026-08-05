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
    marketplaceEntitiesSection,
    marketplaceEntities,
    navigationPanel,
    entityDetailsModal,
    confirmationDialog,
    entityDetailsModalAssertion,
    confirmationDialogAssertion,
    localStorageManager,
    setTestIds,
    toast,
    tooltipAssertion,
    toastAssertion,
    baseAssertion,
    adminCustomApplicationPublishingUtil,
    chat,
    talkToAgents,
    talkToAgentDialogAssertion,
    dialHomePage,
    modelApiHelper,
    talkToAgentDialog,
    entityVersionsDropdownMenuAssertion,
    fileApiHelper,
  }) => {
    setTestIds(
      'EPMDIAL-2569',
      'EPMDIAL-2573',
      'EPMDIAL-5857',
      'EPMDIAL-2570',
      'EPMDIAL-2572',
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
    let searchInput: BaseElement;

    await dialTest.step(
      'Prepare an application with two versions available in the "Marketplace"',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        recentVersions = ModelsUtil.getRecentAgentsVersions(recentModelIds);

        appFirstVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            {
              appName: appName,
              namesToExclude: recentNames.concat(recentVersions),
            },
          );
        appSecondVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            {
              appName: appName,
              namesToExclude: recentNames
                .concat(recentVersions)
                .concat(appFirstVersion.version!),
            },
          );
      },
    );

    await dialTest.step(
      'On the "Marketplace" tab search created agent, hover over bookmark icon and verify tooltip is shown, icon is highlighted',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(appName);
        agentToAddElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        const addBookmarkIcon =
          marketplaceEntities.getEntityElementAddBookmarkIcon(
            agentToAddElement,
          );
        await addBookmarkIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.addToMyWorkspaceTooltip,
        );
        await baseAssertion.assertElementBorderColors(
          addBookmarkIcon,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await baseAssertion.assertElementCursor(
          addBookmarkIcon,
          Cursors.pointer,
        );
      },
    );

    await dialTest.step(
      'Click on bookmark icon and verify toast message is shown, bookmark icon is changed',
      async () => {
        await marketplaceEntities.addEntityToWorkspace(agentToAddElement);
        await toastAssertion.assertToastMessage(
          ExpectedConstants.agentAddedToWorkspaceMessage,
        );
        await toast.closeToast();
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(
            agentToAddElement,
          ),
          'visible',
        );
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementAddBookmarkIcon(
            agentToAddElement,
          ),
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
          await marketplaceEntitiesSection.findEntityElement(appName);
        twoSortedVersions = SortingUtil.sortVersionsArray([
          appFirstVersion.version!,
          appSecondVersion.version!,
        ]);
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityVersion(workspaceAgentElement),
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
        const agentElement = talkToAgents.getEntity(appName);
        await talkToAgentDialogAssertion.assertAgentState(appName, 'visible');
        await talkToAgentDialog.getVersionMenuTrigger(agentElement).click();
        await entityVersionsDropdownMenuAssertion.assertMenuOptions(
          twoSortedVersions,
        );
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
        const actualAgentNames = await talkToAgents.getEntityNames();
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
            {
              appName: appName,
              namesToExclude: recentNames
                .concat(recentVersions)
                .concat(appFirstVersion.version!)
                .concat(appSecondVersion.version!),
            },
          );
      },
    );

    await dialTest.step(
      'Open the agent and verify three versions are available in the dropdown menu, bookmark icon is shown on version switching',
      async () => {
        threeSortedVersions = SortingUtil.sortVersionsArray([
          appFirstVersion.version!,
          appSecondVersion.version!,
          appThirdVersion.version!,
        ]);
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
        });
        await marketplacePage.waitForPageLoaded();
        await searchInput.fillInInput(appName);
        await workspaceAgentElement.click();
        await entityDetailsModalAssertion.assertEntityVersion(
          threeSortedVersions[0],
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.removeBookmarkIcon,
          'visible',
        );
        for (const version of [
          threeSortedVersions[1],
          threeSortedVersions[2],
        ]) {
          await entityDetailsModal.versionMenuTrigger.click();
          await entityDetailsModal
            .getVersionDropdownMenu()
            .selectMenuOption(version);
          await entityDetailsModalAssertion.assertEntityVersion(version);
          await entityDetailsModalAssertion.assertElementState(
            entityDetailsModal.removeBookmarkIcon,
            'visible',
          );
        }
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'On the "Marketplace" tab search created agent, click on bookmark icon and verify confirmation popup is shown',
      async () => {
        await navigationPanel.goToMarketplaceHome();
        await marketplacePage.waitForPageLoaded();
        marketplaceAgentElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        removeBookmarkIcon =
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(
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
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(
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
        await baseAssertion.assertElementBorderColors(
          removeBookmarkIcon,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await baseAssertion.assertElementCursor(
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
        await baseAssertion.assertElementState(removeBookmarkIcon, 'hidden');
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementAddBookmarkIcon(
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
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          allAgents.filter((agent) => agent.isWorkspaceEntity).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertValue(
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
    marketplaceEntitiesSection,
    marketplaceEntities,
    dialHomePage,
    entityDetailsModal,
    entityDetailsModalAssertion,
    localStorageManager,
    setTestIds,
    baseAssertion,
    adminCustomApplicationPublishingUtil,
  }) => {
    setTestIds('EPMDIAL-2613');
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
            {
              appName: appName,
              namesToExclude: recentNames.concat(recentVersions),
            },
          );
        const appSecondVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            {
              appName: appName,
              namesToExclude: recentNames
                .concat(recentVersions)
                .concat(appFirstVersion.version!),
            },
          );
        sortedVersions = SortingUtil.sortVersionsArray([
          appFirstVersion.version!,
          appSecondVersion.version!,
        ]);
      },
    );

    await dialTest.step(
      'On the "Marketplace" tab search created agent and open the card',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.getSearch().inputField.fillInInput(appName);
        agentToAddElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        await agentToAddElement.click();
      },
    );

    await dialTest.step(
      'Click on "Use application" btn, return to the "My workspace" and verify bookmarked app is displayed in the list',
      async () => {
        await entityDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: true,
        });
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await dialHomePage.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        addedAgentElement = await marketplaceEntitiesSection.findEntityElement(
          appName,
          {
            isWorkspaceEntity: true,
          },
        );

        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(
            agentToAddElement,
          ),
          'visible',
        );
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementAddBookmarkIcon(
            agentToAddElement,
          ),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open the agent card and verify all versions are available in the dropdown menu, bookmark icon is shown on version switching',
      async () => {
        await addedAgentElement.click();
        await entityDetailsModalAssertion.assertEntityVersion(
          sortedVersions[0],
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.removeBookmarkIcon,
          'visible',
        );
        await entityDetailsModal.versionMenuTrigger.click();
        await entityDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[1]);
        await entityDetailsModalAssertion.assertEntityVersion(
          sortedVersions[1],
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.removeBookmarkIcon,
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
    marketplaceEntitiesSection,
    marketplaceEntities,
    navigationPanel,
    entityDetailsModal,
    tooltipAssertion,
    toast,
    toastAssertion,
    entityDetailsModalAssertion,
    localStorageManager,
    setTestIds,
    confirmationDialog,
    confirmationDialogAssertion,
    baseAssertion,
    adminCustomApplicationPublishingUtil,
  }) => {
    setTestIds('EPMDIAL-2614', 'EPMDIAL-2617', 'EPMDIAL-2615');
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
            {
              appName: appName,
              namesToExclude: recentNames.concat(recentVersions),
            },
          );
        const appSecondVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            {
              appName: appName,
              namesToExclude: recentNames
                .concat(recentVersions)
                .concat(appFirstVersion.version!),
            },
          );
        sortedVersions = SortingUtil.sortVersionsArray([
          appFirstVersion.version!,
          appSecondVersion.version!,
        ]);
      },
    );

    await dialTest.step(
      'On the "Marketplace" tab search created agent and open the card',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.getSearch().inputField.fillInInput(appName);
        agentToAddElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        await agentToAddElement.click();
      },
    );

    await dialTest.step(
      'Hover over bookmark icon and verify tooltip is shown, icon is highlighted, cursor is changed',
      async () => {
        const addBookmarkIconElement = entityDetailsModal.addBookmarkIcon;
        await addBookmarkIconElement.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.addToMyWorkspaceTooltip,
        );
        await baseAssertion.assertElementBorderColors(
          addBookmarkIconElement,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await baseAssertion.assertElementCursor(
          addBookmarkIconElement,
          Cursors.pointer,
        );
      },
    );

    await dialTest.step(
      'Change the version, click on bookmark icon and verify toast message is shown, bookmark icon is changed',
      async () => {
        await entityDetailsModal.versionMenuTrigger.click();
        await entityDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[1]);
        await entityDetailsModal.addEntityToWorkspace();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.agentAddedToWorkspaceMessage,
        );
        await toast.closeToast();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.addBookmarkIcon,
          'hidden',
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.removeBookmarkIcon,
          'visible',
        );
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Go to the "My Workspace" tab and verify agent card with the latest version is displayed',
      async () => {
        await navigationPanel.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        workspaceAgentElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityVersion(workspaceAgentElement),
          sortedVersions[0],
        );
      },
    );

    await dialTest.step(
      'Open the agent and verify all versions are available in the dropdown menu, bookmark icon is shown on version switching',
      async () => {
        await workspaceAgentElement.click();
        await entityDetailsModalAssertion.assertEntityVersion(
          sortedVersions[0],
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.removeBookmarkIcon,
          'visible',
        );
        await entityDetailsModal.versionMenuTrigger.click();
        await entityDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[1]);
        await entityDetailsModalAssertion.assertEntityVersion(
          sortedVersions[1],
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.removeBookmarkIcon,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Hover over bookmark icon and verify tooltip is shown, icon is highlighted, cursor is changed',
      async () => {
        const removeBookmarkIconElement = entityDetailsModal.removeBookmarkIcon;
        await removeBookmarkIconElement.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.removeFromMyWorkspaceTooltip,
        );
        await baseAssertion.assertElementBorderColors(
          removeBookmarkIconElement,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await baseAssertion.assertElementCursor(
          removeBookmarkIconElement,
          Cursors.pointer,
        );
      },
    );

    await dialTest.step(
      'Change the version, click on bookmark icon and verify confirmation modal is shown',
      async () => {
        await entityDetailsModal.versionMenuTrigger.click();
        await entityDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[1]);
        await entityDetailsModal.removeBookmarkIcon.click();
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
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.removeBookmarkIcon,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Confirm agent removing and verify agent is displayed in the suggested list',
      async () => {
        await entityDetailsModal.removeBookmarkIcon.click();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'visible',
        );
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          allAgents.filter((agent) => agent.isWorkspaceEntity).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        const agentElement = await marketplaceEntitiesSection.findEntityElement(
          appName,
          { isWorkspaceEntity: false },
        );
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementAddBookmarkIcon(agentElement),
          'visible',
        );
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(agentElement),
          'hidden',
        );
      },
    );
  },
);
