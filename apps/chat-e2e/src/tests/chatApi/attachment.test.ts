import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  ModelIds,
} from '@/src/testData';
import { expect } from '@playwright/test';

const modelsForRequestWithAttachment: {
  modelId: string;
  isTextRequestRequired: boolean;
}[] = Array.of(
  { modelId: ModelIds.GPT_4_VISION_PREVIEW, isTextRequestRequired: false },
  { modelId: ModelIds.GEMINI_PRO_VISION, isTextRequestRequired: true },
);

let imageUrl: string;
dialTest.beforeEach(async ({ fileApiHelper }) => {
  imageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
});

for (const modelToUse of modelsForRequestWithAttachment) {
  dialTest(
    `Generate response on request with attachment for model: ${modelToUse.modelId}`,
    async ({ conversationData, chatApiHelper }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation =
        conversationData.prepareConversationWithAttachmentsInRequest(
          modelToUse.modelId,
          modelToUse.isTextRequestRequired,
          imageUrl,
        );
      const modelResponse = await chatApiHelper.postRequest(conversation);
      const status = modelResponse.status();
      expect
        .soft(
          status,
          `${ExpectedMessages.responseCodeIsValid}${modelToUse.modelId}`,
        )
        .toBe(200);

      const respBody = await modelResponse.text();
      const results = respBody.match(ExpectedConstants.responseContentPattern);
      const result = results?.join('');
      expect
        .soft(
          result,
          `${ExpectedMessages.responseTextIsValid}${modelToUse.modelId}`,
        )
        .toMatch(new RegExp('.*sun.*', 'i'));
    },
  );
}
