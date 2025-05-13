import { EntityType } from '@/chat/types/common';
import { Publication } from '@/chat/types/publication';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  AddAppMenuOptions,
  ApplicationTypes,
  CheckboxState,
  ExpectedMessages,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
  SourcesFilterOptions,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';
import { Locator, expect } from '@playwright/test';

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
    marketplaceAgentsSection,
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
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );

        const configAgents = await modelApiHelper.getModels();
        for (const actualAgent of actualAgents) {
          const agent = await modelApiHelper.getAgentByNameAndVersion(
            { name: actualAgent.name, version: actualAgent.version },
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
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          actualAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
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
    navigationPanel,
    marketplaceFilter,
    marketplaceHeader,
    marketplaceAgentsSection,
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
      'Open "My Workspace", check "My Custom apps" option and verify created app is displayed',
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
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [firstAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Create one more custom application in the "My Workspace"',
      async () => {
        await navigationPanel.goToMyWorkspace();
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await appEditorPage.waitForPageLoaded();
        await appEditorGeneralForm.fillInAppFields({
          name: secondAppName,
        });
        await appEditorGeneralForm.goNext();
        await appEditorViewForm.fillInAppFields();
        await appEditorHeader.focusOn();
        await appEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Verify newly added app is displayed immediately',
      async () => {
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [firstAppName, secondAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Delete the first app and verify it disappears immediately',
      async () => {
        const agentElement =
          await marketplaceAgentsSection.findAgentElement(firstAppName);
        await agentElement.hoverOver();
        await marketplaceAgents.getAgentElementDotsMenu(agentElement).click();
        await marketplaceAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        await baseAssertion.assertCheckboxState(
          myCustomAppsSourceFilterElement,
          CheckboxState.checked,
        );
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        const actualAgentNames = actualAgents.map((agent) => agent.name);
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
    'Sources: check Public. And Sorting order - alphabetically.\n' +
    'Copy link is not available for Shared with me applications',
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
    additionalShareUserMarketplaceAgentsSection,
    additionalShareUserNavigationPanel,
    additionalShareUserAgentDetailsModal,
    setTestIds,
    baseAssertion,
  }) => {
    dialSharedWithMeTest.slow();
    setTestIds('EPMRTC-5237', 'EPMRTC-5233', 'EPMRTC-5276');
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
        const actualAgents =
          await additionalShareUserMarketplaceAgentsSection.getAllAgents();
        const actualAgentNames = actualAgents.map((agent) => agent.name);
        baseAssertion.assertArrayIncludesAll(
          actualAgentNames,
          [sharedAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
        baseAssertion.assertArrayExcludesAll(
          actualAgentNames,
          [publishedAppName, additionalUserAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Open shared app and verify no Copy link is available',
      async () => {
        const sharedAppElement =
          await additionalShareUserMarketplaceAgentsSection.findAgentElement(
            sharedAppName,
          );
        await sharedAppElement.click();
        await baseAssertion.assertElementState(
          additionalShareUserAgentDetailsModal.copyLink,
          'hidden',
        );
        await additionalShareUserAgentDetailsModal.closeButton.click();
      },
    );

    for (const tab of ['Marketplace', 'My workspace']) {
      await dialTest.step(
        `Uncheck "Shared with me" filter option, check "Public" and verify only published and config apps are displayed on ${tab}`,
        async () => {
          let actualAgents;
          if (tab === 'Marketplace') {
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
            actualAgents =
              await additionalShareUserMarketplaceAgentsSection.getAllAgents();
          } else {
            await additionalShareUserNavigationPanel.goToMyWorkspace();
            await additionalShareUserMarketplacePage.waitForPageLoaded();
            //remove next line when fixed https://github.com/epam/ai-dial-chat/issues/3303
            await additionalShareUserMarketplaceAgentsSection.goTop();
            actualAgents =
              await additionalShareUserMarketplaceAgentsSection.getAllAgents();
            baseAssertion.assertValue(
              actualAgents.filter((agent) => agent.isWorkspaceAgent).length,
              0,
            );
            await baseAssertion.assertElementState(
              additionalShareUserMarketplace.noWorkspaceResultsFound,
              'visible',
            );
          }

          const actualAgentNames = actualAgents.map((agent) => agent.name);
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

          const allConfigAgents =
            await additionalUserModelApiHelper.getModels();
          //exclude Application type agents from verification since the list of application is changeable
          const groupedConfigAgents = ModelsUtil.groupEntitiesByName(
            allConfigAgents.filter((a) => a.type !== EntityType.Application),
          );
          const expectedAgentNames = Array.from(
            groupedConfigAgents.keys(),
          ).filter((k) => k !== sharedAppName && k !== additionalUserAppName);
          for (const expectedAgentName of expectedAgentNames) {
            expect
              .soft(
                actualAgents.find((agent) => agent.name === expectedAgentName),
                MarketplaceExpectedMessages.filteredAgentsAreValid,
              )
              .toBeDefined();
          }
        },
      );
    }
  },
);

dialTest.afterAll(async ({ adminPublicationApiHelper }) => {
  for (const publication of publicationsToUnpublish) {
    const unpublishResponse =
      await adminPublicationApiHelper.createUnpublishRequest(publication);
    await adminPublicationApiHelper.approveRequest(unpublishResponse);
  }
});
