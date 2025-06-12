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
import { BaseElement, MarketplaceAgentProperties } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil, SortingUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

//TODO: test-cases need to be updated after new search mechanism implementation
dialTest.skip(
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
    marketplaceAgentsSection,
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
      'EPMRTC-4318',
      'EPMRTC-4615',
      'EPMRTC-4383',
      'EPMRTC-4317',
      'EPMRTC-5274',
      'EPMRTC-5369',
    );
    let installedAppVersion: string;
    let installedAppName: string;
    let nonInstalledAppVersion: string;
    let nonInstalledAppName: string;
    let leadingSpacesSearchTerm: string;
    let leadingEndingSpacesSearchTerm: string;
    let notMatchingTerm: string;

    await dialTest.step(
      'Prepare one application visible in "My Workspace" and one available in the "Marketplace", both have common part in the name',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        await localStorageManager.setShowSideBarPanels();
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

        nonInstalledAppVersion = GeneratorUtil.randomApplicationVersion([
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
        await marketplaceHeader.searchInput.fillInInput(
          leadingSpacesSearchTerm,
        );
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
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
          marketplaceHeader.searchInput,
          Attributes.value,
          leadingSpacesSearchTerm,
        );
      },
    );

    await dialTest.step(
      'Switch to "My Workspace" tab, and verify search term is preserved, search results are updated',
      async () => {
        await navigationPanel.goToMyWorkspace();
        await baseAssertion.assertElementAttribute(
          marketplaceHeader.searchInput,
          Attributes.value,
          leadingSpacesSearchTerm,
        );

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
        await marketplaceHeader.searchInput.click();
        await page.keyboard.press(keys.end);
        await marketplaceHeader.searchInput.typeInInput(endSpaces);
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
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
          marketplaceHeader.searchInput,
          Attributes.value,
          leadingEndingSpacesSearchTerm,
        );
      },
    );

    await dialTest.step(
      'Continue typing chars into search field and verify no results are found',
      async () => {
        notMatchingTerm = GeneratorUtil.randomString(10);
        await marketplaceHeader.searchInput.typeInInput(notMatchingTerm);
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
        await baseAssertion.assertElementAttribute(
          marketplaceHeader.searchInput,
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
          marketplaceHeader.searchInput,
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
        await marketplaceHeader.searchInput.fillInInput(searchTerm);
        await baseAssertion.assertElementAttribute(
          marketplaceHeader.searchInput,
          Attributes.value,
          searchTerm,
        );
        const pageUrl = page.url();
        //cleanup search field in order to have url without params
        await marketplaceHeader.searchInput.fillInInput('');
        await baseAssertion.assertElementAttribute(
          marketplaceHeader.searchInput,
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
          marketplaceHeader.searchInput,
          Attributes.value,
          searchTerm,
        );
      },
    );
  },
);

//TODO: test-cases need to be updated after new search mechanism implementation
dialTest.skip(
  'Search by version. My custom application, published applications. Sorting. Suggested options.',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    marketplaceAgents,
    agentDetailsModal,
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
    agentDetailsModalAssertion,
    agentVersionsDropdownMenuAssertion,
  }) => {
    setTestIds('EPMRTC-4510');
    let appCommonVersion: string;
    let secondAppFirstVersion: string;
    let secondAppThirdVersion: string;
    let firstAppName: string;
    let secondAppName: string;
    let expectedAgents: MarketplaceAgentProperties[];

    await dialTest.step(
      'Prepare one application with v2, another app with v1, v2, v3 available in the "Marketplace". Second app is added to the "My Workspace"',
      async () => {
        const recentModelIds = await localStorageManager.getRecentModelsIds();
        const recentNames = ModelsUtil.getRecentAgentsNames(recentModelIds);
        const recentVersions =
          ModelsUtil.getRecentAgentsVersions(recentModelIds);

        appCommonVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
        ]);
        secondAppFirstVersion = GeneratorUtil.randomApplicationVersion([
          ...recentNames,
          ...recentVersions,
          appCommonVersion,
        ]);
        secondAppThirdVersion = GeneratorUtil.randomApplicationVersion([
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
        await marketplaceHeader.searchInput.fillInInput(secondAppFirstVersion);
        const secondAgentElement =
          await marketplaceAgentsSection.findAgentElement(secondAppName, {
            isWorkspaceAgent: false,
          });
        await marketplaceAgents.addAgentToWorkspace(secondAgentElement);
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'Search agents by the common version and verify 4 cards are found. Editable first agent card, editable and bookmarked second agent cards are found',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(appCommonVersion);
        const allAgents = await marketplaceAgentsSection.getAllAgents();
        expectedAgents = allAgents.filter(
          (a) =>
            (a.name === firstAppName || a.name === secondAppName) &&
            a.version === appCommonVersion,
        );
        baseAssertion.assertValue(
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
                agent.isWorkspaceAgent &&
                agent.version === appCommonVersion,
            ).length,
            1,
            ExpectedMessages.elementsCountIsValid,
          );
        }

        const bookmarkedSecondAgent =
          await marketplaceAgentsSection.findAgentElement(secondAppName, {
            isWorkspaceAgent: true,
            isEditable: false,
          });
        await baseAssertion.assertElementState(
          marketplaceAgents.getAgentElementRemoveBookmarkIcon(
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
        baseAssertion.assertValue(
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
          await marketplaceAgentsSection.findAgentElement(secondAppName, {
            isWorkspaceAgent: true,
            isEditable: false,
          });
        await bookmarkedSecondAgentElement.click();
        await agentDetailsModalAssertion.assertApplicationVersion(
          appCommonVersion,
        );
        await agentDetailsModal.versionMenuTrigger.click();
        await agentVersionsDropdownMenuAssertion.assertMenuOptions(
          SortingUtil.sortVersionsArray([
            secondAppFirstVersion,
            appCommonVersion,
            secondAppThirdVersion,
          ]),
        );

        await baseAssertion.assertElementBackgroundColors(
          agentDetailsModal
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

//TODO: test-cases need to be updated after new search mechanism implementation
dialTest.skip(
  'Search in DIAL Marketplace: Search word and other filters work together type and topics.\n' +
    '[Card view] Not published my custom application does not have bookmark icon.\n' +
    '[Detailed card view] Not published my custom application does not have bookmark icon',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    marketplaceFilter,
    marketplaceHeader,
    marketplaceAgentsSection,
    marketplaceAgents,
    agentDetailsModal,
    agentDetailsModalAssertion,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-4425', 'EPMRTC-4610', 'EPMRTC-4609');
    const firstAppName = GeneratorUtil.randomApplicationName();
    const secondAppName = GeneratorUtil.randomApplicationName();
    const thirdAppName = GeneratorUtil.randomApplicationName();
    const appTopic = GeneratorUtil.randomString(5);
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
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
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
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
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
      'Set first app name in the search field and verify only one app is filtered',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(firstAppName);
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          actualAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [firstAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Verify custom app does not have bookmark icon',
      async () => {
        actualAgent =
          await marketplaceAgentsSection.findAgentElement(firstAppName);
        await baseAssertion.assertElementState(
          marketplaceAgents.getAgentElementAddBookmarkIcon(actualAgent),
          'hidden',
        );
        await baseAssertion.assertElementState(
          marketplaceAgents.getAgentElementRemoveBookmarkIcon(actualAgent),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open app card and verify it does not have bookmark icon',
      async () => {
        await actualAgent.click();
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.addBookmarkIcon,
          'hidden',
        );
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.removeBookmarkIcon,
          'hidden',
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
