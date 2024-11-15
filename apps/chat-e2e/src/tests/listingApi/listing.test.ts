import test, { skipReason } from '@/src/core/baseFixtures';
import { Entity, ExpectedMessages } from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const expectedModels = process.env.MODELS_LIST_FOR_TESTS
  ? (JSON.parse(process.env.MODELS_LIST_FOR_TESTS) as Entity[])
  : [];
const expectedAddons = process.env.ADDONS_LIST_FOR_TESTS
  ? (JSON.parse(process.env.ADDONS_LIST_FOR_TESTS) as Entity[])
  : [];

test('Models API listing', async () => {
  test.skip(process.env.MODELS_LIST_FOR_TESTS === undefined, skipReason);
  const models = ModelsUtil.getModels();

  expect
    .soft(models.length, ExpectedMessages.entitiesCountIsValid)
    .toBe(expectedModels.length);

  expectedModels.forEach((model) => {
    const actualModel = ModelsUtil.getModel(model.entityId);
    expect
      .soft(actualModel, `${model}: ${ExpectedMessages.modelIsAvailable}`)
      .toBeDefined();
  });
});

test('Addons API listing', async () => {
  test.skip(process.env.ADDONS_LIST_FOR_TESTS === undefined, skipReason);
  const addons = ModelsUtil.getAddons();

  expect
    .soft(addons.length, ExpectedMessages.entitiesCountIsValid)
    .toBe(expectedAddons.length);

  expectedAddons.forEach((addon) => {
    const actualAddon = ModelsUtil.getAddon(addon.entityId);
    expect
      .soft(actualAddon, `${addon}: ${ExpectedMessages.addonIsAvailable}`)
      .toBeDefined();
  });
});
