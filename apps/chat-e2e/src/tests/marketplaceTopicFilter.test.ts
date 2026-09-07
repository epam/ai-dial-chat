import { EntityType } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
} from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';
import { Locator } from '@playwright/test';

dialTest(
  'Topics: the filter is applied and search results are shown. Custom app. DIAL Marketplace.\n' +
    'Topics: topics set in custom app appear in Topics category. Sorting is alphabetical.\n' +
    'Topics: the filter is applied and search results are shown. Models. Switch between DIAL Marketplace and My workspace. Suggested results.\n' +
    'Topics: long name is cut with three dots at the end.\n' +
    'Topics: on hover over the name tooltip with the full name is shown.\n' +
    'Topics: topics section stays collapsed if user closes it',
  async ({
    setTestIds,
    customApplicationBuilder,
    applicationApiHelper,
    adminApplicationApiHelper,
    publishRequestBuilder,
    adminPublicationApiHelper,
    modelApiHelper,
    localStorageManager,
    marketplacePage,
    marketplaceFilter,
    navigationPanel,
    marketplaceEntitiesSection,
    baseAssertion,
    tooltip,
    page,
    tooltipAssertion,
  }) => {
    setTestIds(
      'EPMDIAL-2681',
      'EPMDIAL-2676',
      'EPMDIAL-2683',
      'EPMDIAL-2689',
      'EPMDIAL-5585',
      'EPMDIAL-2691',
    );
    const firstAppName = GeneratorUtil.randomApplicationName();
    const secondAppName = GeneratorUtil.randomApplicationName();
    const thirdAppName = GeneratorUtil.randomApplicationName();
    const fourthAppName = GeneratorUtil.randomApplicationName();
    const firstTopic = GeneratorUtil.randomString(7).toUpperCase();
    const secondTopic = GeneratorUtil.randomString(10);
    const underscoreTopic = '_' + GeneratorUtil.randomString(10);
    const numericTopic = GeneratorUtil.randomNumberInRange(5);
    const longTopic = GeneratorUtil.randomString(80);

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
        const longTopicApplicationModel = customApplicationBuilder
          .withDisplayName(GeneratorUtil.randomApplicationName())
          .withDescriptionKeywords(longTopic)
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
          longTopicApplicationModel,
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
        await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
          ...addedApps,
        );
      },
    );

    await dialTest.step(
      'Open DIAL Marketplace and verify Topics filter with added options are displayed, topics are sorted alphabetically',
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
          [firstTopic, secondTopic, longTopic],
          MarketplaceExpectedMessages.filterOptionsAreValid,
        );
        baseAssertion.assertStringsSorting(actualTopicsFilterOptions, 'asc');
      },
    );

    await dialTest.step(
      'Hover over the long topic name and verify it is cut with three dots and a tooltip with the full name is shown, hover over a topic which is not cut and verify no tooltip is shown',
      async () => {
        const longTopicLabel = marketplaceFilter.filterByPropertyOptionLabel(
          MarketplaceFilterTypes.topics,
          longTopic,
        );
        await baseAssertion.assertElementTextIsTruncated(longTopicLabel);
        await longTopicLabel.hover();
        await tooltipAssertion.assertTooltipContent(longTopic);
        await page.mouse.move(0, 0);
        await tooltip.waitForState({ state: 'hidden' });

        const shortTopicLabel = marketplaceFilter.filterByPropertyOptionLabel(
          MarketplaceFilterTypes.topics,
          firstTopic,
        );
        await shortTopicLabel.hover();
        await tooltipAssertion.assertTooltipState('hidden');
      },
    );

    await dialTest.step(
      'Collapse Topics section, refresh the browser and verify the section stays collapsed',
      async () => {
        const topicsOptions = marketplaceFilter.filterByPropertyOptions(
          MarketplaceFilterTypes.topics,
        );
        await marketplaceFilter
          .filterByProperty(MarketplaceFilterTypes.topics)
          .click();
        await baseAssertion.assertElementState(topicsOptions, 'hidden');

        await marketplacePage.reloadPage();
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(topicsOptions, 'hidden');

        await marketplaceFilter
          .filterByProperty(MarketplaceFilterTypes.topics)
          .click();
        await baseAssertion.assertElementState(topicsOptions, 'visible');
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
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          actualAgents.length,
          2,
          ExpectedMessages.conversationsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualAgents
            .filter((agent) => agent.isWorkspaceEntity)
            .map((agent) => agent.name),
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
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          actualAgents.length,
          3,
          ExpectedMessages.conversationsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualAgents
            .filter((agent) => agent.isWorkspaceEntity)
            .map((agent) => agent.name),
          [firstAppName, secondAppName, thirdAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Switch to "My Workspace" tab and verify only first and second apps are displayed, third app stay under "Suggested results"',
      async () => {
        await navigationPanel.goToMyWorkspace();
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        const filteredAgents = actualAgents.filter(
          (agent) => agent.isWorkspaceEntity,
        );
        baseAssertion.assertValue(
          filteredAgents.length,
          2,
          ExpectedMessages.conversationsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredAgents.map((agent) => agent.name),
          [firstAppName, secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );

        const suggestedAgents = actualAgents.filter(
          (agent) => agent.isSuggested,
        );
        baseAssertion.assertValue(
          suggestedAgents.length,
          1,
          ExpectedMessages.conversationsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          suggestedAgents.map((agent) => agent.name),
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
    marketplaceEntitiesSection,
    marketplaceEntities,
    toast,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-2684', 'EPMDIAL-2685', 'EPMDIAL-2687');
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
        const actualSuggestedAgents =
          await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          actualSuggestedAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedAgents
            .filter((agent) => agent.isSuggested)
            .map((agent) => agent.name),
          [marketplaceAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Bookmark suggested app and verify it is moved to the workspace results, no apps are suggested',
      async () => {
        const marketplaceAppElement =
          await marketplaceEntitiesSection.findEntityElement(
            marketplaceAppName,
          );
        await marketplaceEntities.addEntityToWorkspace(marketplaceAppElement);
        await toast.closeToast();
        const filteredAgents =
          await marketplaceEntitiesSection.getAllEntities();
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(
            marketplaceAppElement,
          ),
          'visible',
        );
        baseAssertion.assertValue(
          filteredAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredAgents
            .filter((agent) => agent.isWorkspaceEntity)
            .map((agent) => agent.name),
          [marketplaceAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        await baseAssertion.assertElementState(
          marketplace.marketplaceSuggestionsLabel,
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
          marketplaceEntitiesSection,
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
          ExpectedConstants.noMarketplaceEntitiesFoundMessage,
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
    marketplaceEntities,
    marketplaceEntitiesSection,
    confirmationDialog,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-2686');
    const firstAppName = GeneratorUtil.randomApplicationName();
    const secondAppName = GeneratorUtil.randomApplicationName();
    const appTopic = GeneratorUtil.randomString(5);
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
        const filteredAgents =
          await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          filteredAgents.length,
          2,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredAgents
            .filter((agent) => agent.isWorkspaceEntity)
            .map((agent) => agent.name),
          [firstAppName, secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Delete the first app and verify it disappears immediately, topic stays checked',
      async () => {
        const firstAppElement =
          await marketplaceEntitiesSection.findEntityElement(firstAppName);
        await firstAppElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(firstAppElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        const filteredAgents =
          await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          filteredAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          filteredAgents
            .filter((agent) => agent.isWorkspaceEntity)
            .map((agent) => agent.name),
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
        const secondAppElement =
          await marketplaceEntitiesSection.findEntityElement(secondAppName);
        await secondAppElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(secondAppElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        const filteredAgents =
          await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertArrayExcludesAll(
          filteredAgents
            .filter((agent) => agent.isWorkspaceEntity)
            .map((agent) => agent.name),
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
    navigationPanel,
    marketplaceFilter,
    marketplaceEntitiesSection,
    entityDetailsModal,
    entityVersionsDropdownMenuAssertion,
    marketplaceEntities,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-2688', 'EPMDIAL-2682');
    const appName = GeneratorUtil.randomApplicationName();
    const firstVersion = ExpectedConstants.defaultEntityVersion;
    const secondVersion = '0.0.2';
    const firstAppTopic = GeneratorUtil.randomString(7);
    const secondAppTopic = GeneratorUtil.randomString(10);
    let topicFilter: Locator;
    let agentElement: BaseElement;

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
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          allAgents.length,
          1,
          ExpectedMessages.conversationsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          allAgents
            .filter((agent) => agent.isWorkspaceEntity)
            .map((agent) => agent.name),
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );

        agentElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityVersion(agentElement),
          firstVersion,
        );
        await baseAssertion.assertElementInnerText(
          marketplaceEntities.getEntityTopicsContainer(agentElement),
          [firstAppTopic],
        );
      },
    );

    await dialTest.step(
      'Open the agent and verify v1 and first topic are displayed on the card',
      async () => {
        await agentElement.click();
        await baseAssertion.assertElementText(
          entityDetailsModal.entityVersion,
          firstVersion,
        );
        await baseAssertion.assertElementInnerText(
          entityDetailsModal.entityTopics,
          [firstAppTopic],
        );
        await entityDetailsModal.versionMenuTrigger.click();
        await entityVersionsDropdownMenuAssertion.assertMenuIncludesOptions(
          firstVersion,
          secondVersion,
        );
        await entityDetailsModal.closeButton.click();
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
        const agentElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementWithVersion(
            agentElement,
            secondVersion,
          ),
          'visible',
        );
        await baseAssertion.assertElementInnerText(
          marketplaceEntities.getEntityTopicsContainer(agentElement),
          [secondAppTopic],
        );
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementWithVersion(
            agentElement,
            firstVersion,
          ),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open the agent and verify v2 and second topic are displayed on the card',
      async () => {
        await agentElement.click();
        await baseAssertion.assertElementText(
          entityDetailsModal.entityVersion,
          secondVersion,
        );
        await baseAssertion.assertElementInnerText(
          entityDetailsModal.entityTopics,
          [secondAppTopic],
        );
        await entityDetailsModal.versionMenuTrigger.click();
        await entityVersionsDropdownMenuAssertion.assertMenuIncludesOptions(
          firstVersion,
          secondVersion,
        );
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Switch to "My Workspace" tab, check app first topic option in the filter and verify the app with v1 and first topic is suggested',
      async () => {
        await navigationPanel.goToMyWorkspace();
        await topicFilter.click();
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          allAgents.length,
          1,
          ExpectedMessages.conversationsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          allAgents
            .filter((agent) => agent.isSuggested)
            .map((agent) => agent.name),
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );

        const agentElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementWithVersion(
            agentElement,
            firstVersion,
          ),
          'visible',
        );
        await baseAssertion.assertElementInnerText(
          marketplaceEntities.getEntityTopicsContainer(agentElement),
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
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          allAgents.length,
          1,
          ExpectedMessages.conversationsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          allAgents
            .filter((agent) => agent.isSuggested)
            .map((agent) => agent.name),
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        const agentElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementWithVersion(
            agentElement,
            secondVersion,
          ),
          'visible',
        );
        await baseAssertion.assertElementInnerText(
          marketplaceEntities.getEntityTopicsContainer(agentElement),
          [secondAppTopic],
        );
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementWithVersion(
            agentElement,
            firstVersion,
          ),
          'hidden',
        );
      },
    );
  },
);

dialTest(
  'Topics: indication when filter is applied.\n' +
    'Topics: use comma in topic names.\n' +
    'Topics/Types/Sources: indication on Filter panel icon',
  async ({
    setTestIds,
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    header,
    marketplaceFilter,
    marketplaceEntitiesSection,
    marketplaceHeader,
    entityDetailsModal,
    marketplaceEntities,
    tooltip,
    baseAssertion,
    tooltipAssertion,
  }) => {
    setTestIds('EPMDIAL-2693', 'EPMDIAL-2692', 'EPMDIAL-5587');
    const topicsToSelect = Array.from({ length: 10 }, () =>
      GeneratorUtil.randomString(6),
    );
    const commaTopic = `${GeneratorUtil.randomString(5)}, ${GeneratorUtil.randomString(5)}`;
    const applicationName = GeneratorUtil.randomApplicationName();
    const allTopics = [...topicsToSelect, commaTopic];

    const assertCommaTopicIsDisplayedAsSingleItem = async (
      container: BaseElement,
    ) => {
      const visibleTopicsElement =
        marketplaceEntities.getEntityVisibleTopics(container);
      const visibleCount = await visibleTopicsElement.getElementsCount();
      await baseAssertion.assertElementInnerText(
        visibleTopicsElement,
        allTopics.slice(0, visibleCount),
      );
      if (visibleCount < allTopics.length) {
        const hiddenTopicsElement =
          marketplaceEntities.getEntityHiddenTopics(container);
        await hiddenTopicsElement.click();
        await tooltipAssertion.assertTooltipContent(
          allTopics.slice(visibleCount).join('\n'),
        );
        const hiddenCount = (await tooltip.getContent()).split('\n').length;
        baseAssertion.assertValue(
          visibleCount + hiddenCount,
          allTopics.length,
          ExpectedMessages.numberOfTopicsIsCorrect,
        );
        await hiddenTopicsElement.click();
      } else {
        baseAssertion.assertValue(
          visibleCount,
          allTopics.length,
          ExpectedMessages.numberOfTopicsIsCorrect,
        );
      }
    };

    await dialTest.step(
      'Prepare a custom application with at least 10 topics and a topic containing a comma via API',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(applicationName)
          .withDescriptionKeywords(...topicsToSelect, commaTopic)
          .build();
        await applicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialTest.step(
      'Open DIAL Marketplace, expand Filters panel, select at least 10 items in Topics section and verify the selected count indicator appears near the section name, no dot indicator is displayed on the panel toggle',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        for (const topic of topicsToSelect) {
          await marketplaceFilter
            .filterByPropertyOptionInput(MarketplaceFilterTypes.topics, topic)
            .click();
        }
        await baseAssertion.assertElementText(
          marketplaceFilter.filterPropertySelectedCount(
            MarketplaceFilterTypes.topics,
          ),
          topicsToSelect.length.toString(),
        );
        await baseAssertion.assertElementState(
          header.leftPanelDotIndicator,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify the comma-containing topic is displayed as a single topic on the card, in the card detailed view and in the filter panel',
      async () => {
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(applicationName);
        const agentElement =
          await marketplaceEntitiesSection.findEntityElement(applicationName);
        await assertCommaTopicIsDisplayedAsSingleItem(agentElement);

        await agentElement.click();
        await assertCommaTopicIsDisplayedAsSingleItem(entityDetailsModal);
        await entityDetailsModal.closeButton.click();

        const actualTopicsFilterOptions =
          await marketplaceFilter.filterByPropertyOptionLabels(
            MarketplaceFilterTypes.topics,
          );
        baseAssertion.assertArrayIncludesAll(
          actualTopicsFilterOptions,
          [commaTopic],
          MarketplaceExpectedMessages.filterOptionsAreValid,
        );
      },
    );

    await dialTest.step(
      'Collapse left panel and verify dot indicator is displayed on the panel toggle',
      async () => {
        await header.leftPanelToggle.click();
        await baseAssertion.assertElementState(
          header.leftPanelDotIndicator,
          'visible',
        );
      },
    );
  },
);
