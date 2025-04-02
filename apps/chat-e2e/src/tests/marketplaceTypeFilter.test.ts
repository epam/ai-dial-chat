import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  CheckboxState,
  ExpectedMessages,
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
    marketplaceAgentsSection,
    navigationPanel,
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
        const actualModels = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          actualModels.length,
          groupedModelNames.length,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          actualModels.map((model) => model.name),
          groupedModelNames,
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Switch to "My Workspace" tab and verify only installed models are displayed, other models stay under "Suggested results"',
      async () => {
        //remove next line when fixed https://github.com/epam/ai-dial-chat/issues/3303
        await marketplaceAgentsSection.goTop();
        await navigationPanel.myWorkspaceButton.click();
        const allAgents = await marketplaceAgentsSection.getAllAgents();
        const actualWorkspaceModels = allAgents
          .filter((agent) => agent.isWorkspaceAgent)
          .map((agent) => agent.name);
        baseAssertion.assertValue(
          actualWorkspaceModels.length,
          randomModelNames.length,
          ExpectedMessages.elementsCountIsValid,
        );
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
        const actualSuggestedModels = allAgents
          .filter((agent) => agent.isSuggested)
          .map((agent) => agent.name);
        baseAssertion.assertValue(
          actualSuggestedModels.length,
          expectedSuggestedModelNames.length,
          ExpectedMessages.elementsCountIsValid,
        );
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
        const suggestedAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          suggestedAgents.length,
          groupedModelNames.length,
          ExpectedMessages.elementsCountIsValid,
        );
        baseAssertion.assertArrayIncludesAll(
          suggestedAgents.map((agent) => agent.name),
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
    navigationPanel,
    marketplaceFilter,
    marketplaceAgents,
    marketplaceAgentsSection,
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
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.type,
            EntityType.Application,
          )
          .click();
        const allAgents = await modelApiHelper.getModels();
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        for (const actualAgent of actualAgents) {
          const actualAgentModel = allAgents.find(
            (app) => app.name === actualAgent.name,
          );
          if (actualAgentModel) {
            baseAssertion.assertValue(
              actualAgentModel.type,
              EntityType.Application,
            );
          }
        }
        baseAssertion.assertArrayIncludesAll(
          actualAgents.map((agent) => agent.name),
          [appName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Switch to "My Workspace", create new custom app and verify it is immediately displayed',
      async () => {
        await navigationPanel.myWorkspaceButton.click();
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

        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertArrayIncludesAll(
          actualAgents
            .filter((agent) => agent.isWorkspaceAgent)
            .map((agent) => agent.name),
          [addedAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );

    await dialTest.step(
      'Delete added custom app and verify it disappears immediately',
      async () => {
        const addedAppElement =
          await marketplaceAgentsSection.findAgentElement(addedAppName);
        await addedAppElement.hoverOver();
        await marketplaceAgents
          .getAgentElementDotsMenu(addedAppElement)
          .click();
        await marketplaceAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertArrayExcludesAll(
          actualAgents
            .filter((agent) => agent.isWorkspaceAgent)
            .map((agent) => agent.name),
          [addedAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );
  },
);
