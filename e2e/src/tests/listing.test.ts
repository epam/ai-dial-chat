import test from '@/e2e/src/core/fixtures';
import {
  AddonIds,
  AssistantIds,
  ExpectedMessages,
  ModelIds,
} from '@/e2e/src/testData';
import { ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

test('Models API listing', async () => {
  test.skip(process.env.E2E_HOST === undefined, 'Execute test on CI env only');
  const models = ModelsUtil.getModels();
  const assistants = ModelsUtil.getAssistants();
  const expectedModels = Object.values(ModelIds);
  const expectedAssistants = Object.values(AssistantIds);

  expect
    .soft(
      models.length + assistants.length,
      ExpectedMessages.entitiesCountIsValid,
    )
    .toBe(expectedModels.length + expectedAssistants.length);

  expectedModels.forEach((model) => {
    const actualModel = ModelsUtil.getModel(model);
    expect
      .soft(actualModel, `${model}: ${ExpectedMessages.modelIsAvailable}`)
      .toBeDefined();
  });

  expectedAssistants.forEach((assistant) => {
    const actualAssistant = ModelsUtil.getAssistant(assistant);
    expect
      .soft(
        actualAssistant,
        `${assistant}: ${ExpectedMessages.assistantIsAvailable}`,
      )
      .toBeDefined();
  });
});

test('Addons API listing', async () => {
  test.skip(process.env.E2E_HOST === undefined, 'Execute test on CI env only');
  const addons = ModelsUtil.getAddons();
  const expectedAddons = Object.values(AddonIds);

  expect
    .soft(addons.length, ExpectedMessages.entitiesCountIsValid)
    .toBe(expectedAddons.length);

  expectedAddons.forEach((addon) => {
    const actualAddon = ModelsUtil.getAddon(addon);
    expect
      .soft(actualAddon, `${addon}: ${ExpectedMessages.addonIsAvailable}`)
      .toBeDefined();
  });
});
