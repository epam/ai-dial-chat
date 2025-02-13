import { DialAIEntityModel } from '@/chat/types/models';
import { Publication } from '@/chat/types/publication';
import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

let agents: DialAIEntityModel[];
const publicationsToUnpublish: Publication[] = [];

dialTest.beforeAll(async () => {
  agents = ModelsUtil.getOpenAIEntities();
});

dialTest(
  `Search in My workspace: 'No results found' and  suggest results.\n` +
    `Search in My workspace: 'No results found' and no suggested results.\n` +
    'Search in My workspace when nothing to suggest from DIAL Marketplace. No suggested options.\n' +
    'Search in My workspace. Search by version. No suggested options.\n' +
    'Search by not used version to find models in My workspace',
  async ({
    marketplacePage,
    marketplaceHeader,
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

    await dialTest.step(
      'Prepare one application visible in "My Workspace" and one available in the "Marketplace", both have unique name and version',
      async () => {
        const recentModelIds =
          (await localStorageManager.getRecentModelsIds()) as string[];
        const recentModels = agents.filter((a) =>
          recentModelIds.includes(a.reference || a.id),
        );
        const recentNames = recentModels.map(({ name }) => name);
        const recentVersions = recentModels
          .filter((r) => r.version !== undefined)
          .map(({ version }) => version ?? '');

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
        await baseAssertion.assertElementsCount(
          marketplace.getFilteredAgents(),
          0,
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
        const suggestedAgents = marketplace.getSuggestedAgents();
        await baseAssertion.assertElementsCount(suggestedAgents, 1);
        const actualSuggestedAgents = await suggestedAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedAgents,
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
          marketplace.getSuggestedAgents(),
          'hidden',
        );
        await baseAssertion.assertElementState(
          marketplace.getFilteredAgents(),
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
        await baseAssertion.assertElementState(
          marketplace.getSuggestedAgents(),
          'hidden',
        );

        const filteredAgents = marketplace.getFilteredAgents();
        await baseAssertion.assertElementState(filteredAgents, 'visible');
        await baseAssertion.assertElementsCount(filteredAgents, 1);
        const actualFilteredAgents = await filteredAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualFilteredAgents,
          [installedAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
      },
    );

    await dialTest.step(
      'Search by unique installed agent version and verify agent is displayed, no Marketplace agents are suggested',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(installedAppVersion);
        const filteredAgents = marketplace.getFilteredAgents();
        await baseAssertion.assertElementState(filteredAgents, 'visible');
        await baseAssertion.assertElementsCount(filteredAgents, 1);
        const actualFilteredAgents = await filteredAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualFilteredAgents,
          [installedAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
        await baseAssertion.assertElementState(
          marketplace.marketplaceSuggestionsLabel,
          'hidden',
        );
        await baseAssertion.assertElementState(
          marketplace.getSuggestedAgents(),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open found agent and verify no versions menu is available',
      async () => {
        await marketplaceAgents.getAgent(installedAppName).click();
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
        await baseAssertion.assertElementsCount(
          marketplace.getFilteredAgents(),
          0,
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
        const suggestedAgents = marketplace.getSuggestedAgents();
        await baseAssertion.assertElementsCount(suggestedAgents, 1);
        const actualSuggestedAgents = await suggestedAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedAgents,
          [nonInstalledAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
        const actualSuggestedAgentVersion =
          suggestedAgents.getAgentVersion(nonInstalledAppName);
        await baseAssertion.assertElementText(
          actualSuggestedAgentVersion,
          nonInstalledAppSecondVersion,
        );
      },
    );

    await dialTest.step(
      'Open suggested agent and verify set version and available in dropdown menu versions',
      async () => {
        await marketplaceAgents.getAgent(nonInstalledAppName).click();
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
    marketplace,
    addAppDropdownMenu,
    localStorageManager,
    marketplaceAgents,
    agentDetailsModal,
    customApplicationBuilder,
    applicationApiHelper,
    addApplicationModal,
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

    await dialTest.step(
      'Open "My Workspace", search by one of the installed agent versions and verify only that version is displayed in the results',
      async () => {
        const recentModelIds =
          (await localStorageManager.getRecentModelsIds()) as string[];
        const recentModels = agents.filter((a) =>
          recentModelIds.includes(a.reference || a.id),
        );
        recentNames = recentModels.map(({ name }) => name);
        recentVersions = recentModels
          .filter((r) => r.version !== undefined)
          .map(({ version }) => version ?? '');

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
        const filteredAgents = marketplace.getFilteredAgents();
        await baseAssertion.assertElementsCount(filteredAgents, 1);
        await baseAssertion.assertElementText(
          filteredAgents.getAgentVersion(installedAppName),
          installedAppFirstVersion,
        );
      },
    );

    await dialTest.step(
      'Verify another version is not displayed in the suggested results',
      async () => {
        const suggestedAgents = marketplace.getSuggestedAgents();
        await baseAssertion.assertElementsCount(suggestedAgents, 0);
      },
    );

    await dialTest.step(
      'Open found agent and verify there are two versions in dropdown list',
      async () => {
        await marketplaceAgents.getAgent(installedAppName).click();
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
          await addApplicationModal.fillInAppFields({
            name: addedAppNameVersion.name,
            version: addedAppNameVersion.version,
          });
          await addApplicationModal.addApp();
        }

        const filteredAgents = marketplace.getFilteredAgents();
        await baseAssertion.assertElementsCount(filteredAgents, 2);
        const actualFilteredAgents = await filteredAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualFilteredAgents,
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

dialTest.afterAll(async ({ adminPublicationApiHelper }) => {
  for (const publication of publicationsToUnpublish) {
    const unpublishResponse =
      await adminPublicationApiHelper.createUnpublishRequest(publication);
    await adminPublicationApiHelper.approveRequest(unpublishResponse);
  }
});
