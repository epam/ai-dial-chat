import test from '@/e2e/src/core/fixtures';
import { AddonIds, ExpectedMessages, ModelIds } from '@/e2e/src/testData';
import { ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

const skipReason = 'Execute test on CI env only';

test('Models API listing', async () => {
  test.skip(process.env.E2E_HOST === undefined, skipReason);
  const models = ModelsUtil.getModels();
  const expectedModels = Object.values(ModelIds);

  expect
    .soft(models.length, ExpectedMessages.entitiesCountIsValid)
    .toBe(expectedModels.length);

  expectedModels.forEach((model) => {
    const actualModel = ModelsUtil.getModel(model);
    expect
      .soft(actualModel, `${model}: ${ExpectedMessages.modelIsAvailable}`)
      .toBeDefined();
  });
});

test('Addons API listing', async () => {
  test.skip(process.env.E2E_HOST === undefined, skipReason);
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
