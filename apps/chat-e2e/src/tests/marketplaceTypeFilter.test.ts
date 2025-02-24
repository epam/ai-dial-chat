import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  CheckboxState,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

dialTest(
  'Types: the filter is applied and search results are shown. Models. DIAL Marketplace.\n' +
    'Types: the filter is applied and search results are shown. Models. My workspace. Suggested results.\n' +
    'Types: the filter is applied and search results are shown. Models. My workspace. No results.\n' +
    'Filters stay selected on Refresh. My workspace tab stays opened.\n',
  async ({
    setTestIds,
    fileApiHelper,
    localStorageManager,
    marketplacePage,
    marketplaceFilter,
    marketplace,
    marketplaceAgents,
    marketplaceSidebar,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-4435', 'EPMRTC-4620', 'EPMRTC-4439', 'EPMRTC-5363');
    let allModels: DialAIEntityModel[];
    let groupedModelNames: string[];
    let randomModelNames: string[];

    await dialTest.step('Add some models to the users workspace', async () => {
      allModels = ModelsUtil.getModels().filter((m) => m.type === 'model');
      groupedModelNames = Array.from(
        ModelsUtil.groupEntitiesByName(allModels).keys(),
      );
      randomModelNames = GeneratorUtil.randomArrayElements(
        Array.from(groupedModelNames),
        2,
      );
      const randomModels = allModels.filter((m) =>
        randomModelNames.includes(m.name),
      );
      await fileApiHelper.updateInstalledDeployments(randomModels);
      await localStorageManager.setRecentModelsIdsOnce(...randomModels);
    });

    await dialTest.step(
      'Open Dial Marketplace, check Types=Model filter and verify all available models are displayed',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.type,
            EntityType.Model,
          )
          .click();
        await baseAssertion.assertElementsCount(
          marketplace.getAgents(),
          groupedModelNames.length,
        );
        const actualModels = await marketplaceAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualModels,
          groupedModelNames,
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Switch to "My Workspace" tab and verify only installed models are displayed, other models stay under "Suggested results"',
      async () => {
        await marketplaceSidebar.myWorkspaceButton.click();
        const filteredAgents = marketplace.getFilteredAgents();
        await baseAssertion.assertElementsCount(
          filteredAgents,
          randomModelNames.length,
        );
        const actualWorkspaceModels = await filteredAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualWorkspaceModels,
          randomModelNames,
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );

        const nonWorkspaceModels = allModels.filter(
          (m) => !randomModelNames.includes(m.name),
        );
        const expectedSuggestedModelNames = Array.from(
          ModelsUtil.groupEntitiesByName(nonWorkspaceModels).keys(),
        );
        const suggestedAgents = marketplace.getSuggestedAgents();
        await baseAssertion.assertElementsCount(
          suggestedAgents,
          expectedSuggestedModelNames.length,
        );
        const actualSuggestedModels = await suggestedAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedModels,
          expectedSuggestedModelNames,
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Remove all models from "My Workspace" and recent, reload the page and verify filter state is preserved',
      async () => {
        await fileApiHelper.updateInstalledDeployments([]);
        await localStorageManager.setRecentModelsIds();
        await marketplacePage.reloadPage();
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(
          marketplaceFilter.filterByPropertyOptions(
            MarketplaceFilterTypes.type,
          ),
          'visible',
        );
        await baseAssertion.assertCheckboxState(
          marketplaceFilter.filterByPropertyOptionInput(
            MarketplaceFilterTypes.type,
            EntityType.Model,
          ),
          CheckboxState.checked,
        );
      },
    );

    await dialTest.step(
      'Verify no models are found, other Marketplace models stay under "Suggested results"',
      async () => {
        await baseAssertion.assertElementState(
          marketplace.noWorkspaceResultsFound,
          'visible',
        );
        const suggestedAgents = marketplace.getSuggestedAgents();
        await baseAssertion.assertElementsCount(
          suggestedAgents,
          groupedModelNames.length,
        );
        const actualSuggestedModels = await suggestedAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualSuggestedModels,
          groupedModelNames,
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );
  },
);

dialTest(
  'Types: the filter is applied and search results are shown. Applications. DIAL Marketplace.\n' +
    'Types: the search results are updated if to remove/add custom application',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    modelApiHelper,
    marketplacePage,
    marketplaceHeader,
    marketplaceSidebar,
    marketplaceFilter,
    marketplaceAgents,
    marketplace,
    confirmationDialog,
    addAppDropdownMenu,
    appEditorPage,
    appEditorGeneralForm,
    appEditorViewForm,
    appEditorHeader,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-4441', 'EPMRTC-5353');
    const appName = GeneratorUtil.randomApplicationName();
    const addedAppName = GeneratorUtil.randomApplicationName();

    await dialTest.step('Create a custom application', async () => {
      const applicationModel = customApplicationBuilder
        .withDisplayName(appName)
        .withDisplayVersion(GeneratorUtil.randomApplicationVersion())
        .build();
      await applicationApiHelper.createApplication(applicationModel);
    });

    await dialTest.step(
      'Open Dial Marketplace, check Types=Applications filter and verify all available applications are displayed',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        const allApps = await modelApiHelper
          .getModels()
          .then((agents) =>
            agents.filter((agent) => agent.type === 'application'),
          );
        const expectedAppNames = Array.from(
          ModelsUtil.groupEntitiesByName(allApps).keys(),
        );
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.type,
            EntityType.Application,
          )
          .click();
        await baseAssertion.assertElementsCount(
          marketplace.getAgents(),
          expectedAppNames.length,
        );
        const actualModels = await marketplaceAgents.getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualModels,
          expectedAppNames,
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Switch to "My Workspace", create new custom app and verify it is immediately displayed',
      async () => {
        await marketplaceSidebar.myWorkspaceButton.click();
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await appEditorPage.waitForPageLoaded();
        await appEditorGeneralForm.fillInAppFields({
          name: addedAppName,
        });
        await appEditorGeneralForm.goNext();
        await appEditorViewForm.fillInAppFields();
        await appEditorHeader.saveAppAndExit();
        await marketplacePage.waitForPageLoaded();

        const actualFilteredModels = await marketplace
          .getFilteredAgents()
          .getAgentNames();
        baseAssertion.assertArrayIncludesAll(
          actualFilteredModels,
          [addedAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Delete added custom app and verify it disappears immediately',
      async () => {
        const filteredAgents = marketplace.getFilteredAgents();
        await filteredAgents.getAgent(addedAppName).hoverOver();
        await filteredAgents.getAgentDotsMenu(addedAppName).click();
        await filteredAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        const actualFilteredModels = await marketplace
          .getFilteredAgents()
          .getAgentNames();
        baseAssertion.assertArrayExcludesAll(
          actualFilteredModels,
          [addedAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );
  },
);
