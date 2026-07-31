import { EntityType } from '@/chat/types/common';
import { Publication } from '@/chat/types/publication';
import config from '@/config/chat.playwright.config';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  SourcesFilterOptions,
} from '@/src/testData';
import { Attributes, ThemeColorAttributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { BaseElement, MarketplaceEntityProperties } from '@/src/ui/webElements';
import {
  GeneratorUtil,
  ModelsUtil,
  SortingUtil,
  applicationNamePrefix,
} from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  'Search word is stored; search results differ if to switch between My workspace and DIAL Marketplace pages. Search by name. Suggested results on My workspace. The model is without versions.' +
    'Space before and after search phrase is ignored\n' +
    `Search in DIAL Marketplace: 'No results found'.\n` +
    'Search_phrase stays on Refresh. DIAL marketplace tab stays opened.\n' +
    'Search_phrase is applied to another user via URL.\n' +
    'Search_phrase is applied to another user via URL. Search phrase consists of restricted and allowed special chars.',
  async ({
    marketplacePage,
    page,
    marketplaceHeader,
    marketplace,
    marketplaceEntitiesSection,
    navigationPanel,
    localStorageManager,
    setTestIds,
    baseAssertion,
    customApplicationBuilder,
    applicationApiHelper,
    adminApplicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
  }) => {
    setTestIds(
      'EPMDIAL-2633',
      'EPMDIAL-2640',
      'EPMDIAL-2630',
      'EPMDIAL-2656',
      'EPMDIAL-2660',
      'EPMDIAL-2661',
    );
    let installedAppVersion: string;
    let installedAppName: string;
    let nonInstalledAppVersion: string;
    let nonInstalledAppName: string;
    let leadingSpacesSearchTerm: string;
    let leadingEndingSpacesSearchTerm: string;
    let notMatchingTerm: string;
    let searchInput: BaseElement;

    await dialTest.step(
      'Prepare one application visible in "My Workspace" and one available in the "Marketplace", both have common part in the name',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        await localStorageManager.setShowSideBarPanels();
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

        nonInstalledAppVersion = GeneratorUtil.randomEntityVersion([
          ...recentNames,
          ...recentVersions,
          installedAppVersion,
        ]);
        nonInstalledAppName = installedAppName + GeneratorUtil.randomString(7);
        const nonInstalledCustomApplicationModel = customApplicationBuilder
          .withDisplayName(nonInstalledAppName)
          .withDisplayVersion(nonInstalledAppVersion)
          .build();

        //create app by main user in order to have it in My Workspace
        await applicationApiHelper.createApplication(
          installedCustomApplicationModel,
        );
        //create app by admin user and publish it in order to have it in the Marketplace
        const adminApp = await adminApplicationApiHelper.createApplication(
          nonInstalledCustomApplicationModel,
        );
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
      'Open "DIAL Marketplace", search by installed agent name with leading spaces and verify 2 models are found',
      async () => {
        leadingSpacesSearchTerm = ' '.repeat(2) + installedAppName;
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(leadingSpacesSearchTerm);
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          actualAgents.length,
          2,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [installedAppName, nonInstalledAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          leadingSpacesSearchTerm,
        );
      },
    );

    await dialTest.step(
      'Switch to "My Workspace" tab and verify search term is preserved, search results are updated',
      async () => {
        await navigationPanel.goToMyWorkspace();
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          leadingSpacesSearchTerm,
        );

        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        const filteredAgents = allAgents.filter(
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
          'visible',
        );
        const suggestedAgents = allAgents.filter((agent) => agent.isSuggested);
        baseAssertion.assertValue(
          suggestedAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          suggestedAgents.map((agent) => agent.name),
          [nonInstalledAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
      },
    );

    await dialTest.step(
      'Go back to the "Marketplace" tab, type spaces after search term and verify spaces are ignored in the search',
      async () => {
        const endSpaces = ' '.repeat(3);
        leadingEndingSpacesSearchTerm = leadingSpacesSearchTerm + endSpaces;
        await navigationPanel.goToMarketplaceHome();
        await searchInput.click();
        await page.keyboard.press(keys.end);
        await searchInput.typeInInput(endSpaces);
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          actualAgents.length,
          2,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [installedAppName, nonInstalledAppName],
          ExpectedMessages.searchResultsAreCorrect,
        );
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          leadingEndingSpacesSearchTerm,
        );
      },
    );

    await dialTest.step(
      'Continue typing chars into search field and verify no results are found',
      async () => {
        notMatchingTerm = GeneratorUtil.randomString(10);
        await searchInput.typeInInput(notMatchingTerm);
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
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          leadingEndingSpacesSearchTerm + notMatchingTerm,
        );
      },
    );

    await dialTest.step(
      'Reload the page and verify search term is preserved',
      async () => {
        await marketplacePage.reloadPage();
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          leadingEndingSpacesSearchTerm + notMatchingTerm,
        );
      },
    );

    await dialTest.step(
      'Type special chars in the search filed and verify search field is populated if to reopen the url',
      async () => {
        const searchTerm =
          GeneratorUtil.randomString(7) +
          ExpectedConstants.restrictedNameChars +
          ExpectedConstants.allowedSpecialChars;
        await searchInput.fillInInput(searchTerm);
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          searchTerm,
        );
        const pageUrl = page.url();
        //cleanup search field in order to have url without params
        await searchInput.fillInInput('');
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          '',
        );
        baseAssertion.assertValue(
          page.url(),
          config.use!.baseURL!.concat(ExpectedConstants.marketplacePath),
        );
        //navigate to url with special chars as param
        await marketplacePage.navigateToUrl(pageUrl);
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          searchTerm,
        );
      },
    );
  },
);

dialTest(
  'Search by version. My custom application, published applications. Sorting. Suggested options.',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    entityDetailsModal,
    marketplace,
    localStorageManager,
    setTestIds,
    baseAssertion,
    customApplicationBuilder,
    toast,
    applicationApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    entityDetailsModalAssertion,
    entityVersionsDropdownMenuAssertion,
  }) => {
    setTestIds('EPMDIAL-2634');
    let appCommonVersion: string;
    let secondAppFirstVersion: string;
    let secondAppThirdVersion: string;
    let firstAppName: string;
    let secondAppName: string;
    let expectedAgents: MarketplaceEntityProperties[];
    let searchInput: BaseElement;

    await dialTest.step(
      'Prepare one application with v2, another app with v1, v2, v3 available in the "Marketplace". Second app is added to the "My Workspace"',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        const recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        const recentVersions =
          ModelsUtil.getRecentAgentsVersions(recentModelIds);

        appCommonVersion = GeneratorUtil.randomEntityVersion([
          ...recentNames,
          ...recentVersions,
        ]);
        secondAppFirstVersion = GeneratorUtil.randomEntityVersion([
          ...recentNames,
          ...recentVersions,
          appCommonVersion,
        ]);
        secondAppThirdVersion = GeneratorUtil.randomEntityVersion([
          ...recentNames,
          ...recentVersions,
          appCommonVersion,
          secondAppFirstVersion,
        ]);

        firstAppName = GeneratorUtil.randomApplicationName();
        secondAppName = GeneratorUtil.randomApplicationName();

        const firstApplicationModel = customApplicationBuilder
          .withDisplayName(firstAppName)
          .withDisplayVersion(appCommonVersion)
          .build();
        const secondApplicationFirstVersionModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withDisplayVersion(secondAppFirstVersion)
          .build();
        const secondApplicationSecondVersionModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withDisplayVersion(appCommonVersion)
          .build();
        const secondApplicationThirdVersionModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withDisplayVersion(secondAppThirdVersion)
          .build();

        for (const appModel of [
          firstApplicationModel,
          secondApplicationFirstVersionModel,
          secondApplicationSecondVersionModel,
          secondApplicationThirdVersionModel,
        ]) {
          const app = await applicationApiHelper.createApplication(appModel);
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withApplicationResource(app, PublishActions.ADD)
            .build();
          const appPublication =
            await publicationApiHelper.createPublishRequest(publishRequest);
          publicationsToUnpublish.push(appPublication);
          await adminPublicationApiHelper.approveRequest(appPublication);
        }
      },
    );

    await dialTest.step(
      'On the "My Workspace" tab search the second agent and bookmark it',
      async () => {
        await marketplacePage.openMyWorkspacePage();
        await marketplacePage.waitForPageLoaded();
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(secondAppFirstVersion);
        const secondAgentElement =
          await marketplaceEntitiesSection.findEntityElement(secondAppName, {
            isWorkspaceEntity: false,
          });
        await marketplaceEntities.addEntityToWorkspace(secondAgentElement);
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'Search agents by the common version and verify at least 4 cards are found. Editable first agent card, editable and bookmarked second agent cards are found',
      async () => {
        await searchInput.fillInInput(appCommonVersion);
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        expectedAgents = allAgents.filter(
          (a) =>
            (a.name === firstAppName || a.name === secondAppName) &&
            a.version === appCommonVersion,
        );
        baseAssertion.assertNumberIsGreaterThanOrEqual(
          expectedAgents.length,
          4,
          ExpectedMessages.elementsCountIsValid,
        );

        const expectedAgentCriteria = [
          { name: firstAppName, isEditable: true },
          { name: secondAppName, isEditable: true },
          { name: secondAppName, isEditable: false },
        ];
        for (const criteria of expectedAgentCriteria) {
          baseAssertion.assertValue(
            expectedAgents.filter(
              (agent) =>
                agent.name === criteria.name &&
                agent.isEditable === criteria.isEditable &&
                agent.isWorkspaceEntity &&
                agent.version === appCommonVersion,
            ).length,
            1,
            ExpectedMessages.elementsCountIsValid,
          );
        }

        const bookmarkedSecondAgent =
          await marketplaceEntitiesSection.findEntityElement(secondAppName, {
            isWorkspaceEntity: true,
            isEditable: false,
          });
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(
            bookmarkedSecondAgent,
          ),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Not editable first agent card is suggested',
      async () => {
        await baseAssertion.assertElementState(
          marketplace.marketplaceSuggestionsLabel,
          'visible',
        );
        const suggestedAgent = expectedAgents.filter(
          (agent) => agent.isSuggested,
        );
        baseAssertion.assertNumberIsGreaterThanOrEqual(
          suggestedAgent.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertValue(
          expectedAgents.filter(
            (a) =>
              a.name === firstAppName &&
              a.isSuggested &&
              a.version === appCommonVersion &&
              !a.isEditable,
          ).length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );

    await dialTest.step(
      'Open bookmarked second agent card and verify versions available in the menu',
      async () => {
        const bookmarkedSecondAgentElement =
          await marketplaceEntitiesSection.findEntityElement(secondAppName, {
            isWorkspaceEntity: true,
            isEditable: false,
          });
        await bookmarkedSecondAgentElement.click();
        await entityDetailsModalAssertion.assertEntityVersion(appCommonVersion);
        await entityDetailsModal.versionMenuTrigger.click();
        await entityVersionsDropdownMenuAssertion.assertMenuOptions(
          SortingUtil.sortVersionsArray([
            secondAppFirstVersion,
            appCommonVersion,
            secondAppThirdVersion,
          ]),
        );

        await baseAssertion.assertElementBackgroundColors(
          entityDetailsModal
            .getVersionDropdownMenu()
            .menuOption(appCommonVersion),
          ThemesUtil.getRgbColorByKey(
            ThemeColorAttributes.bgAccentPrimaryAlpha,
          ),
        );
      },
    );
  },
);

dialTest(
  'Search in DIAL Marketplace: Search word and other filters work together type and topics.\n' +
    '[Card view] Not published my custom application does not have bookmark icon.\n' +
    '[Detailed card view] Not published my custom application does not have bookmark icon',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    marketplaceFilter,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    entityDetailsModal,
    entityDetailsModalAssertion,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-2635', 'EPMDIAL-2571', 'EPMDIAL-2616');
    const firstAppName = GeneratorUtil.randomApplicationName();
    const secondAppName = GeneratorUtil.randomApplicationName();
    const thirdAppName = GeneratorUtil.randomApplicationName();
    const appTopic = GeneratorUtil.randomString(10);
    let actualAgent: BaseElement;

    await dialTest.step(
      'Prepare three custom applications, two of them have a common topic',
      async () => {
        const firstApplicationModel = customApplicationBuilder
          .withDisplayName(firstAppName)
          .withDescriptionKeywords(appTopic)
          .build();
        const secondApplicationModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withDescriptionKeywords(appTopic)
          .build();
        const thirdApplicationModel = customApplicationBuilder
          .withDisplayName(thirdAppName)
          .build();
        for (const app of [
          firstApplicationModel,
          secondApplicationModel,
          thirdApplicationModel,
        ]) {
          await applicationApiHelper.createApplication(app);
        }
      },
    );

    await dialTest.step(
      'Open "DIAL Marketplace", check Type="Applications", Source="My Custom app" filter options and verify three apps are filtered',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.type,
            EntityType.Application,
          )
          .click();
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.sources,
            SourcesFilterOptions.myCustomApps,
          )
          .click();
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [firstAppName, secondAppName, thirdAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Check apps common topic filter option and verify two apps are filtered',
      async () => {
        await marketplaceFilter
          .filterByPropertyOptionInput(MarketplaceFilterTypes.topics, appTopic)
          .click();
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          actualAgents.length,
          2,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [firstAppName, secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Set first app name in the search field and verify at least one app is filtered',
      async () => {
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(firstAppName);
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertNumberIsGreaterThanOrEqual(
          actualAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        const actualAgentNames = actualAgents.map((agent) => agent.name);
        baseAssertion.assertArrayIncludesAll(
          actualAgentNames,
          [firstAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        baseAssertion.assertArrayExcludesAll(
          actualAgentNames,
          [secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Verify custom app does not have bookmark icon',
      async () => {
        actualAgent =
          await marketplaceEntitiesSection.findEntityElement(firstAppName);
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementAddBookmarkIcon(actualAgent),
          'hidden',
        );
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(actualAgent),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open app card and verify it does not have bookmark icon',
      async () => {
        await actualAgent.click();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.addBookmarkIcon,
          'hidden',
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.removeBookmarkIcon,
          'hidden',
        );
      },
    );
  },
);

dialTest(
  'Search in DIAL Marketplace: multiple spaces between sub-strings are treated as one space , not as sub-string.\n' +
    'Search in DIAL Marketplace: more than 2 special symbols starting with ! are treated as sub-string',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-2645', 'EPMDIAL-2646');
    const middleSpaceAppName = GeneratorUtil.randomApplicationName()
      .concat(' ')
      .concat(GeneratorUtil.randomString(5));
    const specialCharsPart = '!@#$*()';
    const standardPart = GeneratorUtil.randomApplicationName();
    const specialCharsAppName = standardPart.concat(specialCharsPart);
    const searchTermResultMap = new Map<string, string>();
    searchTermResultMap.set(middleSpaceAppName, middleSpaceAppName);
    searchTermResultMap.set(
      middleSpaceAppName.replace(' ', ' '.repeat(5)),
      middleSpaceAppName,
    );
    searchTermResultMap.set(
      standardPart.replace(applicationNamePrefix, '').concat('!@#$%'),
      specialCharsAppName,
    );

    await dialTest.step('Prepare two custom applications', async () => {
      const firstApplicationModel = customApplicationBuilder
        .withDisplayName(middleSpaceAppName)
        .build();
      const secondApplicationModel = customApplicationBuilder
        .withDisplayName(specialCharsAppName)
        .build();
      for (const app of [firstApplicationModel, secondApplicationModel]) {
        await applicationApiHelper.createApplication(app);
      }
    });

    await dialTest.step(
      'Open "DIAL Marketplace", type search term in the search field and verify it is found',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        for (const searchTerm of searchTermResultMap.keys()) {
          await marketplaceHeader
            .getSearch()
            .inputField.fillInInput(searchTerm);
          const actualAgents =
            await marketplaceEntitiesSection.getAllEntities();
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
            [searchTermResultMap.get(searchTerm)!],
            ExpectedMessages.searchResultsAreCorrect,
          );
        }
      },
    );
  },
);

dialTest(
  'Search in DIAL Marketplace. New extended search by name and version',
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
    setTestIds('EPMDIAL-2648');
    const firstTerm = '71234.71234.9';
    const secondTerm = '36789.30123.4';
    const thirdTerm = '71234.71234.0';
    const firstAppName = `${GeneratorUtil.randomApplicationName()} ${firstTerm}`;
    const secondAppName = `${GeneratorUtil.randomApplicationName()} ${secondTerm}`;
    const thirdAppName = GeneratorUtil.randomApplicationName();
    const fourthAppName = GeneratorUtil.randomApplicationName();
    const searchTermResultMap = new Map<string, string[]>();
    searchTermResultMap.set(firstTerm, [
      firstAppName,
      secondAppName,
      thirdAppName,
      fourthAppName,
    ]);
    searchTermResultMap.set(secondTerm.concat(' '.repeat(3)), [
      firstAppName,
      secondAppName,
    ]);
    searchTermResultMap.set(thirdTerm, [
      firstAppName,
      secondAppName,
      thirdAppName,
      fourthAppName,
    ]);
    searchTermResultMap.set(firstTerm.concat('189'), [
      firstAppName,
      secondAppName,
      thirdAppName,
    ]);
    searchTermResultMap.set(firstTerm.concat('1567'), [thirdAppName]);
    let searchInput: BaseElement;

    await dialTest.step(
      'Prepare the set of custom applications with mixture of terms in the name and version',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        const firstAppModel = customApplicationBuilder
          .withDisplayName(firstAppName)
          .withDisplayVersion(secondTerm)
          .build();
        const secondAppModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withDisplayVersion(firstTerm)
          .build();
        const thirdAppModel = customApplicationBuilder
          .withDisplayName(thirdAppName)
          .withDisplayVersion(firstTerm.concat('1'))
          .build();
        const fourthAppModel = customApplicationBuilder
          .withDisplayName(fourthAppName)
          .withDisplayVersion(thirdTerm)
          .build();
        for (const appModel of [
          firstAppModel,
          secondAppModel,
          thirdAppModel,
          fourthAppModel,
        ]) {
          await applicationApiHelper.createApplication(appModel);
        }
      },
    );

    await dialTest.step(
      'Open "DIAL Marketplace", type search term in the search field and verify correct apps are found',
      async () => {
        await marketplacePage.openMarketplacePage();
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
      'Type "71234.71234.915555" in the search field and verify no results are found',
      async () => {
        await searchInput.fillInInput(firstTerm.concat('15555'));
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
