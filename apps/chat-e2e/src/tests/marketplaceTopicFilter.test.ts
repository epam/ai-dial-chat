import { EntityType } from '@/chat/types/common';
import { Publication } from '@/chat/types/publication';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
} from '@/src/testData';
import { MarketplaceAgents } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';
import { Locator } from '@playwright/test';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  'Topics: the filter is applied and search results are shown. Custom app. DIAL Marketplace.\n' +
    'Topics: topics set in custom app appear in Topics category. Sorting is alphabetical.\n' +
    'Topics: the filter is applied and search results are shown. Models. Switch between DIAL Marketplace and My workspace. Suggested results.',
  async ({
    setTestIds,
    customApplicationBuilder,
    applicationApiHelper,
    adminApplicationApiHelper,
    publishRequestBuilder,
    adminPublicationApiHelper,
    fileApiHelper,
    modelApiHelper,
    localStorageManager,
    marketplacePage,
    marketplaceFilter,
    marketplace,
    marketplaceSidebar,
    marketplaceAgents,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-4498', 'EPMRTC-4494', 'EPMRTC-4490');
    const firstAppName = GeneratorUtil.randomApplicationName();
    const secondAppName = GeneratorUtil.randomApplicationName();
    const thirdAppName = GeneratorUtil.randomApplicationName();
    const fourthAppName = GeneratorUtil.randomApplicationName();
    const firstTopic = GeneratorUtil.randomString(7).toUpperCase();
    const secondTopic = GeneratorUtil.randomString(10);
    const underscoreTopic = '_' + GeneratorUtil.randomString(10);
    const numericTopic = GeneratorUtil.randomNumberInRange(5);

    await dialTest.step(
      'Prepare custom applications with combination of topics in the Marketplace, add three apps to "My Workspace"',
      async () => {
        const firstApplicationModel = customApplicationBuilder
          .withDisplayName(firstAppName)
          .withDescriptionKeywords(firstTopic)
          .build();
        const secondApplicationModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withDescriptionKeywords(firstTopic, secondTopic)
          .build();
        const thirdApplicationModel = customApplicationBuilder
          .withDisplayName(thirdAppName)
          .withDescriptionKeywords(secondTopic)
          .build();
        const fourthApplicationModel = customApplicationBuilder
          .withDisplayName(fourthAppName)
          .build();
        const fifthApplicationModel = customApplicationBuilder
          .withDisplayName(GeneratorUtil.randomApplicationName())
          .withDescriptionKeywords(underscoreTopic)
          .build();
        const sixthApplicationModel = customApplicationBuilder
          .withDisplayName(GeneratorUtil.randomApplicationName())
          .withDescriptionKeywords(numericTopic.toString())
          .build();
        for (const app of [
          firstApplicationModel,
          secondApplicationModel,
          thirdApplicationModel,
          fourthApplicationModel,
        ]) {
          const adminApp =
            await adminApplicationApiHelper.createApplication(app);
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

        for (const app of [fifthApplicationModel, sixthApplicationModel]) {
          await applicationApiHelper.createApplication(app);
        }

        const allAgents = await modelApiHelper.getModels();
        const addedApps = allAgents.filter(
          (a) =>
            a.name === firstAppName ||
            a.name === secondAppName ||
            a.name === fourthAppName,
        );
        await fileApiHelper.updateInstalledDeployments(addedApps);
        await localStorageManager.setRecentModelsIdsOnce(...addedApps);
      },
    );

    await dialTest.step(
      'Open Dial Marketplace and verify Topics filter with added options are displayed, topics are sorted alphabetically',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        const topicsFilter = marketplaceFilter.filterByPropertyOptions(
          MarketplaceFilterTypes.topics,
        );
        await baseAssertion.assertElementState(topicsFilter, 'visible');

        const actualTopicsFilterOptions =
          await marketplaceFilter.filterByPropertyOptionLabels(
            MarketplaceFilterTypes.topics,
          );
        baseAssertion.assertArrayIncludesAll(
          actualTopicsFilterOptions,
          [firstTopic, secondTopic],
          MarketplaceExpectedMessages.filterOptionsAreValid,
        );
        await baseAssertion.assertStringsSorting(
          actualTopicsFilterOptions,
          'asc',
        );
      },
    );

    await dialTest.step(
      'Check Topics=firstTopic filter and verify only first and second apps are displayed',
      async () => {
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.topics,
            firstTopic,
          )
          .click();
        await baseAssertion.assertElementsCount(marketplace.getAgents(), 2);
        const actualModels = await marketplaceAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualModels,
          [firstAppName, secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Check also Topics=secondTopic filter and verify only first, second and third apps are displayed',
      async () => {
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.topics,
            secondTopic,
          )
          .click();
        await baseAssertion.assertElementsCount(marketplace.getAgents(), 3);
        const actualModels = await marketplaceAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualModels,
          [firstAppName, secondAppName, thirdAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Switch to "My Workspace" tab and verify only first and second apps are displayed, third app stay under "Suggested results"',
      async () => {
        await marketplaceSidebar.myWorkspaceButton.click();
        const filteredAgents = marketplace.getFilteredAgents();
        await baseAssertion.assertElementsCount(filteredAgents, 2);
        const actualWorkspaceApps = await filteredAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualWorkspaceApps,
          [firstAppName, secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );

        const suggestedAgents = marketplace.getSuggestedAgents();
        await baseAssertion.assertElementsCount(suggestedAgents, 1);
        const actualSuggestedApps = await suggestedAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedApps,
          [thirdAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );
  },
);

dialTest(
  'Topics: the filter is applied and search results are shown. Models. My workspace. Suggested results and no results found.\n' +
    'Topics: the filter is applied and search results are shown. Models. My workspace. No Suggested results, all models are in results found.\n' +
    'Type and Topics: No Results found when use filters types and topics on DIAL Marketplace and My workspace',
  async ({
    setTestIds,
    customApplicationBuilder,
    adminApplicationApiHelper,
    publishRequestBuilder,
    adminPublicationApiHelper,
    marketplacePage,
    marketplaceFilter,
    marketplace,
    toast,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-4669', 'EPMRTC-4670', 'EPMRTC-4601');
    const marketplaceAppName = GeneratorUtil.randomApplicationName();
    const appTopic = GeneratorUtil.randomString(7).toUpperCase();

    await dialTest.step(
      'Prepare custom application with topic available only in the Marketplace',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(marketplaceAppName)
          .withDescriptionKeywords(appTopic)
          .build();
        const adminApp =
          await adminApplicationApiHelper.createApplication(applicationModel);
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withApplicationResource(adminApp, PublishActions.ADD)
          .build();
        const appPublication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        publicationsToUnpublish.push(appPublication);
        await adminPublicationApiHelper.approveRequest(appPublication);
      },
    );

    await dialTest.step(
      'Open "My Workspace", check topic filter and verify "No results found" is displayed, created app stays under suggested results',
      async () => {
        await marketplacePage.openMyWorkspacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceFilter
          .filterByPropertyOptionInput(MarketplaceFilterTypes.topics, appTopic)
          .click();
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
        const actualSuggestedAgents = marketplace.getSuggestedAgents();
        await baseAssertion.assertElementsCount(actualSuggestedAgents, 1);
        baseAssertion.assertArrayIncludesAll(
          await actualSuggestedAgents.getAgentNames(),
          [marketplaceAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Bookmark suggested app and verify it is moved to the workspace results, no apps are suggested',
      async () => {
        await marketplace
          .getSuggestedAgents()
          .addAgentToWorkspace(marketplaceAppName);
        await toast.closeToast();
        const filteredAgents = marketplace.getFilteredAgents();
        await baseAssertion.assertElementState(
          filteredAgents.getAgentRemoveBookmarkIcon(marketplaceAppName),
          'visible',
        );
        await baseAssertion.assertElementsCount(filteredAgents, 1);
        const actualFilteredAgents = await filteredAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualFilteredAgents,
          [marketplaceAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
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
      'Check Types=Model filter option and verify "No results found" is displayed, no agents are suggested',
      async () => {
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.type,
            EntityType.Model,
          )
          .click();
        await baseAssertion.assertElementState(
          marketplace.getFilteredAgents(),
          'hidden',
        );
        await baseAssertion.assertElementState(
          marketplace.getSuggestedAgents(),
          'hidden',
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
      },
    );
  },
);

dialTest(
  'Topics: the search results are updated if to remove/add custom application with corresponding topic',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    marketplaceFilter,
    marketplace,
    confirmationDialog,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-5352');
    const firstAppName = GeneratorUtil.randomApplicationName();
    const secondAppName = GeneratorUtil.randomApplicationName();
    const appTopic = GeneratorUtil.randomString(5);
    let filteredAgents: MarketplaceAgents;
    let appTopicCheckbox: Locator;

    await dialTest.step(
      'Prepare custom applications with common topic in the "My Workspace"',
      async () => {
        const firstApplicationModel = customApplicationBuilder
          .withDisplayName(firstAppName)
          .withDescriptionKeywords(appTopic)
          .build();
        const secondApplicationModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withDescriptionKeywords(appTopic)
          .build();
        for (const app of [firstApplicationModel, secondApplicationModel]) {
          await applicationApiHelper.createApplication(app);
        }
      },
    );

    await dialTest.step(
      'Open "My Workspace", check app topic option in the filter and verify both apps are displayed',
      async () => {
        await marketplacePage.openMyWorkspacePage();
        await marketplacePage.waitForPageLoaded();
        appTopicCheckbox = marketplaceFilter.filterByPropertyOptionInput(
          MarketplaceFilterTypes.topics,
          appTopic,
        );
        await appTopicCheckbox.click();
        filteredAgents = marketplace.getFilteredAgents();
        await baseAssertion.assertElementsCount(filteredAgents, 2);
        baseAssertion.assertArrayIncludesAll(
          await filteredAgents.getAgentNames(),
          [firstAppName, secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Delete the first app and verify it disappears immediately, topic stays checked',
      async () => {
        await filteredAgents.getAgent(firstAppName).hoverOver();
        await filteredAgents.getAgentDotsMenu(firstAppName).click();
        await filteredAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        filteredAgents = marketplace.getFilteredAgents();
        await baseAssertion.assertElementsCount(filteredAgents, 1);
        baseAssertion.assertArrayIncludesAll(
          await filteredAgents.getAgentNames(),
          [secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        await baseAssertion.assertCheckboxState(
          appTopicCheckbox,
          CheckboxState.checked,
        );
      },
    );

    await dialTest.step(
      'Delete the second app and verify it and its topic disappear from the result and filter',
      async () => {
        await filteredAgents.getAgent(secondAppName).hoverOver();
        await filteredAgents.getAgentDotsMenu(secondAppName).click();
        await filteredAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        filteredAgents = marketplace.getFilteredAgents();
        baseAssertion.assertArrayExcludesAll(
          await filteredAgents.getAgentNames(),
          [secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        await baseAssertion.assertElementState(appTopicCheckbox, 'hidden');
      },
    );
  },
);

dialTest(
  'Topics: the filter is applied to different custom app versions. DIAL Marketplace.\n' +
    'Topics: the filter is applied to different custom app versions. My workspace',
  async ({
    setTestIds,
    customApplicationBuilder,
    adminApplicationApiHelper,
    publishRequestBuilder,
    adminPublicationApiHelper,
    marketplacePage,
    marketplaceSidebar,
    marketplaceFilter,
    marketplace,
    agentDetailsModal,
    agentVersionsDropdownMenuAssertion,
    marketplaceAgents,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-4475', 'EPMRTC-4671');
    const appName = GeneratorUtil.randomApplicationName();
    const firstVersion = GeneratorUtil.randomApplicationVersion();
    const secondVersion = GeneratorUtil.randomApplicationVersion([
      firstVersion,
    ]);
    const firstAppTopic = GeneratorUtil.randomString(7);
    const secondAppTopic = GeneratorUtil.randomString(10);
    let topicFilter: Locator;

    await dialTest.step(
      'Prepare custom application with first topic and v1 and v2 with second topic',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(firstVersion)
          .withDescriptionKeywords(firstAppTopic)
          .build();
        const updatedApplicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDescriptionKeywords(secondAppTopic)
          .withDisplayVersion(secondVersion)
          .build();

        for (const app of [applicationModel, updatedApplicationModel]) {
          const adminApp =
            await adminApplicationApiHelper.createApplication(app);
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withApplicationResource(adminApp, PublishActions.ADD_IF_ABSENT)
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
      'Open "Marketplace", check app first topic in the filter and verify the app with v1 and first topic is displayed',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        topicFilter = marketplaceFilter.filterByPropertyOptionInput(
          MarketplaceFilterTypes.topics,
          firstAppTopic,
        );
        await topicFilter.click();
        const agents = marketplace.getAgents();
        await baseAssertion.assertElementsCount(agents, 1);
        baseAssertion.assertArrayIncludesAll(
          await agents.getAgentNames(),
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        await baseAssertion.assertElementText(
          marketplaceAgents.getAgentVersion(appName),
          firstVersion,
        );
        await baseAssertion.assertElementInnerText(
          marketplaceAgents.getAgentTopics(appName),
          [firstAppTopic],
        );
      },
    );

    await dialTest.step(
      'Open the agent and verify v1 and first topic are displayed on the card',
      async () => {
        await marketplaceAgents.getAgent(appName).click();
        await baseAssertion.assertElementText(
          agentDetailsModal.agentVersion,
          firstVersion,
        );
        await baseAssertion.assertElementInnerText(
          agentDetailsModal.agentTopics,
          [firstAppTopic],
        );
        await agentDetailsModal.versionMenuTrigger.click();
        await agentVersionsDropdownMenuAssertion.assertMenuIncludesOptions(
          firstVersion,
          secondVersion,
        );
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Uncheck app first topic option and verify the app with v2 and second topic is displayed',
      async () => {
        await topicFilter.click();
        await baseAssertion.assertCheckboxState(
          topicFilter,
          CheckboxState.unchecked,
        );
        const agents = marketplace.getAgents();
        await baseAssertion.assertElementState(
          agents.getAgentWithVersion(appName, secondVersion),
          'visible',
        );
        await baseAssertion.assertElementInnerText(
          marketplaceAgents.getAgentTopics(appName),
          [secondAppTopic],
        );
      },
    );

    await dialTest.step(
      'Open the agent and verify v2 and second topic are displayed on the card',
      async () => {
        await marketplaceAgents.getAgent(appName).click();
        await baseAssertion.assertElementText(
          agentDetailsModal.agentVersion,
          secondVersion,
        );
        await baseAssertion.assertElementInnerText(
          agentDetailsModal.agentTopics,
          [secondAppTopic],
        );
        await agentDetailsModal.versionMenuTrigger.click();
        await agentVersionsDropdownMenuAssertion.assertMenuIncludesOptions(
          firstVersion,
          secondVersion,
        );
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Switch to "My Workspace" tab, check app first topic option in the filter and verify the app with v1 and first topic is suggested',
      async () => {
        await marketplaceSidebar.myWorkspaceButton.click();
        await topicFilter.click();
        const suggestedAgents = marketplace.getSuggestedAgents();
        await baseAssertion.assertElementsCount(suggestedAgents, 1);
        const actualSuggestedApps = await suggestedAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedApps,
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        await baseAssertion.assertElementText(
          suggestedAgents.getAgentVersion(appName),
          firstVersion,
        );
        await baseAssertion.assertElementInnerText(
          suggestedAgents.getAgentTopics(appName),
          [firstAppTopic],
        );
      },
    );

    await dialTest.step(
      'Check app second topic option in the filter and verify the app with v2 and second topic is suggested',
      async () => {
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.topics,
            secondAppTopic,
          )
          .click();
        const suggestedAgents = marketplace.getSuggestedAgents();
        await baseAssertion.assertElementsCount(suggestedAgents, 1);
        const actualSuggestedApps = await suggestedAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedApps,
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        await baseAssertion.assertElementText(
          suggestedAgents.getAgentVersion(appName),
          secondVersion,
        );
        await baseAssertion.assertElementInnerText(
          suggestedAgents.getAgentTopics(appName),
          [secondAppTopic],
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
