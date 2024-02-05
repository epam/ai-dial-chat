import test from '@/src/core/fixtures';
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
test.beforeAll(async ({ fileApiHelper }) => {
  imageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
});

for (const modelToUse of modelsForRequestWithAttachment) {
  test(`Generate response on request with attachment for model: ${modelToUse.modelId}`, async ({
    conversationData,
    chatApiHelper,
  }) => {
    const conversation = conversationData.prepareConversationWithAttachment(
      imageUrl,
      modelToUse.modelId,
      modelToUse.isTextRequestRequired,
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
  });
}

test.afterAll(async ({ fileApiHelper }) => {
  await fileApiHelper.deleteUploadedFile(Attachment.sunImageName);
});
