import { Publication } from '@/chat/types/publication';
import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  ExpectedConstants,
  ExpectedMessages,
  MarketplaceExpectedMessages,
} from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { BaseElement, MarketplaceAgentProperties } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil, SortingUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  `Search in My workspace: 'No results found' and suggest results.\n` +
    `Search in My workspace: 'No results found' and no suggested results.\n` +
    'Search in My workspace when nothing to suggest from DIAL Marketplace. No suggested options.\n' +
    'Search in My workspace. Search by version. No suggested options.\n' +
    'Search by not used version to find models in My workspace',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    marketplaceAgents,
    marketplace,
    agentDetailsModal,
    localStorageManager,
    setTestIds,
    baseAssertion,
    customApplicationBuilder,
    applicationApiHelper,
    adminApplicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    agentVersionsDropdownMenuAssertion,
  }) => {
    setTestIds(
      'EPMRTC-4424',
      'EPMRTC-4614',
      'EPMRTC-4616',
      'EPMRTC-4502',
      'EPMRTC-4659',
    );
    let installedAppVersion: string;
    let installedAppName: string;
    let nonInstalledAppFirstVersion: string;
    let nonInstalledAppSecondVersion: string;
    let nonInstalledAppName: string;
    let foundSuggestedAgentElement: BaseElement;

    await dialTest.step(
      'Prepare one application visible in "My Workspace" and one available in the "Marketplace", both have unique name and version',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        const recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        const recentVersions =
          ModelsUtil.getRecentAgentsVersions(recentModelIds);

        installedAppVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
        ]);
        installedAppName = GeneratorUtil.randomApplicationName();
        const installedCustomApplicationModel = customApplicationBuilder
          .withDisplayName(installedAppName)
          .withDisplayVersion(installedAppVersion)
          .build();

        nonInstalledAppFirstVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
          installedAppVersion,
        ]);
        nonInstalledAppSecondVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
          installedAppVersion,
          nonInstalledAppFirstVersion,
        ]);
        nonInstalledAppName = GeneratorUtil.randomApplicationName();
        const nonInstalledFirstCustomApplicationModel = customApplicationBuilder
          .withDisplayName(nonInstalledAppName)
          .withDisplayVersion(nonInstalledAppFirstVersion)
          .build();
        const nonInstalledSecondCustomApplicationModel =
          customApplicationBuilder
            .withDisplayName(nonInstalledAppName)
            .withDisplayVersion(nonInstalledAppSecondVersion)
            .build();

        //create app by main user in order to have it in My Workspace
        await applicationApiHelper.createApplication(
          installedCustomApplicationModel,
        );
        //create app with different versions by admin user and publish it in order to have it in the Marketplace
        for (const appModel of [
          nonInstalledFirstCustomApplicationModel,
          nonInstalledSecondCustomApplicationModel,
        ]) {
          const adminApp =
            await adminApplicationApiHelper.createApplication(appModel);
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withApplicationResource(adminApp, PublishActions.ADD)
            .build();
          const appPublication =
            await adminPublicationApiHelper.createPublishRequest(
              publishRequest,
            );
          publicationsToUnpublish.push(appPublication);
          await adminPublicationApiHelper.approveRequest(appPublication);
        }
      },
    );

    await dialTest.step(
      'Open "My Workspace", search by not installed agent name and verify no results label is displayed, agents from Marketplace are suggested',
      async () => {
        await marketplacePage.openMyWorkspacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(nonInstalledAppName);
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        const actualFilteredAgents = actualAgents.filter(
          (agent) => agent.isWorkspaceAgent,
        );
        baseAssertion.assertValue(
          actualFilteredAgents.length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        await baseAssertion.assertElementState(
          marketplace.noWorkspaceResultsFound,
          'visible',
        );
        await baseAssertion.assertElementText(
          marketplace.noWorkspaceResultsFound,
          ExpectedConstants.noWorkspaceAgentsFoundMessage,
        );
        await baseAssertion.assertElementState(
          marketplace.noWorkspaceResultsFoundIcon,
          'visible',
        );

        await baseAssertion.assertElementState(
          marketplace.marketplaceSuggestionsLabel,
          'visible',
        );
        const actualSuggestedAgents = actualAgents.filter(
          (agent) => agent.isSuggested,
        );
        baseAssertion.assertValue(
          actualSuggestedAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedAgents.map((agent) => agent.name),
          [nonInstalledAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
      },
    );

    await dialTest.step(
      'Search by non existent agent name and verify no results label is displayed',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(
          GeneratorUtil.randomString(20),
        );
        await baseAssertion.assertElementState(
          marketplace.noResultsFound,
          'visible',
        );
        await baseAssertion.assertElementText(
          marketplace.noResultsFound,
          ExpectedConstants.noResults,
        );
        await baseAssertion.assertElementText(
          marketplace.noResultsFoundDescription,
          ExpectedConstants.noMarketplaceAgentsFoundMessage,
        );
        await baseAssertion.assertElementState(
          marketplace.noResultsFoundIcon,
          'visible',
        );
        await baseAssertion.assertElementState(
          marketplaceAgentsSection,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Search by installed agent name and verify no Marketplace agents are suggested',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(installedAppName);
        await baseAssertion.assertElementState(
          marketplace.marketplaceSuggestionsLabel,
          'hidden',
        );
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          actualAgents.filter((agent) => agent.isSuggested).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );

        const filteredAgents = actualAgents.filter(
          (agent) => agent.isWorkspaceAgent,
        );
        baseAssertion.assertValue(
          filteredAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredAgents.map((agent) => agent.name),
          [installedAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
      },
    );

    await dialTest.step(
      'Search by unique installed agent version and verify agent is displayed, no Marketplace agents are suggested',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(installedAppVersion);
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        const filteredAgents = actualAgents.filter(
          (agent) => agent.isWorkspaceAgent,
        );
        baseAssertion.assertValue(
          filteredAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredAgents.map((agent) => agent.name),
          [installedAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
        await baseAssertion.assertElementState(
          marketplace.marketplaceSuggestionsLabel,
          'hidden',
        );
        baseAssertion.assertValue(
          actualAgents.filter((agent) => agent.isSuggested).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );

    await dialTest.step(
      'Open found agent and verify no versions menu is available',
      async () => {
        const foundAgent =
          await marketplaceAgentsSection.findAgentElement(installedAppName);
        await foundAgent.click();
        await baseAssertion.assertElementState(
          agentDetailsModal.versionMenuTrigger,
          'hidden',
        );
        await baseAssertion.assertElementText(
          agentDetailsModal.agentVersion,
          installedAppVersion,
        );
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Search by not installed agent version and verify no results label is displayed, agent with searched version is suggested',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(
          nonInstalledAppSecondVersion,
        );
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          actualAgents.filter((agent) => agent.isWorkspaceAgent).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        await baseAssertion.assertElementState(
          marketplace.noWorkspaceResultsFound,
          'visible',
        );
        await baseAssertion.assertElementText(
          marketplace.noWorkspaceResultsFound,
          ExpectedConstants.noWorkspaceAgentsFoundMessage,
        );
        await baseAssertion.assertElementState(
          marketplace.noWorkspaceResultsFoundIcon,
          'visible',
        );

        await baseAssertion.assertElementState(
          marketplace.marketplaceSuggestionsLabel,
          'visible',
        );
        const actualSuggestedAgents = actualAgents.filter(
          (agent) => agent.isSuggested,
        );
        baseAssertion.assertValue(
          actualSuggestedAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedAgents.map((agent) => agent.name),
          [nonInstalledAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );

        foundSuggestedAgentElement =
          await marketplaceAgentsSection.findAgentElement(nonInstalledAppName);
        const actualSuggestedAgentVersion = marketplaceAgents.getAgentVersion(
          foundSuggestedAgentElement,
        );
        await baseAssertion.assertElementText(
          actualSuggestedAgentVersion,
          nonInstalledAppSecondVersion,
        );
      },
    );

    await dialTest.step(
      'Open suggested agent and verify set version are available in dropdown menu versions',
      async () => {
        await foundSuggestedAgentElement.click();
        await baseAssertion.assertElementText(
          agentDetailsModal.agentVersion,
          nonInstalledAppSecondVersion,
        );
        await agentDetailsModal.versionMenuTrigger.click();
        //TODO: replace with commented assertion when fixed https://github.com/epam/ai-dial-chat/issues/3138
        // await agentVersionsDropdownMenuAssertion.assertMenuOptions(
        //   SortingUtil.sortVersionsArray([
        //     nonInstalledAppFirstVersion,
        //     nonInstalledAppSecondVersion,
        //   ]),
        // );
        await agentVersionsDropdownMenuAssertion.assertMenuIncludesOptions(
          nonInstalledAppFirstVersion,
          nonInstalledAppSecondVersion,
        );
      },
    );
  },
);

dialTest(
  'Search by used version to find models when two versions are used in My workspace.\n' +
    'Search in My workspace: Search word stays if to add app and search result is updated accordingly',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    addAppDropdownMenu,
    localStorageManager,
    marketplaceAgents,
    agentDetailsModal,
    customApplicationBuilder,
    applicationApiHelper,
    appEditorPage,
    appEditorGeneralForm,
    appEditorViewForm,
    appEditorHeader,
    setTestIds,
    baseAssertion,
    agentVersionsDropdownMenuAssertion,
  }) => {
    setTestIds('EPMRTC-4627', 'EPMRTC-4319');
    let recentNames: string[];
    let recentVersions: string[];
    let installedAppFirstVersion: string;
    let installedAppSecondVersion: string;
    let installedAppName: string;
    let firstAddedAppName: string;
    let firstAddedAppVersion: string;
    let secondAddedAppName: string;
    let secondAddedAppVersion: string;
    let allAgents: MarketplaceAgentProperties[];

    await dialTest.step(
      'Open "My Workspace", search by one of the installed agent versions and verify only that version is displayed in the results',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        recentVersions = ModelsUtil.getRecentAgentsVersions(recentModelIds);

        installedAppFirstVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
        ]);
        installedAppSecondVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
          installedAppFirstVersion,
        ]);
        installedAppName = GeneratorUtil.randomApplicationName();
        const installedApplicationFirstVersionModel = customApplicationBuilder
          .withDisplayName(installedAppName)
          .withDisplayVersion(installedAppFirstVersion)
          .build();
        const installedApplicationSecondVersionModel = customApplicationBuilder
          .withDisplayName(installedAppName)
          .withDisplayVersion(installedAppSecondVersion)
          .build();
        for (const appModel of [
          installedApplicationFirstVersionModel,
          installedApplicationSecondVersionModel,
        ]) {
          await applicationApiHelper.createApplication(appModel);
        }
        await marketplacePage.openMyWorkspacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(
          installedAppFirstVersion,
        );
        allAgents = await marketplaceAgentsSection.getAllAgents();
        const filteredAgents = allAgents.filter(
          (agent) => agent.isWorkspaceAgent,
        );
        baseAssertion.assertValue(
          filteredAgents.length,
          1,
          ExpectedMessages.conversationsCountIsValid,
        );
        const foundAgentElement =
          await marketplaceAgentsSection.findAgentElement(installedAppName);
        await baseAssertion.assertElementText(
          marketplaceAgents.getAgentVersion(foundAgentElement),
          installedAppFirstVersion,
        );
      },
    );

    await dialTest.step(
      'Verify another version is not displayed in the suggested results',
      async () => {
        const suggestedAgents = allAgents.filter((agent) => agent.isSuggested);
        baseAssertion.assertValue(
          suggestedAgents.length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );

    await dialTest.step(
      'Open found agent and verify there are two versions in dropdown list',
      async () => {
        const agentElement =
          await marketplaceAgentsSection.findAgentElement(installedAppName);
        await agentElement.click();
        await agentDetailsModal.versionMenuTrigger.click();
        //TODO: replace with commented assertion when fixed https://github.com/epam/ai-dial-chat/issues/3138
        // await agentVersionsDropdownMenuAssertion.assertMenuOptions(
        //   SortingUtil.sortVersionsArray([
        //     installedAppFirstVersion,
        //     installedAppSecondVersion,
        //   ]),
        // );
        await agentVersionsDropdownMenuAssertion.assertMenuIncludesOptions(
          installedAppFirstVersion,
          installedAppSecondVersion,
        );
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Set installed app name in the search field',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(installedAppName);
      },
    );

    await dialTest.step(
      'Add custom app with the name including/excluding searched app name and verify the search term is preserved, only first added app is displayed in the results',
      async () => {
        firstAddedAppName = GeneratorUtil.randomString(5) + installedAppName;
        firstAddedAppVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
          installedAppFirstVersion,
          installedAppSecondVersion,
        ]);

        secondAddedAppName = GeneratorUtil.randomApplicationName();
        secondAddedAppVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
          installedAppFirstVersion,
          installedAppSecondVersion,
          firstAddedAppVersion,
        ]);

        const addedAppNameVersionArray = [
          { name: firstAddedAppName, version: firstAddedAppVersion },
          { name: secondAddedAppName, version: secondAddedAppVersion },
        ];
        for (const addedAppNameVersion of addedAppNameVersionArray) {
          await marketplaceHeader.addAppButton.click();
          await addAppDropdownMenu.selectMenuOption(
            AddAppMenuOptions.customApp,
          );
          await appEditorPage.waitForPageLoaded();
          await appEditorGeneralForm.fillInAppFields({
            name: addedAppNameVersion.name,
            version: addedAppNameVersion.version,
          });
          await appEditorGeneralForm.goNext();
          await appEditorViewForm.fillInAppFields();
          await appEditorHeader.saveAppAndExit();
        }

        //TODO: need to clarify whether search field and filters are reset after adding a new app
        await marketplaceHeader.searchInput.fillInInput(installedAppName);
        const allAgents = await marketplaceAgentsSection.getAllAgents();
        const filteredAgents = allAgents.filter(
          (agent) => agent.isWorkspaceAgent,
        );
        baseAssertion.assertValue(
          filteredAgents.length,
          2,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredAgents.map((agent) => agent.name),
          [installedAppName, firstAddedAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
        await baseAssertion.assertElementAttribute(
          marketplaceHeader.searchInput,
          Attributes.value,
          installedAppName,
        );
      },
    );
  },
);

dialTest(
  'Search in My Workspace + Bookmark: search not latest version of model (only one version in My workspace added).\n' +
    'Search in My Workspace + Bookmark: search by name. Not latest version of application' +
    "Search by name when model has versions. Suggested results on My W. doesn't include the model if at least one version is used. Latest v.\n" +
    'Search in My Workspace + Bookmark: search latest version of model (latest and other versions added to My workspace)',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    marketplace,
    marketplaceSidebar,
    agentDetailsModal,
    localStorageManager,
    setTestIds,
    baseAssertion,
    customApplicationBuilder,
    toast,
    adminApplicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    agentVersionsDropdownMenuAssertion,
  }) => {
    setTestIds('EPMRTC-4709', 'EPMRTC-4710', 'EPMRTC-4626', 'EPMRTC-4711');
    let firstAppVersion: string;
    let secondAppVersion: string;
    let sortedVersions: string[];
    let appName: string;

    await dialTest.step(
      'Prepare application with two versions available in the "Marketplace"',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        const recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        const recentVersions =
          ModelsUtil.getRecentAgentsVersions(recentModelIds);

        firstAppVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
        ]);
        secondAppVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
          firstAppVersion,
        ]);
        appName = GeneratorUtil.randomApplicationName();
        sortedVersions = SortingUtil.sortVersionsArray([
          firstAppVersion,
          secondAppVersion,
        ]);

        const firstVersionCustomApplicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(firstAppVersion)
          .build();
        const secondVersionCustomApplicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(secondAppVersion)
          .build();

        for (const appModel of [
          firstVersionCustomApplicationModel,
          secondVersionCustomApplicationModel,
        ]) {
          const adminApp =
            await adminApplicationApiHelper.createApplication(appModel);
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withApplicationResource(adminApp, PublishActions.ADD)
            .build();
          const appPublication =
            await adminPublicationApiHelper.createPublishRequest(
              publishRequest,
            );
          publicationsToUnpublish.push(appPublication);
          await adminPublicationApiHelper.approveRequest(appPublication);
        }
      },
    );

    await dialTest.step(
      'On the "Marketplace" tab open created app and add not latest version to "My Workspace"',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        const agentElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        await agentElement.click();
        await agentDetailsModal.versionMenuTrigger.click();
        await agentDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[1]);
        await baseAssertion.assertElementState(
          agentDetailsModal.addBookmarkIcon,
          'visible',
        );
        await agentDetailsModal.addAgentToWorkspace();
        await baseAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'visible',
        );
        await baseAssertion.assertElementText(
          toast,
          ExpectedConstants.agentAddedToWorkspaceMessage,
        );
        await toast.closeToast();
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Verify agent with major version is displayed on "My Workspace" tab',
      async () => {
        await marketplaceSidebar.myWorkspaceButton.click();
        const foundAgentElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        await baseAssertion.assertElementState(foundAgentElement, 'visible');
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3138
        // await baseAssertion.assertElementText(
        //   marketplaceAgents.getAgentVersion(foundAgentElement),
        //   sortedVersions[0],
        // );
      },
    );

    await dialTest.step(
      'Search by installed agent version/name and verify agent is found, no other agents are suggested',
      async () => {
        for (const searchTerm of [sortedVersions[1], appName]) {
          await marketplaceHeader.searchInput.fillInInput(searchTerm);
          const allAgents = await marketplaceAgentsSection.getAllAgents();
          const filteredAgents = allAgents.filter(
            (agent) => agent.isWorkspaceAgent,
          );
          baseAssertion.assertValue(
            filteredAgents.length,
            1,
            ExpectedMessages.elementsCountIsValid,
          );
          baseAssertion.assertArrayIncludesAll(
            filteredAgents.map((agent) => agent.name),
            [appName],
            ExpectedMessages.searchResultsAreCorrect,
          );

          //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3138
          // const actualAppElement =
          //   await marketplaceAgentsSection.findAgentElement(appName);
          // await baseAssertion.assertElementText(
          //   marketplaceAgents.getAgentVersion(actualAppElement),
          //   sortedVersions[0],
          // );

          await baseAssertion.assertElementState(
            marketplace.marketplaceSuggestionsLabel,
            'hidden',
          );
          baseAssertion.assertValue(
            allAgents.filter((agent) => agent.isSuggested).length,
            0,
            ExpectedMessages.elementsCountIsValid,
          );
        }
      },
    );

    await dialTest.step.skip(
      'Back to the "Marketplace" tab and add latest version to "My Workspace"',
      async () => {
        await marketplaceSidebar.marketplaceHomePageButton.click();
        const actualAppElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        await actualAppElement.click();
        await agentDetailsModal.versionMenuTrigger.click();
        await agentDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(sortedVersions[0]);
        await baseAssertion.assertElementState(
          agentDetailsModal.addBookmarkIcon,
          'visible',
        );
        await agentDetailsModal.addAgentToWorkspace();
        await baseAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'visible',
        );
        await baseAssertion.assertElementText(
          toast,
          ExpectedConstants.agentAddedToWorkspaceMessage,
        );
        await toast.closeToast();
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialTest.step.skip(
      'Verify agent with latest version is displayed on "My Workspace" tab',
      async () => {
        await marketplaceSidebar.myWorkspaceButton.click();
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [appName],
          MarketplaceExpectedMessages.agentIsVisible,
        );
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3138
        // await baseAssertion.assertElementText(
        //   marketplaceAgents.getAgentVersion(appName),
        //   sortedVersions[0],
        // );
      },
    );

    await dialTest.step.skip(
      'Back to "My Workspace" and verify agent is found, no other agents are suggested',
      async () => {
        await marketplaceSidebar.myWorkspaceButton.click();
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        const filteredAgents = actualAgents.filter(
          (agent) => agent.isWorkspaceAgent,
        );
        baseAssertion.assertValue(
          filteredAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredAgents.map((agent) => agent.name),
          [appName],
          ExpectedMessages.searchResultsAreCorrect,
        );
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3138
        // await baseAssertion.assertElementText(
        //   filteredAgents.getAgentVersion(appName),
        //   sortedVersions[0],
        // );

        await baseAssertion.assertElementState(
          marketplace.marketplaceSuggestionsLabel,
          'hidden',
        );
        baseAssertion.assertValue(
          actualAgents.filter((agent) => agent.isSuggested).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );

    await dialTest.step(
      'Open found agent and verify set version and available in dropdown menu versions',
      async () => {
        const actualAgentElement =
          await marketplaceAgentsSection.findAgentElement(appName);
        await actualAgentElement.click();
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3138
        // await baseAssertion.assertElementText(
        //   agentDetailsModal.agentVersion,
        //   sortedVersions[0],
        // );
        await agentDetailsModal.versionMenuTrigger.click();
        //TODO: replace with commented assertion when fixed https://github.com/epam/ai-dial-chat/issues/3138
        // await agentVersionsDropdownMenuAssertion.assertMenuOptions(
        //   sortedVersions,
        // );
        await agentVersionsDropdownMenuAssertion.assertMenuIncludesOptions(
          ...sortedVersions,
        );
      },
    );
  },
);

dialTest.afterAll(async ({ adminPublicationApiHelper }) => {
  for (const publication of publicationsToUnpublish) {
    const unpublishResponse =
      await adminPublicationApiHelper.createUnpublishRequest(publication);
    await adminPublicationApiHelper.approveRequest(unpublishResponse);
  }
});
