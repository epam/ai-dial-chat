import { Publication } from '@/chat/types/publication';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  AddAppMenuOptions,
  EntityEditorAppTypes,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { BaseElement, MarketplaceEntityProperties } from '@/src/ui/webElements';
import {
  GeneratorUtil,
  ModelsUtil,
  SortingUtil,
  applicationNamePrefix,
} from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  `Search in My workspace: 'No results found' and suggest results.\n` +
    `Search in My workspace: 'No results found' and no suggested results.\n` +
    'Search in My workspace when nothing to suggest from DIAL Marketplace. No suggested options.\n' +
    'Search in My workspace. Search by version. No suggested options.\n' +
    'Search by not used version to find models in My workspace.\n' +
    'Copy link is not available for manually created and not published applications',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    marketplace,
    entityDetailsModal,
    localStorageManager,
    setTestIds,
    baseAssertion,
    customApplicationBuilder,
    applicationApiHelper,
    adminApplicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    entityVersionsDropdownMenuAssertion,
  }) => {
    setTestIds(
      'EPMDIAL-2632',
      'EPMDIAL-2631',
      'EPMDIAL-2637',
      'EPMDIAL-2638',
      'EPMDIAL-2641',
      'EPMDIAL-2580',
    );
    let installedAppVersion: string;
    let installedAppName: string;
    let nonInstalledAppFirstVersion: string;
    let nonInstalledAppSecondVersion: string;
    let nonInstalledAppName: string;
    let foundSuggestedAgentElement: BaseElement;
    let searchInput: BaseElement;

    await dialTest.step(
      'Prepare one application visible in "My Workspace" and one available in the "Marketplace", both have unique name and version',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        const recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        const recentVersions =
          ModelsUtil.getRecentAgentsVersions(recentModelIds);

        installedAppVersion = GeneratorUtil.randomEntityVersion([
          ...recentNames,
          ...recentVersions,
        ]);
        installedAppName = GeneratorUtil.randomApplicationName();
        const installedCustomApplicationModel = customApplicationBuilder
          .withDisplayName(installedAppName)
          .withDisplayVersion(installedAppVersion)
          .build();

        nonInstalledAppFirstVersion = GeneratorUtil.randomEntityVersion([
          ...recentNames,
          ...recentVersions,
          installedAppVersion,
        ]);
        nonInstalledAppSecondVersion = GeneratorUtil.randomEntityVersion([
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
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(nonInstalledAppName);
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        const actualFilteredAgents = actualAgents.filter(
          (agent) => agent.isWorkspaceEntity,
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
          ExpectedConstants.noWorkspaceEntitiesFoundMessage,
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
        await searchInput.fillInInput(GeneratorUtil.randomString(20));
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
          ExpectedConstants.noMarketplaceEntitiesFoundMessage,
        );
        await baseAssertion.assertElementState(
          marketplace.noResultsFoundIcon,
          'visible',
        );
        await baseAssertion.assertElementState(
          marketplaceEntitiesSection,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Search by installed agent name and verify no Marketplace agents are suggested',
      async () => {
        await searchInput.fillInInput(installedAppName);
        await baseAssertion.assertElementState(
          marketplace.marketplaceSuggestionsLabel,
          'hidden',
        );
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          actualAgents.filter((agent) => agent.isSuggested).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );

        const filteredAgents = actualAgents.filter(
          (agent) => agent.isWorkspaceEntity,
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
        await searchInput.fillInInput(installedAppVersion);
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        const filteredAgents = actualAgents.filter(
          (agent) => agent.isWorkspaceEntity,
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
      'Open found agent and verify no versions menu and Copy link are available',
      async () => {
        const foundAgent =
          await marketplaceEntitiesSection.findEntityElement(installedAppName);
        await foundAgent.click();
        await baseAssertion.assertElementState(
          entityDetailsModal.versionMenuTrigger,
          'hidden',
        );
        await baseAssertion.assertElementText(
          entityDetailsModal.entityVersion,
          installedAppVersion,
        );
        await baseAssertion.assertElementState(
          entityDetailsModal.copyLink,
          'hidden',
        );
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Search by not installed agent version and verify no results label is displayed, agent with searched version is suggested',
      async () => {
        await searchInput.fillInInput(nonInstalledAppSecondVersion);
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          actualAgents.filter((agent) => agent.isWorkspaceEntity).length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        await baseAssertion.assertElementState(
          marketplace.noWorkspaceResultsFound,
          'visible',
        );
        await baseAssertion.assertElementText(
          marketplace.noWorkspaceResultsFound,
          ExpectedConstants.noWorkspaceEntitiesFoundMessage,
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
          await marketplaceEntitiesSection.findEntityElement(
            nonInstalledAppName,
          );
        const actualSuggestedAgentVersion =
          marketplaceEntities.getEntityVersion(foundSuggestedAgentElement);
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
          entityDetailsModal.entityVersion,
          nonInstalledAppSecondVersion,
        );
        await entityDetailsModal.versionMenuTrigger.click();
        await entityVersionsDropdownMenuAssertion.assertMenuOptions(
          SortingUtil.sortVersionsArray([
            nonInstalledAppFirstVersion,
            nonInstalledAppSecondVersion,
          ]),
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
    marketplaceEntitiesSection,
    addAppDropdownMenu,
    localStorageManager,
    marketplaceEntities,
    entityDetailsModal,
    customApplicationBuilder,
    applicationApiHelper,
    entityEditorPage,
    entityEditorGeneralForm,
    customAppEditorViewForm,
    entityEditorHeader,
    setTestIds,
    baseAssertion,
    entityVersionsDropdownMenuAssertion,
  }) => {
    setTestIds('EPMDIAL-2642', 'EPMDIAL-2636');
    let recentNames: string[];
    let recentVersions: string[];
    let installedAppFirstVersion: string;
    let installedAppSecondVersion: string;
    let installedAppName: string;
    let firstAddedAppName: string;
    let firstAddedAppVersion: string;
    let secondAddedAppName: string;
    let secondAddedAppVersion: string;
    let allAgents: MarketplaceEntityProperties[];
    let searchInput: BaseElement;

    await dialTest.step(
      'Open "My Workspace", search by one of the installed agent versions and verify only that version is displayed in the results',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        recentVersions = ModelsUtil.getRecentAgentsVersions(recentModelIds);

        installedAppFirstVersion = GeneratorUtil.randomEntityVersion([
          ...recentNames,
          ...recentVersions,
        ]);
        installedAppSecondVersion = GeneratorUtil.randomEntityVersion([
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
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(installedAppFirstVersion);
        allAgents = await marketplaceEntitiesSection.getAllEntities();
        const filteredAgents = allAgents.filter(
          (agent) => agent.isWorkspaceEntity,
        );
        baseAssertion.assertNumberIsGreaterThanOrEqual(
          filteredAgents.length,
          1,
          ExpectedMessages.conversationsCountIsValid,
        );
        const foundAgentElement =
          await marketplaceEntitiesSection.findEntityElement(installedAppName);
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityVersion(foundAgentElement),
          installedAppFirstVersion,
        );
      },
    );

    await dialTest.step(
      'Verify another version is not displayed in the suggested results',
      async () => {
        const suggestedAgents = allAgents.filter(
          (agent) => agent.isSuggested && agent.name === installedAppName,
        );
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
          await marketplaceEntitiesSection.findEntityElement(installedAppName);
        await agentElement.click();
        await entityDetailsModal.versionMenuTrigger.click();
        await entityVersionsDropdownMenuAssertion.assertMenuOptions(
          SortingUtil.sortVersionsArray([
            installedAppFirstVersion,
            installedAppSecondVersion,
          ]),
        );
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Set installed app name in the search field',
      async () => {
        await searchInput.fillInInput(installedAppName);
      },
    );

    await dialTest.step(
      'Add custom app with the name including/excluding searched app name and verify the search term is preserved, first added app is displayed in the results',
      async () => {
        firstAddedAppName = GeneratorUtil.randomString(5) + installedAppName;
        firstAddedAppVersion = GeneratorUtil.randomEntityVersion([
          ...recentNames,
          ...recentVersions,
          installedAppFirstVersion,
          installedAppSecondVersion,
        ]);

        secondAddedAppName = GeneratorUtil.randomApplicationName();
        secondAddedAppVersion = GeneratorUtil.randomEntityVersion([
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
          await entityEditorPage.waitForPageLoaded(
            EntityEditorAppTypes.CustomApp,
          );
          await entityEditorGeneralForm.fillInEntityFields({
            name: addedAppNameVersion.name,
            version: addedAppNameVersion.version,
          });
          await entityEditorGeneralForm.goNext({
            hostsArray: [
              API.applicationCreateHost,
              API.installedDeploymentsHost(),
            ],
          });
          await customAppEditorViewForm.fillInAppFields();
          await entityEditorHeader.focusOn({
            triggeredHost: API.applicationCreateHost,
          });
          await entityEditorHeader.saveAndExitButton.click();
          await marketplacePage.waitForPageLoaded();
          await entityDetailsModal.closeButton.click();
        }

        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        const filteredAgents = allAgents.filter(
          (agent) => agent.isWorkspaceEntity,
        );
        baseAssertion.assertNumberIsGreaterThanOrEqual(
          filteredAgents.length,
          2,
          ExpectedMessages.elementsCountIsValid,
        );

        const filteredAgentNames = filteredAgents.map((agent) => agent.name);
        baseAssertion.assertArrayIncludesAll(
          filteredAgentNames,
          [installedAppName, firstAddedAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
        baseAssertion.assertArrayExcludesAll(
          filteredAgentNames,
          [secondAddedAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          installedAppName,
        );
      },
    );
  },
);

dialTest(
  'Bookmark an agent from Suggested results results',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    navigationPanel,
    localStorageManager,
    setTestIds,
    baseAssertion,
    customApplicationBuilder,
    toast,
    adminApplicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
  }) => {
    setTestIds('EPMDIAL-2643');
    let appVersion: string;
    let firstAppName: string;
    let secondAppName: string;
    let thirdAppName: string;
    const commonAppNamePart = GeneratorUtil.randomApplicationName();
    let searchInput: BaseElement;

    await dialTest.step(
      'Prepare two applications with equal versions and app with common name part available in the "Marketplace"',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        const recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        const recentVersions =
          ModelsUtil.getRecentAgentsVersions(recentModelIds);

        appVersion = GeneratorUtil.randomEntityVersion([
          ...recentNames,
          ...recentVersions,
        ]);
        firstAppName =
          commonAppNamePart + GeneratorUtil.randomApplicationName();
        secondAppName =
          GeneratorUtil.randomApplicationName() + commonAppNamePart;
        thirdAppName =
          GeneratorUtil.randomApplicationName() +
          commonAppNamePart +
          GeneratorUtil.randomApplicationName();

        const firstApplicationModel = customApplicationBuilder
          .withDisplayName(firstAppName)
          .withDisplayVersion(appVersion)
          .build();
        const secondApplicationModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withDisplayVersion(appVersion)
          .build();
        const thirdApplicationModel = customApplicationBuilder
          .withDisplayName(thirdAppName)
          .build();

        for (const appModel of [
          firstApplicationModel,
          secondApplicationModel,
          thirdApplicationModel,
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
      'On the "Marketplace" tab search agents by the version and verify two cards are found',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(appVersion);
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        const expectedAgents = allAgents.filter(
          (a) =>
            (a.name === firstAppName || a.name === secondAppName) &&
            a.version === appVersion,
        );
        baseAssertion.assertValue(
          expectedAgents.length,
          2,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );

    await dialTest.step(
      'Bookmark the 1st app from "Marketplace" tab and the 2nd one from "My Workspace" tab',
      async () => {
        const firstAppElement =
          await marketplaceEntitiesSection.findEntityElement(firstAppName);
        await marketplaceEntities.addEntityToWorkspace(firstAppElement);
        await toast.closeToast();
        await navigationPanel.goToMyWorkspace();
        const secondAppElement =
          await marketplaceEntitiesSection.findEntityElement(secondAppName);
        await marketplaceEntities.addEntityToWorkspace(secondAppElement);
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'Verify both apps are displayed as a search result',
      async () => {
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        const filteredAgents = allAgents.filter(
          (agent) => agent.isWorkspaceEntity,
        );
        baseAssertion.assertNumberIsGreaterThanOrEqual(
          filteredAgents.length,
          2,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredAgents.map((agent) => agent.name),
          [firstAppName, secondAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
      },
    );

    await dialTest.step(
      'Search by common part of app names and verify two apps are found, one app is suggested',
      async () => {
        await searchInput.fillInInput(commonAppNamePart);
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        const filteredWorkspaceAgents = allAgents.filter(
          (agent) => agent.isWorkspaceEntity,
        );
        baseAssertion.assertNumberIsGreaterThanOrEqual(
          filteredWorkspaceAgents.length,
          2,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredWorkspaceAgents.map((agent) => agent.name),
          [firstAppName, secondAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );

        const filteredSuggestedAgents = allAgents.filter(
          (agent) => agent.isSuggested,
        );
        baseAssertion.assertNumberIsGreaterThanOrEqual(
          filteredSuggestedAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredSuggestedAgents.map((agent) => agent.name),
          [thirdAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
      },
    );
  },
);

dialTest(
  'Search in My workspace. New extended search by name',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplace,
    marketplaceEntitiesSection,
    localStorageManager,
    setTestIds,
    baseAssertion,
    customApplicationBuilder,
    applicationApiHelper,
  }) => {
    setTestIds('EPMDIAL-2647');

    let searchInput: BaseElement;

    const firstAppName = applicationNamePrefix + 'abcdefghij 1';
    const secondAppName = applicationNamePrefix + 'abcd efghij';
    const thirdAppName = applicationNamePrefix + 'abcdefghij 2';
    const fourthAppName = applicationNamePrefix + 'abcdexfghij';
    const fifthAppName = applicationNamePrefix + 'abcdefghijklmnop12345678';

    const firstTerm = 'abcd';
    const secondTerm = 'abcd   ';
    const thirdTerm = 'abcd ef';
    const fourthTerm = 'abcdex';
    const fifthTerm = 'abcdext';
    const sixthTerm = 'habcdex';
    const seventhTerm = 'habcdex1';

    const searchTermResultMap = new Map<string, string[]>();
    searchTermResultMap.set(firstTerm, [
      firstAppName,
      secondAppName,
      thirdAppName,
      fourthAppName,
      fifthAppName,
    ]);
    searchTermResultMap.set(secondTerm, [
      firstAppName,
      secondAppName,
      thirdAppName,
      fourthAppName,
      fifthAppName,
    ]);
    searchTermResultMap.set(thirdTerm, [
      firstAppName,
      secondAppName,
      thirdAppName,
      fifthAppName,
    ]);
    searchTermResultMap.set(fourthTerm, [
      firstAppName,
      thirdAppName,
      fourthAppName,
      fifthAppName,
    ]);
    searchTermResultMap.set(fifthTerm, [fourthAppName]);
    searchTermResultMap.set(sixthTerm, [fourthAppName]);

    await dialTest.step(
      'Prepare the set of custom applications with mixture of terms in the name',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        for (const name of [
          firstAppName,
          secondAppName,
          thirdAppName,
          fourthAppName,
          fifthAppName,
        ]) {
          const appModel = customApplicationBuilder
            .withDisplayName(name)
            .build();
          await applicationApiHelper.createApplication(appModel);
        }
      },
    );

    await dialTest.step(
      'Open "DIAL Marketplace", type search term in the search field and verify correct apps are found',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
        });
        await marketplacePage.waitForPageLoaded();
        for (const searchTerm of searchTermResultMap.keys()) {
          searchInput = marketplaceHeader.getSearch().inputField;
          await searchInput.fillInInput(searchTerm);
          const actualAgents =
            await marketplaceEntitiesSection.getAllEntities();
          const filteredAgents = actualAgents.filter(
            (agent) => agent.isWorkspaceEntity,
          );
          baseAssertion.assertValue(
            filteredAgents.length,
            searchTermResultMap.get(searchTerm)!.length,
            ExpectedMessages.elementsCountIsValid,
          );
          baseAssertion.assertArrayIncludesAll(
            filteredAgents.map((agent) => agent.name),
            searchTermResultMap.get(searchTerm)!,
            ExpectedMessages.searchResultsAreCorrect,
          );
        }
      },
    );

    await dialTest.step(
      'Type not existent combination in the search field and verify no results are found',
      async () => {
        await searchInput.fillInInput(seventhTerm);
        await baseAssertion.assertElementState(
          marketplace.noResultsFound,
          'visible',
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
