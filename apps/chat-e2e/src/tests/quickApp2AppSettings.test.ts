import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { EntityEditorAppTypes } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialTest(
  "[Quick app 2.0] Only Model with the feature 'tools: true' can be set as Orchestrator\n" +
    "[Quick app 2.0] Temperature is not shown on App setting if 'temperature: false' and vice versa", // EPMRTC-7271 + EPMRTC-7092
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    talkToAgentDialog,
    customApplicationBuilder,
    applicationApiHelper,
    modelApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7271', 'EPMRTC-7092');
    const appName = GeneratorUtil.randomApplicationName();
    const excludedAppName = GeneratorUtil.randomApplicationName();
    let modelNoTemperature: DialAIEntityModel;
    let modelWithTemperature: DialAIEntityModel;
    let toolsUnsupportedModel: DialAIEntityModel;

    await dialTest.step(
      'Precondition: create a custom application and pick models by their feature flags',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(excludedAppName).build(),
        );
        const allEntities = await modelApiHelper.getModels();
        const toolModels = allEntities.filter(
          (entity) =>
            entity.type === EntityType.Model && entity.features?.tools,
        );
        modelNoTemperature = toolModels.find(
          (entity) => !entity.features?.temperature,
        )!;
        modelWithTemperature = toolModels.find(
          (entity) => entity.features?.temperature,
        )!;
        toolsUnsupportedModel = allEntities.find(
          (entity) =>
            entity.type === EntityType.Model && !entity.features?.tools,
        )!;
      },
    );

    await dialTest.step(
      'Open Quick app 2.0 creation page and proceed to App settings step',
      async () => {
        await marketplacePage.openCreateQuickApp2Page({
          updateInstalledEntities: false,
        });
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({ name: appName });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Open the model picker and verify only tool-supporting models are listed',
      async () => {
        await quickApp2EditorViewForm.changeModelButton.click();
        await baseAssertion.assertElementState(talkToAgentDialog, 'visible');
        await talkToAgentDialog.marketplaceTab.click();

        // A tool-supporting model is available to pick
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(modelNoTemperature.name);
        await baseAssertion.assertElementState(
          talkToAgentDialog.getEntityByName(modelNoTemperature.name),
          'visible',
        );

        // A custom application is not offered as an orchestrator
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(excludedAppName);
        await baseAssertion.assertElementState(
          talkToAgentDialog.getEntityByName(excludedAppName),
          'hidden',
        );
        await baseAssertion.assertElementState(
          talkToAgentDialog.noResultsFound,
          'visible',
        );

        // A model without the tools feature is not offered either
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(toolsUnsupportedModel.name);
        await baseAssertion.assertElementState(
          talkToAgentDialog.getEntityByName(toolsUnsupportedModel.name),
          'hidden',
        );
        await baseAssertion.assertElementState(
          talkToAgentDialog.noResultsFound,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Select the tool-supporting model without temperature and verify the temperature slider is hidden',
      async () => {
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(modelNoTemperature.name);
        await talkToAgentDialog
          .getEntityByName(modelNoTemperature.name)
          .click();
        await baseAssertion.assertElementState(talkToAgentDialog, 'hidden');
        await baseAssertion.assertElementContainsText(
          quickApp2EditorViewForm.orchestratorModelName,
          modelNoTemperature.name,
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.temperatureSlider,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Switch to a temperature-capable model and verify the temperature slider is shown',
      async () => {
        await quickApp2EditorViewForm.changeModelButton.click();
        await baseAssertion.assertElementState(talkToAgentDialog, 'visible');
        await talkToAgentDialog.marketplaceTab.click();
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(modelWithTemperature.name);
        await talkToAgentDialog
          .getEntityByName(modelWithTemperature.name)
          .click();
        await baseAssertion.assertElementState(talkToAgentDialog, 'hidden');
        await baseAssertion.assertElementContainsText(
          quickApp2EditorViewForm.orchestratorModelName,
          modelWithTemperature.name,
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.temperatureSlider,
          'visible',
        );
      },
    );
  },
);
