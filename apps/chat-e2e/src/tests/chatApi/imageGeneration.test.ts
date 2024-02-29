import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages, ModelIds } from '@/src/testData';
import { expect } from '@playwright/test';

const modelsForImageGeneration = Array.of(
  ModelIds.STABLE_DIFFUSION,
  ModelIds.DALLE,
  ModelIds.IMAGE_GENERATION_005,
);

let imageUrl: string | undefined;

for (const modelToUse of modelsForImageGeneration) {
  dialTest(
    `Generate image for model: ${modelToUse}`,
    async ({ conversationData, chatApiHelper }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
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
    },
  );
}
