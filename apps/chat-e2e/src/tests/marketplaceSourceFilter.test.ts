import { Publication } from '@/chat/types/publication';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  AddAppMenuOptions,
  ApplicationTypes,
  CheckboxState,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
  SourcesFilterOptions,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';
import { Locator } from '@playwright/test';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  'Sources: check My Custom apps.\n' +
    'Sources: combination inside sources filter works as OR; combination sources + type/topic works as AND',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    marketplace,
    marketplaceFilter,
    marketplaceHeader,
    marketplaceAgents,
    modelApiHelper,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-5234', 'EPMRTC-5239');
    const appName = GeneratorUtil.randomApplicationName();
    const appTopic = GeneratorUtil.randomString(7);

    await dialTest.step(
      'Prepare a custom application with some topic in the "My Workspace"',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDescriptionKeywords(appTopic)
          .build();
        await applicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialTest.step(
      'Open "My Workspace" and verify "My Custom apps" and "Public" options are available in the Sources filter',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(
          marketplaceFilter.filterByProperty(MarketplaceFilterTypes.sources),
          'visible',
        );
        const actualSourcesFilterOptions =
          await marketplaceFilter.filterByPropertyOptionLabels(
            MarketplaceFilterTypes.sources,
          );
        baseAssertion.assertArrayIncludesAll(
          actualSourcesFilterOptions,
          [SourcesFilterOptions.myCustomApps, SourcesFilterOptions.public],
          MarketplaceExpectedMessages.filterOptionsAreValid,
        );
      },
    );

    await dialTest.step(
      'Check "My Custom apps" option and verify only custom apps are displayed',
      async () => {
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.sources,
            SourcesFilterOptions.myCustomApps,
          )
          .click();
        const actualAgentNames = await marketplaceAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualAgentNames,
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );

        const configAgents = await modelApiHelper.getModels();
        for (const agentName of actualAgentNames) {
          const agentVersion = await marketplaceAgents
            .getAgentVersion(agentName)
            .getElementInnerContent();
          const agent = await modelApiHelper.getAgentByNameAndVersion(
            { name: agentName, version: agentVersion },
            configAgents,
          );
          if (agent) {
            baseAssertion.assertValue(
              ModelsUtil.getApplicationType(agent),
              ApplicationTypes.CUSTOM_APP,
            );
          }
        }
      },
    );

    await dialTest.step(
      'Check app topic filter option and verify only created app is displayed',
      async () => {
        await marketplaceFilter
          .filterByPropertyOptionInput(MarketplaceFilterTypes.topics, appTopic)
          .click();
        await baseAssertion.assertElementsCount(marketplaceAgents, 1);
        baseAssertion.assertArrayIncludesAll(
          await marketplaceAgents.getAgentNames(),
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Set random string in the search field and verify no results are displayed',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await baseAssertion.assertElementState(
          marketplace.noResultsFound,
          'visible',
        );
      },
    );
  },
);

dialTest(
  'Sources: the search results are updated if to remove/add custom application.\n' +
    'Sources: the filter disappears and search results are updated if to remove custom application when only one existed',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    addAppDropdownMenu,
    marketplaceSidebar,
    marketplaceFilter,
    marketplaceHeader,
    marketplaceAgents,
    appEditorPage,
    appEditorGeneralForm,
    appEditorViewForm,
    appEditorHeader,
    confirmationDialog,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-5351', 'EPMRTC-5238');
    const firstAppName = GeneratorUtil.randomApplicationName();
    const secondAppName = GeneratorUtil.randomApplicationName();
    let myCustomAppsSourceFilterElement: Locator;

    await dialTest.step(
      'Prepare a custom application in the "My Workspace"',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(firstAppName)
          .build();
        await applicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialTest.step(
      'Open "My Workspace", check "My Custom apps" option and verify and verify created app is displayed',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(
          marketplaceFilter.filterByProperty(MarketplaceFilterTypes.sources),
          'visible',
        );
        myCustomAppsSourceFilterElement =
          marketplaceFilter.filterByPropertyOptionInput(
            MarketplaceFilterTypes.sources,
            SourcesFilterOptions.myCustomApps,
          );
        await myCustomAppsSourceFilterElement.click();
        const actualAgentNames = await marketplaceAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualAgentNames,
          [firstAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Create one more custom application in the "My Workspace"',
      async () => {
        await marketplaceSidebar.myWorkspaceButton.click();
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await appEditorPage.waitForPageLoaded();
        await appEditorGeneralForm.fillInAppFields({
          name: secondAppName,
        });
        await appEditorGeneralForm.goNext();
        await appEditorViewForm.fillInAppFields();
        await appEditorHeader.saveAppAndExit();
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Verify newly added app is displayed immediately',
      async () => {
        //TODO: remove filter check when fixed https://github.com/epam/ai-dial-chat/issues/3221
        await myCustomAppsSourceFilterElement.click();
        const actualAgentNames = await marketplaceAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualAgentNames,
          [firstAppName, secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Delete the first app and verify it disappears immediately',
      async () => {
        await marketplaceAgents.getAgent(firstAppName).hoverOver();
        await marketplaceAgents.getAgentDotsMenu(firstAppName).click();
        await marketplaceAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        await baseAssertion.assertCheckboxState(
          myCustomAppsSourceFilterElement,
          CheckboxState.checked,
        );
        const actualAgentNames = await marketplaceAgents.getAgentNames();
        baseAssertion.assertArrayExcludesAll(
          actualAgentNames,
          [firstAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualAgentNames,
          [secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Sources: check Shared with me.\n' +
    'Sources: check Public. And Sorting order - alphabetically',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    adminApplicationApiHelper,
    mainUserShareApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    additionalUserApplicationApiHelper,
    additionalUserShareApiHelper,
    additionalUserFileApiHelper,
    additionalUserModelApiHelper,
    additionalShareUserLocalStorageManager,
    additionalShareUserMarketplacePage,
    additionalShareUserMarketplace,
    additionalShareUserMarketplaceFilter,
    additionalShareUserMarketplaceAgents,
    additionalShareUserMarketplaceSidebar,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-5237', 'EPMRTC-5233');
    const sharedAppName = GeneratorUtil.randomApplicationName();
    const publishedAppName = GeneratorUtil.randomApplicationName();
    const additionalUserAppName = GeneratorUtil.randomApplicationName();
    let shareByLinkResponse: ShareByLinkResponseModel;
    let sharedWithMeSourceFilterElement: Locator;

    await dialSharedWithMeTest.step(
      'By main user create a custom application and share it',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(sharedAppName)
          .build();
        const backendApp =
          await applicationApiHelper.createApplication(applicationModel);
        shareByLinkResponse =
          await mainUserShareApiHelper.shareAppByLink(backendApp);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
      'By admin user create a custom application and publish it',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(publishedAppName)
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

    await dialSharedWithMeTest.step(
      'By additional user create a custom application',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(additionalUserAppName)
          .build();
        await additionalUserApplicationApiHelper.createApplication(
          applicationModel,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open "Marketplace" and verify Sources filter contains "Shared with me", "My Custom apps", "Public" options sorted alphabetically',
      async () => {
        await additionalUserFileApiHelper.updateInstalledDeployments([]);
        await additionalShareUserLocalStorageManager.setRecentModelsIds();
        await additionalShareUserMarketplacePage.openMarketplacePage();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        const sourceFilterOptions =
          await additionalShareUserMarketplaceFilter.filterByPropertyOptionLabels(
            MarketplaceFilterTypes.sources,
          );
        baseAssertion.assertArrayIncludesAll(
          sourceFilterOptions,
          [
            SourcesFilterOptions.myCustomApps,
            SourcesFilterOptions.public,
            SourcesFilterOptions.sharedWithMe,
          ],
          MarketplaceExpectedMessages.filterOptionsAreValid,
        );
        baseAssertion.assertStringsSorting(sourceFilterOptions, 'asc');
      },
    );

    await dialTest.step(
      'Check "Shared with me" filter option and verify shared app is displayed',
      async () => {
        sharedWithMeSourceFilterElement =
          additionalShareUserMarketplaceFilter.filterByPropertyOptionInput(
            MarketplaceFilterTypes.sources,
            SourcesFilterOptions.sharedWithMe,
          );
        await sharedWithMeSourceFilterElement.click();
        await baseAssertion.assertCheckboxState(
          sharedWithMeSourceFilterElement,
          CheckboxState.checked,
        );
        const actualAgentNames =
          await additionalShareUserMarketplaceAgents.getAgentNames();
        await baseAssertion.assertElementsCount(
          additionalShareUserMarketplaceAgents,
          1,
        );
        baseAssertion.assertArrayIncludesAll(
          actualAgentNames,
          [sharedAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Uncheck "Shared with me" filter option, check "Public" and verify only published and config apps are displayed',
      async () => {
        await sharedWithMeSourceFilterElement.click();
        await baseAssertion.assertCheckboxState(
          sharedWithMeSourceFilterElement,
          CheckboxState.unchecked,
        );
        const publicSourceFilterElement =
          additionalShareUserMarketplaceFilter.filterByPropertyOptionInput(
            MarketplaceFilterTypes.sources,
            SourcesFilterOptions.public,
          );
        await publicSourceFilterElement.click();
        await baseAssertion.assertCheckboxState(
          publicSourceFilterElement,
          CheckboxState.checked,
        );
        const actualAgentNames =
          await additionalShareUserMarketplaceAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualAgentNames,
          [publishedAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        baseAssertion.assertArrayExcludesAll(
          actualAgentNames,
          [sharedAppName, additionalUserAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        const groupedConfigAgents = ModelsUtil.groupEntitiesByName(
          await additionalUserModelApiHelper.getModels(),
        );
        const expectedAgents = Array.from(groupedConfigAgents.keys()).filter(
          (k) => k !== sharedAppName && k !== additionalUserAppName,
        );
        for (const configAgentName of expectedAgents) {
          await baseAssertion.assertElementState(
            additionalShareUserMarketplaceAgents.getAgent(configAgentName),
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Switch to "My Workspace" and verify only published and config apps are suggested, no results in the workspace',
      async () => {
        await additionalShareUserMarketplaceSidebar.myWorkspaceButton.click();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementsCount(
          additionalShareUserMarketplace.getFilteredAgents(),
          0,
        );
        await baseAssertion.assertElementState(
          additionalShareUserMarketplace.noWorkspaceResultsFound,
          'visible',
        );
        const groupedConfigAgents = ModelsUtil.groupEntitiesByName(
          await additionalUserModelApiHelper.getModels(),
        );
        const expectedAgents = Array.from(groupedConfigAgents.keys()).filter(
          (k) => k !== sharedAppName && k !== additionalUserAppName,
        );
        for (const configAgentName of expectedAgents) {
          await baseAssertion.assertElementState(
            additionalShareUserMarketplaceAgents.getAgent(configAgentName),
            'visible',
          );
        }
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
