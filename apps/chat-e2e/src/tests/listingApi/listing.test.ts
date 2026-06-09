import test, { skipReason } from '@/src/core/baseFixtures';
import { Entity, ExpectedMessages } from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const expectedModels = process.env.MODELS_LIST_FOR_TESTS
  ? (JSON.parse(process.env.MODELS_LIST_FOR_TESTS) as Entity[])
  : [];

test('Models API listing', async () => {
  test.skip(process.env.MODELS_LIST_FOR_TESTS === undefined, skipReason);
  const models = ModelsUtil.getModels(false);

  expect
    .soft(models, ExpectedMessages.entitiesCountIsValid)
    .toHaveLength(expectedModels.length);

  expectedModels.forEach((model) => {
    const actualModel = ModelsUtil.getModel(model.entityId);
    expect
      .soft(
        actualModel,
        `${model.entityId}: ${ExpectedMessages.modelIsAvailable}`,
      )
      .toBeDefined();
  });
});
