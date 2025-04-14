import { Publication } from '@/chat/types/publication';
import config from '@/config/chat.playwright.config';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
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

dialTest.afterAll(async ({ adminPublicationApiHelper }) => {
  for (const publication of publicationsToUnpublish) {
    const unpublishResponse =
      await adminPublicationApiHelper.createUnpublishRequest(publication);
    await adminPublicationApiHelper.approveRequest(unpublishResponse);
  }
});
