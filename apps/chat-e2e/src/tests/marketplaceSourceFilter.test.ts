import { EntityType } from '@/chat/types/common';
import { Publication } from '@/chat/types/publication';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  AddAppMenuOptions,
  ApplicationTypes,
  Attachment,
  CheckboxState,
  EntityEditorAppTypes,
  ExpectedConstants,
  ExpectedMessages,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
  SourcesFilterOptions,
} from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';
import { Locator } from '@playwright/test';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  'Sources: check My Custom apps.\n' +
    'Sources: combination inside sources filter works as OR; combination sources + type/topic works as AND.\n' +
    '[App Editor]: Filters and search results are saved when edit field icon for custom app',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    marketplace,
    marketplaceFilter,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    modelApiHelper,
    setTestIds,
    baseAssertion,
    fileApiHelper,
    entityEditorGeneralForm,
    fileManagerModal,
    fileManagerModalGrid,
    entityEditorHeader,
  }) => {
    setTestIds('EPMDIAL-2697', 'EPMDIAL-2705', 'EPMDIAL-2644');
    const appName = GeneratorUtil.randomApplicationName();
    const appTopic = GeneratorUtil.randomString(7);
    let initIconUrl: string;
    let searchInput: BaseElement;

    await dialTest.step('Upload images to the root path', async () => {
      initIconUrl = await fileApiHelper.putFile(Attachment.appIconSvg);
      await fileApiHelper.putFile(Attachment.cloudImageName);
    });

    await dialTest.step(
      'Prepare a custom application with some topic in the "My Workspace"',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDescriptionKeywords(appTopic)
          .withIconUrl(initIconUrl)
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
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
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
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
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
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(GeneratorUtil.randomString(10));
        await baseAssertion.assertElementState(
          marketplace.noResultsFound,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Set app name in the search field and open it for edit',
      async () => {
        await searchInput.fillInInput(appName);
        const agentElement = await marketplaceEntitiesSection.findEntityElement(
          appName,
          {
            isWorkspaceEntity: true,
            isEditable: true,
          },
        );
        await marketplaceEntities.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.edit);
      },
    );

    await dialTest.step('Update app icon', async () => {
      await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
        isHttpMethodTriggered: false,
      });
      await baseAssertion.assertElementState(
        entityEditorGeneralForm,
        'visible',
      );
      await entityEditorGeneralForm.changeIcon.click();
      const attachmentCheckbox =
        await fileManagerModalGrid.gridCheckboxByNameCell(
          Attachment.cloudImageName,
        );
      await attachmentCheckbox.click();
      await fileManagerModal.getSelectButton().click();
      await entityEditorHeader.saveAndExitButton.click();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Verify search string and Source filter are preserved',
      async () => {
        await baseAssertion.assertElementAttribute(
          searchInput,
          Attributes.value,
          appName,
        );
        await baseAssertion.assertCheckboxState(
          marketplaceFilter.filterByPropertyOptionInput(
            MarketplaceFilterTypes.sources,
            SourcesFilterOptions.myCustomApps,
          ),
          CheckboxState.checked,
        );
      },
    );
  },
);

dialTest(
  'Sources: the search results are updated if to remove/add custom application.\n' +
    'Sources: the filter disappears and search results are updated if to remove custom application when only one existed.\n' +
    `My workspace: The button is named 'Add app', the menu has names 'Custom app', 'Code app'`,
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    addAppDropdownMenu,
    navigationPanel,
    marketplaceFilter,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    addAppDropdownMenuAssertion,
    entityEditorPage,
    entityEditorGeneralForm,
    customAppEditorViewForm,
    entityEditorHeader,
    confirmationDialog,
    setTestIds,
    baseAssertion,
    entityDetailsModal,
  }) => {
    setTestIds('EPMDIAL-2704', 'EPMDIAL-2703', 'EPMDIAL-2590');
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
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [firstAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Navigate to "My Workspace" and verify "Add app" button title and available menu options',
      async () => {
        await navigationPanel.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementText(
          marketplaceHeader.addAppButton,
          ExpectedConstants.addAppButtonTitle,
        );
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenuAssertion.assertMenuIncludesOptions(
          ...Object.values(AddAppMenuOptions),
        );
      },
    );

    await dialTest.step('Create one more custom application', async () => {
      await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
      await entityEditorPage.waitForPageLoaded(EntityEditorAppTypes.CustomApp);
      await entityEditorGeneralForm.fillInEntityFields({
        name: secondAppName,
      });
      await entityEditorGeneralForm.goNext({
        hostsArray: [API.applicationCreateHost, API.installedDeploymentsHost()],
      });
      await customAppEditorViewForm.fillInAppFields();
      await entityEditorHeader.focusOn({
        triggeredHost: API.applicationCreateHost,
      });
      await entityEditorHeader.saveAndExitButton.click();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Verify newly added app is displayed immediately',
      async () => {
        await entityDetailsModal.closeButton.click();
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
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
          await marketplaceEntitiesSection.findEntityElement(firstAppName);
        await agentElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        await baseAssertion.assertCheckboxState(
          myCustomAppsSourceFilterElement,
          CheckboxState.checked,
        );
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
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
    additionalShareUserMarketplaceEntitiesSection,
    additionalShareUserNavigationPanel,
    additionalShareUserEntityDetailsModal,
    setTestIds,
    baseAssertion,
  }) => {
    dialSharedWithMeTest.slow();
    setTestIds('EPMDIAL-2701', 'EPMDIAL-2702', 'EPMDIAL-2581');
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
        await additionalShareUserLocalStorageManager.setRecentModelsIdsAndUseLastModel();
        await additionalShareUserMarketplacePage.openMarketplacePage({
          updateInstalledToolsets: false,
        });
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
          await additionalShareUserMarketplaceEntitiesSection.getAllEntities();
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
          await additionalShareUserMarketplaceEntitiesSection.findEntityElement(
            sharedAppName,
          );
        await sharedAppElement.click();
        await baseAssertion.assertElementState(
          additionalShareUserEntityDetailsModal.copyLink,
          'hidden',
        );
        await additionalShareUserEntityDetailsModal.closeButton.click();
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
              await additionalShareUserMarketplaceEntitiesSection.getAllEntities();
          } else {
            await additionalShareUserNavigationPanel.goToMyWorkspace();
            await additionalShareUserMarketplacePage.waitForPageLoaded();
            actualAgents =
              await additionalShareUserMarketplaceEntitiesSection.getAllEntities();
            baseAssertion.assertValue(
              actualAgents.filter((agent) => agent.isWorkspaceEntity).length,
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
          baseAssertion.assertArrayIncludesAll(
            actualAgents.map((agent) => agent.name),
            expectedAgentNames,
            MarketplaceExpectedMessages.filteredAgentsAreValid,
          );
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
