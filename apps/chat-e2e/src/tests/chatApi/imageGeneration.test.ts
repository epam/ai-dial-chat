import test, { stateFilePath } from '@/src/core/fixtures';
import { ExpectedConstants, ExpectedMessages, ModelIds } from '@/src/testData';
import { expect } from '@playwright/test';

const modelsForImageGeneration = Array.of(
  ModelIds.STABLE_DIFFUSION,
  ModelIds.DALLE,
  ModelIds.IMAGE_GENERATION_005,
);

test.describe('Chat API request for image generation tests', () => {
  test.use({ storageState: stateFilePath });
  let imageUrl: string | undefined;

for (const modelToUse of modelsForImageGeneration) {
  test(`Generate image for model: ${modelToUse}`, async ({
    conversationData,
    chatApiHelper,
  }) => {
    const conversation =
      conversationData.prepareModelConversationBasedOnRequests(modelToUse, [
        'draw smiling emoticon',
      ]);

    const response = await chatApiHelper.postRequest(conversation);
    const status = response.status();
    expect
      .soft(status, `${ExpectedMessages.responseCodeIsValid}${modelToUse}`)
      .toBe(200);

    const respBody = await response.text();
    const result = respBody.match(ExpectedConstants.responseFileUrlPattern);
    imageUrl = result ? result[0] : undefined;
    expect
      .soft(
        imageUrl,
        `${ExpectedMessages.imageUrlReturnedInResponse}${modelToUse}`,
      )
      .toMatch(ExpectedConstants.responseFileUrlContentPattern(modelToUse));
  });
}

  test.afterEach(async ({ fileApiHelper }) => {
    if (imageUrl) {
      await fileApiHelper.deleteAppDataFile(imageUrl);
    }
  });
});
