import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  AddAppMenuOptions,
  CheckboxState,
  EntityEditorAppTypes,
  ExpectedMessages,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
} from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
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
    marketplaceEntitiesSection,
    navigationPanel,
    baseAssertion,
  }) => {
    dialTest.slow();
    setTestIds('EPMDIAL-2666', 'EPMDIAL-2667', 'EPMDIAL-2668', 'EPMDIAL-2657');
    let allModels: DialAIEntityModel[];
    let groupedModelNames: string[];
    let randomModelNames: string[];

    await dialTest.step('Add some models to the users workspace', async () => {
      allModels = ModelsUtil.getModels(false).filter((m) => m.type === 'model');
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
      await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
        ...randomModels,
      );
    });

    await dialTest.step(
      'Open DIAL Marketplace, check Types=Model filter and verify all available models are displayed',
      async () => {
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.type,
            EntityType.Model,
          )
          .click();
        const actualModels = await marketplaceEntitiesSection.getAllEntities();
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

    //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/6574
    await dialTest.step.skip(
      'Switch to "My Workspace" tab and verify only installed models are displayed, other models stay under "Suggested results"',
      async () => {
        await navigationPanel.goToMyWorkspace();
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        const actualWorkspaceModels = allAgents
          .filter((agent) => agent.isWorkspaceEntity)
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
        await localStorageManager.setRecentModelsIdsAndUseLastModel();
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
        //TODO: remove next line when fixed https://github.com/epam/ai-dial-chat/issues/6574
        await navigationPanel.goToMyWorkspace();
        await baseAssertion.assertElementState(
          marketplace.noWorkspaceResultsFound,
          'visible',
        );
        const suggestedAgents =
          await marketplaceEntitiesSection.getAllEntities();
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
    marketplaceEntities,
    marketplaceEntitiesSection,
    confirmationDialog,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorGeneralForm,
    customAppEditorViewForm,
    entityEditorHeader,
    setTestIds,
    baseAssertion,
    entityDetailsModal,
  }) => {
    setTestIds('EPMDIAL-2669', 'EPMDIAL-2670');
    const appName = GeneratorUtil.randomApplicationName();
    const addedAppName = GeneratorUtil.randomApplicationName();
    let addedAppElement: BaseElement;

    await dialTest.step('Create a custom application', async () => {
      const applicationModel = customApplicationBuilder
        .withDisplayName(appName)
        .withDisplayVersion(GeneratorUtil.randomEntityVersion())
        .build();
      await applicationApiHelper.createApplication(applicationModel);
    });

    await dialTest.step(
      'Open DIAL Marketplace, check Types=Applications filter and verify all available applications are displayed',
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
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        for (const actualAgent of actualAgents) {
          const actualAgentModel = allAgents.find(
            (app) => app.name === actualAgent.name,
          );
          if (actualAgentModel) {
            baseAssertion.assertValue(
              actualAgentModel.type,
              EntityType.Application,
              `${actualAgentModel.name} is not an ${EntityType.Application}`,
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
        await navigationPanel.goToMyWorkspace();
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.CustomApp,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: addedAppName,
        });
        await entityEditorGeneralForm.goNext({
          hostsArray: [
            API.applicationCreateHost,
            API.installedDeploymentsHost(),
          ],
        });
        await customAppEditorViewForm.fillInAppFields();
        await entityEditorHeader.focusOn({
          triggeredHost: API.applicationCreateHost,
        });
        await entityEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModal.closeButton.click();

        addedAppElement = await marketplaceEntitiesSection.findEntityElement(
          addedAppName,
          { isWorkspaceEntity: true, isEditable: true },
        );
        await baseAssertion.assertElementState(addedAppElement, 'visible');
      },
    );

    await dialTest.step(
      'Delete added custom app and verify it disappears immediately',
      async () => {
        await addedAppElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(addedAppElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertArrayExcludesAll(
          actualAgents
            .filter((agent) => agent.isWorkspaceEntity)
            .map((agent) => agent.name),
          [addedAppName],
          MarketplaceExpectedMessages.filteredAgentsAreValid,
        );
      },
    );
  },
);
